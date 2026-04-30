#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1z-off.json';
const defaultOnPath = '/tmp/phase1z-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1za-shoulder-guard-residual-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1za-shoulder-guard-residual-attribution.json');

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
  return {
    latitudeDeg: round(latitudesDeg[index], 2),
    largeScaleCondensationSourceKgM2: round(get('largeScaleCondensationSourceKgM2'), 5),
    shoulderAbsorptionGuardCandidateMassKgM2: round(get('shoulderAbsorptionGuardCandidateMassKgM2'), 5),
    shoulderAbsorptionGuardPotentialSuppressedMassKgM2: round(get('shoulderAbsorptionGuardPotentialSuppressedMassKgM2'), 5),
    shoulderAbsorptionGuardEventCount: round(get('shoulderAbsorptionGuardEventCount'), 5),
    shoulderAbsorptionGuardBridgeSilenceFrac: round(get('shoulderAbsorptionGuardBridgeSilenceFrac'), 5),
    shoulderAbsorptionGuardBandWindowFrac: round(get('shoulderAbsorptionGuardBandWindowFrac'), 5),
    shoulderAbsorptionGuardSelectorSupportFrac: round(get('shoulderAbsorptionGuardSelectorSupportFrac'), 5),
    shoulderAbsorptionGuardAppliedSuppressionKgM2: round(get('shoulderAbsorptionGuardAppliedSuppressionKgM2'), 5),
    dryingOmegaBridgeLocalAppliedPaS: round(get('dryingOmegaBridgeLocalAppliedPaS'), 5),
    dryingOmegaBridgeProjectedAppliedPaS: round(get('dryingOmegaBridgeProjectedAppliedPaS'), 5),
    wind10mU: round(get('wind10mU'), 5)
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

export function buildPhase1ZAResidualAttribution({ offAudit, onAudit, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const shoulder3Off = snapshot(offSample, 3.75);
  const shoulder3On = snapshot(onSample, 3.75);
  const shoulder11Off = snapshot(offSample, 11.25);
  const shoulder11On = snapshot(onSample, 11.25);
  const source26On = snapshot(onSample, 26.25);
  const target33Off = snapshot(offSample, 33.75);
  const target33On = snapshot(onSample, 33.75);

  const bands = {
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
    ),
    targetEntryCondensationDeltaKgM2: round(
      bandAverage(onSample, 'largeScaleCondensationSourceKgM2', 30, 45)
        - bandAverage(offSample, 'largeScaleCondensationSourceKgM2', 30, 45),
      5
    )
  };

  const equatorialEdgeShoulderMissScore = mean(
    clamp01(Math.max(0, delta(shoulder3On.largeScaleCondensationSourceKgM2, shoulder3Off.largeScaleCondensationSourceKgM2)) / 0.02),
    1 - clamp01((shoulder3On.shoulderAbsorptionGuardCandidateMassKgM2 || 0) / 0.005),
    1 - clamp01((shoulder3On.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) / 0.002),
    1 - clamp01((shoulder3On.shoulderAbsorptionGuardBandWindowFrac || 0) / 0.005)
  );

  const targetEntryFalsePositiveScore = mean(
    clamp01((target33On.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) / 0.01),
    clamp01(Math.max(0, -(delta(target33On.largeScaleCondensationSourceKgM2, target33Off.largeScaleCondensationSourceKgM2))) / 0.02),
    1 - clamp01((target33On.dryingOmegaBridgeProjectedAppliedPaS || 0) / 0.00005),
    clamp01((target33On.shoulderAbsorptionGuardBandWindowFrac || 0) / 0.05)
  );

  const sharedWeakEngineAmbiguityScore = mean(
    clamp01((shoulder11On.shoulderAbsorptionGuardCandidateMassKgM2 || 0) / 0.05),
    clamp01((target33On.shoulderAbsorptionGuardCandidateMassKgM2 || 0) / 0.05),
    clamp01((shoulder11On.shoulderAbsorptionGuardBridgeSilenceFrac || 0) / 0.05),
    clamp01((target33On.shoulderAbsorptionGuardBridgeSilenceFrac || 0) / 0.05),
    1 - clamp01((source26On.shoulderAbsorptionGuardCandidateMassKgM2 || 0) / 0.002)
  );

  const ranking = [
    {
      key: 'equatorial_edge_shoulder_miss',
      label: 'The selector never admits the strongest 3.75°N shoulder rebound at all.',
      score: round(equatorialEdgeShoulderMissScore, 5),
      evidence: {
        latitudeDeg: shoulder3On.latitudeDeg,
        condensationDeltaKgM2: round(delta(shoulder3On.largeScaleCondensationSourceKgM2, shoulder3Off.largeScaleCondensationSourceKgM2), 5),
        candidateMassOnKgM2: shoulder3On.shoulderAbsorptionGuardCandidateMassKgM2,
        appliedSuppressionOnKgM2: shoulder3On.shoulderAbsorptionGuardAppliedSuppressionKgM2,
        bandWindowOnFrac: shoulder3On.shoulderAbsorptionGuardBandWindowFrac
      }
    },
    {
      key: 'target_entry_false_positive',
      label: 'The selector is still active in the 30–45°N target-entry lane it was supposed to leave alone.',
      score: round(targetEntryFalsePositiveScore, 5),
      evidence: {
        latitudeDeg: target33On.latitudeDeg,
        condensationDeltaKgM2: round(delta(target33On.largeScaleCondensationSourceKgM2, target33Off.largeScaleCondensationSourceKgM2), 5),
        appliedSuppressionOnKgM2: target33On.shoulderAbsorptionGuardAppliedSuppressionKgM2,
        projectedBridgeOnPaS: target33On.dryingOmegaBridgeProjectedAppliedPaS,
        bandWindowOnFrac: target33On.shoulderAbsorptionGuardBandWindowFrac
      }
    },
    {
      key: 'shared_weak_engine_ambiguity',
      label: 'Weak-engine bridge-silent marine columns still look too similar between the shoulder and target-entry lanes.',
      score: round(sharedWeakEngineAmbiguityScore, 5),
      evidence: {
        shoulder11CandidateOnKgM2: shoulder11On.shoulderAbsorptionGuardCandidateMassKgM2,
        target33CandidateOnKgM2: target33On.shoulderAbsorptionGuardCandidateMassKgM2,
        shoulder11BridgeSilenceOnFrac: shoulder11On.shoulderAbsorptionGuardBridgeSilenceFrac,
        target33BridgeSilenceOnFrac: target33On.shoulderAbsorptionGuardBridgeSilenceFrac,
        source26CandidateOnKgM2: source26On.shoulderAbsorptionGuardCandidateMassKgM2
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const redesignContract = {
    primaryFinding: ranking[0]?.key || 'equatorial_edge_shoulder_miss',
    keep: [
      'keep Phase 1K marine-maintenance suppression',
      'keep Phase 1M circulation rebound containment',
      'keep Phase 1X projected-share repair instrumentation'
    ],
    requiredChanges: [
      'add an explicit equatorial-shoulder admission path for 3–6°N columns instead of relying on the current subtropical-band proxy alone',
      'add an explicit target-entry exclusion for 30–45°N columns so the shoulder guard cannot fire in the transition lane',
      'do not redesign the next selector as a pure weak-engine or bridge-silence gate; those signals are shared by both the desired and false-positive lanes'
    ],
    likelyImplementationNeed: 'microphysics5.js currently lacks a direct latitude-aware discriminator, so the next patch should either inject one into state or precompute a dedicated shoulder-window diagnostic upstream.'
  };

  return {
    schema: 'satellite-wars.phase1za-shoulder-guard-residual-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: ranking[0]?.key || 'equatorial_edge_shoulder_miss',
    nextPhase: 'Phase 1ZB: Latitude-Aware Shoulder Guard Redesign',
    recommendation: 'The next patch should not retune amplitude. It needs a selector redesign that reaches the equatorial shoulder while explicitly excluding the target-entry lane.',
    offOnCompare: {
      itczWidthDeg: { off: round(offMetrics.itczWidthDeg || 0, 5), on: round(onMetrics.itczWidthDeg || 0, 5), delta: round(delta(onMetrics.itczWidthDeg, offMetrics.itczWidthDeg), 5) },
      subtropicalDryNorthRatio: { off: round(offMetrics.subtropicalDryNorthRatio || 0, 5), on: round(onMetrics.subtropicalDryNorthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDryNorthRatio, offMetrics.subtropicalDryNorthRatio), 5) },
      subtropicalDrySouthRatio: { off: round(offMetrics.subtropicalDrySouthRatio || 0, 5), on: round(onMetrics.subtropicalDrySouthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDrySouthRatio, offMetrics.subtropicalDrySouthRatio), 5) },
      midlatitudeWesterliesNorthU10Ms: { off: round(offMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), on: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), delta: round(delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms), 5) }
    },
    residualBands: bands,
    referenceSlices: {
      shoulder3p75: { off: shoulder3Off, on: shoulder3On },
      shoulder11p25: { off: shoulder11Off, on: shoulder11On },
      source26p25: { on: source26On },
      targetEntry33p75: { off: target33Off, on: target33On }
    },
    ranking,
    redesignContract
  };
}

export function renderPhase1ZAReport(summary) {
  const lines = [
    '# Phase 1ZA Shoulder Guard Residual Attribution',
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
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\` (delta \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Residual Bands',
    '',
    `- tropical shoulder core condensation delta: \`${summary.residualBands.tropicalShoulderCoreCondensationDeltaKgM2}\``,
    `- tropical shoulder core applied suppression on: \`${summary.residualBands.tropicalShoulderCoreAppliedSuppressionOnKgM2}\``,
    `- target-entry applied suppression on: \`${summary.residualBands.targetEntryAppliedSuppressionOnKgM2}\``,
    `- target-entry condensation delta: \`${summary.residualBands.targetEntryCondensationDeltaKgM2}\``,
    '',
    '## Reference Slices',
    '',
    `- shoulder 3.75°N: off/on condensation \`${summary.referenceSlices.shoulder3p75.off.largeScaleCondensationSourceKgM2}\` / \`${summary.referenceSlices.shoulder3p75.on.largeScaleCondensationSourceKgM2}\`, candidate on \`${summary.referenceSlices.shoulder3p75.on.shoulderAbsorptionGuardCandidateMassKgM2}\`, applied on \`${summary.referenceSlices.shoulder3p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`, band-window on \`${summary.referenceSlices.shoulder3p75.on.shoulderAbsorptionGuardBandWindowFrac}\``,
    `- shoulder 11.25°N: off/on condensation \`${summary.referenceSlices.shoulder11p25.off.largeScaleCondensationSourceKgM2}\` / \`${summary.referenceSlices.shoulder11p25.on.largeScaleCondensationSourceKgM2}\`, candidate on \`${summary.referenceSlices.shoulder11p25.on.shoulderAbsorptionGuardCandidateMassKgM2}\`, applied on \`${summary.referenceSlices.shoulder11p25.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\``,
    `- source 26.25°N: candidate on \`${summary.referenceSlices.source26p25.on.shoulderAbsorptionGuardCandidateMassKgM2}\`, applied on \`${summary.referenceSlices.source26p25.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\``,
    `- target-entry 33.75°N: off/on condensation \`${summary.referenceSlices.targetEntry33p75.off.largeScaleCondensationSourceKgM2}\` / \`${summary.referenceSlices.targetEntry33p75.on.largeScaleCondensationSourceKgM2}\`, applied on \`${summary.referenceSlices.targetEntry33p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`, projected bridge on \`${summary.referenceSlices.targetEntry33p75.on.dryingOmegaBridgeProjectedAppliedPaS}\``,
    '',
    '## Ranking',
    ''
  ];

  for (const item of summary.ranking) {
    lines.push(`- \`${item.key}\` score \`${item.score}\`: ${item.label}`);
  }

  lines.push(
    '',
    '## Redesign Contract',
    '',
    `- primary finding: \`${summary.redesignContract.primaryFinding}\``,
    ...summary.redesignContract.keep.map((item) => `- keep: ${item}`),
    ...summary.redesignContract.requiredChanges.map((item) => `- required change: ${item}`),
    `- likely implementation need: ${summary.redesignContract.likelyImplementationNeed}`
  );

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = path.resolve(argv[++i]);
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
  const offAudit = readJson(options.offPath);
  const onAudit = readJson(options.onPath);
  const summary = buildPhase1ZAResidualAttribution({
    offAudit,
    onAudit,
    paths: options
  });
  const report = renderPhase1ZAReport(summary);
  ensureParent(options.reportPath);
  ensureParent(options.jsonPath);
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) main(process.argv.slice(2));
