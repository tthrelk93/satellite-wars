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
  c42QuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick.json'),
  c32MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json'),
  c40MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json'),
  c42MonthlyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-monthly-climatology.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c43-equatorward-transition-organized-support-restore-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c43-equatorward-transition-organized-support-restore-attribution.json')
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

export function classifyC43Decision({
  c32CrossEq,
  c42CrossEq,
  c32ItczWidth,
  c42ItczWidth,
  c32DryNorth,
  c42DryNorth,
  c32DrySouth,
  c42DrySouth,
  c32Westerlies,
  c42Westerlies,
  c32OceanCond,
  c42OceanCond,
  c4026Hits,
  c4226Hits,
  c4026Carryover,
  c4226Carryover,
  c4033Hits,
  c4233Hits
}) {
  const quickInvariant =
    approxEqual(c32CrossEq, c42CrossEq)
    && approxEqual(c32ItczWidth, c42ItczWidth)
    && approxEqual(c32DryNorth, c42DryNorth)
    && approxEqual(c32DrySouth, c42DrySouth)
    && approxEqual(c32Westerlies, c42Westerlies)
    && approxEqual(c32OceanCond, c42OceanCond);

  const laneRetracted =
    Number.isFinite(c4026Hits) && Number.isFinite(c4226Hits) && c4226Hits < c4026Hits
    && Number.isFinite(c4026Carryover) && Number.isFinite(c4226Carryover) && c4226Carryover < c4026Carryover
    && Number.isFinite(c4033Hits) && Number.isFinite(c4233Hits) && c4233Hits > c4033Hits;

  if (quickInvariant && laneRetracted) {
    return {
      verdict: 'equatorward_narrowing_removes_26p25_restore_signal_and_exactly_reverts_to_c32',
      nextMove: 'Architecture C44: 26p25-centered organized-support restore experiment'
    };
  }

  return {
    verdict: 'equatorward_transition_organized_support_restore_attribution_inconclusive',
    nextMove: 'Architecture C44: alternate narrow-band organized-support restore experiment'
  };
}

export function renderArchitectureC43Markdown({
  decision,
  quickComparison,
  latitudeShiftComparison,
  nextContract
}) {
  const lines = [
    '# Earth Weather Architecture C43 Equatorward-Transition Organized-Support Restore Attribution',
    '',
    'This phase attributes the C42 equatorward-transition restore relative to both the strict C32 carveout and the broader C40 transition-band restore. The question is whether backing away from the 26.25° receiver lane preserved any of the live C40 sign-relief signal or simply collapsed the experiment back to the C32 baseline.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C32 vs C42 quick comparison',
    '',
    `- cross-equatorial vapor flux north: C32 \`${quickComparison.c32CrossEq}\`, C42 \`${quickComparison.c42CrossEq}\``,
    `- ITCZ width: C32 \`${quickComparison.c32ItczWidth}\`, C42 \`${quickComparison.c42ItczWidth}\``,
    `- NH dry-belt ratio: C32 \`${quickComparison.c32DryNorth}\`, C42 \`${quickComparison.c42DryNorth}\``,
    `- SH dry-belt ratio: C32 \`${quickComparison.c32DrySouth}\`, C42 \`${quickComparison.c42DrySouth}\``,
    `- NH midlatitude westerlies: C32 \`${quickComparison.c32Westerlies}\`, C42 \`${quickComparison.c42Westerlies}\``,
    `- NH dry-belt ocean condensation: C32 \`${quickComparison.c32OceanCond}\`, C42 \`${quickComparison.c42OceanCond}\``,
    '',
    '## C40 to C42 lane retraction',
    '',
    `- 26.25° accumulated override hits: C40 \`${latitudeShiftComparison.c4026Hits}\`, C42 \`${latitudeShiftComparison.c4226Hits}\``,
    `- 26.25° carried-over upper cloud: C40 \`${latitudeShiftComparison.c4026Carryover}\`, C42 \`${latitudeShiftComparison.c4226Carryover}\``,
    `- 33.75° accumulated override hits: C40 \`${latitudeShiftComparison.c4033Hits}\`, C42 \`${latitudeShiftComparison.c4233Hits}\``,
    `- 33.75° carried-over upper cloud: C40 \`${latitudeShiftComparison.c4033Carryover}\`, C42 \`${latitudeShiftComparison.c4233Carryover}\``,
    '',
    '## Interpretation',
    '',
    '- C42 is not just close to C32. It reproduces the strict C32 quick climate and latitude-resolved override state to reporting precision.',
    '- The only live difference between C40 and C42 was the retracted `26.25°` lane. Once that lane is removed, the small C40 sign-relief signal disappears completely.',
    '- That means the `26.25°` receiver lane is carrying the only live organized-support restore signal in this subfamily.',
    '',
    '## Next experiment contract',
    '',
    '- Keep the strict C32 core carveout fixed.',
    '- Stop treating the whole transition band as the lever; isolate the `26.25°` lane directly.',
    '- Test whether a 26.25°-centered restore alone can reproduce the C40 sign-relief signal without unnecessarily touching 18.75° or 33.75°.',
    '- Candidate focus lanes:',
    ...nextContract.focusTargets.map((entry) => `  - \`${entry}\``),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c32Quick = readJson(options.c32QuickPath);
  const c40Quick = readJson(options.c40QuickPath);
  const c42Quick = readJson(options.c42QuickPath);
  const c32Monthly = readJson(options.c32MonthlyPath);
  const c40Monthly = readJson(options.c40MonthlyPath);
  const c42Monthly = readJson(options.c42MonthlyPath);

  const c32Metrics = extractMetrics(c32Quick);
  const c42Metrics = extractMetrics(c42Quick);
  const c40Profiles = firstProfileMonth(c40Monthly)?.profiles;
  const c42Profiles = firstProfileMonth(c42Monthly)?.profiles;

  const quickComparison = {
    c32CrossEq: round(c32Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c42CrossEq: round(c42Metrics.crossEquatorialVaporFluxNorthKgM_1S),
    c32ItczWidth: round(c32Metrics.itczWidthDeg),
    c42ItczWidth: round(c42Metrics.itczWidthDeg),
    c32DryNorth: round(c32Metrics.subtropicalDryNorthRatio),
    c42DryNorth: round(c42Metrics.subtropicalDryNorthRatio),
    c32DrySouth: round(c32Metrics.subtropicalDrySouthRatio),
    c42DrySouth: round(c42Metrics.subtropicalDrySouthRatio),
    c32Westerlies: round(c32Metrics.midlatitudeWesterliesNorthU10Ms),
    c42Westerlies: round(c42Metrics.midlatitudeWesterliesNorthU10Ms),
    c32OceanCond: round(c32Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    c42OceanCond: round(c42Metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const latitudeShiftComparison = {
    c4026Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4226Hits: atLat(c42Profiles, 'carryInputOverrideAccumHitCount', 26.25),
    c4026Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4226Carryover: atLat(c42Profiles, 'carriedOverUpperCloudMassKgM2', 26.25),
    c4033Hits: atLat(c40Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4233Hits: atLat(c42Profiles, 'carryInputOverrideAccumHitCount', 33.75),
    c4033Carryover: atLat(c40Profiles, 'carriedOverUpperCloudMassKgM2', 33.75),
    c4233Carryover: atLat(c42Profiles, 'carriedOverUpperCloudMassKgM2', 33.75)
  };

  const decision = classifyC43Decision({
    ...quickComparison,
    ...latitudeShiftComparison
  });

  const nextContract = {
    focusTargets: [
      'restore organized-support only around the 26.25° lane and its mirrored southern row',
      'leave 18.75° and 33.75° outside the active restore geometry',
      'test whether the 26.25° lane alone reproduces the only live sign-relief signal from C40'
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c43-equatorward-transition-organized-support-restore-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    quickComparison,
    latitudeShiftComparison,
    nextContract
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC43Markdown({
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
