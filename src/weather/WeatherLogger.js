import { Re, g } from './constants';

const EARTH_AREA = 4 * Math.PI * Re * Re;
const DEFAULT_MAX_ENTRIES = 20000;
const DEFAULT_CADENCE_SECONDS = 6 * 3600;
const DEFAULT_WIND_PANIC = 150;
const SCHEMA_ID = 'satellitewars.weatherlog';
const SCHEMA_VERSION = 1;

const PROBES = [
  { name: 'Caribbean', lat: 15, lon: -60 },
  { name: 'Amazon', lat: -5, lon: -60 },
  { name: 'Sahara', lat: 25, lon: 10 },
  { name: 'NAtlantic', lat: 45, lon: -35 },
  { name: 'EqPacific', lat: 0, lon: -140 },
  { name: 'SOcean', lat: -55, lon: 0 }
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

class WeatherLogger {
  constructor({ maxEntries = DEFAULT_MAX_ENTRIES, cadenceSeconds = DEFAULT_CADENCE_SECONDS } = {}) {
    this.enabled = false;
    this.entries = [];
    this.maxEntries = maxEntries;
    this.cadenceSeconds = cadenceSeconds;
    this.nextLogSimTimeSeconds = 0;
    this.runId = null;
    this.onLine = null;
    this.processEnabled = true;
    this._seq = 0;
    this._grid = null;
    this._rowWeights = null;
    this._totalWeight = 0;
    this._scratch = null;
    this._scratchSize = 0;
    this._staticLoggedDay = null;
    this._logStaticNext = false;
    this._probeIndices = null;
    this._lastPanicSimTime = null;
    this._firstNonFiniteModule = null;
    this._runStartLogged = false;
  }

  setOnLine(onLine) {
    this.onLine = typeof onLine === 'function' ? onLine : null;
  }

  setRunInfo({ runId, seqStart } = {}) {
    if (typeof runId === 'string' && runId.length > 0 && runId !== this.runId) {
      this.runId = runId;
      this._seq = Number.isFinite(seqStart) ? Math.floor(seqStart) : 0;
      this._runStartLogged = false;
    } else if (Number.isFinite(seqStart)) {
      this._seq = Math.floor(seqStart);
    }
  }

  hasRunStart() {
    return this._runStartLogged;
  }

  setCadence(seconds, simTimeSeconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.cadenceSeconds = seconds;
    if (Number.isFinite(simTimeSeconds)) {
      this.nextLogSimTimeSeconds = simTimeSeconds + this.cadenceSeconds;
    }
  }

  setMaxEntries(maxEntries) {
    if (!Number.isFinite(maxEntries) || maxEntries <= 0) return;
    this.maxEntries = Math.floor(maxEntries);
    this._trimEntries();
  }

  start(simTimeSeconds, { cadenceSeconds, maxEntries } = {}) {
    this.enabled = true;
    if (Number.isFinite(cadenceSeconds)) {
      this.cadenceSeconds = cadenceSeconds;
    }
    if (Number.isFinite(maxEntries)) {
      this.maxEntries = Math.floor(maxEntries);
    }
    this.nextLogSimTimeSeconds = Number.isFinite(simTimeSeconds)
      ? simTimeSeconds + this.cadenceSeconds
      : this.cadenceSeconds;
    if (!this.runId) {
      this.runId = `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      this._seq = 0;
      this._runStartLogged = false;
    }
    this._staticLoggedDay = null;
    this._logStaticNext = true;
    this._lastPanicSimTime = null;
    this._firstNonFiniteModule = null;
  }

  stop() {
    this.enabled = false;
  }

  clear() {
    this.entries = [];
    this._firstNonFiniteModule = null;
  }

  getCount() {
    return this.entries.length;
  }

  download(filename = 'weather-log.jsonl') {
    if (!this.entries.length || typeof document === 'undefined') return false;
    const blob = new Blob([this.entries.join('\n') + '\n'], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    return true;
  }

  recordIfDue(context, core, { force = false, reason } = {}) {
    if (!this.enabled && !force) return false;
    const simTimeSeconds = context?.simTimeSeconds;
    if (!force && Number.isFinite(simTimeSeconds) && simTimeSeconds < this.nextLogSimTimeSeconds) {
      return false;
    }
    const entry = this._buildStateEntry(context, core, { reason, event: 'state' });
    this._pushEntry(entry);
    if (!force && Number.isFinite(simTimeSeconds)) {
      this.nextLogSimTimeSeconds = simTimeSeconds + this.cadenceSeconds;
    }
    return true;
  }

  recordNow(context, core, { reason } = {}) {
    if (!this.enabled) return false;
    return this.recordIfDue(context, core, { force: true, reason });
  }

  recordRunStart(core, { session, cadenceSeconds, modelKind } = {}) {
    if (this._runStartLogged) return false;
    if (!this.runId) {
      this.runId = `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      this._seq = 0;
    }
    const entry = this._buildRunStartEntry(core, { session, cadenceSeconds, modelKind });
    this._pushEntry(entry);
    this._runStartLogged = true;
    return true;
  }

  logProcessDelta(context, core, moduleName, before, after) {
    if (!this.enabled || !this.processEnabled) return false;
    const deltas = {};
    for (const key of Object.keys(before)) {
      const beforeMean = before[key].meanAw;
      const afterMean = after[key].meanAw;
      const beforeMax = before[key].maxAbs;
      const afterMax = after[key].maxAbs;
      deltas[key] = {
        dMeanAw: Number.isFinite(beforeMean) && Number.isFinite(afterMean) ? afterMean - beforeMean : null,
        dMaxAbs: Number.isFinite(beforeMax) && Number.isFinite(afterMax) ? afterMax - beforeMax : null,
        beforeFiniteCount: before[key].finiteCount ?? null,
        afterFiniteCount: after[key].finiteCount ?? null
      };
    }
    const nonFiniteFields = [];
    for (const key of Object.keys(after)) {
      const mean = after[key].meanAw;
      const maxAbs = after[key].maxAbs;
      const finiteCount = after[key].finiteCount ?? 0;
      if (!Number.isFinite(mean) || !Number.isFinite(maxAbs) || finiteCount === 0) {
        nonFiniteFields.push(key);
      }
    }
    if (nonFiniteFields.length && !this._firstNonFiniteModule) {
      const entry = {
        event: 'moduleNonFinite',
        sim: this._buildSimMeta(context, core),
        module: moduleName,
        reason: 'firstNonFiniteAfterModule',
        nonFiniteFields
      };
      this._pushEntry(entry);
      this._firstNonFiniteModule = moduleName;
    }
    const entry = {
      event: 'module',
      sim: this._buildSimMeta(context, core),
      module: moduleName,
      deltas
    };
    this._pushEntry(entry);
    return true;
  }

  checkPanic(context, core, { windMaxThreshold = DEFAULT_WIND_PANIC, desyncThresholdSeconds } = {}) {
    if (!this.enabled) return false;
    const simTimeSeconds = context?.simTimeSeconds;
    const simTime = Number.isFinite(simTimeSeconds) ? simTimeSeconds : core.timeUTC;
    if (this._lastPanicSimTime === simTime) return false;
    const fields = core.fields;
    const reasons = [];
    let nanCount = 0;
    let infCount = 0;
    let hMinFound = Infinity;
    let maxWind = 0;

    const scanArray = (arr) => {
      for (let k = 0; k < arr.length; k++) {
        const v = arr[k];
        if (!Number.isFinite(v)) {
          if (Number.isNaN(v)) nanCount++;
          else infCount++;
        }
      }
    };

    scanArray(fields.u);
    scanArray(fields.v);
    scanArray(fields.uU);
    scanArray(fields.vU);
    scanArray(fields.hL);
    scanArray(fields.hU);
    scanArray(fields.T);
    scanArray(fields.TU);
    scanArray(fields.Ts);
    scanArray(fields.qv);
    scanArray(fields.qvU);
    scanArray(fields.qc);
    scanArray(fields.qcU);
    if (fields.qi) scanArray(fields.qi);
    if (fields.qiU) scanArray(fields.qiU);
    scanArray(fields.qr);
    scanArray(fields.ps);

    for (let k = 0; k < fields.hL.length; k++) {
      const hL = fields.hL[k];
      const hU = fields.hU[k];
      if (hL < hMinFound) hMinFound = hL;
      if (hU < hMinFound) hMinFound = hU;
      const speedL = Math.hypot(fields.u[k], fields.v[k]);
      const speedU = Math.hypot(fields.uU[k], fields.vU[k]);
      if (speedL > maxWind) maxWind = speedL;
      if (speedU > maxWind) maxWind = speedU;
    }

    if (nanCount > 0 || infCount > 0) {
      reasons.push(`nonFinite:${nanCount + infCount}`);
    }
    if (hMinFound <= 0) {
      reasons.push('negativeThickness');
    }
    if (maxWind > windMaxThreshold) {
      reasons.push(`wind>${windMaxThreshold}`);
    }

    const deltaSimMinusCore = Number.isFinite(simTimeSeconds) ? simTimeSeconds - core.timeUTC : 0;
    const desyncThreshold = Number.isFinite(desyncThresholdSeconds)
      ? desyncThresholdSeconds
      : Math.max(core.modelDt * 2, 600);
    if (Math.abs(deltaSimMinusCore) > desyncThreshold) {
      reasons.push('clockDesync');
    }

    if (!reasons.length) return false;
    this._lastPanicSimTime = simTime;
    const entry = this._buildStateEntry(context, core, { reason: reasons.join(','), event: 'panic' });
    entry.panic = {
      nanCount,
      infCount,
      hMinFound,
      maxWind,
      deltaSimMinusCore
    };
    this._pushEntry(entry);
    return true;
  }

  buildProcessSnapshot(core) {
    this._ensureGrid(core.grid);
    const { fields } = core;
    const snapshot = {
      T: this._meanMaxAbs(fields.T),
      Ts: this._meanMaxAbs(fields.Ts),
      TU: this._meanMaxAbs(fields.TU),
      qv: this._meanMaxAbs(fields.qv),
      qvU: this._meanMaxAbs(fields.qvU),
      qcU: this._meanMaxAbs(fields.qcU),
      qc: this._meanMaxAbs(fields.qc),
      qr: this._meanMaxAbs(fields.qr),
      ps: this._meanMaxAbs(fields.ps),
      hL: this._meanMaxAbs(fields.hL),
      hU: this._meanMaxAbs(fields.hU),
      u: this._meanMaxAbs(fields.u),
      v: this._meanMaxAbs(fields.v),
      uU: this._meanMaxAbs(fields.uU),
      vU: this._meanMaxAbs(fields.vU)
    };
    if (fields.theta) snapshot.theta = this._meanMaxAbs(fields.theta);
    if (fields.thetaU) snapshot.thetaU = this._meanMaxAbs(fields.thetaU);
    if (fields.qi) snapshot.qi = this._meanMaxAbs(fields.qi);
    if (fields.qiU) snapshot.qiU = this._meanMaxAbs(fields.qiU);
    return snapshot;
  }

  _buildSimMeta(context, core) {
    const simTimeSeconds = Number.isFinite(context?.simTimeSeconds)
      ? context.simTimeSeconds
      : core?.timeUTC ?? 0;
    const simDay = Math.floor(simTimeSeconds / 86400);
    const todHours = ((simTimeSeconds % 86400) + 86400) % 86400 / 3600;
    return {
      simTimeSeconds,
      simDay,
      todHours,
      simSpeed: context?.simSpeed ?? null,
      paused: context?.paused ?? null,
      seed: core?.seed ?? null,
      modelDtSeconds: core?.modelDt ?? null,
      stepsRanThisTick: context?.stepsRanThisTick ?? null,
      coreTimeUTCSeconds: core?.timeUTC ?? null,
      deltaSimMinusCoreSeconds: Number.isFinite(simTimeSeconds) && core ? simTimeSeconds - core.timeUTC : null
    };
  }

  _buildStateEntry(context, core, { reason, event = 'state' } = {}) {
    const sim = this._buildSimMeta(context, core);
    const entry = {
      event,
      sim
    };
    if (reason) entry.reason = reason;

    this._ensureGrid(core.grid);

    const simDay = sim.simDay;
    const includeStatic = this._logStaticNext || (this._staticLoggedDay !== simDay);
    if (includeStatic) {
      this._staticLoggedDay = simDay;
      this._logStaticNext = false;
    }

    entry.fields = this._buildFieldStats(core, includeStatic);
    entry.clamps = this._buildClampStats(core);
    entry.budgets = this._buildBudgetStats(core);
    entry.v2 = this._buildV2Stats(core);
    entry.sanity = this._buildSanityStats(core);
    entry.staticFieldsLogged = includeStatic;
    entry.probes = this._collectProbes(core);
    entry.tc = core?.tcSystem?.getStormSummary?.() || { stormCount: 0, storms: [] };
    return entry;
  }

  _buildRunStartEntry(core, { session, cadenceSeconds, modelKind } = {}) {
    const grid = core?.grid || {};
    const params = {
      dyn: core?.dynParams ?? null,
      mass: core?.massParams ?? null,
      advect: core?.advectParams ?? null,
      vert: core?.vertParams ?? null,
      micro: core?.microParams ?? null,
      surface: core?.surfaceParams ?? null,
      rad: core?.radParams ?? null,
      diag: core?.diagParams ?? null,
      nudge: core?.nudgeParams ?? null
    };
    const clone = (obj) => (obj ? JSON.parse(JSON.stringify(obj)) : null);
    const sigmaHalf = core?.sigmaHalf
      ? Array.from(core.sigmaHalf)
      : core?.state?.sigmaHalf
        ? Array.from(core.state.sigmaHalf)
        : null;
    const pTopPa = core?.microParams?.pTop ?? core?.diagParams?.pTop ?? null;
    const model = {
      kind: modelKind || (core?.state?.nz ? 'v2' : 'v1'),
      grid: {
        nx: grid.nx ?? null,
        ny: grid.ny ?? null,
        nz: core?.nz ?? core?.state?.nz ?? null,
        sigmaHalf,
        pTopPa,
        minDxMeters: grid.minDxMeters ?? null
      }
    };
    const build = session?.build || {};
    return {
      event: 'runStart',
      log: {
        file: session?.filename ?? null,
        cadenceSimSeconds: Number.isFinite(cadenceSeconds) ? cadenceSeconds : this.cadenceSeconds
      },
      build: {
        appVersion: build.appVersion ?? null,
        gitCommit: build.gitCommit ?? null,
        gitDirty: typeof build.gitDirty === 'boolean' ? build.gitDirty : null,
        nodeEnv: build.nodeEnv ?? null
      },
      model,
      params: {
        dyn: clone(params.dyn),
        mass: clone(params.mass),
        advect: clone(params.advect),
        vert: clone(params.vert),
        micro: clone(params.micro),
        surface: clone(params.surface),
        rad: clone(params.rad),
        diag: clone(params.diag),
        nudge: clone(params.nudge)
      },
      init: {
        seed: core?.seed ?? null,
        timeUTCSeconds: core?.timeUTC ?? null,
        useClimo: Boolean(core?.climo),
        climoHasSlp: core?.climo?.hasSlp ?? false,
        climoHasT2m: core?.climo?.hasT2m ?? false
      },
      server: {
        pid: session?.pid ?? null,
        startedAtUtc: session?.startedAtUtc ?? null
      }
    };
  }

  _buildClampStats(core) {
    const fields = core?.fields || {};
    return {
      tauLowClampCount: Math.max(0, fields.tauLowClampCount || 0),
      tauHighClampCount: Math.max(0, fields.tauHighClampCount || 0)
    };
  }

  _buildBudgetStats(core) {
    const state = core?.state;
    const grid = core?.grid;
    if (!state || !grid || !state.qv || !state.pHalf || !Number.isFinite(state.nz)) {
      return {
        columnWaterKgM2MeanAw: null,
        columnWaterKgM2P95: null,
        negWaterCount3d: 0
      };
    }
    this._ensureGrid(grid);
    const { nx, ny } = grid;
    const { N, nz, qv, qc, qr, qi, pHalf } = state;
    let sum = 0;
    let sumW = 0;
    let count = 0;
    const gLocal = g;
    let negWaterCount3d = 0;

    for (let j = 0; j < ny; j++) {
      const w = this._rowWeights[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        let col = 0;
        for (let lev = 0; lev < nz; lev++) {
          const idx = lev * N + k;
          const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
          const qvVal = qv[idx];
          const qcVal = qc ? qc[idx] : 0;
          const qiVal = qi ? qi[idx] : 0;
          const qrVal = qr ? qr[idx] : 0;
          if (qvVal < 0 || qcVal < 0 || qiVal < 0 || qrVal < 0) {
            negWaterCount3d++;
          }
          col += (qvVal + qcVal + qiVal + qrVal) * (dp / gLocal);
        }
        sum += col * w;
        sumW += w;
        this._scratch[count++] = col;
      }
    }

    const p95 = this._percentilesFromScratch(count, [95]).p95;
    return {
      columnWaterKgM2MeanAw: sumW > 0 ? sum / sumW : null,
      columnWaterKgM2P95: p95,
      negWaterCount3d
    };
  }

  _buildV2Stats(core) {
    const vm = core?.state?.vertMetrics;
    const out = {
      convectiveFraction: vm?.convectiveFraction ?? null,
      omegaPosP90: vm?.omegaPosP90 ?? null,
      instabP90: vm?.instabP90 ?? null,
      convTopLevMean: vm?.convTopLevMean ?? null,
      convCondMassTotalKgM2: vm?.convCondMassTotalKgM2 ?? null,
      omegaSurfMinusDpsDtRms: vm?.omegaSurfMinusDpsDtRms ?? null,
      thetaSMeanAw: null,
      qvSMeanAw: null,
      TsLandMean: null,
      TsOceanMean: null,
      qvSLandMean: null,
      qvSOceanMean: null,
      soilWFracLandMean: null,
      precipLandMean: null,
      precipOceanMean: null,
      rainColumnKgM2MeanAw: null,
      iceColumnKgM2MeanAw: null,
      cloudHighMeanInAscent: null,
      cloudHighMeanInSubsidence: null,
      cloudHighAscentRatio: null,
      cloudHighMeanInMoistUpper: null,
      cloudLowMeanTropics: null,
      cloudHighMeanTropics: null,
      tauLowMeanTropics: null,
      tauHighMeanTropics: null,
      precipMeanTropics: null,
      RHU_p95Tropics: null,
      omegaUAscentAbs_p95Tropics: null,
      cloudLowMeanMidlat: null,
      cloudHighMeanMidlat: null,
      tauLowMeanMidlat: null,
      tauHighMeanMidlat: null,
      precipMeanMidlat: null,
      RHU_p95Midlat: null,
      omegaUAscentAbs_p95Midlat: null,
      cloudLowMeanPolar: null,
      cloudHighMeanPolar: null,
      tauLowMeanPolar: null,
      tauHighMeanPolar: null,
      precipMeanPolar: null,
      RHU_p95Polar: null,
      omegaUAscentAbs_p95Polar: null
    };

    const fields = core?.fields;
    const grid = core?.grid;
    const state = core?.state;
    if (grid && state && state.qr && state.pHalf && Number.isFinite(state.nz)) {
      this._ensureGrid(grid);
      const { nx, ny } = grid;
      const { N, nz, qr, qi, pHalf, theta, qv } = state;
      const landMask = core?.geo?.landMask || state.landMask;
      const hasLandMask = landMask && landMask.length === N;
      let sumRain = 0;
      let sumIce = 0;
      let sumW = 0;
      let sumTheta = 0;
      let sumThetaW = 0;
      let sumQv = 0;
      let sumQvW = 0;
      let sumTsLand = 0;
      let sumTsLandW = 0;
      let sumTsOcean = 0;
      let sumTsOceanW = 0;
      let sumQvLand = 0;
      let sumQvLandW = 0;
      let sumQvOcean = 0;
      let sumQvOceanW = 0;
      let sumSoilFracLand = 0;
      let sumSoilFracLandW = 0;
      let sumPrecipLand = 0;
      let sumPrecipLandW = 0;
      let sumPrecipOcean = 0;
      let sumPrecipOceanW = 0;
      const levS = Math.max(0, nz - 1);
      for (let j = 0; j < ny; j++) {
        const w = this._rowWeights[j];
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          let colRain = 0;
          let colIce = 0;
          for (let lev = 0; lev < nz; lev++) {
            const idx = lev * N + k;
            const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
            colRain += qr[idx] * (dp / g);
            if (qi) colIce += qi[idx] * (dp / g);
          }
          sumRain += colRain * w;
          sumIce += colIce * w;
          sumW += w;
          if (theta && qv) {
            const idxS = levS * N + k;
            const thetaVal = theta[idxS];
            const qvVal = qv[idxS];
            if (Number.isFinite(thetaVal)) {
              sumTheta += thetaVal * w;
              sumThetaW += w;
            }
            if (Number.isFinite(qvVal)) {
              sumQv += qvVal * w;
              sumQvW += w;
            }
          }
          if (hasLandMask) {
            const isLand = landMask[k] === 1;
            const tsVal = fields?.Ts ? fields.Ts[k] : null;
            const qvSVal = fields?.qv ? fields.qv[k] : null;
            const precipVal = fields?.precipRate ? fields.precipRate[k] : null;
            if (Number.isFinite(tsVal)) {
              if (isLand) {
                sumTsLand += tsVal * w;
                sumTsLandW += w;
              } else {
                sumTsOcean += tsVal * w;
                sumTsOceanW += w;
              }
            }
            if (Number.isFinite(qvSVal)) {
              if (isLand) {
                sumQvLand += qvSVal * w;
                sumQvLandW += w;
              } else {
                sumQvOcean += qvSVal * w;
                sumQvOceanW += w;
              }
            }
            if (Number.isFinite(precipVal)) {
              if (isLand) {
                sumPrecipLand += precipVal * w;
                sumPrecipLandW += w;
              } else {
                sumPrecipOcean += precipVal * w;
                sumPrecipOceanW += w;
              }
            }
            if (isLand && state.soilW && state.soilCap) {
              const cap = state.soilCap[k];
              if (cap > 0) {
                const frac = clamp(state.soilW[k] / cap, 0, 1);
                sumSoilFracLand += frac * w;
                sumSoilFracLandW += w;
              }
            }
          }
        }
      }
      if (sumW > 0) {
        out.rainColumnKgM2MeanAw = sumRain / sumW;
        out.iceColumnKgM2MeanAw = sumIce / sumW;
      }
      if (sumThetaW > 0) out.thetaSMeanAw = sumTheta / sumThetaW;
      if (sumQvW > 0) out.qvSMeanAw = sumQv / sumQvW;
      if (sumTsLandW > 0) out.TsLandMean = sumTsLand / sumTsLandW;
      if (sumTsOceanW > 0) out.TsOceanMean = sumTsOcean / sumTsOceanW;
      if (sumQvLandW > 0) out.qvSLandMean = sumQvLand / sumQvLandW;
      if (sumQvOceanW > 0) out.qvSOceanMean = sumQvOcean / sumQvOceanW;
      if (sumSoilFracLandW > 0) out.soilWFracLandMean = sumSoilFracLand / sumSoilFracLandW;
      if (sumPrecipLandW > 0) out.precipLandMean = sumPrecipLand / sumPrecipLandW;
      if (sumPrecipOceanW > 0) out.precipOceanMean = sumPrecipOcean / sumPrecipOceanW;
    }

    if (fields && grid) {
      this._ensureGrid(grid);
      const { nx, ny } = grid;
      if (fields.cloudHigh && fields.omegaU && fields.RHU) {
        const omegaThreshRaw = core?.diagParams?.omegaHigh0;
        const omegaThresh = Number.isFinite(omegaThreshRaw) ? omegaThreshRaw : 0.05;
        const rhHigh0Raw = core?.diagParams?.rhHigh0;
        const rhHigh0 = Number.isFinite(rhHigh0Raw) ? rhHigh0Raw : 0.55;

        let sumAsc = 0;
        let sumAscW = 0;
        let sumSub = 0;
        let sumSubW = 0;
        let sumMoist = 0;
        let sumMoistW = 0;

        for (let j = 0; j < ny; j++) {
          const w = this._rowWeights[j];
          const row = j * nx;
          for (let i = 0; i < nx; i++) {
            const k = row + i;
            const ch = fields.cloudHigh[k];
            if (!Number.isFinite(ch)) continue;
            const omegaU = fields.omegaU[k];
            if (Number.isFinite(omegaU)) {
            if (omegaU < -omegaThresh) {
              sumAsc += ch * w;
              sumAscW += w;
            } else if (omegaU > omegaThresh) {
              sumSub += ch * w;
              sumSubW += w;
            }
            }
            const rhu = fields.RHU[k];
            if (Number.isFinite(rhu) && rhu > rhHigh0) {
              sumMoist += ch * w;
              sumMoistW += w;
            }
          }
        }

        const meanAsc = sumAscW > 0 ? sumAsc / sumAscW : null;
        const meanSub = sumSubW > 0 ? sumSub / sumSubW : null;
        const meanMoist = sumMoistW > 0 ? sumMoist / sumMoistW : null;

        out.cloudHighMeanInAscent = meanAsc;
        out.cloudHighMeanInSubsidence = meanSub;
        out.cloudHighMeanInMoistUpper = meanMoist;
        out.cloudHighAscentRatio =
          meanAsc != null && meanSub != null ? meanAsc / (meanSub + 1e-6) : null;
      }

      if (
        fields.cloudLow &&
        fields.cloudHigh &&
        fields.tauLow &&
        fields.tauHigh &&
        fields.precipRate &&
        fields.RHU &&
        fields.omegaU
      ) {
        const { latDeg } = grid;
        const bandKeys = ['Tropics', 'Midlat', 'Polar'];
        const bandCount = bandKeys.length;
        const sumCloudLow = new Float64Array(bandCount);
        const sumCloudLowW = new Float64Array(bandCount);
        const sumCloudHigh = new Float64Array(bandCount);
        const sumCloudHighW = new Float64Array(bandCount);
        const sumTauLow = new Float64Array(bandCount);
        const sumTauLowW = new Float64Array(bandCount);
        const sumTauHigh = new Float64Array(bandCount);
        const sumTauHighW = new Float64Array(bandCount);
        const sumPrecip = new Float64Array(bandCount);
        const sumPrecipW = new Float64Array(bandCount);

        for (let j = 0; j < ny; j++) {
          const latAbs = Math.abs(latDeg[j]);
          let band = 2;
          if (latAbs < 20) band = 0;
          else if (latAbs < 60) band = 1;
          const w = this._rowWeights[j];
          const row = j * nx;
          for (let i = 0; i < nx; i++) {
            const k = row + i;
            const cl = fields.cloudLow[k];
            if (Number.isFinite(cl)) {
              sumCloudLow[band] += cl * w;
              sumCloudLowW[band] += w;
            }
            const ch = fields.cloudHigh[k];
            if (Number.isFinite(ch)) {
              sumCloudHigh[band] += ch * w;
              sumCloudHighW[band] += w;
            }
            const tl = fields.tauLow[k];
            if (Number.isFinite(tl)) {
              sumTauLow[band] += tl * w;
              sumTauLowW[band] += w;
            }
            const th = fields.tauHigh[k];
            if (Number.isFinite(th)) {
              sumTauHigh[band] += th * w;
              sumTauHighW[band] += w;
            }
            const pr = fields.precipRate[k];
            if (Number.isFinite(pr)) {
              sumPrecip[band] += pr * w;
              sumPrecipW[band] += w;
            }
          }
        }

        const assignMean = (prefix, sums, weights) => {
          for (let b = 0; b < bandCount; b++) {
            out[`${prefix}${bandKeys[b]}`] = weights[b] > 0 ? sums[b] / weights[b] : null;
          }
        };

        assignMean('cloudLowMean', sumCloudLow, sumCloudLowW);
        assignMean('cloudHighMean', sumCloudHigh, sumCloudHighW);
        assignMean('tauLowMean', sumTauLow, sumTauLowW);
        assignMean('tauHighMean', sumTauHigh, sumTauHighW);
        assignMean('precipMean', sumPrecip, sumPrecipW);

        const bandP95 = (arr, bandIdx, invert) => {
          let count = 0;
          for (let j = 0; j < ny; j++) {
            const latAbs = Math.abs(latDeg[j]);
            let band = 2;
            if (latAbs < 20) band = 0;
            else if (latAbs < 60) band = 1;
            if (band !== bandIdx) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
              const raw = arr[row + i];
              const v = invert ? -raw : raw;
              if (!Number.isFinite(v)) continue;
              this._scratch[count++] = v;
            }
          }
          return this._percentilesFromScratch(count, [95]).p95;
        };

        for (let b = 0; b < bandCount; b++) {
          out[`RHU_p95${bandKeys[b]}`] = bandP95(fields.RHU, b, false);
          out[`omegaUAscentAbs_p95${bandKeys[b]}`] = bandP95(fields.omegaU, b, true);
        }
      }
    }

    return out;
  }

  _buildSanityStats(core) {
    const state = core?.state;
    const grid = core?.grid;
    if (!state || !grid || !state.ps || !state.pHalf) {
      return {
        psOutOfRangeCount: 0,
        pHalfInversionCount: 0,
        dpNonPositiveCount: 0,
        psClampMinCount: 0,
        psClampMaxCount: 0,
        meanDpsDtApplied: null,
        meanDpsDtActual: null,
        psAtMaxCount: 0,
        psAtMinCount: 0,
        psAtMaxAreaFrac: 0,
        psAtMinAreaFrac: 0
      };
    }
    this._ensureGrid(grid);
    const psMin = core?.massParams?.psMin ?? 50000;
    const psMax = core?.massParams?.psMax ?? 110000;
    const { nx, ny, cosLat } = grid;
    const { N, nz, ps, pHalf } = state;
    let psOut = 0;
    let inversions = 0;
    let dpNonPositive = 0;
    let psAtMaxCount = 0;
    let psAtMinCount = 0;
    let psAtMaxWeight = 0;
    let psAtMinWeight = 0;

    for (let j = 0; j < ny; j++) {
      const w = cosLat[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        const p = ps[k];
        if (p < psMin || p > psMax) psOut++;
        if (p >= psMax - 1) {
          psAtMaxCount += 1;
          psAtMaxWeight += w;
        }
        if (p <= psMin + 1) {
          psAtMinCount += 1;
          psAtMinWeight += w;
        }
        let inverted = false;
        for (let lev = 0; lev < nz; lev++) {
          const p1 = pHalf[lev * N + k];
          const p2 = pHalf[(lev + 1) * N + k];
          if (p1 >= p2) {
            inverted = true;
          }
          if (p2 - p1 <= 0) dpNonPositive++;
        }
        if (inverted) inversions++;
      }
    }

    const totalWeight = this._totalWeight || 0;
    const psAtMaxAreaFrac = totalWeight > 0 ? psAtMaxWeight / totalWeight : 0;
    const psAtMinAreaFrac = totalWeight > 0 ? psAtMinWeight / totalWeight : 0;

    return {
      psOutOfRangeCount: psOut,
      pHalfInversionCount: inversions,
      dpNonPositiveCount: dpNonPositive,
      psClampMinCount: Number.isFinite(state.psClampMinCount) ? state.psClampMinCount : 0,
      psClampMaxCount: Number.isFinite(state.psClampMaxCount) ? state.psClampMaxCount : 0,
      meanDpsDtApplied: Number.isFinite(state.meanDpsDtApplied) ? state.meanDpsDtApplied : null,
      meanDpsDtActual: Number.isFinite(state.meanDpsDtActual) ? state.meanDpsDtActual : null,
      psAtMaxCount,
      psAtMinCount,
      psAtMaxAreaFrac,
      psAtMinAreaFrac
    };
  }

  _buildFieldStats(core, includeStatic) {
    const fields = core.fields;
    const climo = core.climo || {};
    const geo = core.geo || {};
    const landMask = geo.landMask;
    const stats = {};

    const cloudStats = this._statsScalar(fields.cloud, {
      landMask,
      physMin: 0,
      physMax: 1,
      thresholdsAbove: [0.2, 0.6]
    });
    cloudStats.below0Count = cloudStats.belowPhysMinCount;
    cloudStats.areaFracGt02 = cloudStats.areaFracAbove?.['0.2'] ?? null;
    cloudStats.areaFracGt06 = cloudStats.areaFracAbove?.['0.6'] ?? null;
    stats.clouds = cloudStats;

    const cloudLowStats = this._statsScalar(fields.cloudLow, {
      landMask,
      physMin: 0,
      physMax: 1,
      thresholdsAbove: [0.2, 0.6]
    });
    cloudLowStats.below0Count = cloudLowStats.belowPhysMinCount;
    stats.cloudLow = cloudLowStats;

    const cloudHighStats = this._statsScalar(fields.cloudHigh, {
      landMask,
      physMin: 0,
      physMax: 1,
      thresholdsAbove: [0.2, 0.6]
    });
    cloudHighStats.below0Count = cloudHighStats.belowPhysMinCount;
    stats.cloudHigh = cloudHighStats;

    const psMin = core?.massParams?.psMin ?? 85000;
    const psMax = core?.massParams?.psMax ?? 107000;
    const psStats = this._statsScalar(fields.ps, {
      landMask,
      physMin: psMin,
      physMax: psMax
    });
    if (psStats) {
      psStats.minHpa = psStats.min != null ? psStats.min / 100 : null;
      psStats.maxHpa = psStats.max != null ? psStats.max / 100 : null;
      psStats.meanHpa = psStats.meanAw != null ? psStats.meanAw / 100 : null;
      if (climo.slpNow) {
        psStats.rmsVsClimoHpa = this._rmsDifference(fields.ps, climo.slpNow, { landMask, scale: 1 / 100 });
      }
    }
    stats.ps = psStats;

    const tStats = this._statsScalar(fields.T, {
      landMask,
      thresholdsBelow: [273.15],
      thresholdsAbove: [310]
    });
    tStats.areaFracLt273 = tStats.areaFracBelow?.['273.15'] ?? null;
    tStats.areaFracGt310 = tStats.areaFracAbove?.['310'] ?? null;
    stats.T = tStats;

    const tUStats = this._statsScalar(fields.TU, { landMask });
    stats.TU = tUStats;

    const tsStats = this._statsScalar(fields.Ts, { landMask });
    tsStats.meanOcean = this._statsScalar(fields.Ts, { landMask, landMaskMode: 'ocean' }).meanAw;
    tsStats.meanLand = this._statsScalar(fields.Ts, { landMask, landMaskMode: 'land' }).meanAw;
    stats.Ts = tsStats;

    const sstStats = climo.sstNow
      ? this._statsScalar(climo.sstNow, { landMask, landMaskMode: 'ocean', physMin: 260, physMax: 320 })
      : this._missingStats();
    if (sstStats) {
      sstStats.meanOcean = sstStats.meanAw;
    }
    stats.sst = sstStats;

    const seaIceStats = climo.iceNow
      ? this._statsScalar(climo.iceNow, {
        landMask,
        landMaskMode: 'ocean',
        physMin: 0,
        physMax: 1,
        thresholdsAbove: [0.15]
      })
      : this._missingStats();
    if (seaIceStats) {
      seaIceStats.below0Count = seaIceStats.belowPhysMinCount;
      seaIceStats.areaFracGt015 = seaIceStats.areaFracAbove?.['0.15'] ?? null;
      seaIceStats.meanOcean = seaIceStats.meanAw;
    }
    stats.seaIce = seaIceStats;

    if (includeStatic) {
      stats.albedo = geo.albedo
        ? this._statsScalar(geo.albedo, { landMask, physMin: 0, physMax: 1 })
        : this._missingStats();
      if (geo.albedo) {
        stats.albedo.below0Count = stats.albedo.belowPhysMinCount;
        stats.albedo.meanLand = this._statsScalar(geo.albedo, { landMask, landMaskMode: 'land' }).meanAw;
        stats.albedo.meanOcean = this._statsScalar(geo.albedo, { landMask, landMaskMode: 'ocean' }).meanAw;
      }
      stats.elev = geo.elev
        ? this._statsScalar(geo.elev, { landMask, physMin: -500, physMax: 9000 })
        : this._missingStats();
      stats.soilCap = geo.soilCap
        ? this._statsScalar(geo.soilCap, { landMask, physMin: 0, physMax: 1 })
        : this._missingStats();
      if (geo.soilCap) {
        stats.soilCap.below0Count = stats.soilCap.belowPhysMinCount;
      }
    }

    const rhStats = this._statsScalar(fields.RH, {
      landMask,
      physMin: 0,
      physMax: 2,
      thresholdsAbove: [1.0, 1.1],
      thresholdsBelow: [0]
    });
    rhStats.below0Count = rhStats.belowPhysMinCount;
    rhStats.areaFracGt1 = rhStats.areaFracAbove?.['1'] ?? rhStats.areaFracAbove?.['1.0'] ?? null;
    rhStats.areaFracGt11 = rhStats.areaFracAbove?.['1.1'] ?? null;
    rhStats.areaFracLt0 = rhStats.areaFracBelow?.['0'] ?? null;
    stats.RH = rhStats;

    const rhuStats = this._statsScalar(fields.RHU, {
      landMask,
      physMin: 0,
      physMax: 2,
      thresholdsAbove: [1.0, 1.1],
      thresholdsBelow: [0]
    });
    rhuStats.below0Count = rhuStats.belowPhysMinCount;
    rhuStats.areaFracGt1 = rhuStats.areaFracAbove?.['1'] ?? rhuStats.areaFracAbove?.['1.0'] ?? null;
    rhuStats.areaFracGt11 = rhuStats.areaFracAbove?.['1.1'] ?? null;
    rhuStats.areaFracLt0 = rhuStats.areaFracBelow?.['0'] ?? null;
    stats.RHU = rhuStats;

    const qvUStats = this._statsScalar(fields.qvU, { landMask, physMin: 0 });
    qvUStats.below0Count = qvUStats.belowPhysMinCount;
    stats.qvU = qvUStats;

    const qcUStats = this._statsScalar(fields.qcU, { landMask, physMin: 0 });
    qcUStats.below0Count = qcUStats.belowPhysMinCount;
    stats.qcU = qcUStats;

    if (fields.qiU) {
      const qiUStats = this._statsScalar(fields.qiU, { landMask, physMin: 0 });
      qiUStats.below0Count = qiUStats.belowPhysMinCount;
      stats.qiU = qiUStats;
    }

    const tauLowStats = this._statsScalar(fields.tauLow, { landMask, physMin: 0, physMax: 80 });
    stats.tauLow = tauLowStats;
    const tauHighStats = this._statsScalar(fields.tauHigh, { landMask, physMin: 0, physMax: 80 });
    stats.tauHigh = tauHighStats;
    const tauLowDeltaStats = this._statsScalar(fields.tauLowDelta, { landMask, physMin: 0 });
    stats.tauLowDelta = tauLowDeltaStats;
    const tauHighDeltaStats = this._statsScalar(fields.tauHighDelta, { landMask, physMin: 0 });
    stats.tauHighDelta = tauHighDeltaStats;

    stats.wind = this._statsVector(fields.u, fields.v, { landMask });
    stats.windUpper = this._statsVector(fields.uU, fields.vU, { landMask });
    stats.windUpper.shearMeanAw = this._meanShear(fields.u, fields.v, fields.uU, fields.vU);

    const hMin = core?.dynParams?.hMin ?? 0;
    const hUStats = this._statsScalar(fields.hU, {
      landMask,
      physMin: 0,
      thresholdsBelow: hMin > 0 ? [hMin] : []
    });
    hUStats.below0Count = hUStats.belowPhysMinCount;
    hUStats.areaFracLtHmin = hMin > 0 ? hUStats.areaFracBelow?.[String(hMin)] ?? null : null;
    stats.hUpper = hUStats;

    const divStats = this._statsScalar(fields.div, { landMask });
    divStats.rms = divStats.rmsAw;
    divStats.p99Abs = this._percentileAbs(fields.div, { landMask }, 99);
    stats.div = divStats;

    const vortStats = this._statsScalar(fields.vort, { landMask });
    vortStats.rms = vortStats.rmsAw;
    vortStats.p99Abs = this._percentileAbs(fields.vort, { landMask }, 99);
    stats.vort = vortStats;

    const omegaLStats = this._statsScalar(fields.omegaL, { landMask });
    omegaLStats.rms = omegaLStats.rmsAw;
    omegaLStats.p99Abs = this._percentileAbs(fields.omegaL, { landMask }, 99);
    stats.omegaL = omegaLStats;

    const omegaUStats = this._statsScalar(fields.omegaU, { landMask });
    omegaUStats.rms = omegaUStats.rmsAw;
    omegaUStats.p99Abs = this._percentileAbs(fields.omegaU, { landMask }, 99);
    stats.omegaU = omegaUStats;

    const cwpStats = this._statsScalar(fields.cwp, {
      landMask,
      physMin: 0,
      thresholdsAbove: [0.1]
    });
    cwpStats.below0Count = cwpStats.belowPhysMinCount;
    cwpStats.areaFracGt01 = cwpStats.areaFracAbove?.['0.1'] ?? null;
    cwpStats.cwpMax = cwpStats.max;
    cwpStats.totalCwpAw = cwpStats.meanAw != null ? cwpStats.meanAw * EARTH_AREA : null;
    stats.cwp = cwpStats;

    const cwpLowStats = this._statsScalar(fields.cwpLow, {
      landMask,
      physMin: 0,
      thresholdsAbove: [0.1]
    });
    cwpLowStats.below0Count = cwpLowStats.belowPhysMinCount;
    cwpLowStats.cwpMax = cwpLowStats.max;
    stats.cwpLow = cwpLowStats;

    const cwpHighStats = this._statsScalar(fields.cwpHigh, {
      landMask,
      physMin: 0,
      thresholdsAbove: [0.1]
    });
    cwpHighStats.below0Count = cwpHighStats.belowPhysMinCount;
    cwpHighStats.cwpMax = cwpHighStats.max;
    stats.cwpHigh = cwpHighStats;

    const precipStats = this._statsScalar(fields.precipRate, {
      landMask,
      physMin: 0,
      thresholdsAbove: [0.1]
    });
    precipStats.below0Count = precipStats.belowPhysMinCount;
    precipStats.areaFracGt01 = precipStats.areaFracAbove?.['0.1'] ?? null;
    precipStats.precipMax = precipStats.max;
    precipStats.globalMmPerDay = precipStats.meanAw != null ? precipStats.meanAw * 24 : null;
    stats.precip = precipStats;

    return stats;
  }

  _collectProbes(core) {
    this._ensureGrid(core.grid);
    if (!this._probeIndices) return [];
    const { fields } = core;
    const probes = [];
    for (const probe of this._probeIndices) {
      const k = probe.k;
      probes.push({
        name: probe.name,
        lat: probe.lat,
        lon: probe.lon,
        ps: fields.ps[k],
        T: fields.T[k],
        Ts: fields.Ts[k],
        TU: fields.TU[k],
        RH: fields.RH[k],
        RHU: fields.RHU[k],
        cloud: fields.cloud[k],
        cloudLow: fields.cloudLow[k],
        cloudHigh: fields.cloudHigh[k],
        tauLow: fields.tauLow[k],
        tauHigh: fields.tauHigh[k],
        omegaL: fields.omegaL[k],
        omegaU: fields.omegaU[k],
        cwp: fields.cwp[k],
        cwpLow: fields.cwpLow[k],
        cwpHigh: fields.cwpHigh[k],
        precip: fields.precipRate[k],
        u: fields.u[k],
        v: fields.v[k],
        uU: fields.uU[k],
        vU: fields.vU[k],
        hU: fields.hU[k],
        qvU: fields.qvU[k],
        qcU: fields.qcU ? fields.qcU[k] : 0,
        qiU: fields.qiU ? fields.qiU[k] : 0
      });
    }
    return probes;
  }

  _ensureGrid(grid) {
    if (this._grid === grid) return;
    this._grid = grid;
    this._rowWeights = new Float32Array(grid.ny);
    let total = 0;
    for (let j = 0; j < grid.ny; j++) {
      const w = grid.cosLat[j];
      this._rowWeights[j] = w;
      total += w * grid.nx;
    }
    this._totalWeight = total;
    this._ensureScratch(grid.count);
    this._probeIndices = this._buildProbeIndices(grid);
  }

  _buildProbeIndices(grid) {
    const indices = [];
    for (const probe of PROBES) {
      const i = Math.round((probe.lon + 180) / grid.cellLonDeg - 0.5);
      const j = Math.round((90 - probe.lat) / grid.cellLatDeg - 0.5);
      const ii = ((i % grid.nx) + grid.nx) % grid.nx;
      const jj = clamp(j, 0, grid.ny - 1);
      indices.push({ ...probe, i: ii, j: jj, k: jj * grid.nx + ii });
    }
    return indices;
  }

  _ensureScratch(size) {
    if (this._scratch && this._scratchSize >= size) return;
    this._scratchSize = size;
    this._scratch = new Float64Array(size);
  }

  _missingStats() {
    return {
      missing: true,
      min: null,
      max: null,
      meanAw: null,
      stdAw: null,
      rmsAw: null,
      p05: null,
      p50: null,
      p95: null,
      nanCount: 0,
      infCount: 0,
      belowPhysMinCount: 0,
      abovePhysMaxCount: 0,
      count: 0
    };
  }

  _meanMaxAbs(arr) {
    const { nx, ny } = this._grid;
    let sum = 0;
    let sumW = 0;
    let maxAbs = 0;
    let finiteCount = 0;
    for (let j = 0; j < ny; j++) {
      const w = this._rowWeights[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const v = arr[row + i];
        if (!Number.isFinite(v)) continue;
        finiteCount++;
        sum += v * w;
        sumW += w;
        const abs = Math.abs(v);
        if (abs > maxAbs) maxAbs = abs;
      }
    }
    return {
      meanAw: sumW > 0 ? sum / sumW : null,
      maxAbs: sumW > 0 ? maxAbs : null,
      finiteCount
    };
  }

  _statsScalar(arr, opts = {}) {
    if (!arr) return this._missingStats();
    const { nx, ny } = this._grid;
    const landMask = opts.landMask;
    const landMaskMode = opts.landMaskMode;
    const thresholdsAbove = opts.thresholdsAbove || [];
    const thresholdsBelow = opts.thresholdsBelow || [];
    const physMin = opts.physMin;
    const physMax = opts.physMax;

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSq = 0;
    let sumW = 0;
    let nanCount = 0;
    let infCount = 0;
    let belowPhysMinCount = 0;
    let abovePhysMaxCount = 0;
    const aboveWeights = thresholdsAbove.map(() => 0);
    const belowWeights = thresholdsBelow.map(() => 0);
    let scratchCount = 0;

    for (let j = 0; j < ny; j++) {
      const w = this._rowWeights[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        if (landMaskMode && landMask) {
          const isLand = landMask[k] === 1;
          if (landMaskMode === 'land' && !isLand) continue;
          if (landMaskMode === 'ocean' && isLand) continue;
        }
        const v = arr[k];
        if (!Number.isFinite(v)) {
          if (Number.isNaN(v)) nanCount++;
          else infCount++;
          continue;
        }
        if (v < min) min = v;
        if (v > max) max = v;
        if (Number.isFinite(physMin) && v < physMin) belowPhysMinCount++;
        if (Number.isFinite(physMax) && v > physMax) abovePhysMaxCount++;
        for (let t = 0; t < thresholdsAbove.length; t++) {
          if (v > thresholdsAbove[t]) aboveWeights[t] += w;
        }
        for (let t = 0; t < thresholdsBelow.length; t++) {
          if (v < thresholdsBelow[t]) belowWeights[t] += w;
        }
        sum += v * w;
        sumSq += v * v * w;
        sumW += w;
        this._scratch[scratchCount++] = v;
      }
    }

    const meanAw = sumW > 0 ? sum / sumW : null;
    const meanSqAw = sumW > 0 ? sumSq / sumW : null;
    const stdAw = meanSqAw != null && meanAw != null
      ? Math.sqrt(Math.max(0, meanSqAw - meanAw * meanAw))
      : null;
    const rmsAw = meanSqAw != null ? Math.sqrt(Math.max(0, meanSqAw)) : null;

    const percentiles = this._percentilesFromScratch(scratchCount, [5, 50, 95]);
    const areaFracAbove = {};
    thresholdsAbove.forEach((thr, idx) => {
      areaFracAbove[String(thr)] = sumW > 0 ? aboveWeights[idx] / sumW : null;
    });
    const areaFracBelow = {};
    thresholdsBelow.forEach((thr, idx) => {
      areaFracBelow[String(thr)] = sumW > 0 ? belowWeights[idx] / sumW : null;
    });

    return {
      min: scratchCount > 0 ? min : null,
      max: scratchCount > 0 ? max : null,
      meanAw,
      stdAw,
      rmsAw,
      p05: percentiles.p05,
      p50: percentiles.p50,
      p95: percentiles.p95,
      nanCount,
      infCount,
      belowPhysMinCount,
      abovePhysMaxCount,
      areaFracAbove,
      areaFracBelow,
      count: scratchCount
    };
  }

  _statsVector(u, v, opts = {}) {
    if (!u || !v) return this._missingStats();
    const { nx, ny } = this._grid;
    const landMask = opts.landMask;
    const landMaskMode = opts.landMaskMode;
    let sumW = 0;
    let sumU = 0;
    let sumV = 0;
    let sumSpeed = 0;
    let sumKe = 0;
    let minSpeed = Infinity;
    let maxSpeed = -Infinity;
    let nanCount = 0;
    let infCount = 0;
    let scratchCount = 0;

    for (let j = 0; j < ny; j++) {
      const w = this._rowWeights[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        if (landMaskMode && landMask) {
          const isLand = landMask[k] === 1;
          if (landMaskMode === 'land' && !isLand) continue;
          if (landMaskMode === 'ocean' && isLand) continue;
        }
        const uu = u[k];
        const vv = v[k];
        if (!Number.isFinite(uu) || !Number.isFinite(vv)) {
          if (Number.isNaN(uu) || Number.isNaN(vv)) nanCount++;
          else infCount++;
          continue;
        }
        const speed = Math.hypot(uu, vv);
        sumU += uu * w;
        sumV += vv * w;
        sumSpeed += speed * w;
        sumKe += 0.5 * (uu * uu + vv * vv) * w;
        sumW += w;
        if (speed < minSpeed) minSpeed = speed;
        if (speed > maxSpeed) maxSpeed = speed;
        this._scratch[scratchCount++] = speed;
      }
    }

    const speedPercentiles = this._percentilesFromScratch(scratchCount, [5, 50, 95]);
    const speedMeanAw = sumW > 0 ? sumSpeed / sumW : null;
    const maxOut = scratchCount > 0 ? maxSpeed : null;
    return {
      meanUAw: sumW > 0 ? sumU / sumW : null,
      meanVAw: sumW > 0 ? sumV / sumW : null,
      meanAw: speedMeanAw,
      min: scratchCount > 0 ? minSpeed : null,
      max: maxOut,
      p05: speedPercentiles.p05,
      p50: speedPercentiles.p50,
      p95: speedPercentiles.p95,
      speedMeanAw,
      speedP95: speedPercentiles.p95,
      speedMax: maxOut,
      keMeanAw: sumW > 0 ? sumKe / sumW : null,
      nanCount,
      infCount,
      belowPhysMinCount: 0,
      abovePhysMaxCount: 0,
      count: scratchCount
    };
  }

  _meanShear(u, v, uU, vU) {
    const { nx, ny } = this._grid;
    let sum = 0;
    let sumW = 0;
    for (let j = 0; j < ny; j++) {
      const w = this._rowWeights[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        const du = uU[k] - u[k];
        const dv = vU[k] - v[k];
        if (!Number.isFinite(du) || !Number.isFinite(dv)) continue;
        sum += Math.hypot(du, dv) * w;
        sumW += w;
      }
    }
    return sumW > 0 ? sum / sumW : null;
  }

  _percentilesFromScratch(count, percents) {
    if (!count || count <= 0) {
      const out = {};
      percents.forEach((p) => {
        out[`p${p}`] = null;
      });
      return out;
    }
    const data = this._scratch.subarray(0, count);
    data.sort();
    const out = {};
    percents.forEach((p) => {
      const idx = Math.max(0, Math.min(count - 1, Math.floor((p / 100) * (count - 1))));
      out[`p${p}`] = data[idx];
    });
    return out;
  }

  _percentileAbs(arr, opts, p) {
    if (!arr) return null;
    const { nx, ny } = this._grid;
    const landMask = opts?.landMask;
    const landMaskMode = opts?.landMaskMode;
    let scratchCount = 0;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        if (landMaskMode && landMask) {
          const isLand = landMask[k] === 1;
          if (landMaskMode === 'land' && !isLand) continue;
          if (landMaskMode === 'ocean' && isLand) continue;
        }
        const v = arr[k];
        if (!Number.isFinite(v)) continue;
        this._scratch[scratchCount++] = Math.abs(v);
      }
    }
    const out = this._percentilesFromScratch(scratchCount, [p]);
    return out[`p${p}`];
  }

  _rmsDifference(a, b, opts = {}) {
    if (!a || !b) return null;
    const { nx, ny } = this._grid;
    const landMask = opts.landMask;
    const landMaskMode = opts.landMaskMode;
    const scale = Number.isFinite(opts.scale) ? opts.scale : 1;
    let sumSq = 0;
    let sumW = 0;
    for (let j = 0; j < ny; j++) {
      const w = this._rowWeights[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        if (landMaskMode && landMask) {
          const isLand = landMask[k] === 1;
          if (landMaskMode === 'land' && !isLand) continue;
          if (landMaskMode === 'ocean' && isLand) continue;
        }
        const v = a[k] - b[k];
        if (!Number.isFinite(v)) continue;
        const vv = v * scale;
        sumSq += vv * vv * w;
        sumW += w;
      }
    }
    return sumW > 0 ? Math.sqrt(sumSq / sumW) : null;
  }

  _diffStats(a, b, opts = {}) {
    if (!a || !b) return { meanAw: null, p95: null };
    const { nx, ny } = this._grid;
    const landMask = opts.landMask;
    const landMaskMode = opts.landMaskMode;
    let sum = 0;
    let sumW = 0;
    let scratchCount = 0;
    for (let j = 0; j < ny; j++) {
      const w = this._rowWeights[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        if (landMaskMode && landMask) {
          const isLand = landMask[k] === 1;
          if (landMaskMode === 'land' && !isLand) continue;
          if (landMaskMode === 'ocean' && isLand) continue;
        }
        const v = a[k] - b[k];
        if (!Number.isFinite(v)) continue;
        sum += v * w;
        sumW += w;
        this._scratch[scratchCount++] = v;
      }
    }
    const meanAw = sumW > 0 ? sum / sumW : null;
    const p95 = this._percentilesFromScratch(scratchCount, [95]).p95;
    return { meanAw, p95 };
  }

  _pushEntry(entry) {
    const decorated = {
      schema: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      runId: this.runId,
      seq: this._seq++,
      tRealUtcMs: Date.now(),
      ...entry
    };
    const line = JSON.stringify(decorated);
    this.entries.push(line);
    this._trimEntries();
    if (this.onLine && this.runId) {
      try {
        this.onLine(line);
      } catch (_) {}
    }
  }

  _trimEntries() {
    if (this.entries.length <= this.maxEntries) return;
    const remove = this.entries.length - this.maxEntries;
    this.entries.splice(0, remove);
  }
}

export default WeatherLogger;
