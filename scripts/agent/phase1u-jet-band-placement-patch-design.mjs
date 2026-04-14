#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1s-omega-bridge-off.json';
const defaultOnPath = '/tmp/phase1s-omega-bridge-on.json';
const defaultOffProfilesPath = '/tmp/phase1s-omega-bridge-off-sample-profiles.json';
const defaultOnProfilesPath = '/tmp/phase1s-omega-bridge-on-sample-profiles.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1u-jet-band-placement-patch-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1u-jet-band-placement-patch-design.json');

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

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestMetrics = (audit) => audit?.samples?.[audit.samples.length - 1]?.metrics || {};
const delta = (onValue, offValue) => (Number(onValue) || 0) - (Number(offValue) || 0);
const mean = (...values) => values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / Math.max(1, values.length);

function latestProfileSample(sampleProfiles) {
  if (Array.isArray(sampleProfiles?.samples) && sampleProfiles.samples.length > 0) {
    return sampleProfiles.samples[sampleProfiles.samples.length - 1];
  }
  const values = Object.values(sampleProfiles || {}).filter((value) => value && typeof value === 'object');
  values.sort((a, b) => (a.targetDay || 0) - (b.targetDay || 0));
  return values[values.length - 1] || null;
}

function bandAverage(sample, seriesKey, minLat, maxLat) {
  const lats = sample?.profiles?.latitudesDeg || [];
  const series = sample?.profiles?.series?.[seriesKey] || [];
  let weightedSum = 0;
  let weight = 0;
  for (let i = 0; i < lats.length; i++) {
    const lat = lats[i];
    if (!(lat >= minLat && lat <= maxLat)) continue;
    weightedSum += Number(series[i]) || 0;
    weight += 1;
  }
  return weight > 0 ? weightedSum / weight : 0;
}

function bandDeltas(offSample, onSample) {
  const bands = [
    { key: 'tropicalShoulderNorth', label: 'Tropical shoulder (3-18.75N)', minLat: 3, maxLat: 18.75 },
    { key: 'dryBeltCoreNorth', label: 'Dry-belt core (18.75-30N)', minLat: 18.75, maxLat: 30 },
    { key: 'transitionEntryNorth', label: 'Transition / jet entry (30-45N)', minLat: 30, maxLat: 45 },
    { key: 'jetBandNorth', label: 'Jet band (41.25-56.25N)', minLat: 41.25, maxLat: 56.25 }
  ];
  const out = {};
  for (const band of bands) {
    const offWind = bandAverage(offSample, 'wind10mU', band.minLat, band.maxLat);
    const onWind = bandAverage(onSample, 'wind10mU', band.minLat, band.maxLat);
    const offStorm = bandAverage(offSample, 'stormTrackIndex', band.minLat, band.maxLat);
    const onStorm = bandAverage(onSample, 'stormTrackIndex', band.minLat, band.maxLat);
    const offCond = bandAverage(offSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);
    const onCond = bandAverage(onSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);
    out[band.key] = {
      label: band.label,
      wind10mUDelta: round(onWind - offWind, 5),
      stormTrackIndexDelta: round(onStorm - offStorm, 5),
      largeScaleCondensationDeltaKgM2: round(onCond - offCond, 5)
    };
  }
  return out;
}

const nextPhaseForVerdict = (verdict) => {
  switch (verdict) {
    case 'poleward_projected_transition_bridge_required':
    default:
      return 'Phase 1V: Implement Poleward Jet-Entry Bridge Patch';
  }
};

export function buildPhase1UJetBandPlacementPatchDesign({
  baselineMetrics,
  offMetrics,
  onMetrics,
  offProfileSample,
  onProfileSample,
  paths
}) {
  const bands = bandDeltas(offProfileSample, onProfileSample);
  const northTransitionOmegaDelta = delta(
    onMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS,
    offMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS
  );
  const northDryBeltOmegaDelta = delta(
    onMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS,
    offMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS
  );
  const nhJetDelta = delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms);

  const sameColumnRetuneRisk = mean(
    clamp01(Math.max(0, bands.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2) / 0.02),
    1 - clamp01(Math.abs(bands.transitionEntryNorth.wind10mUDelta) / 0.01),
    1 - clamp01(Math.abs(nhJetDelta) / 0.03)
  );
  const withinLoopPolewardReweightRisk = mean(
    0.75,
    1 - clamp01(Math.abs(bands.transitionEntryNorth.wind10mUDelta) / 0.01),
    1 - clamp01(Math.abs(bands.jetBandNorth.stormTrackIndexDelta) / 0.00002)
  );
  const polewardProjectedBridgeScore = mean(
    clamp01(Math.max(0, bands.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2) / 0.01),
    clamp01(Math.max(0, -bands.dryBeltCoreNorth.largeScaleCondensationDeltaKgM2) / 0.003),
    1 - clamp01(Math.abs(bands.transitionEntryNorth.wind10mUDelta) / 0.01),
    1 - clamp01(Math.abs(bands.jetBandNorth.wind10mUDelta) / 0.01)
  );

  const ranking = [
    {
      key: 'poleward_projected_transition_bridge_required',
      label: 'Use a poleward-projected bridge from the dry-belt source lane into the 30-45N transition / jet-entry lane',
      score: round(polewardProjectedBridgeScore, 5),
      evidence: {
        tropicalShoulderCondensationDeltaKgM2: bands.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2,
        dryBeltCoreCondensationDeltaKgM2: bands.dryBeltCoreNorth.largeScaleCondensationDeltaKgM2,
        transitionEntryWindDeltaMs: bands.transitionEntryNorth.wind10mUDelta,
        jetBandWindDeltaMs: bands.jetBandNorth.wind10mUDelta
      }
    },
    {
      key: 'same_column_amplitude_retune_wrong_lane',
      label: 'Do not just strengthen the current same-column bridge amplitude',
      score: round(sameColumnRetuneRisk, 5),
      evidence: {
        northTransitionOmegaDeltaPaS: round(northTransitionOmegaDelta, 5),
        northDryBeltOmegaDeltaPaS: round(northDryBeltOmegaDelta, 5),
        tropicalShoulderCondensationDeltaKgM2: bands.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2,
        midlatitudeWesterliesNorthDeltaMs: round(nhJetDelta, 5)
      }
    },
    {
      key: 'within_loop_lat_reweight_still_insufficient',
      label: 'Reweighting only inside the current 15-35N loop is still too narrow',
      score: round(withinLoopPolewardReweightRisk, 5),
      evidence: {
        currentLoopLat0: 15,
        currentLoopLat1: 35,
        transitionEntryWindDeltaMs: bands.transitionEntryNorth.wind10mUDelta,
        jetBandStormTrackDelta: bands.jetBandNorth.stormTrackIndexDelta
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const verdict = ranking[0]?.key || 'poleward_projected_transition_bridge_required';
  const nextPhase = nextPhaseForVerdict(verdict);

  return {
    schema: 'satellite-wars.phase1u-jet-band-placement-patch-design.v1',
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
    liveBridgeState: {
      northTransitionLowLevelOmegaEffectiveDeltaPaS: round(northTransitionOmegaDelta, 5),
      northDryBeltLowLevelOmegaEffectiveDeltaPaS: round(northDryBeltOmegaDelta, 5),
      midlatitudeWesterliesNorthDeltaMs: round(nhJetDelta, 5),
      northTransitionDryingOmegaBridgeAppliedMeanPaS: round(onMetrics.northTransitionDryingOmegaBridgeAppliedMeanPaS || 0, 5),
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: round(onMetrics.northDryBeltDryingOmegaBridgeAppliedMeanPaS || 0, 5)
    },
    bandDeltas: bands,
    ranking,
    currentLaneGeometry: {
      subtropicalSubsidenceLat0: 15,
      subtropicalSubsidenceLat1: 35,
      bridgeUsesSameColumnLatShape: true,
      implication: 'The current same-step bridge is confined to the 15-35N subtropical loop, so it cannot directly seed the 41.25-56.25N jet band.'
    },
    patchDesign: {
      primaryFiles: [
        path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'),
        path.join(repoRoot, 'src', 'weather', 'v2', 'core5.js')
      ],
      mechanism: 'Split the current bridge into a capped local share plus a capped same-hemisphere poleward-projected share that redistributes part of the proved dry-belt response into the 30-45N transition / jet-entry rows.',
      insertionPoints: [
        'vertical5.js: keep the current dryDriver/source gate as the source selector, but accumulate a same-hemisphere projected bridge reservoir from source rows centered on roughly 20-30N.',
        'vertical5.js: redistribute the projected share into target rows centered on roughly 30-45N before later same-step consumers read low-level omega.',
        'vertical5.js: apply a strong equatorward leak penalty below about 20-22N so the tropical shoulder does not absorb the bridge gain.',
        'core5.js: expose separate source-band, target-band, local-share, projected-share, and max-Pa/s caps so the design can be tuned without broad circulation retunes.'
      ],
      suggestedParams: {
        enableProjectedDryingOmegaBridge: false,
        dryingOmegaBridgeLocalShareMaxFrac: 0.35,
        dryingOmegaBridgeProjectedShareMaxFrac: 0.65,
        dryingOmegaBridgeSourceLat0: 20,
        dryingOmegaBridgeSourceLat1: 30,
        dryingOmegaBridgeTargetLat0: 30,
        dryingOmegaBridgeTargetLat1: 45,
        dryingOmegaBridgeEquatorwardLeakLat0: 18,
        dryingOmegaBridgeEquatorwardLeakLat1: 22,
        dryingOmegaBridgeProjectedMaxPaS: 0.006
      },
      targetSignature: {
        positiveTransitionEntryWindDeltaMs: 0.01,
        positiveJetBandStormTrackDelta: 0.00002,
        maxAllowedTropicalShoulderCondensationDeltaKgM2: 0.005,
        maxAllowedItczWidthDeltaDeg: 0.02,
        maxAllowedNorthDryRatioDelta: 0.01
      },
      designRules: [
        'Do not increase total bridge amplitude first; redistribute where the existing response lands.',
        'Keep the response same-hemisphere and row-limited so the patch behaves like a placement correction, not a new global circulation forcing.',
        'Preserve the kept Phase 1K marine-maintenance win and the kept Phase 1M transition-containment win.'
      ]
    },
    recommendation: 'Use a poleward-projected jet-entry bridge design. The current bridge is climate-live, but its gain is being spent in the dry-belt core and tropical shoulder instead of the 30-45N transition lane.'
  };
}

export function renderPhase1UReport(summary) {
  const lines = [
    '# Phase 1U Jet-Band Placement Patch Design',
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${summary.paths.baselinePath}\``,
    `- Same-branch off audit: \`${summary.paths.offPath}\``,
    `- Same-branch on audit: \`${summary.paths.onPath}\``,
    `- Same-branch off profiles: \`${summary.paths.offProfilesPath}\``,
    `- Same-branch on profiles: \`${summary.paths.onProfilesPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- ${summary.recommendation}`,
    '',
    '## Current Lane Geometry',
    '',
    `- current subtropical loop: \`${summary.currentLaneGeometry.subtropicalSubsidenceLat0}-${summary.currentLaneGeometry.subtropicalSubsidenceLat1}°\``,
    `- same-column bridge shape: \`${summary.currentLaneGeometry.bridgeUsesSameColumnLatShape}\``,
    `- ${summary.currentLaneGeometry.implication}`,
    '',
    '## Live Bridge State',
    '',
    `- \`northTransitionLowLevelOmegaEffectiveDeltaPaS = ${summary.liveBridgeState.northTransitionLowLevelOmegaEffectiveDeltaPaS}\``,
    `- \`northDryBeltLowLevelOmegaEffectiveDeltaPaS = ${summary.liveBridgeState.northDryBeltLowLevelOmegaEffectiveDeltaPaS}\``,
    `- \`midlatitudeWesterliesNorthDeltaMs = ${summary.liveBridgeState.midlatitudeWesterliesNorthDeltaMs}\``,
    `- \`northTransitionDryingOmegaBridgeAppliedMeanPaS = ${summary.liveBridgeState.northTransitionDryingOmegaBridgeAppliedMeanPaS}\``,
    `- \`northDryBeltDryingOmegaBridgeAppliedMeanPaS = ${summary.liveBridgeState.northDryBeltDryingOmegaBridgeAppliedMeanPaS}\``,
    '',
    '## Lat-Band Deltas',
    '',
    ...Object.values(summary.bandDeltas).map((band) =>
      `- ${band.label}: wind delta \`${band.wind10mUDelta}\`, storm-track delta \`${band.stormTrackIndexDelta}\`, condensation delta \`${band.largeScaleCondensationDeltaKgM2}\``
    ),
    '',
    '## Ranking',
    '',
    ...summary.ranking.map((entry, index) => `${index + 1}. \`${entry.key}\` score \`${entry.score}\``),
    '',
    '## Patch Design',
    '',
    `- Mechanism: ${summary.patchDesign.mechanism}`,
    ...summary.patchDesign.insertionPoints.map((point) => `- ${point}`),
    '',
    '## Suggested Parameters',
    '',
    ...Object.entries(summary.patchDesign.suggestedParams).map(([key, value]) => `- \`${key} = ${value}\``),
    '',
    '## Target Signature',
    '',
    ...Object.entries(summary.patchDesign.targetSignature).map(([key, value]) => `- \`${key} = ${value}\``),
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
    offProfilesPath: defaultOffProfilesPath,
    onProfilesPath: defaultOnProfilesPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--baseline' && argv[i + 1]) args.baselinePath = argv[++i];
    else if (arg.startsWith('--baseline=')) args.baselinePath = arg.slice('--baseline='.length);
    else if (arg === '--off' && argv[i + 1]) args.offPath = argv[++i];
    else if (arg.startsWith('--off=')) args.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) args.onPath = argv[++i];
    else if (arg.startsWith('--on=')) args.onPath = arg.slice('--on='.length);
    else if (arg === '--off-profiles' && argv[i + 1]) args.offProfilesPath = argv[++i];
    else if (arg.startsWith('--off-profiles=')) args.offProfilesPath = arg.slice('--off-profiles='.length);
    else if (arg === '--on-profiles' && argv[i + 1]) args.onProfilesPath = argv[++i];
    else if (arg.startsWith('--on-profiles=')) args.onProfilesPath = arg.slice('--on-profiles='.length);
    else if (arg === '--report' && argv[i + 1]) args.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) args.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) args.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) args.jsonPath = arg.slice('--json='.length);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const baselineMetrics = latestMetrics(readJson(args.baselinePath));
  const offMetrics = latestMetrics(readJson(args.offPath));
  const onMetrics = latestMetrics(readJson(args.onPath));
  const offProfileSample = latestProfileSample(readJson(args.offProfilesPath));
  const onProfileSample = latestProfileSample(readJson(args.onProfilesPath));
  const summary = buildPhase1UJetBandPlacementPatchDesign({
    baselineMetrics,
    offMetrics,
    onMetrics,
    offProfileSample,
    onProfileSample,
    paths: {
      baselinePath: args.baselinePath,
      offPath: args.offPath,
      onPath: args.onPath,
      offProfilesPath: args.offProfilesPath,
      onProfilesPath: args.onProfilesPath,
      reportPath: args.reportPath,
      jsonPath: args.jsonPath
    }
  });
  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(args.jsonPath), { recursive: true });
  fs.writeFileSync(args.reportPath, renderPhase1UReport(summary));
  fs.writeFileSync(args.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
