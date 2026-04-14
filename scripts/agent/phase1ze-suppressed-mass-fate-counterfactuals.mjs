#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1ze-off.json';
const defaultRetainPath = '/tmp/phase1ze-retain.json';
const defaultSinkPath = '/tmp/phase1ze-sink.json';
const defaultBufferedPath = '/tmp/phase1ze-buffered.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1ze-suppressed-mass-fate-counterfactuals.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1ze-suppressed-mass-fate-counterfactuals.json');

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
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestMetrics = (audit) => audit?.samples?.[audit.samples.length - 1]?.metrics || {};
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;

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

function summarizeMode(modeKey, audit, offAudit) {
  const metrics = latestMetrics(audit);
  const offMetrics = latestMetrics(offAudit);
  const sample = latestSample(audit);
  const offSample = latestSample(offAudit);

  const itczDelta = (Number(metrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0);
  const dryNorthDelta = (Number(metrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0);
  const drySouthDelta = (Number(metrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0);
  const shoulderCoreDelta = bandAverage(sample, 'largeScaleCondensationSourceKgM2', 3, 12) - bandAverage(offSample, 'largeScaleCondensationSourceKgM2', 3, 12);
  const spilloverDelta = bandAverage(sample, 'largeScaleCondensationSourceKgM2', 12, 22.5) - bandAverage(offSample, 'largeScaleCondensationSourceKgM2', 12, 22.5);
  const targetEntryApplied = bandAverage(sample, 'shoulderAbsorptionGuardAppliedSuppressionKgM2', 30, 45);
  const retainedMass = bandAverage(sample, 'shoulderAbsorptionGuardRetainedVaporKgM2', 3, 12);
  const sinkMass = bandAverage(sample, 'shoulderAbsorptionGuardSinkExportKgM2', 3, 12);
  const bufferedMass = bandAverage(sample, 'shoulderAbsorptionGuardBufferedRainoutKgM2', 3, 12);

  const exitCriteria = {
    shoulderCoreCondensationPass: shoulderCoreDelta <= 0,
    spilloverPass: spilloverDelta <= 0,
    targetEntryPass: targetEntryApplied <= 1e-6,
    itczGuardrailPass: itczDelta <= 0,
    dryNorthGuardrailPass: dryNorthDelta <= 0,
    drySouthGuardrailPass: drySouthDelta <= 0
  };
  const exitCriteriaPass = Object.values(exitCriteria).every(Boolean);
  const score = mean(
    1 - clamp01(Math.max(0, shoulderCoreDelta) / 0.016),
    1 - clamp01(Math.max(0, spilloverDelta) / 0.0065),
    1 - clamp01(Math.max(0, itczDelta) / 0.056),
    1 - clamp01(Math.max(0, dryNorthDelta) / 0.012),
    1 - clamp01(Math.max(0, drySouthDelta) / 0.005),
    1 - clamp01(targetEntryApplied / 0.001)
  );

  return {
    key: modeKey,
    label: modeKey === 'retain'
      ? 'In-place vapor retention'
      : modeKey === 'sink_export'
        ? 'Capped local sink/export'
        : 'Buffered rainout',
    score: round(score, 5),
    exitCriteriaPass,
    exitCriteria,
    metrics: {
      itczWidthDeg: round(metrics.itczWidthDeg || 0, 5),
      subtropicalDryNorthRatio: round(metrics.subtropicalDryNorthRatio || 0, 5),
      subtropicalDrySouthRatio: round(metrics.subtropicalDrySouthRatio || 0, 5),
      midlatitudeWesterliesNorthU10Ms: round(metrics.midlatitudeWesterliesNorthU10Ms || 0, 5)
    },
    deltas: {
      itczWidthDeg: round(itczDelta, 5),
      subtropicalDryNorthRatio: round(dryNorthDelta, 5),
      subtropicalDrySouthRatio: round(drySouthDelta, 5),
      tropicalShoulderCoreCondensationKgM2: round(shoulderCoreDelta, 5),
      shoulderSpilloverKgM2: round(spilloverDelta, 5),
      targetEntryAppliedSuppressionKgM2: round(targetEntryApplied, 5)
    },
    fateDiagnostics: {
      retainedVaporKgM2: round(retainedMass, 5),
      sinkExportKgM2: round(sinkMass, 5),
      bufferedRainoutKgM2: round(bufferedMass, 5)
    }
  };
}

export function buildPhase1ZESuppressedMassFateCounterfactuals({ offAudit, retainAudit, sinkAudit, bufferedAudit, paths }) {
  const results = [
    summarizeMode('retain', retainAudit, offAudit),
    summarizeMode('sink_export', sinkAudit, offAudit),
    summarizeMode('buffered_rainout', bufferedAudit, offAudit)
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const winner = results[0];
  const allFail = results.every((result) => !result.exitCriteriaPass);

  return {
    schema: 'satellite-wars.phase1ze-suppressed-mass-fate-counterfactuals.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: winner.exitCriteriaPass ? 'winner_found' : 'no_counterfactual_clears_gate',
    nextPhase: winner.exitCriteriaPass
      ? `Phase 1ZF: Implement ${winner.key} shoulder fate patch`
      : 'Phase 1ZF: Shoulder Fate Patch Design',
    recommendation: winner.exitCriteriaPass
      ? `${winner.label} is the first fate mode that clears the counterfactual gate and should become the next implementation candidate.`
      : `No fate mode clears every guardrail yet. ${winner.label} is the best current direction, but it still needs a patch-design phase instead of a direct default enablement.`,
    offMetrics: latestMetrics(offAudit),
    ranking: results,
    winner,
    allFail
  };
}

export function renderPhase1ZEReport(summary) {
  const lines = [
    '# Phase 1ZE Suppressed-Mass Fate Counterfactuals',
    '',
    '## Scope',
    '',
    `- off baseline: \`${summary.paths.offPath}\``,
    `- retain: \`${summary.paths.retainPath}\``,
    `- sink/export: \`${summary.paths.sinkPath}\``,
    `- buffered rainout: \`${summary.paths.bufferedPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- ${summary.recommendation}`,
    '',
    '## Ranking',
    ''
  ];

  for (const item of summary.ranking) {
    lines.push(`- ${item.key}: score \`${item.score}\`, exit pass \`${item.exitCriteriaPass}\``);
    lines.push(`  itcz delta \`${item.deltas.itczWidthDeg}\`, dry north delta \`${item.deltas.subtropicalDryNorthRatio}\`, dry south delta \`${item.deltas.subtropicalDrySouthRatio}\``);
    lines.push(`  shoulder core delta \`${item.deltas.tropicalShoulderCoreCondensationKgM2}\`, spillover delta \`${item.deltas.shoulderSpilloverKgM2}\`, target-entry applied \`${item.deltas.targetEntryAppliedSuppressionKgM2}\``);
    lines.push(`  retained \`${item.fateDiagnostics.retainedVaporKgM2}\`, sink/export \`${item.fateDiagnostics.sinkExportKgM2}\`, buffered rainout \`${item.fateDiagnostics.bufferedRainoutKgM2}\``);
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    retainPath: defaultRetainPath,
    sinkPath: defaultSinkPath,
    bufferedPath: defaultBufferedPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--retain' && argv[i + 1]) options.retainPath = argv[++i];
    else if (arg.startsWith('--retain=')) options.retainPath = arg.slice('--retain='.length);
    else if (arg === '--sink' && argv[i + 1]) options.sinkPath = argv[++i];
    else if (arg.startsWith('--sink=')) options.sinkPath = arg.slice('--sink='.length);
    else if (arg === '--buffered' && argv[i + 1]) options.bufferedPath = argv[++i];
    else if (arg.startsWith('--buffered=')) options.bufferedPath = arg.slice('--buffered='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZESuppressedMassFateCounterfactuals({
    offAudit: readJson(options.offPath),
    retainAudit: readJson(options.retainPath),
    sinkAudit: readJson(options.sinkPath),
    bufferedAudit: readJson(options.bufferedPath),
    paths: options
  });
  const report = renderPhase1ZEReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
