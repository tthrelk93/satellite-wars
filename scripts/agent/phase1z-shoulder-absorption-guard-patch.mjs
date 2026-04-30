#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1z-off.json';
const defaultOnPath = '/tmp/phase1z-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1z-shoulder-absorption-guard-patch.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1z-shoulder-absorption-guard-patch.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestMetrics = (audit) => audit?.samples?.[audit.samples.length - 1]?.metrics || {};
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;
const delta = (onValue, offValue) => (Number(onValue) || 0) - (Number(offValue) || 0);

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
    shoulderAbsorptionGuardAppliedSuppressionKgM2: round(get('shoulderAbsorptionGuardAppliedSuppressionKgM2'), 5),
    dryingOmegaBridgeLocalAppliedPaS: round(get('dryingOmegaBridgeLocalAppliedPaS'), 5),
    dryingOmegaBridgeProjectedAppliedPaS: round(get('dryingOmegaBridgeProjectedAppliedPaS'), 5),
    wind10mU: round(get('wind10mU'), 5)
  };
}

function buildBandDiagnostics(offSample, onSample) {
  const bands = [
    { key: 'tropicalShoulderNorth', label: 'Tropical shoulder (3-18.75N)', minLat: 3, maxLat: 18.75 },
    { key: 'tropicalShoulderCoreNorth', label: 'Tropical shoulder core (3-12N)', minLat: 3, maxLat: 12 },
    { key: 'sourceCoreNorth', label: 'Source core (20-30N)', minLat: 20, maxLat: 30 },
    { key: 'targetEntryNorth', label: 'Target entry (30-45N)', minLat: 30, maxLat: 45 },
    { key: 'jetBandNorth', label: 'Jet band (41.25-56.25N)', minLat: 41.25, maxLat: 56.25 }
  ];
  const out = {};
  for (const band of bands) {
    const condensationOff = bandAverage(offSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);
    const condensationOn = bandAverage(onSample, 'largeScaleCondensationSourceKgM2', band.minLat, band.maxLat);
    const guardAppliedOn = bandAverage(onSample, 'shoulderAbsorptionGuardAppliedSuppressionKgM2', band.minLat, band.maxLat);
    const localBridgeOn = bandAverage(onSample, 'dryingOmegaBridgeLocalAppliedPaS', band.minLat, band.maxLat);
    const projectedBridgeOn = bandAverage(onSample, 'dryingOmegaBridgeProjectedAppliedPaS', band.minLat, band.maxLat);
    const windOn = bandAverage(onSample, 'wind10mU', band.minLat, band.maxLat);
    out[band.key] = {
      label: band.label,
      condensationDeltaKgM2: round(condensationOn - condensationOff, 5),
      guardAppliedOnKgM2: round(guardAppliedOn, 5),
      localBridgeOnPaS: round(localBridgeOn, 5),
      projectedBridgeOnPaS: round(projectedBridgeOn, 5),
      wind10mUOn: round(windOn, 5)
    };
  }
  return out;
}

function findShoulderPeak(offSample, onSample) {
  const lats = onSample?.profiles?.latitudesDeg || [];
  const offCond = offSample?.profiles?.series?.largeScaleCondensationSourceKgM2 || [];
  const onCond = onSample?.profiles?.series?.largeScaleCondensationSourceKgM2 || [];
  const onGuard = onSample?.profiles?.series?.shoulderAbsorptionGuardAppliedSuppressionKgM2 || [];
  let best = null;
  for (let i = 0; i < lats.length; i += 1) {
    const lat = Number(lats[i]) || 0;
    if (!(lat >= 3 && lat <= 12)) continue;
    const condDelta = (Number(onCond[i]) || 0) - (Number(offCond[i]) || 0);
    if (!best || condDelta > best.condensationDeltaKgM2) {
      best = {
        latitudeDeg: round(lat, 2),
        condensationDeltaKgM2: round(condDelta, 5),
        guardAppliedOnKgM2: round(Number(onGuard[i]) || 0, 5)
      };
    }
  }
  return best;
}

export function buildPhase1ZShoulderAbsorptionGuardPatch({
  baselineMetrics,
  offMetrics,
  onMetrics,
  offSample,
  onSample,
  paths
}) {
  const bands = buildBandDiagnostics(offSample, onSample);
  const shoulderPeak = findShoulderPeak(offSample, onSample);
  const exitCriteria = {
    shoulderCondensationPass: (bands.tropicalShoulderCoreNorth?.condensationDeltaKgM2 || 0) <= 0,
    targetEntryProjectedBridgePass: (bands.targetEntryNorth?.projectedBridgeOnPaS || 0) > 0,
    itczWidthPass: (Number(onMetrics.itczWidthDeg) || 0) <= (Number(offMetrics.itczWidthDeg) || 0),
    northDryPass: (Number(onMetrics.subtropicalDryNorthRatio) || 0) <= (Number(offMetrics.subtropicalDryNorthRatio) || 0),
    southDryPass: (Number(onMetrics.subtropicalDrySouthRatio) || 0) <= (Number(offMetrics.subtropicalDrySouthRatio) || 0),
    jetNonDegradingPass: (Number(onMetrics.midlatitudeWesterliesNorthU10Ms) || 0) >= (Number(offMetrics.midlatitudeWesterliesNorthU10Ms) || 0),
    sourceLocalityPass: (bands.sourceCoreNorth?.guardAppliedOnKgM2 || 0) <= (bands.tropicalShoulderCoreNorth?.guardAppliedOnKgM2 || 0)
  };
  const pass = Object.values(exitCriteria).every(Boolean);
  return {
    schema: 'satellite-wars.phase1z-shoulder-absorption-guard-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: pass ? 'kept_patch' : 'rejected_patch',
    nextPhase: pass ? 'Phase 2A: Finish Hadley Moisture Partitioning' : 'Phase 1ZA: Shoulder Guard Residual Attribution',
    recommendation: pass
      ? 'Keep the shoulder absorption guard and move back toward the main Hadley moisture-partitioning roadmap.'
      : 'Do not assume the shoulder guard is the final fix yet; use the same-branch compare to identify the residual mismatch before broadening tuning.',
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
    shoulderPeak,
    bandDiagnostics: bands,
    referenceSlices: {
      tropicalShoulder3p75: { off: nearestLatSnapshot(offSample, 3.75), on: nearestLatSnapshot(onSample, 3.75) },
      tropicalShoulder11p25: { off: nearestLatSnapshot(offSample, 11.25), on: nearestLatSnapshot(onSample, 11.25) },
      sourceCore26p25: { off: nearestLatSnapshot(offSample, 26.25), on: nearestLatSnapshot(onSample, 26.25) },
      targetEntry33p75: { off: nearestLatSnapshot(offSample, 33.75), on: nearestLatSnapshot(onSample, 33.75) }
    },
    exitCriteria
  };
}

export function renderPhase1ZReport(summary) {
  const lines = [
    '# Phase 1Z Shoulder Absorption Guard Patch',
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
    '## Exit Criteria',
    '',
    `- shoulder condensation pass: \`${summary.exitCriteria.shoulderCondensationPass}\``,
    `- target-entry projected bridge pass: \`${summary.exitCriteria.targetEntryProjectedBridgePass}\``,
    `- ITCZ width pass: \`${summary.exitCriteria.itczWidthPass}\``,
    `- north dry-belt pass: \`${summary.exitCriteria.northDryPass}\``,
    `- south dry-belt pass: \`${summary.exitCriteria.southDryPass}\``,
    `- NH jet non-degrading pass: \`${summary.exitCriteria.jetNonDegradingPass}\``,
    `- source-locality pass: \`${summary.exitCriteria.sourceLocalityPass}\``,
    '',
    '## Dominant Shoulder Point',
    '',
    `- strongest shoulder latitude: \`${summary.shoulderPeak?.latitudeDeg ?? null}°\``,
    `- condensation delta: \`${summary.shoulderPeak?.condensationDeltaKgM2 ?? null}\``,
    `- applied guard suppression on: \`${summary.shoulderPeak?.guardAppliedOnKgM2 ?? null}\``,
    '',
    '## Band Diagnostics',
    ''
  ];

  for (const band of Object.values(summary.bandDiagnostics)) {
    lines.push(
      `- ${band.label}: condensation delta \`${band.condensationDeltaKgM2}\`, guard applied on \`${band.guardAppliedOnKgM2}\`, local bridge on \`${band.localBridgeOnPaS}\`, projected bridge on \`${band.projectedBridgeOnPaS}\`, wind on \`${band.wind10mUOn}\``
    );
  }

  lines.push(
    '',
    '## Reference Slices',
    '',
    `- tropicalShoulder3p75: off cond \`${summary.referenceSlices.tropicalShoulder3p75.off.largeScaleCondensationSourceKgM2}\`, on cond \`${summary.referenceSlices.tropicalShoulder3p75.on.largeScaleCondensationSourceKgM2}\`, off/on guard \`${summary.referenceSlices.tropicalShoulder3p75.off.shoulderAbsorptionGuardAppliedSuppressionKgM2}\` / \`${summary.referenceSlices.tropicalShoulder3p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\``,
    `- tropicalShoulder11p25: off cond \`${summary.referenceSlices.tropicalShoulder11p25.off.largeScaleCondensationSourceKgM2}\`, on cond \`${summary.referenceSlices.tropicalShoulder11p25.on.largeScaleCondensationSourceKgM2}\`, off/on guard \`${summary.referenceSlices.tropicalShoulder11p25.off.shoulderAbsorptionGuardAppliedSuppressionKgM2}\` / \`${summary.referenceSlices.tropicalShoulder11p25.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\``,
    `- sourceCore26p25: off cond \`${summary.referenceSlices.sourceCore26p25.off.largeScaleCondensationSourceKgM2}\`, on cond \`${summary.referenceSlices.sourceCore26p25.on.largeScaleCondensationSourceKgM2}\`, on guard \`${summary.referenceSlices.sourceCore26p25.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\``,
    `- targetEntry33p75: off cond \`${summary.referenceSlices.targetEntry33p75.off.largeScaleCondensationSourceKgM2}\`, on cond \`${summary.referenceSlices.targetEntry33p75.on.largeScaleCondensationSourceKgM2}\`, on projected bridge \`${summary.referenceSlices.targetEntry33p75.on.dryingOmegaBridgeProjectedAppliedPaS}\``,
    '',
    '## Baseline Gap',
    '',
    `- \`itczWidthDeg\`: \`${summary.baselineGap.itczWidthDeg.baseline}\` -> \`${summary.baselineGap.itczWidthDeg.current}\` (delta \`${summary.baselineGap.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.baselineGap.subtropicalDryNorthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDryNorthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDryNorthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.baseline}\` -> \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.current}\` (delta \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.delta}\`)`
  );

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    baselinePath: defaultBaselinePath,
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--baseline' && argv[i + 1]) options.baselinePath = path.resolve(argv[++i]);
    else if (arg.startsWith('--baseline=')) options.baselinePath = path.resolve(arg.slice('--baseline='.length));
    else if (arg === '--off' && argv[i + 1]) options.offPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--off=')) options.offPath = path.resolve(arg.slice('--off='.length));
    else if (arg === '--on' && argv[i + 1]) options.onPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--on=')) options.onPath = path.resolve(arg.slice('--on='.length));
    else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--report=')) options.reportPath = path.resolve(arg.slice('--report='.length));
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--json=')) options.jsonPath = path.resolve(arg.slice('--json='.length));
  }
  return options;
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main(argv) {
  const options = parseArgs(argv);
  const baselineAudit = readJson(options.baselinePath);
  const offAudit = readJson(options.offPath);
  const onAudit = readJson(options.onPath);
  const summary = buildPhase1ZShoulderAbsorptionGuardPatch({
    baselineMetrics: latestMetrics(baselineAudit),
    offMetrics: latestMetrics(offAudit),
    onMetrics: latestMetrics(onAudit),
    offSample: latestSample(offAudit),
    onSample: latestSample(onAudit),
    paths: options
  });
  const report = renderPhase1ZReport(summary);
  ensureParent(options.reportPath);
  ensureParent(options.jsonPath);
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) main(process.argv.slice(2));
