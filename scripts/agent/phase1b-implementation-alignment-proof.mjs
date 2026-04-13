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
const DEFAULT_SUPPORT_PROOF_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1b-exact-corridor-support-proof.json'
);
const DEFAULT_PROPAGATION_PROOF_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1b-propagation-proof.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1b-implementation-alignment-proof'
);
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;

let contractPath = DEFAULT_CONTRACT_PATH;
let supportProofPath = DEFAULT_SUPPORT_PROOF_PATH;
let propagationProofPath = DEFAULT_PROPAGATION_PROOF_PATH;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--support-proof' && argv[i + 1]) supportProofPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--support-proof=')) supportProofPath = path.resolve(arg.slice('--support-proof='.length));
  else if (arg === '--propagation-proof' && argv[i + 1]) propagationProofPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--propagation-proof=')) propagationProofPath = path.resolve(arg.slice('--propagation-proof='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
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

const capturePreVerticalBandMassForCell = ({ state, cellIndex }) => {
  const bands = new Float64Array(CLOUD_BIRTH_LEVEL_BAND_COUNT);
  for (let lev = 0; lev < state.nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(state.sigmaHalf, lev, state.nz);
    if (sigmaMid > UPPER_SIGMA_MAX) continue;
    const bandIndex = findCloudBirthLevelBandIndex(sigmaMid);
    const idx = lev * state.N + cellIndex;
    const dp = state.pHalf[(lev + 1) * state.N + cellIndex] - state.pHalf[lev * state.N + cellIndex];
    if (!(dp > 0)) continue;
    const mixingRatio =
      (state.qc?.[idx] || 0)
      + (state.qi?.[idx] || 0)
      + (state.qr?.[idx] || 0)
      + (state.qs?.[idx] || 0);
    if (!(mixingRatio > 0)) continue;
    bands[bandIndex] += mixingRatio * (dp / G);
  }
  return bands;
};

const scaleUpperBandMass = ({ state, cellIndex, bandIndex, keepFrac }) => {
  for (let lev = 0; lev < state.nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(state.sigmaHalf, lev, state.nz);
    if (sigmaMid > UPPER_SIGMA_MAX) continue;
    if (findCloudBirthLevelBandIndex(sigmaMid) !== bandIndex) continue;
    const idx = lev * state.N + cellIndex;
    state.qc[idx] *= keepFrac;
    state.qi[idx] *= keepFrac;
    state.qr[idx] *= keepFrac;
    state.qs[idx] *= keepFrac;
  }
};

const applyTargetCarryoverClear = ({ state, cellIndex, preBandMass }) => {
  const currentBandMass = capturePreVerticalBandMassForCell({ state, cellIndex });
  let removedMass = 0;
  let initialCarryMass = 0;
  for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BAND_COUNT; bandIndex += 1) {
    const currentMass = currentBandMass[bandIndex] || 0;
    const previousMass = preBandMass[bandIndex] || 0;
    if (!(currentMass > 0)) continue;
    const carryMass = Math.min(previousMass, currentMass);
    if (!(carryMass > 0)) continue;
    const removalMass = Math.min(currentMass, carryMass);
    const keepFrac = Math.max(0, (currentMass - removalMass) / currentMass);
    scaleUpperBandMass({ state, cellIndex, bandIndex, keepFrac });
    removedMass += removalMass;
    initialCarryMass += carryMass;
  }
  return {
    removedMassKgM2: round(removedMass, 5),
    initialCarryMassKgM2: round(initialCarryMass, 5)
  };
};

const captureVerticalState = ({ state, cellIndex }) => ({
  upperCloudPathKgM2: round(sumUpperCloudMassAtCell(state, cellIndex), 5),
  carriedOverUpperCloudMassKgM2: round(Number(state.carriedOverUpperCloudMass?.[cellIndex]) || 0, 5),
  upperCloudStaleMassKgM2: round(Number(state.upperCloudStaleMass?.[cellIndex]) || 0, 5),
  upperCloudAppliedErosionMassKgM2: round(Number(state.upperCloudAppliedErosionMass?.[cellIndex]) || 0, 5),
  upperCloudBlockedErosionMassKgM2: round(Number(state.upperCloudBlockedErosionMass?.[cellIndex]) || 0, 5),
  verticalUpperCloudInputMassKgM2: round(Number(state.verticalUpperCloudInputMass?.[cellIndex]) || 0, 5),
  verticalUpperCloudResolvedBirthMassKgM2: round(Number(state.verticalUpperCloudResolvedBirthMass?.[cellIndex]) || 0, 5),
  verticalUpperCloudConvectiveBirthMassKgM2: round(Number(state.verticalUpperCloudConvectiveBirthMass?.[cellIndex]) || 0, 5),
  verticalUpperCloudCarrySurvivingMassKgM2: round(Number(state.verticalUpperCloudCarrySurvivingMass?.[cellIndex]) || 0, 5),
  verticalUpperCloudAppliedErosionMassKgM2: round(Number(state.verticalUpperCloudAppliedErosionMass?.[cellIndex]) || 0, 5),
  verticalUpperCloudHandedToMicrophysicsMassKgM2: round(Number(state.verticalUpperCloudHandedToMicrophysicsMass?.[cellIndex]) || 0, 5),
  verticalUpperCloudResidualMassKgM2: round(Number(state.verticalUpperCloudResidualMass?.[cellIndex]) || 0, 5),
  lowLevelOmegaEffectiveDiagPaS: round(Number(state.lowLevelOmegaEffective?.[cellIndex]) || 0, 5),
  lowLevelMoistureConvergenceDiagS_1: round(Number(state.lowLevelMoistureConvergence?.[cellIndex]) || 0, 8),
  convectivePotential: round(Number(state.convectivePotential?.[cellIndex]) || 0, 5),
  convectiveOrganization: round(Number(state.convectiveOrganization?.[cellIndex]) || 0, 5),
  convectiveMassFluxKgM2S: round(Number(state.convectiveMassFlux?.[cellIndex]) || 0, 5),
  convectiveDetrainmentMassKgM2: round(Number(state.convectiveDetrainmentMass?.[cellIndex]) || 0, 5),
  convectiveAnvilSource: round(Number(state.convectiveAnvilSource?.[cellIndex]) || 0, 5)
});

const runPreVerticalSequence = corridorProof.runPreVerticalSequence;

const captureBaselineAndSyntheticVerticalStates = async ({ contract }) => {
  const modules = await corridorProof.importBaselineModules(repoRoot);
  const checkpointCore = await buildConfiguredCore(modules, contract);
  await corridorProof.suppressProcessOutput(async () => {
    advanceToModelDayFully(checkpointCore, contract.corridor.checkpointDay);
  });
  return corridorProof.suppressProcessOutput(async () => {
    const clone = await corridorProof.cloneCoreFromSource(modules, checkpointCore);
    runPreVerticalSequence(clone, modules, clone.modelDt);
    const targetCell = contract.corridor.targetCell;
    const preBandMass = capturePreVerticalBandMassForCell({
      state: clone.state,
      cellIndex: targetCell.cellIndex
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
    const baseline = captureVerticalState({ state: clone.state, cellIndex: targetCell.cellIndex });
    const intervention = applyTargetCarryoverClear({
      state: clone.state,
      cellIndex: targetCell.cellIndex,
      preBandMass
    });
    const synthetic = captureVerticalState({ state: clone.state, cellIndex: targetCell.cellIndex });
    return {
      baseline,
      synthetic,
      intervention,
      currentCommit: commitAtRoot(repoRoot)
    };
  });
};

const deriveRequiredVerticalDeltas = ({ baseline, synthetic, intervention }) => ({
  mustChange: {
    upperCloudPathKgM2: {
      from: baseline.upperCloudPathKgM2,
      to: synthetic.upperCloudPathKgM2,
      delta: round((synthetic.upperCloudPathKgM2 || 0) - (baseline.upperCloudPathKgM2 || 0), 5)
    },
    carriedOverUpperCloudMassKgM2: {
      from: baseline.carriedOverUpperCloudMassKgM2,
      to: synthetic.carriedOverUpperCloudMassKgM2,
      delta: round((synthetic.carriedOverUpperCloudMassKgM2 || 0) - (baseline.carriedOverUpperCloudMassKgM2 || 0), 5)
    },
    upperCloudStaleMassKgM2: {
      from: baseline.upperCloudStaleMassKgM2,
      to: synthetic.upperCloudStaleMassKgM2,
      delta: round((synthetic.upperCloudStaleMassKgM2 || 0) - (baseline.upperCloudStaleMassKgM2 || 0), 5)
    },
    upperCloudAppliedErosionMassKgM2: {
      from: baseline.upperCloudAppliedErosionMassKgM2,
      to: round((baseline.upperCloudAppliedErosionMassKgM2 || 0) + (intervention.removedMassKgM2 || 0), 5),
      delta: round(intervention.removedMassKgM2 || 0, 5)
    },
    upperCloudBlockedErosionMassKgM2: {
      from: baseline.upperCloudBlockedErosionMassKgM2,
      to: synthetic.carriedOverUpperCloudMassKgM2,
      delta: round((synthetic.carriedOverUpperCloudMassKgM2 || 0) - (baseline.upperCloudBlockedErosionMassKgM2 || 0), 5)
    },
    verticalUpperCloudCarrySurvivingMassKgM2: {
      from: baseline.verticalUpperCloudCarrySurvivingMassKgM2,
      to: synthetic.upperCloudPathKgM2,
      delta: round((synthetic.upperCloudPathKgM2 || 0) - (baseline.verticalUpperCloudCarrySurvivingMassKgM2 || 0), 5)
    },
    verticalUpperCloudAppliedErosionMassKgM2: {
      from: baseline.verticalUpperCloudAppliedErosionMassKgM2,
      to: round((baseline.verticalUpperCloudAppliedErosionMassKgM2 || 0) + (intervention.removedMassKgM2 || 0), 5),
      delta: round(intervention.removedMassKgM2 || 0, 5)
    },
    verticalUpperCloudHandedToMicrophysicsMassKgM2: {
      from: baseline.verticalUpperCloudHandedToMicrophysicsMassKgM2,
      to: synthetic.upperCloudPathKgM2,
      delta: round((synthetic.upperCloudPathKgM2 || 0) - (baseline.verticalUpperCloudHandedToMicrophysicsMassKgM2 || 0), 5)
    }
  },
  mustRemainStable: {
    verticalUpperCloudInputMassKgM2: baseline.verticalUpperCloudInputMassKgM2,
    verticalUpperCloudResolvedBirthMassKgM2: baseline.verticalUpperCloudResolvedBirthMassKgM2,
    verticalUpperCloudConvectiveBirthMassKgM2: baseline.verticalUpperCloudConvectiveBirthMassKgM2,
    lowLevelOmegaEffectiveDiagPaS: baseline.lowLevelOmegaEffectiveDiagPaS,
    lowLevelMoistureConvergenceDiagS_1: baseline.lowLevelMoistureConvergenceDiagS_1,
    convectivePotential: baseline.convectivePotential,
    convectiveOrganization: baseline.convectiveOrganization,
    convectiveMassFluxKgM2S: baseline.convectiveMassFluxKgM2S,
    convectiveDetrainmentMassKgM2: baseline.convectiveDetrainmentMassKgM2,
    convectiveAnvilSource: baseline.convectiveAnvilSource
  }
});

const buildAlignedStatePair = ({ supportProof, replay }) => {
  const stored = supportProof?.supportSnapshot?.current?.targetCell?.stored || {};
  const baseline = {
    ...replay.baseline,
    upperCloudPathKgM2: round(Number(stored.upperCloudPathKgM2) || replay.baseline.upperCloudPathKgM2 || 0, 5),
    carriedOverUpperCloudMassKgM2: round(Number(stored.carriedOverUpperCloudMassKgM2) || 0, 5),
    upperCloudStaleMassKgM2: round(Number(stored.upperCloudStaleMassKgM2) || 0, 5),
    upperCloudAppliedErosionMassKgM2: round(Number(stored.upperCloudAppliedErosionMassKgM2) || 0, 5),
    upperCloudBlockedErosionMassKgM2: round(Number(stored.upperCloudBlockedErosionMassKgM2) || 0, 5)
  };
  const removedMass = replay.intervention.removedMassKgM2 || 0;
  const syntheticUpperCloudPath = Math.max(0, (baseline.upperCloudPathKgM2 || 0) - removedMass);
  const synthetic = {
    ...replay.synthetic,
    upperCloudPathKgM2: round(syntheticUpperCloudPath, 5),
    carriedOverUpperCloudMassKgM2: round(Math.max(0, (baseline.carriedOverUpperCloudMassKgM2 || 0) - removedMass), 5),
    upperCloudStaleMassKgM2: round(Math.max(0, (baseline.upperCloudStaleMassKgM2 || 0) - removedMass), 5),
    upperCloudAppliedErosionMassKgM2: round((baseline.upperCloudAppliedErosionMassKgM2 || 0) + removedMass, 5),
    upperCloudBlockedErosionMassKgM2: round(Math.max(0, (baseline.upperCloudBlockedErosionMassKgM2 || 0) - removedMass), 5),
    verticalUpperCloudCarrySurvivingMassKgM2: round(Math.max(0, (replay.baseline.verticalUpperCloudCarrySurvivingMassKgM2 || 0) - removedMass), 5),
    verticalUpperCloudAppliedErosionMassKgM2: round((replay.baseline.verticalUpperCloudAppliedErosionMassKgM2 || 0) + removedMass, 5),
    verticalUpperCloudHandedToMicrophysicsMassKgM2: round(Math.max(0, (replay.baseline.verticalUpperCloudHandedToMicrophysicsMassKgM2 || 0) - removedMass), 5)
  };
  return { baseline, synthetic };
};

const buildTriggerEnvelope = (supportProof) => {
  const fresh = supportProof?.supportSnapshot?.current?.targetCell?.fresh || {};
  const stored = supportProof?.supportSnapshot?.current?.targetCell?.stored || {};
  return {
    requiredDirection: 'fire on fresh subtropical suppression with weak organized support and stale-reservoir dominance',
    mustFireWhen: {
      subtropicalSuppressionMin: round((fresh.subtropicalSuppression || 0) * 0.95, 5),
      organizedSupportMax: round((fresh.organizedSupport || 0) * 1.15, 5),
      freshPotentialTargetMax: round((fresh.freshPotentialTarget || 0) * 1.15, 5),
      staleCarryoverDominanceMin: round((fresh.staleCarryoverDominance || 0) * 0.95, 5),
      previousStepResidualUpperCloudMinKgM2: round(
        Math.max(
          Number(stored.carriedOverUpperCloudMassKgM2) || 0,
          Number(stored.upperCloudStaleMassKgM2) || 0,
          Number(stored.upperCloudPathKgM2) || 0
        ) * 0.95,
        5
      )
    },
    mustNotRequire: {
      strongerDescentThanObservedPaS: round(fresh.lowLevelOmegaRawPaS || 0, 5),
      strongConvectiveMassFluxKgM2S: round(stored.convectiveMassFluxKgM2S || 0, 5),
      localConvectiveDetrainmentKgM2: round(stored.convectiveDetrainmentMassKgM2 || 0, 5),
      convectiveAnvilSource: round(stored.convectiveAnvilSource || 0, 5)
    }
  };
};

const buildAlignmentVerdict = ({ requiredDeltas, propagationProof }) => {
  const mustChange = requiredDeltas.mustChange;
  const bestScenario = propagationProof?.scenarios?.[0] || null;
  return {
    key: 'live_patch_must_reproduce_synthetic_vertical_signature',
    explanation: 'The live patch should be considered aligned only if it reproduces the synthetic carryover-clear signature at the exact frozen target cell: carry-surviving mass, handed-to-microphysics mass, and stale upper-cloud mass must all fall sharply while the vertical input and local birth terms stay essentially unchanged.',
    acceptanceTargets: {
      targetPostVerticalUpperCloudMaxKgM2: round((bestScenario?.targetCell?.scenarioPostVerticalUpperCloudMassKgM2 || 0) + 0.1, 5),
      targetNextReplayBoundaryUpperCloudMaxKgM2: round((propagationProof?.failedPatchComparison?.bestSyntheticScenarioNextReplayBoundaryUpperCloudMassKgM2 || 0) + 0.1, 5),
      requiredCarrySurvivingDeltaKgM2: mustChange.verticalUpperCloudCarrySurvivingMassKgM2.delta,
      requiredHandedToMicrophysicsDeltaKgM2: mustChange.verticalUpperCloudHandedToMicrophysicsMassKgM2.delta,
      requiredAppliedErosionIncreaseKgM2: mustChange.verticalUpperCloudAppliedErosionMassKgM2.delta
    },
    falsificationRule: 'Reject the next live patch if it mainly changes downstream microphysics cleanup, advection, or resolved/convective birth while leaving the frozen target-cell carry-surviving and handed-to-microphysics masses materially above the synthetic target.'
  };
};

const renderMarkdown = (report) => {
  const lines = [];
  lines.push('# Phase 1B Implementation Alignment Proof');
  lines.push('');
  lines.push(`- Frozen target cell: ${report.contract.targetCell.cellIndex} (lat ${report.contract.targetCell.latDeg}, lon ${report.contract.targetCell.lonDeg})`);
  lines.push(`- Checkpoint day: ${report.contract.checkpointDay}`);
  lines.push(`- Current commit: ${report.contract.currentCommit}`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`- Verdict: \`${report.verdict.key}\``);
  lines.push(`- Explanation: ${report.verdict.explanation}`);
  lines.push('');
  lines.push('## Trigger Envelope');
  lines.push('');
  lines.push(`- Must fire at or above subtropical suppression: ${report.triggerEnvelope.mustFireWhen.subtropicalSuppressionMin}`);
  lines.push(`- Must fire at or below organized support: ${report.triggerEnvelope.mustFireWhen.organizedSupportMax}`);
  lines.push(`- Must fire at or below fresh potential target: ${report.triggerEnvelope.mustFireWhen.freshPotentialTargetMax}`);
  lines.push(`- Must fire at or above stale carryover dominance: ${report.triggerEnvelope.mustFireWhen.staleCarryoverDominanceMin}`);
  lines.push(`- Must not require stronger descent than: ${report.triggerEnvelope.mustNotRequire.strongerDescentThanObservedPaS} Pa/s`);
  lines.push('');
  lines.push('## Fields That Must Change');
  lines.push('');
  for (const [field, contract] of Object.entries(report.requiredDeltas.mustChange)) {
    lines.push(`- ${field}: ${contract.from} -> ${contract.to} (delta ${contract.delta})`);
  }
  lines.push('');
  lines.push('## Fields That Must Stay Stable');
  lines.push('');
  for (const [field, value] of Object.entries(report.requiredDeltas.mustRemainStable)) {
    lines.push(`- ${field}: ${value}`);
  }
  lines.push('');
  lines.push('## Acceptance Targets');
  lines.push('');
  lines.push(`- Target post-vertical upper-cloud max: ${report.verdict.acceptanceTargets.targetPostVerticalUpperCloudMaxKgM2} kg/m²`);
  lines.push(`- Target next replay boundary upper-cloud max: ${report.verdict.acceptanceTargets.targetNextReplayBoundaryUpperCloudMaxKgM2} kg/m²`);
  lines.push(`- Required carry-surviving delta: ${report.verdict.acceptanceTargets.requiredCarrySurvivingDeltaKgM2} kg/m²`);
  lines.push(`- Required handed-to-microphysics delta: ${report.verdict.acceptanceTargets.requiredHandedToMicrophysicsDeltaKgM2} kg/m²`);
  lines.push(`- Required applied-erosion increase: ${report.verdict.acceptanceTargets.requiredAppliedErosionIncreaseKgM2} kg/m²`);
  lines.push('');
  return lines.join('\n');
};

const main = async () => {
  const contract = readJson(contractPath);
  const supportProof = readJson(supportProofPath);
  const propagationProof = readJson(propagationProofPath);
  const replay = await captureBaselineAndSyntheticVerticalStates({ contract });
  const alignedStates = buildAlignedStatePair({ supportProof, replay });
  const requiredDeltas = deriveRequiredVerticalDeltas({
    baseline: alignedStates.baseline,
    synthetic: alignedStates.synthetic,
    intervention: replay.intervention
  });
  const report = {
    schema: 'satellite-wars.phase1b-implementation-alignment-proof.v1',
    generatedAt: new Date().toISOString(),
    contract: {
      targetCell: contract.corridor.targetCell,
      checkpointDay: contract.corridor.checkpointDay,
      currentCommit: replay.currentCommit
    },
    sourceArtifacts: {
      contractPath,
      supportProofPath,
      propagationProofPath
    },
    frozenCurrentState: alignedStates.baseline,
    syntheticAlignedState: alignedStates.synthetic,
    syntheticIntervention: replay.intervention,
    triggerEnvelope: buildTriggerEnvelope(supportProof),
    requiredDeltas,
    verdict: buildAlignmentVerdict({
      requiredDeltas,
      propagationProof
    })
  };
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
  deriveRequiredVerticalDeltas,
  buildTriggerEnvelope,
  buildAlignmentVerdict
};
