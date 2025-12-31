import * as THREE from 'three';
import { RE_M } from '../../constants';

const DEFAULT_SEGMENTS = 256;

export class RadarPpiOverlay {
    constructor({ ppiPass, earthRadiusKm, options = {} }) {
        this.ppiPass = ppiPass;
        this.earthRadiusKm = earthRadiusKm;
        this.opacity = options.opacity ?? 1.0;
        this.backgroundAlpha = options.backgroundAlpha ?? 0.10;
        this.backgroundColor = options.backgroundColor ?? [0.0, 0.0, 0.0];
        this.edgeFadeFrac = options.edgeFadeFrac ?? 0.03;
        this.radiusOffsetKm = options.radiusOffsetKm ?? 10;
        this.segments = options.segments ?? DEFAULT_SEGMENTS;

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
            edgeFadeFrac: { value: this.edgeFadeFrac }
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

                out vec4 outColor;

                const float PI = 3.141592653589793;

                void main() {
                    vec3 dir = normalize(vDir);
                    float lat = asin(clamp(dir.y, -1.0, 1.0));
                    float lon = atan(-dir.z, dir.x);

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

                    float outA = baseA + echoA * (1.0 - baseA);
                    vec3 outRGB = outA > 1e-6
                        ? (baseRGB * baseA + echoRGB * echoA * (1.0 - baseA)) / outA
                        : vec3(0.0);
                    outColor = vec4(outRGB, outA);
                }
            `,
            glslVersion: THREE.GLSL3,
            transparent: true,
            depthWrite: false,
            depthTest: true,
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
