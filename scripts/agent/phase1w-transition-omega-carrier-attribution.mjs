#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1w-carrier-off.json';
const defaultOnPath = '/tmp/phase1w-carrier-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1w-transition-omega-carrier-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1w-transition-omega-carrier-attribution.json');

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

function bandAverage(sample, seriesKey, minLat, maxLat) {
  const lats = sample?.profiles?.latitudesDeg || [];
  const series = sample?.profiles?.series?.[seriesKey] || [];
  let sum = 0;
  let count = 0;
  for (let i = 0; i < lats.length; i += 1) {
    if (!(lats[i] >= minLat && lats[i] <= maxLat)) continue;
    sum += Number(series[i]) || 0;
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function buildBandDiagnostics(offSample, onSample) {
  const bands = [
    { key: 'tropicalShoulderNorth', label: 'Tropical shoulder (3-18.75N)', minLat: 3, maxLat: 18.75 },
    { key: 'equatorwardLeakNorth', label: 'Equatorward leak window (18-22N)', minLat: 18, maxLat: 22 },
    { key: 'sourceCoreNorth', label: 'Source core (20-30N)', minLat: 20, maxLat: 30 },
    { key: 'targetEntryEquatorwardNorth', label: 'Target entry equatorward half (30-37.5N)', minLat: 30, maxLat: 37.5 },
    { key: 'targetEntryPolewardNorth', label: 'Target entry poleward half (37.5-45N)', minLat: 37.5, maxLat: 45 },
    { key: 'targetEntryNorth', label: 'Target entry (30-45N)', minLat: 30, maxLat: 45 },
    { key: 'jetBandNorth', label: 'Jet band (41.25-56.25N)', minLat: 41.25, maxLat: 56.25 }
  ];

  const outputs = {};
  for (const band of bands) {
    const offLocalBridge = bandAverage(offSample, 'dryingOmegaBridgeLocalAppliedPaS', band.minLat, band.maxLat);
    const onLocalBridge = bandAverage(onSample, 'dryingOmegaBridgeLocalAppliedPaS', band.minLat, band.maxLat);
    const offProjectedBridge = bandAverage(offSample, 'dryingOmegaBridgeProjectedAppliedPaS', band.minLat, band.maxLat);
    const onProjectedBridge = bandAverage(onSample, 'dryingOmegaBridgeProjectedAppliedPaS', band.minLat, band.maxLat);
    const offTotalBridge = bandAverage(offSample, 'dryingOmegaBridgeAppliedPaS', band.minLat, band.maxLat);
    const onTotalBridge = bandAverage(onSample, 'dryingOmegaBridgeAppliedPaS', band.minLat, band.maxLat);
    const offLowerOmega = bandAverage(offSample, 'lowerTroposphericOmegaPaS', band.minLat, band.maxLat);
    const onLowerOmega = bandAverage(onSample, 'lowerTroposphericOmegaPaS', band.minLat, band.maxLat);
    const offMidOmega = bandAverage(offSample, 'midTroposphericOmegaPaS', band.minLat, band.maxLat);
    const onMidOmega = bandAverage(onSample, 'midTroposphericOmegaPaS', band.minLat, band.maxLat);
    const offUpperOmega = bandAverage(offSample, 'upperTroposphericOmegaPaS', band.minLat, band.maxLat);
    const onUpperOmega = bandAverage(onSample, 'upperTroposphericOmegaPaS', band.minLat, band.maxLat);
    const offWind = bandAverage(offSample, 'wind10mU', band.minLat, band.maxLat);
    const onWind = bandAverage(onSample, 'wind10mU', band.minLat, band.maxLat);
    const offStorm = bandAverage(offSample, 'stormTrackIndex', band.minLat, band.maxLat);
    const onStorm = bandAverage(onSample, 'stormTrackIndex', band.minLat, band.maxLat);
    const offCond = bandAverage(offSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);
    const onCond = bandAverage(onSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);

    outputs[band.key] = {
      label: band.label,
      localBridgeOnPaS: round(onLocalBridge, 5),
      projectedBridgeOnPaS: round(onProjectedBridge, 5),
      totalBridgeOnPaS: round(onTotalBridge, 5),
      localBridgeDeltaPaS: round(onLocalBridge - offLocalBridge, 5),
      projectedBridgeDeltaPaS: round(onProjectedBridge - offProjectedBridge, 5),
      totalBridgeDeltaPaS: round(onTotalBridge - offTotalBridge, 5),
      lowerOmegaDeltaPaS: round(onLowerOmega - offLowerOmega, 5),
      midOmegaDeltaPaS: round(onMidOmega - offMidOmega, 5),
      upperOmegaDeltaPaS: round(onUpperOmega - offUpperOmega, 5),
      wind10mUDeltaMs: round(onWind - offWind, 5),
      stormTrackIndexDelta: round(onStorm - offStorm, 5),
      largeScaleCondensationDeltaKgM2: round(onCond - offCond, 5)
    };
  }
  return outputs;
}

function nextPhaseForVerdict(verdict, nextPhaseNumber = '1X') {
  switch (verdict) {
    case 'projected_share_unapplied_before_transition_entry':
      return `Phase ${nextPhaseNumber}: Projected-Share Application Repair`;
    case 'vertical_depth_failure':
      return `Phase ${nextPhaseNumber}: Vertical-Depth Bridge Patch Design`;
    case 'latitudinal_target_placement_failure':
      return `Phase ${nextPhaseNumber}: Poleward Target Reweight Design`;
    case 'equatorward_condensation_absorption':
      return `Phase ${nextPhaseNumber}: Equatorward Absorption Guard Design`;
    case 'true_downstream_jet_response_failure':
    default:
      return `Phase ${nextPhaseNumber}: Transition-To-Jet Coupling Design`;
  }
}

function recommendationForVerdict(verdict) {
  switch (verdict) {
    case 'projected_share_unapplied_before_transition_entry':
      return 'Repair the projected-share application path first. The current branch is still behaving like a mostly source-local bridge, so further carrier attribution would be premature until the target-row deposition actually exists in the live run.';
    case 'vertical_depth_failure':
      return 'The projected bridge reaches the target rows, but it stays too shallow. Extend the bridge vertically before tuning amplitude or downstream coupling.';
    case 'latitudinal_target_placement_failure':
      return 'The projected bridge reaches the transition lane, but it is landing too equatorward inside that lane. Reweight target rows poleward before changing strength.';
    case 'equatorward_condensation_absorption':
      return 'The projected bridge is live, but an equatorward condensation sink is still soaking up the response before jet entry. Add an absorption guard before building downstream coupling.';
    case 'true_downstream_jet_response_failure':
    default:
      return 'The projected bridge reaches the transition and jet-entry structure, but wind recovery still stays flat. Move to a downstream transition-to-jet coupling design.';
  }
}

export function buildPhase1WTransitionOmegaCarrierAttribution({
  baselineMetrics,
  offMetrics,
  onMetrics,
  offSample,
  onSample,
  paths,
  nextPhaseNumber = '1X'
}) {
  const bands = buildBandDiagnostics(offSample, onSample);
  const jetFlatScore = mean(
    1 - clamp01(Math.abs(bands.targetEntryNorth.wind10mUDeltaMs) / 0.01),
    1 - clamp01(Math.abs(bands.jetBandNorth.wind10mUDeltaMs) / 0.01),
    1 - clamp01(Math.abs(bands.jetBandNorth.stormTrackIndexDelta) / 0.00002)
  );

  const projectedShareMissingScore = mean(
    clamp01(bands.sourceCoreNorth.localBridgeOnPaS / 0.001),
    1 - clamp01(bands.targetEntryNorth.projectedBridgeOnPaS / 0.0005),
    1 - clamp01(bands.targetEntryPolewardNorth.projectedBridgeOnPaS / 0.0003),
    jetFlatScore
  );

  const verticalDepthFailureScore = mean(
    clamp01(bands.targetEntryNorth.projectedBridgeOnPaS / 0.0005),
    clamp01(bands.targetEntryNorth.lowerOmegaDeltaPaS / 0.001),
    1 - clamp01(bands.targetEntryNorth.midOmegaDeltaPaS / 0.0007),
    1 - clamp01(bands.jetBandNorth.midOmegaDeltaPaS / 0.0004),
    jetFlatScore
  );

  const latitudinalPlacementFailureScore = mean(
    clamp01(bands.targetEntryNorth.projectedBridgeOnPaS / 0.0005),
    1 - clamp01(
      bands.targetEntryPolewardNorth.projectedBridgeOnPaS
      / Math.max(1e-6, bands.targetEntryEquatorwardNorth.projectedBridgeOnPaS)
    ),
    clamp01(bands.equatorwardLeakNorth.projectedBridgeOnPaS / 0.0001),
    jetFlatScore
  );

  const equatorwardAbsorptionScore = mean(
    clamp01(Math.max(0, bands.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2) / 0.01),
    clamp01(Math.max(0, -bands.sourceCoreNorth.largeScaleCondensationDeltaKgM2) / 0.003),
    clamp01(bands.targetEntryNorth.lowerOmegaDeltaPaS / 0.001),
    jetFlatScore
  );

  const downstreamJetFailureScore = mean(
    clamp01(bands.targetEntryNorth.projectedBridgeOnPaS / 0.0005),
    clamp01(bands.targetEntryNorth.midOmegaDeltaPaS / 0.0007),
    clamp01(bands.jetBandNorth.midOmegaDeltaPaS / 0.0004),
    jetFlatScore
  );

  const ranking = [
    {
      key: 'projected_share_unapplied_before_transition_entry',
      label: 'Projected bridge share never becomes a live target-lane carrier',
      score: round(projectedShareMissingScore, 5),
      evidence: {
        sourceCoreLocalBridgeOnPaS: bands.sourceCoreNorth.localBridgeOnPaS,
        targetEntryProjectedBridgeOnPaS: bands.targetEntryNorth.projectedBridgeOnPaS,
        targetPolewardProjectedBridgeOnPaS: bands.targetEntryPolewardNorth.projectedBridgeOnPaS,
        jetBandWindDeltaMs: bands.jetBandNorth.wind10mUDeltaMs
      }
    },
    {
      key: 'vertical_depth_failure',
      label: 'Carrier reaches the target lane but stays too shallow vertically',
      score: round(verticalDepthFailureScore, 5),
      evidence: {
        targetEntryProjectedBridgeOnPaS: bands.targetEntryNorth.projectedBridgeOnPaS,
        targetEntryLowerOmegaDeltaPaS: bands.targetEntryNorth.lowerOmegaDeltaPaS,
        targetEntryMidOmegaDeltaPaS: bands.targetEntryNorth.midOmegaDeltaPaS,
        jetBandMidOmegaDeltaPaS: bands.jetBandNorth.midOmegaDeltaPaS
      }
    },
    {
      key: 'latitudinal_target_placement_failure',
      label: 'Carrier reaches the target lane but lands too far equatorward inside it',
      score: round(latitudinalPlacementFailureScore, 5),
      evidence: {
        equatorwardLeakProjectedBridgeOnPaS: bands.equatorwardLeakNorth.projectedBridgeOnPaS,
        targetEntryEquatorwardProjectedBridgeOnPaS: bands.targetEntryEquatorwardNorth.projectedBridgeOnPaS,
        targetEntryPolewardProjectedBridgeOnPaS: bands.targetEntryPolewardNorth.projectedBridgeOnPaS
      }
    },
    {
      key: 'equatorward_condensation_absorption',
      label: 'A remaining equatorward condensation sink absorbs the carrier before jet entry',
      score: round(equatorwardAbsorptionScore, 5),
      evidence: {
        tropicalShoulderCondensationDeltaKgM2: bands.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2,
        sourceCoreCondensationDeltaKgM2: bands.sourceCoreNorth.largeScaleCondensationDeltaKgM2,
        targetEntryLowerOmegaDeltaPaS: bands.targetEntryNorth.lowerOmegaDeltaPaS
      }
    },
    {
      key: 'true_downstream_jet_response_failure',
      label: 'Carrier reaches the transition and jet-entry structure, but wind recovery still fails downstream',
      score: round(downstreamJetFailureScore, 5),
      evidence: {
        targetEntryProjectedBridgeOnPaS: bands.targetEntryNorth.projectedBridgeOnPaS,
        targetEntryMidOmegaDeltaPaS: bands.targetEntryNorth.midOmegaDeltaPaS,
        jetBandMidOmegaDeltaPaS: bands.jetBandNorth.midOmegaDeltaPaS,
        jetBandWindDeltaMs: bands.jetBandNorth.wind10mUDeltaMs
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const verdict = ranking[0]?.key || 'projected_share_unapplied_before_transition_entry';
  const nextPhase = nextPhaseForVerdict(verdict, nextPhaseNumber);

  return {
    schema: 'satellite-wars.phase1w-transition-omega-carrier-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    nextPhase,
    baselineGap: {
      itczWidthDeg: {
        baseline: round(baselineMetrics.itczWidthDeg || 0, 5),
        current: round(onMetrics.itczWidthDeg || 0, 5),
        delta: round(delta(onMetrics.itczWidthDeg, baselineMetrics.itczWidthDeg), 5)
      },
      subtropicalDryNorthRatio: {
        baseline: round(baselineMetrics.subtropicalDryNorthRatio || 0, 5),
        current: round(onMetrics.subtropicalDryNorthRatio || 0, 5),
        delta: round(delta(onMetrics.subtropicalDryNorthRatio, baselineMetrics.subtropicalDryNorthRatio), 5)
      },
      midlatitudeWesterliesNorthU10Ms: {
        baseline: round(baselineMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5),
        current: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5),
        delta: round(delta(onMetrics.midlatitudeWesterliesNorthU10Ms, baselineMetrics.midlatitudeWesterliesNorthU10Ms), 5)
      }
    },
    offOnCompare: {
      itczWidthDeg: { off: round(offMetrics.itczWidthDeg || 0, 5), on: round(onMetrics.itczWidthDeg || 0, 5), delta: round(delta(onMetrics.itczWidthDeg, offMetrics.itczWidthDeg), 5) },
      subtropicalDryNorthRatio: { off: round(offMetrics.subtropicalDryNorthRatio || 0, 5), on: round(onMetrics.subtropicalDryNorthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDryNorthRatio, offMetrics.subtropicalDryNorthRatio), 5) },
      subtropicalDrySouthRatio: { off: round(offMetrics.subtropicalDrySouthRatio || 0, 5), on: round(onMetrics.subtropicalDrySouthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDrySouthRatio, offMetrics.subtropicalDrySouthRatio), 5) },
      midlatitudeWesterliesNorthU10Ms: { off: round(offMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), on: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), delta: round(delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms), 5) }
    },
    bandDiagnostics: bands,
    ranking,
    recommendation: recommendationForVerdict(verdict)
  };
}

function inferReportTitle(reportPath) {
  const base = path.basename(reportPath || '');
  if (base.includes('phase1x')) return '# Phase 1X Projected-Share Application Repair';
  return '# Phase 1W Transition-Omega Carrier Attribution';
}

export function renderPhase1WReport(summary, reportPath = '') {
  const lines = [
    inferReportTitle(reportPath),
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${summary.paths.baselinePath}\``,
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
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\` (delta \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Band Diagnostics',
    '',
    ...Object.values(summary.bandDiagnostics).map((band) =>
      `- ${band.label}: local bridge on \`${band.localBridgeOnPaS}\`, projected bridge on \`${band.projectedBridgeOnPaS}\`, lower/mid/upper omega deltas \`${band.lowerOmegaDeltaPaS}\` / \`${band.midOmegaDeltaPaS}\` / \`${band.upperOmegaDeltaPaS}\`, wind delta \`${band.wind10mUDeltaMs}\`, storm-track delta \`${band.stormTrackIndexDelta}\`, condensation delta \`${band.largeScaleCondensationDeltaKgM2}\``
    ),
    '',
    '## Ranking',
    '',
    ...summary.ranking.map((entry, index) => `${index + 1}. \`${entry.key}\` score \`${entry.score}\``),
    '',
    '## Baseline Gap',
    '',
    `- \`itczWidthDeg\`: \`${summary.baselineGap.itczWidthDeg.baseline}\` -> \`${summary.baselineGap.itczWidthDeg.current}\` (delta \`${summary.baselineGap.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.baselineGap.subtropicalDryNorthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDryNorthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDryNorthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.baseline}\` -> \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.current}\` (delta \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.delta}\`)`
  ];
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = {
    baselinePath: defaultBaselinePath,
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--baseline' && argv[i + 1]) args.baselinePath = argv[++i];
    else if (arg.startsWith('--baseline=')) args.baselinePath = arg.slice('--baseline='.length);
    else if (arg === '--off' && argv[i + 1]) args.offPath = argv[++i];
    else if (arg.startsWith('--off=')) args.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) args.onPath = argv[++i];
    else if (arg.startsWith('--on=')) args.onPath = arg.slice('--on='.length);
    else if (arg === '--report' && argv[i + 1]) args.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) args.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) args.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) args.jsonPath = arg.slice('--json='.length);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const nextPhaseNumber = path.basename(args.reportPath).includes('phase1x') ? '1Y' : '1X';
  const baseline = readJson(args.baselinePath);
  const offAudit = readJson(args.offPath);
  const onAudit = readJson(args.onPath);
  const summary = buildPhase1WTransitionOmegaCarrierAttribution({
    baselineMetrics: latestMetrics(baseline),
    offMetrics: latestMetrics(offAudit),
    onMetrics: latestMetrics(onAudit),
    offSample: latestSample(offAudit),
    onSample: latestSample(onAudit),
    nextPhaseNumber,
    paths: {
      baselinePath: args.baselinePath,
      offPath: args.offPath,
      onPath: args.onPath
    }
  });
  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(args.jsonPath), { recursive: true });
  fs.writeFileSync(args.reportPath, renderPhase1WReport(summary, args.reportPath));
  fs.writeFileSync(args.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] === __filename) {
  main();
}
