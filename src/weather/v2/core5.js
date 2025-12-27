import { createLatLonGridV2 } from './grid';
import { createState5 } from './state5';
import { updateHydrostatic } from './hydrostatic';
import { stepWinds5 } from './dynamics5';
import { stepSurfacePressure5 } from './mass5';
import { stepAdvection5 } from './advect5';
import { stepVertical5 } from './vertical5';
import { stepMicrophysics5 } from './microphysics5';
import { stepSurface2D5 } from './surface2d';
import { initClimo2D } from './climo2d';
import { stepRadiation2D5 } from './radiation2d';
import { updateDiagnostics2D5 } from './diagnostics2d';
import { initializeV2FromClimo } from './initializeFromClimo';
import { stepNudging5 } from './nudging5';

// Fractions anchored between pTop and ps, thin aloft, thicker near surface
const SIGMA_HALF = new Float32Array([0.0, 0.07, 0.18, 0.38, 0.65, 1.0]);
const P_TOP = 20000;
const DEBUG_INIT_TEST_BLOB = false;

const makeArray = (count, value = 0) => {
  const arr = new Float32Array(count);
  if (value !== 0) arr.fill(value);
  return arr;
};

export class WeatherCore5 {
  constructor({ nx = 180, ny = 90, dt = 120, seed } = {}) {
    this.grid = createLatLonGridV2(nx, ny, { minDxMeters: 80000 });
	    this.nz = 5;
	    this.sigmaHalf = SIGMA_HALF;
	    this.state = createState5({ grid: this.grid, nz: this.nz, sigmaHalf: this.sigmaHalf });
	    const { N } = this.state;
	    const phiMidOffset = 2 * N;

    this.modelDt = dt;
    this.timeUTC = 0;
    this.seed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1e9);
    this.ready = false;
    this._accum = 0;
    this._lastAdvanceSteps = 0;
    this._dynStepIndex = 0;
    this._nudgeAccumSeconds = 0;
    this._climoAccumSeconds = 0;
    this._climoUpdate = null;
    this._climoUpdateArgs = null;
    this._climoOut = null;
    this._metricsEverySteps = 10;
    this._metricsCounter = 0;
    this._debugChecks = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';
    this.dynParams = {
      maxWind: 150,
      tauDragSurface: 6 * 86400,
      tauDragTop: 20 * 86400,
      nuLaplacian: 2e5,
      polarFilterLatStartDeg: 60,
      polarFilterEverySteps: 0,
      extraFilterEverySteps: 0,
      extraFilterPasses: 2,
      enableMetricTerms: true
    };
    this.massParams = {
      psMin: 50000,
      psMax: 110000,
      conserveGlobalMean: true,
      maxAbsDpsDt: 1.0
    };
    this.advectParams = {
      polarLatStartDeg: 60,
      filterMoisture: false,
      maxBacktraceCells: 2
    };
    this.surfaceParams = {
      enable: true,
      rhoAir: 1.2,
      CpAir: 1004,
      Lv: 2.5e6,
      Ce: 1.2e-3,
      Ch: 1.0e-3,
      windFloor: 1.0,
      oceanTauTs: 10 * 86400,
      landTauTs: 3 * 86400,
      TsMin: 200,
      TsMax: 330,
      evapMax: 2e-4,
      soilEvapExponent: 1.0,
      runoffEnabled: true
    };
    this.nudgeParams = {
      enable: true,
      cadenceSeconds: 6 * 3600,
      tauPs: 30 * 86400,
      smoothLon: 31,
      smoothLat: 9,
      enablePs: true,
      enableUpper: false
    };
    this.radParams = {
      enable: true,
      S0: 1361,
      kSw: 0.12,
      albedoOcean: 0.06,
      albedoLand: 0.2,
      eps0: 0.75,
      kWv: 12.0,
      kCld: 0.1,
      tauRadLower: 2.5 * 86400,
      tauRadUpper: 1.5 * 86400,
      heatFracLower: 0.65,
      heatFracUpper: 0.35,
      dThetaMaxPerStep: 1.0,
      kTau: 80,
      radIceFactor: 0.7,
      pTop: P_TOP,
      enableSigmaLWProfile: true,
      enableSwMassDistribution: true
    };
    this.vertParams = {
      enableMixing: true,
      enableConvection: true,
      enableConvectiveMixing: true,
      enableConvectiveOutcome: false,
      mu0: 0.05,
      tauConv: 2 * 3600,
      tauPblUnstable: 6 * 3600,
      tauPblStable: 2 * 86400,
      pblDepthFrac: 0.35,
      maxMixFracPbl: 0.2,
      pblTaper: 0.85,
      pblMixCondensate: true,
      pblCondMixScale: 0.35,
      rhTrig: 0.75,
      rhMidMin: 0.25,
      omegaTrig: 0.3,
      instabTrig: 3,
      qvTrig: 0.002,
      thetaeCoeff: 10,
      thetaeQvCap: 0.03,
      pblWarmRain: true,
      qcAuto0: 7e-4,
      tauAuto: 4 * 3600,
      autoMaxFrac: 0.2,
      eps: 1e-12,
      debugConservation: false
    };
    this.microParams = {
      p0: 100000,
      pTop: P_TOP,
      qc0: 1e-3,
      qi0: 6e-4,
      kAuto: 3e-4,
      kAutoIce: 8e-4,
      kAutoColdBoost: 3.0,
      qc0ColdReduce: 0.5,
      autoMaxFrac: 0.25,
      precipEffMicro: 0.8,
      tauFreeze: 5400,
      tauMelt: 5400,
      Tfreeze: 273.15,
      TiceFull: 253.15,
      kFall: 1 / 3600,
      tauEvapCloudMin: 900,
      tauEvapCloudMax: 7200,
      tauEvapRainMin: 900,
      tauEvapRainMax: 28800,
      dThetaMaxMicroPerStep: 1.0,
      rhEvap0: 0.9,
      rhEvap1: 0.3,
      tauIceAgg: 12 * 3600,
      iceAggMaxFrac: 0.05,
      precipRateMax: 200,
      enable: true
    };
    this.diagParams = {
      enableNewCoverage: true,
      kTauLowLiquid: 20,
      kTauLowIce: 20,
      kTauHighIce: 10,
      kTauHighLiquid: 30,
      tauMaxLow: 50,
      tauMaxHigh: 50,
      tauCloudLowSeconds: 3 * 3600,
      tauCloudHighSeconds: 6 * 3600,
      rhLow0: 0.9,
      rhLow1: 0.99,
      rhHigh0: 0.55,
      rhHigh1: 0.85,
      omegaLowSubs0: 0.02,
      omegaLowSubs1: 0.2,
      omegaHigh0: 0.05,
      omegaHigh1: 0.3,
      stabLow0K: 0.5,
      stabLow1K: 3.0,
      convAnvilTauSeconds: 6 * 3600,
      convAnvilBoost: 0.6,
      convLowSuppress: 0.5,
      qc0Low: 1e-4,
      qc1Low: 8e-4,
      qc0High: 0.002,
      qc1High: 0.004,
      tau0: 6,
      levVort: 2,
      levUpper: 2,
      pTop: P_TOP,
      wTauHigh: 0
    };
    this._dynScratch = {
      lapU: new Float32Array(N),
      lapV: new Float32Array(N),
      fluxU: new Float32Array(N),
      fluxV: new Float32Array(N),
      dpsDt: new Float32Array(N),
      tmpU: new Float32Array(this.state.SZ),
      tmpV: new Float32Array(this.state.SZ),
      tmp3D: new Float32Array(this.state.SZ),
      rowA: new Float32Array(this.grid.nx),
      rowB: new Float32Array(this.grid.nx)
    };
    this._nudgeScratch = {
      tmp2D: new Float32Array(N),
      tmp2D2: new Float32Array(N)
    };

	    const levLower = this.nz - 1;
	    const levUpper = 2;
	    const lowerOffset = levLower * N;
	    const upperOffset = levUpper * N;

	    this.fields = {
	      u: this.state.u.subarray(lowerOffset, lowerOffset + N),
	      v: this.state.v.subarray(lowerOffset, lowerOffset + N),
	      uU: this.state.u.subarray(upperOffset, upperOffset + N),
	      vU: this.state.v.subarray(upperOffset, upperOffset + N),
	      hL: makeArray(N, 9000),
	      hU: makeArray(N, 3000),
	      T: this.state.T.subarray(lowerOffset, lowerOffset + N),
	      Ts: this.state.Ts,
	      TU: this.state.T.subarray(upperOffset, upperOffset + N),
	      qv: this.state.qv.subarray(lowerOffset, lowerOffset + N),
	      qvU: this.state.qv.subarray(upperOffset, upperOffset + N),
	      qc: this.state.qc.subarray(lowerOffset, lowerOffset + N),
	      qcU: this.state.qc.subarray(upperOffset, upperOffset + N),
	      qi: this.state.qi.subarray(lowerOffset, lowerOffset + N),
	      qiU: this.state.qi.subarray(upperOffset, upperOffset + N),
	      qr: this.state.qr.subarray(lowerOffset, lowerOffset + N),
	      ps: this.state.ps,
	      RH: makeArray(N),
	      RHU: makeArray(N),
      vort: makeArray(N),
      div: makeArray(N),
      omegaL: makeArray(N),
      omegaU: makeArray(N),
      cloud: makeArray(N),
      cloudLow: makeArray(N),
      cloudHigh: makeArray(N),
      phiMid: this.state.phiMid.subarray(phiMidOffset, phiMidOffset + N),
      cwp: makeArray(N),
      cwpLow: makeArray(N),
      cwpHigh: makeArray(N),
      tauLow: makeArray(N),
      tauHigh: makeArray(N),
      tauLowDelta: makeArray(N),
      tauHighDelta: makeArray(N),
      tauLowClampCount: 0,
      tauHighClampCount: 0,
      precipRate: this.state.precipRate,
      tcGenesis: makeArray(N),
      tcMask: makeArray(N)
    };

    this.geo = {
      landMask: this.state.landMask,
      elev: makeArray(N),
      albedo: makeArray(N),
      soilM: this.state.soilW,
      soilCap: this.state.soilCap,
      soilW: this.state.soilW,
      rough: makeArray(N),
      sstNow: this.state.sstNow,
      iceNow: makeArray(N)
    };

    this.climo = {
      sstNow: this.state.sstNow,
      iceNow: this.geo.iceNow,
      slpNow: makeArray(N),
      t2mNow: makeArray(N),
      hasSlp: false,
      hasT2m: false
    };

    this.state.albedo = this.geo.albedo;

    if (DEBUG_INIT_TEST_BLOB) {
      this._applyDebugInitTestBlob();
    }

	    updateHydrostatic(this.state, { pTop: P_TOP });

	    this._v2Levels = { levLower, levUpper, lowerOffset, upperOffset };

    console.log(`[V2] seed=${this.seed} version=v2`);
    this._initPromise = this._init();
  }

  advanceModelSeconds(modelSeconds) {
    if (!Number.isFinite(modelSeconds) || modelSeconds <= 0) return 0;
    this._accum += modelSeconds;
    const steps = Math.floor(this._accum / this.modelDt);
    const maxSteps = Math.max(1000, Math.ceil(86400 / this.modelDt) + 10);
    const stepsToRun = Math.min(steps, maxSteps);
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

  setTimeUTC(seconds) {
    if (!Number.isFinite(seconds)) return;
    this.timeUTC = seconds;
    this._accum = 0;
    this._lastAdvanceSteps = 0;
    this._dynStepIndex = 0;
    this._nudgeAccumSeconds = 0;
    this._climoAccumSeconds = 0;
    this._updateClimoNow(0, true);
    updateHydrostatic(this.state, { pTop: P_TOP });
  }

  setSeed(seed) {
    if (!Number.isFinite(seed)) return;
    this.seed = seed;
    this._accum = 0;
    this._dynStepIndex = 0;
    this._nudgeAccumSeconds = 0;
    this._climoAccumSeconds = 0;
    this._updateClimoNow(0, true);
    if (this.ready) {
      initializeV2FromClimo({
        grid: this.grid,
        state: this.state,
        geo: this.geo,
        climo: this.climo
      });
    }
    updateHydrostatic(this.state, { pTop: P_TOP });
  }

  getSeed() {
    return this.seed;
  }

  debugSpawnTropicalCyclone() {}

  debugSpawnHurricane() {}

  setV2ConvectionEnabled(enabled) {
    this.vertParams.enableConvection = Boolean(enabled);
  }

  async _init() {
    try {
      const climo = await initClimo2D({ grid: this.grid, seed: this.seed });
      if (climo?.landMask && climo.landMask.length === this.state.landMask.length) {
        this.state.landMask.set(climo.landMask);
      }
      if (climo?.soilCap && climo.soilCap.length === this.state.soilCap.length) {
        this.state.soilCap.set(climo.soilCap);
      }
      if (climo?.sstNow && climo.sstNow.length === this.state.sstNow.length) {
        this.state.sstNow.set(climo.sstNow);
      }
      if (climo?.iceNow && climo.iceNow.length === this.geo.iceNow.length) {
        this.geo.iceNow.set(climo.iceNow);
      }
      if (climo?.albedo && climo.albedo.length === this.geo.albedo.length) {
        this.geo.albedo.set(climo.albedo);
      }
      if (climo?.elev && climo.elev.length === this.geo.elev.length) {
        this.geo.elev.set(climo.elev);
      }
      if (climo?.slpNow && climo.slpNow.length === this.climo.slpNow.length) {
        this.climo.slpNow.set(climo.slpNow);
      }
      if (climo?.t2mNow && climo.t2mNow.length === this.climo.t2mNow.length) {
        this.climo.t2mNow.set(climo.t2mNow);
      }
      this.climo.hasSlp = Boolean(climo?.hasSlp);
      this.climo.hasT2m = Boolean(climo?.hasT2m);

      this._climoUpdate = climo?.updateClimoNow || null;
      this._climoOut = {
        sstNow: this.state.sstNow,
        iceNow: this.geo.iceNow,
        slpNow: this.climo.slpNow,
        t2mNow: this.climo.t2mNow
      };
      this._climoUpdateArgs = { timeUTC: this.timeUTC, out: this._climoOut };
      this._climoAccumSeconds = 0;
      this._updateClimoNow(0, true);
      initializeV2FromClimo({
        grid: this.grid,
        state: this.state,
        geo: this.geo,
        climo: this.climo
      });
      updateHydrostatic(this.state, { pTop: P_TOP });
      this.ready = true;
    } catch (err) {
      console.warn('[WeatherCore5] Climo init failed; using defaults.', err);
      this.ready = true;
    }
  }

  _applyDebugInitTestBlob() {
    const { nx, ny, latDeg, lonDeg, cosLat, kmPerDegLat } = this.grid;
    const { N, nz, theta, qv, u, v } = this.state;
    if (!N || !nz) return;

    const i0 = Math.floor(nx * 0.39);
    const i1 = Math.floor(nx * 0.55);
    const j0 = Math.floor(ny * 0.33);
    const j1 = Math.floor(ny * 0.65);
    const iC = Math.floor((i0 + i1) * 0.5);
    const jC = Math.floor((j0 + j1) * 0.5);
    const lon0 = lonDeg[Math.max(0, Math.min(nx - 1, iC))];
    const lat0 = latDeg[Math.max(0, Math.min(ny - 1, jC))];

    const r0 = 2_200_000;
    const invR02 = 1 / (r0 * r0);

    for (let j = j0; j <= j1; j++) {
      const lat = latDeg[j];
      const kmPerDegLon = kmPerDegLat * cosLat[j];
      for (let i = i0; i <= i1; i++) {
        const k = j * nx + i;
        const lon = lonDeg[i];
        const dx = (lon - lon0) * kmPerDegLon * 1000;
        const dy = (lat - lat0) * kmPerDegLat * 1000;
        const r2 = dx * dx + dy * dy;
        const w = Math.exp(-r2 * invR02);
        if (w < 1e-4) continue;

        const r = Math.sqrt(r2) + 1e-6;
        const ex = dx / r;
        const ey = dy / r;

        for (let lev = 0; lev < nz; lev++) {
          const idx = lev * N + k;
          theta[idx] += 12 * w;
          qv[idx] = Math.max(qv[idx], 0.001 * w);
          if (lev < nz - 1) {
            const inflow = 18 * w;
            u[idx] += -inflow * ex;
            v[idx] += -inflow * ey;
          }
        }

        const levS = nz - 1;
        const idxS = levS * N + k;
        theta[idxS] += 10 * w;
        qv[idxS] = Math.max(qv[idxS], 0.03 * w);

        const levA = nz - 2;
        const idxA = levA * N + k;
        qv[idxA] = Math.max(qv[idxA], 0.02 * w);
      }
    }
  }

  _stepOnce(dt) {
    this._updateClimoNow(dt, false);
    updateHydrostatic(this.state, { pTop: P_TOP });
    stepSurface2D5({
      dt,
      grid: this.grid,
      state: this.state,
      params: this.surfaceParams
    });
    updateHydrostatic(this.state, { pTop: P_TOP });
    stepRadiation2D5({
      dt,
      grid: this.grid,
      state: this.state,
      timeUTC: this.timeUTC,
      params: this.radParams
    });
    updateHydrostatic(this.state, { pTop: P_TOP });
    stepWinds5({
      dt,
      grid: this.grid,
      state: this.state,
      params: { ...this.dynParams, stepIndex: this._dynStepIndex },
      scratch: this._dynScratch
    });
    stepSurfacePressure5({
      dt,
      grid: this.grid,
      state: this.state,
      params: this.massParams,
      scratch: this._dynScratch
    });
    stepAdvection5({
      dt,
      grid: this.grid,
      state: this.state,
      params: { ...this.advectParams, stepIndex: this._dynStepIndex },
      scratch: this._dynScratch
    });
    stepVertical5({
      dt,
      grid: this.grid,
      state: this.state,
      params: this.vertParams,
      scratch: this._dynScratch
    });
    updateHydrostatic(this.state, { pTop: P_TOP });
    stepMicrophysics5({ dt, state: this.state, params: this.microParams });
    updateHydrostatic(this.state, { pTop: P_TOP });
    this._nudgeAccumSeconds += dt;
    if (this.nudgeParams.enable && this._nudgeAccumSeconds >= this.nudgeParams.cadenceSeconds) {
      const dtNudge = this._nudgeAccumSeconds;
      this._nudgeAccumSeconds = 0;
      stepNudging5({
        dt: dtNudge,
        grid: this.grid,
        state: this.state,
        climo: this.climo,
        params: this.nudgeParams,
        scratch: this._nudgeScratch
      });
      updateHydrostatic(this.state, { pTop: P_TOP });
    }
    updateDiagnostics2D5({
      dt,
      grid: this.grid,
      state: this.state,
      outFields: this.fields,
      params: this.diagParams
    });
    this._metricsCounter += 1;
    if (this._metricsCounter % this._metricsEverySteps === 0) {
      this._logV2Metrics();
    }
    if (this._debugChecks) {
      this._sanityCheck();
    }
    this._dynStepIndex += 1;
    this.timeUTC += dt;
  }

  _updateClimoNow(dt, force) {
    if (!this._climoUpdate || !this._climoUpdateArgs) return;
    if (force) {
      this._climoUpdateArgs.timeUTC = this.timeUTC;
      this._climoUpdate(this._climoUpdateArgs);
      return;
    }
    this._climoAccumSeconds += dt;
    if (this._climoAccumSeconds < 3600) return;
    this._climoAccumSeconds -= 3600;
    this._climoUpdateArgs.timeUTC = this.timeUTC;
    this._climoUpdate(this._climoUpdateArgs);
  }

  _metricStats(arr) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    const len = arr.length;
    for (let i = 0; i < len; i++) {
      const v = arr[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    return { min, max, mean: len ? sum / len : 0 };
  }

  _logV2Metrics() {
    const f = this.fields;
    const stats = (field) => this._metricStats(field);
    const sCloudL = stats(f.cloudLow);
    const sCloudH = stats(f.cloudHigh);
    const sTauL = stats(f.tauLow);
    const sTauH = stats(f.tauHigh);
    const sCwpL = stats(f.cwpLow);
    const sCwpH = stats(f.cwpHigh);
    const sPrecip = stats(f.precipRate);
    const clampL = f.tauLowClampCount || 0;
    const clampH = f.tauHighClampCount || 0;
    const vm = this.state.vertMetrics || {};
    const omegaP90 = vm.omegaPosP90 ?? 0;
    const omegaP95 = vm.omegaPosP95 ?? 0;
    const instabP50 = vm.instabP50 ?? 0;
    const convFrac = vm.convectiveFraction ?? 0;
    console.log(
      `[V2] step=${this._dynStepIndex} t=${this.timeUTC.toFixed(0)} ` +
      `cloudL m=${sCloudL.mean.toFixed(3)} mn=${sCloudL.min.toFixed(3)} mx=${sCloudL.max.toFixed(3)} ` +
      `cloudH m=${sCloudH.mean.toFixed(3)} mn=${sCloudH.min.toFixed(3)} mx=${sCloudH.max.toFixed(3)} ` +
      `tauL m=${sTauL.mean.toFixed(2)} mx=${sTauL.max.toFixed(2)} tauH m=${sTauH.mean.toFixed(2)} mx=${sTauH.max.toFixed(2)} ` +
      `cwpL m=${sCwpL.mean.toFixed(3)} cwpH m=${sCwpH.mean.toFixed(3)} ` +
      `tauClamp L=${clampL} H=${clampH} ` +
      `precip m=${sPrecip.mean.toFixed(3)} mx=${sPrecip.max.toFixed(3)} ` +
      `omegaP90=${omegaP90.toFixed(3)} omegaP95=${omegaP95.toFixed(3)} instabP50=${instabP50.toFixed(3)} convFrac=${convFrac.toFixed(3)}`
    );
  }

  _sanityCheck() {
    const { ps, qv, qc, qi, qr, pHalf } = this.state;
    const { tauLow, tauHigh } = this.fields;
    let badPs = 0;
    let inversions = 0;
    let dpNeg = 0;
    let neg = 0;
    let tauClamp = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p < 50000 || p > 110000) badPs++;
      const base = i;
      for (let k = 0; k < this.nz; k++) {
        const p1 = pHalf[k * this.state.N + base];
        const p2 = pHalf[(k + 1) * this.state.N + base];
        if (p1 >= p2) {
          inversions++;
          break;
        }
        const dp = p2 - p1;
        if (dp <= 0) dpNeg++;
      }
    }
    const len3D = qv.length;
    for (let i = 0; i < len3D; i++) {
      if (qv[i] < 0 || qc[i] < 0 || qi[i] < 0 || qr[i] < 0) neg++;
    }
    for (let i = 0; i < tauLow.length; i++) {
      if (tauLow[i] > 50 || tauHigh[i] > 50) tauClamp++;
    }
    if (badPs || neg || tauClamp || dpNeg || inversions) {
      console.warn(
        `[V2 sanity] psBad=${badPs} inversions=${inversions} dpNeg=${dpNeg} negWater=${neg} tau>50=${tauClamp}`
      );
    }
  }
}
