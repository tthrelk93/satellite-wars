import * as THREE from 'three';
import { RE_M } from '../../constants';

const DEFAULT_RADAR_CADENCE_SECONDS = 600;

export class RadarPpiPass {
    constructor({ renderer, volume, specs, options = {} }) {
        this.renderer = renderer;
        this.volume = volume;
        this.specs = specs;
        this.radarCadenceSimSeconds = options.radarCadenceSimSeconds ?? DEFAULT_RADAR_CADENCE_SECONDS;

        this.lastRenderSimTime = null;
        this.lastVolumeUploadSimTime = null;

        const ppiSizePx = specs?.ppiSizePx ?? 512;
        this.renderTarget = new THREE.WebGLRenderTarget(ppiSizePx, ppiSizePx, {
            depthBuffer: false,
            stencilBuffer: false
        });
        this.renderTarget.texture.minFilter = THREE.LinearFilter;
        this.renderTarget.texture.magFilter = THREE.LinearFilter;
        this.renderTarget.texture.generateMipmaps = false;

        this.scene = new THREE.Scene();
        this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this._initMaterial();

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.scene.add(quad);
        this.quad = quad;
        this.hudMesh = null;
        this.hudBorder = null;
    }

    _initMaterial() {
        const uniforms = this._buildUniforms();
        const nz = uniforms.nz?.value ?? 1;
        const shader = this._buildShader(nz);

        this.material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: shader.vertex,
            fragmentShader: shader.fragment,
            glslVersion: THREE.GLSL3,
            depthWrite: false,
            depthTest: false,
            transparent: true
        });
    }

    _buildUniforms() {
        const volumeUniforms = this.volume?.uniforms || this.volume?.getUniforms?.();
        const nzRaw = Number.isFinite(volumeUniforms?.nz) ? volumeUniforms.nz : 1;
        const nz = Math.max(1, nzRaw);
        let sigmaMidSrc = volumeUniforms?.sigmaMid;
        if (!sigmaMidSrc || sigmaMidSrc.length < nz) {
            sigmaMidSrc = new Float32Array(nz);
            for (let lev = 0; lev < nz; lev += 1) {
                sigmaMidSrc[lev] = (lev + 0.5) / nz;
            }
        }
        const sigmaMid = new Float32Array(nz);
        sigmaMid.set(sigmaMidSrc.subarray(0, nz));
        const elevRad = THREE.MathUtils.degToRad(this.specs?.elevationDeg ?? 0.5);
        return {
            weatherTex3D: { value: this.volume?.weatherTex3D ?? null },
            psTex2D: { value: this.volume?.psTex2D ?? null },
            lat0Rad: { value: 0 },
            lon0Rad: { value: 0 },
            cosLat0: { value: 1 },
            rangeMaxM: { value: (this.specs?.rangeMaxKm ?? 300) * 1000 },
            elevRad: { value: elevRad },
            ReM: { value: RE_M },
            pTopPa: { value: volumeUniforms?.pTopPa ?? 20000 },
            sigmaMid: { value: sigmaMid },
            nz: { value: nz },
            scaleHeightM: { value: volumeUniforms?.scaleHeightM ?? 8000 },
            p0Pa: { value: 100000 },
            psToPa: { value: volumeUniforms?.psToPa ?? this.volume?.psToPa ?? 100 },
            iceFactor: { value: 0.2 },
            qMin: { value: 1e-5 },
            dbzMin: { value: 10.0 },
            dbzAlphaSpan: { value: 12.0 },
            zExponent: { value: 2.0 },
            zScale: { value: 2e9 },
            ringStepKm: { value: 50.0 },
            ringWidthKm: { value: 1.5 }
        };
    }

    _buildShader(nz) {
        const nzSafe = Math.max(1, nz);
        const nzMinus1 = Math.max(0, nzSafe - 1);
        const vertex = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragment = `
            precision highp float;
            precision highp sampler2D;
            precision highp sampler3D;

            in vec2 vUv;
            uniform sampler3D weatherTex3D;
            uniform sampler2D psTex2D;

            uniform float lat0Rad;
            uniform float lon0Rad;
            uniform float cosLat0;
            uniform float rangeMaxM;
            uniform float elevRad;

            uniform float ReM;
            uniform float pTopPa;
            uniform float scaleHeightM;
            uniform float p0Pa;
            uniform float psToPa;
            uniform float iceFactor;
            uniform float qMin;
            uniform float dbzMin;
            uniform float dbzAlphaSpan;
            uniform float zExponent;
            uniform float zScale;
            uniform float ringStepKm;
            uniform float ringWidthKm;
            uniform int nz;
            uniform float sigmaMid[${nzSafe}];

            out vec4 outColor;

            const float PI = 3.141592653589793;

            vec3 radarColor(float dbz) {
                if (dbz < 20.0) {
                    float t = clamp((dbz - dbzMin) / 15.0, 0.0, 1.0);
                    return mix(vec3(0.0, 0.3, 0.0), vec3(0.0, 1.0, 0.0), t);
                }
                if (dbz < 35.0) {
                    float t = (dbz - 20.0) / 15.0;
                    return mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), t);
                }
                if (dbz < 50.0) {
                    float t = (dbz - 35.0) / 15.0;
                    return mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), t);
                }
                if (dbz < 60.0) {
                    float t = (dbz - 50.0) / 10.0;
                    return mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 1.0), t);
                }
                return vec3(1.0);
            }

            void main() {
                vec2 offset = (vUv - 0.5) * 2.0;
                float eastM = offset.x * rangeMaxM;
                float northM = offset.y * rangeMaxM;
                float rangeM = length(vec2(eastM, northM));
                if (rangeM > rangeMaxM) {
                    outColor = vec4(0.0);
                    return;
                }

                float dLat = northM / ReM;
                float dLon = eastM / (ReM * max(1e-6, cosLat0));
                float lat = lat0Rad + dLat;
                float lon = lon0Rad + dLon;

                float u = fract(lon / (2.0 * PI) + 0.5);
                float v = clamp(0.5 - lat / PI, 0.0, 1.0);

                float hM = rangeM * tan(elevRad);
                float p = p0Pa * exp(-hM / scaleHeightM);

                float ps = texture(psTex2D, vec2(u, v)).r * psToPa;
                float den = max(1.0, ps - pTopPa);
                float sigma = clamp((p - pTopPa) / den, 0.0, 1.0);

                float levF = float(nz - 1);
                if (sigma <= sigmaMid[0]) {
                    levF = 0.0;
                } else {
                    for (int k = 0; k < ${nzMinus1}; k += 1) {
                        float s0 = sigmaMid[k];
                        float s1 = sigmaMid[k + 1];
                        if (sigma <= s1) {
                            float denom = max(1e-6, s1 - s0);
                            float t = (sigma - s0) / denom;
                            levF = float(k) + t;
                            break;
                        }
                    }
                }

                float z = (levF + 0.5) / float(${nzSafe});
                vec4 s = texture(weatherTex3D, vec3(u, v, z));
                float qr = max(0.0, s.r);
                float qi = max(0.0, s.g);
                float qSum = qr + iceFactor * qi;

                float dbz = -999.0;
                if (qSum >= qMin) {
                    float zProxy = max(1e-12, zScale * pow(qSum, zExponent));
                    dbz = 4.3429448 * log(zProxy);
                    dbz = clamp(dbz, -10.0, 70.0);
                }

                float alpha = 0.0;
                vec3 color = vec3(0.0);
                if (dbz >= dbzMin) {
                    color = radarColor(dbz);
                    alpha = smoothstep(dbzMin, dbzMin + dbzAlphaSpan, dbz) * 0.9;
                }

                float rangeKm = rangeM / 1000.0;
                float stepKm = max(1.0, ringStepKm);
                float d = mod(rangeKm, stepKm);
                d = min(d, stepKm - d);
                float ring = 1.0 - smoothstep(ringWidthKm, 2.0 * ringWidthKm, d);
                float rangeMaxKm = rangeMaxM / 1000.0;
                float edge = 1.0 - smoothstep(ringWidthKm, 2.0 * ringWidthKm, abs(rangeKm - rangeMaxKm));
                ring = max(ring, edge);
                if (ring > 0.0) {
                    float ringBlend = clamp(ring * 0.15, 0.0, 1.0);
                    color = mix(color, vec3(0.9), ringBlend);
                    alpha = max(alpha, ring * 0.25);
                }

                if (rangeKm < 2.0) {
                    float center = 1.0 - smoothstep(0.5, 2.0, rangeKm);
                    color = mix(color, vec3(1.0), center * 0.5);
                    alpha = max(alpha, center * 0.6);
                }

                outColor = vec4(color, alpha);
            }
        `;

        return { vertex, fragment };
    }

    attachHudToCamera(camera, hudOptions = {}) {
        if (!camera) return;
        const planeDistance = hudOptions.planeDistance ?? 5000;
        const marginFrac = hudOptions.marginFrac ?? 0.04;
        const widthFrac = hudOptions.widthFrac ?? 0.28;

        const planeGeo = new THREE.PlaneGeometry(1, 1);
        const planeMat = new THREE.MeshBasicMaterial({
            map: this.renderTarget.texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.renderOrder = 998;
        plane.frustumCulled = false;

        if (camera.isPerspectiveCamera) {
            const viewH = 2 * planeDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
            const viewW = viewH * camera.aspect;
            const planeW = viewW * widthFrac;
            const planeH = planeW;
            const margin = viewH * marginFrac;
            plane.scale.set(planeW, planeH, 1);
            plane.position.set(
                -viewW * 0.5 + planeW * 0.5 + margin,
                -viewH * 0.5 + planeH * 0.5 + margin,
                -planeDistance
            );
        } else {
            plane.position.set(0, 0, -planeDistance);
        }

        camera.add(plane);
        this.hudMesh = plane;

        if (hudOptions.border !== false) {
            const borderGeo = new THREE.PlaneGeometry(1, 1);
            const borderMat = new THREE.MeshBasicMaterial({
                color: 0x111111,
                depthTest: false,
                depthWrite: false
            });
            const border = new THREE.Mesh(borderGeo, borderMat);
            border.renderOrder = 997;
            border.frustumCulled = false;
            border.scale.copy(plane.scale).multiplyScalar(1.06);
            border.position.copy(plane.position).add(new THREE.Vector3(0, 0, -1));
            camera.add(border);
            this.hudBorder = border;
        }
    }

    setOriginLatLonRad(lat0Rad, lon0Rad) {
        const lat = Number.isFinite(lat0Rad) ? lat0Rad : 0;
        const lon = Number.isFinite(lon0Rad) ? lon0Rad : 0;
        this.material.uniforms.lat0Rad.value = lat;
        this.material.uniforms.lon0Rad.value = lon;
        this.material.uniforms.cosLat0.value = Math.cos(lat);
    }

    render({ simTimeSeconds }) {
        if (!this.volume?.weatherTex3D || !this.volume?.psTex2D) return false;
        if (!Number.isFinite(simTimeSeconds)) return false;

        const uploadSimTime = this.volume.lastUploadSimTime;
        const uploadChanged = uploadSimTime !== null && uploadSimTime !== this.lastVolumeUploadSimTime;
        const cadenceOk = this.lastRenderSimTime === null
            || simTimeSeconds - this.lastRenderSimTime >= this.radarCadenceSimSeconds;

        if (!uploadChanged && !cadenceOk) return false;

        this.material.uniforms.weatherTex3D.value = this.volume.weatherTex3D;
        this.material.uniforms.psTex2D.value = this.volume.psTex2D;

        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(this.scene, this.orthoCam);
        this.renderer.setRenderTarget(null);

        this.lastRenderSimTime = simTimeSeconds;
        this.lastVolumeUploadSimTime = uploadSimTime;
        return true;
    }

    dispose() {
        this.renderTarget?.dispose?.();
        this.material?.dispose?.();
        this.quad?.geometry?.dispose?.();
        this.hudMesh?.geometry?.dispose?.();
        this.hudMesh?.material?.dispose?.();
        this.hudBorder?.geometry?.dispose?.();
        this.hudBorder?.material?.dispose?.();
    }
}
