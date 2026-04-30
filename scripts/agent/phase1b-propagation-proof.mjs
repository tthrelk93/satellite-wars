#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { advanceToModelDayFully } from './advance-fully.mjs';
import {
  CLOUD_BIRTH_LEVEL_BAND_COUNT,
  cloudBirthBandOffset,
  findCloudBirthLevelBandIndex,
  sigmaMidAtLevel
} from '../../src/weather/v2/cloudBirthTracing5.js';

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
  'phase1b-propagation-proof'
);
const DEFAULT_FAILED_LEDGER_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1b-prevertical-boundary-ledger.json'
);
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;

let contractPath = DEFAULT_CONTRACT_PATH;
let reportBase = DEFAULT_REPORT_BASE;
let failedLedgerPath = DEFAULT_FAILED_LEDGER_PATH;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--failed-ledger' && argv[i + 1]) failedLedgerPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--failed-ledger=')) failedLedgerPath = path.resolve(arg.slice('--failed-ledger='.length));
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const sum = corridorProof.sum || ((values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const sumUpperCloudMassAtCell = (state, cellIndex) => {
  if (!state?.pHalf || !state?.sigmaHalf) return 0;
  const { N, nz, pHalf, sigmaHalf, qc, qi, qr } = state;
  const qs = state.qs;
  let totalMass = 0;
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
    if (sigmaMid > UPPER_SIGMA_MAX) continue;
    const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
    if (!(dp > 0)) continue;
    const idx = lev * N + cellIndex;
    const mixingRatio =
      (qc?.[idx] || 0)
      + (qi?.[idx] || 0)
      + (qr?.[idx] || 0)
      + (qs?.[idx] || 0);
    if (!(mixingRatio > 0)) continue;
    totalMass += mixingRatio * (dp / G);
  }
  return totalMass;
};

const buildConfiguredCore = async (modules, contract) => corridorProof.suppressProcessOutput(async () => {
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

const computeStepCadence = (core) => {
  const lodActive = core.lodParams?.enable && core.simSpeed > core.lodParams.simSpeedThreshold;
  const microEvery = Math.max(1, Number(core.lodParams?.microphysicsEvery) || 1);
  const radEvery = Math.max(1, Number(core.lodParams?.radiationEvery) || 1);
  return {
    doRadiation: !lodActive || (core._dynStepIndex % radEvery === 0),
    doMicrophysics: !lodActive || (core._dynStepIndex % microEvery === 0)
  };
};

const buildNeighborSet = ({ core, targetCell, corridorIndices }) => {
  const corridorSet = new Set(corridorIndices);
  const neighbors = [];
  for (let dj = -1; dj <= 1; dj += 1) {
    for (let di = -1; di <= 1; di += 1) {
      const rowIndex = targetCell.rowIndex + dj;
      if (rowIndex < 0 || rowIndex >= core.grid.ny) continue;
      const colIndex = (targetCell.colIndex + di + core.grid.nx) % core.grid.nx;
      const idx = rowIndex * core.grid.nx + colIndex;
      if (corridorSet.has(idx)) neighbors.push(idx);
    }
  }
  return [...new Set(neighbors)];
};

const capturePreVerticalBandMass = ({ state, cellIndices }) => {
  const out = new Map();
  for (const cellIndex of cellIndices) {
    const bands = new Float64Array(CLOUD_BIRTH_LEVEL_BAND_COUNT);
    for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BAND_COUNT; bandIndex += 1) {
      bands[bandIndex] = Number(state.prevUpperCloudBandMass?.[cloudBirthBandOffset(bandIndex, cellIndex, state.N)] || 0);
    }
    out.set(cellIndex, bands);
  }
  return out;
};

const computeUpperBandMassesForCell = (state, cellIndex) => {
  const { N, nz, pHalf, sigmaHalf, qc, qi, qr } = state;
  const qs = state.qs;
  const bands = new Float64Array(CLOUD_BIRTH_LEVEL_BAND_COUNT);
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
    if (sigmaMid > UPPER_SIGMA_MAX) continue;
    const bandIndex = findCloudBirthLevelBandIndex(sigmaMid);
    const idx = lev * N + cellIndex;
    const dp = pHalf[(lev + 1) * N + cellIndex] - pHalf[lev * N + cellIndex];
    if (!(dp > 0)) continue;
    const mixingRatio =
      (qc?.[idx] || 0)
      + (qi?.[idx] || 0)
      + (qr?.[idx] || 0)
      + (qs?.[idx] || 0);
    if (!(mixingRatio > 0)) continue;
    bands[bandIndex] += mixingRatio * (dp / G);
  }
  return bands;
};

const scaleUpperBandMass = ({ state, cellIndex, bandIndex, keepFrac }) => {
  const { N, nz, pHalf, sigmaHalf, qc, qi, qr } = state;
  const qs = state.qs;
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
    if (sigmaMid > UPPER_SIGMA_MAX) continue;
    if (findCloudBirthLevelBandIndex(sigmaMid) !== bandIndex) continue;
    const idx = lev * N + cellIndex;
    qc[idx] *= keepFrac;
    qi[idx] *= keepFrac;
    qr[idx] *= keepFrac;
    qs[idx] *= keepFrac;
  }
};

const applyCarryoverClearIntervention = ({ state, cellIndices, preBandMassByCell, strength = 1 }) => {
  const summary = {
    targetRemovedKgM2: 0,
    corridorRemovedKgM2: 0,
    targetRemovedFrac: 0,
    corridorRemovedFrac: 0,
    targetInitialCarryKgM2: 0,
    corridorInitialCarryKgM2: 0
  };
  for (const cellIndex of cellIndices) {
    const currentBandMass = computeUpperBandMassesForCell(state, cellIndex);
    const prevBandMass = preBandMassByCell.get(cellIndex) || new Float64Array(CLOUD_BIRTH_LEVEL_BAND_COUNT);
    let removedCell = 0;
    let carryCell = 0;
    for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BAND_COUNT; bandIndex += 1) {
      const currentMass = currentBandMass[bandIndex] || 0;
      const previousMass = prevBandMass[bandIndex] || 0;
      if (!(currentMass > 0)) continue;
      const carryMass = Math.min(previousMass, currentMass);
      if (!(carryMass > 0)) continue;
      const removalMass = Math.min(currentMass, carryMass * strength);
      const keepFrac = Math.max(0, (currentMass - removalMass) / currentMass);
      scaleUpperBandMass({ state, cellIndex, bandIndex, keepFrac });
      removedCell += removalMass;
      carryCell += carryMass;
    }
    summary.corridorRemovedKgM2 += removedCell;
    summary.corridorInitialCarryKgM2 += carryCell;
    if (removedCell > summary.targetRemovedKgM2) {
      summary.targetRemovedKgM2 = removedCell;
      summary.targetInitialCarryKgM2 = carryCell;
    }
  }
  summary.targetRemovedKgM2 = round(summary.targetRemovedKgM2, 5);
  summary.corridorRemovedKgM2 = round(summary.corridorRemovedKgM2, 5);
  summary.targetInitialCarryKgM2 = round(summary.targetInitialCarryKgM2, 5);
  summary.corridorInitialCarryKgM2 = round(summary.corridorInitialCarryKgM2, 5);
  summary.targetRemovedFrac = round(
    summary.targetInitialCarryKgM2 > 0 ? summary.targetRemovedKgM2 / summary.targetInitialCarryKgM2 : 0,
    5
  );
  summary.corridorRemovedFrac = round(
    summary.corridorInitialCarryKgM2 > 0 ? summary.corridorRemovedKgM2 / summary.corridorInitialCarryKgM2 : 0,
    5
  );
  return summary;
};

const aggregateScenarioFields = (state, targetCell, corridorIndices) => {
  const aggregate = (field) => round(sum(corridorIndices.map((idx) => Number(field?.[idx]) || 0)), 5);
  return {
    targetCell: {
      upperCloudMassKgM2: round(sumUpperCloudMassAtCell(state, targetCell.cellIndex), 5),
      largeScaleCondensationSourceKgM2: round(Number(state.largeScaleCondensationSource?.[targetCell.cellIndex]) || 0, 5),
      microphysicsUpperCloudInputMassKgM2: round(Number(state.microphysicsUpperCloudInputMass?.[targetCell.cellIndex]) || 0, 5),
      microphysicsUpperCloudSaturationBirthMassKgM2: round(Number(state.microphysicsUpperCloudSaturationBirthMass?.[targetCell.cellIndex]) || 0, 5),
      microphysicsUpperCloudCloudToPrecipMassKgM2: round(Number(state.microphysicsUpperCloudCloudToPrecipMass?.[targetCell.cellIndex]) || 0, 5),
      microphysicsUpperCloudCloudReevaporationMassKgM2: round(Number(state.microphysicsUpperCloudCloudReevaporationMass?.[targetCell.cellIndex]) || 0, 5),
      microphysicsUpperCloudOutputMassKgM2: round(Number(state.microphysicsUpperCloudOutputMass?.[targetCell.cellIndex]) || 0, 5)
    },
    corridorBand: {
      upperCloudMassKgM2: round(sum(corridorIndices.map((idx) => sumUpperCloudMassAtCell(state, idx))), 5),
      largeScaleCondensationSourceKgM2: aggregate(state.largeScaleCondensationSource),
      microphysicsUpperCloudInputMassKgM2: aggregate(state.microphysicsUpperCloudInputMass),
      microphysicsUpperCloudSaturationBirthMassKgM2: aggregate(state.microphysicsUpperCloudSaturationBirthMass),
      microphysicsUpperCloudCloudToPrecipMassKgM2: aggregate(state.microphysicsUpperCloudCloudToPrecipMass),
      microphysicsUpperCloudCloudReevaporationMassKgM2: aggregate(state.microphysicsUpperCloudCloudReevaporationMass),
      microphysicsUpperCloudOutputMassKgM2: aggregate(state.microphysicsUpperCloudOutputMass)
    }
  };
};

const advanceCurrentStepRemainder = ({ core, modules }) => {
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  const { doMicrophysics } = computeStepCadence(core);
  if (typeof core.vertParams?.enableConvectiveOutcome === 'boolean') {
    core.microParams.enableConvectiveOutcome = core.vertParams.enableConvectiveOutcome;
  }
  if (doMicrophysics) {
    modules.stepMicrophysics5({ dt: core.modelDt, state: core.state, params: core.microParams });
    if (typeof core._closeSurfaceSourceTracerBudget === 'function') {
      core._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
    }
  }
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
};

const computeReductionSummary = ({ control, scenario, targetCell, corridorIndices, intervention }) => {
  const postVerticalTargetReduction = round(
    (control.postVertical.targetCell.upperCloudMassKgM2 || 0)
      - (scenario.postIntervention.targetCell.upperCloudMassKgM2 || 0),
    5
  );
  const boundaryTargetReduction = round(
    (control.nextReplayBoundary.targetCell.upperCloudMassKgM2 || 0)
      - (scenario.nextReplayBoundary.targetCell.upperCloudMassKgM2 || 0),
    5
  );
  const postVerticalCorridorReduction = round(
    (control.postVertical.corridorBand.upperCloudMassKgM2 || 0)
      - (scenario.postIntervention.corridorBand.upperCloudMassKgM2 || 0),
    5
  );
  const boundaryCorridorReduction = round(
    (control.nextReplayBoundary.corridorBand.upperCloudMassKgM2 || 0)
      - (scenario.nextReplayBoundary.corridorBand.upperCloudMassKgM2 || 0),
    5
  );
  const targetSurvivalFrac = round(
    postVerticalTargetReduction > 0 ? boundaryTargetReduction / postVerticalTargetReduction : 0,
    5
  );
  const corridorSurvivalFrac = round(
    postVerticalCorridorReduction > 0 ? boundaryCorridorReduction / postVerticalCorridorReduction : 0,
    5
  );
  const targetRebuildKgM2 = round(postVerticalTargetReduction - boundaryTargetReduction, 5);
  const corridorRebuildKgM2 = round(postVerticalCorridorReduction - boundaryCorridorReduction, 5);
  const targetSaturationBirthRebuildKgM2 = round(
    (scenario.nextReplayBoundary.targetCell.microphysicsUpperCloudSaturationBirthMassKgM2 || 0)
      - (control.nextReplayBoundary.targetCell.microphysicsUpperCloudSaturationBirthMassKgM2 || 0),
    5
  );
  const corridorSaturationBirthRebuildKgM2 = round(
    (scenario.nextReplayBoundary.corridorBand.microphysicsUpperCloudSaturationBirthMassKgM2 || 0)
      - (control.nextReplayBoundary.corridorBand.microphysicsUpperCloudSaturationBirthMassKgM2 || 0),
    5
  );
  const targetCondensationShare = round(
    targetRebuildKgM2 > 0 ? Math.min(1, Math.max(0, targetSaturationBirthRebuildKgM2 / targetRebuildKgM2)) : 0,
    5
  );
  const corridorCondensationShare = round(
    corridorRebuildKgM2 > 0 ? Math.min(1, Math.max(0, corridorSaturationBirthRebuildKgM2 / corridorRebuildKgM2)) : 0,
    5
  );
  const verdict = classifyScenario({
    targetSurvivalFrac,
    targetRebuildKgM2,
    targetSaturationBirthRebuildKgM2,
    corridorSurvivalFrac
  });
  return {
    targetCell: {
      controlPostVerticalUpperCloudMassKgM2: control.postVertical.targetCell.upperCloudMassKgM2 || 0,
      scenarioPostVerticalUpperCloudMassKgM2: scenario.postIntervention.targetCell.upperCloudMassKgM2 || 0,
      postVerticalReductionKgM2: postVerticalTargetReduction,
      controlNextReplayBoundaryUpperCloudMassKgM2: control.nextReplayBoundary.targetCell.upperCloudMassKgM2 || 0,
      scenarioNextReplayBoundaryUpperCloudMassKgM2: scenario.nextReplayBoundary.targetCell.upperCloudMassKgM2 || 0,
      nextReplayBoundaryReductionKgM2: boundaryTargetReduction,
      reductionSurvivalFrac: targetSurvivalFrac,
      regainedBeforeNextBoundaryKgM2: targetRebuildKgM2,
      saturationBirthRebuildKgM2: targetSaturationBirthRebuildKgM2,
      saturationBirthShareOfRebuildFrac: targetCondensationShare
    },
    corridorBand: {
      controlPostVerticalUpperCloudMassKgM2: control.postVertical.corridorBand.upperCloudMassKgM2 || 0,
      scenarioPostVerticalUpperCloudMassKgM2: scenario.postIntervention.corridorBand.upperCloudMassKgM2 || 0,
      postVerticalReductionKgM2: postVerticalCorridorReduction,
      controlNextReplayBoundaryUpperCloudMassKgM2: control.nextReplayBoundary.corridorBand.upperCloudMassKgM2 || 0,
      scenarioNextReplayBoundaryUpperCloudMassKgM2: scenario.nextReplayBoundary.corridorBand.upperCloudMassKgM2 || 0,
      nextReplayBoundaryReductionKgM2: boundaryCorridorReduction,
      reductionSurvivalFrac: corridorSurvivalFrac,
      regainedBeforeNextBoundaryKgM2: corridorRebuildKgM2,
      saturationBirthRebuildKgM2: corridorSaturationBirthRebuildKgM2,
      saturationBirthShareOfRebuildFrac: corridorCondensationShare
    },
    verdict,
    intervention
  };
};

const classifyScenario = ({
  targetSurvivalFrac,
  targetRebuildKgM2,
  targetSaturationBirthRebuildKgM2,
  corridorSurvivalFrac
}) => {
  if (
    targetSurvivalFrac < 0.5
    && targetRebuildKgM2 > 0
    && targetSaturationBirthRebuildKgM2 > 0.1
  ) {
    return {
      key: 'microphysics_local_maintenance_dominant',
      explanation: 'Most of the local post-vertical reduction is rebuilt before the next replay boundary, and the rebuild is strongly explained by increased saturation-adjustment cloud birth inside stepMicrophysics5.'
    };
  }
  if (targetSurvivalFrac >= 0.75 && corridorSurvivalFrac >= 0.75) {
    return {
      key: 'vertical_correction_survives_boundary',
      explanation: 'The local vertical correction mostly survives to the next replay boundary, so the earlier failed patch was likely an implementation mismatch rather than immediate local rebound.'
    };
  }
  return {
    key: 'mixed_propagation_failure',
    explanation: 'The local correction only partly survives to the next replay boundary. Some of the loss is local microphysics maintenance, but the rebound is not explained by one dominant immediate term alone.'
  };
};

const runControlPath = async ({ checkpointCore, modules, targetCell, corridorIndices }) => corridorProof.suppressProcessOutput(async () => {
  const clone = await corridorProof.cloneCoreFromSource(modules, checkpointCore);
  corridorProof.runPreVerticalSequence(clone, modules, clone.modelDt);
  const preBandMassByCell = capturePreVerticalBandMass({
    state: clone.state,
    cellIndices: corridorIndices
  });
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
  const postVertical = aggregateScenarioFields(clone.state, targetCell, corridorIndices);
  advanceCurrentStepRemainder({ core: clone, modules });
  const nextReplayBoundary = aggregateScenarioFields(clone.state, targetCell, corridorIndices);
  return {
    postVertical,
    nextReplayBoundary,
    preBandMassByCell,
    checkpointState: clone
  };
});

const runScenarioPath = async ({
  controlClone,
  modules,
  targetCell,
  corridorIndices,
  preBandMassByCell,
  scenario
}) => corridorProof.suppressProcessOutput(async () => {
  const clone = await corridorProof.cloneCoreFromSource(modules, controlClone);
  const intervention = applyCarryoverClearIntervention({
    state: clone.state,
    cellIndices: scenario.cellIndices,
    preBandMassByCell,
    strength: 1
  });
  const postIntervention = aggregateScenarioFields(clone.state, targetCell, corridorIndices);
  advanceCurrentStepRemainder({ core: clone, modules });
  const nextReplayBoundary = aggregateScenarioFields(clone.state, targetCell, corridorIndices);
  return {
    key: scenario.key,
    label: scenario.label,
    cellCount: scenario.cellIndices.length,
    postIntervention,
    nextReplayBoundary,
    intervention
  };
});

const buildReport = ({ contract, control, scenarios, currentCommit, neighborhoodSize }) => {
  const ranked = scenarios
    .map((scenario) => ({
      key: scenario.key,
      label: scenario.label,
      cellCount: scenario.cellCount,
      ...computeReductionSummary({
        control,
        scenario,
        targetCell: contract.corridor.targetCell,
        corridorIndices: null,
        intervention: scenario.intervention
      })
    }))
    .sort((a, b) => (b.targetCell.reductionSurvivalFrac || 0) - (a.targetCell.reductionSurvivalFrac || 0));
  const best = ranked[0] || null;
  let failedPatchComparison = null;
  if (failedLedgerPath && fs.existsSync(failedLedgerPath)) {
    const failedLedger = readJson(failedLedgerPath);
    const failedBoundary = failedLedger?.traces?.current?.endPreviousStepMicrophysics5?.targetCell || null;
    if (failedBoundary) {
      failedPatchComparison = {
        sourcePath: failedLedgerPath,
        failedPatchNextReplayBoundaryUpperCloudMassKgM2: round(failedBoundary.upperCloudMassKgM2 || 0, 5),
        bestSyntheticScenarioKey: best?.key || null,
        bestSyntheticScenarioNextReplayBoundaryUpperCloudMassKgM2: round(
          best?.targetCell?.scenarioNextReplayBoundaryUpperCloudMassKgM2 || 0,
          5
        )
      };
    }
  }
  const decision = best?.verdict?.key === 'microphysics_local_maintenance_dominant'
    ? {
        key: 'next_boundary_rebuild_is_local_microphysics_maintenance',
        explanation: 'A current-step vertical carryover clear does improve the frozen handoff locally, but most of that reduction is rebuilt before the next replay boundary by same-step microphysics saturation-adjustment cloud birth. That is why the local fix can look right in the frozen corridor yet still fail to lower the owned endPreviousStepMicrophysics5 reservoir one replay boundary later.'
      }
    : best?.targetCell?.reductionSurvivalFrac >= 0.75
      ? {
          key: 'failed_patch_was_implementation_mismatch',
          explanation: 'A true current-step carryover-clear correction survives to the next replay boundary. That means the rejected patch did not fail because the corrected signal was immediately rebuilt by same-step propagation. It failed because the implementation never actually delivered the intended owner reduction in the live replay chain.'
        }
      : {
          key: 'propagation_failure_is_mixed_or_inconclusive',
          explanation: best?.verdict?.explanation || 'The propagation proof did not isolate one dominant immediate rebound path.'
        };
  return {
    schema: 'satellite-wars.phase1b-propagation-proof.v1',
    generatedAt: new Date().toISOString(),
    contract: {
      targetCell: contract.corridor.targetCell,
      checkpointDay: contract.corridor.checkpointDay,
      historicalCommit: contract.baselineRoots?.historical?.commit || null,
      currentProofCommit: currentCommit
    },
    scenarios: ranked,
    decision,
    failedPatchComparison,
    context: {
      neighborhoodCellCount: neighborhoodSize
    }
  };
};

const renderMarkdown = (report) => {
  const lines = [];
  lines.push('# Phase 1B Propagation Proof');
  lines.push('');
  lines.push(`- Frozen target cell: ${report.contract.targetCell.cellIndex} (lat ${report.contract.targetCell.latDeg}, lon ${report.contract.targetCell.lonDeg})`);
  lines.push(`- Checkpoint day: ${report.contract.checkpointDay}`);
  lines.push(`- Historical reference: ${report.contract.historicalCommit}`);
  lines.push(`- Current proof commit: ${report.contract.currentProofCommit}`);
  lines.push('');
  lines.push('## Decision');
  lines.push('');
  lines.push(`- Verdict: \`${report.decision.key}\``);
  lines.push(`- Explanation: ${report.decision.explanation}`);
  lines.push('');
  lines.push('## Scenario ranking');
  lines.push('');
  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.label}`);
    lines.push(`- Cells cleared: ${scenario.cellCount}`);
    lines.push(`- Target post-vertical reduction: ${scenario.targetCell.postVerticalReductionKgM2} kg/m²`);
    lines.push(`- Target next-boundary reduction: ${scenario.targetCell.nextReplayBoundaryReductionKgM2} kg/m²`);
    lines.push(`- Target survival: ${scenario.targetCell.reductionSurvivalFrac}`);
    lines.push(`- Target rebuild before next boundary: ${scenario.targetCell.regainedBeforeNextBoundaryKgM2} kg/m²`);
    lines.push(`- Target saturation-birth rebuild: ${scenario.targetCell.saturationBirthRebuildKgM2} kg/m²`);
    lines.push(`- Corridor survival: ${scenario.corridorBand.reductionSurvivalFrac}`);
    lines.push(`- Scenario verdict: \`${scenario.verdict.key}\``);
    lines.push('');
  }
  if (report.failedPatchComparison) {
    lines.push('## Failed Patch Comparison');
    lines.push('');
    lines.push(`- Failed patch next replay boundary mass: ${report.failedPatchComparison.failedPatchNextReplayBoundaryUpperCloudMassKgM2} kg/m²`);
    lines.push(`- Best synthetic scenario: ${report.failedPatchComparison.bestSyntheticScenarioKey}`);
    lines.push(`- Best synthetic scenario next replay boundary mass: ${report.failedPatchComparison.bestSyntheticScenarioNextReplayBoundaryUpperCloudMassKgM2} kg/m²`);
    lines.push('');
  }
  return lines.join('\n');
};

const main = async () => {
  const contract = readJson(contractPath);
  const modules = await corridorProof.importBaselineModules(repoRoot);
  const checkpointCore = await buildConfiguredCore(modules, contract);
  await corridorProof.suppressProcessOutput(async () => {
    advanceToModelDayFully(checkpointCore, contract.corridor.checkpointDay);
  });

  const corridorIndices = corridorProof.buildCorridorMask(checkpointCore, {
    sector: contract.corridor.sectorKey,
    latMin: contract.corridor.latBandDeg[0],
    latMax: contract.corridor.latBandDeg[1]
  });
  const targetCell = contract.corridor.targetCell;
  const neighborhoodIndices = buildNeighborSet({
    core: checkpointCore,
    targetCell,
    corridorIndices
  });
  const control = await runControlPath({
    checkpointCore,
    modules,
    targetCell,
    corridorIndices
  });

  const scenarios = [];
  for (const scenario of [
    {
      key: 'targetCellCarryoverClear',
      label: 'Target-cell carryover clear',
      cellIndices: [targetCell.cellIndex]
    },
    {
      key: 'localNeighborhoodCarryoverClear',
      label: '3x3 neighborhood carryover clear',
      cellIndices: neighborhoodIndices
    },
    {
      key: 'corridorBandCarryoverClear',
      label: 'Whole corridor carryover clear',
      cellIndices: corridorIndices
    }
  ]) {
    scenarios.push(await runScenarioPath({
      controlClone: control.checkpointState,
      modules,
      targetCell,
      corridorIndices,
      preBandMassByCell: control.preBandMassByCell,
      scenario
    }));
  }

  const report = buildReport({
    contract,
    control,
    scenarios,
    currentCommit: commitAtRoot(repoRoot),
    neighborhoodSize: neighborhoodIndices.length
  });

  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(`${reportBase}.md`, `${renderMarkdown(report)}\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export const _test = {
  buildNeighborSet,
  classifyScenario,
  computeReductionSummary
};
