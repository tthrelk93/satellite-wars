import * as THREE from 'three';
import { RE_M } from '../../constants';

const DEFAULT_SEGMENTS = 256;

export class RadarPpiOverlay {
    constructor({ ppiPass, earthRadiusKm, options = {} }) {
        this.ppiPass = ppiPass;
        this.earthRadiusKm = earthRadiusKm;
        this.opacity = options.opacity ?? 1.0;
        this.backgroundAlpha = options.backgroundAlpha ?? 0.0;
        this.backgroundColor = options.backgroundColor ?? [0.0, 0.0, 0.0];
        this.edgeFadeFrac = options.edgeFadeFrac ?? 0.03;
        this.radiusOffsetKm = options.radiusOffsetKm ?? 10;
        this.segments = options.segments ?? DEFAULT_SEGMENTS;
        this.sweepLineWidthDeg = options.sweepLineWidthDeg ?? 1.2;
        this.sweepGlowWidthDeg = options.sweepGlowWidthDeg ?? 6.0;
        this.sweepLineAlpha = options.sweepLineAlpha ?? 0.25;
        this.sweepLineColor = options.sweepLineColor ?? [0.0, 1.0, 0.5];
        this.minEchoAlpha = options.minEchoAlpha ?? 0.08;
        this.blending = options.blending ?? THREE.AdditiveBlending;

        this._initMesh();
    }

    _initMesh() {
        const radius = this.earthRadiusKm + this.radiusOffsetKm;
        const geometry = new THREE.SphereGeometry(radius, this.segments, this.segments);
        const backgroundColor = Array.isArray(this.backgroundColor)
            ? new THREE.Color(this.backgroundColor[0], this.backgroundColor[1], this.backgroundColor[2])
            : this.backgroundColor;
        const uniforms = {
            ppiTex: { value: this.ppiPass?.renderTarget?.texture ?? null },
            lat0Rad: { value: 0 },
            lon0Rad: { value: 0 },
            cosLat0: { value: 1 },
            rangeMaxM: { value: (this.ppiPass?.specs?.rangeMaxKm ?? 300) * 1000 },
            ReM: { value: RE_M },
            overlayAlpha: { value: this.opacity },
            backgroundAlpha: { value: this.backgroundAlpha },
            backgroundColor: { value: backgroundColor },
            edgeFadeFrac: { value: this.edgeFadeFrac },
            sweepAngleRad: { value: Math.PI * 0.5 },
            sweepLineWidthRad: { value: THREE.MathUtils.degToRad(this.sweepLineWidthDeg) },
            sweepGlowWidthRad: { value: THREE.MathUtils.degToRad(this.sweepGlowWidthDeg) },
            sweepLineAlpha: { value: this.sweepLineAlpha },
            sweepLineColor: {
                value: Array.isArray(this.sweepLineColor)
                    ? new THREE.Color(this.sweepLineColor[0], this.sweepLineColor[1], this.sweepLineColor[2])
                    : this.sweepLineColor
            },
            minEchoAlpha: { value: this.minEchoAlpha }
        };

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                out vec3 vDir;
                void main() {
                    vDir = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                precision highp sampler2D;

                in vec3 vDir;
                uniform sampler2D ppiTex;
                uniform float lat0Rad;
                uniform float lon0Rad;
                uniform float cosLat0;
                uniform float rangeMaxM;
                uniform float ReM;
                uniform float overlayAlpha;
                uniform float backgroundAlpha;
                uniform vec3 backgroundColor;
                uniform float edgeFadeFrac;
                uniform float sweepAngleRad;
                uniform float sweepLineWidthRad;
                uniform float sweepGlowWidthRad;
                uniform float sweepLineAlpha;
                uniform vec3 sweepLineColor;
                uniform float minEchoAlpha;

                out vec4 outColor;

                const float PI = 3.141592653589793;
                float wrapAngle(float a) {
                    return atan(sin(a), cos(a));
                }

                void main() {
                    vec3 dir = normalize(vDir);
                    float lat = asin(clamp(dir.y, -1.0, 1.0));
                    float lon = atan(dir.x, dir.z);

                    float dLon = atan(sin(lon - lon0Rad), cos(lon - lon0Rad));
                    float dLat = lat - lat0Rad;

                    float eastM = dLon * ReM * cosLat0;
                    float northM = dLat * ReM;
                    float rangeM = length(vec2(eastM, northM));

                    if (rangeM > rangeMaxM) {
                        outColor = vec4(0.0);
                        return;
                    }

                    float edge = 1.0 - smoothstep(rangeMaxM * (1.0 - edgeFadeFrac), rangeMaxM, rangeM);
                    vec2 uv = vec2(eastM / (2.0 * rangeMaxM) + 0.5, northM / (2.0 * rangeMaxM) + 0.5);
                    vec4 ppi = texture(ppiTex, uv);

                    float baseA = backgroundAlpha * edge;
                    vec3 baseRGB = backgroundColor;
                    float echoA = ppi.a * overlayAlpha * edge;
                    vec3 echoRGB = ppi.rgb;
                    float ppiLum = dot(ppi.rgb, vec3(0.333333));
                    if (ppi.a < 1e-4 || ppiLum < 1e-4) {
                        echoA = 0.0;
                        echoRGB = vec3(0.0);
                    }
                    if (echoA < minEchoAlpha) {
                        echoA = 0.0;
                        echoRGB = vec3(0.0);
                    }

                    float outA = baseA + echoA * (1.0 - baseA);
                    vec3 outRGB = outA > 1e-6
                        ? (baseRGB * baseA + echoRGB * echoA * (1.0 - baseA)) / outA
                        : vec3(0.0);

                    float az = atan(northM, eastM);
                    float dAz = abs(wrapAngle(az - sweepAngleRad));
                    float glow = 1.0 - smoothstep(sweepGlowWidthRad, sweepGlowWidthRad * 1.25, dAz);
                    float core = 1.0 - smoothstep(sweepLineWidthRad, sweepLineWidthRad * 1.10, dAz);
                    float sweep = max(core, 0.35 * glow);
                    float sweepA = sweepLineAlpha * sweep * edge;
                    vec3 sweepRGB = sweepLineColor;

                    float finalA = outA + sweepA * (1.0 - outA);
                    vec3 finalRGB = finalA > 1e-6
                        ? (outRGB * outA + sweepRGB * sweepA * (1.0 - outA)) / finalA
                        : vec3(0.0);
                    if (finalA < 1e-4) {
                        discard;
                    }
                    outColor = vec4(finalRGB, finalA);
                }
            `,
            glslVersion: THREE.GLSL3,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: this.blending,
            side: THREE.FrontSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.renderOrder = 4;
    }

    setOriginLatLonRad(lat0Rad, lon0Rad) {
        const lat = Number.isFinite(lat0Rad) ? lat0Rad : 0;
        const lon = Number.isFinite(lon0Rad) ? lon0Rad : 0;
        const uniforms = this.mesh.material.uniforms;
        uniforms.lat0Rad.value = lat;
        uniforms.lon0Rad.value = lon;
        uniforms.cosLat0.value = Math.cos(lat);
    }

    setSweepAngleRad(angleRad) {
        if (!this.mesh?.material?.uniforms?.sweepAngleRad) return;
        this.mesh.material.uniforms.sweepAngleRad.value = Number.isFinite(angleRad) ? angleRad : 0;
    }

    updateTexture() {
        if (this.mesh?.material?.uniforms?.ppiTex) {
            this.mesh.material.uniforms.ppiTex.value = this.ppiPass?.renderTarget?.texture ?? null;
        }
    }

    dispose() {
        this.mesh?.geometry?.dispose?.();
        this.mesh?.material?.dispose?.();
    }
}
