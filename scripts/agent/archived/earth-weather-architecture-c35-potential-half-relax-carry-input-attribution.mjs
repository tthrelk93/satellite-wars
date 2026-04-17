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
  c34QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c34-potential-half-relax-carry-input-quick.json'),
  c32TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-transport-interface-budget.json'),
  c34TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c34-potential-half-relax-carry-input-quick-transport-interface-budget.json'),
  c32HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-hadley-partition-summary.json'),
  c34HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c34-potential-half-relax-carry-input-quick-hadley-partition-summary.json'),
  c32MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-moisture-attribution.json'),
  c34MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c34-potential-half-relax-carry-input-quick-moisture-attribution.json'),
  c32ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-thermodynamic-support-summary.json'),
  c34ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c34-potential-half-relax-carry-input-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c35-potential-half-relax-carry-input-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c35-potential-half-relax-carry-input-attribution.json')
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
const approxEqual = (a, b, epsilon = 1e-9) => (
  (a == null && b == null)
  || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon)
  || (typeof a === 'string' && typeof b === 'string' && a === b)
);
const latestMetrics = (auditJson) => auditJson?.samples?.[auditJson.samples.length - 1]?.metrics || {};
const getInterface = (budget, targetLatDeg) => budget.interfaces.find((entry) => entry.targetLatDeg === targetLatDeg);
const getBand = (budget, targetLatDeg, bandKey) => getInterface(budget, targetLatDeg)?.levelBands?.[bandKey] || null;

export function classifyC35Decision({
  c32CrossEq,
  c34CrossEq,
  c32ItczWidth,
  c34ItczWidth,
  c32DryNorth,
  c34DryNorth,
  c32DrySouth,
  c34DrySouth,
  c32Westerlies,
  c34Westerlies,
  c32OceanCond,
  c34OceanCond,
  c32EqLower,
  c34EqLower,
  c32EqMid,
  c34EqMid,
  c32EqUpper,
  c34EqUpper,
  c32EqLowerZonal,
  c34EqLowerZonal,
  c32EqMidZonal,
  c34EqMidZonal,
  c32EqUpperZonal,
  c34EqUpperZonal,
  c32EqLowerEddy,
  c34EqLowerEddy,
  c32EqMidEddy,
  c34EqMidEddy,
  c32EqUpperEddy,
  c34EqUpperEddy,
  c32DryLower35,
  c34DryLower35,
  c32DryMid35,
  c34DryMid35,
  c32DryUpper35,
  c34DryUpper35,
  c32Carryover,
  c34Carryover,
  c32Persistence,
  c34Persistence,
  c32WeakErosion,
  c34WeakErosion,
  c32UpperCloudPath,
  c34UpperCloudPath,
  c32DominantVaporImport,
  c34DominantVaporImport,
  c32CloudRecirc,
  c34CloudRecirc,
  c32NorthReturn,
  c34NorthReturn,
  c32PrimaryRegime,
  c34PrimaryRegime,
  c32DynamicsSupport,
  c34DynamicsSupport,
  c32MoistureSupport,
  c34MoistureSupport
}) {
  const quickInvariant =
    approxEqual(c32CrossEq, c34CrossEq)
    && approxEqual(c32ItczWidth, c34ItczWidth)
    && approxEqual(c32DryNorth, c34DryNorth)
    && approxEqual(c32DrySouth, c34DrySouth)
    && approxEqual(c32Westerlies, c34Westerlies)
    && approxEqual(c32OceanCond, c34OceanCond);

  const transportInvariant =
    approxEqual(c32EqLower, c34EqLower)
    && approxEqual(c32EqMid, c34EqMid)
    && approxEqual(c32EqUpper, c34EqUpper)
    && approxEqual(c32EqLowerZonal, c34EqLowerZonal)
    && approxEqual(c32EqMidZonal, c34EqMidZonal)
    && approxEqual(c32EqUpperZonal, c34EqUpperZonal)
    && approxEqual(c32EqLowerEddy, c34EqLowerEddy)
    && approxEqual(c32EqMidEddy, c34EqMidEddy)
    && approxEqual(c32EqUpperEddy, c34EqUpperEddy)
    && approxEqual(c32DryLower35, c34DryLower35)
    && approxEqual(c32DryMid35, c34DryMid35)
    && approxEqual(c32DryUpper35, c34DryUpper35);

  const receiverInvariant =
    approxEqual(c32Carryover, c34Carryover)
    && approxEqual(c32Persistence, c34Persistence)
    && approxEqual(c32WeakErosion, c34WeakErosion)
    && approxEqual(c32UpperCloudPath, c34UpperCloudPath)
    && approxEqual(c32DominantVaporImport, c34DominantVaporImport)
    && approxEqual(c32CloudRecirc, c34CloudRecirc)
    && approxEqual(c32NorthReturn, c34NorthReturn);

  const thermoInvariant =
    approxEqual(c32PrimaryRegime, c34PrimaryRegime)
    && approxEqual(c32DynamicsSupport, c34DynamicsSupport)
    && approxEqual(c32MoistureSupport, c34MoistureSupport);

  const severeCrossEqPersisted =
    Number.isFinite(c32CrossEq) && Number.isFinite(c34CrossEq) && c32CrossEq < 0 && c34CrossEq < 0;

  if (quickInvariant && transportInvariant && receiverInvariant && thermoInvariant && severeCrossEqPersisted) {
    return {
      verdict: 'potential_half_relax_inert_potential_cap_not_primary_binder',
      nextMove: 'Architecture C36: organized-support half-relax carry-input experiment'
    };
  }

  return {
    verdict: 'potential_half_relax_carry_input_attribution_inconclusive',
    nextMove: 'Architecture C36: broader organized-support follow-up experiment'
  };
}

export function renderArchitectureC35Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C35 Potential-Half-Relax Carry-Input Attribution',
    '',
    'This phase attributes the C34 potential-half-relax variant relative to the stricter C32 organized-support carry-input carveout. The question is whether the half-relaxed potential cap changed the live climate state at all, or whether the organized-support cap is the real active binder.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C32 vs C34 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C32 \`${quickComparison.c32CrossEq}\`, C34 \`${quickComparison.c34CrossEq}\``,
    `- ITCZ width: C32 \`${quickComparison.c32ItczWidth}\`, C34 \`${quickComparison.c34ItczWidth}\``,
    `- NH dry-belt ratio: C32 \`${quickComparison.c32DryNorth}\`, C34 \`${quickComparison.c34DryNorth}\``,
    `- SH dry-belt ratio: C32 \`${quickComparison.c32DrySouth}\`, C34 \`${quickComparison.c34DrySouth}\``,
    `- NH midlatitude westerlies: C32 \`${quickComparison.c32Westerlies}\`, C34 \`${quickComparison.c34Westerlies}\``,
    `- NH dry-belt ocean condensation: C32 \`${quickComparison.c32OceanCond}\`, C34 \`${quickComparison.c34OceanCond}\``,
    '',
    '## Equatorial transport comparison',
    '',
    `- equator lower total-water flux north: C32 \`${transportComparison.c32EqLower}\`, C34 \`${transportComparison.c34EqLower}\``,
    `- equator mid total-water flux north: C32 \`${transportComparison.c32EqMid}\`, C34 \`${transportComparison.c34EqMid}\``,
    `- equator upper total-water flux north: C32 \`${transportComparison.c32EqUpper}\`, C34 \`${transportComparison.c34EqUpper}\``,
    `- equator lower zonal-mean transport: C32 \`${transportComparison.c32EqLowerZonal}\`, C34 \`${transportComparison.c34EqLowerZonal}\``,
    `- equator lower eddy transport: C32 \`${transportComparison.c32EqLowerEddy}\`, C34 \`${transportComparison.c34EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C32 \`${transportComparison.c32EqMidZonal}\`, C34 \`${transportComparison.c34EqMidZonal}\``,
    `- equator mid eddy transport: C32 \`${transportComparison.c32EqMidEddy}\`, C34 \`${transportComparison.c34EqMidEddy}\``,
    `- equator upper zonal-mean transport: C32 \`${transportComparison.c32EqUpperZonal}\`, C34 \`${transportComparison.c34EqUpperZonal}\``,
    `- equator upper eddy transport: C32 \`${transportComparison.c32EqUpperEddy}\`, C34 \`${transportComparison.c34EqUpperEddy}\``,
    `- 35° lower vapor import: C32 \`${transportComparison.c32DryLower35}\`, C34 \`${transportComparison.c34DryLower35}\``,
    `- 35° mid vapor import: C32 \`${transportComparison.c32DryMid35}\`, C34 \`${transportComparison.c34DryMid35}\``,
    `- 35° upper vapor import: C32 \`${transportComparison.c32DryUpper35}\`, C34 \`${transportComparison.c34DryUpper35}\``,
    '',
    '## Dry-belt receiver comparison',
    '',
    `- NH dry-belt ocean condensation: C32 \`${dryBeltComparison.c32OceanCond}\`, C34 \`${dryBeltComparison.c34OceanCond}\``,
    `- carried-over upper cloud: C32 \`${dryBeltComparison.c32Carryover}\`, C34 \`${dryBeltComparison.c34Carryover}\``,
    `- imported anvil persistence: C32 \`${dryBeltComparison.c32Persistence}\`, C34 \`${dryBeltComparison.c34Persistence}\``,
    `- weak-erosion survival: C32 \`${dryBeltComparison.c32WeakErosion}\`, C34 \`${dryBeltComparison.c34WeakErosion}\``,
    `- upper-cloud path: C32 \`${dryBeltComparison.c32UpperCloudPath}\`, C34 \`${dryBeltComparison.c34UpperCloudPath}\``,
    `- cloud recirculation proxy: C32 \`${dryBeltComparison.c32CloudRecirc}\`, C34 \`${dryBeltComparison.c34CloudRecirc}\``,
    `- return-branch mass flux: C32 \`${dryBeltComparison.c32NorthReturn}\`, C34 \`${dryBeltComparison.c34NorthReturn}\``,
    `- dominant vapor import: C32 \`${dryBeltComparison.c32DominantVaporImport}\`, C34 \`${dryBeltComparison.c34DominantVaporImport}\``,
    '',
    '## Thermodynamic comparison',
    '',
    `- C32 primary regime: \`${thermodynamicComparison.c32PrimaryRegime}\``,
    `- C34 primary regime: \`${thermodynamicComparison.c34PrimaryRegime}\``,
    `- C32 dynamics support score: \`${thermodynamicComparison.c32DynamicsSupport}\``,
    `- C34 dynamics support score: \`${thermodynamicComparison.c34DynamicsSupport}\``,
    `- C32 moisture support score: \`${thermodynamicComparison.c32MoistureSupport}\``,
    `- C34 moisture support score: \`${thermodynamicComparison.c34MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- The half-relaxed potential cap did not just fail to clear the gate. It left the quick score, the equatorial transport stack, and the dry-belt receiver state unchanged to reporting precision.',
    '- That means the potential cap is not the active binder in this carry-input family. The live lower-mid core defect under C32 is being set upstream by the stricter organized-support cap, not by the potential cap itself.',
    '- The next bounded move should keep the stricter potential cap fixed, then partially relax only the organized-support cap so we can test whether the lower-mid core can recover without reopening the receiver side as aggressively as C30 did.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C32 strict potential cap fixed.',
    '- Preserve the C32 dry-belt receiver containment and upper-branch relief.',
    '- Partially relax only the organized-support cap.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c32Quick = readJson(options.c32QuickPath);
  const c34Quick = readJson(options.c34QuickPath);
  const c32Transport = readJson(options.c32TransportPath);
  const c34Transport = readJson(options.c34TransportPath);
  const c32Hadley = readJson(options.c32HadleyPath);
  const c34Hadley = readJson(options.c34HadleyPath);
  const c32Moisture = readJson(options.c32MoisturePath);
  const c34Moisture = readJson(options.c34MoisturePath);
  const c32Thermo = readJson(options.c32ThermoPath);
  const c34Thermo = readJson(options.c34ThermoPath);

  const c32Metrics = latestMetrics(c32Quick);
  const c34Metrics = latestMetrics(c34Quick);
  const c32EqLower = getBand(c32Transport, 0, 'lowerTroposphere');
  const c34EqLower = getBand(c34Transport, 0, 'lowerTroposphere');
  const c32EqMid = getBand(c32Transport, 0, 'midTroposphere');
  const c34EqMid = getBand(c34Transport, 0, 'midTroposphere');
  const c32EqUpper = getBand(c32Transport, 0, 'upperTroposphere');
  const c34EqUpper = getBand(c34Transport, 0, 'upperTroposphere');
  const c3235Lower = getBand(c32Transport, 35, 'lowerTroposphere');
  const c3435Lower = getBand(c34Transport, 35, 'lowerTroposphere');
  const c3235Mid = getBand(c32Transport, 35, 'midTroposphere');
  const c3435Mid = getBand(c34Transport, 35, 'midTroposphere');
  const c3235Upper = getBand(c32Transport, 35, 'upperTroposphere');
  const c3435Upper = getBand(c34Transport, 35, 'upperTroposphere');

  const c32ThermoClass = c32Thermo.classification || {};
  const c34ThermoClass = c34Thermo.classification || {};

  const quickComparison = {
    c32CrossEq: round(c32Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c34CrossEq: round(c34Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c32ItczWidth: round(c32Metrics.itczWidthDeg),
    c34ItczWidth: round(c34Metrics.itczWidthDeg),
    c32DryNorth: round(c32Metrics.subtropicalDryNorthRatio),
    c34DryNorth: round(c34Metrics.subtropicalDryNorthRatio),
    c32DrySouth: round(c32Metrics.subtropicalDrySouthRatio),
    c34DrySouth: round(c34Metrics.subtropicalDrySouthRatio),
    c32Westerlies: round(c32Metrics.midlatitudeWesterliesNorthU10Ms),
    c34Westerlies: round(c34Metrics.midlatitudeWesterliesNorthU10Ms),
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c34OceanCond: round(c34Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c32EqLower: round(c32EqLower?.totalWaterFluxNorthKgM_1S),
    c34EqLower: round(c34EqLower?.totalWaterFluxNorthKgM_1S),
    c32EqMid: round(c32EqMid?.totalWaterFluxNorthKgM_1S),
    c34EqMid: round(c34EqMid?.totalWaterFluxNorthKgM_1S),
    c32EqUpper: round(c32EqUpper?.totalWaterFluxNorthKgM_1S),
    c34EqUpper: round(c34EqUpper?.totalWaterFluxNorthKgM_1S),
    c32EqLowerZonal: round(c32EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c34EqLowerZonal: round(c34EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqLowerEddy: round(c32EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c34EqLowerEddy: round(c34EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c32EqMidZonal: round(c32EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c34EqMidZonal: round(c34EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqMidEddy: round(c32EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c34EqMidEddy: round(c34EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c32EqUpperZonal: round(c32EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c34EqUpperZonal: round(c34EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c32EqUpperEddy: round(c32EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c34EqUpperEddy: round(c34EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c32DryLower35: round(c3235Lower?.totalWaterFluxNorthKgM_1S),
    c34DryLower35: round(c3435Lower?.totalWaterFluxNorthKgM_1S),
    c32DryMid35: round(c3235Mid?.totalWaterFluxNorthKgM_1S),
    c34DryMid35: round(c3435Mid?.totalWaterFluxNorthKgM_1S),
    c32DryUpper35: round(c3235Upper?.totalWaterFluxNorthKgM_1S),
    c34DryUpper35: round(c3435Upper?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c34OceanCond: round(c34Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c32Carryover: round(c32Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c34Carryover: round(c34Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c32Persistence: round(c32Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c34Persistence: round(c34Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c32WeakErosion: round(c32Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c34WeakErosion: round(c34Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c32UpperCloudPath: round(c32Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c34UpperCloudPath: round(c34Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c32CloudRecirc: round(c32Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c34CloudRecirc: round(c34Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c32NorthReturn: round(c32Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c34NorthReturn: round(c34Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c32DominantVaporImport: round(c32Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S),
    c34DominantVaporImport: round(c34Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c32PrimaryRegime: c32ThermoClass.primaryRegime || null,
    c34PrimaryRegime: c34ThermoClass.primaryRegime || null,
    c32DynamicsSupport: round(c32ThermoClass.dynamicsSupportScore),
    c34DynamicsSupport: round(c34ThermoClass.dynamicsSupportScore),
    c32MoistureSupport: round(c32ThermoClass.moistureSupportScore),
    c34MoistureSupport: round(c34ThermoClass.moistureSupportScore)
  };

  const decision = classifyC35Decision({
    ...quickComparison,
    ...transportComparison,
    ...dryBeltComparison,
    ...thermodynamicComparison
  });

  const nextContract = {
    focusTargets: [
      'keep the C32 strict potential cap fixed at 0.42',
      'partially relax only the organized-support cap so lower-mid equatorial cells can recover without fully reopening the C30 receiver side',
      'preserve the C32 dry-belt receiver containment and upper-branch relief while testing whether organized-support is the live binder'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c35-potential-half-relax-carry-input-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC35Markdown({
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
