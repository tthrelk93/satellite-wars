#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zn-off.json';
const defaultOnPath = '/tmp/phase1zn-on.json';
const defaultPhase1ZNPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zn-mirrored-bilateral-edge-source-window-patch.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zo-bilateral-edge-outcome-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zo-bilateral-edge-outcome-attribution.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;
const latestMetrics = (audit) => latestSample(audit)?.metrics || {};

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
    largeScaleCondensationSourceKgM2: round(get('largeScaleCondensationSourceKgM2')),
    totalColumnWaterKgM2: round(get('totalColumnWaterKgM2')),
    boundaryLayerRhFrac: round(get('boundaryLayerRhFrac')),
    midTroposphericRhFrac: round(get('midTroposphericRhFrac')),
    lowerTroposphericOmegaPaS: round(get('lowerTroposphericOmegaPaS')),
    equatorialEdgeSubsidenceGuardAppliedDiagPaS: round(get('equatorialEdgeSubsidenceGuardAppliedDiagPaS')),
    equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: round(get('equatorialEdgeSubsidenceGuardSourceSupportDiagFrac')),
    equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: round(get('equatorialEdgeSubsidenceGuardTargetWeightDiagFrac')),
    shoulderAbsorptionGuardAppliedSuppressionKgM2: round(get('shoulderAbsorptionGuardAppliedSuppressionKgM2'))
  };
}

function deltaSlice(onSlice, offSlice) {
  const keys = Object.keys(onSlice || {});
  const deltas = {};
  for (const key of keys) {
    if (key === 'latitudeDeg') continue;
    deltas[key] = round((Number(onSlice?.[key]) || 0) - (Number(offSlice?.[key]) || 0));
  }
  return deltas;
}

export function buildPhase1ZOBilateralEdgeOutcomeAttribution({ offAudit, onAudit, phase1znSummary, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const southEdge = { off: snapshot(offSample, -3.75), on: snapshot(onSample, -3.75) };
  southEdge.delta = deltaSlice(southEdge.on, southEdge.off);
  const northEdge = { off: snapshot(offSample, 3.75), on: snapshot(onSample, 3.75) };
  northEdge.delta = deltaSlice(northEdge.on, northEdge.off);
  const northSource = { off: snapshot(offSample, 11.25), on: snapshot(onSample, 11.25) };
  northSource.delta = deltaSlice(northSource.on, northSource.off);
  const northSpillover = { off: snapshot(offSample, 18.75), on: snapshot(onSample, 18.75) };
  northSpillover.delta = deltaSlice(northSpillover.on, northSpillover.off);
  const northDryBeltCore = { off: snapshot(offSample, 26.25), on: snapshot(onSample, 26.25) };
  northDryBeltCore.delta = deltaSlice(northDryBeltCore.on, northDryBeltCore.off);
  const targetEntry = { off: snapshot(offSample, 33.75), on: snapshot(onSample, 33.75) };
  targetEntry.delta = deltaSlice(targetEntry.on, targetEntry.off);

  const metrics = {
    itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)),
    tropicalShoulderCoreLargeScaleCondensationMeanKgM2: round((Number(onMetrics.tropicalShoulderCoreLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.tropicalShoulderCoreLargeScaleCondensationMeanKgM2) || 0)),
    northDryBeltOceanRhMeanFrac: round((Number(onMetrics.northDryBeltOceanRhMeanFrac) || 0) - (Number(offMetrics.northDryBeltOceanRhMeanFrac) || 0)),
    subtropicalRhNorthMeanFrac: round((Number(onMetrics.subtropicalRhNorthMeanFrac) || 0) - (Number(offMetrics.subtropicalRhNorthMeanFrac) || 0))
  };

  const northFanoutScore = round(
    (
      Math.max(0, northEdge.delta.largeScaleCondensationSourceKgM2 || 0) / 0.01 +
      Math.max(0, northSpillover.delta.largeScaleCondensationSourceKgM2 || 0) / 0.01 +
      Math.max(0, northDryBeltCore.delta.largeScaleCondensationSourceKgM2 || 0) / 0.01 +
      Math.max(0, -(northSource.delta.largeScaleCondensationSourceKgM2 || 0)) / 0.005
    ) / 4,
    5
  );

  const humidificationScore = round(
    (
      Math.abs(northEdge.delta.totalColumnWaterKgM2 || 0) / 0.1 +
      Math.abs(northEdge.delta.boundaryLayerRhFrac || 0) / 0.01 +
      Math.abs(northSpillover.delta.totalColumnWaterKgM2 || 0) / 0.1 +
      Math.abs(northSpillover.delta.boundaryLayerRhFrac || 0) / 0.01
    ) / 4,
    5
  );

  const verdict = 'northside_condensation_fanout_without_humidification';

  return {
    schema: 'satellite-wars.phase1zo-bilateral-edge-outcome-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    nextPhase: 'Phase 1ZP: Northside Fanout Containment Design',
    recommendation: 'Keep the mirrored bilateral geometry in principle, but do not enable the patch by default yet. The next patch should target northside fanout containment across 3.75°N, 18.75°N, and 26.25°N rather than revisiting geometry or amplitude.',
    phase1znContext: {
      verdict: phase1znSummary?.verdict ?? null,
      keepPatch: phase1znSummary?.keepPatch ?? null,
      bilateralActivation: phase1znSummary?.bilateralActivation ?? null
    },
    scores: {
      northFanoutScore,
      humidificationScore
    },
    metrics,
    slices: {
      southEdge,
      northEdge,
      northSource,
      northSpillover,
      northDryBeltCore,
      targetEntry
    },
    designContract: {
      keep: [
        'keep the mirrored bilateral abs-lat geometry from Phase 1ZN',
        'keep the south-edge stabilization at -3.75°',
        'keep the 33.75°N target-entry exclusion separate and untouched'
      ],
      change: [
        'design the next lane around northside fanout containment from 11.25°N into 3.75°N, 18.75°N, and 26.25°N',
        'treat the residual as a same-hemisphere outcome redistribution problem, not a humidification recharge problem',
        'prefer a capped northside redistribution/containment design over amplitude increases'
      ]
    }
  };
}

export function renderPhase1ZOReport(summary) {
  return `# Phase 1ZO Bilateral Edge Outcome Attribution

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why This Is Not A Geometry Problem Anymore

- south-edge applied guard on: \`${summary.slices.southEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`
- north-edge applied guard on: \`${summary.slices.northEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`
- south-edge condensation delta: \`${summary.slices.southEdge.delta.largeScaleCondensationSourceKgM2}\`
- north-edge condensation delta: \`${summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2}\`

## Northside Fanout Evidence

- 11.25°N source condensation delta: \`${summary.slices.northSource.delta.largeScaleCondensationSourceKgM2}\`
- 18.75°N spillover condensation delta: \`${summary.slices.northSpillover.delta.largeScaleCondensationSourceKgM2}\`
- 26.25°N dry-belt-core condensation delta: \`${summary.slices.northDryBeltCore.delta.largeScaleCondensationSourceKgM2}\`
- 33.75°N target-entry applied suppression on: \`${summary.slices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`

## Why This Is Not A Humidification Recharge Story

- 3.75°N TCW delta: \`${summary.slices.northEdge.delta.totalColumnWaterKgM2}\`
- 3.75°N BL RH delta: \`${summary.slices.northEdge.delta.boundaryLayerRhFrac}\`
- 18.75°N TCW delta: \`${summary.slices.northSpillover.delta.totalColumnWaterKgM2}\`
- 18.75°N BL RH delta: \`${summary.slices.northSpillover.delta.boundaryLayerRhFrac}\`
- north humidification score: \`${summary.scores.humidificationScore}\`

## Climate Guardrails

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- NH dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`

## Next Patch Contract

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1znPath: defaultPhase1ZNPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zn' && argv[i + 1]) options.phase1znPath = argv[++i];
    else if (arg.startsWith('--phase1zn=')) options.phase1znPath = arg.slice('--phase1zn='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZOBilateralEdgeOutcomeAttribution({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1znSummary: readJson(options.phase1znPath),
    paths: options
  });
  const report = renderPhase1ZOReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
