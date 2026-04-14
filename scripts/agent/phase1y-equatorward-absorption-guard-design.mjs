#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1x-off.json';
const defaultOnPath = '/tmp/phase1x-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1y-equatorward-absorption-guard-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1y-equatorward-absorption-guard-design.json');

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

function nearestLatSnapshot(sample, targetLat) {
  const lats = sample?.profiles?.latitudesDeg || [];
  if (!lats.length) return null;
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < lats.length; i += 1) {
    const distance = Math.abs((lats[i] || 0) - targetLat);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  const get = (key) => Number(sample?.profiles?.series?.[key]?.[bestIndex]) || 0;
  return {
    latitudeDeg: round(lats[bestIndex], 2),
    largeScaleCondensationSourceKgM2: round(get('largeScaleCondensationSourceKgM2'), 5),
    lowerTroposphericOmegaPaS: round(get('lowerTroposphericOmegaPaS'), 5),
    midTroposphericOmegaPaS: round(get('midTroposphericOmegaPaS'), 5),
    dryingOmegaBridgeLocalAppliedPaS: round(get('dryingOmegaBridgeLocalAppliedPaS'), 5),
    dryingOmegaBridgeProjectedAppliedPaS: round(get('dryingOmegaBridgeProjectedAppliedPaS'), 5),
    stormTrackIndex: round(get('stormTrackIndex'), 5),
    wind10mU: round(get('wind10mU'), 5)
  };
}

function buildBandDiagnostics(offSample, onSample) {
  const bands = [
    { key: 'tropicalShoulderNorth', label: 'Tropical shoulder (3-18.75N)', minLat: 3, maxLat: 18.75 },
    { key: 'tropicalShoulderCoreNorth', label: 'Tropical shoulder core (3-12N)', minLat: 3, maxLat: 12 },
    { key: 'equatorwardLeakNorth', label: 'Equatorward leak window (18-22N)', minLat: 18, maxLat: 22 },
    { key: 'sourceCoreNorth', label: 'Source core (20-30N)', minLat: 20, maxLat: 30 },
    { key: 'targetEntryNorth', label: 'Target entry (30-45N)', minLat: 30, maxLat: 45 },
    { key: 'jetBandNorth', label: 'Jet band (41.25-56.25N)', minLat: 41.25, maxLat: 56.25 }
  ];
  const out = {};
  for (const band of bands) {
    const keys = [
      'largeScaleCondensationSourceKgM2',
      'lowerTroposphericOmegaPaS',
      'midTroposphericOmegaPaS',
      'dryingOmegaBridgeLocalAppliedPaS',
      'dryingOmegaBridgeProjectedAppliedPaS',
      'stormTrackIndex',
      'wind10mU'
    ];
    const values = Object.fromEntries(keys.map((key) => [key, {
      off: bandAverage(offSample, key, band.minLat, band.maxLat),
      on: bandAverage(onSample, key, band.minLat, band.maxLat)
    }]));
    out[band.key] = {
      label: band.label,
      condensationDeltaKgM2: round(values.largeScaleCondensationSourceKgM2.on - values.largeScaleCondensationSourceKgM2.off, 5),
      lowerOmegaDeltaPaS: round(values.lowerTroposphericOmegaPaS.on - values.lowerTroposphericOmegaPaS.off, 5),
      midOmegaDeltaPaS: round(values.midTroposphericOmegaPaS.on - values.midTroposphericOmegaPaS.off, 5),
      localBridgeOnPaS: round(values.dryingOmegaBridgeLocalAppliedPaS.on, 5),
      projectedBridgeOnPaS: round(values.dryingOmegaBridgeProjectedAppliedPaS.on, 5),
      stormTrackOn: round(values.stormTrackIndex.on, 5),
      wind10mUOn: round(values.wind10mU.on, 5)
    };
  }
  return out;
}

function findShoulderPeak(offSample, onSample) {
  const lats = onSample?.profiles?.latitudesDeg || [];
  const offCond = offSample?.profiles?.series?.largeScaleCondensationSourceKgM2 || [];
  const onCond = onSample?.profiles?.series?.largeScaleCondensationSourceKgM2 || [];
  const onLocal = onSample?.profiles?.series?.dryingOmegaBridgeLocalAppliedPaS || [];
  const onProjected = onSample?.profiles?.series?.dryingOmegaBridgeProjectedAppliedPaS || [];
  const onLowerOmega = onSample?.profiles?.series?.lowerTroposphericOmegaPaS || [];
  const onMidOmega = onSample?.profiles?.series?.midTroposphericOmegaPaS || [];
  const onStorm = onSample?.profiles?.series?.stormTrackIndex || [];
  let best = null;
  for (let i = 0; i < lats.length; i += 1) {
    const lat = Number(lats[i]) || 0;
    if (!(lat >= 3 && lat <= 18.75)) continue;
    const condDelta = (Number(onCond[i]) || 0) - (Number(offCond[i]) || 0);
    if (!best || condDelta > best.condensationDeltaKgM2) {
      best = {
        latitudeDeg: round(lat, 2),
        condensationDeltaKgM2: round(condDelta, 5),
        localBridgeOnPaS: round(Number(onLocal[i]) || 0, 5),
        projectedBridgeOnPaS: round(Number(onProjected[i]) || 0, 5),
        lowerOmegaOnPaS: round(Number(onLowerOmega[i]) || 0, 5),
        midOmegaOnPaS: round(Number(onMidOmega[i]) || 0, 5),
        stormTrackOn: round(Number(onStorm[i]) || 0, 5)
      };
    }
  }
  return best;
}

export function buildPhase1YEquatorwardAbsorptionGuardDesign({
  baselineMetrics,
  offMetrics,
  onMetrics,
  offSample,
  onSample,
  paths
}) {
  const bands = buildBandDiagnostics(offSample, onSample);
  const shoulderPeak = findShoulderPeak(offSample, onSample);
  const referenceSlices = {
    tropicalShoulder3p75: {
      off: nearestLatSnapshot(offSample, 3.75),
      on: nearestLatSnapshot(onSample, 3.75)
    },
    tropicalShoulder11p25: {
      off: nearestLatSnapshot(offSample, 11.25),
      on: nearestLatSnapshot(onSample, 11.25)
    },
    equatorwardLeak18p75: {
      off: nearestLatSnapshot(offSample, 18.75),
      on: nearestLatSnapshot(onSample, 18.75)
    },
    sourceCore26p25: {
      off: nearestLatSnapshot(offSample, 26.25),
      on: nearestLatSnapshot(onSample, 26.25)
    },
    targetEntry33p75: {
      off: nearestLatSnapshot(offSample, 33.75),
      on: nearestLatSnapshot(onSample, 33.75)
    }
  };

  const remoteShoulderAbsorptionScore = mean(
    clamp01(Math.max(0, bands.tropicalShoulderNorth.condensationDeltaKgM2) / 0.01),
    clamp01(Math.max(0, bands.tropicalShoulderCoreNorth.condensationDeltaKgM2) / 0.015),
    1 - clamp01((shoulderPeak?.projectedBridgeOnPaS || 0) / 0.0001),
    1 - clamp01((shoulderPeak?.localBridgeOnPaS || 0) / 0.0001),
    clamp01(Math.max(0, -bands.sourceCoreNorth.condensationDeltaKgM2) / 0.006),
    clamp01(bands.targetEntryNorth.projectedBridgeOnPaS / 0.0004)
  );

  const directBridgeLeakScore = mean(
    clamp01(Math.max(0, bands.tropicalShoulderNorth.condensationDeltaKgM2) / 0.01),
    clamp01((shoulderPeak?.projectedBridgeOnPaS || 0) / 0.0002),
    clamp01((shoulderPeak?.localBridgeOnPaS || 0) / 0.0002)
  );

  const broadHumidificationScore = mean(
    clamp01(Math.max(0, bands.tropicalShoulderNorth.condensationDeltaKgM2) / 0.01),
    clamp01(Math.max(0, bands.equatorwardLeakNorth.condensationDeltaKgM2) / 0.004),
    1 - clamp01(Math.max(0, -bands.sourceCoreNorth.condensationDeltaKgM2) / 0.01)
  );

  const downstreamJetNonresponseScore = mean(
    clamp01(bands.targetEntryNorth.projectedBridgeOnPaS / 0.0004),
    clamp01(bands.jetBandNorth.projectedBridgeOnPaS / 0.0001),
    1 - clamp01(Math.abs(delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms)) / 0.01)
  );

  const ranking = [
    {
      key: 'remote_shoulder_absorption',
      label: 'Remote tropical-shoulder condensation rebound absorbs the carrier before wind recovery',
      score: round(remoteShoulderAbsorptionScore, 5),
      evidence: {
        shoulderPeakLatitudeDeg: shoulderPeak?.latitudeDeg ?? null,
        shoulderPeakCondensationDeltaKgM2: shoulderPeak?.condensationDeltaKgM2 ?? null,
        shoulderPeakProjectedBridgeOnPaS: shoulderPeak?.projectedBridgeOnPaS ?? null,
        shoulderPeakLocalBridgeOnPaS: shoulderPeak?.localBridgeOnPaS ?? null,
        targetEntryProjectedBridgeOnPaS: bands.targetEntryNorth.projectedBridgeOnPaS,
        sourceCoreCondensationDeltaKgM2: bands.sourceCoreNorth.condensationDeltaKgM2
      }
    },
    {
      key: 'downstream_jet_nonresponse',
      label: 'Carrier reaches the jet-entry structure but wind recovery still fails downstream',
      score: round(downstreamJetNonresponseScore, 5),
      evidence: {
        targetEntryProjectedBridgeOnPaS: bands.targetEntryNorth.projectedBridgeOnPaS,
        jetBandProjectedBridgeOnPaS: bands.jetBandNorth.projectedBridgeOnPaS,
        midlatitudeWesterliesNorthDeltaMs: round(delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms), 5)
      }
    },
    {
      key: 'direct_shoulder_bridge_leak',
      label: 'The bridge itself is leaking directly into the tropical shoulder',
      score: round(directBridgeLeakScore, 5),
      evidence: {
        shoulderPeakLatitudeDeg: shoulderPeak?.latitudeDeg ?? null,
        shoulderPeakProjectedBridgeOnPaS: shoulderPeak?.projectedBridgeOnPaS ?? null,
        shoulderPeakLocalBridgeOnPaS: shoulderPeak?.localBridgeOnPaS ?? null
      }
    },
    {
      key: 'broad_humidification_rebound',
      label: 'A broad tropical humidification rebound is overwhelming any narrow guard',
      score: round(broadHumidificationScore, 5),
      evidence: {
        tropicalShoulderCondensationDeltaKgM2: bands.tropicalShoulderNorth.condensationDeltaKgM2,
        equatorwardLeakCondensationDeltaKgM2: bands.equatorwardLeakNorth.condensationDeltaKgM2,
        sourceCoreCondensationDeltaKgM2: bands.sourceCoreNorth.condensationDeltaKgM2
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    schema: 'satellite-wars.phase1y-equatorward-absorption-guard-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: ranking[0]?.key || 'remote_shoulder_absorption',
    nextPhase: 'Phase 1Z: Implement Shoulder Absorption Guard Patch',
    recommendation: 'Keep the repaired projected-share bridge in place and add a narrow tropical-shoulder absorption guard in the saturation-adjustment lane before trying more downstream jet coupling.',
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
    shoulderPeak,
    referenceSlices,
    patchContract: {
      targetLane: 'marine saturation-adjustment condensation in the tropical shoulder',
      preferredFiles: ['microphysics5.js', 'planetary-realism-audit.mjs'],
      latitudeWindowDeg: [3, 12],
      doNotTouch: ['projected bridge deposition in 30-45N', 'Phase 1K marine-maintenance dry-belt suppression', 'Phase 1M circulation rebound containment'],
      desiredSignature: {
        tropicalShoulderCondensationDeltaKgM2: '<= 0',
        targetEntryProjectedBridgeOnPaS: 'stay > 0',
        midlatitudeWesterliesNorthU10Ms: 'non-decreasing'
      }
    },
    ranking
  };
}

export function renderPhase1YReport(summary) {
  const lines = [
    '# Phase 1Y Equatorward Absorption Guard Design',
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
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\` (delta \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Dominant Shoulder Signal',
    '',
    `- strongest shoulder rebound latitude: \`${summary.shoulderPeak.latitudeDeg}°\``,
    `- shoulder condensation delta: \`${summary.shoulderPeak.condensationDeltaKgM2}\``,
    `- shoulder local bridge on: \`${summary.shoulderPeak.localBridgeOnPaS}\``,
    `- shoulder projected bridge on: \`${summary.shoulderPeak.projectedBridgeOnPaS}\``,
    `- shoulder lower / mid omega on: \`${summary.shoulderPeak.lowerOmegaOnPaS}\` / \`${summary.shoulderPeak.midOmegaOnPaS}\``,
    `- shoulder storm-track on: \`${summary.shoulderPeak.stormTrackOn}\``,
    '',
    '## Band Diagnostics',
    '',
    ...Object.values(summary.bandDiagnostics).map((band) =>
      `- ${band.label}: condensation delta \`${band.condensationDeltaKgM2}\`, lower / mid omega delta \`${band.lowerOmegaDeltaPaS}\` / \`${band.midOmegaDeltaPaS}\`, local bridge on \`${band.localBridgeOnPaS}\`, projected bridge on \`${band.projectedBridgeOnPaS}\`, storm-track on \`${band.stormTrackOn}\``
    ),
    '',
    '## Reference Slices',
    '',
    ...Object.entries(summary.referenceSlices).map(([key, value]) =>
      `- ${key}: off cond \`${value.off.largeScaleCondensationSourceKgM2}\`, on cond \`${value.on.largeScaleCondensationSourceKgM2}\`, off/on projected bridge \`${value.off.dryingOmegaBridgeProjectedAppliedPaS}\` / \`${value.on.dryingOmegaBridgeProjectedAppliedPaS}\`, off/on local bridge \`${value.off.dryingOmegaBridgeLocalAppliedPaS}\` / \`${value.on.dryingOmegaBridgeLocalAppliedPaS}\``
    ),
    '',
    '## Patch Contract',
    '',
    `- target lane: ${summary.patchContract.targetLane}`,
    `- latitude window: \`${summary.patchContract.latitudeWindowDeg[0]}-${summary.patchContract.latitudeWindowDeg[1]}°\``,
    `- do not touch: ${summary.patchContract.doNotTouch.join('; ')}`,
    `- desired signature: shoulder condensation \`${summary.patchContract.desiredSignature.tropicalShoulderCondensationDeltaKgM2}\`, target-entry projected bridge \`${summary.patchContract.desiredSignature.targetEntryProjectedBridgeOnPaS}\`, NH jet \`${summary.patchContract.desiredSignature.midlatitudeWesterliesNorthU10Ms}\``,
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
  const baseline = readJson(args.baselinePath);
  const offAudit = readJson(args.offPath);
  const onAudit = readJson(args.onPath);
  const summary = buildPhase1YEquatorwardAbsorptionGuardDesign({
    baselineMetrics: latestMetrics(baseline),
    offMetrics: latestMetrics(offAudit),
    onMetrics: latestMetrics(onAudit),
    offSample: latestSample(offAudit),
    onSample: latestSample(onAudit),
    paths: {
      baselinePath: args.baselinePath,
      offPath: args.offPath,
      onPath: args.onPath
    }
  });
  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(args.jsonPath), { recursive: true });
  fs.writeFileSync(args.reportPath, renderPhase1YReport(summary));
  fs.writeFileSync(args.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] === __filename) {
  main();
}
