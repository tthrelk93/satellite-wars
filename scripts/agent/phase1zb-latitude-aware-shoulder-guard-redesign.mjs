#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zb-off.json';
const defaultOnPath = '/tmp/phase1zb-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zb-latitude-aware-shoulder-guard-redesign.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zb-latitude-aware-shoulder-guard-redesign.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

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
  return {
    latitudeDeg: round(latitudesDeg[index], 2),
    largeScaleCondensationSourceKgM2: round(get('largeScaleCondensationSourceKgM2'), 5),
    shoulderAbsorptionGuardCandidateMassKgM2: round(get('shoulderAbsorptionGuardCandidateMassKgM2'), 5),
    shoulderAbsorptionGuardAppliedSuppressionKgM2: round(get('shoulderAbsorptionGuardAppliedSuppressionKgM2'), 5),
    shoulderAbsorptionGuardBandWindowFrac: round(get('shoulderAbsorptionGuardBandWindowFrac'), 5),
    shoulderAbsorptionGuardSelectorSupportFrac: round(get('shoulderAbsorptionGuardSelectorSupportFrac'), 5),
    freshShoulderLatitudeWindowDiagFrac: round(get('freshShoulderLatitudeWindowDiagFrac'), 5),
    freshShoulderTargetEntryExclusionDiagFrac: round(get('freshShoulderTargetEntryExclusionDiagFrac'), 5),
    dryingOmegaBridgeProjectedAppliedPaS: round(get('dryingOmegaBridgeProjectedAppliedPaS'), 5)
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

export function buildPhase1ZBLatitudeAwareShoulderGuardRedesign({ offAudit, onAudit, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const shoulder3Off = snapshot(offSample, 3.75);
  const shoulder3On = snapshot(onSample, 3.75);
  const shoulder11On = snapshot(onSample, 11.25);
  const target33Off = snapshot(offSample, 33.75);
  const target33On = snapshot(onSample, 33.75);

  const exitCriteria = {
    strongestShoulderAdmittedPass:
      (shoulder3On?.shoulderAbsorptionGuardCandidateMassKgM2 || 0) > 0
      && (shoulder3On?.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) > 0
      && (shoulder3On?.freshShoulderLatitudeWindowDiagFrac || 0) > 0.5,
    targetEntryExcludedPass:
      (target33On?.shoulderAbsorptionGuardCandidateMassKgM2 || 0) === 0
      && (target33On?.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) === 0
      && (target33On?.freshShoulderTargetEntryExclusionDiagFrac || 0) > 0.5,
    guardrailPass:
      (Number(onMetrics.itczWidthDeg) || 0) <= (Number(offMetrics.itczWidthDeg) || 0)
      && (Number(onMetrics.subtropicalDryNorthRatio) || 0) <= (Number(offMetrics.subtropicalDryNorthRatio) || 0)
      && (Number(onMetrics.subtropicalDrySouthRatio) || 0) <= (Number(offMetrics.subtropicalDrySouthRatio) || 0),
    shoulderCoreCondensationPass:
      bandAverage(onSample, 'largeScaleCondensationSourceKgM2', 3, 12)
      <= bandAverage(offSample, 'largeScaleCondensationSourceKgM2', 3, 12)
  };

  const verdict = Object.values(exitCriteria).every(Boolean)
    ? 'selector_redesigned'
    : 'needs_follow_up';

  return {
    schema: 'satellite-wars.phase1zb-latitude-aware-shoulder-guard-redesign.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    nextPhase: verdict === 'selector_redesigned'
      ? 'Phase 2A: Finish Hadley Moisture Partitioning'
      : 'Phase 1ZC: Shoulder Guard Reintegration Audit',
    recommendation: verdict === 'selector_redesigned'
      ? 'The selector geometry is now correct enough to stop iterating on amplitude and move back into the broader moisture-partitioning roadmap.'
      : 'The selector geometry is improved but still needs a follow-up reintegration audit before we treat the shoulder lane as solved.',
    offOnCompare: {
      itczWidthDeg: { off: round(offMetrics.itczWidthDeg || 0, 5), on: round(onMetrics.itczWidthDeg || 0, 5), delta: round(delta(onMetrics.itczWidthDeg, offMetrics.itczWidthDeg), 5) },
      subtropicalDryNorthRatio: { off: round(offMetrics.subtropicalDryNorthRatio || 0, 5), on: round(onMetrics.subtropicalDryNorthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDryNorthRatio, offMetrics.subtropicalDryNorthRatio), 5) },
      subtropicalDrySouthRatio: { off: round(offMetrics.subtropicalDrySouthRatio || 0, 5), on: round(onMetrics.subtropicalDrySouthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDrySouthRatio, offMetrics.subtropicalDrySouthRatio), 5) }
    },
    bandDiagnostics: {
      tropicalShoulderCoreCondensationDeltaKgM2: round(
        bandAverage(onSample, 'largeScaleCondensationSourceKgM2', 3, 12)
          - bandAverage(offSample, 'largeScaleCondensationSourceKgM2', 3, 12),
        5
      ),
      tropicalShoulderCoreAppliedSuppressionOnKgM2: round(
        bandAverage(onSample, 'shoulderAbsorptionGuardAppliedSuppressionKgM2', 3, 12),
        5
      ),
      targetEntryAppliedSuppressionOnKgM2: round(
        bandAverage(onSample, 'shoulderAbsorptionGuardAppliedSuppressionKgM2', 30, 45),
        5
      )
    },
    referenceSlices: {
      shoulder3p75: { off: shoulder3Off, on: shoulder3On },
      shoulder11p25: { on: shoulder11On },
      targetEntry33p75: { off: target33Off, on: target33On }
    },
    exitCriteria
  };
}

export function renderPhase1ZBReport(summary) {
  const lines = [
    '# Phase 1ZB Latitude-Aware Shoulder Guard Redesign',
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
    '## Exit Criteria',
    '',
    `- strongest shoulder admitted: \`${summary.exitCriteria.strongestShoulderAdmittedPass}\``,
    `- target-entry excluded: \`${summary.exitCriteria.targetEntryExcludedPass}\``,
    `- guardrails preserved or improved: \`${summary.exitCriteria.guardrailPass}\``,
    `- shoulder-core condensation reduced: \`${summary.exitCriteria.shoulderCoreCondensationPass}\``,
    '',
    '## Off Versus On',
    '',
    `- \`itczWidthDeg\`: \`${summary.offOnCompare.itczWidthDeg.off}\` -> \`${summary.offOnCompare.itczWidthDeg.on}\` (delta \`${summary.offOnCompare.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.offOnCompare.subtropicalDryNorthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDryNorthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.offOnCompare.subtropicalDrySouthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDrySouthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDrySouthRatio.delta}\`)`,
    '',
    '## Key Slices',
    '',
    `- shoulder \`3.75°N\`: off candidate \`${summary.referenceSlices.shoulder3p75.off.shoulderAbsorptionGuardCandidateMassKgM2}\`, on candidate \`${summary.referenceSlices.shoulder3p75.on.shoulderAbsorptionGuardCandidateMassKgM2}\`, on applied \`${summary.referenceSlices.shoulder3p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`, on latitude window \`${summary.referenceSlices.shoulder3p75.on.freshShoulderLatitudeWindowDiagFrac}\``,
    `- shoulder \`11.25°N\`: on candidate \`${summary.referenceSlices.shoulder11p25.on.shoulderAbsorptionGuardCandidateMassKgM2}\`, on applied \`${summary.referenceSlices.shoulder11p25.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`, on latitude window \`${summary.referenceSlices.shoulder11p25.on.freshShoulderLatitudeWindowDiagFrac}\``,
    `- target entry \`33.75°N\`: off/on candidate \`${summary.referenceSlices.targetEntry33p75.off.shoulderAbsorptionGuardCandidateMassKgM2}\` / \`${summary.referenceSlices.targetEntry33p75.on.shoulderAbsorptionGuardCandidateMassKgM2}\`, off/on applied \`${summary.referenceSlices.targetEntry33p75.off.shoulderAbsorptionGuardAppliedSuppressionKgM2}\` / \`${summary.referenceSlices.targetEntry33p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`, on exclusion \`${summary.referenceSlices.targetEntry33p75.on.freshShoulderTargetEntryExclusionDiagFrac}\``,
    '',
    '## Band Diagnostics',
    '',
    `- tropical shoulder core condensation delta: \`${summary.bandDiagnostics.tropicalShoulderCoreCondensationDeltaKgM2}\``,
    `- tropical shoulder core applied suppression on: \`${summary.bandDiagnostics.tropicalShoulderCoreAppliedSuppressionOnKgM2}\``,
    `- target-entry applied suppression on: \`${summary.bandDiagnostics.targetEntryAppliedSuppressionOnKgM2}\``
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
  const summary = buildPhase1ZBLatitudeAwareShoulderGuardRedesign({
    offAudit,
    onAudit,
    paths: options
  });
  const report = renderPhase1ZBReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
