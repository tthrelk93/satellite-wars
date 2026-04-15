#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zy-off.json';
const defaultOnPath = '/tmp/phase1zy-on.json';
const defaultOffSectorPath = '/tmp/phase1zy-off-nh-dry-belt-source-sector-summary.json';
const defaultOnSectorPath = '/tmp/phase1zy-on-nh-dry-belt-source-sector-summary.json';
const defaultOffBirthPath = '/tmp/phase1zy-off-vertical-cloud-birth-attribution.json';
const defaultOnBirthPath = '/tmp/phase1zy-on-vertical-cloud-birth-attribution.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zza-atlantic-dry-core-receiver-design.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zza-atlantic-dry-core-receiver-design.json'
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

function metricDelta(offMetrics, onMetrics, key) {
  return round((Number(onMetrics?.[key]) || 0) - (Number(offMetrics?.[key]) || 0));
}

function sectorDelta(offSectorSummary, onSectorSummary, sectorKey, metric) {
  return round(
    (Number(onSectorSummary?.[sectorKey]?.[metric]) || 0)
      - (Number(offSectorSummary?.[sectorKey]?.[metric]) || 0)
  );
}

function channelDelta(offBirth, onBirth, sectorKey, channelKey) {
  return round(
    (Number(onBirth?.northDryBeltSectorChannelMeansKgM2?.[sectorKey]?.[channelKey]) || 0)
      - (Number(offBirth?.northDryBeltSectorChannelMeansKgM2?.[sectorKey]?.[channelKey]) || 0)
  );
}

export function buildPhase1ZZAAtlanticDryCoreReceiverDesign({
  offAudit,
  onAudit,
  offSectorSummary,
  onSectorSummary,
  offBirthAttribution,
  onBirthAttribution,
  paths
}) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const offMetrics = offSample?.metrics || {};
  const onMetrics = onSample?.metrics || {};

  const guardrails = {
    itczWidthDeg: metricDelta(offMetrics, onMetrics, 'itczWidthDeg'),
    subtropicalDryNorthRatio: metricDelta(offMetrics, onMetrics, 'subtropicalDryNorthRatio'),
    subtropicalDrySouthRatio: metricDelta(offMetrics, onMetrics, 'subtropicalDrySouthRatio'),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: metricDelta(offMetrics, onMetrics, 'northDryBeltOceanLargeScaleCondensationMeanKgM2')
  };

  const zonalReceiverSignature = {
    northSource11NCondensation: zonalDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    northSource11NTotalColumnWater: zonalDelta(offSample, onSample, 11.25, 'totalColumnWaterKgM2'),
    northSource11NLowerOmega: zonalDelta(offSample, onSample, 11.25, 'lowerTroposphericOmegaPaS'),
    atlanticDryCore26NCondensation: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    atlanticDryCore26NTotalColumnWater: zonalDelta(offSample, onSample, 26.25, 'totalColumnWaterKgM2'),
    atlanticDryCore26NLowerOmega: zonalDelta(offSample, onSample, 26.25, 'lowerTroposphericOmegaPaS'),
    atlanticDryCore26NMidRh: zonalDelta(offSample, onSample, 26.25, 'midTroposphericRhFrac'),
    equatorialEdge3NCondensation: zonalDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    southMirror11SCondensation: zonalDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2')
  };

  const sectorSignature = {
    atlanticLowLevelSource: sectorDelta(offSectorSummary, onSectorSummary, 'atlantic', 'totalLowLevelSourceMeanKgM2'),
    atlanticCondensation: sectorDelta(offSectorSummary, onSectorSummary, 'atlantic', 'largeScaleCondensationMeanKgM2'),
    eastPacificCondensation: sectorDelta(offSectorSummary, onSectorSummary, 'eastPacific', 'largeScaleCondensationMeanKgM2'),
    continentalCondensation: sectorDelta(offSectorSummary, onSectorSummary, 'continentalSubtropics', 'largeScaleCondensationMeanKgM2'),
    indoPacificCondensation: sectorDelta(offSectorSummary, onSectorSummary, 'indoPacific', 'largeScaleCondensationMeanKgM2')
  };

  const birthSignature = {
    atlanticCarryEntering: channelDelta(offBirthAttribution, onBirthAttribution, 'atlantic', 'carryOverUpperCloudEntering'),
    atlanticCarrySurviving: channelDelta(offBirthAttribution, onBirthAttribution, 'atlantic', 'carryOverUpperCloudSurviving'),
    atlanticSaturationAdjustmentBirth: channelDelta(offBirthAttribution, onBirthAttribution, 'atlantic', 'saturationAdjustmentCloudBirth'),
    atlanticResolvedAscentBirth: channelDelta(offBirthAttribution, onBirthAttribution, 'atlantic', 'resolvedAscentCloudBirth'),
    atlanticConvectiveDetrainmentBirth: channelDelta(offBirthAttribution, onBirthAttribution, 'atlantic', 'convectiveDetrainmentCloudBirth')
  };

  return {
    schema: 'satellite-wars.phase1zza-atlantic-dry-core-receiver-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'atlantic_receiver_efficiency_without_birth_or_import_growth',
    keepPatch: false,
    nextPhase: 'Phase 1ZZB: Implement Atlantic Receiver Efficiency Taper Patch',
    recommendation: 'Do not strengthen the north-source cap. Add a basin-aware Atlantic dry-core receiver taper in vertical5/core5, ocean-only and centered on the poleward half of the 20–30°N lane, keyed off the already-live north leak signal while leaving 11.25°N relief intact.',
    designContract: {
      basinWindow: 'Atlantic ocean sector, lonDeg >= -90 && lonDeg < 20, land excluded',
      latitudeWindow: 'Poleward half of the dry-core receiver lane, centered near 22–30°N with taper outside it',
      activationCarrier: 'Reuse the existing live northside leak signal / source-cap activity rather than introducing a new independent source switch',
      targetMechanism: 'Receiver efficiency / uptake taper under dry-core condensation concentration, not source strengthening, local humidity recharge, or import ablation',
      antiPatterns: [
        'Do not increase the north-source cap amplitude first',
        'Do not blunt Atlantic carryover or saturation-adjustment birth globally',
        'Do not add a new local humidity or omega boost at 11.25°N'
      ]
    },
    guardrails,
    zonalReceiverSignature,
    sectorSignature,
    birthSignature
  };
}

export function renderPhase1ZZAReport(summary) {
  return `# Phase 1ZZA Atlantic Dry-Core Receiver Design

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why This Is A Receiver Problem

- 11.25°N source relief is real: condensation \`${summary.zonalReceiverSignature.northSource11NCondensation}\`, TCW \`${summary.zonalReceiverSignature.northSource11NTotalColumnWater}\`, lower-omega \`${summary.zonalReceiverSignature.northSource11NLowerOmega}\`
- 26.25°N dry-core uptake still rises: condensation \`${summary.zonalReceiverSignature.atlanticDryCore26NCondensation}\`, TCW \`${summary.zonalReceiverSignature.atlanticDryCore26NTotalColumnWater}\`, lower-omega \`${summary.zonalReceiverSignature.atlanticDryCore26NLowerOmega}\`, mid-RH \`${summary.zonalReceiverSignature.atlanticDryCore26NMidRh}\`
- Atlantic sector dominates the failed receiver lane: condensation \`${summary.sectorSignature.atlanticCondensation}\` versus east Pacific \`${summary.sectorSignature.eastPacificCondensation}\`, continental \`${summary.sectorSignature.continentalCondensation}\`, Indo-Pacific \`${summary.sectorSignature.indoPacificCondensation}\`

## Why This Is Not An Upstream Birth/Import Growth Problem

- Atlantic low-level source delta: \`${summary.sectorSignature.atlanticLowLevelSource}\`
- Atlantic carry entering delta: \`${summary.birthSignature.atlanticCarryEntering}\`
- Atlantic carry surviving delta: \`${summary.birthSignature.atlanticCarrySurviving}\`
- Atlantic saturation-adjustment birth delta: \`${summary.birthSignature.atlanticSaturationAdjustmentBirth}\`
- Atlantic resolved-ascent birth delta: \`${summary.birthSignature.atlanticResolvedAscentBirth}\`
- Atlantic convective detrainment birth delta: \`${summary.birthSignature.atlanticConvectiveDetrainmentBirth}\`

## Design Contract

- Basin window: \`${summary.designContract.basinWindow}\`
- Latitude window: \`${summary.designContract.latitudeWindow}\`
- Activation carrier: \`${summary.designContract.activationCarrier}\`
- Target mechanism: \`${summary.designContract.targetMechanism}\`
- Anti-patterns:
  - \`${summary.designContract.antiPatterns[0]}\`
  - \`${summary.designContract.antiPatterns[1]}\`
  - \`${summary.designContract.antiPatterns[2]}\`

## Guardrails Context

- itcz width delta: \`${summary.guardrails.itczWidthDeg}\`
- dry north delta: \`${summary.guardrails.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.guardrails.subtropicalDrySouthRatio}\`
- NH dry-belt ocean condensation delta: \`${summary.guardrails.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`
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
  const summary = buildPhase1ZZAAtlanticDryCoreReceiverDesign({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    offSectorSummary: readJson(options.offSectorPath).nhDryBeltSectorSummary,
    onSectorSummary: readJson(options.onSectorPath).nhDryBeltSectorSummary,
    offBirthAttribution: readJson(options.offBirthPath).attribution,
    onBirthAttribution: readJson(options.onBirthPath).attribution,
    paths: options
  });
  const report = renderPhase1ZZAReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
