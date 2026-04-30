#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { advanceToModelDayFully } from './advance-fully.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = corridorProof.repoRoot || path.resolve(__dirname, '..', '..');

const DEFAULT_CONTRACT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'prevertical-ownership-contract.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-supply-vs-retention-counterfactuals'
);
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;
const CLOUD_SPECIES = ['qc', 'qi', 'qr', 'qs'];

let contractPath = DEFAULT_CONTRACT_PATH;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const sum = corridorProof.sum || ((values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
const sigmaMidAtLevel = (sigmaHalf, lev) => 0.5 * ((sigmaHalf?.[lev] || 0) + (sigmaHalf?.[lev + 1] || 0));

const createConfiguredCore = async (modules, contract) => corridorProof.suppressProcessOutput(async () => {
  const core = new modules.WeatherCore5({
    nx: contract.corridor.grid.nx,
    ny: contract.corridor.grid.ny,
    dt: contract.corridor.grid.dtSeconds,
    seed: 12345
  });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  return core;
});

const advanceToDay = async (core, day) => {
  await corridorProof.suppressProcessOutput(async () => {
    advanceToModelDayFully(core, day);
  });
};

const computeStepCadence = (core) => {
  const lodActive = core.lodParams?.enable && core.simSpeed > core.lodParams.simSpeedThreshold;
  const radEvery = Math.max(1, Number(core.lodParams?.radiationEvery) || 1);
  return {
    doRadiation: !lodActive || (core._dynStepIndex % radEvery === 0)
  };
};

const upperCloudMixingRatioAtIndex = (state, idx) => (
  (state.qc?.[idx] || 0)
  + (state.qi?.[idx] || 0)
  + (state.qr?.[idx] || 0)
  + (state.qs?.[idx] || 0)
);

const aggregateUpperCloudMass = (state, indices) => {
  const { N, nz, pHalf, sigmaHalf } = state;
  let total = 0;
  for (const cellIndex of indices) {
    for (let lev = 0; lev < nz; lev += 1) {
      if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
      const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
      if (!(dp > 0)) continue;
      const idx = lev * N + cellIndex;
      total += upperCloudMixingRatioAtIndex(state, idx) * (dp / G);
    }
  }
  return round(total, 5);
};

const captureMassSnapshot = ({ state, targetCellIndex, corridorIndices, label }) => ({
  label,
  targetCellUpperCloudMassKgM2: aggregateUpperCloudMass(state, [targetCellIndex]),
  corridorUpperCloudMassKgM2: aggregateUpperCloudMass(state, corridorIndices)
});

const runToPreAdvectionBoundary = ({ core, modules }) => {
  const { doRadiation } = computeStepCadence(core);
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  modules.stepSurface2D5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    climo: core.climo,
    geo: core.geo,
    params: core.surfaceParams
  });
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  if (doRadiation) {
    modules.stepRadiation2D5({
      dt: core.modelDt,
      grid: core.grid,
      state: core.state,
      timeUTC: core.timeUTC,
      params: core.radParams
    });
  }
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  core.dynParams.stepIndex = core._dynStepIndex;
  modules.stepWinds5({
    dt: core.modelDt,
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
    const durationSeconds = Number.isFinite(spinupParams.durationSeconds) ? spinupParams.durationSeconds : 0;
    core._windNudgeSpinupSeconds = Math.min(
      core._windNudgeSpinupSeconds + core.modelDt,
      durationSeconds > 0 ? durationSeconds : core._windNudgeSpinupSeconds + core.modelDt
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
    dt: core.modelDt,
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
      dt: core.modelDt,
      grid: core.grid,
      state: core.state,
      climo: core.climo,
      params: core.windEddyParams
    });
  }
  modules.stepSurfacePressure5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    params: core.massParams,
    scratch: core._dynScratch
  });
};

const copyUpperCloudReservoir = ({ sourceState, targetState, cellIndices = null }) => {
  const cellSet = cellIndices ? new Set(cellIndices) : null;
  const { N, nz, sigmaHalf } = targetState;
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const base = lev * N;
    const copyCell = (cellIndex) => {
      const idx = base + cellIndex;
      for (const key of CLOUD_SPECIES) {
        if (targetState[key]) {
          targetState[key][idx] = sourceState[key]?.[idx] || 0;
        }
      }
    };
    if (cellSet) {
      for (const cellIndex of cellSet) copyCell(cellIndex);
    } else {
      for (let cellIndex = 0; cellIndex < N; cellIndex += 1) copyCell(cellIndex);
    }
  }
};

const saveUpperCloudReservoir = ({ state, cellIndices }) => {
  const { N, nz, sigmaHalf } = state;
  const saved = {};
  for (const key of CLOUD_SPECIES) saved[key] = new Map();
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const base = lev * N;
    for (const cellIndex of cellIndices) {
      const idx = base + cellIndex;
      for (const key of CLOUD_SPECIES) {
        if (state[key]) saved[key].set(idx, state[key][idx] || 0);
      }
    }
  }
  return saved;
};

const restoreUpperCloudReservoir = ({ state, saved }) => {
  for (const key of CLOUD_SPECIES) {
    if (!state[key]) continue;
    for (const [idx, value] of saved[key].entries()) {
      state[key][idx] = value;
    }
  }
};

const runAdvectionOnly = ({ core, modules }) => {
  core.advectParams.stepIndex = core._dynStepIndex;
  modules.stepAdvection5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    params: core.advectParams,
    scratch: core._dynScratch
  });
};

const summarizeScenario = ({ name, snapshot, historicalBaseline, currentBaseline }) => {
  const targetExcessKgM2 = round(snapshot.targetCellUpperCloudMassKgM2 - historicalBaseline.targetCellUpperCloudMassKgM2, 5);
  const corridorExcessKgM2 = round(snapshot.corridorUpperCloudMassKgM2 - historicalBaseline.corridorUpperCloudMassKgM2, 5);
  const baselineTargetExcess = currentBaseline.targetExcessKgM2;
  const baselineCorridorExcess = currentBaseline.corridorExcessKgM2;
  const targetReductionFrac = baselineTargetExcess > 0
    ? round(1 - (targetExcessKgM2 / baselineTargetExcess), 5)
    : null;
  const corridorReductionFrac = baselineCorridorExcess > 0
    ? round(1 - (corridorExcessKgM2 / baselineCorridorExcess), 5)
    : null;
  const targetReproductionFrac = baselineTargetExcess > 0
    ? round(targetExcessKgM2 / baselineTargetExcess, 5)
    : null;
  const corridorReproductionFrac = baselineCorridorExcess > 0
    ? round(corridorExcessKgM2 / baselineCorridorExcess, 5)
    : null;
  return {
    name,
    ...snapshot,
    targetExcessKgM2,
    corridorExcessKgM2,
    targetReductionFrac,
    corridorReductionFrac,
    targetReproductionFrac,
    corridorReproductionFrac
  };
};

const classifyOutcome = ({ retentionOff, advectionOff, carryoverOnly, advectionOnly }) => {
  const ruledIn = [];
  const ruledOut = [];
  const ambiguous = [];
  let decision = 'coupled';

  if ((retentionOff.targetReductionFrac || 0) >= 0.7 && (advectionOff.targetReductionFrac || 0) < 0.35) {
    decision = 'retention-dominant';
    ruledIn.push('Removing the current corridor reservoir before advection removes most of the target-cell excess while corridor advection shutdown alone does not.');
  } else if ((advectionOff.targetReductionFrac || 0) >= 0.7 && (retentionOff.targetReductionFrac || 0) < 0.35) {
    decision = 'advection-dominant';
    ruledIn.push('Disabling corridor advection removes most of the target-cell excess while removing the prior reservoir alone does not.');
  } else {
    ruledIn.push('Neither local retention removal nor local advection shutdown alone clears the excess strongly enough to claim a single dominant owner.');
  }

  if ((carryoverOnly.targetReproductionFrac || 0) >= 0.7) {
    ruledIn.push('Current upper-cloud carryover is sufficient to reproduce most of the target-cell excess even under historical flow.');
  } else {
    ambiguous.push('Current carryover alone does not fully reproduce the target-cell excess under historical flow.');
  }

  if ((advectionOnly.targetReproductionFrac || 0) >= 0.7) {
    ruledIn.push('Current flow acting on the historical cloud reservoir is sufficient to reproduce most of the target-cell excess.');
  } else {
    ruledOut.push('Current flow acting on the historical cloud reservoir is not sufficient to recreate most of the target-cell excess.');
  }

  if ((retentionOff.targetReductionFrac || 0) > 0.35 && (advectionOff.targetReductionFrac || 0) > 0.35) {
    decision = 'coupled';
    ruledIn.push('Both the inherited reservoir and current-step advection contribute materially in the frozen corridor.');
  }

  return { decision, ruledIn, ruledOut, ambiguous };
};

const renderMarkdown = ({ contract, baselines, scenarios, assessment }) => {
  const lines = [];
  lines.push('# U3 Pre-Vertical Supply Versus Retention Counterfactuals');
  lines.push('');
  lines.push(`- Corridor: ${contract.corridor.sectorKey} ${contract.corridor.latBandDeg[0]}-${contract.corridor.latBandDeg[1]} deg`);
  lines.push(`- Target cell: ${contract.corridor.targetCell.cellIndex} (lat ${contract.corridor.targetCell.latDeg}, lon ${contract.corridor.targetCell.lonDeg})`);
  lines.push(`- Historical baseline: ${baselines.historical.commit}`);
  lines.push(`- Current baseline: ${baselines.current.commit}`);
  lines.push(`- Decision: ${assessment.decision}`);
  lines.push('');
  lines.push('## Baseline excess');
  lines.push('');
  lines.push(`- Target excess: ${baselines.current.targetExcessKgM2}`);
  lines.push(`- Corridor excess: ${baselines.current.corridorExcessKgM2}`);
  lines.push('');
  lines.push('## Scenario outcomes');
  lines.push('');
  for (const scenario of scenarios) {
    lines.push(`### ${scenario.name}`);
    lines.push(`- Target mass: ${scenario.targetCellUpperCloudMassKgM2}`);
    lines.push(`- Corridor mass: ${scenario.corridorUpperCloudMassKgM2}`);
    lines.push(`- Target excess: ${scenario.targetExcessKgM2}`);
    lines.push(`- Corridor excess: ${scenario.corridorExcessKgM2}`);
    lines.push(`- Target reduction frac: ${scenario.targetReductionFrac}`);
    lines.push(`- Corridor reduction frac: ${scenario.corridorReductionFrac}`);
    lines.push(`- Target reproduction frac: ${scenario.targetReproductionFrac}`);
    lines.push(`- Corridor reproduction frac: ${scenario.corridorReproductionFrac}`);
    lines.push('');
  }
  return lines.join('\n');
};

const runExperiment = async () => {
  const contract = readJson(contractPath);
  const historicalRoot = contract.baselineRoots?.historical?.root;
  if (!historicalRoot || !fs.existsSync(path.join(historicalRoot, '.git'))) {
    throw new Error(`Missing historical worktree at ${historicalRoot}.`);
  }

  const currentModules = await corridorProof.importBaselineModules(repoRoot);
  const historicalModules = await corridorProof.importBaselineModules(historicalRoot);
  const checkpointDay = Number(contract.provingInstant?.checkpointDay ?? contract.corridor.checkpointDay);

  const currentCheckpointCore = await createConfiguredCore(currentModules, contract);
  const historicalCheckpointCore = await createConfiguredCore(historicalModules, contract);
  await advanceToDay(currentCheckpointCore, checkpointDay);
  await advanceToDay(historicalCheckpointCore, checkpointDay);

  const corridorIndices = corridorProof.buildCorridorMask(currentCheckpointCore, {
    sector: contract.corridor.sectorKey,
    latMin: contract.corridor.latBandDeg[0],
    latMax: contract.corridor.latBandDeg[1]
  });
  const targetCellIndex = contract.corridor.targetCell.cellIndex;
  if (!corridorIndices.includes(targetCellIndex)) {
    throw new Error(`Target cell ${targetCellIndex} is not inside the frozen corridor.`);
  }

  const currentPreAdvection = await corridorProof.cloneCoreFromSource(currentModules, currentCheckpointCore);
  const historicalPreAdvection = await corridorProof.cloneCoreFromSource(historicalModules, historicalCheckpointCore);
  runToPreAdvectionBoundary({ core: currentPreAdvection, modules: currentModules });
  runToPreAdvectionBoundary({ core: historicalPreAdvection, modules: historicalModules });

  const currentBaselineCore = await corridorProof.cloneCoreFromSource(currentModules, currentPreAdvection);
  runAdvectionOnly({ core: currentBaselineCore, modules: currentModules });
  const currentBaselineSnapshot = captureMassSnapshot({
    state: currentBaselineCore.state,
    targetCellIndex,
    corridorIndices,
    label: 'currentBaseline'
  });

  const historicalBaselineCore = await corridorProof.cloneCoreFromSource(historicalModules, historicalPreAdvection);
  runAdvectionOnly({ core: historicalBaselineCore, modules: historicalModules });
  const historicalBaselineSnapshot = captureMassSnapshot({
    state: historicalBaselineCore.state,
    targetCellIndex,
    corridorIndices,
    label: 'historicalBaseline'
  });

  const baselineCurrent = {
    targetExcessKgM2: round(
      currentBaselineSnapshot.targetCellUpperCloudMassKgM2 - historicalBaselineSnapshot.targetCellUpperCloudMassKgM2,
      5
    ),
    corridorExcessKgM2: round(
      currentBaselineSnapshot.corridorUpperCloudMassKgM2 - historicalBaselineSnapshot.corridorUpperCloudMassKgM2,
      5
    )
  };

  const retentionOffCore = await corridorProof.cloneCoreFromSource(currentModules, currentPreAdvection);
  copyUpperCloudReservoir({
    sourceState: historicalPreAdvection.state,
    targetState: retentionOffCore.state,
    cellIndices: corridorIndices
  });
  runAdvectionOnly({ core: retentionOffCore, modules: currentModules });
  const retentionOff = summarizeScenario({
    name: 'retentionOffCorridorLocal',
    snapshot: captureMassSnapshot({
      state: retentionOffCore.state,
      targetCellIndex,
      corridorIndices,
      label: 'retentionOffCorridorLocal'
    }),
    historicalBaseline: historicalBaselineSnapshot,
    currentBaseline: baselineCurrent
  });

  const advectionOffCore = await corridorProof.cloneCoreFromSource(currentModules, currentPreAdvection);
  const savedCorridor = saveUpperCloudReservoir({ state: advectionOffCore.state, cellIndices: corridorIndices });
  runAdvectionOnly({ core: advectionOffCore, modules: currentModules });
  restoreUpperCloudReservoir({ state: advectionOffCore.state, saved: savedCorridor });
  const advectionOff = summarizeScenario({
    name: 'advectionOffCorridorLocal',
    snapshot: captureMassSnapshot({
      state: advectionOffCore.state,
      targetCellIndex,
      corridorIndices,
      label: 'advectionOffCorridorLocal'
    }),
    historicalBaseline: historicalBaselineSnapshot,
    currentBaseline: baselineCurrent
  });

  const carryoverOnlyCore = await corridorProof.cloneCoreFromSource(historicalModules, historicalPreAdvection);
  copyUpperCloudReservoir({
    sourceState: currentPreAdvection.state,
    targetState: carryoverOnlyCore.state
  });
  runAdvectionOnly({ core: carryoverOnlyCore, modules: historicalModules });
  const carryoverOnly = summarizeScenario({
    name: 'carryoverOnlyHistoricalFlow',
    snapshot: captureMassSnapshot({
      state: carryoverOnlyCore.state,
      targetCellIndex,
      corridorIndices,
      label: 'carryoverOnlyHistoricalFlow'
    }),
    historicalBaseline: historicalBaselineSnapshot,
    currentBaseline: baselineCurrent
  });

  const advectionOnlyCore = await corridorProof.cloneCoreFromSource(currentModules, currentPreAdvection);
  copyUpperCloudReservoir({
    sourceState: historicalPreAdvection.state,
    targetState: advectionOnlyCore.state
  });
  runAdvectionOnly({ core: advectionOnlyCore, modules: currentModules });
  const advectionOnly = summarizeScenario({
    name: 'advectionOnlyCurrentFlow',
    snapshot: captureMassSnapshot({
      state: advectionOnlyCore.state,
      targetCellIndex,
      corridorIndices,
      label: 'advectionOnlyCurrentFlow'
    }),
    historicalBaseline: historicalBaselineSnapshot,
    currentBaseline: baselineCurrent
  });

  const assessment = classifyOutcome({ retentionOff, advectionOff, carryoverOnly, advectionOnly });

  return {
    schema: 'satellite-wars.prevertical-supply-vs-retention-counterfactuals.v1',
    generatedAt: new Date().toISOString(),
    contractPath,
    baselines: {
      historical: {
        commit: commitAtRoot(historicalRoot),
        root: historicalRoot,
        ...historicalBaselineSnapshot
      },
      current: {
        commit: commitAtRoot(repoRoot),
        root: repoRoot,
        ...currentBaselineSnapshot,
        ...baselineCurrent
      }
    },
    scenarios: {
      retentionOffCorridorLocal: retentionOff,
      advectionOffCorridorLocal: advectionOff,
      carryoverOnlyHistoricalFlow: carryoverOnly,
      advectionOnlyCurrentFlow: advectionOnly
    },
    rootCauseAssessment: assessment
  };
};

const main = async () => {
  const result = await corridorProof.suppressProcessOutput(runExperiment);
  const contract = readJson(contractPath);
  const markdown = renderMarkdown({
    contract,
    baselines: result.baselines,
    scenarios: Object.values(result.scenarios),
    assessment: result.rootCauseAssessment
  });
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    decision: result.rootCauseAssessment.decision,
    scenarios: Object.fromEntries(Object.entries(result.scenarios).map(([key, value]) => [key, {
      targetReductionFrac: value.targetReductionFrac,
      targetReproductionFrac: value.targetReproductionFrac
    }]))
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  classifyOutcome,
  summarizeScenario
};
