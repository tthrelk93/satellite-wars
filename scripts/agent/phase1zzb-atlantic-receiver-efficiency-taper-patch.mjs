#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zzb-off.json';
const defaultOnPath = '/tmp/phase1zzb-on.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzb-atlantic-receiver-efficiency-taper-patch.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzb-atlantic-receiver-efficiency-taper-patch.json'
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

export function buildPhase1ZZBAtlanticReceiverEfficiencyTaperPatch({ offAudit, onAudit, paths }) {
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
    atlanticReceiver26N: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    spillover18N: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    source11N: zonalDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    edge3N: zonalDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    southSource11S: zonalDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2')
  };

  const liveState = {
    atlanticReceiverTaper26N: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperDiagFrac'),
    atlanticReceiverApplied26N: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperAppliedDiag'),
    tcw26NDelta: zonalDelta(offSample, onSample, 26.25, 'totalColumnWaterKgM2'),
    lowerOmega26NDelta: zonalDelta(offSample, onSample, 26.25, 'lowerTroposphericOmegaPaS'),
    midRh26NDelta: zonalDelta(offSample, onSample, 26.25, 'midTroposphericRhFrac'),
    tcw18NDelta: zonalDelta(offSample, onSample, 18.75, 'totalColumnWaterKgM2'),
    lowerOmega18NDelta: zonalDelta(offSample, onSample, 18.75, 'lowerTroposphericOmegaPaS'),
    midRh18NDelta: zonalDelta(offSample, onSample, 18.75, 'midTroposphericRhFrac')
  };

  const keepPatch = (laneDeltas.atlanticReceiver26N ?? 0) < 0
    && (laneDeltas.spillover18N ?? 0) <= 0
    && (laneDeltas.source11N ?? 0) <= 0
    && (metrics.itczWidthDeg ?? 0) <= 0
    && (metrics.subtropicalDryNorthRatio ?? 0) <= 0
    && (metrics.subtropicalDrySouthRatio ?? 0) <= 0
    && (metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? 0) <= 0;

  return {
    schema: 'satellite-wars.phase1zzb-atlantic-receiver-efficiency-taper-patch.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: keepPatch
      ? 'atlantic_receiver_relief_kept'
      : 'atlantic_receiver_relief_with_transition_spillover',
    keepPatch,
    nextPhase: keepPatch
      ? 'Phase 1ZZC: Residual Post-Receiver Attribution'
      : 'Phase 1ZZC: Atlantic Receiver Spillover Attribution',
    recommendation: keepPatch
      ? 'Keep the Atlantic receiver taper available and move on to the residual attribution lane.'
      : 'Do not enable the Atlantic receiver taper by default. It relieves the Atlantic-facing 26.25°N dry-core receiver, but the improvement is reabsorbed into 18.75°N spillover and the climate guardrails get slightly worse.',
    metrics,
    laneDeltas,
    liveState
  };
}

export function renderPhase1ZZBReport(summary) {
  return `# Phase 1ZZB Atlantic Receiver Efficiency Taper Patch

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

## Receiver-Lane Outcome

- Atlantic dry-core receiver \`26.25°N\` condensation delta: \`${summary.laneDeltas.atlanticReceiver26N}\`
- transition spillover \`18.75°N\` condensation delta: \`${summary.laneDeltas.spillover18N}\`
- north source \`11.25°N\` condensation delta: \`${summary.laneDeltas.source11N}\`
- edge \`3.75°N\` condensation delta: \`${summary.laneDeltas.edge3N}\`
- south source \`-11.25°\` condensation delta: \`${summary.laneDeltas.southSource11S}\`

## Live Taper State

- \`26.25°N\` taper frac: \`${summary.liveState.atlanticReceiverTaper26N}\`
- \`26.25°N\` applied taper: \`${summary.liveState.atlanticReceiverApplied26N}\`
- \`26.25°N\` total-column-water delta: \`${summary.liveState.tcw26NDelta}\`
- \`26.25°N\` lower-omega delta: \`${summary.liveState.lowerOmega26NDelta}\`
- \`26.25°N\` mid-RH delta: \`${summary.liveState.midRh26NDelta}\`
- \`18.75°N\` total-column-water delta: \`${summary.liveState.tcw18NDelta}\`
- \`18.75°N\` lower-omega delta: \`${summary.liveState.lowerOmega18NDelta}\`
- \`18.75°N\` mid-RH delta: \`${summary.liveState.midRh18NDelta}\`
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
  const summary = buildPhase1ZZBAtlanticReceiverEfficiencyTaperPatch({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZZBReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
