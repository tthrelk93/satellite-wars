#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zs-off.json';
const defaultOnPath = '/tmp/phase1zs-on.json';
const defaultPhase1ZRPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zr-northside-leak-penalty-admission-attribution.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zs-northside-leak-risk-gate-redesign.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zs-northside-leak-risk-gate-redesign.json');

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
    equatorialEdgeNorthsideLeakPenaltyDiagFrac: round(get('equatorialEdgeNorthsideLeakPenaltyDiagFrac')),
    equatorialEdgeNorthsideLeakSourceWindowDiagFrac: round(get('equatorialEdgeNorthsideLeakSourceWindowDiagFrac')),
    equatorialEdgeNorthsideLeakRiskDiagFrac: round(get('equatorialEdgeNorthsideLeakRiskDiagFrac')),
    equatorialEdgeSubsidenceGuardAppliedDiagPaS: round(get('equatorialEdgeSubsidenceGuardAppliedDiagPaS'))
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

export function buildPhase1ZSNorthsideLeakRiskGateRedesign({ offAudit, onAudit, phase1zrSummary, paths }) {
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
  const southSource = { off: snapshot(offSample, -11.25), on: snapshot(onSample, -11.25) };
  southSource.delta = deltaSlice(southSource.on, southSource.off);

  const metrics = {
    itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)),
    midlatitudeWesterliesNorthU10Ms: round((Number(onMetrics.midlatitudeWesterliesNorthU10Ms) || 0) - (Number(offMetrics.midlatitudeWesterliesNorthU10Ms) || 0))
  };

  return {
    schema: 'satellite-wars.phase1zs-northside-leak-risk-gate-redesign.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'northside_gate_live_with_south_mirror_regression',
    keepPatch: false,
    nextPhase: 'Phase 1ZT: South Mirror Rebound Attribution',
    recommendation: 'Keep the redesigned northside leak gate available behind the runtime toggle, but do not enable it by default. It successfully activates the NH source lane and reduces the north fanout path, but the full 30-day climate screen regresses through a south-mirror rebound.',
    phase1zrContext: {
      verdict: phase1zrSummary?.verdict ?? null,
      nextPhase: phase1zrSummary?.nextPhase ?? null
    },
    metrics,
    slices: {
      northEdge,
      northSource,
      northSpillover,
      northDryBeltCore,
      southEdge,
      southSource
    },
    designContract: {
      keep: [
        'keep the supported-source-normalized northside leak gate logic available behind the patch toggle',
        'keep the bilateral equatorial-edge subsidence guard geometry and south-edge stabilization plumbing'
      ],
      change: [
        'attribute why the improved NH source suppression is paired with a south-mirror rebound at -3.75° and -11.25°',
        'treat the next problem as a bilateral balance / cross-equatorial compensation problem, not another northside admission miss'
      ]
    }
  };
}

export function renderPhase1ZSReport(summary) {
  return `# Phase 1ZS Northside Leak Risk Gate Redesign

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## What Improved

- 11.25°N source condensation delta: \`${summary.slices.northSource.delta.largeScaleCondensationSourceKgM2}\`
- 18.75°N spillover condensation delta: \`${summary.slices.northSpillover.delta.largeScaleCondensationSourceKgM2}\`
- 3.75°N edge condensation delta: \`${summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2}\`
- 11.25°N leak penalty on: \`${summary.slices.northSource.on.equatorialEdgeNorthsideLeakPenaltyDiagFrac}\`

## Why It Still Fails The Climate Gate

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- NH westerlies delta: \`${summary.metrics.midlatitudeWesterliesNorthU10Ms}\`
- south edge condensation delta: \`${summary.slices.southEdge.delta.largeScaleCondensationSourceKgM2}\`
- south source condensation delta: \`${summary.slices.southSource.delta.largeScaleCondensationSourceKgM2}\`

## Next Step

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1zrPath: defaultPhase1ZRPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zr' && argv[i + 1]) options.phase1zrPath = argv[++i];
    else if (arg.startsWith('--phase1zr=')) options.phase1zrPath = arg.slice('--phase1zr='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZSNorthsideLeakRiskGateRedesign({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1zrSummary: readJson(options.phase1zrPath),
    paths: options
  });
  const report = renderPhase1ZSReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
