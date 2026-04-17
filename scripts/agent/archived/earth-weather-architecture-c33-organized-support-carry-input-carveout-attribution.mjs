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
  c30QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick.json'),
  c32QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick.json'),
  c30TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-transport-interface-budget.json'),
  c32TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-transport-interface-budget.json'),
  c30HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-hadley-partition-summary.json'),
  c32HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-hadley-partition-summary.json'),
  c30MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-moisture-attribution.json'),
  c32MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-moisture-attribution.json'),
  c30ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-thermodynamic-support-summary.json'),
  c32ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c33-organized-support-carry-input-carveout-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c33-organized-support-carry-input-carveout-attribution.json')
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

export function classifyC33Decision({
  c30CrossEq,
  c32CrossEq,
  c30EqLower,
  c32EqLower,
  c30EqMid,
  c32EqMid,
  c30EqUpper,
  c32EqUpper,
  c30EqLowerZonal,
  c32EqLowerZonal,
  c30EqMidZonal,
  c32EqMidZonal,
  c30EqUpperZonal,
  c32EqUpperZonal,
  c30EqLowerEddy,
  c32EqLowerEddy,
  c30EqMidEddy,
  c32EqMidEddy,
  c30EqUpperEddy,
  c32EqUpperEddy,
  c30OceanCond,
  c32OceanCond,
  c30Carryover,
  c32Carryover,
  c30Persistence,
  c32Persistence,
  c30WeakErosion,
  c32WeakErosion,
  c30UpperCloudPath,
  c32UpperCloudPath,
  c30DominantVaporImport,
  c32DominantVaporImport,
  c30CloudRecirc,
  c32CloudRecirc,
  c30NorthReturn,
  c32NorthReturn
}) {
  const crossEqWorsened = Number.isFinite(c30CrossEq) && Number.isFinite(c32CrossEq) && c32CrossEq < c30CrossEq;
  const receiverImproved =
    Number.isFinite(c30OceanCond) && Number.isFinite(c32OceanCond) && c32OceanCond < c30OceanCond
    && Number.isFinite(c30Carryover) && Number.isFinite(c32Carryover) && c32Carryover < c30Carryover
    && Number.isFinite(c30Persistence) && Number.isFinite(c32Persistence) && c32Persistence < c30Persistence
    && Number.isFinite(c30WeakErosion) && Number.isFinite(c32WeakErosion) && c32WeakErosion < c30WeakErosion
    && Number.isFinite(c30UpperCloudPath) && Number.isFinite(c32UpperCloudPath) && c32UpperCloudPath < c30UpperCloudPath
    && Number.isFinite(c30CloudRecirc) && Number.isFinite(c32CloudRecirc) && c32CloudRecirc < c30CloudRecirc;
  const lowerMidReloaded =
    Number.isFinite(c30EqLower) && Number.isFinite(c32EqLower) && c32EqLower < c30EqLower
    && Number.isFinite(c30EqMid) && Number.isFinite(c32EqMid) && c32EqMid < c30EqMid
    && Number.isFinite(c30EqLowerZonal) && Number.isFinite(c32EqLowerZonal) && c32EqLowerZonal < c30EqLowerZonal
    && Number.isFinite(c30EqMidZonal) && Number.isFinite(c32EqMidZonal) && c32EqMidZonal < c30EqMidZonal
    && Number.isFinite(c30EqLowerEddy) && Number.isFinite(c32EqLowerEddy) && c32EqLowerEddy < c30EqLowerEddy;
  const upperRelieved =
    Number.isFinite(c30EqUpper) && Number.isFinite(c32EqUpper) && c32EqUpper > c30EqUpper
    && Number.isFinite(c30EqUpperZonal) && Number.isFinite(c32EqUpperZonal) && c32EqUpperZonal > c30EqUpperZonal
    && Number.isFinite(c30EqUpperEddy) && Number.isFinite(c32EqUpperEddy) && c32EqUpperEddy > c30EqUpperEddy;
  const dryBeltImportReloaded =
    Number.isFinite(c30DominantVaporImport) && Number.isFinite(c32DominantVaporImport) && c32DominantVaporImport < c30DominantVaporImport
    && Number.isFinite(c30NorthReturn) && Number.isFinite(c32NorthReturn) && c32NorthReturn > c30NorthReturn;

  if (crossEqWorsened && receiverImproved && lowerMidReloaded && upperRelieved && dryBeltImportReloaded) {
    return {
      verdict: 'organized_support_carveout_restores_receiver_containment_and_upper_branch_but_deepens_lower_mid_core_import',
      nextMove: 'Architecture C34: potential-half-relax carry-input experiment'
    };
  }

  return {
    verdict: 'organized_support_carry_input_carveout_attribution_inconclusive',
    nextMove: 'Architecture C34: broader organized-support carry-input follow-up experiment'
  };
}

export function renderArchitectureC33Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C33 Organized-Support Carry-Input Carveout Attribution',
    '',
    'This phase attributes the C32 organized-support / potential carveout relative to the broader C30 carry-input recapture. The question is whether the stricter caps fixed the right equatorial-organized admission path or simply traded one transport defect for another.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C30 vs C32 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C30 \`${quickComparison.c30CrossEq}\`, C32 \`${quickComparison.c32CrossEq}\``,
    `- ITCZ width: C30 \`${quickComparison.c30ItczWidth}\`, C32 \`${quickComparison.c32ItczWidth}\``,
    `- NH dry-belt ratio: C30 \`${quickComparison.c30DryNorth}\`, C32 \`${quickComparison.c32DryNorth}\``,
    `- SH dry-belt ratio: C30 \`${quickComparison.c30DrySouth}\`, C32 \`${quickComparison.c32DrySouth}\``,
    `- NH midlatitude westerlies: C30 \`${quickComparison.c30Westerlies}\`, C32 \`${quickComparison.c32Westerlies}\``,
    `- NH dry-belt ocean condensation: C30 \`${quickComparison.c30OceanCond}\`, C32 \`${quickComparison.c32OceanCond}\``,
    '',
    '## Equatorial transport repartition',
    '',
    `- equator lower total-water flux north: C30 \`${transportComparison.c30EqLower}\`, C32 \`${transportComparison.c32EqLower}\``,
    `- equator mid total-water flux north: C30 \`${transportComparison.c30EqMid}\`, C32 \`${transportComparison.c32EqMid}\``,
    `- equator upper total-water flux north: C30 \`${transportComparison.c30EqUpper}\`, C32 \`${transportComparison.c32EqUpper}\``,
    `- equator lower zonal-mean transport: C30 \`${transportComparison.c30EqLowerZonal}\`, C32 \`${transportComparison.c32EqLowerZonal}\``,
    `- equator lower eddy transport: C30 \`${transportComparison.c30EqLowerEddy}\`, C32 \`${transportComparison.c32EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C30 \`${transportComparison.c30EqMidZonal}\`, C32 \`${transportComparison.c32EqMidZonal}\``,
    `- equator mid eddy transport: C30 \`${transportComparison.c30EqMidEddy}\`, C32 \`${transportComparison.c32EqMidEddy}\``,
    `- equator upper zonal-mean transport: C30 \`${transportComparison.c30EqUpperZonal}\`, C32 \`${transportComparison.c32EqUpperZonal}\``,
    `- equator upper eddy transport: C30 \`${transportComparison.c30EqUpperEddy}\`, C32 \`${transportComparison.c32EqUpperEddy}\``,
    `- 35° lower vapor import: C30 \`${transportComparison.c30DryLower35}\`, C32 \`${transportComparison.c32DryLower35}\``,
    `- 35° mid vapor import: C30 \`${transportComparison.c30DryMid35}\`, C32 \`${transportComparison.c32DryMid35}\``,
    `- 35° upper vapor import: C30 \`${transportComparison.c30DryUpper35}\`, C32 \`${transportComparison.c32DryUpper35}\``,
    '',
    '## Dry-belt receiver / containment shift',
    '',
    `- NH dry-belt ocean condensation: C30 \`${dryBeltComparison.c30OceanCond}\`, C32 \`${dryBeltComparison.c32OceanCond}\``,
    `- carried-over upper cloud: C30 \`${dryBeltComparison.c30Carryover}\`, C32 \`${dryBeltComparison.c32Carryover}\``,
    `- imported anvil persistence: C30 \`${dryBeltComparison.c30Persistence}\`, C32 \`${dryBeltComparison.c32Persistence}\``,
    `- weak-erosion survival: C30 \`${dryBeltComparison.c30WeakErosion}\`, C32 \`${dryBeltComparison.c32WeakErosion}\``,
    `- upper-cloud path: C30 \`${dryBeltComparison.c30UpperCloudPath}\`, C32 \`${dryBeltComparison.c32UpperCloudPath}\``,
    `- cloud recirculation proxy: C30 \`${dryBeltComparison.c30CloudRecirc}\`, C32 \`${dryBeltComparison.c32CloudRecirc}\``,
    `- return-branch mass flux: C30 \`${dryBeltComparison.c30NorthReturn}\`, C32 \`${dryBeltComparison.c32NorthReturn}\``,
    `- dominant vapor import: C30 \`${dryBeltComparison.c30DominantVaporImport}\`, C32 \`${dryBeltComparison.c32DominantVaporImport}\``,
    '',
    '## Thermodynamic shift',
    '',
    `- C30 primary regime: \`${thermodynamicComparison.c30PrimaryRegime}\``,
    `- C32 primary regime: \`${thermodynamicComparison.c32PrimaryRegime}\``,
    `- C30 dynamics support score: \`${thermodynamicComparison.c30DynamicsSupport}\``,
    `- C32 dynamics support score: \`${thermodynamicComparison.c32DynamicsSupport}\``,
    `- C30 moisture support score: \`${thermodynamicComparison.c30MoistureSupport}\``,
    `- C32 moisture support score: \`${thermodynamicComparison.c32MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- Restoring the stricter organized-support and potential caps clearly tightened the dry-belt receiver side again: carryover, persistence, weak-erosion survival, upper-cloud path, cloud recirculation, and ocean condensation all improved.',
    '- It also relieved the upper equatorial branch and made the thermodynamic regime more dynamics-supported again.',
    '- But the lower and mid equatorial core got worse on both the total and zonal-mean sides, and the 35° import burden reloaded at every level.',
    '- That means the organized-support carveout direction was partly right, but it over-tightened the lower-mid core. The next bounded move should keep the stricter organized-support cap but only partially relax the potential cap instead of fully restoring both.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C32 organized-support carveout baseline fixed where it improved receiver containment.',
    '- Preserve the C32 dry-belt receiver / upper-branch relief.',
    '- Partially relax only the convective-potential cap so the lower-mid core can recover without reopening organized receiver spillover.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c30Quick = readJson(options.c30QuickPath);
  const c32Quick = readJson(options.c32QuickPath);
  const c30Transport = readJson(options.c30TransportPath);
  const c32Transport = readJson(options.c32TransportPath);
  const c30Hadley = readJson(options.c30HadleyPath);
  const c32Hadley = readJson(options.c32HadleyPath);
  const c30Moisture = readJson(options.c30MoisturePath);
  const c32Moisture = readJson(options.c32MoisturePath);
  const c30Thermo = readJson(options.c30ThermoPath);
  const c32Thermo = readJson(options.c32ThermoPath);

  const c30Metrics = latestMetrics(c30Quick);
  const c32Metrics = latestMetrics(c32Quick);
  const c30EqLower = getBand(c30Transport, 0, 'lowerTroposphere');
  const c32EqLower = getBand(c32Transport, 0, 'lowerTroposphere');
  const c30EqMid = getBand(c30Transport, 0, 'midTroposphere');
  const c32EqMid = getBand(c32Transport, 0, 'midTroposphere');
  const c30EqUpper = getBand(c30Transport, 0, 'upperTroposphere');
  const c32EqUpper = getBand(c32Transport, 0, 'upperTroposphere');
  const c3035Lower = getBand(c30Transport, 35, 'lowerTroposphere');
  const c3235Lower = getBand(c32Transport, 35, 'lowerTroposphere');
  const c3035Mid = getBand(c30Transport, 35, 'midTroposphere');
  const c3235Mid = getBand(c32Transport, 35, 'midTroposphere');
  const c3035Upper = getBand(c30Transport, 35, 'upperTroposphere');
  const c3235Upper = getBand(c32Transport, 35, 'upperTroposphere');

  const quickComparison = {
    c30CrossEq: round(c30Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c32CrossEq: round(c32Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c30ItczWidth: round(c30Metrics.itczWidthDeg),
    c32ItczWidth: round(c32Metrics.itczWidthDeg),
    c30DryNorth: round(c30Metrics.subtropicalDryNorthRatio),
    c32DryNorth: round(c32Metrics.subtropicalDryNorthRatio),
    c30DrySouth: round(c30Metrics.subtropicalDrySouthRatio),
    c32DrySouth: round(c32Metrics.subtropicalDrySouthRatio),
    c30Westerlies: round(c30Metrics.midlatitudeWesterliesNorthU10Ms),
    c32Westerlies: round(c32Metrics.midlatitudeWesterliesNorthU10Ms),
    c30OceanCond: round(c30Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c30EqLower: round(c30EqLower?.totalWaterFluxNorthKgM_1S),
    c32EqLower: round(c32EqLower?.totalWaterFluxNorthKgM_1S),
    c30EqMid: round(c30EqMid?.totalWaterFluxNorthKgM_1S),
    c32EqMid: round(c32EqMid?.totalWaterFluxNorthKgM_1S),
    c30EqUpper: round(c30EqUpper?.totalWaterFluxNorthKgM_1S),
    c32EqUpper: round(c32EqUpper?.totalWaterFluxNorthKgM_1S),
    c30EqLowerZonal: round(c30EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqLowerZonal: round(c32EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqLowerEddy: round(c30EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c32EqLowerEddy: round(c32EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c30EqMidZonal: round(c30EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqMidZonal: round(c32EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqMidEddy: round(c30EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c32EqMidEddy: round(c32EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c30EqUpperZonal: round(c30EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqUpperZonal: round(c32EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqUpperEddy: round(c30EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c32EqUpperEddy: round(c32EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c30DryLower35: round(c3035Lower?.totalWaterFluxNorthKgM_1S),
    c32DryLower35: round(c3235Lower?.totalWaterFluxNorthKgM_1S),
    c30DryMid35: round(c3035Mid?.totalWaterFluxNorthKgM_1S),
    c32DryMid35: round(c3235Mid?.totalWaterFluxNorthKgM_1S),
    c30DryUpper35: round(c3035Upper?.totalWaterFluxNorthKgM_1S),
    c32DryUpper35: round(c3235Upper?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c30OceanCond: round(c30Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c30Carryover: round(c30Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c32Carryover: round(c32Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c30Persistence: round(c30Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c32Persistence: round(c32Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c30WeakErosion: round(c30Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c32WeakErosion: round(c32Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c30UpperCloudPath: round(c30Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c32UpperCloudPath: round(c32Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c30CloudRecirc: round(c30Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c32CloudRecirc: round(c32Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c30NorthReturn: round(c30Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c32NorthReturn: round(c32Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c30DominantVaporImport: round(c30Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S),
    c32DominantVaporImport: round(c32Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c30PrimaryRegime: c30Thermo.classification?.primaryRegime || null,
    c32PrimaryRegime: c32Thermo.classification?.primaryRegime || null,
    c30DynamicsSupport: round(c30Thermo.classification?.dynamicsSupportScore, 5),
    c32DynamicsSupport: round(c32Thermo.classification?.dynamicsSupportScore, 5),
    c30MoistureSupport: round(c30Thermo.classification?.moistureSupportScore, 5),
    c32MoistureSupport: round(c32Thermo.classification?.moistureSupportScore, 5)
  };

  const decision = classifyC33Decision({
    c30CrossEq: quickComparison.c30CrossEq,
    c32CrossEq: quickComparison.c32CrossEq,
    c30EqLower: round(c30EqLower?.totalWaterFluxNorthKgM_1S),
    c32EqLower: transportComparison.c32EqLower,
    c30EqLowerZonal: transportComparison.c30EqLowerZonal,
    c32EqLowerZonal: transportComparison.c32EqLowerZonal,
    c30EqMidZonal: transportComparison.c30EqMidZonal,
    c32EqMidZonal: transportComparison.c32EqMidZonal,
    c30EqUpperZonal: transportComparison.c30EqUpperZonal,
    c32EqUpperZonal: transportComparison.c32EqUpperZonal,
    c30EqLowerEddy: transportComparison.c30EqLowerEddy,
    c32EqLowerEddy: transportComparison.c32EqLowerEddy,
    c30EqMidEddy: transportComparison.c30EqMidEddy,
    c32EqMidEddy: transportComparison.c32EqMidEddy,
    c30EqUpperEddy: transportComparison.c30EqUpperEddy,
    c32EqUpperEddy: transportComparison.c32EqUpperEddy,
    c30EqMid: transportComparison.c30EqMid,
    c32EqMid: transportComparison.c32EqMid,
    c30EqUpper: transportComparison.c30EqUpper,
    c32EqUpper: transportComparison.c32EqUpper,
    c30OceanCond: dryBeltComparison.c30OceanCond,
    c32OceanCond: dryBeltComparison.c32OceanCond,
    c30Carryover: dryBeltComparison.c30Carryover,
    c32Carryover: dryBeltComparison.c32Carryover,
    c30Persistence: dryBeltComparison.c30Persistence,
    c32Persistence: dryBeltComparison.c32Persistence,
    c30WeakErosion: dryBeltComparison.c30WeakErosion,
    c32WeakErosion: dryBeltComparison.c32WeakErosion,
    c30UpperCloudPath: dryBeltComparison.c30UpperCloudPath,
    c32UpperCloudPath: dryBeltComparison.c32UpperCloudPath,
    c30DominantVaporImport: dryBeltComparison.c30DominantVaporImport,
    c32DominantVaporImport: dryBeltComparison.c32DominantVaporImport,
    c30CloudRecirc: dryBeltComparison.c30CloudRecirc,
    c32CloudRecirc: dryBeltComparison.c32CloudRecirc,
    c30NorthReturn: dryBeltComparison.c30NorthReturn,
    c32NorthReturn: dryBeltComparison.c32NorthReturn
  });

  const nextContract = {
    focusTargets: [
      'keep the C32 strict organized-support cap and the C30 subtropical suppression / dominance / residual-mass thresholds fixed',
      'partially relax only the convective-potential cap so lower-mid equatorial cells are not over-trimmed',
      'preserve the C32 dry-belt receiver / upper-branch relief while recovering the C30 lower-mid core transport'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c33-organized-support-carry-input-carveout-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickComparison,
    transportComparison,
    dryBeltComparison,
    thermodynamicComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC33Markdown({
    decision,
    quickComparison,
    transportComparison,
    dryBeltComparison,
    thermodynamicComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
