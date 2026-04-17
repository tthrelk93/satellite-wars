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
  c22QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick.json'),
  c24QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick.json'),
  c22TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-transport-interface-budget.json'),
  c24TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-transport-interface-budget.json'),
  c22HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-hadley-partition-summary.json'),
  c24HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-hadley-partition-summary.json'),
  c22MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-moisture-attribution.json'),
  c24MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-moisture-attribution.json'),
  c22ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c22-equatorial-band-eddy-softening-quick-thermodynamic-support-summary.json'),
  c24ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.json')
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

export function classifyC25Decision({
  c22CrossEq,
  c24CrossEq,
  c22ItczWidth,
  c24ItczWidth,
  c22DryNorth,
  c24DryNorth,
  c22DrySouth,
  c24DrySouth,
  c22EqBoundary,
  c24EqBoundary,
  c22EqLower,
  c24EqLower,
  c22EqMid,
  c24EqMid,
  c22EqUpper,
  c24EqUpper,
  c22EqLowerZonal,
  c24EqLowerZonal,
  c22EqLowerEddy,
  c24EqLowerEddy,
  c22EqMidZonal,
  c24EqMidZonal,
  c22EqMidEddy,
  c24EqMidEddy,
  c22Carryover,
  c24Carryover,
  c22Persistence,
  c24Persistence,
  c22WeakErosion,
  c24WeakErosion,
  c22CloudRecirc,
  c24CloudRecirc,
  c22NorthReturn,
  c24NorthReturn
}) {
  const quickShapeImproved =
    Number.isFinite(c22ItczWidth) && Number.isFinite(c24ItczWidth) && c24ItczWidth < c22ItczWidth
    && Number.isFinite(c22DryNorth) && Number.isFinite(c24DryNorth) && c24DryNorth < c22DryNorth
    && Number.isFinite(c22DrySouth) && Number.isFinite(c24DrySouth) && c24DrySouth <= c22DrySouth;

  const crossEqWorsened = Number.isFinite(c22CrossEq) && Number.isFinite(c24CrossEq) && c24CrossEq < c22CrossEq;
  const lowerMidRelieved =
    Number.isFinite(c22EqBoundary) && Number.isFinite(c24EqBoundary) && c24EqBoundary > c22EqBoundary
    && Number.isFinite(c22EqLower) && Number.isFinite(c24EqLower) && c24EqLower > c22EqLower
    && Number.isFinite(c22EqMid) && Number.isFinite(c24EqMid) && c24EqMid > c22EqMid
    && Number.isFinite(c22EqLowerZonal) && Number.isFinite(c24EqLowerZonal) && c24EqLowerZonal > c22EqLowerZonal
    && Number.isFinite(c22EqMidZonal) && Number.isFinite(c24EqMidZonal) && c24EqMidZonal > c22EqMidZonal;
  const eddyTradeMixed =
    Number.isFinite(c22EqLowerEddy) && Number.isFinite(c24EqLowerEddy) && c24EqLowerEddy > c22EqLowerEddy
    && Number.isFinite(c22EqMidEddy) && Number.isFinite(c24EqMidEddy) && c24EqMidEddy < c22EqMidEddy;
  const upperAndCarryoverRebounded =
    Number.isFinite(c22EqUpper) && Number.isFinite(c24EqUpper) && c24EqUpper < c22EqUpper
    && Number.isFinite(c22Carryover) && Number.isFinite(c24Carryover) && c24Carryover > c22Carryover
    && Number.isFinite(c22Persistence) && Number.isFinite(c24Persistence) && c24Persistence > c22Persistence
    && Number.isFinite(c22WeakErosion) && Number.isFinite(c24WeakErosion) && c24WeakErosion > c22WeakErosion
    && Number.isFinite(c22CloudRecirc) && Number.isFinite(c24CloudRecirc) && c24CloudRecirc > c22CloudRecirc
    && Number.isFinite(c22NorthReturn) && Number.isFinite(c24NorthReturn) && c24NorthReturn > c22NorthReturn;

  if (quickShapeImproved && crossEqWorsened && lowerMidRelieved && eddyTradeMixed && upperAndCarryoverRebounded) {
    return {
      verdict: 'inner_core_narrowing_relieves_lower_mid_core_but_reopens_upper_carryover_shoulder',
      nextMove: 'Architecture C26: partial equatorial shoulder restore experiment'
    };
  }

  return {
    verdict: 'inner_core_equatorial_eddy_softening_attribution_inconclusive',
    nextMove: 'Architecture C26: broader inner-core shoulder follow-up experiment'
  };
}

export function renderArchitectureC25Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C25 Inner-Core Equatorial Eddy Softening Attribution',
    '',
    'This phase attributes the C24 inner-core narrowing relative to the broader C22 equatorial-band carveout. The question is whether the inner-core move relieved the right equatorial branch or simply traded one transport defect for another.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C22 vs C24 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C22 \`${quickComparison.c22CrossEq}\`, C24 \`${quickComparison.c24CrossEq}\``,
    `- ITCZ width: C22 \`${quickComparison.c22ItczWidth}\`, C24 \`${quickComparison.c24ItczWidth}\``,
    `- NH dry-belt ratio: C22 \`${quickComparison.c22DryNorth}\`, C24 \`${quickComparison.c24DryNorth}\``,
    `- SH dry-belt ratio: C22 \`${quickComparison.c22DrySouth}\`, C24 \`${quickComparison.c24DrySouth}\``,
    `- NH midlatitude westerlies: C22 \`${quickComparison.c22Westerlies}\`, C24 \`${quickComparison.c24Westerlies}\``,
    `- NH dry-belt ocean condensation: C22 \`${quickComparison.c22OceanCond}\`, C24 \`${quickComparison.c24OceanCond}\``,
    '',
    '## Equatorial transport repartition',
    '',
    `- equator boundary-layer total-water flux north: C22 \`${transportComparison.c22EqBoundary}\`, C24 \`${transportComparison.c24EqBoundary}\``,
    `- equator lower-troposphere total-water flux north: C22 \`${transportComparison.c22EqLower}\`, C24 \`${transportComparison.c24EqLower}\``,
    `- equator mid-troposphere total-water flux north: C22 \`${transportComparison.c22EqMid}\`, C24 \`${transportComparison.c24EqMid}\``,
    `- equator upper-troposphere total-water flux north: C22 \`${transportComparison.c22EqUpper}\`, C24 \`${transportComparison.c24EqUpper}\``,
    `- equator lower zonal-mean transport: C22 \`${transportComparison.c22EqLowerZonal}\`, C24 \`${transportComparison.c24EqLowerZonal}\``,
    `- equator lower eddy transport: C22 \`${transportComparison.c22EqLowerEddy}\`, C24 \`${transportComparison.c24EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C22 \`${transportComparison.c22EqMidZonal}\`, C24 \`${transportComparison.c24EqMidZonal}\``,
    `- equator mid eddy transport: C22 \`${transportComparison.c22EqMidEddy}\`, C24 \`${transportComparison.c24EqMidEddy}\``,
    `- 35° lower vapor import: C22 \`${transportComparison.c22North35Lower}\`, C24 \`${transportComparison.c24North35Lower}\``,
    `- 35° mid vapor import: C22 \`${transportComparison.c22North35Mid}\`, C24 \`${transportComparison.c24North35Mid}\``,
    '',
    '## Dry-belt carryover rebound',
    '',
    `- carried-over upper cloud: C22 \`${dryBeltComparison.c22Carryover}\`, C24 \`${dryBeltComparison.c24Carryover}\``,
    `- imported anvil persistence: C22 \`${dryBeltComparison.c22Persistence}\`, C24 \`${dryBeltComparison.c24Persistence}\``,
    `- weak-erosion survival: C22 \`${dryBeltComparison.c22WeakErosion}\`, C24 \`${dryBeltComparison.c24WeakErosion}\``,
    `- upper-cloud path: C22 \`${dryBeltComparison.c22UpperCloudPath}\`, C24 \`${dryBeltComparison.c24UpperCloudPath}\``,
    `- cloud recirculation proxy: C22 \`${dryBeltComparison.c22CloudRecirc}\`, C24 \`${dryBeltComparison.c24CloudRecirc}\``,
    `- return-branch mass flux: C22 \`${dryBeltComparison.c22NorthReturn}\`, C24 \`${dryBeltComparison.c24NorthReturn}\``,
    `- north transition vapor flux north: C22 \`${dryBeltComparison.c22TransitionFlux}\`, C24 \`${dryBeltComparison.c24TransitionFlux}\``,
    `- north dry-belt vapor flux north: C22 \`${dryBeltComparison.c22DryBeltFlux}\`, C24 \`${dryBeltComparison.c24DryBeltFlux}\``,
    '',
    '## Thermodynamic shift',
    '',
    `- C22 primary regime: \`${thermodynamicComparison.c22PrimaryRegime}\``,
    `- C24 primary regime: \`${thermodynamicComparison.c24PrimaryRegime}\``,
    `- C22 dynamics support score: \`${thermodynamicComparison.c22DynamicsSupport}\``,
    `- C24 dynamics support score: \`${thermodynamicComparison.c24DynamicsSupport}\``,
    `- C22 moisture support score: \`${thermodynamicComparison.c22MoistureSupport}\``,
    `- C24 moisture support score: \`${thermodynamicComparison.c24MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- C24 did improve the broad quick-shape metrics and relieved parts of the boundary/lower/mid equatorial transport burden relative to C22.',
    '- But the inner-core narrowing gave back some upper-branch relief and reopened the dry-belt carryover / return-branch side of the hybrid.',
    '- That means the 10–16° shoulder was carrying useful upper-branch and containment support even while parts of it were harming the lower-mid equatorial branch.',
    '- The next bounded move should be a partial shoulder restore, not a full reversion to C22 and not another fully narrowed inner-core cut.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C17 carryover carveout fixed.',
    '- Keep the C24 inner-core narrowing as the baseline equatorial relief contract.',
    '- Restore only a modest amount of outer-shoulder softening so the 10–12°/12–14° rows can recover upper-branch and carryover support without recreating the full C22 lower-mid drag.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c22Quick = readJson(options.c22QuickPath);
  const c24Quick = readJson(options.c24QuickPath);
  const c22Transport = readJson(options.c22TransportPath);
  const c24Transport = readJson(options.c24TransportPath);
  const c22Hadley = readJson(options.c22HadleyPath);
  const c24Hadley = readJson(options.c24HadleyPath);
  const c22Moisture = readJson(options.c22MoisturePath);
  const c24Moisture = readJson(options.c24MoisturePath);
  const c22Thermo = readJson(options.c22ThermoPath);
  const c24Thermo = readJson(options.c24ThermoPath);

  const c22Metrics = latestMetrics(c22Quick);
  const c24Metrics = latestMetrics(c24Quick);
  const c22EqBoundary = getBand(c22Transport, 0, 'boundaryLayer');
  const c24EqBoundary = getBand(c24Transport, 0, 'boundaryLayer');
  const c22EqLower = getBand(c22Transport, 0, 'lowerTroposphere');
  const c24EqLower = getBand(c24Transport, 0, 'lowerTroposphere');
  const c22EqMid = getBand(c22Transport, 0, 'midTroposphere');
  const c24EqMid = getBand(c24Transport, 0, 'midTroposphere');
  const c22EqUpper = getBand(c22Transport, 0, 'upperTroposphere');
  const c24EqUpper = getBand(c24Transport, 0, 'upperTroposphere');
  const c22North35Lower = getBand(c22Transport, 35, 'lowerTroposphere');
  const c24North35Lower = getBand(c24Transport, 35, 'lowerTroposphere');
  const c22North35Mid = getBand(c22Transport, 35, 'midTroposphere');
  const c24North35Mid = getBand(c24Transport, 35, 'midTroposphere');

  const quickComparison = {
    c22CrossEq: round(c22Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c24CrossEq: round(c24Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c22ItczWidth: round(c22Metrics.itczWidthDeg),
    c24ItczWidth: round(c24Metrics.itczWidthDeg),
    c22DryNorth: round(c22Metrics.subtropicalDryNorthRatio),
    c24DryNorth: round(c24Metrics.subtropicalDryNorthRatio),
    c22DrySouth: round(c22Metrics.subtropicalDrySouthRatio),
    c24DrySouth: round(c24Metrics.subtropicalDrySouthRatio),
    c22Westerlies: round(c22Metrics.midlatitudeWesterliesNorthU10Ms),
    c24Westerlies: round(c24Metrics.midlatitudeWesterliesNorthU10Ms),
    c22OceanCond: round(c22Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c24OceanCond: round(c24Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c22EqBoundary: round(c22EqBoundary?.totalWaterFluxNorthKgM_1S),
    c24EqBoundary: round(c24EqBoundary?.totalWaterFluxNorthKgM_1S),
    c22EqLower: round(c22EqLower?.totalWaterFluxNorthKgM_1S),
    c24EqLower: round(c24EqLower?.totalWaterFluxNorthKgM_1S),
    c22EqMid: round(c22EqMid?.totalWaterFluxNorthKgM_1S),
    c24EqMid: round(c24EqMid?.totalWaterFluxNorthKgM_1S),
    c22EqUpper: round(c22EqUpper?.totalWaterFluxNorthKgM_1S),
    c24EqUpper: round(c24EqUpper?.totalWaterFluxNorthKgM_1S),
    c22EqLowerZonal: round(c22EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c24EqLowerZonal: round(c24EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c22EqLowerEddy: round(c22EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c24EqLowerEddy: round(c24EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c22EqMidZonal: round(c22EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c24EqMidZonal: round(c24EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c22EqMidEddy: round(c22EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c24EqMidEddy: round(c24EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c22North35Lower: round(c22North35Lower?.totalWaterFluxNorthKgM_1S),
    c24North35Lower: round(c24North35Lower?.totalWaterFluxNorthKgM_1S),
    c22North35Mid: round(c22North35Mid?.totalWaterFluxNorthKgM_1S),
    c24North35Mid: round(c24North35Mid?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c22Carryover: round(c22Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c24Carryover: round(c24Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c22Persistence: round(c22Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c24Persistence: round(c24Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c22WeakErosion: round(c22Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c24WeakErosion: round(c24Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c22UpperCloudPath: round(c22Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c24UpperCloudPath: round(c24Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c22CloudRecirc: round(c22Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c24CloudRecirc: round(c24Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c22NorthReturn: round(c22Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c24NorthReturn: round(c24Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c22TransitionFlux: round(c22Moisture.latestMetrics?.northTransitionVaporFluxNorthKgM_1S),
    c24TransitionFlux: round(c24Moisture.latestMetrics?.northTransitionVaporFluxNorthKgM_1S),
    c22DryBeltFlux: round(c22Moisture.latestMetrics?.northDryBeltVaporFluxNorthKgM_1S),
    c24DryBeltFlux: round(c24Moisture.latestMetrics?.northDryBeltVaporFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c22PrimaryRegime: c22Thermo.classification?.primaryRegime || null,
    c24PrimaryRegime: c24Thermo.classification?.primaryRegime || null,
    c22DynamicsSupport: round(c22Thermo.classification?.dynamicsSupportScore, 5),
    c24DynamicsSupport: round(c24Thermo.classification?.dynamicsSupportScore, 5),
    c22MoistureSupport: round(c22Thermo.classification?.moistureSupportScore, 5),
    c24MoistureSupport: round(c24Thermo.classification?.moistureSupportScore, 5)
  };

  const decision = classifyC25Decision({
    c22CrossEq: quickComparison.c22CrossEq,
    c24CrossEq: quickComparison.c24CrossEq,
    c22ItczWidth: quickComparison.c22ItczWidth,
    c24ItczWidth: quickComparison.c24ItczWidth,
    c22DryNorth: quickComparison.c22DryNorth,
    c24DryNorth: quickComparison.c24DryNorth,
    c22DrySouth: quickComparison.c22DrySouth,
    c24DrySouth: quickComparison.c24DrySouth,
    c22EqBoundary: transportComparison.c22EqBoundary,
    c24EqBoundary: transportComparison.c24EqBoundary,
    c22EqLower: transportComparison.c22EqLower,
    c24EqLower: transportComparison.c24EqLower,
    c22EqMid: transportComparison.c22EqMid,
    c24EqMid: transportComparison.c24EqMid,
    c22EqUpper: transportComparison.c22EqUpper,
    c24EqUpper: transportComparison.c24EqUpper,
    c22EqLowerZonal: transportComparison.c22EqLowerZonal,
    c24EqLowerZonal: transportComparison.c24EqLowerZonal,
    c22EqLowerEddy: transportComparison.c22EqLowerEddy,
    c24EqLowerEddy: transportComparison.c24EqLowerEddy,
    c22EqMidZonal: transportComparison.c22EqMidZonal,
    c24EqMidZonal: transportComparison.c24EqMidZonal,
    c22EqMidEddy: transportComparison.c22EqMidEddy,
    c24EqMidEddy: transportComparison.c24EqMidEddy,
    c22Carryover: dryBeltComparison.c22Carryover,
    c24Carryover: dryBeltComparison.c24Carryover,
    c22Persistence: dryBeltComparison.c22Persistence,
    c24Persistence: dryBeltComparison.c24Persistence,
    c22WeakErosion: dryBeltComparison.c22WeakErosion,
    c24WeakErosion: dryBeltComparison.c24WeakErosion,
    c22CloudRecirc: dryBeltComparison.c22CloudRecirc,
    c24CloudRecirc: dryBeltComparison.c24CloudRecirc,
    c22NorthReturn: dryBeltComparison.c22NorthReturn,
    c24NorthReturn: dryBeltComparison.c24NorthReturn
  });

  const nextContract = {
    focusTargets: [
      'keep the 0–10° inner-core narrowing as the lower-mid relief anchor',
      'restore only a modest outer shoulder between roughly 10–12° or 10–14°',
      'recover some upper-branch and carryover containment relief without returning to the full C22 4–16° / 0.7 blend'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC25Markdown({
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
