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
  c44QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c44-26p25-centered-organized-support-restore-quick.json'),
  c32MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c44MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c44-26p25-centered-organized-support-restore-quick-monthly-climatology.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c45-26p25-centered-organized-support-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c45-26p25-centered-organized-support-restore-attribution.json')
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

export function classifyC45Decision({
  c32CrossEq,
  c44CrossEq,
  c32ItczWidth,
  c44ItczWidth,
  c32DryNorth,
  c44DryNorth,
  c32DrySouth,
  c44DrySouth,
  c32Westerlies,
  c44Westerlies,
  c32OceanCond,
  c44OceanCond,
  c4026Hits,
  c4426Hits,
  c4033Hits,
  c4433Hits,
  c4026Carryover,
  c4426Carryover,
  c4033Carryover,
  c4433Carryover
}) {
  const quickInvariant =
    approxEqual(c32CrossEq, c44CrossEq)
    && approxEqual(c32ItczWidth, c44ItczWidth)
    && approxEqual(c32DryNorth, c44DryNorth)
    && approxEqual(c32DrySouth, c44DrySouth)
    && approxEqual(c32Westerlies, c44Westerlies)
    && approxEqual(c32OceanCond, c44OceanCond);

  const isolated26Reverted =
    Number.isFinite(c4026Hits) && Number.isFinite(c4426Hits) && c4426Hits < c4026Hits
    && Number.isFinite(c4026Carryover) && Number.isFinite(c4426Carryover) && c4426Carryover < c4026Carryover
    && Number.isFinite(c4033Hits) && Number.isFinite(c4433Hits) && c4433Hits > c4033Hits
    && Number.isFinite(c4033Carryover) && Number.isFinite(c4433Carryover) && c4433Carryover > c4033Carryover;

  if (quickInvariant && isolated26Reverted) {
    return {
      verdict: 'isolated_26p25_restore_insufficient_c40_signal_requires_poleward_shoulder_coupling',
      nextMove: 'Architecture C46: 26p25-33p75 coupled organized-support restore experiment'
    };
  }

  return {
    verdict: '26p25_centered_organized_support_restore_attribution_inconclusive',
    nextMove: 'Architecture C46: alternate coupled-shoulder organized-support restore experiment'
  };
}

export function renderArchitectureC45Markdown({
  decision,
  quickComparison,
  latitudeShiftComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C45 26p25-Centered Organized-Support Restore Attribution',
    '',
    'This phase attributes the isolated C44 `26.25°` restore relative to both the strict C32 carveout and the broader C40 transition-band restore. The question is whether the `26.25°` lane alone is sufficient to carry the live C40 signal or whether it needs coupling to the poleward shoulder.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C32 vs C44 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C32 \`${quickComparison.c32CrossEq}\`, C44 \`${quickComparison.c44CrossEq}\``,
    `- ITCZ width: C32 \`${quickComparison.c32ItczWidth}\`, C44 \`${quickComparison.c44ItczWidth}\``,
    `- NH dry-belt ratio: C32 \`${quickComparison.c32DryNorth}\`, C44 \`${quickComparison.c44DryNorth}\``,
    `- SH dry-belt ratio: C32 \`${quickComparison.c32DrySouth}\`, C44 \`${quickComparison.c44DrySouth}\``,
    `- NH midlatitude westerlies: C32 \`${quickComparison.c32Westerlies}\`, C44 \`${quickComparison.c44Westerlies}\``,
    `- NH dry-belt ocean condensation: C32 \`${quickComparison.c32OceanCond}\`, C44 \`${quickComparison.c44OceanCond}\``,
    '',
    '## C40 to C44 lane isolation',
    '',
    `- 26.25° accumulated override hits: C40 \`${latitudeShiftComparison.c4026Hits}\`, C44 \`${latitudeShiftComparison.c4426Hits}\``,
    `- 26.25° carried-over upper cloud: C40 \`${latitudeShiftComparison.c4026Carryover}\`, C44 \`${latitudeShiftComparison.c4426Carryover}\``,
    `- 33.75° accumulated override hits: C40 \`${latitudeShiftComparison.c4033Hits}\`, C44 \`${latitudeShiftComparison.c4433Hits}\``,
    `- 33.75° carried-over upper cloud: C40 \`${latitudeShiftComparison.c4033Carryover}\`, C44 \`${latitudeShiftComparison.c4433Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C44 is another exact reversion to the strict C32 state, so the isolated `26.25°` lane is not sufficient on its own.',
    '- The live C40 signal therefore depends on coupling between the `26.25°` lane and the poleward shoulder rather than on the `26.25°` lane alone.',
    '- Since C42 also showed that removing `26.25°` kills the signal, the remaining honest lever is a paired `26.25° + 33.75°` restore instead of any more single-lane geometry.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 core carveout fixed.',
    '- Restore organized-support across the `26.25°` and `33.75°` poleward shoulder only.',
    '- Leave `18.75°` and the equatorial core outside the active restore geometry.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c32Quick = readJson(options.c32QuickPath);
  const c40Quick = readJson(options.c40QuickPath);
  const c44Quick = readJson(options.c44QuickPath);
  const c32Monthly = readJson(options.c32MonthlyPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c44Monthly = readJson(options.c44MonthlyPath);

  const c32Metrics = extractMetrics(c32Quick);
  const c44Metrics = extractMetrics(c44Quick);
  const c40Profiles = firstProfileMonth(c40Monthly)?.profiles;
  const c44Profiles = firstProfileMonth(c44Monthly)?.profiles;

  const quickComparison = {
    c32CrossEq: round(c32Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c44CrossEq: round(c44Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c32ItczWidth: round(c32Metrics.itczWidthDeg),
    c44ItczWidth: round(c44Metrics.itczWidthDeg),
    c32DryNorth: round(c32Metrics.subtropicalDryNorthRatio),
    c44DryNorth: round(c44Metrics.subtropicalDryNorthRatio),
    c32DrySouth: round(c32Metrics.subtropicalDrySouthRatio),
    c44DrySouth: round(c44Metrics.subtropicalDrySouthRatio),
    c32Westerlies: round(c32Metrics.midlatitudeWesterliesNorthU10Ms),
    c44Westerlies: round(c44Metrics.midlatitudeWesterliesNorthU10Ms),
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c44OceanCond: round(c44Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const latitudeShiftComparison = {
    c4026Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4426Hits: atLat(c44Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4026Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4426Carryover: atLat(c44Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4033Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4433Hits: atLat(c44Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4033Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c4433Carryover: atLat(c44Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const decision = classifyC45Decision({
    ...quickComparison,
    ...latitudeShiftComparison
  });

  const nextContract = {
    focusTargets: [
      'restore organized-support only across the 26.25°–33.75° poleward shoulder',
      'leave 18.75° and the equatorial core outside the active restore geometry',
      'test whether coupled poleward-shoulder geometry is sufficient to recreate the live C40 signal'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c45-26p25-centered-organized-support-restore-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickComparison,
    latitudeShiftComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC45Markdown({
    decision,
    quickComparison,
    latitudeShiftComparison,
    nextContract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
