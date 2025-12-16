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
        this.core = new WeatherCore({ nx, ny, dt: tickSeconds * 200 }); // model dt in seconds, faster than wall
        this.renderScale = renderScale;
        this.tickSeconds = tickSeconds;
        this.lastStepTs = performance.now();

        const texW = nx * renderScale;
        const texH = ny * renderScale;
        this.canvasCloud = document.createElement('canvas');
        this.canvasCloud.width = texW;
        this.canvasCloud.height = texH;
        this.ctxCloud = this.canvasCloud.getContext('2d');
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
        const img = this.ctxCloud.createImageData(w, h);
        const data = img.data;

        for (let y = 0; y < h; y++) {
            const lat = (y / h) * grid.ny;
            for (let x = 0; x < w; x++) {
                const lon = (x / w) * grid.nx;
                const cloud = bilinear(fields.cloud, lon, lat, grid.nx, grid.ny);
                if (cloud < 0.02) continue;
                const idx = (y * w + x) * 4;
                const alpha = Math.min(1, cloud);
                data[idx] = 245;
                data[idx + 1] = 245;
                data[idx + 2] = 245;
                data[idx + 3] = alpha * 180;
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
