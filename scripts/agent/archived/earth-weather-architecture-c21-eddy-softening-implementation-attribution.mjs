#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { summarizeInterface } from './earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');

const defaults = {
  c17Path: path.join(REPORT_DIR, 'earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.json'),
  c20Path: path.join(REPORT_DIR, 'earth-weather-architecture-c20-zonal-mean-preserving-eddy-nudge-softening-experiment.json'),
  c17TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-transport-interface-budget.json'),
  c20TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c20-eddy-softening-quick-transport-interface-budget.json'),
  c17HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-hadley-partition-summary.json'),
  c20HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c20-eddy-softening-quick-hadley-partition-summary.json'),
  c17MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-moisture-attribution.json'),
  c20MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c20-eddy-softening-quick-moisture-attribution.json'),
  c17ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-thermodynamic-support-summary.json'),
  c20ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c20-eddy-softening-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c21-eddy-softening-implementation-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c21-eddy-softening-implementation-attribution.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--c17' && argv[i + 1]) options.c17Path = path.resolve(argv[++i]);
  else if (arg === '--c20' && argv[i + 1]) options.c20Path = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const pickQuickMetric = (reportJson, key) => reportJson.quickRows?.find((row) => row.key === key)?.on ?? null;
const pickMetric = (json, key) => round((json.latestMetrics || json.metrics || json)?.[key]);

export function classifyC21Decision({
  c17CrossEq,
  c20CrossEq,
  c17EquatorEddy,
  c20EquatorEddy,
  c17EquatorZonal,
  c20EquatorZonal,
  c17North35Vapor,
  c20North35Vapor,
  c17Carryover,
  c20Carryover,
  c17Persistence,
  c20Persistence,
  c17WeakErosion,
  c20WeakErosion,
  c17CloudRecirc,
  c20CloudRecirc,
  c17NorthReturn,
  c20NorthReturn
}) {
  const totalWorsened = Number.isFinite(c17CrossEq) && Number.isFinite(c20CrossEq) && c20CrossEq < c17CrossEq;
  const eddyWorsened = Number.isFinite(c17EquatorEddy) && Number.isFinite(c20EquatorEddy) && c20EquatorEddy < c17EquatorEddy;
  const zonalWorsened = Number.isFinite(c17EquatorZonal) && Number.isFinite(c20EquatorZonal) && c20EquatorZonal < c17EquatorZonal;
  const north35Improved = Number.isFinite(c17North35Vapor) && Number.isFinite(c20North35Vapor) && c20North35Vapor > c17North35Vapor;
  const carryoverRebounded = Number.isFinite(c17Carryover) && Number.isFinite(c20Carryover) && c20Carryover > c17Carryover * 1.2;
  const persistenceRebounded = Number.isFinite(c17Persistence) && Number.isFinite(c20Persistence) && c20Persistence > c17Persistence * 1.2;
  const weakErosionRebounded = Number.isFinite(c17WeakErosion) && Number.isFinite(c20WeakErosion) && c20WeakErosion > c17WeakErosion * 1.2;
  const recircRebounded = Number.isFinite(c17CloudRecirc) && Number.isFinite(c20CloudRecirc) && c20CloudRecirc > c17CloudRecirc + 0.5;
  const northReturnRebounded = Number.isFinite(c17NorthReturn) && Number.isFinite(c20NorthReturn) && c20NorthReturn > c17NorthReturn;

  if (
    totalWorsened
    && eddyWorsened
    && zonalWorsened
    && north35Improved
    && carryoverRebounded
    && persistenceRebounded
    && weakErosionRebounded
    && recircRebounded
    && northReturnRebounded
  ) {
    return {
      verdict: 'global_eddy_softening_reactivates_return_branch_carryover_without_fixing_equatorial_export',
      nextMove: 'Architecture C22: equatorial-band eddy softening carveout experiment'
    };
  }

  return {
    verdict: 'eddy_softening_attribution_inconclusive',
    nextMove: 'Architecture C22: broadened eddy-softening follow-up experiment'
  };
}

export function renderArchitectureC21Markdown({
  decision,
  quickComparison,
  transportComparison,
  carryoverComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C21 Eddy-Softening Implementation Attribution',
    '',
    'This phase attributes the failed C20 global eddy-softening experiment relative to the stronger C17 carryover-carveout base. The question is whether eddy softening was inert, or whether it traded the wrong transport defect for a rebound in the dry-belt return/carryover family.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C17 vs C20 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C17 \`${quickComparison.c17CrossEq}\`, C20 \`${quickComparison.c20CrossEq}\``,
    `- ITCZ width: C17 \`${quickComparison.c17ItczWidth}\`, C20 \`${quickComparison.c20ItczWidth}\``,
    `- NH dry-belt ratio: C17 \`${quickComparison.c17DryNorth}\`, C20 \`${quickComparison.c20DryNorth}\``,
    `- SH dry-belt ratio: C17 \`${quickComparison.c17DrySouth}\`, C20 \`${quickComparison.c20DrySouth}\``,
    `- NH midlatitude westerlies: C17 \`${quickComparison.c17Westerlies}\`, C20 \`${quickComparison.c20Westerlies}\``,
    `- NH dry-belt ocean condensation: C17 \`${quickComparison.c17OceanCond}\`, C20 \`${quickComparison.c20OceanCond}\``,
    '',
    '## Transport comparison',
    '',
    `- equator zonal-mean vapor flux north: C17 \`${transportComparison.c17EquatorZonal}\`, C20 \`${transportComparison.c20EquatorZonal}\``,
    `- equator eddy vapor flux north: C17 \`${transportComparison.c17EquatorEddy}\`, C20 \`${transportComparison.c20EquatorEddy}\``,
    `- equator mid/upper vapor flux north: C17 \`${transportComparison.c17EquatorMidUpper}\`, C20 \`${transportComparison.c20EquatorMidUpper}\``,
    `- equator low-level velocity mean: C17 \`${transportComparison.c17EquatorVelocity}\`, C20 \`${transportComparison.c20EquatorVelocity}\``,
    `- 35° interface vapor flux north: C17 \`${transportComparison.c17North35Vapor}\`, C20 \`${transportComparison.c20North35Vapor}\``,
    '',
    '## Carryover / return-branch rebound',
    '',
    `- NH dry-belt carried-over upper cloud: C17 \`${carryoverComparison.c17Carryover}\`, C20 \`${carryoverComparison.c20Carryover}\``,
    `- NH dry-belt imported anvil persistence: C17 \`${carryoverComparison.c17Persistence}\`, C20 \`${carryoverComparison.c20Persistence}\``,
    `- NH dry-belt weak-erosion survival: C17 \`${carryoverComparison.c17WeakErosion}\`, C20 \`${carryoverComparison.c20WeakErosion}\``,
    `- NH dry-belt cloud recirculation proxy: C17 \`${carryoverComparison.c17CloudRecirc}\`, C20 \`${carryoverComparison.c20CloudRecirc}\``,
    `- NH dry-belt return-branch mass flux: C17 \`${carryoverComparison.c17NorthReturn}\`, C20 \`${carryoverComparison.c20NorthReturn}\``,
    '',
    '## Interpretation',
    '',
    '- C20 was not inert. It did change the transport system.',
    '- But the change went the wrong way: the equatorial zonal-mean and eddy branches both got more negative, even though the 35° interface burden improved.',
    '- At the same time, the NH dry-belt carryover / persistence / weak-erosion family rebounded and the return branch strengthened again.',
    '- That means global eddy softening relaxes the wrong parts of the hybrid. The next test should keep C17 as the base and soften eddy rescaling only where the remaining equatorial export defect actually lives.',
    '',
    '## Thermodynamic shift',
    '',
    `- C17 primary regime: \`${thermodynamicComparison.c17PrimaryRegime}\``,
    `- C20 primary regime: \`${thermodynamicComparison.c20PrimaryRegime}\``,
    `- C17 dynamics support score: \`${thermodynamicComparison.c17DynamicsSupport}\``,
    `- C20 dynamics support score: \`${thermodynamicComparison.c20DynamicsSupport}\``,
    `- C17 moisture support score: \`${thermodynamicComparison.c17MoistureSupport}\``,
    `- C20 moisture support score: \`${thermodynamicComparison.c20MoistureSupport}\``,
    '',
    '## Next experiment contract',
    '',
    '- Keep the C17 carryover carveout fixed.',
    '- Do not soften eddy rescaling globally.',
    '- Apply the softening only inside an equatorial band so the dry-belt return/carryover containment stays intact.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c17 = readJson(options.c17Path);
  const c20 = readJson(options.c20Path);
  const c17Transport = readJson(options.c17TransportPath);
  const c20Transport = readJson(options.c20TransportPath);
  const c17Hadley = readJson(options.c17HadleyPath);
  const c20Hadley = readJson(options.c20HadleyPath);
  const c17Moisture = readJson(options.c17MoisturePath);
  const c20Moisture = readJson(options.c20MoisturePath);
  const c17Thermo = readJson(options.c17ThermoPath);
  const c20Thermo = readJson(options.c20ThermoPath);

  const c17Equator = summarizeInterface(c17Transport, 0);
  const c20Equator = summarizeInterface(c20Transport, 0);
  const c17North35 = summarizeInterface(c17Transport, 35);
  const c20North35 = summarizeInterface(c20Transport, 35);

  const quickComparison = {
    c17CrossEq: round(pickQuickMetric(c17, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c20CrossEq: round(pickQuickMetric(c20, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c17ItczWidth: round(pickQuickMetric(c17, 'itczWidthDeg')),
    c20ItczWidth: round(pickQuickMetric(c20, 'itczWidthDeg')),
    c17DryNorth: round(pickQuickMetric(c17, 'subtropicalDryNorthRatio')),
    c20DryNorth: round(pickQuickMetric(c20, 'subtropicalDryNorthRatio')),
    c17DrySouth: round(pickQuickMetric(c17, 'subtropicalDrySouthRatio')),
    c20DrySouth: round(pickQuickMetric(c20, 'subtropicalDrySouthRatio')),
    c17Westerlies: round(pickQuickMetric(c17, 'midlatitudeWesterliesNorthU10Ms')),
    c20Westerlies: round(pickQuickMetric(c20, 'midlatitudeWesterliesNorthU10Ms')),
    c17OceanCond: round(pickQuickMetric(c17, 'northDryBeltOceanLargeScaleCondensationMeanKgM2')),
    c20OceanCond: round(pickQuickMetric(c20, 'northDryBeltOceanLargeScaleCondensationMeanKgM2'))
  };

  const transportComparison = {
    c17EquatorZonal: round(c17Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c20EquatorZonal: round(c20Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c17EquatorEddy: round(c17Equator?.vaporFluxEddyComponentKgM_1S),
    c20EquatorEddy: round(c20Equator?.vaporFluxEddyComponentKgM_1S),
    c17EquatorMidUpper: round(c17Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c20EquatorMidUpper: round(c20Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c17EquatorVelocity: round(c17Equator?.lowLevelVelocityMeanMs),
    c20EquatorVelocity: round(c20Equator?.lowLevelVelocityMeanMs),
    c17North35Vapor: round(c17North35?.vaporFluxNorthKgM_1S),
    c20North35Vapor: round(c20North35?.vaporFluxNorthKgM_1S)
  };

  const carryoverComparison = {
    c17Carryover: pickMetric(c17Moisture, 'northDryBeltCarriedOverUpperCloudMeanKgM2'),
    c20Carryover: pickMetric(c20Moisture, 'northDryBeltCarriedOverUpperCloudMeanKgM2'),
    c17Persistence: pickMetric(c17Moisture, 'northDryBeltImportedAnvilPersistenceMeanKgM2'),
    c20Persistence: pickMetric(c20Moisture, 'northDryBeltImportedAnvilPersistenceMeanKgM2'),
    c17WeakErosion: pickMetric(c17Moisture, 'northDryBeltWeakErosionCloudSurvivalMeanKgM2'),
    c20WeakErosion: pickMetric(c20Moisture, 'northDryBeltWeakErosionCloudSurvivalMeanKgM2'),
    c17CloudRecirc: round(c17Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c20CloudRecirc: round(c20Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c17NorthReturn: round(c17Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    c20NorthReturn: round(c20Hadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S)
  };

  const thermodynamicComparison = {
    c17PrimaryRegime: c17Thermo.classification?.primaryRegime || null,
    c20PrimaryRegime: c20Thermo.classification?.primaryRegime || null,
    c17DynamicsSupport: round(c17Thermo.classification?.dynamicsSupportScore),
    c20DynamicsSupport: round(c20Thermo.classification?.dynamicsSupportScore),
    c17MoistureSupport: round(c17Thermo.classification?.moistureSupportScore),
    c20MoistureSupport: round(c20Thermo.classification?.moistureSupportScore)
  };

  const decision = classifyC21Decision({
    ...quickComparison,
    ...transportComparison,
    ...carryoverComparison
  });

  const nextContract = {
    focusTargets: [
      'equatorial latitude-gated softening in windEddyNudge5.js',
      'keep subtropical rows on the original C17 eddy rescaling contract',
      'preserve C17 carryover carveout and low-level preserve layer'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c21-eddy-softening-implementation-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickComparison,
    transportComparison,
    carryoverComparison,
    thermodynamicComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC21Markdown({
    decision,
    quickComparison,
    transportComparison,
    carryoverComparison,
    thermodynamicComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, quickComparison, transportComparison, carryoverComparison })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
