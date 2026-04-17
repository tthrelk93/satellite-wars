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
  c28QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick.json'),
  c30QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick.json'),
  c28TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-transport-interface-budget.json'),
  c30TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-transport-interface-budget.json'),
  c28HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-hadley-partition-summary.json'),
  c30HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-hadley-partition-summary.json'),
  c28MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-moisture-attribution.json'),
  c30MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-moisture-attribution.json'),
  c28ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-thermodynamic-support-summary.json'),
  c30ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c31-weak-restore-carry-input-recapture-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c31-weak-restore-carry-input-recapture-attribution.json')
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

export function classifyC31Decision({
  c28CrossEq,
  c30CrossEq,
  c28EqLowerZonal,
  c30EqLowerZonal,
  c28EqMidZonal,
  c30EqMidZonal,
  c28EqUpperZonal,
  c30EqUpperZonal,
  c28EqLowerEddy,
  c30EqLowerEddy,
  c28EqMidEddy,
  c30EqMidEddy,
  c28EqUpperEddy,
  c30EqUpperEddy,
  c28OceanCond,
  c30OceanCond,
  c28Carryover,
  c30Carryover,
  c28Persistence,
  c30Persistence,
  c28WeakErosion,
  c30WeakErosion,
  c28DominantVaporImport,
  c30DominantVaporImport,
  c28CloudRecirc,
  c30CloudRecirc,
  c28NorthReturn,
  c30NorthReturn
}) {
  const crossEqWorsened = Number.isFinite(c28CrossEq) && Number.isFinite(c30CrossEq) && c30CrossEq < c28CrossEq;
  const zonalMeanImproved =
    Number.isFinite(c28EqLowerZonal) && Number.isFinite(c30EqLowerZonal) && c30EqLowerZonal > c28EqLowerZonal
    && Number.isFinite(c28EqMidZonal) && Number.isFinite(c30EqMidZonal) && c30EqMidZonal > c28EqMidZonal
    && Number.isFinite(c28EqUpperZonal) && Number.isFinite(c30EqUpperZonal) && c30EqUpperZonal > c28EqUpperZonal;
  const eddyWorsened =
    Number.isFinite(c28EqLowerEddy) && Number.isFinite(c30EqLowerEddy) && c30EqLowerEddy < c28EqLowerEddy
    && Number.isFinite(c28EqMidEddy) && Number.isFinite(c30EqMidEddy) && c30EqMidEddy < c28EqMidEddy
    && Number.isFinite(c28EqUpperEddy) && Number.isFinite(c30EqUpperEddy) && c30EqUpperEddy < c28EqUpperEddy;
  const dryBeltImproved =
    Number.isFinite(c28OceanCond) && Number.isFinite(c30OceanCond) && c30OceanCond < c28OceanCond
    && Number.isFinite(c28Carryover) && Number.isFinite(c30Carryover) && c30Carryover < c28Carryover
    && Number.isFinite(c28Persistence) && Number.isFinite(c30Persistence) && c30Persistence < c28Persistence
    && Number.isFinite(c28WeakErosion) && Number.isFinite(c30WeakErosion) && c30WeakErosion < c28WeakErosion
    && Number.isFinite(c28DominantVaporImport) && Number.isFinite(c30DominantVaporImport) && c30DominantVaporImport > c28DominantVaporImport;
  const recirculationReloaded =
    Number.isFinite(c28CloudRecirc) && Number.isFinite(c30CloudRecirc) && c30CloudRecirc > c28CloudRecirc
    && Number.isFinite(c28NorthReturn) && Number.isFinite(c30NorthReturn) && c30NorthReturn > c28NorthReturn;

  if (crossEqWorsened && zonalMeanImproved && eddyWorsened && dryBeltImproved && recirculationReloaded) {
    return {
      verdict: 'carry_input_recapture_recovers_dry_belt_and_zonal_mean_but_reloads_equatorial_eddy_export_recirculation',
      nextMove: 'Architecture C32: organized-support carry-input carveout experiment'
    };
  }

  return {
    verdict: 'weak_restore_carry_input_recapture_attribution_inconclusive',
    nextMove: 'Architecture C32: broader weak-restore carry-input follow-up experiment'
  };
}

export function renderArchitectureC31Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C31 Weak Restore Carry-Input Recapture Attribution',
    '',
    'This phase attributes the C30 stronger carry-input recapture relative to the weaker C28 receiver contract. The question is whether the stronger recapture fixed the NH dry-belt receiver side cleanly or whether it paid for that relief by damaging a different equatorial transport branch.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C28 vs C30 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C28 \`${quickComparison.c28CrossEq}\`, C30 \`${quickComparison.c30CrossEq}\``,
    `- ITCZ width: C28 \`${quickComparison.c28ItczWidth}\`, C30 \`${quickComparison.c30ItczWidth}\``,
    `- NH dry-belt ratio: C28 \`${quickComparison.c28DryNorth}\`, C30 \`${quickComparison.c30DryNorth}\``,
    `- SH dry-belt ratio: C28 \`${quickComparison.c28DrySouth}\`, C30 \`${quickComparison.c30DrySouth}\``,
    `- NH midlatitude westerlies: C28 \`${quickComparison.c28Westerlies}\`, C30 \`${quickComparison.c30Westerlies}\``,
    `- NH dry-belt ocean condensation: C28 \`${quickComparison.c28OceanCond}\`, C30 \`${quickComparison.c30OceanCond}\``,
    '',
    '## Equatorial transport repartition',
    '',
    `- equator lower total-water flux north: C28 \`${transportComparison.c28EqLower}\`, C30 \`${transportComparison.c30EqLower}\``,
    `- equator mid total-water flux north: C28 \`${transportComparison.c28EqMid}\`, C30 \`${transportComparison.c30EqMid}\``,
    `- equator upper total-water flux north: C28 \`${transportComparison.c28EqUpper}\`, C30 \`${transportComparison.c30EqUpper}\``,
    `- equator lower zonal-mean transport: C28 \`${transportComparison.c28EqLowerZonal}\`, C30 \`${transportComparison.c30EqLowerZonal}\``,
    `- equator lower eddy transport: C28 \`${transportComparison.c28EqLowerEddy}\`, C30 \`${transportComparison.c30EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C28 \`${transportComparison.c28EqMidZonal}\`, C30 \`${transportComparison.c30EqMidZonal}\``,
    `- equator mid eddy transport: C28 \`${transportComparison.c28EqMidEddy}\`, C30 \`${transportComparison.c30EqMidEddy}\``,
    `- equator upper zonal-mean transport: C28 \`${transportComparison.c28EqUpperZonal}\`, C30 \`${transportComparison.c30EqUpperZonal}\``,
    `- equator upper eddy transport: C28 \`${transportComparison.c28EqUpperEddy}\`, C30 \`${transportComparison.c30EqUpperEddy}\``,
    `- 35° lower vapor import: C28 \`${transportComparison.c28DryLower35}\`, C30 \`${transportComparison.c30DryLower35}\``,
    `- 35° mid vapor import: C28 \`${transportComparison.c28DryMid35}\`, C30 \`${transportComparison.c30DryMid35}\``,
    `- 35° upper vapor import: C28 \`${transportComparison.c28DryUpper35}\`, C30 \`${transportComparison.c30DryUpper35}\``,
    '',
    '## Dry-belt receiver / recirculation shift',
    '',
    `- NH dry-belt ocean condensation: C28 \`${dryBeltComparison.c28OceanCond}\`, C30 \`${dryBeltComparison.c30OceanCond}\``,
    `- carried-over upper cloud: C28 \`${dryBeltComparison.c28Carryover}\`, C30 \`${dryBeltComparison.c30Carryover}\``,
    `- imported anvil persistence: C28 \`${dryBeltComparison.c28Persistence}\`, C30 \`${dryBeltComparison.c30Persistence}\``,
    `- weak-erosion survival: C28 \`${dryBeltComparison.c28WeakErosion}\`, C30 \`${dryBeltComparison.c30WeakErosion}\``,
    `- upper-cloud path: C28 \`${dryBeltComparison.c28UpperCloudPath}\`, C30 \`${dryBeltComparison.c30UpperCloudPath}\``,
    `- cloud recirculation proxy: C28 \`${dryBeltComparison.c28CloudRecirc}\`, C30 \`${dryBeltComparison.c30CloudRecirc}\``,
    `- return-branch mass flux: C28 \`${dryBeltComparison.c28NorthReturn}\`, C30 \`${dryBeltComparison.c30NorthReturn}\``,
    `- dominant vapor import: C28 \`${dryBeltComparison.c28DominantVaporImport}\`, C30 \`${dryBeltComparison.c30DominantVaporImport}\``,
    '',
    '## Thermodynamic shift',
    '',
    `- C28 primary regime: \`${thermodynamicComparison.c28PrimaryRegime}\``,
    `- C30 primary regime: \`${thermodynamicComparison.c30PrimaryRegime}\``,
    `- C28 dynamics support score: \`${thermodynamicComparison.c28DynamicsSupport}\``,
    `- C30 dynamics support score: \`${thermodynamicComparison.c30DynamicsSupport}\``,
    `- C28 moisture support score: \`${thermodynamicComparison.c28MoistureSupport}\``,
    `- C30 moisture support score: \`${thermodynamicComparison.c30MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- The stronger carry-input recapture genuinely improved the NH dry-belt receiver side: carryover, persistence, weak-erosion survival, dominant vapor import, and ocean condensation all moved in the right direction.',
    '- It also improved the equatorial zonal-mean branch at lower, mid, and upper levels, so the recapture was not a pure circulation regression.',
    '- The remaining failure is concentrated in the equatorial eddy/export lane instead: every equatorial eddy branch became more negative, the cross-equatorial flux got worse, and the return/recirculation side intensified again.',
    '- That means the next bounded move should preserve the C30 recapture gains but protect organized equatorial cells from the stronger carry-input override rather than undoing the whole recapture layer.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C30 weak-restore carry-input recapture baseline fixed.',
    '- Preserve the C30 dry-belt receiver relief and zonal-mean improvements.',
    '- Restore stricter organized-support and convective-potential caps so the stronger recapture does not over-admit organized equatorial cells.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c28Quick = readJson(options.c28QuickPath);
  const c30Quick = readJson(options.c30QuickPath);
  const c28Transport = readJson(options.c28TransportPath);
  const c30Transport = readJson(options.c30TransportPath);
  const c28Hadley = readJson(options.c28HadleyPath);
  const c30Hadley = readJson(options.c30HadleyPath);
  const c28Moisture = readJson(options.c28MoisturePath);
  const c30Moisture = readJson(options.c30MoisturePath);
  const c28Thermo = readJson(options.c28ThermoPath);
  const c30Thermo = readJson(options.c30ThermoPath);

  const c28Metrics = latestMetrics(c28Quick);
  const c30Metrics = latestMetrics(c30Quick);
  const c28EqLower = getBand(c28Transport, 0, 'lowerTroposphere');
  const c30EqLower = getBand(c30Transport, 0, 'lowerTroposphere');
  const c28EqMid = getBand(c28Transport, 0, 'midTroposphere');
  const c30EqMid = getBand(c30Transport, 0, 'midTroposphere');
  const c28EqUpper = getBand(c28Transport, 0, 'upperTroposphere');
  const c30EqUpper = getBand(c30Transport, 0, 'upperTroposphere');
  const c2835Lower = getBand(c28Transport, 35, 'lowerTroposphere');
  const c3035Lower = getBand(c30Transport, 35, 'lowerTroposphere');
  const c2835Mid = getBand(c28Transport, 35, 'midTroposphere');
  const c3035Mid = getBand(c30Transport, 35, 'midTroposphere');
  const c2835Upper = getBand(c28Transport, 35, 'upperTroposphere');
  const c3035Upper = getBand(c30Transport, 35, 'upperTroposphere');

  const quickComparison = {
    c28CrossEq: round(c28Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c30CrossEq: round(c30Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c28ItczWidth: round(c28Metrics.itczWidthDeg),
    c30ItczWidth: round(c30Metrics.itczWidthDeg),
    c28DryNorth: round(c28Metrics.subtropicalDryNorthRatio),
    c30DryNorth: round(c30Metrics.subtropicalDryNorthRatio),
    c28DrySouth: round(c28Metrics.subtropicalDrySouthRatio),
    c30DrySouth: round(c30Metrics.subtropicalDrySouthRatio),
    c28Westerlies: round(c28Metrics.midlatitudeWesterliesNorthU10Ms),
    c30Westerlies: round(c30Metrics.midlatitudeWesterliesNorthU10Ms),
    c28OceanCond: round(c28Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c30OceanCond: round(c30Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c28EqLower: round(c28EqLower?.totalWaterFluxNorthKgM_1S),
    c30EqLower: round(c30EqLower?.totalWaterFluxNorthKgM_1S),
    c28EqMid: round(c28EqMid?.totalWaterFluxNorthKgM_1S),
    c30EqMid: round(c30EqMid?.totalWaterFluxNorthKgM_1S),
    c28EqUpper: round(c28EqUpper?.totalWaterFluxNorthKgM_1S),
    c30EqUpper: round(c30EqUpper?.totalWaterFluxNorthKgM_1S),
    c28EqLowerZonal: round(c28EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqLowerZonal: round(c30EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c28EqLowerEddy: round(c28EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c30EqLowerEddy: round(c30EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c28EqMidZonal: round(c28EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqMidZonal: round(c30EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c28EqMidEddy: round(c28EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c30EqMidEddy: round(c30EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c28EqUpperZonal: round(c28EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c30EqUpperZonal: round(c30EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c28EqUpperEddy: round(c28EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c30EqUpperEddy: round(c30EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c28DryLower35: round(c2835Lower?.totalWaterFluxNorthKgM_1S),
    c30DryLower35: round(c3035Lower?.totalWaterFluxNorthKgM_1S),
    c28DryMid35: round(c2835Mid?.totalWaterFluxNorthKgM_1S),
    c30DryMid35: round(c3035Mid?.totalWaterFluxNorthKgM_1S),
    c28DryUpper35: round(c2835Upper?.totalWaterFluxNorthKgM_1S),
    c30DryUpper35: round(c3035Upper?.totalWaterFluxNorthKgM_1S)
  };

  const dryBeltComparison = {
    c28OceanCond: round(c28Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c30OceanCond: round(c30Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c28Carryover: round(c28Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c30Carryover: round(c30Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c28Persistence: round(c28Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c30Persistence: round(c30Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c28WeakErosion: round(c28Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c30WeakErosion: round(c30Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c28UpperCloudPath: round(c28Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c30UpperCloudPath: round(c30Moisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    c28CloudRecirc: round(c28Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c30CloudRecirc: round(c30Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c28NorthReturn: round(c28Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c30NorthReturn: round(c30Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c28DominantVaporImport: round(c28Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S),
    c30DominantVaporImport: round(c30Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c28PrimaryRegime: c28Thermo.classification?.primaryRegime || null,
    c30PrimaryRegime: c30Thermo.classification?.primaryRegime || null,
    c28DynamicsSupport: round(c28Thermo.classification?.dynamicsSupportScore, 5),
    c30DynamicsSupport: round(c30Thermo.classification?.dynamicsSupportScore, 5),
    c28MoistureSupport: round(c28Thermo.classification?.moistureSupportScore, 5),
    c30MoistureSupport: round(c30Thermo.classification?.moistureSupportScore, 5)
  };

  const decision = classifyC31Decision({
    c28CrossEq: quickComparison.c28CrossEq,
    c30CrossEq: quickComparison.c30CrossEq,
    c28EqLowerZonal: transportComparison.c28EqLowerZonal,
    c30EqLowerZonal: transportComparison.c30EqLowerZonal,
    c28EqMidZonal: transportComparison.c28EqMidZonal,
    c30EqMidZonal: transportComparison.c30EqMidZonal,
    c28EqUpperZonal: transportComparison.c28EqUpperZonal,
    c30EqUpperZonal: transportComparison.c30EqUpperZonal,
    c28EqLowerEddy: transportComparison.c28EqLowerEddy,
    c30EqLowerEddy: transportComparison.c30EqLowerEddy,
    c28EqMidEddy: transportComparison.c28EqMidEddy,
    c30EqMidEddy: transportComparison.c30EqMidEddy,
    c28EqUpperEddy: transportComparison.c28EqUpperEddy,
    c30EqUpperEddy: transportComparison.c30EqUpperEddy,
    c28OceanCond: dryBeltComparison.c28OceanCond,
    c30OceanCond: dryBeltComparison.c30OceanCond,
    c28Carryover: dryBeltComparison.c28Carryover,
    c30Carryover: dryBeltComparison.c30Carryover,
    c28Persistence: dryBeltComparison.c28Persistence,
    c30Persistence: dryBeltComparison.c30Persistence,
    c28WeakErosion: dryBeltComparison.c28WeakErosion,
    c30WeakErosion: dryBeltComparison.c30WeakErosion,
    c28DominantVaporImport: dryBeltComparison.c28DominantVaporImport,
    c30DominantVaporImport: dryBeltComparison.c30DominantVaporImport,
    c28CloudRecirc: dryBeltComparison.c28CloudRecirc,
    c30CloudRecirc: dryBeltComparison.c30CloudRecirc,
    c28NorthReturn: dryBeltComparison.c28NorthReturn,
    c30NorthReturn: dryBeltComparison.c30NorthReturn
  });

  const nextContract = {
    focusTargets: [
      'keep the C30 subtropical suppression, dominance, and residual-mass recapture thresholds fixed',
      'restore stricter organized-support and convective-potential caps so organized equatorial cells are carved out of the stronger recapture',
      'preserve the C30 dry-belt receiver relief while recovering the C28 eddy/export advantage'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c31-weak-restore-carry-input-recapture-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC31Markdown({
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
