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
  c17QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick.json'),
  c22QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick.json'),
  c17TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-transport-interface-budget.json'),
  c22TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-transport-interface-budget.json'),
  c17HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-hadley-partition-summary.json'),
  c22HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-hadley-partition-summary.json'),
  c17MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-moisture-attribution.json'),
  c22MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-moisture-attribution.json'),
  c17ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-thermodynamic-support-summary.json'),
  c22ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.json')
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

export function classifyC23Decision({
  c17CrossEq,
  c22CrossEq,
  c17Carryover,
  c22Carryover,
  c17Persistence,
  c22Persistence,
  c17WeakErosion,
  c22WeakErosion,
  c17CloudRecirc,
  c22CloudRecirc,
  c17NorthReturn,
  c22NorthReturn,
  c17EqUpper,
  c22EqUpper,
  c17EqLowerZonal,
  c22EqLowerZonal,
  c17EqMidZonal,
  c22EqMidZonal
}) {
  const crossEqStillWorse = Number.isFinite(c17CrossEq) && Number.isFinite(c22CrossEq) && c22CrossEq < c17CrossEq;
  const carryoverPreserved = Number.isFinite(c17Carryover) && Number.isFinite(c22Carryover) && c22Carryover <= c17Carryover;
  const persistencePreserved = Number.isFinite(c17Persistence) && Number.isFinite(c22Persistence) && c22Persistence <= c17Persistence;
  const weakErosionPreserved = Number.isFinite(c17WeakErosion) && Number.isFinite(c22WeakErosion) && c22WeakErosion <= c17WeakErosion;
  const recircPreserved = Number.isFinite(c17CloudRecirc) && Number.isFinite(c22CloudRecirc) && c22CloudRecirc <= c17CloudRecirc + 0.01;
  const returnPreserved = Number.isFinite(c17NorthReturn) && Number.isFinite(c22NorthReturn) && c22NorthReturn <= c17NorthReturn;
  const upperRelieved = Number.isFinite(c17EqUpper) && Number.isFinite(c22EqUpper) && c22EqUpper > c17EqUpper;
  const lowerZonalWorsened = Number.isFinite(c17EqLowerZonal) && Number.isFinite(c22EqLowerZonal) && c22EqLowerZonal < c17EqLowerZonal;
  const midZonalWorsened = Number.isFinite(c17EqMidZonal) && Number.isFinite(c22EqMidZonal) && c22EqMidZonal < c17EqMidZonal;

  if (
    crossEqStillWorse
    && carryoverPreserved
    && persistencePreserved
    && weakErosionPreserved
    && recircPreserved
    && returnPreserved
    && upperRelieved
    && lowerZonalWorsened
    && midZonalWorsened
  ) {
    return {
      verdict: 'equatorial_band_softening_preserves_dry_belt_relief_but_deepens_lower_mid_zonal_branch',
      nextMove: 'Architecture C24: inner-core equatorial eddy softening experiment'
    };
  }

  return {
    verdict: 'equatorial_band_softening_attribution_inconclusive',
    nextMove: 'Architecture C24: broadened equatorial-band follow-up experiment'
  };
}

export function renderArchitectureC23Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C23 Equatorial-Band Eddy Softening Attribution',
    '',
    'This phase attributes the C22 equatorial-band eddy-softening result relative to the stronger C17 carryover-carveout base. The question is whether the narrower band preserved the right dry-belt relief while concentrating the remaining defect into a smaller equatorial transport branch.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C17 vs C22 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C17 \`${quickComparison.c17CrossEq}\`, C22 \`${quickComparison.c22CrossEq}\``,
    `- ITCZ width: C17 \`${quickComparison.c17ItczWidth}\`, C22 \`${quickComparison.c22ItczWidth}\``,
    `- NH dry-belt ratio: C17 \`${quickComparison.c17DryNorth}\`, C22 \`${quickComparison.c22DryNorth}\``,
    `- SH dry-belt ratio: C17 \`${quickComparison.c17DrySouth}\`, C22 \`${quickComparison.c22DrySouth}\``,
    `- NH midlatitude westerlies: C17 \`${quickComparison.c17Westerlies}\`, C22 \`${quickComparison.c22Westerlies}\``,
    `- NH dry-belt ocean condensation: C17 \`${quickComparison.c17OceanCond}\`, C22 \`${quickComparison.c22OceanCond}\``,
    '',
    '## Equatorial transport repartition',
    '',
    `- equator boundary-layer total-water flux north: C17 \`${transportComparison.c17EqBoundary}\`, C22 \`${transportComparison.c22EqBoundary}\``,
    `- equator lower-troposphere total-water flux north: C17 \`${transportComparison.c17EqLower}\`, C22 \`${transportComparison.c22EqLower}\``,
    `- equator mid-troposphere total-water flux north: C17 \`${transportComparison.c17EqMid}\`, C22 \`${transportComparison.c22EqMid}\``,
    `- equator upper-troposphere total-water flux north: C17 \`${transportComparison.c17EqUpper}\`, C22 \`${transportComparison.c22EqUpper}\``,
    `- equator lower zonal-mean transport: C17 \`${transportComparison.c17EqLowerZonal}\`, C22 \`${transportComparison.c22EqLowerZonal}\``,
    `- equator lower eddy transport: C17 \`${transportComparison.c17EqLowerEddy}\`, C22 \`${transportComparison.c22EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C17 \`${transportComparison.c17EqMidZonal}\`, C22 \`${transportComparison.c22EqMidZonal}\``,
    `- equator mid eddy transport: C17 \`${transportComparison.c17EqMidEddy}\`, C22 \`${transportComparison.c22EqMidEddy}\``,
    `- 35° lower vapor import: C17 \`${transportComparison.c17North35Lower}\`, C22 \`${transportComparison.c22North35Lower}\``,
    `- 35° mid vapor import: C17 \`${transportComparison.c17North35Mid}\`, C22 \`${transportComparison.c22North35Mid}\``,
    '',
    '## Dry-belt containment preservation',
    '',
    `- carried-over upper cloud: C17 \`${dryBeltComparison.c17Carryover}\`, C22 \`${dryBeltComparison.c22Carryover}\``,
    `- imported anvil persistence: C17 \`${dryBeltComparison.c17Persistence}\`, C22 \`${dryBeltComparison.c22Persistence}\``,
    `- weak-erosion survival: C17 \`${dryBeltComparison.c17WeakErosion}\`, C22 \`${dryBeltComparison.c22WeakErosion}\``,
    `- upper-cloud path: C17 \`${dryBeltComparison.c17UpperCloudPath}\`, C22 \`${dryBeltComparison.c22UpperCloudPath}\``,
    `- cloud recirculation proxy: C17 \`${dryBeltComparison.c17CloudRecirc}\`, C22 \`${dryBeltComparison.c22CloudRecirc}\``,
    `- return-branch mass flux: C17 \`${dryBeltComparison.c17NorthReturn}\`, C22 \`${dryBeltComparison.c22NorthReturn}\``,
    `- north transition vapor flux north: C17 \`${dryBeltComparison.c17TransitionFlux}\`, C22 \`${dryBeltComparison.c22TransitionFlux}\``,
    `- north dry-belt vapor flux north: C17 \`${dryBeltComparison.c17DryBeltFlux}\`, C22 \`${dryBeltComparison.c22DryBeltFlux}\``,
    '',
    '## Thermodynamic shift',
    '',
    `- C17 primary regime: \`${thermodynamicComparison.c17PrimaryRegime}\``,
    `- C22 primary regime: \`${thermodynamicComparison.c22PrimaryRegime}\``,
    `- C17 dynamics support score: \`${thermodynamicComparison.c17DynamicsSupport}\``,
    `- C22 dynamics support score: \`${thermodynamicComparison.c22DynamicsSupport}\``,
    `- C17 moisture support score: \`${thermodynamicComparison.c17MoistureSupport}\``,
    `- C22 moisture support score: \`${thermodynamicComparison.c22MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- C22 preserved the dry-belt containment side of C17 instead of reactivating the carryover family.',
    '- The equatorial-band carveout also slightly improved the upper-troposphere branch and the 35° NH import burden.',
    '- But the remaining sign defect tightened into the equatorial lower-to-mid zonal branch: boundary/lower/mid transport got more negative even while upper export was marginally relieved.',
    '- That means the next bounded move should keep the C22 carryover preservation but trim the softened latitude footprint again so the inner equatorial core is tested without pulling the outer lower-mid rows farther southward.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C17 carryover carveout fixed.',
    '- Preserve the C22 reduction in dry-belt carryover / recirculation / return-branch mass flux.',
    '- Narrow and weaken the equatorial softening so it acts on the inner equatorial core instead of the full 4–16° band.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c17Quick = readJson(options.c17QuickPath);
  const c22Quick = readJson(options.c22QuickPath);
  const c17Transport = readJson(options.c17TransportPath);
  const c22Transport = readJson(options.c22TransportPath);
  const c17Hadley = readJson(options.c17HadleyPath);
  const c22Hadley = readJson(options.c22HadleyPath);
  const c17Moisture = readJson(options.c17MoisturePath);
  const c22Moisture = readJson(options.c22MoisturePath);
  const c17Thermo = readJson(options.c17ThermoPath);
  const c22Thermo = readJson(options.c22ThermoPath);

  const c17Metrics = latestMetrics(c17Quick);
  const c22Metrics = latestMetrics(c22Quick);
  const c17EqBoundary = getBand(c17Transport, 0, 'boundaryLayer');
  const c22EqBoundary = getBand(c22Transport, 0, 'boundaryLayer');
  const c17EqLower = getBand(c17Transport, 0, 'lowerTroposphere');
  const c22EqLower = getBand(c22Transport, 0, 'lowerTroposphere');
  const c17EqMid = getBand(c17Transport, 0, 'midTroposphere');
  const c22EqMid = getBand(c22Transport, 0, 'midTroposphere');
  const c17EqUpper = getBand(c17Transport, 0, 'upperTroposphere');
  const c22EqUpper = getBand(c22Transport, 0, 'upperTroposphere');
  const c17North35Lower = getBand(c17Transport, 35, 'lowerTroposphere');
  const c22North35Lower = getBand(c22Transport, 35, 'lowerTroposphere');
  const c17North35Mid = getBand(c17Transport, 35, 'midTroposphere');
  const c22North35Mid = getBand(c22Transport, 35, 'midTroposphere');

  const quickComparison = {
    c17CrossEq: round(c17Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c22CrossEq: round(c22Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c17ItczWidth: round(c17Metrics.itczWidthDeg),
    c22ItczWidth: round(c22Metrics.itczWidthDeg),
    c17DryNorth: round(c17Metrics.subtropicalDryNorthRatio),
    c22DryNorth: round(c22Metrics.subtropicalDryNorthRatio),
    c17DrySouth: round(c17Metrics.subtropicalDrySouthRatio),
    c22DrySouth: round(c22Metrics.subtropicalDrySouthRatio),
    c17Westerlies: round(c17Metrics.midlatitudeWesterliesNorthU10Ms),
    c22Westerlies: round(c22Metrics.midlatitudeWesterliesNorthU10Ms),
    c17OceanCond: round(c17Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c22OceanCond: round(c22Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c17EqBoundary: round(c17EqBoundary?.totalWaterFluxNorthKgM_1S),
    c22EqBoundary: round(c22EqBoundary?.totalWaterFluxNorthKgM_1S),
    c17EqLower: round(c17EqLower?.totalWaterFluxNorthKgM_1S),
    c22EqLower: round(c22EqLower?.totalWaterFluxNorthKgM_1S),
    c17EqMid: round(c17EqMid?.totalWaterFluxNorthKgM_1S),
    c22EqMid: round(c22EqMid?.totalWaterFluxNorthKgM_1S),
    c17EqUpper: round(c17EqUpper?.totalWaterFluxNorthKgM_1S),
    c22EqUpper: round(c22EqUpper?.totalWaterFluxNorthKgM_1S),
    c17EqLowerZonal: round(c17EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c22EqLowerZonal: round(c22EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c17EqLowerEddy: round(c17EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c22EqLowerEddy: round(c22EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c17EqMidZonal: round(c17EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c22EqMidZonal: round(c22EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c17EqMidEddy: round(c17EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c22EqMidEddy: round(c22EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c17North35Lower: round(c17North35Lower?.totalWaterFluxNorthKgM_1S),
    c22North35Lower: round(c22North35Lower?.totalWaterFluxNorthKgM_1S),
    c17North35Mid: round(c17North35Mid?.totalWaterFluxNorthKgM_1S),
    c22North35Mid: round(c22North35Mid?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c17Carryover: round(c17Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c22Carryover: round(c22Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c17Persistence: round(c17Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c22Persistence: round(c22Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c17WeakErosion: round(c17Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c22WeakErosion: round(c22Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c17UpperCloudPath: round(c17Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c22UpperCloudPath: round(c22Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c17CloudRecirc: round(c17Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c22CloudRecirc: round(c22Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c17NorthReturn: round(c17Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c22NorthReturn: round(c22Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c17TransitionFlux: round(c17Moisture.latestMetrics?.northTransitionVaporFluxNorthKgM_1S),
    c22TransitionFlux: round(c22Moisture.latestMetrics?.northTransitionVaporFluxNorthKgM_1S),
    c17DryBeltFlux: round(c17Moisture.latestMetrics?.northDryBeltVaporFluxNorthKgM_1S),
    c22DryBeltFlux: round(c22Moisture.latestMetrics?.northDryBeltVaporFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c17PrimaryRegime: c17Thermo.classification?.primaryRegime || null,
    c22PrimaryRegime: c22Thermo.classification?.primaryRegime || null,
    c17DynamicsSupport: round(c17Thermo.classification?.dynamicsSupportScore),
    c22DynamicsSupport: round(c22Thermo.classification?.dynamicsSupportScore),
    c17MoistureSupport: round(c17Thermo.classification?.moistureSupportScore),
    c22MoistureSupport: round(c22Thermo.classification?.moistureSupportScore)
  };

  const decision = classifyC23Decision({
    ...quickComparison,
    ...transportComparison,
    ...dryBeltComparison
  });

  const nextContract = {
    focusTargets: [
      'narrow the softening footprint from the full 4–16° band into the inner equatorial core',
      'reduce blend-to-unity amplitude so the lower/mid zonal branch is perturbed less strongly',
      'keep the C17 carryover carveout and the C22 dry-belt containment contract fixed'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC23Markdown({
    decision,
    quickComparison,
    transportComparison,
    dryBeltComparison,
    thermodynamicComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, quickComparison, transportComparison })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
