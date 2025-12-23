import * as THREE from 'three';
import { WeatherCore } from './weather/core';
import WeatherLogger from './weather/WeatherLogger';
import { bilinear } from './weather/advect';

// WeatherField: rendering wrapper around the physics core
class WeatherField {
    constructor({
        nx = 180,
        ny = 90,
        renderScale = 2,
        tickSeconds = 0.5,
        modelDt = 120,
        timeScale = 200,
        kappa = 2000,
        seed,
        debugMode = 'clouds'
    } = {}) {
        this.core = new WeatherCore({ nx, ny, dt: modelDt, timeScale, kappa, seed });
        this.renderScale = renderScale;
        this.tickSeconds = tickSeconds;
        this._paintAccumSeconds = 0;
        this._lastSimTimeSeconds = null;
        this.paused = false;
        this.debugMode = debugMode;
        this._debugScratch = new Float32Array(this.core.grid.count);
        this._percentileScratch = new Float32Array(this.core.grid.count);
        this._simContext = { simSpeed: null, paused: null };
        this._lastStepsRan = 0;
        this._needsCoreTimeSync = true;
        this.logger = new WeatherLogger();
        this.core.setLogger(this.logger);

        const texW = nx * renderScale;
        const texH = ny * renderScale;
        this.canvasCloudLow = document.createElement('canvas');
        this.canvasCloudLow.width = texW;
        this.canvasCloudLow.height = texH;
        this.ctxCloudLow = this.canvasCloudLow.getContext('2d');
        this.imgCloudLow = this.ctxCloudLow.createImageData(texW, texH);
        this.dataCloudLow = this.imgCloudLow.data;
        this.textureLow = new THREE.CanvasTexture(this.canvasCloudLow);

        this.canvasCloudHigh = document.createElement('canvas');
        this.canvasCloudHigh.width = texW;
        this.canvasCloudHigh.height = texH;
        this.ctxCloudHigh = this.canvasCloudHigh.getContext('2d');
        this.imgCloudHigh = this.ctxCloudHigh.createImageData(texW, texH);
        this.dataCloudHigh = this.imgCloudHigh.data;
        this.textureHigh = new THREE.CanvasTexture(this.canvasCloudHigh);

        [this.textureLow, this.textureHigh].forEach(t => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.ClampToEdgeWrapping;
            t.magFilter = THREE.LinearFilter;
            t.minFilter = THREE.LinearFilter;
            t.needsUpdate = true;
        });

        this.canvasDebug = document.createElement('canvas');
        this.canvasDebug.width = texW;
        this.canvasDebug.height = texH;
        this.ctxDebug = this.canvasDebug.getContext('2d');
        this.imgDebug = this.ctxDebug.createImageData(texW, texH);
        this.dataDebug = this.imgDebug.data;
        this.textureDebug = new THREE.CanvasTexture(this.canvasDebug);
        this.textureDebug.wrapS = THREE.RepeatWrapping;
        this.textureDebug.wrapT = THREE.ClampToEdgeWrapping;
        this.textureDebug.magFilter = THREE.LinearFilter;
        this.textureDebug.minFilter = THREE.LinearFilter;
        this.textureDebug.needsUpdate = true;
    }

    update(simTimeSeconds, realDtSeconds, simContext = {}) {
        if (!Number.isFinite(simTimeSeconds)) return;
        if (!this.core.ready) {
            this._lastSimTimeSeconds = simTimeSeconds;
            return;
        }
        if (this._needsCoreTimeSync) {
            this._resyncCoreTime(simTimeSeconds);
            return;
        }
        if (this.paused) return;
        const simSpeed = Number.isFinite(simContext.simSpeed)
            ? simContext.simSpeed
            : this._simContext.simSpeed;
        const paused = typeof simContext.paused === 'boolean'
            ? simContext.paused
            : this._simContext.paused;
        this._simContext = { simSpeed, paused };
        this.core.setLoggerContext({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan });
        if (this._lastSimTimeSeconds === null || simTimeSeconds < this._lastSimTimeSeconds) {
            this._lastSimTimeSeconds = simTimeSeconds;
            return;
        }
        const deltaSim = simTimeSeconds - this._lastSimTimeSeconds;
        if (deltaSim > 0) {
            const maxSteps = Math.max(1000, Math.ceil(86400 / this.core.modelDt) + 10);
            const maxCatchupSeconds = maxSteps * this.core.modelDt;
            if (deltaSim > maxCatchupSeconds) {
                this._resyncCoreTime(simTimeSeconds);
                return;
            }
            const stepsRan = this.core.advanceModelSeconds(deltaSim) || 0;
            this._lastStepsRan = stepsRan;
        }
        this._lastSimTimeSeconds = simTimeSeconds;
        const desyncSeconds = Math.abs(simTimeSeconds - this.core.timeUTC);
        const desyncThreshold = Math.max(6 * 3600, this.core.modelDt * 10);
        if (desyncSeconds > desyncThreshold) {
            this._resyncCoreTime(simTimeSeconds);
            return;
        }
        this.logger?.recordIfDue({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan }, this.core);
        const realDt = Number.isFinite(realDtSeconds) ? Math.max(0, realDtSeconds) : 0;
        this._paintAccumSeconds += realDt;
        if (this._paintAccumSeconds < this.tickSeconds) return;
        this._paintAccumSeconds -= this.tickSeconds;
        this._paintClouds();
        this._paintDebug();
    }

    setPaused(paused) {
        this.paused = Boolean(paused);
    }

    getPaused() {
        return this.paused;
    }

    stepModelSeconds(modelSeconds) {
        if (!this.core.ready) return;
        const stepsRan = this.core.advanceModelSeconds(modelSeconds) || 0;
        this._lastStepsRan = stepsRan;
        this._paintAccumSeconds = 0;
        this._paintClouds();
        this._paintDebug();
    }

    setDebugMode(mode) {
        this.debugMode = mode || 'clouds';
        this._paintDebug();
    }

    getDebugMode() {
        return this.debugMode;
    }

    getDebugTexture() {
        return this.textureDebug;
    }

    setSeed(seed) {
        this.core.setSeed(seed);
        this._paintAccumSeconds = 0;
        this._lastSimTimeSeconds = null;
        this._lastStepsRan = 0;
        this._needsCoreTimeSync = true;
        this._paintClouds();
        this._paintDebug();
    }

    _resyncCoreTime(simTimeSeconds) {
        this.core.setTimeUTC(simTimeSeconds);
        this._lastSimTimeSeconds = simTimeSeconds;
        this._paintAccumSeconds = 0;
        this._lastStepsRan = 0;
        this._needsCoreTimeSync = false;
    }

    getSeed() {
        return this.core.getSeed();
    }

    getTimeUTC() {
        return this.core.timeUTC;
    }

    startLogCapture({ cadenceSeconds, maxEntries, simTimeSeconds } = {}) {
        if (Number.isFinite(cadenceSeconds)) {
            this.logger.setCadence(cadenceSeconds, simTimeSeconds);
        }
        if (Number.isFinite(maxEntries)) {
            this.logger.setMaxEntries(maxEntries);
        }
        this.logger.start(simTimeSeconds);
    }

    stopLogCapture() {
        this.logger.stop();
    }

    clearLogCapture() {
        this.logger.clear();
    }

    downloadLogCapture(filename) {
        return this.logger.download(filename);
    }

    setLogCadence(cadenceSeconds, simTimeSeconds) {
        this.logger.setCadence(cadenceSeconds, simTimeSeconds);
    }

    getLogStatus() {
        return {
            enabled: this.logger.enabled,
            count: this.logger.getCount(),
            cadenceSeconds: this.logger.cadenceSeconds
        };
    }

    logNow(simTimeSeconds, simContext = {}, reason) {
        const simSpeed = Number.isFinite(simContext.simSpeed)
            ? simContext.simSpeed
            : this._simContext.simSpeed;
        const paused = typeof simContext.paused === 'boolean'
            ? simContext.paused
            : this._simContext.paused;
        this.core.setLoggerContext({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan });
        return this.logger.recordNow({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan }, this.core, { reason });
    }

    getZonalMean(mode) {
        if (!this.core.ready) return new Float32Array(this.core.grid.ny);
        const { grid } = this.core;
        const values = this._getFieldValues(mode);
        const out = new Float32Array(grid.ny);
        for (let j = 0; j < grid.ny; j++) {
            let sum = 0;
            const rowOffset = j * grid.nx;
            for (let i = 0; i < grid.nx; i++) {
                sum += values[rowOffset + i];
            }
            out[j] = sum / grid.nx;
        }
        return out;
    }

    _paintClouds() {
        if (!this.core.ready) return;
        const { grid, fields } = this.core;

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

        const t = this.core.timeUTC || 0;

        const drawLayer = ({
            ctx,
            img,
            data,
            tauField,
            uField,
            vField,
            advectSeconds,
            noiseScale,
            shadeBase,
            shadeVar,
            tauScale
        }) => {
            const w = ctx.canvas.width;
            const h = ctx.canvas.height;
            data.fill(0);
            for (let y = 0; y < h; y++) {
                const lat = (y / h) * grid.ny;
                const j = Math.max(0, Math.min(grid.ny - 1, Math.floor(lat)));
                const kmPerDegLat = 111.0;
                const kmPerDegLon = Math.max(1.0, kmPerDegLat * grid.cosLat[j]);
                for (let x = 0; x < w; x++) {
                    const lon = (x / w) * grid.nx;
                    const u = bilinear(uField, lon, lat, grid.nx, grid.ny);
                    const v = bilinear(vField, lon, lat, grid.nx, grid.ny);
                    const dLonCells = (u * advectSeconds) / (kmPerDegLon * 1000 * grid.cellLonDeg);
                    const dLatCells = (v * advectSeconds) / (kmPerDegLat * 1000 * grid.cellLatDeg);

                    const tau = bilinear(tauField, lon - dLonCells, lat - dLatCells, grid.nx, grid.ny);
                    const n = fbm(x * noiseScale, y * noiseScale, t);
                    const tauMod = Math.max(0, tau * (0.8 + 0.4 * (n - 0.5)));
                    const a = 1 - Math.exp(-tauMod * tauScale);
                    const alpha = Math.max(0, Math.min(1, a));

                    const idx = (y * w + x) * 4;
                    const shade = shadeBase + Math.floor(shadeVar * (n - 0.5));
                    data[idx] = shade;
                    data[idx + 1] = shade;
                    data[idx + 2] = shade;
                    data[idx + 3] = Math.floor(255 * alpha);
                }
            }
            ctx.putImageData(img, 0, 0);
        };

        drawLayer({
            ctx: this.ctxCloudLow,
            img: this.imgCloudLow,
            data: this.dataCloudLow,
            tauField: fields.tauLow,
            uField: fields.u,
            vField: fields.v,
            advectSeconds: 1800,
            noiseScale: 0.015,
            shadeBase: 230,
            shadeVar: 24,
            tauScale: 1.1
        });

        drawLayer({
            ctx: this.ctxCloudHigh,
            img: this.imgCloudHigh,
            data: this.dataCloudHigh,
            tauField: fields.tauHigh,
            uField: fields.uU,
            vField: fields.vU,
            advectSeconds: 3600,
            noiseScale: 0.01,
            shadeBase: 240,
            shadeVar: 20,
            tauScale: 0.9
        });

        this.textureLow.needsUpdate = true;
        this.textureHigh.needsUpdate = true;
    }

    _paintDebug() {
        if (!this.core.ready || this.debugMode === 'clouds') return;
        const { grid } = this.core;
        const w = this.ctxDebug.canvas.width;
        const h = this.ctxDebug.canvas.height;
        const img = this.imgDebug;
        const data = this.dataDebug;
        const values = this._getFieldValues(this.debugMode);
        const config = this._getDebugConfig(this.debugMode);
        const { min, max, transform } = this._computeScale(values, config);
        const denom = max - min || 1;
        const maxAbs = config.diverging ? Math.max(Math.abs(min), Math.abs(max)) || 1 : 1;

        data.fill(0);
        for (let y = 0; y < h; y++) {
            const lat = Math.max(0, Math.min(grid.ny - 1, Math.floor((y / h) * grid.ny)));
            const rowOffset = lat * grid.nx;
            for (let x = 0; x < w; x++) {
                const lon = Math.floor((x / w) * grid.nx) % grid.nx;
                const k = rowOffset + lon;
                const value = values[k];
                let r = 0;
                let g = 0;
                let b = 0;
                if (config.diverging) {
                    const norm = Math.max(-1, Math.min(1, value / maxAbs));
                    [r, g, b] = this._divergingColor(norm);
                } else {
                    const t = Math.max(0, Math.min(1, (transform(value) - min) / denom));
                    [r, g, b] = this._sequentialColor(t);
                }
                const idx = (y * w + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        this.ctxDebug.putImageData(img, 0, 0);
        if (this.debugMode === 'wind') {
            this._drawWindArrows();
        }
        this.textureDebug.needsUpdate = true;
    }

    _getFieldValues(mode) {
        const { fields } = this.core;
        switch (mode) {
            case 'ps':
                return fields.ps;
            case 'T':
                return fields.T;
            case 'Ts':
                return fields.Ts;
            case 'TU':
                return fields.TU;
            case 'RH':
                return fields.RH;
            case 'RHU':
                return fields.RHU;
            case 'vort':
                return fields.vort;
            case 'div':
                return fields.div;
            case 'cwp':
                return fields.cwp;
            case 'precip':
                return fields.precipRate;
            case 'sst':
                return this.core.climo?.sstNow || this._getZeroScratch();
            case 'seaIce':
                return this.core.climo?.iceNow || this._getZeroScratch();
            case 'albedo':
                return this.core.geo?.albedo || this._getZeroScratch();
            case 'elev':
                return this.core.geo?.elev || this._getZeroScratch();
            case 'soilCap':
                return this.core.geo?.soilCap || this.core.geo?.soilM || this._getZeroScratch();
            case 'landMask':
                return this.core.geo?.landMask || this._getZeroScratch();
            case 'wind':
                return this._computeWindSpeed();
            case 'windUpper':
                return this._computeWindSpeed(this.core.fields.uU, this.core.fields.vU);
            case 'hUpper':
                return fields.hU;
            case 'omegaL':
                return fields.omegaL;
            case 'omegaU':
                return fields.omegaU;
            case 'tauLow':
                return fields.tauLow;
            case 'tauHigh':
                return fields.tauHigh;
            case 'cloudLow':
                return fields.cloudLow;
            case 'cloudHigh':
                return fields.cloudHigh;
            case 'cwpLow':
                return fields.cwpLow;
            case 'cwpHigh':
                return fields.cwpHigh;
            case 'clouds':
            default:
                return fields.cloud;
        }
    }

    _getZeroScratch() {
        this._debugScratch.fill(0);
        return this._debugScratch;
    }

    _computeWindSpeed(u = this.core.fields.u, v = this.core.fields.v) {
        for (let k = 0; k < u.length; k++) {
            this._debugScratch[k] = Math.hypot(u[k], v[k]);
        }
        return this._debugScratch;
    }

    _getDebugConfig(mode) {
        switch (mode) {
            case 'ps':
                return { fixed: [95000, 103000] };
            case 'T':
                return { fixed: [240, 320] };
            case 'Ts':
                return { fixed: [240, 320] };
            case 'TU':
                return { fixed: [180, 320] };
            case 'RH':
                return { fixed: [0, 1.2] };
            case 'RHU':
                return { fixed: [0, 1.2] };
            case 'vort':
                return { fixed: [-5e-5, 5e-5], diverging: true };
            case 'div':
                return { fixed: [-5e-5, 5e-5], diverging: true };
            case 'precip':
                return { fixed: [0, 50], log: true };
            case 'cwp':
                return { fixed: [0, 0.5], log: true };
            case 'sst':
                return { fixed: [271, 307] };
            case 'seaIce':
                return { fixed: [0, 1] };
            case 'albedo':
                return { fixed: [0, 1] };
            case 'elev':
                return { fixed: [0, 5000] };
            case 'soilCap':
                return { fixed: [0, 1] };
            case 'landMask':
                return { fixed: [0, 1] };
            case 'wind':
                return { fixed: [0, 30] };
            case 'windUpper':
                return { fixed: [0, 100] };
            case 'hUpper':
                return { fixed: [1000, 5000] };
            case 'omegaL':
                return { fixed: [-0.2, 0.2], diverging: true };
            case 'omegaU':
                return { fixed: [-0.2, 0.2], diverging: true };
            case 'tauLow':
                return { fixed: [0, 20] };
            case 'tauHigh':
                return { fixed: [0, 20] };
            case 'cloudLow':
                return { fixed: [0, 1] };
            case 'cloudHigh':
                return { fixed: [0, 1] };
            case 'cwpLow':
                return { fixed: [0, 0.5], log: true };
            case 'cwpHigh':
                return { fixed: [0, 0.5], log: true };
            case 'clouds':
                return { fixed: [0, 1] };
            default:
                return { fixed: [0, 1] };
        }
    }

    _computeScale(values, config) {
        const transform = config.log
            ? (v) => Math.log10(1 + Math.max(0, v))
            : (v) => v;
        let min = transform(config.fixed[0]);
        let max = transform(config.fixed[1]);
        const [pMin, pMax] = this._computePercentileRange(values, transform, 5, 95);
        if (Number.isFinite(pMin) && Number.isFinite(pMax) && pMax > pMin) {
            min = pMin;
            max = pMax;
        }
        if (!(max > min)) {
            min = 0;
            max = 1;
        }
        return { min, max, transform };
    }

    _computePercentileRange(values, transform, pLow, pHigh) {
        const scratch = this._percentileScratch;
        for (let i = 0; i < values.length; i++) {
            const v = transform(values[i]);
            scratch[i] = Number.isFinite(v) ? v : 0;
        }
        scratch.sort();
        const lo = Math.max(0, Math.min(values.length - 1, Math.floor((pLow / 100) * (values.length - 1))));
        const hi = Math.max(0, Math.min(values.length - 1, Math.floor((pHigh / 100) * (values.length - 1))));
        return [scratch[lo], scratch[hi]];
    }

    _sequentialColor(t) {
        const stops = [
            { t: 0.0, c: [12, 28, 60] },
            { t: 0.35, c: [20, 140, 190] },
            { t: 0.7, c: [235, 220, 90] },
            { t: 1.0, c: [180, 30, 30] }
        ];
        if (t <= 0) return stops[0].c;
        if (t >= 1) return stops[stops.length - 1].c;
        for (let i = 0; i < stops.length - 1; i++) {
            const a = stops[i];
            const b = stops[i + 1];
            if (t >= a.t && t <= b.t) {
                const tt = (t - a.t) / (b.t - a.t);
                return [
                    Math.round(a.c[0] + (b.c[0] - a.c[0]) * tt),
                    Math.round(a.c[1] + (b.c[1] - a.c[1]) * tt),
                    Math.round(a.c[2] + (b.c[2] - a.c[2]) * tt)
                ];
            }
        }
        return stops[stops.length - 1].c;
    }

    _divergingColor(value) {
        const t = (value + 1) * 0.5;
        if (t <= 0.5) {
            const tt = t / 0.5;
            return [
                Math.round(30 + (245 - 30) * tt),
                Math.round(80 + (245 - 80) * tt),
                Math.round(200 + (245 - 200) * tt)
            ];
        }
        const tt = (t - 0.5) / 0.5;
        return [
            Math.round(245 + (200 - 245) * tt),
            Math.round(245 + (40 - 245) * tt),
            Math.round(245 + (40 - 245) * tt)
        ];
    }

    _drawWindArrows() {
        const { grid, fields } = this.core;
        const { u, v } = fields;
        const w = this.ctxDebug.canvas.width;
        const h = this.ctxDebug.canvas.height;
        const ctx = this.ctxDebug;
        const step = Math.max(6, Math.floor(grid.nx / 30));
        const cellPx = w / grid.nx;
        const maxLen = cellPx * 2.5;
        const speedToPx = cellPx * 0.35;

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        for (let j = 0; j < grid.ny; j += step) {
            const rowOffset = j * grid.nx;
            const y = ((j + 0.5) / grid.ny) * h;
            for (let i = 0; i < grid.nx; i += step) {
                const k = rowOffset + i;
                const uu = u[k];
                const vv = v[k];
                const speed = Math.hypot(uu, vv);
                if (speed < 0.2) continue;
                const len = Math.min(maxLen, speed * speedToPx);
                const angle = Math.atan2(-vv, uu);
                const x = ((i + 0.5) / grid.nx) * w;
                const x2 = x + Math.cos(angle) * len;
                const y2 = y + Math.sin(angle) * len;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                const headLen = Math.max(3, len * 0.3);
                const a1 = angle + Math.PI * 0.75;
                const a2 = angle - Math.PI * 0.75;
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 + Math.cos(a1) * headLen, y2 + Math.sin(a1) * headLen);
                ctx.lineTo(x2 + Math.cos(a2) * headLen, y2 + Math.sin(a2) * headLen);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
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
