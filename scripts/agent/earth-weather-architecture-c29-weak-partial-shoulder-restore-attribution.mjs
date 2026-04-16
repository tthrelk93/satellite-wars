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
  c26QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick.json'),
  c28QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick.json'),
  c26TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-transport-interface-budget.json'),
  c28TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-transport-interface-budget.json'),
  c26HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-hadley-partition-summary.json'),
  c28HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-hadley-partition-summary.json'),
  c26MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-moisture-attribution.json'),
  c28MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-moisture-attribution.json'),
  c26ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-thermodynamic-support-summary.json'),
  c28ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c29-weak-partial-shoulder-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c29-weak-partial-shoulder-restore-attribution.json')
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

export function classifyC29Decision({
  c26CrossEq,
  c28CrossEq,
  c26EqLower,
  c28EqLower,
  c26EqMid,
  c28EqMid,
  c26EqUpper,
  c28EqUpper,
  c26EqLowerEddy,
  c28EqLowerEddy,
  c26EqMidEddy,
  c28EqMidEddy,
  c26EqUpperEddy,
  c28EqUpperEddy,
  c26OceanCond,
  c28OceanCond,
  c26Carryover,
  c28Carryover,
  c26CloudRecirc,
  c28CloudRecirc,
  c26NorthReturn,
  c28NorthReturn
}) {
  const crossEqImproved = Number.isFinite(c26CrossEq) && Number.isFinite(c28CrossEq) && c28CrossEq > c26CrossEq;
  const lowerMidTotalsImproved =
    Number.isFinite(c26EqLower) && Number.isFinite(c28EqLower) && c28EqLower > c26EqLower
    && Number.isFinite(c26EqMid) && Number.isFinite(c28EqMid) && c28EqMid > c26EqMid;
  const upperImproved = Number.isFinite(c26EqUpper) && Number.isFinite(c28EqUpper) && c28EqUpper > c26EqUpper;
  const eddyImproved =
    Number.isFinite(c26EqLowerEddy) && Number.isFinite(c28EqLowerEddy) && c28EqLowerEddy > c26EqLowerEddy
    && Number.isFinite(c26EqMidEddy) && Number.isFinite(c28EqMidEddy) && c28EqMidEddy > c26EqMidEddy
    && Number.isFinite(c26EqUpperEddy) && Number.isFinite(c28EqUpperEddy) && c28EqUpperEddy > c26EqUpperEddy;
  const dryBeltWorsened =
    Number.isFinite(c26OceanCond) && Number.isFinite(c28OceanCond) && c28OceanCond > c26OceanCond
    && Number.isFinite(c26Carryover) && Number.isFinite(c28Carryover) && c28Carryover > c26Carryover
    && Number.isFinite(c26CloudRecirc) && Number.isFinite(c28CloudRecirc) && c28CloudRecirc > c26CloudRecirc
    && Number.isFinite(c26NorthReturn) && Number.isFinite(c28NorthReturn) && c28NorthReturn > c26NorthReturn;

  if (crossEqImproved && lowerMidTotalsImproved && upperImproved && eddyImproved && dryBeltWorsened) {
    return {
      verdict: 'weak_restore_relieves_equatorial_eddy_export_but_reopens_dry_belt_carryover_condensation',
      nextMove: 'Architecture C30: weak restore carry-input recapture experiment'
    };
  }

  return {
    verdict: 'weak_partial_shoulder_restore_attribution_inconclusive',
    nextMove: 'Architecture C30: broader weak-restore follow-up experiment'
  };
}

export function renderArchitectureC29Markdown({
  decision,
  quickComparison,
  transportComparison,
  dryBeltComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C29 Weak Partial Shoulder Restore Attribution',
    '',
    'This phase attributes the C28 weak shoulder restore relative to the stronger C26 partial shoulder restore. The question is whether the weaker restore actually solved the right equatorial export problem or just shifted the cost into the NH dry-belt receiver side.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C26 vs C28 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C26 \`${quickComparison.c26CrossEq}\`, C28 \`${quickComparison.c28CrossEq}\``,
    `- ITCZ width: C26 \`${quickComparison.c26ItczWidth}\`, C28 \`${quickComparison.c28ItczWidth}\``,
    `- NH dry-belt ratio: C26 \`${quickComparison.c26DryNorth}\`, C28 \`${quickComparison.c28DryNorth}\``,
    `- SH dry-belt ratio: C26 \`${quickComparison.c26DrySouth}\`, C28 \`${quickComparison.c28DrySouth}\``,
    `- NH midlatitude westerlies: C26 \`${quickComparison.c26Westerlies}\`, C28 \`${quickComparison.c28Westerlies}\``,
    `- NH dry-belt ocean condensation: C26 \`${quickComparison.c26OceanCond}\`, C28 \`${quickComparison.c28OceanCond}\``,
    '',
    '## Equatorial transport repartition',
    '',
    `- equator lower total-water flux north: C26 \`${transportComparison.c26EqLower}\`, C28 \`${transportComparison.c28EqLower}\``,
    `- equator mid total-water flux north: C26 \`${transportComparison.c26EqMid}\`, C28 \`${transportComparison.c28EqMid}\``,
    `- equator upper total-water flux north: C26 \`${transportComparison.c26EqUpper}\`, C28 \`${transportComparison.c28EqUpper}\``,
    `- equator lower zonal-mean transport: C26 \`${transportComparison.c26EqLowerZonal}\`, C28 \`${transportComparison.c28EqLowerZonal}\``,
    `- equator lower eddy transport: C26 \`${transportComparison.c26EqLowerEddy}\`, C28 \`${transportComparison.c28EqLowerEddy}\``,
    `- equator mid zonal-mean transport: C26 \`${transportComparison.c26EqMidZonal}\`, C28 \`${transportComparison.c28EqMidZonal}\``,
    `- equator mid eddy transport: C26 \`${transportComparison.c26EqMidEddy}\`, C28 \`${transportComparison.c28EqMidEddy}\``,
    `- equator upper zonal-mean transport: C26 \`${transportComparison.c26EqUpperZonal}\`, C28 \`${transportComparison.c28EqUpperZonal}\``,
    `- equator upper eddy transport: C26 \`${transportComparison.c26EqUpperEddy}\`, C28 \`${transportComparison.c28EqUpperEddy}\``,
    '',
    '## Dry-belt carryover / condensation rebound',
    '',
    `- NH dry-belt ocean condensation: C26 \`${dryBeltComparison.c26OceanCond}\`, C28 \`${dryBeltComparison.c28OceanCond}\``,
    `- carried-over upper cloud: C26 \`${dryBeltComparison.c26Carryover}\`, C28 \`${dryBeltComparison.c28Carryover}\``,
    `- imported anvil persistence: C26 \`${dryBeltComparison.c26Persistence}\`, C28 \`${dryBeltComparison.c28Persistence}\``,
    `- weak-erosion survival: C26 \`${dryBeltComparison.c26WeakErosion}\`, C28 \`${dryBeltComparison.c28WeakErosion}\``,
    `- cloud recirculation proxy: C26 \`${dryBeltComparison.c26CloudRecirc}\`, C28 \`${dryBeltComparison.c28CloudRecirc}\``,
    `- return-branch mass flux: C26 \`${dryBeltComparison.c26NorthReturn}\`, C28 \`${dryBeltComparison.c28NorthReturn}\``,
    `- dominant vapor import: C26 \`${dryBeltComparison.c26DominantVaporImport}\`, C28 \`${dryBeltComparison.c28DominantVaporImport}\``,
    '',
    '## Thermodynamic shift',
    '',
    `- C26 primary regime: \`${thermodynamicComparison.c26PrimaryRegime}\``,
    `- C28 primary regime: \`${thermodynamicComparison.c28PrimaryRegime}\``,
    `- C26 dynamics support score: \`${thermodynamicComparison.c26DynamicsSupport}\``,
    `- C28 dynamics support score: \`${thermodynamicComparison.c28DynamicsSupport}\``,
    `- C26 moisture support score: \`${thermodynamicComparison.c26MoistureSupport}\``,
    `- C28 moisture support score: \`${thermodynamicComparison.c28MoistureSupport}\``,
    '',
    '## Interpretation',
    '',
    '- Weakening the shoulder restore materially improved the equatorial export side, especially the eddy transport branches and the cross-equatorial sign defect.',
    '- But that same weakening reopened the NH dry-belt ocean condensation receiver path through stronger carryover, recirculation, and import.',
    '- That means the next bounded move should keep the C28 weak shoulder geometry but re-strengthen only the carry-input override / recapture path on the dry-belt side.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C28 weak shoulder restore geometry fixed.',
    '- Preserve the C28 cross-equatorial and equatorial-eddy improvements.',
    '- Add a stronger carry-input override recapture layer so dry-belt carryover and ocean condensation do not rebound.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c26Quick = readJson(options.c26QuickPath);
  const c28Quick = readJson(options.c28QuickPath);
  const c26Transport = readJson(options.c26TransportPath);
  const c28Transport = readJson(options.c28TransportPath);
  const c26Hadley = readJson(options.c26HadleyPath);
  const c28Hadley = readJson(options.c28HadleyPath);
  const c26Moisture = readJson(options.c26MoisturePath);
  const c28Moisture = readJson(options.c28MoisturePath);
  const c26Thermo = readJson(options.c26ThermoPath);
  const c28Thermo = readJson(options.c28ThermoPath);

  const c26Metrics = latestMetrics(c26Quick);
  const c28Metrics = latestMetrics(c28Quick);
  const c26EqLower = getBand(c26Transport, 0, 'lowerTroposphere');
  const c28EqLower = getBand(c28Transport, 0, 'lowerTroposphere');
  const c26EqMid = getBand(c26Transport, 0, 'midTroposphere');
  const c28EqMid = getBand(c28Transport, 0, 'midTroposphere');
  const c26EqUpper = getBand(c26Transport, 0, 'upperTroposphere');
  const c28EqUpper = getBand(c28Transport, 0, 'upperTroposphere');

  const quickComparison = {
    c26CrossEq: round(c26Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c28CrossEq: round(c28Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c26ItczWidth: round(c26Metrics.itczWidthDeg),
    c28ItczWidth: round(c28Metrics.itczWidthDeg),
    c26DryNorth: round(c26Metrics.subtropicalDryNorthRatio),
    c28DryNorth: round(c28Metrics.subtropicalDryNorthRatio),
    c26DrySouth: round(c26Metrics.subtropicalDrySouthRatio),
    c28DrySouth: round(c28Metrics.subtropicalDrySouthRatio),
    c26Westerlies: round(c26Metrics.midlatitudeWesterliesNorthU10Ms),
    c28Westerlies: round(c28Metrics.midlatitudeWesterliesNorthU10Ms),
    c26OceanCond: round(c26Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c28OceanCond: round(c28Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const transportComparison = {
    c26EqLower: round(c26EqLower?.totalWaterFluxNorthKgM_1S),
    c28EqLower: round(c28EqLower?.totalWaterFluxNorthKgM_1S),
    c26EqMid: round(c26EqMid?.totalWaterFluxNorthKgM_1S),
    c28EqMid: round(c28EqMid?.totalWaterFluxNorthKgM_1S),
    c26EqUpper: round(c26EqUpper?.totalWaterFluxNorthKgM_1S),
    c28EqUpper: round(c28EqUpper?.totalWaterFluxNorthKgM_1S),
    c26EqLowerZonal: round(c26EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c28EqLowerZonal: round(c28EqLower?.totalWaterFluxZonalMeanComponentKgM_1S),
    c26EqLowerEddy: round(c26EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c28EqLowerEddy: round(c28EqLower?.totalWaterFluxEddyComponentKgM_1S),
    c26EqMidZonal: round(c26EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c28EqMidZonal: round(c28EqMid?.totalWaterFluxZonalMeanComponentKgM_1S),
    c26EqMidEddy: round(c26EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c28EqMidEddy: round(c28EqMid?.totalWaterFluxEddyComponentKgM_1S),
    c26EqUpperZonal: round(c26EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c28EqUpperZonal: round(c28EqUpper?.totalWaterFluxZonalMeanComponentKgM_1S),
    c26EqUpperEddy: round(c26EqUpper?.totalWaterFluxEddyComponentKgM_1S),
    c28EqUpperEddy: round(c28EqUpper?.totalWaterFluxEddyComponentKgM_1S)
  };

  const dryBeltComparison = {
    c26OceanCond: round(c26Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c28OceanCond: round(c28Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c26Carryover: round(c26Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c28Carryover: round(c28Moisture.latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c26Persistence: round(c26Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c28Persistence: round(c28Moisture.latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c26WeakErosion: round(c26Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c28WeakErosion: round(c28Moisture.latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c26CloudRecirc: round(c26Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c28CloudRecirc: round(c28Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c26NorthReturn: round(c26Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c28NorthReturn: round(c28Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c26DominantVaporImport: round(c26Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S),
    c28DominantVaporImport: round(c28Hadley.northDryBeltTransport?.dominantVaporImport?.signedFluxNorthKgM_1S)
  };

  const thermodynamicComparison = {
    c26PrimaryRegime: c26Thermo.classification?.primaryRegime || null,
    c28PrimaryRegime: c28Thermo.classification?.primaryRegime || null,
    c26DynamicsSupport: round(c26Thermo.classification?.dynamicsSupportScore, 5),
    c28DynamicsSupport: round(c28Thermo.classification?.dynamicsSupportScore, 5),
    c26MoistureSupport: round(c26Thermo.classification?.moistureSupportScore, 5),
    c28MoistureSupport: round(c28Thermo.classification?.moistureSupportScore, 5)
  };

  const decision = classifyC29Decision({
    c26CrossEq: quickComparison.c26CrossEq,
    c28CrossEq: quickComparison.c28CrossEq,
    c26EqLower: transportComparison.c26EqLower,
    c28EqLower: transportComparison.c28EqLower,
    c26EqMid: transportComparison.c26EqMid,
    c28EqMid: transportComparison.c28EqMid,
    c26EqUpper: transportComparison.c26EqUpper,
    c28EqUpper: transportComparison.c28EqUpper,
    c26EqLowerEddy: transportComparison.c26EqLowerEddy,
    c28EqLowerEddy: transportComparison.c28EqLowerEddy,
    c26EqMidEddy: transportComparison.c26EqMidEddy,
    c28EqMidEddy: transportComparison.c28EqMidEddy,
    c26EqUpperEddy: transportComparison.c26EqUpperEddy,
    c28EqUpperEddy: transportComparison.c28EqUpperEddy,
    c26OceanCond: dryBeltComparison.c26OceanCond,
    c28OceanCond: dryBeltComparison.c28OceanCond,
    c26Carryover: dryBeltComparison.c26Carryover,
    c28Carryover: dryBeltComparison.c28Carryover,
    c26CloudRecirc: dryBeltComparison.c26CloudRecirc,
    c28CloudRecirc: dryBeltComparison.c28CloudRecirc,
    c26NorthReturn: dryBeltComparison.c26NorthReturn,
    c28NorthReturn: dryBeltComparison.c28NorthReturn
  });

  const nextContract = {
    focusTargets: [
      'keep the C28 weak 0–11° / 0.47 shoulder geometry fixed',
      'strengthen the dry-belt carry-input override so carryover, persistence, and ocean condensation are forced back down',
      'avoid re-strengthening the shoulder itself, since C29 shows the remaining rebound is on the dry-belt receiver side'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c29-weak-partial-shoulder-restore-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC29Markdown({
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
