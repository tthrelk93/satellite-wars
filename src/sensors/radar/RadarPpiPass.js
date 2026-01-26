import * as THREE from 'three';
import { RE_M } from '../../constants';

const DEFAULT_RADAR_CADENCE_SECONDS = 600;
const DEFAULT_SWEEP_PERIOD_SECONDS = 6.0;
const DEFAULT_SWEEP_BEAM_WIDTH_DEG = 1.2;
const DEFAULT_SWEEP_PAINT_WIDTH_DEG = 3.0;
const DEFAULT_SWEEP_PERSISTENCE_SECONDS = 12.0;

export class RadarPpiPass {
    constructor({ renderer, volume, specs, options = {} }) {
        this.renderer = renderer;
        this.volume = volume;
        this.specs = specs;
        this.radarCadenceSimSeconds = options.radarCadenceSimSeconds ?? DEFAULT_RADAR_CADENCE_SECONDS;
        this.sweepPeriodSeconds = options.sweepPeriodSeconds ?? DEFAULT_SWEEP_PERIOD_SECONDS;
        this.sweepBeamWidthDeg = options.sweepBeamWidthDeg ?? DEFAULT_SWEEP_BEAM_WIDTH_DEG;
        this.sweepPaintWidthDeg = options.sweepPaintWidthDeg ?? DEFAULT_SWEEP_PAINT_WIDTH_DEG;
        this.sweepPersistenceSeconds = options.sweepPersistenceSeconds ?? DEFAULT_SWEEP_PERSISTENCE_SECONDS;

        this.lastRenderSimTime = null;
        this.lastVolumeUploadSimTime = null;
        this.sweepAngleRad = Math.PI * 0.5;

        const ppiSizePx = specs?.ppiSizePx ?? 512;
        this.renderTarget = new THREE.WebGLRenderTarget(ppiSizePx, ppiSizePx, {
            depthBuffer: false,
            stencilBuffer: false
        });
        this.renderTarget.texture.minFilter = THREE.LinearFilter;
        this.renderTarget.texture.magFilter = THREE.LinearFilter;
        this.renderTarget.texture.generateMipmaps = false;

        this.fullTarget = new THREE.WebGLRenderTarget(ppiSizePx, ppiSizePx, {
            depthBuffer: false,
            stencilBuffer: false
        });
        this.fullTarget.texture.minFilter = THREE.LinearFilter;
        this.fullTarget.texture.magFilter = THREE.LinearFilter;
        this.fullTarget.texture.generateMipmaps = false;

        this._accumTargetA = this.renderTarget;
        this._accumTargetB = new THREE.WebGLRenderTarget(ppiSizePx, ppiSizePx, {
            depthBuffer: false,
            stencilBuffer: false
        });
        this._accumTargetB.texture.minFilter = THREE.LinearFilter;
        this._accumTargetB.texture.magFilter = THREE.LinearFilter;
        this._accumTargetB.texture.generateMipmaps = false;
        this._accumUseA = true;
        this._accumDirty = true;

        this.scene = new THREE.Scene();
        this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this._initMaterial();
        this._initAccumComposer();

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

                outColor = vec4(color, alpha);
            }
        `;

        return { vertex, fragment };
    }

    _initAccumComposer() {
        const uniforms = {
            prevTex: { value: this._accumTargetA.texture },
            fullTex: { value: this.fullTarget.texture },
            sweepAngleRad: { value: this.sweepAngleRad },
            paintWidthRad: { value: THREE.MathUtils.degToRad(this.sweepPaintWidthDeg) },
            fade: { value: 0.99 }
        };
        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                precision highp sampler2D;

                in vec2 vUv;
                uniform sampler2D prevTex;
                uniform sampler2D fullTex;
                uniform float sweepAngleRad;
                uniform float paintWidthRad;
                uniform float fade;

                out vec4 outColor;

                float wrapAngle(float a) {
                    return atan(sin(a), cos(a));
                }

                void main() {
                    vec2 uv = vUv;
                    vec2 o = (uv - 0.5) * 2.0;
                    float r = length(o);
                    if (r > 1.0) {
                        outColor = vec4(0.0);
                        return;
                    }

                    vec4 prev = texture(prevTex, uv);
                    prev.rgb *= fade;
                    prev.a *= fade;

                    vec4 src = texture(fullTex, uv);
                    float ang = atan(o.y, o.x);
                    float d = abs(wrapAngle(ang - sweepAngleRad));
                    float mask = 1.0 - smoothstep(paintWidthRad, paintWidthRad * 1.25, d);
                    src.a *= mask;

                    float outA = src.a + prev.a * (1.0 - src.a);
                    vec3 outRGB = outA > 1e-6
                        ? (src.rgb * src.a + prev.rgb * prev.a * (1.0 - src.a)) / outA
                        : vec3(0.0);
                    outColor = vec4(outRGB, outA);
                }
            `,
            glslVersion: THREE.GLSL3,
            depthWrite: false,
            depthTest: false,
            transparent: true
        });
        const scene = new THREE.Scene();
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(quad);
        this._accumScene = scene;
        this._accumMaterial = material;
        this._accumQuad = quad;
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

    resetSweep() {
        this.sweepAngleRad = Math.PI * 0.5;
        this.lastRenderSimTime = null;
        this._accumDirty = true;
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

        this.renderer.setRenderTarget(this.fullTarget);
        this.renderer.render(this.scene, this.orthoCam);
        this.renderer.setRenderTarget(null);

        this.lastRenderSimTime = simTimeSeconds;
        this.lastVolumeUploadSimTime = uploadSimTime;
        return true;
    }

    _clearTarget(target) {
        const renderer = this.renderer;
        if (!renderer || !target) return;
        const prevTarget = renderer.getRenderTarget();
        const prevColor = new THREE.Color();
        renderer.getClearColor(prevColor);
        const prevAlpha = renderer.getClearAlpha();
        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.setRenderTarget(prevTarget);
        renderer.setClearColor(prevColor, prevAlpha);
        renderer.autoClear = prevAutoClear;
    }

    updateSweep({ simTimeSeconds, realDtSeconds }) {
        if (!Number.isFinite(realDtSeconds) || realDtSeconds <= 0) return false;
        if (!this._accumMaterial || !this._accumScene) return false;

        if (Number.isFinite(simTimeSeconds)) {
            this.render({ simTimeSeconds });
        }
        if (this._accumDirty) {
            this._clearTarget(this._accumTargetA);
            this._clearTarget(this._accumTargetB);
            this._accumDirty = false;
        }

        const period = Math.max(0.5, Number(this.sweepPeriodSeconds) || DEFAULT_SWEEP_PERIOD_SECONDS);
        const omega = (2 * Math.PI) / period;
        this.sweepAngleRad = (this.sweepAngleRad + omega * realDtSeconds) % (2 * Math.PI);

        const persistence = Math.max(0.25, Number(this.sweepPersistenceSeconds) || DEFAULT_SWEEP_PERSISTENCE_SECONDS);
        const fade = Math.exp(-realDtSeconds / persistence);

        const src = this._accumUseA ? this._accumTargetA : this._accumTargetB;
        const dst = this._accumUseA ? this._accumTargetB : this._accumTargetA;

        this._accumMaterial.uniforms.prevTex.value = src.texture;
        this._accumMaterial.uniforms.fullTex.value = this.fullTarget.texture;
        this._accumMaterial.uniforms.sweepAngleRad.value = this.sweepAngleRad;
        this._accumMaterial.uniforms.paintWidthRad.value = THREE.MathUtils.degToRad(this.sweepPaintWidthDeg);
        this._accumMaterial.uniforms.fade.value = fade;

        this.renderer.setRenderTarget(dst);
        this.renderer.render(this._accumScene, this.orthoCam);
        this.renderer.setRenderTarget(null);

        this._accumUseA = !this._accumUseA;
        this.renderTarget = dst;
        if (this.hudMesh?.material) {
            this.hudMesh.material.map = this.renderTarget.texture;
            this.hudMesh.material.needsUpdate = true;
        }
        return true;
    }

    dispose() {
        this.renderTarget?.dispose?.();
        this.fullTarget?.dispose?.();
        this._accumTargetB?.dispose?.();
        this.material?.dispose?.();
        this._accumMaterial?.dispose?.();
        this.quad?.geometry?.dispose?.();
        this._accumQuad?.geometry?.dispose?.();
        this.hudMesh?.geometry?.dispose?.();
        this.hudMesh?.material?.dispose?.();
        this.hudBorder?.geometry?.dispose?.();
        this.hudBorder?.material?.dispose?.();
    }
}
