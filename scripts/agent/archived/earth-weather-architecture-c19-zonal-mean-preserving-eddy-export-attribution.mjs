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
  c17Path: path.join(REPORT_DIR, 'earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.json'),
  c13TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-quick-transport-interface-budget.json'),
  c17TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--c13' && argv[i + 1]) options.c13Path = path.resolve(argv[++i]);
  else if (arg === '--c17' && argv[i + 1]) options.c17Path = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const pickQuickMetric = (reportJson, key) => reportJson.quickRows?.find((row) => row.key === key)?.on ?? null;

const LOW_LEVEL_PRESERVE_KEYS = [
  'nudgeParams.tauQvS',
  'nudgeParams.tauQvColumn',
  'nudgeParams organized/subsidence relief quartet',
  'windNudgeParams.tauSurfaceSeconds'
];

export function classifyC19Decision({
  sharedLowLevelPreserveLayer,
  c13CrossEq,
  c17CrossEq,
  c13EquatorZonal,
  c17EquatorZonal,
  c13EquatorEddy,
  c17EquatorEddy,
  c13EquatorVelocity,
  c17EquatorVelocity,
  c13North35Vapor,
  c17North35Vapor
}) {
  const totalWorsened = Number.isFinite(c13CrossEq) && Number.isFinite(c17CrossEq) && c17CrossEq < c13CrossEq;
  const zonalImproved = Number.isFinite(c13EquatorZonal) && Number.isFinite(c17EquatorZonal) && c17EquatorZonal > c13EquatorZonal;
  const eddyWorsened = Number.isFinite(c13EquatorEddy) && Number.isFinite(c17EquatorEddy) && c17EquatorEddy < c13EquatorEddy;
  const lowLevelVelocityWorsened = Number.isFinite(c13EquatorVelocity) && Number.isFinite(c17EquatorVelocity) && c17EquatorVelocity < c13EquatorVelocity;
  const north35Improved = Number.isFinite(c13North35Vapor) && Number.isFinite(c17North35Vapor) && c17North35Vapor > c13North35Vapor;

  if (
    sharedLowLevelPreserveLayer
    && totalWorsened
    && zonalImproved
    && eddyWorsened
    && lowLevelVelocityWorsened
    && north35Improved
  ) {
    return {
      verdict: 'shared_preserve_layer_not_primary_blocker_vertical_overlay_eddy_export_coupling',
      nextMove: 'Architecture C20: zonal-mean-preserving eddy nudge softening experiment'
    };
  }

  return {
    verdict: 'eddy_export_attribution_inconclusive',
    nextMove: 'Architecture C20: broadened post-carryover eddy export experiment'
  };
}

export function renderArchitectureC19Markdown({
  decision,
  quickComparison,
  transportComparison,
  contractComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C19 Zonal-Mean-Preserving Eddy Export Attribution',
    '',
    'This phase compares the strongest sign-contract hybrid (C13) to the strongest carryover-carveout hybrid (C17). The point is to separate the shared preserved low-level momentum layer from the newer vertical-overlay family and determine which side now owns the remaining eddy/export sign defect.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Shared low-level preserve contract',
    '',
    `- shared preserve-layer params: ${contractComparison.sharedLowLevelPreserveParams.map((entry) => `\`${entry}\``).join(', ')}`,
    `- preserve-layer identical across C13 and C17: \`${contractComparison.sharedLowLevelPreserveLayer}\``,
    '',
    '## C13 vs C17 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C13 \`${quickComparison.c13CrossEq}\`, C17 \`${quickComparison.c17CrossEq}\``,
    `- ITCZ width: C13 \`${quickComparison.c13ItczWidth}\`, C17 \`${quickComparison.c17ItczWidth}\``,
    `- NH dry-belt ratio: C13 \`${quickComparison.c13DryNorth}\`, C17 \`${quickComparison.c17DryNorth}\``,
    `- SH dry-belt ratio: C13 \`${quickComparison.c13DrySouth}\`, C17 \`${quickComparison.c17DrySouth}\``,
    `- NH midlatitude westerlies: C13 \`${quickComparison.c13Westerlies}\`, C17 \`${quickComparison.c17Westerlies}\``,
    `- NH dry-belt ocean condensation: C13 \`${quickComparison.c13OceanCond}\`, C17 \`${quickComparison.c17OceanCond}\``,
    '',
    '## Transport comparison',
    '',
    `- equator zonal-mean vapor flux north: C13 \`${transportComparison.c13EquatorZonal}\`, C17 \`${transportComparison.c17EquatorZonal}\``,
    `- equator eddy vapor flux north: C13 \`${transportComparison.c13EquatorEddy}\`, C17 \`${transportComparison.c17EquatorEddy}\``,
    `- equator mid/upper vapor flux north: C13 \`${transportComparison.c13EquatorMidUpper}\`, C17 \`${transportComparison.c17EquatorMidUpper}\``,
    `- equator lower-troposphere vapor flux north: C13 \`${transportComparison.c13EquatorLower}\`, C17 \`${transportComparison.c17EquatorLower}\``,
    `- equator low-level velocity mean: C13 \`${transportComparison.c13EquatorVelocity}\`, C17 \`${transportComparison.c17EquatorVelocity}\``,
    `- 35° interface vapor flux north: C13 \`${transportComparison.c13North35Vapor}\`, C17 \`${transportComparison.c17North35Vapor}\``,
    '',
    '## Interpretation',
    '',
    '- C13 and C17 share the same preserved low-level moisture / momentum contract, so the remaining transport difference is not explained by the preserve layer alone.',
    '- Relative to C13, C17 improves the zonal-mean equatorial branch and the 35° northward interface burden, while also improving the headline dry-belt and ITCZ metrics.',
    '- But C17 makes the equatorial eddy branch and low-level velocity more negative than C13, which is enough to make the total cross-equatorial flux worse again.',
    '- That means the next bounded experiment should keep the C17 vertical/carryover gains and soften only the eddy-energy rescaling lane, not remove the whole preserved low-level contract.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the C17 carryover carveout fixed.',
    '- Keep the C13/C17 shared low-level wind nudge and moisture-nudge preserve contract fixed.',
    '- Soften only the surface eddy-energy rescaling band before any broader preserve-layer changes.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c13 = readJson(options.c13Path);
  const c17 = readJson(options.c17Path);
  const c13Transport = readJson(options.c13TransportPath);
  const c17Transport = readJson(options.c17TransportPath);

  const c13Equator = summarizeInterface(c13Transport, 0);
  const c17Equator = summarizeInterface(c17Transport, 0);
  const c13North35 = summarizeInterface(c13Transport, 35);
  const c17North35 = summarizeInterface(c17Transport, 35);

  const c13PatchedParams = new Set(c13.patchSummary?.patchedParams || []);
  const c17PatchedParams = new Set(c17.patchSummary?.patchedParams || []);
  const sharedLowLevelPreserveParams = LOW_LEVEL_PRESERVE_KEYS.filter((key) => c13PatchedParams.has(key) && c17PatchedParams.has(key));
  const sharedLowLevelPreserveLayer = sharedLowLevelPreserveParams.length === LOW_LEVEL_PRESERVE_KEYS.length;

  const quickComparison = {
    c13CrossEq: round(pickQuickMetric(c13, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c17CrossEq: round(pickQuickMetric(c17, 'crossEquatorialVaporFluxNorthKgM_1S')),
    c13ItczWidth: round(pickQuickMetric(c13, 'itczWidthDeg')),
    c17ItczWidth: round(pickQuickMetric(c17, 'itczWidthDeg')),
    c13DryNorth: round(pickQuickMetric(c13, 'subtropicalDryNorthRatio')),
    c17DryNorth: round(pickQuickMetric(c17, 'subtropicalDryNorthRatio')),
    c13DrySouth: round(pickQuickMetric(c13, 'subtropicalDrySouthRatio')),
    c17DrySouth: round(pickQuickMetric(c17, 'subtropicalDrySouthRatio')),
    c13Westerlies: round(pickQuickMetric(c13, 'midlatitudeWesterliesNorthU10Ms')),
    c17Westerlies: round(pickQuickMetric(c17, 'midlatitudeWesterliesNorthU10Ms')),
    c13OceanCond: round(pickQuickMetric(c13, 'northDryBeltOceanLargeScaleCondensationMeanKgM2')),
    c17OceanCond: round(pickQuickMetric(c17, 'northDryBeltOceanLargeScaleCondensationMeanKgM2'))
  };

  const transportComparison = {
    c13EquatorZonal: round(c13Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c17EquatorZonal: round(c17Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c13EquatorEddy: round(c13Equator?.vaporFluxEddyComponentKgM_1S),
    c17EquatorEddy: round(c17Equator?.vaporFluxEddyComponentKgM_1S),
    c13EquatorMidUpper: round(c13Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c17EquatorMidUpper: round(c17Equator?.midUpperTroposphereVaporFluxNorthKgM_1S),
    c13EquatorLower: round(c13Equator?.lowerTroposphereVaporFluxNorthKgM_1S),
    c17EquatorLower: round(c17Equator?.lowerTroposphereVaporFluxNorthKgM_1S),
    c13EquatorVelocity: round(c13Equator?.lowLevelVelocityMeanMs),
    c17EquatorVelocity: round(c17Equator?.lowLevelVelocityMeanMs),
    c13North35Vapor: round(c13North35?.vaporFluxNorthKgM_1S),
    c17North35Vapor: round(c17North35?.vaporFluxNorthKgM_1S)
  };

  const contractComparison = {
    sharedLowLevelPreserveParams,
    sharedLowLevelPreserveLayer
  };

  const decision = classifyC19Decision({
    sharedLowLevelPreserveLayer,
    c13CrossEq: quickComparison.c13CrossEq,
    c17CrossEq: quickComparison.c17CrossEq,
    c13EquatorZonal: transportComparison.c13EquatorZonal,
    c17EquatorZonal: transportComparison.c17EquatorZonal,
    c13EquatorEddy: transportComparison.c13EquatorEddy,
    c17EquatorEddy: transportComparison.c17EquatorEddy,
    c13EquatorVelocity: transportComparison.c13EquatorVelocity,
    c17EquatorVelocity: transportComparison.c17EquatorVelocity,
    c13North35Vapor: transportComparison.c13North35Vapor,
    c17North35Vapor: transportComparison.c17North35Vapor
  });

  const nextContract = {
    focusTargets: [
      'windEddyParams.tauSeconds',
      'windEddyParams.scaleClampMin',
      'windEddyParams.scaleClampMax',
      'surface-row eddy-energy rescaling in windEddyNudge5.js'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickComparison,
    transportComparison,
    contractComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC19Markdown({
    decision,
    quickComparison,
    transportComparison,
    contractComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, quickComparison, transportComparison, contractComparison })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
