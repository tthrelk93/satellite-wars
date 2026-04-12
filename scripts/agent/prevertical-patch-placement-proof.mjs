#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
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
const DEFAULT_U2_REPORT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-provenance-ownership.json'
);
const DEFAULT_U4_REPORT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-reduced-order-results.json'
);
const DEFAULT_U5_NORMALIZED_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-variant-normalized-ownership.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-patch-placement-proof'
);
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;

let contractPath = DEFAULT_CONTRACT_PATH;
let u2ReportPath = DEFAULT_U2_REPORT_PATH;
let u4ReportPath = DEFAULT_U4_REPORT_PATH;
let u5NormalizedPath = DEFAULT_U5_NORMALIZED_PATH;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--u2-report' && argv[i + 1]) u2ReportPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--u2-report=')) u2ReportPath = path.resolve(arg.slice('--u2-report='.length));
  else if (arg === '--u4-report' && argv[i + 1]) u4ReportPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--u4-report=')) u4ReportPath = path.resolve(arg.slice('--u4-report='.length));
  else if (arg === '--u5-normalized' && argv[i + 1]) u5NormalizedPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--u5-normalized=')) u5NormalizedPath = path.resolve(arg.slice('--u5-normalized='.length));
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

const aggregateUpperCloudMass = (state, indices) => {
  const { N, nz, pHalf, sigmaHalf } = state;
  let total = 0;
  for (const cellIndex of indices) {
    for (let lev = 0; lev < nz; lev += 1) {
      if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
      const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
      if (!(dp > 0)) continue;
      const idx = lev * N + cellIndex;
      total += (
        (state.qc?.[idx] || 0)
        + (state.qi?.[idx] || 0)
        + (state.qr?.[idx] || 0)
        + (state.qs?.[idx] || 0)
      ) * (dp / G);
    }
  }
  return round(total, 5);
};

const aggregateUpperComponentMass = (state, indices, fields) => {
  const { N, nz, pHalf, sigmaHalf } = state;
  let total = 0;
  for (const cellIndex of indices) {
    for (let lev = 0; lev < nz; lev += 1) {
      if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
      const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
      if (!(dp > 0)) continue;
      const idx = lev * N + cellIndex;
      total += fields.reduce((inner, fieldName) => inner + (state[fieldName]?.[idx] || 0), 0) * (dp / G);
    }
  }
  return round(total, 5);
};

const captureMassSnapshot = ({ state, targetCellIndex, corridorIndices, label }) => ({
  label,
  targetCellUpperCloudMassKgM2: aggregateUpperCloudMass(state, [targetCellIndex]),
  corridorUpperCloudMassKgM2: aggregateUpperCloudMass(state, corridorIndices),
  targetCellUpperCloudCondensateKgM2: aggregateUpperComponentMass(state, [targetCellIndex], ['qc', 'qi']),
  targetCellUpperHydrometeorPrecipKgM2: aggregateUpperComponentMass(state, [targetCellIndex], ['qr', 'qs']),
  corridorUpperCloudCondensateKgM2: aggregateUpperComponentMass(state, corridorIndices, ['qc', 'qi']),
  corridorUpperHydrometeorPrecipKgM2: aggregateUpperComponentMass(state, corridorIndices, ['qr', 'qs'])
});

const captureCurrentLedger = ({ state, targetCellIndex, corridorIndices }) => ({
  targetCell: {
    inputMassKgM2: round(state.microphysicsUpperCloudInputMass?.[targetCellIndex] || 0, 5),
    saturationBirthMassKgM2: round(state.microphysicsUpperCloudSaturationBirthMass?.[targetCellIndex] || 0, 5),
    cloudReevaporationMassKgM2: round(state.microphysicsUpperCloudCloudReevaporationMass?.[targetCellIndex] || 0, 5),
    precipReevaporationMassKgM2: round(state.microphysicsUpperCloudPrecipReevaporationMass?.[targetCellIndex] || 0, 5),
    sedimentationExportMassKgM2: round(state.microphysicsUpperCloudSedimentationExportMass?.[targetCellIndex] || 0, 5),
    cloudToPrecipMassKgM2: round(state.microphysicsUpperCloudCloudToPrecipMass?.[targetCellIndex] || 0, 5),
    outputMassKgM2: round(state.microphysicsUpperCloudOutputMass?.[targetCellIndex] || 0, 5)
  },
  corridorBand: {
    inputMassKgM2: round(sum(corridorIndices.map((idx) => state.microphysicsUpperCloudInputMass?.[idx] || 0)), 5),
    saturationBirthMassKgM2: round(sum(corridorIndices.map((idx) => state.microphysicsUpperCloudSaturationBirthMass?.[idx] || 0)), 5),
    cloudReevaporationMassKgM2: round(sum(corridorIndices.map((idx) => state.microphysicsUpperCloudCloudReevaporationMass?.[idx] || 0)), 5),
    precipReevaporationMassKgM2: round(sum(corridorIndices.map((idx) => state.microphysicsUpperCloudPrecipReevaporationMass?.[idx] || 0)), 5),
    sedimentationExportMassKgM2: round(sum(corridorIndices.map((idx) => state.microphysicsUpperCloudSedimentationExportMass?.[idx] || 0)), 5),
    cloudToPrecipMassKgM2: round(sum(corridorIndices.map((idx) => state.microphysicsUpperCloudCloudToPrecipMass?.[idx] || 0)), 5),
    outputMassKgM2: round(sum(corridorIndices.map((idx) => state.microphysicsUpperCloudOutputMass?.[idx] || 0)), 5)
  }
});

const computeStepCadence = (core) => {
  const lodActive = core.lodParams?.enable && core.simSpeed > core.lodParams.simSpeedThreshold;
  const microEvery = Math.max(1, Number(core.lodParams?.microphysicsEvery) || 1);
  return {
    doMicrophysics: !lodActive || (core._dynStepIndex % microEvery === 0)
  };
};

const closeTracerBudget = (core) => {
  if (typeof core._closeSurfaceSourceTracerBudget === 'function') {
    core._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
  }
};

const runPreviousStepScenario = async ({
  name,
  seedCore,
  baseModules,
  verticalModules,
  microModules,
  verticalParamsSourceCore = null,
  microParamsSourceCore = null,
  postModules,
  targetCell,
  corridorIndices
}) => corridorProof.suppressProcessOutput(async () => {
  const clone = await corridorProof.cloneCoreFromSource(baseModules, seedCore);
  corridorProof.runPreVerticalSequence(clone, baseModules, clone.modelDt);
  const previousStepPreVertical = captureMassSnapshot({
    state: clone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    label: 'previousStepPreVertical5'
  });

  const verticalParams = verticalParamsSourceCore?.vertParams
    ? { ...verticalParamsSourceCore.vertParams }
    : clone.vertParams;
  verticalModules.stepVertical5({
    dt: clone.modelDt,
    grid: clone.grid,
    state: clone.state,
    geo: clone.geo,
    params: verticalParams,
    scratch: clone._dynScratch
  });
  closeTracerBudget(clone);
  if (typeof clone._updateHydrostatic === 'function') clone._updateHydrostatic();

  const afterPreviousStepVertical = captureMassSnapshot({
    state: clone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    label: 'afterPreviousStepVertical5'
  });

  let microLedger = null;
  const { doMicrophysics } = computeStepCadence(clone);
  const microParams = microParamsSourceCore?.microParams
    ? { ...microParamsSourceCore.microParams }
    : { ...clone.microParams };
  if (typeof verticalParams?.enableConvectiveOutcome === 'boolean') {
    microParams.enableConvectiveOutcome = verticalParams.enableConvectiveOutcome;
  }
  if (doMicrophysics) {
    microModules.stepMicrophysics5({ dt: clone.modelDt, state: clone.state, params: microParams });
    closeTracerBudget(clone);
    if (microModules === baseModules) {
      microLedger = captureCurrentLedger({
        state: clone.state,
        targetCellIndex: targetCell.cellIndex,
        corridorIndices
      });
    }
  }
  if (typeof clone._updateHydrostatic === 'function') clone._updateHydrostatic();

  const endPreviousStepMicrophysics = captureMassSnapshot({
    state: clone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    label: 'endPreviousStepMicrophysics5'
  });

  clone._dynStepIndex += 1;
  clone.timeUTC += clone.modelDt;

  corridorProof.runPreVerticalSequence(clone, postModules, clone.modelDt);
  const provingInstant = captureMassSnapshot({
    state: clone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    label: 'preStepVertical5'
  });

  return {
    name,
    previousStepPreVertical,
    afterPreviousStepVertical,
    endPreviousStepMicrophysics,
    provingInstant,
    currentInstrumentationLedger: microLedger
  };
});

const summarizePlacementScenario = ({ scenario, currentBaseline, historicalBaseline }) => {
  const baselineTargetExcess = (currentBaseline.provingInstant.targetCellUpperCloudMassKgM2 || 0) - (historicalBaseline.provingInstant.targetCellUpperCloudMassKgM2 || 0);
  const baselineCorridorExcess = (currentBaseline.provingInstant.corridorUpperCloudMassKgM2 || 0) - (historicalBaseline.provingInstant.corridorUpperCloudMassKgM2 || 0);
  const baselinePrevStepTargetExcess = (currentBaseline.endPreviousStepMicrophysics.targetCellUpperCloudMassKgM2 || 0) - (historicalBaseline.endPreviousStepMicrophysics.targetCellUpperCloudMassKgM2 || 0);
  const baselinePrevStepCorridorExcess = (currentBaseline.endPreviousStepMicrophysics.corridorUpperCloudMassKgM2 || 0) - (historicalBaseline.endPreviousStepMicrophysics.corridorUpperCloudMassKgM2 || 0);

  const targetExcessKgM2 = round((scenario.provingInstant.targetCellUpperCloudMassKgM2 || 0) - (historicalBaseline.provingInstant.targetCellUpperCloudMassKgM2 || 0), 5);
  const corridorExcessKgM2 = round((scenario.provingInstant.corridorUpperCloudMassKgM2 || 0) - (historicalBaseline.provingInstant.corridorUpperCloudMassKgM2 || 0), 5);
  const previousStepTargetExcessKgM2 = round((scenario.endPreviousStepMicrophysics.targetCellUpperCloudMassKgM2 || 0) - (historicalBaseline.endPreviousStepMicrophysics.targetCellUpperCloudMassKgM2 || 0), 5);
  const previousStepCorridorExcessKgM2 = round((scenario.endPreviousStepMicrophysics.corridorUpperCloudMassKgM2 || 0) - (historicalBaseline.endPreviousStepMicrophysics.corridorUpperCloudMassKgM2 || 0), 5);

  const targetReductionFrac = baselineTargetExcess > 0
    ? round((baselineTargetExcess - targetExcessKgM2) / baselineTargetExcess, 5)
    : null;
  const corridorReductionFrac = baselineCorridorExcess > 0
    ? round((baselineCorridorExcess - corridorExcessKgM2) / baselineCorridorExcess, 5)
    : null;
  const previousStepTargetReductionFrac = baselinePrevStepTargetExcess > 0
    ? round((baselinePrevStepTargetExcess - previousStepTargetExcessKgM2) / baselinePrevStepTargetExcess, 5)
    : null;
  const previousStepCorridorReductionFrac = baselinePrevStepCorridorExcess > 0
    ? round((baselinePrevStepCorridorExcess - previousStepCorridorExcessKgM2) / baselinePrevStepCorridorExcess, 5)
    : null;

  const score = round(
    0.4 * (targetReductionFrac || 0)
      + 0.25 * (corridorReductionFrac || 0)
      + 0.2 * (previousStepTargetReductionFrac || 0)
      + 0.15 * (previousStepCorridorReductionFrac || 0),
    5
  );

  return {
    name: scenario.name,
    provingInstant: scenario.provingInstant,
    endPreviousStepMicrophysics: scenario.endPreviousStepMicrophysics,
    currentInstrumentationLedger: scenario.currentInstrumentationLedger,
    targetExcessKgM2,
    corridorExcessKgM2,
    previousStepTargetExcessKgM2,
    previousStepCorridorExcessKgM2,
    targetReductionFrac,
    corridorReductionFrac,
    previousStepTargetReductionFrac,
    previousStepCorridorReductionFrac,
    score
  };
};

const choosePatchPlacement = ({ verticalOnly, microphysicsOnly, coordinated, u2Report, u4Report, normalizedReport, contract }) => {
  const singleScenarios = [verticalOnly, microphysicsOnly].sort((a, b) => (b.score || 0) - (a.score || 0));
  const bestSingle = singleScenarios[0];
  const secondSingle = singleScenarios[1];
  const coordinatedAdvantage = round((coordinated.score || 0) - (bestSingle.score || 0), 5);
  const bestSingleClearlyWins = (bestSingle.score || 0) >= 0.75 && ((bestSingle.score || 0) - (secondSingle.score || 0)) >= 0.2;

  let primaryOwner = null;
  let secondaryOwner = null;
  let placementType = 'coordinated';
  if (bestSingleClearlyWins) {
    placementType = 'single-owner';
    primaryOwner = bestSingle.name === 'historicalMicrophysicsOnly' ? 'stepMicrophysics5' : 'stepVertical5';
    if ((secondSingle.score || 0) >= 0.2 && coordinatedAdvantage >= 0.05) {
      secondaryOwner = secondSingle.name === 'historicalMicrophysicsOnly' ? 'stepMicrophysics5' : 'stepVertical5';
    }
  } else if (coordinatedAdvantage >= 0.08) {
    primaryOwner = 'stepMicrophysics5';
    secondaryOwner = 'stepVertical5';
  } else {
    primaryOwner = bestSingle.name === 'historicalMicrophysicsOnly' ? 'stepMicrophysics5' : 'stepVertical5';
    if ((secondSingle.score || 0) >= 0.15) secondaryOwner = secondSingle.name === 'historicalMicrophysicsOnly' ? 'stepMicrophysics5' : 'stepVertical5';
  }

  const dominantU2Owner = u2Report?.primaryOwnerRanking?.targetCell?.key || null;
  const reducedDecision = u4Report?.rootCauseAssessment?.decision || null;
  const numericalOwner = normalizedReport?.assessment?.normalizedStableOwner || null;

  const supportingEvidence = [];
  if (dominantU2Owner === 'previousStepResidualUpperCloud') {
    supportingEvidence.push('U2 keeps previousStepResidualUpperCloud as the dominant target-cell owner.');
  }
  if (reducedDecision === 'retention-local-maintenance-without-full-globe') {
    supportingEvidence.push('U4 reproduces the bug in the no-transport column and sector curtain, so full-globe transport is not required.');
  }
  if (numericalOwner === 'previousStepResidualUpperCloud') {
    supportingEvidence.push('Repaired normalized U5 keeps the same owner and first boundary across informative variants.');
  }

  const allScenarioScoresCollapsed = [verticalOnly, microphysicsOnly, coordinated].every((entry) => Math.abs(entry.score || 0) <= 0.01);
  const verticalFact = contract?.frozenFacts?.currentVerticalTargetCell || {};
  const microFact = contract?.frozenFacts?.currentMicrophysicsTargetCell || {};
  const carryPassThroughFrac = verticalFact.inputMassKgM2 > 0
    ? (verticalFact.carrySurvivingMassKgM2 || 0) / verticalFact.inputMassKgM2
    : 0;
  const microRemovalFrac = microFact.inputMassKgM2 > 0
    ? 1 - ((microFact.outputMassKgM2 || 0) / microFact.inputMassKgM2)
    : 0;
  const verticalBirthMass = (verticalFact.resolvedBirthMassKgM2 || 0) + (verticalFact.convectiveBirthMassKgM2 || 0);

  if (
    allScenarioScoresCollapsed
    && dominantU2Owner === 'previousStepResidualUpperCloud'
    && reducedDecision === 'retention-local-maintenance-without-full-globe'
    && numericalOwner === 'previousStepResidualUpperCloud'
    && carryPassThroughFrac >= 0.99
    && (verticalFact.appliedErosionMassKgM2 || 0) <= 0.01
    && verticalBirthMass <= 0.1
  ) {
    placementType = 'single-owner';
    primaryOwner = 'stepVertical5';
    secondaryOwner = microRemovalFrac < 0.2 ? 'stepMicrophysics5' : null;
    supportingEvidence.push(
      `Frozen E1 shows stepVertical5 passing ${round(carryPassThroughFrac * 100, 2)}% of target-cell carryover forward with applied erosion ${(verticalFact.appliedErosionMassKgM2 || 0)} kg/m² and only ${round(verticalBirthMass, 5)} kg/m² of in-step birth.`
    );
    if (secondaryOwner) {
      supportingEvidence.push(
        `stepMicrophysics5 only removes ${round(microRemovalFrac * 100, 2)}% of that target-cell upper-cloud input in the frozen proof, so it remains a downstream support path rather than the first owner.`
      );
    }
    return {
      placementType,
      primaryOwner,
      secondaryOwner,
      winningScenario: 'evidenceFallback.verticalCarryoverErosion',
      supportingEvidence,
      nonOwnerExplanation: 'stepMicrophysics5 is downstream support rather than first ownership because the frozen E1 handoff already carries the full excess reservoir into microphysics with zero applied erosion.',
      coordinatedAdvantage,
      rankedScenarios: [microphysicsOnly, verticalOnly, coordinated].sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((entry) => ({
          name: entry.name,
          score: entry.score,
          targetReductionFrac: entry.targetReductionFrac,
          corridorReductionFrac: entry.corridorReductionFrac,
          previousStepTargetReductionFrac: entry.previousStepTargetReductionFrac
        }))
    };
  }

  const winningScenario = primaryOwner === 'stepMicrophysics5'
    ? microphysicsOnly
    : primaryOwner === 'stepVertical5'
      ? verticalOnly
      : coordinated;

  const nonOwnerExplanation = primaryOwner === 'stepMicrophysics5'
    ? `stepVertical5 is not primary because swapping in historical vertical only clears ${round((verticalOnly.targetReductionFrac || 0) * 100, 2)}% of the target proving-instant excess, versus ${round((microphysicsOnly.targetReductionFrac || 0) * 100, 2)}% for historical microphysics.`
    : primaryOwner === 'stepVertical5'
      ? `stepMicrophysics5 is not primary because swapping in historical microphysics only clears ${round((microphysicsOnly.targetReductionFrac || 0) * 100, 2)}% of the target proving-instant excess, versus ${round((verticalOnly.targetReductionFrac || 0) * 100, 2)}% for historical vertical.`
      : `No single swap clears enough of the target proving-instant excess; the coordinated bundle is stronger than either single-owner scenario by ${round(coordinatedAdvantage * 100, 2)} percentage points of score.`;

  return {
    placementType,
    primaryOwner,
    secondaryOwner,
    winningScenario: winningScenario.name,
    supportingEvidence,
    nonOwnerExplanation,
    coordinatedAdvantage,
    rankedScenarios: [microphysicsOnly, verticalOnly, coordinated].sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((entry) => ({
        name: entry.name,
        score: entry.score,
        targetReductionFrac: entry.targetReductionFrac,
        corridorReductionFrac: entry.corridorReductionFrac,
        previousStepTargetReductionFrac: entry.previousStepTargetReductionFrac
      }))
  };
};

const buildPredictedSignature = ({ placement, currentBaseline, historicalBaseline, u2Report, u4Report }) => {
  const historicalTarget = historicalBaseline.provingInstant.targetCellUpperCloudMassKgM2 || 0;
  const historicalCorridor = historicalBaseline.provingInstant.corridorUpperCloudMassKgM2 || 0;
  const currentTarget = currentBaseline.provingInstant.targetCellUpperCloudMassKgM2 || 0;
  const currentCorridor = currentBaseline.provingInstant.corridorUpperCloudMassKgM2 || 0;
  const targetDropKgM2 = round(Math.max(0, currentTarget - historicalTarget), 5);
  const corridorDropKgM2 = round(Math.max(0, currentCorridor - historicalCorridor), 5);
  const previousResidualTarget = u2Report?.excessPreStepVertical5?.targetCell?.previousStepResidualUpperCloud || 0;
  const advectionTarget = u2Report?.excessPreStepVertical5?.targetCell?.currentStepAdvectedUpperCloud || 0;
  const previousResidualCorridor = u2Report?.excessPreStepVertical5?.corridorBand?.previousStepResidualUpperCloud || 0;
  const advectionCorridor = u2Report?.excessPreStepVertical5?.corridorBand?.currentStepAdvectedUpperCloud || 0;

  const reducedOrderExpectation = placement.primaryOwner === 'stepMicrophysics5'
    ? 'no-transport column reproduction should collapse materially, because the retained previous-step reservoir should no longer survive the local microphysics handoff.'
    : placement.primaryOwner === 'stepVertical5'
      ? 'sector curtain reproduction should collapse earlier at the previous-step pre-microphysics handoff, before microphysics has a chance to preserve the reservoir.'
      : 'both the no-transport column and the sector curtain should weaken together; if only one changes materially, the coordinated placement is wrong.';

  const climateExpectation = placement.primaryOwner === 'stepMicrophysics5'
    ? '30-day climate metrics should improve first through a lower north dry-belt ratio, with ITCZ width moving only modestly because the patch targets residual carryover rather than tropical birth.'
    : placement.primaryOwner === 'stepVertical5'
      ? '30-day climate metrics may shift both the north dry-belt ratio and ITCZ width together, because the patch touches the handoff entering the upper-cloud reservoir.'
      : '30-day climate metrics should improve on the north dry belt without requiring a broad ITCZ shift; if ITCZ widening remains the main visible effect, the coordinated patch is probably too blunt.';

  return {
    preverticalLedger: {
      targetCellPreviousStepResidualExpectedDropKgM2: targetDropKgM2,
      corridorPreviousStepResidualExpectedDropKgM2: corridorDropKgM2,
      targetCellCurrentStepAdvectionShouldStaySecondaryKgM2: round(advectionTarget, 5),
      corridorCurrentStepAdvectionShouldStaySecondaryKgM2: round(advectionCorridor, 5),
      explanation: placement.primaryOwner === 'stepMicrophysics5'
        ? 'The winning proof should mainly reduce the endPreviousStepMicrophysics5 reservoir and the same previous-step residual term at preStepVertical5.'
        : placement.primaryOwner === 'stepVertical5'
          ? 'The winning proof should mainly reduce the post-vertical handoff that microphysics receives, with much smaller change in current-step advection.'
          : 'The winning proof should reduce both the previous-step handoff and the residual microphysics carryover, but not replace previousStepResidualUpperCloud with a new owner family.'
    },
    provenanceOwnership: {
      targetCellPreviousStepResidualBaselineKgM2: round(previousResidualTarget, 5),
      corridorPreviousStepResidualBaselineKgM2: round(previousResidualCorridor, 5),
      targetCellCurrentStepAdvectionBaselineKgM2: round(advectionTarget, 5),
      corridorCurrentStepAdvectionBaselineKgM2: round(advectionCorridor, 5),
      expectation: 'previousStepResidualUpperCloud should stop dominating the excess; currentStepAdvectedUpperCloud may remain visible but should stay secondary.'
    },
    reducedOrderExperiment: {
      priorDecision: u4Report?.rootCauseAssessment?.decision || null,
      expectation: reducedOrderExpectation
    },
    climateGate: {
      expectation: climateExpectation
    }
  };
};

const buildFalsificationRule = ({ placement }) => {
  if (placement.primaryOwner === 'stepMicrophysics5') {
    return 'Falsify this placement if a patch leaves endPreviousStepMicrophysics5 upper-cloud mass materially unchanged but mostly lowers current-step advection or resolved vertical birth instead.';
  }
  if (placement.primaryOwner === 'stepVertical5') {
    return 'Falsify this placement if a patch leaves the previous-step post-vertical handoff materially unchanged and only lowers endPreviousStepMicrophysics5 through downstream cleanup.';
  }
  return 'Falsify this placement if one single-module patch reproduces the same proving-instant reduction as the coordinated bundle without creating a new owner family.';
};

const renderMarkdown = (result) => {
  const { placement, scenarios, predictedSignature } = result;
  const lines = [];
  lines.push('# Pre-Vertical Patch Placement Proof');
  lines.push('');
  lines.push('## Verdict');
  lines.push(`- Primary owner: \`${placement.primaryOwner}\``);
  lines.push(`- Secondary owner: ${placement.secondaryOwner ? `\`${placement.secondaryOwner}\`` : 'none required for the first patch'}`);
  lines.push(`- Winning proof scenario: \`${placement.winningScenario}\``);
  lines.push(`- Placement type: \`${placement.placementType}\``);
  lines.push('');
  lines.push('## Ranked scenarios');
  for (const entry of placement.rankedScenarios) {
    lines.push(`- \`${entry.name}\`: score=${entry.score}, targetReduction=${entry.targetReductionFrac}, corridorReduction=${entry.corridorReductionFrac}, previousStepTargetReduction=${entry.previousStepTargetReductionFrac}`);
  }
  lines.push('');
  lines.push('## Key scenario outputs');
  for (const scenario of scenarios) {
    lines.push(`### ${scenario.name}`);
    lines.push(`- Proving-instant target mass: ${scenario.provingInstant.targetCellUpperCloudMassKgM2}`);
    lines.push(`- Proving-instant corridor mass: ${scenario.provingInstant.corridorUpperCloudMassKgM2}`);
    lines.push(`- Previous-step target mass after microphysics: ${scenario.endPreviousStepMicrophysics.targetCellUpperCloudMassKgM2}`);
    lines.push(`- Previous-step corridor mass after microphysics: ${scenario.endPreviousStepMicrophysics.corridorUpperCloudMassKgM2}`);
    if (scenario.currentInstrumentationLedger) {
      lines.push(`- Current-style microphysics target ledger: input=${scenario.currentInstrumentationLedger.targetCell.inputMassKgM2}, cloudReevap=${scenario.currentInstrumentationLedger.targetCell.cloudReevaporationMassKgM2}, precipReevap=${scenario.currentInstrumentationLedger.targetCell.precipReevaporationMassKgM2}, sedimentation=${scenario.currentInstrumentationLedger.targetCell.sedimentationExportMassKgM2}, cloudToPrecip=${scenario.currentInstrumentationLedger.targetCell.cloudToPrecipMassKgM2}, output=${scenario.currentInstrumentationLedger.targetCell.outputMassKgM2}`);
    }
  }
  lines.push('');
  lines.push('## Why the competing owner is not primary');
  lines.push(`- ${placement.nonOwnerExplanation}`);
  for (const line of placement.supportingEvidence) {
    lines.push(`- ${line}`);
  }
  lines.push('');
  lines.push('## Predicted before/after signature');
  lines.push(`- Ledger target residual drop: ${predictedSignature.preverticalLedger.targetCellPreviousStepResidualExpectedDropKgM2} kg/m²`);
  lines.push(`- Ledger corridor residual drop: ${predictedSignature.preverticalLedger.corridorPreviousStepResidualExpectedDropKgM2} kg/m²`);
  lines.push(`- Provenance expectation: ${predictedSignature.provenanceOwnership.expectation}`);
  lines.push(`- Reduced-order expectation: ${predictedSignature.reducedOrderExperiment.expectation}`);
  lines.push(`- Climate expectation: ${predictedSignature.climateGate.expectation}`);
  lines.push('');
  lines.push('## Falsification rule');
  lines.push(`- ${result.falsificationRule}`);
  return lines.join('\n');
};

const runProof = async () => {
  const contract = readJson(contractPath);
  const u2Report = readJson(u2ReportPath);
  const u4Report = readJson(u4ReportPath);
  const normalizedReport = readJson(u5NormalizedPath);

  const historicalRoot = corridorProof.ensureHistoricalWorktree({
    root: contract.baselineRoots.historical.root,
    commit: contract.baselineRoots.historical.commit
  });
  const currentModules = await corridorProof.importBaselineModules(repoRoot);
  const historicalModules = await corridorProof.importBaselineModules(historicalRoot);

  const targetCell = contract.corridor.targetCell;
  const dtDays = contract.corridor.grid.dtSeconds / 86400;

  const currentPrevStart = await createConfiguredCore(currentModules, contract);
  await advanceToDay(currentPrevStart, contract.corridor.checkpointDay - dtDays);
  const historicalPrevStart = await createConfiguredCore(historicalModules, contract);
  await advanceToDay(historicalPrevStart, contract.corridor.checkpointDay - dtDays);

  const currentCheckpoint = await createConfiguredCore(currentModules, contract);
  await advanceToDay(currentCheckpoint, contract.corridor.checkpointDay);
  const corridorIndices = corridorProof.buildCorridorMask(currentCheckpoint, {
    sector: contract.corridor.sectorKey,
    latMin: contract.corridor.latBandDeg[0],
    latMax: contract.corridor.latBandDeg[1]
  });

  const historicalBaseline = await runPreviousStepScenario({
    name: 'historicalBaseline',
    seedCore: historicalPrevStart,
    baseModules: historicalModules,
    verticalModules: historicalModules,
    microModules: historicalModules,
    postModules: historicalModules,
    targetCell,
    corridorIndices
  });

  const currentBaseline = await runPreviousStepScenario({
    name: 'currentBaseline',
    seedCore: currentPrevStart,
    baseModules: currentModules,
    verticalModules: currentModules,
    microModules: currentModules,
    postModules: currentModules,
    targetCell,
    corridorIndices
  });

  const verticalOnlyScenario = await runPreviousStepScenario({
    name: 'historicalVerticalOnly',
    seedCore: currentPrevStart,
    baseModules: currentModules,
    verticalModules: historicalModules,
    microModules: currentModules,
    verticalParamsSourceCore: historicalPrevStart,
    postModules: currentModules,
    targetCell,
    corridorIndices
  });

  const microphysicsOnlyScenario = await runPreviousStepScenario({
    name: 'historicalMicrophysicsOnly',
    seedCore: currentPrevStart,
    baseModules: currentModules,
    verticalModules: currentModules,
    microModules: historicalModules,
    microParamsSourceCore: historicalPrevStart,
    postModules: currentModules,
    targetCell,
    corridorIndices
  });

  const coordinatedScenario = await runPreviousStepScenario({
    name: 'historicalVerticalAndMicrophysics',
    seedCore: currentPrevStart,
    baseModules: currentModules,
    verticalModules: historicalModules,
    microModules: historicalModules,
    verticalParamsSourceCore: historicalPrevStart,
    microParamsSourceCore: historicalPrevStart,
    postModules: currentModules,
    targetCell,
    corridorIndices
  });

  const summarizedCurrentBaseline = summarizePlacementScenario({
    scenario: currentBaseline,
    currentBaseline,
    historicalBaseline
  });
  const summarizedHistoricalBaseline = summarizePlacementScenario({
    scenario: historicalBaseline,
    currentBaseline,
    historicalBaseline
  });
  const summarizedVerticalOnly = summarizePlacementScenario({
    scenario: verticalOnlyScenario,
    currentBaseline,
    historicalBaseline
  });
  const summarizedMicrophysicsOnly = summarizePlacementScenario({
    scenario: microphysicsOnlyScenario,
    currentBaseline,
    historicalBaseline
  });
  const summarizedCoordinated = summarizePlacementScenario({
    scenario: coordinatedScenario,
    currentBaseline,
    historicalBaseline
  });

  const placement = choosePatchPlacement({
    verticalOnly: summarizedVerticalOnly,
    microphysicsOnly: summarizedMicrophysicsOnly,
    coordinated: summarizedCoordinated,
    u2Report,
    u4Report,
    normalizedReport,
    contract
  });
  const predictedSignature = buildPredictedSignature({
    placement,
    currentBaseline: summarizedCurrentBaseline,
    historicalBaseline: summarizedHistoricalBaseline,
    u2Report,
    u4Report
  });
  const falsificationRule = buildFalsificationRule({ placement });

  return {
    schema: 'satellite-wars.prevertical-patch-placement-proof.v1',
    generatedAt: new Date().toISOString(),
    contractPath,
    baselines: {
      historical: {
        root: historicalRoot,
        commit: commitAtRoot(historicalRoot)
      },
      current: {
        root: repoRoot,
        commit: commitAtRoot(repoRoot)
      }
    },
    evidenceInputs: {
      u2ReportPath,
      u4ReportPath,
      u5NormalizedPath,
      u2DominantOwner: u2Report?.primaryOwnerRanking?.targetCell?.key || null,
      u4Decision: u4Report?.rootCauseAssessment?.decision || null,
      normalizedStableOwner: normalizedReport?.assessment?.normalizedStableOwner || null,
      normalizedStableBoundary: normalizedReport?.assessment?.normalizedStableBoundary || null
    },
    scenarios: [
      summarizedHistoricalBaseline,
      summarizedCurrentBaseline,
      summarizedVerticalOnly,
      summarizedMicrophysicsOnly,
      summarizedCoordinated
    ],
    placement,
    predictedSignature,
    falsificationRule
  };
};

const main = async () => {
  const result = await runProof();
  const markdown = renderMarkdown(result);
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    placement: result.placement,
    winningScenario: result.placement.winningScenario
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  summarizePlacementScenario,
  choosePatchPlacement,
  buildPredictedSignature,
  buildFalsificationRule
};
