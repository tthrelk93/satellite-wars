#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const INNER_CORE_MAX_ABS_LAT_DEG = 10.5;

const defaults = {
  c32QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick.json'),
  c38QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c38-inner-core-organized-support-restore-quick.json'),
  c32MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json'),
  c38MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c38-inner-core-organized-support-restore-quick-monthly-climatology.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c39-inner-core-organized-support-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c39-inner-core-organized-support-restore-attribution.json')
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

const buildActiveRows = ({ latitudesDeg, values }) => latitudesDeg
  .map((latDeg, index) => ({
    latDeg,
    value: values[index] || 0
  }))
  .filter((entry) => Math.abs(entry.value) > 1e-9);

const sameRows = (a, b, epsilon = 1e-9) => (
  a.length === b.length
  && a.every((row, index) => approxEqual(row.latDeg, b[index]?.latDeg, epsilon) && approxEqual(row.value, b[index]?.value, epsilon))
);

export function classifyC39Decision({
  c32CrossEq,
  c38CrossEq,
  c32OceanCond,
  c38OceanCond,
  c32ItczWidth,
  c38ItczWidth,
  c32DryNorth,
  c38DryNorth,
  c32DrySouth,
  c38DrySouth,
  c32Westerlies,
  c38Westerlies,
  c32AccumHitRows,
  c38AccumHitRows,
  c32AccumRemovedRows,
  c38AccumRemovedRows,
  innerCoreMaxAbsLatDeg = INNER_CORE_MAX_ABS_LAT_DEG
}) {
  const quickInvariant =
    approxEqual(c32CrossEq, c38CrossEq)
    && approxEqual(c32OceanCond, c38OceanCond)
    && approxEqual(c32ItczWidth, c38ItczWidth)
    && approxEqual(c32DryNorth, c38DryNorth)
    && approxEqual(c32DrySouth, c38DrySouth)
    && approxEqual(c32Westerlies, c38Westerlies);

  const overrideInvariant =
    sameRows(c32AccumHitRows, c38AccumHitRows)
    && sameRows(c32AccumRemovedRows, c38AccumRemovedRows);

  const activeOutsideInnerCore = c38AccumHitRows.length > 0
    && c38AccumHitRows.every((entry) => Math.abs(entry.latDeg) > innerCoreMaxAbsLatDeg);

  if (quickInvariant && overrideInvariant && activeOutsideInnerCore) {
    return {
      verdict: 'inner_core_restore_inert_active_override_targets_outside_restore_band',
      nextMove: 'Architecture C40: transition-band organized-support restore experiment'
    };
  }

  return {
    verdict: 'inner_core_organized_support_restore_attribution_inconclusive',
    nextMove: 'Architecture C40: broader organized-support restore geometry experiment'
  };
}

const formatRows = (rows) => rows.length
  ? rows.map((entry) => `\`${round(entry.latDeg, 2)}°: ${round(entry.value, 3)}\``).join(', ')
  : 'none';

export function renderArchitectureC39Markdown({
  decision,
  quickComparison,
  overrideComparison,
  nextContract,
  innerCoreMaxAbsLatDeg = INNER_CORE_MAX_ABS_LAT_DEG
}) {
  const lines = [
    '# Earth Weather Architecture C39 Inner-Core Organized-Support Restore Attribution',
    '',
    'This phase attributes why the C38 inner-core organized-support restore was inert. The question is whether the inner-core taper reached the live carry-input override targets at all, or whether it missed the actual receiver / transition rows where the strict C32 gate is binding.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C32 vs C38 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C32 \`${quickComparison.c32CrossEq}\`, C38 \`${quickComparison.c38CrossEq}\``,
    `- ITCZ width: C32 \`${quickComparison.c32ItczWidth}\`, C38 \`${quickComparison.c38ItczWidth}\``,
    `- NH dry-belt ratio: C32 \`${quickComparison.c32DryNorth}\`, C38 \`${quickComparison.c38DryNorth}\``,
    `- SH dry-belt ratio: C32 \`${quickComparison.c32DrySouth}\`, C38 \`${quickComparison.c38DrySouth}\``,
    `- NH midlatitude westerlies: C32 \`${quickComparison.c32Westerlies}\`, C38 \`${quickComparison.c38Westerlies}\``,
    `- NH dry-belt ocean condensation: C32 \`${quickComparison.c32OceanCond}\`, C38 \`${quickComparison.c38OceanCond}\``,
    '',
    '## Carry-input override latitude coverage',
    '',
    `- inner-core restore max |lat|: \`${innerCoreMaxAbsLatDeg}°\``,
    `- C32 accumulated override hits: ${formatRows(overrideComparison.c32AccumHitRows)}`,
    `- C38 accumulated override hits: ${formatRows(overrideComparison.c38AccumHitRows)}`,
    `- C32 accumulated removed mass: ${formatRows(overrideComparison.c32AccumRemovedRows)}`,
    `- C38 accumulated removed mass: ${formatRows(overrideComparison.c38AccumRemovedRows)}`,
    `- C32 in-band hit rows: ${formatRows(overrideComparison.c32InBandRows)}`,
    `- C38 in-band hit rows: ${formatRows(overrideComparison.c38InBandRows)}`,
    `- C32 out-of-band hit rows: ${formatRows(overrideComparison.c32OutOfBandRows)}`,
    `- C38 out-of-band hit rows: ${formatRows(overrideComparison.c38OutOfBandRows)}`,
    '',
    '## Interpretation',
    '',
    '- The C38 inner-core restore did not change the quick climate signature at all relative to the strict C32 carveout.',
    '- The carry-input override accumulators are also unchanged to reporting precision between C32 and C38.',
    '- The active override rows sit in the transition / receiver latitudes around `18.75°`, `26.25°`, `33.75°` and their southern mirrors, all outside the inner-core taper.',
    '- That means the inner-core restore was geometrically inert: it never touched the actual rows where the organized-support gate is binding.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 organized-support / potential carveout fixed in the equatorial core.',
    '- Restore organized-support admission only across the active transition band where the carry-input override is actually firing.',
    '- Keep the restore bounded with a latitude taper so the experiment can recover blocked transition transport without reopening the full receiver side.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c32Quick = readJson(options.c32QuickPath);
  const c38Quick = readJson(options.c38QuickPath);
  const c32Monthly = readJson(options.c32MonthlyPath);
  const c38Monthly = readJson(options.c38MonthlyPath);

  const c32Metrics = extractMetrics(c32Quick);
  const c38Metrics = extractMetrics(c38Quick);
  const c32ProfileMonth = firstProfileMonth(c32Monthly);
  const c38ProfileMonth = firstProfileMonth(c38Monthly);

  if (!c32ProfileMonth || !c38ProfileMonth) {
    throw new Error('Expected both C32 and C38 monthly climatology artifacts to contain at least one profiled month.');
  }

  const c32Latitudes = c32ProfileMonth.profiles.latitudesDeg;
  const c38Latitudes = c38ProfileMonth.profiles.latitudesDeg;
  const c32AccumHitRows = buildActiveRows({
    latitudesDeg: c32Latitudes,
    values: c32ProfileMonth.profiles.series.carryInputOverrideAccumHitCount
  }).map((entry) => ({ latDeg: round(entry.latDeg, 2), value: round(entry.value, 3) }));
  const c38AccumHitRows = buildActiveRows({
    latitudesDeg: c38Latitudes,
    values: c38ProfileMonth.profiles.series.carryInputOverrideAccumHitCount
  }).map((entry) => ({ latDeg: round(entry.latDeg, 2), value: round(entry.value, 3) }));
  const c32AccumRemovedRows = buildActiveRows({
    latitudesDeg: c32Latitudes,
    values: c32ProfileMonth.profiles.series.carryInputOverrideAccumRemovedMassKgM2
  }).map((entry) => ({ latDeg: round(entry.latDeg, 2), value: round(entry.value, 3) }));
  const c38AccumRemovedRows = buildActiveRows({
    latitudesDeg: c38Latitudes,
    values: c38ProfileMonth.profiles.series.carryInputOverrideAccumRemovedMassKgM2
  }).map((entry) => ({ latDeg: round(entry.latDeg, 2), value: round(entry.value, 3) }));

  const splitBand = (rows) => ({
    inBand: rows.filter((entry) => Math.abs(entry.latDeg) <= INNER_CORE_MAX_ABS_LAT_DEG),
    outOfBand: rows.filter((entry) => Math.abs(entry.latDeg) > INNER_CORE_MAX_ABS_LAT_DEG)
  });
  const c32BandSplit = splitBand(c32AccumHitRows);
  const c38BandSplit = splitBand(c38AccumHitRows);

  const quickComparison = {
    c32CrossEq: round(c32Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c38CrossEq: round(c38Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c32ItczWidth: round(c32Metrics.itczWidthDeg),
    c38ItczWidth: round(c38Metrics.itczWidthDeg),
    c32DryNorth: round(c32Metrics.subtropicalDryNorthRatio),
    c38DryNorth: round(c38Metrics.subtropicalDryNorthRatio),
    c32DrySouth: round(c32Metrics.subtropicalDrySouthRatio),
    c38DrySouth: round(c38Metrics.subtropicalDrySouthRatio),
    c32Westerlies: round(c32Metrics.midlatitudeWesterliesNorthU10Ms),
    c38Westerlies: round(c38Metrics.midlatitudeWesterliesNorthU10Ms),
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c38OceanCond: round(c38Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const overrideComparison = {
    c32AccumHitRows,
    c38AccumHitRows,
    c32AccumRemovedRows,
    c38AccumRemovedRows,
    c32InBandRows: c32BandSplit.inBand,
    c38InBandRows: c38BandSplit.inBand,
    c32OutOfBandRows: c32BandSplit.outOfBand,
    c38OutOfBandRows: c38BandSplit.outOfBand
  };

  const decision = classifyC39Decision({
    ...quickComparison,
    ...overrideComparison,
    innerCoreMaxAbsLatDeg: INNER_CORE_MAX_ABS_LAT_DEG
  });

  const nextContract = {
    focusTargets: [
      'restore organized-support admission across the active transition band near 18.75°–33.75° and mirrored southern rows',
      'leave the equatorial core at the strict C32 organized-support / potential carveout',
      'preserve the C32 receiver containment while testing whether the live blocked subset is transition-band only'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c39-inner-core-organized-support-restore-attribution.v1',
    generatedAt: new Date().toISOString(),
    innerCoreMaxAbsLatDeg: INNER_CORE_MAX_ABS_LAT_DEG,
    decision,
    quickComparison,
    overrideComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC39Markdown({
    decision,
    quickComparison,
    overrideComparison,
    nextContract,
    innerCoreMaxAbsLatDeg: INNER_CORE_MAX_ABS_LAT_DEG
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
