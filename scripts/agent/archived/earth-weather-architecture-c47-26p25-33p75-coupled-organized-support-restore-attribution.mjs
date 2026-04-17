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
  c40QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick.json'),
  c46QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick.json'),
  c30MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-monthly-climatology.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c46MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-monthly-climatology.json'),
  c30MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-moisture-attribution.json'),
  c46MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-moisture-attribution.json'),
  c30TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-transport-interface-budget.json'),
  c40TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json'),
  c46TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c47-26p25-33p75-coupled-organized-support-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c47-26p25-33p75-coupled-organized-support-restore-attribution.json')
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
);
const extractMetrics = (auditJson) => auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {};
const firstProfileMonth = (monthlyJson) => monthlyJson.find((entry) => entry?.profiles?.latitudesDeg && entry?.profiles?.series) || null;
const atLat = (profiles, key, targetLatDeg) => {
  const index = profiles.latitudesDeg.indexOf(targetLatDeg);
  if (index === -1) return null;
  return round(profiles.series?.[key]?.[index]);
};

const getTransportSummary = (transportJson) => {
  const equator = transportJson.interfaces.find((entry) => entry.targetLatDeg === 0);
  const north35 = transportJson.interfaces.find((entry) => entry.targetLatDeg === 35);
  const byLevel = (iface, levelIndex) => {
    const level = iface?.modelLevels?.[levelIndex];
    if (!level) return null;
    return {
      total: round(level.totalWaterFluxNorthKgM_1S),
      zonalMean: round(level.totalWaterFluxZonalMeanComponentKgM_1S),
      eddy: round(level.totalWaterFluxEddyComponentKgM_1S)
    };
  };
  return {
    dominantImport: round(transportJson.dominantNhDryBeltVaporImport?.signedFluxNorthKgM_1S),
    eqLower: byLevel(equator, 0),
    eqMid: byLevel(equator, 1),
    eqUpper: byLevel(equator, 2),
    north35Lower: byLevel(north35, 0),
    north35Mid: byLevel(north35, 1),
    north35Upper: byLevel(north35, 2)
  };
};

const transportEquivalent = (left, right) => {
  const levelKeys = ['eqLower', 'eqMid', 'eqUpper', 'north35Lower', 'north35Mid', 'north35Upper'];
  return approxEqual(left.dominantImport, right.dominantImport)
    && levelKeys.every((key) => (
      approxEqual(left[key]?.total, right[key]?.total)
      && approxEqual(left[key]?.zonalMean, right[key]?.zonalMean)
      && approxEqual(left[key]?.eddy, right[key]?.eddy)
    ));
};

export function classifyC47Decision({
  quickEquivalentToC30,
  moistureEquivalentToC30,
  transportEquivalentToC30,
  c4033Hits,
  c4633Hits,
  c4033Carryover,
  c4633Carryover
}) {
  const polewardShoulderReloaded =
    Number.isFinite(c4033Hits) && Number.isFinite(c4633Hits) && c4633Hits > c4033Hits
    && Number.isFinite(c4033Carryover) && Number.isFinite(c4633Carryover) && c4633Carryover > c4033Carryover;

  if (quickEquivalentToC30 && moistureEquivalentToC30 && transportEquivalentToC30 && polewardShoulderReloaded) {
    return {
      verdict: 'coupled_shoulder_reopens_c30_recapture_regime_full_33p75_restore_too_strong',
      nextMove: 'Architecture C48: tapered poleward-shoulder organized-support restore experiment'
    };
  }

  return {
    verdict: 'coupled_shoulder_attribution_inconclusive',
    nextMove: 'Architecture C48: alternate tapered poleward-shoulder organized-support restore experiment'
  };
}

export function renderArchitectureC47Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  shoulderContrast,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C47 26p25-33p75 Coupled Organized-Support Restore Attribution',
    '',
    'This phase attributes the C46 coupled poleward-shoulder restore relative to both the earlier C30 weak-restore carry-input recapture regime and the smaller C40 transition-band restore signal. The question is whether C46 created a genuinely new intermediate state or simply reopened an older rejected regime.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C30 vs C46 quick / moisture identity',
    '',
    `- cross-equatorial vapor flux north: C30 \`${quickComparison.c30CrossEq}\`, C46 \`${quickComparison.c46CrossEq}\``,
    `- ITCZ width: C30 \`${quickComparison.c30ItczWidth}\`, C46 \`${quickComparison.c46ItczWidth}\``,
    `- NH dry-belt ratio: C30 \`${quickComparison.c30DryNorth}\`, C46 \`${quickComparison.c46DryNorth}\``,
    `- SH dry-belt ratio: C30 \`${quickComparison.c30DrySouth}\`, C46 \`${quickComparison.c46DrySouth}\``,
    `- NH midlatitude westerlies: C30 \`${quickComparison.c30Westerlies}\`, C46 \`${quickComparison.c46Westerlies}\``,
    `- NH dry-belt ocean condensation: C30 \`${quickComparison.c30OceanCond}\`, C46 \`${quickComparison.c46OceanCond}\``,
    `- NH imported anvil persistence: C30 \`${moistureComparison.c30Persistence}\`, C46 \`${moistureComparison.c46Persistence}\``,
    `- NH carried-over upper cloud: C30 \`${moistureComparison.c30Carryover}\`, C46 \`${moistureComparison.c46Carryover}\``,
    `- NH weak-erosion survival: C30 \`${moistureComparison.c30WeakErosion}\`, C46 \`${moistureComparison.c46WeakErosion}\``,
    '',
    '## C30 vs C46 transport identity',
    '',
    `- equator lower total-water flux north: C30 \`${transportComparison.c30EqLower}\`, C46 \`${transportComparison.c46EqLower}\``,
    `- equator mid total-water flux north: C30 \`${transportComparison.c30EqMid}\`, C46 \`${transportComparison.c46EqMid}\``,
    `- equator upper total-water flux north: C30 \`${transportComparison.c30EqUpper}\`, C46 \`${transportComparison.c46EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C30 \`${transportComparison.c30DominantImport}\`, C46 \`${transportComparison.c46DominantImport}\``,
    '',
    '## C40 vs C46 shoulder contrast',
    '',
    `- 18.75° accumulated override hits: C40 \`${shoulderContrast.c4018Hits}\`, C46 \`${shoulderContrast.c4618Hits}\``,
    `- 26.25° accumulated override hits: C40 \`${shoulderContrast.c4026Hits}\`, C46 \`${shoulderContrast.c4626Hits}\``,
    `- 33.75° accumulated override hits: C40 \`${shoulderContrast.c4033Hits}\`, C46 \`${shoulderContrast.c4633Hits}\``,
    `- 18.75° carried-over upper cloud: C40 \`${shoulderContrast.c4018Carryover}\`, C46 \`${shoulderContrast.c4618Carryover}\``,
    `- 26.25° carried-over upper cloud: C40 \`${shoulderContrast.c4026Carryover}\`, C46 \`${shoulderContrast.c4626Carryover}\``,
    `- 33.75° carried-over upper cloud: C40 \`${shoulderContrast.c4033Carryover}\`, C46 \`${shoulderContrast.c4633Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C46 does not create a new hybrid regime. It reopens the older C30 weak-restore carry-input recapture state to reporting precision across the quick score, moisture attribution, transport budget, and latitude-resolved override rows.',
    '- The live difference from C40 is concentrated in the poleward shoulder: `26.25°` stays essentially the same, but `33.75°` is restored far more strongly in C46.',
    '- That means the C46 failure is not about whether the poleward shoulder must be active. It is about amplitude: the full-strength `33.75°` restore is too strong and snaps the hybrid back into the broader C30 tradeoff.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 core carveout fixed.',
    '- Keep the `26.25°` lane fully restored so the live shoulder signal remains active.',
    '- Taper the `33.75°` poleward shoulder toward the smaller C40-level restore instead of reopening the full C30-strength shoulder.',
    '- Leave `18.75°` outside the active restore geometry so the experiment stays narrower than C40.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c30Quick = readJson(options.c30QuickPath);
  const c40Quick = readJson(options.c40QuickPath);
  const c46Quick = readJson(options.c46QuickPath);
  const c30Monthly = readJson(options.c30MonthlyPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c46Monthly = readJson(options.c46MonthlyPath);
  const c30Moisture = readJson(options.c30MoisturePath);
  const c46Moisture = readJson(options.c46MoisturePath);
  const c30Transport = readJson(options.c30TransportPath);
  const c40Transport = readJson(options.c40TransportPath);
  const c46Transport = readJson(options.c46TransportPath);

  const c30Metrics = extractMetrics(c30Quick);
  const c46Metrics = extractMetrics(c46Quick);
  const c40Profiles = firstProfileMonth(c40Monthly)?.profiles;
  const c46Profiles = firstProfileMonth(c46Monthly)?.profiles;

  const quickComparison = {
    c30CrossEq: round(c30Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c46CrossEq: round(c46Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c30ItczWidth: round(c30Metrics.itczWidthDeg),
    c46ItczWidth: round(c46Metrics.itczWidthDeg),
    c30DryNorth: round(c30Metrics.subtropicalDryNorthRatio),
    c46DryNorth: round(c46Metrics.subtropicalDryNorthRatio),
    c30DrySouth: round(c30Metrics.subtropicalDrySouthRatio),
    c46DrySouth: round(c46Metrics.subtropicalDrySouthRatio),
    c30Westerlies: round(c30Metrics.midlatitudeWesterliesNorthU10Ms),
    c46Westerlies: round(c46Metrics.midlatitudeWesterliesNorthU10Ms),
    c30OceanCond: round(c30Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c46OceanCond: round(c46Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c30Persistence: round(c30Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c46Persistence: round(c46Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c30Carryover: round(c30Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c46Carryover: round(c46Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c30WeakErosion: round(c30Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c46WeakErosion: round(c46Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2)
  };

  const c30TransportSummary = getTransportSummary(c30Transport);
  const c40TransportSummary = getTransportSummary(c40Transport);
  const c46TransportSummary = getTransportSummary(c46Transport);
  const transportComparison = {
    c30EqLower: c30TransportSummary.eqLower.total,
    c46EqLower: c46TransportSummary.eqLower.total,
    c30EqMid: c30TransportSummary.eqMid.total,
    c46EqMid: c46TransportSummary.eqMid.total,
    c30EqUpper: c30TransportSummary.eqUpper.total,
    c46EqUpper: c46TransportSummary.eqUpper.total,
    c30DominantImport: c30TransportSummary.dominantImport,
    c46DominantImport: c46TransportSummary.dominantImport
  };

  const shoulderContrast = {
    c4018Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c4618Hits: atLat(c46Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c4026Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4626Hits: atLat(c46Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4033Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4633Hits: atLat(c46Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4018Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c4618Carryover: atLat(c46Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c4026Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4626Carryover: atLat(c46Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4033Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c4633Carryover: atLat(c46Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c40DominantImport: c40TransportSummary.dominantImport,
    c46DominantImport: c46TransportSummary.dominantImport
  };

  const quickEquivalentToC30 =
    approxEqual(quickComparison.c30CrossEq, quickComparison.c46CrossEq)
    && approxEqual(quickComparison.c30ItczWidth, quickComparison.c46ItczWidth)
    && approxEqual(quickComparison.c30DryNorth, quickComparison.c46DryNorth)
    && approxEqual(quickComparison.c30DrySouth, quickComparison.c46DrySouth)
    && approxEqual(quickComparison.c30Westerlies, quickComparison.c46Westerlies)
    && approxEqual(quickComparison.c30OceanCond, quickComparison.c46OceanCond);

  const moistureEquivalentToC30 =
    approxEqual(moistureComparison.c30Persistence, moistureComparison.c46Persistence)
    && approxEqual(moistureComparison.c30Carryover, moistureComparison.c46Carryover)
    && approxEqual(moistureComparison.c30WeakErosion, moistureComparison.c46WeakErosion);

  const decision = classifyC47Decision({
    quickEquivalentToC30,
    moistureEquivalentToC30,
    transportEquivalentToC30: transportEquivalent(c30TransportSummary, c46TransportSummary),
    c4033Hits: shoulderContrast.c4033Hits,
    c4633Hits: shoulderContrast.c4633Hits,
    c4033Carryover: shoulderContrast.c4033Carryover,
    c4633Carryover: shoulderContrast.c4633Carryover
  });

  const nextContract = {
    focusTargets: [
      'keep the 26.25° lane fully restored while tapering the 33.75° poleward shoulder down toward the smaller C40-level restore',
      'leave 18.75° outside the active geometry so the experiment stays narrower than C40',
      'test whether partial 33.75° shoulder amplitude avoids snapping back to the broader C30 weak-restore recapture regime'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c47-26p25-33p75-coupled-organized-support-restore-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickEquivalentToC30,
    moistureEquivalentToC30,
    transportEquivalentToC30: transportEquivalent(c30TransportSummary, c46TransportSummary),
    quickComparison,
    moistureComparison,
    transportComparison,
    shoulderContrast,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC47Markdown({
    decision,
    quickComparison,
    moistureComparison,
    transportComparison,
    shoulderContrast,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
