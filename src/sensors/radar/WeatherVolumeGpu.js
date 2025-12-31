import * as THREE from 'three';
import { Rd } from '../../weather/constants';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pickPTopPa = (core) => {
    const pTop = core?.microParams?.pTop ?? core?.radParams?.pTop;
    return Number.isFinite(pTop) ? pTop : 20000;
};

export class WeatherVolumeGpu {
    constructor({ renderer, core, options = {} }) {
        this.renderer = renderer;
        this.core = core;
        this.useHalfFloat = options.useHalfFloat !== undefined ? options.useHalfFloat : true;
        this.uploadCadenceSimSeconds = options.uploadCadenceSimSeconds ?? 3600;
        this.maxUploadsPerRealSecond = options.maxUploadsPerRealSecond ?? 4;
        this.debug = options.debug ?? false;

        this.psUnits = 'hPa';
        this.psToPa = 100;

        this.lastUploadSimTime = null;
        this.lastUploadRealMs = 0;
        this.lastWarning = null;

        this.capabilities = WeatherVolumeGpu.getCapabilities(renderer, this.useHalfFloat);
        this.floatType = this.capabilities.floatType;
        this.weatherTex3D = null;
        this.psTex2D = null;
        this.uniforms = null;

        if (!this.isSupported()) {
            this._setWarning(this.capabilities.reason || 'WebGL2 required for Data3DTexture/sampler3D');
            return;
        }
        if (!core?.grid || !core?.state) {
            this._setWarning('Missing v2 core for weather volume GPU upload');
            return;
        }

        this._initDimensions();
        if (this.nx <= 0 || this.ny <= 0 || this.nz <= 0) {
            this._setWarning('Invalid grid dimensions for weather volume GPU upload');
            return;
        }
        this._initStaging();
        this._initTextures();
        this._initUniforms();
    }

    static getCapabilities(renderer, useHalfFloat = true) {
        const isWebGL2 = !!renderer?.capabilities?.isWebGL2;
        const has3DTextures = isWebGL2;
        let reason = null;
        if (!isWebGL2) {
            reason = 'WebGL2 required for Data3DTexture/sampler3D';
        }
        const floatType = useHalfFloat && isWebGL2 ? THREE.HalfFloatType : THREE.FloatType;
        return { isWebGL2, has3DTextures, floatType, reason };
    }

    isSupported() {
        return !!this.capabilities?.has3DTextures;
    }

    getUnsupportedReason() {
        return this.isSupported() ? null : (this.capabilities?.reason || 'Unsupported');
    }

    getUniforms() {
        return this.uniforms;
    }

    update({ simTimeSeconds }) {
        if (!this.isSupported()) {
            this._setWarning(this.getUnsupportedReason());
            return false;
        }
        if (!Number.isFinite(simTimeSeconds)) return false;

        const nowMs = Date.now();
        const minRealInterval = 1000 / Math.max(1, this.maxUploadsPerRealSecond);

        if (this.lastUploadSimTime === null) {
            const didUpload = this.uploadFromCore();
            if (didUpload) {
                this.lastUploadSimTime = simTimeSeconds;
                this.lastUploadRealMs = nowMs;
            }
            return didUpload;
        }

        if (simTimeSeconds - this.lastUploadSimTime < this.uploadCadenceSimSeconds) return false;
        if (nowMs - this.lastUploadRealMs < minRealInterval) return false;

        const didUpload = this.uploadFromCore();
        if (didUpload) {
            this.lastUploadSimTime = simTimeSeconds;
            this.lastUploadRealMs = nowMs;
        }
        return didUpload;
    }

    uploadFromCore() {
        if (!this.weatherTex3D || !this.psTex2D) return false;

        const core = this.core;
        const state = core?.state;
        const grid = core?.grid;
        if (!state || !grid) {
            this._setWarning('Missing core state/grid for weather upload');
            return false;
        }

        const { qr, qi, u, v, ps } = state;
        if (!qr || !u || !v || !ps) {
            this._setWarning('Missing state fields for weather upload');
            return false;
        }

        const nx = this.nx;
        const ny = this.ny;
        const nz = this.nz;
        const N = this.N;

        if (qr.length !== N * nz || u.length !== N * nz || v.length !== N * nz) {
            this._setWarning('State 3D array size mismatch for weather upload');
            return false;
        }
        if (ps.length !== N) {
            this._setWarning('State ps array size mismatch for weather upload');
            return false;
        }

        const weather = this._weatherStaging;
        const psStaging = this._psStaging;
        const useHalf = this._useHalfFloatData;
        const toHalf = useHalf ? THREE.DataUtils.toHalfFloat : null;
        const psUseHalf = this._psType === THREE.HalfFloatType;
        const psToHalf = psUseHalf ? THREE.DataUtils.toHalfFloat : null;

        for (let lev = 0; lev < nz; lev += 1) {
            const levOffset = lev * N;
            for (let j = 0; j < ny; j += 1) {
                const rowOffset = j * nx;
                for (let i = 0; i < nx; i += 1) {
                    const k2D = rowOffset + i;
                    const idxState = levOffset + k2D;
                    const idxTex = ((lev * ny + j) * nx + i) * 4;

                    const qrVal = qr[idxState];
                    const qiVal = qi ? qi[idxState] : 0;
                    const uVal = u[idxState];
                    const vVal = v[idxState];

                    if (useHalf) {
                        weather[idxTex] = toHalf(qrVal);
                        weather[idxTex + 1] = toHalf(qiVal);
                        weather[idxTex + 2] = toHalf(uVal);
                        weather[idxTex + 3] = toHalf(vVal);
                    } else {
                        weather[idxTex] = qrVal;
                        weather[idxTex + 1] = qiVal;
                        weather[idxTex + 2] = uVal;
                        weather[idxTex + 3] = vVal;
                    }
                }
            }
        }

        if (this._psStride === 1) {
            for (let k = 0; k < N; k += 1) {
                const psHpa = clamp(ps[k] * 0.01, 200, 1100);
                psStaging[k] = psUseHalf ? psToHalf(psHpa) : psHpa;
            }
        } else {
            for (let k = 0; k < N; k += 1) {
                const idx = k * 4;
                const psHpa = clamp(ps[k] * 0.01, 200, 1100);
                psStaging[idx] = psUseHalf ? psToHalf(psHpa) : psHpa;
                psStaging[idx + 1] = 0;
                psStaging[idx + 2] = 0;
                psStaging[idx + 3] = 0;
            }
        }

        this.weatherTex3D.image.data = weather;
        this.psTex2D.image.data = psStaging;
        this.weatherTex3D.needsUpdate = true;
        this.psTex2D.needsUpdate = true;
        return true;
    }

    _initDimensions() {
        const grid = this.core?.grid;
        const state = this.core?.state;
        this.nx = grid?.nx ?? 0;
        this.ny = grid?.ny ?? 0;
        this.nz = state?.nz ?? this.core?.nz ?? 0;
        this.N = this.nx * this.ny;
    }

    _initStaging() {
        const weatherSize = this.N * this.nz * 4;
        const useHalf = this.floatType === THREE.HalfFloatType;
        this._useHalfFloatData = useHalf;
        this._weatherStaging = useHalf ? new Uint16Array(weatherSize) : new Float32Array(weatherSize);

        this._psIsRed = !!THREE.RedFormat && this.capabilities.isWebGL2;
        this._psStride = this._psIsRed ? 1 : 4;
        const psSize = this.N * this._psStride;
        this._psType = this.floatType === THREE.HalfFloatType ? THREE.HalfFloatType : THREE.FloatType;
        this._psStaging = this._psType === THREE.HalfFloatType ? new Uint16Array(psSize) : new Float32Array(psSize);
    }

    _initTextures() {
        this.weatherTex3D = new THREE.Data3DTexture(this._weatherStaging, this.nx, this.ny, this.nz);
        this.weatherTex3D.format = THREE.RGBAFormat;
        this.weatherTex3D.type = this.floatType;
        this.weatherTex3D.minFilter = THREE.LinearFilter;
        this.weatherTex3D.magFilter = THREE.LinearFilter;
        this.weatherTex3D.wrapS = THREE.RepeatWrapping;
        this.weatherTex3D.wrapT = THREE.ClampToEdgeWrapping;
        this.weatherTex3D.wrapR = THREE.ClampToEdgeWrapping;
        this.weatherTex3D.unpackAlignment = 1;
        this.weatherTex3D.needsUpdate = true;

        const psFormat = this._psIsRed ? THREE.RedFormat : THREE.RGBAFormat;
        this.psTex2D = new THREE.DataTexture(this._psStaging, this.nx, this.ny, psFormat, this._psType);
        this.psTex2D.minFilter = THREE.NearestFilter;
        this.psTex2D.magFilter = THREE.NearestFilter;
        this.psTex2D.wrapS = THREE.RepeatWrapping;
        this.psTex2D.wrapT = THREE.ClampToEdgeWrapping;
        this.psTex2D.unpackAlignment = 1;
        this.psTex2D.needsUpdate = true;
    }

    _initUniforms() {
        const grid = this.core?.grid;
        const sigmaHalf = this.core?.state?.sigmaHalf || this.core?.sigmaHalf;
        const nz = this.nz;
        const sigmaMid = new Float32Array(nz);
        if (sigmaHalf && sigmaHalf.length >= nz + 1) {
            for (let lev = 0; lev < nz; lev += 1) {
                sigmaMid[lev] = 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]);
            }
        } else {
            this._setWarning('Missing sigmaHalf for radar uniforms');
        }

        this.uniforms = {
            nx: this.nx,
            ny: this.ny,
            nz,
            cellLonDeg: grid?.cellLonDeg ?? 0,
            cellLatDeg: grid?.cellLatDeg ?? 0,
            pTopPa: pickPTopPa(this.core),
            psToPa: this.psToPa,
            sigmaMid,
            Rd,
            TrefK: 288,
            scaleHeightM: 8000
        };
    }

    _setWarning(message) {
        if (!message) return;
        this.lastWarning = { atMs: Date.now(), message };
    }
}
