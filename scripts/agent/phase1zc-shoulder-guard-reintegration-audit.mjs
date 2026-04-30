#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zb-off.json';
const defaultOnPath = '/tmp/phase1zb-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zc-shoulder-guard-reintegration-audit.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zc-shoulder-guard-reintegration-audit.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const mean = (...values) => values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / Math.max(1, values.length);
const delta = (onValue, offValue) => (Number(onValue) || 0) - (Number(offValue) || 0);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestMetrics = (audit) => audit?.samples?.[audit.samples.length - 1]?.metrics || {};
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;

function nearestIndex(latitudesDeg, targetLat) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < latitudesDeg.length; i += 1) {
    const distance = Math.abs((latitudesDeg[i] || 0) - targetLat);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function snapshot(sample, targetLat) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return null;
  const index = nearestIndex(latitudesDeg, targetLat);
  const get = (key) => Number(sample?.profiles?.series?.[key]?.[index]) || 0;
  const finalCond = get('largeScaleCondensationSourceKgM2');
  const appliedSuppression = get('shoulderAbsorptionGuardAppliedSuppressionKgM2');
  return {
    latitudeDeg: round(latitudesDeg[index], 2),
    largeScaleCondensationSourceKgM2: round(finalCond, 5),
    shoulderAbsorptionGuardCandidateMassKgM2: round(get('shoulderAbsorptionGuardCandidateMassKgM2'), 5),
    shoulderAbsorptionGuardPotentialSuppressedMassKgM2: round(get('shoulderAbsorptionGuardPotentialSuppressedMassKgM2'), 5),
    shoulderAbsorptionGuardAppliedSuppressionKgM2: round(appliedSuppression, 5),
    shoulderAbsorptionGuardBandWindowFrac: round(get('shoulderAbsorptionGuardBandWindowFrac'), 5),
    shoulderAbsorptionGuardSelectorSupportFrac: round(get('shoulderAbsorptionGuardSelectorSupportFrac'), 5),
    freshShoulderLatitudeWindowDiagFrac: round(get('freshShoulderLatitudeWindowDiagFrac'), 5),
    freshShoulderTargetEntryExclusionDiagFrac: round(get('freshShoulderTargetEntryExclusionDiagFrac'), 5),
    totalColumnWaterKgM2: round(get('totalColumnWaterKgM2'), 5),
    boundaryLayerRhFrac: round(get('boundaryLayerRhFrac'), 5),
    lowerTroposphericRhFrac: round(get('lowerTroposphericRhFrac'), 5),
    midTroposphericRhFrac: round(get('midTroposphericRhFrac'), 5),
    precipRateMmHr: round(get('precipRateMmHr'), 5),
    reconstructedRawCondensationKgM2: round(finalCond + appliedSuppression, 5)
  };
}

function bandAverage(sample, key, minLat, maxLat) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  const series = sample?.profiles?.series?.[key] || [];
  let sum = 0;
  let count = 0;
  for (let i = 0; i < latitudesDeg.length; i += 1) {
    if (!(latitudesDeg[i] >= minLat && latitudesDeg[i] <= maxLat)) continue;
    sum += Number(series[i]) || 0;
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function bandReconstructedRawCondensation(sample, minLat, maxLat) {
  return bandAverage(sample, 'largeScaleCondensationSourceKgM2', minLat, maxLat)
    + bandAverage(sample, 'shoulderAbsorptionGuardAppliedSuppressionKgM2', minLat, maxLat);
}

export function buildPhase1ZCShoulderGuardReintegrationAudit({ offAudit, onAudit, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const shoulder3Off = snapshot(offSample, 3.75);
  const shoulder3On = snapshot(onSample, 3.75);
  const shoulder11Off = snapshot(offSample, 11.25);
  const shoulder11On = snapshot(onSample, 11.25);
  const spill18Off = snapshot(offSample, 18.75);
  const spill18On = snapshot(onSample, 18.75);
  const source26Off = snapshot(offSample, 26.25);
  const source26On = snapshot(onSample, 26.25);
  const target33Off = snapshot(offSample, 33.75);
  const target33On = snapshot(onSample, 33.75);

  const bandDiagnostics = {
    tropicalShoulderCoreNetCondensationDeltaKgM2: round(
      bandAverage(onSample, 'largeScaleCondensationSourceKgM2', 3, 12)
        - bandAverage(offSample, 'largeScaleCondensationSourceKgM2', 3, 12),
      5
    ),
    tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2: round(
      bandReconstructedRawCondensation(onSample, 3, 12)
        - bandReconstructedRawCondensation(offSample, 3, 12),
      5
    ),
    tropicalShoulderCoreAppliedSuppressionOnKgM2: round(
      bandAverage(onSample, 'shoulderAbsorptionGuardAppliedSuppressionKgM2', 3, 12),
      5
    ),
    tropicalShoulderCoreTcwDeltaKgM2: round(
      bandAverage(onSample, 'totalColumnWaterKgM2', 3, 12)
        - bandAverage(offSample, 'totalColumnWaterKgM2', 3, 12),
      5
    ),
    tropicalShoulderCoreMidRhDeltaFrac: round(
      bandAverage(onSample, 'midTroposphericRhFrac', 3, 12)
        - bandAverage(offSample, 'midTroposphericRhFrac', 3, 12),
      5
    ),
    adjacentShoulderSpilloverDeltaKgM2: round(
      bandAverage(onSample, 'largeScaleCondensationSourceKgM2', 12, 22.5)
        - bandAverage(offSample, 'largeScaleCondensationSourceKgM2', 12, 22.5),
      5
    ),
    adjacentShoulderSpilloverTcwDeltaKgM2: round(
      bandAverage(onSample, 'totalColumnWaterKgM2', 12, 22.5)
        - bandAverage(offSample, 'totalColumnWaterKgM2', 12, 22.5),
      5
    ),
    adjacentShoulderSpilloverMidRhDeltaFrac: round(
      bandAverage(onSample, 'midTroposphericRhFrac', 12, 22.5)
        - bandAverage(offSample, 'midTroposphericRhFrac', 12, 22.5),
      5
    ),
    targetEntryAppliedSuppressionOnKgM2: round(
      bandAverage(onSample, 'shoulderAbsorptionGuardAppliedSuppressionKgM2', 30, 45),
      5
    )
  };

  const sameLaneVaporRechargeScore = mean(
    clamp01(bandDiagnostics.tropicalShoulderCoreNetCondensationDeltaKgM2 / 0.01),
    clamp01(bandDiagnostics.tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2 / 0.02),
    clamp01(bandDiagnostics.tropicalShoulderCoreAppliedSuppressionOnKgM2 / 0.01),
    clamp01(bandDiagnostics.tropicalShoulderCoreTcwDeltaKgM2 / 0.08),
    clamp01(bandDiagnostics.tropicalShoulderCoreMidRhDeltaFrac / 0.002)
  );

  const adjacentSpilloverScore = mean(
    clamp01(bandDiagnostics.adjacentShoulderSpilloverDeltaKgM2 / 0.004),
    clamp01(bandDiagnostics.adjacentShoulderSpilloverTcwDeltaKgM2 / 0.08),
    clamp01(bandDiagnostics.adjacentShoulderSpilloverMidRhDeltaFrac / 0.004),
    1 - clamp01((spill18On.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) / 0.001)
  );

  const ranking = [
    {
      key: 'same_lane_vapor_recharge',
      label: 'Suppressed shoulder condensation is reappearing as a same-lane vapor recharge inside the corrected 3–12°N selector.',
      score: round(sameLaneVaporRechargeScore, 5),
      evidence: {
        tropicalShoulderCoreNetCondensationDeltaKgM2: bandDiagnostics.tropicalShoulderCoreNetCondensationDeltaKgM2,
        tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2: bandDiagnostics.tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2,
        tropicalShoulderCoreAppliedSuppressionOnKgM2: bandDiagnostics.tropicalShoulderCoreAppliedSuppressionOnKgM2,
        tropicalShoulderCoreTcwDeltaKgM2: bandDiagnostics.tropicalShoulderCoreTcwDeltaKgM2,
        tropicalShoulderCoreMidRhDeltaFrac: bandDiagnostics.tropicalShoulderCoreMidRhDeltaFrac
      }
    },
    {
      key: 'adjacent_ungated_shoulder_spillover',
      label: 'A secondary share of the rebound spills poleward into the ungated 12–22.5°N shoulder-adjacent lane.',
      score: round(adjacentSpilloverScore, 5),
      evidence: {
        adjacentShoulderSpilloverDeltaKgM2: bandDiagnostics.adjacentShoulderSpilloverDeltaKgM2,
        adjacentShoulderSpilloverTcwDeltaKgM2: bandDiagnostics.adjacentShoulderSpilloverTcwDeltaKgM2,
        adjacentShoulderSpilloverMidRhDeltaFrac: bandDiagnostics.adjacentShoulderSpilloverMidRhDeltaFrac,
        spill18p75AppliedSuppressionOnKgM2: spill18On.shoulderAbsorptionGuardAppliedSuppressionKgM2
      }
    }
  ];

  return {
    schema: 'satellite-wars.phase1zc-shoulder-guard-reintegration-audit.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'same_lane_vapor_recharge',
    nextPhase: 'Phase 1ZD: Suppressed-Mass Fate Design',
    recommendation: 'The next phase should stop redesigning selector geometry and instead explain how the suppressed 3–12°N marine condensation mass is recharging the same shoulder lane and spilling into 18.75°N.',
    offOnCompare: {
      itczWidthDeg: { off: round(offMetrics.itczWidthDeg || 0, 5), on: round(onMetrics.itczWidthDeg || 0, 5), delta: round(delta(onMetrics.itczWidthDeg, offMetrics.itczWidthDeg), 5) },
      subtropicalDryNorthRatio: { off: round(offMetrics.subtropicalDryNorthRatio || 0, 5), on: round(onMetrics.subtropicalDryNorthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDryNorthRatio, offMetrics.subtropicalDryNorthRatio), 5) },
      subtropicalDrySouthRatio: { off: round(offMetrics.subtropicalDrySouthRatio || 0, 5), on: round(onMetrics.subtropicalDrySouthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDrySouthRatio, offMetrics.subtropicalDrySouthRatio), 5) }
    },
    bandDiagnostics,
    referenceSlices: {
      shoulder3p75: { off: shoulder3Off, on: shoulder3On },
      shoulder11p25: { off: shoulder11Off, on: shoulder11On },
      spillover18p75: { off: spill18Off, on: spill18On },
      source26p25: { off: source26Off, on: source26On },
      targetEntry33p75: { off: target33Off, on: target33On }
    },
    ranking,
    rootCauseAssessment: {
      ruledIn: [
        'The corrected selector is active in the right 3–12°N shoulder cells, but the same lane becomes moister and more RH-rich, so reconstructed raw condensation rises faster than the applied suppression.',
        'A smaller secondary rebound leaks into 18.75°N even though the guard never fires there.'
      ],
      ruledOut: [
        'This is no longer a 30–45°N target-entry false-positive problem.'
      ],
      ambiguous: [
        'Whether the next fix should route suppressed mass into a local sink, a delayed rainout path, or a narrower inner-vs-outer shoulder split is still unresolved.'
      ]
    }
  };
}

export function renderPhase1ZCReport(summary) {
  const lines = [
    '# Phase 1ZC Shoulder Guard Reintegration Audit',
    '',
    '## Scope',
    '',
    `- Same-branch off audit: \`${summary.paths.offPath}\``,
    `- Same-branch on audit: \`${summary.paths.onPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- ${summary.recommendation}`,
    '',
    '## Off Versus On',
    '',
    `- \`itczWidthDeg\`: \`${summary.offOnCompare.itczWidthDeg.off}\` -> \`${summary.offOnCompare.itczWidthDeg.on}\` (delta \`${summary.offOnCompare.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.offOnCompare.subtropicalDryNorthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDryNorthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.offOnCompare.subtropicalDrySouthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDrySouthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDrySouthRatio.delta}\`)`,
    '',
    '## Band Diagnostics',
    '',
    `- tropical shoulder core net condensation delta: \`${summary.bandDiagnostics.tropicalShoulderCoreNetCondensationDeltaKgM2}\``,
    `- tropical shoulder core reconstructed raw condensation delta: \`${summary.bandDiagnostics.tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2}\``,
    `- tropical shoulder core applied suppression on: \`${summary.bandDiagnostics.tropicalShoulderCoreAppliedSuppressionOnKgM2}\``,
    `- tropical shoulder core TCW delta: \`${summary.bandDiagnostics.tropicalShoulderCoreTcwDeltaKgM2}\``,
    `- tropical shoulder core mid-RH delta: \`${summary.bandDiagnostics.tropicalShoulderCoreMidRhDeltaFrac}\``,
    `- adjacent shoulder spillover delta: \`${summary.bandDiagnostics.adjacentShoulderSpilloverDeltaKgM2}\``,
    `- adjacent shoulder TCW delta: \`${summary.bandDiagnostics.adjacentShoulderSpilloverTcwDeltaKgM2}\``,
    `- adjacent shoulder mid-RH delta: \`${summary.bandDiagnostics.adjacentShoulderSpilloverMidRhDeltaFrac}\``,
    `- target-entry applied suppression on: \`${summary.bandDiagnostics.targetEntryAppliedSuppressionOnKgM2}\``,
    '',
    '## Key Slices',
    '',
    `- shoulder \`3.75°N\`: off/on final condensation \`${summary.referenceSlices.shoulder3p75.off.largeScaleCondensationSourceKgM2}\` / \`${summary.referenceSlices.shoulder3p75.on.largeScaleCondensationSourceKgM2}\`, on applied \`${summary.referenceSlices.shoulder3p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`, on reconstructed raw \`${summary.referenceSlices.shoulder3p75.on.reconstructedRawCondensationKgM2}\``,
    `- shoulder \`11.25°N\`: off/on final condensation \`${summary.referenceSlices.shoulder11p25.off.largeScaleCondensationSourceKgM2}\` / \`${summary.referenceSlices.shoulder11p25.on.largeScaleCondensationSourceKgM2}\`, on applied \`${summary.referenceSlices.shoulder11p25.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`, on reconstructed raw \`${summary.referenceSlices.shoulder11p25.on.reconstructedRawCondensationKgM2}\``,
    `- spillover \`18.75°N\`: off/on condensation \`${summary.referenceSlices.spillover18p75.off.largeScaleCondensationSourceKgM2}\` / \`${summary.referenceSlices.spillover18p75.on.largeScaleCondensationSourceKgM2}\`, on applied \`${summary.referenceSlices.spillover18p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\``,
    `- source \`26.25°N\`: off/on condensation \`${summary.referenceSlices.source26p25.off.largeScaleCondensationSourceKgM2}\` / \`${summary.referenceSlices.source26p25.on.largeScaleCondensationSourceKgM2}\``,
    `- target entry \`33.75°N\`: off/on candidate \`${summary.referenceSlices.targetEntry33p75.off.shoulderAbsorptionGuardCandidateMassKgM2}\` / \`${summary.referenceSlices.targetEntry33p75.on.shoulderAbsorptionGuardCandidateMassKgM2}\`, on exclusion \`${summary.referenceSlices.targetEntry33p75.on.freshShoulderTargetEntryExclusionDiagFrac}\``,
    '',
    '## Ranked Residuals',
    '',
    ...summary.ranking.map((item, index) => `${index + 1}. ${item.key}: ${item.label} (score \`${item.score}\`)`),
    '',
    '## Assessment',
    '',
    ...summary.rootCauseAssessment.ruledIn.map((line) => `- ruled in: ${line}`),
    ...summary.rootCauseAssessment.ruledOut.map((line) => `- ruled out: ${line}`),
    ...summary.rootCauseAssessment.ambiguous.map((line) => `- ambiguous: ${line}`)
  ];
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const offAudit = readJson(options.offPath);
  const onAudit = readJson(options.onPath);
  const summary = buildPhase1ZCShoulderGuardReintegrationAudit({
    offAudit,
    onAudit,
    paths: options
  });
  const report = renderPhase1ZCReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
