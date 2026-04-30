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
  'phase1zw-north-source-rebound-attribution.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zw-north-source-rebound-attribution.json'
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

function seriesValue(sample, lat, key) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  const index = nearestIndex(latitudesDeg, lat);
  return Number(sample?.profiles?.series?.[key]?.[index]) || 0;
}

function seriesDelta(offSample, onSample, lat, key) {
  return round(seriesValue(onSample, lat, key) - seriesValue(offSample, lat, key));
}

export function buildPhase1ZWNorthSourceReboundAttribution({ offAudit, onAudit, paths }) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const northSource = {
    condensationDeltaKgM2: seriesDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    totalColumnWaterDeltaKgM2: seriesDelta(offSample, onSample, 11.25, 'totalColumnWaterKgM2'),
    boundaryLayerRhDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'boundaryLayerRhFrac'),
    lowerTroposphericRhDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'lowerTroposphericRhFrac'),
    midTroposphericRhDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'midTroposphericRhFrac'),
    lowerTroposphericOmegaDeltaPaS: seriesDelta(offSample, onSample, 11.25, 'lowerTroposphericOmegaPaS'),
    midTroposphericOmegaDeltaPaS: seriesDelta(offSample, onSample, 11.25, 'midTroposphericOmegaPaS'),
    sourceSupportDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'equatorialEdgeSubsidenceGuardSourceSupportDiagFrac'),
    leakPenaltyDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'equatorialEdgeNorthsideLeakPenaltyDiagFrac'),
    precipReevaporationDeltaKgM2: seriesDelta(offSample, onSample, 11.25, 'precipReevaporationMassKgM2'),
    vaporFluxNorthDeltaKgM_1S: seriesDelta(offSample, onSample, 11.25, 'verticallyIntegratedVaporFluxNorthKgM_1S'),
    totalWaterFluxNorthDeltaKgM_1S: seriesDelta(offSample, onSample, 11.25, 'verticallyIntegratedTotalWaterFluxNorthKgM_1S')
  };

  const surroundingLane = {
    edge3NCondensationDeltaKgM2: seriesDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    spillover18NCondensationDeltaKgM2: seriesDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    dryCore26NCondensationDeltaKgM2: seriesDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    southMirror11SCondensationDeltaKgM2: seriesDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2'),
    crossEquatorialVaporFluxNorthDeltaKgM_1S: round(
      (Number(on.crossEquatorialVaporFluxNorthKgM_1S) || 0)
        - (Number(off.crossEquatorialVaporFluxNorthKgM_1S) || 0)
    )
  };

  const localRechargeSignal = round(
    Math.max(0, northSource.totalColumnWaterDeltaKgM2 || 0)
      + Math.max(0, northSource.boundaryLayerRhDeltaFrac || 0)
      + Math.max(0, northSource.lowerTroposphericRhDeltaFrac || 0)
      + Math.max(0, northSource.midTroposphericRhDeltaFrac || 0)
      + Math.max(0, northSource.lowerTroposphericOmegaDeltaPaS || 0)
      + Math.max(0, northSource.midTroposphericOmegaDeltaPaS || 0)
  );

  const concentrationSignal = round(
    Math.max(0, northSource.condensationDeltaKgM2 || 0)
      + Math.max(0, -(surroundingLane.spillover18NCondensationDeltaKgM2 || 0))
      + Math.max(0, -(surroundingLane.dryCore26NCondensationDeltaKgM2 || 0))
      + Math.max(0, surroundingLane.crossEquatorialVaporFluxNorthDeltaKgM_1S || 0) * 0.01
  );

  const verdict = concentrationSignal > localRechargeSignal
    ? 'north_source_condensation_concentration_without_local_recharge'
    : 'north_source_recharge_signal_mixed';

  return {
    schema: 'satellite-wars.phase1zw-north-source-rebound-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    nextPhase: verdict === 'north_source_condensation_concentration_without_local_recharge'
      ? 'Phase 1ZX: North Source Concentration Patch Design'
      : 'Phase 1ZX: North Source Rebound Sensitivity Audit',
    recommendation: verdict === 'north_source_condensation_concentration_without_local_recharge'
      ? 'Keep the Phase 1ZV weak-hemi floor taper. Do not chase the remaining 11.25N rebound with a local humidity or omega boost. The next patch should be a capped source-concentration containment lane in vertical5.js/core5.js around the 9-13N source row.'
      : 'Do not patch yet. The local recharge picture is mixed enough that the next step should stay attribution-first.',
    keepWeakHemiFloorTaper: true,
    localRechargeSignal,
    concentrationSignal,
    northSource,
    surroundingLane,
    guardrails: {
      itczWidthDeltaDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
      subtropicalDryNorthRatioDelta: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
      subtropicalDrySouthRatioDelta: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
      northDryBeltOceanLargeScaleCondensationDeltaKgM2: round(
        (Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
          - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
      )
    }
  };
}

export function renderPhase1ZWReport(summary) {
  return `# Phase 1ZW North Source Rebound Attribution

## Verdict

- ${summary.verdict}
- keep weak-hemi taper: \`${summary.keepWeakHemiFloorTaper}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why The Remaining 11.25°N Rebound Is Not Local Recharge

- 11.25°N condensation delta: \`${summary.northSource.condensationDeltaKgM2}\`
- 11.25°N total-column-water delta: \`${summary.northSource.totalColumnWaterDeltaKgM2}\`
- 11.25°N BL RH delta: \`${summary.northSource.boundaryLayerRhDeltaFrac}\`
- 11.25°N lower-RH delta: \`${summary.northSource.lowerTroposphericRhDeltaFrac}\`
- 11.25°N mid-RH delta: \`${summary.northSource.midTroposphericRhDeltaFrac}\`
- 11.25°N lower-omega delta: \`${summary.northSource.lowerTroposphericOmegaDeltaPaS}\`
- 11.25°N mid-omega delta: \`${summary.northSource.midTroposphericOmegaDeltaPaS}\`
- 11.25°N source-support delta: \`${summary.northSource.sourceSupportDeltaFrac}\`
- 11.25°N leak-penalty delta: \`${summary.northSource.leakPenaltyDeltaFrac}\`

## Concentration Evidence

- 18.75°N condensation delta: \`${summary.surroundingLane.spillover18NCondensationDeltaKgM2}\`
- 26.25°N condensation delta: \`${summary.surroundingLane.dryCore26NCondensationDeltaKgM2}\`
- 3.75°N condensation delta: \`${summary.surroundingLane.edge3NCondensationDeltaKgM2}\`
- -11.25° condensation delta: \`${summary.surroundingLane.southMirror11SCondensationDeltaKgM2}\`
- cross-equatorial vapor-flux delta: \`${summary.surroundingLane.crossEquatorialVaporFluxNorthDeltaKgM_1S}\`
- concentration signal: \`${summary.concentrationSignal}\`
- local recharge signal: \`${summary.localRechargeSignal}\`

## Guardrail Context

- itcz width delta: \`${summary.guardrails.itczWidthDeltaDeg}\`
- dry north delta: \`${summary.guardrails.subtropicalDryNorthRatioDelta}\`
- dry south delta: \`${summary.guardrails.subtropicalDrySouthRatioDelta}\`
- north dry-belt ocean condensation delta: \`${summary.guardrails.northDryBeltOceanLargeScaleCondensationDeltaKgM2}\`

## Practical Read

- The Phase 1ZV taper is still worth keeping.
- The remaining north-side miss is now a same-hemisphere source-row concentration problem around \`11.25°N\`, not a new humidity recharge lane.
- The next patch should stay in the \`vertical5.js\` / \`core5.js\` lane and contain source-row concentration before turning up any broader amplitude.
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
  const summary = buildPhase1ZWNorthSourceReboundAttribution({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZWReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
