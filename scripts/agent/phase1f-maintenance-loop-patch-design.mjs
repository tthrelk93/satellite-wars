#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_PHASE1E_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1e-proof-vs-climate-delta-attribution'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1f-maintenance-loop-patch-design'
);

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

let phase1eBase = DEFAULT_PHASE1E_BASE;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--phase1e-base' && argv[i + 1]) phase1eBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--phase1e-base=')) phase1eBase = path.resolve(arg.slice('--phase1e-base='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
}

const getDelta = (baseline, patched) => ({
  baseline: round(baseline),
  patched: round(patched),
  delta: round((patched ?? 0) - (baseline ?? 0))
});

const sumCloudBirthMass = (hist = [], keys = []) => hist
  .filter((entry) => keys.includes(entry.key))
  .reduce((sum, entry) => sum + (entry.cloudBirthMassKgM2 || 0), 0);

export const buildPhase1FMaintenanceLoopPatchDesign = ({
  phase1eReport,
  baselineSummary,
  patchedSummary,
  baselineMoisture,
  patchedMoisture,
  baselineBirth,
  patchedBirth,
  baselineBirthHist,
  patchedBirthHist,
  baselineRadiation,
  patchedRadiation,
  baselineTransport,
  patchedTransport
}) => {
  const summaryBaselineMetrics = baselineSummary?.samples?.[baselineSummary.samples.length - 1]?.metrics || {};
  const summaryPatchedMetrics = patchedSummary?.samples?.[patchedSummary.samples.length - 1]?.metrics || {};
  const baselineMetrics = { ...(baselineMoisture?.latestMetrics || {}), ...summaryBaselineMetrics };
  const patchedMetrics = { ...(patchedMoisture?.latestMetrics || {}), ...summaryPatchedMetrics };
  const birthBaseline = baselineBirth?.attribution?.northDryBeltChannelMeansKgM2 || {};
  const birthPatched = patchedBirth?.attribution?.northDryBeltChannelMeansKgM2 || {};
  const baselineOceanCond = baselineMoisture?.northDryBeltGenerationAttribution?.oceanLargeScaleCondensationMeanKgM2;
  const patchedOceanCond = patchedMoisture?.northDryBeltGenerationAttribution?.oceanLargeScaleCondensationMeanKgM2;
  const baselineLandCond = baselineMoisture?.northDryBeltGenerationAttribution?.landLargeScaleCondensationMeanKgM2;
  const patchedLandCond = patchedMoisture?.northDryBeltGenerationAttribution?.landLargeScaleCondensationMeanKgM2;
  const baselineWeakAscentBirth = sumCloudBirthMass(baselineBirthHist?.histograms?.ascentMagnitudePaS, ['weak', 'modest']);
  const patchedWeakAscentBirth = sumCloudBirthMass(patchedBirthHist?.histograms?.ascentMagnitudePaS, ['weak', 'modest']);
  const baselineStrongAscentBirth = sumCloudBirthMass(baselineBirthHist?.histograms?.ascentMagnitudePaS, ['organized', 'strong', 'extreme']);
  const patchedStrongAscentBirth = sumCloudBirthMass(patchedBirthHist?.histograms?.ascentMagnitudePaS, ['organized', 'strong', 'extreme']);

  const evidence = {
    largeScaleCondensation: getDelta(
      baselineMetrics.northDryBeltLargeScaleCondensationMeanKgM2,
      patchedMetrics.northDryBeltLargeScaleCondensationMeanKgM2
    ),
    oceanLargeScaleCondensation: getDelta(baselineOceanCond, patchedOceanCond),
    landLargeScaleCondensation: getDelta(baselineLandCond, patchedLandCond),
    importedAnvilPersistence: getDelta(
      baselineMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2,
      patchedMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2
    ),
    carriedOverUpperCloud: getDelta(
      baselineMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2,
      patchedMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2
    ),
    weakErosionCloudSurvival: getDelta(
      baselineMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2,
      patchedMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2
    ),
    surfaceOceanEvaporation: getDelta(
      baselineMetrics.northDryBeltOceanEvapMeanMmHr,
      patchedMetrics.northDryBeltOceanEvapMeanMmHr
    ),
    surfaceLandEvaporation: getDelta(
      baselineMetrics.northDryBeltLandEvapMeanMmHr,
      patchedMetrics.northDryBeltLandEvapMeanMmHr
    ),
    boundaryLayerRh: getDelta(
      baselineMetrics.northDryBeltBoundaryLayerRhMeanFrac,
      patchedMetrics.northDryBeltBoundaryLayerRhMeanFrac
    ),
    midTroposphereRh: getDelta(
      baselineMetrics.northDryBeltMidTroposphereRhMeanFrac,
      patchedMetrics.northDryBeltMidTroposphereRhMeanFrac
    ),
    upperTroposphericImport: getDelta(
      baselineTransport?.dominantNhDryBeltVaporImport?.importMagnitudeKgM_1S,
      patchedTransport?.dominantNhDryBeltVaporImport?.importMagnitudeKgM_1S
    ),
    radiativePersistenceSupport: getDelta(
      baselineRadiation?.radiation?.northDryBeltUpperCloudRadiativePersistenceSupportMeanWm2,
      patchedRadiation?.radiation?.northDryBeltUpperCloudRadiativePersistenceSupportMeanWm2
    ),
    weakAscentCloudBirthMass: getDelta(baselineWeakAscentBirth, patchedWeakAscentBirth),
    strongAscentCloudBirthMass: getDelta(baselineStrongAscentBirth, patchedStrongAscentBirth)
  };

  const largeScaleCondensationCompensates = (evidence.largeScaleCondensation.delta || 0) > 0;
  const oceanCondensationDominates = (evidence.oceanLargeScaleCondensation.delta || 0) > (evidence.landLargeScaleCondensation.delta || 0);
  const importedCarryDrops = (evidence.importedAnvilPersistence.delta || 0) < 0
    && (evidence.weakErosionCloudSurvival.delta || 0) < 0
    && (evidence.carriedOverUpperCloud.delta || 0) < 0;
  const forcingDoesNotIncrease = Math.abs(evidence.surfaceOceanEvaporation.delta || 0) < 0.01
    && Math.abs(evidence.upperTroposphericImport.delta || 0) < 0.5
    && (evidence.radiativePersistenceSupport.delta || 0) <= 0;
  const weakAscentNotDominant = (patchedWeakAscentBirth || 0) < (patchedStrongAscentBirth || 0);

  const proofAnswers = {
    addedLargeScaleCondensationOrigin: {
      answer: oceanCondensationDominates
        ? 'The residual added large-scale condensation is ocean-side, not land-side.'
        : 'Ocean-side dominance is not cleanly established.',
      evidence: {
        northDryBeltLargeScaleCondensationMeanKgM2: evidence.largeScaleCondensation,
        northDryBeltOceanLargeScaleCondensationMeanKgM2: evidence.oceanLargeScaleCondensation,
        northDryBeltLandLargeScaleCondensationMeanKgM2: evidence.landLargeScaleCondensation
      }
    },
    humidificationPath: {
      answer: forcingDoesNotIncrease
        ? 'The maintenance loop is not being driven by stronger surface evaporation, stronger import, or stronger radiative support. The remaining humidification path is structural marine moisture retention feeding saturation adjustment.'
        : 'One or more external support pathways still increase enough to remain primary suspects.',
      evidence: {
        northDryBeltOceanEvapMeanMmHr: evidence.surfaceOceanEvaporation,
        northDryBeltBoundaryLayerRhMeanFrac: evidence.boundaryLayerRh,
        northDryBeltMidTroposphereRhMeanFrac: evidence.midTroposphereRh,
        dominantUpperTroposphericImportKgM_1S: evidence.upperTroposphericImport,
        upperCloudRadiativePersistenceSupportMeanWm2: evidence.radiativePersistenceSupport
      }
    },
    localVsCirculationAssessment: {
      answer: largeScaleCondensationCompensates && importedCarryDrops
        ? 'The remaining blocker is better explained by local maintenance than by the previously dominant import/retention owner. Circulation remains biased on the branch, but the next patch should target local maintenance first.'
        : 'Local maintenance is not yet proved dominant enough for the next patch.',
      evidence: {
        importedAnvilPersistenceMeanKgM2: evidence.importedAnvilPersistence,
        weakErosionCloudSurvivalMeanKgM2: evidence.weakErosionCloudSurvival,
        carriedOverUpperCloudMeanKgM2: evidence.carriedOverUpperCloud,
        largeScaleCondensationMeanKgM2: evidence.largeScaleCondensation,
        itczWidthDeg: phase1eReport?.climateGuardrailDeltas?.itczWidthDeg || null
      }
    }
  };

  const patchTarget = {
    primaryModule: 'stepMicrophysics5',
    primaryFile: path.join(repoRoot, 'src', 'weather', 'v2', 'microphysics5.js'),
    primaryRegion: 'saturation-adjustment condensation branch',
    primaryLines: '313-345',
    primaryReason: 'This branch condenses all supersaturated vapor immediately, but does not currently suppress condensation in weak-engine, subtropically suppressed marine columns. After the carry-input patch reduces imported cloud, this is the one pathway that still moves in the wrong direction.',
    secondaryModule: 'stepVertical5',
    secondaryFile: path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'),
    secondaryRegion: 'weak-erosion support diagnostics',
    secondaryLines: '1478-1498',
    secondaryReason: 'This region already computes the regime information that distinguishes weakly ventilated subtropical maintenance columns. It should provide the microphysics gating signal, but should not be the first direct climate lever again.',
    ruledOutFirstMoves: [
      {
        module: 'stepRadiation2D5',
        reason: 'Radiative support decreases in the improved patch-on state, so radiation is secondary support rather than the first corrective lever.'
      },
      {
        module: 'transport/carry-input override',
        reason: 'Imported carryover and weak-erosion survival both decrease with patch-on, so more carryover-clear tuning is not the right first move.'
      },
      {
        module: 'surface moisture source throttling',
        reason: 'Ocean evaporation is effectively unchanged across the apples-to-apples compare.'
      }
    ]
  };

  const patchMechanism = {
    label: 'Regime-selective saturation-adjustment maintenance suppression',
    description: 'Reduce or defer saturation-adjustment cloud birth only when a column is weakly organized, subtropically suppressed, and marine-maintained, while leaving organized and strong-ascent condensation largely unchanged.',
    implementationSketch: [
      'Use existing microphysics regime terms (`marginalSubsiding`, `organizedOutflow`, `convMassFluxStrength`, `subtropicalDryingStrength`) to compute a maintenance-suppression factor inside the `qvVal > qsat` branch.',
      'Apply the suppression only in weakly organized subtropical columns so the strong/organized ascent bins are preserved.',
      'Prefer a reduction in cloud birth efficiency or a delay threshold in weak-engine marine columns instead of a global reduction in condensation.'
    ]
  };

  const predictedSignature = {
    shouldDecrease: [
      { key: 'northDryBeltLargeScaleCondensationMeanKgM2', target: '< 0.16079 from current 0.17069' },
      { key: 'northDryBeltOceanLargeScaleCondensationMeanKgM2', target: '< 0.18314 from current 0.19722' },
      { key: 'northDryBeltBoundaryLayerRhMeanFrac', target: '< 0.61368' },
      { key: 'northDryBeltMidTroposphereRhMeanFrac', target: '< 0.44885' },
      { key: 'itczWidthDeg', target: '< 26.415' },
      { key: 'subtropicalDryNorthRatio', target: '< 1.704' },
      { key: 'subtropicalDrySouthRatio', target: '< 1.296' }
    ],
    shouldHoldOrImprove: [
      { key: 'northDryBeltImportedAnvilPersistenceMeanKgM2', target: '<= 0.21583' },
      { key: 'northDryBeltWeakErosionCloudSurvivalMeanKgM2', target: '<= 0.21337' },
      { key: 'midlatitudeWesterliesNorthU10Ms', target: '>= 0.532' },
      { key: 'midlatitudeWesterliesSouthU10Ms', target: '>= 0.851' }
    ],
    antiPattern: 'Do not globally suppress saturation-adjustment condensation. Strong/organized ascent bins still dominate cumulative cloud birth, so a blanket microphysics reduction would likely damage the tropical engine.'
  };

  const exitCriteriaPass = largeScaleCondensationCompensates && oceanCondensationDominates && importedCarryDrops && forcingDoesNotIncrease && weakAscentNotDominant;

  return {
    schema: 'satellite-wars.phase1f-maintenance-loop-patch-design.v1',
    generatedAt: new Date().toISOString(),
    inputs: {
      phase1eReport: phase1eReport?.config?.reportBasePath || null,
      baselineSummaryPath: phase1eReport?.baseline?.summaryPath || null,
      patchedSummaryPath: phase1eReport?.patched?.summaryPath || null
    },
    keyEvidence: evidence,
    proofAnswers,
    patchTarget,
    patchMechanism,
    predictedSignature,
    decision: {
      nextPhase: 'Phase 1G: implement regime-selective saturation-adjustment maintenance patch',
      exitCriteriaPass
    }
  };
};

const renderMarkdown = (report) => {
  const lines = [
    '# Phase 1F Maintenance-Loop Patch Design',
    '',
    '## Decision',
    '',
    `- Next phase: \`${report.decision.nextPhase}\``,
    `- Exit criteria pass: \`${report.decision.exitCriteriaPass}\``,
    '',
    '## Proof Answers',
    '',
    `- Added large-scale condensation origin: ${report.proofAnswers.addedLargeScaleCondensationOrigin.answer}`,
    `- Humidification path: ${report.proofAnswers.humidificationPath.answer}`,
    `- Local vs circulation assessment: ${report.proofAnswers.localVsCirculationAssessment.answer}`,
    '',
    '## Patch Target',
    '',
    `- Primary module: \`${report.patchTarget.primaryModule}\``,
    `- Primary file: ${report.patchTarget.primaryFile}`,
    `- Primary region: lines \`${report.patchTarget.primaryLines}\``,
    `- Why: ${report.patchTarget.primaryReason}`,
    `- Secondary module: \`${report.patchTarget.secondaryModule}\``,
    `- Secondary file: ${report.patchTarget.secondaryFile}`,
    `- Secondary region: lines \`${report.patchTarget.secondaryLines}\``,
    `- Why: ${report.patchTarget.secondaryReason}`,
    '',
    '## Predicted Signature',
    ''
  ];
  for (const row of report.predictedSignature.shouldDecrease) {
    lines.push(`- Should decrease \`${row.key}\` to ${row.target}`);
  }
  for (const row of report.predictedSignature.shouldHoldOrImprove) {
    lines.push(`- Should hold/improve \`${row.key}\` at ${row.target}`);
  }
  lines.push('', `- Anti-pattern: ${report.predictedSignature.antiPattern}`, '', '## Key Evidence', '');
  for (const [key, value] of Object.entries(report.keyEvidence)) {
    lines.push(`- \`${key}\`: \`${value.baseline} -> ${value.patched}\` (delta \`${value.delta}\`)`);
  }
  return `${lines.join('\n')}\n`;
};

export async function main() {
  const phase1eReport = readJson(`${phase1eBase}.json`);
  const baselineSummary = readJson(`${phase1eBase}-baseline-off.json`);
  const patchedSummary = readJson(`${phase1eBase}-patched-on.json`);
  const baselineMoisture = readJson(`${phase1eBase}-baseline-off-moisture-attribution.json`);
  const patchedMoisture = readJson(`${phase1eBase}-patched-on-moisture-attribution.json`);
  const baselineBirth = readJson(`${phase1eBase}-baseline-off-vertical-cloud-birth-attribution.json`);
  const patchedBirth = readJson(`${phase1eBase}-patched-on-vertical-cloud-birth-attribution.json`);
  const baselineBirthHist = readJson(`${phase1eBase}-baseline-off-vertical-cloud-birth-histograms.json`);
  const patchedBirthHist = readJson(`${phase1eBase}-patched-on-vertical-cloud-birth-histograms.json`);
  const baselineRadiation = readJson(`${phase1eBase}-baseline-off-radiative-cloud-maintenance.json`);
  const patchedRadiation = readJson(`${phase1eBase}-patched-on-radiative-cloud-maintenance.json`);
  const baselineTransport = readJson(`${phase1eBase}-baseline-off-transport-interface-budget.json`);
  const patchedTransport = readJson(`${phase1eBase}-patched-on-transport-interface-budget.json`);

  const report = buildPhase1FMaintenanceLoopPatchDesign({
    phase1eReport,
    baselineSummary,
    patchedSummary,
    baselineMoisture,
    patchedMoisture,
    baselineBirth,
    patchedBirth,
    baselineBirthHist,
    patchedBirthHist,
    baselineRadiation,
    patchedRadiation,
    baselineTransport,
    patchedTransport
  });
  const markdown = renderMarkdown(report);
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify(report));
  return report;
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  await main();
}

export const _test = {
  buildPhase1FMaintenanceLoopPatchDesign,
  sumCloudBirthMass
};
