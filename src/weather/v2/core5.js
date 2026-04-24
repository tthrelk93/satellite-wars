import { createLatLonGridV2 } from './grid.js';
import { createState5 } from './state5.js';
import { updateHydrostatic } from './hydrostatic.js';
import { stepWinds5 } from './dynamics5.js';
import { stepWindEddyNudge5 } from './windEddyNudge5.js';
import { stepWindNudge5 } from './windNudge5.js';
import { stepSurfacePressure5 } from './mass5.js';
import { stepAdvection5 } from './advect5.js';
import { stepVertical5 } from './vertical5.js';
import { stepMicrophysics5 } from './microphysics5.js';
import { stepSurface2D5 } from './surface2d.js';
import { initClimo2D } from './climo2d.js';
import { stepRadiation2D5 } from './radiation2d.js';
import { updateDiagnostics2D5 } from './diagnostics2d.js';
import { initializeV2FromClimo } from './initializeFromClimo.js';
import { initializeV2FromAnalysis } from './initializeFromAnalysis.js';
import { loadAnalysisDataset } from './analysisLoader.js';
import { stepAnalysisIncrement5 } from './analysisIncrement5.js';
import { stepNudging5 } from './nudging5.js';
import {
  CLOUD_BIRTH_LEVEL_BANDS,
  CLOUD_BIRTH_LEVEL_BAND_COUNT,
  cloudBirthBandOffset,
  sigmaMidAtLevel as cloudBirthSigmaMidAtLevel
} from './cloudBirthTracing5.js';
import {
  buildVerticalLayout,
  computeGeopotentialHeightByPressure,
  createSigmaHalfLevels,
  DEFAULT_PRESSURE_LEVELS_PA,
  levelSubarray
} from './verticalGrid.js';
import { SURFACE_MOISTURE_SOURCE_FIELDS } from './sourceTracing5.js';
import WeatherLogger from '../WeatherLogger.js';

const P_TOP = 20000;
const DEBUG_INIT_TEST_BLOB = false;
const hasNodeStderr = typeof process !== 'undefined' && typeof process?.stderr?.write === 'function';
const debugStdErr = (message) => {
  if (hasNodeStderr) {
    process.stderr.write(`${message}\n`);
    return;
  }
  console.log(message);
};
const debugWarn = (message) => {
  if (hasNodeStderr) {
    process.stderr.write(`${message}\n`);
    return;
  }
  console.warn(message);
};

const makeArray = (count, value = 0) => {
  const arr = new Float32Array(count);
  if (value !== 0) arr.fill(value);
  return arr;
};

const PROCESS_BUDGET_MODULES = new Set([
  'stepSurface2D5',
  'stepSurfacePressure5',
  'stepAdvection5',
  'stepVertical5',
  'stepMicrophysics5',
  'stepNudging5'
]);
const PROCESS_BUDGET_BANDS = [
  { key: 'tropical_core', label: 'Tropical core', lat0: -12, lat1: 12 },
  { key: 'north_transition', label: 'North transition', lat0: 12, lat1: 22 },
  { key: 'south_transition', label: 'South transition', lat0: -22, lat1: -12 },
  { key: 'north_dry_belt', label: 'North dry belt', lat0: 15, lat1: 35 },
  { key: 'south_dry_belt', label: 'South dry belt', lat0: -35, lat1: -15 },
  { key: 'north_dry_belt_land', label: 'North dry belt land', lat0: 15, lat1: 35, landMaskMode: 'land' },
  { key: 'north_dry_belt_ocean', label: 'North dry belt ocean', lat0: 15, lat1: 35, landMaskMode: 'ocean' },
  { key: 'south_dry_belt_land', label: 'South dry belt land', lat0: -35, lat1: -15, landMaskMode: 'land' },
  { key: 'south_dry_belt_ocean', label: 'South dry belt ocean', lat0: -35, lat1: -15, landMaskMode: 'ocean' }
];
const PRECIP_REGIME_KEYS = [
  'deep_core_tropical',
  'tropical_transition_spillover',
  'marginal_subtropical',
  'large_scale_other'
];
const CONSERVATION_SAMPLE_MODULES = new Set([
  'stepSurface2D5',
  'stepAdvection5',
  'stepVertical5',
  'stepMicrophysics5',
  'stepNudging5',
  'stepAnalysisIncrement5'
]);
const CONSERVATION_WATER_BANDS = [
  { key: 'tropical', lat0: -15, lat1: 15 },
  { key: 'subtropical', absLat0: 15, absLat1: 35 },
  { key: 'midlat', absLat0: 35, absLat1: 60 },
  { key: 'polar', absLat0: 60, absLat1: 90 },
  { key: 'midlatPolar', absLat0: 35, absLat1: 90 }
];

const createBandDeltaAccumulator = () => ({
  surfaceVaporDeltaKgKg: 0,
  upperVaporDeltaKgKg: 0,
  surfaceCloudDeltaKgKg: 0,
  upperCloudDeltaKgKg: 0,
  surfacePrecipDeltaMm: 0,
  convectiveOrganizationDelta: 0,
  convectiveMassFluxDeltaKgM2S: 0,
  detrainmentDeltaKgM2: 0,
  anvilDeltaFrac: 0,
  subtropicalSubsidenceDryingDeltaFrac: 0
});

const createProcessBudgetAccumulator = () => ({
  schema: 'satellite-wars.climate-process-budget.v1',
  sampleCount: 0,
  sampledModelSeconds: 0,
  bandDefinitions: PROCESS_BUDGET_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    lat0: band.lat0,
    lat1: band.lat1,
    landMaskMode: band.landMaskMode || 'all'
  })),
  modules: {},
  precipitationRegimes: Object.fromEntries(PRECIP_REGIME_KEYS.map((key) => [key, { surfacePrecipDeltaMm: 0 }])),
  notes: {
    interpretation: 'Positive surface/upper vapor deltas moisten a band; positive surface-precip deltas remove atmospheric water locally.'
  }
});

const createModuleBudgetAccumulator = (moduleName) => ({
  module: moduleName,
  callCount: 0,
  sampledModelSeconds: 0,
  bands: Object.fromEntries(PROCESS_BUDGET_BANDS.map((band) => [band.key, createBandDeltaAccumulator()]))
});

const createModuleTimingAccumulator = () => ({
  schema: 'satellite-wars.module-timing.v1',
  modules: {},
  order: []
});

const createConservationBudgetAccumulator = () => ({
  schema: 'satellite-wars.conservation-budget.v1',
  sampleCount: 0,
  sampledModelSeconds: 0,
  modules: {},
  notes: {
    interpretation: 'Global means are area-weighted. Water proxies are atmospheric column means plus accumulated surface precipitation.'
  }
});

const createConservationModuleAccumulator = (moduleName) => ({
  module: moduleName,
  callCount: 0,
  sampledModelSeconds: 0,
  delta: {
    globalColumnWaterMeanKgM2: 0,
    globalVaporMeanKgM2: 0,
    globalCondensateMeanKgM2: 0,
    globalEvapAccumMeanMm: 0,
    globalPrecipAccumMeanMm: 0,
    globalNumericalAdvectionRepairMeanKgM2: 0,
    globalNumericalAdvectionAddedMeanKgM2: 0,
    globalNumericalAdvectionRemovedMeanKgM2: 0,
    globalNumericalAdvectionResidualMeanKgM2: 0,
    globalVerticalSubtropicalDryingDemandMeanKgM2: 0,
    globalVerticalCloudErosionToVaporMeanKgM2: 0,
    tropicalColumnWaterMeanKgM2: 0,
    subtropicalColumnWaterMeanKgM2: 0,
    midlatColumnWaterMeanKgM2: 0,
    polarColumnWaterMeanKgM2: 0,
    midlatPolarColumnWaterMeanKgM2: 0,
    tropicalSourceWaterTropicalMeanKgM2: 0,
    tropicalSourceWaterSubtropicalMeanKgM2: 0,
    tropicalSourceWaterMidlatMeanKgM2: 0,
    tropicalSourceWaterPolarMeanKgM2: 0,
    tropicalSourceWaterMidlatPolarMeanKgM2: 0,
    tropicalSourceWaterGlobalMeanKgM2: 0,
    globalSurfaceTempMeanK: 0,
    globalSurfaceThetaMeanK: 0,
    globalUpperThetaMeanK: 0,
    globalSurfacePressureMeanPa: 0
  }
});

const buildWaterCycleClosureSummary = (budget) => {
  const modules = budget?.modules || {};
  const delta = (moduleName, key) => Number(modules[moduleName]?.delta?.[key]) || 0;
  const evaporationMeanMm = delta('stepSurface2D5', 'globalEvapAccumMeanMm');
  const precipitationMeanMm = delta('stepMicrophysics5', 'globalPrecipAccumMeanMm');
  const advectionNetDeltaKgM2 = delta('stepAdvection5', 'globalColumnWaterMeanKgM2');
  const verticalNetDeltaKgM2 = delta('stepVertical5', 'globalColumnWaterMeanKgM2');
  const verticalSubtropicalDryingDemandKgM2 = delta('stepVertical5', 'globalVerticalSubtropicalDryingDemandMeanKgM2');
  const verticalCloudErosionToVaporKgM2 = delta('stepVertical5', 'globalVerticalCloudErosionToVaporMeanKgM2');
  const verticalUnaccountedDeltaKgM2 = verticalNetDeltaKgM2;
  const nudgingNetDeltaKgM2 = delta('stepNudging5', 'globalColumnWaterMeanKgM2')
    + delta('stepAnalysisIncrement5', 'globalColumnWaterMeanKgM2');
  const tcwDriftKgM2 = Object.values(modules).reduce(
    (sum, moduleBudget) => sum + (Number(moduleBudget?.delta?.globalColumnWaterMeanKgM2) || 0),
    0
  );
  const physicalAtmosphericSourceKgM2 = evaporationMeanMm - precipitationMeanMm;
  const transportNumericalResidualKgM2 = advectionNetDeltaKgM2 + verticalUnaccountedDeltaKgM2;
  const denominator = Math.max(1, Math.abs(evaporationMeanMm), Math.abs(precipitationMeanMm));
  return {
    schema: 'satellite-wars.water-cycle-closure.v1',
    sampledModelSeconds: Number(budget?.sampledModelSeconds) || 0,
    evaporationMeanMm,
    precipitationMeanMm,
    evapMinusPrecipMeanMm: evaporationMeanMm - precipitationMeanMm,
    evapPrecipRelativeImbalance: (evaporationMeanMm - precipitationMeanMm) / denominator,
    tcwDriftKgM2,
    physicalAtmosphericSourceKgM2,
    nudgingNetDeltaKgM2,
    advectionNetDeltaKgM2,
    verticalNetDeltaKgM2,
    verticalUnaccountedDeltaKgM2,
    verticalSubtropicalDryingDemandKgM2,
    verticalCloudErosionToVaporKgM2,
    transportNumericalResidualKgM2,
    advectionRepairMeanKgM2: delta('stepAdvection5', 'globalNumericalAdvectionRepairMeanKgM2'),
    advectionRepairAddedMeanKgM2: delta('stepAdvection5', 'globalNumericalAdvectionAddedMeanKgM2'),
    advectionRepairRemovedMeanKgM2: delta('stepAdvection5', 'globalNumericalAdvectionRemovedMeanKgM2'),
    advectionRepairResidualMeanKgM2: delta('stepAdvection5', 'globalNumericalAdvectionResidualMeanKgM2'),
    tropicalSourceMidlatPolarDeltaKgM2: delta('stepAdvection5', 'tropicalSourceWaterMidlatPolarMeanKgM2'),
    tropicalSourceNumericalResidualKgM2: delta('stepAdvection5', 'tropicalSourceWaterGlobalMeanKgM2'),
    notes: {
      interpretation: 'Evaporation and precipitation are cumulative surface fluxes in mm water equivalent. TCW drift is atmospheric total-column water change. Advection and vertical unaccounted deltas should stay near zero for conservative transport. Tropical-source midlat/polar delta is physical tracer redistribution; tropical-source numerical residual is the global tracer source/sink check. Subtropical drying demand and cloud erosion-to-vapor are tracked as non-sink process demand/phase conversion.'
    }
  };
};

const CLOUD_TRANSITION_LEDGER_MODULES = new Set([
  'stepAdvection5',
  'stepVertical5',
  'stepMicrophysics5',
  'stepRadiation2D5'
]);
const REPLAY_TOGGLEABLE_MODULES = new Set([
  'stepAdvection5',
  'stepVertical5',
  'stepMicrophysics5',
  'stepRadiation2D5'
]);
const CLOUD_TRANSITION_LEDGER_TRANSITIONS = [
  { key: 'importedCloudEntering', label: 'Imported cloud entering' },
  { key: 'importedCloudSurvivingUnchanged', label: 'Imported cloud surviving unchanged' },
  { key: 'cloudErodedAway', label: 'Cloud eroded away' },
  { key: 'cloudConvertedIntoLocalCondensationSupport', label: 'Cloud converted into local condensation support' },
  { key: 'cloudConvertedIntoPrecipSupport', label: 'Cloud converted into precip support' },
  { key: 'cloudLostToReevaporation', label: 'Cloud lost to re-evaporation' },
  { key: 'cloudKeptAliveByRadiativePersistence', label: 'Cloud kept alive by radiative persistence' },
  { key: 'advectiveExportLoss', label: 'Advective export loss' },
  { key: 'unattributedResidual', label: 'Unattributed residual' }
];

const createCloudTransitionLedgerModuleAccumulator = (moduleName, cellCount) => ({
  module: moduleName,
  callCount: 0,
  sampledModelSeconds: 0,
  netCloudDeltaByBandCell: new Float64Array(cellCount * CLOUD_BIRTH_LEVEL_BAND_COUNT),
  transitions: Object.fromEntries(
    CLOUD_TRANSITION_LEDGER_TRANSITIONS.map(({ key }) => [key, new Float64Array(cellCount * CLOUD_BIRTH_LEVEL_BAND_COUNT)])
  )
});

const createCloudTransitionLedgerAccumulator = (cellCount) => ({
  schema: 'satellite-wars.cloud-transition-ledger.v1',
  sampleCount: 0,
  sampledModelSeconds: 0,
  bandDefinitions: CLOUD_BIRTH_LEVEL_BANDS.map((band) => ({ ...band })),
  transitionDefinitions: CLOUD_TRANSITION_LEDGER_TRANSITIONS.map((transition) => ({ ...transition })),
  modules: Object.fromEntries(
    Array.from(CLOUD_TRANSITION_LEDGER_MODULES).map((moduleName) => [
      moduleName,
      createCloudTransitionLedgerModuleAccumulator(moduleName, cellCount)
    ])
  )
});

const VERTICAL_CLOUD_BIRTH_TRACE_FIELDS = [
  'resolvedAscentCloudBirthAccumMass',
  'saturationAdjustmentCloudBirthAccumMass',
  'saturationAdjustmentRainoutMass',
  'convectiveDetrainmentCloudBirthAccumMass',
  'carryOverUpperCloudEnteringAccumMass',
  'carryOverUpperCloudSurvivingAccumMass',
  'saturationAdjustmentEventCount',
  'saturationAdjustmentSupersaturationMassWeighted',
  'saturationAdjustmentOmegaMassWeighted',
  'weakAscentCloudBirthAccumMass',
  'strongAscentCloudBirthAccumMass',
  'resolvedAscentCloudBirthByBandMass',
  'saturationAdjustmentCloudBirthByBandMass',
  'convectiveDetrainmentCloudBirthByBandMass',
  'carryOverUpperCloudEnteringByBandMass',
  'carryOverUpperCloudSurvivingByBandMass',
  'advectedCloudImportByBandMass',
  'advectedCloudExportByBandMass',
  'prevUpperCloudBandMass',
  'upperCloudResidenceTimeSeconds',
  'upperCloudTimeSinceLocalBirthSeconds',
  'upperCloudTimeSinceImportSeconds',
  'upperCloudFreshBornMass',
  'upperCloudRecentlyImportedMass',
  'upperCloudStaleMass',
  'upperCloudPassiveSurvivalMass',
  'upperCloudRegenerationMass',
  'upperCloudOscillatoryMass',
  'upperCloudPotentialErosionMass',
  'upperCloudAppliedErosionMass',
  'upperCloudBlockedErosionMass',
  'upperCloudBlockedByWeakSubsidenceMass',
  'upperCloudBlockedByWeakDescentVentMass',
  'upperCloudBlockedByLocalSupportMass',
  'upperCloudResidenceTimeMassWeightedSeconds',
  'upperCloudTimeSinceLocalBirthMassWeightedSeconds',
  'upperCloudTimeSinceImportMassWeightedSeconds',
  'upperCloudFreshBornAccumMass',
  'upperCloudRecentlyImportedAccumMass',
  'upperCloudStaleAccumMass',
  'upperCloudPassiveSurvivalAccumMass',
  'upperCloudRegenerationAccumMass',
  'upperCloudOscillatoryAccumMass',
  'upperCloudPotentialErosionAccumMass',
  'upperCloudAppliedErosionAccumMass',
  'upperCloudBlockedErosionAccumMass',
  'upperCloudBlockedByWeakSubsidenceAccumMass',
  'upperCloudBlockedByWeakDescentVentAccumMass',
  'upperCloudBlockedByLocalSupportAccumMass',
  'upperCloudPotentialErosionByBandMass',
  'upperCloudAppliedErosionByBandMass',
  'upperCloudBlockedErosionByBandMass',
  'microphysicsCloudToPrecipByBandMass',
  'cloudReevaporationByBandMass',
  'precipReevaporationByBandMass',
  'radiativePersistenceEquivalentByBandMass',
  'upperCloudShortwaveAbsorptionWm2',
  'upperCloudLongwaveRelaxationBoost',
  'upperCloudRadiativePersistenceSupportWm2',
  'upperCloudClearSkyLwCoolingWm2',
  'upperCloudCloudyLwCoolingWm2',
  'upperCloudLwCloudEffectWm2',
  'upperCloudNetCloudRadiativeEffectWm2',
  'surfaceCloudShortwaveShieldingWm2'
];

export class WeatherCore5 {
  constructor({
    nx = 180,
    ny = 90,
    dt = 120,
    seed,
    nz = 26,
    sigmaHalf,
    pressureLevelsPa = DEFAULT_PRESSURE_LEVELS_PA,
    instrumentationMode = 'full',
    maxInternalDt = 900
  } = {}) {
    this.grid = createLatLonGridV2(nx, ny, { minDxMeters: 80000 });
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      const lat0 = this.grid.latDeg[0];
      const latN = this.grid.latDeg[this.grid.ny - 1];
      debugStdErr(`[V2 grid] latDeg[0]=${lat0?.toFixed?.(3)} latDeg[ny-1]=${latN?.toFixed?.(3)}`);
      if (!(lat0 > latN)) {
        debugWarn('[V2 grid] Expected lat decreases with j (j increases southward); advect5 assumes this.');
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
    this.state = createState5({ grid: this.grid, nz: this.nz, sigmaHalf: this.sigmaHalf, instrumentationMode });
    const { N } = this.state;

    this.modelDt = dt;
    this.maxInternalDt = Math.max(1, Math.min(this.modelDt, Number(maxInternalDt) || this.modelDt));
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
    this.instrumentationMode = 'full';
    this._replayDisabledModules = new Set();
    this.lodParams = {
      enable: true,
      simSpeedThreshold: 8,
      microphysicsEvery: 3,
      radiationEvery: 6
    };
    this.dynParams = {
      maxWind: 70,
      tauDragSurface: 5 * 3600,
      tauDragTop: 6 * 3600,
      nuLaplacian: 4_000_000,
      quadDragAlphaSurface: 0.02,
      tropicsDragBoost: 0.5,
      tropicsDragLat0Deg: 10,
      tropicsDragLat1Deg: 30,
      polarFilterLatStartDeg: 60,
      polarFilterEverySteps: 1,
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
      maxBacktraceCells: 2,
      conserveWater: true
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
      cadenceSeconds: 3 * 3600,
      tauPs: 15 * 86400,
      tauThetaS: 45 * 86400,
      tauQvS: 45 * 86400,
      sstAirOffsetK: -1,
      rhTargetOceanEq: 0.8,
      rhTargetOceanPole: 0.72,
      rhTargetLandEq: 0.7,
      rhTargetLandPole: 0.55,
      qvCap: 0.03,
      landQvNudgeScale: 0.5,
      oceanQvNudgeScale: 1.0,
      organizedConvectionQvSurfaceRelief: 0.85,
      organizedConvectionQvColumnRelief: 1.05,
      organizedConvectionThetaColumnRelief: 0.55,
      subtropicalSubsidenceQvRelief: 1.65,
      smoothLon: 61,
      smoothLat: 13,
      enablePs: true,
      enableThetaS: true,
      enableQvS: false,
      enableThetaColumn: true,
      enableQvColumn: false,
      enableWindColumn: true,
      thetaSource: 'auto',
      qvSource: 'auto',
      windSource: 'auto',
      tauThetaColumn: 15 * 86400,
      tauQvColumn: 18 * 86400,
      tauWindColumn: 1 * 86400,
      enableUpper: false
    };
    this._nudgeParamsRuntime = { ...this.nudgeParams };
    this._moduleTiming = createModuleTimingAccumulator();
    this._conservationBudget = createConservationBudgetAccumulator();
    this.windNudgeParams = {
      enable: true,
      tauSurfaceSeconds: 8 * 3600,
      tauUpperSeconds: 1 * 3600,
      tauVSeconds: 2 * 3600,
      upperWindCapFactor: 1.35,
      upperWindCapOffset: 0,
      upperWindCapMin: 0,
      upperWindCapJetBoost: 20,
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
      tauUpperStartSeconds: 1 * 3600,
      tauVStartSeconds: 2 * 3600
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
      enableSwMassDistribution: true,
      upperCloudRadiativePersistenceEquivalentScale: 1.0
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
      rhTrig: 0.72,
      rhMidMin: 0.22,
      omegaTrig: 0.2,
      instabTrig: 2.5,
      qvTrig: 0.0018,
      thetaeCoeff: 10.5,
      thetaeQvCap: 0.03,
      convPotentialGrowTau: 90 * 60,
      convPotentialDecayTau: 8 * 3600,
      convOrganizationGrowTau: 90 * 60,
      convOrganizationDecayTau: 12 * 3600,
      convMinPotential: 0.15,
      convMinOrganization: 0.18,
      pblWarmRain: true,
       qcAuto0: 7e-4,
       tauAuto: 4 * 3600,
       autoMaxFrac: 0.2,
       entrainFrac: 0.2,
      detrainTopFrac: 0.7,
      convRainoutBase: 0.28,
      convRainoutOrganizationWeight: 0.32,
      convRainoutHumidityWeight: 0.2,
      buoyTrigK: 0.0,
      dThetaMaxConvPerStep: 2.5,
      enableLargeScaleVerticalAdvection: true,
      verticalAdvectionCflMax: 0.4,
      verticalAdvectionMaxSubsteps: 8,
      dThetaMaxVertAdvPerStep: 2.0,
      enableOmegaMassFix: true,
      orographicLiftScale: 0.5,
      orographicLeeSubsidenceScale: 0.35,
      terrainDirectionalBlend: 0.05,
      terrainLeeOmega0: 0.15,
      terrainLeeOmega1: 1.2,
      terrainLeeAscentDamp: 1.0,
      terrainLeeOmegaFloorBlend: 1.0,
      terrainDeliveryProtectExposure0: 0.5,
      terrainDeliveryProtectExposure1: 8.0,
      tropicalOrganizationBandDeg: 13,
      subtropicalSubsidenceLat0: 15,
      subtropicalSubsidenceLat1: 35,
      subtropicalSubsidenceTau: 8 * 3600,
      subtropicalSubsidenceMaxDryFrac: 0.28,
      subtropicalSubsidenceThetaStepK: 0.85,
      subtropicalSubsidenceTopSigma: 0.35,
      subtropicalSubsidenceBottomSigma: 0.85,
      subtropicalSubsidenceCrossHemiFloorFrac: 0.58,
      subtropicalSubsidenceWeakHemiBoost: 0.35,
      enableCirculationReboundContainment: true,
      circulationReboundContainmentScale: 1.35,
      circulationReboundOrganizationScale: 0.6,
      circulationReboundActivityScale: 0.35,
      circulationReboundSourceScale: 0.75,
      enableTransitionReturnFlowCoupling: false,
      circulationReturnFlowCouplingOpportunity0: 0.0002,
      circulationReturnFlowCouplingOpportunity1: 0.0012,
      circulationReturnFlowCouplingMaxFrac: 0.14,
      enableDryingOmegaBridge: false,
      dryingOmegaBridgeDry0: 0.08,
      dryingOmegaBridgeDry1: 0.16,
      dryingOmegaBridgeSuppressedSource0: 0.0007,
      dryingOmegaBridgeSuppressedSource1: 0.0016,
      dryingOmegaBridgeMaxPaS: 0.018,
      dryingOmegaBridgeProjectedShareMaxFrac: 0.65,
      dryingOmegaBridgeSourceLat0: 20,
      dryingOmegaBridgeSourceLat1: 30,
      dryingOmegaBridgeTargetLat0: 30,
      dryingOmegaBridgeTargetLat1: 45,
      dryingOmegaBridgeEquatorwardLeakLat0: 18,
      dryingOmegaBridgeEquatorwardLeakLat1: 22,
      dryingOmegaBridgeProjectedMaxPaS: 0.006,
      enableEquatorialEdgeSubsidenceGuard: false,
      equatorialEdgeSubsidenceGuardMaxPaS: 0.007,
      equatorialEdgeSubsidenceGuardSourceLat0: 8,
      equatorialEdgeSubsidenceGuardSourceLat1: 14,
      equatorialEdgeSubsidenceGuardTargetLat0: 2,
      equatorialEdgeSubsidenceGuardTargetLat1: 6,
      equatorialEdgeSubsidenceGuardProjectedMaxPaS: 0.0035,
      enableNorthsideFanoutLeakPenalty: false,
      northsideFanoutLeakPenaltyMaxFrac: 0.28,
      northsideFanoutLeakPenaltyLat0: 9,
      northsideFanoutLeakPenaltyLat1: 13,
      northsideFanoutLeakPenaltyRisk0: 0.32,
      northsideFanoutLeakPenaltyRisk1: 0.5,
      enableNorthSourceConcentrationPenalty: false,
      northSourceConcentrationPenaltySignal0: 0.035,
      northSourceConcentrationPenaltySignal1: 0.065,
      northSourceConcentrationPenaltySupport0: 0.08,
      northSourceConcentrationPenaltySupport1: 0.16,
      northSourceConcentrationPenaltyMaxFrac: 0.14,
      enableAtlanticDryCoreReceiverTaper: false,
      atlanticDryCoreReceiverTaperSignal0: 0.04,
      atlanticDryCoreReceiverTaperSignal1: 0.075,
      atlanticDryCoreReceiverTaperLat0: 22,
      atlanticDryCoreReceiverTaperLat1: 30,
      atlanticDryCoreReceiverTaperDry0: 0.12,
      atlanticDryCoreReceiverTaperDry1: 0.24,
      atlanticDryCoreReceiverTaperOmega0: 0.12,
      atlanticDryCoreReceiverTaperOmega1: 0.26,
      atlanticDryCoreReceiverTaperMaxFrac: 0.16,
      enableAtlanticTransitionCarryoverContainment: false,
      atlanticTransitionCarryoverContainmentSignal0: 0.04,
      atlanticTransitionCarryoverContainmentSignal1: 0.075,
      atlanticTransitionCarryoverContainmentLat0: 18,
      atlanticTransitionCarryoverContainmentLat1: 22.5,
      atlanticTransitionCarryoverContainmentOverlap0: 0.08,
      atlanticTransitionCarryoverContainmentOverlap1: 0.18,
      atlanticTransitionCarryoverContainmentDry0: 0.12,
      atlanticTransitionCarryoverContainmentDry1: 0.24,
      atlanticTransitionCarryoverContainmentOmega0: 0.12,
      atlanticTransitionCarryoverContainmentOmega1: 0.26,
      atlanticTransitionCarryoverContainmentMaxFrac: 0.18,
      enableWeakHemiCrossHemiFloorTaper: false,
      weakHemiCrossHemiFloorTaperPenalty0: 0.02,
      weakHemiCrossHemiFloorTaperPenalty1: 0.06,
      weakHemiCrossHemiFloorTaperOverhang0: 0.06,
      weakHemiCrossHemiFloorTaperOverhang1: 0.12,
      weakHemiCrossHemiFloorTaperMaxFrac: 0.145,
      upperCloudWeakErosionSupportScale: 1.0,
      upperCloudPersistenceSupportScale: 1.0,
      eps: 1e-12,
      debugConservation: false
    };
    this.microParams = {
      p0: 100000,
      pTop: P_TOP,
      qc0: 2e-4,
      qi0: 1.5e-4,
      qs0: 2e-4,
      kAutoRain: 2.4e-3,
      kAutoSnow: 3.0e-3,
      kAccreteRain: 8e-4,
      kAccreteSnow: 8e-4,
      autoMaxFrac: 0.85,
      precipEffMicro: 1.0,
      tauFreeze: 5400,
      tauMelt: 5400,
      tauFreezeRain: 3600,
      tauMeltSnow: 3600,
      Tfreeze: 273.15,
      TiceFull: 253.15,
      kFallRain: 1 / 900,
      kFallSnow: 1 / 3600,
      tauEvapCloudMin: 900,
      tauEvapCloudMax: 7200,
      tauEvapRainMin: 3600,
      tauEvapRainMax: 86400,
      tauSubSnowMin: 3600,
      tauSubSnowMax: 86400,
      dThetaMaxMicroPerStep: 1.0,
      rhEvap0: 0.9,
      rhEvap1: 0.3,
      tauIceAgg: 12 * 3600,
      iceAggMaxFrac: 0.05,
      precipRateMax: 200,
      enableConvectiveOutcome: true,
      convTauEvapCloudScale: 0.35,
      convKAutoScale: 2.0,
      convPrecipEffBoost: 0.12,
      enableSoftLiveStateMaintenanceSuppression: true,
      softLiveStateMaintenanceSuppressionScale: 2.0,
      softLiveStateMaintenanceSuppressionMaxFrac: 0.4,
      enableExplicitSubtropicalBalanceContract: false,
      explicitSubtropicalBalanceContractScale: 1.0,
      enableShoulderAbsorptionGuard: true,
      shoulderAbsorptionGuardScale: 1.6,
      shoulderAbsorptionGuardMaxFrac: 0.2,
      shoulderAbsorptionGuardSuppressedMassMode: 'buffered_rainout',
      shoulderBufferedEquatorialEdgeBoost: 0.35,
      shoulderBufferedInnerLanePenalty: 0.2,
      convectiveSaturationRainoutMaxFrac: 0.65,
      convectiveSaturationRainoutSupersat0: 0.025,
      convectiveSaturationRainoutSupersat1: 0.18,
      convectiveSaturationRainoutAscent0: 0.04,
      convectiveSaturationRainoutAscent1: 0.18,
      convectiveSaturationRainoutSigma0: 0.25,
      convectiveSaturationRainoutSigma1: 0.92,
      convectiveSaturationRainoutSigmaTop: 0.98,
      terrainLeeWarmRainSuppress: 0.9,
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
    this.analysisIncrementParams = {
      enable: true,
      thetaMin: 180,
      thetaMax: 380,
      TsMin: 180,
      TsMax: 330,
      qvMax: 0.04,
      windMin: -150,
      windMax: 150
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
      slp: makeArray(N),
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
      tauTotal: makeArray(N),
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
      windNowU: makeArray(N),
      windNowV: makeArray(N),
      wind500NowU: makeArray(N),
      wind500NowV: makeArray(N),
      wind250NowU: makeArray(N),
      wind250NowV: makeArray(N),
      q2mNow: makeArray(N),
      q700Now: makeArray(N),
      q250Now: makeArray(N),
      t700Now: makeArray(N),
      t250Now: makeArray(N),
      hasSlp: false,
      hasT2m: false,
      hasWind: false,
      hasWind500: false,
      hasWind250: false,
      hasQ2m: false,
      hasQ700: false,
      hasQ250: false,
      hasT700: false,
      hasT250: false
    };

    this.state.albedo = this.geo.albedo;

    if (DEBUG_INIT_TEST_BLOB) {
      this._applyDebugInitTestBlob();
    }

    this._updateHydrostatic();
    this.resetVerticalCloudBirthTracingDiagnostics();
    this.resetClimateProcessDiagnostics();
    this.resetCloudTransitionLedger();
    this.resetConservationDiagnostics();
    this.resetModuleTimingDiagnostics();
    this.setInstrumentationMode(instrumentationMode);

    debugStdErr(`[V2] seed=${this.seed} version=v2 nz=${this.nz}`);
    this._initPromise = this._init();
  }

  advanceModelSeconds(modelSeconds) {
    if (!Number.isFinite(modelSeconds) || modelSeconds <= 0) return 0;
    this._accum += modelSeconds;
    const steps = Math.floor(this._accum / this.modelDt);
    const maxSteps = Math.max(1000, Math.ceil(86400 / this.modelDt) + 10);
    const stepsToRun = Math.min(steps, maxSteps);
    let internalStepsRun = 0;
    for (let i = 0; i < stepsToRun; i++) {
      let remaining = this.modelDt;
      while (remaining > 1e-9) {
        const subDt = Math.min(this.maxInternalDt, remaining);
        this._stepOnce(subDt);
        internalStepsRun += 1;
        remaining -= subDt;
      }
    }
    if (this._loggerContext) {
      this._loggerContext.stepsRanThisTick = internalStepsRun;
    }
    this._accum -= stepsToRun * this.modelDt;
    if (stepsToRun < steps) {
      this._accum = Math.min(this._accum, this.modelDt * maxSteps);
    }
    this._lastAdvanceSteps = internalStepsRun;
    return internalStepsRun;
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

  setInstrumentationMode(mode = 'full') {
    const nextMode = mode === 'disabled' ? 'disabled' : mode === 'noop' ? 'noop' : 'full';
    this.instrumentationMode = nextMode;
    if (this.state) {
      this.state.instrumentationMode = nextMode;
      this.state.instrumentationEnabled = nextMode !== 'disabled';
    }
  }

  getInstrumentationMode() {
    return this.instrumentationMode || 'full';
  }

  setReplayDisabledModules(moduleNames = []) {
    const nextDisabled = new Set();
    for (const moduleName of moduleNames || []) {
      if (REPLAY_TOGGLEABLE_MODULES.has(moduleName)) {
        nextDisabled.add(moduleName);
      }
    }
    this._replayDisabledModules = nextDisabled;
  }

  clearReplayDisabledModules() {
    this._replayDisabledModules = new Set();
  }

  getReplayDisabledModules() {
    return Array.from(this._replayDisabledModules || []);
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
    this.resetVerticalCloudBirthTracingDiagnostics();
    this.resetClimateProcessDiagnostics();
    this.resetCloudTransitionLedger();
    this.resetConservationDiagnostics();
    this.resetModuleTimingDiagnostics();
    this.clearReplayDisabledModules();
  }

  resetVerticalCloudBirthTracingDiagnostics() {
    for (const fieldName of VERTICAL_CLOUD_BIRTH_TRACE_FIELDS) {
      const field = this.state?.[fieldName];
      if (field instanceof Float32Array || field instanceof Uint32Array || field instanceof Uint16Array || field instanceof Uint8Array) {
        field.fill(0);
      }
    }
  }

  resetClimateProcessDiagnostics() {
    this._climateProcessBudget = createProcessBudgetAccumulator();
  }

  resetCloudTransitionLedger() {
    this._cloudTransitionLedger = createCloudTransitionLedgerAccumulator(this.state?.N || 0);
  }

  getClimateProcessBudgetSummary() {
    const summary = this._climateProcessBudget
      ? JSON.parse(JSON.stringify(this._climateProcessBudget))
      : createProcessBudgetAccumulator();
    const sampledDays = Number(summary.sampledModelSeconds) > 0
      ? summary.sampledModelSeconds / 86400
      : 0;
    for (const moduleSummary of Object.values(summary.modules || {})) {
      const moduleDays = Number(moduleSummary.sampledModelSeconds) > 0
        ? moduleSummary.sampledModelSeconds / 86400
        : sampledDays;
      for (const bandSummary of Object.values(moduleSummary.bands || {})) {
        bandSummary.surfaceVaporDeltaRateKgKgDay = moduleDays > 0
          ? bandSummary.surfaceVaporDeltaKgKg / moduleDays
          : null;
        bandSummary.upperVaporDeltaRateKgKgDay = moduleDays > 0
          ? bandSummary.upperVaporDeltaKgKg / moduleDays
          : null;
        bandSummary.surfacePrecipDeltaRateMmDay = moduleDays > 0
          ? bandSummary.surfacePrecipDeltaMm / moduleDays
          : null;
      }
    }
    const totalRegimePrecip = Object.values(summary.precipitationRegimes || {}).reduce(
      (sum, regime) => sum + (Number.isFinite(regime?.surfacePrecipDeltaMm) ? regime.surfacePrecipDeltaMm : 0),
      0
    );
    for (const regimeSummary of Object.values(summary.precipitationRegimes || {})) {
      regimeSummary.fractionOfTrackedMicrophysicsPrecip = totalRegimePrecip > 0
        ? regimeSummary.surfacePrecipDeltaMm / totalRegimePrecip
        : null;
    }
    return summary;
  }

  getCloudTransitionLedgerRaw() {
    if (!this._cloudTransitionLedger) {
      return createCloudTransitionLedgerAccumulator(this.state?.N || 0);
    }
    const summary = {
      ...this._cloudTransitionLedger,
      bandDefinitions: this._cloudTransitionLedger.bandDefinitions.map((band) => ({ ...band })),
      transitionDefinitions: this._cloudTransitionLedger.transitionDefinitions.map((transition) => ({ ...transition })),
      modules: {}
    };
    for (const [moduleName, moduleSummary] of Object.entries(this._cloudTransitionLedger.modules || {})) {
      summary.modules[moduleName] = {
        module: moduleSummary.module,
        callCount: moduleSummary.callCount,
        sampledModelSeconds: moduleSummary.sampledModelSeconds,
        netCloudDeltaByBandCell: Float64Array.from(moduleSummary.netCloudDeltaByBandCell || []),
        transitions: Object.fromEntries(
          Object.entries(moduleSummary.transitions || {}).map(([key, field]) => [key, Float64Array.from(field || [])])
        )
      };
    }
    return summary;
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

  _serializePressureLevelFieldMap(map) {
    if (!(map instanceof Map)) return null;
    return Array.from(map.entries()).map(([pressurePa, field]) => ([
      Number(pressurePa),
      this._copySnapshotField(field)
    ]));
  }

  _restorePressureLevelFieldMap(entries) {
    if (!Array.isArray(entries)) return null;
    const restored = new Map();
    for (const [pressurePa, field] of entries) {
      if (!(field instanceof Float32Array || field instanceof Uint8Array || field instanceof Uint16Array)) continue;
      restored.set(Number(pressurePa), this._copySnapshotField(field));
    }
    return restored;
  }

  _serializeAnalysisTargets() {
    const analysisTargets = this.state?.analysisTargets;
    if (!analysisTargets || typeof analysisTargets !== 'object') return null;
    return {
      source: analysisTargets.source ?? null,
      surfacePressurePa: this._copySnapshotField(analysisTargets.surfacePressurePa),
      surfaceTemperatureK: this._copySnapshotField(analysisTargets.surfaceTemperatureK),
      uByPressurePa: this._serializePressureLevelFieldMap(analysisTargets.uByPressurePa),
      vByPressurePa: this._serializePressureLevelFieldMap(analysisTargets.vByPressurePa),
      temperatureKByPressurePa: this._serializePressureLevelFieldMap(analysisTargets.temperatureKByPressurePa),
      thetaKByPressurePa: this._serializePressureLevelFieldMap(analysisTargets.thetaKByPressurePa),
      specificHumidityKgKgByPressurePa: this._serializePressureLevelFieldMap(analysisTargets.specificHumidityKgKgByPressurePa)
    };
  }

  _restoreAnalysisTargets(snapshot) {
    const analysisTargets = snapshot?.analysisTargets;
    if (!analysisTargets) {
      this.state.analysisTargets = null;
      return;
    }
    this.state.analysisTargets = {
      source: analysisTargets.source ?? null,
      surfacePressurePa: analysisTargets.surfacePressurePa instanceof Float32Array
        ? new Float32Array(analysisTargets.surfacePressurePa)
        : null,
      surfaceTemperatureK: analysisTargets.surfaceTemperatureK instanceof Float32Array
        ? new Float32Array(analysisTargets.surfaceTemperatureK)
        : null,
      uByPressurePa: this._restorePressureLevelFieldMap(analysisTargets.uByPressurePa),
      vByPressurePa: this._restorePressureLevelFieldMap(analysisTargets.vByPressurePa),
      temperatureKByPressurePa: this._restorePressureLevelFieldMap(analysisTargets.temperatureKByPressurePa),
      thetaKByPressurePa: this._restorePressureLevelFieldMap(analysisTargets.thetaKByPressurePa),
      specificHumidityKgKgByPressurePa: this._restorePressureLevelFieldMap(analysisTargets.specificHumidityKgKgByPressurePa)
    };
  }

  _serializeDiagnosticState() {
    return {
      vertMetrics: this.state?.vertMetrics ? { ...this.state.vertMetrics } : null,
      vertMetricsContinuous: this.state?.vertMetricsContinuous ? { ...this.state.vertMetricsContinuous } : null
    };
  }

  _restoreDiagnosticState(snapshot) {
    const diagnosticState = snapshot?.diagnosticState || null;
    this.state.vertMetrics = diagnosticState?.vertMetrics
      ? { ...diagnosticState.vertMetrics }
      : null;
    this.state.vertMetricsContinuous = diagnosticState?.vertMetricsContinuous
      ? { ...diagnosticState.vertMetricsContinuous }
      : null;
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
      sstNow: this.state.sstNow,
      seaIceFrac: this.state.seaIceFrac,
      seaIceThicknessM: this.state.seaIceThicknessM,
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
      climo: {
        fields: Object.fromEntries(
          Object.entries(this.climo)
            .filter(([, value]) => value instanceof Float32Array || value instanceof Uint8Array || value instanceof Uint16Array)
            .map(([key, value]) => [key, this._copySnapshotField(value)])
        ),
        flags: {
          hasSlp: Boolean(this.climo.hasSlp),
          hasT2m: Boolean(this.climo.hasT2m),
          hasWind: Boolean(this.climo.hasWind),
          hasWind500: Boolean(this.climo.hasWind500),
          hasWind250: Boolean(this.climo.hasWind250),
          hasQ2m: Boolean(this.climo.hasQ2m),
          hasQ700: Boolean(this.climo.hasQ700),
          hasQ250: Boolean(this.climo.hasQ250),
          hasT700: Boolean(this.climo.hasT700),
          hasT250: Boolean(this.climo.hasT250)
        }
      },
      runtime: {
        timeUTC: this.timeUTC,
        modelDt: this.modelDt,
        maxInternalDt: this.maxInternalDt,
        accumSeconds: this._accum,
        dynStepIndex: this._dynStepIndex,
        nudgeAccumSeconds: this._nudgeAccumSeconds,
        climoAccumSeconds: this._climoAccumSeconds,
        windNudgeSpinupSeconds: this._windNudgeSpinupSeconds,
        metricsCounter: this._metricsCounter,
        nextModuleLogSimTime: this._nextModuleLogSimTime,
        simSpeed: this.simSpeed,
        windNudgeMaxAbsCorrection: this._windNudgeMaxAbsCorrection,
        instrumentationMode: this.getInstrumentationMode()
      },
      params: {
        surfaceParams: { ...this.surfaceParams },
        advectParams: { ...this.advectParams },
        vertParams: { ...this.vertParams },
        microParams: { ...this.microParams },
        nudgeParams: { ...this.nudgeParams },
        windNudgeParams: { ...this.windNudgeParams },
        windEddyParams: { ...this.windEddyParams },
        windNudgeSpinupParams: { ...this.windNudgeSpinupParams },
        dynParams: { ...this.dynParams },
        massParams: { ...this.massParams },
        analysisIncrementParams: { ...this.analysisIncrementParams },
        radParams: { ...this.radParams },
        diagParams: { ...this.diagParams },
        lodParams: { ...this.lodParams }
      },
      analysisTargets: this._serializeAnalysisTargets(),
      diagnosticState: this._serializeDiagnosticState(),
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

  loadStateSnapshot(snapshot) {
    if (!snapshot || !snapshot.state) {
      throw new Error('A full state snapshot is required to restore WeatherCore5.');
    }
    if (snapshot?.grid?.nx !== this.grid.nx || snapshot?.grid?.ny !== this.grid.ny) {
      throw new Error('Snapshot grid does not match WeatherCore5 grid.');
    }
    if (snapshot?.vertical?.nz !== this.nz) {
      throw new Error('Snapshot vertical layout does not match WeatherCore5 vertical resolution.');
    }

    for (const [key, value] of Object.entries(snapshot?.climo?.fields || {})) {
      const target = this.climo[key] || this.geo[key];
      if (target instanceof Float32Array || target instanceof Uint8Array || target instanceof Uint16Array) {
        if (!value || value.length !== target.length) continue;
        target.set(value);
      }
    }
    Object.assign(this.climo, snapshot?.climo?.flags || {});

    for (const [key, value] of Object.entries(snapshot.state)) {
      const target = this.state[key];
      if (target instanceof Float32Array || target instanceof Uint8Array || target instanceof Uint16Array) {
        if (!value || value.length !== target.length) continue;
        target.set(value);
        continue;
      }
      if (value instanceof Float32Array) {
        this.state[key] = new Float32Array(value);
      } else if (value instanceof Uint8Array) {
        this.state[key] = new Uint8Array(value);
      } else if (value instanceof Uint16Array) {
        this.state[key] = new Uint16Array(value);
      }
    }
    this._restoreAnalysisTargets(snapshot);
    this._restoreDiagnosticState(snapshot);
    this.setInstrumentationMode(snapshot?.runtime?.instrumentationMode || this.getInstrumentationMode());

    Object.assign(this.surfaceParams, snapshot?.params?.surfaceParams || {});
    Object.assign(this.advectParams, snapshot?.params?.advectParams || {});
    Object.assign(this.vertParams, snapshot?.params?.vertParams || {});
    Object.assign(this.microParams, snapshot?.params?.microParams || {});
    Object.assign(this.nudgeParams, snapshot?.params?.nudgeParams || {});
    Object.assign(this.windNudgeParams, snapshot?.params?.windNudgeParams || {});
    Object.assign(this.windEddyParams, snapshot?.params?.windEddyParams || {});
    Object.assign(this.windNudgeSpinupParams, snapshot?.params?.windNudgeSpinupParams || {});
    Object.assign(this.dynParams, snapshot?.params?.dynParams || {});
    Object.assign(this.massParams, snapshot?.params?.massParams || {});
    Object.assign(this.analysisIncrementParams, snapshot?.params?.analysisIncrementParams || {});
    Object.assign(this.radParams, snapshot?.params?.radParams || {});
    Object.assign(this.diagParams, snapshot?.params?.diagParams || {});
    Object.assign(this.lodParams, snapshot?.params?.lodParams || {});

    this.timeUTC = Number(snapshot?.runtime?.timeUTC) || 0;
    this.modelDt = Number(snapshot?.runtime?.modelDt) || this.modelDt;
    this.maxInternalDt = Math.max(1, Math.min(this.modelDt, Number(snapshot?.runtime?.maxInternalDt) || this.maxInternalDt || this.modelDt));
    this._accum = Number(snapshot?.runtime?.accumSeconds) || 0;
    this._dynStepIndex = Number(snapshot?.runtime?.dynStepIndex) || 0;
    this._nudgeAccumSeconds = Number(snapshot?.runtime?.nudgeAccumSeconds) || 0;
    this._climoAccumSeconds = Number(snapshot?.runtime?.climoAccumSeconds) || 0;
    this._windNudgeSpinupSeconds = Number(snapshot?.runtime?.windNudgeSpinupSeconds) || 0;
    this._metricsCounter = Number(snapshot?.runtime?.metricsCounter) || 0;
    this._nextModuleLogSimTime = Number.isFinite(snapshot?.runtime?.nextModuleLogSimTime)
      ? snapshot.runtime.nextModuleLogSimTime
      : null;
    this.simSpeed = Number(snapshot?.runtime?.simSpeed) || 1;
    this._windNudgeMaxAbsCorrection = Number(snapshot?.runtime?.windNudgeMaxAbsCorrection) || 0;
    Object.assign(this._nudgeParamsRuntime, this.nudgeParams);
    if (this._climoUpdateArgs) {
      this._climoUpdateArgs.timeUTC = this.timeUTC;
    }
    this.clearReplayDisabledModules();
  }

  resetModuleTimingDiagnostics() {
    this._moduleTiming = createModuleTimingAccumulator();
  }

  getModuleTimingSummary() {
    return JSON.parse(JSON.stringify(this._moduleTiming));
  }

  resetConservationDiagnostics() {
    this._conservationBudget = createConservationBudgetAccumulator();
    if (this.state) {
      this.state.numericalAdvectionWaterRepairMassMeanKgM2 = 0;
      this.state.numericalAdvectionWaterAddedMassMeanKgM2 = 0;
      this.state.numericalAdvectionWaterRemovedMassMeanKgM2 = 0;
      this.state.numericalAdvectionWaterResidualMassMeanKgM2 = 0;
      this.state.numericalAdvectionWaterRepairMass?.fill?.(0);
      this.state.numericalAdvectionWaterAddedMass?.fill?.(0);
      this.state.numericalAdvectionWaterRemovedMass?.fill?.(0);
      this.state.verticalSubtropicalDryingDemandMass?.fill?.(0);
      this.state.verticalCloudErosionToVaporMass?.fill?.(0);
    }
  }

  getConservationSummary() {
    const summary = JSON.parse(JSON.stringify(this._conservationBudget));
    summary.waterCycle = buildWaterCycleClosureSummary(summary);
    return summary;
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
      qs: levelSubarray(this.state.qs, N, levSurface),
      qsU: levelSubarray(this.state.qs, N, levUpper),
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
      const elev = this.geo?.elev?.[i] || 0;
      const tMean = Math.max(180, this.fields.Ts[i] + 0.5 * 0.0065 * Math.max(0, elev));
      this.fields.slp[i] = this.state.ps[i] * Math.exp((9.80665 * Math.max(0, elev)) / Math.max(1e-6, 287.05 * tMean));
    }
    if (heights['85000']) this.fields.h850.set(heights['85000']);
    if (heights['70000']) this.fields.h700.set(heights['70000']);
    if (heights['50000']) this.fields.h500.set(heights['50000']);
    if (heights['25000']) this.fields.h250.set(heights['25000']);
  }

  _updateHydrostatic() {
    updateHydrostatic(this.state, { pTop: P_TOP, terrainHeightM: this.geo?.elev || null });
    this._updateStandardPressureDiagnostics();
  }

  _seedInitializationMoistureTracer() {
    if (this.state?.instrumentationEnabled === false) return;
    const initField = this.state.qvSourceInitializationMemory;
    if (!(initField instanceof Float32Array) || initField.length !== this.state.qv.length) return;
    initField.set(this.state.qv);
    for (const fieldName of SURFACE_MOISTURE_SOURCE_FIELDS) {
      if (fieldName === 'qvSourceInitializationMemory') continue;
      const field = this.state[fieldName];
      if (field?.fill) field.fill(0);
    }
  }

  _closeSurfaceSourceTracerBudget(fallbackFieldName = null) {
    if (this.state?.instrumentationEnabled === false) return;
    const { qv } = this.state;
    if (!(qv instanceof Float32Array)) return;
    const tracerFields = SURFACE_MOISTURE_SOURCE_FIELDS
      .map((fieldName) => this.state[fieldName])
      .filter((field) => field instanceof Float32Array && field.length === qv.length);
    if (!tracerFields.length) return;
    const fallbackField = fallbackFieldName
      ? this.state[fallbackFieldName]
      : null;

    for (let idx = 0; idx < qv.length; idx += 1) {
      const vapor = Math.max(0, qv[idx] || 0);
      if (!(vapor > 0)) {
        for (const field of tracerFields) field[idx] = 0;
        continue;
      }
      let tagged = 0;
      for (const field of tracerFields) tagged += Math.max(0, field[idx] || 0);
      if (tagged > vapor) {
        const scale = vapor / Math.max(tagged, 1e-12);
        for (const field of tracerFields) field[idx] = Math.max(0, field[idx] || 0) * scale;
        continue;
      }
      if (fallbackField instanceof Float32Array && fallbackField.length === qv.length && tagged < vapor) {
        fallbackField[idx] += vapor - tagged;
      }
    }
  }

  _recordModuleTiming(moduleName, elapsedMs) {
    const entry = this._moduleTiming.modules[moduleName] || (this._moduleTiming.modules[moduleName] = {
      module: moduleName,
      callCount: 0,
      totalWallMs: 0,
      maxWallMs: 0
    });
    entry.callCount += 1;
    entry.totalWallMs += elapsedMs;
    entry.maxWallMs = Math.max(entry.maxWallMs, elapsedMs);
    if (!this._moduleTiming.order.includes(moduleName)) this._moduleTiming.order.push(moduleName);
  }

  _captureConservationSnapshot() {
    const { grid, state } = this;
    const { nx, ny, cosLat } = grid;
    const { N, nz, qv, qc, qi, qr, qs, pHalf, ps, Ts, theta, surfaceEvapAccum } = state;
    let weightTotal = 0;
    let waterTotal = 0;
    let vaporTotal = 0;
    let condensateTotal = 0;
    let tropicalSourceTotal = 0;
    let evapAccumTotal = 0;
    let precipAccumTotal = 0;
    let verticalDryingDemandTotal = 0;
    let verticalCloudErosionToVaporTotal = 0;
    let surfaceTempTotal = 0;
    let surfaceThetaTotal = 0;
    let upperThetaTotal = 0;
    let psTotal = 0;
    const bandSums = Object.fromEntries(
      CONSERVATION_WATER_BANDS.map(({ key }) => [key, { weight: 0, columnWater: 0, tropicalSourceWater: 0 }])
    );
    const surfaceBase = (nz - 1) * N;
    const upperBase = (this.verticalLayout?.upperTroposphere || 0) * N;
    for (let cell = 0; cell < N; cell += 1) {
      const row = Math.floor(cell / nx);
      const lat = grid.latDeg[row];
      const latAbs = Math.abs(lat);
      const weight = Math.max(0.05, cosLat[row] || 0);
      weightTotal += weight;
      psTotal += (ps[cell] || 0) * weight;
      evapAccumTotal += (surfaceEvapAccum?.[cell] || 0) * weight;
      precipAccumTotal += (state.precipAccum?.[cell] || 0) * weight;
      verticalDryingDemandTotal += (state.verticalSubtropicalDryingDemandMass?.[cell] || 0) * weight;
      verticalCloudErosionToVaporTotal += (state.verticalCloudErosionToVaporMass?.[cell] || 0) * weight;
      surfaceTempTotal += (Ts[cell] || 0) * weight;
      surfaceThetaTotal += (theta[surfaceBase + cell] || 0) * weight;
      upperThetaTotal += (theta[upperBase + cell] || 0) * weight;
      let vaporColumn = 0;
      let condensateColumn = 0;
      let tropicalSourceColumn = 0;
      for (let lev = 0; lev < nz; lev += 1) {
        const idx = lev * N + cell;
        const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
        const layerMass = dp / 9.80665;
        const vapor = Math.max(0, qv[idx] || 0) * layerMass;
        const condensate = (
          Math.max(0, qc?.[idx] || 0)
          + Math.max(0, qi?.[idx] || 0)
          + Math.max(0, qr?.[idx] || 0)
          + Math.max(0, qs?.[idx] || 0)
        ) * layerMass;
        vaporColumn += vapor;
        condensateColumn += condensate;
        tropicalSourceColumn += (
          Math.max(0, state.qvSourceTropicalOceanNorth?.[idx] || 0)
          + Math.max(0, state.qvSourceTropicalOceanSouth?.[idx] || 0)
        ) * layerMass;
      }
      const columnWater = vaporColumn + condensateColumn;
      vaporTotal += vaporColumn * weight;
      condensateTotal += condensateColumn * weight;
      tropicalSourceTotal += tropicalSourceColumn * weight;
      waterTotal += columnWater * weight;
      for (const band of CONSERVATION_WATER_BANDS) {
        const inBand = Number.isFinite(band.absLat0)
          ? latAbs >= band.absLat0 && latAbs < band.absLat1
          : lat >= band.lat0 && lat < band.lat1;
        if (!inBand) continue;
        const acc = bandSums[band.key];
        acc.weight += weight;
        acc.columnWater += columnWater * weight;
        acc.tropicalSourceWater += tropicalSourceColumn * weight;
      }
    }
    const mean = (value) => weightTotal > 0 ? value / weightTotal : 0;
    const bandMean = (key, field) => {
      const band = bandSums[key];
      return band?.weight > 0 ? band[field] / band.weight : 0;
    };
    return {
      globalColumnWaterMeanKgM2: mean(waterTotal),
      globalVaporMeanKgM2: mean(vaporTotal),
      globalCondensateMeanKgM2: mean(condensateTotal),
      globalEvapAccumMeanMm: mean(evapAccumTotal),
      globalPrecipAccumMeanMm: mean(precipAccumTotal),
      globalNumericalAdvectionRepairMeanKgM2: state.numericalAdvectionWaterRepairMassMeanKgM2 || 0,
      globalNumericalAdvectionAddedMeanKgM2: state.numericalAdvectionWaterAddedMassMeanKgM2 || 0,
      globalNumericalAdvectionRemovedMeanKgM2: state.numericalAdvectionWaterRemovedMassMeanKgM2 || 0,
      globalNumericalAdvectionResidualMeanKgM2: state.numericalAdvectionWaterResidualMassMeanKgM2 || 0,
      globalVerticalSubtropicalDryingDemandMeanKgM2: mean(verticalDryingDemandTotal),
      globalVerticalCloudErosionToVaporMeanKgM2: mean(verticalCloudErosionToVaporTotal),
      tropicalColumnWaterMeanKgM2: bandMean('tropical', 'columnWater'),
      subtropicalColumnWaterMeanKgM2: bandMean('subtropical', 'columnWater'),
      midlatColumnWaterMeanKgM2: bandMean('midlat', 'columnWater'),
      polarColumnWaterMeanKgM2: bandMean('polar', 'columnWater'),
      midlatPolarColumnWaterMeanKgM2: bandMean('midlatPolar', 'columnWater'),
      tropicalSourceWaterTropicalMeanKgM2: bandMean('tropical', 'tropicalSourceWater'),
      tropicalSourceWaterSubtropicalMeanKgM2: bandMean('subtropical', 'tropicalSourceWater'),
      tropicalSourceWaterMidlatMeanKgM2: bandMean('midlat', 'tropicalSourceWater'),
      tropicalSourceWaterPolarMeanKgM2: bandMean('polar', 'tropicalSourceWater'),
      tropicalSourceWaterMidlatPolarMeanKgM2: bandMean('midlatPolar', 'tropicalSourceWater'),
      tropicalSourceWaterGlobalMeanKgM2: mean(tropicalSourceTotal),
      globalSurfaceTempMeanK: mean(surfaceTempTotal),
      globalSurfaceThetaMeanK: mean(surfaceThetaTotal),
      globalUpperThetaMeanK: mean(upperThetaTotal),
      globalSurfacePressureMeanPa: mean(psTotal)
    };
  }

  _accumulateConservationBudget(moduleName, beforeSnapshot, sampledDtSeconds) {
    if (!this._conservationBudget || !beforeSnapshot || !CONSERVATION_SAMPLE_MODULES.has(moduleName)) return;
    const afterSnapshot = this._captureConservationSnapshot();
    const moduleBudget = this._conservationBudget.modules[moduleName]
      || (this._conservationBudget.modules[moduleName] = createConservationModuleAccumulator(moduleName));
    moduleBudget.callCount += 1;
    moduleBudget.sampledModelSeconds += sampledDtSeconds;
    for (const key of Object.keys(moduleBudget.delta)) {
      moduleBudget.delta[key] += (afterSnapshot[key] || 0) - (beforeSnapshot[key] || 0);
    }
  }

  _shouldSampleClimateProcessBudget() {
    if (!this._climateProcessBudget) {
      this.resetClimateProcessDiagnostics();
    }
    this._climateProcessBudget.sampleCount += 1;
    if (!this._conservationBudget) {
      this.resetConservationDiagnostics();
    }
    this._conservationBudget.sampleCount += 1;
    return true;
  }

  _captureClimateProcessBudgetSnapshot(includePrecipCells = false) {
    const { grid, state } = this;
    const { nx, ny } = grid;
    const { N, landMask, precipAccum } = state;
    const bandSums = Object.fromEntries(PROCESS_BUDGET_BANDS.map((band) => [band.key, {
      weight: 0,
      surfaceVaporKgKg: 0,
      upperVaporKgKg: 0,
      surfaceCloudKgKg: 0,
      upperCloudKgKg: 0,
      surfacePrecipMm: 0,
      convectiveOrganizationFrac: 0,
      convectiveMassFluxKgM2S: 0,
      detrainmentKgM2: 0,
      anvilFrac: 0,
      subtropicalSubsidenceDryingFrac: 0
    }]));

    for (let k = 0; k < N; k += 1) {
      const row = Math.floor(k / nx);
      const lat = grid.latDeg[row];
      const weight = Math.max(0.05, grid.cosLat[row] || 0);
      const isLand = landMask[k] === 1;
      const surfaceVaporKgKg = this.fields.qv?.[k] || 0;
      const upperVaporKgKg = this.fields.qvU?.[k] || 0;
      const surfaceCloudKgKg = (this.fields.qc?.[k] || 0) + (this.fields.qi?.[k] || 0);
      const upperCloudKgKg = (this.fields.qcU?.[k] || 0) + (this.fields.qiU?.[k] || 0);

      for (const band of PROCESS_BUDGET_BANDS) {
        if (lat < band.lat0 || lat > band.lat1) continue;
        if (band.landMaskMode === 'land' && !isLand) continue;
        if (band.landMaskMode === 'ocean' && isLand) continue;
        const acc = bandSums[band.key];
        acc.weight += weight;
        acc.surfaceVaporKgKg += surfaceVaporKgKg * weight;
        acc.upperVaporKgKg += upperVaporKgKg * weight;
        acc.surfaceCloudKgKg += surfaceCloudKgKg * weight;
        acc.upperCloudKgKg += upperCloudKgKg * weight;
        acc.surfacePrecipMm += (precipAccum?.[k] || 0) * weight;
        acc.convectiveOrganizationFrac += (state.convectiveOrganization?.[k] || 0) * weight;
        acc.convectiveMassFluxKgM2S += (state.convectiveMassFlux?.[k] || 0) * weight;
        acc.detrainmentKgM2 += (state.convectiveDetrainmentMass?.[k] || 0) * weight;
        acc.anvilFrac += (state.convectiveAnvilSource?.[k] || 0) * weight;
        acc.subtropicalSubsidenceDryingFrac += (state.subtropicalSubsidenceDrying?.[k] || 0) * weight;
      }
    }

    const bands = Object.fromEntries(
      Object.entries(bandSums).map(([key, value]) => {
        const weight = value.weight;
        const mean = (field) => (weight > 0 ? value[field] / weight : 0);
        return [key, {
          surfaceVaporKgKg: mean('surfaceVaporKgKg'),
          upperVaporKgKg: mean('upperVaporKgKg'),
          surfaceCloudKgKg: mean('surfaceCloudKgKg'),
          upperCloudKgKg: mean('upperCloudKgKg'),
          surfacePrecipMm: mean('surfacePrecipMm'),
          convectiveOrganizationFrac: mean('convectiveOrganizationFrac'),
          convectiveMassFluxKgM2S: mean('convectiveMassFluxKgM2S'),
          detrainmentKgM2: mean('detrainmentKgM2'),
          anvilFrac: mean('anvilFrac'),
          subtropicalSubsidenceDryingFrac: mean('subtropicalSubsidenceDryingFrac')
        }];
      })
    );

    return {
      bands,
      precipAccumCell: includePrecipCells && precipAccum ? Float64Array.from(precipAccum) : null
    };
  }

  _copyCloudTransitionBandField(field) {
    return field instanceof Float32Array && field.length === this.state.N * CLOUD_BIRTH_LEVEL_BAND_COUNT
      ? Float64Array.from(field)
      : new Float64Array(this.state.N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }

  _captureCloudTransitionSnapshot(moduleName) {
    const { N, nz, pHalf, qc, qi, qr, qs } = this.state;
    const cloudPathByBand = new Float64Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
    const precipPathByBand = new Float64Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = cloudBirthSigmaMidAtLevel(this.sigmaHalf, lev, nz);
      const bandIndex = CLOUD_BIRTH_LEVEL_BANDS.findIndex((band) => sigmaMid >= band.minSigma && sigmaMid < band.maxSigma);
      const resolvedBandIndex = bandIndex >= 0 ? bandIndex : CLOUD_BIRTH_LEVEL_BANDS.length - 1;
      const base = lev * N;
      for (let k = 0; k < N; k += 1) {
        const idx = base + k;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        if (!(dp > 0)) continue;
        const layerMassKgM2 = dp / 9.80665;
        const offset = cloudBirthBandOffset(resolvedBandIndex, k, N);
        const precipMixingRatio = (qr?.[idx] || 0) + (qs?.[idx] || 0);
        const cloudMixingRatio = (qc?.[idx] || 0) + (qi?.[idx] || 0) + precipMixingRatio;
        cloudPathByBand[offset] += cloudMixingRatio * layerMassKgM2;
        precipPathByBand[offset] += precipMixingRatio * layerMassKgM2;
      }
    }
    const snapshot = {
      cloudPathByBand,
      precipPathByBand
    };
    if (moduleName === 'stepVertical5') {
      snapshot.carryOverUpperCloudEnteringByBandMass = this._copyCloudTransitionBandField(this.state.carryOverUpperCloudEnteringByBandMass);
      snapshot.carryOverUpperCloudSurvivingByBandMass = this._copyCloudTransitionBandField(this.state.carryOverUpperCloudSurvivingByBandMass);
      snapshot.resolvedAscentCloudBirthByBandMass = this._copyCloudTransitionBandField(this.state.resolvedAscentCloudBirthByBandMass);
      snapshot.convectiveDetrainmentCloudBirthByBandMass = this._copyCloudTransitionBandField(this.state.convectiveDetrainmentCloudBirthByBandMass);
      snapshot.upperCloudAppliedErosionByBandMass = this._copyCloudTransitionBandField(this.state.upperCloudAppliedErosionByBandMass);
    }
    if (moduleName === 'stepMicrophysics5') {
      snapshot.saturationAdjustmentCloudBirthByBandMass = this._copyCloudTransitionBandField(this.state.saturationAdjustmentCloudBirthByBandMass);
      snapshot.microphysicsCloudToPrecipByBandMass = this._copyCloudTransitionBandField(this.state.microphysicsCloudToPrecipByBandMass);
      snapshot.cloudReevaporationByBandMass = this._copyCloudTransitionBandField(this.state.cloudReevaporationByBandMass);
      snapshot.precipReevaporationByBandMass = this._copyCloudTransitionBandField(this.state.precipReevaporationByBandMass);
    }
    return snapshot;
  }

  _accumulateCloudTransitionLedger(moduleName, beforeSnapshot, afterSnapshot, sampledDtSeconds) {
    if (!this._cloudTransitionLedger || !beforeSnapshot || !afterSnapshot) return;
    const moduleLedger = this._cloudTransitionLedger.modules[moduleName];
    if (!moduleLedger) return;
    moduleLedger.callCount += 1;
    moduleLedger.sampledModelSeconds += sampledDtSeconds;
    const bandSize = this.state.N * CLOUD_BIRTH_LEVEL_BAND_COUNT;
    const addTransition = (transitionKey, index, value) => {
      if (!Number.isFinite(value) || value === 0) return;
      moduleLedger.transitions[transitionKey][index] += value;
    };
    const diffFieldAt = (afterField, beforeField, index) => (
      (afterField?.[index] || 0) - (beforeField?.[index] || 0)
    );
    for (let index = 0; index < bandSize; index += 1) {
      const netCloudDelta = (afterSnapshot.cloudPathByBand?.[index] || 0) - (beforeSnapshot.cloudPathByBand?.[index] || 0);
      moduleLedger.netCloudDeltaByBandCell[index] += netCloudDelta;
      let accountedDelta = 0;

      if (moduleName === 'stepAdvection5') {
        const importedCloudEntering = Math.max(0, netCloudDelta);
        const advectiveExportLoss = Math.max(0, -netCloudDelta);
        addTransition('importedCloudEntering', index, importedCloudEntering);
        addTransition('advectiveExportLoss', index, advectiveExportLoss);
        accountedDelta = importedCloudEntering - advectiveExportLoss;
      } else if (moduleName === 'stepVertical5') {
        const importedCloudEntering = diffFieldAt(afterSnapshot.carryOverUpperCloudEnteringByBandMass, beforeSnapshot.carryOverUpperCloudEnteringByBandMass, index);
        const importedCloudSurvivingUnchanged = diffFieldAt(afterSnapshot.carryOverUpperCloudSurvivingByBandMass, beforeSnapshot.carryOverUpperCloudSurvivingByBandMass, index);
        const cloudErodedAway = diffFieldAt(afterSnapshot.upperCloudAppliedErosionByBandMass, beforeSnapshot.upperCloudAppliedErosionByBandMass, index);
        const cloudConvertedIntoLocalCondensationSupport =
          diffFieldAt(afterSnapshot.resolvedAscentCloudBirthByBandMass, beforeSnapshot.resolvedAscentCloudBirthByBandMass, index)
          + diffFieldAt(afterSnapshot.convectiveDetrainmentCloudBirthByBandMass, beforeSnapshot.convectiveDetrainmentCloudBirthByBandMass, index);
        addTransition('importedCloudEntering', index, importedCloudEntering);
        addTransition('importedCloudSurvivingUnchanged', index, importedCloudSurvivingUnchanged);
        addTransition('cloudErodedAway', index, cloudErodedAway);
        addTransition('cloudConvertedIntoLocalCondensationSupport', index, cloudConvertedIntoLocalCondensationSupport);
        accountedDelta = cloudConvertedIntoLocalCondensationSupport - cloudErodedAway;
      } else if (moduleName === 'stepMicrophysics5') {
        const cloudConvertedIntoLocalCondensationSupport = diffFieldAt(
          afterSnapshot.saturationAdjustmentCloudBirthByBandMass,
          beforeSnapshot.saturationAdjustmentCloudBirthByBandMass,
          index
        );
        const cloudConvertedIntoPrecipSupport = diffFieldAt(
          afterSnapshot.microphysicsCloudToPrecipByBandMass,
          beforeSnapshot.microphysicsCloudToPrecipByBandMass,
          index
        );
        const cloudLostToReevaporation = diffFieldAt(
          afterSnapshot.cloudReevaporationByBandMass,
          beforeSnapshot.cloudReevaporationByBandMass,
          index
        ) + diffFieldAt(
          afterSnapshot.precipReevaporationByBandMass,
          beforeSnapshot.precipReevaporationByBandMass,
          index
        );
        addTransition('cloudConvertedIntoLocalCondensationSupport', index, cloudConvertedIntoLocalCondensationSupport);
        addTransition('cloudConvertedIntoPrecipSupport', index, cloudConvertedIntoPrecipSupport);
        addTransition('cloudLostToReevaporation', index, cloudLostToReevaporation);
        accountedDelta = cloudConvertedIntoLocalCondensationSupport - cloudLostToReevaporation;
      } else if (moduleName === 'stepRadiation2D5') {
        const cell = index % this.state.N;
        const bandIndex = Math.floor(index / this.state.N);
        const sigmaWeight = bandIndex === 3 ? 1 : bandIndex === 2 ? 0.35 : bandIndex === 1 ? 0.1 : 0.05;
        const supportFrac = Math.max(0, Math.min(1, (this.state.upperCloudRadiativePersistenceSupportWm2?.[cell] || 0) / 80));
        const cloudKeptAliveByRadiativePersistence = Math.min(
          beforeSnapshot.cloudPathByBand?.[index] || 0,
          afterSnapshot.cloudPathByBand?.[index] || 0
        ) * supportFrac * sigmaWeight * (sampledDtSeconds / 86400);
        addTransition('cloudKeptAliveByRadiativePersistence', index, cloudKeptAliveByRadiativePersistence);
        accountedDelta = 0;
      }

      const residual = netCloudDelta - accountedDelta;
      addTransition('unattributedResidual', index, residual);
    }
  }

  _classifyTrackedPrecipRegime(latDeg, cellIndex) {
    const latAbs = Math.abs(latDeg);
    const convOrg = this.state.convectiveOrganization?.[cellIndex] || 0;
    const convMassFlux = this.state.convectiveMassFlux?.[cellIndex] || 0;
    const anvil = this.state.convectiveAnvilSource?.[cellIndex] || 0;
    const subsidence = this.state.subtropicalSubsidenceDrying?.[cellIndex] || 0;
    if (latAbs <= 12 && (convOrg >= 0.4 || convMassFlux >= 0.0045)) return 'deep_core_tropical';
    if (latAbs > 12 && latAbs <= 25 && (anvil >= 0.1 || convOrg >= 0.2 || convMassFlux >= 0.001)) {
      return 'tropical_transition_spillover';
    }
    if (latAbs >= 15 && latAbs <= 35 && convOrg < 0.35 && convMassFlux < 0.004 && subsidence < 0.08) {
      return 'marginal_subtropical';
    }
    return 'large_scale_other';
  }

  _accumulateClimateProcessBudget(moduleName, beforeSnapshot, sampledDtSeconds) {
    if (!this._climateProcessBudget || !beforeSnapshot?.bands) return;
    const afterSnapshot = this._captureClimateProcessBudgetSnapshot(moduleName === 'stepMicrophysics5');
    const moduleBudget = this._climateProcessBudget.modules[moduleName]
      || (this._climateProcessBudget.modules[moduleName] = createModuleBudgetAccumulator(moduleName));
    moduleBudget.callCount += 1;
    moduleBudget.sampledModelSeconds += sampledDtSeconds;

    for (const band of PROCESS_BUDGET_BANDS) {
      const beforeBand = beforeSnapshot.bands[band.key];
      const afterBand = afterSnapshot.bands[band.key];
      if (!beforeBand || !afterBand) continue;
      const acc = moduleBudget.bands[band.key];
      acc.surfaceVaporDeltaKgKg += afterBand.surfaceVaporKgKg - beforeBand.surfaceVaporKgKg;
      acc.upperVaporDeltaKgKg += afterBand.upperVaporKgKg - beforeBand.upperVaporKgKg;
      acc.surfaceCloudDeltaKgKg += afterBand.surfaceCloudKgKg - beforeBand.surfaceCloudKgKg;
      acc.upperCloudDeltaKgKg += afterBand.upperCloudKgKg - beforeBand.upperCloudKgKg;
      acc.surfacePrecipDeltaMm += afterBand.surfacePrecipMm - beforeBand.surfacePrecipMm;
      acc.convectiveOrganizationDelta += afterBand.convectiveOrganizationFrac - beforeBand.convectiveOrganizationFrac;
      acc.convectiveMassFluxDeltaKgM2S += afterBand.convectiveMassFluxKgM2S - beforeBand.convectiveMassFluxKgM2S;
      acc.detrainmentDeltaKgM2 += afterBand.detrainmentKgM2 - beforeBand.detrainmentKgM2;
      acc.anvilDeltaFrac += afterBand.anvilFrac - beforeBand.anvilFrac;
      acc.subtropicalSubsidenceDryingDeltaFrac += afterBand.subtropicalSubsidenceDryingFrac - beforeBand.subtropicalSubsidenceDryingFrac;
    }

    if (moduleName === 'stepMicrophysics5' && beforeSnapshot.precipAccumCell && afterSnapshot.precipAccumCell) {
      const { nx } = this.grid;
      for (let k = 0; k < this.state.N; k += 1) {
        const deltaPrecip = afterSnapshot.precipAccumCell[k] - beforeSnapshot.precipAccumCell[k];
        if (!(deltaPrecip > 0)) continue;
        const row = Math.floor(k / nx);
        const regime = this._classifyTrackedPrecipRegime(this.grid.latDeg[row], k);
        this._climateProcessBudget.precipitationRegimes[regime].surfacePrecipDeltaMm += deltaPrecip;
      }
    }
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
        this.state.seaIceFrac.set(climo.iceNow);
        for (let i = 0; i < this.state.seaIceThicknessM.length; i += 1) {
          this.state.seaIceThicknessM[i] = Math.max(0, this.state.seaIceFrac[i]) * 1.5;
        }
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
      if (climo?.windNowU && climo.windNowU.length === this.climo.windNowU.length) this.climo.windNowU.set(climo.windNowU);
      if (climo?.windNowV && climo.windNowV.length === this.climo.windNowV.length) this.climo.windNowV.set(climo.windNowV);
      if (climo?.wind500NowU && climo.wind500NowU.length === this.climo.wind500NowU.length) this.climo.wind500NowU.set(climo.wind500NowU);
      if (climo?.wind500NowV && climo.wind500NowV.length === this.climo.wind500NowV.length) this.climo.wind500NowV.set(climo.wind500NowV);
      if (climo?.wind250NowU && climo.wind250NowU.length === this.climo.wind250NowU.length) this.climo.wind250NowU.set(climo.wind250NowU);
      if (climo?.wind250NowV && climo.wind250NowV.length === this.climo.wind250NowV.length) this.climo.wind250NowV.set(climo.wind250NowV);
      if (climo?.q2mNow && climo.q2mNow.length === this.climo.q2mNow.length) this.climo.q2mNow.set(climo.q2mNow);
      if (climo?.q700Now && climo.q700Now.length === this.climo.q700Now.length) this.climo.q700Now.set(climo.q700Now);
      if (climo?.q250Now && climo.q250Now.length === this.climo.q250Now.length) this.climo.q250Now.set(climo.q250Now);
      if (climo?.t700Now && climo.t700Now.length === this.climo.t700Now.length) this.climo.t700Now.set(climo.t700Now);
      if (climo?.t250Now && climo.t250Now.length === this.climo.t250Now.length) this.climo.t250Now.set(climo.t250Now);
      this.climo.hasSlp = Boolean(climo?.hasSlp);
      this.climo.hasT2m = Boolean(climo?.hasT2m);
      this.climo.hasWind = Boolean(climo?.hasWind);
      this.climo.hasWind500 = Boolean(climo?.hasWind500);
      this.climo.hasWind250 = Boolean(climo?.hasWind250);
      this.climo.hasQ2m = Boolean(climo?.hasQ2m);
      this.climo.hasQ700 = Boolean(climo?.hasQ700);
      this.climo.hasQ250 = Boolean(climo?.hasQ250);
      this.climo.hasT700 = Boolean(climo?.hasT700);
      this.climo.hasT250 = Boolean(climo?.hasT250);

      this._climoUpdate = climo?.updateClimoNow || null;
      this._climoOut = {
        sstNow: this.state.sstNow,
        iceNow: this.geo.iceNow,
        slpNow: this.climo.slpNow,
        t2mNow: this.climo.t2mNow,
        windNowU: this.climo.windNowU,
        windNowV: this.climo.windNowV,
        wind500NowU: this.climo.wind500NowU,
        wind500NowV: this.climo.wind500NowV,
        wind250NowU: this.climo.wind250NowU,
        wind250NowV: this.climo.wind250NowV,
        q2mNow: this.climo.q2mNow,
        q700Now: this.climo.q700Now,
        q250Now: this.climo.q250Now,
        t700Now: this.climo.t700Now,
        t250Now: this.climo.t250Now
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
      this._seedInitializationMoistureTracer();
      this.ready = true;
    } catch (err) {
      console.warn('[WeatherCore5] Climo init failed; using defaults.', err);
      this.analysisInit = {
        source: 'error',
        reason: err?.message || String(err)
      };
      this._seedInitializationMoistureTracer();
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
    const shouldSampleClimateBudget = this._shouldSampleClimateProcessBudget();
    if (shouldSampleClimateBudget && this._climateProcessBudget) {
      this._climateProcessBudget.sampledModelSeconds += dt;
    }
    if (shouldSampleClimateBudget && this._cloudTransitionLedger) {
      this._cloudTransitionLedger.sampleCount += 1;
      this._cloudTransitionLedger.sampledModelSeconds += dt;
    }
    if (shouldSampleClimateBudget && this._conservationBudget) {
      this._conservationBudget.sampledModelSeconds += dt;
    }
    const runWithDiagnostics = (name, fn, { sampledDtSeconds = dt } = {}) => {
      const collectBudget = shouldSampleClimateBudget && PROCESS_BUDGET_MODULES.has(name);
      const collectCloudTransitionLedger = shouldSampleClimateBudget && CLOUD_TRANSITION_LEDGER_MODULES.has(name);
      const collectConservation = shouldSampleClimateBudget && CONSERVATION_SAMPLE_MODULES.has(name);
      const beforeLog = shouldLogModules ? logger.buildProcessSnapshot(this) : null;
      const beforeBudget = collectBudget ? this._captureClimateProcessBudgetSnapshot(name === 'stepMicrophysics5') : null;
      const beforeCloudTransition = collectCloudTransitionLedger ? this._captureCloudTransitionSnapshot(name) : null;
      const beforeConservation = collectConservation ? this._captureConservationSnapshot() : null;
      const replayDisabled = this._replayDisabledModules?.has(name);
      const startedAt = Date.now();
      if (!replayDisabled) {
        fn();
      }
      const elapsedMs = Date.now() - startedAt;
      this._recordModuleTiming(name, elapsedMs);
      if (shouldLogModules) {
        const after = logger.buildProcessSnapshot(this);
        logger.logProcessDelta(logContext, this, name, beforeLog, after);
      }
      if (collectBudget) {
        this._accumulateClimateProcessBudget(name, beforeBudget, sampledDtSeconds);
      }
      if (collectCloudTransitionLedger) {
        this._accumulateCloudTransitionLedger(name, beforeCloudTransition, this._captureCloudTransitionSnapshot(name), sampledDtSeconds);
      }
      if (collectConservation) {
        this._accumulateConservationBudget(name, beforeConservation, sampledDtSeconds);
      }
    };
    const lodActive = this.lodParams?.enable && this.simSpeed > this.lodParams.simSpeedThreshold;
    const microEvery = Math.max(1, Number(this.lodParams?.microphysicsEvery) || 1);
    const radEvery = Math.max(1, Number(this.lodParams?.radiationEvery) || 1);
    const doRadiation = !lodActive || (this._dynStepIndex % radEvery === 0);
    const doMicrophysics = !lodActive || (this._dynStepIndex % microEvery === 0);

    runWithDiagnostics('updateHydrostatic', () => this._updateHydrostatic());
    runWithDiagnostics('stepSurface2D5', () => {
      stepSurface2D5({
        dt,
        grid: this.grid,
        state: this.state,
        climo: this.climo,
        geo: this.geo,
        params: this.surfaceParams
      });
    });
    runWithDiagnostics('updateHydrostatic', () => this._updateHydrostatic());
    if (doRadiation) {
      runWithDiagnostics('stepRadiation2D5', () => {
        stepRadiation2D5({
          dt,
          grid: this.grid,
          state: this.state,
          timeUTC: this.timeUTC,
          params: this.radParams
        });
      });
    }
    runWithDiagnostics('updateHydrostatic', () => this._updateHydrostatic());
    let windDynamicsDiagnostics = null;
    runWithDiagnostics('stepWinds5', () => {
      this.dynParams.stepIndex = this._dynStepIndex;
      windDynamicsDiagnostics = stepWinds5({
        dt,
        grid: this.grid,
        state: this.state,
        geo: this.geo,
        params: {
          ...this.dynParams,
          diagnosticsLevel: this.verticalLayout?.upperTroposphere ?? null,
          collectDiagnostics: shouldLogModules
        },
        scratch: this._dynScratch
      });
    });
    if (shouldLogModules && windDynamicsDiagnostics) {
      logger.recordEvent('windDynamicsDiagnostics', logContext, this, windDynamicsDiagnostics);
    }
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
      climo: this.climo,
      params: {
        ...this.windNudgeParams,
        tauSurfaceSeconds: tauSurfaceEff,
        tauUpperSeconds: tauUpperEff,
        tauVSeconds: tauVEff,
        maxUpperSpeed: this.dynParams?.maxWind ?? null
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
            source: windNudgeResult.source ?? null,
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
        climo: this.climo,
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
    runWithDiagnostics('stepSurfacePressure5', () => {
      stepSurfacePressure5({
        dt,
        grid: this.grid,
        state: this.state,
        params: this.massParams,
        scratch: this._dynScratch
      });
    });
    runWithDiagnostics('stepAdvection5', () => {
      this.advectParams.stepIndex = this._dynStepIndex;
      stepAdvection5({
        dt,
        grid: this.grid,
        state: this.state,
        params: this.advectParams,
        scratch: this._dynScratch
      });
    });
    runWithDiagnostics('stepVertical5', () => {
      stepVertical5({
        dt,
        grid: this.grid,
        state: this.state,
        geo: this.geo,
        params: this.vertParams,
        scratch: this._dynScratch
      });
      this._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
    });
    runWithDiagnostics('updateHydrostatic', () => this._updateHydrostatic());
    if (typeof this.vertParams?.enableConvectiveOutcome === 'boolean') {
      this.microParams.enableConvectiveOutcome = this.vertParams.enableConvectiveOutcome;
    }
    if (doMicrophysics) {
      runWithDiagnostics('stepMicrophysics5', () => {
        stepMicrophysics5({ dt, state: this.state, params: this.microParams });
        this._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
      });
    }
    runWithDiagnostics('updateHydrostatic', () => this._updateHydrostatic());
    this._nudgeAccumSeconds += dt;
    if (this.nudgeParams.enable && this._nudgeAccumSeconds >= this.nudgeParams.cadenceSeconds) {
      const dtNudge = this._nudgeAccumSeconds;
      this._nudgeAccumSeconds = 0;
      runWithDiagnostics('stepNudging5', () => {
      Object.assign(this._nudgeParamsRuntime, this.nudgeParams);
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
      this._closeSurfaceSourceTracerBudget('qvSourceNudgingInjection');
      }, { sampledDtSeconds: dtNudge });
      runWithDiagnostics('updateHydrostatic', () => this._updateHydrostatic());
    }
    let analysisIncrementResult = null;
    runWithDiagnostics('stepAnalysisIncrement5', () => {
      analysisIncrementResult = stepAnalysisIncrement5({
        dt,
        state: this.state,
        grid: this.grid,
        params: {
          ...this.analysisIncrementParams,
          psMin: this.massParams?.psMin,
          psMax: this.massParams?.psMax
        }
      });
      if (analysisIncrementResult?.didApply) {
        this._closeSurfaceSourceTracerBudget('qvSourceAnalysisInjection');
      }
    });
    if (analysisIncrementResult?.didApply) {
      runWithDiagnostics('updateHydrostatic', () => this._updateHydrostatic());
      if (shouldLogModules) {
        logger.recordEvent(
          'analysisIncrementDiagnostics',
          logContext,
          this,
          {
            updatedCount: analysisIncrementResult.updatedCount ?? null,
            meanAbsDelta: analysisIncrementResult.meanAbsDelta ?? null,
            maxAbsDelta: analysisIncrementResult.maxAbsDelta ?? null,
            remainingSeconds: analysisIncrementResult.remainingSeconds ?? null
          }
        );
      }
    }
    runWithDiagnostics('updateDiagnostics2D5', () => {
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
