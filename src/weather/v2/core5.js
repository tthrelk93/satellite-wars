import { createLatLonGridV2 } from './grid';
import { createState5 } from './state5';
import { updateHydrostatic } from './hydrostatic';
import { stepWinds5 } from './dynamics5';
import { stepWindEddyNudge5 } from './windEddyNudge5';
import { stepWindNudge5 } from './windNudge5';
import { stepSurfacePressure5 } from './mass5';
import { stepAdvection5 } from './advect5';
import { stepVertical5 } from './vertical5';
import { stepMicrophysics5 } from './microphysics5';
import { stepSurface2D5 } from './surface2d';
import { initClimo2D } from './climo2d';
import { stepRadiation2D5 } from './radiation2d';
import { updateDiagnostics2D5 } from './diagnostics2d';
import { initializeV2FromClimo } from './initializeFromClimo';
import { initializeV2FromAnalysis } from './initializeFromAnalysis.js';
import { loadAnalysisDataset } from './analysisLoader.js';
import { stepNudging5 } from './nudging5';
import {
  buildVerticalLayout,
  computeGeopotentialHeightByPressure,
  createSigmaHalfLevels,
  DEFAULT_PRESSURE_LEVELS_PA,
  levelSubarray
} from './verticalGrid';
import WeatherLogger from '../WeatherLogger';

const P_TOP = 20000;
const DEBUG_INIT_TEST_BLOB = false;

const makeArray = (count, value = 0) => {
  const arr = new Float32Array(count);
  if (value !== 0) arr.fill(value);
  return arr;
};

export class WeatherCore5 {
  constructor({
    nx = 180,
    ny = 90,
    dt = 120,
    seed,
    nz = 26,
    sigmaHalf,
    pressureLevelsPa = DEFAULT_PRESSURE_LEVELS_PA
  } = {}) {
    this.grid = createLatLonGridV2(nx, ny, { minDxMeters: 80000 });
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      const lat0 = this.grid.latDeg[0];
      const latN = this.grid.latDeg[this.grid.ny - 1];
      console.log(`[V2 grid] latDeg[0]=${lat0?.toFixed?.(3)} latDeg[ny-1]=${latN?.toFixed?.(3)}`);
      if (!(lat0 > latN)) {
        console.warn('[V2 grid] Expected lat decreases with j (j increases southward); advect5 assumes this.');
      }
    }
    this.nz = Math.max(5, Math.floor(Number(nz) || 26));
    const sigmaInput = sigmaHalf instanceof Float32Array
      ? sigmaHalf
      : Array.isArray(sigmaHalf)
        ? Float32Array.from(sigmaHalf)
        : createSigmaHalfLevels({ nz: this.nz });
    this.sigmaHalf = sigmaInput.length === this.nz + 1
      ? sigmaInput
      : createSigmaHalfLevels({ nz: this.nz });
    this.verticalLayout = buildVerticalLayout({ sigmaHalf: this.sigmaHalf, pressureLevelsPa });
    this.state = createState5({ grid: this.grid, nz: this.nz, sigmaHalf: this.sigmaHalf });
    const { N } = this.state;

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
    this.analysisInit = { source: 'pending' };
    this._metricsEverySteps = 10;
    this._metricsCounter = 0;
    this._debugChecks = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';
    this._moduleLogCadenceSeconds = 6 * 3600;
    this._nextModuleLogSimTime = null;
    this.logger = null;
    this._loggerContext = null;
    this.simSpeed = 1;
    this.lodParams = {
      enable: true,
      simSpeedThreshold: 8,
      microphysicsEvery: 3,
      radiationEvery: 6
    };
    this.dynParams = {
      maxWind: 70,
      tauDragSurface: 4 * 3600,
      tauDragTop: 2 * 86400,
      nuLaplacian: 4_000_000,
      quadDragAlphaSurface: 0.02,
      tropicsDragBoost: 0.5,
      tropicsDragLat0Deg: 10,
      tropicsDragLat1Deg: 30,
      polarFilterLatStartDeg: 60,
      polarFilterEverySteps: 0,
      extraFilterEverySteps: 0,
      extraFilterPasses: 2,
      enableMetricTerms: true
    };
    this.massParams = {
      psMin: 80000,
      psMax: 105000,
      conserveGlobalMean: true,
      maxAbsDpsDt: 0.02
    };
    this.advectParams = {
      polarLatStartDeg: 80,
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
      runoffEnabled: true,
      enableLandClimoTs: true,
      landTsUseT2m: true,
      landTsUseLatBaseline: true
    };
    this.nudgeParams = {
      enable: true,
      cadenceSeconds: 6 * 3600,
      tauPs: 15 * 86400,
      tauThetaS: 45 * 86400,
      tauQvS: 30 * 86400,
      sstAirOffsetK: -1,
      rhTargetOceanEq: 0.8,
      rhTargetOceanPole: 0.72,
      rhTargetLandEq: 0.7,
      rhTargetLandPole: 0.55,
      qvCap: 0.03,
      landQvNudgeScale: 0.5,
      oceanQvNudgeScale: 1.0,
      smoothLon: 61,
      smoothLat: 13,
      enablePs: true,
      enableThetaS: true,
      enableQvS: true,
      enableUpper: false
    };
    this._nudgeParamsRuntime = { ...this.nudgeParams };
    this.windNudgeParams = {
      enable: true,
      tauSurfaceSeconds: 7 * 86400,
      tauUpperSeconds: 10 * 86400,
      tauVSeconds: 20 * 86400,
      upperJetScale: 2.2,
      upperJetLatDeg: 35,
      upperJetWidthDeg: 12
    };
    this.windEddyParams = {
      enable: true,
      tauSeconds: 10 * 86400,
      scaleClampMin: 0.5,
      scaleClampMax: 2.0,
      eps: 1e-6
    };
    this._windNudgeMaxAbsCorrection = 0;
    this._windNudgeSpinupSeconds = 0;
    this.windNudgeSpinupParams = {
      enable: true,
      durationSeconds: 24 * 3600,
      tauSurfaceStartSeconds: 6 * 3600,
      tauUpperStartSeconds: 12 * 3600,
      tauVStartSeconds: 24 * 3600
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
      tauRadLower: 30 * 86400,
      tauRadUpper: 15 * 86400,
      TeqLowerEqK: 288,
      TeqLowerPoleK: 253,
      TeqUpperEqK: 255,
      TeqUpperPoleK: 235,
      TeqLatShape: 'sin2',
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
       enableConvectiveMixing: false,
       enableConvectiveOutcome: true,
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
       entrainFrac: 0.2,
      detrainTopFrac: 0.7,
      buoyTrigK: 0.0,
      dThetaMaxConvPerStep: 2.5,
      enableLargeScaleVerticalAdvection: true,
      verticalAdvectionCflMax: 0.4,
      dThetaMaxVertAdvPerStep: 2.0,
      enableOmegaMassFix: true,
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
      enableFluxSedimentation: true,
      enableIceSedimentation: true,
      kFallIce: 1 / (6 * 3600),
      enableIceMeltToRain: true,
      tauMeltIceToRain: 3600,
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
      enableConvectiveOutcome: true,
      convTauEvapCloudScale: 0.35,
      convKAutoScale: 2.0,
      convPrecipEffBoost: 0.15,
      dThetaMaxMicroPerStepConv: 2.5,
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
      dpTauLowMaxPa: 11000,
      tau0: 6,
      levVort: 2,
      levUpper: 2,
      pTop: P_TOP,
      wTauHigh: 0
    };
    this._dynScratch = {
      lapU: new Float32Array(N),
      lapV: new Float32Array(N),
      lapLapU: new Float32Array(N),
      lapLapV: new Float32Array(N),
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

    this.fields = {
      hL: makeArray(N),
      hU: makeArray(N),
      h850: makeArray(N),
      h700: makeArray(N),
      h500: makeArray(N),
      h250: makeArray(N),
      RH: makeArray(N),
      RHU: makeArray(N),
      vort: makeArray(N),
      div: makeArray(N),
      omegaL: makeArray(N),
      omegaU: makeArray(N),
      cloud: makeArray(N),
      cloudLow: makeArray(N),
      cloudHigh: makeArray(N),
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
    this._bindFieldViews();

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

    this._updateHydrostatic();

    console.log(`[V2] seed=${this.seed} version=v2 nz=${this.nz}`);
    this._initPromise = this._init();
  }

  advanceModelSeconds(modelSeconds) {
    if (!Number.isFinite(modelSeconds) || modelSeconds <= 0) return 0;
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

  setLogger(logger) {
    this.logger = logger instanceof WeatherLogger ? logger : null;
  }

  setLoggerContext(context) {
    this._loggerContext = context || null;
  }

  getLoggerContext() {
    return this._loggerContext;
  }

  setSimSpeed(simSpeed) {
    if (!Number.isFinite(simSpeed)) return;
    this.simSpeed = Math.max(0, simSpeed);
  }

  setTimeUTC(seconds) {
    if (!Number.isFinite(seconds)) return;
    this.timeUTC = seconds;
    this._accum = 0;
    this._lastAdvanceSteps = 0;
    this._dynStepIndex = 0;
    this._nudgeAccumSeconds = 0;
    this._climoAccumSeconds = 0;
    this._windNudgeSpinupSeconds = 0;
    this._updateClimoNow(0, true);
    this._updateHydrostatic();
  }

  setSeed(seed) {
    if (!Number.isFinite(seed)) return;
    this.seed = seed;
    this._accum = 0;
    this._dynStepIndex = 0;
    this._nudgeAccumSeconds = 0;
    this._climoAccumSeconds = 0;
    this._windNudgeSpinupSeconds = 0;
    this._updateClimoNow(0, true);
    if (this.ready) {
      initializeV2FromClimo({
        grid: this.grid,
        state: this.state,
        geo: this.geo,
        climo: this.climo
      });
    }
    this._updateHydrostatic();
  }

  getSeed() {
    return this.seed;
  }

  _copySnapshotField(field) {
    if (field instanceof Float32Array) return new Float32Array(field);
    if (field instanceof Uint8Array) return new Uint8Array(field);
    if (field instanceof Uint16Array) return new Uint16Array(field);
    return field;
  }

  getStateSnapshot({ mode = 'compact' } = {}) {
    const compactFields = {
      ps: this.fields.ps,
      Ts: this.fields.Ts,
      u: this.fields.u,
      v: this.fields.v,
      uU: this.fields.uU,
      vU: this.fields.vU,
      cloud: this.fields.cloud,
      cloudLow: this.fields.cloudLow,
      cloudHigh: this.fields.cloudHigh,
      precipRate: this.fields.precipRate,
      tauLow: this.fields.tauLow,
      tauHigh: this.fields.tauHigh,
      h850: this.fields.h850,
      h700: this.fields.h700,
      h500: this.fields.h500,
      h250: this.fields.h250
    };
    const snapshot = {
      mode,
      timeUTC: this.timeUTC,
      grid: {
        nx: this.grid.nx,
        ny: this.grid.ny,
        latDeg: new Float32Array(this.grid.latDeg),
        lonDeg: new Float32Array(this.grid.lonDeg)
      },
      vertical: {
        nz: this.nz,
        sigmaHalf: new Float32Array(this.sigmaHalf),
        layout: { ...this.verticalLayout }
      },
      fields: Object.fromEntries(
        Object.entries(compactFields).map(([key, field]) => [key, this._copySnapshotField(field)])
      )
    };

    if (mode === 'full') {
      snapshot.state = Object.fromEntries(
        Object.entries(this.state)
          .filter(([, value]) => value instanceof Float32Array || value instanceof Uint8Array || value instanceof Uint16Array)
          .map(([key, value]) => [key, this._copySnapshotField(value)])
      );
    }

    return snapshot;
  }

  _bindFieldViews() {
    const { N } = this.state;
    const layout = this.verticalLayout;
    const levSurface = layout.surface;
    const levLower = layout.lowerTroposphere;
    const levMid = layout.midTroposphere;
    const levUpper = layout.upperTroposphere;
    this._v2Levels = {
      levSurface,
      levLower,
      levMid,
      levUpper,
      surfaceOffset: levSurface * N,
      lowerOffset: levLower * N,
      midOffset: levMid * N,
      upperOffset: levUpper * N
    };

    Object.assign(this.fields, {
      u: levelSubarray(this.state.u, N, levSurface),
      v: levelSubarray(this.state.v, N, levSurface),
      uU: levelSubarray(this.state.u, N, levUpper),
      vU: levelSubarray(this.state.v, N, levUpper),
      theta: levelSubarray(this.state.theta, N, levSurface),
      thetaU: levelSubarray(this.state.theta, N, levUpper),
      T: levelSubarray(this.state.T, N, levSurface),
      TU: levelSubarray(this.state.T, N, levUpper),
      Ts: this.state.Ts,
      qv: levelSubarray(this.state.qv, N, levSurface),
      qvU: levelSubarray(this.state.qv, N, levUpper),
      qc: levelSubarray(this.state.qc, N, levSurface),
      qcU: levelSubarray(this.state.qc, N, levUpper),
      qi: levelSubarray(this.state.qi, N, levSurface),
      qiU: levelSubarray(this.state.qi, N, levUpper),
      qr: levelSubarray(this.state.qr, N, levSurface),
      ps: this.state.ps,
      phiMid: levelSubarray(this.state.phiMid, N, levMid),
      precipRate: this.state.precipRate
    });

    this.diagParams.levUpper = levUpper;
    this.diagParams.levVort = levMid;
  }

  _updateStandardPressureDiagnostics() {
    const heights = computeGeopotentialHeightByPressure(this.state, this.verticalLayout.pressureLevelsPa);
    const { N } = this.state;
    const { levLower, levUpper } = this._v2Levels;
    const lowerBase = levLower * N;
    const upperBase = levUpper * N;
    for (let i = 0; i < N; i += 1) {
      this.fields.hL[i] = this.state.phiMid[lowerBase + i] / 9.80665;
      this.fields.hU[i] = this.state.phiMid[upperBase + i] / 9.80665;
    }
    if (heights['85000']) this.fields.h850.set(heights['85000']);
    if (heights['70000']) this.fields.h700.set(heights['70000']);
    if (heights['50000']) this.fields.h500.set(heights['50000']);
    if (heights['25000']) this.fields.h250.set(heights['25000']);
  }

  _updateHydrostatic() {
    updateHydrostatic(this.state, { pTop: P_TOP });
    this._updateStandardPressureDiagnostics();
  }

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

      const analysisDataset = await loadAnalysisDataset({});
      if (analysisDataset) {
        try {
          this.analysisInit = initializeV2FromAnalysis({
            grid: this.grid,
            state: this.state,
            geo: this.geo,
            climo: this.climo,
            analysis: analysisDataset,
            params: { pTop: P_TOP, p0: 100000 }
          });
        } catch (analysisError) {
          console.warn('[WeatherCore5] Analysis init failed; falling back to climatology.', analysisError);
          initializeV2FromClimo({
            grid: this.grid,
            state: this.state,
            geo: this.geo,
            climo: this.climo
          });
          this.analysisInit = {
            source: 'climatology-fallback',
            reason: analysisError?.message || String(analysisError)
          };
        }
      } else {
        initializeV2FromClimo({
          grid: this.grid,
          state: this.state,
          geo: this.geo,
          climo: this.climo
        });
        this.analysisInit = { source: 'climatology' };
      }

      this._updateHydrostatic();
      this.ready = true;
    } catch (err) {
      console.warn('[WeatherCore5] Climo init failed; using defaults.', err);
      this.analysisInit = {
        source: 'error',
        reason: err?.message || String(err)
      };
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
    const logger = this.logger;
    const logContext = this._loggerContext;
    const logEnabled = Boolean(logger && logger.enabled && logger.processEnabled);
    const moduleCadenceSeconds = Number.isFinite(logger?.processCadenceSeconds) && logger.processCadenceSeconds > 0
      ? logger.processCadenceSeconds
      : Number.isFinite(logger?.cadenceSeconds) && logger.cadenceSeconds > 0
        ? logger.cadenceSeconds
        : this._moduleLogCadenceSeconds;
    if (!Number.isFinite(this._nextModuleLogSimTime)) {
      this._nextModuleLogSimTime = this.timeUTC;
    }
    const shouldLogModules = logEnabled && this.timeUTC >= this._nextModuleLogSimTime;
    if (shouldLogModules) {
      this._nextModuleLogSimTime = this.timeUTC + moduleCadenceSeconds;
    }
    const runWithLog = (name, fn) => {
      if (!shouldLogModules) {
        fn();
        return;
      }
      const before = logger.buildProcessSnapshot(this);
      fn();
      const after = logger.buildProcessSnapshot(this);
      logger.logProcessDelta(logContext, this, name, before, after);
    };
    const lodActive = this.lodParams?.enable && this.simSpeed > this.lodParams.simSpeedThreshold;
    const microEvery = Math.max(1, Number(this.lodParams?.microphysicsEvery) || 1);
    const radEvery = Math.max(1, Number(this.lodParams?.radiationEvery) || 1);
    const doRadiation = !lodActive || (this._dynStepIndex % radEvery === 0);
    const doMicrophysics = !lodActive || (this._dynStepIndex % microEvery === 0);

    runWithLog('updateHydrostatic', () => this._updateHydrostatic());
    runWithLog('stepSurface2D5', () => {
      stepSurface2D5({
        dt,
        grid: this.grid,
        state: this.state,
        climo: this.climo,
        params: this.surfaceParams
      });
    });
    runWithLog('updateHydrostatic', () => this._updateHydrostatic());
    if (doRadiation) {
      runWithLog('stepRadiation2D5', () => {
        stepRadiation2D5({
          dt,
          grid: this.grid,
          state: this.state,
          timeUTC: this.timeUTC,
          params: this.radParams
        });
      });
    }
    runWithLog('updateHydrostatic', () => this._updateHydrostatic());
    runWithLog('stepWinds5', () => {
      this.dynParams.stepIndex = this._dynStepIndex;
      stepWinds5({
        dt,
        grid: this.grid,
        state: this.state,
        params: this.dynParams,
        scratch: this._dynScratch
      });
    });
    const spinupParams = this.windNudgeSpinupParams;
    if (spinupParams?.enable) {
      const durationSeconds = Number.isFinite(spinupParams.durationSeconds)
        ? spinupParams.durationSeconds
        : 0;
      this._windNudgeSpinupSeconds = Math.min(
        this._windNudgeSpinupSeconds + dt,
        durationSeconds > 0 ? durationSeconds : this._windNudgeSpinupSeconds + dt
      );
    }
    const dur = Number.isFinite(spinupParams?.durationSeconds) ? spinupParams.durationSeconds : 0;
    const r01 = dur > 0 ? Math.min(1, this._windNudgeSpinupSeconds / dur) : 1;
    const r = r01 * r01 * (3 - 2 * r01);
    const lerp = (a, b, t) => a + (b - a) * t;
    const tauSurfaceEff = lerp(
      spinupParams?.tauSurfaceStartSeconds ?? this.windNudgeParams.tauSurfaceSeconds,
      this.windNudgeParams.tauSurfaceSeconds,
      r
    );
    const tauUpperEff = lerp(
      spinupParams?.tauUpperStartSeconds ?? this.windNudgeParams.tauUpperSeconds,
      this.windNudgeParams.tauUpperSeconds,
      r
    );
    const tauVEff = lerp(
      spinupParams?.tauVStartSeconds ?? this.windNudgeParams.tauVSeconds,
      this.windNudgeParams.tauVSeconds,
      r
    );
    const windNudgeResult = stepWindNudge5({
      dt,
      grid: this.grid,
      state: this.state,
      params: {
        ...this.windNudgeParams,
        tauSurfaceSeconds: tauSurfaceEff,
        tauUpperSeconds: tauUpperEff,
        tauVSeconds: tauVEff
      }
    });
    if (windNudgeResult?.didApply) {
      const maxAbs = Number.isFinite(windNudgeResult.maxAbsCorrection)
        ? windNudgeResult.maxAbsCorrection
        : 0;
      this._windNudgeMaxAbsCorrection = Math.max(this._windNudgeMaxAbsCorrection, maxAbs);
      if (shouldLogModules) {
        logger.recordEvent(
          'windNudgeDiagnostics',
          logContext,
          this,
          {
            rmseSurface: windNudgeResult.rmseSurface ?? null,
            rmseUpper: windNudgeResult.rmseUpper ?? null,
            maxAbsCorrection: this._windNudgeMaxAbsCorrection,
            spinupSeconds: this._windNudgeSpinupSeconds,
            effectiveTaus: {
              tauSurfaceSeconds: tauSurfaceEff,
              tauUpperSeconds: tauUpperEff,
              tauVSeconds: tauVEff
            },
            params: this.windNudgeParams
          }
        );
        this._windNudgeMaxAbsCorrection = 0;
      }
    }
    if (this.windEddyParams?.enable) {
      const eddyResult = stepWindEddyNudge5({
        dt,
        grid: this.grid,
        state: this.state,
        params: this.windEddyParams
      });
      if (eddyResult?.didApply && shouldLogModules) {
        logger.recordEvent(
          'windEddyNudgeDiagnostics',
          logContext,
          this,
          {
            ekeMean: eddyResult.ekeMean ?? null,
            maxScale: eddyResult.maxScale ?? null,
            params: this.windEddyParams
          }
        );
      }
    }
    runWithLog('stepSurfacePressure5', () => {
      stepSurfacePressure5({
        dt,
        grid: this.grid,
        state: this.state,
        params: this.massParams,
        scratch: this._dynScratch
      });
    });
    runWithLog('stepAdvection5', () => {
      this.advectParams.stepIndex = this._dynStepIndex;
      stepAdvection5({
        dt,
        grid: this.grid,
        state: this.state,
        params: this.advectParams,
        scratch: this._dynScratch
      });
    });
    runWithLog('stepVertical5', () => {
      stepVertical5({
        dt,
        grid: this.grid,
        state: this.state,
        params: this.vertParams,
        scratch: this._dynScratch
      });
    });
    runWithLog('updateHydrostatic', () => this._updateHydrostatic());
    if (typeof this.vertParams?.enableConvectiveOutcome === 'boolean') {
      this.microParams.enableConvectiveOutcome = this.vertParams.enableConvectiveOutcome;
    }
    if (doMicrophysics) {
      runWithLog('stepMicrophysics5', () => stepMicrophysics5({ dt, state: this.state, params: this.microParams }));
    }
    runWithLog('updateHydrostatic', () => this._updateHydrostatic());
    this._nudgeAccumSeconds += dt;
    if (this.nudgeParams.enable && this._nudgeAccumSeconds >= this.nudgeParams.cadenceSeconds) {
      const dtNudge = this._nudgeAccumSeconds;
      this._nudgeAccumSeconds = 0;
      runWithLog('stepNudging5', () => {
      this._nudgeParamsRuntime.psMin = this.massParams?.psMin;
      this._nudgeParamsRuntime.psMax = this.massParams?.psMax;
      stepNudging5({
        dt: dtNudge,
        grid: this.grid,
        state: this.state,
        climo: this.climo,
        params: this._nudgeParamsRuntime,
        scratch: this._nudgeScratch
      });
      });
      runWithLog('updateHydrostatic', () => this._updateHydrostatic());
    }
    runWithLog('updateDiagnostics2D5', () => {
      updateDiagnostics2D5({
        dt,
        grid: this.grid,
        state: this.state,
        outFields: this.fields,
        params: this.diagParams
      });
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
    // console.log(
    //   `[V2] step=${this._dynStepIndex} t=${this.timeUTC.toFixed(0)} ` +
    //   `cloudL m=${sCloudL.mean.toFixed(3)} mn=${sCloudL.min.toFixed(3)} mx=${sCloudL.max.toFixed(3)} ` +
    //   `cloudH m=${sCloudH.mean.toFixed(3)} mn=${sCloudH.min.toFixed(3)} mx=${sCloudH.max.toFixed(3)} ` +
    //   `tauL m=${sTauL.mean.toFixed(2)} mx=${sTauL.max.toFixed(2)} tauH m=${sTauH.mean.toFixed(2)} mx=${sTauH.max.toFixed(2)} ` +
    //   `cwpL m=${sCwpL.mean.toFixed(3)} cwpH m=${sCwpH.mean.toFixed(3)} ` +
    //   `tauClamp L=${clampL} H=${clampH} ` +
    //   `precip m=${sPrecip.mean.toFixed(3)} mx=${sPrecip.max.toFixed(3)} ` +
    //   `omegaP90=${omegaP90.toFixed(3)} omegaP95=${omegaP95.toFixed(3)} instabP50=${instabP50.toFixed(3)} convFrac=${convFrac.toFixed(3)}`
    // );
  }

  _sanityCheck() {
    const { ps, qv, qc, qi, qr, pHalf } = this.state;
    const { tauLow, tauHigh } = this.fields;
    const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
    let badPs = 0;
    let inversions = 0;
    let dpNeg = 0;
    let neg = 0;
    let tauClamp = 0;
    let tOut = 0;
    let tuOut = 0;
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
    if (isDev && this.fields?.T && this.fields?.TU) {
      const tMin = 150;
      const tMax = 350;
      const tField = this.fields.T;
      const tuField = this.fields.TU;
      for (let i = 0; i < tField.length; i++) {
        const tVal = tField[i];
        if (Number.isFinite(tVal) && (tVal < tMin || tVal > tMax)) tOut++;
        const tuVal = tuField[i];
        if (Number.isFinite(tuVal) && (tuVal < tMin || tuVal > tMax)) tuOut++;
      }
    }
    if (badPs || neg || tauClamp || dpNeg || inversions || (isDev && (tOut || tuOut))) {
      const tMsg = isDev ? ` TOut=${tOut} TUOut=${tuOut}` : '';
      console.warn(
        `[V2 sanity] psBad=${badPs} inversions=${inversions} dpNeg=${dpNeg} negWater=${neg} tau>50=${tauClamp}${tMsg}`
      );
    }
  }
}
