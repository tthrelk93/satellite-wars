#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { classifyNhDryBeltSector } from '../../src/weather/v2/sourceTracing5.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = corridorProof.repoRoot || path.resolve(__dirname, '..', '..');

const DEFAULT_CONTRACT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'prevertical-ownership-contract.json'
);
const DEFAULT_U3_REPORT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-supply-vs-retention-counterfactuals.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-reduced-order-results'
);
const CLOUD_SPECIES = ['qc', 'qi', 'qr', 'qs'];
const WIND_SPECIES = ['u', 'v'];

let contractPath = DEFAULT_CONTRACT_PATH;
let u3ReportPath = DEFAULT_U3_REPORT_PATH;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--u3-report' && argv[i + 1]) u3ReportPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--u3-report=')) u3ReportPath = path.resolve(arg.slice('--u3-report='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

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
    core.advanceModelSeconds(day * 86400);
  });
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

const upperCloudMassAtCell = (state, cellIndex) => {
  const { N, nz, pHalf, sigmaHalf } = state;
  let total = 0;
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = 0.5 * ((sigmaHalf?.[lev] || 0) + (sigmaHalf?.[lev + 1] || 0));
    if (sigmaMid > 0.55) continue;
    const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
    if (!(dp > 0)) continue;
    const idx = lev * N + cellIndex;
    total += (
      (state.qc?.[idx] || 0)
      + (state.qi?.[idx] || 0)
      + (state.qr?.[idx] || 0)
      + (state.qs?.[idx] || 0)
    ) * (dp / 9.80665);
  }
  return total;
};

const aggregateUpperCloudMass = (state, cellIndices) => round(
  cellIndices.reduce((total, cellIndex) => total + upperCloudMassAtCell(state, cellIndex), 0),
  5
);

const buildSectorIndices = (core, sectorKey) => {
  const indices = [];
  const { nx, ny, lonDeg } = core.grid;
  const landMask = core.state.landMask;
  for (let j = 0; j < ny; j += 1) {
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      const isLand = landMask?.[idx] === 1;
      if (classifyNhDryBeltSector({ lonDeg: lonDeg[i], isLand }) === sectorKey) {
        indices.push(idx);
      }
    }
  }
  return indices;
};

const subtractIndices = (indices, excluded) => {
  const excludedSet = new Set(excluded);
  return indices.filter((idx) => !excludedSet.has(idx));
};

const copyCellwiseArray = ({ source, target, cellIndices, N }) => {
  if (!source || !target || source.length !== target.length) return;
  if (target.length % N !== 0) return;
  const slabs = target.length / N;
  for (let slab = 0; slab < slabs; slab += 1) {
    const base = slab * N;
    for (const cellIndex of cellIndices) {
      target[base + cellIndex] = source[base + cellIndex];
    }
  }
};

const copyTransferableCells = ({ sourceCore, targetCore, cellIndices, stateKeys = null, fieldKeys = null }) => {
  const N = targetCore.state.N;
  const stateKeySet = stateKeys ? new Set(stateKeys) : null;
  const fieldKeySet = fieldKeys ? new Set(fieldKeys) : null;

  for (const [key, targetArr] of Object.entries(targetCore.state)) {
    if (!ArrayBuffer.isView(targetArr)) continue;
    if (stateKeySet && !stateKeySet.has(key)) continue;
    const sourceArr = sourceCore.state[key];
    if (!sourceArr || !ArrayBuffer.isView(sourceArr)) continue;
    copyCellwiseArray({ source: sourceArr, target: targetArr, cellIndices, N });
  }

  for (const [key, targetArr] of Object.entries(targetCore.fields || {})) {
    if (!ArrayBuffer.isView(targetArr)) continue;
    if (fieldKeySet && !fieldKeySet.has(key)) continue;
    const sourceArr = sourceCore.fields?.[key];
    if (!sourceArr || !ArrayBuffer.isView(sourceArr)) continue;
    copyCellwiseArray({ source: sourceArr, target: targetArr, cellIndices, N });
  }
};

const runLocalColumnStep = ({ core, modules }) => {
  const { doRadiation, doMicrophysics } = computeStepCadence(core);
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
  modules.stepVertical5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    geo: core.geo,
    params: core.vertParams,
    scratch: core._dynScratch
  });
  if (typeof core._closeSurfaceSourceTracerBudget === 'function') {
    core._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
  }
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  if (typeof core.vertParams?.enableConvectiveOutcome === 'boolean') {
    core.microParams.enableConvectiveOutcome = core.vertParams.enableConvectiveOutcome;
  }
  if (doMicrophysics) {
    modules.stepMicrophysics5({ dt: core.modelDt, state: core.state, params: core.microParams });
    if (typeof core._closeSurfaceSourceTracerBudget === 'function') {
      core._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
    }
  }
  core.timeUTC += core.modelDt;
  core._dynStepIndex += 1;
};

const runPreverticalSequence = ({ core, modules }) => {
  corridorProof.runPreVerticalSequence(core, modules, core.modelDt);
};

const summarizeReproduction = ({ name, snapshot, referenceExcess }) => {
  const targetReproductionFrac = referenceExcess.target > 0
    ? round(snapshot.targetCellUpperCloudMassKgM2 / referenceExcess.target, 5)
    : null;
  const corridorReproductionFrac = referenceExcess.corridor > 0
    ? round(snapshot.corridorUpperCloudMassKgM2 / referenceExcess.corridor, 5)
    : null;
  return {
    name,
    ...snapshot,
    targetReproductionFrac,
    corridorReproductionFrac
  };
};

const classifyReducedOrderOutcome = ({ column, curtain, advectionOnly }) => {
  const ruledIn = [];
  const ruledOut = [];
  const ambiguous = [];
  let decision = 'requires-full-globe';

  if ((column.targetReproductionFrac || 0) >= 0.7) {
    ruledIn.push('The no-transport column retains most of the target-cell excess, so the bug survives without horizontal transport.');
    decision = 'local-retention-survives';
  } else {
    ambiguous.push('The no-transport column does not retain enough of the target-cell excess for a clean local-retention proof.');
  }

  if ((curtain.targetReproductionFrac || 0) >= 0.7) {
    ruledIn.push('The sector curtain reproduces most of the target-cell excess, so full-globe complexity is not required.');
    if (decision === 'requires-full-globe') decision = 'sector-curtain-sufficient';
  } else {
    ambiguous.push('The sector curtain does not reproduce enough of the target-cell excess to fully replace globe-scale context.');
  }

  if ((advectionOnly.targetReproductionFrac || 0) < 0.2) {
    ruledOut.push('The advection-only curtain cannot reproduce the target-cell excess, so transport alone is insufficient.');
  } else {
    ambiguous.push('The advection-only curtain still reproduces too much of the target-cell excess to rule transport-only behavior out.');
  }

  if ((column.targetReproductionFrac || 0) >= 0.7 && (advectionOnly.targetReproductionFrac || 0) < 0.2) {
    decision = 'retention-local-maintenance-without-full-globe';
  }

  return { decision, ruledIn, ruledOut, ambiguous };
};

const renderMarkdown = ({ contract, baselines, experiments, assessment }) => {
  const lines = [];
  lines.push('# U4 Pre-Vertical Reduced-Order Reference Experiments');
  lines.push('');
  lines.push(`- Corridor: ${contract.corridor.sectorKey} ${contract.corridor.latBandDeg[0]}-${contract.corridor.latBandDeg[1]} deg`);
  lines.push(`- Target cell: ${contract.corridor.targetCell.cellIndex} (lat ${contract.corridor.targetCell.latDeg}, lon ${contract.corridor.targetCell.lonDeg})`);
  lines.push(`- Decision: ${assessment.decision}`);
  lines.push('');
  lines.push('## Reference excess');
  lines.push('');
  lines.push(`- Target: ${baselines.referenceExcess.target}`);
  lines.push(`- Corridor: ${baselines.referenceExcess.corridor}`);
  lines.push('');
  for (const experiment of experiments) {
    lines.push(`## ${experiment.name}`);
    lines.push('');
    lines.push(`- Target mass: ${experiment.targetCellUpperCloudMassKgM2}`);
    lines.push(`- Corridor mass: ${experiment.corridorUpperCloudMassKgM2}`);
    lines.push(`- Target reproduction: ${experiment.targetReproductionFrac}`);
    lines.push(`- Corridor reproduction: ${experiment.corridorReproductionFrac}`);
    if (experiment.notes?.length) {
      for (const note of experiment.notes) lines.push(`- ${note}`);
    }
    lines.push('');
  }
  return lines.join('\n');
};

const runExperiment = async () => {
  const contract = readJson(contractPath);
  const u3Report = readJson(u3ReportPath);
  const historicalRoot = contract.baselineRoots?.historical?.root;
  if (!historicalRoot || !fs.existsSync(path.join(historicalRoot, '.git'))) {
    throw new Error(`Missing historical worktree at ${historicalRoot}.`);
  }

  const currentModules = await corridorProof.importBaselineModules(repoRoot);
  const historicalModules = await corridorProof.importBaselineModules(historicalRoot);
  const checkpointDay = Number(contract.corridor.checkpointDay);

  const currentCheckpoint = await createConfiguredCore(currentModules, contract);
  const historicalCheckpoint = await createConfiguredCore(historicalModules, contract);
  await advanceToDay(currentCheckpoint, checkpointDay);
  await advanceToDay(historicalCheckpoint, checkpointDay);

  const corridorIndices = corridorProof.buildCorridorMask(currentCheckpoint, {
    sector: contract.corridor.sectorKey,
    latMin: contract.corridor.latBandDeg[0],
    latMax: contract.corridor.latBandDeg[1]
  });
  const sectorIndices = buildSectorIndices(currentCheckpoint, contract.corridor.sectorKey);
  const sectorOutsideCorridor = subtractIndices(sectorIndices, corridorIndices);
  const targetCellIndex = contract.corridor.targetCell.cellIndex;
  const referenceExcess = {
    target: Number(u3Report.baselines?.current?.targetExcessKgM2) || 0,
    corridor: Number(u3Report.baselines?.current?.corridorExcessKgM2) || 0
  };

  const currentColumn = await corridorProof.cloneCoreFromSource(currentModules, currentCheckpoint);
  const historicalColumn = await corridorProof.cloneCoreFromSource(historicalModules, historicalCheckpoint);
  runLocalColumnStep({ core: currentColumn, modules: currentModules });
  runLocalColumnStep({ core: historicalColumn, modules: historicalModules });
  const columnExperiment = summarizeReproduction({
    name: 'columnNoTransport',
    snapshot: {
      targetCellUpperCloudMassKgM2: round(
        upperCloudMassAtCell(currentColumn.state, targetCellIndex) - upperCloudMassAtCell(historicalColumn.state, targetCellIndex),
        5
      ),
      corridorUpperCloudMassKgM2: round(
        aggregateUpperCloudMass(currentColumn.state, corridorIndices) - aggregateUpperCloudMass(historicalColumn.state, corridorIndices),
        5
      ),
      notes: [
        'One local step with no wind updates and no horizontal transport.',
        `Historical target after local step: ${round(upperCloudMassAtCell(historicalColumn.state, targetCellIndex), 5)}`
      ]
    },
    referenceExcess
  });

  const sectorCurtain = await corridorProof.cloneCoreFromSource(historicalModules, historicalCheckpoint);
  copyTransferableCells({ sourceCore: currentCheckpoint, targetCore: sectorCurtain, cellIndices: sectorIndices });
  runPreverticalSequence({ core: sectorCurtain, modules: historicalModules });
  const sectorCurtainExperiment = summarizeReproduction({
    name: 'sectorCurtain',
    snapshot: {
      targetCellUpperCloudMassKgM2: aggregateUpperCloudMass(sectorCurtain.state, [targetCellIndex]),
      corridorUpperCloudMassKgM2: aggregateUpperCloudMass(sectorCurtain.state, corridorIndices),
      notes: [
        'Historical globe with current east-Pacific sector state copied in before one frozen pre-vertical replay.',
        `Sector width cells: ${sectorIndices.length}`
      ]
    },
    referenceExcess
  });

  const advectionOnlyCurtain = await corridorProof.cloneCoreFromSource(historicalModules, historicalCheckpoint);
  copyTransferableCells({
    sourceCore: currentCheckpoint,
    targetCore: advectionOnlyCurtain,
    cellIndices: sectorOutsideCorridor,
    stateKeys: [...CLOUD_SPECIES, ...WIND_SPECIES]
  });
  advectionOnlyCurtain.advectParams.stepIndex = advectionOnlyCurtain._dynStepIndex;
  historicalModules.stepAdvection5({
    dt: advectionOnlyCurtain.modelDt,
    grid: advectionOnlyCurtain.grid,
    state: advectionOnlyCurtain.state,
    params: advectionOnlyCurtain.advectParams,
    scratch: advectionOnlyCurtain._dynScratch
  });
  const advectionOnlyExperiment = summarizeReproduction({
    name: 'advectionOnlyCurtain',
    snapshot: {
      targetCellUpperCloudMassKgM2: aggregateUpperCloudMass(advectionOnlyCurtain.state, [targetCellIndex]),
      corridorUpperCloudMassKgM2: aggregateUpperCloudMass(advectionOnlyCurtain.state, corridorIndices),
      notes: [
        'Historical checkpoint with current east-Pacific cloud and wind fields outside the dry-belt corridor only.',
        'Runs advection only, with no surface, radiation, vertical, or microphysics steps.'
      ]
    },
    referenceExcess
  });

  const assessment = classifyReducedOrderOutcome({
    column: columnExperiment,
    curtain: sectorCurtainExperiment,
    advectionOnly: advectionOnlyExperiment
  });

  return {
    schema: 'satellite-wars.prevertical-reduced-order-results.v1',
    generatedAt: new Date().toISOString(),
    contractPath,
    u3ReportPath,
    baselines: {
      historical: {
        commit: commitAtRoot(historicalRoot),
        root: historicalRoot
      },
      current: {
        commit: commitAtRoot(repoRoot),
        root: repoRoot
      },
      referenceExcess
    },
    masks: {
      corridorCellCount: corridorIndices.length,
      sectorCellCount: sectorIndices.length,
      sectorOutsideCorridorCellCount: sectorOutsideCorridor.length
    },
    experiments: {
      columnNoTransport: columnExperiment,
      sectorCurtain: sectorCurtainExperiment,
      advectionOnlyCurtain: advectionOnlyExperiment
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
    experiments: Object.values(result.experiments),
    assessment: result.rootCauseAssessment
  });
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    decision: result.rootCauseAssessment.decision,
    columnTargetReproductionFrac: result.experiments.columnNoTransport.targetReproductionFrac,
    sectorCurtainTargetReproductionFrac: result.experiments.sectorCurtain.targetReproductionFrac,
    advectionOnlyCurtainTargetReproductionFrac: result.experiments.advectionOnlyCurtain.targetReproductionFrac
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  summarizeReproduction,
  classifyReducedOrderOutcome
};
