#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';
import { _test as supportProofTest } from './phase1b-exact-corridor-support-proof.mjs';
import { _test as alignmentProofTest } from './phase1b-implementation-alignment-proof.mjs';
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
const DEFAULT_OLD_ALIGNMENT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1b-implementation-alignment-proof.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1b-live-replay-reconciliation'
);
const DEFAULT_DESIGN_PATH = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1b-live-replay-patch-design.md'
);
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;

let contractPath = DEFAULT_CONTRACT_PATH;
let oldAlignmentPath = DEFAULT_OLD_ALIGNMENT_PATH;
let reportBase = DEFAULT_REPORT_BASE;
let designPath = DEFAULT_DESIGN_PATH;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--old-alignment' && argv[i + 1]) oldAlignmentPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--old-alignment=')) oldAlignmentPath = path.resolve(arg.slice('--old-alignment='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--design-path' && argv[i + 1]) designPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--design-path=')) designPath = path.resolve(arg.slice('--design-path='.length));
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

const captureLiveHandoffState = ({ state, cellIndex, freshSupport }) => {
  const upperCloudPathKgM2 = round(sumUpperCloudMassAtCell(state, cellIndex), 5);
  const carriedOverUpperCloudMassKgM2 = round(Number(state.carriedOverUpperCloudMass?.[cellIndex]) || 0, 5);
  const upperCloudStaleMassKgM2 = round(Number(state.upperCloudStaleMass?.[cellIndex]) || 0, 5);
  const verticalUpperCloudInputMassKgM2 = round(Number(state.verticalUpperCloudInputMass?.[cellIndex]) || 0, 5);
  const verticalUpperCloudCarrySurvivingMassKgM2 = round(Number(state.verticalUpperCloudCarrySurvivingMass?.[cellIndex]) || 0, 5);
  const staleCarryoverDominance = upperCloudPathKgM2 > 0
    ? round(carriedOverUpperCloudMassKgM2 / upperCloudPathKgM2, 5)
    : 0;
  const verticalCarryInputDominance = verticalUpperCloudInputMassKgM2 > 0
    ? round(verticalUpperCloudCarrySurvivingMassKgM2 / verticalUpperCloudInputMassKgM2, 5)
    : 0;
  return {
    upperCloudPathKgM2,
    carriedOverUpperCloudMassKgM2,
    upperCloudStaleMassKgM2,
    upperCloudAppliedErosionMassKgM2: round(Number(state.upperCloudAppliedErosionMass?.[cellIndex]) || 0, 5),
    upperCloudBlockedErosionMassKgM2: round(Number(state.upperCloudBlockedErosionMass?.[cellIndex]) || 0, 5),
    verticalUpperCloudInputMassKgM2,
    verticalUpperCloudResolvedBirthMassKgM2: round(Number(state.verticalUpperCloudResolvedBirthMass?.[cellIndex]) || 0, 5),
    verticalUpperCloudConvectiveBirthMassKgM2: round(Number(state.verticalUpperCloudConvectiveBirthMass?.[cellIndex]) || 0, 5),
    verticalUpperCloudCarrySurvivingMassKgM2,
    verticalUpperCloudAppliedErosionMassKgM2: round(Number(state.verticalUpperCloudAppliedErosionMass?.[cellIndex]) || 0, 5),
    verticalUpperCloudHandedToMicrophysicsMassKgM2: round(Number(state.verticalUpperCloudHandedToMicrophysicsMass?.[cellIndex]) || 0, 5),
    verticalUpperCloudResidualMassKgM2: round(Number(state.verticalUpperCloudResidualMass?.[cellIndex]) || 0, 5),
    convectivePotential: round(Number(state.convectivePotential?.[cellIndex]) || 0, 5),
    convectiveOrganization: round(Number(state.convectiveOrganization?.[cellIndex]) || 0, 5),
    convectiveMassFluxKgM2S: round(Number(state.convectiveMassFlux?.[cellIndex]) || 0, 5),
    convectiveDetrainmentMassKgM2: round(Number(state.convectiveDetrainmentMass?.[cellIndex]) || 0, 5),
    convectiveAnvilSource: round(Number(state.convectiveAnvilSource?.[cellIndex]) || 0, 5),
    lowLevelOmegaEffectiveDiagPaS: round(Number(state.lowLevelOmegaEffective?.[cellIndex]) || 0, 5),
    lowLevelMoistureConvergenceDiagS_1: round(Number(state.lowLevelMoistureConvergence?.[cellIndex]) || 0, 8),
    freshPotentialTarget: round(freshSupport.freshPotentialTarget || 0, 5),
    freshOrganizedSupport: round(freshSupport.organizedSupport || 0, 5),
    freshSubtropicalSuppression: round(freshSupport.subtropicalSuppression || 0, 5),
    staleCarryoverDominance,
    verticalCarryInputDominance,
    lowLevelOmegaRawPaS: round(freshSupport.lowLevelOmegaRawPaS || 0, 5),
    lowLevelMoistureConvergenceS_1: round(freshSupport.lowLevelMoistureConvergenceS_1 || 0, 8)
  };
};

const captureLiveReplayReconciliation = async ({ contract }) => {
  const modules = await corridorProof.importBaselineModules(repoRoot);
  const checkpointCore = await buildConfiguredCore(modules, contract);
  await corridorProof.suppressProcessOutput(async () => {
    advanceToModelDayFully(checkpointCore, contract.corridor.checkpointDay);
  });
  return corridorProof.suppressProcessOutput(async () => {
    const clone = await corridorProof.cloneCoreFromSource(modules, checkpointCore);
    corridorProof.runPreVerticalSequence(clone, modules, clone.modelDt);
    const targetCellIndex = contract.corridor.targetCell.cellIndex;
    const freshSupport = supportProofTest.computeFreshSupport({ core: clone, cellIndex: targetCellIndex });
    const preBandMass = capturePreVerticalBandMassForCell({
      state: clone.state,
      cellIndex: targetCellIndex
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
    const liveCurrentState = captureLiveHandoffState({
      state: clone.state,
      cellIndex: targetCellIndex,
      freshSupport
    });
    const intervention = applyTargetCarryoverClear({
      state: clone.state,
      cellIndex: targetCellIndex,
      preBandMass
    });
    const syntheticLiveTarget = captureLiveHandoffState({
      state: clone.state,
      cellIndex: targetCellIndex,
      freshSupport
    });
    return {
      liveCurrentState,
      syntheticLiveTarget,
      intervention,
      currentCommit: commitAtRoot(repoRoot)
    };
  });
};

const buildMassContractDrift = ({ oldAlignment, liveCurrentState }) => {
  const oldState = oldAlignment?.frozenCurrentState || {};
  const fields = [
    'upperCloudPathKgM2',
    'carriedOverUpperCloudMassKgM2',
    'upperCloudStaleMassKgM2',
    'verticalUpperCloudInputMassKgM2',
    'verticalUpperCloudCarrySurvivingMassKgM2',
    'verticalUpperCloudHandedToMicrophysicsMassKgM2'
  ];
  const fieldDrift = {};
  let maxAbsDelta = 0;
  for (const field of fields) {
    const oldValue = Number(oldState[field]) || 0;
    const liveValue = Number(liveCurrentState[field]) || 0;
    const delta = round(liveValue - oldValue, 5);
    const absDelta = round(Math.abs(delta), 5);
    maxAbsDelta = Math.max(maxAbsDelta, absDelta || 0);
    fieldDrift[field] = {
      old: round(oldValue, 5),
      live: round(liveValue, 5),
      delta,
      absDelta
    };
  }
  return {
    fieldDrift,
    maxAbsDeltaKgM2: round(maxAbsDelta, 5),
    staleMassContract: maxAbsDelta >= 0.5
  };
};

const evaluateOldGateCompatibility = ({ oldAlignment, liveCurrentState }) => {
  const oldGate = oldAlignment?.triggerEnvelope?.mustFireWhen || {};
  const liveReservoirKgM2 = Math.max(
    Number(liveCurrentState.verticalUpperCloudInputMassKgM2) || 0,
    Number(liveCurrentState.upperCloudPathKgM2) || 0,
    Number(liveCurrentState.carriedOverUpperCloudMassKgM2) || 0,
    Number(liveCurrentState.upperCloudStaleMassKgM2) || 0
  );
  const checks = {
    subtropicalSuppression: {
      threshold: round(Number(oldGate.subtropicalSuppressionMin) || 0, 5),
      observed: round(Number(liveCurrentState.freshSubtropicalSuppression) || 0, 5),
      pass: (Number(liveCurrentState.freshSubtropicalSuppression) || 0) >= (Number(oldGate.subtropicalSuppressionMin) || 0)
    },
    organizedSupport: {
      threshold: round(Number(oldGate.organizedSupportMax) || 0, 5),
      observed: round(Number(liveCurrentState.freshOrganizedSupport) || 0, 5),
      pass: (Number(liveCurrentState.freshOrganizedSupport) || 0) <= (Number(oldGate.organizedSupportMax) || 0)
    },
    freshPotentialTarget: {
      threshold: round(Number(oldGate.freshPotentialTargetMax) || 0, 5),
      observed: round(Number(liveCurrentState.freshPotentialTarget) || 0, 5),
      pass: (Number(liveCurrentState.freshPotentialTarget) || 0) <= (Number(oldGate.freshPotentialTargetMax) || 0)
    },
    staleCarryoverDominance: {
      threshold: round(Number(oldGate.staleCarryoverDominanceMin) || 0, 5),
      observed: round(Number(liveCurrentState.staleCarryoverDominance) || 0, 5),
      pass: (Number(liveCurrentState.staleCarryoverDominance) || 0) >= (Number(oldGate.staleCarryoverDominanceMin) || 0)
    },
    previousStepResidualUpperCloud: {
      threshold: round(Number(oldGate.previousStepResidualUpperCloudMinKgM2) || 0, 5),
      observed: round(liveReservoirKgM2, 5),
      pass: liveReservoirKgM2 >= (Number(oldGate.previousStepResidualUpperCloudMinKgM2) || 0)
    }
  };
  const mismatchedGates = Object.entries(checks)
    .filter(([, entry]) => !entry.pass)
    .map(([key, entry]) => ({
      gate: key,
      threshold: entry.threshold,
      observed: entry.observed
    }));
  return {
    checks,
    mismatchedGates,
    supportFamilyStillValid: mismatchedGates.every((entry) => (
      entry.gate === 'staleCarryoverDominance'
      || entry.gate === 'previousStepResidualUpperCloud'
    ))
  };
};

const buildReconciledTriggerContract = ({ oldAlignment, liveCurrentState, gateCompatibility }) => {
  const oldGate = oldAlignment?.triggerEnvelope?.mustFireWhen || {};
  const liveReservoirKgM2 = Math.max(
    Number(liveCurrentState.verticalUpperCloudInputMassKgM2) || 0,
    Number(liveCurrentState.upperCloudPathKgM2) || 0,
    Number(liveCurrentState.carriedOverUpperCloudMassKgM2) || 0,
    Number(liveCurrentState.upperCloudStaleMassKgM2) || 0
  );
  const observed = {
    freshPotentialTarget: round(Number(liveCurrentState.freshPotentialTarget) || 0, 5),
    freshOrganizedSupport: round(Number(liveCurrentState.freshOrganizedSupport) || 0, 5),
    freshSubtropicalSuppression: round(Number(liveCurrentState.freshSubtropicalSuppression) || 0, 5),
    staleCarryoverDominance: round(Number(liveCurrentState.staleCarryoverDominance) || 0, 5),
    previousStepResidualUpperCloudKgM2: round(liveReservoirKgM2, 5)
  };
  return {
    exactObservedLiveState: observed,
    recommendedEnvelope: {
      subtropicalSuppressionMin: round(
        gateCompatibility.checks.subtropicalSuppression.pass
          ? Number(oldGate.subtropicalSuppressionMin) || 0
          : observed.freshSubtropicalSuppression * 0.98,
        5
      ),
      organizedSupportMax: round(
        gateCompatibility.checks.organizedSupport.pass
          ? Number(oldGate.organizedSupportMax) || 0
          : observed.freshOrganizedSupport * 1.05,
        5
      ),
      freshPotentialTargetMax: round(
        gateCompatibility.checks.freshPotentialTarget.pass
          ? Number(oldGate.freshPotentialTargetMax) || 0
          : observed.freshPotentialTarget * 1.05,
        5
      ),
      staleCarryoverDominanceMin: gateCompatibility.checks.staleCarryoverDominance.pass
        ? round(Number(oldGate.staleCarryoverDominanceMin) || 0, 5)
        : null,
      verticalCarryInputDominanceMin: gateCompatibility.checks.staleCarryoverDominance.pass
        ? round(Number(liveCurrentState.verticalCarryInputDominance) || 0, 5)
        : round((Number(liveCurrentState.verticalCarryInputDominance) || 0) * 0.95, 5),
      previousStepResidualUpperCloudMinKgM2: round(
        gateCompatibility.checks.previousStepResidualUpperCloud.pass
          ? Number(oldGate.previousStepResidualUpperCloudMinKgM2) || 0
          : observed.previousStepResidualUpperCloudKgM2 * 0.95,
        5
      )
    },
    representationShift: {
      staleCarryoverDominanceFieldUsable: gateCompatibility.checks.staleCarryoverDominance.pass,
      explanation: gateCompatibility.checks.staleCarryoverDominance.pass
        ? 'The older stale-carryover dominance field remains usable at the exact live handoff.'
        : 'At the exact live handoff, the retained reservoir is expressed through vertical input and carry-surviving mass while carriedOverUpperCloudMass has already rolled to zero. Replace the old stale-carryover-dominance gate with a vertical carry-surviving-to-input dominance gate.'
    }
  };
};

const buildReconciledVerdict = ({ massContractDrift, gateCompatibility, requiredDeltas }) => ({
  key: 'old_alignment_contract_stale_use_live_reconciled_handoff_target',
  explanation: gateCompatibility.supportFamilyStillValid
    ? 'The older support-family trigger logic still broadly matches the real corridor, but the old mass/dominance contract is stale enough that a live patch can miss the actual replay state. The next patch must therefore be designed against the exact current live handoff, not the older static mass target.'
    : 'Both the old support-family trigger logic and the old mass contract have drifted away from the live replay state. The next patch must be designed against the exact current live handoff and should not reuse the older trigger envelope unchanged.',
  keyFindings: {
    staleMassContract: massContractDrift.staleMassContract,
    supportFamilyStillValid: gateCompatibility.supportFamilyStillValid,
    mismatchedGates: gateCompatibility.mismatchedGates.map((entry) => entry.gate)
  },
  livePatchContract: {
    requiredCarrySurvivingDeltaKgM2: requiredDeltas.mustChange.verticalUpperCloudCarrySurvivingMassKgM2.delta,
    requiredHandedToMicrophysicsDeltaKgM2: requiredDeltas.mustChange.verticalUpperCloudHandedToMicrophysicsMassKgM2.delta,
    requiredAppliedErosionIncreaseKgM2: requiredDeltas.mustChange.verticalUpperCloudAppliedErosionMassKgM2.delta
  },
  falsificationRule: 'Reject the next live patch if it still keys off post-handoff carriedOverUpperCloudMass dominance instead of the live carry-surviving-to-input dominance, or if it fails to reduce the exact live replay carry-surviving and handed-to-microphysics masses by the reconciled deltas.'
});

const renderMarkdown = (report) => {
  const lines = [];
  lines.push('# Phase 1B Live Replay Reconciliation');
  lines.push('');
  lines.push(`- Frozen target cell: ${report.contract.targetCell.cellIndex} (lat ${report.contract.targetCell.latDeg}, lon ${report.contract.targetCell.lonDeg})`);
  lines.push(`- Checkpoint day: ${report.contract.checkpointDay}`);
  lines.push(`- Current commit: ${report.contract.currentCommit}`);
  lines.push(`- Old alignment commit: ${report.oldAlignment.contract.currentCommit}`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`- Verdict: \`${report.verdict.key}\``);
  lines.push(`- Explanation: ${report.verdict.explanation}`);
  lines.push('');
  lines.push('## Old Contract Drift');
  lines.push('');
  lines.push(`- Stale mass contract: ${report.massContractDrift.staleMassContract}`);
  lines.push(`- Max absolute mass drift: ${report.massContractDrift.maxAbsDeltaKgM2} kg/m²`);
  for (const [field, drift] of Object.entries(report.massContractDrift.fieldDrift)) {
    lines.push(`- ${field}: old ${drift.old}, live ${drift.live}, delta ${drift.delta}`);
  }
  lines.push('');
  lines.push('## Old Trigger Compatibility');
  lines.push('');
  lines.push(`- Support family still valid: ${report.oldGateCompatibility.supportFamilyStillValid}`);
  for (const [gate, check] of Object.entries(report.oldGateCompatibility.checks)) {
    lines.push(`- ${gate}: observed ${check.observed}, threshold ${check.threshold}, pass ${check.pass}`);
  }
  lines.push('');
  lines.push('## Exact Live Handoff');
  lines.push('');
  for (const [field, value] of Object.entries(report.liveReplayState)) {
    lines.push(`- ${field}: ${value}`);
  }
  lines.push('');
  lines.push('## Reconciled Trigger Contract');
  lines.push('');
  for (const [field, value] of Object.entries(report.reconciledTriggerContract.exactObservedLiveState)) {
    lines.push(`- observed ${field}: ${value}`);
  }
  for (const [field, value] of Object.entries(report.reconciledTriggerContract.recommendedEnvelope)) {
    lines.push(`- recommended ${field}: ${value}`);
  }
  lines.push(`- representation shift: ${report.reconciledTriggerContract.representationShift.explanation}`);
  lines.push('');
  lines.push('## Required Live Deltas');
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
  return lines.join('\n');
};

const renderPatchDesignMarkdown = (report) => {
  const lines = [];
  lines.push('# Phase 1B Live Replay Patch Design');
  lines.push('');
  lines.push('The next `stepVertical5` patch must be designed against the exact current live replay state, not the older static alignment mass target.');
  lines.push('');
  lines.push('## Why');
  lines.push('');
  lines.push(`- Old mass contract stale: ${report.massContractDrift.staleMassContract}`);
  lines.push(`- Support family still valid: ${report.oldGateCompatibility.supportFamilyStillValid}`);
  if (report.oldGateCompatibility.mismatchedGates.length) {
    lines.push(`- Old mismatched gates: ${report.oldGateCompatibility.mismatchedGates.map((entry) => entry.gate).join(', ')}`);
  }
  lines.push('');
  lines.push('## Live Trigger To Design Against');
  lines.push('');
  for (const [field, value] of Object.entries(report.reconciledTriggerContract.exactObservedLiveState)) {
    lines.push(`- ${field}: ${value}`);
  }
  lines.push('');
  lines.push('## Recommended Gate Envelope');
  lines.push('');
  for (const [field, value] of Object.entries(report.reconciledTriggerContract.recommendedEnvelope)) {
    lines.push(`- ${field}: ${value}`);
  }
  lines.push(`- representation shift: ${report.reconciledTriggerContract.representationShift.explanation}`);
  lines.push('');
  lines.push('## Live Handoff Target');
  lines.push('');
  for (const [field, contract] of Object.entries(report.requiredDeltas.mustChange)) {
    lines.push(`- ${field}: ${contract.from} -> ${contract.to}`);
  }
  lines.push('');
  lines.push('## Stability Contract');
  lines.push('');
  for (const [field, value] of Object.entries(report.requiredDeltas.mustRemainStable)) {
    lines.push(`- ${field}: ${value}`);
  }
  lines.push('');
  lines.push('## Keep/Reject Rule');
  lines.push('');
  lines.push(`- ${report.verdict.falsificationRule}`);
  lines.push('');
  return lines.join('\n');
};

const main = async () => {
  const contract = readJson(contractPath);
  const oldAlignment = readJson(oldAlignmentPath);
  const liveReplay = await captureLiveReplayReconciliation({ contract });
  const massContractDrift = buildMassContractDrift({
    oldAlignment,
    liveCurrentState: liveReplay.liveCurrentState
  });
  const oldGateCompatibility = evaluateOldGateCompatibility({
    oldAlignment,
    liveCurrentState: liveReplay.liveCurrentState
  });
  const reconciledTriggerContract = buildReconciledTriggerContract({
    oldAlignment,
    liveCurrentState: liveReplay.liveCurrentState,
    gateCompatibility: oldGateCompatibility
  });
  const requiredDeltas = alignmentProofTest.deriveRequiredVerticalDeltas({
    baseline: liveReplay.liveCurrentState,
    synthetic: liveReplay.syntheticLiveTarget,
    intervention: liveReplay.intervention
  });
  const report = {
    schema: 'satellite-wars.phase1b-live-replay-reconciliation.v1',
    generatedAt: new Date().toISOString(),
    contract: {
      targetCell: contract.corridor.targetCell,
      checkpointDay: contract.corridor.checkpointDay,
      currentCommit: liveReplay.currentCommit
    },
    sourceArtifacts: {
      contractPath,
      oldAlignmentPath
    },
    oldAlignment,
    liveReplayState: liveReplay.liveCurrentState,
    syntheticLiveTarget: liveReplay.syntheticLiveTarget,
    syntheticIntervention: liveReplay.intervention,
    massContractDrift,
    oldGateCompatibility,
    reconciledTriggerContract,
    requiredDeltas,
    verdict: buildReconciledVerdict({
      massContractDrift,
      gateCompatibility: oldGateCompatibility,
      requiredDeltas
    })
  };
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.mkdirSync(path.dirname(designPath), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(`${reportBase}.md`, `${renderMarkdown(report)}\n`);
  fs.writeFileSync(designPath, `${renderPatchDesignMarkdown(report)}\n`);
  process.stdout.write(JSON.stringify({
    verdict: report.verdict,
    mismatchedGates: report.oldGateCompatibility.mismatchedGates,
    liveReplayState: {
      upperCloudPathKgM2: report.liveReplayState.upperCloudPathKgM2,
      carriedOverUpperCloudMassKgM2: report.liveReplayState.carriedOverUpperCloudMassKgM2,
      verticalUpperCloudInputMassKgM2: report.liveReplayState.verticalUpperCloudInputMassKgM2
    }
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  await main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export const _test = {
  buildMassContractDrift,
  evaluateOldGateCompatibility,
  buildReconciledTriggerContract,
  buildReconciledVerdict
};
