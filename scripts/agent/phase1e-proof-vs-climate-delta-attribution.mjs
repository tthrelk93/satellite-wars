#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const auditScriptPath = path.join(repoRoot, 'scripts', 'agent', 'planetary-realism-audit.mjs');
const loaderPath = path.join(repoRoot, 'scripts', 'agent', 'resolve-js-loader.mjs');
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1e-proof-vs-climate-delta-attribution'
);
const SECONDS_PER_DAY = 86400;
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const BAND_DEFS = [
  { key: 'equatorialCore', label: 'Equatorial core', lat0: -10, lat1: 10 },
  { key: 'northTransition', label: 'North transition', lat0: 10, lat1: 22 },
  { key: 'northDryBelt', label: 'North dry belt', lat0: 22, lat1: 35 },
  { key: 'southTransition', label: 'South transition', lat0: -22, lat1: -10 },
  { key: 'southDryBelt', label: 'South dry belt', lat0: -35, lat1: -22 }
];

const FAMILY_DEFS = [
  {
    key: 'circulation_moisture_reorganization',
    label: 'Circulation / moisture reorganization',
    metrics: [
      { key: 'itczWidthDeg', direction: 1, weight: 1.0 },
      { key: 'subtropicalDryNorthRatio', direction: 1, weight: 0.9 },
      { key: 'subtropicalDrySouthRatio', direction: 1, weight: 0.7 },
      { key: 'midlatitudeWesterliesNorthU10Ms', direction: -1, weight: 0.9 },
      { key: 'midlatitudeWesterliesSouthU10Ms', direction: -1, weight: 0.5 },
      { key: 'crossEquatorialVaporFluxNorthKgM_1S', direction: 1, weight: 0.4 }
    ]
  },
  {
    key: 'large_scale_condensation_maintenance',
    label: 'Large-scale condensation maintenance',
    metrics: [
      { key: 'northDryBeltLargeScaleCondensationMeanKgM2', direction: 1, weight: 1.0 },
      { key: 'northDryBeltUpperCloudPathMeanKgM2', direction: 1, weight: 0.7 },
      { key: 'globalCloudMeanFrac', direction: 1, weight: 0.35 }
    ]
  },
  {
    key: 'imported_anvil_persistence',
    label: 'Imported anvil persistence',
    metrics: [
      { key: 'northDryBeltImportedAnvilPersistenceMeanKgM2', direction: 1, weight: 1.0 },
      { key: 'northDryBeltUpperCloudPathMeanKgM2', direction: 1, weight: 0.5 }
    ]
  },
  {
    key: 'weak_erosion_cloud_survival',
    label: 'Weak-erosion cloud survival',
    metrics: [
      { key: 'northDryBeltWeakErosionCloudSurvivalMeanKgM2', direction: 1, weight: 1.0 },
      { key: 'northDryBeltCarriedOverUpperCloudMeanKgM2', direction: 1, weight: 0.6 }
    ]
  },
  {
    key: 'radiative_cloud_support',
    label: 'Radiative cloud support',
    metrics: [
      { key: 'northDryBeltSurfaceCloudShieldingMeanWm2', direction: 1, weight: 0.8 },
      { key: 'northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2', direction: 1, weight: 0.8 },
      { key: 'northDryBeltBoundaryLayerRhMeanFrac', direction: 1, weight: 0.4 }
    ]
  },
  {
    key: 'humidification_precip_rebound',
    label: 'Humidification / precipitation rebound',
    metrics: [
      { key: 'globalPrecipMeanMmHr', direction: 1, weight: 0.5 },
      { key: 'northDryBeltBoundaryLayerRhMeanFrac', direction: 1, weight: 0.8 },
      { key: 'northDryBeltMidTroposphereRhMeanFrac', direction: 1, weight: 0.8 }
    ]
  }
];

let reportBase = DEFAULT_REPORT_BASE;
let preset = 'quick';
let seed = 12345;
let baselineSummaryPath = null;
let patchedSummaryPath = null;
let rerunAudits = true;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--preset' && argv[i + 1]) preset = argv[++i];
  else if (arg.startsWith('--preset=')) preset = arg.slice('--preset='.length);
  else if (arg === '--seed' && argv[i + 1]) seed = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--seed=')) seed = Number.parseInt(arg.slice('--seed='.length), 10);
  else if (arg === '--baseline-summary' && argv[i + 1]) baselineSummaryPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--baseline-summary=')) baselineSummaryPath = path.resolve(arg.slice('--baseline-summary='.length));
  else if (arg === '--patched-summary' && argv[i + 1]) patchedSummaryPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--patched-summary=')) patchedSummaryPath = path.resolve(arg.slice('--patched-summary='.length));
  else if (arg === '--no-rerun-audits') rerunAudits = false;
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const runAuditVariant = ({ overrideMode, variantReportBase }) => {
  const args = [
    '--experimental-default-type=module',
    '--loader',
    loaderPath,
    auditScriptPath,
    '--preset',
    preset,
    '--seed',
    String(seed),
    '--report-base',
    variantReportBase,
    '--instrumentation-mode',
    'full',
    '--no-repro-check',
    '--no-counterfactuals',
    `--carry-input-override=${overrideMode}`
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe']
  });
  if (result.status !== 0) {
    throw new Error(`Audit variant ${overrideMode} failed:\n${result.stderr || '(no stderr)'}`);
  }
};

const loadAuditSet = (summaryPath) => {
  const summary = readJson(summaryPath);
  const sampleProfilesPath = summary.artifacts?.sampleProfilesJsonPath;
  return {
    summary,
    profiles: sampleProfilesPath ? readJson(sampleProfilesPath) : []
  };
};

const getLatestSample = (summary) => summary?.samples?.[summary.samples.length - 1] || null;
const getLatestProfiles = (profiles) => profiles?.[profiles.length - 1] || null;

const symmetricDirectionalDelta = (baseline, patched, direction = 1) => {
  const b = Number(baseline);
  const p = Number(patched);
  if (!Number.isFinite(b) || !Number.isFinite(p)) return null;
  const denom = Math.abs(b) + Math.abs(p) + 1e-6;
  return direction * ((2 * (p - b)) / denom);
};

const profileBandMean = (latitudesDeg, values, lat0, lat1) => {
  if (!Array.isArray(latitudesDeg) || !Array.isArray(values) || latitudesDeg.length !== values.length) return null;
  let total = 0;
  let weightTotal = 0;
  for (let i = 0; i < latitudesDeg.length; i += 1) {
    const lat = latitudesDeg[i];
    if (lat < lat0 || lat > lat1) continue;
    const weight = Math.max(0.05, Math.cos((lat * Math.PI) / 180));
    total += (values[i] || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? total / weightTotal : null;
};

const buildProfileBandDeltas = ({ baselineProfiles, patchedProfiles, seriesKey }) => {
  const latitudesDeg = baselineProfiles?.profiles?.latitudesDeg || patchedProfiles?.profiles?.latitudesDeg || [];
  const baselineSeries = baselineProfiles?.profiles?.series?.[seriesKey] || [];
  const patchedSeries = patchedProfiles?.profiles?.series?.[seriesKey] || [];
  return BAND_DEFS.map((band) => {
    const baseline = profileBandMean(latitudesDeg, baselineSeries, band.lat0, band.lat1);
    const patched = profileBandMean(latitudesDeg, patchedSeries, band.lat0, band.lat1);
    return {
      band: band.key,
      label: band.label,
      baseline: round(baseline, 5),
      patched: round(patched, 5),
      delta: round((patched ?? 0) - (baseline ?? 0), 5)
    };
  });
};

const buildTopLatitudeDeltas = ({ baselineProfiles, patchedProfiles, seriesKey, count = 6 }) => {
  const latitudesDeg = baselineProfiles?.profiles?.latitudesDeg || patchedProfiles?.profiles?.latitudesDeg || [];
  const baselineSeries = baselineProfiles?.profiles?.series?.[seriesKey] || [];
  const patchedSeries = patchedProfiles?.profiles?.series?.[seriesKey] || [];
  return latitudesDeg
    .map((lat, index) => ({
      latDeg: lat,
      baseline: round(baselineSeries[index] || 0, 5),
      patched: round(patchedSeries[index] || 0, 5),
      delta: round((patchedSeries[index] || 0) - (baselineSeries[index] || 0), 5)
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, count);
};

const buildFamilyRanking = ({ baselineMetrics, patchedMetrics }) => FAMILY_DEFS.map((family) => {
  const contributions = family.metrics.map((metric) => {
    const baseline = baselineMetrics?.[metric.key];
    const patched = patchedMetrics?.[metric.key];
    const directionalDelta = symmetricDirectionalDelta(baseline, patched, metric.direction);
    return {
      key: metric.key,
      baseline: round(baseline, 5),
      patched: round(patched, 5),
      rawDelta: round((patched ?? 0) - (baseline ?? 0), 5),
      directionalDelta: round(directionalDelta, 5),
      weight: metric.weight
    };
  }).filter((metric) => Number.isFinite(metric.directionalDelta));
  const totalWeight = contributions.reduce((sum, metric) => sum + metric.weight, 0);
  const score = totalWeight > 0
    ? contributions.reduce((sum, metric) => sum + metric.directionalDelta * metric.weight, 0) / totalWeight
    : null;
  return {
    key: family.key,
    label: family.label,
    score: round(score, 5),
    contributions
  };
}).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));

const buildClimateGuardrailDeltas = ({ baselineMetrics, patchedMetrics }) => {
  const keys = [
    'itczWidthDeg',
    'subtropicalDryNorthRatio',
    'subtropicalDrySouthRatio',
    'subtropicalSubsidenceNorthMean',
    'subtropicalSubsidenceSouthMean',
    'midlatitudeWesterliesNorthU10Ms',
    'midlatitudeWesterliesSouthU10Ms',
    'globalCloudMeanFrac',
    'globalPrecipMeanMmHr'
  ];
  return Object.fromEntries(keys.map((key) => [
    key,
    {
      baseline: round(baselineMetrics?.[key], 5),
      patched: round(patchedMetrics?.[key], 5),
      delta: round((patchedMetrics?.[key] ?? 0) - (baselineMetrics?.[key] ?? 0), 5)
    }
  ]));
};

const buildCarryOverrideSummary = (patchedMetrics = {}) => ({
  northDryBeltCarryInputOverrideAccumHitMean: round(patchedMetrics.northDryBeltCarryInputOverrideAccumHitMean, 5),
  southDryBeltCarryInputOverrideAccumHitMean: round(patchedMetrics.southDryBeltCarryInputOverrideAccumHitMean, 5),
  northTransitionCarryInputOverrideAccumHitMean: round(patchedMetrics.northTransitionCarryInputOverrideAccumHitMean, 5),
  southTransitionCarryInputOverrideAccumHitMean: round(patchedMetrics.southTransitionCarryInputOverrideAccumHitMean, 5),
  northDryBeltCarryInputOverrideAccumRemovedMeanKgM2: round(patchedMetrics.northDryBeltCarryInputOverrideAccumRemovedMeanKgM2, 5),
  southDryBeltCarryInputOverrideAccumRemovedMeanKgM2: round(patchedMetrics.southDryBeltCarryInputOverrideAccumRemovedMeanKgM2, 5),
  northTransitionCarryInputOverrideAccumRemovedMeanKgM2: round(patchedMetrics.northTransitionCarryInputOverrideAccumRemovedMeanKgM2, 5),
  southTransitionCarryInputOverrideAccumRemovedMeanKgM2: round(patchedMetrics.southTransitionCarryInputOverrideAccumRemovedMeanKgM2, 5)
});

const buildConclusion = (ranking = []) => {
  const [top, second] = ranking;
  if (!top) return 'No dominant compensation family could be ranked.';
  if (second && Number.isFinite(top.score) && Number.isFinite(second.score) && Math.abs(top.score - second.score) <= 0.08) {
    return `Compensation looks coupled. ${top.label} and ${second.label} are effectively tied and should be treated as the joint rebound path.`;
  }
  return `${top.label} is the dominant compensation family on the apples-to-apples 30-day comparison.`;
};

const renderMarkdown = (report) => {
  const lines = [
    '# Phase 1E Proof-vs-Climate Delta Attribution',
    '',
    '## Scope',
    '',
    `- Baseline run: patch override \`off\``,
    `- Patched run: patch override \`on\``,
    `- Preset: \`${report.config.preset}\``,
    `- Seed: \`${report.config.seed}\``,
    `- Target day: \`${report.targetDay}\``,
    '',
    '## Verdict',
    '',
    `- Dominant compensation family: \`${report.dominantCompensationFamily?.key || 'unknown'}\``,
    `- Read: ${report.conclusion}`,
    '',
    '## Climate Guardrail Deltas',
    ''
  ];
  for (const [key, value] of Object.entries(report.climateGuardrailDeltas || {})) {
    lines.push(`- \`${key}\`: \`${value.baseline} -> ${value.patched}\``);
  }
  lines.push('', '## Compensation Ranking', '');
  for (const family of report.compensationFamilyRanking || []) {
    lines.push(`- \`${family.key}\` score \`${family.score}\``);
    for (const metric of family.contributions.slice(0, 3)) {
      lines.push(`  - \`${metric.key}\`: \`${metric.baseline} -> ${metric.patched}\` (dir-score \`${metric.directionalDelta}\`)`);
    }
  }
  lines.push('', '## Latitude-Band Response', '');
  for (const [seriesKey, bandRows] of Object.entries(report.bandDeltaAttribution || {})) {
    lines.push(`- \`${seriesKey}\``);
    for (const row of bandRows) {
      lines.push(`  - ${row.label}: \`${row.baseline} -> ${row.patched}\` (delta \`${row.delta}\`)`);
    }
  }
  lines.push('', '## Carry-Override Footprint', '');
  for (const [key, value] of Object.entries(report.patchedCarryOverrideFootprint || {})) {
    lines.push(`- \`${key} = ${value}\``);
  }
  return `${lines.join('\n')}\n`;
};

export const buildPhase1EDeltaAttributionReport = ({
  baselineSummary,
  patchedSummary,
  baselineProfiles,
  patchedProfiles,
  baselineSummaryPath,
  patchedSummaryPath,
  reportBasePath = null
}) => {
  const baselineSample = getLatestSample(baselineSummary);
  const patchedSample = getLatestSample(patchedSummary);
  const baselineProfileSample = getLatestProfiles(baselineProfiles);
  const patchedProfileSample = getLatestProfiles(patchedProfiles);
  const baselineMetrics = baselineSample?.metrics || {};
  const patchedMetrics = patchedSample?.metrics || {};
  const compensationFamilyRanking = buildFamilyRanking({ baselineMetrics, patchedMetrics });
  const dominantCompensationFamily = compensationFamilyRanking[0] || null;
  return {
    schema: 'satellite-wars.phase1e-proof-vs-climate-delta-attribution.v1',
    generatedAt: new Date().toISOString(),
    config: {
      preset,
      seed,
      reportBasePath
    },
    targetDay: patchedSample?.targetDay || baselineSample?.targetDay || null,
    baseline: {
      summaryPath: baselineSummaryPath,
      gitCommit: baselineSummary?.runManifest?.gitCommit || null,
      carryInputOverrideMode: baselineSummary?.runManifest?.config?.carryInputOverrideMode || baselineSummary?.config?.carryInputOverrideMode || 'off'
    },
    patched: {
      summaryPath: patchedSummaryPath,
      gitCommit: patchedSummary?.runManifest?.gitCommit || null,
      carryInputOverrideMode: patchedSummary?.runManifest?.config?.carryInputOverrideMode || patchedSummary?.config?.carryInputOverrideMode || 'on'
    },
    climateGuardrailDeltas: buildClimateGuardrailDeltas({ baselineMetrics, patchedMetrics }),
    compensationFamilyRanking,
    dominantCompensationFamily,
    bandDeltaAttribution: {
      cloudTotalFraction: buildProfileBandDeltas({ baselineProfiles: baselineProfileSample, patchedProfiles: patchedProfileSample, seriesKey: 'cloudTotalFraction' }),
      precipRateMmHr: buildProfileBandDeltas({ baselineProfiles: baselineProfileSample, patchedProfiles: patchedProfileSample, seriesKey: 'precipRateMmHr' }),
      wind10mU: buildProfileBandDeltas({ baselineProfiles: baselineProfileSample, patchedProfiles: patchedProfileSample, seriesKey: 'wind10mU' }),
      convectiveOrganization: buildProfileBandDeltas({ baselineProfiles: baselineProfileSample, patchedProfiles: patchedProfileSample, seriesKey: 'convectiveOrganization' })
    },
    topLatitudeDeltas: {
      cloudTotalFraction: buildTopLatitudeDeltas({ baselineProfiles: baselineProfileSample, patchedProfiles: patchedProfileSample, seriesKey: 'cloudTotalFraction' }),
      precipRateMmHr: buildTopLatitudeDeltas({ baselineProfiles: baselineProfileSample, patchedProfiles: patchedProfileSample, seriesKey: 'precipRateMmHr' }),
      wind10mU: buildTopLatitudeDeltas({ baselineProfiles: baselineProfileSample, patchedProfiles: patchedProfileSample, seriesKey: 'wind10mU' })
    },
    patchedCarryOverrideFootprint: buildCarryOverrideSummary(patchedMetrics),
    conclusion: buildConclusion(compensationFamilyRanking)
  };
};

export async function main() {
  const baselineVariantBase = `${reportBase}-baseline-off`;
  const patchedVariantBase = `${reportBase}-patched-on`;
  if (rerunAudits) {
    runAuditVariant({ overrideMode: 'off', variantReportBase: baselineVariantBase });
    runAuditVariant({ overrideMode: 'on', variantReportBase: patchedVariantBase });
    baselineSummaryPath = `${baselineVariantBase}.json`;
    patchedSummaryPath = `${patchedVariantBase}.json`;
  }
  if (!baselineSummaryPath || !patchedSummaryPath) {
    throw new Error('Phase 1E requires either rerun audits or explicit --baseline-summary and --patched-summary paths.');
  }
  const baselineRun = loadAuditSet(baselineSummaryPath);
  const patchedRun = loadAuditSet(patchedSummaryPath);
  const report = buildPhase1EDeltaAttributionReport({
    baselineSummary: baselineRun.summary,
    patchedSummary: patchedRun.summary,
    baselineProfiles: baselineRun.profiles,
    patchedProfiles: patchedRun.profiles,
    baselineSummaryPath,
    patchedSummaryPath,
    reportBasePath: reportBase
  });
  const markdown = renderMarkdown(report);
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify(report));
  return report;
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  await main();
}

export const _test = {
  symmetricDirectionalDelta,
  buildProfileBandDeltas,
  buildFamilyRanking,
  buildPhase1EDeltaAttributionReport
};
