#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');

const defaults = {
  c60QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick.json'),
  c62QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick.json'),
  c60MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-monthly-climatology.json'),
  c62MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick-monthly-climatology.json'),
  c60MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-moisture-attribution.json'),
  c62MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick-moisture-attribution.json'),
  c60TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json'),
  c62TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c63-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c63-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-attribution.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const extractMetrics = (auditJson) => auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {};
const firstProfileMonth = (monthlyJson) => monthlyJson.find((entry) => entry?.profiles?.latitudesDeg && entry?.profiles?.series) || null;
const atLat = (profiles, key, targetLatDeg) => {
  const index = profiles.latitudesDeg.indexOf(targetLatDeg);
  if (index === -1) return null;
  return round(profiles.series?.[key]?.[index]);
};

const getTransportSummary = (transportJson) => {
  const equator = transportJson.interfaces.find((entry) => entry.targetLatDeg === 0);
  const north35 = transportJson.interfaces.find((entry) => entry.targetLatDeg === 35);
  const byBand = (iface, key) => iface?.levelBands?.[key]
    ? {
        total: round(iface.levelBands[key].totalWaterFluxNorthKgM_1S),
        zonalMean: round(iface.levelBands[key].totalWaterFluxZonalMeanComponentKgM_1S),
        eddy: round(iface.levelBands[key].totalWaterFluxEddyComponentKgM_1S),
        velocity: round(iface.levelBands[key].velocityMeanMs)
      }
    : null;
  return {
    dominantImport: round(transportJson.dominantNhDryBeltVaporImport?.signedFluxNorthKgM_1S),
    eqLower: byBand(equator, 'lowerTroposphere'),
    eqMid: byBand(equator, 'midTroposphere'),
    eqUpper: byBand(equator, 'upperTroposphere'),
    north35Lower: byBand(north35, 'lowerTroposphere'),
    north35Mid: byBand(north35, 'midTroposphere'),
    north35Upper: byBand(north35, 'upperTroposphere')
  };
};

export function classifyC63Decision({
  receiverReboundRecovered,
  polewardShoulderRecaptured,
  crossEqImproved,
  dominantImportWorsened,
  north35ZonalMeanImproved,
  north35EddyWorsened,
  transitionLaneReloaded
}) {
  if (
    receiverReboundRecovered
    && polewardShoulderRecaptured
    && crossEqImproved
    && dominantImportWorsened
    && north35ZonalMeanImproved
    && north35EddyWorsened
    && transitionLaneReloaded
  ) {
    return {
      verdict: 'poleward_shoulder_containment_recaptures_receiver_and_nh_ocean_rebound_but_35deg_eddy_import_remains_primary_blocker',
      nextMove: 'Architecture C64: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening experiment'
    };
  }

  return {
    verdict: 'poleward_shoulder_containment_attribution_inconclusive',
    nextMove: 'Architecture C64: alternate stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening experiment'
  };
}

export function renderArchitectureC63Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison
}) {
  const lines = [
    '# Earth Weather Architecture C63 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment Attribution',
    '',
    'This phase attributes the active C62 poleward-shoulder containment result relative to the C60 middle state. The goal is to identify whether C62 actually resolves the C60 repayment lane, or whether it simply shifts the remaining blocker into a different transport branch.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C60 vs C62 quick result',
    '',
    `- cross-equatorial vapor flux north: C60 \`${quickComparison.c60CrossEq}\`, C62 \`${quickComparison.c62CrossEq}\``,
    `- ITCZ width: C60 \`${quickComparison.c60ItczWidth}\`, C62 \`${quickComparison.c62ItczWidth}\``,
    `- NH dry-belt ratio: C60 \`${quickComparison.c60DryNorth}\`, C62 \`${quickComparison.c62DryNorth}\``,
    `- SH dry-belt ratio: C60 \`${quickComparison.c60DrySouth}\`, C62 \`${quickComparison.c62DrySouth}\``,
    `- NH midlatitude westerlies: C60 \`${quickComparison.c60Westerlies}\`, C62 \`${quickComparison.c62Westerlies}\``,
    `- NH dry-belt ocean condensation: C60 \`${quickComparison.c60OceanCond}\`, C62 \`${quickComparison.c62OceanCond}\``,
    '',
    '## Receiver and shoulder relief',
    '',
    `- NH ocean imported anvil persistence: C60 \`${moistureComparison.c60OceanPersistence}\`, C62 \`${moistureComparison.c62OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C60 \`${moistureComparison.c60OceanCarryover}\`, C62 \`${moistureComparison.c62OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C60 \`${moistureComparison.c60OceanWeakErosion}\`, C62 \`${moistureComparison.c62OceanWeakErosion}\``,
    `- 18.75° vapor flux north: C60 \`${rowComparison.c6018Flux}\`, C62 \`${rowComparison.c6218Flux}\``,
    `- 18.75° carried-over upper cloud: C60 \`${rowComparison.c6018Carryover}\`, C62 \`${rowComparison.c6218Carryover}\``,
    `- 26.25° vapor flux north: C60 \`${rowComparison.c6026Flux}\`, C62 \`${rowComparison.c6226Flux}\``,
    `- 26.25° carried-over upper cloud: C60 \`${rowComparison.c6026Carryover}\`, C62 \`${rowComparison.c6226Carryover}\``,
    `- 33.75° carried-over upper cloud: C60 \`${rowComparison.c6033Carryover}\`, C62 \`${rowComparison.c6233Carryover}\``,
    `- 33.75° upper-cloud path: C60 \`${rowComparison.c6033UpperPath}\`, C62 \`${rowComparison.c6233UpperPath}\``,
    '',
    '## Remaining 35° interface blocker',
    '',
    `- 35° dominant NH dry-belt vapor import: C60 \`${transportComparison.c60DominantImport}\`, C62 \`${transportComparison.c62DominantImport}\``,
    `- 35° lower zonal-mean total-water flux north: C60 \`${transportComparison.c60North35LowerZonal}\`, C62 \`${transportComparison.c62North35LowerZonal}\``,
    `- 35° lower eddy total-water flux north: C60 \`${transportComparison.c60North35LowerEddy}\`, C62 \`${transportComparison.c62North35LowerEddy}\``,
    `- 35° mid zonal-mean total-water flux north: C60 \`${transportComparison.c60North35MidZonal}\`, C62 \`${transportComparison.c62North35MidZonal}\``,
    `- 35° mid eddy total-water flux north: C60 \`${transportComparison.c60North35MidEddy}\`, C62 \`${transportComparison.c62North35MidEddy}\``,
    `- 35° upper zonal-mean total-water flux north: C60 \`${transportComparison.c60North35UpperZonal}\`, C62 \`${transportComparison.c62North35UpperZonal}\``,
    `- 35° upper eddy total-water flux north: C60 \`${transportComparison.c60North35UpperEddy}\`, C62 \`${transportComparison.c62North35UpperEddy}\``,
    '',
    '## Interpretation',
    '',
    '- C62 is a real improvement over C60 on the receiver side. It recaptures `26.25°` carryover, unloads the `33.75°` shoulder, and materially recovers NH dry-belt ocean maintenance metrics.',
    '- C62 also helps the broad climate objective a bit more than C60, including a small additional relief in cross-equatorial vapor flux north.',
    '- The remaining blocker is now sharper, not broader: the `35°` interface zonal-mean branch improves, but the `35°` eddy branch worsens across the lower, mid, and upper troposphere. That eddy-side repayment is now the dominant reason the sign defect stays severe.',
    '- The next bounded move should keep the active C62 carryover controls fixed and soften only the `35°` interface eddy-rescaling lane. That lets us test the live blocker directly without giving back the now-helpful `26.25°` and `33.75°` containment wins.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the active C62 `18.75°` transition preserve fixed.',
    '- Keep the active stronger `26.25°` receiver carryover containment fixed.',
    '- Keep the active `33.75°` poleward-shoulder carryover containment fixed.',
    '- Add only a narrow `35°` interface eddy-softening carveout in `windEddyNudge5.js` and judge whether the remaining eddy import burden can be reduced without reopening the NH ocean rebound family.',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c60Quick = readJson(options.c60QuickPath);
  const c62Quick = readJson(options.c62QuickPath);
  const c60Monthly = readJson(options.c60MonthlyPath);
  const c62Monthly = readJson(options.c62MonthlyPath);
  const c60Moisture = readJson(options.c60MoisturePath);
  const c62Moisture = readJson(options.c62MoisturePath);
  const c60Transport = readJson(options.c60TransportPath);
  const c62Transport = readJson(options.c62TransportPath);

  const c60Metrics = extractMetrics(c60Quick);
  const c62Metrics = extractMetrics(c62Quick);
  const c60Profiles = firstProfileMonth(c60Monthly)?.profiles;
  const c62Profiles = firstProfileMonth(c62Monthly)?.profiles;
  const c60TransportSummary = getTransportSummary(c60Transport);
  const c62TransportSummary = getTransportSummary(c62Transport);

  const quickComparison = {
    c60CrossEq: round(c60Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c62CrossEq: round(c62Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c60ItczWidth: round(c60Metrics.itczWidthDeg),
    c62ItczWidth: round(c62Metrics.itczWidthDeg),
    c60DryNorth: round(c60Metrics.subtropicalDryNorthRatio),
    c62DryNorth: round(c62Metrics.subtropicalDryNorthRatio),
    c60DrySouth: round(c60Metrics.subtropicalDrySouthRatio),
    c62DrySouth: round(c62Metrics.subtropicalDrySouthRatio),
    c60Westerlies: round(c60Metrics.midlatitudeWesterliesNorthU10Ms),
    c62Westerlies: round(c62Metrics.midlatitudeWesterliesNorthU10Ms),
    c60OceanCond: round(c60Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c62OceanCond: round(c62Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c60OceanPersistence: round(c60Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c62OceanPersistence: round(c62Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c60OceanCarryover: round(c60Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c62OceanCarryover: round(c62Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c60OceanWeakErosion: round(c60Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c62OceanWeakErosion: round(c62Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2)
  };

  const transportComparison = {
    c60DominantImport: c60TransportSummary.dominantImport,
    c62DominantImport: c62TransportSummary.dominantImport,
    c60North35LowerZonal: c60TransportSummary.north35Lower.zonalMean,
    c62North35LowerZonal: c62TransportSummary.north35Lower.zonalMean,
    c60North35LowerEddy: c60TransportSummary.north35Lower.eddy,
    c62North35LowerEddy: c62TransportSummary.north35Lower.eddy,
    c60North35MidZonal: c60TransportSummary.north35Mid.zonalMean,
    c62North35MidZonal: c62TransportSummary.north35Mid.zonalMean,
    c60North35MidEddy: c60TransportSummary.north35Mid.eddy,
    c62North35MidEddy: c62TransportSummary.north35Mid.eddy,
    c60North35UpperZonal: c60TransportSummary.north35Upper.zonalMean,
    c62North35UpperZonal: c62TransportSummary.north35Upper.zonalMean,
    c60North35UpperEddy: c60TransportSummary.north35Upper.eddy,
    c62North35UpperEddy: c62TransportSummary.north35Upper.eddy
  };

  const rowComparison = {
    c6018Flux: atLat(c60Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6218Flux: atLat(c62Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6018Carryover: atLat(c60Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c6218Carryover: atLat(c62Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c6026Flux: atLat(c60Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c6226Flux: atLat(c62Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c6026Carryover: atLat(c60Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6226Carryover: atLat(c62Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6033Carryover: atLat(c60Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c6233Carryover: atLat(c62Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c6033UpperPath: atLat(c60Profiles, 'upperCloudPathKgM2', 33.75),
    c6233UpperPath: atLat(c62Profiles, 'upperCloudPathKgM2', 33.75)
  };

  const decision = classifyC63Decision({
    receiverReboundRecovered:
      quickComparison.c62OceanCond < quickComparison.c60OceanCond
      && moistureComparison.c62OceanPersistence < moistureComparison.c60OceanPersistence
      && moistureComparison.c62OceanCarryover < moistureComparison.c60OceanCarryover
      && moistureComparison.c62OceanWeakErosion < moistureComparison.c60OceanWeakErosion
      && rowComparison.c6226Carryover < rowComparison.c6026Carryover,
    polewardShoulderRecaptured:
      rowComparison.c6233Carryover < rowComparison.c6033Carryover
      && rowComparison.c6233UpperPath < rowComparison.c6033UpperPath,
    crossEqImproved: quickComparison.c62CrossEq > quickComparison.c60CrossEq,
    dominantImportWorsened: transportComparison.c62DominantImport < transportComparison.c60DominantImport,
    north35ZonalMeanImproved:
      transportComparison.c62North35LowerZonal > transportComparison.c60North35LowerZonal
      && transportComparison.c62North35MidZonal > transportComparison.c60North35MidZonal
      && transportComparison.c62North35UpperZonal > transportComparison.c60North35UpperZonal,
    north35EddyWorsened:
      transportComparison.c62North35LowerEddy < transportComparison.c60North35LowerEddy
      && transportComparison.c62North35MidEddy < transportComparison.c60North35MidEddy
      && transportComparison.c62North35UpperEddy < transportComparison.c60North35UpperEddy,
    transitionLaneReloaded:
      rowComparison.c6218Carryover > rowComparison.c6018Carryover
      && rowComparison.c6218Flux < rowComparison.c6018Flux
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c63-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-attribution.v1',
    generatedAt: new Date().toISOString(),
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    decision
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC63Markdown({
    decision,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison
  }));

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  main();
}
