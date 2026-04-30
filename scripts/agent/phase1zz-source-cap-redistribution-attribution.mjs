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
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zz-source-cap-redistribution-attribution.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zz-source-cap-redistribution-attribution.json'
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

function sectorDelta(offSectorSummary, onSectorSummary, sectorKey, metric) {
  return round(
    (Number(onSectorSummary?.[sectorKey]?.[metric]) || 0)
      - (Number(offSectorSummary?.[sectorKey]?.[metric]) || 0)
  );
}

export function buildPhase1ZZSourceCapRedistributionAttribution({
  offAudit,
  onAudit,
  offSectorSummary,
  onSectorSummary,
  paths
}) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const guardrails = {
    itczWidthDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round((Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0) - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)),
    crossEquatorialVaporFluxNorthKgM_1S: round((Number(on.crossEquatorialVaporFluxNorthKgM_1S) || 0) - (Number(off.crossEquatorialVaporFluxNorthKgM_1S) || 0))
  };

  const zonalDeltas = {
    source11NCondensation: zonalDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    source11NTotalColumnWater: zonalDelta(offSample, onSample, 11.25, 'totalColumnWaterKgM2'),
    source11NLowerOmega: zonalDelta(offSample, onSample, 11.25, 'lowerTroposphericOmegaPaS'),
    spillover18NCondensation: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    dryCore26NCondensation: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    dryCore26NTotalColumnWater: zonalDelta(offSample, onSample, 26.25, 'totalColumnWaterKgM2'),
    dryCore26NLowerOmega: zonalDelta(offSample, onSample, 26.25, 'lowerTroposphericOmegaPaS'),
    edge3NCondensation: zonalDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    southSource11SCondensation: zonalDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2'),
    southSource11STotalColumnWater: zonalDelta(offSample, onSample, -11.25, 'totalColumnWaterKgM2'),
    southSource11SLowerOmega: zonalDelta(offSample, onSample, -11.25, 'lowerTroposphericOmegaPaS')
  };

  const sectorDeltas = {
    continentalSubtropics: {
      totalLowLevelSourceMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'continentalSubtropics', 'totalLowLevelSourceMeanKgM2'),
      largeScaleCondensationMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'continentalSubtropics', 'largeScaleCondensationMeanKgM2')
    },
    eastPacific: {
      totalLowLevelSourceMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'eastPacific', 'totalLowLevelSourceMeanKgM2'),
      largeScaleCondensationMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'eastPacific', 'largeScaleCondensationMeanKgM2')
    },
    atlantic: {
      totalLowLevelSourceMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'atlantic', 'totalLowLevelSourceMeanKgM2'),
      largeScaleCondensationMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'atlantic', 'largeScaleCondensationMeanKgM2')
    },
    indoPacific: {
      totalLowLevelSourceMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'indoPacific', 'totalLowLevelSourceMeanKgM2'),
      largeScaleCondensationMeanKgM2: sectorDelta(offSectorSummary, onSectorSummary, 'indoPacific', 'largeScaleCondensationMeanKgM2')
    }
  };

  const dominantNorthReceiver = Object.entries(sectorDeltas)
    .map(([key, value]) => ({ key, condensationDelta: value.largeScaleCondensationMeanKgM2 }))
    .sort((a, b) => Math.abs(b.condensationDelta || 0) - Math.abs(a.condensationDelta || 0))[0];

  const verdict = 'atlantic_dry_core_redistribution_with_secondary_south_mirror';

  return {
    schema: 'satellite-wars.phase1zz-source-cap-redistribution-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    keepPatch: false,
    nextPhase: 'Phase 1ZZA: Atlantic Dry-Core Receiver Design',
    recommendation: 'Do not strengthen the north-source cap itself. The next patch should target the dry-core receiver lane, especially the Atlantic-facing 20–30°N uptake branch, while keeping the 11.25°N relief that 1ZY already achieved.',
    guardrails,
    zonalDeltas,
    sectorDeltas,
    dominantNorthReceiver
  };
}

export function renderPhase1ZZReport(summary) {
  return `# Phase 1ZZ Source-Cap Redistribution Attribution

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Main Guardrails

- itcz width delta: \`${summary.guardrails.itczWidthDeg}\`
- dry north delta: \`${summary.guardrails.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.guardrails.subtropicalDrySouthRatio}\`
- north dry-belt ocean condensation delta: \`${summary.guardrails.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`
- cross-equatorial vapor-flux delta: \`${summary.guardrails.crossEquatorialVaporFluxNorthKgM_1S}\`

## Zonal Redistribution

- 11.25°N condensation delta: \`${summary.zonalDeltas.source11NCondensation}\`
- 11.25°N total-column-water delta: \`${summary.zonalDeltas.source11NTotalColumnWater}\`
- 11.25°N lower-omega delta: \`${summary.zonalDeltas.source11NLowerOmega}\`
- 18.75°N condensation delta: \`${summary.zonalDeltas.spillover18NCondensation}\`
- 26.25°N condensation delta: \`${summary.zonalDeltas.dryCore26NCondensation}\`
- 26.25°N total-column-water delta: \`${summary.zonalDeltas.dryCore26NTotalColumnWater}\`
- 26.25°N lower-omega delta: \`${summary.zonalDeltas.dryCore26NLowerOmega}\`
- 3.75°N condensation delta: \`${summary.zonalDeltas.edge3NCondensation}\`
- -11.25° condensation delta: \`${summary.zonalDeltas.southSource11SCondensation}\`
- -11.25° total-column-water delta: \`${summary.zonalDeltas.southSource11STotalColumnWater}\`
- -11.25° lower-omega delta: \`${summary.zonalDeltas.southSource11SLowerOmega}\`

## NH Dry-Belt Sector Split

- dominant receiver: \`${summary.dominantNorthReceiver.key}\`
- continental subtropics condensation delta: \`${summary.sectorDeltas.continentalSubtropics.largeScaleCondensationMeanKgM2}\`
- east Pacific condensation delta: \`${summary.sectorDeltas.eastPacific.largeScaleCondensationMeanKgM2}\`
- Atlantic condensation delta: \`${summary.sectorDeltas.atlantic.largeScaleCondensationMeanKgM2}\`
- Indo-Pacific condensation delta: \`${summary.sectorDeltas.indoPacific.largeScaleCondensationMeanKgM2}\`
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    offSectorPath: defaultOffSectorPath,
    onSectorPath: defaultOnSectorPath,
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
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZZSourceCapRedistributionAttribution({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    offSectorSummary: readJson(options.offSectorPath).nhDryBeltSectorSummary,
    onSectorSummary: readJson(options.onSectorPath).nhDryBeltSectorSummary,
    paths: options
  });
  const report = renderPhase1ZZReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
