import * as THREE from 'three';

const DEFAULT_WIDTH = 256;
const DEFAULT_HEIGHT = 128;
const DEFAULT_SCALE = 5000;

export class WeatherVolumeDebugView {
    constructor({ renderer, volume, options = {} }) {
        this.renderer = renderer;
        this.volume = volume;
        this.width = options.width ?? DEFAULT_WIDTH;
        this.height = options.height ?? DEFAULT_HEIGHT;
        this.scale = options.scale ?? DEFAULT_SCALE;

        this.target = new THREE.WebGLRenderTarget(this.width, this.height, {
            depthBuffer: false,
            stencilBuffer: false
        });
        this.target.texture.minFilter = THREE.LinearFilter;
        this.target.texture.magFilter = THREE.LinearFilter;
        this.target.texture.generateMipmaps = false;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const sliceZ = this._computeSliceZ();
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                weatherTex3D: { value: this.volume?.weatherTex3D ?? null },
                sliceZ: { value: sliceZ },
                scale: { value: this.scale }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                precision highp sampler3D;
                in vec2 vUv;
                uniform sampler3D weatherTex3D;
                uniform float sliceZ;
                uniform float scale;
                out vec4 outColor;
                void main() {
                    float qr = texture(weatherTex3D, vec3(vUv, sliceZ)).r;
                    float c = clamp(qr * scale, 0.0, 1.0);
                    outColor = vec4(vec3(c), 1.0);
                }
            `,
            glslVersion: THREE.GLSL3
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.scene.add(quad);
        this.debugMesh = null;

        if (options.camera) {
            const planeDistance = options.planeDistance ?? 5000;
            const planeWidth = options.planeWidth ?? 2000;
            const planeHeight = planeWidth * (this.height / this.width);
            const planeGeo = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const planeMat = new THREE.MeshBasicMaterial({
                map: this.target.texture,
                transparent: true,
                depthWrite: false,
                depthTest: false
            });
            const plane = new THREE.Mesh(planeGeo, planeMat);
            plane.renderOrder = 999;
            plane.frustumCulled = false;
            this._positionDebugPlane(options.camera, plane, planeDistance, planeWidth, planeHeight, options.margin);
            options.camera.add(plane);
            this.debugMesh = plane;
        }
    }

    render() {
        if (!this.volume?.weatherTex3D) return false;
        this.material.uniforms.weatherTex3D.value = this.volume.weatherTex3D;
        this.material.uniforms.sliceZ.value = this._computeSliceZ();
        this.renderer.setRenderTarget(this.target);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        return true;
    }

    getTexture() {
        return this.target.texture;
    }

    dispose() {
        this.debugMesh?.geometry?.dispose?.();
        this.debugMesh?.material?.dispose?.();
        this.target?.dispose?.();
        this.material?.dispose?.();
    }

    _computeSliceZ() {
        const nz = this.volume?.nz ?? this.volume?.core?.nz ?? 1;
        return nz > 0 ? (nz - 0.5) / nz : 0.5;
    }

    _positionDebugPlane(camera, plane, planeDistance, planeWidth, planeHeight, margin) {
        if (!camera?.isPerspectiveCamera) {
            plane.position.set(0, 0, -planeDistance);
            return;
        }
        const fovRad = THREE.MathUtils.degToRad(camera.fov);
        const viewHeight = 2 * Math.tan(fovRad * 0.5) * planeDistance;
        const viewWidth = viewHeight * camera.aspect;
        const pad = margin ?? Math.min(planeWidth, planeHeight) * 0.08;
        plane.position.set(
            -viewWidth * 0.5 + planeWidth * 0.5 + pad,
            -viewHeight * 0.5 + planeHeight * 0.5 + pad,
            -planeDistance
        );
    }
}
