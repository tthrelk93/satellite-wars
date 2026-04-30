import * as THREE from 'three';
import { createWeatherKernel } from './weather/kernel';
import WeatherLogger from './weather/WeatherLogger';
import { bilinear } from './weather/shared/bilinear';
import { WeatherLogSink } from './weather/logSink';
import {
    buildVisualWeatherCueProduct,
    classifyVisualWeatherCell,
    normalizeWeatherVisualMode,
    renderVisualWeatherColor
} from './weather/visuals/weatherVisualModes';

const AUTO_LOG_CADENCE_SECONDS = 6 * 3600;
const AUTO_LOG_MAX_ENTRIES = 20000;
const AUTO_LOG_INIT_RETRY_MS = 5000;
const CLOUD_TEXTURE_SOFTEN_BLUR_PX = 0.0;
const EXTERNAL_CORE_CLOUD_PAINT_CADENCE_SECONDS = 2.0;

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const hashUnit = (x, y, seed) => {
    let n = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967295;
};

// WeatherField: rendering wrapper around the physics core
class WeatherField {
    constructor({
        nx = 180,
        ny = 90,
        renderScale = 2,
        tickSeconds = 0.5,
        modelDt = 120,
        seed,
        debugMode = 'clouds',
        autoLogEnabled = true,
        autoStateLogEnabled = true
    } = {}) {
        this.kernel = createWeatherKernel({ nx, ny, dt: modelDt, seed });
        this.core = this.kernel.core;
        this.renderScale = renderScale;
        this.tickSeconds = tickSeconds;
        this._paintAccumSeconds = 0;
        this._lastSimTimeSeconds = null;
        this.paused = false;
        this.debugMode = debugMode;
        this.visualMode = 'visible';
        this._debugScratch = new Float32Array(this.core.grid.count);
        this._percentileScratch = new Float32Array(this.core.grid.count);
        this._simContext = { simSpeed: null, paused: null };
        this.useExternalCore = false;
        this.renderEnabled = true;
        this.eventProduct = null;
        this.localDownscaleProduct = null;
        this._lastStepsRan = 0;
        this._lastPaintSimTime = null;
        this._nextExternalPaintLayer = 'low';
        this._needsCoreTimeSync = true;
        this.logger = new WeatherLogger();
        this.core.setLogger?.(this.logger);
        this._logSink = null;
        this._autoLogReady = false;
        this._autoLogInitInFlight = false;
        this._nextAutoLogInitAtMs = 0;
        this._autoStateLogEnabled = Boolean(autoStateLogEnabled);

        const shouldAutoLog = autoLogEnabled && (process.env.NODE_ENV !== 'production' || process.env.REACT_APP_AUTO_LOG === '1');
        if (shouldAutoLog && typeof fetch !== 'undefined') {
            this._logSink = new WeatherLogSink({ baseUrl: '/__weatherlog', flushIntervalMs: 300 });
            this._maybeInitAutoLogging(true);
        }

        const texW = nx * renderScale;
        const texH = ny * renderScale;
        this._texW = texW;
        this._texH = texH;
        this._cloudNoiseLow = this._buildCloudNoise(texW, texH, (seed ?? 0) + 101);
        this._cloudNoiseHigh = this._buildCloudNoise(texW, texH, (seed ?? 0) + 509);
        this._lastPerfStats = null;
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

        this.renderParams = {
            aLow: 0.95,
            aHigh: 0.70,
            gammaLow: 1.35,
            gammaHigh: 1.85,
            tauBrightLow: 12,
            tauBrightHigh: 8,
            tauEdgeLow: 0.08,
            tauEdgeHigh: 0.05,
            alphaHighCap: 0.65,
            debugMode: 'final'
        };

        this._cloudLowMean = 0;
        this._cloudHighMean = 0;

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
        this._softenCanvas = document.createElement('canvas');
        this._softenCanvas.width = texW;
        this._softenCanvas.height = texH;
        this._softenCtx = this._softenCanvas.getContext('2d');
    }

    _buildCloudNoise(width, height, seed) {
        const out = new Uint8Array(width * height);
        const baseSeed = Math.trunc(seed || 0);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let value = 0;
                let amplitude = 0.5;
                let norm = 0;
                for (let octave = 0; octave < 4; octave++) {
                    const stride = 1 << octave;
                    value += amplitude * hashUnit(Math.floor(x / stride), Math.floor(y / stride), baseSeed + octave * 7919);
                    norm += amplitude;
                    amplitude *= 0.5;
                }
                out[y * width + x] = Math.max(0, Math.min(255, Math.round(255 * (value / Math.max(1e-6, norm)))));
            }
        }
        this._blendScalarLongitudeSeam(out, width, height);
        return out;
    }

    _blendScalarLongitudeSeam(data, width, height, seamColumns = 8) {
        if (!data || width < 2 || height < 1) return;
        const cols = Math.max(1, Math.min(Math.floor(width / 2), Math.floor(seamColumns)));
        const left = new Array(cols);
        const right = new Array(cols);
        for (let y = 0; y < height; y++) {
            const row = y * width;
            for (let d = 0; d < cols; d++) {
                left[d] = data[row + d];
                right[d] = data[row + width - 1 - d];
            }
            for (let d = 0; d < cols; d++) {
                const blend = 1 - d / cols;
                const average = 0.5 * (left[d] + right[d]);
                data[row + d] = Math.round(left[d] * (1 - blend) + average * blend);
                data[row + width - 1 - d] = Math.round(right[d] * (1 - blend) + average * blend);
            }
        }
    }

    _blendTextureLongitudeSeam(data, width, height, seamColumns = 8) {
        if (!data || width < 2 || height < 1) return;
        const cols = Math.max(1, Math.min(Math.floor(width / 2), Math.floor(seamColumns)));
        const left = new Array(cols * 4);
        const right = new Array(cols * 4);
        for (let y = 0; y < height; y++) {
            const row = y * width * 4;
            for (let d = 0; d < cols; d++) {
                const leftIdx = row + d * 4;
                const rightIdx = row + (width - 1 - d) * 4;
                for (let c = 0; c < 4; c++) {
                    left[d * 4 + c] = data[leftIdx + c];
                    right[d * 4 + c] = data[rightIdx + c];
                }
            }
            for (let d = 0; d < cols; d++) {
                const blend = 1 - d / cols;
                const leftIdx = row + d * 4;
                const rightIdx = row + (width - 1 - d) * 4;
                for (let c = 0; c < 4; c++) {
                    const leftValue = left[d * 4 + c];
                    const rightValue = right[d * 4 + c];
                    const average = 0.5 * (leftValue + rightValue);
                    data[leftIdx + c] = Math.round(leftValue * (1 - blend) + average * blend);
                    data[rightIdx + c] = Math.round(rightValue * (1 - blend) + average * blend);
                }
            }
        }
    }

    _softenLayerCanvas(ctx) {
        if (!ctx || !this._softenCtx || CLOUD_TEXTURE_SOFTEN_BLUR_PX <= 0) return;
        const canvas = ctx.canvas;
        if (!canvas?.width || !canvas?.height) return;
        if (this._softenCanvas.width !== canvas.width || this._softenCanvas.height !== canvas.height) {
            this._softenCanvas.width = canvas.width;
            this._softenCanvas.height = canvas.height;
        }
        this._softenCtx.clearRect(0, 0, canvas.width, canvas.height);
        this._softenCtx.drawImage(canvas, 0, 0);
        const prevFilter = ctx.filter;
        const prevComposite = ctx.globalCompositeOperation;
        ctx.filter = `blur(${CLOUD_TEXTURE_SOFTEN_BLUR_PX}px)`;
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(this._softenCanvas, 0, 0);
        ctx.filter = prevFilter;
        ctx.globalCompositeOperation = prevComposite;
    }

    _sampleCloudNoise(noise, lon, lat, grid) {
        if (!noise?.length || !grid) return 0.5;
        const lonWrapped = ((lon % grid.nx) + grid.nx) % grid.nx;
        const latClamped = Math.max(0, Math.min(grid.ny - 1, lat));
        const x = Math.max(0, Math.min(this._texW - 1, Math.floor((lonWrapped / grid.nx) * this._texW)));
        const y = Math.max(0, Math.min(this._texH - 1, Math.floor((latClamped / Math.max(1, grid.ny - 1)) * (this._texH - 1))));
        return noise[y * this._texW + x] / 255;
    }

    _maybeInitAutoLogging(force = false) {
        if (!this._logSink || this._autoLogReady || this._autoLogInitInFlight) return;
        const nowMs = Date.now();
        if (!force && nowMs < this._nextAutoLogInitAtMs) return;
        void this._initAutoLogging();
    }

    async _initAutoLogging() {
        if (!this._logSink || this._autoLogReady || this._autoLogInitInFlight) return;
        this._autoLogInitInFlight = true;
        try {
            if (this.core?._initPromise) {
                await this.core._initPromise;
            }
        } catch (_) {
            // proceed with whatever init data is available
        }
        try {
            const session = await this._logSink.init();
            if (!session) {
                this._nextAutoLogInitAtMs = Date.now() + AUTO_LOG_INIT_RETRY_MS;
                return;
            }

            this.logger.setOnLine((line) => this._logSink.enqueue(line));
            this.logger.setRunInfo({
                runId: session.runId,
                seqStart: Number.isFinite(session.seqStart) ? session.seqStart : 0
            });
            this.logger.start(this.core.timeUTC, {
                cadenceSeconds: AUTO_LOG_CADENCE_SECONDS,
                maxEntries: AUTO_LOG_MAX_ENTRIES
            });
            this.logger.recordRunStart(this.core, {
                session,
                cadenceSeconds: AUTO_LOG_CADENCE_SECONDS,
                modelKind: 'v2'
            });
            this.logger.recordNow(
                {
                    simTimeSeconds: this.core.timeUTC,
                    simSpeed: this._simContext.simSpeed,
                    paused: this._simContext.paused,
                    stepsRanThisTick: this._lastStepsRan
                },
                this.core,
                { reason: 'autoStart' }
            );
            this._autoLogReady = true;
            this._nextAutoLogInitAtMs = 0;
        } finally {
            this._autoLogInitInFlight = false;
        }
    }

    update(simTimeSeconds, realDtSeconds, simContext = {}) {
        const perfStartMs = nowMs();
        const perfStats = {
            updateMs: 0,
            autoLogMs: 0,
            physicsMs: 0,
            loggerMs: 0,
            paintCloudsMs: 0,
            paintDebugMs: 0,
            painted: false,
            renderEnabled: this.renderEnabled,
            useExternalCore: this.useExternalCore === true,
            stepsRan: this._lastStepsRan
        };
        const finishPerf = () => {
            perfStats.updateMs = nowMs() - perfStartMs;
            perfStats.stepsRan = this._lastStepsRan;
            this._lastPerfStats = perfStats;
        };
        if (!Number.isFinite(simTimeSeconds)) {
            finishPerf();
            return;
        }
        let phaseStartMs = nowMs();
        this._maybeInitAutoLogging();
        perfStats.autoLogMs += nowMs() - phaseStartMs;
        if (!this.core.ready) {
            this._lastSimTimeSeconds = simTimeSeconds;
            finishPerf();
            return;
        }
        const useExternalCore = this.useExternalCore === true;
        perfStats.useExternalCore = useExternalCore;
        if (this._needsCoreTimeSync && !useExternalCore) {
            this._resyncCoreTime(simTimeSeconds);
            finishPerf();
            return;
        }
        if (this.paused) {
            finishPerf();
            return;
        }
        const simSpeed = Number.isFinite(simContext.simSpeed)
            ? simContext.simSpeed
            : this._simContext.simSpeed;
        const paused = typeof simContext.paused === 'boolean'
            ? simContext.paused
            : this._simContext.paused;
        this._simContext = { simSpeed, paused };
        this.core.setSimSpeed?.(simSpeed);
        this.core.setLoggerContext?.({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan });
        if (this._lastSimTimeSeconds === null || simTimeSeconds < this._lastSimTimeSeconds) {
            this._lastSimTimeSeconds = simTimeSeconds;
            finishPerf();
            return;
        }
        if (!useExternalCore) {
            const deltaSim = simTimeSeconds - this._lastSimTimeSeconds;
            if (deltaSim > 0) {
                const maxSteps = Math.max(1000, Math.ceil(86400 / this.core.modelDt) + 10);
                const maxCatchupSeconds = maxSteps * this.core.modelDt;
                if (deltaSim > maxCatchupSeconds) {
                    this._resyncCoreTime(simTimeSeconds);
                    finishPerf();
                    return;
                }
                phaseStartMs = nowMs();
                const stepsRan = this.core.advanceModelSeconds(deltaSim) || 0;
                perfStats.physicsMs += nowMs() - phaseStartMs;
                this._lastStepsRan = stepsRan;
                if (stepsRan > 0) this._refreshEventProduct();
            }
        } else {
            this._lastStepsRan = 0;
        }
        this._lastSimTimeSeconds = simTimeSeconds;
        const desyncSeconds = Math.abs(simTimeSeconds - this.core.timeUTC);
        const desyncThreshold = Math.max(6 * 3600, this.core.modelDt * 10);
        if (desyncSeconds > desyncThreshold && !useExternalCore) {
            this._resyncCoreTime(simTimeSeconds);
            finishPerf();
            return;
        }
        phaseStartMs = nowMs();
        if (this._autoStateLogEnabled) {
            this.logger?.recordIfDue({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan }, this.core);
        }
        perfStats.loggerMs += nowMs() - phaseStartMs;
        if (!this.renderEnabled) {
            this._paintAccumSeconds = 0;
            finishPerf();
            return;
        }
        const realDt = Number.isFinite(realDtSeconds) ? Math.max(0, realDtSeconds) : 0;
        const paintCadenceSeconds = useExternalCore
            ? Math.max(this.tickSeconds, EXTERNAL_CORE_CLOUD_PAINT_CADENCE_SECONDS)
            : this.tickSeconds;
        this._paintAccumSeconds += realDt;
        if (this._paintAccumSeconds < paintCadenceSeconds) {
            finishPerf();
            return;
        }
        if (useExternalCore && simContext?.deferWeatherPaint) {
            this._paintAccumSeconds = Math.min(this._paintAccumSeconds, paintCadenceSeconds);
            finishPerf();
            return;
        }
        this._paintAccumSeconds -= paintCadenceSeconds;
        const paintOptions = useExternalCore
            ? {
                paintLow: this._nextExternalPaintLayer !== 'high',
                paintHigh: this._nextExternalPaintLayer === 'high'
            }
            : null;
        if (useExternalCore) {
            this._nextExternalPaintLayer = this._nextExternalPaintLayer === 'high' ? 'low' : 'high';
        }
        phaseStartMs = nowMs();
        this._paintClouds(simTimeSeconds, paintOptions);
        perfStats.paintCloudsMs += nowMs() - phaseStartMs;
        phaseStartMs = nowMs();
        this._paintDebug();
        perfStats.paintDebugMs += nowMs() - phaseStartMs;
        perfStats.painted = true;
        finishPerf();
    }

    setPaused(paused) {
        this.paused = Boolean(paused);
    }

    getPaused() {
        return this.paused;
    }

    setUseExternalCore(enabled) {
        this.useExternalCore = Boolean(enabled);
        if (this.useExternalCore) {
            this._needsCoreTimeSync = false;
        }
    }

    setRenderEnabled(enabled) {
        const next = Boolean(enabled);
        if (this.renderEnabled === next) return;
        this.renderEnabled = next;
        this._paintAccumSeconds = 0;
        if (next && this.core.ready) {
            this._paintClouds(this.core.timeUTC);
            this._paintDebug();
        }
    }

    stepModelSeconds(modelSeconds) {
        this.catchUpModelSeconds(modelSeconds);
    }

    catchUpModelSeconds(modelSeconds, simTimeSeconds = null) {
        if (!this.core.ready) return 0;
        let stepsRan = 0;
        if (Number.isFinite(modelSeconds) && modelSeconds > 0) {
            stepsRan = this.core.advanceModelSeconds(modelSeconds) || 0;
            if (stepsRan > 0) this._refreshEventProduct();
        }
        this._lastStepsRan = stepsRan;
        if (Number.isFinite(simTimeSeconds)) {
            this._lastSimTimeSeconds = simTimeSeconds;
        }
        this._paintAccumSeconds = 0;
        if (this.renderEnabled) {
            this._paintClouds(this.core.timeUTC);
            this._paintDebug();
        }
        return stepsRan;
    }

    setDebugMode(mode) {
        const validRenderDebug = ['final', 'cloudLow', 'cloudHigh', 'tauLow', 'tauHigh'];
        if (validRenderDebug.includes(mode)) {
            this.renderParams.debugMode = mode;
        } else {
            this.debugMode = mode || 'clouds';
            this._paintDebug();
        }
    }

    setVisualMode(mode) {
        const next = normalizeWeatherVisualMode(mode);
        if (this.visualMode === next) return;
        this.visualMode = next;
        this._paintAccumSeconds = Math.max(this._paintAccumSeconds, this.tickSeconds);
    }

    getVisualMode() {
        return this.visualMode;
    }

    getDebugMode() {
        return this.debugMode;
    }

    getDebugTexture() {
        return this.textureDebug;
    }

    setSeed(seed) {
        this.kernel?.setSeed?.(seed);
        this._cloudNoiseLow = this._buildCloudNoise(this._texW, this._texH, (seed ?? 0) + 101);
        this._cloudNoiseHigh = this._buildCloudNoise(this._texW, this._texH, (seed ?? 0) + 509);
        this.eventProduct = null;
        this.localDownscaleProduct = null;
        this._paintAccumSeconds = 0;
        this._lastSimTimeSeconds = null;
        this._lastStepsRan = 0;
        this._lastPaintSimTime = null;
        this._needsCoreTimeSync = true;
        if (this.renderEnabled) {
            this._paintClouds(this.core.timeUTC);
            this._paintDebug();
        }
    }

    _resyncCoreTime(simTimeSeconds) {
        this.core.setTimeUTC(simTimeSeconds);
        this._refreshEventProduct({ force: true });
        this._lastSimTimeSeconds = simTimeSeconds;
        this._paintAccumSeconds = 0;
        this._lastStepsRan = 0;
        this._lastPaintSimTime = null;
        this._needsCoreTimeSync = false;
        if (this.renderEnabled) {
            this._paintClouds(this.core.timeUTC);
            this._paintDebug();
        }
    }

    getSeed() {
        return this.core.getSeed?.() ?? this.core.seed ?? 0;
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
        this.logger.start(simTimeSeconds, { cadenceSeconds, maxEntries });
        if (!this.logger.hasRunStart?.()) {
            const session = this._logSink?.getSession?.() || null;
            this.logger.recordRunStart(this.core, {
                session,
                cadenceSeconds: this.logger.cadenceSeconds,
                modelKind: 'v2'
            });
        }
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

    getPerfStats() {
        return this._lastPerfStats ? { ...this._lastPerfStats } : null;
    }

    getCoreSnapshot(options = {}) {
        return this.kernel?.getSnapshot?.(options) || null;
    }

    getEventProduct() {
        return this.eventProduct || this.kernel?.getEventProduct?.() || null;
    }

    setEventProduct(product) {
        this.eventProduct = product && typeof product === 'object' ? product : null;
        if (!this.localDownscaleProduct) {
            this._refreshLocalDownscaleProduct({ force: true, eventProduct: this.eventProduct });
        }
    }

    getLocalDownscaleProduct() {
        return this.localDownscaleProduct || this.kernel?.getLocalDownscaleProduct?.({ eventProduct: this.eventProduct }) || null;
    }

    getVisualCueProduct() {
        return buildVisualWeatherCueProduct({
            core: this.core,
            eventProduct: this.eventProduct,
            localDownscale: this.getLocalDownscaleProduct()
        });
    }

    setLocalDownscaleProduct(product) {
        this.localDownscaleProduct = product && typeof product === 'object' ? product : null;
    }

    setLocalFocusRegions(focusRegions = []) {
        this.kernel?.setLocalFocusRegions?.(Array.isArray(focusRegions) ? focusRegions : []);
        this._refreshLocalDownscaleProduct({ force: true, eventProduct: this.eventProduct });
    }

    _refreshEventProduct(options = {}) {
        if (!this.kernel?.getEventProduct) return null;
        try {
            this.eventProduct = this.kernel.getEventProduct(options);
            this._refreshLocalDownscaleProduct({ force: options.force === true, eventProduct: this.eventProduct });
            return this.eventProduct;
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[WeatherField] event product update failed', err);
            }
            return this.eventProduct;
        }
    }

    _refreshLocalDownscaleProduct(options = {}) {
        if (!this.kernel?.getLocalDownscaleProduct) return this.localDownscaleProduct;
        try {
            this.localDownscaleProduct = this.kernel.getLocalDownscaleProduct({
                force: options.force === true,
                eventProduct: options.eventProduct || this.eventProduct
            });
            return this.localDownscaleProduct;
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[WeatherField] local downscale update failed', err);
            }
            return this.localDownscaleProduct;
        }
    }

    setV2ConvectionEnabled(enabled) {
        this.kernel?.setV2ConvectionEnabled?.(enabled);
    }

    logNow(simTimeSeconds, simContext = {}, reason) {
        const simSpeed = Number.isFinite(simContext.simSpeed)
            ? simContext.simSpeed
            : this._simContext.simSpeed;
        const paused = typeof simContext.paused === 'boolean'
            ? simContext.paused
            : this._simContext.paused;
        this.core.setLoggerContext?.({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan });
        return this.logger.recordNow({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan }, this.core, { reason });
    }

    logValidationSnapshot(simTimeSeconds, simContext = {}, options = {}) {
        const simSpeed = Number.isFinite(simContext.simSpeed)
            ? simContext.simSpeed
            : this._simContext.simSpeed;
        const paused = typeof simContext.paused === 'boolean'
            ? simContext.paused
            : this._simContext.paused;
        this.core.setLoggerContext?.({ simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan });
        return this.logger.recordValidationSnapshot(
            { simTimeSeconds, simSpeed, paused, stepsRanThisTick: this._lastStepsRan },
            this.core,
            options
        );
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

    _paintClouds(simTimeSeconds, { paintLow = true, paintHigh = true } = {}) {
        if (!this.core.ready) return;
        if (!paintLow && !paintHigh) return;
        const { grid, fields } = this.core;

        const simTime = Number.isFinite(simTimeSeconds) ? simTimeSeconds : this.core.timeUTC || 0;
        const deltaSim = this._lastPaintSimTime === null ? 0 : Math.max(0, simTime - this._lastPaintSimTime);
        const advectSeconds = Math.min(deltaSim, 3 * 3600);
        this._lastPaintSimTime = simTime;

        // Cache global means directly from model fields (when ready)
        if (this.core?.ready && fields?.cloudLow && fields?.cloudHigh) {
            const nCells = fields.cloudLow.length || 1;
            let sumLow = 0;
            let sumHigh = 0;
            for (let i = 0; i < nCells; i++) {
                sumLow += fields.cloudLow[i];
                sumHigh += fields.cloudHigh[i];
            }
            this._cloudLowMean = sumLow / nCells;
            this._cloudHighMean = sumHigh / nCells;
        }

        const drawLayer = ({
            ctx,
            img,
            data,
            cloudField,
            tauField,
            uField,
            vField,
            advectSeconds,
            noiseField,
            shadeBase,
            shadeVar,
            renderParams,
            isHigh
        }) => {
            const w = ctx.canvas.width;
            const h = ctx.canvas.height;
            const visualMode = this.visualMode;
            const precipField = fields.precipRate;
            const temperatureField = fields.Ts || this.core.state?.Ts;
            const landMaskField = this.core.geo?.landMask;
            const soilMoistureField = this.core.state?.soilMoistureFraction;
            data.fill(0);
            for (let y = 0; y < h; y++) {
                const lat = (y / h) * grid.ny;
                const j = Math.max(0, Math.min(grid.ny - 1, Math.floor(lat)));
                const latDeg = grid.latDeg?.[j] ?? (90 - ((j + 0.5) / Math.max(1, grid.ny)) * 180);
                const kmPerDegLat = 111.0;
                const kmPerDegLon = Math.max(1.0, kmPerDegLat * grid.cosLat[j]);
                for (let x = 0; x < w; x++) {
                    const lon = (x / w) * grid.nx;
                    const u = bilinear(uField, lon, lat, grid.nx, grid.ny);
                    const v = bilinear(vField, lon, lat, grid.nx, grid.ny);
                    const dLonCells = (u * advectSeconds) / (kmPerDegLon * 1000 * grid.cellLonDeg);
                    const dLatCells = (v * advectSeconds) / (kmPerDegLat * 1000 * grid.cellLatDeg);

                    const cloud = bilinear(cloudField, lon - dLonCells, lat - dLatCells, grid.nx, grid.ny);
                    const tau = bilinear(tauField, lon - dLonCells, lat - dLatCells, grid.nx, grid.ny);
                    const advLon = lon - dLonCells;
                    const advLat = lat - dLatCells;
                    const sampleI = ((Math.floor(advLon) % grid.nx) + grid.nx) % grid.nx;
                    const sampleJ = Math.max(0, Math.min(grid.ny - 1, Math.floor(advLat)));
                    const sampleK = sampleJ * grid.nx + sampleI;
                    const precipRateMmHr = Math.max(0, precipField?.[sampleK] || 0);
                    const temperatureK = temperatureField?.[sampleK] || 288;
                    const landMask = landMaskField?.[sampleK] || 0;
                    const soilMoisture01 = soilMoistureField?.[sampleK] || 0.35;
                    const n = this._sampleCloudNoise(noiseField, advLon, advLat, grid);
                    const tauEff = Math.max(0, tau);
                    const aBase = Math.pow(cloud, isHigh ? renderParams.gammaHigh : renderParams.gammaLow) *
                        (isHigh ? renderParams.aHigh : renderParams.aLow);
                    let alpha = Math.max(0, Math.min(1, aBase));
                    if (isHigh) alpha = Math.min(alpha, renderParams.alphaHighCap);

                    const bright = 1 - Math.exp(-tauEff / (isHigh ? renderParams.tauBrightHigh : renderParams.tauBrightLow));
                    let value = alpha * (0.55 + 0.45 * bright);
                    const edgeScale = isHigh ? renderParams.tauEdgeHigh : renderParams.tauEdgeLow;
                    if (edgeScale > 0) {
                        const edge = 1 - Math.exp(-tauEff * edgeScale);
                        value *= 0.90 + 0.10 * edge;
                    }

                    if (this.renderParams.debugMode === 'cloudLow' && !isHigh) {
                        value = cloud;
                        alpha = 1;
                    } else if (this.renderParams.debugMode === 'cloudHigh' && isHigh) {
                        value = cloud;
                        alpha = 1;
                    } else if (this.renderParams.debugMode === 'tauLow' && !isHigh) {
                        value = Math.max(0, Math.min(1, tauEff / 50));
                        alpha = 1;
                    } else if (this.renderParams.debugMode === 'tauHigh' && isHigh) {
                        value = Math.max(0, Math.min(1, tauEff / 50));
                        alpha = 1;
                    }

                    const idx = (y * w + x) * 4;
                    const shade = shadeBase + Math.floor(shadeVar * (n - 0.5));
                    const baseShadeValue = Math.max(0, Math.min(255, Math.floor(shade * value)));
                    if (alpha < 0.008 && precipRateMmHr < 0.02 && visualMode !== 'radar') {
                        data[idx] = 0;
                        data[idx + 1] = 0;
                        data[idx + 2] = 0;
                        data[idx + 3] = 0;
                        continue;
                    }
                    const windSpeedMs = Math.hypot(u, v);
                    const visual = classifyVisualWeatherCell({
                        cloudLow: isHigh ? 0 : cloud,
                        cloudHigh: isHigh ? cloud : 0,
                        tauLow: isHigh ? 0 : tauEff,
                        tauHigh: isHigh ? tauEff : 0,
                        precipRateMmHr,
                        windSpeedMs,
                        temperatureK,
                        landMask,
                        soilMoisture01,
                        latDeg
                    });
                    const visualColor = renderVisualWeatherColor({
                        mode: this.visualMode,
                        isHigh,
                        cloud,
                        tau: tauEff,
                        precipRateMmHr,
                        temperatureK,
                        windSpeedMs,
                        visual,
                        noise: n,
                        baseShade: baseShadeValue,
                        baseValue: value,
                        baseAlpha: alpha
                    });
                    data[idx] = visualColor.r;
                    data[idx + 1] = visualColor.g;
                    data[idx + 2] = visualColor.b;
                    data[idx + 3] = Math.floor(255 * visualColor.a);
                }
            }
            this._blendTextureLongitudeSeam(data, w, h);
            ctx.putImageData(img, 0, 0);
            this._softenLayerCanvas(ctx);
        };

        if (paintLow) {
            drawLayer({
                ctx: this.ctxCloudLow,
                img: this.imgCloudLow,
                data: this.dataCloudLow,
                cloudField: fields.cloudLow,
                tauField: fields.tauLow,
                uField: fields.u,
                vField: fields.v,
                advectSeconds,
                noiseField: this._cloudNoiseLow,
                shadeBase: 230,
                shadeVar: 24,
                renderParams: this.renderParams,
                isHigh: false
            });
        }

        if (paintHigh) {
            drawLayer({
                ctx: this.ctxCloudHigh,
                img: this.imgCloudHigh,
                data: this.dataCloudHigh,
                cloudField: fields.cloudHigh,
                tauField: fields.tauHigh,
                uField: fields.uU,
                vField: fields.vU,
                advectSeconds,
                noiseField: this._cloudNoiseHigh,
                shadeBase: 240,
                shadeVar: 20,
                renderParams: this.renderParams,
                isHigh: true
            });
        }

        this._paintEventCloudSignatures(simTime, { paintLow, paintHigh });
        this._paintLocalDownscaleSignatures(simTime, { paintLow, paintHigh });

        if (paintLow) this.textureLow.needsUpdate = true;
        if (paintHigh) this.textureHigh.needsUpdate = true;
    }

    _paintLocalDownscaleSignatures(simTimeSeconds, { paintLow = true, paintHigh = true } = {}) {
        const regions = this.localDownscaleProduct?.regions;
        if (!Array.isArray(regions) || regions.length === 0) return;
        if (!paintLow && !paintHigh) return;
        const w = this.canvasCloudLow.width;
        const h = this.canvasCloudLow.height;
        const kmPerPixelLat = (180 * 111) / Math.max(1, h);
        const projectLatLon = (lat, lon, wrapOffsetX = 0) => ({
            x: ((lon + 180) / 360) * w + wrapOffsetX,
            y: ((90 - lat) / 180) * h
        });
        const drawCell = (ctx, lat, lon, radiusPx, fillStyle, wrapOffsetX = 0) => {
            const { x, y } = projectLatLon(lat, lon, wrapOffsetX);
            ctx.beginPath();
            ctx.ellipse(x, y, radiusPx / Math.max(0.35, Math.cos((lat * Math.PI) / 180)), radiusPx, 0, 0, Math.PI * 2);
            ctx.fillStyle = fillStyle;
            ctx.fill();
        };
        const drawFastCell = (ctx, lat, lon, radiusPx, fillStyle, wrapOffsetX = 0) => {
            const { x, y } = projectLatLon(lat, lon, wrapOffsetX);
            const rx = radiusPx / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
            ctx.fillStyle = fillStyle;
            ctx.fillRect(x - rx, y - radiusPx, rx * 2, radiusPx * 2);
        };
        for (const region of regions.slice(0, 8)) {
            const fields = region.fields || {};
            const nx = region.grid?.nx || 0;
            const ny = region.grid?.ny || 0;
            if (!nx || !ny || !fields.latDeg || !fields.lonDeg) continue;
            const isFocusRegion = region.source === 'focus';
            const stride = isFocusRegion ? (nx > 21 ? 3 : 2) : (nx > 27 ? 2 : 1);
            const cellRadius = Math.max(0.8, Math.min(isFocusRegion ? 2.2 : 3.5, (region.spacingKm || 20) / kmPerPixelLat * 0.48));
            const paintCell = isFocusRegion ? drawFastCell : drawCell;
            const phase = (Number.isFinite(simTimeSeconds) ? simTimeSeconds : 0) / 1800;
            if (paintLow) {
                this.ctxCloudLow.save();
                this.ctxCloudLow.globalCompositeOperation = 'lighter';
            }
            if (paintHigh) {
                this.ctxCloudHigh.save();
                this.ctxCloudHigh.globalCompositeOperation = 'lighter';
            }
            for (let y = 0; y < ny; y += stride) {
                for (let x = 0; x < nx; x += stride) {
                    const p = y * nx + x;
                    const weight = fields.detailWeight?.[p] || 0;
                    if (weight < 0.06) continue;
                    const lat = fields.latDeg[p];
                    const lon = fields.lonDeg[p];
                    const rain = fields.rainRateMmHr?.[p] || 0;
                    const low = fields.cloudLow?.[p] || 0;
                    const high = fields.cloudHigh?.[p] || 0;
                    const lightning = fields.lightningRate?.[p] || 0;
                    const hail = fields.hailRisk?.[p] || 0;
                    const tornado = fields.tornadoTrackMask?.[p] || 0;
                    const parentRain = fields.parentRainRateMmHr?.[p] || 0;
                    const focusMateriality = isFocusRegion
                        ? Math.min(1, Math.max(0, rain - parentRain) * 5 + Math.max(0, low - 0.36) * 0.7 + Math.max(0, high - 0.34) * 0.45)
                        : 1;
                    if (focusMateriality < 0.04) continue;
                    const pulse = 0.82 + 0.18 * Math.sin(phase + p * 0.37);
                    const lowAlpha = Math.min(0.38, weight * focusMateriality * (0.02 + rain * 0.075 + low * 0.12 + hail * 0.16 + tornado * 0.28)) * pulse;
                    const highAlpha = Math.min(0.34, weight * focusMateriality * (0.018 + high * 0.13 + rain * 0.036 + lightning * 0.08));
                    if (paintLow && lowAlpha > 0.012) {
                        const warmTint = Math.min(255, 218 + hail * 32 + tornado * 20);
                        for (const offset of [-w, 0, w]) {
                            paintCell(this.ctxCloudLow, lat, lon, cellRadius * (1.0 + rain * 0.09), `rgba(${warmTint}, ${232 - hail * 40}, ${246 - tornado * 70}, ${lowAlpha})`, offset);
                        }
                    }
                    if (paintHigh && highAlpha > 0.012) {
                        for (const offset of [-w, 0, w]) {
                            paintCell(this.ctxCloudHigh, lat, lon, cellRadius * 1.45, `rgba(248, 252, 255, ${highAlpha})`, offset);
                        }
                    }
                    if (paintHigh && lightning > 0.22 && ((p + Math.floor(phase * 7)) % 17 === 0)) {
                        for (const offset of [-w, 0, w]) {
                            paintCell(this.ctxCloudHigh, lat, lon, cellRadius * 0.8, `rgba(255, 244, 180, ${Math.min(0.34, lightning * weight)})`, offset);
                        }
                    }
                }
            }
            if (paintLow && Array.isArray(region.tornadoTracks) && region.tornadoTracks.length > 0) {
                this.ctxCloudLow.lineCap = 'round';
                for (const track of region.tornadoTracks) {
                    const start = track.start;
                    const end = track.end;
                    if (!start || !end) continue;
                    for (const offset of [-w, 0, w]) {
                        const a = projectLatLon(start.latDeg, start.lonDeg, offset);
                        const b = projectLatLon(end.latDeg, end.lonDeg, offset);
                        this.ctxCloudLow.beginPath();
                        this.ctxCloudLow.moveTo(a.x, a.y);
                        this.ctxCloudLow.lineTo(b.x, b.y);
                        this.ctxCloudLow.strokeStyle = 'rgba(255, 110, 110, 0.34)';
                        this.ctxCloudLow.lineWidth = Math.max(1, cellRadius * 0.85);
                        this.ctxCloudLow.stroke();
                    }
                }
            }
            if (paintLow) this.ctxCloudLow.restore();
            if (paintHigh) this.ctxCloudHigh.restore();
        }
    }

    _paintEventCloudSignatures(simTimeSeconds, { paintLow = true, paintHigh = true } = {}) {
        const events = this.eventProduct?.activeEvents;
        if (!Array.isArray(events) || events.length === 0) return;
        if (!paintLow && !paintHigh) return;
        const tropicalEvents = events
            .filter((event) => event?.type === 'hurricane' || event?.type === 'tropical-disturbance')
            .slice(0, 8);
        const severeEvents = events
            .filter((event) => event?.severeWeather && (
                event.type === 'supercell'
                || event.type === 'tornado-outbreak'
                || event.type === 'tornado-touchdown'
            ))
            .slice(0, 12);
        if (tropicalEvents.length === 0 && severeEvents.length === 0) return;
        const w = this.canvasCloudHigh.width;
        const h = this.canvasCloudHigh.height;
        const kmPerPixelLat = (180 * 111) / Math.max(1, h);
        const projectLatLon = (lat, lon, wrapOffsetX = 0) => ({
            x: ((lon + 180) / 360) * w + wrapOffsetX,
            y: ((90 - lat) / 180) * h
        });
        const drawTropicalOnContext = (ctx, event, wrapOffsetX = 0) => {
            const center = event.hurricane?.center || event.center;
            if (!center) return;
            const lat = Number(center.latDeg);
            const lon = Number(center.lonDeg);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
            const intensity = Math.max(0.1, Math.min(1, event.hurricane?.intensity01 ?? event.intensity01 ?? 0.2));
            const radiusKm = Math.max(120, event.hurricane?.rainShieldRadiusKm ?? event.radiusKm ?? 260);
            const { x: cx, y: cy } = projectLatLon(lat, lon, wrapOffsetX);
            const radiusY = Math.max(5, radiusKm / kmPerPixelLat);
            const radiusX = radiusY / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
            const spiralCount = Math.max(2, Math.min(6, event.hurricane?.rainShield?.spiralBandCount ?? Math.round(2 + intensity * 4)));
            const spinSign = lat >= 0 ? 1 : -1;
            const phase = ((simTimeSeconds || 0) / 5400) * spinSign;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let arm = 0; arm < spiralCount; arm++) {
                const armPhase = phase + (arm / spiralCount) * Math.PI * 2;
                ctx.beginPath();
                for (let n = 0; n <= 42; n++) {
                    const t = n / 42;
                    const r = radiusY * (0.18 + 0.82 * t);
                    const angle = armPhase + spinSign * (0.9 + 4.2 * t);
                    const px = cx + Math.cos(angle) * r * (radiusX / radiusY);
                    const py = cy + Math.sin(angle) * r;
                    if (n === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                const alpha = event.type === 'hurricane' ? 0.18 + 0.38 * intensity : 0.08 + 0.18 * intensity;
                ctx.strokeStyle = `rgba(245, 250, 255, ${alpha})`;
                ctx.lineWidth = Math.max(1, Math.min(5, radiusY * 0.055 * intensity));
                ctx.stroke();
            }
            if (event.type === 'hurricane' && intensity >= 0.45) {
                const eyeRadiusPx = Math.max(1.5, (event.hurricane?.eyeRadiusKm ?? 24) / kmPerPixelLat);
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.ellipse(cx, cy, eyeRadiusPx / Math.max(0.45, Math.cos((lat * Math.PI) / 180)), eyeRadiusPx, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.8, 0.25 + intensity * 0.55)})`;
                ctx.fill();
                ctx.globalCompositeOperation = 'lighter';
                ctx.beginPath();
                ctx.ellipse(cx, cy, eyeRadiusPx * 1.7, eyeRadiusPx * 1.25, 0, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + intensity * 0.34})`;
                ctx.lineWidth = Math.max(1, eyeRadiusPx * 0.35);
                ctx.stroke();
            }
            ctx.restore();
        };
        const drawPolygon = (ctx, polygon, wrapOffsetX, { strokeStyle, fillStyle, lineWidth = 1 }) => {
            if (!Array.isArray(polygon) || polygon.length < 3) return;
            ctx.beginPath();
            polygon.forEach((point, index) => {
                const lat = Number(point.latDeg);
                const lon = Number(point.lonDeg);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                const { x, y } = projectLatLon(lat, lon, wrapOffsetX);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            if (fillStyle) {
                ctx.fillStyle = fillStyle;
                ctx.fill();
            }
            if (strokeStyle) {
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = lineWidth;
                ctx.stroke();
            }
        };
        const drawSevereOnContext = (event, wrapOffsetX = 0) => {
            const severe = event.severeWeather;
            const center = severe?.center || event.center;
            if (!center) return;
            const lat = Number(center.latDeg);
            const lon = Number(center.lonDeg);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
            const intensity = Math.max(0.15, Math.min(1, event.intensity01 ?? severe.environmentIndex01 ?? 0.25));
            const { x: cx, y: cy } = projectLatLon(lat, lon, wrapOffsetX);
            const motion = severe.motionVector || event.motionVector || { uMs: 10, vMs: 2 };
            const speed = Math.max(1, Math.hypot(motion.uMs || 0, motion.vMs || 0));
            const eastUnit = (motion.uMs || 0) / speed;
            const northUnit = (motion.vMs || 0) / speed;
            const anvilKm = severe.satelliteSignature?.anvilRadiusKm ?? (70 + 220 * intensity);
            const anvilY = Math.max(4, anvilKm / kmPerPixelLat);
            const anvilX = anvilY / Math.max(0.45, Math.cos((lat * Math.PI) / 180));
            const anvilCx = cx + eastUnit * anvilX * 0.35;
            const anvilCy = cy - northUnit * anvilY * 0.35;
            if (paintHigh) {
                this.ctxCloudHigh.save();
                this.ctxCloudHigh.globalCompositeOperation = 'lighter';
                this.ctxCloudHigh.beginPath();
                this.ctxCloudHigh.ellipse(anvilCx, anvilCy, anvilX * 1.25, anvilY * 0.72, Math.atan2(northUnit, eastUnit), 0, Math.PI * 2);
                this.ctxCloudHigh.fillStyle = `rgba(245, 250, 255, ${0.10 + 0.22 * intensity})`;
                this.ctxCloudHigh.fill();
                if (severe.satelliteSignature?.overshootingTop) {
                    this.ctxCloudHigh.beginPath();
                    this.ctxCloudHigh.arc(cx, cy, Math.max(1.5, anvilY * 0.13), 0, Math.PI * 2);
                    this.ctxCloudHigh.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.28 * intensity})`;
                    this.ctxCloudHigh.fill();
                }
                this.ctxCloudHigh.restore();
            }

            if (paintLow) {
                this.ctxCloudLow.save();
                this.ctxCloudLow.globalCompositeOperation = 'lighter';
                drawPolygon(this.ctxCloudLow, severe.warningPolygon, wrapOffsetX, {
                    strokeStyle: `rgba(250, 204, 21, ${0.24 + 0.24 * intensity})`,
                    fillStyle: `rgba(250, 204, 21, ${0.025 + 0.035 * intensity})`,
                    lineWidth: Math.max(1, intensity * 2.2)
                });
                for (const swath of severe.damageSwaths || []) {
                    drawPolygon(this.ctxCloudLow, swath.polygon, wrapOffsetX, {
                        strokeStyle: `rgba(248, 113, 113, ${0.16 + 0.22 * intensity})`,
                        fillStyle: `rgba(127, 29, 29, ${0.05 + 0.08 * intensity})`,
                        lineWidth: Math.max(1, intensity * 1.6)
                    });
                }
                const hookRadius = Math.max(3, (25 + 70 * intensity) / kmPerPixelLat);
                const hookSign = lat >= 0 ? 1 : -1;
                this.ctxCloudLow.beginPath();
                for (let n = 0; n <= 28; n++) {
                    const t = n / 28;
                    const angle = hookSign * (0.4 + 3.7 * t);
                    const r = hookRadius * (0.35 + 0.75 * t);
                    const px = cx - eastUnit * hookRadius * 0.45 + Math.cos(angle) * r;
                    const py = cy + northUnit * hookRadius * 0.35 + Math.sin(angle) * r;
                    if (n === 0) this.ctxCloudLow.moveTo(px, py);
                    else this.ctxCloudLow.lineTo(px, py);
                }
                this.ctxCloudLow.strokeStyle = `rgba(255, 255, 255, ${0.18 + 0.42 * intensity})`;
                this.ctxCloudLow.lineWidth = Math.max(1.2, hookRadius * 0.14);
                this.ctxCloudLow.lineCap = 'round';
                this.ctxCloudLow.stroke();
                if (severe.radarSignature?.velocityCouplet) {
                    const coupletOffset = Math.max(2.2, hookRadius * 0.38);
                    this.ctxCloudLow.beginPath();
                    this.ctxCloudLow.arc(cx - coupletOffset, cy, Math.max(1.5, hookRadius * 0.16), 0, Math.PI * 2);
                    this.ctxCloudLow.fillStyle = `rgba(56, 189, 248, ${0.18 + 0.25 * intensity})`;
                    this.ctxCloudLow.fill();
                    this.ctxCloudLow.beginPath();
                    this.ctxCloudLow.arc(cx + coupletOffset, cy, Math.max(1.5, hookRadius * 0.16), 0, Math.PI * 2);
                    this.ctxCloudLow.fillStyle = `rgba(248, 113, 113, ${0.18 + 0.25 * intensity})`;
                    this.ctxCloudLow.fill();
                }
                this.ctxCloudLow.restore();
            }
        };
        for (const event of tropicalEvents) {
            for (const offset of [-w, 0, w]) {
                if (paintLow) drawTropicalOnContext(this.ctxCloudLow, event, offset);
                if (paintHigh) drawTropicalOnContext(this.ctxCloudHigh, event, offset);
            }
        }
        for (const event of severeEvents) {
            for (const offset of [-w, 0, w]) {
                drawSevereOnContext(event, offset);
            }
        }
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

        this._blendTextureLongitudeSeam(data, w, h);
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
            case 'slp':
                return fields.slp || fields.ps;
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
                return this.core.state?.sstNow || this.core.climo?.sstNow || this._getZeroScratch();
            case 'seaIce':
                return this.core.state?.seaIceFrac || this.core.climo?.iceNow || this._getZeroScratch();
            case 'seaIceThickness':
                return this.core.state?.seaIceThicknessM || this._getZeroScratch();
            case 'albedo':
                return this.core.geo?.albedo || this._getZeroScratch();
            case 'elev':
                return this.core.geo?.elev || this._getZeroScratch();
            case 'soilCap':
                return this.core.geo?.soilCap || this.core.geo?.soilM || this._getZeroScratch();
            case 'soilW':
                return this.core.geo?.soilW || this._getZeroScratch();
            case 'landMask':
                return this.core.geo?.landMask || this._getZeroScratch();
            case 'wind':
                return this._computeWindSpeed();
            case 'windUpper':
                return this._computeWindSpeed(this.core.fields.uU, this.core.fields.vU);
            case 'h850':
                return fields.h850 || this._getZeroScratch();
            case 'h700':
                return fields.h700 || this._getZeroScratch();
            case 'h500':
                return fields.h500 || this._getZeroScratch();
            case 'h250':
                return fields.h250 || this._getZeroScratch();
            case 'hUpper':
                return fields.hU;
            case 'omegaL':
                return fields.omegaL;
            case 'omegaU':
                return fields.omegaU;
            case 'phiMid':
                return fields.phiMid || this._getZeroScratch();
            case 'tauLow':
                return fields.tauLow;
            case 'tauHigh':
                return fields.tauHigh;
            case 'tauLowDelta':
                return fields.tauLowDelta;
            case 'cloudLow':
                return fields.cloudLow;
            case 'cloudHigh':
                return fields.cloudHigh;
            case 'cwpLow':
                return fields.cwpLow;
            case 'cwpHigh':
                return fields.cwpHigh;
            case 'tcGenesis':
                return fields.tcGenesis;
            case 'tcMask':
                return fields.tcMask;
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
            case 'slp':
                return { fixed: [98000, 104500] };
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
            case 'seaIceThickness':
                return { fixed: [0, 3] };
            case 'albedo':
                return { fixed: [0, 1] };
            case 'elev':
                return { fixed: [0, 5000] };
            case 'soilCap':
                return { fixed: [0, 1] };
            case 'soilW':
                return { fixed: [0, 200] };
            case 'landMask':
                return { fixed: [0, 1] };
            case 'wind':
                return { fixed: [0, 30] };
            case 'windUpper':
                return { fixed: [0, 100] };
            case 'h850':
                return { fixed: [500, 1800] };
            case 'h700':
                return { fixed: [2000, 4000] };
            case 'h500':
                return { fixed: [4800, 6200] };
            case 'h250':
                return { fixed: [9000, 12000] };
            case 'hUpper':
                return { fixed: [1000, 12000] };
            case 'omegaL':
                return { fixed: [-0.2, 0.2], diverging: true };
            case 'omegaU':
                return { fixed: [-0.2, 0.2], diverging: true };
            case 'phiMid':
                return { fixed: [0, 600000] };
            case 'tauLow':
                return { fixed: [0, 20] };
            case 'tauHigh':
                return { fixed: [0, 20] };
            case 'tauLowDelta':
                return { fixed: [0, 1] };
            case 'cloudLow':
                return { fixed: [0, 1] };
            case 'cloudHigh':
                return { fixed: [0, 1] };
            case 'cwpLow':
                return { fixed: [0, 0.5], log: true };
            case 'cwpHigh':
                return { fixed: [0, 0.5], log: true };
            case 'tcGenesis':
                return { fixed: [0, 0.2], log: true };
            case 'tcMask':
                return { fixed: [0, 1] };
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

    getCloudStats() {
        return {
            cloudLowMean: this._cloudLowMean || 0,
            cloudHighMean: this._cloudHighMean || 0,
            cloudMean: ((this._cloudLowMean || 0) + (this._cloudHighMean || 0)) * 0.5
        };
    }

    sampleCloudLow(u, v) {
        if (!this.core.ready) return 0;
        const { grid, fields } = this.core;
        const lon = Math.floor(grid.nx * u) % grid.nx;
        let lat = Math.floor(grid.ny * v);
        lat = Math.max(0, Math.min(grid.ny - 1, lat));
        const k = lat * grid.nx + lon;
        return fields.cloudLow[k];
    }

    sampleCloudHigh(u, v) {
        if (!this.core.ready) return 0;
        const { grid, fields } = this.core;
        const lon = Math.floor(grid.nx * u) % grid.nx;
        let lat = Math.floor(grid.ny * v);
        lat = Math.max(0, Math.min(grid.ny - 1, lat));
        const k = lat * grid.nx + lon;
        return fields.cloudHigh[k];
    }
}

export default WeatherField;
