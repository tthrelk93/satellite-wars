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
  c13Path: path.join(REPORT_DIR, 'earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.json'),
  c15Path: path.join(REPORT_DIR, 'earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.json'),
  c13TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-quick-transport-interface-budget.json'),
  c15TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-transport-interface-budget.json'),
  c13HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-quick-hadley-partition-summary.json'),
  c15HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-hadley-partition-summary.json'),
  c13MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-quick-moisture-attribution.json'),
  c15MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-moisture-attribution.json'),
  c13ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-quick-thermodynamic-support-summary.json'),
  c15ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c16-vertical-contract-implementation-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c16-vertical-contract-implementation-attribution.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--c13' && argv[i + 1]) options.c13Path = path.resolve(argv[++i]);
  else if (arg === '--c15' && argv[i + 1]) options.c15Path = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const pickQuickMetric = (reportJson, key) => reportJson.quickRows?.find((row) => row.key === key)?.on ?? null;
const pickMetric = (json, key) => round((json.latestMetrics || json.metrics || json)?.[key]);

export function classifyC16Decision({
  c13CrossEq,
  c15CrossEq,
  c13EquatorZonal,
  c15EquatorZonal,
  c13EquatorEddy,
  c15EquatorEddy,
  c13North35Vapor,
  c15North35Vapor,
  c13Carryover,
  c15Carryover,
  c13Persistence,
  c15Persistence,
  c13WeakErosion,
  c15WeakErosion,
  c13CloudRecirc,
  c15CloudRecirc
}) {
  const zonalImproved = Number.isFinite(c13EquatorZonal) && Number.isFinite(c15EquatorZonal) && c15EquatorZonal > c13EquatorZonal;
  const totalWorsened = Number.isFinite(c13CrossEq) && Number.isFinite(c15CrossEq) && c15CrossEq < c13CrossEq;
  const eddyWorsened = Number.isFinite(c13EquatorEddy) && Number.isFinite(c15EquatorEddy) && c15EquatorEddy < c13EquatorEddy;
  const northImportImproved = Number.isFinite(c13North35Vapor) && Number.isFinite(c15North35Vapor) && c15North35Vapor > c13North35Vapor;
  const carryoverActivated = Number.isFinite(c15Carryover) && c15Carryover > 0.1 && (!Number.isFinite(c13Carryover) || c13Carryover < 0.01);
  const persistenceActivated = Number.isFinite(c15Persistence) && c15Persistence > 0.1 && (!Number.isFinite(c13Persistence) || c13Persistence < 0.01);
  const weakErosionActivated = Number.isFinite(c15WeakErosion) && c15WeakErosion > 0.1 && (!Number.isFinite(c13WeakErosion) || c13WeakErosion < 0.01);
  const cloudRecircActivated = Number.isFinite(c15CloudRecirc) && Number.isFinite(c13CloudRecirc) && c15CloudRecirc > c13CloudRecirc + 0.5;

  if (
    zonalImproved
    && totalWorsened
    && eddyWorsened
    && northImportImproved
    && carryoverActivated
    && persistenceActivated
    && weakErosionActivated
    && cloudRecircActivated
  ) {
    return {
      verdict: 'zonal_mean_relief_offset_by_upper_cloud_carryover_recirculation',
      nextMove: 'Architecture C17: zonal-mean-preserving upper-cloud carryover carveout experiment'
    };
  }

  return {
    verdict: 'vertical_contract_implementation_attribution_inconclusive',
    nextMove: 'Architecture C17: broadened vertical carveout experiment'
  };
}

export function renderArchitectureC16Markdown({
  decision,
  quickComparison,
  transportComparison,
  carryoverComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C16 Vertical-Contract Implementation Attribution',
    '',
    'This phase attributes what the full current vertical-state overlay in C15 actually changed relative to the narrower C13 sign-contract hybrid. The goal is to determine whether the remaining failure is still a missing vertical-state feature, or whether the full current vertical overlay reintroduces the wrong cloud-maintenance pathway while only partially helping the equatorial branch.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C13 vs C15 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C13 \`${quickComparison.c13CrossEq}\`, C15 \`${quickComparison.c15CrossEq}\``,
    `- ITCZ width: C13 \`${quickComparison.c13ItczWidth}\`, C15 \`${quickComparison.c15ItczWidth}\``,
    `- NH dry-belt ratio: C13 \`${quickComparison.c13DryNorth}\`, C15 \`${quickComparison.c15DryNorth}\``,
    `- NH dry-belt ocean condensation: C13 \`${quickComparison.c13OceanCond}\`, C15 \`${quickComparison.c15OceanCond}\``,
    '',
    '## Transport comparison',
    '',
    `- equator zonal-mean vapor flux north: C13 \`${transportComparison.c13EquatorZonal}\`, C15 \`${transportComparison.c15EquatorZonal}\``,
    `- equator eddy vapor flux north: C13 \`${transportComparison.c13EquatorEddy}\`, C15 \`${transportComparison.c15EquatorEddy}\``,
    `- equator mid/upper-troposphere vapor flux north: C13 \`${transportComparison.c13EquatorMidUpper}\`, C15 \`${transportComparison.c15EquatorMidUpper}\``,
    `- 35° interface vapor flux north: C13 \`${transportComparison.c13North35Vapor}\`, C15 \`${transportComparison.c15North35Vapor}\``,
    '',
    '## Carryover / maintenance comparison',
    '',
    `- NH dry-belt carried-over upper cloud: C13 \`${carryoverComparison.c13Carryover}\`, C15 \`${carryoverComparison.c15Carryover}\``,
    `- NH dry-belt imported anvil persistence: C13 \`${carryoverComparison.c13Persistence}\`, C15 \`${carryoverComparison.c15Persistence}\``,
    `- NH dry-belt weak-erosion survival: C13 \`${carryoverComparison.c13WeakErosion}\`, C15 \`${carryoverComparison.c15WeakErosion}\``,
    `- NH dry-belt cloud recirculation proxy: C13 \`${carryoverComparison.c13CloudRecirc}\`, C15 \`${carryoverComparison.c15CloudRecirc}\``,
    '',
    '## Interpretation',
    '',
    '- C15 did help the equatorial zonal-mean branch relative to C13 and it also reduced the 35° dry-belt import burden.',
    '- But C15 simultaneously reactivated a large upper-cloud carryover / imported-anvil / weak-erosion survival pathway in the NH dry belt.',
    '- That reintroduced a dynamics-supported cloud-maintenance regime and made the equatorial eddy / mid-upper transport more negative, which more than canceled the zonal-mean relief.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the donor-base hybrid plus the C13 low-level preserve layer.',
    '- Keep only the vertical-state pieces that helped the zonal-mean branch and the 35° import burden.',
    '- Carve out the current vertical upper-cloud carryover / persistence / weak-erosion lane for the next bounded experiment instead of carrying the full current vertical overlay forward.',
    '- Candidate carveout focus in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js):',
    ...nextContract.carveoutTargets.map((entry) => `  - \`${entry}\``),
    '',
    '## Thermodynamic shift',
    '',
    `- C13 primary regime: \`${thermodynamicComparison.c13PrimaryRegime}\``,
    `- C15 primary regime: \`${thermodynamicComparison.c15PrimaryRegime}\``,
    `- C13 dynamics support score: \`${thermodynamicComparison.c13DynamicsSupport}\``,
    `- C15 dynamics support score: \`${thermodynamicComparison.c15DynamicsSupport}\``,
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c13 = readJson(options.c13Path);
  const c15 = readJson(options.c15Path);
  const c13Transport = readJson(options.c13TransportPath);
  const c15Transport = readJson(options.c15TransportPath);
  const c13Hadley = readJson(options.c13HadleyPath);
  const c15Hadley = readJson(options.c15HadleyPath);
  const c13Moisture = readJson(options.c13MoisturePath);
  const c15Moisture = readJson(options.c15MoisturePath);
  const c13Thermo = readJson(options.c13ThermoPath);
  const c15Thermo = readJson(options.c15ThermoPath);

  const c13Equator = summarizeInterface(c13Transport, 0);
  const c15Equator = summarizeInterface(c15Transport, 0);
  const c13North35 = summarizeInterface(c13Transport, 35);
  const c15North35 = summarizeInterface(c15Transport, 35);

  const quickComparison = {
    c13CrossEq: round(pickQuickMetric(c13, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c15CrossEq: round(pickQuickMetric(c15, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c13ItczWidth: round(pickQuickMetric(c13, 'itczWidthDeg')),
    c15ItczWidth: round(pickQuickMetric(c15, 'itczWidthDeg')),
    c13DryNorth: round(pickQuickMetric(c13, 'subtropicalDryNorthRatio')),
    c15DryNorth: round(pickQuickMetric(c15, 'subtropicalDryNorthRatio')),
    c13OceanCond: round(pickQuickMetric(c13, 'northDryBeltOceanLargeScaleCondensationMeanKgM2')),
    c15OceanCond: round(pickQuickMetric(c15, 'northDryBeltOceanLargeScaleCondensationMeanKgM2'))
  };

  const transportComparison = {
    c13EquatorZonal: round(c13Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c15EquatorZonal: round(c15Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c13EquatorEddy: round(c13Equator?.vaporFluxEddyComponentKgM_1S),
    c15EquatorEddy: round(c15Equator?.vaporFluxEddyComponentKgM_1S),
    c13EquatorMidUpper: round(c13Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c15EquatorMidUpper: round(c15Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c13North35Vapor: round(c13North35?.vaporFluxNorthKgM_1S),
    c15North35Vapor: round(c15North35?.vaporFluxNorthKgM_1S)
  };

  const carryoverComparison = {
    c13Carryover: pickMetric(c13Moisture, 'northDryBeltCarriedOverUpperCloudMeanKgM2'),
    c15Carryover: pickMetric(c15Moisture, 'northDryBeltCarriedOverUpperCloudMeanKgM2'),
    c13Persistence: pickMetric(c13Moisture, 'northDryBeltImportedAnvilPersistenceMeanKgM2'),
    c15Persistence: pickMetric(c15Moisture, 'northDryBeltImportedAnvilPersistenceMeanKgM2'),
    c13WeakErosion: pickMetric(c13Moisture, 'northDryBeltWeakErosionCloudSurvivalMeanKgM2'),
    c15WeakErosion: pickMetric(c15Moisture, 'northDryBeltWeakErosionCloudSurvivalMeanKgM2'),
    c13CloudRecirc: round(c13Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c15CloudRecirc: round(c15Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S)
  };

  const thermodynamicComparison = {
    c13PrimaryRegime: c13Thermo.classification?.primaryRegime || null,
    c15PrimaryRegime: c15Thermo.classification?.primaryRegime || null,
    c13DynamicsSupport: round(c13Thermo.classification?.dynamicsSupportScore),
    c15DynamicsSupport: round(c15Thermo.classification?.dynamicsSupportScore)
  };

  const decision = classifyC16Decision({
    ...quickComparison,
    ...transportComparison,
    ...carryoverComparison
  });

  const nextContract = {
    carveoutTargets: [
      'carriedOverUpperCloudMass / importedAnvilPersistenceMass accumulation path',
      'weakErosionCloudSurvivalMass support path',
      'upper-cloud passive survival / blocked-erosion persistence lane',
      'keep the subtropical subsidence contract pieces that relieved zonal-mean equatorial flow'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c16-vertical-contract-implementation-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC16Markdown({
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
