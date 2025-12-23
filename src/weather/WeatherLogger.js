import { Re } from './constants';

const EARTH_AREA = 4 * Math.PI * Re * Re;
const DEFAULT_MAX_ENTRIES = 20000;
const DEFAULT_CADENCE_SECONDS = 3600;
const DEFAULT_WIND_PANIC = 150;

const PROBES = [
  { name: 'Caribbean', lat: 15, lon: -60 },
  { name: 'Amazon', lat: -5, lon: -60 },
  { name: 'Sahara', lat: 25, lon: 10 },
  { name: 'NAtlantic', lat: 45, lon: -35 },
  { name: 'EqPacific', lat: 0, lon: -140 },
  { name: 'SOcean', lat: -55, lon: 0 }
];

const nowMs = () => {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

class WeatherLogger {
  constructor({ maxEntries = DEFAULT_MAX_ENTRIES, cadenceSeconds = DEFAULT_CADENCE_SECONDS } = {}) {
    this.enabled = false;
    this.entries = [];
    this.maxEntries = maxEntries;
    this.cadenceSeconds = cadenceSeconds;
    this.nextLogSimTimeSeconds = 0;
    this.runId = null;
    this.processEnabled = true;
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
    this.nextLogSimTimeSeconds = Number.isFinite(simTimeSeconds) ? simTimeSeconds : 0;
    this.runId = `weather-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
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
    const blob = new Blob([this.entries.join('\n') + '\n'], { type: 'application/json' });
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
    const entry = this._buildStateEntry(context, core, { reason, event: force ? 'manualStep' : 'state' });
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
      const entry = this._buildBaseEntry(context, core);
      entry.event = 'moduleNonFinite';
      entry.module = moduleName;
      entry.reason = 'firstNonFiniteAfterModule';
      entry.nonFiniteFields = nonFiniteFields;
      this._pushEntry(entry);
      this._firstNonFiniteModule = moduleName;
    }
    const entry = this._buildBaseEntry(context, core);
    entry.event = 'module';
    entry.module = moduleName;
    entry.deltas = deltas;
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
    return {
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
  }

  _buildBaseEntry(context, core) {
    const simTimeSeconds = Number.isFinite(context?.simTimeSeconds)
      ? context.simTimeSeconds
      : core?.timeUTC ?? 0;
    const simDay = Math.floor(simTimeSeconds / 86400);
    const todHours = ((simTimeSeconds % 86400) + 86400) % 86400 / 3600;
    const dayOfYear = (((simTimeSeconds / 86400) % 365) + 365) % 365;
    const monthFloat = (dayOfYear / 365) * 12;
    const monthFloor = Math.floor(monthFloat);
    const m0 = monthFloor % 12;
    const m1 = (m0 + 1) % 12;
    const f = monthFloat - monthFloor;
    const simIsoUTC = Number.isFinite(simTimeSeconds) ? new Date(simTimeSeconds * 1000).toISOString() : null;

    return {
      tRealMs: nowMs(),
      runId: this.runId,
      simTimeSeconds,
      simIsoUTC,
      simEpochLabel: 'sim-epoch-0',
      simDay,
      todHours,
      monthFloat,
      monthM0: m0,
      monthM1: m1,
      monthF: f,
      simSpeed: context?.simSpeed ?? null,
      paused: context?.paused ?? null,
      seed: core?.seed ?? null,
      'core.timeUTC': core?.timeUTC ?? null,
      deltaSimMinusCore: Number.isFinite(simTimeSeconds) && core ? simTimeSeconds - core.timeUTC : null,
      modelDt: core?.modelDt ?? null,
      stepsRanThisTick: context?.stepsRanThisTick ?? null
    };
  }

  _buildStateEntry(context, core, { reason, event = 'state' } = {}) {
    const base = this._buildBaseEntry(context, core);
    base.event = event;
    if (reason) base.reason = reason;
    base.cadenceSeconds = this.cadenceSeconds;

    this._ensureGrid(core.grid);

    const simDay = base.simDay;
    const includeStatic = this._logStaticNext || (this._staticLoggedDay !== simDay);
    if (includeStatic) {
      this._staticLoggedDay = simDay;
      this._logStaticNext = false;
    }

    base.fields = this._buildFieldStats(core, includeStatic);
    base.staticFieldsLogged = includeStatic;
    base.probes = this._collectProbes(core);
    return base;
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

    const psStats = this._statsScalar(fields.ps, {
      landMask,
      physMin: 85000,
      physMax: 107000
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

    if (climo.sstNow) {
      const tsMinusSst = this._diffStats(fields.Ts, climo.sstNow, {
        landMask,
        landMaskMode: 'ocean'
      });
      stats.tsMinusSst = {
        meanOcean: tsMinusSst.meanAw,
        p95Ocean: tsMinusSst.p95
      };
    }

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

    const tauLowStats = this._statsScalar(fields.tauLow, { landMask, physMin: 0, physMax: 20 });
    stats.tauLow = tauLowStats;
    const tauHighStats = this._statsScalar(fields.tauHigh, { landMask, physMin: 0, physMax: 20 });
    stats.tauHigh = tauHighStats;

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
        qvU: fields.qvU[k]
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
    return { missing: true };
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
    let maxSpeed = 0;
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
        if (speed > maxSpeed) maxSpeed = speed;
        this._scratch[scratchCount++] = speed;
      }
    }

    const speedPercentiles = this._percentilesFromScratch(scratchCount, [95]);
    return {
      meanUAw: sumW > 0 ? sumU / sumW : null,
      meanVAw: sumW > 0 ? sumV / sumW : null,
      speedMeanAw: sumW > 0 ? sumSpeed / sumW : null,
      speedP95: speedPercentiles.p95,
      speedMax: scratchCount > 0 ? maxSpeed : null,
      keMeanAw: sumW > 0 ? sumKe / sumW : null,
      nanCount,
      infCount,
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
    this.entries.push(JSON.stringify(entry));
    this._trimEntries();
  }

  _trimEntries() {
    if (this.entries.length <= this.maxEntries) return;
    const remove = this.entries.length - this.maxEntries;
    this.entries.splice(0, remove);
  }
}

export default WeatherLogger;
