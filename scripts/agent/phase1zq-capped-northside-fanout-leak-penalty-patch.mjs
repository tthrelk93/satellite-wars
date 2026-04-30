#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zq-off.json';
const defaultOnPath = '/tmp/phase1zq-on.json';
const defaultPhase1ZPPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zp-northside-fanout-containment-design.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zq-capped-northside-fanout-leak-penalty-patch.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zq-capped-northside-fanout-leak-penalty-patch.json');

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
    equatorialEdgeSubsidenceGuardAppliedDiagPaS: round(get('equatorialEdgeSubsidenceGuardAppliedDiagPaS')),
    equatorialEdgeNorthsideLeakPenaltyDiagFrac: round(get('equatorialEdgeNorthsideLeakPenaltyDiagFrac')),
    equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: round(get('equatorialEdgeSubsidenceGuardSourceSupportDiagFrac')),
    equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: round(get('equatorialEdgeSubsidenceGuardTargetWeightDiagFrac')),
    totalColumnWaterKgM2: round(get('totalColumnWaterKgM2')),
    boundaryLayerRhFrac: round(get('boundaryLayerRhFrac')),
    lowerTroposphericOmegaPaS: round(get('lowerTroposphericOmegaPaS'))
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

export function buildPhase1ZQCappedNorthsideFanoutLeakPenaltyPatch({ offAudit, onAudit, phase1zpSummary, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const northEdge = { off: snapshot(offSample, 3.75), on: snapshot(onSample, 3.75) };
  northEdge.delta = deltaSlice(northEdge.on, northEdge.off);
  const northSource = { off: snapshot(offSample, 11.25), on: snapshot(onSample, 11.25) };
  northSource.delta = deltaSlice(northSource.on, northSource.off);
  const northSpillover = { off: snapshot(offSample, 18.75), on: snapshot(onSample, 18.75) };
  northSpillover.delta = deltaSlice(northSpillover.on, northSpillover.off);
  const northDryBeltCore = { off: snapshot(offSample, 26.25), on: snapshot(onSample, 26.25) };
  northDryBeltCore.delta = deltaSlice(northDryBeltCore.on, northDryBeltCore.off);
  const southEdge = { off: snapshot(offSample, -3.75), on: snapshot(onSample, -3.75) };
  southEdge.delta = deltaSlice(southEdge.on, southEdge.off);

  const metrics = {
    itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)),
    midlatitudeWesterliesNorthU10Ms: round((Number(onMetrics.midlatitudeWesterliesNorthU10Ms) || 0) - (Number(offMetrics.midlatitudeWesterliesNorthU10Ms) || 0))
  };

  const verdict = 'northside_leak_penalty_inert_zero_live_admission';
  const keepPatch = false;

  return {
    schema: 'satellite-wars.phase1zq-capped-northside-fanout-leak-penalty-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    keepPatch,
    nextPhase: 'Phase 1ZR: Northside Leak Penalty Admission Attribution',
    recommendation: 'Keep the 1ZQ plumbing and diagnostics, but leave the leak-penalty disabled by default. The live 11.25°N source lane keeps positive equatorial-edge source support while the new penalty stays at zero, so the next step is admission attribution rather than amplitude tuning.',
    phase1zpContext: {
      verdict: phase1zpSummary?.verdict ?? null,
      preferredLane: phase1zpSummary?.ranking?.[0]?.key ?? null
    },
    metrics,
    slices: {
      northEdge,
      northSource,
      northSpillover,
      northDryBeltCore,
      southEdge
    },
    designContract: {
      keep: [
        'keep the bilateral abs-lat equatorial-edge guard geometry',
        'keep the south-edge stabilization and the NH target-entry exclusion untouched',
        'keep the northside leak-penalty plumbing and diagnostics available behind a toggle'
      ],
      change: [
        'attribute why the 11.25°N source lane never admits a non-zero leak penalty in the real 30-day branch state',
        'treat the remaining miss as an admission/selector threshold problem, not a global amplitude problem'
      ]
    }
  };
}

export function renderPhase1ZQReport(summary) {
  return `# Phase 1ZQ Capped Northside Fanout Leak Penalty Patch

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Live 30-Day Compare

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- NH dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`
- NH westerlies delta: \`${summary.metrics.midlatitudeWesterliesNorthU10Ms}\`

## Why This Failed

- 11.25°N source support on: \`${summary.slices.northSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- 11.25°N leak penalty on: \`${summary.slices.northSource.on.equatorialEdgeNorthsideLeakPenaltyDiagFrac}\`
- 3.75°N condensation delta: \`${summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2}\`
- 18.75°N condensation delta: \`${summary.slices.northSpillover.delta.largeScaleCondensationSourceKgM2}\`
- 26.25°N condensation delta: \`${summary.slices.northDryBeltCore.delta.largeScaleCondensationSourceKgM2}\`
- -3.75° condensation delta: \`${summary.slices.southEdge.delta.largeScaleCondensationSourceKgM2}\`

## Next Step

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1zpPath: defaultPhase1ZPPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zp' && argv[i + 1]) options.phase1zpPath = argv[++i];
    else if (arg.startsWith('--phase1zp=')) options.phase1zpPath = arg.slice('--phase1zp='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZQCappedNorthsideFanoutLeakPenaltyPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1zpSummary: readJson(options.phase1zpPath),
    paths: options
  });
  const report = renderPhase1ZQReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
