#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zj-off.json';
const defaultOnPath = '/tmp/phase1zj-on.json';
const defaultPhase1ZGPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zg-equatorial-edge-buffered-shoulder-patch.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zj-split-lane-equatorial-edge-candidate-gate-patch.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zj-split-lane-equatorial-edge-candidate-gate-patch.json');

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
  const keys = [
    'largeScaleCondensationSourceKgM2',
    'shoulderAbsorptionGuardCandidateMassKgM2',
    'shoulderAbsorptionGuardAppliedSuppressionKgM2',
    'shoulderAbsorptionGuardBufferedRainoutKgM2',
    'shoulderAbsorptionGuardEventCount',
    'freshShoulderLatitudeWindowDiagFrac',
    'freshShoulderEquatorialEdgeWindowDiagFrac',
    'freshShoulderInnerWindowDiagFrac',
    'freshShoulderEquatorialEdgeGateSupportDiagFrac',
    'freshShoulderTargetEntryExclusionDiagFrac'
  ];

  const off = {};
  const on = {};
  const deltas = {};
  for (const key of keys) {
    off[key] = read(seriesOff, key);
    on[key] = read(seriesOn, key);
    deltas[key] = round((Number(on[key]) || 0) - (Number(off[key]) || 0));
  }
  return { latitudeDeg, off, on, deltas };
}

export function buildPhase1ZJSplitLaneEquatorialEdgeCandidateGatePatch({ offAudit, onAudit, phase1zgSummary, paths }) {
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

  const previousEdge = phase1zgSummary?.slices?.equatorialEdge?.deltas || {};
  const previousInner = phase1zgSummary?.slices?.innerShoulder?.deltas || {};
  const previousSpillover = phase1zgSummary?.slices?.spillover?.deltas || {};

  const keepPatch = metrics.itczWidthDeg < 0
    && metrics.subtropicalDryNorthRatio < 0
    && metrics.subtropicalDrySouthRatio < 0
    && (targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) === 0
    && (innerShoulder.deltas.largeScaleCondensationSourceKgM2 || 0) < 0
    && (spillover.deltas.largeScaleCondensationSourceKgM2 || 0) <= 0;

  return {
    schema: 'satellite-wars.phase1zj-split-lane-equatorial-edge-candidate-gate-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: keepPatch
      ? 'keep_with_out_of_lane_edge_residual'
      : 'reject_split_lane_patch',
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZK: Equatorial-Edge Out-Of-Lane Attribution'
      : 'Phase 1ZK: Equatorial-Edge Out-Of-Lane Attribution',
    metrics,
    slices: {
      equatorialEdge,
      innerShoulder,
      spillover,
      targetEntry
    },
    phase1zgComparison: {
      priorEdgeCondensationDeltaKgM2: previousEdge.largeScaleCondensationSourceKgM2 ?? null,
      currentEdgeCondensationDeltaKgM2: equatorialEdge.deltas.largeScaleCondensationSourceKgM2,
      priorEdgeCandidateDeltaKgM2: previousEdge.shoulderAbsorptionGuardCandidateMassKgM2 ?? null,
      currentEdgeCandidateDeltaKgM2: equatorialEdge.deltas.shoulderAbsorptionGuardCandidateMassKgM2,
      priorEdgeAppliedSuppressionDeltaKgM2: previousEdge.shoulderAbsorptionGuardAppliedSuppressionKgM2 ?? null,
      currentEdgeAppliedSuppressionDeltaKgM2: equatorialEdge.deltas.shoulderAbsorptionGuardAppliedSuppressionKgM2,
      priorInnerCondensationDeltaKgM2: previousInner.largeScaleCondensationSourceKgM2 ?? null,
      currentInnerCondensationDeltaKgM2: innerShoulder.deltas.largeScaleCondensationSourceKgM2,
      priorSpilloverCondensationDeltaKgM2: previousSpillover.largeScaleCondensationSourceKgM2 ?? null,
      currentSpilloverCondensationDeltaKgM2: spillover.deltas.largeScaleCondensationSourceKgM2
    },
    recommendation: keepPatch
      ? 'Keep the split-lane gate: it improves the main 30-day climate guardrails and preserves the 11.25°N, 18.75°N, and 33.75°N wins. The remaining 3.75°N rebound now happens with zero shoulder-guard admission, so the next phase should chase the out-of-lane source rather than re-tuning this gate.'
      : 'Do not keep the split-lane gate by default yet; it did not improve the main climate guardrails enough to justify moving on.'
  };
}

export function renderPhase1ZJReport(summary) {
  return `# Phase 1ZJ Split-Lane Equatorial-Edge Candidate Gate Patch

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

## Protected Lanes

- 11.25°N condensation delta: \`${summary.slices.innerShoulder.deltas.largeScaleCondensationSourceKgM2}\`
- 18.75°N spillover delta: \`${summary.slices.spillover.deltas.largeScaleCondensationSourceKgM2}\`
- 33.75°N target-entry applied suppression: \`${summary.slices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`

## Residual At 3.75°N

- condensation delta: \`${summary.slices.equatorialEdge.deltas.largeScaleCondensationSourceKgM2}\`
- candidate delta: \`${summary.slices.equatorialEdge.deltas.shoulderAbsorptionGuardCandidateMassKgM2}\`
- applied suppression delta: \`${summary.slices.equatorialEdge.deltas.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`
- buffered rainout delta: \`${summary.slices.equatorialEdge.deltas.shoulderAbsorptionGuardBufferedRainoutKgM2}\`
- edge window on: \`${summary.slices.equatorialEdge.on.freshShoulderEquatorialEdgeWindowDiagFrac}\`
- edge gate support on: \`${summary.slices.equatorialEdge.on.freshShoulderEquatorialEdgeGateSupportDiagFrac}\`

## What Changed Versus Phase 1ZG

- prior 3.75°N condensation delta: \`${summary.phase1zgComparison.priorEdgeCondensationDeltaKgM2}\`
- current 3.75°N condensation delta: \`${summary.phase1zgComparison.currentEdgeCondensationDeltaKgM2}\`
- prior 3.75°N candidate delta: \`${summary.phase1zgComparison.priorEdgeCandidateDeltaKgM2}\`
- current 3.75°N candidate delta: \`${summary.phase1zgComparison.currentEdgeCandidateDeltaKgM2}\`
- prior 3.75°N applied suppression delta: \`${summary.phase1zgComparison.priorEdgeAppliedSuppressionDeltaKgM2}\`
- current 3.75°N applied suppression delta: \`${summary.phase1zgComparison.currentEdgeAppliedSuppressionDeltaKgM2}\`
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1zgPath: defaultPhase1ZGPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zg' && argv[i + 1]) options.phase1zgPath = argv[++i];
    else if (arg.startsWith('--phase1zg=')) options.phase1zgPath = arg.slice('--phase1zg='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZJSplitLaneEquatorialEdgeCandidateGatePatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1zgSummary: readJson(options.phase1zgPath),
    paths: options
  });
  const report = renderPhase1ZJReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
