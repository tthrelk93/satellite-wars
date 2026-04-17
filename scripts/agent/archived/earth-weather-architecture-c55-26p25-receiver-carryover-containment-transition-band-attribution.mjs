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
  c32QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick.json'),
  c40QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick.json'),
  c54QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick.json'),
  c32MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c54MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-monthly-climatology.json'),
  c40MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-moisture-attribution.json'),
  c54MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-moisture-attribution.json'),
  c40TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json'),
  c54TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c55-26p25-receiver-carryover-containment-transition-band-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c55-26p25-receiver-carryover-containment-transition-band-attribution.json')
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

export function classifyC55Decision({
  receiverReliefActive,
  transitionExportWorsened,
  polewardShoulderReloaded,
  equatorialFluxWorsened
}) {
  if (receiverReliefActive && transitionExportWorsened && polewardShoulderReloaded && equatorialFluxWorsened) {
    return {
      verdict: 'receiver_carryover_containment_relieves_26p25_but_forces_18p75_transition_export_and_33p75_reload',
      nextMove: 'Architecture C56: 26p25 carryover containment with 18p75 transition-support preserve experiment'
    };
  }

  return {
    verdict: 'receiver_carryover_containment_attribution_inconclusive',
    nextMove: 'Architecture C56: alternate 26p25 carryover containment with 18p75 transition-support preserve experiment'
  };
}

export function renderArchitectureC55Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C55 26p25 Receiver Carryover Containment Transition-Band Attribution',
    '',
    'This phase attributes the C54 receiver-lane carryover-containment experiment relative to the live C40 transition-band regime, with strict C32 kept as the receiver-row baseline. The goal is to identify which active response paid for the small `26.25°` receiver relief.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C40 vs C54 quick result',
    '',
    `- cross-equatorial vapor flux north: C40 \`${quickComparison.c40CrossEq}\`, C54 \`${quickComparison.c54CrossEq}\``,
    `- ITCZ width: C40 \`${quickComparison.c40ItczWidth}\`, C54 \`${quickComparison.c54ItczWidth}\``,
    `- NH dry-belt ratio: C40 \`${quickComparison.c40DryNorth}\`, C54 \`${quickComparison.c54DryNorth}\``,
    `- SH dry-belt ratio: C40 \`${quickComparison.c40DrySouth}\`, C54 \`${quickComparison.c54DrySouth}\``,
    `- NH midlatitude westerlies: C40 \`${quickComparison.c40Westerlies}\`, C54 \`${quickComparison.c54Westerlies}\``,
    `- NH dry-belt ocean condensation: C40 \`${quickComparison.c40OceanCond}\`, C54 \`${quickComparison.c54OceanCond}\``,
    '',
    '## C40 vs C54 moisture / transport shift',
    '',
    `- NH ocean imported anvil persistence: C40 \`${moistureComparison.c40OceanPersistence}\`, C54 \`${moistureComparison.c54OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C40 \`${moistureComparison.c40OceanCarryover}\`, C54 \`${moistureComparison.c54OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C40 \`${moistureComparison.c40OceanWeakErosion}\`, C54 \`${moistureComparison.c54OceanWeakErosion}\``,
    `- equator lower total-water flux north: C40 \`${transportComparison.c40EqLower}\`, C54 \`${transportComparison.c54EqLower}\``,
    `- equator mid total-water flux north: C40 \`${transportComparison.c40EqMid}\`, C54 \`${transportComparison.c54EqMid}\``,
    `- equator upper total-water flux north: C40 \`${transportComparison.c40EqUpper}\`, C54 \`${transportComparison.c54EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C40 \`${transportComparison.c40DominantImport}\`, C54 \`${transportComparison.c54DominantImport}\``,
    '',
    '## Latitude-resolved tradeoff',
    '',
    `- 18.75° vapor flux north: C40 \`${rowComparison.c4018Flux}\`, C54 \`${rowComparison.c5418Flux}\``,
    `- 18.75° carried-over upper cloud: C40 \`${rowComparison.c4018Carryover}\`, C54 \`${rowComparison.c5418Carryover}\``,
    `- 26.25° vapor flux north: C40 \`${rowComparison.c4026Flux}\`, C54 \`${rowComparison.c5426Flux}\``,
    `- 26.25° carried-over upper cloud: C32 \`${rowComparison.c3226Carryover}\`, C40 \`${rowComparison.c4026Carryover}\`, C54 \`${rowComparison.c5426Carryover}\``,
    `- 33.75° carried-over upper cloud: C40 \`${rowComparison.c4033Carryover}\`, C54 \`${rowComparison.c5433Carryover}\``,
    `- 33.75° imported anvil persistence: C40 \`${rowComparison.c4033Persistence}\`, C54 \`${rowComparison.c5433Persistence}\``,
    '',
    '## Interpretation',
    '',
    '- C54 is not inert. It slightly relieves the `26.25°` receiver row: local carryover/persistence drop and the `26.25°` northward vapor flux becomes less negative than C40.',
    '- But that relief is paid for in two places. The first is the equatorward transition lane: `18.75°` vapor export becomes more southward and the equator transport stack worsens at every level. The second is the poleward shoulder: `33.75°` carryover and persistence reload above C40.',
    '- So the next bounded move is not more `26.25°` containment. It is to keep the C54 receiver relief while preserving the `18.75°` transition-support lane that appears to be getting starved by that containment.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the `26.25°` receiver carryover containment active.',
    '- Add narrow `18.75°` transition-support preserve so the equatorward transition lane does not pay for the receiver relief.',
    '- Leave the broader transition-band family live while watching the `33.75°` shoulder as a secondary reload risk.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c32Quick = readJson(options.c32QuickPath);
  const c40Quick = readJson(options.c40QuickPath);
  const c54Quick = readJson(options.c54QuickPath);
  const c32Monthly = readJson(options.c32MonthlyPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c54Monthly = readJson(options.c54MonthlyPath);
  const c40Moisture = readJson(options.c40MoisturePath);
  const c54Moisture = readJson(options.c54MoisturePath);
  const c40Transport = readJson(options.c40TransportPath);
  const c54Transport = readJson(options.c54TransportPath);

  const c40Metrics = extractMetrics(c40Quick);
  const c54Metrics = extractMetrics(c54Quick);
  const c32Profiles = firstProfileMonth(c32Monthly)?.profiles;
  const c40Profiles = firstProfileMonth(c40Monthly)?.profiles;
  const c54Profiles = firstProfileMonth(c54Monthly)?.profiles;
  const c40TransportSummary = getTransportSummary(c40Transport);
  const c54TransportSummary = getTransportSummary(c54Transport);

  const quickComparison = {
    c40CrossEq: round(c40Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c54CrossEq: round(c54Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c40ItczWidth: round(c40Metrics.itczWidthDeg),
    c54ItczWidth: round(c54Metrics.itczWidthDeg),
    c40DryNorth: round(c40Metrics.subtropicalDryNorthRatio),
    c54DryNorth: round(c54Metrics.subtropicalDryNorthRatio),
    c40DrySouth: round(c40Metrics.subtropicalDrySouthRatio),
    c54DrySouth: round(c54Metrics.subtropicalDrySouthRatio),
    c40Westerlies: round(c40Metrics.midlatitudeWesterliesNorthU10Ms),
    c54Westerlies: round(c54Metrics.midlatitudeWesterliesNorthU10Ms),
    c40OceanCond: round(c40Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c54OceanCond: round(c54Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c40OceanPersistence: round(c40Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c54OceanPersistence: round(c54Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c40OceanCarryover: round(c40Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c54OceanCarryover: round(c54Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c40OceanWeakErosion: round(c40Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c54OceanWeakErosion: round(c54Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2)
  };

  const transportComparison = {
    c40EqLower: c40TransportSummary.eqLower.total,
    c54EqLower: c54TransportSummary.eqLower.total,
    c40EqMid: c40TransportSummary.eqMid.total,
    c54EqMid: c54TransportSummary.eqMid.total,
    c40EqUpper: c40TransportSummary.eqUpper.total,
    c54EqUpper: c54TransportSummary.eqUpper.total,
    c40DominantImport: c40TransportSummary.dominantImport,
    c54DominantImport: c54TransportSummary.dominantImport
  };

  const rowComparison = {
    c4018Flux: atLat(c40Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c5418Flux: atLat(c54Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c4018Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c5418Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c4026Flux: atLat(c40Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c5426Flux: atLat(c54Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c3226Carryover: atLat(c32Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4026Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5426Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4033Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c5433Carryover: atLat(c54Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c4033Persistence: atLat(c40Profiles, 'importedAnvilPersistenceMassKgM2', 33.75),
    c5433Persistence: atLat(c54Profiles, 'importedAnvilPersistenceMassKgM2', 33.75)
  };

  const receiverReliefActive =
    rowComparison.c5426Carryover < rowComparison.c4026Carryover
    && rowComparison.c5426Flux > rowComparison.c4026Flux;
  const transitionExportWorsened =
    rowComparison.c5418Flux < rowComparison.c4018Flux
    && transportComparison.c54EqLower < transportComparison.c40EqLower
    && transportComparison.c54EqMid < transportComparison.c40EqMid
    && transportComparison.c54EqUpper < transportComparison.c40EqUpper;
  const polewardShoulderReloaded =
    rowComparison.c5433Carryover > rowComparison.c4033Carryover
    && rowComparison.c5433Persistence > rowComparison.c4033Persistence;
  const equatorialFluxWorsened = quickComparison.c54CrossEq < quickComparison.c40CrossEq;

  const decision = classifyC55Decision({
    receiverReliefActive,
    transitionExportWorsened,
    polewardShoulderReloaded,
    equatorialFluxWorsened
  });

  const nextContract = {
    focusTargets: [
      '18.75° transition-band organized-support preserve',
      'equatorward transition carry-input support around 18–22.5°N',
      'keep 26.25° receiver carryover containment active while watching 33.75° shoulder reload'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c55-26p25-receiver-carryover-containment-transition-band-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    receiverReliefActive,
    transitionExportWorsened,
    polewardShoulderReloaded,
    equatorialFluxWorsened,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC55Markdown({
    decision,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
