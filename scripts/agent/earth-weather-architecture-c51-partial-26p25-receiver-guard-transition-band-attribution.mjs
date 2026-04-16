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
  c40QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick.json'),
  c50QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c50MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-monthly-climatology.json'),
  c40MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-moisture-attribution.json'),
  c50MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-moisture-attribution.json'),
  c40TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json'),
  c50TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c51-partial-26p25-receiver-guard-transition-band-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c51-partial-26p25-receiver-guard-transition-band-attribution.json')
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
  const keys = ['eqLower', 'eqMid', 'eqUpper', 'north35Lower', 'north35Mid', 'north35Upper'];
  return approxEqual(left.dominantImport, right.dominantImport)
    && keys.every((key) => (
      approxEqual(left[key]?.total, right[key]?.total)
      && approxEqual(left[key]?.zonalMean, right[key]?.zonalMean)
      && approxEqual(left[key]?.eddy, right[key]?.eddy)
    ));
};

export function classifyC51Decision({
  quickEquivalentToC40,
  moistureEquivalentToC40,
  transportEquivalentToC40,
  rowsEquivalent
}) {
  if (quickEquivalentToC40 && moistureEquivalentToC40 && transportEquivalentToC40 && rowsEquivalent) {
    return {
      verdict: 'partial_26p25_receiver_guard_inert_threshold_below_live_binder',
      nextMove: 'Architecture C52: strong 26p25 receiver-guard transition-band experiment'
    };
  }

  return {
    verdict: 'partial_26p25_receiver_guard_attribution_inconclusive',
    nextMove: 'Architecture C52: alternate stronger 26p25 receiver-guard transition-band experiment'
  };
}

export function renderArchitectureC51Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C51 Partial 26p25 Receiver-Guard Transition-Band Attribution',
    '',
    'This phase attributes the C50 partial `26.25°` receiver-guard transition-band experiment relative to the earlier C40 transition-band regime. The question is whether the first simple receiver guard actually moved the live regime at all or whether it sat below the binding threshold.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C40 vs C50 quick identity',
    '',
    `- cross-equatorial vapor flux north: C40 \`${quickComparison.c40CrossEq}\`, C50 \`${quickComparison.c50CrossEq}\``,
    `- ITCZ width: C40 \`${quickComparison.c40ItczWidth}\`, C50 \`${quickComparison.c50ItczWidth}\``,
    `- NH dry-belt ratio: C40 \`${quickComparison.c40DryNorth}\`, C50 \`${quickComparison.c50DryNorth}\``,
    `- SH dry-belt ratio: C40 \`${quickComparison.c40DrySouth}\`, C50 \`${quickComparison.c50DrySouth}\``,
    `- NH midlatitude westerlies: C40 \`${quickComparison.c40Westerlies}\`, C50 \`${quickComparison.c50Westerlies}\``,
    `- NH dry-belt ocean condensation: C40 \`${quickComparison.c40OceanCond}\`, C50 \`${quickComparison.c50OceanCond}\``,
    '',
    '## C40 vs C50 moisture / transport identity',
    '',
    `- NH imported anvil persistence: C40 \`${moistureComparison.c40Persistence}\`, C50 \`${moistureComparison.c50Persistence}\``,
    `- NH carried-over upper cloud: C40 \`${moistureComparison.c40Carryover}\`, C50 \`${moistureComparison.c50Carryover}\``,
    `- NH weak-erosion survival: C40 \`${moistureComparison.c40WeakErosion}\`, C50 \`${moistureComparison.c50WeakErosion}\``,
    `- equator lower total-water flux north: C40 \`${transportComparison.c40EqLower}\`, C50 \`${transportComparison.c50EqLower}\``,
    `- equator mid total-water flux north: C40 \`${transportComparison.c40EqMid}\`, C50 \`${transportComparison.c50EqMid}\``,
    `- equator upper total-water flux north: C40 \`${transportComparison.c40EqUpper}\`, C50 \`${transportComparison.c50EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C40 \`${transportComparison.c40DominantImport}\`, C50 \`${transportComparison.c50DominantImport}\``,
    '',
    '## C40 vs C50 shoulder-row identity',
    '',
    `- 18.75° override hits: C40 \`${rowComparison.c4018Hits}\`, C50 \`${rowComparison.c5018Hits}\``,
    `- 26.25° override hits: C40 \`${rowComparison.c4026Hits}\`, C50 \`${rowComparison.c5026Hits}\``,
    `- 33.75° override hits: C40 \`${rowComparison.c4033Hits}\`, C50 \`${rowComparison.c5033Hits}\``,
    `- 18.75° carried-over upper cloud: C40 \`${rowComparison.c4018Carryover}\`, C50 \`${rowComparison.c5018Carryover}\``,
    `- 26.25° carried-over upper cloud: C40 \`${rowComparison.c4026Carryover}\`, C50 \`${rowComparison.c5026Carryover}\``,
    `- 33.75° carried-over upper cloud: C40 \`${rowComparison.c4033Carryover}\`, C50 \`${rowComparison.c5033Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C50 does not create a new transition-band state. It reproduces the earlier C40 regime exactly across the quick score, moisture attribution, transport budget, and latitude-resolved shoulder rows.',
    '- That means the first simple `26.25°` receiver guard is below the live binder. It never reaches the cells that are carrying the modest receiver reload in the C40 regime.',
    '- The next honest bounded move is to keep the C40 geometry fixed and test a stronger `26.25°` receiver guard that pulls the center row all the way back toward the strict C32 cap while leaving the outer transition band live.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 core carveout fixed.',
    '- Keep the C40 transition-band geometry active.',
    '- Strengthen the `26.25°` receiver guard enough to pull the center row back toward the strict C32 cap while leaving `18.75°` and `33.75°` live.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c40Quick = readJson(options.c40QuickPath);
  const c50Quick = readJson(options.c50QuickPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c50Monthly = readJson(options.c50MonthlyPath);
  const c40Moisture = readJson(options.c40MoisturePath);
  const c50Moisture = readJson(options.c50MoisturePath);
  const c40Transport = readJson(options.c40TransportPath);
  const c50Transport = readJson(options.c50TransportPath);

  const c40Metrics = extractMetrics(c40Quick);
  const c50Metrics = extractMetrics(c50Quick);
  const c40Profiles = firstProfileMonth(c40Monthly)?.profiles;
  const c50Profiles = firstProfileMonth(c50Monthly)?.profiles;
  const c40TransportSummary = getTransportSummary(c40Transport);
  const c50TransportSummary = getTransportSummary(c50Transport);

  const quickComparison = {
    c40CrossEq: round(c40Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c50CrossEq: round(c50Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c40ItczWidth: round(c40Metrics.itczWidthDeg),
    c50ItczWidth: round(c50Metrics.itczWidthDeg),
    c40DryNorth: round(c40Metrics.subtropicalDryNorthRatio),
    c50DryNorth: round(c50Metrics.subtropicalDryNorthRatio),
    c40DrySouth: round(c40Metrics.subtropicalDrySouthRatio),
    c50DrySouth: round(c50Metrics.subtropicalDrySouthRatio),
    c40Westerlies: round(c40Metrics.midlatitudeWesterliesNorthU10Ms),
    c50Westerlies: round(c50Metrics.midlatitudeWesterliesNorthU10Ms),
    c40OceanCond: round(c40Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c50OceanCond: round(c50Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c40Persistence: round(c40Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c50Persistence: round(c50Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c40Carryover: round(c40Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c50Carryover: round(c50Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c40WeakErosion: round(c40Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c50WeakErosion: round(c50Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2)
  };

  const transportComparison = {
    c40EqLower: c40TransportSummary.eqLower.total,
    c50EqLower: c50TransportSummary.eqLower.total,
    c40EqMid: c40TransportSummary.eqMid.total,
    c50EqMid: c50TransportSummary.eqMid.total,
    c40EqUpper: c40TransportSummary.eqUpper.total,
    c50EqUpper: c50TransportSummary.eqUpper.total,
    c40DominantImport: c40TransportSummary.dominantImport,
    c50DominantImport: c50TransportSummary.dominantImport
  };

  const rowComparison = {
    c4018Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c5018Hits: atLat(c50Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c4026Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c5026Hits: atLat(c50Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4033Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c5033Hits: atLat(c50Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4018Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c5018Carryover: atLat(c50Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c4026Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5026Carryover: atLat(c50Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4033Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c5033Carryover: atLat(c50Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const quickEquivalentToC40 =
    approxEqual(quickComparison.c40CrossEq, quickComparison.c50CrossEq)
    && approxEqual(quickComparison.c40ItczWidth, quickComparison.c50ItczWidth)
    && approxEqual(quickComparison.c40DryNorth, quickComparison.c50DryNorth)
    && approxEqual(quickComparison.c40DrySouth, quickComparison.c50DrySouth)
    && approxEqual(quickComparison.c40Westerlies, quickComparison.c50Westerlies)
    && approxEqual(quickComparison.c40OceanCond, quickComparison.c50OceanCond);

  const moistureEquivalentToC40 =
    approxEqual(moistureComparison.c40Persistence, moistureComparison.c50Persistence)
    && approxEqual(moistureComparison.c40Carryover, moistureComparison.c50Carryover)
    && approxEqual(moistureComparison.c40WeakErosion, moistureComparison.c50WeakErosion);

  const rowsEquivalent =
    approxEqual(rowComparison.c4018Hits, rowComparison.c5018Hits)
    && approxEqual(rowComparison.c4026Hits, rowComparison.c5026Hits)
    && approxEqual(rowComparison.c4033Hits, rowComparison.c5033Hits)
    && approxEqual(rowComparison.c4018Carryover, rowComparison.c5018Carryover)
    && approxEqual(rowComparison.c4026Carryover, rowComparison.c5026Carryover)
    && approxEqual(rowComparison.c4033Carryover, rowComparison.c5033Carryover);

  const decision = classifyC51Decision({
    quickEquivalentToC40,
    moistureEquivalentToC40,
    transportEquivalentToC40: transportEquivalent(c40TransportSummary, c50TransportSummary),
    rowsEquivalent
  });

  const nextContract = {
    focusTargets: [
      'keep the C40 transition-band geometry active',
      'strengthen the 26.25° receiver guard enough to pull the center row toward the strict C32 cap',
      'leave 18.75° and 33.75° live so the transition-band sign-relief signal can survive while the 26.25° reload is tested more aggressively'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c51-partial-26p25-receiver-guard-transition-band-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickEquivalentToC40,
    moistureEquivalentToC40,
    transportEquivalentToC40: transportEquivalent(c40TransportSummary, c50TransportSummary),
    rowsEquivalent,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC51Markdown({
    decision,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
