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
  c58QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick.json'),
  c60QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick.json'),
  c58MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-monthly-climatology.json'),
  c60MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-monthly-climatology.json'),
  c58MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-moisture-attribution.json'),
  c60MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-moisture-attribution.json'),
  c58TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json'),
  c60TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c61-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c61-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-attribution.json')
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

export function classifyC61Decision({
  equatorialFluxRelieved,
  equatorialTransportImproved,
  transitionRowRelieved,
  receiverCarryoverRecaptured,
  receiverFluxWorsened,
  polewardImportRelieved,
  polewardShoulderReloaded,
  dryBeltOceanMaintenanceReloaded
}) {
  if (
    equatorialFluxRelieved
    && equatorialTransportImproved
    && transitionRowRelieved
    && receiverCarryoverRecaptured
    && receiverFluxWorsened
    && polewardImportRelieved
    && polewardShoulderReloaded
    && dryBeltOceanMaintenanceReloaded
  ) {
    return {
      verdict: 'stronger_receiver_containment_relieves_equatorial_export_and_recaptures_26p25_carryover_but_reloads_33p75_poleward_shoulder_and_nh_ocean_maintenance',
      nextMove: 'Architecture C62: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment experiment'
    };
  }

  return {
    verdict: 'stronger_receiver_containment_attribution_inconclusive',
    nextMove: 'Architecture C62: alternate stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment experiment'
  };
}

export function renderArchitectureC61Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison
}) {
  const lines = [
    '# Earth Weather Architecture C61 Stronger 26p25 Receiver Carryover Containment On Top Of 18p75 Transition Carry-Input Preserve Attribution',
    '',
    'This phase attributes the stronger C60 `26.25°` receiver carryover containment relative to the active C58 transition-preserve baseline. The goal is to identify where the substantial export-side relief came from and where the NH dry-belt ocean rebound was reintroduced.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C58 vs C60 quick result',
    '',
    `- cross-equatorial vapor flux north: C58 \`${quickComparison.c58CrossEq}\`, C60 \`${quickComparison.c60CrossEq}\``,
    `- ITCZ width: C58 \`${quickComparison.c58ItczWidth}\`, C60 \`${quickComparison.c60ItczWidth}\``,
    `- NH dry-belt ratio: C58 \`${quickComparison.c58DryNorth}\`, C60 \`${quickComparison.c60DryNorth}\``,
    `- SH dry-belt ratio: C58 \`${quickComparison.c58DrySouth}\`, C60 \`${quickComparison.c60DrySouth}\``,
    `- NH midlatitude westerlies: C58 \`${quickComparison.c58Westerlies}\`, C60 \`${quickComparison.c60Westerlies}\``,
    `- NH dry-belt ocean condensation: C58 \`${quickComparison.c58OceanCond}\`, C60 \`${quickComparison.c60OceanCond}\``,
    '',
    '## C58 vs C60 moisture / transport shift',
    '',
    `- NH ocean imported anvil persistence: C58 \`${moistureComparison.c58OceanPersistence}\`, C60 \`${moistureComparison.c60OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C58 \`${moistureComparison.c58OceanCarryover}\`, C60 \`${moistureComparison.c60OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C58 \`${moistureComparison.c58OceanWeakErosion}\`, C60 \`${moistureComparison.c60OceanWeakErosion}\``,
    `- NH upper-cloud path: C58 \`${moistureComparison.c58UpperCloudPath}\`, C60 \`${moistureComparison.c60UpperCloudPath}\``,
    `- equator lower total-water flux north: C58 \`${transportComparison.c58EqLower}\`, C60 \`${transportComparison.c60EqLower}\``,
    `- equator mid total-water flux north: C58 \`${transportComparison.c58EqMid}\`, C60 \`${transportComparison.c60EqMid}\``,
    `- equator upper total-water flux north: C58 \`${transportComparison.c58EqUpper}\`, C60 \`${transportComparison.c60EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C58 \`${transportComparison.c58DominantImport}\`, C60 \`${transportComparison.c60DominantImport}\``,
    '',
    '## Shoulder-row redistribution',
    '',
    `- 18.75° vapor flux north: C58 \`${rowComparison.c5818Flux}\`, C60 \`${rowComparison.c6018Flux}\``,
    `- 18.75° carried-over upper cloud: C58 \`${rowComparison.c5818Carryover}\`, C60 \`${rowComparison.c6018Carryover}\``,
    `- 26.25° vapor flux north: C58 \`${rowComparison.c5826Flux}\`, C60 \`${rowComparison.c6026Flux}\``,
    `- 26.25° carried-over upper cloud: C58 \`${rowComparison.c5826Carryover}\`, C60 \`${rowComparison.c6026Carryover}\``,
    `- 33.75° carried-over upper cloud: C58 \`${rowComparison.c5833Carryover}\`, C60 \`${rowComparison.c6033Carryover}\``,
    `- 33.75° upper-cloud path: C58 \`${rowComparison.c5833UpperPath}\`, C60 \`${rowComparison.c6033UpperPath}\``,
    '',
    '## Interpretation',
    '',
    '- C60 is a real, active middle state. Relative to C58 it materially relieves the cross-equatorial sign defect and improves the equator lower, mid, and upper transport bands.',
    '- The export-side relief does not come from sacrificing the `18.75°` transition row. That lane actually improves slightly, and the `26.25°` row unloads carryover even though its flux itself becomes a bit more southward.',
    '- The dominant repayment lands poleward instead: the `33.75°` shoulder reloads upper-cloud carryover and path mass, and the NH dry-belt ocean maintenance family rebounds sharply. That rebound is what drags NH ocean condensation back up.',
    '- The next bounded move should therefore keep the active C60 `18.75°` transition preserve and stronger `26.25°` containment fixed, then add a narrow `33.75°` poleward-shoulder carryover containment carveout rather than weakening the already-helpful receiver lane.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the active C60 `18.75°` transition carry-input preserve untouched.',
    '- Keep the active stronger `26.25°` receiver carryover containment untouched.',
    '- Add only a narrow `33.75°` poleward-shoulder carryover containment lane and judge whether it can recapture the NH ocean rebound without giving back the export-side gain.',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c58Quick = readJson(options.c58QuickPath);
  const c60Quick = readJson(options.c60QuickPath);
  const c58Monthly = readJson(options.c58MonthlyPath);
  const c60Monthly = readJson(options.c60MonthlyPath);
  const c58Moisture = readJson(options.c58MoisturePath);
  const c60Moisture = readJson(options.c60MoisturePath);
  const c58Transport = readJson(options.c58TransportPath);
  const c60Transport = readJson(options.c60TransportPath);

  const c58Metrics = extractMetrics(c58Quick);
  const c60Metrics = extractMetrics(c60Quick);
  const c58Profiles = firstProfileMonth(c58Monthly)?.profiles;
  const c60Profiles = firstProfileMonth(c60Monthly)?.profiles;
  const c58TransportSummary = getTransportSummary(c58Transport);
  const c60TransportSummary = getTransportSummary(c60Transport);

  const quickComparison = {
    c58CrossEq: round(c58Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c60CrossEq: round(c60Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c58ItczWidth: round(c58Metrics.itczWidthDeg),
    c60ItczWidth: round(c60Metrics.itczWidthDeg),
    c58DryNorth: round(c58Metrics.subtropicalDryNorthRatio),
    c60DryNorth: round(c60Metrics.subtropicalDryNorthRatio),
    c58DrySouth: round(c58Metrics.subtropicalDrySouthRatio),
    c60DrySouth: round(c60Metrics.subtropicalDrySouthRatio),
    c58Westerlies: round(c58Metrics.midlatitudeWesterliesNorthU10Ms),
    c60Westerlies: round(c60Metrics.midlatitudeWesterliesNorthU10Ms),
    c58OceanCond: round(c58Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c60OceanCond: round(c60Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c58OceanPersistence: round(c58Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c60OceanPersistence: round(c60Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c58OceanCarryover: round(c58Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c60OceanCarryover: round(c60Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c58OceanWeakErosion: round(c58Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c60OceanWeakErosion: round(c60Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c58UpperCloudPath: round(c58Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2),
    c60UpperCloudPath: round(c60Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2)
  };

  const transportComparison = {
    c58EqLower: c58TransportSummary.eqLower.total,
    c60EqLower: c60TransportSummary.eqLower.total,
    c58EqMid: c58TransportSummary.eqMid.total,
    c60EqMid: c60TransportSummary.eqMid.total,
    c58EqUpper: c58TransportSummary.eqUpper.total,
    c60EqUpper: c60TransportSummary.eqUpper.total,
    c58DominantImport: c58TransportSummary.dominantImport,
    c60DominantImport: c60TransportSummary.dominantImport
  };

  const rowComparison = {
    c5818Flux: atLat(c58Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6018Flux: atLat(c60Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c5818Carryover: atLat(c58Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c6018Carryover: atLat(c60Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c5826Flux: atLat(c58Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c6026Flux: atLat(c60Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c5826Carryover: atLat(c58Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6026Carryover: atLat(c60Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5833Carryover: atLat(c58Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c6033Carryover: atLat(c60Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c5833UpperPath: atLat(c58Profiles, 'upperCloudPathKgM2', 33.75),
    c6033UpperPath: atLat(c60Profiles, 'upperCloudPathKgM2', 33.75)
  };

  const decision = classifyC61Decision({
    equatorialFluxRelieved: quickComparison.c60CrossEq > quickComparison.c58CrossEq,
    equatorialTransportImproved:
      transportComparison.c60EqLower > transportComparison.c58EqLower
      && transportComparison.c60EqMid > transportComparison.c58EqMid
      && transportComparison.c60EqUpper > transportComparison.c58EqUpper,
    transitionRowRelieved:
      rowComparison.c6018Flux > rowComparison.c5818Flux
      && rowComparison.c6018Carryover < rowComparison.c5818Carryover,
    receiverCarryoverRecaptured: rowComparison.c6026Carryover < rowComparison.c5826Carryover,
    receiverFluxWorsened: rowComparison.c6026Flux < rowComparison.c5826Flux,
    polewardImportRelieved: transportComparison.c60DominantImport > transportComparison.c58DominantImport,
    polewardShoulderReloaded:
      rowComparison.c6033Carryover > rowComparison.c5833Carryover
      && rowComparison.c6033UpperPath > rowComparison.c5833UpperPath,
    dryBeltOceanMaintenanceReloaded:
      quickComparison.c60OceanCond > quickComparison.c58OceanCond
      && moistureComparison.c60OceanPersistence > moistureComparison.c58OceanPersistence
      && moistureComparison.c60OceanCarryover > moistureComparison.c58OceanCarryover
      && moistureComparison.c60OceanWeakErosion > moistureComparison.c58OceanWeakErosion
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c61-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC61Markdown({
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
