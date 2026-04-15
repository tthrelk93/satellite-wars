#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zze-off.json';
const defaultOnPath = '/tmp/phase1zze-on.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zze-atlantic-transition-carryover-containment-patch.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zze-atlantic-transition-carryover-containment-patch.json'
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

export function buildPhase1ZZEAtlanticTransitionCarryoverContainmentPatch({ offAudit, onAudit, paths }) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const metrics = {
    itczWidthDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round(
      (Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
      - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
    ),
    midlatitudeWesterliesNorthU10Ms: round(
      (Number(on.midlatitudeWesterliesNorthU10Ms) || 0)
      - (Number(off.midlatitudeWesterliesNorthU10Ms) || 0)
    )
  };

  const laneDeltas = {
    receiver26N: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    spillover18N: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    source11N: zonalDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    edge3N: zonalDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    southMirror11S: zonalDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2')
  };

  const liveState = {
    transitionContainment18N: zonalValue(onSample, 18.75, 'atlanticTransitionCarryoverContainmentDiagFrac'),
    transitionContainmentApplied18N: zonalValue(onSample, 18.75, 'atlanticTransitionCarryoverContainmentAppliedDiag'),
    importedPersistence18NDelta: zonalDelta(offSample, onSample, 18.75, 'importedAnvilPersistenceMassKgM2'),
    carryover18NDelta: zonalDelta(offSample, onSample, 18.75, 'carriedOverUpperCloudMassKgM2'),
    weakErosion18NDelta: zonalDelta(offSample, onSample, 18.75, 'weakErosionCloudSurvivalMassKgM2'),
    upperCloudPath18NDelta: zonalDelta(offSample, onSample, 18.75, 'upperCloudPathKgM2'),
    receiverTaper26N: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperDiagFrac'),
    receiverApplied26N: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperAppliedDiag')
  };

  const keepPatch = (liveState.transitionContainmentApplied18N ?? 0) > 0
    && (laneDeltas.receiver26N ?? 0) <= 0
    && (laneDeltas.spillover18N ?? 0) <= 0
    && (metrics.itczWidthDeg ?? 0) <= 0
    && (metrics.subtropicalDryNorthRatio ?? 0) <= 0
    && (metrics.subtropicalDrySouthRatio ?? 0) <= 0
    && (metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? 0) <= 0;

  return {
    schema: 'satellite-wars.phase1zze-atlantic-transition-carryover-containment-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: keepPatch
      ? 'atlantic_transition_carryover_containment_kept'
      : 'atlantic_transition_carryover_containment_with_residual_redistribution',
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZZF: Residual Post-Atlantic Transition Containment Attribution'
      : 'Phase 1ZZF: Transition Carryover Admission Attribution',
    recommendation: keepPatch
      ? 'Keep the Atlantic receiver bundle with transition carryover containment enabled and move to the residual attribution lane.'
      : 'Do not enable the Atlantic transition carryover containment bundle by default yet. The live 18.75N transition lane never actually admits the containment taper, so the next step is admission attribution rather than stronger amplitude tuning.',
    metrics,
    laneDeltas,
    liveState
  };
}

export function renderPhase1ZZEReport(summary) {
  return `# Phase 1ZZE Atlantic Transition Carryover Containment Patch

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

## Receiver Bundle Outcome

- receiver \`26.25°N\` condensation delta: \`${summary.laneDeltas.receiver26N}\`
- transition spillover \`18.75°N\` condensation delta: \`${summary.laneDeltas.spillover18N}\`
- north source \`11.25°N\` condensation delta: \`${summary.laneDeltas.source11N}\`
- edge \`3.75°N\` condensation delta: \`${summary.laneDeltas.edge3N}\`
- south mirror \`-11.25°\` condensation delta: \`${summary.laneDeltas.southMirror11S}\`

## Live Containment State

- \`18.75°N\` containment frac: \`${summary.liveState.transitionContainment18N}\`
- \`18.75°N\` containment applied: \`${summary.liveState.transitionContainmentApplied18N}\`
- \`18.75°N\` imported persistence delta: \`${summary.liveState.importedPersistence18NDelta}\`
- \`18.75°N\` carryover delta: \`${summary.liveState.carryover18NDelta}\`
- \`18.75°N\` weak-erosion survival delta: \`${summary.liveState.weakErosion18NDelta}\`
- \`18.75°N\` upper-cloud path delta: \`${summary.liveState.upperCloudPath18NDelta}\`
- \`26.25°N\` receiver taper frac on: \`${summary.liveState.receiverTaper26N}\`
- \`26.25°N\` receiver taper applied on: \`${summary.liveState.receiverApplied26N}\`
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
  const summary = buildPhase1ZZEAtlanticTransitionCarryoverContainmentPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZZEReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
