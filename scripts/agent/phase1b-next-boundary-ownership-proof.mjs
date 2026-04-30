#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
  'phase1b-next-boundary-ownership-proof'
);
const DEFAULT_BASELINE_ROOT = path.join('/tmp', 'sw-phase1b-head-baseline');
const MATERIAL_REDUCTION_THRESHOLD_KGM2 = 0.05;
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;

let contractPath = DEFAULT_CONTRACT_PATH;
let reportBase = DEFAULT_REPORT_BASE;
let baselineRoot = DEFAULT_BASELINE_ROOT;
let materialThresholdKgM2 = MATERIAL_REDUCTION_THRESHOLD_KGM2;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--baseline-root' && argv[i + 1]) baselineRoot = path.resolve(argv[++i]);
  else if (arg.startsWith('--baseline-root=')) baselineRoot = path.resolve(arg.slice('--baseline-root='.length));
  else if (arg === '--material-threshold' && argv[i + 1]) materialThresholdKgM2 = Number.parseFloat(argv[++i]);
  else if (arg.startsWith('--material-threshold=')) materialThresholdKgM2 = Number.parseFloat(arg.slice('--material-threshold='.length));
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
    const sigmaMid = 0.5 * ((sigmaHalf?.[lev] || 0) + (sigmaHalf?.[lev + 1] || 0));
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

const sumForIndices = (indices, getter) => {
  let total = 0;
  for (const idx of indices) total += Number(getter(idx)) || 0;
  return total;
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
  return {
    doMicrophysics: !lodActive || (core._dynStepIndex % microEvery === 0)
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

const captureRun = async ({ modules, contract, root }) => {
  const checkpointCore = await buildConfiguredCore(modules, contract);
  await corridorProof.suppressProcessOutput(async () => {
    advanceToModelDayFully(checkpointCore, contract.corridor.checkpointDay);
  });
  return corridorProof.suppressProcessOutput(async () => {
    const clone = await corridorProof.cloneCoreFromSource(modules, checkpointCore);
    corridorProof.runPreVerticalSequence(clone, modules, clone.modelDt);
    const targetCell = contract.corridor.targetCell;
    const corridorIndices = corridorProof.buildCorridorMask(clone, {
      sector: contract.corridor.sectorKey,
      latMin: contract.corridor.latBandDeg[0],
      latMax: contract.corridor.latBandDeg[1]
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

    const handoff = {
      targetCell: {
        upperCloudMassKgM2: round(sumUpperCloudMassAtCell(clone.state, targetCell.cellIndex), 5),
        carrySurvivingKgM2: round(Number(clone.state.verticalUpperCloudCarrySurvivingMass?.[targetCell.cellIndex]) || 0, 5),
        appliedErosionKgM2: round(Number(clone.state.verticalUpperCloudAppliedErosionMass?.[targetCell.cellIndex]) || 0, 5),
        handedToMicrophysicsKgM2: round(Number(clone.state.verticalUpperCloudHandedToMicrophysicsMass?.[targetCell.cellIndex]) || 0, 5)
      },
      corridorBand: {
        upperCloudMassKgM2: round(sumForIndices(corridorIndices, (idx) => sumUpperCloudMassAtCell(clone.state, idx)), 5),
        carrySurvivingKgM2: round(sumForIndices(corridorIndices, (idx) => clone.state.verticalUpperCloudCarrySurvivingMass?.[idx] || 0), 5),
        appliedErosionKgM2: round(sumForIndices(corridorIndices, (idx) => clone.state.verticalUpperCloudAppliedErosionMass?.[idx] || 0), 5),
        handedToMicrophysicsKgM2: round(sumForIndices(corridorIndices, (idx) => clone.state.verticalUpperCloudHandedToMicrophysicsMass?.[idx] || 0), 5)
      }
    };

    advanceCurrentStepRemainder({ core: clone, modules });

    const nextBoundary = {
      targetCell: {
        ownedPreviousStepResidualUpperCloudKgM2: round(sumUpperCloudMassAtCell(clone.state, targetCell.cellIndex), 5),
        upperCloudOutputKgM2: round(Number(clone.state.microphysicsUpperCloudOutputMass?.[targetCell.cellIndex]) || 0, 5),
        saturationBirthKgM2: round(Number(clone.state.microphysicsUpperCloudSaturationBirthMass?.[targetCell.cellIndex]) || 0, 5),
        cloudToPrecipKgM2: round(Number(clone.state.microphysicsUpperCloudCloudToPrecipMass?.[targetCell.cellIndex]) || 0, 5),
        cloudReevaporationKgM2: round(Number(clone.state.microphysicsUpperCloudCloudReevaporationMass?.[targetCell.cellIndex]) || 0, 5)
      },
      corridorBand: {
        ownedPreviousStepResidualUpperCloudKgM2: round(sumForIndices(corridorIndices, (idx) => sumUpperCloudMassAtCell(clone.state, idx)), 5),
        upperCloudOutputKgM2: round(sumForIndices(corridorIndices, (idx) => clone.state.microphysicsUpperCloudOutputMass?.[idx] || 0), 5),
        saturationBirthKgM2: round(sumForIndices(corridorIndices, (idx) => clone.state.microphysicsUpperCloudSaturationBirthMass?.[idx] || 0), 5),
        cloudToPrecipKgM2: round(sumForIndices(corridorIndices, (idx) => clone.state.microphysicsUpperCloudCloudToPrecipMass?.[idx] || 0), 5),
        cloudReevaporationKgM2: round(sumForIndices(corridorIndices, (idx) => clone.state.microphysicsUpperCloudCloudReevaporationMass?.[idx] || 0), 5)
      }
    };

    return {
      root,
      commit: commitAtRoot(root),
      handoff,
      nextBoundary
    };
  });
};

const buildVerdict = ({ baseline, candidate, materialThreshold }) => {
  const targetHandoffReduction = round(
    (baseline.handoff.targetCell.carrySurvivingKgM2 || 0)
      - (candidate.handoff.targetCell.carrySurvivingKgM2 || 0),
    5
  );
  const corridorHandoffReduction = round(
    (baseline.handoff.corridorBand.carrySurvivingKgM2 || 0)
      - (candidate.handoff.corridorBand.carrySurvivingKgM2 || 0),
    5
  );
  const targetNextBoundaryReduction = round(
    (baseline.nextBoundary.targetCell.ownedPreviousStepResidualUpperCloudKgM2 || 0)
      - (candidate.nextBoundary.targetCell.ownedPreviousStepResidualUpperCloudKgM2 || 0),
    5
  );
  const corridorNextBoundaryReduction = round(
    (baseline.nextBoundary.corridorBand.ownedPreviousStepResidualUpperCloudKgM2 || 0)
      - (candidate.nextBoundary.corridorBand.ownedPreviousStepResidualUpperCloudKgM2 || 0),
    5
  );
  const targetReductionSurvivalFrac = round(
    targetHandoffReduction > 0 ? targetNextBoundaryReduction / targetHandoffReduction : 0,
    5
  );
  const corridorReductionSurvivalFrac = round(
    corridorHandoffReduction > 0 ? corridorNextBoundaryReduction / corridorHandoffReduction : 0,
    5
  );
  const targetPass = targetNextBoundaryReduction > materialThreshold;
  const corridorPass = corridorNextBoundaryReduction > materialThreshold;
  return {
    targetHandoffReductionKgM2: targetHandoffReduction,
    corridorHandoffReductionKgM2: corridorHandoffReduction,
    targetNextBoundaryReductionKgM2: targetNextBoundaryReduction,
    corridorNextBoundaryReductionKgM2: corridorNextBoundaryReduction,
    targetReductionSurvivalFrac,
    corridorReductionSurvivalFrac,
    materialThresholdKgM2: round(materialThreshold, 5),
    pass: targetPass && corridorPass,
    explanation: targetPass && corridorPass
      ? 'The narrower live-state patch reduces the owned previous-step upper-cloud reservoir at the next replay boundary in both the target cell and corridor band.'
      : 'The narrower live-state patch improves the current handoff, but it does not yet produce a material reduction in the owned previous-step upper-cloud reservoir at the next replay boundary.'
  };
};

const renderMarkdown = (report) => {
  const lines = [
    '# Phase 1B Next-Boundary Ownership Proof',
    '',
    `- Target cell: ${report.contract.targetCell.cellIndex} (lat ${report.contract.targetCell.latDeg}, lon ${report.contract.targetCell.lonDeg})`,
    `- Checkpoint day: ${report.contract.checkpointDay}`,
    `- Baseline commit: ${report.baseline.commit}`,
    `- Candidate root: ${report.candidate.root}`,
    '',
    '## Verdict',
    '',
    `- Pass: ${report.verdict.pass}`,
    `- Explanation: ${report.verdict.explanation}`,
    '',
    '## Handoff Reduction',
    '',
    `- Target carry-surviving reduction: ${report.verdict.targetHandoffReductionKgM2} kg/m²`,
    `- Corridor carry-surviving reduction: ${report.verdict.corridorHandoffReductionKgM2} kg/m²`,
    '',
    '## Next-Boundary Reduction',
    '',
    `- Target owned reservoir reduction: ${report.verdict.targetNextBoundaryReductionKgM2} kg/m²`,
    `- Corridor owned reservoir reduction: ${report.verdict.corridorNextBoundaryReductionKgM2} kg/m²`,
    `- Target reduction survival fraction: ${report.verdict.targetReductionSurvivalFrac}`,
    `- Corridor reduction survival fraction: ${report.verdict.corridorReductionSurvivalFrac}`,
    '',
    '## Target Cell',
    '',
    `- Baseline next-boundary owned reservoir: ${report.baseline.nextBoundary.targetCell.ownedPreviousStepResidualUpperCloudKgM2} kg/m²`,
    `- Candidate next-boundary owned reservoir: ${report.candidate.nextBoundary.targetCell.ownedPreviousStepResidualUpperCloudKgM2} kg/m²`,
    `- Baseline saturation birth: ${report.baseline.nextBoundary.targetCell.saturationBirthKgM2} kg/m²`,
    `- Candidate saturation birth: ${report.candidate.nextBoundary.targetCell.saturationBirthKgM2} kg/m²`
  ];
  return lines.join('\n');
};

const main = async () => {
  const contract = readJson(contractPath);
  const baselineCommit = commitAtRoot(repoRoot);
  const baselineWorktreeRoot = corridorProof.ensureHistoricalWorktree({
    root: baselineRoot,
    commit: baselineCommit
  });
  const baselineModules = await corridorProof.importBaselineModules(baselineWorktreeRoot);
  const candidateModules = await corridorProof.importBaselineModules(repoRoot);
  const baseline = await captureRun({ modules: baselineModules, contract, root: baselineWorktreeRoot });
  const candidate = await captureRun({ modules: candidateModules, contract, root: repoRoot });
  const verdict = buildVerdict({
    baseline,
    candidate,
    materialThreshold: materialThresholdKgM2
  });
  const report = {
    schema: 'satellite-wars.phase1b-next-boundary-ownership-proof.v1',
    generatedAt: new Date().toISOString(),
    contract: {
      targetCell: contract.corridor.targetCell,
      checkpointDay: contract.corridor.checkpointDay
    },
    baseline,
    candidate,
    verdict
  };
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(`${reportBase}.md`, `${renderMarkdown(report)}\n`);
  process.stdout.write(JSON.stringify({
    verdict,
    baselineNextBoundaryTarget: baseline.nextBoundary.targetCell.ownedPreviousStepResidualUpperCloudKgM2,
    candidateNextBoundaryTarget: candidate.nextBoundary.targetCell.ownedPreviousStepResidualUpperCloudKgM2
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
  buildVerdict
};
