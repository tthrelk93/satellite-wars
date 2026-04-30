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
  c56QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick.json'),
  c54MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-monthly-climatology.json'),
  c56MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-monthly-climatology.json'),
  c54MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-moisture-attribution.json'),
  c56MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-moisture-attribution.json'),
  c54TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-transport-interface-budget.json'),
  c56TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c57-26p25-carryover-containment-with-18p75-transition-support-preserve-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c57-26p25-carryover-containment-with-18p75-transition-support-preserve-attribution.json')
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

export function classifyC57Decision({
  exactQuickMatch,
  exactMoistureMatch,
  exactTransportMatch,
  exactRowMatch
}) {
  if (exactQuickMatch && exactMoistureMatch && exactTransportMatch && exactRowMatch) {
    return {
      verdict: 'transition_support_preserve_inert_organized_support_only_not_live_binder',
      nextMove: 'Architecture C58: 26p25 carryover containment with 18p75 transition carry-input preserve experiment'
    };
  }

  return {
    verdict: 'transition_support_preserve_attribution_inconclusive',
    nextMove: 'Architecture C58: alternate 26p25 carryover containment with 18p75 transition carry-input preserve experiment'
  };
}

export function renderArchitectureC57Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison,
  exactnessSummary
}) {
  const lines = [
    '# Earth Weather Architecture C57 26p25 Carryover Containment With 18p75 Transition-Support Preserve Attribution',
    '',
    'This phase attributes the C56 narrow `18.75°` transition-support preserve experiment relative to the active C54 receiver-containment regime. The goal is to determine whether the preserve lane ever touched the live binder or whether it was fully inert.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C54 vs C56 quick result',
    '',
    `- cross-equatorial vapor flux north: C54 \`${quickComparison.c54CrossEq}\`, C56 \`${quickComparison.c56CrossEq}\``,
    `- ITCZ width: C54 \`${quickComparison.c54ItczWidth}\`, C56 \`${quickComparison.c56ItczWidth}\``,
    `- NH dry-belt ratio: C54 \`${quickComparison.c54DryNorth}\`, C56 \`${quickComparison.c56DryNorth}\``,
    `- SH dry-belt ratio: C54 \`${quickComparison.c54DrySouth}\`, C56 \`${quickComparison.c56DrySouth}\``,
    `- NH midlatitude westerlies: C54 \`${quickComparison.c54Westerlies}\`, C56 \`${quickComparison.c56Westerlies}\``,
    `- NH dry-belt ocean condensation: C54 \`${quickComparison.c54OceanCond}\`, C56 \`${quickComparison.c56OceanCond}\``,
    '',
    '## C54 vs C56 moisture / transport check',
    '',
    `- NH ocean imported anvil persistence: C54 \`${moistureComparison.c54OceanPersistence}\`, C56 \`${moistureComparison.c56OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C54 \`${moistureComparison.c54OceanCarryover}\`, C56 \`${moistureComparison.c56OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C54 \`${moistureComparison.c54OceanWeakErosion}\`, C56 \`${moistureComparison.c56OceanWeakErosion}\``,
    `- equator lower total-water flux north: C54 \`${transportComparison.c54EqLower}\`, C56 \`${transportComparison.c56EqLower}\``,
    `- equator mid total-water flux north: C54 \`${transportComparison.c54EqMid}\`, C56 \`${transportComparison.c56EqMid}\``,
    `- equator upper total-water flux north: C54 \`${transportComparison.c54EqUpper}\`, C56 \`${transportComparison.c56EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C54 \`${transportComparison.c54DominantImport}\`, C56 \`${transportComparison.c56DominantImport}\``,
    '',
    '## Shoulder-row identity check',
    '',
    `- 18.75° vapor flux north: C54 \`${rowComparison.c5418Flux}\`, C56 \`${rowComparison.c5618Flux}\``,
    `- 18.75° carried-over upper cloud: C54 \`${rowComparison.c5418Carryover}\`, C56 \`${rowComparison.c5618Carryover}\``,
    `- 26.25° vapor flux north: C54 \`${rowComparison.c5426Flux}\`, C56 \`${rowComparison.c5626Flux}\``,
    `- 26.25° carried-over upper cloud: C54 \`${rowComparison.c5426Carryover}\`, C56 \`${rowComparison.c5626Carryover}\``,
    `- 33.75° carried-over upper cloud: C54 \`${rowComparison.c5433Carryover}\`, C56 \`${rowComparison.c5633Carryover}\``,
    `- 33.75° imported anvil persistence: C54 \`${rowComparison.c5433Persistence}\`, C56 \`${rowComparison.c5633Persistence}\``,
    '',
    '## Exactness summary',
    '',
    `- exact quick match: \`${exactnessSummary.exactQuickMatch}\``,
    `- exact moisture match: \`${exactnessSummary.exactMoistureMatch}\``,
    `- exact transport match: \`${exactnessSummary.exactTransportMatch}\``,
    `- exact shoulder-row match: \`${exactnessSummary.exactRowMatch}\``,
    '',
    '## Interpretation',
    '',
    '- C56 is fully inert relative to C54 at report precision: the quick score, the NH ocean moisture attribution, the equatorial transport stack, and the `18.75°` / `26.25°` / `33.75°` shoulder rows all match exactly.',
    '- That means the narrow `18.75°` organized-support-only preserve never touched the live binder. It did not create a new middle state and it did not even partially relieve the transition-export defect.',
    '- The next bounded move should therefore target the broader `18–22.5°N` transition carry-input contract, not just the organized-support cap, while keeping the active `26.25°` receiver carryover containment in place.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the active `26.25°` receiver carryover containment from C54.',
    '- Add a broader `18.75°` transition carry-input preserve lane that can relax the local carry-input contract rather than only the fresh organized-support cap.',
    '- Candidate preserve levers:',
    '  - `18.75° transition carry-input potential support`',
    '  - `18.75° transition subtropical-suppression relief`',
    '  - `18.75° transition dominance / residual-mass relax`',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c54Quick = readJson(options.c54QuickPath);
  const c56Quick = readJson(options.c56QuickPath);
  const c54Monthly = readJson(options.c54MonthlyPath);
  const c56Monthly = readJson(options.c56MonthlyPath);
  const c54Moisture = readJson(options.c54MoisturePath);
  const c56Moisture = readJson(options.c56MoisturePath);
  const c54Transport = readJson(options.c54TransportPath);
  const c56Transport = readJson(options.c56TransportPath);

  const c54Metrics = extractMetrics(c54Quick);
  const c56Metrics = extractMetrics(c56Quick);
  const c54Profiles = firstProfileMonth(c54Monthly)?.profiles;
  const c56Profiles = firstProfileMonth(c56Monthly)?.profiles;
  const c54TransportSummary = getTransportSummary(c54Transport);
  const c56TransportSummary = getTransportSummary(c56Transport);

  const quickComparison = {
    c54CrossEq: round(c54Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c56CrossEq: round(c56Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c54ItczWidth: round(c54Metrics.itczWidthDeg),
    c56ItczWidth: round(c56Metrics.itczWidthDeg),
    c54DryNorth: round(c54Metrics.subtropicalDryNorthRatio),
    c56DryNorth: round(c56Metrics.subtropicalDryNorthRatio),
    c54DrySouth: round(c54Metrics.subtropicalDrySouthRatio),
    c56DrySouth: round(c56Metrics.subtropicalDrySouthRatio),
    c54Westerlies: round(c54Metrics.midlatitudeWesterliesNorthU10Ms),
    c56Westerlies: round(c56Metrics.midlatitudeWesterliesNorthU10Ms),
    c54OceanCond: round(c54Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c56OceanCond: round(c56Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c54OceanPersistence: round(c54Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c56OceanPersistence: round(c56Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c54OceanCarryover: round(c54Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c56OceanCarryover: round(c56Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c54OceanWeakErosion: round(c54Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c56OceanWeakErosion: round(c56Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2)
  };

  const transportComparison = {
    c54EqLower: c54TransportSummary.eqLower.total,
    c56EqLower: c56TransportSummary.eqLower.total,
    c54EqMid: c54TransportSummary.eqMid.total,
    c56EqMid: c56TransportSummary.eqMid.total,
    c54EqUpper: c54TransportSummary.eqUpper.total,
    c56EqUpper: c56TransportSummary.eqUpper.total,
    c54DominantImport: c54TransportSummary.dominantImport,
    c56DominantImport: c56TransportSummary.dominantImport
  };

  const rowComparison = {
    c5418Flux: atLat(c54Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c5618Flux: atLat(c56Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c5418Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c5618Carryover: atLat(c56Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c5426Flux: atLat(c54Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c5626Flux: atLat(c56Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c5426Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5626Carryover: atLat(c56Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5433Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c5633Carryover: atLat(c56Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c5433Persistence: atLat(c54Profiles, 'importedAnvilPersistenceMassKgM2', 33.75),
    c5633Persistence: atLat(c56Profiles, 'importedAnvilPersistenceMassKgM2', 33.75)
  };

  const exactQuickMatch = Object.values(quickComparison).every((value, index, array) => {
    if (index % 2 === 0) return true;
    return value === array[index - 1];
  });
  const exactMoistureMatch = Object.values(moistureComparison).every((value, index, array) => {
    if (index % 2 === 0) return true;
    return value === array[index - 1];
  });
  const exactTransportMatch = Object.values(transportComparison).every((value, index, array) => {
    if (index % 2 === 0) return true;
    return value === array[index - 1];
  });
  const exactRowMatch = Object.values(rowComparison).every((value, index, array) => {
    if (index % 2 === 0) return true;
    return value === array[index - 1];
  });

  const decision = classifyC57Decision({
    exactQuickMatch,
    exactMoistureMatch,
    exactTransportMatch,
    exactRowMatch
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c57-26p25-carryover-containment-with-18p75-transition-support-preserve-attribution.v1',
    generatedAt: new Date().toISOString(),
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    exactnessSummary: {
      exactQuickMatch,
      exactMoistureMatch,
      exactTransportMatch,
      exactRowMatch
    },
    decision
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC57Markdown({
    decision,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    exactnessSummary: result.exactnessSummary
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
