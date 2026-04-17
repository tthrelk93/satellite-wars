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
  c24QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick.json'),
  c26QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick.json'),
  c24TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-transport-interface-budget.json'),
  c26TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-transport-interface-budget.json'),
  c24HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-hadley-partition-summary.json'),
  c26HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-hadley-partition-summary.json'),
  c24MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-moisture-attribution.json'),
  c26MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-moisture-attribution.json'),
  c24ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick-thermodynamic-support-summary.json'),
  c26ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c27-partial-equatorial-shoulder-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c27-partial-equatorial-shoulder-restore-attribution.json')
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

export function classifyC27Decision({
  c24CrossEq,
  c26CrossEq,
  c24EqLower,
  c26EqLower,
  c24EqUpper,
  c26EqUpper,
  c24NorthReturn,
  c26NorthReturn,
  c24CloudRecirc,
  c26CloudRecirc,
  c24North35Lower,
  c26North35Lower,
  c24North35Mid,
  c26North35Mid,
  c24OceanCond,
  c26OceanCond
}) {
  const crossEqRelieved = Number.isFinite(c24CrossEq) && Number.isFinite(c26CrossEq) && c26CrossEq > c24CrossEq;
  const upperRelieved = Number.isFinite(c24EqUpper) && Number.isFinite(c26EqUpper) && c26EqUpper > c24EqUpper;
  const northReturnRelieved = Number.isFinite(c24NorthReturn) && Number.isFinite(c26NorthReturn) && c26NorthReturn < c24NorthReturn;
  const oceanCondRelieved = Number.isFinite(c24OceanCond) && Number.isFinite(c26OceanCond) && c26OceanCond < c24OceanCond;
  const lowerReloaded = Number.isFinite(c24EqLower) && Number.isFinite(c26EqLower) && c26EqLower < c24EqLower;
  const cloudRecircReloaded = Number.isFinite(c24CloudRecirc) && Number.isFinite(c26CloudRecirc) && c26CloudRecirc > c24CloudRecirc;
  const northImportReloaded =
    Number.isFinite(c24North35Lower) && Number.isFinite(c26North35Lower) && c26North35Lower < c24North35Lower
    && Number.isFinite(c24North35Mid) && Number.isFinite(c26North35Mid) && c26North35Mid < c24North35Mid;

  if (
    crossEqRelieved
    && upperRelieved
    && northReturnRelieved
    && oceanCondRelieved
    && lowerReloaded
    && cloudRecircReloaded
    && northImportReloaded
  ) {
    return {
      verdict: 'partial_shoulder_restore_recovers_upper_branch_and_return_flow_but_reloads_lower_import_and_cloud_recirculation',
      nextMove: 'Architecture C28: weak partial equatorial shoulder restore experiment'
    };
  }

  return {
    verdict: 'partial_equatorial_shoulder_restore_attribution_inconclusive',
    nextMove: 'Architecture C28: broader weak shoulder follow-up experiment'
  };
}

export function renderArchitectureC27Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C27 Partial Equatorial Shoulder Restore Attribution',
    '',
    'This phase attributes the C26 partial shoulder restore relative to the C24 inner-core baseline. The question is whether restoring a small outer shoulder helped the right circulation branch or simply reloaded the wrong imports.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C24 vs C26 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C24 \`${quickComparison.c24CrossEq}\`, C26 \`${quickComparison.c26CrossEq}\``,
    `- ITCZ width: C24 \`${quickComparison.c24ItczWidth}\`, C26 \`${quickComparison.c26ItczWidth}\``,
    `- NH dry-belt ratio: C24 \`${quickComparison.c24DryNorth}\`, C26 \`${quickComparison.c26DryNorth}\``,
    `- SH dry-belt ratio: C24 \`${quickComparison.c24DrySouth}\`, C26 \`${quickComparison.c26DrySouth}\``,
    `- NH midlatitude westerlies: C24 \`${quickComparison.c24Westerlies}\`, C26 \`${quickComparison.c26Westerlies}\``,
    `- NH dry-belt ocean condensation: C24 \`${quickComparison.c24OceanCond}\`, C26 \`${quickComparison.c26OceanCond}\``,
    '',
    '## Equatorial transport repartition',
    '',
    `- equator boundary-layer total-water flux north: C24 \`${transportComparison.c24EqBoundary}\`, C26 \`${transportComparison.c26EqBoundary}\``,
    `- equator lower-troposphere total-water flux north: C24 \`${transportComparison.c24EqLower}\`, C26 \`${transportComparison.c26EqLower}\``,
    `- equator mid-troposphere total-water flux north: C24 \`${transportComparison.c24EqMid}\`, C26 \`${transportComparison.c26EqMid}\``,
    `- equator upper-troposphere total-water flux north: C24 \`${transportComparison.c24EqUpper}\`, C26 \`${transportComparison.c26EqUpper}\``,
    `- equator lower zonal-mean transport: C24 \`${transportComparison.c24EqLowerZonal}\`, C26 \`${transportComparison.c26EqLowerZonal}\``,
    `- equator lower eddy transport: C24 \`${transportComparison.c24EqLowerEddy}\`, C26 \`${transportComparison.c26EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C24 \`${transportComparison.c24EqMidZonal}\`, C26 \`${transportComparison.c26EqMidZonal}\``,
    `- equator mid eddy transport: C24 \`${transportComparison.c24EqMidEddy}\`, C26 \`${transportComparison.c26EqMidEddy}\``,
    `- 35° lower vapor import: C24 \`${transportComparison.c24North35Lower}\`, C26 \`${transportComparison.c26North35Lower}\``,
    `- 35° mid vapor import: C24 \`${transportComparison.c24North35Mid}\`, C26 \`${transportComparison.c26North35Mid}\``,
    '',
    '## Dry-belt carryover / return-flow tradeoff',
    '',
    `- carried-over upper cloud: C24 \`${dryBeltComparison.c24Carryover}\`, C26 \`${dryBeltComparison.c26Carryover}\``,
    `- imported anvil persistence: C24 \`${dryBeltComparison.c24Persistence}\`, C26 \`${dryBeltComparison.c26Persistence}\``,
    `- weak-erosion survival: C24 \`${dryBeltComparison.c24WeakErosion}\`, C26 \`${dryBeltComparison.c26WeakErosion}\``,
    `- upper-cloud path: C24 \`${dryBeltComparison.c24UpperCloudPath}\`, C26 \`${dryBeltComparison.c26UpperCloudPath}\``,
    `- cloud recirculation proxy: C24 \`${dryBeltComparison.c24CloudRecirc}\`, C26 \`${dryBeltComparison.c26CloudRecirc}\``,
    `- return-branch mass flux: C24 \`${dryBeltComparison.c24NorthReturn}\`, C26 \`${dryBeltComparison.c26NorthReturn}\``,
    `- north transition vapor flux north: C24 \`${dryBeltComparison.c24TransitionFlux}\`, C26 \`${dryBeltComparison.c26TransitionFlux}\``,
    `- north dry-belt vapor flux north: C24 \`${dryBeltComparison.c24DryBeltFlux}\`, C26 \`${dryBeltComparison.c26DryBeltFlux}\``,
    '',
    '## Thermodynamic shift',
    '',
    `- C24 primary regime: \`${thermodynamicComparison.c24PrimaryRegime}\``,
    `- C26 primary regime: \`${thermodynamicComparison.c26PrimaryRegime}\``,
    `- C24 dynamics support score: \`${thermodynamicComparison.c24DynamicsSupport}\``,
    `- C26 dynamics support score: \`${thermodynamicComparison.c26DynamicsSupport}\``,
    `- C24 moisture support score: \`${thermodynamicComparison.c24MoistureSupport}\``,
    `- C26 moisture support score: \`${thermodynamicComparison.c26MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- C26 did recover some useful upper-branch and return-flow behavior relative to C24, and it modestly improved both cross-equatorial flux and NH dry-belt ocean condensation.',
    '- But that shoulder restore also reloaded the lower branch, the 35° import burden, and cloud recirculation.',
    '- That means the C26 restore was directionally useful but slightly too strong: the right next move is to keep the restored shoulder concept while weakening it.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C17 carryover carveout fixed.',
    '- Keep the C24 inner-core narrowing as the baseline lower-mid relief anchor.',
    '- Preserve some of the C26 upper-branch and return-flow recovery while trimming the lower-branch reload.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c24Quick = readJson(options.c24QuickPath);
  const c26Quick = readJson(options.c26QuickPath);
  const c24Transport = readJson(options.c24TransportPath);
  const c26Transport = readJson(options.c26TransportPath);
  const c24Hadley = readJson(options.c24HadleyPath);
  const c26Hadley = readJson(options.c26HadleyPath);
  const c24Moisture = readJson(options.c24MoisturePath);
  const c26Moisture = readJson(options.c26MoisturePath);
  const c24Thermo = readJson(options.c24ThermoPath);
  const c26Thermo = readJson(options.c26ThermoPath);

  const c24Metrics = latestMetrics(c24Quick);
  const c26Metrics = latestMetrics(c26Quick);
  const c24EqBoundary = getBand(c24Transport, 0, 'boundaryLayer');
  const c26EqBoundary = getBand(c26Transport, 0, 'boundaryLayer');
  const c24EqLower = getBand(c24Transport, 0, 'lowerTroposphere');
  const c26EqLower = getBand(c26Transport, 0, 'lowerTroposphere');
  const c24EqMid = getBand(c24Transport, 0, 'midTroposphere');
  const c26EqMid = getBand(c26Transport, 0, 'midTroposphere');
  const c24EqUpper = getBand(c24Transport, 0, 'upperTroposphere');
  const c26EqUpper = getBand(c26Transport, 0, 'upperTroposphere');
  const c24North35Lower = getBand(c24Transport, 35, 'lowerTroposphere');
  const c26North35Lower = getBand(c26Transport, 35, 'lowerTroposphere');
  const c24North35Mid = getBand(c24Transport, 35, 'midTroposphere');
  const c26North35Mid = getBand(c26Transport, 35, 'midTroposphere');

  const quickComparison = {
    c24CrossEq: round(c24Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c26CrossEq: round(c26Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c24ItczWidth: round(c24Metrics.itczWidthDeg),
    c26ItczWidth: round(c26Metrics.itczWidthDeg),
    c24DryNorth: round(c24Metrics.subtropicalDryNorthRatio),
    c26DryNorth: round(c26Metrics.subtropicalDryNorthRatio),
    c24DrySouth: round(c24Metrics.subtropicalDrySouthRatio),
    c26DrySouth: round(c26Metrics.subtropicalDrySouthRatio),
    c24Westerlies: round(c24Metrics.midlatitudeWesterliesNorthU10Ms),
    c26Westerlies: round(c26Metrics.midlatitudeWesterliesNorthU10Ms),
    c24OceanCond: round(c24Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c26OceanCond: round(c26Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c24EqBoundary: round(c24EqBoundary?.totalWaterFluxNorthKgM_1S),
    c26EqBoundary: round(c26EqBoundary?.totalWaterFluxNorthKgM_1S),
    c24EqLower: round(c24EqLower?.totalWaterFluxNorthKgM_1S),
    c26EqLower: round(c26EqLower?.totalWaterFluxNorthKgM_1S),
    c24EqMid: round(c24EqMid?.totalWaterFluxNorthKgM_1S),
    c26EqMid: round(c26EqMid?.totalWaterFluxNorthKgM_1S),
    c24EqUpper: round(c24EqUpper?.totalWaterFluxNorthKgM_1S),
    c26EqUpper: round(c26EqUpper?.totalWaterFluxNorthKgM_1S),
    c24EqLowerZonal: round(c24EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c26EqLowerZonal: round(c26EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c24EqLowerEddy: round(c24EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c26EqLowerEddy: round(c26EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c24EqMidZonal: round(c24EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c26EqMidZonal: round(c26EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c24EqMidEddy: round(c24EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c26EqMidEddy: round(c26EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c24North35Lower: round(c24North35Lower?.totalWaterFluxNorthKgM_1S),
    c26North35Lower: round(c26North35Lower?.totalWaterFluxNorthKgM_1S),
    c24North35Mid: round(c24North35Mid?.totalWaterFluxNorthKgM_1S),
    c26North35Mid: round(c26North35Mid?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c24Carryover: round(c24Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c26Carryover: round(c26Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c24Persistence: round(c24Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c26Persistence: round(c26Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c24WeakErosion: round(c24Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c26WeakErosion: round(c26Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c24UpperCloudPath: round(c24Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c26UpperCloudPath: round(c26Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c24CloudRecirc: round(c24Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c26CloudRecirc: round(c26Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c24NorthReturn: round(c24Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c26NorthReturn: round(c26Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c24TransitionFlux: round(c24Moisture.latestMetrics?.northTransitionVaporFluxNorthKgM_1S),
    c26TransitionFlux: round(c26Moisture.latestMetrics?.northTransitionVaporFluxNorthKgM_1S),
    c24DryBeltFlux: round(c24Moisture.latestMetrics?.northDryBeltVaporFluxNorthKgM_1S),
    c26DryBeltFlux: round(c26Moisture.latestMetrics?.northDryBeltVaporFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c24PrimaryRegime: c24Thermo.classification?.primaryRegime || null,
    c26PrimaryRegime: c26Thermo.classification?.primaryRegime || null,
    c24DynamicsSupport: round(c24Thermo.classification?.dynamicsSupportScore, 5),
    c26DynamicsSupport: round(c26Thermo.classification?.dynamicsSupportScore, 5),
    c24MoistureSupport: round(c24Thermo.classification?.moistureSupportScore, 5),
    c26MoistureSupport: round(c26Thermo.classification?.moistureSupportScore, 5)
  };

  const decision = classifyC27Decision({
    c24CrossEq: quickComparison.c24CrossEq,
    c26CrossEq: quickComparison.c26CrossEq,
    c24EqLower: transportComparison.c24EqLower,
    c26EqLower: transportComparison.c26EqLower,
    c24EqUpper: transportComparison.c24EqUpper,
    c26EqUpper: transportComparison.c26EqUpper,
    c24NorthReturn: dryBeltComparison.c24NorthReturn,
    c26NorthReturn: dryBeltComparison.c26NorthReturn,
    c24CloudRecirc: dryBeltComparison.c24CloudRecirc,
    c26CloudRecirc: dryBeltComparison.c26CloudRecirc,
    c24North35Lower: transportComparison.c24North35Lower,
    c26North35Lower: transportComparison.c26North35Lower,
    c24North35Mid: transportComparison.c24North35Mid,
    c26North35Mid: transportComparison.c26North35Mid,
    c24OceanCond: quickComparison.c24OceanCond,
    c26OceanCond: quickComparison.c26OceanCond
  });

  const nextContract = {
    focusTargets: [
      'keep the C24 0–10° / 0.45 inner-core anchor',
      'retain only a weaker shoulder restoration than C26, closer to a 0–11° / 0.47 or similarly reduced restore',
      'preserve the C26 upper-branch and return-flow relief while trimming the lower-branch reload and cloud-recirculation rebound'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c27-partial-equatorial-shoulder-restore-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC27Markdown({
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
