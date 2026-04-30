#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildValidationDiagnostics } from '../../src/weather/validation/diagnostics.js';
import { classifyNhDryBeltSector } from '../../src/weather/v2/sourceTracing5.js';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { advanceModelSecondsFully } from './advance-fully.mjs';
import { _test as planetaryAuditTest } from './planetary-realism-audit.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_REPORT_BASE = path.join(repoRoot, 'weather-validation', 'output', 'phase-e0-minimal-corridor');
const DEFAULT_HISTORICAL_COMMIT = 'e6fea58';
const DEFAULT_HISTORICAL_ROOT = '/tmp/sw-phase1-e6';
const DEFAULT_SECTOR_KEY = 'eastPacific';
const DEFAULT_LAT0 = 22;
const DEFAULT_LAT1 = 35;
const DEFAULT_TARGET_DAY = 30;
const DEFAULT_WINDOW_STEPS = 12;
const DEFAULT_GRID = { nx: 48, ny: 24 };
const DEFAULT_DT_SECONDS = 1800;
const DEFAULT_SEED = 12345;

const argv = process.argv.slice(2);
let reportBase = DEFAULT_REPORT_BASE;
let historicalCommit = DEFAULT_HISTORICAL_COMMIT;
let historicalRoot = DEFAULT_HISTORICAL_ROOT;
let targetDay = DEFAULT_TARGET_DAY;
let windowSteps = DEFAULT_WINDOW_STEPS;
let nx = DEFAULT_GRID.nx;
let ny = DEFAULT_GRID.ny;
let dtSeconds = DEFAULT_DT_SECONDS;
let seed = DEFAULT_SEED;
let sectorKey = DEFAULT_SECTOR_KEY;
let lat0 = DEFAULT_LAT0;
let lat1 = DEFAULT_LAT1;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--historical-commit' && argv[i + 1]) historicalCommit = argv[++i];
  else if (arg.startsWith('--historical-commit=')) historicalCommit = arg.slice('--historical-commit='.length);
  else if (arg === '--historical-root' && argv[i + 1]) historicalRoot = path.resolve(argv[++i]);
  else if (arg.startsWith('--historical-root=')) historicalRoot = path.resolve(arg.slice('--historical-root='.length));
  else if (arg === '--target-day' && argv[i + 1]) targetDay = Number.parseFloat(argv[++i]);
  else if (arg.startsWith('--target-day=')) targetDay = Number.parseFloat(arg.slice('--target-day='.length));
  else if (arg === '--window-steps' && argv[i + 1]) windowSteps = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--window-steps=')) windowSteps = Number.parseInt(arg.slice('--window-steps='.length), 10);
  else if (arg === '--grid' && argv[i + 1]) {
    const [nxRaw, nyRaw] = argv[++i].toLowerCase().split('x');
    nx = Number.parseInt(nxRaw, 10);
    ny = Number.parseInt(nyRaw, 10);
  } else if (arg.startsWith('--grid=')) {
    const [nxRaw, nyRaw] = arg.slice('--grid='.length).toLowerCase().split('x');
    nx = Number.parseInt(nxRaw, 10);
    ny = Number.parseInt(nyRaw, 10);
  } else if (arg === '--dt' && argv[i + 1]) dtSeconds = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--dt=')) dtSeconds = Number.parseInt(arg.slice('--dt='.length), 10);
  else if (arg === '--seed' && argv[i + 1]) seed = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--seed=')) seed = Number.parseInt(arg.slice('--seed='.length), 10);
  else if (arg === '--sector' && argv[i + 1]) sectorKey = argv[++i];
  else if (arg.startsWith('--sector=')) sectorKey = arg.slice('--sector='.length);
  else if (arg === '--lat-band' && argv[i + 1]) {
    const [lat0Raw, lat1Raw] = argv[++i].split(':');
    lat0 = Number.parseFloat(lat0Raw);
    lat1 = Number.parseFloat(lat1Raw);
  } else if (arg.startsWith('--lat-band=')) {
    const [lat0Raw, lat1Raw] = arg.slice('--lat-band='.length).split(':');
    lat0 = Number.parseFloat(lat0Raw);
    lat1 = Number.parseFloat(lat1Raw);
  }
}

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const mean = (values) => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
};
const sum = (values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0);
const metricAt = (arr, idx) => Array.isArray(arr) && idx >= 0 && idx < arr.length ? Number(arr[idx]) || 0 : 0;

const VERTICAL_FIELDS = [
  'upperCloudPathKgM2',
  'carriedOverUpperCloudMassKgM2',
  'weakErosionCloudSurvivalMassKgM2',
  'largeScaleCondensationSourceKgM2',
  'resolvedAscentCloudBirthPotentialKgM2',
  'importedAnvilPersistenceMassKgM2',
  'convectiveOrganizationFrac',
  'convectiveMassFluxKgM2S',
  'lowerTroposphericRhFrac',
  'precipRateMmHr',
  'totalColumnWaterKgM2',
  'subtropicalSubsidenceDryingFrac'
];

const suppressProcessOutput = async (fn) => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWrite = process?.stderr?.write ? process.stderr.write.bind(process.stderr) : null;
  console.log = () => {};
  console.error = () => {};
  if (process?.stderr?.write) {
    process.stderr.write = () => true;
  }
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    if (originalWrite) {
      process.stderr.write = originalWrite;
    }
  }
};

const ensureHistoricalWorktree = ({ root, commit }) => {
  if (fs.existsSync(path.join(root, '.git'))) return root;
  fs.mkdirSync(path.dirname(root), { recursive: true });
  execSync(`git worktree add --detach ${JSON.stringify(root)} ${JSON.stringify(commit)}`, {
    cwd: repoRoot,
    stdio: 'pipe'
  });
  return root;
};

const importBaselineModules = async (root) => {
  const importFromRoot = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
  const [
    coreModule,
    surfaceModule,
    radiationModule,
    windsModule,
    windNudgeModule,
    windEddyModule,
    pressureModule,
    advectionModule,
    verticalModule,
    microModule
  ] = await Promise.all([
    importFromRoot('src/weather/v2/core5.js'),
    importFromRoot('src/weather/v2/surface2d.js'),
    importFromRoot('src/weather/v2/radiation2d.js'),
    importFromRoot('src/weather/v2/dynamics5.js'),
    importFromRoot('src/weather/v2/windNudge5.js'),
    importFromRoot('src/weather/v2/windEddyNudge5.js'),
    importFromRoot('src/weather/v2/mass5.js'),
    importFromRoot('src/weather/v2/advect5.js'),
    importFromRoot('src/weather/v2/vertical5.js'),
    importFromRoot('src/weather/v2/microphysics5.js')
  ]);
  return {
    root,
    WeatherCore5: coreModule.WeatherCore5,
    stepSurface2D5: surfaceModule.stepSurface2D5,
    stepRadiation2D5: radiationModule.stepRadiation2D5,
    stepWinds5: windsModule.stepWinds5,
    stepWindNudge5: windNudgeModule.stepWindNudge5,
    stepWindEddyNudge5: windEddyModule.stepWindEddyNudge5,
    stepSurfacePressure5: pressureModule.stepSurfacePressure5,
    stepAdvection5: advectionModule.stepAdvection5,
    stepVertical5: verticalModule.stepVertical5,
    stepMicrophysics5: microModule.stepMicrophysics5
  };
};

const copyTypedArrays = (target, source) => {
  for (const [key, value] of Object.entries(source || {})) {
    const targetValue = target?.[key];
    if (
      (value instanceof Float32Array || value instanceof Uint8Array || value instanceof Uint16Array)
      && targetValue
      && targetValue.constructor === value.constructor
      && targetValue.length === value.length
    ) {
      targetValue.set(value);
    }
  }
};

const copyPlainObjects = (target, source) => {
  if (!target || !source) return;
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
      if (target[key] && typeof target[key] === 'object' && !ArrayBuffer.isView(target[key])) {
        Object.assign(target[key], value);
      }
    }
  }
};

const copyScalarFields = (target, source) => {
  if (!target || !source) return;
  for (const [key, value] of Object.entries(source)) {
    if (
      value == null
      || typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
    ) {
      target[key] = value;
    }
  }
};

const cloneCoreFromSource = async (modules, sourceCore) => suppressProcessOutput(async () => {
  const clone = new modules.WeatherCore5({
    nx: sourceCore.grid.nx,
    ny: sourceCore.grid.ny,
    dt: sourceCore.modelDt,
    seed: sourceCore.seed
  });
  await clone._initPromise;
  copyTypedArrays(clone.geo, sourceCore.geo);
  copyTypedArrays(clone.climo, sourceCore.climo);
  copyTypedArrays(clone.state, sourceCore.state);
  copyScalarFields(clone.geo, sourceCore.geo);
  copyScalarFields(clone.climo, sourceCore.climo);
  copyPlainObjects(clone.surfaceParams, sourceCore.surfaceParams);
  copyPlainObjects(clone.advectParams, sourceCore.advectParams);
  copyPlainObjects(clone.vertParams, sourceCore.vertParams);
  copyPlainObjects(clone.microParams, sourceCore.microParams);
  copyPlainObjects(clone.nudgeParams, sourceCore.nudgeParams);
  copyPlainObjects(clone.windNudgeParams, sourceCore.windNudgeParams);
  copyPlainObjects(clone.windEddyParams, sourceCore.windEddyParams);
  copyPlainObjects(clone.windNudgeSpinupParams, sourceCore.windNudgeSpinupParams);
  copyPlainObjects(clone.dynParams, sourceCore.dynParams);
  copyPlainObjects(clone.massParams, sourceCore.massParams);
  copyPlainObjects(clone.radParams, sourceCore.radParams);
  copyPlainObjects(clone.analysisIncrementParams, sourceCore.analysisIncrementParams);
  copyPlainObjects(clone.diagParams, sourceCore.diagParams);
  copyPlainObjects(clone.lodParams, sourceCore.lodParams);
  clone.timeUTC = sourceCore.timeUTC;
  clone._accum = sourceCore._accum;
  clone._dynStepIndex = sourceCore._dynStepIndex;
  clone._nudgeAccumSeconds = sourceCore._nudgeAccumSeconds;
  clone._climoAccumSeconds = sourceCore._climoAccumSeconds;
  clone._windNudgeSpinupSeconds = sourceCore._windNudgeSpinupSeconds;
  clone._metricsCounter = sourceCore._metricsCounter || 0;
  clone._nextModuleLogSimTime = sourceCore._nextModuleLogSimTime ?? null;
  clone._windNudgeMaxAbsCorrection = sourceCore._windNudgeMaxAbsCorrection || 0;
  clone.simSpeed = sourceCore.simSpeed;
  if (typeof clone.setInstrumentationMode === 'function' && typeof sourceCore.getInstrumentationMode === 'function') {
    clone.setInstrumentationMode(sourceCore.getInstrumentationMode());
  }
  if (clone._climoUpdateArgs) {
    clone._climoUpdateArgs.timeUTC = clone.timeUTC;
  }
  if (typeof clone._updateHydrostatic === 'function') {
    clone._updateHydrostatic();
  }
  return clone;
});

const createBaselineCore = async (modules) => suppressProcessOutput(async () => {
  const core = new modules.WeatherCore5({ nx, ny, dt: dtSeconds, seed });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  return core;
});

const advanceSilently = async (core, modelSeconds) => suppressProcessOutput(async () => {
  advanceModelSecondsFully(core, modelSeconds);
});

const buildCorridorMask = (core, { sector, latMin, latMax }) => {
  const indices = [];
  const { nx: gridNx, ny: gridNy, latDeg, lonDeg } = core.grid;
  const landMask = core.state.landMask;
  for (let j = 0; j < gridNy; j += 1) {
    const lat = latDeg[j];
    if (lat < latMin || lat > latMax) continue;
    const row = j * gridNx;
    for (let i = 0; i < gridNx; i += 1) {
      const idx = row + i;
      const isLand = landMask?.[idx] === 1;
      if (classifyNhDryBeltSector({ lonDeg: lonDeg[i], isLand }) === sector) {
        indices.push(idx);
      }
    }
  }
  return indices;
};

const selectCorridorTarget = (diagnostics, core, corridorIndices) => {
  let best = null;
  for (const idx of corridorIndices) {
    const upperCloud = metricAt(diagnostics.upperCloudPathKgM2, idx);
    const carry = metricAt(diagnostics.carriedOverUpperCloudMassKgM2, idx);
    const weakErosion = metricAt(diagnostics.weakErosionCloudSurvivalMassKgM2, idx);
    const largeScale = metricAt(diagnostics.largeScaleCondensationSourceKgM2, idx);
    const score = upperCloud + (0.9 * carry) + (0.7 * weakErosion) + (0.5 * largeScale);
    if (!best || score > best.score) {
      const rowIndex = Math.floor(idx / core.grid.nx);
      const colIndex = idx % core.grid.nx;
      best = {
        cellIndex: idx,
        rowIndex,
        colIndex,
        latDeg: round(core.grid.latDeg[rowIndex], 5),
        lonDeg: round(core.grid.lonDeg[colIndex], 5),
        sectorKey,
        score: round(score, 5)
      };
    }
  }
  return best;
};

const meanForIndices = (arr, indices) => round(mean(indices.map((idx) => metricAt(arr, idx))), 5);

const extractSliceFromDiagnostics = (diagnostics, targetCell, corridorIndices) => {
  const cell = {};
  const corridor = {};
  for (const fieldName of VERTICAL_FIELDS) {
    cell[fieldName] = round(metricAt(diagnostics[fieldName], targetCell.cellIndex), 5);
    corridor[fieldName] = meanForIndices(diagnostics[fieldName], corridorIndices);
  }
  return {
    simTimeSeconds: diagnostics.simTimeSeconds,
    targetCell: cell,
    corridorBand: corridor
  };
};

const computeStepCadence = (core) => {
  const lodActive = core.lodParams?.enable && core.simSpeed > core.lodParams.simSpeedThreshold;
  const microEvery = Math.max(1, Number(core.lodParams?.microphysicsEvery) || 1);
  const radEvery = Math.max(1, Number(core.lodParams?.radiationEvery) || 1);
  return {
    doRadiation: !lodActive || (core._dynStepIndex % radEvery === 0),
    doMicrophysics: !lodActive || (core._dynStepIndex % microEvery === 0)
  };
};

const runPreVerticalSequence = (core, modules, dt) => {
  const { doRadiation } = computeStepCadence(core);
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  modules.stepSurface2D5({
    dt,
    grid: core.grid,
    state: core.state,
    climo: core.climo,
    geo: core.geo,
    params: core.surfaceParams
  });
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  if (doRadiation) {
    modules.stepRadiation2D5({
      dt,
      grid: core.grid,
      state: core.state,
      timeUTC: core.timeUTC,
      params: core.radParams
    });
  }
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  core.dynParams.stepIndex = core._dynStepIndex;
  modules.stepWinds5({
    dt,
    grid: core.grid,
    state: core.state,
    geo: core.geo,
    params: {
      ...core.dynParams,
      diagnosticsLevel: core.verticalLayout?.upperTroposphere ?? null,
      collectDiagnostics: false
    },
    scratch: core._dynScratch
  });
  const spinupParams = core.windNudgeSpinupParams;
  if (spinupParams?.enable) {
    const durationSeconds = Number.isFinite(spinupParams.durationSeconds)
      ? spinupParams.durationSeconds
      : 0;
    core._windNudgeSpinupSeconds = Math.min(
      core._windNudgeSpinupSeconds + dt,
      durationSeconds > 0 ? durationSeconds : core._windNudgeSpinupSeconds + dt
    );
  }
  const dur = Number.isFinite(spinupParams?.durationSeconds) ? spinupParams.durationSeconds : 0;
  const r01 = dur > 0 ? Math.min(1, core._windNudgeSpinupSeconds / dur) : 1;
  const r = r01 * r01 * (3 - 2 * r01);
  const lerp = (a, b, t) => a + (b - a) * t;
  const tauSurfaceEff = lerp(
    spinupParams?.tauSurfaceStartSeconds ?? core.windNudgeParams.tauSurfaceSeconds,
    core.windNudgeParams.tauSurfaceSeconds,
    r
  );
  const tauUpperEff = lerp(
    spinupParams?.tauUpperStartSeconds ?? core.windNudgeParams.tauUpperSeconds,
    core.windNudgeParams.tauUpperSeconds,
    r
  );
  const tauVEff = lerp(
    spinupParams?.tauVStartSeconds ?? core.windNudgeParams.tauVSeconds,
    core.windNudgeParams.tauVSeconds,
    r
  );
  modules.stepWindNudge5({
    dt,
    grid: core.grid,
    state: core.state,
    climo: core.climo,
    params: {
      ...core.windNudgeParams,
      tauSurfaceSeconds: tauSurfaceEff,
      tauUpperSeconds: tauUpperEff,
      tauVSeconds: tauVEff,
      maxUpperSpeed: core.dynParams?.maxWind ?? null
    }
  });
  if (core.windEddyParams?.enable) {
    modules.stepWindEddyNudge5({
      dt,
      grid: core.grid,
      state: core.state,
      climo: core.climo,
      params: core.windEddyParams
    });
  }
  modules.stepSurfacePressure5({
    dt,
    grid: core.grid,
    state: core.state,
    params: core.massParams,
    scratch: core._dynScratch
  });
  core.advectParams.stepIndex = core._dynStepIndex;
  modules.stepAdvection5({
    dt,
    grid: core.grid,
    state: core.state,
    params: core.advectParams,
    scratch: core._dynScratch
  });
};

const runVerticalReplayStep = async ({ actualCore, modules, targetCell, corridorIndices }) => {
  return suppressProcessOutput(async () => {
    const beforeFullStep = buildValidationDiagnostics(actualCore);
    const clone = await cloneCoreFromSource(modules, actualCore);
    runPreVerticalSequence(clone, modules, actualCore.modelDt);
    const preVertical = buildValidationDiagnostics(clone);
    modules.stepVertical5({
      dt: clone.modelDt,
      grid: clone.grid,
      state: clone.state,
      geo: clone.geo,
      params: clone.vertParams,
      scratch: clone._dynScratch
    });
    if (typeof clone._closeSurfaceSourceTracerBudget === 'function') {
      clone._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
    }
    const postVertical = buildValidationDiagnostics(clone);
    if (typeof clone._updateHydrostatic === 'function') clone._updateHydrostatic();
    const { doMicrophysics } = computeStepCadence(clone);
    if (typeof clone.vertParams?.enableConvectiveOutcome === 'boolean') {
      clone.microParams.enableConvectiveOutcome = clone.vertParams.enableConvectiveOutcome;
    }
    if (doMicrophysics) {
      modules.stepMicrophysics5({ dt: clone.modelDt, state: clone.state, params: clone.microParams });
      if (typeof clone._closeSurfaceSourceTracerBudget === 'function') {
        clone._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
      }
    }
    const postMicrophysics = buildValidationDiagnostics(clone);
    actualCore._stepOnce(actualCore.modelDt);
    const afterFullStep = buildValidationDiagnostics(actualCore);

    const preVerticalSlice = extractSliceFromDiagnostics(preVertical, targetCell, corridorIndices);
    const postVerticalSlice = extractSliceFromDiagnostics(postVertical, targetCell, corridorIndices);
    const postMicrophysicsSlice = extractSliceFromDiagnostics(postMicrophysics, targetCell, corridorIndices);

    return {
      dynStepIndex: actualCore._dynStepIndex - 1,
      beforeFullStep: extractSliceFromDiagnostics(beforeFullStep, targetCell, corridorIndices),
      preVertical: preVerticalSlice,
      postVertical: postVerticalSlice,
      postMicrophysics: postMicrophysicsSlice,
      afterFullStep: extractSliceFromDiagnostics(afterFullStep, targetCell, corridorIndices),
      verticalProxies: {
        cloudInKgM2: preVerticalSlice.targetCell.upperCloudPathKgM2,
        cloudBornProxyKgM2: round(Math.max(0, postVerticalSlice.targetCell.upperCloudPathKgM2 - preVerticalSlice.targetCell.upperCloudPathKgM2), 5),
        cloudCarriedProxyKgM2: postVerticalSlice.targetCell.carriedOverUpperCloudMassKgM2,
        cloudErodedProxyKgM2: round(Math.max(0, preVerticalSlice.targetCell.carriedOverUpperCloudMassKgM2 - postVerticalSlice.targetCell.carriedOverUpperCloudMassKgM2), 5),
        cloudHandedToMicrophysicsKgM2: postVerticalSlice.targetCell.upperCloudPathKgM2,
        cloudLeftAfterMicrophysicsKgM2: postMicrophysicsSlice.targetCell.upperCloudPathKgM2,
        microphysicsCloudRemovalProxyKgM2: round(Math.max(0, postVerticalSlice.targetCell.upperCloudPathKgM2 - postMicrophysicsSlice.targetCell.upperCloudPathKgM2), 5)
      }
    };
  });
};

const compareSlices = (currentSlice, historicalSlice) => {
  const fields = [
    'upperCloudPathKgM2',
    'carriedOverUpperCloudMassKgM2',
    'weakErosionCloudSurvivalMassKgM2',
    'largeScaleCondensationSourceKgM2',
    'resolvedAscentCloudBirthPotentialKgM2',
    'precipRateMmHr'
  ];
  return fields.map((field) => ({
    field,
    delta: round((currentSlice?.targetCell?.[field] || 0) - (historicalSlice?.targetCell?.[field] || 0), 5),
    absDelta: round(Math.abs((currentSlice?.targetCell?.[field] || 0) - (historicalSlice?.targetCell?.[field] || 0)), 5)
  })).sort((a, b) => (b.absDelta || 0) - (a.absDelta || 0));
};

export const buildBaselineFreezeReport = ({
  currentBaseline,
  historicalBaseline,
  corridorTarget,
  corridorDefinition,
  checkpointDay,
  targetDayValue,
  windowStepsValue
}) => ({
  schema: 'satellite-wars.phase-e0-baseline-freeze.v1',
  generatedAt: new Date().toISOString(),
  corridorDefinition,
  corridorTarget,
  checkpointDay,
  targetDay: targetDayValue,
  windowSteps: windowStepsValue,
  baselines: {
    current: currentBaseline,
    historical: historicalBaseline
  }
});

export const buildMinimalFailingCorridorSummary = ({
  currentTrace,
  historicalTrace,
  corridorTarget,
  corridorDefinition
}) => {
  const steps = [];
  for (let i = 0; i < Math.min(currentTrace.length, historicalTrace.length); i += 1) {
    const currentStep = currentTrace[i];
    const historicalStep = historicalTrace[i];
    const ranked = compareSlices(currentStep.postVertical, historicalStep.postVertical);
    const divergenceScore = round(sum(ranked.slice(0, 3).map((entry) => entry.absDelta || 0)), 5);
    steps.push({
      stepOffset: i,
      simTimeSeconds: currentStep.postVertical.simTimeSeconds,
      divergenceScore,
      topDeltas: ranked.slice(0, 3)
    });
  }
  const firstMaterialStep = steps.find((entry) => (entry.divergenceScore || 0) >= 0.05) || steps[0] || null;
  const peakStep = steps.reduce((best, entry) => (!best || (entry.divergenceScore || 0) > (best.divergenceScore || 0) ? entry : best), null);
  const rootCauseAssessment = {
    ruledIn: [],
    ruledOut: [],
    ambiguous: []
  };
  if (firstMaterialStep?.topDeltas?.length) {
    rootCauseAssessment.ruledIn.push(
      `The first material divergence appears in the minimal corridor window at step offset ${firstMaterialStep.stepOffset}, led by ${firstMaterialStep.topDeltas[0].field}.`
    );
  }
  if (peakStep?.topDeltas?.length) {
    rootCauseAssessment.ruledIn.push(
      `The strongest vertical-path divergence in the window is ${peakStep.topDeltas[0].field} at step offset ${peakStep.stepOffset}.`
    );
  }
  rootCauseAssessment.ambiguous.push('Phase E0 isolates the failing corridor and divergence timing, but it does not yet close the vertical budget by channel.');
  return {
    schema: 'satellite-wars.phase-e0-minimal-corridor-summary.v1',
    generatedAt: new Date().toISOString(),
    corridorDefinition,
    corridorTarget,
    firstMaterialStep,
    peakStep,
    steps,
    rootCauseAssessment
  };
};

const renderMarkdown = ({ freezeReport, summary }) => {
  const lines = [];
  lines.push('# Phase E0 Minimal Failing Corridor');
  lines.push('');
  lines.push(`- Target day: ${freezeReport.targetDay}`);
  lines.push(`- Checkpoint day: ${freezeReport.checkpointDay}`);
  lines.push(`- Window steps: ${freezeReport.windowSteps}`);
  lines.push(`- Corridor: ${freezeReport.corridorDefinition.sectorKey} ${freezeReport.corridorDefinition.latBandDeg[0]}-${freezeReport.corridorDefinition.latBandDeg[1]} deg`);
  lines.push(`- Target cell: ${freezeReport.corridorTarget.cellIndex} (lat ${freezeReport.corridorTarget.latDeg}, lon ${freezeReport.corridorTarget.lonDeg})`);
  lines.push('');
  lines.push('## Frozen baselines');
  lines.push('');
  lines.push(`- Historical commit: ${freezeReport.baselines.historical.commit}`);
  lines.push(`- Current commit: ${freezeReport.baselines.current.commit}`);
  lines.push(`- Historical dry ratio: ${freezeReport.baselines.historical.metrics.subtropicalDryNorthRatio}`);
  lines.push(`- Current dry ratio: ${freezeReport.baselines.current.metrics.subtropicalDryNorthRatio}`);
  lines.push('');
  lines.push('## Divergence summary');
  lines.push('');
  if (summary.firstMaterialStep) {
    lines.push(`- First material divergence step: ${summary.firstMaterialStep.stepOffset}`);
    lines.push(`- First material divergence score: ${summary.firstMaterialStep.divergenceScore}`);
    lines.push(`- Leading first-step delta: ${summary.firstMaterialStep.topDeltas?.[0]?.field} (${summary.firstMaterialStep.topDeltas?.[0]?.delta})`);
  }
  if (summary.peakStep) {
    lines.push(`- Peak divergence step: ${summary.peakStep.stepOffset}`);
    lines.push(`- Peak divergence score: ${summary.peakStep.divergenceScore}`);
    lines.push(`- Leading peak-step delta: ${summary.peakStep.topDeltas?.[0]?.field} (${summary.peakStep.topDeltas?.[0]?.delta})`);
  }
  lines.push('');
  return lines.join('\n');
};

const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const runExperiment = async () => {
  ensureHistoricalWorktree({ root: historicalRoot, commit: historicalCommit });
  const currentModules = await importBaselineModules(repoRoot);
  const historicalModules = await importBaselineModules(historicalRoot);

  const currentSelectionCore = await createBaselineCore(currentModules);
  await advanceSilently(currentSelectionCore, targetDay * 86400);
  const currentTargetDiagnostics = buildValidationDiagnostics(currentSelectionCore);
  const corridorIndices = buildCorridorMask(currentSelectionCore, { sector: sectorKey, latMin: lat0, latMax: lat1 });
  const corridorTarget = selectCorridorTarget(currentTargetDiagnostics, currentSelectionCore, corridorIndices);
  if (!corridorTarget) {
    throw new Error(`No corridor target found for sector ${sectorKey} and latitude band ${lat0}:${lat1}.`);
  }

  const checkpointDay = targetDay - ((windowSteps * dtSeconds) / 86400);

  const currentCore = await createBaselineCore(currentModules);
  const historicalCore = await createBaselineCore(historicalModules);
  await advanceSilently(currentCore, checkpointDay * 86400);
  await advanceSilently(historicalCore, checkpointDay * 86400);

  const currentTrace = [];
  const historicalTrace = [];
  for (let step = 0; step < windowSteps; step += 1) {
    currentTrace.push(await runVerticalReplayStep({
      actualCore: currentCore,
      modules: currentModules,
      targetCell: corridorTarget,
      corridorIndices
    }));
    historicalTrace.push(await runVerticalReplayStep({
      actualCore: historicalCore,
      modules: historicalModules,
      targetCell: corridorTarget,
      corridorIndices
    }));
  }

  const currentFinal = buildValidationDiagnostics(currentCore);
  const historicalFinal = buildValidationDiagnostics(historicalCore);
  const currentFinalSummary = planetaryAuditTest.classifySnapshot(currentFinal, targetDay);
  const historicalFinalSummary = planetaryAuditTest.classifySnapshot(historicalFinal, targetDay);
  const corridorDefinition = {
    sectorKey,
    latBandDeg: [lat0, lat1],
    grid: { nx, ny, dtSeconds }
  };

  const freezeReport = buildBaselineFreezeReport({
    currentBaseline: {
      commit: commitAtRoot(repoRoot),
      root: repoRoot,
      metrics: {
        subtropicalDryNorthRatio: round(currentFinalSummary.metrics?.subtropicalDryNorthRatio, 5),
        itczWidthDeg: round(currentFinalSummary.metrics?.itczWidthDeg, 5),
        targetCellUpperCloudPathKgM2: round(metricAt(currentFinal.upperCloudPathKgM2, corridorTarget.cellIndex), 5),
        targetCellLargeScaleCondensationKgM2: round(metricAt(currentFinal.largeScaleCondensationSourceKgM2, corridorTarget.cellIndex), 5)
      }
    },
    historicalBaseline: {
      commit: commitAtRoot(historicalRoot),
      root: historicalRoot,
      metrics: {
        subtropicalDryNorthRatio: round(historicalFinalSummary.metrics?.subtropicalDryNorthRatio, 5),
        itczWidthDeg: round(historicalFinalSummary.metrics?.itczWidthDeg, 5),
        targetCellUpperCloudPathKgM2: round(metricAt(historicalFinal.upperCloudPathKgM2, corridorTarget.cellIndex), 5),
        targetCellLargeScaleCondensationKgM2: round(metricAt(historicalFinal.largeScaleCondensationSourceKgM2, corridorTarget.cellIndex), 5)
      }
    },
    corridorTarget,
    corridorDefinition,
    checkpointDay: round(checkpointDay, 5),
    targetDayValue: targetDay,
    windowStepsValue: windowSteps
  });

  const summary = buildMinimalFailingCorridorSummary({
    currentTrace,
    historicalTrace,
    corridorTarget,
    corridorDefinition
  });

  const output = {
    schema: 'satellite-wars.phase-e0-minimal-corridor.v1',
    generatedAt: new Date().toISOString(),
    freezeReport,
    summary,
    traces: {
      current: currentTrace,
      historical: historicalTrace
    }
  };
  return output;
};

const main = async () => {
  const result = await runExperiment();
  const markdown = renderMarkdown(result);
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    freezeReport: result.freezeReport,
    summary: result.summary
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  buildBaselineFreezeReport,
  buildMinimalFailingCorridorSummary
};

export const _proof = {
  repoRoot,
  round,
  mean,
  sum,
  metricAt,
  suppressProcessOutput,
  ensureHistoricalWorktree,
  importBaselineModules,
  createBaselineCore,
  advanceSilently,
  buildCorridorMask,
  selectCorridorTarget,
  cloneCoreFromSource,
  runPreVerticalSequence
};
