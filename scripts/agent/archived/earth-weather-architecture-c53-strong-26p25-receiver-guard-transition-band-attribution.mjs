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
  c32QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick.json'),
  c40QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick.json'),
  c52QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c52-strong-26p25-receiver-guard-transition-band-quick.json'),
  c32MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c52MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c52-strong-26p25-receiver-guard-transition-band-quick-monthly-climatology.json'),
  c40MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-moisture-attribution.json'),
  c52MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c52-strong-26p25-receiver-guard-transition-band-quick-moisture-attribution.json'),
  c40TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json'),
  c52TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c52-strong-26p25-receiver-guard-transition-band-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c53-strong-26p25-receiver-guard-transition-band-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c53-strong-26p25-receiver-guard-transition-band-attribution.json')
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

export function classifyC53Decision({
  quickEquivalentToC40,
  moistureEquivalentToC40,
  transportEquivalentToC40,
  rowsEquivalent,
  receiverRowReloadStillElevated
}) {
  if (quickEquivalentToC40 && moistureEquivalentToC40 && transportEquivalentToC40 && rowsEquivalent && receiverRowReloadStillElevated) {
    return {
      verdict: 'strong_26p25_receiver_guard_inert_receiver_reload_maintained_by_downstream_carryover',
      nextMove: 'Architecture C54: 26p25 receiver carryover containment transition-band experiment'
    };
  }

  return {
    verdict: 'strong_26p25_receiver_guard_attribution_inconclusive',
    nextMove: 'Architecture C54: alternate 26p25 receiver carryover containment transition-band experiment'
  };
}

export function renderArchitectureC53Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C53 Strong 26p25 Receiver-Guard Transition-Band Attribution',
    '',
    'This phase attributes the C52 strong `26.25°` receiver-guard experiment relative to the earlier C40 transition-band regime. The question is whether the stronger guard finally reached the live binder or whether the receiver reload is actually being maintained downstream of fresh organized-support admission.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C40 vs C52 quick identity',
    '',
    `- cross-equatorial vapor flux north: C40 \`${quickComparison.c40CrossEq}\`, C52 \`${quickComparison.c52CrossEq}\``,
    `- ITCZ width: C40 \`${quickComparison.c40ItczWidth}\`, C52 \`${quickComparison.c52ItczWidth}\``,
    `- NH dry-belt ratio: C40 \`${quickComparison.c40DryNorth}\`, C52 \`${quickComparison.c52DryNorth}\``,
    `- SH dry-belt ratio: C40 \`${quickComparison.c40DrySouth}\`, C52 \`${quickComparison.c52DrySouth}\``,
    `- NH midlatitude westerlies: C40 \`${quickComparison.c40Westerlies}\`, C52 \`${quickComparison.c52Westerlies}\``,
    `- NH dry-belt ocean condensation: C40 \`${quickComparison.c40OceanCond}\`, C52 \`${quickComparison.c52OceanCond}\``,
    '',
    '## C40 vs C52 moisture / transport identity',
    '',
    `- NH imported anvil persistence: C40 \`${moistureComparison.c40Persistence}\`, C52 \`${moistureComparison.c52Persistence}\``,
    `- NH carried-over upper cloud: C40 \`${moistureComparison.c40Carryover}\`, C52 \`${moistureComparison.c52Carryover}\``,
    `- NH weak-erosion survival: C40 \`${moistureComparison.c40WeakErosion}\`, C52 \`${moistureComparison.c52WeakErosion}\``,
    `- equator lower total-water flux north: C40 \`${transportComparison.c40EqLower}\`, C52 \`${transportComparison.c52EqLower}\``,
    `- equator mid total-water flux north: C40 \`${transportComparison.c40EqMid}\`, C52 \`${transportComparison.c52EqMid}\``,
    `- equator upper total-water flux north: C40 \`${transportComparison.c40EqUpper}\`, C52 \`${transportComparison.c52EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C40 \`${transportComparison.c40DominantImport}\`, C52 \`${transportComparison.c52DominantImport}\``,
    '',
    '## 26.25° receiver-row context',
    '',
    `- override hits: C32 \`${rowComparison.c3226Hits}\`, C40 \`${rowComparison.c4026Hits}\`, C52 \`${rowComparison.c5226Hits}\``,
    `- carried-over upper cloud: C32 \`${rowComparison.c3226Carryover}\`, C40 \`${rowComparison.c4026Carryover}\`, C52 \`${rowComparison.c5226Carryover}\``,
    `- imported anvil persistence: C32 \`${rowComparison.c3226Persistence}\`, C40 \`${rowComparison.c4026Persistence}\`, C52 \`${rowComparison.c5226Persistence}\``,
    '',
    '## Interpretation',
    '',
    '- C52 does not create a new transition-band state. It reproduces the earlier C40 regime exactly across the quick score, moisture attribution, transport budget, and latitude-resolved shoulder rows.',
    '- The `26.25°` receiver row stays elevated relative to strict C32, but it is unchanged between C40 and C52 even after the guard pulls the organized-support max back toward the strict carveout value.',
    '- That means the live receiver reload is no longer controlled by fresh organized-support admission at `26.25°`. The stronger organized-support guard is inert, and the remaining candidate is downstream upper-cloud carryover / persistence maintenance in that receiver lane.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 core carveout fixed.',
    '- Keep the C40 transition-band organized-support restore geometry active.',
    '- Leave the broad transition-band sign-relief family alive, but add narrow `26.25°` carryover containment in the receiver lane.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c32Quick = readJson(options.c32QuickPath);
  const c40Quick = readJson(options.c40QuickPath);
  const c52Quick = readJson(options.c52QuickPath);
  const c32Monthly = readJson(options.c32MonthlyPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c52Monthly = readJson(options.c52MonthlyPath);
  const c40Moisture = readJson(options.c40MoisturePath);
  const c52Moisture = readJson(options.c52MoisturePath);
  const c40Transport = readJson(options.c40TransportPath);
  const c52Transport = readJson(options.c52TransportPath);

  const c32Metrics = extractMetrics(c32Quick);
  const c40Metrics = extractMetrics(c40Quick);
  const c52Metrics = extractMetrics(c52Quick);
  const c32Profiles = firstProfileMonth(c32Monthly)?.profiles;
  const c40Profiles = firstProfileMonth(c40Monthly)?.profiles;
  const c52Profiles = firstProfileMonth(c52Monthly)?.profiles;
  const c40TransportSummary = getTransportSummary(c40Transport);
  const c52TransportSummary = getTransportSummary(c52Transport);

  const quickComparison = {
    c40CrossEq: round(c40Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c52CrossEq: round(c52Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c40ItczWidth: round(c40Metrics.itczWidthDeg),
    c52ItczWidth: round(c52Metrics.itczWidthDeg),
    c40DryNorth: round(c40Metrics.subtropicalDryNorthRatio),
    c52DryNorth: round(c52Metrics.subtropicalDryNorthRatio),
    c40DrySouth: round(c40Metrics.subtropicalDrySouthRatio),
    c52DrySouth: round(c52Metrics.subtropicalDrySouthRatio),
    c40Westerlies: round(c40Metrics.midlatitudeWesterliesNorthU10Ms),
    c52Westerlies: round(c52Metrics.midlatitudeWesterliesNorthU10Ms),
    c40OceanCond: round(c40Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c52OceanCond: round(c52Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c40Persistence: round(c40Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c52Persistence: round(c52Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c40Carryover: round(c40Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c52Carryover: round(c52Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c40WeakErosion: round(c40Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c52WeakErosion: round(c52Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2)
  };

  const transportComparison = {
    c40EqLower: c40TransportSummary.eqLower.total,
    c52EqLower: c52TransportSummary.eqLower.total,
    c40EqMid: c40TransportSummary.eqMid.total,
    c52EqMid: c52TransportSummary.eqMid.total,
    c40EqUpper: c40TransportSummary.eqUpper.total,
    c52EqUpper: c52TransportSummary.eqUpper.total,
    c40DominantImport: c40TransportSummary.dominantImport,
    c52DominantImport: c52TransportSummary.dominantImport
  };

  const rowComparison = {
    c3226Hits: atLat(c32Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4026Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c5226Hits: atLat(c52Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c3226Carryover: atLat(c32Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4026Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c5226Carryover: atLat(c52Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c3226Persistence: atLat(c32Profiles, 'importedAnvilPersistenceMassKgM2', 26.25),
    c4026Persistence: atLat(c40Profiles, 'importedAnvilPersistenceMassKgM2', 26.25),
    c5226Persistence: atLat(c52Profiles, 'importedAnvilPersistenceMassKgM2', 26.25),
    c4018Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c5218Hits: atLat(c52Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c4033Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c5233Hits: atLat(c52Profiles, 'carryInputOverrideAccumHitCount', 33.75)
  };

  const quickEquivalentToC40 =
    approxEqual(quickComparison.c40CrossEq, quickComparison.c52CrossEq)
    && approxEqual(quickComparison.c40ItczWidth, quickComparison.c52ItczWidth)
    && approxEqual(quickComparison.c40DryNorth, quickComparison.c52DryNorth)
    && approxEqual(quickComparison.c40DrySouth, quickComparison.c52DrySouth)
    && approxEqual(quickComparison.c40Westerlies, quickComparison.c52Westerlies)
    && approxEqual(quickComparison.c40OceanCond, quickComparison.c52OceanCond);

  const moistureEquivalentToC40 =
    approxEqual(moistureComparison.c40Persistence, moistureComparison.c52Persistence)
    && approxEqual(moistureComparison.c40Carryover, moistureComparison.c52Carryover)
    && approxEqual(moistureComparison.c40WeakErosion, moistureComparison.c52WeakErosion);

  const rowsEquivalent =
    approxEqual(rowComparison.c4018Hits, rowComparison.c5218Hits)
    && approxEqual(rowComparison.c4026Hits, rowComparison.c5226Hits)
    && approxEqual(rowComparison.c4033Hits, rowComparison.c5233Hits)
    && approxEqual(rowComparison.c4026Carryover, rowComparison.c5226Carryover)
    && approxEqual(rowComparison.c4026Persistence, rowComparison.c5226Persistence);

  const receiverRowReloadStillElevated =
    rowComparison.c4026Carryover > rowComparison.c3226Carryover
    && approxEqual(rowComparison.c4026Carryover, rowComparison.c5226Carryover)
    && rowComparison.c4026Persistence > rowComparison.c3226Persistence
    && approxEqual(rowComparison.c4026Persistence, rowComparison.c5226Persistence);

  const decision = classifyC53Decision({
    quickEquivalentToC40,
    moistureEquivalentToC40,
    transportEquivalentToC40: transportEquivalent(c40TransportSummary, c52TransportSummary),
    rowsEquivalent,
    receiverRowReloadStillElevated
  });

  const nextContract = {
    focusTargets: [
      '26.25° carried-over upper-cloud overlap mass',
      '26.25° imported anvil persistence and weak-erosion survival support',
      'receiver-lane containment that leaves the broader C40 transition-band geometry alive'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c53-strong-26p25-receiver-guard-transition-band-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickEquivalentToC40,
    moistureEquivalentToC40,
    transportEquivalentToC40: transportEquivalent(c40TransportSummary, c52TransportSummary),
    rowsEquivalent,
    receiverRowReloadStillElevated,
    quickComparison,
    moistureComparison,
    transportComparison,
    rowComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC53Markdown({
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
