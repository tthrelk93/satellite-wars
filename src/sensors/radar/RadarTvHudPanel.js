import * as THREE from 'three';
import { RE_M } from '../../constants';
import earthmap from '../../8081_earthmap10k.jpg';

const DEFAULT_OPTIONS = {
    corner: 'bottomLeft',
    widthFrac: 0.26,
    marginFrac: 0.04,
    planeDistance: 5000,
    baseDarken: 0.65,
    baseDesat: 0.6
};

let cachedBaseMapTex = null;

const getBaseMapTexture = () => {
    if (cachedBaseMapTex) return cachedBaseMapTex;
    const texture = new THREE.TextureLoader().load(earthmap);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    cachedBaseMapTex = texture;
    return cachedBaseMapTex;
};

export class RadarTvHudPanel {
    constructor({ renderer, camera, ppiPass, options = {} }) {
        this.renderer = renderer;
        this.camera = camera;
        this.ppiPass = ppiPass;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.mesh = null;
        this.material = null;

        this._initMesh();
        if (camera) {
            this.attachToCamera(camera, this.options);
        }
    }

    _initMesh() {
        const ppiTex = this.ppiPass?.renderTarget?.texture ?? null;
        const baseMapTex = getBaseMapTexture();
        const rangeMaxM = (this.ppiPass?.specs?.rangeMaxKm ?? 300) * 1000;

        const uniforms = {
            ppiTex: { value: ppiTex },
            baseMapTex: { value: baseMapTex },
            lat0Rad: { value: 0 },
            lon0Rad: { value: 0 },
            cosLat0: { value: 1 },
            rangeMaxM: { value: rangeMaxM },
            ReM: { value: RE_M },
            baseDarken: { value: this.options.baseDarken },
            baseDesat: { value: this.options.baseDesat }
        };

        this.material = new THREE.ShaderMaterial({
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
                uniform sampler2D ppiTex;
                uniform sampler2D baseMapTex;
                uniform float lat0Rad;
                uniform float lon0Rad;
                uniform float cosLat0;
                uniform float rangeMaxM;
                uniform float ReM;
                uniform float baseDarken;
                uniform float baseDesat;

                out vec4 outColor;

                const float PI = 3.141592653589793;

                void main() {
                    float eastM = (vUv.x - 0.5) * 2.0 * rangeMaxM;
                    float northM = (vUv.y - 0.5) * 2.0 * rangeMaxM;
                    float rangeM = length(vec2(eastM, northM));

                    float lat = lat0Rad + northM / ReM;
                    float lon = lon0Rad + eastM / (ReM * max(1e-6, cosLat0));

                    float uMap = fract(lon / (2.0 * PI) + 0.5);
                    float vMap = clamp(0.5 - lat / PI, 0.0, 1.0);

                    vec3 base = texture(baseMapTex, vec2(uMap, vMap)).rgb;
                    float luma = dot(base, vec3(0.299, 0.587, 0.114));
                    base = mix(base, vec3(luma), baseDesat);
                    base *= baseDarken;

                    if (rangeM > rangeMaxM) {
                        base *= 0.65;
                    }

                    vec4 ppi = texture(ppiTex, vUv);
                    vec3 finalColor = mix(base, ppi.rgb, ppi.a);
                    outColor = vec4(finalColor, 1.0);
                }
            `,
            glslVersion: THREE.GLSL3,
            depthWrite: false,
            depthTest: false
        });

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
        this.mesh.renderOrder = 995;
        this.mesh.frustumCulled = false;
    }

    attachToCamera(camera, opts = {}) {
        if (!camera || !this.mesh) return;
        this.camera = camera;
        const corner = opts.corner ?? this.options.corner;
        const planeDistance = opts.planeDistance ?? this.options.planeDistance;
        const widthFrac = opts.widthFrac ?? this.options.widthFrac;
        const marginFrac = opts.marginFrac ?? this.options.marginFrac;

        if (camera.isPerspectiveCamera) {
            const viewH = 2 * planeDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
            const viewW = viewH * camera.aspect;
            const planeW = viewW * widthFrac;
            const planeH = planeW;
            const margin = viewH * marginFrac;

            let x = -viewW * 0.5 + planeW * 0.5 + margin;
            let y = -viewH * 0.5 + planeH * 0.5 + margin;
            if (corner === 'bottomRight') {
                x = viewW * 0.5 - planeW * 0.5 - margin;
            } else if (corner === 'topLeft') {
                y = viewH * 0.5 - planeH * 0.5 - margin;
            } else if (corner === 'topRight') {
                x = viewW * 0.5 - planeW * 0.5 - margin;
                y = viewH * 0.5 - planeH * 0.5 - margin;
            }

            this.mesh.scale.set(planeW, planeH, 1);
            this.mesh.position.set(x, y, -planeDistance);
        } else {
            this.mesh.position.set(0, 0, -planeDistance);
        }

        camera.add(this.mesh);
    }

    setOriginLatLonRad(lat0Rad, lon0Rad) {
        const lat = Number.isFinite(lat0Rad) ? lat0Rad : 0;
        const lon = Number.isFinite(lon0Rad) ? lon0Rad : 0;
        const uniforms = this.material?.uniforms;
        if (!uniforms) return;
        uniforms.lat0Rad.value = lat;
        uniforms.lon0Rad.value = lon;
        uniforms.cosLat0.value = Math.cos(lat);
    }

    updateTexture() {
        if (this.material?.uniforms?.ppiTex) {
            this.material.uniforms.ppiTex.value = this.ppiPass?.renderTarget?.texture ?? null;
        }
    }

    dispose() {
        if (this.mesh?.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.mesh?.geometry?.dispose?.();
        this.material?.dispose?.();
    }
}
