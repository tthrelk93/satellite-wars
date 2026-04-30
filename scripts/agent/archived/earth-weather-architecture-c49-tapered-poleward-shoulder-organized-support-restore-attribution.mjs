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
  c48QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-quick.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c48MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-quick-monthly-climatology.json'),
  c40MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-moisture-attribution.json'),
  c48MoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-quick-moisture-attribution.json'),
  c40TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json'),
  c48TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c49-tapered-poleward-shoulder-organized-support-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c49-tapered-poleward-shoulder-organized-support-restore-attribution.json')
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

export function classifyC49Decision({
  quickEquivalentToC40,
  moistureEquivalentToC40,
  transportEquivalentToC40,
  rowsEquivalent
}) {
  if (quickEquivalentToC40 && moistureEquivalentToC40 && transportEquivalentToC40 && rowsEquivalent) {
    return {
      verdict: 'tapered_poleward_shoulder_exactly_reproduces_c40_transition_regime',
      nextMove: 'Architecture C50: partial 26p25 receiver-guard transition-band experiment'
    };
  }

  return {
    verdict: 'tapered_poleward_shoulder_attribution_inconclusive',
    nextMove: 'Architecture C50: alternate transition-band receiver-guard experiment'
  };
}

export function renderArchitectureC49Markdown({
  decision,
  quickComparison,
  moistureComparison,
  transportComparison,
  rowComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C49 Tapered Poleward-Shoulder Organized-Support Restore Attribution',
    '',
    'This phase attributes the C48 tapered poleward-shoulder restore relative to the earlier C40 transition-band restore. The question is whether tapering the `33.75°` shoulder created a genuinely new middle state or simply reproduced the known C40 regime exactly.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C40 vs C48 quick identity',
    '',
    `- cross-equatorial vapor flux north: C40 \`${quickComparison.c40CrossEq}\`, C48 \`${quickComparison.c48CrossEq}\``,
    `- ITCZ width: C40 \`${quickComparison.c40ItczWidth}\`, C48 \`${quickComparison.c48ItczWidth}\``,
    `- NH dry-belt ratio: C40 \`${quickComparison.c40DryNorth}\`, C48 \`${quickComparison.c48DryNorth}\``,
    `- SH dry-belt ratio: C40 \`${quickComparison.c40DrySouth}\`, C48 \`${quickComparison.c48DrySouth}\``,
    `- NH midlatitude westerlies: C40 \`${quickComparison.c40Westerlies}\`, C48 \`${quickComparison.c48Westerlies}\``,
    `- NH dry-belt ocean condensation: C40 \`${quickComparison.c40OceanCond}\`, C48 \`${quickComparison.c48OceanCond}\``,
    '',
    '## C40 vs C48 moisture / transport identity',
    '',
    `- NH imported anvil persistence: C40 \`${moistureComparison.c40Persistence}\`, C48 \`${moistureComparison.c48Persistence}\``,
    `- NH carried-over upper cloud: C40 \`${moistureComparison.c40Carryover}\`, C48 \`${moistureComparison.c48Carryover}\``,
    `- NH weak-erosion survival: C40 \`${moistureComparison.c40WeakErosion}\`, C48 \`${moistureComparison.c48WeakErosion}\``,
    `- equator lower total-water flux north: C40 \`${transportComparison.c40EqLower}\`, C48 \`${transportComparison.c48EqLower}\``,
    `- equator mid total-water flux north: C40 \`${transportComparison.c40EqMid}\`, C48 \`${transportComparison.c48EqMid}\``,
    `- equator upper total-water flux north: C40 \`${transportComparison.c40EqUpper}\`, C48 \`${transportComparison.c48EqUpper}\``,
    `- 35° dominant NH dry-belt vapor import: C40 \`${transportComparison.c40DominantImport}\`, C48 \`${transportComparison.c48DominantImport}\``,
    '',
    '## C40 vs C48 shoulder-row identity',
    '',
    `- 18.75° override hits: C40 \`${rowComparison.c4018Hits}\`, C48 \`${rowComparison.c4818Hits}\``,
    `- 26.25° override hits: C40 \`${rowComparison.c4026Hits}\`, C48 \`${rowComparison.c4826Hits}\``,
    `- 33.75° override hits: C40 \`${rowComparison.c4033Hits}\`, C48 \`${rowComparison.c4833Hits}\``,
    `- 18.75° carried-over upper cloud: C40 \`${rowComparison.c4018Carryover}\`, C48 \`${rowComparison.c4818Carryover}\``,
    `- 26.25° carried-over upper cloud: C40 \`${rowComparison.c4026Carryover}\`, C48 \`${rowComparison.c4826Carryover}\``,
    `- 33.75° carried-over upper cloud: C40 \`${rowComparison.c4033Carryover}\`, C48 \`${rowComparison.c4833Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C48 does not create a new transition family state. It reproduces the earlier C40 regime to reporting precision across the quick score, moisture attribution, transport budget, and shoulder-row diagnostics.',
    '- That means tapering the poleward shoulder is not the remaining live lever by itself. The unresolved defect is now the same one C41 already exposed inside the C40 regime: a small sign-defect relief paired with a modest `26.25°` receiver reload and a worse equatorial lower branch.',
    '- The next honest bounded move is therefore to keep the C40 transition-band geometry fixed and partially guard the `26.25°` receiver lane rather than trying more shoulder-shape variants.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 core carveout fixed.',
    '- Keep the C40 transition-band restore geometry active.',
    '- Partially guard the `26.25°` receiver lane so the transition-band signal can stay live without fully reopening that inner dry-belt row.',
    '- Leave the `33.75°` shoulder at the proven C40-level amplitude.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c40Quick = readJson(options.c40QuickPath);
  const c48Quick = readJson(options.c48QuickPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c48Monthly = readJson(options.c48MonthlyPath);
  const c40Moisture = readJson(options.c40MoisturePath);
  const c48Moisture = readJson(options.c48MoisturePath);
  const c40Transport = readJson(options.c40TransportPath);
  const c48Transport = readJson(options.c48TransportPath);

  const c40Metrics = extractMetrics(c40Quick);
  const c48Metrics = extractMetrics(c48Quick);
  const c40Profiles = firstProfileMonth(c40Monthly)?.profiles;
  const c48Profiles = firstProfileMonth(c48Monthly)?.profiles;
  const c40TransportSummary = getTransportSummary(c40Transport);
  const c48TransportSummary = getTransportSummary(c48Transport);

  const quickComparison = {
    c40CrossEq: round(c40Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c48CrossEq: round(c48Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c40ItczWidth: round(c40Metrics.itczWidthDeg),
    c48ItczWidth: round(c48Metrics.itczWidthDeg),
    c40DryNorth: round(c40Metrics.subtropicalDryNorthRatio),
    c48DryNorth: round(c48Metrics.subtropicalDryNorthRatio),
    c40DrySouth: round(c40Metrics.subtropicalDrySouthRatio),
    c48DrySouth: round(c48Metrics.subtropicalDrySouthRatio),
    c40Westerlies: round(c40Metrics.midlatitudeWesterliesNorthU10Ms),
    c48Westerlies: round(c48Metrics.midlatitudeWesterliesNorthU10Ms),
    c40OceanCond: round(c40Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c48OceanCond: round(c48Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const moistureComparison = {
    c40Persistence: round(c40Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c48Persistence: round(c48Moisture.latestMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2),
    c40Carryover: round(c40Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c48Carryover: round(c48Moisture.latestMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2),
    c40WeakErosion: round(c40Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2),
    c48WeakErosion: round(c48Moisture.latestMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2)
  };

  const transportComparison = {
    c40EqLower: c40TransportSummary.eqLower.total,
    c48EqLower: c48TransportSummary.eqLower.total,
    c40EqMid: c40TransportSummary.eqMid.total,
    c48EqMid: c48TransportSummary.eqMid.total,
    c40EqUpper: c40TransportSummary.eqUpper.total,
    c48EqUpper: c48TransportSummary.eqUpper.total,
    c40DominantImport: c40TransportSummary.dominantImport,
    c48DominantImport: c48TransportSummary.dominantImport
  };

  const rowComparison = {
    c4018Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c4818Hits: atLat(c48Profiles, 'carryInputOverrideAccumHitCount', 18.75),
    c4026Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4826Hits: atLat(c48Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4033Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4833Hits: atLat(c48Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4018Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c4818Carryover: atLat(c48Profiles, 'carriedOverUpperCloudMassKgM2', 18.75),
    c4026Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4826Carryover: atLat(c48Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4033Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c4833Carryover: atLat(c48Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const quickEquivalentToC40 =
    approxEqual(quickComparison.c40CrossEq, quickComparison.c48CrossEq)
    && approxEqual(quickComparison.c40ItczWidth, quickComparison.c48ItczWidth)
    && approxEqual(quickComparison.c40DryNorth, quickComparison.c48DryNorth)
    && approxEqual(quickComparison.c40DrySouth, quickComparison.c48DrySouth)
    && approxEqual(quickComparison.c40Westerlies, quickComparison.c48Westerlies)
    && approxEqual(quickComparison.c40OceanCond, quickComparison.c48OceanCond);

  const moistureEquivalentToC40 =
    approxEqual(moistureComparison.c40Persistence, moistureComparison.c48Persistence)
    && approxEqual(moistureComparison.c40Carryover, moistureComparison.c48Carryover)
    && approxEqual(moistureComparison.c40WeakErosion, moistureComparison.c48WeakErosion);

  const rowsEquivalent =
    approxEqual(rowComparison.c4018Hits, rowComparison.c4818Hits)
    && approxEqual(rowComparison.c4026Hits, rowComparison.c4826Hits)
    && approxEqual(rowComparison.c4033Hits, rowComparison.c4833Hits)
    && approxEqual(rowComparison.c4018Carryover, rowComparison.c4818Carryover)
    && approxEqual(rowComparison.c4026Carryover, rowComparison.c4826Carryover)
    && approxEqual(rowComparison.c4033Carryover, rowComparison.c4833Carryover);

  const decision = classifyC49Decision({
    quickEquivalentToC40,
    moistureEquivalentToC40,
    transportEquivalentToC40: transportEquivalent(c40TransportSummary, c48TransportSummary),
    rowsEquivalent
  });

  const nextContract = {
    focusTargets: [
      'keep the C40 transition-band restore geometry active',
      'partially guard the 26.25° receiver lane instead of removing it outright',
      'leave the 33.75° shoulder at the proven C40-level amplitude while testing whether a smaller 26.25° reload can preserve the sign-relief signal'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c49-tapered-poleward-shoulder-organized-support-restore-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickEquivalentToC40,
    moistureEquivalentToC40,
    transportEquivalentToC40: transportEquivalent(c40TransportSummary, c48TransportSummary),
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
  fs.writeFileSync(options.reportPath, renderArchitectureC49Markdown({
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
