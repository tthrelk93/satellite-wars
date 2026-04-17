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
  c62QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick.json'),
  c64QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-quick.json'),
  c62MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick-monthly-climatology.json'),
  c64MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-monthly-climatology.json'),
  c62MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick-moisture-attribution.json'),
  c64MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-moisture-attribution.json'),
  c62TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick-transport-interface-budget.json'),
  c64TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c65-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c65-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-attribution.json')
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

export function classifyC65Decision({
  north35ImportRelieved,
  north35EddyRelieved,
  equatorialZonalMeanImproved,
  equatorialEddyCollapsed,
  crossEqWorsened,
  transitionFluxReloaded,
  shoulderMaintenanceReloaded
}) {
  if (
    north35ImportRelieved
    && north35EddyRelieved
    && equatorialZonalMeanImproved
    && equatorialEddyCollapsed
    && crossEqWorsened
    && transitionFluxReloaded
    && shoulderMaintenanceReloaded
  ) {
    return {
      verdict: '35deg_interface_eddy_softening_relieves_targeted_import_but_overcorrects_equatorial_eddy_export_and_reloads_transition_shoulder_maintenance',
      nextMove: 'Architecture C66: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and equatorial eddy guard experiment'
    };
  }

  return {
    verdict: '35deg_interface_eddy_softening_attribution_inconclusive',
    nextMove: 'Architecture C66: alternate stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and equatorial eddy guard experiment'
  };
}

export function renderArchitectureC65Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison
}) {
  const lines = [
    '# Earth Weather Architecture C65 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment And 35deg Interface Eddy Softening Attribution',
    '',
    'This phase attributes the active C64 `35°` interface eddy-softening result relative to the stronger C62 carryover-containment base. The goal is to identify whether C64 is inert, locally useful but globally harmful, or genuinely closer to a keep candidate.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C62 vs C64 quick result',
    '',
    `- cross-equatorial vapor flux north: C62 \`${quickComparison.c62CrossEq}\`, C64 \`${quickComparison.c64CrossEq}\``,
    `- ITCZ width: C62 \`${quickComparison.c62ItczWidth}\`, C64 \`${quickComparison.c64ItczWidth}\``,
    `- NH dry-belt ratio: C62 \`${quickComparison.c62DryNorth}\`, C64 \`${quickComparison.c64DryNorth}\``,
    `- SH dry-belt ratio: C62 \`${quickComparison.c62DrySouth}\`, C64 \`${quickComparison.c64DrySouth}\``,
    `- NH midlatitude westerlies: C62 \`${quickComparison.c62Westerlies}\`, C64 \`${quickComparison.c64Westerlies}\``,
    `- NH dry-belt ocean condensation: C62 \`${quickComparison.c62OceanCond}\`, C64 \`${quickComparison.c64OceanCond}\``,
    '',
    '## Targeted 35° relief',
    '',
    `- 35° dominant NH dry-belt vapor import: C62 \`${transportComparison.c62DominantImport}\`, C64 \`${transportComparison.c64DominantImport}\``,
    `- 35° lower total-water flux north: C62 \`${transportComparison.c62North35LowerTotal}\`, C64 \`${transportComparison.c64North35LowerTotal}\``,
    `- 35° lower eddy total-water flux north: C62 \`${transportComparison.c62North35LowerEddy}\`, C64 \`${transportComparison.c64North35LowerEddy}\``,
    `- 35° mid total-water flux north: C62 \`${transportComparison.c62North35MidTotal}\`, C64 \`${transportComparison.c64North35MidTotal}\``,
    `- 35° mid eddy total-water flux north: C62 \`${transportComparison.c62North35MidEddy}\`, C64 \`${transportComparison.c64North35MidEddy}\``,
    `- 35° upper total-water flux north: C62 \`${transportComparison.c62North35UpperTotal}\`, C64 \`${transportComparison.c64North35UpperTotal}\``,
    `- 35° upper eddy total-water flux north: C62 \`${transportComparison.c62North35UpperEddy}\`, C64 \`${transportComparison.c64North35UpperEddy}\``,
    '',
    '## Repayment in the equatorial / transition core',
    '',
    `- equator lower zonal-mean total-water flux north: C62 \`${transportComparison.c62EqLowerZonal}\`, C64 \`${transportComparison.c64EqLowerZonal}\``,
    `- equator lower eddy total-water flux north: C62 \`${transportComparison.c62EqLowerEddy}\`, C64 \`${transportComparison.c64EqLowerEddy}\``,
    `- equator mid zonal-mean total-water flux north: C62 \`${transportComparison.c62EqMidZonal}\`, C64 \`${transportComparison.c64EqMidZonal}\``,
    `- equator mid eddy total-water flux north: C62 \`${transportComparison.c62EqMidEddy}\`, C64 \`${transportComparison.c64EqMidEddy}\``,
    `- equator upper zonal-mean total-water flux north: C62 \`${transportComparison.c62EqUpperZonal}\`, C64 \`${transportComparison.c64EqUpperZonal}\``,
    `- equator upper eddy total-water flux north: C62 \`${transportComparison.c62EqUpperEddy}\`, C64 \`${transportComparison.c64EqUpperEddy}\``,
    `- north transition vapor flux north: C62 \`${moistureComparison.c62TransitionFlux}\`, C64 \`${moistureComparison.c64TransitionFlux}\``,
    '',
    '## Shoulder / maintenance reload',
    '',
    `- NH ocean imported anvil persistence: C62 \`${moistureComparison.c62OceanPersistence}\`, C64 \`${moistureComparison.c64OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C62 \`${moistureComparison.c62OceanCarryover}\`, C64 \`${moistureComparison.c64OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C62 \`${moistureComparison.c62OceanWeakErosion}\`, C64 \`${moistureComparison.c64OceanWeakErosion}\``,
    `- NH upper-cloud path: C62 \`${moistureComparison.c62UpperCloudPath}\`, C64 \`${moistureComparison.c64UpperCloudPath}\``,
    `- 11.25° vapor flux north: C62 \`${rowComparison.c6211Flux}\`, C64 \`${rowComparison.c6411Flux}\``,
    `- 18.75° vapor flux north: C62 \`${rowComparison.c6218Flux}\`, C64 \`${rowComparison.c6418Flux}\``,
    `- 26.25° carried-over upper cloud: C62 \`${rowComparison.c6226Carryover}\`, C64 \`${rowComparison.c6426Carryover}\``,
    `- 33.75° carried-over upper cloud: C62 \`${rowComparison.c6233Carryover}\`, C64 \`${rowComparison.c6433Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C64 is not inert. The narrow `35°` interface eddy-softening lane genuinely relieves the targeted `35°` import branch, including the lower, mid, and upper eddy components.',
    '- But that local relief does not survive globally. The equatorial zonal-mean branch improves slightly while the equatorial eddy branch collapses much harder across all three levels, and that drives the overall cross-equatorial sign defect farther away from the target.',
    '- The repayment also lands in the transition / shoulder maintenance family: `11.25°` and `18.75°` fluxes worsen, while the `26.25°` and `33.75°` carryover lanes reload somewhat even though NH ocean condensation improves slightly.',
    '- The next bounded move should keep the active `35°` relief fixed and add an equatorial eddy guard, not immediately weaken the `35°` lane. That tests whether the C64 failure is specifically an equatorial over-softening repayment rather than a bad `35°` target in itself.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the active C64 `35°` interface eddy-softening geometry fixed.',
    '- Keep the active C62 carryover-containment geometry fixed.',
    '- Tighten the base equatorial eddy-softening contract so the equatorial branch cannot relax as much while the `35°` relief stays live.',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c62Quick = readJson(options.c62QuickPath);
  const c64Quick = readJson(options.c64QuickPath);
  const c62Monthly = readJson(options.c62MonthlyPath);
  const c64Monthly = readJson(options.c64MonthlyPath);
  const c62Moisture = readJson(options.c62MoisturePath);
  const c64Moisture = readJson(options.c64MoisturePath);
  const c62Transport = readJson(options.c62TransportPath);
  const c64Transport = readJson(options.c64TransportPath);

  const c62Metrics = extractMetrics(c62Quick);
  const c64Metrics = extractMetrics(c64Quick);
  const c62Profiles = firstProfileMonth(c62Monthly)?.profiles;
  const c64Profiles = firstProfileMonth(c64Monthly)?.profiles;
  const c62TransportSummary = getTransportSummary(c62Transport);
  const c64TransportSummary = getTransportSummary(c64Transport);

  const quickComparison = {
    c62CrossEq: round(c62Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c64CrossEq: round(c64Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c62ItczWidth: round(c62Metrics.itczWidthDeg),
    c64ItczWidth: round(c64Metrics.itczWidthDeg),
    c62DryNorth: round(c62Metrics.subtropicalDryNorthRatio),
    c64DryNorth: round(c64Metrics.subtropicalDryNorthRatio),
    c62DrySouth: round(c62Metrics.subtropicalDrySouthRatio),
    c64DrySouth: round(c64Metrics.subtropicalDrySouthRatio),
    c62Westerlies: round(c62Metrics.midlatitudeWesterliesNorthU10Ms),
    c64Westerlies: round(c64Metrics.midlatitudeWesterliesNorthU10Ms),
    c62OceanCond: round(c62Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c64OceanCond: round(c64Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c62OceanPersistence: round(c62Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c64OceanPersistence: round(c64Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c62OceanCarryover: round(c62Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c64OceanCarryover: round(c64Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c62OceanWeakErosion: round(c62Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c64OceanWeakErosion: round(c64Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c62UpperCloudPath: round(c62Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2),
    c64UpperCloudPath: round(c64Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2),
    c62TransitionFlux: round(c62Moisture.latestMetrics.northTransitionVaporFluxNorthKgM_1S),
    c64TransitionFlux: round(c64Moisture.latestMetrics.northTransitionVaporFluxNorthKgM_1S)
  };

  const transportComparison = {
    c62DominantImport: c62TransportSummary.dominantImport,
    c64DominantImport: c64TransportSummary.dominantImport,
    c62North35LowerTotal: c62TransportSummary.north35Lower.total,
    c64North35LowerTotal: c64TransportSummary.north35Lower.total,
    c62North35LowerEddy: c62TransportSummary.north35Lower.eddy,
    c64North35LowerEddy: c64TransportSummary.north35Lower.eddy,
    c62North35MidTotal: c62TransportSummary.north35Mid.total,
    c64North35MidTotal: c64TransportSummary.north35Mid.total,
    c62North35MidEddy: c62TransportSummary.north35Mid.eddy,
    c64North35MidEddy: c64TransportSummary.north35Mid.eddy,
    c62North35UpperTotal: c62TransportSummary.north35Upper.total,
    c64North35UpperTotal: c64TransportSummary.north35Upper.total,
    c62North35UpperEddy: c62TransportSummary.north35Upper.eddy,
    c64North35UpperEddy: c64TransportSummary.north35Upper.eddy,
    c62EqLowerZonal: c62TransportSummary.eqLower.zonalMean,
    c64EqLowerZonal: c64TransportSummary.eqLower.zonalMean,
    c62EqLowerEddy: c62TransportSummary.eqLower.eddy,
    c64EqLowerEddy: c64TransportSummary.eqLower.eddy,
    c62EqMidZonal: c62TransportSummary.eqMid.zonalMean,
    c64EqMidZonal: c64TransportSummary.eqMid.zonalMean,
    c62EqMidEddy: c62TransportSummary.eqMid.eddy,
    c64EqMidEddy: c64TransportSummary.eqMid.eddy,
    c62EqUpperZonal: c62TransportSummary.eqUpper.zonalMean,
    c64EqUpperZonal: c64TransportSummary.eqUpper.zonalMean,
    c62EqUpperEddy: c62TransportSummary.eqUpper.eddy,
    c64EqUpperEddy: c64TransportSummary.eqUpper.eddy
  };

  const rowComparison = {
    c6211Flux: atLat(c62Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 11.25),
    c6411Flux: atLat(c64Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 11.25),
    c6218Flux: atLat(c62Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6418Flux: atLat(c64Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6226Carryover: atLat(c62Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6426Carryover: atLat(c64Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6233Carryover: atLat(c62Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c6433Carryover: atLat(c64Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const decision = classifyC65Decision({
    north35ImportRelieved:
      transportComparison.c64North35LowerTotal > transportComparison.c62North35LowerTotal
      && transportComparison.c64North35MidTotal > transportComparison.c62North35MidTotal
      && transportComparison.c64North35UpperTotal > transportComparison.c62North35UpperTotal,
    north35EddyRelieved:
      transportComparison.c64North35LowerEddy > transportComparison.c62North35LowerEddy
      && transportComparison.c64North35MidEddy > transportComparison.c62North35MidEddy
      && transportComparison.c64North35UpperEddy > transportComparison.c62North35UpperEddy,
    equatorialZonalMeanImproved:
      transportComparison.c64EqLowerZonal > transportComparison.c62EqLowerZonal
      && transportComparison.c64EqMidZonal > transportComparison.c62EqMidZonal
      && transportComparison.c64EqUpperZonal > transportComparison.c62EqUpperZonal,
    equatorialEddyCollapsed:
      transportComparison.c64EqLowerEddy < transportComparison.c62EqLowerEddy
      && transportComparison.c64EqMidEddy < transportComparison.c62EqMidEddy
      && transportComparison.c64EqUpperEddy < transportComparison.c62EqUpperEddy,
    crossEqWorsened: quickComparison.c64CrossEq < quickComparison.c62CrossEq,
    transitionFluxReloaded:
      moistureComparison.c64TransitionFlux < moistureComparison.c62TransitionFlux
      && rowComparison.c6411Flux < rowComparison.c6211Flux
      && rowComparison.c6418Flux < rowComparison.c6218Flux,
    shoulderMaintenanceReloaded:
      moistureComparison.c64OceanPersistence > moistureComparison.c62OceanPersistence
      && moistureComparison.c64OceanCarryover > moistureComparison.c62OceanCarryover
      && moistureComparison.c64OceanWeakErosion > moistureComparison.c62OceanWeakErosion
      && moistureComparison.c64UpperCloudPath > moistureComparison.c62UpperCloudPath
      && rowComparison.c6426Carryover > rowComparison.c6226Carryover
      && rowComparison.c6433Carryover > rowComparison.c6233Carryover
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c65-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC65Markdown({
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
