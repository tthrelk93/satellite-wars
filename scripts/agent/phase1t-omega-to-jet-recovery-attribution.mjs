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
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1t-omega-to-jet-recovery-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1t-omega-to-jet-recovery-attribution.json');

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

function buildBandDeltas(offSample, onSample) {
  const bands = [
    { key: 'tropicalShoulderNorth', label: 'Tropical shoulder (3-18.75N)', minLat: 3, maxLat: 18.75 },
    { key: 'dryBeltCoreNorth', label: 'Dry-belt core (18.75-30N)', minLat: 18.75, maxLat: 30 },
    { key: 'transitionBandNorth', label: 'Transition band (30-41.25N)', minLat: 30, maxLat: 41.25 },
    { key: 'jetBandNorth', label: 'Jet band (41.25-56.25N)', minLat: 41.25, maxLat: 56.25 }
  ];
  const outputs = {};
  for (const band of bands) {
    const offWind = bandAverage(offSample, 'wind10mU', band.minLat, band.maxLat);
    const onWind = bandAverage(onSample, 'wind10mU', band.minLat, band.maxLat);
    const offStorm = bandAverage(offSample, 'stormTrackIndex', band.minLat, band.maxLat);
    const onStorm = bandAverage(onSample, 'stormTrackIndex', band.minLat, band.maxLat);
    const offCond = bandAverage(offSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);
    const onCond = bandAverage(onSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);
    const offDry = bandAverage(offSample, 'subtropicalSubsidenceDryingFrac', band.minLat, band.maxLat);
    const onDry = bandAverage(onSample, 'subtropicalSubsidenceDryingFrac', band.minLat, band.maxLat);
    outputs[band.key] = {
      label: band.label,
      wind10mUDelta: round(onWind - offWind, 5),
      stormTrackIndexDelta: round(onStorm - offStorm, 5),
      largeScaleCondensationDeltaKgM2: round(onCond - offCond, 5),
      subtropicalSubsidenceDryingDeltaFrac: round(onDry - offDry, 5)
    };
  }
  return outputs;
}

const nextPhaseForVerdict = (verdict) => {
  switch (verdict) {
    case 'equatorward_absorption_before_jet_band':
      return 'Phase 1U: Jet-Band Placement Patch Design';
    case 'omega_response_still_too_weak':
      return 'Phase 1U: Bridge Gain Patch Design';
    case 'downstream_jet_recovery_failure':
    default:
      return 'Phase 1U: Jet Recovery Coupling Design';
  }
};

const recommendationForVerdict = (verdict) => {
  switch (verdict) {
    case 'equatorward_absorption_before_jet_band':
      return 'The bridge response is being absorbed in the NH dry-belt and tropical-shoulder lane instead of reaching the 30-56N jet pathway. Keep the bridge disabled by default and redesign its placement/latitudinal weighting before changing amplitude.';
    case 'omega_response_still_too_weak':
      return 'The bridge engages, but the omega gain is too small to matter. Keep the diagnostics and tune bridge gain only after preserving the current guardrails.';
    case 'downstream_jet_recovery_failure':
    default:
      return 'The bridge reaches the jet-entry lane, but the NH jet still does not recover. Move to a downstream omega-to-jet coupling design instead of strengthening the bridge itself.';
  }
};

export function buildPhase1TOmegaToJetRecoveryAttribution({
  baselineMetrics,
  offMetrics,
  onMetrics,
  offProfileSample,
  onProfileSample,
  paths
}) {
  const northTransitionOmegaDelta = delta(
    onMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS,
    offMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS
  );
  const northDryBeltOmegaDelta = delta(
    onMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS,
    offMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS
  );
  const jetDelta = delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms);
  const bridgeActivation = mean(
    onMetrics.northTransitionDryingOmegaBridgeAppliedMeanPaS || 0,
    onMetrics.northDryBeltDryingOmegaBridgeAppliedMeanPaS || 0
  );
  const bandDeltas = buildBandDeltas(offProfileSample, onProfileSample);

  const omegaGainScore = mean(
    clamp01(northTransitionOmegaDelta / 0.01),
    clamp01(northDryBeltOmegaDelta / 0.005)
  );
  const jetBandStillFlatScore = mean(
    1 - clamp01(Math.abs(bandDeltas.transitionBandNorth.wind10mUDelta) / 0.01),
    1 - clamp01(Math.abs(bandDeltas.jetBandNorth.wind10mUDelta) / 0.01),
    1 - clamp01(Math.abs(bandDeltas.jetBandNorth.stormTrackIndexDelta) / 0.00002)
  );
  const equatorwardRedistributionScore = mean(
    clamp01(Math.max(0, -bandDeltas.dryBeltCoreNorth.largeScaleCondensationDeltaKgM2) / 0.003),
    clamp01(Math.max(0, bandDeltas.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2) / 0.01),
    jetBandStillFlatScore
  );
  const downstreamJetFailureScore = mean(
    omegaGainScore,
    clamp01(Math.abs(bandDeltas.transitionBandNorth.wind10mUDelta) / 0.01),
    1 - clamp01(Math.abs(jetDelta) / 0.03)
  );

  const ranking = [
    {
      key: 'equatorward_absorption_before_jet_band',
      label: 'Bridge response is absorbed too far equatorward before it reaches the jet band',
      score: round(equatorwardRedistributionScore, 5),
      evidence: {
        tropicalShoulderCondensationDeltaKgM2: bandDeltas.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2,
        dryBeltCoreCondensationDeltaKgM2: bandDeltas.dryBeltCoreNorth.largeScaleCondensationDeltaKgM2,
        jetBandWindDeltaMs: bandDeltas.jetBandNorth.wind10mUDelta,
        jetBandStormTrackDelta: bandDeltas.jetBandNorth.stormTrackIndexDelta
      }
    },
    {
      key: 'omega_response_still_too_weak',
      label: 'Bridge moves omega, but not strongly enough to seed the jet pathway',
      score: round(mean(1 - omegaGainScore, clamp01(bridgeActivation / 0.002), jetBandStillFlatScore), 5),
      evidence: {
        northTransitionOmegaDeltaPaS: round(northTransitionOmegaDelta, 5),
        northDryBeltOmegaDeltaPaS: round(northDryBeltOmegaDelta, 5),
        bridgeActivationMeanPaS: round(bridgeActivation, 5)
      }
    },
    {
      key: 'downstream_jet_recovery_failure',
      label: 'A downstream jet-recovery gap remains after omega reaches the transition lane',
      score: round(downstreamJetFailureScore, 5),
      evidence: {
        transitionBandWindDeltaMs: bandDeltas.transitionBandNorth.wind10mUDelta,
        jetBandWindDeltaMs: bandDeltas.jetBandNorth.wind10mUDelta,
        jetBandStormTrackDelta: bandDeltas.jetBandNorth.stormTrackIndexDelta,
        midlatitudeWesterliesNorthDeltaMs: round(jetDelta, 5)
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const verdict = ranking[0]?.key || 'downstream_jet_recovery_failure';
  const nextPhase = nextPhaseForVerdict(verdict);

  return {
    schema: 'satellite-wars.phase1t-omega-to-jet-recovery-attribution.v1',
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
      subtropicalDrySouthRatio: {
        baseline: round(baselineMetrics.subtropicalDrySouthRatio || 0, 5),
        current: round(onMetrics.subtropicalDrySouthRatio || 0, 5),
        delta: round(delta(onMetrics.subtropicalDrySouthRatio, baselineMetrics.subtropicalDrySouthRatio), 5)
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
      midlatitudeWesterliesNorthU10Ms: { off: round(offMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), on: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), delta: round(jetDelta, 5) }
    },
    bridgeSignals: {
      northTransitionDryingOmegaBridgeAppliedMeanPaS: round(onMetrics.northTransitionDryingOmegaBridgeAppliedMeanPaS || 0, 5),
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: round(onMetrics.northDryBeltDryingOmegaBridgeAppliedMeanPaS || 0, 5),
      northTransitionLowLevelOmegaEffectiveDeltaPaS: round(northTransitionOmegaDelta, 5),
      northDryBeltLowLevelOmegaEffectiveDeltaPaS: round(northDryBeltOmegaDelta, 5),
      omegaTargetHitFrac: round(omegaGainScore, 5),
      midlatitudeWesterliesNorthDeltaMs: round(jetDelta, 5)
    },
    bandDeltas,
    ranking,
    recommendation: recommendationForVerdict(verdict)
  };
}

export function renderPhase1TReport(summary) {
  const lines = [
    '# Phase 1T Omega-To-Jet Recovery Attribution',
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
    '## Bridge Signals',
    '',
    `- \`northTransitionDryingOmegaBridgeAppliedMeanPaS = ${summary.bridgeSignals.northTransitionDryingOmegaBridgeAppliedMeanPaS}\``,
    `- \`northDryBeltDryingOmegaBridgeAppliedMeanPaS = ${summary.bridgeSignals.northDryBeltDryingOmegaBridgeAppliedMeanPaS}\``,
    `- \`northTransitionLowLevelOmegaEffectiveDeltaPaS = ${summary.bridgeSignals.northTransitionLowLevelOmegaEffectiveDeltaPaS}\``,
    `- \`northDryBeltLowLevelOmegaEffectiveDeltaPaS = ${summary.bridgeSignals.northDryBeltLowLevelOmegaEffectiveDeltaPaS}\``,
    `- \`omegaTargetHitFrac = ${summary.bridgeSignals.omegaTargetHitFrac}\``,
    `- \`midlatitudeWesterliesNorthDeltaMs = ${summary.bridgeSignals.midlatitudeWesterliesNorthDeltaMs}\``,
    '',
    '## Lat-Band Deltas',
    '',
    ...Object.values(summary.bandDeltas).flatMap((band) => ([
      `- ${band.label}: wind delta \`${band.wind10mUDelta}\`, storm-track delta \`${band.stormTrackIndexDelta}\`, condensation delta \`${band.largeScaleCondensationDeltaKgM2}\`, drying delta \`${band.subtropicalSubsidenceDryingDeltaFrac}\``
    ])),
    '',
    '## Off Versus On',
    '',
    `- \`itczWidthDeg\`: \`${summary.offOnCompare.itczWidthDeg.off}\` -> \`${summary.offOnCompare.itczWidthDeg.on}\` (delta \`${summary.offOnCompare.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.offOnCompare.subtropicalDryNorthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDryNorthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.offOnCompare.subtropicalDrySouthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDrySouthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDrySouthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\` (delta \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Ranking',
    '',
    ...summary.ranking.map((entry, index) => `${index + 1}. \`${entry.key}\` score \`${entry.score}\``),
    '',
    '## Baseline Gap',
    '',
    `- \`itczWidthDeg\`: \`${summary.baselineGap.itczWidthDeg.baseline}\` -> \`${summary.baselineGap.itczWidthDeg.current}\` (delta \`${summary.baselineGap.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.baselineGap.subtropicalDryNorthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDryNorthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.baselineGap.subtropicalDrySouthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDrySouthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDrySouthRatio.delta}\`)`,
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
  const summary = buildPhase1TOmegaToJetRecoveryAttribution({
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
  fs.writeFileSync(args.reportPath, renderPhase1TReport(summary));
  fs.writeFileSync(args.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
