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
  c32TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-transport-interface-budget.json'),
  c40TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json'),
  c32HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-hadley-partition-summary.json'),
  c40HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-hadley-partition-summary.json'),
  c32MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-moisture-attribution.json'),
  c40MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-moisture-attribution.json'),
  c32MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c32ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-thermodynamic-support-summary.json'),
  c40ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c41-transition-band-organized-support-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c41-transition-band-organized-support-restore-attribution.json')
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
const latestMetrics = (auditJson) => auditJson?.samples?.[auditJson.samples.length - 1]?.metrics || {};
const getInterface = (budget, targetLatDeg) => budget.interfaces.find((entry) => entry.targetLatDeg === targetLatDeg);
const getBand = (budget, targetLatDeg, bandKey) => getInterface(budget, targetLatDeg)?.levelBands?.[bandKey] || null;
const firstProfileMonth = (monthlyJson) => monthlyJson.find((entry) => entry?.profiles?.latitudesDeg && entry?.profiles?.series) || null;
const atLat = (profiles, key, targetLatDeg) => {
  const index = profiles.latitudesDeg.indexOf(targetLatDeg);
  if (index === -1) return null;
  const value = profiles.series?.[key]?.[index];
  return round(value);
};
const overrideAtLat = (profiles, targetLatDeg) => ({
  hits: atLat(profiles, 'carryInputOverrideAccumHitCount', targetLatDeg),
  removed: atLat(profiles, 'carryInputOverrideAccumRemovedMassKgM2', targetLatDeg)
});

export function classifyC41Decision({
  c32CrossEq,
  c40CrossEq,
  c32EqLower,
  c40EqLower,
  c32EqMid,
  c40EqMid,
  c32EqUpper,
  c40EqUpper,
  c32EqLowerEddy,
  c40EqLowerEddy,
  c32EqMidEddy,
  c40EqMidEddy,
  c32EqUpperEddy,
  c40EqUpperEddy,
  c32OceanCond,
  c40OceanCond,
  c3226Carryover,
  c4026Carryover,
  c3233Carryover,
  c4033Carryover,
  c3226Hits,
  c4026Hits,
  c3233Hits,
  c4033Hits
}) {
  const signDefectSlightlyRelieved =
    Number.isFinite(c32CrossEq) && Number.isFinite(c40CrossEq) && c40CrossEq > c32CrossEq;
  const lowerBranchWorsened =
    Number.isFinite(c32EqLower) && Number.isFinite(c40EqLower) && c40EqLower < c32EqLower
    && Number.isFinite(c32EqLowerEddy) && Number.isFinite(c40EqLowerEddy) && c40EqLowerEddy < c32EqLowerEddy;
  const midUpperImproved =
    Number.isFinite(c32EqMid) && Number.isFinite(c40EqMid) && c40EqMid > c32EqMid
    && Number.isFinite(c32EqUpper) && Number.isFinite(c40EqUpper) && c40EqUpper > c32EqUpper
    && Number.isFinite(c32EqMidEddy) && Number.isFinite(c40EqMidEddy) && c40EqMidEddy > c32EqMidEddy
    && Number.isFinite(c32EqUpperEddy) && Number.isFinite(c40EqUpperEddy) && c40EqUpperEddy > c32EqUpperEddy;
  const receiverReloaded =
    Number.isFinite(c32OceanCond) && Number.isFinite(c40OceanCond) && c40OceanCond > c32OceanCond
    && Number.isFinite(c3226Carryover) && Number.isFinite(c4026Carryover) && c4026Carryover > c3226Carryover
    && Number.isFinite(c3233Carryover) && Number.isFinite(c4033Carryover) && c4033Carryover < c3233Carryover;
  const overrideShiftedEquatorward =
    Number.isFinite(c3226Hits) && Number.isFinite(c4026Hits) && c4026Hits > c3226Hits
    && Number.isFinite(c3233Hits) && Number.isFinite(c4033Hits) && c4033Hits < c3233Hits;

  if (signDefectSlightlyRelieved && lowerBranchWorsened && midUpperImproved && receiverReloaded && overrideShiftedEquatorward) {
    return {
      verdict: 'transition_band_restore_shifts_override_equatorward_and_slightly_relieves_sign_defect_but_reloads_26p25_receiver_lane',
      nextMove: 'Architecture C42: equatorward-transition organized-support restore experiment'
    };
  }

  return {
    verdict: 'transition_band_organized_support_restore_attribution_inconclusive',
    nextMove: 'Architecture C42: broader transition-band follow-up experiment'
  };
}

export function renderArchitectureC41Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  latitudeShiftComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C41 Transition-Band Organized-Support Restore Attribution',
    '',
    'This phase attributes the C40 transition-band organized-support restore relative to the strict C32 carveout. The question is whether activating the live transition rows improved the right transport subset cleanly, or whether it simply shifted the receiver burden equatorward into a different dry-belt lane.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C32 vs C40 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C32 \`${quickComparison.c32CrossEq}\`, C40 \`${quickComparison.c40CrossEq}\``,
    `- ITCZ width: C32 \`${quickComparison.c32ItczWidth}\`, C40 \`${quickComparison.c40ItczWidth}\``,
    `- NH dry-belt ratio: C32 \`${quickComparison.c32DryNorth}\`, C40 \`${quickComparison.c40DryNorth}\``,
    `- SH dry-belt ratio: C32 \`${quickComparison.c32DrySouth}\`, C40 \`${quickComparison.c40DrySouth}\``,
    `- NH midlatitude westerlies: C32 \`${quickComparison.c32Westerlies}\`, C40 \`${quickComparison.c40Westerlies}\``,
    `- NH dry-belt ocean condensation: C32 \`${quickComparison.c32OceanCond}\`, C40 \`${quickComparison.c40OceanCond}\``,
    '',
    '## Equatorial transport repartition',
    '',
    `- equator lower total-water flux north: C32 \`${transportComparison.c32EqLower}\`, C40 \`${transportComparison.c40EqLower}\``,
    `- equator mid total-water flux north: C32 \`${transportComparison.c32EqMid}\`, C40 \`${transportComparison.c40EqMid}\``,
    `- equator upper total-water flux north: C32 \`${transportComparison.c32EqUpper}\`, C40 \`${transportComparison.c40EqUpper}\``,
    `- equator lower zonal-mean transport: C32 \`${transportComparison.c32EqLowerZonal}\`, C40 \`${transportComparison.c40EqLowerZonal}\``,
    `- equator lower eddy transport: C32 \`${transportComparison.c32EqLowerEddy}\`, C40 \`${transportComparison.c40EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C32 \`${transportComparison.c32EqMidZonal}\`, C40 \`${transportComparison.c40EqMidZonal}\``,
    `- equator mid eddy transport: C32 \`${transportComparison.c32EqMidEddy}\`, C40 \`${transportComparison.c40EqMidEddy}\``,
    `- equator upper zonal-mean transport: C32 \`${transportComparison.c32EqUpperZonal}\`, C40 \`${transportComparison.c40EqUpperZonal}\``,
    `- equator upper eddy transport: C32 \`${transportComparison.c32EqUpperEddy}\`, C40 \`${transportComparison.c40EqUpperEddy}\``,
    `- 35° lower vapor import: C32 \`${transportComparison.c32DryLower35}\`, C40 \`${transportComparison.c40DryLower35}\``,
    `- 35° mid vapor import: C32 \`${transportComparison.c32DryMid35}\`, C40 \`${transportComparison.c40DryMid35}\``,
    `- 35° upper vapor import: C32 \`${transportComparison.c32DryUpper35}\`, C40 \`${transportComparison.c40DryUpper35}\``,
    '',
    '## Dry-belt receiver / return shift',
    '',
    `- carried-over upper cloud: C32 \`${dryBeltComparison.c32Carryover}\`, C40 \`${dryBeltComparison.c40Carryover}\``,
    `- imported anvil persistence: C32 \`${dryBeltComparison.c32Persistence}\`, C40 \`${dryBeltComparison.c40Persistence}\``,
    `- weak-erosion survival: C32 \`${dryBeltComparison.c32WeakErosion}\`, C40 \`${dryBeltComparison.c40WeakErosion}\``,
    `- upper-cloud path: C32 \`${dryBeltComparison.c32UpperCloudPath}\`, C40 \`${dryBeltComparison.c40UpperCloudPath}\``,
    `- dominant vapor import: C32 \`${dryBeltComparison.c32DominantVaporImport}\`, C40 \`${dryBeltComparison.c40DominantVaporImport}\``,
    `- cloud recirculation proxy: C32 \`${dryBeltComparison.c32CloudRecirc}\`, C40 \`${dryBeltComparison.c40CloudRecirc}\``,
    `- return-branch mass flux: C32 \`${dryBeltComparison.c32NorthReturn}\`, C40 \`${dryBeltComparison.c40NorthReturn}\``,
    '',
    '## Latitude-resolved override shift',
    '',
    `- 26.25° accumulated override hits: C32 \`${latitudeShiftComparison.c3226Hits}\`, C40 \`${latitudeShiftComparison.c4026Hits}\``,
    `- 33.75° accumulated override hits: C32 \`${latitudeShiftComparison.c3233Hits}\`, C40 \`${latitudeShiftComparison.c4033Hits}\``,
    `- 26.25° accumulated removed mass: C32 \`${latitudeShiftComparison.c3226Removed}\`, C40 \`${latitudeShiftComparison.c4026Removed}\``,
    `- 33.75° accumulated removed mass: C32 \`${latitudeShiftComparison.c3233Removed}\`, C40 \`${latitudeShiftComparison.c4033Removed}\``,
    `- 26.25° carried-over upper cloud: C32 \`${latitudeShiftComparison.c3226Carryover}\`, C40 \`${latitudeShiftComparison.c4026Carryover}\``,
    `- 33.75° carried-over upper cloud: C32 \`${latitudeShiftComparison.c3233Carryover}\`, C40 \`${latitudeShiftComparison.c4033Carryover}\``,
    '',
    '## Thermodynamic shift',
    '',
    `- C32 primary regime: \`${thermodynamicComparison.c32PrimaryRegime}\``,
    `- C40 primary regime: \`${thermodynamicComparison.c40PrimaryRegime}\``,
    `- C32 dynamics support score: \`${thermodynamicComparison.c32DynamicsSupport}\``,
    `- C40 dynamics support score: \`${thermodynamicComparison.c40DynamicsSupport}\``,
    `- C32 moisture support score: \`${thermodynamicComparison.c32MoistureSupport}\``,
    `- C40 moisture support score: \`${thermodynamicComparison.c40MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- The transition-band restore is active: it no longer reproduces the strict C32 quick state exactly.',
    '- It slightly relieves the cross-equatorial sign defect and improves the mid-upper / 35° zonal-mean side, so the geometry is hitting a live transport subset.',
    '- But the equatorial lower branch gets worse and the NH receiver side reopens modestly.',
    '- The latitude-resolved signal explains why: activity shifts away from `33.75°` and into `26.25°`, which reloads the inner dry-belt receiver lane rather than cleanly resolving the defect.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 core carveout fixed.',
    '- Preserve the fact that the active geometry must reach the transition band, not the equatorial core.',
    '- Narrow the restore equatorward so it can still touch `18.75°`-class transition cells while backing away from the `26.25°` receiver lane.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c32Quick = readJson(options.c32QuickPath);
  const c40Quick = readJson(options.c40QuickPath);
  const c32Transport = readJson(options.c32TransportPath);
  const c40Transport = readJson(options.c40TransportPath);
  const c32Hadley = readJson(options.c32HadleyPath);
  const c40Hadley = readJson(options.c40HadleyPath);
  const c32Moisture = readJson(options.c32MoisturePath);
  const c40Moisture = readJson(options.c40MoisturePath);
  const c32Monthly = readJson(options.c32MonthlyPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c32Thermo = readJson(options.c32ThermoPath);
  const c40Thermo = readJson(options.c40ThermoPath);

  const c32Metrics = latestMetrics(c32Quick);
  const c40Metrics = latestMetrics(c40Quick);
  const c32EqLower = getBand(c32Transport, 0, 'lowerTroposphere');
  const c40EqLower = getBand(c40Transport, 0, 'lowerTroposphere');
  const c32EqMid = getBand(c32Transport, 0, 'midTroposphere');
  const c40EqMid = getBand(c40Transport, 0, 'midTroposphere');
  const c32EqUpper = getBand(c32Transport, 0, 'upperTroposphere');
  const c40EqUpper = getBand(c40Transport, 0, 'upperTroposphere');
  const c3235Lower = getBand(c32Transport, 35, 'lowerTroposphere');
  const c4035Lower = getBand(c40Transport, 35, 'lowerTroposphere');
  const c3235Mid = getBand(c32Transport, 35, 'midTroposphere');
  const c4035Mid = getBand(c40Transport, 35, 'midTroposphere');
  const c3235Upper = getBand(c32Transport, 35, 'upperTroposphere');
  const c4035Upper = getBand(c40Transport, 35, 'upperTroposphere');
  const c32ProfileMonth = firstProfileMonth(c32Monthly)?.profiles;
  const c40ProfileMonth = firstProfileMonth(c40Monthly)?.profiles;
  const c32ThermoClass = c32Thermo.classification || {};
  const c40ThermoClass = c40Thermo.classification || {};

  const quickComparison = {
    c32CrossEq: round(c32Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c40CrossEq: round(c40Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c32ItczWidth: round(c32Metrics.itczWidthDeg),
    c40ItczWidth: round(c40Metrics.itczWidthDeg),
    c32DryNorth: round(c32Metrics.subtropicalDryNorthRatio),
    c40DryNorth: round(c40Metrics.subtropicalDryNorthRatio),
    c32DrySouth: round(c32Metrics.subtropicalDrySouthRatio),
    c40DrySouth: round(c40Metrics.subtropicalDrySouthRatio),
    c32Westerlies: round(c32Metrics.midlatitudeWesterliesNorthU10Ms),
    c40Westerlies: round(c40Metrics.midlatitudeWesterliesNorthU10Ms),
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c40OceanCond: round(c40Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c32EqLower: round(c32EqLower?.totalWaterFluxNorthKgM_1S),
    c40EqLower: round(c40EqLower?.totalWaterFluxNorthKgM_1S),
    c32EqMid: round(c32EqMid?.totalWaterFluxNorthKgM_1S),
    c40EqMid: round(c40EqMid?.totalWaterFluxNorthKgM_1S),
    c32EqUpper: round(c32EqUpper?.totalWaterFluxNorthKgM_1S),
    c40EqUpper: round(c40EqUpper?.totalWaterFluxNorthKgM_1S),
    c32EqLowerZonal: round(c32EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c40EqLowerZonal: round(c40EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqLowerEddy: round(c32EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c40EqLowerEddy: round(c40EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c32EqMidZonal: round(c32EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c40EqMidZonal: round(c40EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqMidEddy: round(c32EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c40EqMidEddy: round(c40EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c32EqUpperZonal: round(c32EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c40EqUpperZonal: round(c40EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqUpperEddy: round(c32EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c40EqUpperEddy: round(c40EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c32DryLower35: round(c3235Lower?.totalWaterFluxNorthKgM_1S),
    c40DryLower35: round(c4035Lower?.totalWaterFluxNorthKgM_1S),
    c32DryMid35: round(c3235Mid?.totalWaterFluxNorthKgM_1S),
    c40DryMid35: round(c4035Mid?.totalWaterFluxNorthKgM_1S),
    c32DryUpper35: round(c3235Upper?.totalWaterFluxNorthKgM_1S),
    c40DryUpper35: round(c4035Upper?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c32Carryover: round(c32Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c40Carryover: round(c40Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c32Persistence: round(c32Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c40Persistence: round(c40Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c32WeakErosion: round(c32Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c40WeakErosion: round(c40Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c32UpperCloudPath: round(c32Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c40UpperCloudPath: round(c40Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c32DominantVaporImport: round(c32Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S),
    c40DominantVaporImport: round(c40Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S),
    c32CloudRecirc: round(c32Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c40CloudRecirc: round(c40Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c32NorthReturn: round(c32Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c40NorthReturn: round(c40Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S)
  };

  const latitudeShiftComparison = {
    c3226Hits: overrideAtLat(c32ProfileMonth, 26.25).hits,
    c4026Hits: overrideAtLat(c40ProfileMonth, 26.25).hits,
    c3233Hits: overrideAtLat(c32ProfileMonth, 33.75).hits,
    c4033Hits: overrideAtLat(c40ProfileMonth, 33.75).hits,
    c3226Removed: overrideAtLat(c32ProfileMonth, 26.25).removed,
    c4026Removed: overrideAtLat(c40ProfileMonth, 26.25).removed,
    c3233Removed: overrideAtLat(c32ProfileMonth, 33.75).removed,
    c4033Removed: overrideAtLat(c40ProfileMonth, 33.75).removed,
    c3226Carryover: atLat(c32ProfileMonth, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4026Carryover: atLat(c40ProfileMonth, 'carriedOverUpperCloudMassKgM2', 26.25),
    c3233Carryover: atLat(c32ProfileMonth, 'carriedOverUpperCloudMassKgM2', 33.75),
    c4033Carryover: atLat(c40ProfileMonth, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const thermodynamicComparison = {
    c32PrimaryRegime: c32ThermoClass.primaryRegime || null,
    c40PrimaryRegime: c40ThermoClass.primaryRegime || null,
    c32DynamicsSupport: round(c32ThermoClass.dynamicsSupportScore),
    c40DynamicsSupport: round(c40ThermoClass.dynamicsSupportScore),
    c32MoistureSupport: round(c32ThermoClass.moistureSupportScore),
    c40MoistureSupport: round(c40ThermoClass.moistureSupportScore)
  };

  const decision = classifyC41Decision({
    ...quickComparison,
    ...transportComparison,
    ...dryBeltComparison,
    c3226Carryover: latitudeShiftComparison.c3226Carryover,
    c4026Carryover: latitudeShiftComparison.c4026Carryover,
    c3233Carryover: latitudeShiftComparison.c3233Carryover,
    c4033Carryover: latitudeShiftComparison.c4033Carryover,
    c3226Hits: latitudeShiftComparison.c3226Hits,
    c4026Hits: latitudeShiftComparison.c4026Hits,
    c3233Hits: latitudeShiftComparison.c3233Hits,
    c4033Hits: latitudeShiftComparison.c4033Hits
  });

  const nextContract = {
    focusTargets: [
      'keep the strict C32 organized-support / potential carveout in the equatorial core',
      'restore organized-support only in the equatorward transition shoulder around 18°–24°',
      'avoid reopening the 26.25° receiver lane while preserving a live transition-band geometry'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c41-transition-band-organized-support-restore-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickComparison,
    transportComparison,
    dryBeltComparison,
    latitudeShiftComparison,
    thermodynamicComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC41Markdown({
    decision,
    quickComparison,
    transportComparison,
    dryBeltComparison,
    latitudeShiftComparison,
    thermodynamicComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
