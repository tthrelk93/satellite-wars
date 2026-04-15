#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zzb-off.json';
const defaultOnPath = '/tmp/phase1zzb-on.json';
const defaultOffSectorPath = '/tmp/phase1zzb-off-nh-dry-belt-source-sector-summary.json';
const defaultOnSectorPath = '/tmp/phase1zzb-on-nh-dry-belt-source-sector-summary.json';
const defaultOffBirthPath = '/tmp/phase1zzb-off-vertical-cloud-birth-attribution.json';
const defaultOnBirthPath = '/tmp/phase1zzb-on-vertical-cloud-birth-attribution.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzc-atlantic-receiver-spillover-attribution.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzc-atlantic-receiver-spillover-attribution.json'
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

function nestedDelta(offRoot, onRoot, pathParts) {
  const get = (root) => pathParts.reduce((acc, key) => (acc && key in acc ? acc[key] : null), root);
  return round((Number(get(onRoot)) || 0) - (Number(get(offRoot)) || 0));
}

export function buildPhase1ZZCAtlanticReceiverSpilloverAttribution({
  offAudit,
  onAudit,
  offSectorSummary,
  onSectorSummary,
  offBirth,
  onBirth,
  paths
}) {
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
    )
  };

  const spillover18N = {
    condensationDelta: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    tcwDelta: zonalDelta(offSample, onSample, 18.75, 'totalColumnWaterKgM2'),
    lowerOmegaDelta: zonalDelta(offSample, onSample, 18.75, 'lowerTroposphericOmegaPaS'),
    midRhDelta: zonalDelta(offSample, onSample, 18.75, 'midTroposphericRhFrac'),
    surfaceEvapDelta: zonalDelta(offSample, onSample, 18.75, 'surfaceEvapRateMmHr'),
    northDryBeltOceanSourceDelta: zonalDelta(offSample, onSample, 18.75, 'sourceNorthDryBeltOceanKgM2'),
    tropicalNorthSourceDelta: zonalDelta(offSample, onSample, 18.75, 'sourceTropicalOceanNorthKgM2'),
    resolvedAscentBirthDelta: zonalDelta(offSample, onSample, 18.75, 'resolvedAscentCloudBirthPotentialKgM2'),
    importedAnvilPersistenceDelta: zonalDelta(offSample, onSample, 18.75, 'importedAnvilPersistenceMassKgM2'),
    carriedOverUpperCloudDelta: zonalDelta(offSample, onSample, 18.75, 'carriedOverUpperCloudMassKgM2'),
    weakErosionCloudSurvivalDelta: zonalDelta(offSample, onSample, 18.75, 'weakErosionCloudSurvivalMassKgM2'),
    upperCloudPathDelta: zonalDelta(offSample, onSample, 18.75, 'upperCloudPathKgM2'),
    cloudReevaporationDelta: zonalDelta(offSample, onSample, 18.75, 'cloudReevaporationMassKgM2'),
    precipReevaporationDelta: zonalDelta(offSample, onSample, 18.75, 'precipReevaporationMassKgM2')
  };

  const receiver26N = {
    condensationDelta: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    tcwDelta: zonalDelta(offSample, onSample, 26.25, 'totalColumnWaterKgM2'),
    lowerOmegaDelta: zonalDelta(offSample, onSample, 26.25, 'lowerTroposphericOmegaPaS'),
    midRhDelta: zonalDelta(offSample, onSample, 26.25, 'midTroposphericRhFrac'),
    taperDiagFrac: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperDiagFrac'),
    taperApplied: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperAppliedDiag')
  };

  const sectorDeltas = {
    atlanticCondensationDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'atlantic', 'largeScaleCondensationMeanKgM2']
    ),
    atlanticLowLevelSourceDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'atlantic', 'totalLowLevelSourceMeanKgM2']
    ),
    eastPacificCondensationDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'eastPacific', 'largeScaleCondensationMeanKgM2']
    ),
    indoPacificCondensationDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'indoPacific', 'largeScaleCondensationMeanKgM2']
    ),
    continentalCondensationDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'continentalSubtropics', 'largeScaleCondensationMeanKgM2']
    )
  };

  const atlanticBirthDeltas = {
    resolvedAscentCloudBirthDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'resolvedAscentCloudBirth']
    ),
    saturationAdjustmentCloudBirthDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'saturationAdjustmentCloudBirth']
    ),
    convectiveDetrainmentCloudBirthDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'convectiveDetrainmentCloudBirth']
    ),
    carryOverUpperCloudEnteringDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'carryOverUpperCloudEntering']
    ),
    carryOverUpperCloudSurvivingDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'carryOverUpperCloudSurviving']
    ),
    carrySurvivalFracDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltCarryOverSurvivalFrac']
    )
  };

  const verdict = 'atlantic_transition_carryover_spillover_without_source_recharge';
  const nextPhase = 'Phase 1ZZD: Atlantic Transition Carryover Containment Design';

  return {
    schema: 'satellite-wars.phase1zzc-atlantic-receiver-spillover-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    nextPhase,
    recommendation:
      'Do not retune Atlantic receiver geometry again. The spillover is not fresh low-level source recharge; it is transition-lane carryover and cloud-maintenance uptake around 18.75°N. The next patch should target Atlantic transition carryover containment while preserving the 26.25°N receiver relief.',
    metrics,
    spillover18N,
    receiver26N,
    sectorDeltas,
    atlanticBirthDeltas
  };
}

export function renderPhase1ZZCReport(summary) {
  return `# Phase 1ZZC Atlantic Receiver Spillover Attribution

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Main Guardrails

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- north dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`

## Spillover Lane \`18.75°N\`

- condensation delta: \`${summary.spillover18N.condensationDelta}\`
- total-column-water delta: \`${summary.spillover18N.tcwDelta}\`
- lower-omega delta: \`${summary.spillover18N.lowerOmegaDelta}\`
- mid-RH delta: \`${summary.spillover18N.midRhDelta}\`
- surface-evap delta: \`${summary.spillover18N.surfaceEvapDelta}\`
- north-dry-belt-ocean source delta: \`${summary.spillover18N.northDryBeltOceanSourceDelta}\`
- tropical-ocean-north source delta: \`${summary.spillover18N.tropicalNorthSourceDelta}\`
- resolved-ascent birth delta: \`${summary.spillover18N.resolvedAscentBirthDelta}\`
- imported-anvil persistence delta: \`${summary.spillover18N.importedAnvilPersistenceDelta}\`
- carried-over upper-cloud delta: \`${summary.spillover18N.carriedOverUpperCloudDelta}\`
- weak-erosion survival delta: \`${summary.spillover18N.weakErosionCloudSurvivalDelta}\`
- upper-cloud path delta: \`${summary.spillover18N.upperCloudPathDelta}\`
- cloud re-evaporation delta: \`${summary.spillover18N.cloudReevaporationDelta}\`
- precip re-evaporation delta: \`${summary.spillover18N.precipReevaporationDelta}\`

## Receiver Lane \`26.25°N\`

- condensation delta: \`${summary.receiver26N.condensationDelta}\`
- total-column-water delta: \`${summary.receiver26N.tcwDelta}\`
- lower-omega delta: \`${summary.receiver26N.lowerOmegaDelta}\`
- mid-RH delta: \`${summary.receiver26N.midRhDelta}\`
- taper frac on: \`${summary.receiver26N.taperDiagFrac}\`
- taper applied on: \`${summary.receiver26N.taperApplied}\`

## Sector / Channel Deltas

- Atlantic dry-belt condensation delta: \`${summary.sectorDeltas.atlanticCondensationDelta}\`
- Atlantic low-level-source delta: \`${summary.sectorDeltas.atlanticLowLevelSourceDelta}\`
- East Pacific dry-belt condensation delta: \`${summary.sectorDeltas.eastPacificCondensationDelta}\`
- Indo-Pacific dry-belt condensation delta: \`${summary.sectorDeltas.indoPacificCondensationDelta}\`
- continental dry-belt condensation delta: \`${summary.sectorDeltas.continentalCondensationDelta}\`

- Atlantic resolved-ascent birth delta: \`${summary.atlanticBirthDeltas.resolvedAscentCloudBirthDelta}\`
- Atlantic saturation-adjustment birth delta: \`${summary.atlanticBirthDeltas.saturationAdjustmentCloudBirthDelta}\`
- Atlantic convective-detrainment birth delta: \`${summary.atlanticBirthDeltas.convectiveDetrainmentCloudBirthDelta}\`
- Atlantic carry-entering delta: \`${summary.atlanticBirthDeltas.carryOverUpperCloudEnteringDelta}\`
- Atlantic carry-surviving delta: \`${summary.atlanticBirthDeltas.carryOverUpperCloudSurvivingDelta}\`
- carry-survival-frac delta: \`${summary.atlanticBirthDeltas.carrySurvivalFracDelta}\`
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    offSectorPath: defaultOffSectorPath,
    onSectorPath: defaultOnSectorPath,
    offBirthPath: defaultOffBirthPath,
    onBirthPath: defaultOnBirthPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--off-sector' && argv[i + 1]) options.offSectorPath = argv[++i];
    else if (arg.startsWith('--off-sector=')) options.offSectorPath = arg.slice('--off-sector='.length);
    else if (arg === '--on-sector' && argv[i + 1]) options.onSectorPath = argv[++i];
    else if (arg.startsWith('--on-sector=')) options.onSectorPath = arg.slice('--on-sector='.length);
    else if (arg === '--off-birth' && argv[i + 1]) options.offBirthPath = argv[++i];
    else if (arg.startsWith('--off-birth=')) options.offBirthPath = arg.slice('--off-birth='.length);
    else if (arg === '--on-birth' && argv[i + 1]) options.onBirthPath = argv[++i];
    else if (arg.startsWith('--on-birth=')) options.onBirthPath = arg.slice('--on-birth='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZZCAtlanticReceiverSpilloverAttribution({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    offSectorSummary: readJson(options.offSectorPath),
    onSectorSummary: readJson(options.onSectorPath),
    offBirth: readJson(options.offBirthPath),
    onBirth: readJson(options.onBirthPath),
    paths: options
  });
  const report = renderPhase1ZZCReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
