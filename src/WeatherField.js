import * as THREE from 'three';
import { WeatherCore } from './weather/core';
import { bilinear } from './weather/advect';

// WeatherField: rendering wrapper around the physics core
class WeatherField {
    constructor({
        nx = 180,
        ny = 90,
        renderScale = 2,
        tickSeconds = 0.5
    } = {}) {
        this.core = new WeatherCore({ nx, ny, dt: 120, timeScale: 200, kappa: 2000 });
        this.renderScale = renderScale;
        this.tickSeconds = tickSeconds;
        this.lastStepTs = performance.now();

        const texW = nx * renderScale;
        const texH = ny * renderScale;
        this.canvasCloud = document.createElement('canvas');
        this.canvasCloud.width = texW;
        this.canvasCloud.height = texH;
        this.ctxCloud = this.canvasCloud.getContext('2d');
        this.imgCloud = this.ctxCloud.createImageData(texW, texH);
        this.dataCloud = this.imgCloud.data;
        this.textureLow = new THREE.CanvasTexture(this.canvasCloud);
        this.textureHigh = new THREE.CanvasTexture(this.canvasCloud);
        [this.textureLow, this.textureHigh].forEach(t => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.ClampToEdgeWrapping;
            t.magFilter = THREE.LinearFilter;
            t.minFilter = THREE.LinearFilter;
            t.needsUpdate = true;
        });
    }

    maybeStep() {
        const now = performance.now();
        const dtMs = now - this.lastStepTs;
        if (dtMs < this.tickSeconds * 1000) return;
        this.core.step(dtMs / 1000); // pass seconds
        this.lastStepTs = now;
        this._paintClouds();
    }

    _paintClouds() {
        if (!this.core.ready) return;
        const { grid, fields } = this.core;
        const w = this.ctxCloud.canvas.width;
        const h = this.ctxCloud.canvas.height;
        const img = this.imgCloud;
        const data = this.dataCloud;
        data.fill(0);

        const smoothstep = (a, b, x) => {
            const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
            return t * t * (3 - 2 * t);
        };
        const hash = (x, y, t) => {
            const s = Math.sin(x * 127.1 + y * 311.7 + t * 0.1) * 43758.5453;
            return s - Math.floor(s);
        };
        const fbm = (x, y, t) => {
            let v = 0, a = 0.5, f = 1.0;
            for (let o = 0; o < 4; o++) {
                v += a * hash(x * f, y * f, t);
                f *= 2.0;
                a *= 0.5;
            }
            return v;
        };

        const advectSeconds = 1800;
        const t = this.core.timeUTC || 0;

        for (let y = 0; y < h; y++) {
            const lat = (y / h) * grid.ny;
            for (let x = 0; x < w; x++) {
                const lon = (x / w) * grid.nx;
                const u = bilinear(fields.u, lon, lat, grid.nx, grid.ny);
                const v = bilinear(fields.v, lon, lat, grid.nx, grid.ny);
                const j = Math.max(0, Math.min(grid.ny - 1, Math.floor(lat)));
                const kmPerDegLat = 111.0;
                const kmPerDegLon = Math.max(1.0, kmPerDegLat * grid.cosLat[j]);
                const dLonCells = (u * advectSeconds) / (kmPerDegLon * 1000 * grid.cellLonDeg);
                const dLatCells = (v * advectSeconds) / (kmPerDegLat * 1000 * grid.cellLatDeg);

                const cloud = bilinear(fields.cloud, lon - dLonCells, lat - dLatCells, grid.nx, grid.ny);

                const n = fbm(x * 0.015, y * 0.015, t);
                const c = Math.max(0, Math.min(1, cloud * (0.8 + 0.4 * (n - 0.5))));
                const a = smoothstep(0.03, 0.18, c);

                const idx = (y * w + x) * 4;
                const shade = 230 + Math.floor(20 * n);
                data[idx] = shade;
                data[idx + 1] = shade;
                data[idx + 2] = shade;
                data[idx + 3] = Math.floor(255 * a);
            }
        }

        this.ctxCloud.putImageData(img, 0, 0);
        this.textureLow.needsUpdate = true;
        this.textureHigh.needsUpdate = true;
    }

    sampleWeather(u, v) {
        if (!this.core.ready) return 0;
        const { grid, fields } = this.core;
        const lon = Math.floor(grid.nx * u) % grid.nx;
        let lat = Math.floor(grid.ny * v);
        lat = Math.max(0, Math.min(grid.ny - 1, lat));
        const k = lat * grid.nx + lon;
        return fields.cloud[k];
    }
}

export default WeatherField;
