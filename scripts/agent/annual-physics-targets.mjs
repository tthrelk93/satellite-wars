#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readAuditJsonArtifact } from './audit-artifact-metadata.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultReportBase = path.join(repoRoot, 'weather-validation', 'output', 'annual-planetary-realism');

const argv = process.argv.slice(2);
let reportBase = defaultReportBase;
let outPath = null;
let mdOutPath = null;
let topN = 5;

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === '--report-base' && argv[index + 1]) reportBase = path.resolve(argv[++index]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--out' && argv[index + 1]) outPath = path.resolve(argv[++index]);
  else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
  else if (arg === '--md-out' && argv[index + 1]) mdOutPath = path.resolve(argv[++index]);
  else if (arg.startsWith('--md-out=')) mdOutPath = path.resolve(arg.slice('--md-out='.length));
  else if (arg === '--top' && argv[index + 1]) topN = Number.parseInt(argv[++index], 10);
  else if (arg.startsWith('--top=')) topN = Number.parseInt(arg.slice('--top='.length), 10);
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const round = (value, digits = 3) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const readJson = readAuditJsonArtifact;

const monthLabel = (monthIndex) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex] || `M${monthIndex + 1}`;

const metricRange = (months, metricKey) => {
  const values = months
    .map((month) => month?.metrics?.[metricKey])
    .filter((value) => Number.isFinite(value));
  if (!values.length) return { min: null, max: null, span: null };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    span: Math.max(...values) - Math.min(...values)
  };
};

const metricExtremaMonth = (months, metricKey, mode = 'max') => {
  let best = null;
  for (const month of months) {
    const value = month?.metrics?.[metricKey];
    if (!Number.isFinite(value)) continue;
    if (!best) {
      best = { monthIndex: month.monthIndex, month: month.month, value };
      continue;
    }
    if ((mode === 'max' && value > best.value) || (mode === 'min' && value < best.value)) {
      best = { monthIndex: month.monthIndex, month: month.month, value };
    }
  }
  return best;
};

const monthlyTrace = (months, metricKey, digits = 3) => months
  .filter((month) => Number.isFinite(month?.metrics?.[metricKey]))
  .map((month) => ({
    monthIndex: month.monthIndex,
    month: month.month || monthLabel(month.monthIndex),
    value: round(month.metrics[metricKey], digits)
  }));

const latestMetric = (summary, metricKey) => summary?.horizons?.[summary.horizons.length - 1]?.latest?.metrics?.[metricKey];

const monthlyProfileSummary = (months, seriesKey, selector) => {
  const samples = [];
  for (const month of months) {
    const profile = month?.profiles;
    if (!profile?.latitudesDeg?.length || !Array.isArray(profile?.series?.[seriesKey])) continue;
    const value = selector(profile.latitudesDeg, profile.series[seriesKey]);
    if (Number.isFinite(value)) {
      samples.push({
        monthIndex: month.monthIndex,
        month: month.month || monthLabel(month.monthIndex),
        value
      });
    }
  }
  return samples;
};

const bandMeanFromProfile = (latitudesDeg, values, lat0, lat1) => {
  let total = 0;
  let count = 0;
  for (let index = 0; index < latitudesDeg.length; index += 1) {
    const lat = latitudesDeg[index];
    if (lat < lat0 || lat > lat1) continue;
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    total += value;
    count += 1;
  }
  return count > 0 ? total / count : null;
};

const buildCampaignDefinitions = () => ([
  {
    code: 'hadley_moisture_partitioning',
    title: 'Tighten Hadley-cell moisture export and subtropical drying',
    focusArea: 'ITCZ placement, convective heating organization, subtropical subsidence drying, and moisture export',
    files: [
      'src/weather/v2/vertical5.js',
      'src/weather/v2/microphysics5.js',
      'src/weather/v2/core5.js',
      'src/weather/v2/nudging5.js'
    ],
    relatedGapCodes: [
      'itcz_out_of_tropical_band',
      'itcz_width_unrealistic',
      'north_subtropical_dry_belt_too_wet',
      'south_subtropical_dry_belt_too_wet',
      'north_subtropical_lower_troposphere_too_humid',
      'south_subtropical_lower_troposphere_too_humid',
      'north_subtropical_subsidence_too_weak',
      'south_subtropical_subsidence_too_weak'
    ],
    derive(summary, gaps, months) {
      const related = gaps.filter((gap) => this.relatedGapCodes.includes(gap.code));
      const severity = clamp01(related.reduce((sum, gap) => sum + (gap.severity || 0), 0) / 2.4);
      const dryNorth = latestMetric(summary, 'subtropicalDryNorthRatio');
      const drySouth = latestMetric(summary, 'subtropicalDrySouthRatio');
      const itczWidth = latestMetric(summary, 'itczWidthDeg');
      const subNorth = latestMetric(summary, 'subtropicalSubsidenceNorthMean');
      const subSouth = latestMetric(summary, 'subtropicalSubsidenceSouthMean');
      return {
        score: severity,
        why: [
          `Latest dry-belt ratios are ${round(dryNorth)} north and ${round(drySouth)} south against a target below 0.8.`,
          `ITCZ width is ${round(itczWidth)} deg and subtropical subsidence drying is ${round(subNorth)} / ${round(subSouth)} north/south.`,
          'This is the highest-leverage campaign for fixing the wet subtropics, weak descending branches, and misplaced tropical rain belts together.'
        ],
        evidence: {
          latest: {
            itczWidthDeg: round(itczWidth),
            subtropicalDryNorthRatio: round(dryNorth),
            subtropicalDrySouthRatio: round(drySouth),
            subtropicalSubsidenceNorthMean: round(subNorth),
            subtropicalSubsidenceSouthMean: round(subSouth)
          },
          monthly: {
            dryNorth: monthlyTrace(months, 'subtropicalDryNorthRatio'),
            drySouth: monthlyTrace(months, 'subtropicalDrySouthRatio'),
            itczWidth: monthlyTrace(months, 'itczWidthDeg'),
            subtropicalSubsidenceNorth: monthlyTrace(months, 'subtropicalSubsidenceNorthMean'),
            subtropicalSubsidenceSouth: monthlyTrace(months, 'subtropicalSubsidenceSouthMean')
          }
        },
        recommendedActions: [
          'Sharpen organized tropical ascent while increasing compensating subtropical drying instead of retuning precipitation thresholds in isolation.',
          'Target latitude-aware detrainment/rainout so equatorial convection exports moisture upward while the 15-35 deg bands dry out structurally.',
          'Use nudging only as a guardrail once the broad moisture partition improves.'
        ]
      };
    }
  },
  {
    code: 'organized_tropical_convection',
    title: 'Strengthen organized tropical convection and upper-level outflow',
    focusArea: 'convective potential, organization, mass flux, detrainment, and anvil persistence',
    files: [
      'src/weather/v2/vertical5.js',
      'src/weather/v2/microphysics5.js'
    ],
    relatedGapCodes: [],
    derive(summary, gaps, months) {
      const org = Number(latestMetric(summary, 'tropicalConvectiveOrganization') || 0);
      const potential = Number(latestMetric(summary, 'tropicalConvectivePotential') || 0);
      const flux = Number(latestMetric(summary, 'tropicalConvectiveMassFluxKgM2S') || 0);
      const detrain = Number(latestMetric(summary, 'upperDetrainmentTropicalKgM2') || 0);
      const anvil = Number(latestMetric(summary, 'tropicalAnvilPersistenceFrac') || 0);
      const score = clamp01(
        Math.max(
          (0.42 - org) / 0.22,
          (0.45 - potential) / 0.25,
          (0.0012 - flux) / 0.0012,
          (0.004 - detrain) / 0.004,
          (0.08 - anvil) / 0.08
        )
      );
      const detrainTrace = monthlyTrace(months, 'upperDetrainmentTropicalKgM2', 5);
      const anvilTrace = monthlyTrace(months, 'tropicalAnvilPersistenceFrac');
      return {
        score,
        why: [
          `Latest tropical organization/potential/mass flux are ${round(org)}, ${round(potential)}, and ${round(flux, 5)}.`,
          `Upper detrainment is ${round(detrain, 5)} kg/m² and anvil persistence is ${round(anvil)}.`,
          'If organized convection is too weak or too shallow, the model cannot sustain a realistic ITCZ or export moisture out of the deep tropics.'
        ],
        evidence: {
          latest: {
            tropicalConvectivePotential: round(potential),
            tropicalConvectiveOrganization: round(org),
            tropicalConvectiveMassFluxKgM2S: round(flux, 5),
            upperDetrainmentTropicalKgM2: round(detrain, 5),
            tropicalAnvilPersistenceFrac: round(anvil)
          },
          monthly: {
            convectivePotential: monthlyTrace(months, 'tropicalConvectivePotential'),
            convectiveOrganization: monthlyTrace(months, 'tropicalConvectiveOrganization'),
            convectiveMassFluxKgM2S: monthlyTrace(months, 'tropicalConvectiveMassFluxKgM2S', 5),
            upperDetrainmentTropicalKgM2: detrainTrace,
            tropicalAnvilPersistenceFrac: anvilTrace
          }
        },
        recommendedActions: [
          'Increase persistence and vertical reach of organized convection before increasing total precipitation efficiency.',
          'Make detrainment height and anvil persistence respond more strongly to sustained organized mass flux.',
          'Keep weak marginal subtropical convection suppressed while strengthening the true equatorial overturning core.'
        ]
      };
    }
  },
  {
    code: 'surface_circulation_and_jets',
    title: 'Recover trade winds and midlatitude jet structure',
    focusArea: 'surface momentum restore, Hadley/Ferrel circulation shape, and jet placement',
    files: [
      'src/weather/v2/core5.js',
      'src/weather/v2/vertical5.js',
      'src/weather/v2/nudging5.js'
    ],
    relatedGapCodes: [
      'trade_winds_missing_north',
      'trade_winds_missing_south',
      'westerlies_missing_north',
      'westerlies_missing_south'
    ],
    derive(summary, gaps, months) {
      const related = gaps.filter((gap) => this.relatedGapCodes.includes(gap.code));
      const severity = clamp01(related.reduce((sum, gap) => sum + (gap.severity || 0), 0) / 1.2);
      const northTrades = latestMetric(summary, 'tropicalTradesNorthU10Ms');
      const southTrades = latestMetric(summary, 'tropicalTradesSouthU10Ms');
      const northWest = latestMetric(summary, 'midlatitudeWesterliesNorthU10Ms');
      const southWest = latestMetric(summary, 'midlatitudeWesterliesSouthU10Ms');
      return {
        score: severity,
        why: [
          `Latest trade winds are ${round(northTrades)} / ${round(southTrades)} m/s north/south and westerlies are ${round(northWest)} / ${round(southWest)} m/s.`,
          'Large-scale circulation errors will contaminate every downstream realism target, including dry belts, storm tracks, and cyclone-support environments.'
        ],
        evidence: {
          latest: {
            tropicalTradesNorthU10Ms: round(northTrades),
            tropicalTradesSouthU10Ms: round(southTrades),
            midlatitudeWesterliesNorthU10Ms: round(northWest),
            midlatitudeWesterliesSouthU10Ms: round(southWest)
          },
          monthly: {
            tropicalTradesNorthU10Ms: monthlyTrace(months, 'tropicalTradesNorthU10Ms'),
            tropicalTradesSouthU10Ms: monthlyTrace(months, 'tropicalTradesSouthU10Ms'),
            midlatitudeWesterliesNorthU10Ms: monthlyTrace(months, 'midlatitudeWesterliesNorthU10Ms'),
            midlatitudeWesterliesSouthU10Ms: monthlyTrace(months, 'midlatitudeWesterliesSouthU10Ms')
          }
        },
        recommendedActions: [
          'Tune circulation and overturning structure together with moisture partitioning, not as a separate wind-only pass.',
          'Reduce any nudging pattern that artificially flattens trade-wind asymmetry or suppresses jet sharpening.',
          'Recheck trade/westerly zonal means after each broad hydrology change before returning to storm specifics.'
        ]
      };
    }
  },
  {
    code: 'storm_tracks_and_seasonality',
    title: 'Improve storm-track placement and seasonal cyclone-support structure',
    focusArea: 'storm latitudes, cyclone environments, and warm-season hemispheric contrast',
    files: [
      'src/weather/v2/core5.js',
      'src/weather/v2/vertical5.js',
      'src/weather/v2/microphysics5.js'
    ],
    relatedGapCodes: [
      'north_storm_track_out_of_range',
      'south_storm_track_out_of_range',
      'north_tropical_cyclone_seasonality_weak',
      'south_tropical_cyclone_seasonality_weak'
    ],
    derive(summary, gaps, months) {
      const related = gaps.filter((gap) => this.relatedGapCodes.includes(gap.code));
      const severity = clamp01(related.reduce((sum, gap) => sum + (gap.severity || 0), 0));
      const northTrack = latestMetric(summary, 'stormTrackNorthLatDeg');
      const southTrack = latestMetric(summary, 'stormTrackSouthLatDeg');
      return {
        score: severity,
        why: [
          `Latest storm-track peaks are ${round(northTrack)} and ${round(southTrack)} deg.`,
          'If seasonal cyclone-support structure is weak, the annual climate may look superficially stable while still missing realistic hemispheric timing and storm organization.'
        ],
        evidence: {
          latest: {
            stormTrackNorthLatDeg: round(northTrack),
            stormTrackSouthLatDeg: round(southTrack)
          },
          monthly: {
            tropicalCycloneEnvironmentCountNh: monthlyTrace(months, 'tropicalCycloneEnvironmentCountNh'),
            tropicalCycloneEnvironmentCountSh: monthlyTrace(months, 'tropicalCycloneEnvironmentCountSh')
          }
        },
        recommendedActions: [
          'Do not tune cyclone seasonality before the moisture belts and trades are credible; use this as a downstream validation campaign.',
          'Once the broad climate is healthy, target the hemisphere with the weakest warm-season environment contrast first.'
        ]
      };
    }
  },
  {
    code: 'cloud_hydrology_balance',
    title: 'Stabilize cloud-field and hydrology balance',
    focusArea: 'global cloud amount, column water drift, and runaway hydrology',
    files: [
      'src/weather/v2/microphysics5.js',
      'src/weather/v2/core5.js',
      'src/weather/v2/vertical5.js'
    ],
    relatedGapCodes: [
      'cloud_field_unbalanced',
      'runaway_global_precip',
      'column_water_drift',
      'runaway_surface_winds'
    ],
    derive(summary, gaps, months) {
      const related = gaps.filter((gap) => this.relatedGapCodes.includes(gap.code));
      const severity = clamp01(related.reduce((sum, gap) => sum + (gap.severity || 0), 0));
      const cloud = latestMetric(summary, 'globalCloudMeanFrac');
      const precip = latestMetric(summary, 'globalPrecipMeanMmHr');
      const tcw = latestMetric(summary, 'globalTcwMeanKgM2');
      return {
        score: severity,
        why: [
          `Latest global cloud/precip/TCW are ${round(cloud)}, ${round(precip)}, and ${round(tcw)}.`,
          'If the cloud-water budget drifts or collapses, the annual run becomes untrustworthy even if a few regional metrics temporarily improve.'
        ],
        evidence: {
          latest: {
            globalCloudMeanFrac: round(cloud),
            globalPrecipMeanMmHr: round(precip),
            globalTcwMeanKgM2: round(tcw)
          },
          monthly: {
            globalCloudMeanFrac: monthlyTrace(months, 'globalCloudMeanFrac'),
            globalPrecipMeanMmHr: monthlyTrace(months, 'globalPrecipMeanMmHr'),
            globalTcwMeanKgM2: monthlyTrace(months, 'globalTcwMeanKgM2')
          }
        },
        recommendedActions: [
          'Treat this as a guardrail campaign: fix any annual drift before trusting seasonal tuning wins.',
          'Prefer structural fixes in convection/microphysics coupling over global clamps.'
        ]
      };
    }
  }
]);

export const buildAnnualPhysicsTargets = ({ summary, monthlyClimatology, realismGaps, top = 5 }) => {
  const definitions = buildCampaignDefinitions();
  const candidates = definitions
    .map((definition) => {
      const derived = definition.derive(summary, realismGaps, monthlyClimatology);
      return {
        rank: null,
        code: definition.code,
        title: definition.title,
        focusArea: definition.focusArea,
        files: definition.files,
        score: round(derived.score, 3) ?? 0,
        why: derived.why,
        evidence: derived.evidence,
        recommendedActions: derived.recommendedActions
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, top))
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1
    }));
  return candidates;
};

const renderMarkdown = (report) => {
  const lines = [
    '# Annual Physics Targets',
    '',
    `Generated: ${report.generatedAt}`,
    `Source report base: ${report.reportBase}`,
    `Top targets requested: ${report.topRequested}`,
    ''
  ];
  for (const target of report.targets) {
    lines.push(`## ${target.rank}. ${target.title}`);
    lines.push('');
    lines.push(`- Score: ${target.score}`);
    lines.push(`- Focus area: ${target.focusArea}`);
    lines.push(`- Candidate files: ${target.files.join(', ')}`);
    target.why.forEach((line) => lines.push(`- Why: ${line}`));
    target.recommendedActions.forEach((line) => lines.push(`- Action: ${line}`));
    const latestEntries = Object.entries(target.evidence?.latest || {}).filter(([, value]) => value !== null && value !== undefined);
    if (latestEntries.length) {
      lines.push('- Latest evidence:');
      latestEntries.forEach(([key, value]) => lines.push(`  - ${key}: ${value}`));
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
};

export async function main() {
  if (!Number.isFinite(topN) || topN <= 0) topN = 5;
  const summary = readJson(`${reportBase}.json`);
  const monthlyClimatology = readJson(`${reportBase}-monthly-climatology.json`);
  const realismGaps = readJson(`${reportBase}-realism-gaps.json`);
  const targets = buildAnnualPhysicsTargets({
    summary,
    monthlyClimatology,
    realismGaps,
    top: topN
  });
  const report = {
    schema: 'satellite-wars.annual-physics-targets.v1',
    generatedAt: new Date().toISOString(),
    reportBase,
    topRequested: topN,
    sourceSummaryPath: `${reportBase}.json`,
    sourceMonthlyClimatologyPath: `${reportBase}-monthly-climatology.json`,
    sourceRealismGapsPath: `${reportBase}-realism-gaps.json`,
    targets
  };
  const effectiveOut = outPath || `${reportBase}-physics-targets.json`;
  const effectiveMdOut = mdOutPath || `${reportBase}-physics-targets.md`;
  fs.mkdirSync(path.dirname(effectiveOut), { recursive: true });
  fs.mkdirSync(path.dirname(effectiveMdOut), { recursive: true });
  fs.writeFileSync(effectiveOut, toJson(report));
  fs.writeFileSync(effectiveMdOut, renderMarkdown(report));
  process.stdout.write(toJson(report));
  return report;
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  buildAnnualPhysicsTargets,
  monthLabel
};
