#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zv-off.json';
const defaultOnPath = '/tmp/phase1zv-on.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zv-weak-hemi-cross-hemi-floor-taper-patch.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zv-weak-hemi-cross-hemi-floor-taper-patch.json'
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

function zonalDelta(offSample, onSample, targetLat, key) {
  const latitudesDeg = offSample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return null;
  const index = nearestIndex(latitudesDeg, targetLat);
  return round(
    (Number(onSample?.profiles?.series?.[key]?.[index]) || 0)
      - (Number(offSample?.profiles?.series?.[key]?.[index]) || 0)
  );
}

export function buildPhase1ZVWeakHemiCrossHemiFloorTaperPatch({ offAudit, onAudit, paths }) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const metrics = {
    itczWidthDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
    midlatitudeWesterliesNorthU10Ms: round((Number(on.midlatitudeWesterliesNorthU10Ms) || 0) - (Number(off.midlatitudeWesterliesNorthU10Ms) || 0)),
    crossEquatorialVaporFluxNorthKgM_1S: round((Number(on.crossEquatorialVaporFluxNorthKgM_1S) || 0) - (Number(off.crossEquatorialVaporFluxNorthKgM_1S) || 0)),
    tropicalShoulderLargeScaleCondensationMeanKgM2: round((Number(on.tropicalShoulderLargeScaleCondensationMeanKgM2) || 0) - (Number(off.tropicalShoulderLargeScaleCondensationMeanKgM2) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)),
    southTransitionSubtropicalCrossHemiFloorShareMeanFrac: round((Number(on.southTransitionSubtropicalCrossHemiFloorShareMeanFrac) || 0) - (Number(off.southTransitionSubtropicalCrossHemiFloorShareMeanFrac) || 0)),
    southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac: round((Number(on.southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac) || 0) - (Number(off.southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac) || 0)),
    southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac: round((Number(on.southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac) || 0) - (Number(off.southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac) || 0))
  };

  const condensationDeltas = {
    southSource11S: zonalDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2'),
    southEdge3S: zonalDelta(offSample, onSample, -3.75, 'largeScaleCondensationSourceKgM2'),
    northEdge3N: zonalDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    northSource11N: zonalDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    spillover18N: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    dryCore26N: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2')
  };

  const keepPatch = (metrics.itczWidthDeg ?? 0) < 0
    && (metrics.subtropicalDryNorthRatio ?? 0) < 0
    && (metrics.subtropicalDrySouthRatio ?? 0) <= 0
    && (metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? 0) < 0;

  return {
    schema: 'satellite-wars.phase1zv-weak-hemi-cross-hemi-floor-taper-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: keepPatch
      ? 'guardrail_improvement_with_north_source_rebound'
      : 'weak_hemi_floor_taper_not_keepable',
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZW: North Source Rebound Attribution'
      : 'Phase 1ZW: Weak-Hemi Floor Taper Outcome Attribution',
    recommendation: keepPatch
      ? 'Keep the weak-hemi floor taper lane available, but do not increase amplitude yet. The main guardrails improve, while a narrower north-source rebound remains to be attributed.'
      : 'Do not keep this floor taper as a default climate fix. Use the outcome attribution phase to explain why the taper shifts condensation into the wrong lane.',
    metrics,
    condensationDeltas,
    liveState: {
      southTransitionSubtropicalCrossHemiFloorShareMeanFrac: round(Number(on.southTransitionSubtropicalCrossHemiFloorShareMeanFrac) || 0),
      southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac: round(Number(on.southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac) || 0),
      southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac: round(Number(on.southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac) || 0),
      northTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac: round(Number(on.northTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac) || 0)
    }
  };
}

export function renderPhase1ZVReport(summary) {
  return `# Phase 1ZV Weak-Hemi Cross-Hemi Floor Taper Patch

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

## Weak-Hemi Floor Response

- south cross-hemi floor-share delta: \`${summary.metrics.southTransitionSubtropicalCrossHemiFloorShareMeanFrac}\`
- south weak-hemi overhang delta: \`${summary.metrics.southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac}\`
- south taper applied delta: \`${summary.metrics.southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac}\`
- live south taper mean: \`${summary.liveState.southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac}\`

## Lane Deltas

- -11.25° condensation delta: \`${summary.condensationDeltas.southSource11S}\`
- -3.75° condensation delta: \`${summary.condensationDeltas.southEdge3S}\`
- 3.75° condensation delta: \`${summary.condensationDeltas.northEdge3N}\`
- 11.25°N condensation delta: \`${summary.condensationDeltas.northSource11N}\`
- 18.75°N condensation delta: \`${summary.condensationDeltas.spillover18N}\`
- 26.25°N condensation delta: \`${summary.condensationDeltas.dryCore26N}\`
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
  const summary = buildPhase1ZVWeakHemiCrossHemiFloorTaperPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZVReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
