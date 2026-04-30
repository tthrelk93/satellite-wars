#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zy-off.json';
const defaultOnPath = '/tmp/phase1zy-on.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zy-capped-north-source-concentration-penalty-patch.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zy-capped-north-source-concentration-penalty-patch.json'
);

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function zonalValue(sample, targetLat, key) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return null;
  const index = nearestIndex(latitudesDeg, targetLat);
  return round(Number(sample?.profiles?.series?.[key]?.[index]) || 0);
}

function zonalDelta(offSample, onSample, targetLat, key) {
  const offValue = zonalValue(offSample, targetLat, key);
  const onValue = zonalValue(onSample, targetLat, key);
  return round((onValue || 0) - (offValue || 0));
}

export function buildPhase1ZYCappedNorthSourceConcentrationPenaltyPatch({ offAudit, onAudit, paths }) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const metrics = {
    itczWidthDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)),
    midlatitudeWesterliesNorthU10Ms: round((Number(on.midlatitudeWesterliesNorthU10Ms) || 0) - (Number(off.midlatitudeWesterliesNorthU10Ms) || 0)),
    crossEquatorialVaporFluxNorthKgM_1S: round((Number(on.crossEquatorialVaporFluxNorthKgM_1S) || 0) - (Number(off.crossEquatorialVaporFluxNorthKgM_1S) || 0))
  };

  const sourceLaneDeltas = {
    dryCore26N: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    spillover18N: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    source11N: zonalDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    edge3N: zonalDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    edge3S: zonalDelta(offSample, onSample, -3.75, 'largeScaleCondensationSourceKgM2'),
    source11S: zonalDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2')
  };

  const liveState = {
    northSourcePenalty11N: zonalValue(onSample, 11.25, 'northSourceConcentrationPenaltyDiagFrac'),
    northSourceApplied11N: zonalValue(onSample, 11.25, 'northSourceConcentrationAppliedDiag'),
    northLeakPenalty11N: zonalValue(onSample, 11.25, 'equatorialEdgeNorthsideLeakPenaltyDiagFrac'),
    totalColumnWater11NDelta: zonalDelta(offSample, onSample, 11.25, 'totalColumnWaterKgM2'),
    lowerOmega11NDelta: zonalDelta(offSample, onSample, 11.25, 'lowerTroposphericOmegaPaS'),
    midOmega11NDelta: zonalDelta(offSample, onSample, 11.25, 'midTroposphericOmegaPaS')
  };

  const keepPatch = (sourceLaneDeltas.source11N ?? 0) < 0
    && (sourceLaneDeltas.spillover18N ?? 0) <= 0
    && (sourceLaneDeltas.dryCore26N ?? 0) <= 0
    && (metrics.itczWidthDeg ?? 0) <= 0
    && (metrics.subtropicalDryNorthRatio ?? 0) <= 0
    && (metrics.subtropicalDrySouthRatio ?? 0) <= 0
    && (metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? 0) <= 0;

  return {
    schema: 'satellite-wars.phase1zy-capped-north-source-concentration-penalty-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: keepPatch
      ? 'north_source_concentration_relief_kept'
      : 'north_source_relief_with_dry_core_redistribution',
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZZ: Residual Post-Cap Attribution'
      : 'Phase 1ZZ: Source-Cap Redistribution Attribution',
    recommendation: keepPatch
      ? 'Keep the capped north-source concentration penalty available and move on to the residual attribution phase.'
      : 'Do not enable this penalty by default. It improves the 11.25°N source row, but the improvement is redistributed into the dry-belt core and south mirror rather than closing the climate lane cleanly.',
    metrics,
    sourceLaneDeltas,
    liveState
  };
}

export function renderPhase1ZYReport(summary) {
  return `# Phase 1ZY Capped North Source Concentration Penalty Patch

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Main Guardrails

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- NH westerlies delta: \`${summary.metrics.midlatitudeWesterliesNorthU10Ms}\`
- north dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`
- cross-equatorial vapor-flux delta: \`${summary.metrics.crossEquatorialVaporFluxNorthKgM_1S}\`

## Source-Lane Outcome

- 11.25°N source condensation delta: \`${summary.sourceLaneDeltas.source11N}\`
- 18.75°N spillover condensation delta: \`${summary.sourceLaneDeltas.spillover18N}\`
- 26.25°N dry-core condensation delta: \`${summary.sourceLaneDeltas.dryCore26N}\`
- 3.75°N edge condensation delta: \`${summary.sourceLaneDeltas.edge3N}\`
- -3.75° edge condensation delta: \`${summary.sourceLaneDeltas.edge3S}\`
- -11.25° source condensation delta: \`${summary.sourceLaneDeltas.source11S}\`

## Live Penalty State

- 11.25°N concentration penalty frac: \`${summary.liveState.northSourcePenalty11N}\`
- 11.25°N concentration applied: \`${summary.liveState.northSourceApplied11N}\`
- 11.25°N upstream leak penalty frac: \`${summary.liveState.northLeakPenalty11N}\`
- 11.25°N total-column-water delta: \`${summary.liveState.totalColumnWater11NDelta}\`
- 11.25°N lower-omega delta: \`${summary.liveState.lowerOmega11NDelta}\`
- 11.25°N mid-omega delta: \`${summary.liveState.midOmega11NDelta}\`
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZYCappedNorthSourceConcentrationPenaltyPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZYReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
