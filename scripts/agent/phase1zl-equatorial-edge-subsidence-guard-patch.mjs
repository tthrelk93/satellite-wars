#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zl-off.json';
const defaultOnPath = '/tmp/phase1zl-on.json';
const defaultPhase1ZKPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zk-equatorial-edge-out-of-lane-attribution.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zl-equatorial-edge-subsidence-guard-patch.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zl-equatorial-edge-subsidence-guard-patch.json');

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
    shoulderAbsorptionGuardCandidateMassKgM2: round(get('shoulderAbsorptionGuardCandidateMassKgM2')),
    shoulderAbsorptionGuardAppliedSuppressionKgM2: round(get('shoulderAbsorptionGuardAppliedSuppressionKgM2')),
    equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: round(get('equatorialEdgeSubsidenceGuardSourceSupportDiagFrac')),
    equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: round(get('equatorialEdgeSubsidenceGuardTargetWeightDiagFrac')),
    equatorialEdgeSubsidenceGuardAppliedDiagPaS: round(get('equatorialEdgeSubsidenceGuardAppliedDiagPaS')),
    freshShoulderInnerWindowDiagFrac: round(get('freshShoulderInnerWindowDiagFrac')),
    freshShoulderEquatorialEdgeWindowDiagFrac: round(get('freshShoulderEquatorialEdgeWindowDiagFrac')),
    freshShoulderTargetEntryExclusionDiagFrac: round(get('freshShoulderTargetEntryExclusionDiagFrac'))
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

export function buildPhase1ZLEquatorialEdgeSubsidenceGuardPatch({ offAudit, onAudit, phase1zkSummary, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const southSource = {
    off: snapshot(offSample, -11.25),
    on: snapshot(onSample, -11.25)
  };
  southSource.delta = deltaSlice(southSource.on, southSource.off);

  const northSource = {
    off: snapshot(offSample, 11.25),
    on: snapshot(onSample, 11.25)
  };
  northSource.delta = deltaSlice(northSource.on, northSource.off);

  const southEdge = {
    off: snapshot(offSample, -3.75),
    on: snapshot(onSample, -3.75)
  };
  southEdge.delta = deltaSlice(southEdge.on, southEdge.off);

  const northEdge = {
    off: snapshot(offSample, 3.75),
    on: snapshot(onSample, 3.75)
  };
  northEdge.delta = deltaSlice(northEdge.on, northEdge.off);

  const spillover = {
    off: snapshot(offSample, 18.75),
    on: snapshot(onSample, 18.75)
  };
  spillover.delta = deltaSlice(spillover.on, spillover.off);

  const targetEntry = {
    off: snapshot(offSample, 33.75),
    on: snapshot(onSample, 33.75)
  };
  targetEntry.delta = deltaSlice(targetEntry.on, targetEntry.off);

  const metrics = {
    itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
    midlatitudeWesterliesNorthU10Ms: round((Number(onMetrics.midlatitudeWesterliesNorthU10Ms) || 0) - (Number(offMetrics.midlatitudeWesterliesNorthU10Ms) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0))
  };

  const keepPatch = metrics.itczWidthDeg < 0
    && metrics.subtropicalDryNorthRatio <= 0
    && metrics.subtropicalDrySouthRatio <= 0
    && (northEdge.delta.largeScaleCondensationSourceKgM2 || 0) <= 0
    && (southEdge.delta.largeScaleCondensationSourceKgM2 || 0) <= 0;

  return {
    schema: 'satellite-wars.phase1zl-equatorial-edge-subsidence-guard-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: keepPatch
      ? 'keep_bilateral_edge_guard'
      : 'north_only_partial_guard_activation',
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZM: Bilateral Equatorial-Edge Source Redesign'
      : 'Phase 1ZM: Bilateral Equatorial-Edge Source Redesign',
    recommendation: keepPatch
      ? 'Keep the equatorial-edge guard and redesign its source lane next, because the current carrier is still tied too tightly to the NH inner-shoulder geometry.'
      : 'Do not enable the equatorial-edge subsidence guard by default. It improves only the north target lane, leaves the south mirror silent, and slightly worsens the climate guardrails.',
    phase1zkContext: {
      verdict: phase1zkSummary?.verdict ?? null,
      nextPhase: phase1zkSummary?.nextPhase ?? null
    },
    metrics,
    slices: {
      southSource,
      northSource,
      southEdge,
      northEdge,
      spillover,
      targetEntry
    },
    designContract: {
      keep: [
        'keep the Phase 1ZJ split-lane shoulder gate',
        'keep the 33.75°N target-entry exclusion',
        'keep the equatorial-edge subsidence guard diagnostics and runtime toggle'
      ],
      change: [
        'redesign the guard source away from the NH-only inner-shoulder lane',
        'build a bilateral source carrier that can project into both -3.75° and 3.75° edge lanes',
        'treat this as a source-lane geometry problem before any amplitude increase'
      ]
    }
  };
}

export function renderPhase1ZLReport(summary) {
  return `# Phase 1ZL Equatorial-Edge Subsidence Guard Patch

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
- NH dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`

## Bilateral Edge Result

- -3.75° condensation delta: \`${summary.slices.southEdge.delta.largeScaleCondensationSourceKgM2}\`
- -3.75° applied guard on: \`${summary.slices.southEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`
- 3.75° condensation delta: \`${summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2}\`
- 3.75° applied guard on: \`${summary.slices.northEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`

## Source-Lane Asymmetry

- -11.25° source support on: \`${summary.slices.southSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- 11.25° source support on: \`${summary.slices.northSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- -3.75° target weight on: \`${summary.slices.southEdge.on.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac}\`
- 3.75° target weight on: \`${summary.slices.northEdge.on.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac}\`

## Protected Lanes

- 18.75° spillover condensation delta: \`${summary.slices.spillover.delta.largeScaleCondensationSourceKgM2}\`
- 33.75° target-entry applied suppression on: \`${summary.slices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`
- 33.75° target-entry exclusion on: \`${summary.slices.targetEntry.on.freshShoulderTargetEntryExclusionDiagFrac}\`

## Next Patch Contract

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1zkPath: defaultPhase1ZKPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zk' && argv[i + 1]) options.phase1zkPath = argv[++i];
    else if (arg.startsWith('--phase1zk=')) options.phase1zkPath = arg.slice('--phase1zk='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZLEquatorialEdgeSubsidenceGuardPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1zkSummary: readJson(options.phase1zkPath),
    paths: options
  });
  const report = renderPhase1ZLReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
