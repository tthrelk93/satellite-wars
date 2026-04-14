#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zn-off.json';
const defaultOnPath = '/tmp/phase1zn-on.json';
const defaultPhase1ZMPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zm-bilateral-equatorial-edge-source-redesign.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zn-mirrored-bilateral-edge-source-window-patch.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zn-mirrored-bilateral-edge-source-window-patch.json');

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
    lowerTroposphericOmegaPaS: round(get('lowerTroposphericOmegaPaS')),
    equatorialEdgeSubsidenceGuardAppliedDiagPaS: round(get('equatorialEdgeSubsidenceGuardAppliedDiagPaS')),
    equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: round(get('equatorialEdgeSubsidenceGuardSourceSupportDiagFrac')),
    equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: round(get('equatorialEdgeSubsidenceGuardTargetWeightDiagFrac')),
    shoulderAbsorptionGuardCandidateMassKgM2: round(get('shoulderAbsorptionGuardCandidateMassKgM2')),
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

export function buildPhase1ZNMirroredBilateralEdgeSourceWindowPatch({ offAudit, onAudit, phase1zmSummary, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const southSource = { off: snapshot(offSample, -11.25), on: snapshot(onSample, -11.25) };
  southSource.delta = deltaSlice(southSource.on, southSource.off);
  const southEdge = { off: snapshot(offSample, -3.75), on: snapshot(onSample, -3.75) };
  southEdge.delta = deltaSlice(southEdge.on, southEdge.off);
  const northEdge = { off: snapshot(offSample, 3.75), on: snapshot(onSample, 3.75) };
  northEdge.delta = deltaSlice(northEdge.on, northEdge.off);
  const northSource = { off: snapshot(offSample, 11.25), on: snapshot(onSample, 11.25) };
  northSource.delta = deltaSlice(northSource.on, northSource.off);
  const spillover = { off: snapshot(offSample, 18.75), on: snapshot(onSample, 18.75) };
  spillover.delta = deltaSlice(spillover.on, spillover.off);
  const targetEntry = { off: snapshot(offSample, 33.75), on: snapshot(onSample, 33.75) };
  targetEntry.delta = deltaSlice(targetEntry.on, targetEntry.off);

  const metrics = {
    itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
    midlatitudeWesterliesNorthU10Ms: round((Number(onMetrics.midlatitudeWesterliesNorthU10Ms) || 0) - (Number(offMetrics.midlatitudeWesterliesNorthU10Ms) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0))
  };

  const bilateralActivation = (northSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac || 0) > 0
    && (southSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac || 0) > 0
    && (northEdge.on.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac || 0) > 0
    && (southEdge.on.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac || 0) > 0
    && (northEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS || 0) > 0
    && (southEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS || 0) > 0;

  const keepPatch = bilateralActivation
    && metrics.itczWidthDeg < 0
    && metrics.subtropicalDryNorthRatio <= 0
    && metrics.subtropicalDrySouthRatio <= 0
    && (northEdge.delta.largeScaleCondensationSourceKgM2 || 0) <= 0
    && (southEdge.delta.largeScaleCondensationSourceKgM2 || 0) <= 0
    && (spillover.delta.largeScaleCondensationSourceKgM2 || 0) <= 0;

  const verdict = keepPatch
    ? 'keep_mirrored_bilateral_edge_guard'
    : bilateralActivation
      ? 'bilateral_activation_with_nh_edge_overresponse'
      : 'mirror_still_broken';

  return {
    schema: 'satellite-wars.phase1zn-mirrored-bilateral-edge-source-window-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZO: Bilateral Edge Reintegration Audit'
      : 'Phase 1ZO: Bilateral Edge Outcome Attribution',
    recommendation: keepPatch
      ? 'Keep the mirrored bilateral edge-source patch and audit remaining climate drift before making it default.'
      : 'Do not enable the mirrored bilateral edge-source patch by default. The geometry bug is fixed, but the outcome is now a bilateral activation with north-edge and 18.75°N overresponse.',
    phase1zmContext: {
      verdict: phase1zmSummary?.verdict ?? null,
      nextPhase: phase1zmSummary?.nextPhase ?? null
    },
    metrics,
    bilateralActivation,
    slices: {
      southSource,
      southEdge,
      northEdge,
      northSource,
      spillover,
      targetEntry
    },
    designContract: {
      keep: [
        'keep the bilateral abs-lat source and target geometry',
        'keep the NH target-entry exclusion separate from the bilateral edge guard',
        'keep the equatorial-edge guard runtime toggle disabled by default until the climate screen passes'
      ],
      change: [
        'explain why the north edge 3.75°N and adjacent 18.75°N lane over-respond once bilateral activation becomes live',
        'treat the next phase as an outcome-attribution problem, not another geometry problem',
        'preserve the south-edge stabilization while reducing the north-edge and 18.75°N rebound'
      ]
    }
  };
}

export function renderPhase1ZNReport(summary) {
  return `# Phase 1ZN Mirrored Bilateral Edge-Source Window Patch

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- bilateral activation: \`${summary.bilateralActivation}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Climate Guardrails

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- NH westerlies delta: \`${summary.metrics.midlatitudeWesterliesNorthU10Ms}\`
- NH dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`

## Bilateral Activation Check

- -11.25° source support on: \`${summary.slices.southSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- 11.25° source support on: \`${summary.slices.northSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- -3.75° target weight on: \`${summary.slices.southEdge.on.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac}\`
- 3.75° target weight on: \`${summary.slices.northEdge.on.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac}\`
- -3.75° applied guard on: \`${summary.slices.southEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`
- 3.75° applied guard on: \`${summary.slices.northEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`

## Outcome

- -3.75° condensation delta: \`${summary.slices.southEdge.delta.largeScaleCondensationSourceKgM2}\`
- 3.75° condensation delta: \`${summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2}\`
- 11.25° condensation delta: \`${summary.slices.northSource.delta.largeScaleCondensationSourceKgM2}\`
- 18.75° spillover condensation delta: \`${summary.slices.spillover.delta.largeScaleCondensationSourceKgM2}\`
- 33.75° target-entry applied suppression on: \`${summary.slices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`

## Next Patch Contract

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1zmPath: defaultPhase1ZMPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zm' && argv[i + 1]) options.phase1zmPath = argv[++i];
    else if (arg.startsWith('--phase1zm=')) options.phase1zmPath = arg.slice('--phase1zm='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZNMirroredBilateralEdgeSourceWindowPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1zmSummary: readJson(options.phase1zmPath),
    paths: options
  });
  const report = renderPhase1ZNReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
