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
  c36QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c36-organized-support-half-relax-carry-input-quick.json'),
  c30TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-transport-interface-budget.json'),
  c36TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c36-organized-support-half-relax-carry-input-quick-transport-interface-budget.json'),
  c30HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-hadley-partition-summary.json'),
  c36HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c36-organized-support-half-relax-carry-input-quick-hadley-partition-summary.json'),
  c30MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-moisture-attribution.json'),
  c36MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c36-organized-support-half-relax-carry-input-quick-moisture-attribution.json'),
  c30ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-thermodynamic-support-summary.json'),
  c36ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c36-organized-support-half-relax-carry-input-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c37-organized-support-half-relax-carry-input-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c37-organized-support-half-relax-carry-input-attribution.json')
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

export function classifyC37Decision({
  c30CrossEq,
  c36CrossEq,
  c30ItczWidth,
  c36ItczWidth,
  c30DryNorth,
  c36DryNorth,
  c30DrySouth,
  c36DrySouth,
  c30Westerlies,
  c36Westerlies,
  c30OceanCond,
  c36OceanCond,
  c30EqLower,
  c36EqLower,
  c30EqMid,
  c36EqMid,
  c30EqUpper,
  c36EqUpper,
  c30EqLowerZonal,
  c36EqLowerZonal,
  c30EqMidZonal,
  c36EqMidZonal,
  c30EqUpperZonal,
  c36EqUpperZonal,
  c30EqLowerEddy,
  c36EqLowerEddy,
  c30EqMidEddy,
  c36EqMidEddy,
  c30EqUpperEddy,
  c36EqUpperEddy,
  c30DryLower35,
  c36DryLower35,
  c30DryMid35,
  c36DryMid35,
  c30DryUpper35,
  c36DryUpper35,
  c30Carryover,
  c36Carryover,
  c30Persistence,
  c36Persistence,
  c30WeakErosion,
  c36WeakErosion,
  c30UpperCloudPath,
  c36UpperCloudPath,
  c30DominantVaporImport,
  c36DominantVaporImport,
  c30CloudRecirc,
  c36CloudRecirc,
  c30NorthReturn,
  c36NorthReturn,
  c30PrimaryRegime,
  c36PrimaryRegime,
  c30DynamicsSupport,
  c36DynamicsSupport,
  c30MoistureSupport,
  c36MoistureSupport
}) {
  const quickInvariant =
    approxEqual(c30CrossEq, c36CrossEq)
    && approxEqual(c30ItczWidth, c36ItczWidth)
    && approxEqual(c30DryNorth, c36DryNorth)
    && approxEqual(c30DrySouth, c36DrySouth)
    && approxEqual(c30Westerlies, c36Westerlies)
    && approxEqual(c30OceanCond, c36OceanCond);

  const transportInvariant =
    approxEqual(c30EqLower, c36EqLower)
    && approxEqual(c30EqMid, c36EqMid)
    && approxEqual(c30EqUpper, c36EqUpper)
    && approxEqual(c30EqLowerZonal, c36EqLowerZonal)
    && approxEqual(c30EqMidZonal, c36EqMidZonal)
    && approxEqual(c30EqUpperZonal, c36EqUpperZonal)
    && approxEqual(c30EqLowerEddy, c36EqLowerEddy)
    && approxEqual(c30EqMidEddy, c36EqMidEddy)
    && approxEqual(c30EqUpperEddy, c36EqUpperEddy)
    && approxEqual(c30DryLower35, c36DryLower35)
    && approxEqual(c30DryMid35, c36DryMid35)
    && approxEqual(c30DryUpper35, c36DryUpper35);

  const receiverInvariant =
    approxEqual(c30Carryover, c36Carryover)
    && approxEqual(c30Persistence, c36Persistence)
    && approxEqual(c30WeakErosion, c36WeakErosion)
    && approxEqual(c30UpperCloudPath, c36UpperCloudPath)
    && approxEqual(c30DominantVaporImport, c36DominantVaporImport)
    && approxEqual(c30CloudRecirc, c36CloudRecirc)
    && approxEqual(c30NorthReturn, c36NorthReturn);

  const thermoInvariant =
    approxEqual(c30PrimaryRegime, c36PrimaryRegime)
    && approxEqual(c30DynamicsSupport, c36DynamicsSupport)
    && approxEqual(c30MoistureSupport, c36MoistureSupport);

  const severeCrossEqPersisted =
    Number.isFinite(c30CrossEq) && Number.isFinite(c36CrossEq) && c30CrossEq < 0 && c36CrossEq < 0;

  if (quickInvariant && transportInvariant && receiverInvariant && thermoInvariant && severeCrossEqPersisted) {
    return {
      verdict: 'organized_support_half_relax_inert_threshold_cliff_reverts_to_c30',
      nextMove: 'Architecture C38: inner-core organized-support restore experiment'
    };
  }

  return {
    verdict: 'organized_support_half_relax_carry_input_attribution_inconclusive',
    nextMove: 'Architecture C38: broader organized-support geometry follow-up experiment'
  };
}

export function renderArchitectureC37Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C37 Organized-Support Half-Relax Carry-Input Attribution',
    '',
    'This phase attributes the C36 organized-support half-relax variant relative to the broader C30 carry-input recapture. The question is whether the half-relaxed organized-support cap created a usable intermediate state, or whether it simply falls off a threshold cliff back to the full C30 behavior.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C30 vs C36 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C30 \`${quickComparison.c30CrossEq}\`, C36 \`${quickComparison.c36CrossEq}\``,
    `- ITCZ width: C30 \`${quickComparison.c30ItczWidth}\`, C36 \`${quickComparison.c36ItczWidth}\``,
    `- NH dry-belt ratio: C30 \`${quickComparison.c30DryNorth}\`, C36 \`${quickComparison.c36DryNorth}\``,
    `- SH dry-belt ratio: C30 \`${quickComparison.c30DrySouth}\`, C36 \`${quickComparison.c36DrySouth}\``,
    `- NH midlatitude westerlies: C30 \`${quickComparison.c30Westerlies}\`, C36 \`${quickComparison.c36Westerlies}\``,
    `- NH dry-belt ocean condensation: C30 \`${quickComparison.c30OceanCond}\`, C36 \`${quickComparison.c36OceanCond}\``,
    '',
    '## Equatorial transport comparison',
    '',
    `- equator lower total-water flux north: C30 \`${transportComparison.c30EqLower}\`, C36 \`${transportComparison.c36EqLower}\``,
    `- equator mid total-water flux north: C30 \`${transportComparison.c30EqMid}\`, C36 \`${transportComparison.c36EqMid}\``,
    `- equator upper total-water flux north: C30 \`${transportComparison.c30EqUpper}\`, C36 \`${transportComparison.c36EqUpper}\``,
    `- equator lower zonal-mean transport: C30 \`${transportComparison.c30EqLowerZonal}\`, C36 \`${transportComparison.c36EqLowerZonal}\``,
    `- equator lower eddy transport: C30 \`${transportComparison.c30EqLowerEddy}\`, C36 \`${transportComparison.c36EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C30 \`${transportComparison.c30EqMidZonal}\`, C36 \`${transportComparison.c36EqMidZonal}\``,
    `- equator mid eddy transport: C30 \`${transportComparison.c30EqMidEddy}\`, C36 \`${transportComparison.c36EqMidEddy}\``,
    `- equator upper zonal-mean transport: C30 \`${transportComparison.c30EqUpperZonal}\`, C36 \`${transportComparison.c36EqUpperZonal}\``,
    `- equator upper eddy transport: C30 \`${transportComparison.c30EqUpperEddy}\`, C36 \`${transportComparison.c36EqUpperEddy}\``,
    `- 35° lower vapor import: C30 \`${transportComparison.c30DryLower35}\`, C36 \`${transportComparison.c36DryLower35}\``,
    `- 35° mid vapor import: C30 \`${transportComparison.c30DryMid35}\`, C36 \`${transportComparison.c36DryMid35}\``,
    `- 35° upper vapor import: C30 \`${transportComparison.c30DryUpper35}\`, C36 \`${transportComparison.c36DryUpper35}\``,
    '',
    '## Dry-belt receiver comparison',
    '',
    `- NH dry-belt ocean condensation: C30 \`${dryBeltComparison.c30OceanCond}\`, C36 \`${dryBeltComparison.c36OceanCond}\``,
    `- carried-over upper cloud: C30 \`${dryBeltComparison.c30Carryover}\`, C36 \`${dryBeltComparison.c36Carryover}\``,
    `- imported anvil persistence: C30 \`${dryBeltComparison.c30Persistence}\`, C36 \`${dryBeltComparison.c36Persistence}\``,
    `- weak-erosion survival: C30 \`${dryBeltComparison.c30WeakErosion}\`, C36 \`${dryBeltComparison.c36WeakErosion}\``,
    `- upper-cloud path: C30 \`${dryBeltComparison.c30UpperCloudPath}\`, C36 \`${dryBeltComparison.c36UpperCloudPath}\``,
    `- cloud recirculation proxy: C30 \`${dryBeltComparison.c30CloudRecirc}\`, C36 \`${dryBeltComparison.c36CloudRecirc}\``,
    `- return-branch mass flux: C30 \`${dryBeltComparison.c30NorthReturn}\`, C36 \`${dryBeltComparison.c36NorthReturn}\``,
    `- dominant vapor import: C30 \`${dryBeltComparison.c30DominantVaporImport}\`, C36 \`${dryBeltComparison.c36DominantVaporImport}\``,
    '',
    '## Thermodynamic comparison',
    '',
    `- C30 primary regime: \`${thermodynamicComparison.c30PrimaryRegime}\``,
    `- C36 primary regime: \`${thermodynamicComparison.c36PrimaryRegime}\``,
    `- C30 dynamics support score: \`${thermodynamicComparison.c30DynamicsSupport}\``,
    `- C36 dynamics support score: \`${thermodynamicComparison.c36DynamicsSupport}\``,
    `- C30 moisture support score: \`${thermodynamicComparison.c30MoistureSupport}\``,
    `- C36 moisture support score: \`${thermodynamicComparison.c36MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- The organized-support half-relax does not create a distinct intermediate state. It reproduces the full C30 climate, transport, and receiver signature to reporting precision.',
    '- That means scalar organized-support tuning is behaving like a threshold cliff in this family: once the cap is loosened far enough to re-admit the blocked subset, the hybrid snaps all the way back to the broader recapture regime.',
    '- The next bounded move should stop trying to tune organized support globally and instead restore it only inside the inner equatorial core, while keeping the stricter C32 gate outside that core to preserve receiver containment.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C32 strict organized-support and potential caps outside the inner equatorial core.',
    '- Restore organized-support admission only inside the lower-mid equatorial core.',
    '- Preserve the C32 dry-belt receiver containment while testing whether core-only restore can recover transport without the C30 collapse.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c30Quick = readJson(options.c30QuickPath);
  const c36Quick = readJson(options.c36QuickPath);
  const c30Transport = readJson(options.c30TransportPath);
  const c36Transport = readJson(options.c36TransportPath);
  const c30Hadley = readJson(options.c30HadleyPath);
  const c36Hadley = readJson(options.c36HadleyPath);
  const c30Moisture = readJson(options.c30MoisturePath);
  const c36Moisture = readJson(options.c36MoisturePath);
  const c30Thermo = readJson(options.c30ThermoPath);
  const c36Thermo = readJson(options.c36ThermoPath);

  const c30Metrics = latestMetrics(c30Quick);
  const c36Metrics = latestMetrics(c36Quick);
  const c30EqLower = getBand(c30Transport, 0, 'lowerTroposphere');
  const c36EqLower = getBand(c36Transport, 0, 'lowerTroposphere');
  const c30EqMid = getBand(c30Transport, 0, 'midTroposphere');
  const c36EqMid = getBand(c36Transport, 0, 'midTroposphere');
  const c30EqUpper = getBand(c30Transport, 0, 'upperTroposphere');
  const c36EqUpper = getBand(c36Transport, 0, 'upperTroposphere');
  const c3035Lower = getBand(c30Transport, 35, 'lowerTroposphere');
  const c3635Lower = getBand(c36Transport, 35, 'lowerTroposphere');
  const c3035Mid = getBand(c30Transport, 35, 'midTroposphere');
  const c3635Mid = getBand(c36Transport, 35, 'midTroposphere');
  const c3035Upper = getBand(c30Transport, 35, 'upperTroposphere');
  const c3635Upper = getBand(c36Transport, 35, 'upperTroposphere');

  const c30ThermoClass = c30Thermo.classification || {};
  const c36ThermoClass = c36Thermo.classification || {};

  const quickComparison = {
    c30CrossEq: round(c30Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c36CrossEq: round(c36Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c30ItczWidth: round(c30Metrics.itczWidthDeg),
    c36ItczWidth: round(c36Metrics.itczWidthDeg),
    c30DryNorth: round(c30Metrics.subtropicalDryNorthRatio),
    c36DryNorth: round(c36Metrics.subtropicalDryNorthRatio),
    c30DrySouth: round(c30Metrics.subtropicalDrySouthRatio),
    c36DrySouth: round(c36Metrics.subtropicalDrySouthRatio),
    c30Westerlies: round(c30Metrics.midlatitudeWesterliesNorthU10Ms),
    c36Westerlies: round(c36Metrics.midlatitudeWesterliesNorthU10Ms),
    c30OceanCond: round(c30Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c36OceanCond: round(c36Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c30EqLower: round(c30EqLower?.totalWaterFluxNorthKgM_1S),
    c36EqLower: round(c36EqLower?.totalWaterFluxNorthKgM_1S),
    c30EqMid: round(c30EqMid?.totalWaterFluxNorthKgM_1S),
    c36EqMid: round(c36EqMid?.totalWaterFluxNorthKgM_1S),
    c30EqUpper: round(c30EqUpper?.totalWaterFluxNorthKgM_1S),
    c36EqUpper: round(c36EqUpper?.totalWaterFluxNorthKgM_1S),
    c30EqLowerZonal: round(c30EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c36EqLowerZonal: round(c36EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqLowerEddy: round(c30EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c36EqLowerEddy: round(c36EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c30EqMidZonal: round(c30EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c36EqMidZonal: round(c36EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqMidEddy: round(c30EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c36EqMidEddy: round(c36EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c30EqUpperZonal: round(c30EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c36EqUpperZonal: round(c36EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqUpperEddy: round(c30EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c36EqUpperEddy: round(c36EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c30DryLower35: round(c3035Lower?.totalWaterFluxNorthKgM_1S),
    c36DryLower35: round(c3635Lower?.totalWaterFluxNorthKgM_1S),
    c30DryMid35: round(c3035Mid?.totalWaterFluxNorthKgM_1S),
    c36DryMid35: round(c3635Mid?.totalWaterFluxNorthKgM_1S),
    c30DryUpper35: round(c3035Upper?.totalWaterFluxNorthKgM_1S),
    c36DryUpper35: round(c3635Upper?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c30OceanCond: round(c30Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c36OceanCond: round(c36Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c30Carryover: round(c30Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c36Carryover: round(c36Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c30Persistence: round(c30Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c36Persistence: round(c36Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c30WeakErosion: round(c30Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c36WeakErosion: round(c36Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c30UpperCloudPath: round(c30Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c36UpperCloudPath: round(c36Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c30CloudRecirc: round(c30Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c36CloudRecirc: round(c36Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c30NorthReturn: round(c30Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c36NorthReturn: round(c36Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c30DominantVaporImport: round(c30Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S),
    c36DominantVaporImport: round(c36Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c30PrimaryRegime: c30ThermoClass.primaryRegime || null,
    c36PrimaryRegime: c36ThermoClass.primaryRegime || null,
    c30DynamicsSupport: round(c30ThermoClass.dynamicsSupportScore),
    c36DynamicsSupport: round(c36ThermoClass.dynamicsSupportScore),
    c30MoistureSupport: round(c30ThermoClass.moistureSupportScore),
    c36MoistureSupport: round(c36ThermoClass.moistureSupportScore)
  };

  const decision = classifyC37Decision({
    ...quickComparison,
    ...transportComparison,
    ...dryBeltComparison,
    ...thermodynamicComparison
  });

  const nextContract = {
    focusTargets: [
      'start from the strict C32 organized-support / potential carveout base',
      'restore organized-support admission only inside the inner equatorial core instead of globally',
      'preserve the strict C32 receiver containment outside the core while testing lower-mid transport recovery'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c37-organized-support-half-relax-carry-input-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC37Markdown({
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
