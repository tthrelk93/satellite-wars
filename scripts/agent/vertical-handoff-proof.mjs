#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = corridorProof.repoRoot || path.resolve(__dirname, '..', '..');

const DEFAULT_E0_REPORT = path.join(repoRoot, 'weather-validation', 'output', 'phase-e0-minimal-corridor.json');
const DEFAULT_REPORT_BASE = path.join(repoRoot, 'weather-validation', 'output', 'vertical-handoff-proof');
const DEFAULT_COARSE_GRID = { nx: 36, ny: 18 };
const DEFAULT_DT_HALF_SECONDS = 900;

const argv = process.argv.slice(2);
let reportBase = DEFAULT_REPORT_BASE;
let e0ReportPath = DEFAULT_E0_REPORT;
let coarseNx = DEFAULT_COARSE_GRID.nx;
let coarseNy = DEFAULT_COARSE_GRID.ny;
let dtHalfSeconds = DEFAULT_DT_HALF_SECONDS;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--e0-report' && argv[i + 1]) e0ReportPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--e0-report=')) e0ReportPath = path.resolve(arg.slice('--e0-report='.length));
  else if (arg === '--coarse-grid' && argv[i + 1]) {
    const [nxRaw, nyRaw] = argv[++i].toLowerCase().split('x');
    coarseNx = Number.parseInt(nxRaw, 10);
    coarseNy = Number.parseInt(nyRaw, 10);
  } else if (arg.startsWith('--coarse-grid=')) {
    const [nxRaw, nyRaw] = arg.slice('--coarse-grid='.length).toLowerCase().split('x');
    coarseNx = Number.parseInt(nxRaw, 10);
    coarseNy = Number.parseInt(nyRaw, 10);
  } else if (arg === '--dt-half' && argv[i + 1]) dtHalfSeconds = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--dt-half=')) dtHalfSeconds = Number.parseInt(arg.slice('--dt-half='.length), 10);
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const metricAt = corridorProof.metricAt || ((arr, idx) => Array.isArray(arr) && idx >= 0 && idx < arr.length ? Number(arr[idx]) || 0 : 0);
const sum = corridorProof.sum || ((values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0));
const mean = corridorProof.mean || ((values) => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
});

const VERTICAL_LEDGER_FIELDS = [
  'inputMassKgM2',
  'resolvedBirthMassKgM2',
  'convectiveBirthMassKgM2',
  'carrySurvivingMassKgM2',
  'appliedErosionMassKgM2',
  'handedToMicrophysicsMassKgM2',
  'residualMassKgM2'
];

const MICROPHYSICS_LEDGER_FIELDS = [
  'inputMassKgM2',
  'saturationBirthMassKgM2',
  'cloudReevaporationMassKgM2',
  'precipReevaporationMassKgM2',
  'sedimentationExportMassKgM2',
  'cloudToPrecipMassKgM2',
  'outputMassKgM2',
  'residualMassKgM2'
];

const closureFrac = (residual, terms) => {
  const scale = Math.max(1e-6, sum(terms.map((value) => Math.abs(value || 0))));
  return round(Math.max(0, 1 - Math.abs(residual || 0) / scale), 5);
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const pickNearestCorridorCell = (core, corridorIndices, targetLatDeg, targetLonDeg) => {
  let best = null;
  for (const idx of corridorIndices) {
    const rowIndex = Math.floor(idx / core.grid.nx);
    const colIndex = idx % core.grid.nx;
    const lat = core.grid.latDeg[rowIndex];
    const lon = core.grid.lonDeg[colIndex];
    const dLat = lat - targetLatDeg;
    const dLonWrapped = ((((lon - targetLonDeg) + 540) % 360) - 180);
    const score = dLat * dLat + dLonWrapped * dLonWrapped;
    if (!best || score < best.score) {
      best = {
        cellIndex: idx,
        rowIndex,
        colIndex,
        latDeg: round(lat, 5),
        lonDeg: round(lon, 5),
        score: round(score, 8)
      };
    }
  }
  return best;
};

const createConfiguredCore = async (modules, { nx, ny, dt, seed }) => corridorProof.suppressProcessOutput(async () => {
  const core = new modules.WeatherCore5({ nx, ny, dt, seed });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  return core;
});

const aggregateScalarField = (arr, indices) => round(sum(indices.map((idx) => Number(arr?.[idx]) || 0)), 5);

const aggregateLedger = (state, targetCellIndex, corridorIndices) => {
  const verticalTarget = {
    inputMassKgM2: round(state.verticalUpperCloudInputMass?.[targetCellIndex] || 0, 5),
    resolvedBirthMassKgM2: round(state.verticalUpperCloudResolvedBirthMass?.[targetCellIndex] || 0, 5),
    convectiveBirthMassKgM2: round(state.verticalUpperCloudConvectiveBirthMass?.[targetCellIndex] || 0, 5),
    carrySurvivingMassKgM2: round(state.verticalUpperCloudCarrySurvivingMass?.[targetCellIndex] || 0, 5),
    appliedErosionMassKgM2: round(state.verticalUpperCloudAppliedErosionMass?.[targetCellIndex] || 0, 5),
    handedToMicrophysicsMassKgM2: round(state.verticalUpperCloudHandedToMicrophysicsMass?.[targetCellIndex] || 0, 5),
    residualMassKgM2: round(state.verticalUpperCloudResidualMass?.[targetCellIndex] || 0, 5)
  };
  verticalTarget.totalBirthMassKgM2 = round((verticalTarget.resolvedBirthMassKgM2 || 0) + (verticalTarget.convectiveBirthMassKgM2 || 0), 5);
  verticalTarget.closureFrac = closureFrac(verticalTarget.residualMassKgM2, [
    verticalTarget.inputMassKgM2,
    verticalTarget.totalBirthMassKgM2,
    verticalTarget.appliedErosionMassKgM2,
    verticalTarget.handedToMicrophysicsMassKgM2
  ]);

  const microTarget = {
    inputMassKgM2: round(state.microphysicsUpperCloudInputMass?.[targetCellIndex] || 0, 5),
    saturationBirthMassKgM2: round(state.microphysicsUpperCloudSaturationBirthMass?.[targetCellIndex] || 0, 5),
    cloudReevaporationMassKgM2: round(state.microphysicsUpperCloudCloudReevaporationMass?.[targetCellIndex] || 0, 5),
    precipReevaporationMassKgM2: round(state.microphysicsUpperCloudPrecipReevaporationMass?.[targetCellIndex] || 0, 5),
    sedimentationExportMassKgM2: round(state.microphysicsUpperCloudSedimentationExportMass?.[targetCellIndex] || 0, 5),
    cloudToPrecipMassKgM2: round(state.microphysicsUpperCloudCloudToPrecipMass?.[targetCellIndex] || 0, 5),
    outputMassKgM2: round(state.microphysicsUpperCloudOutputMass?.[targetCellIndex] || 0, 5),
    residualMassKgM2: round(state.microphysicsUpperCloudResidualMass?.[targetCellIndex] || 0, 5)
  };
  microTarget.closureFrac = closureFrac(microTarget.residualMassKgM2, [
    microTarget.inputMassKgM2,
    microTarget.saturationBirthMassKgM2,
    microTarget.cloudReevaporationMassKgM2,
    microTarget.precipReevaporationMassKgM2,
    microTarget.sedimentationExportMassKgM2,
    microTarget.outputMassKgM2
  ]);

  const verticalCorridor = {
    inputMassKgM2: aggregateScalarField(state.verticalUpperCloudInputMass, corridorIndices),
    resolvedBirthMassKgM2: aggregateScalarField(state.verticalUpperCloudResolvedBirthMass, corridorIndices),
    convectiveBirthMassKgM2: aggregateScalarField(state.verticalUpperCloudConvectiveBirthMass, corridorIndices),
    carrySurvivingMassKgM2: aggregateScalarField(state.verticalUpperCloudCarrySurvivingMass, corridorIndices),
    appliedErosionMassKgM2: aggregateScalarField(state.verticalUpperCloudAppliedErosionMass, corridorIndices),
    handedToMicrophysicsMassKgM2: aggregateScalarField(state.verticalUpperCloudHandedToMicrophysicsMass, corridorIndices),
    residualMassKgM2: aggregateScalarField(state.verticalUpperCloudResidualMass, corridorIndices)
  };
  verticalCorridor.totalBirthMassKgM2 = round((verticalCorridor.resolvedBirthMassKgM2 || 0) + (verticalCorridor.convectiveBirthMassKgM2 || 0), 5);
  verticalCorridor.closureFrac = closureFrac(verticalCorridor.residualMassKgM2, [
    verticalCorridor.inputMassKgM2,
    verticalCorridor.totalBirthMassKgM2,
    verticalCorridor.appliedErosionMassKgM2,
    verticalCorridor.handedToMicrophysicsMassKgM2
  ]);

  const microCorridor = {
    inputMassKgM2: aggregateScalarField(state.microphysicsUpperCloudInputMass, corridorIndices),
    saturationBirthMassKgM2: aggregateScalarField(state.microphysicsUpperCloudSaturationBirthMass, corridorIndices),
    cloudReevaporationMassKgM2: aggregateScalarField(state.microphysicsUpperCloudCloudReevaporationMass, corridorIndices),
    precipReevaporationMassKgM2: aggregateScalarField(state.microphysicsUpperCloudPrecipReevaporationMass, corridorIndices),
    sedimentationExportMassKgM2: aggregateScalarField(state.microphysicsUpperCloudSedimentationExportMass, corridorIndices),
    cloudToPrecipMassKgM2: aggregateScalarField(state.microphysicsUpperCloudCloudToPrecipMass, corridorIndices),
    outputMassKgM2: aggregateScalarField(state.microphysicsUpperCloudOutputMass, corridorIndices),
    residualMassKgM2: aggregateScalarField(state.microphysicsUpperCloudResidualMass, corridorIndices)
  };
  microCorridor.closureFrac = closureFrac(microCorridor.residualMassKgM2, [
    microCorridor.inputMassKgM2,
    microCorridor.saturationBirthMassKgM2,
    microCorridor.cloudReevaporationMassKgM2,
    microCorridor.precipReevaporationMassKgM2,
    microCorridor.sedimentationExportMassKgM2,
    microCorridor.outputMassKgM2
  ]);

  const combined = {
    targetCellResidualMassKgM2: round((verticalTarget.residualMassKgM2 || 0) + (microTarget.residualMassKgM2 || 0), 5),
    corridorResidualMassKgM2: round((verticalCorridor.residualMassKgM2 || 0) + (microCorridor.residualMassKgM2 || 0), 5),
    targetCellClosureFrac: round(mean([verticalTarget.closureFrac, microTarget.closureFrac]) || 0, 5),
    corridorClosureFrac: round(mean([verticalCorridor.closureFrac, microCorridor.closureFrac]) || 0, 5)
  };

  return {
    vertical: { targetCell: verticalTarget, corridorBand: verticalCorridor },
    microphysics: { targetCell: microTarget, corridorBand: microCorridor },
    combined
  };
};

const doMicrophysicsForClone = (clone, modules) => {
  if (typeof clone._updateHydrostatic === 'function') clone._updateHydrostatic();
  const lodActive = clone.lodParams?.enable && clone.simSpeed > clone.lodParams.simSpeedThreshold;
  const microEvery = Math.max(1, Number(clone.lodParams?.microphysicsEvery) || 1);
  const doMicrophysics = !lodActive || (clone._dynStepIndex % microEvery === 0);
  if (typeof clone.vertParams?.enableConvectiveOutcome === 'boolean') {
    clone.microParams.enableConvectiveOutcome = clone.vertParams.enableConvectiveOutcome;
  }
  if (doMicrophysics) {
    modules.stepMicrophysics5({ dt: clone.modelDt, state: clone.state, params: clone.microParams });
    if (typeof clone._closeSurfaceSourceTracerBudget === 'function') {
      clone._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
    }
  }
};

const rankFieldDeltas = (currentFields, historicalFields, fieldNames) => fieldNames.map((field) => ({
  field,
  delta: round((currentFields?.[field] || 0) - (historicalFields?.[field] || 0), 5),
  absDelta: round(Math.abs((currentFields?.[field] || 0) - (historicalFields?.[field] || 0)), 5)
})).sort((a, b) => (b.absDelta || 0) - (a.absDelta || 0));

const runLedgerReplayStep = async ({ actualCore, modules, targetCell, corridorIndices }) => {
  return corridorProof.suppressProcessOutput(async () => {
    const clone = await corridorProof.cloneCoreFromSource(modules, actualCore);
    corridorProof.runPreVerticalSequence(clone, modules, actualCore.modelDt);
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
    const verticalLedger = aggregateLedger(clone.state, targetCell.cellIndex, corridorIndices).vertical;
    doMicrophysicsForClone(clone, modules);
    const microphysicsLedger = aggregateLedger(clone.state, targetCell.cellIndex, corridorIndices).microphysics;
    const combinedLedger = aggregateLedger(clone.state, targetCell.cellIndex, corridorIndices).combined;
    actualCore._stepOnce(actualCore.modelDt);
    return {
      dynStepIndex: actualCore._dynStepIndex - 1,
      simTimeSeconds: actualCore.timeUTC,
      vertical: verticalLedger,
      microphysics: microphysicsLedger,
      combined: combinedLedger
    };
  });
};

const loadFrozenBaseline = () => {
  if (!fs.existsSync(e0ReportPath)) {
    throw new Error(`Missing Phase E0 report at ${e0ReportPath}. Run Phase E0 first.`);
  }
  return readJson(e0ReportPath);
};

const runReplaySeries = async ({
  modules,
  config,
  targetLatDeg,
  targetLonDeg,
  sectorKey,
  latBandDeg,
  nx,
  ny,
  dt,
  seed
}) => {
  const core = await createConfiguredCore(modules, { nx, ny, dt, seed });
  await corridorProof.advanceSilently(core, config.checkpointDay * 86400);
  const corridorIndices = corridorProof.buildCorridorMask(core, {
    sector: sectorKey,
    latMin: latBandDeg[0],
    latMax: latBandDeg[1]
  });
  const targetCell = pickNearestCorridorCell(core, corridorIndices, targetLatDeg, targetLonDeg);
  const trace = [];
  for (let step = 0; step < config.windowSteps; step += 1) {
    trace.push(await runLedgerReplayStep({
      actualCore: core,
      modules,
      targetCell,
      corridorIndices
    }));
  }
  return { targetCell, corridorIndices, trace };
};

const summarizeBaselinePair = ({ currentTrace, historicalTrace }) => {
  const stepSummaries = [];
  for (let i = 0; i < Math.min(currentTrace.length, historicalTrace.length); i += 1) {
    const currentStep = currentTrace[i];
    const historicalStep = historicalTrace[i];
    const verticalRank = rankFieldDeltas(
      currentStep.vertical.targetCell,
      historicalStep.vertical.targetCell,
      VERTICAL_LEDGER_FIELDS
    );
    const microRank = rankFieldDeltas(
      currentStep.microphysics.targetCell,
      historicalStep.microphysics.targetCell,
      MICROPHYSICS_LEDGER_FIELDS
    );
    stepSummaries.push({
      stepOffset: i,
      simTimeSeconds: currentStep.simTimeSeconds,
      currentCombinedClosureFrac: currentStep.combined.targetCellClosureFrac,
      historicalCombinedClosureFrac: historicalStep.combined.targetCellClosureFrac,
      verticalTopDelta: verticalRank[0],
      microphysicsTopDelta: microRank[0],
      combinedResidualDeltaKgM2: round((currentStep.combined.targetCellResidualMassKgM2 || 0) - (historicalStep.combined.targetCellResidualMassKgM2 || 0), 5)
    });
  }
  const firstDominantStep = stepSummaries[0] || null;
  const peakVerticalStep = stepSummaries.reduce(
    (best, entry) => (!best || (entry.verticalTopDelta?.absDelta || 0) > (best.verticalTopDelta?.absDelta || 0) ? entry : best),
    null
  );
  const peakMicrophysicsStep = stepSummaries.reduce(
    (best, entry) => (!best || (entry.microphysicsTopDelta?.absDelta || 0) > (best.microphysicsTopDelta?.absDelta || 0) ? entry : best),
    null
  );
  return {
    steps: stepSummaries,
    firstDominantStep,
    peakVerticalStep,
    peakMicrophysicsStep
  };
};

const summarizeSensitivityVariant = ({ name, trace }) => {
  const combinedTargetClosures = trace.map((entry) => entry.combined.targetCellClosureFrac || 0);
  const combinedCorridorClosures = trace.map((entry) => entry.combined.corridorClosureFrac || 0);
  const verticalBirthVsHandoff = trace.map((entry) => ({
    resolvedBirthMassKgM2: entry.vertical.targetCell.resolvedBirthMassKgM2,
    convectiveBirthMassKgM2: entry.vertical.targetCell.convectiveBirthMassKgM2,
    handedToMicrophysicsMassKgM2: entry.vertical.targetCell.handedToMicrophysicsMassKgM2
  }));
  const dominantChannels = verticalBirthVsHandoff.map((entry) => rankFieldDeltas(entry, {}, [
    'resolvedBirthMassKgM2',
    'convectiveBirthMassKgM2',
    'handedToMicrophysicsMassKgM2'
  ])[0]?.field || null);
  return {
    name,
    minTargetClosureFrac: round(Math.min(...combinedTargetClosures), 5),
    minCorridorClosureFrac: round(Math.min(...combinedCorridorClosures), 5),
    dominantVerticalChannel: dominantChannels[0] || null,
    dominantChannelStable: dominantChannels.every((field) => field === dominantChannels[0])
  };
};

const renderMarkdown = (report) => {
  const { configuration, baselinePair, sensitivity } = report;
  const lines = [];
  lines.push('# Phase E1 Budget-Closed Vertical Handoff Proof');
  lines.push('');
  lines.push(`- Corridor: ${configuration.sectorKey} ${configuration.latBandDeg[0]}-${configuration.latBandDeg[1]} deg`);
  lines.push(`- Frozen target cell: ${configuration.targetCell.cellIndex} (lat ${configuration.targetCell.latDeg}, lon ${configuration.targetCell.lonDeg})`);
  lines.push(`- Checkpoint day: ${configuration.checkpointDay}`);
  lines.push(`- Baseline replay window: ${configuration.windowSteps} steps`);
  lines.push('');
  lines.push('## Baseline Pair');
  lines.push('');
  lines.push(`- Current commit: ${report.baselines.current.commit}`);
  lines.push(`- Historical commit: ${report.baselines.historical.commit}`);
  lines.push(`- First dominant vertical delta: ${baselinePair.firstDominantStep?.verticalTopDelta?.field} (${baselinePair.firstDominantStep?.verticalTopDelta?.delta})`);
  lines.push(`- First dominant microphysics delta: ${baselinePair.firstDominantStep?.microphysicsTopDelta?.field} (${baselinePair.firstDominantStep?.microphysicsTopDelta?.delta})`);
  lines.push(`- Peak vertical step: ${baselinePair.peakVerticalStep?.stepOffset}`);
  lines.push(`- Peak microphysics step: ${baselinePair.peakMicrophysicsStep?.stepOffset}`);
  lines.push('');
  lines.push('## Sensitivity');
  lines.push('');
  for (const variant of sensitivity) {
    lines.push(`- ${variant.name}: min target closure ${variant.minTargetClosureFrac}, min corridor closure ${variant.minCorridorClosureFrac}, dominant vertical channel ${variant.dominantVerticalChannel}, stable ${variant.dominantChannelStable}`);
  }
  return lines.join('\n');
};

const runExperiment = async () => {
  const e0Report = loadFrozenBaseline();
  const historicalRoot = e0Report.freezeReport?.baselines?.historical?.root || '/tmp/sw-phase1-e6';
  const historicalCommit = e0Report.freezeReport?.baselines?.historical?.commit || 'e6fea58';
  corridorProof.ensureHistoricalWorktree({ root: historicalRoot, commit: historicalCommit });

  const targetCell = e0Report.freezeReport.corridorTarget;
  const sectorKey = e0Report.freezeReport.corridorDefinition.sectorKey;
  const latBandDeg = e0Report.freezeReport.corridorDefinition.latBandDeg;
  const checkpointDay = e0Report.freezeReport.checkpointDay;
  const windowSteps = e0Report.freezeReport.windowSteps;
  const targetDay = e0Report.freezeReport.targetDay;
  const baselineGrid = e0Report.freezeReport.corridorDefinition.grid;
  const targetLatDeg = targetCell.latDeg;
  const targetLonDeg = targetCell.lonDeg;
  const seed = 12345;

  const currentModules = await corridorProof.importBaselineModules(repoRoot);
  const historicalModules = await corridorProof.importBaselineModules(historicalRoot);

  const baselineConfig = {
    checkpointDay,
    windowSteps
  };

  const currentBaseline = await runReplaySeries({
    modules: currentModules,
    config: baselineConfig,
    targetLatDeg,
    targetLonDeg,
    sectorKey,
    latBandDeg,
    nx: baselineGrid.nx,
    ny: baselineGrid.ny,
    dt: baselineGrid.dtSeconds,
    seed
  });
  const historicalBaseline = await runReplaySeries({
    modules: historicalModules,
    config: baselineConfig,
    targetLatDeg,
    targetLonDeg,
    sectorKey,
    latBandDeg,
    nx: baselineGrid.nx,
    ny: baselineGrid.ny,
    dt: baselineGrid.dtSeconds,
    seed
  });

  const dtHalfConfig = {
    checkpointDay: targetDay - ((windowSteps * baselineGrid.dtSeconds) / 86400),
    windowSteps: Math.max(1, Math.round((windowSteps * baselineGrid.dtSeconds) / dtHalfSeconds))
  };
  const gridCoarseConfig = {
    checkpointDay,
    windowSteps
  };

  const dtHalfSeries = await runReplaySeries({
    modules: currentModules,
    config: dtHalfConfig,
    targetLatDeg,
    targetLonDeg,
    sectorKey,
    latBandDeg,
    nx: baselineGrid.nx,
    ny: baselineGrid.ny,
    dt: dtHalfSeconds,
    seed
  });
  const coarseSeries = await runReplaySeries({
    modules: currentModules,
    config: gridCoarseConfig,
    targetLatDeg,
    targetLonDeg,
    sectorKey,
    latBandDeg,
    nx: coarseNx,
    ny: coarseNy,
    dt: baselineGrid.dtSeconds,
    seed
  });

  const baselinePair = summarizeBaselinePair({
    currentTrace: currentBaseline.trace,
    historicalTrace: historicalBaseline.trace
  });
  const sensitivity = [
    summarizeSensitivityVariant({ name: 'dt_half', trace: dtHalfSeries.trace }),
    summarizeSensitivityVariant({ name: 'grid_coarse', trace: coarseSeries.trace })
  ];

  return {
    schema: 'satellite-wars.phase-e1-vertical-handoff-proof.v1',
    generatedAt: new Date().toISOString(),
    configuration: {
      sectorKey,
      latBandDeg,
      checkpointDay: round(checkpointDay, 5),
      windowSteps,
      targetCell: currentBaseline.targetCell
    },
    baselines: {
      current: {
        commit: commitAtRoot(repoRoot),
        root: repoRoot,
        targetCell: currentBaseline.targetCell
      },
      historical: {
        commit: commitAtRoot(historicalRoot),
        root: historicalRoot,
        targetCell: historicalBaseline.targetCell
      }
    },
    baselinePair,
    sensitivity,
    traces: {
      current: currentBaseline.trace,
      historical: historicalBaseline.trace,
      dt_half: dtHalfSeries.trace,
      grid_coarse: coarseSeries.trace
    }
  };
};

const main = async () => {
  const report = await runExperiment();
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${reportBase}.md`, renderMarkdown(report));
  process.stdout.write(JSON.stringify({
    configuration: report.configuration,
    baselinePair: report.baselinePair,
    sensitivity: report.sensitivity
  }, null, 2));
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  await main();
}

export const _test = {
  aggregateLedger,
  summarizeBaselinePair,
  summarizeSensitivityVariant
};
