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
  c66QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-quick.json'),
  c68QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-quick.json'),
  c66MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-35deg-interface-eddy-softening-equatorial-guard-quick-monthly-climatology.json'),
  c68MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c68-narrower-equatorial-core-guard-quick-monthly-climatology.json'),
  c66MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-35deg-interface-eddy-softening-equatorial-guard-quick-moisture-attribution.json'),
  c68MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c68-narrower-equatorial-core-guard-quick-moisture-attribution.json'),
  c66TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-35deg-interface-eddy-softening-equatorial-guard-quick-transport-interface-budget.json'),
  c68TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c68-narrower-equatorial-core-guard-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c69-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c69-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-attribution.json')
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
        eddy: round(iface.levelBands[key].totalWaterFluxEddyComponentKgM_1S)
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

export function classifyC69Decision({
  transitionRowsRelieved,
  maintenanceRelieved,
  north35EddyPreserved,
  receiverLaneStillLive,
  equatorialUpperWorsened,
  dominantImportWorsened,
  crossEqWorsened
}) {
  if (
    transitionRowsRelieved
    && maintenanceRelieved
    && north35EddyPreserved
    && receiverLaneStillLive
    && equatorialUpperWorsened
    && dominantImportWorsened
    && crossEqWorsened
  ) {
    return {
      verdict: 'narrower_core_guard_relieves_transition_rows_and_nh_maintenance_but_overwithdraws_equatorial_upper_support_and_dominant_import',
      nextMove: 'Architecture C70: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, narrower equatorial-core guard, and stronger inner-core blend experiment'
    };
  }

  return {
    verdict: 'narrower_core_guard_attribution_inconclusive',
    nextMove: 'Architecture C70: alternate stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, narrower equatorial-core guard, and stronger inner-core blend experiment'
  };
}

export function renderArchitectureC69Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison
}) {
  const lines = [
    '# Earth Weather Architecture C69 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment 35deg Interface Eddy Softening And Narrower Equatorial-Core Guard Attribution',
    '',
    'This phase attributes the active C68 narrower-core-guard result relative to C66. The goal is to determine whether C68 is simply worse, or whether it trades one specific repayment family for another in a way we can still use.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C66 vs C68 quick result',
    '',
    `- cross-equatorial vapor flux north: C66 \`${quickComparison.c66CrossEq}\`, C68 \`${quickComparison.c68CrossEq}\``,
    `- ITCZ width: C66 \`${quickComparison.c66ItczWidth}\`, C68 \`${quickComparison.c68ItczWidth}\``,
    `- NH dry-belt ratio: C66 \`${quickComparison.c66DryNorth}\`, C68 \`${quickComparison.c68DryNorth}\``,
    `- SH dry-belt ratio: C66 \`${quickComparison.c66DrySouth}\`, C68 \`${quickComparison.c68DrySouth}\``,
    `- NH midlatitude westerlies: C66 \`${quickComparison.c66Westerlies}\`, C68 \`${quickComparison.c68Westerlies}\``,
    `- NH dry-belt ocean condensation: C66 \`${quickComparison.c66OceanCond}\`, C68 \`${quickComparison.c68OceanCond}\``,
    '',
    '## What C68 relieved',
    '',
    `- NH ocean imported anvil persistence: C66 \`${moistureComparison.c66OceanPersistence}\`, C68 \`${moistureComparison.c68OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C66 \`${moistureComparison.c66OceanCarryover}\`, C68 \`${moistureComparison.c68OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C66 \`${moistureComparison.c66OceanWeakErosion}\`, C68 \`${moistureComparison.c68OceanWeakErosion}\``,
    `- NH upper-cloud path: C66 \`${moistureComparison.c66UpperCloudPath}\`, C68 \`${moistureComparison.c68UpperCloudPath}\``,
    `- north transition vapor flux north: C66 \`${moistureComparison.c66TransitionFlux}\`, C68 \`${moistureComparison.c68TransitionFlux}\``,
    `- 11.25° vapor flux north: C66 \`${rowComparison.c6611Flux}\`, C68 \`${rowComparison.c6811Flux}\``,
    `- 18.75° vapor flux north: C66 \`${rowComparison.c6618Flux}\`, C68 \`${rowComparison.c6818Flux}\``,
    `- 26.25° vapor flux north: C66 \`${rowComparison.c6626Flux}\`, C68 \`${rowComparison.c6826Flux}\``,
    `- 33.75° vapor flux north: C66 \`${rowComparison.c6633Flux}\`, C68 \`${rowComparison.c6833Flux}\``,
    `- 11.25° carried-over upper cloud: C66 \`${rowComparison.c6611Carryover}\`, C68 \`${rowComparison.c6811Carryover}\``,
    `- 18.75° carried-over upper cloud: C66 \`${rowComparison.c6618Carryover}\`, C68 \`${rowComparison.c6818Carryover}\``,
    `- 33.75° carried-over upper cloud: C66 \`${rowComparison.c6633Carryover}\`, C68 \`${rowComparison.c6833Carryover}\``,
    '',
    '## What C68 gave back',
    '',
    `- 35° dominant NH dry-belt vapor import: C66 \`${transportComparison.c66DominantImport}\`, C68 \`${transportComparison.c68DominantImport}\``,
    `- 35° lower total-water flux north: C66 \`${transportComparison.c66North35LowerTotal}\`, C68 \`${transportComparison.c68North35LowerTotal}\``,
    `- 35° mid total-water flux north: C66 \`${transportComparison.c66North35MidTotal}\`, C68 \`${transportComparison.c68North35MidTotal}\``,
    `- 35° upper total-water flux north: C66 \`${transportComparison.c66North35UpperTotal}\`, C68 \`${transportComparison.c68North35UpperTotal}\``,
    `- equator lower zonal-mean total-water flux north: C66 \`${transportComparison.c66EqLowerZonal}\`, C68 \`${transportComparison.c68EqLowerZonal}\``,
    `- equator mid zonal-mean total-water flux north: C66 \`${transportComparison.c66EqMidZonal}\`, C68 \`${transportComparison.c68EqMidZonal}\``,
    `- equator upper zonal-mean total-water flux north: C66 \`${transportComparison.c66EqUpperZonal}\`, C68 \`${transportComparison.c68EqUpperZonal}\``,
    `- equator upper eddy total-water flux north: C66 \`${transportComparison.c66EqUpperEddy}\`, C68 \`${transportComparison.c68EqUpperEddy}\``,
    `- 26.25° carried-over upper cloud: C66 \`${rowComparison.c6626Carryover}\`, C68 \`${rowComparison.c6826Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C68 is not a random miss. It clearly relieves the outer transition / shoulder repayment family and further improves the NH ocean maintenance family relative to C66.',
    '- It also preserves the `35°` eddy-side relief. The 35° lower, mid, and upper eddy components all keep improving under the narrower core guard.',
    '- But it pays for that by over-withdrawing broader equatorial support: the dominant NH dry-belt import gets more negative, the 35° total branch worsens, and the equatorial zonal-mean plus upper-level branches all move the wrong way.',
    '- The `26.25°` receiver lane also remains live, with a small carryover reload even as the other shoulder lanes improve.',
    '- So the next bounded move should keep the narrower-core geometry but strengthen the inner-core blend rather than widening the guard again. That tests whether we can recover the equatorial support we lost without reopening the outer-row repayment family.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the active C68 narrower-core geometry fixed.',
    '- Keep the active C68 `35°` interface eddy-softening lane fixed.',
    '- Increase the inner-core guard blend while keeping the narrowed `6°` reach so only the core gets stronger support.',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c66Quick = readJson(options.c66QuickPath);
  const c68Quick = readJson(options.c68QuickPath);
  const c66Monthly = readJson(options.c66MonthlyPath);
  const c68Monthly = readJson(options.c68MonthlyPath);
  const c66Moisture = readJson(options.c66MoisturePath);
  const c68Moisture = readJson(options.c68MoisturePath);
  const c66Transport = readJson(options.c66TransportPath);
  const c68Transport = readJson(options.c68TransportPath);

  const c66Metrics = extractMetrics(c66Quick);
  const c68Metrics = extractMetrics(c68Quick);
  const c66Profiles = firstProfileMonth(c66Monthly)?.profiles;
  const c68Profiles = firstProfileMonth(c68Monthly)?.profiles;
  const c66TransportSummary = getTransportSummary(c66Transport);
  const c68TransportSummary = getTransportSummary(c68Transport);

  const quickComparison = {
    c66CrossEq: round(c66Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c68CrossEq: round(c68Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c66ItczWidth: round(c66Metrics.itczWidthDeg),
    c68ItczWidth: round(c68Metrics.itczWidthDeg),
    c66DryNorth: round(c66Metrics.subtropicalDryNorthRatio),
    c68DryNorth: round(c68Metrics.subtropicalDryNorthRatio),
    c66DrySouth: round(c66Metrics.subtropicalDrySouthRatio),
    c68DrySouth: round(c68Metrics.subtropicalDrySouthRatio),
    c66Westerlies: round(c66Metrics.midlatitudeWesterliesNorthU10Ms),
    c68Westerlies: round(c68Metrics.midlatitudeWesterliesNorthU10Ms),
    c66OceanCond: round(c66Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c68OceanCond: round(c68Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c66OceanPersistence: round(c66Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c68OceanPersistence: round(c68Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c66OceanCarryover: round(c66Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c68OceanCarryover: round(c68Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c66OceanWeakErosion: round(c66Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c68OceanWeakErosion: round(c68Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c66UpperCloudPath: round(c66Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2),
    c68UpperCloudPath: round(c68Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2),
    c66TransitionFlux: round(c66Moisture.latestMetrics.northTransitionVaporFluxNorthKgM_1S),
    c68TransitionFlux: round(c68Moisture.latestMetrics.northTransitionVaporFluxNorthKgM_1S)
  };

  const transportComparison = {
    c66DominantImport: c66TransportSummary.dominantImport,
    c68DominantImport: c68TransportSummary.dominantImport,
    c66North35LowerTotal: c66TransportSummary.north35Lower.total,
    c68North35LowerTotal: c68TransportSummary.north35Lower.total,
    c66North35LowerEddy: c66TransportSummary.north35Lower.eddy,
    c68North35LowerEddy: c68TransportSummary.north35Lower.eddy,
    c66North35MidTotal: c66TransportSummary.north35Mid.total,
    c68North35MidTotal: c68TransportSummary.north35Mid.total,
    c66North35MidEddy: c66TransportSummary.north35Mid.eddy,
    c68North35MidEddy: c68TransportSummary.north35Mid.eddy,
    c66North35UpperTotal: c66TransportSummary.north35Upper.total,
    c68North35UpperTotal: c68TransportSummary.north35Upper.total,
    c66North35UpperEddy: c66TransportSummary.north35Upper.eddy,
    c68North35UpperEddy: c68TransportSummary.north35Upper.eddy,
    c66EqLowerZonal: c66TransportSummary.eqLower.zonalMean,
    c68EqLowerZonal: c68TransportSummary.eqLower.zonalMean,
    c66EqMidZonal: c66TransportSummary.eqMid.zonalMean,
    c68EqMidZonal: c68TransportSummary.eqMid.zonalMean,
    c66EqUpperZonal: c66TransportSummary.eqUpper.zonalMean,
    c68EqUpperZonal: c68TransportSummary.eqUpper.zonalMean,
    c66EqUpperEddy: c66TransportSummary.eqUpper.eddy,
    c68EqUpperEddy: c68TransportSummary.eqUpper.eddy
  };

  const rowComparison = {
    c6611Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 11.25),
    c6811Flux: atLat(c68Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 11.25),
    c6618Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6818Flux: atLat(c68Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6626Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c6826Flux: atLat(c68Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c6633Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 33.75),
    c6833Flux: atLat(c68Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 33.75),
    c6611Carryover: atLat(c66Profiles, 'carriedOverUpperCloudMassKgM2', 11.25),
    c6811Carryover: atLat(c68Profiles, 'carriedOverUpperCloudMassKgM2', 11.25),
    c6618Carryover: atLat(c66Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c6818Carryover: atLat(c68Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c6626Carryover: atLat(c66Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6826Carryover: atLat(c68Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6633Carryover: atLat(c66Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c6833Carryover: atLat(c68Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const decision = classifyC69Decision({
    transitionRowsRelieved:
      rowComparison.c6811Flux > rowComparison.c6611Flux
      && rowComparison.c6818Flux > rowComparison.c6618Flux
      && rowComparison.c6826Flux > rowComparison.c6626Flux
      && rowComparison.c6833Flux > rowComparison.c6633Flux,
    maintenanceRelieved:
      moistureComparison.c68OceanPersistence < moistureComparison.c66OceanPersistence
      && moistureComparison.c68OceanCarryover < moistureComparison.c66OceanCarryover
      && moistureComparison.c68OceanWeakErosion < moistureComparison.c66OceanWeakErosion
      && moistureComparison.c68UpperCloudPath < moistureComparison.c66UpperCloudPath
      && moistureComparison.c68TransitionFlux > moistureComparison.c66TransitionFlux
      && rowComparison.c6811Carryover < rowComparison.c6611Carryover
      && rowComparison.c6818Carryover < rowComparison.c6618Carryover
      && rowComparison.c6833Carryover < rowComparison.c6633Carryover,
    north35EddyPreserved:
      transportComparison.c68North35LowerEddy > transportComparison.c66North35LowerEddy
      && transportComparison.c68North35MidEddy > transportComparison.c66North35MidEddy
      && transportComparison.c68North35UpperEddy > transportComparison.c66North35UpperEddy,
    receiverLaneStillLive:
      rowComparison.c6826Carryover > rowComparison.c6626Carryover,
    equatorialUpperWorsened:
      transportComparison.c68EqUpperZonal < transportComparison.c66EqUpperZonal
      && transportComparison.c68EqUpperEddy < transportComparison.c66EqUpperEddy,
    dominantImportWorsened:
      transportComparison.c68DominantImport < transportComparison.c66DominantImport
      && transportComparison.c68North35LowerTotal < transportComparison.c66North35LowerTotal
      && transportComparison.c68North35MidTotal < transportComparison.c66North35MidTotal
      && transportComparison.c68North35UpperTotal < transportComparison.c66North35UpperTotal,
    crossEqWorsened:
      quickComparison.c68CrossEq < quickComparison.c66CrossEq
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c69-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC69Markdown({
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
