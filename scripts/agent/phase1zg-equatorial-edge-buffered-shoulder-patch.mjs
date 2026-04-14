#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zg-off.json';
const defaultOnPath = '/tmp/phase1zg-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zg-equatorial-edge-buffered-shoulder-patch.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zg-equatorial-edge-buffered-shoulder-patch.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;
const latestMetrics = (audit) => latestSample(audit)?.metrics || {};

function sliceDelta(offSample, onSample, latitudeDeg) {
  const latitudesDeg = offSample?.profiles?.latitudesDeg || [];
  const index = latitudesDeg.findIndex((value) => Math.abs(value - latitudeDeg) < 1e-6);
  const seriesOff = offSample?.profiles?.series || {};
  const seriesOn = onSample?.profiles?.series || {};
  const read = (series, key) => (index >= 0 ? (series[key]?.[index] ?? null) : null);

  return {
    latitudeDeg,
    off: {
      largeScaleCondensationSourceKgM2: read(seriesOff, 'largeScaleCondensationSourceKgM2'),
      shoulderAbsorptionGuardCandidateMassKgM2: read(seriesOff, 'shoulderAbsorptionGuardCandidateMassKgM2'),
      shoulderAbsorptionGuardAppliedSuppressionKgM2: read(seriesOff, 'shoulderAbsorptionGuardAppliedSuppressionKgM2'),
      shoulderAbsorptionGuardBufferedRainoutKgM2: read(seriesOff, 'shoulderAbsorptionGuardBufferedRainoutKgM2'),
      shoulderAbsorptionGuardEventCount: read(seriesOff, 'shoulderAbsorptionGuardEventCount'),
      totalColumnWaterKgM2: read(seriesOff, 'totalColumnWaterKgM2')
    },
    on: {
      largeScaleCondensationSourceKgM2: read(seriesOn, 'largeScaleCondensationSourceKgM2'),
      shoulderAbsorptionGuardCandidateMassKgM2: read(seriesOn, 'shoulderAbsorptionGuardCandidateMassKgM2'),
      shoulderAbsorptionGuardAppliedSuppressionKgM2: read(seriesOn, 'shoulderAbsorptionGuardAppliedSuppressionKgM2'),
      shoulderAbsorptionGuardBufferedRainoutKgM2: read(seriesOn, 'shoulderAbsorptionGuardBufferedRainoutKgM2'),
      shoulderAbsorptionGuardEventCount: read(seriesOn, 'shoulderAbsorptionGuardEventCount'),
      totalColumnWaterKgM2: read(seriesOn, 'totalColumnWaterKgM2')
    },
    deltas: {
      largeScaleCondensationSourceKgM2: round((Number(read(seriesOn, 'largeScaleCondensationSourceKgM2')) || 0) - (Number(read(seriesOff, 'largeScaleCondensationSourceKgM2')) || 0)),
      shoulderAbsorptionGuardCandidateMassKgM2: round((Number(read(seriesOn, 'shoulderAbsorptionGuardCandidateMassKgM2')) || 0) - (Number(read(seriesOff, 'shoulderAbsorptionGuardCandidateMassKgM2')) || 0)),
      shoulderAbsorptionGuardAppliedSuppressionKgM2: round((Number(read(seriesOn, 'shoulderAbsorptionGuardAppliedSuppressionKgM2')) || 0) - (Number(read(seriesOff, 'shoulderAbsorptionGuardAppliedSuppressionKgM2')) || 0)),
      shoulderAbsorptionGuardEventCount: round((Number(read(seriesOn, 'shoulderAbsorptionGuardEventCount')) || 0) - (Number(read(seriesOff, 'shoulderAbsorptionGuardEventCount')) || 0)),
      totalColumnWaterKgM2: round((Number(read(seriesOn, 'totalColumnWaterKgM2')) || 0) - (Number(read(seriesOff, 'totalColumnWaterKgM2')) || 0))
    }
  };
}

export function buildPhase1ZGEquatorialEdgeBufferedShoulderPatch({ offAudit, onAudit, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const equatorialEdge = sliceDelta(offSample, onSample, 3.75);
  const innerShoulder = sliceDelta(offSample, onSample, 11.25);
  const spillover = sliceDelta(offSample, onSample, 18.75);
  const targetEntry = sliceDelta(offSample, onSample, 33.75);

  const metrics = {
    itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
    midlatitudeWesterliesNorthU10Ms: round((Number(onMetrics.midlatitudeWesterliesNorthU10Ms) || 0) - (Number(offMetrics.midlatitudeWesterliesNorthU10Ms) || 0)),
    tropicalShoulderCoreLargeScaleCondensationMeanKgM2: round((Number(onMetrics.tropicalShoulderCoreLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.tropicalShoulderCoreLargeScaleCondensationMeanKgM2) || 0))
  };

  const keepPatch = metrics.itczWidthDeg < 0
    && metrics.subtropicalDryNorthRatio < 0
    && metrics.subtropicalDrySouthRatio < 0
    && (targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) === 0
    && (spillover.deltas.largeScaleCondensationSourceKgM2 || 0) <= 0;

  return {
    schema: 'satellite-wars.phase1zg-equatorial-edge-buffered-shoulder-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: keepPatch ? 'keep_with_equatorial_edge_residual' : 'reject_equatorial_edge_patch',
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZH: Equatorial-Edge Candidate Rebound Attribution'
      : 'Phase 1ZH: Equatorial-Edge Candidate Rebound Attribution',
    metrics,
    slices: {
      equatorialEdge,
      innerShoulder,
      spillover,
      targetEntry
    },
    recommendation: keepPatch
      ? 'Keep the buffered shoulder patch on by default: it improves ITCZ width and both dry-belt ratios while preserving the target-entry exclusion, then use the next phase to explain the remaining 3.75°N rebound.'
      : 'Do not keep this patch by default yet; use the next phase to explain the equatorial-edge rebound before another implementation attempt.'
  };
}

export function renderPhase1ZGReport(summary) {
  return `# Phase 1ZG Equatorial-Edge Buffered Shoulder Patch

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Climate Guardrails

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- NH westerlies delta: \`${summary.metrics.midlatitudeWesterliesNorthU10Ms}\`
- tropical shoulder core condensation delta: \`${summary.metrics.tropicalShoulderCoreLargeScaleCondensationMeanKgM2}\`

## Key Slices

- 3.75°N condensation delta: \`${summary.slices.equatorialEdge.deltas.largeScaleCondensationSourceKgM2}\`
- 3.75°N candidate delta: \`${summary.slices.equatorialEdge.deltas.shoulderAbsorptionGuardCandidateMassKgM2}\`
- 3.75°N applied suppression delta: \`${summary.slices.equatorialEdge.deltas.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`
- 3.75°N event-count delta: \`${summary.slices.equatorialEdge.deltas.shoulderAbsorptionGuardEventCount}\`
- 11.25°N condensation delta: \`${summary.slices.innerShoulder.deltas.largeScaleCondensationSourceKgM2}\`
- 18.75°N spillover delta: \`${summary.slices.spillover.deltas.largeScaleCondensationSourceKgM2}\`
- 33.75°N target-entry applied suppression: \`${summary.slices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`
`;
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
  const summary = buildPhase1ZGEquatorialEdgeBufferedShoulderPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZGReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
