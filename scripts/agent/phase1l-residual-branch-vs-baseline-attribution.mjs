#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
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
  'reports',
  'phase1l-residual-branch-vs-baseline-attribution'
);
const DEFAULT_TRUSTED_BASELINE_SUMMARY = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1-hadley-second-pass-restore-v4.json'
);
const DEFAULT_CURRENT_REPORT_BASE = path.join(os.tmpdir(), 'satellite-wars-phase1l-current-branch');

const BAND_DEFS = [
  { key: 'equatorialCore', label: 'Equatorial core', lat0: -10, lat1: 10 },
  { key: 'northTransition', label: 'North transition', lat0: 10, lat1: 22 },
  { key: 'northDryBelt', label: 'North dry belt', lat0: 22, lat1: 35 },
  { key: 'southTransition', label: 'South transition', lat0: -22, lat1: -10 },
  { key: 'southDryBelt', label: 'South dry belt', lat0: -35, lat1: -22 }
];

const FAMILY_DEFS = [
  {
    key: 'broadened_tropical_response',
    label: 'Broadened tropical response',
    metrics: [
      { key: 'itczWidthDeg', direction: 1, weight: 1.0 },
      { key: 'northTransitionPrecipMeanMmHr', direction: 1, weight: 0.8 },
      { key: 'southTransitionPrecipMeanMmHr', direction: 1, weight: 0.6 },
      { key: 'subtropicalDryNorthRatio', direction: 1, weight: 0.8 },
      { key: 'subtropicalDrySouthRatio', direction: 1, weight: 0.6 },
      { key: 'tropicalCoreConvectiveOrganizationMeanFrac', direction: -1, weight: 0.35 }
    ]
  },
  {
    key: 'marine_maintenance_residual',
    label: 'Marine maintenance residual',
    metrics: [
      { key: 'northDryBeltPrecipMeanMmHr', direction: 1, weight: 0.9 },
      { key: 'northDryBeltCloudMeanFrac', direction: 1, weight: 0.7 },
      { key: 'northDryBeltLowerRhMeanFrac', direction: 1, weight: 0.8 },
      { key: 'northDryBeltTcwMeanKgM2', direction: 1, weight: 0.7 },
      { key: 'northDryBeltMoistureConvergenceMeanS_1', direction: 1, weight: 0.4 }
    ]
  },
  {
    key: 'circulation_side_rebound',
    label: 'Circulation-side rebound',
    metrics: [
      { key: 'midlatitudeWesterliesNorthU10Ms', direction: -1, weight: 1.0 },
      { key: 'midlatitudeWesterliesSouthU10Ms', direction: -1, weight: 0.5 },
      { key: 'northDryBeltSubsidenceDryingMeanFrac', direction: -1, weight: 0.5 },
      { key: 'southDryBeltSubsidenceDryingMeanFrac', direction: -1, weight: 0.7 }
    ]
  },
  {
    key: 'upper_cloud_clouddeck_residual',
    label: 'Upper-cloud / cloud-deck residual',
    metrics: [
      { key: 'northDryBeltCloudMeanFrac', direction: 1, weight: 0.7 },
      { key: 'northDryBeltAnvilPersistenceMeanFrac', direction: 1, weight: 0.9 },
      { key: 'northDryBeltTcwMeanKgM2', direction: 1, weight: 0.5 }
    ]
  }
];

const NEXT_PATCH_LANE_BY_FAMILY = {
  broadened_tropical_response: {
    key: 'phase1m-tropical-response-containment',
    label: 'Phase 1M: Tropical-response containment',
    focus: 'Target [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) and [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) to tighten the transition-band / ITCZ response rather than adding more local dry-belt suppression.'
  },
  marine_maintenance_residual: {
    key: 'phase1m-marine-maintenance-refinement',
    label: 'Phase 1M: Marine maintenance refinement',
    focus: 'Stay in [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) and refine the live gate physics around the residual marine condensation path.'
  },
  circulation_side_rebound: {
    key: 'phase1m-circulation-rebound-lane',
    label: 'Phase 1M: Circulation rebound lane',
    focus: 'Target circulation partition and wind response in [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) and [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js).'
  },
  upper_cloud_clouddeck_residual: {
    key: 'phase1m-upper-cloud-residual',
    label: 'Phase 1M: Upper-cloud residual lane',
    focus: 'Revisit residual cloud-deck persistence in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) with the Phase 1K maintenance suppression held fixed.'
  }
};

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

let reportBase = DEFAULT_REPORT_BASE;
let trustedBaselineSummaryPath = DEFAULT_TRUSTED_BASELINE_SUMMARY;
let currentSummaryPath = null;
let currentReportBase = DEFAULT_CURRENT_REPORT_BASE;
let preset = 'quick';
let seed = 12345;
let rerunCurrent = true;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--trusted-baseline-summary' && argv[i + 1]) trustedBaselineSummaryPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--trusted-baseline-summary=')) trustedBaselineSummaryPath = path.resolve(arg.slice('--trusted-baseline-summary='.length));
  else if (arg === '--current-summary' && argv[i + 1]) currentSummaryPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--current-summary=')) currentSummaryPath = path.resolve(arg.slice('--current-summary='.length));
  else if (arg === '--current-report-base' && argv[i + 1]) currentReportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--current-report-base=')) currentReportBase = path.resolve(arg.slice('--current-report-base='.length));
  else if (arg === '--preset' && argv[i + 1]) preset = argv[++i];
  else if (arg.startsWith('--preset=')) preset = arg.slice('--preset='.length);
  else if (arg === '--seed' && argv[i + 1]) seed = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--seed=')) seed = Number.parseInt(arg.slice('--seed='.length), 10);
  else if (arg === '--no-rerun-current') rerunCurrent = false;
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const runCurrentAudit = ({ variantReportBase }) => {
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
    '--no-counterfactuals'
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe']
  });
  if (result.status !== 0) {
    throw new Error(`Phase 1L current-branch audit failed:\n${result.stderr || '(no stderr)'}`);
  }
};

const loadAuditSet = (summaryPath) => {
  const summary = readJson(summaryPath);
  const sampleProfilesPath = summary.artifacts?.sampleProfilesJsonPath;
  return {
    summary,
    profiles: sampleProfilesPath && fs.existsSync(sampleProfilesPath) ? readJson(sampleProfilesPath) : []
  };
};

const getLatestSample = (summary) => summary?.samples?.[summary.samples.length - 1] || null;
const getLatestProfiles = (profiles) => profiles?.[profiles.length - 1] || null;

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

const symmetricDirectionalDelta = (baseline, current, direction = 1) => {
  const b = Number(baseline);
  const c = Number(current);
  if (!Number.isFinite(b) || !Number.isFinite(c)) return null;
  const denom = Math.abs(b) + Math.abs(c) + 1e-6;
  return direction * ((2 * (c - b)) / denom);
};

const buildComparableProfileMetrics = (profileSample) => {
  const latitudesDeg = profileSample?.profiles?.latitudesDeg || [];
  const series = profileSample?.profiles?.series || {};
  const meanForBand = (seriesKey, lat0, lat1) => profileBandMean(latitudesDeg, series[seriesKey] || [], lat0, lat1);
  return {
    equatorialCorePrecipMeanMmHr: meanForBand('precipRateMmHr', -10, 10),
    northTransitionPrecipMeanMmHr: meanForBand('precipRateMmHr', 10, 22),
    southTransitionPrecipMeanMmHr: meanForBand('precipRateMmHr', -22, -10),
    northDryBeltPrecipMeanMmHr: meanForBand('precipRateMmHr', 22, 35),
    southDryBeltPrecipMeanMmHr: meanForBand('precipRateMmHr', -35, -22),
    northDryBeltCloudMeanFrac: meanForBand('cloudTotalFraction', 22, 35),
    southDryBeltCloudMeanFrac: meanForBand('cloudTotalFraction', -35, -22),
    northDryBeltLowerRhMeanFrac: meanForBand('lowerTroposphericRhFrac', 22, 35),
    southDryBeltLowerRhMeanFrac: meanForBand('lowerTroposphericRhFrac', -35, -22),
    northDryBeltTcwMeanKgM2: meanForBand('totalColumnWaterKgM2', 22, 35),
    northDryBeltMoistureConvergenceMeanS_1: meanForBand('lowerLevelMoistureConvergenceS_1', 22, 35),
    northDryBeltSubsidenceDryingMeanFrac: meanForBand('subtropicalSubsidenceDryingFrac', 22, 35),
    southDryBeltSubsidenceDryingMeanFrac: meanForBand('subtropicalSubsidenceDryingFrac', -35, -22),
    tropicalCoreConvectiveOrganizationMeanFrac: meanForBand('convectiveOrganization', -10, 10),
    northTransitionConvectiveOrganizationMeanFrac: meanForBand('convectiveOrganization', 10, 22),
    southTransitionConvectiveOrganizationMeanFrac: meanForBand('convectiveOrganization', -22, -10),
    tropicalCoreConvectiveMassFluxMeanKgM2S: meanForBand('convectiveMassFluxKgM2S', -10, 10),
    northDryBeltAnvilPersistenceMeanFrac: meanForBand('anvilPersistenceFrac', 22, 35)
  };
};

const buildCombinedMetrics = ({ summary, profiles }) => {
  const latestSample = getLatestSample(summary);
  const latestProfiles = getLatestProfiles(profiles);
  return {
    ...(latestSample?.metrics || {}),
    ...buildComparableProfileMetrics(latestProfiles)
  };
};

const buildFamilyRanking = ({ baselineMetrics, currentMetrics }) => FAMILY_DEFS.map((family) => {
  const contributions = family.metrics.map((metric) => {
    const baseline = baselineMetrics?.[metric.key];
    const current = currentMetrics?.[metric.key];
    const directionalDelta = symmetricDirectionalDelta(baseline, current, metric.direction);
    return {
      key: metric.key,
      baseline: round(baseline, 5),
      current: round(current, 5),
      rawDelta: round((current ?? 0) - (baseline ?? 0), 5),
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

const buildClimateGuardrailDeltas = ({ baselineMetrics, currentMetrics }) => {
  const keys = [
    'itczWidthDeg',
    'subtropicalDryNorthRatio',
    'subtropicalDrySouthRatio',
    'subtropicalSubsidenceNorthMean',
    'subtropicalSubsidenceSouthMean',
    'midlatitudeWesterliesNorthU10Ms',
    'midlatitudeWesterliesSouthU10Ms',
    'tropicalConvectiveOrganization',
    'tropicalConvectiveMassFluxKgM2S',
    'equatorialPrecipMeanMmHr'
  ];
  return Object.fromEntries(keys.map((key) => [
    key,
    {
      baseline: round(baselineMetrics?.[key], 5),
      current: round(currentMetrics?.[key], 5),
      delta: round((currentMetrics?.[key] ?? 0) - (baselineMetrics?.[key] ?? 0), 5)
    }
  ]));
};

const buildBandDeltaAttribution = ({ baselineProfiles, currentProfiles, seriesKey }) => {
  const latitudesDeg = baselineProfiles?.profiles?.latitudesDeg || currentProfiles?.profiles?.latitudesDeg || [];
  const baselineSeries = baselineProfiles?.profiles?.series?.[seriesKey] || [];
  const currentSeries = currentProfiles?.profiles?.series?.[seriesKey] || [];
  return BAND_DEFS.map((band) => {
    const baseline = profileBandMean(latitudesDeg, baselineSeries, band.lat0, band.lat1);
    const current = profileBandMean(latitudesDeg, currentSeries, band.lat0, band.lat1);
    return {
      band: band.key,
      label: band.label,
      baseline: round(baseline, 5),
      current: round(current, 5),
      delta: round((current ?? 0) - (baseline ?? 0), 5)
    };
  });
};

const buildCurrentCorroboration = (currentMetrics = {}) => ({
  northDryBeltOceanLargeScaleCondensationMeanKgM2: round(currentMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2, 5),
  northDryBeltOceanMarineCondensationMeanKgM2: round(currentMetrics.northDryBeltOceanMarineCondensationMeanKgM2, 5),
  northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2: round(currentMetrics.northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2, 5),
  northDryBeltOceanSoftLiveGateHitMean: round(currentMetrics.northDryBeltOceanSoftLiveGateHitMean, 5),
  northDryBeltOceanSoftLiveGateSelectorSupportMeanFrac: round(currentMetrics.northDryBeltOceanSoftLiveGateSelectorSupportMeanFrac, 5),
  northDryBeltImportedAnvilPersistenceMeanKgM2: round(currentMetrics.northDryBeltImportedAnvilPersistenceMeanKgM2, 5),
  northDryBeltWeakErosionCloudSurvivalMeanKgM2: round(currentMetrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2, 5),
  northDryBeltCarriedOverUpperCloudMeanKgM2: round(currentMetrics.northDryBeltCarriedOverUpperCloudMeanKgM2, 5),
  northDryBeltUpperCloudPathMeanKgM2: round(currentMetrics.northDryBeltUpperCloudPathMeanKgM2, 5)
});

const chooseNextPatchLane = (ranking = []) => {
  const top = ranking[0];
  return top ? (NEXT_PATCH_LANE_BY_FAMILY[top.key] || null) : null;
};

const buildConclusion = ({ ranking = [], nextPatchLane = null }) => {
  const [top, second] = ranking;
  if (!top) return 'No dominant residual family could be ranked.';
  if (second && Number.isFinite(top.score) && Number.isFinite(second.score) && Math.abs(top.score - second.score) <= 0.08) {
    return `Residual mismatch is coupled between ${top.label} and ${second.label}. The next patch lane should start with ${nextPatchLane?.label || 'the leading lane'} but keep both families in view.`;
  }
  return `${top.label} is the dominant residual blocker against the trusted baseline. The next patch lane should be ${nextPatchLane?.label || 'chosen from that family'}.`;
};

const renderMarkdown = (report) => {
  const lines = [
    '# Phase 1L Residual Branch-Versus-Baseline Attribution',
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${report.baseline.summaryPath}\``,
    `- Current branch compare: \`${report.current.summaryPath}\``,
    `- Preset: \`${report.config.preset}\``,
    `- Seed: \`${report.config.seed}\``,
    `- Target day: \`${report.targetDay}\``,
    '',
    '## Verdict',
    '',
    `- Dominant residual family: \`${report.dominantResidualFamily?.key || 'unknown'}\``,
    `- Read: ${report.conclusion}`,
    `- Recommended next patch lane: ${report.nextPatchLane?.focus || 'No next lane selected.'}`,
    '',
    '## Climate Guardrail Deltas',
    ''
  ];
  for (const [key, value] of Object.entries(report.climateGuardrailDeltas || {})) {
    lines.push(`- \`${key}\`: \`${value.baseline} -> ${value.current}\` (delta \`${value.delta}\`)`);
  }
  lines.push('', '## Residual Family Ranking', '');
  for (const family of report.residualFamilyRanking || []) {
    lines.push(`- \`${family.key}\` score \`${family.score}\``);
    for (const metric of family.contributions.slice(0, 4)) {
      lines.push(`  - \`${metric.key}\`: \`${metric.baseline} -> ${metric.current}\` (dir-score \`${metric.directionalDelta}\`)`);
    }
  }
  lines.push('', '## Shared Profile-Band Deltas', '');
  for (const [seriesKey, rows] of Object.entries(report.bandDeltaAttribution || {})) {
    lines.push(`- \`${seriesKey}\``);
    for (const row of rows) {
      lines.push(`  - ${row.label}: \`${row.baseline} -> ${row.current}\` (delta \`${row.delta}\`)`);
    }
  }
  lines.push('', '## Current-Branch Corroborating Diagnostics', '');
  for (const [key, value] of Object.entries(report.currentCorroboration || {})) {
    lines.push(`- \`${key} = ${value}\``);
  }
  return `${lines.join('\n')}\n`;
};

export const buildPhase1LResidualReport = ({
  trustedBaselineSummary,
  currentSummary,
  trustedBaselineProfiles,
  currentProfiles,
  trustedBaselineSummaryPath,
  currentSummaryPath,
  reportBasePath = null
}) => {
  const baselineSample = getLatestSample(trustedBaselineSummary);
  const currentSample = getLatestSample(currentSummary);
  const baselineProfileSample = getLatestProfiles(trustedBaselineProfiles);
  const currentProfileSample = getLatestProfiles(currentProfiles);
  const baselineMetrics = buildCombinedMetrics({ summary: trustedBaselineSummary, profiles: trustedBaselineProfiles });
  const currentMetrics = buildCombinedMetrics({ summary: currentSummary, profiles: currentProfiles });
  const residualFamilyRanking = buildFamilyRanking({ baselineMetrics, currentMetrics });
  const dominantResidualFamily = residualFamilyRanking[0] || null;
  const nextPatchLane = chooseNextPatchLane(residualFamilyRanking);
  const report = {
    schema: 'satellite-wars.phase1l-residual-branch-vs-baseline-attribution.v1',
    generatedAt: new Date().toISOString(),
    config: {
      preset,
      seed,
      reportBasePath
    },
    targetDay: currentSample?.targetDay || baselineSample?.targetDay || null,
    baseline: {
      summaryPath: trustedBaselineSummaryPath,
      gitCommit: trustedBaselineSummary?.runManifest?.gitCommit || null
    },
    current: {
      summaryPath: currentSummaryPath,
      gitCommit: currentSummary?.runManifest?.gitCommit || null,
      softLiveGatePatchMode: currentSummary?.runManifest?.config?.softLiveGatePatchMode || currentSummary?.config?.softLiveGatePatchMode || 'default'
    },
    climateGuardrailDeltas: buildClimateGuardrailDeltas({ baselineMetrics, currentMetrics }),
    residualFamilyRanking,
    dominantResidualFamily,
    nextPatchLane,
    bandDeltaAttribution: {
      precipRateMmHr: buildBandDeltaAttribution({ baselineProfiles: baselineProfileSample, currentProfiles: currentProfileSample, seriesKey: 'precipRateMmHr' }),
      cloudTotalFraction: buildBandDeltaAttribution({ baselineProfiles: baselineProfileSample, currentProfiles: currentProfileSample, seriesKey: 'cloudTotalFraction' }),
      convectiveOrganization: buildBandDeltaAttribution({ baselineProfiles: baselineProfileSample, currentProfiles: currentProfileSample, seriesKey: 'convectiveOrganization' }),
      lowerTroposphericRhFrac: buildBandDeltaAttribution({ baselineProfiles: baselineProfileSample, currentProfiles: currentProfileSample, seriesKey: 'lowerTroposphericRhFrac' }),
      wind10mU: buildBandDeltaAttribution({ baselineProfiles: baselineProfileSample, currentProfiles: currentProfileSample, seriesKey: 'wind10mU' })
    },
    currentCorroboration: buildCurrentCorroboration(currentMetrics),
    conclusion: buildConclusion({ ranking: residualFamilyRanking, nextPatchLane })
  };
  return report;
};

export async function main() {
  if (rerunCurrent) {
    runCurrentAudit({ variantReportBase: currentReportBase });
    currentSummaryPath = `${currentReportBase}.json`;
  }
  if (!trustedBaselineSummaryPath || !currentSummaryPath) {
    throw new Error('Phase 1L requires a trusted baseline summary and a current branch summary.');
  }
  const baselineRun = loadAuditSet(trustedBaselineSummaryPath);
  const currentRun = loadAuditSet(currentSummaryPath);
  const report = buildPhase1LResidualReport({
    trustedBaselineSummary: baselineRun.summary,
    currentSummary: currentRun.summary,
    trustedBaselineProfiles: baselineRun.profiles,
    currentProfiles: currentRun.profiles,
    trustedBaselineSummaryPath,
    currentSummaryPath,
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
  buildComparableProfileMetrics,
  buildFamilyRanking,
  chooseNextPatchLane,
  buildPhase1LResidualReport
};
