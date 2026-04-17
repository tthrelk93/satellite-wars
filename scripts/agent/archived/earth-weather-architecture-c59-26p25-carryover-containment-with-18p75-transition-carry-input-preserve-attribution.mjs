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
  c54QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick.json'),
  c58QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick.json'),
  c54MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-monthly-climatology.json'),
  c58MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-monthly-climatology.json'),
  c54MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-moisture-attribution.json'),
  c58MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-moisture-attribution.json'),
  c54TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-transport-interface-budget.json'),
  c58TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c59-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c59-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-attribution.json')
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
  const byLevel = (iface, levelIndex) => {
    const level = iface?.modelLevels?.[levelIndex];
    if (!level) return null;
    return {
      total: round(level.totalWaterFluxNorthKgM_1S),
      zonalMean: round(level.totalWaterFluxZonalMeanComponentKgM_1S),
      eddy: round(level.totalWaterFluxEddyComponentKgM_1S)
    };
  };
  return {
    dominantImport: round(transportJson.dominantNhDryBeltVaporImport?.signedFluxNorthKgM_1S),
    eqLower: byLevel(equator, 0),
    eqMid: byLevel(equator, 1),
    eqUpper: byLevel(equator, 2),
    north35Lower: byLevel(north35, 0),
    north35Mid: byLevel(north35, 1),
    north35Upper: byLevel(north35, 2)
  };
};

export function classifyC59Decision({
  equatorialFluxRelieved,
  equatorialTransportImproved,
  transitionRowReloaded,
  receiverRowReloaded,
  polewardImportWorsened,
  polewardShoulderUnloaded
}) {
  if (
    equatorialFluxRelieved
    && equatorialTransportImproved
    && transitionRowReloaded
    && receiverRowReloaded
    && polewardImportWorsened
    && polewardShoulderUnloaded
  ) {
    return {
      verdict: 'transition_carry_input_preserve_relieves_equatorial_export_but_reloads_18p75_26p25_and_worsens_35deg_import',
      nextMove: 'Architecture C60: stronger 26p25 receiver carryover containment on top of 18p75 transition carry-input preserve experiment'
    };
  }

  return {
    verdict: 'transition_carry_input_preserve_attribution_inconclusive',
    nextMove: 'Architecture C60: alternate stronger 26p25 receiver carryover containment on top of 18p75 transition carry-input preserve experiment'
  };
}

export function renderArchitectureC59Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison
}) {
  const lines = [
    '# Earth Weather Architecture C59 26p25 Carryover Containment With 18p75 Transition Carry-Input Preserve Attribution',
    '',
    'This phase attributes the active C58 transition carry-input preserve relative to the C54 receiver-containment baseline. The goal is to identify exactly where the modest equatorial sign-defect relief came from and which rows paid for it.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C54 vs C58 quick result',
    '',
    `- cross-equatorial vapor flux north: C54 \`${quickComparison.c54CrossEq}\`, C58 \`${quickComparison.c58CrossEq}\``,
    `- ITCZ width: C54 \`${quickComparison.c54ItczWidth}\`, C58 \`${quickComparison.c58ItczWidth}\``,
    `- NH dry-belt ratio: C54 \`${quickComparison.c54DryNorth}\`, C58 \`${quickComparison.c58DryNorth}\``,
    `- SH dry-belt ratio: C54 \`${quickComparison.c54DrySouth}\`, C58 \`${quickComparison.c58DrySouth}\``,
    `- NH midlatitude westerlies: C54 \`${quickComparison.c54Westerlies}\`, C58 \`${quickComparison.c58Westerlies}\``,
    `- NH dry-belt ocean condensation: C54 \`${quickComparison.c54OceanCond}\`, C58 \`${quickComparison.c58OceanCond}\``,
    '',
    '## C54 vs C58 moisture / transport shift',
    '',
    `- NH ocean imported anvil persistence: C54 \`${moistureComparison.c54OceanPersistence}\`, C58 \`${moistureComparison.c58OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C54 \`${moistureComparison.c54OceanCarryover}\`, C58 \`${moistureComparison.c58OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C54 \`${moistureComparison.c54OceanWeakErosion}\`, C58 \`${moistureComparison.c58OceanWeakErosion}\``,
    `- equator lower total-water flux north: C54 \`${transportComparison.c54EqLower}\`, C58 \`${transportComparison.c58EqLower}\``,
    `- equator mid total-water flux north: C54 \`${transportComparison.c54EqMid}\`, C58 \`${transportComparison.c58EqMid}\``,
    `- equator upper total-water flux north: C54 \`${transportComparison.c54EqUpper}\`, C58 \`${transportComparison.c58EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C54 \`${transportComparison.c54DominantImport}\`, C58 \`${transportComparison.c58DominantImport}\``,
    '',
    '## Shoulder-row tradeoff',
    '',
    `- 18.75° vapor flux north: C54 \`${rowComparison.c5418Flux}\`, C58 \`${rowComparison.c5818Flux}\``,
    `- 18.75° carried-over upper cloud: C54 \`${rowComparison.c5418Carryover}\`, C58 \`${rowComparison.c5818Carryover}\``,
    `- 26.25° vapor flux north: C54 \`${rowComparison.c5426Flux}\`, C58 \`${rowComparison.c5826Flux}\``,
    `- 26.25° carried-over upper cloud: C54 \`${rowComparison.c5426Carryover}\`, C58 \`${rowComparison.c5826Carryover}\``,
    `- 33.75° vapor flux north: C54 \`${rowComparison.c5433Flux}\`, C58 \`${rowComparison.c5833Flux}\``,
    `- 33.75° carried-over upper cloud: C54 \`${rowComparison.c5433Carryover}\`, C58 \`${rowComparison.c5833Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C58 is a real middle state. It slightly relieves the cross-equatorial sign defect and improves the equator lower/mid/upper transport stack relative to C54.',
    '- But that export-side relief does not come from a healthier `18.75°` transition row. The `18.75°` lane actually becomes more southward and reloads carryover. The `26.25°` receiver row also reloads carryover and becomes more southward than C54.',
    '- The poleward shoulder changes in the opposite direction: `33.75°` carryover unloads, but the `35°` interface import burden worsens. So the net C58 tradeoff is modest equatorial relief bought by shifting burden into the transition / receiver side and the dry-belt import interface.',
    '- The next bounded move should therefore keep the active C58 transition carry-input preserve, but strengthen the `26.25°` receiver carryover containment so we can test whether some of that receiver-side loss can be recaptured without giving back the small sign-defect relief.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the active `18.75°` transition carry-input preserve from C58.',
    '- Strengthen the active `26.25°` receiver carryover containment rather than changing the transition preserve again.',
    '- Watch whether stronger receiver recapture restores NH dry-belt metrics without collapsing the small equatorial transport relief from C58.',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c54Quick = readJson(options.c54QuickPath);
  const c58Quick = readJson(options.c58QuickPath);
  const c54Monthly = readJson(options.c54MonthlyPath);
  const c58Monthly = readJson(options.c58MonthlyPath);
  const c54Moisture = readJson(options.c54MoisturePath);
  const c58Moisture = readJson(options.c58MoisturePath);
  const c54Transport = readJson(options.c54TransportPath);
  const c58Transport = readJson(options.c58TransportPath);

  const c54Metrics = extractMetrics(c54Quick);
  const c58Metrics = extractMetrics(c58Quick);
  const c54Profiles = firstProfileMonth(c54Monthly)?.profiles;
  const c58Profiles = firstProfileMonth(c58Monthly)?.profiles;
  const c54TransportSummary = getTransportSummary(c54Transport);
  const c58TransportSummary = getTransportSummary(c58Transport);

  const quickComparison = {
    c54CrossEq: round(c54Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c58CrossEq: round(c58Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c54ItczWidth: round(c54Metrics.itczWidthDeg),
    c58ItczWidth: round(c58Metrics.itczWidthDeg),
    c54DryNorth: round(c54Metrics.subtropicalDryNorthRatio),
    c58DryNorth: round(c58Metrics.subtropicalDryNorthRatio),
    c54DrySouth: round(c54Metrics.subtropicalDrySouthRatio),
    c58DrySouth: round(c58Metrics.subtropicalDrySouthRatio),
    c54Westerlies: round(c54Metrics.midlatitudeWesterliesNorthU10Ms),
    c58Westerlies: round(c58Metrics.midlatitudeWesterliesNorthU10Ms),
    c54OceanCond: round(c54Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c58OceanCond: round(c58Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c54OceanPersistence: round(c54Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c58OceanPersistence: round(c58Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c54OceanCarryover: round(c54Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c58OceanCarryover: round(c58Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c54OceanWeakErosion: round(c54Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c58OceanWeakErosion: round(c58Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2)
  };

  const transportComparison = {
    c54EqLower: c54TransportSummary.eqLower.total,
    c58EqLower: c58TransportSummary.eqLower.total,
    c54EqMid: c54TransportSummary.eqMid.total,
    c58EqMid: c58TransportSummary.eqMid.total,
    c54EqUpper: c54TransportSummary.eqUpper.total,
    c58EqUpper: c58TransportSummary.eqUpper.total,
    c54DominantImport: c54TransportSummary.dominantImport,
    c58DominantImport: c58TransportSummary.dominantImport
  };

  const rowComparison = {
    c5418Flux: atLat(c54Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c5818Flux: atLat(c58Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c5418Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c5818Carryover: atLat(c58Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c5426Flux: atLat(c54Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c5826Flux: atLat(c58Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c5426Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5826Carryover: atLat(c58Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5433Flux: atLat(c54Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 33.75),
    c5833Flux: atLat(c58Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 33.75),
    c5433Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c5833Carryover: atLat(c58Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const decision = classifyC59Decision({
    equatorialFluxRelieved: quickComparison.c58CrossEq > quickComparison.c54CrossEq,
    equatorialTransportImproved:
      transportComparison.c58EqLower > transportComparison.c54EqLower
      && transportComparison.c58EqMid > transportComparison.c54EqMid
      && transportComparison.c58EqUpper > transportComparison.c54EqUpper,
    transitionRowReloaded:
      rowComparison.c5818Flux < rowComparison.c5418Flux
      && rowComparison.c5818Carryover > rowComparison.c5418Carryover,
    receiverRowReloaded:
      rowComparison.c5826Flux < rowComparison.c5426Flux
      && rowComparison.c5826Carryover > rowComparison.c5426Carryover,
    polewardImportWorsened: transportComparison.c58DominantImport < transportComparison.c54DominantImport,
    polewardShoulderUnloaded: rowComparison.c5833Carryover < rowComparison.c5433Carryover
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c59-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC59Markdown({
    decision,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison
  }));

  process.stdout.write(`${JSON.stringify({
    reportPath: options.reportPath,
    jsonPath: options.jsonPath,
    decision
  }, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main();
}
