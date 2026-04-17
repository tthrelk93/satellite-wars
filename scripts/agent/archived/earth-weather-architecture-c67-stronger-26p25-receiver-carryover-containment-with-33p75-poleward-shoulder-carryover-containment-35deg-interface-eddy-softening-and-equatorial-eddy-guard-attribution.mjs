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
  c64QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-quick.json'),
  c66QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-quick.json'),
  c64MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-monthly-climatology.json'),
  c66MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-35deg-interface-eddy-softening-equatorial-guard-quick-monthly-climatology.json'),
  c64MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-moisture-attribution.json'),
  c66MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-35deg-interface-eddy-softening-equatorial-guard-quick-moisture-attribution.json'),
  c64TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-transport-interface-budget.json'),
  c66TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c66-35deg-interface-eddy-softening-equatorial-guard-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c67-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c67-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-attribution.json')
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

export function classifyC67Decision({
  lowerMidEquatorialRelieved,
  north35ReliefPreserved,
  maintenanceRelieved,
  upperEddyStillBinding,
  transitionShoulderFluxReloaded,
  receiverLaneReloaded,
  crossEqStillSevere
}) {
  if (
    lowerMidEquatorialRelieved
    && north35ReliefPreserved
    && maintenanceRelieved
    && upperEddyStillBinding
    && transitionShoulderFluxReloaded
    && receiverLaneReloaded
    && crossEqStillSevere
  ) {
    return {
      verdict: 'equatorial_guard_relieves_lower_mid_core_and_nh_maintenance_but_upper_eddy_and_transition_receiver_flux_remain_primary_blockers',
      nextMove: 'Architecture C68: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and narrower equatorial-core eddy guard experiment'
    };
  }

  return {
    verdict: 'equatorial_guard_attribution_inconclusive',
    nextMove: 'Architecture C68: alternate stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and narrower equatorial-core eddy guard experiment'
  };
}

export function renderArchitectureC67Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison
}) {
  const lines = [
    '# Earth Weather Architecture C67 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment 35deg Interface Eddy Softening And Equatorial Eddy Guard Attribution',
    '',
    'This phase attributes the active C66 equatorial-eddy-guard result relative to C64. The goal is to determine whether the C66 guard is inert, broadly helpful but still insufficient, or actively pushing the climate into a different failure family.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C64 vs C66 quick result',
    '',
    `- cross-equatorial vapor flux north: C64 \`${quickComparison.c64CrossEq}\`, C66 \`${quickComparison.c66CrossEq}\``,
    `- ITCZ width: C64 \`${quickComparison.c64ItczWidth}\`, C66 \`${quickComparison.c66ItczWidth}\``,
    `- NH dry-belt ratio: C64 \`${quickComparison.c64DryNorth}\`, C66 \`${quickComparison.c66DryNorth}\``,
    `- SH dry-belt ratio: C64 \`${quickComparison.c64DrySouth}\`, C66 \`${quickComparison.c66DrySouth}\``,
    `- NH midlatitude westerlies: C64 \`${quickComparison.c64Westerlies}\`, C66 \`${quickComparison.c66Westerlies}\``,
    `- NH dry-belt ocean condensation: C64 \`${quickComparison.c64OceanCond}\`, C66 \`${quickComparison.c66OceanCond}\``,
    '',
    '## Preserved relief',
    '',
    `- 35° dominant NH dry-belt vapor import: C64 \`${transportComparison.c64DominantImport}\`, C66 \`${transportComparison.c66DominantImport}\``,
    `- 35° lower eddy total-water flux north: C64 \`${transportComparison.c64North35LowerEddy}\`, C66 \`${transportComparison.c66North35LowerEddy}\``,
    `- 35° mid eddy total-water flux north: C64 \`${transportComparison.c64North35MidEddy}\`, C66 \`${transportComparison.c66North35MidEddy}\``,
    `- 35° upper eddy total-water flux north: C64 \`${transportComparison.c64North35UpperEddy}\`, C66 \`${transportComparison.c66North35UpperEddy}\``,
    `- equator lower eddy total-water flux north: C64 \`${transportComparison.c64EqLowerEddy}\`, C66 \`${transportComparison.c66EqLowerEddy}\``,
    `- equator mid eddy total-water flux north: C64 \`${transportComparison.c64EqMidEddy}\`, C66 \`${transportComparison.c66EqMidEddy}\``,
    `- equator lower zonal-mean total-water flux north: C64 \`${transportComparison.c64EqLowerZonal}\`, C66 \`${transportComparison.c66EqLowerZonal}\``,
    `- equator mid zonal-mean total-water flux north: C64 \`${transportComparison.c64EqMidZonal}\`, C66 \`${transportComparison.c66EqMidZonal}\``,
    '',
    '## Remaining blocker',
    '',
    `- equator upper zonal-mean total-water flux north: C64 \`${transportComparison.c64EqUpperZonal}\`, C66 \`${transportComparison.c66EqUpperZonal}\``,
    `- equator upper eddy total-water flux north: C64 \`${transportComparison.c64EqUpperEddy}\`, C66 \`${transportComparison.c66EqUpperEddy}\``,
    `- 11.25° vapor flux north: C64 \`${rowComparison.c6411Flux}\`, C66 \`${rowComparison.c6611Flux}\``,
    `- 18.75° vapor flux north: C64 \`${rowComparison.c6418Flux}\`, C66 \`${rowComparison.c6618Flux}\``,
    `- 26.25° vapor flux north: C64 \`${rowComparison.c6426Flux}\`, C66 \`${rowComparison.c6626Flux}\``,
    `- 33.75° vapor flux north: C64 \`${rowComparison.c6433Flux}\`, C66 \`${rowComparison.c6633Flux}\``,
    `- 26.25° carried-over upper cloud: C64 \`${rowComparison.c6426Carryover}\`, C66 \`${rowComparison.c6626Carryover}\``,
    '',
    '## Maintenance relief',
    '',
    `- NH ocean imported anvil persistence: C64 \`${moistureComparison.c64OceanPersistence}\`, C66 \`${moistureComparison.c66OceanPersistence}\``,
    `- NH ocean carried-over upper cloud: C64 \`${moistureComparison.c64OceanCarryover}\`, C66 \`${moistureComparison.c66OceanCarryover}\``,
    `- NH ocean weak-erosion survival: C64 \`${moistureComparison.c64OceanWeakErosion}\`, C66 \`${moistureComparison.c66OceanWeakErosion}\``,
    `- NH upper-cloud path: C64 \`${moistureComparison.c64UpperCloudPath}\`, C66 \`${moistureComparison.c66UpperCloudPath}\``,
    `- north transition vapor flux north: C64 \`${moistureComparison.c64TransitionFlux}\`, C66 \`${moistureComparison.c66TransitionFlux}\``,
    `- 18.75° carried-over upper cloud: C64 \`${rowComparison.c6418Carryover}\`, C66 \`${rowComparison.c6618Carryover}\``,
    `- 33.75° carried-over upper cloud: C64 \`${rowComparison.c6433Carryover}\`, C66 \`${rowComparison.c6633Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C66 is not inert. Tightening the base equatorial guard materially improves the lower and mid equatorial branches while preserving and even strengthening the targeted `35°` eddy-import relief.',
    '- The NH dry-belt ocean maintenance family also improves: imported persistence, carryover, weak-erosion survival, upper-cloud path, and the north-transition vapor burden all move in the right direction relative to C64.',
    '- But the remaining blocker is now tighter and more specific. The equatorial upper eddy branch does not improve, and the transition / shoulder vapor-flux rows at `11.25°`, `18.75°`, `26.25°`, and `33.75°` all move more negative even while `18.75°` and `33.75°` carryover improve.',
    '- The `26.25°` receiver lane is also still live: its carryover reloads slightly under C66. So the next bounded move should narrow the equatorial guard toward the core, not abandon the C66 family or weaken the active `35°` lane.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the active C66 `35°` interface eddy-softening branch fixed.',
    '- Keep the active C66 stronger `26.25°` and `33.75°` carryover containment branch fixed.',
    '- Narrow the equatorial guard from the outer shoulder toward the inner core to test whether the remaining repayment is living outside the core support window.',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c64Quick = readJson(options.c64QuickPath);
  const c66Quick = readJson(options.c66QuickPath);
  const c64Monthly = readJson(options.c64MonthlyPath);
  const c66Monthly = readJson(options.c66MonthlyPath);
  const c64Moisture = readJson(options.c64MoisturePath);
  const c66Moisture = readJson(options.c66MoisturePath);
  const c64Transport = readJson(options.c64TransportPath);
  const c66Transport = readJson(options.c66TransportPath);

  const c64Metrics = extractMetrics(c64Quick);
  const c66Metrics = extractMetrics(c66Quick);
  const c64Profiles = firstProfileMonth(c64Monthly)?.profiles;
  const c66Profiles = firstProfileMonth(c66Monthly)?.profiles;
  const c64TransportSummary = getTransportSummary(c64Transport);
  const c66TransportSummary = getTransportSummary(c66Transport);

  const quickComparison = {
    c64CrossEq: round(c64Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c66CrossEq: round(c66Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c64ItczWidth: round(c64Metrics.itczWidthDeg),
    c66ItczWidth: round(c66Metrics.itczWidthDeg),
    c64DryNorth: round(c64Metrics.subtropicalDryNorthRatio),
    c66DryNorth: round(c66Metrics.subtropicalDryNorthRatio),
    c64DrySouth: round(c64Metrics.subtropicalDrySouthRatio),
    c66DrySouth: round(c66Metrics.subtropicalDrySouthRatio),
    c64Westerlies: round(c64Metrics.midlatitudeWesterliesNorthU10Ms),
    c66Westerlies: round(c66Metrics.midlatitudeWesterliesNorthU10Ms),
    c64OceanCond: round(c64Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c66OceanCond: round(c66Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c64OceanPersistence: round(c64Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c66OceanPersistence: round(c66Moisture.latestMetrics.northDryBeltOceanImportedAnvilPersistenceMeanKgM2),
    c64OceanCarryover: round(c64Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c66OceanCarryover: round(c66Moisture.latestMetrics.northDryBeltOceanCarriedOverUpperCloudMeanKgM2),
    c64OceanWeakErosion: round(c64Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c66OceanWeakErosion: round(c66Moisture.latestMetrics.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2),
    c64UpperCloudPath: round(c64Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2),
    c66UpperCloudPath: round(c66Moisture.latestMetrics.northDryBeltUpperCloudPathMeanKgM2),
    c64TransitionFlux: round(c64Moisture.latestMetrics.northTransitionVaporFluxNorthKgM_1S),
    c66TransitionFlux: round(c66Moisture.latestMetrics.northTransitionVaporFluxNorthKgM_1S)
  };

  const transportComparison = {
    c64DominantImport: c64TransportSummary.dominantImport,
    c66DominantImport: c66TransportSummary.dominantImport,
    c64North35LowerEddy: c64TransportSummary.north35Lower.eddy,
    c66North35LowerEddy: c66TransportSummary.north35Lower.eddy,
    c64North35MidEddy: c64TransportSummary.north35Mid.eddy,
    c66North35MidEddy: c66TransportSummary.north35Mid.eddy,
    c64North35UpperEddy: c64TransportSummary.north35Upper.eddy,
    c66North35UpperEddy: c66TransportSummary.north35Upper.eddy,
    c64EqLowerZonal: c64TransportSummary.eqLower.zonalMean,
    c66EqLowerZonal: c66TransportSummary.eqLower.zonalMean,
    c64EqLowerEddy: c64TransportSummary.eqLower.eddy,
    c66EqLowerEddy: c66TransportSummary.eqLower.eddy,
    c64EqMidZonal: c64TransportSummary.eqMid.zonalMean,
    c66EqMidZonal: c66TransportSummary.eqMid.zonalMean,
    c64EqMidEddy: c64TransportSummary.eqMid.eddy,
    c66EqMidEddy: c66TransportSummary.eqMid.eddy,
    c64EqUpperZonal: c64TransportSummary.eqUpper.zonalMean,
    c66EqUpperZonal: c66TransportSummary.eqUpper.zonalMean,
    c64EqUpperEddy: c64TransportSummary.eqUpper.eddy,
    c66EqUpperEddy: c66TransportSummary.eqUpper.eddy
  };

  const rowComparison = {
    c6411Flux: atLat(c64Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 11.25),
    c6611Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 11.25),
    c6418Flux: atLat(c64Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6618Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 18.75),
    c6426Flux: atLat(c64Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c6626Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 26.25),
    c6433Flux: atLat(c64Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 33.75),
    c6633Flux: atLat(c66Profiles, 'verticallyIntegratedVaporFluxNorthKgM_1S', 33.75),
    c6418Carryover: atLat(c64Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c6618Carryover: atLat(c66Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c6426Carryover: atLat(c64Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6626Carryover: atLat(c66Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c6433Carryover: atLat(c64Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c6633Carryover: atLat(c66Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const decision = classifyC67Decision({
    lowerMidEquatorialRelieved:
      transportComparison.c66EqLowerZonal > transportComparison.c64EqLowerZonal
      && transportComparison.c66EqLowerEddy > transportComparison.c64EqLowerEddy
      && transportComparison.c66EqMidZonal > transportComparison.c64EqMidZonal
      && transportComparison.c66EqMidEddy > transportComparison.c64EqMidEddy,
    north35ReliefPreserved:
      transportComparison.c66DominantImport > transportComparison.c64DominantImport
      && transportComparison.c66North35LowerEddy > transportComparison.c64North35LowerEddy
      && transportComparison.c66North35MidEddy > transportComparison.c64North35MidEddy
      && transportComparison.c66North35UpperEddy > transportComparison.c64North35UpperEddy,
    maintenanceRelieved:
      moistureComparison.c66OceanPersistence < moistureComparison.c64OceanPersistence
      && moistureComparison.c66OceanCarryover < moistureComparison.c64OceanCarryover
      && moistureComparison.c66OceanWeakErosion < moistureComparison.c64OceanWeakErosion
      && moistureComparison.c66UpperCloudPath < moistureComparison.c64UpperCloudPath
      && moistureComparison.c66TransitionFlux > moistureComparison.c64TransitionFlux
      && rowComparison.c6618Carryover < rowComparison.c6418Carryover
      && rowComparison.c6633Carryover < rowComparison.c6433Carryover,
    upperEddyStillBinding:
      transportComparison.c66EqUpperEddy <= transportComparison.c64EqUpperEddy,
    transitionShoulderFluxReloaded:
      rowComparison.c6611Flux < rowComparison.c6411Flux
      && rowComparison.c6618Flux < rowComparison.c6418Flux
      && rowComparison.c6626Flux < rowComparison.c6426Flux
      && rowComparison.c6633Flux < rowComparison.c6433Flux,
    receiverLaneReloaded:
      rowComparison.c6626Carryover > rowComparison.c6426Carryover,
    crossEqStillSevere:
      quickComparison.c66CrossEq < 0
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c67-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC67Markdown({
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
