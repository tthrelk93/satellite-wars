// core.js: orchestrates physics steps for the weather model
import { createLatLonGrid } from './grid';
import { createFields, initAtmosphere } from './fields';
import { loadGeoTexture, analyticGeo } from './geo';
import { loadClimatology } from './climatology';
import { cosZenith, surfaceRadiation } from './solar';
import { updateSurface, saturationMixingRatio } from './surface';
import { computeDensity } from './dynamics';
import { advectScalar } from './advect';
import { stepDyn2Layer } from './dyn2layer';
import { stepMicrophysics, stepUpperCloudMicrophysics } from './microphysics';
import { stepConvection } from './convection';
import { stepVerticalExchange } from './vertical';
import { stepStratiformClouds } from './clouds';
import { computeRH, computeRHUpper, computeOmegaProxy, computeVorticity, computeDivergence, computeCloudOptics, computePrecipRate } from './diagnostics';
import WeatherLogger from './WeatherLogger';
import { TropicalCycloneSystem } from './tropicalCyclones';

const HL0 = 9000;
const HU0 = 3000;
const P0 = 101325;
const P_SCALE = 10;

const NUDGE_TAU_U_L = 30 * 86400;
const NUDGE_TAU_U_U = 20 * 86400;
const NUDGE_TAU_H = 40 * 86400;
const NUDGE_TAU_T = 20 * 86400;
const NUDGE_CADENCE_SECONDS = 6 * 3600;
const NUDGE_LON_WINDOW = 31;
const NUDGE_LAT_WINDOW = 9;
const NUDGE_WINDS = false;
const KAPPA_UPPER_FACTOR = 0.5;

export class WeatherCore {
  constructor({
    nx = 180,
    ny = 90,
    dt = 120,        // modelDt seconds
    timeScale = 200, // model seconds per real second
    kappa = 2000,    // diffusion m^2/s
    seed
  } = {}) {
    this.grid = createLatLonGrid(nx, ny);
    this.fields = createFields(this.grid);
    this.geo = {
      landMask: new Uint8Array(this.grid.count),
      elev: new Float32Array(this.grid.count),
      albedo: new Float32Array(this.grid.count),
      soilM: new Float32Array(this.grid.count),
      soilCap: new Float32Array(this.grid.count),
      rough: new Float32Array(this.grid.count),
      sstNow: null,
      iceNow: null
    };
    this.climo = {
      sstMonths: [],
      iceMonths: null,
      sstNow: new Float32Array(this.grid.count),
      iceNow: null,
      slpMonths: null,
      windMonthsU: null,
      windMonthsV: null,
      wind500MonthsU: null,
      wind500MonthsV: null,
      wind250MonthsU: null,
      wind250MonthsV: null,
      t2mMonths: null,
      slpNow: null,
      windNowU: null,
      windNowV: null,
      wind500NowU: null,
      wind500NowV: null,
      wind250NowU: null,
      wind250NowV: null,
      t2mNow: null
    };
    this.timeUTC = 0;
    this.modelDt = dt;
    this.timeScale = timeScale;
    this.kappa = kappa;
    this.seed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1e9);
    this._accum = 0;
    this.ready = false;
    this._climoLastUpdateUTC = -Infinity;
    this.logger = null;
    this._loggerContext = null;
    this._lastAdvanceSteps = 0;
    this._nudgeAccumSeconds = 0;
    this.tcSystem = new TropicalCycloneSystem(this.seed);
    this.dynParams = {
      hMin: 500,
      alpha: 0.25,
      tauShear: 12 * 86400,
      tauDragL: 6 * 86400,
      tauDragU: 20 * 86400,
      nu4: 3e15,
      minDx: 80000,
      maxWind: 150,
      thermoCouplingL: 10,
      thermoCouplingU: 30,
      thermoTrefL: 285,
      thermoTrefU: 270
    };
    initAtmosphere(this.fields, this.grid, this.seed, { hL0: HL0, hU0: HU0, pScale: P_SCALE, p0: P0 });
    this._tmp = new Float32Array(this.grid.count);
    this._dynScratch = {
      uLAdv: new Float32Array(this.grid.count),
      vLAdv: new Float32Array(this.grid.count),
      uUAdv: new Float32Array(this.grid.count),
      vUAdv: new Float32Array(this.grid.count),
      hLAdv: new Float32Array(this.grid.count),
      hUAdv: new Float32Array(this.grid.count),
      divL: new Float32Array(this.grid.count),
      divU: new Float32Array(this.grid.count),
      phiL: new Float32Array(this.grid.count),
      phiU: new Float32Array(this.grid.count),
      lap: new Float32Array(this.grid.count),
      lap2: new Float32Array(this.grid.count),
      rowA: new Float32Array(this.grid.nx),
      rowB: new Float32Array(this.grid.nx)
    };
    this._smoothA = new Float32Array(this.grid.count);
    this._smoothB = new Float32Array(this.grid.count);
    this._smoothStore = {
      u: new Float32Array(this.grid.count),
      v: new Float32Array(this.grid.count),
      uU: new Float32Array(this.grid.count),
      vU: new Float32Array(this.grid.count),
      hL: new Float32Array(this.grid.count),
      hU: new Float32Array(this.grid.count),
      T: new Float32Array(this.grid.count)
    };
    this._computeDiagnostics(0);
    this._loadGeo();
  }

  async _loadGeo() {
    const [geoRaw, climo] = await Promise.all([
      loadGeoTexture(this.grid.nx, this.grid.ny),
      loadClimatology({ nx: this.grid.nx, ny: this.grid.ny, latDeg: this.grid.latDeg })
    ]);

    const geo = geoRaw || analyticGeo(this.grid.nx, this.grid.ny, this.grid.latDeg);
    geo.soilCap = geo.soilCap || geo.soilM;

    this.climo.sstMonths = climo.sstMonths;
    this.climo.iceMonths = climo.iceMonths;
    this.climo.sstNow = new Float32Array(this.grid.count);
    this.climo.iceNow = climo.iceMonths ? new Float32Array(this.grid.count) : null;
    this.climo.slpMonths = climo.slpMonths;
    this.climo.windMonthsU = climo.windMonthsU;
    this.climo.windMonthsV = climo.windMonthsV;
    this.climo.wind500MonthsU = climo.wind500MonthsU;
    this.climo.wind500MonthsV = climo.wind500MonthsV;
    this.climo.wind250MonthsU = climo.wind250MonthsU;
    this.climo.wind250MonthsV = climo.wind250MonthsV;
    this.climo.t2mMonths = climo.t2mMonths;

    this.climo.slpNow = climo.slpMonths ? new Float32Array(this.grid.count) : null;
    this.climo.windNowU = climo.windMonthsU ? new Float32Array(this.grid.count) : null;
    this.climo.windNowV = climo.windMonthsV ? new Float32Array(this.grid.count) : null;
    this.climo.wind500NowU = climo.wind500MonthsU ? new Float32Array(this.grid.count) : null;
    this.climo.wind500NowV = climo.wind500MonthsV ? new Float32Array(this.grid.count) : null;
    this.climo.wind250NowU = climo.wind250MonthsU ? new Float32Array(this.grid.count) : null;
    this.climo.wind250NowV = climo.wind250MonthsV ? new Float32Array(this.grid.count) : null;
    this.climo.t2mNow = climo.t2mMonths ? new Float32Array(this.grid.count) : null;

    geo.sstNow = this.climo.sstNow;
    geo.iceNow = this.climo.iceNow;

    geo.albedo = climo.albedo || geo.albedo;
    geo.elev = climo.elev || geo.elev;
    geo.soilCap = climo.soilCap || geo.soilCap;
    geo.soilM = geo.soilCap || geo.soilM;

    const deriveLandMask = (source, threshold) => {
      if (!source || source.length !== this.grid.count) return null;
      const mask = new Uint8Array(this.grid.count);
      let landCount = 0;
      for (let k = 0; k < source.length; k++) {
        const land = source[k] > threshold;
        if (land) landCount += 1;
        mask[k] = land ? 1 : 0;
      }
      return { mask, landFrac: landCount / source.length };
    };

    const landCandidates = [
      { name: 'soilCap', source: geo.soilCap, threshold: 0.01 },
      { name: 'elev', source: geo.elev, threshold: 5 },
      { name: 'albedo', source: geo.albedo, threshold: 0.08 }
    ];
    let fallback = null;
    let chosen = null;
    let warned = false;
    for (const candidate of landCandidates) {
      const result = deriveLandMask(candidate.source, candidate.threshold);
      if (!result) continue;
      if (!fallback) fallback = { ...result, name: candidate.name };
      if (result.landFrac >= 0.05 && result.landFrac <= 0.95) {
        chosen = { ...result, name: candidate.name };
        break;
      }
      if (!warned) {
        console.warn(`[WeatherCore] Derived landMask from ${candidate.name} has extreme land fraction (${(result.landFrac * 100).toFixed(1)}%). Trying fallback.`);
        warned = true;
      }
    }
    if (!chosen && fallback) {
      chosen = fallback;
      if (!warned) {
        console.warn(`[WeatherCore] Derived landMask from ${fallback.name} has extreme land fraction (${(fallback.landFrac * 100).toFixed(1)}%).`);
      }
    }
    if (chosen) {
      geo.landMask = chosen.mask;
    }

    this.geo = geo;
    this._updateClimoNow();
    this._initializeFromClimo();
    this.ready = true;
  }

  step(realDtSeconds) {
    if (!this.ready) return;
    this._accum += realDtSeconds * this.timeScale;
    const maxSteps = 8;
    let steps = 0;
    while (this._accum >= this.modelDt && steps < maxSteps) {
      this._stepOnce(this.modelDt);
      this._accum -= this.modelDt;
      steps++;
    }
    this._lastAdvanceSteps = steps;
    if (this._loggerContext) {
      this._loggerContext.stepsRanThisTick = steps;
    }
  }

  advanceModelSeconds(modelSeconds) {
    if (!this.ready) return;
    if (!Number.isFinite(modelSeconds) || modelSeconds <= 0) return;
    this._accum += modelSeconds;
    const steps = Math.floor(this._accum / this.modelDt);
    const maxSteps = Math.max(1000, Math.ceil(86400 / this.modelDt) + 10);
    const stepsToRun = Math.min(steps, maxSteps);
    if (this._loggerContext) {
      this._loggerContext.stepsRanThisTick = stepsToRun;
    }
    for (let i = 0; i < stepsToRun; i++) {
      this._stepOnce(this.modelDt);
    }
    this._accum -= stepsToRun * this.modelDt;
    if (stepsToRun < steps) {
      this._accum = Math.min(this._accum, this.modelDt * maxSteps);
    }
    this._lastAdvanceSteps = stepsToRun;
    return stepsToRun;
  }

  setSeed(seed) {
    if (!Number.isFinite(seed)) return;
    this.seed = seed;
    initAtmosphere(this.fields, this.grid, this.seed, { hL0: HL0, hU0: HU0, pScale: P_SCALE, p0: P0 });
    this._accum = 0;
    this.timeUTC = 0;
    this._climoLastUpdateUTC = -Infinity;
    this._computeDiagnostics(0);
    this.tcSystem?.setSeed?.(this.seed);
  }

  getSeed() {
    return this.seed;
  }

  setTimeUTC(seconds) {
    if (!Number.isFinite(seconds)) return;
    this.timeUTC = seconds;
    this._climoLastUpdateUTC = -Infinity;
    this._accum = 0;
    this._lastAdvanceSteps = 0;
    this._nudgeAccumSeconds = 0;
    this._updateClimoNow();
    this.tcSystem?.resetTime?.();
  }

  setLogger(logger) {
    this.logger = logger instanceof WeatherLogger ? logger : null;
  }

  setLoggerContext(context) {
    this._loggerContext = context || null;
  }

  getLoggerContext() {
    return this._loggerContext;
  }

  debugSpawnTropicalCyclone() {
    if (!this.tcSystem) return;
    this.tcSystem.debugSpawnBestCaribbean({
      timeUTC: this.timeUTC,
      grid: this.grid,
      fields: this.fields,
      geo: this.geo
    });
    this.tcSystem.step({
      dt: 0,
      timeUTC: this.timeUTC,
      grid: this.grid,
      fields: this.fields,
      geo: this.geo,
      dynParams: this.dynParams
    });
  }

  debugSpawnHurricane({ latDeg, lonDeg } = {}) {
    if (!this.tcSystem) return;
    this.tcSystem.debugSpawnHurricane({
      latDeg: Number.isFinite(latDeg) ? latDeg : 15,
      lonDeg: Number.isFinite(lonDeg) ? lonDeg : -60,
      vmax: 35,
      radiusKm: 450
    });
    this.tcSystem.step({
      dt: 0,
      timeUTC: this.timeUTC,
      grid: this.grid,
      fields: this.fields,
      geo: this.geo,
      dynParams: this.dynParams
    });
  }

  getLastAdvanceSteps() {
    return this._lastAdvanceSteps;
  }

  _stepOnce(dt) {
    const { grid, fields, geo } = this;
    const dayOfYear = (this.timeUTC / 86400) % 365;
    const tauDay = 8 * 86400;
    const tauNightClear = 2 * 86400;
    const tauNightCloudy = 4 * 86400;
    this._updateClimoNow(dayOfYear);
    const logger = this.logger;
    const logContext = this._loggerContext;
    const logEnabled = Boolean(logger && logger.enabled && logger.processEnabled);
    const runWithLog = (name, fn) => {
      if (!logEnabled) {
        fn();
        return;
      }
      const before = logger.buildProcessSnapshot(this);
      fn();
      const after = logger.buildProcessSnapshot(this);
      logger.logProcessDelta(logContext, this, name, before, after);
    };

    runWithLog('radiation', () => {
      for (let j = 0; j < grid.ny; j++) {
        for (let i = 0; i < grid.nx; i++) {
          const k = j * grid.nx + i;
          const latRad = (grid.latDeg[j] * Math.PI) / 180;
          const cosZ = cosZenith(latRad, grid.lonDeg[i], this.timeUTC, dayOfYear);
          const cloudFrac = Math.min(1, fields.cloud[k] || 0);
          const isDay = cosZ > 0.01;
          const tauL = isDay
            ? tauDay
            : (tauNightClear + (tauNightCloudy - tauNightClear) * cloudFrac);
          const tauU = tauL * 1.5;
          let albedo = geo.albedo[k];
          if (geo.iceNow) {
            const ice = Math.max(0, Math.min(1, geo.iceNow[k]));
            const iceAlbedo = 0.55;
            albedo = albedo * (1 - ice) + iceAlbedo * ice;
          }
          const rad = surfaceRadiation({
            cosZ,
            cloudFrac,
            albedo,
            Ts: fields.Ts[k],
            Tair: fields.T[k]
          });
          fields.rad[k] = rad;

          const sinLat = Math.sin(latRad);
          const TeqL = (285 - 55 * (sinLat * sinLat)) + 10 * cosZ - 6 * cloudFrac;
          const TeqU = TeqL - 18;
          fields.T[k] += (TeqL - fields.T[k]) * (dt / tauL);
          fields.TU[k] += (TeqU - fields.TU[k]) * (dt / tauU);
        }
      }
    });

    runWithLog('surfaceFluxes', () => {
      updateSurface({ dt, fields, geo, rad: fields.rad, grid });
    });

    runWithLog('dynamics', () => {
      stepDyn2Layer({ dt, grid, fields, params: this.dynParams, scratch: this._dynScratch });
    });

    this._nudgeAccumSeconds += dt;
    if (this._nudgeAccumSeconds >= NUDGE_CADENCE_SECONDS) {
      const dtNudge = this._nudgeAccumSeconds;
      this._nudgeAccumSeconds = 0;
      runWithLog('nudging', () => {
        this._applyNudging(dtNudge);
      });
    }

    // Derive surface pressure from lower-layer thickness
    this._deriveSurfacePressure();

    // Density from state
    computeDensity(fields);

    runWithLog('advection', () => {
      this._advectScalars(dt);
    });

    runWithLog('verticalExchange', () => {
      stepVerticalExchange({ dt, grid, fields, geo, dayOfYear, timeUTC: this.timeUTC, params: this.dynParams });
    });

    computeOmegaProxy(fields);
    this.tcSystem?.step({ dt, timeUTC: this.timeUTC, grid, fields, geo, dynParams: this.dynParams });

    runWithLog('stratiformClouds', () => {
      stepStratiformClouds({ dt, fields, geo, grid });
    });

    runWithLog('largeScaleMoisture', () => {
      this._applyLargeScaleMoisture(dt, dayOfYear);
    });

    runWithLog('microphysics', () => {
      stepMicrophysics({ dt, fields });
    });

    runWithLog('upperMicrophysics', () => {
      stepUpperCloudMicrophysics({ dt, fields });
    });

    runWithLog('convection', () => {
      stepConvection({ dt, fields, geo, grid, dayOfYear });
    });

    // Diagnostics
    this._computeDiagnostics(dt);

    if (logger && logger.enabled) {
      const desyncThreshold = Math.max(this.modelDt * 2, 600);
      logger.checkPanic(logContext, this, { desyncThresholdSeconds: desyncThreshold });
    }

    this.timeUTC += dt;
  }

  _updateClimoNow(dayOfYearOverride) {
    if (!this.climo?.sstMonths?.length) return;
    const nowUTC = this.timeUTC;
    if (nowUTC - this._climoLastUpdateUTC < 3600) return;
    const dayOfYear = Number.isFinite(dayOfYearOverride)
      ? dayOfYearOverride
      : (nowUTC / 86400) % 365;
    const monthFloat = (dayOfYear / 365) * 12;
    const m0 = Math.floor(monthFloat) % 12;
    const m1 = (m0 + 1) % 12;
    const f = monthFloat - Math.floor(monthFloat);

    const interpMonths = (months, out) => {
      if (!months || !out) return;
      const a = months[m0];
      const b = months[m1];
      if (!a || !b) return;
      for (let k = 0; k < a.length; k++) {
        out[k] = a[k] + (b[k] - a[k]) * f;
      }
    };

    interpMonths(this.climo.sstMonths, this.climo.sstNow);
    interpMonths(this.climo.iceMonths, this.climo.iceNow);
    interpMonths(this.climo.slpMonths, this.climo.slpNow);
    interpMonths(this.climo.windMonthsU, this.climo.windNowU);
    interpMonths(this.climo.windMonthsV, this.climo.windNowV);
    interpMonths(this.climo.wind500MonthsU, this.climo.wind500NowU);
    interpMonths(this.climo.wind500MonthsV, this.climo.wind500NowV);
    interpMonths(this.climo.wind250MonthsU, this.climo.wind250NowU);
    interpMonths(this.climo.wind250MonthsV, this.climo.wind250NowV);
    interpMonths(this.climo.t2mMonths, this.climo.t2mNow);

    this._climoLastUpdateUTC = nowUTC;
  }

  _initializeFromClimo() {
    const { fields, climo, geo, grid } = this;
    if (!climo) return;
    const hMin = this.dynParams?.hMin ?? 0;
    const landMask = geo.landMask;
    const hasSlp = climo.slpNow && climo.slpNow.length === fields.hL.length;
    const hasWind = climo.windNowU && climo.windNowV;
    const hasWind500 = climo.wind500NowU && climo.wind500NowV;
    const hasWind250 = climo.wind250NowU && climo.wind250NowV;
    const hasT2m = climo.t2mNow && climo.t2mNow.length === fields.T.length;

    if (!hasSlp && !hasWind && !hasWind500 && !hasWind250 && !hasT2m) {
      return;
    }

    let seed = (this.seed || 0) + 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const { nx, ny, latDeg } = grid;
    for (let j = 0; j < ny; j++) {
      const lat = latDeg[j];
      const latAbs = Math.abs(lat);
      const tropics = Math.max(0, 1 - latAbs / 30);
      const polar = latAbs / 90;
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (hasSlp) {
          fields.hL[k] = HL0 + (climo.slpNow[k] - P0) / P_SCALE;
          if (Number.isFinite(hMin)) {
            fields.hL[k] = Math.max(hMin, fields.hL[k]);
          }
          fields.hU[k] = HU0;
        }
        if (hasWind) {
          fields.u[k] = 0.7 * climo.windNowU[k];
          fields.v[k] = 0.7 * climo.windNowV[k];
        }
        if (hasWind500 || hasWind250) {
          let weight = 0;
          let uTarget = 0;
          let vTarget = 0;
          if (hasWind500) {
            uTarget += 0.6 * climo.wind500NowU[k];
            vTarget += 0.6 * climo.wind500NowV[k];
            weight += 0.6;
          }
          if (hasWind250) {
            uTarget += 0.4 * climo.wind250NowU[k];
            vTarget += 0.4 * climo.wind250NowV[k];
            weight += 0.4;
          }
          if (weight > 0) {
            const scale = 0.7 / weight;
            fields.uU[k] = uTarget * scale;
            fields.vU[k] = vTarget * scale;
          }
        }
        if (hasT2m) {
          fields.T[k] = climo.t2mNow[k];
          if (landMask && landMask[k] === 1) {
            fields.Ts[k] = climo.t2mNow[k];
          }
          fields.TU[k] = climo.t2mNow[k] - 18;
        }

        const noiseU = (rand() - 0.5) * 1.0;
        const noiseV = (rand() - 0.5) * 1.0;
        const noiseThick = (rand() - 0.5) * 40;
        fields.u[k] += noiseU;
        fields.v[k] += noiseV;
        fields.uU[k] += noiseU;
        fields.vU[k] += noiseV;
        fields.hL[k] += noiseThick;
        fields.hU[k] += noiseThick * 0.5;
        if (Number.isFinite(hMin)) {
          fields.hL[k] = Math.max(hMin, fields.hL[k]);
          fields.hU[k] = Math.max(hMin, fields.hU[k]);
        }
        fields.T[k] = clamp(fields.T[k], 180, 330);
        fields.TU[k] = clamp(fields.TU[k], 180, 330);
        fields.qv[k] = Math.max(0, fields.qv[k]);
        fields.qvU[k] = Math.max(0, fields.qvU[k]);

        const land = landMask && landMask[k] === 1;
        let rhLower = land ? 0.55 : 0.68;
        rhLower += 0.12 * tropics;
        rhLower -= 0.08 * polar;
        rhLower = clamp(rhLower, land ? 0.45 : 0.6, land ? 0.65 : 0.75);

        let rhUpper = 0.3 + 0.15 * tropics - 0.05 * polar;
        rhUpper = clamp(rhUpper, 0.2, 0.5);

        const pLocal = clamp(P0 + P_SCALE * (fields.hL[k] - HL0), 85000, 107000);
        const qs = saturationMixingRatio(fields.T[k], pLocal);
        const qsU = saturationMixingRatio(fields.TU[k], 50000);
        fields.qv[k] = Math.max(0, rhLower * qs);
        fields.qvU[k] = Math.max(0, rhUpper * qsU);
      }
    }

    this._deriveSurfacePressure();
    computeDensity(fields);
    this._computeDiagnostics(0);
  }

  _computeDiagnostics(dt = 0) {
    const { grid, fields } = this;
    computeRH(fields);
    computeRHUpper(fields, fields.RHU);
    computeVorticity(fields, grid, fields.vort);
    computeDivergence(fields, grid, fields.div);
    computeCloudOptics(fields, {}, dt);
    computePrecipRate(fields, fields.precipRate);
  }

  _smoothField(src, out, passes) {
    const { nx, ny } = this.grid;
    const a = this._smoothA;
    const b = this._smoothB;
    a.set(src);
    let read = a;
    let write = b;
    for (let pass = 0; pass < passes; pass++) {
      for (let j = 0; j < ny; j++) {
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const iW = (i - 1 + nx) % nx;
          const iE = (i + 1) % nx;
          const k = row + i;
          write[k] = 0.25 * read[row + iW] + 0.5 * read[k] + 0.25 * read[row + iE];
        }
      }
      let swap = read;
      read = write;
      write = swap;
      for (let j = 0; j < ny; j++) {
        const jN = Math.max(0, j - 1);
        const jS = Math.min(ny - 1, j + 1);
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          write[k] = 0.25 * read[jN * nx + i] + 0.5 * read[k] + 0.25 * read[jS * nx + i];
        }
      }
      swap = read;
      read = write;
      write = swap;
    }
    out.set(read);
    return out;
  }

  _smoothFieldBox(src, out, lonWindowCells, latWindowCells) {
    const { nx, ny } = this.grid;
    const tmp = this._smoothA;
    const halfLon = Math.max(1, Math.floor(lonWindowCells / 2));
    const halfLat = Math.max(1, Math.floor(latWindowCells / 2));
    const lonWindow = halfLon * 2 + 1;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        let sum = 0;
        for (let w = -halfLon; w <= halfLon; w++) {
          const ii = (i + w + nx) % nx;
          sum += src[row + ii];
        }
        tmp[row + i] = sum / lonWindow;
      }
    }
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        let sum = 0;
        let count = 0;
        for (let w = -halfLat; w <= halfLat; w++) {
          const jj = Math.max(0, Math.min(ny - 1, j + w));
          sum += tmp[jj * nx + i];
          count += 1;
        }
        out[row + i] = sum / count;
      }
    }
    return out;
  }

  _applyNudging(dt) {
    const { climo, fields } = this;
    if (!climo) return;

    const nudgingLower = NUDGE_WINDS && climo.windNowU && climo.windNowV;
    const nudgingUpper = NUDGE_WINDS && (climo.wind500NowU || climo.wind250NowU);
    const nudgingMass = climo.slpNow;
    const nudgingTemp = climo.t2mNow;
    if (!nudgingLower && !nudgingUpper && !nudgingMass && !nudgingTemp) return;

    const coeffUL = dt / NUDGE_TAU_U_L;
    const coeffUU = dt / NUDGE_TAU_U_U;
    const coeffH = dt / NUDGE_TAU_H;
    const coeffT = dt / NUDGE_TAU_T;

    if (nudgingLower) {
      this._smoothFieldBox(fields.u, this._smoothStore.u, NUDGE_LON_WINDOW, NUDGE_LAT_WINDOW);
      this._smoothFieldBox(fields.v, this._smoothStore.v, NUDGE_LON_WINDOW, NUDGE_LAT_WINDOW);
    }
    if (nudgingUpper) {
      this._smoothFieldBox(fields.uU, this._smoothStore.uU, NUDGE_LON_WINDOW, NUDGE_LAT_WINDOW);
      this._smoothFieldBox(fields.vU, this._smoothStore.vU, NUDGE_LON_WINDOW, NUDGE_LAT_WINDOW);
    }
    if (nudgingMass) {
      this._smoothFieldBox(fields.hL, this._smoothStore.hL, NUDGE_LON_WINDOW, NUDGE_LAT_WINDOW);
      this._smoothFieldBox(fields.hU, this._smoothStore.hU, NUDGE_LON_WINDOW, NUDGE_LAT_WINDOW);
    }
    if (nudgingTemp) {
      this._smoothFieldBox(fields.T, this._smoothStore.T, NUDGE_LON_WINDOW, NUDGE_LAT_WINDOW);
    }

    for (let k = 0; k < fields.u.length; k++) {
      if (nudgingLower) {
        fields.u[k] += (climo.windNowU[k] - this._smoothStore.u[k]) * coeffUL;
        fields.v[k] += (climo.windNowV[k] - this._smoothStore.v[k]) * coeffUL;
      }
      if (nudgingUpper) {
        let weight = 0;
        let uTarget = 0;
        let vTarget = 0;
        if (climo.wind500NowU && climo.wind500NowV) {
          uTarget += 0.6 * climo.wind500NowU[k];
          vTarget += 0.6 * climo.wind500NowV[k];
          weight += 0.6;
        }
        if (climo.wind250NowU && climo.wind250NowV) {
          uTarget += 0.4 * climo.wind250NowU[k];
          vTarget += 0.4 * climo.wind250NowV[k];
          weight += 0.4;
        }
        if (weight > 0) {
          const invW = 1 / weight;
          const uBlend = uTarget * invW;
          const vBlend = vTarget * invW;
          fields.uU[k] += (uBlend - this._smoothStore.uU[k]) * coeffUU;
          fields.vU[k] += (vBlend - this._smoothStore.vU[k]) * coeffUU;
        }
      }
      if (nudgingMass) {
        const hTarget = HL0 + (climo.slpNow[k] - P0) / P_SCALE;
        fields.hL[k] += (hTarget - this._smoothStore.hL[k]) * coeffH;
        fields.hU[k] += (HU0 - this._smoothStore.hU[k]) * coeffH;
      }
      if (nudgingTemp) {
        fields.T[k] += (climo.t2mNow[k] - this._smoothStore.T[k]) * coeffT;
      }
    }
  }

  _advectScalars(dt) {
    const { grid, fields } = this;
    const tmp = this._tmp;
    advectScalar({ src: fields.T, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.T.set(tmp);
    advectScalar({ src: fields.qv, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.qv.set(tmp);
    advectScalar({ src: fields.qc, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.qc.set(tmp);
    advectScalar({ src: fields.qr, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.qr.set(tmp);
    const kappaUpper = this.kappa * KAPPA_UPPER_FACTOR;
    advectScalar({ src: fields.TU, dst: tmp, u: fields.uU, v: fields.vU, dt, grid, kappa: kappaUpper });
    fields.TU.set(tmp);
    advectScalar({ src: fields.qvU, dst: tmp, u: fields.uU, v: fields.vU, dt, grid, kappa: kappaUpper });
    fields.qvU.set(tmp);
    advectScalar({ src: fields.qcU, dst: tmp, u: fields.uU, v: fields.vU, dt, grid, kappa: kappaUpper });
    fields.qcU.set(tmp);
  }

  _deriveSurfacePressure() {
    const { ps, hL } = this.fields;
    const pMin = 85000;
    const pMax = 107000;
    for (let k = 0; k < ps.length; k++) {
      ps[k] = P0 + P_SCALE * (hL[k] - HL0);
      ps[k] = Math.max(pMin, Math.min(pMax, ps[k]));
    }
  }

  _applyLargeScaleMoisture(dt, dayOfYear) {
    const { grid, fields, geo } = this;
    const { nx, ny, latDeg } = grid;
    const { qv, T, ps, Ts } = fields;
    const { landMask, soilM, elev } = geo;

    const itczLat = 8 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
    const tauDry = 4 * 86400; // seconds, e-folding for subsidence drying

    for (let j = 0; j < ny; j++) {
      const lat = latDeg[j];
      const latAbs = Math.abs(lat);
      const tropics = Math.exp(-Math.pow((lat - itczLat) / 12, 2));
      const subtropics = Math.exp(-Math.pow((latAbs - 25) / 9, 2));
      const polar = Math.exp(-Math.pow((latAbs - 70) / 12, 2));
      const baseP = 101000 - 40 * latAbs;
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const land = landMask[k] === 1;
        let targetRH = 0.56 + 0.22 * tropics - 0.14 * subtropics - 0.12 * polar;
        if (land) {
          targetRH += 0.18 * (soilM[k] - 0.6) - 0.03;
          const lift = Math.min(1, elev[k] / 2500);
          targetRH += 0.05 * lift;
        } else {
          const warmOcean = Math.max(0, (Ts[k] - 298) / 6);
          targetRH += 0.04 * warmOcean;
        }
        const pAnom = (baseP - ps[k]) / 1200;
        targetRH += 0.08 * Math.tanh(pAnom);
        targetRH = Math.max(0.35, Math.min(0.92, targetRH));

        const qs = saturationMixingRatio(T[k], ps[k]);
        const qvTarget = targetRH * qs;
        if (qv[k] > qvTarget) {
          qv[k] += (qvTarget - qv[k]) * (dt / tauDry);
        }
      }
    }
  }
}
