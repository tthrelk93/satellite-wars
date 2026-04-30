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
  c15Path: path.join(REPORT_DIR, 'earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.json'),
  c17Path: path.join(REPORT_DIR, 'earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.json'),
  c15TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-transport-interface-budget.json'),
  c17TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-transport-interface-budget.json'),
  c15HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-hadley-partition-summary.json'),
  c17HadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-hadley-partition-summary.json'),
  c15MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-moisture-attribution.json'),
  c17MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-moisture-attribution.json'),
  c15ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c15-vertical-contract-quick-thermodynamic-support-summary.json'),
  c17ThermoPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-thermodynamic-support-summary.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c18-carryover-carveout-implementation-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c18-carryover-carveout-implementation-attribution.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--c15' && argv[i + 1]) options.c15Path = path.resolve(argv[++i]);
  else if (arg === '--c17' && argv[i + 1]) options.c17Path = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const pickQuickMetric = (reportJson, key) => reportJson.quickRows?.find((row) => row.key === key)?.on ?? null;
const pickMetric = (json, key) => round((json.latestMetrics || json.metrics || json)?.[key]);

export function classifyC18Decision({
  c15CrossEq,
  c17CrossEq,
  c15EquatorZonal,
  c17EquatorZonal,
  c15EquatorEddy,
  c17EquatorEddy,
  c15EquatorMidUpper,
  c17EquatorMidUpper,
  c15North35Vapor,
  c17North35Vapor,
  c15Carryover,
  c17Carryover,
  c15Persistence,
  c17Persistence,
  c15WeakErosion,
  c17WeakErosion,
  c15CloudRecirc,
  c17CloudRecirc
}) {
  const carryoverReduced = Number.isFinite(c15Carryover) && Number.isFinite(c17Carryover) && c17Carryover < c15Carryover * 0.75;
  const persistenceReduced = Number.isFinite(c15Persistence) && Number.isFinite(c17Persistence) && c17Persistence < c15Persistence * 0.75;
  const weakErosionReduced = Number.isFinite(c15WeakErosion) && Number.isFinite(c17WeakErosion) && c17WeakErosion < c15WeakErosion * 0.75;
  const cloudRecircReduced = Number.isFinite(c15CloudRecirc) && Number.isFinite(c17CloudRecirc) && c17CloudRecirc < c15CloudRecirc * 0.35;
  const totalImprovedButStillNegative = Number.isFinite(c15CrossEq) && Number.isFinite(c17CrossEq) && c17CrossEq > c15CrossEq && c17CrossEq < 0;
  const zonalImproved = Number.isFinite(c15EquatorZonal) && Number.isFinite(c17EquatorZonal) && c17EquatorZonal > c15EquatorZonal;
  const midUpperImproved = Number.isFinite(c15EquatorMidUpper) && Number.isFinite(c17EquatorMidUpper) && c17EquatorMidUpper > c15EquatorMidUpper;
  const eddyWorsened = Number.isFinite(c15EquatorEddy) && Number.isFinite(c17EquatorEddy) && c17EquatorEddy < c15EquatorEddy;
  const northImportWorsened = Number.isFinite(c15North35Vapor) && Number.isFinite(c17North35Vapor) && c17North35Vapor < c15North35Vapor;

  if (
    carryoverReduced
    && persistenceReduced
    && weakErosionReduced
    && cloudRecircReduced
    && totalImprovedButStillNegative
    && zonalImproved
    && midUpperImproved
    && eddyWorsened
    && northImportWorsened
  ) {
    return {
      verdict: 'carryover_carveout_relief_preserves_zonal_mean_but_eddy_export_remains_primary_blocker',
      nextMove: 'Architecture C19: zonal-mean-preserving eddy export attribution'
    };
  }

  return {
    verdict: 'carryover_carveout_attribution_inconclusive',
    nextMove: 'Architecture C19: broadened post-carveout transport attribution'
  };
}

export function renderArchitectureC18Markdown({
  decision,
  quickComparison,
  transportComparison,
  carryoverComparison,
  thermodynamicComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C18 Carryover Carveout Implementation Attribution',
    '',
    'This phase attributes what the C17 carryover carveout actually changed relative to the broader C15 vertical-state overlay. The goal is to determine whether the carveout truly relieved the upper-cloud carryover lane and, if so, what transport branch is now the dominant remaining blocker.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C15 vs C17 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C15 \`${quickComparison.c15CrossEq}\`, C17 \`${quickComparison.c17CrossEq}\``,
    `- ITCZ width: C15 \`${quickComparison.c15ItczWidth}\`, C17 \`${quickComparison.c17ItczWidth}\``,
    `- NH dry-belt ratio: C15 \`${quickComparison.c15DryNorth}\`, C17 \`${quickComparison.c17DryNorth}\``,
    `- SH dry-belt ratio: C15 \`${quickComparison.c15DrySouth}\`, C17 \`${quickComparison.c17DrySouth}\``,
    `- NH midlatitude westerlies: C15 \`${quickComparison.c15Westerlies}\`, C17 \`${quickComparison.c17Westerlies}\``,
    `- NH dry-belt ocean condensation: C15 \`${quickComparison.c15OceanCond}\`, C17 \`${quickComparison.c17OceanCond}\``,
    '',
    '## Transport comparison',
    '',
    `- equator zonal-mean vapor flux north: C15 \`${transportComparison.c15EquatorZonal}\`, C17 \`${transportComparison.c17EquatorZonal}\``,
    `- equator eddy vapor flux north: C15 \`${transportComparison.c15EquatorEddy}\`, C17 \`${transportComparison.c17EquatorEddy}\``,
    `- equator mid/upper-troposphere vapor flux north: C15 \`${transportComparison.c15EquatorMidUpper}\`, C17 \`${transportComparison.c17EquatorMidUpper}\``,
    `- equator low-level velocity mean: C15 \`${transportComparison.c15EquatorVelocity}\`, C17 \`${transportComparison.c17EquatorVelocity}\``,
    `- 35° interface vapor flux north: C15 \`${transportComparison.c15North35Vapor}\`, C17 \`${transportComparison.c17North35Vapor}\``,
    '',
    '## Carryover / maintenance comparison',
    '',
    `- NH dry-belt carried-over upper cloud: C15 \`${carryoverComparison.c15Carryover}\`, C17 \`${carryoverComparison.c17Carryover}\``,
    `- NH dry-belt imported anvil persistence: C15 \`${carryoverComparison.c15Persistence}\`, C17 \`${carryoverComparison.c17Persistence}\``,
    `- NH dry-belt weak-erosion survival: C15 \`${carryoverComparison.c15WeakErosion}\`, C17 \`${carryoverComparison.c17WeakErosion}\``,
    `- NH dry-belt cloud recirculation proxy: C15 \`${carryoverComparison.c15CloudRecirc}\`, C17 \`${carryoverComparison.c17CloudRecirc}\``,
    '',
    '## Interpretation',
    '',
    '- C17 did not leave the carryover carveout inert. It materially reduced carried-over upper cloud, imported persistence, weak-erosion survival, and the NH dry-belt cloud recirculation proxy.',
    '- C17 also improved the equatorial zonal-mean branch and the mid/upper transport component relative to C15, while further improving ITCZ width and both dry-belt ratios.',
    '- But the severe regression remains because the equatorial eddy branch got more negative and the 35° northward vapor interface worsened again.',
    '- That means the upper-cloud carryover lane was a real part of the C15 failure, but it is no longer the dominant blocker after the carveout lands.',
    '',
    '## Thermodynamic shift',
    '',
    `- C15 primary regime: \`${thermodynamicComparison.c15PrimaryRegime}\``,
    `- C17 primary regime: \`${thermodynamicComparison.c17PrimaryRegime}\``,
    `- C15 dynamics support score: \`${thermodynamicComparison.c15DynamicsSupport}\``,
    `- C17 dynamics support score: \`${thermodynamicComparison.c17DynamicsSupport}\``,
    `- C15 moisture support score: \`${thermodynamicComparison.c15MoistureSupport}\``,
    `- C17 moisture support score: \`${thermodynamicComparison.c17MoistureSupport}\``,
    '',
    '## Next experiment contract',
    '',
    '- Keep the C17 carry-input carveout fixed as the new comparison base.',
    '- Preserve the zonal-mean relief and the improved dry-belt/ITCZ metrics from C17.',
    '- Attribute the remaining equatorial eddy export / low-level velocity sign defect before changing the hybrid again.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c15 = readJson(options.c15Path);
  const c17 = readJson(options.c17Path);
  const c15Transport = readJson(options.c15TransportPath);
  const c17Transport = readJson(options.c17TransportPath);
  const c15Hadley = readJson(options.c15HadleyPath);
  const c17Hadley = readJson(options.c17HadleyPath);
  const c15Moisture = readJson(options.c15MoisturePath);
  const c17Moisture = readJson(options.c17MoisturePath);
  const c15Thermo = readJson(options.c15ThermoPath);
  const c17Thermo = readJson(options.c17ThermoPath);

  const c15Equator = summarizeInterface(c15Transport, 0);
  const c17Equator = summarizeInterface(c17Transport, 0);
  const c15North35 = summarizeInterface(c15Transport, 35);
  const c17North35 = summarizeInterface(c17Transport, 35);

  const quickComparison = {
    c15CrossEq: round(pickQuickMetric(c15, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c17CrossEq: round(pickQuickMetric(c17, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c15ItczWidth: round(pickQuickMetric(c15, 'itczWidthDeg')),
    c17ItczWidth: round(pickQuickMetric(c17, 'itczWidthDeg')),
    c15DryNorth: round(pickQuickMetric(c15, 'subtropicalDryNorthRatio')),
    c17DryNorth: round(pickQuickMetric(c17, 'subtropicalDryNorthRatio')),
    c15DrySouth: round(pickQuickMetric(c15, 'subtropicalDrySouthRatio')),
    c17DrySouth: round(pickQuickMetric(c17, 'subtropicalDrySouthRatio')),
    c15Westerlies: round(pickQuickMetric(c15, 'midlatitudeWesterliesNorthU10Ms')),
    c17Westerlies: round(pickQuickMetric(c17, 'midlatitudeWesterliesNorthU10Ms')),
    c15OceanCond: round(pickQuickMetric(c15, 'northDryBeltOceanLargeScaleCondensationMeanKgM2')),
    c17OceanCond: round(pickQuickMetric(c17, 'northDryBeltOceanLargeScaleCondensationMeanKgM2'))
  };

  const transportComparison = {
    c15EquatorZonal: round(c15Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c17EquatorZonal: round(c17Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c15EquatorEddy: round(c15Equator?.vaporFluxEddyComponentKgM_1S),
    c17EquatorEddy: round(c17Equator?.vaporFluxEddyComponentKgM_1S),
    c15EquatorMidUpper: round(c15Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c17EquatorMidUpper: round(c17Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c15EquatorVelocity: round(c15Equator?.lowLevelVelocityMeanMs),
    c17EquatorVelocity: round(c17Equator?.lowLevelVelocityMeanMs),
    c15North35Vapor: round(c15North35?.vaporFluxNorthKgM_1S),
    c17North35Vapor: round(c17North35?.vaporFluxNorthKgM_1S)
  };

  const carryoverComparison = {
    c15Carryover: pickMetric(c15Moisture, 'northDryBeltCarriedOverUpperCloudMeanKgM2'),
    c17Carryover: pickMetric(c17Moisture, 'northDryBeltCarriedOverUpperCloudMeanKgM2'),
    c15Persistence: pickMetric(c15Moisture, 'northDryBeltImportedAnvilPersistenceMeanKgM2'),
    c17Persistence: pickMetric(c17Moisture, 'northDryBeltImportedAnvilPersistenceMeanKgM2'),
    c15WeakErosion: pickMetric(c15Moisture, 'northDryBeltWeakErosionCloudSurvivalMeanKgM2'),
    c17WeakErosion: pickMetric(c17Moisture, 'northDryBeltWeakErosionCloudSurvivalMeanKgM2'),
    c15CloudRecirc: round(c15Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S),
    c17CloudRecirc: round(c17Hadley.northDryBeltTransport?.cloudRecirculationProxyKgM_1S)
  };

  const thermodynamicComparison = {
    c15PrimaryRegime: c15Thermo.classification?.primaryRegime || null,
    c17PrimaryRegime: c17Thermo.classification?.primaryRegime || null,
    c15DynamicsSupport: round(c15Thermo.classification?.dynamicsSupportScore),
    c17DynamicsSupport: round(c17Thermo.classification?.dynamicsSupportScore),
    c15MoistureSupport: round(c15Thermo.classification?.moistureSupportScore),
    c17MoistureSupport: round(c17Thermo.classification?.moistureSupportScore)
  };

  const decision = classifyC18Decision({
    ...quickComparison,
    ...transportComparison,
    ...carryoverComparison
  });

  const nextContract = {
    focusTargets: [
      'equatorial eddy vapor-flux branch in the transport-interface budget',
      'equatorial low-level velocity / preserved low-level momentum layer',
      '35° northward vapor interface burden after the carryover carveout',
      'windEddyNudge5.js and nudging5.js preserve-layer interaction with the donor scaffold'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c18-carryover-carveout-implementation-attribution.v1',
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
  fs.writeFileSync(options.reportPath, renderArchitectureC18Markdown({
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
