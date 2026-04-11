#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { WeatherCore5 } from '../../src/weather/v2/core5.js';
import { buildValidationDiagnostics } from '../../src/weather/validation/diagnostics.js';
import { NH_DRY_BELT_SOURCE_SECTOR_KEYS, SURFACE_MOISTURE_SOURCE_TRACERS, classifyNhDryBeltSector } from '../../src/weather/v2/sourceTracing5.js';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { ensureCyclePlanReady } from './plan-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultReportBase = path.join(repoRoot, 'weather-validation', 'reports', 'planetary-realism-status');

export const PLANETARY_PRESETS = {
  quick: {
    nx: 48,
    ny: 24,
    dt: 1800,
    horizonsDays: [30],
    sampleEveryDays: 15
  },
  seasonal: {
    nx: 48,
    ny: 24,
    dt: 1800,
    horizonsDays: [90],
    sampleEveryDays: 15
  },
  annual: {
    nx: 48,
    ny: 24,
    dt: 3600,
    horizonsDays: [365],
    sampleEveryDays: 15
  },
  full: {
    nx: 48,
    ny: 24,
    dt: 3600,
    horizonsDays: [30, 90, 365],
    sampleEveryDays: 15
  }
};

const argv = process.argv.slice(2);
let preset = 'quick';
let nx = null;
let ny = null;
let dt = null;
let seed = 12345;
let sampleEveryDays = null;
let horizonsDays = null;
let outPath = null;
let mdOutPath = null;
let reportBase = null;
let reproCheck = null;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--preset' && argv[i + 1]) preset = argv[++i];
  else if (arg.startsWith('--preset=')) preset = arg.slice('--preset='.length);
  else if (arg === '--grid' && argv[i + 1]) {
    const [nxRaw, nyRaw] = argv[++i].toLowerCase().split('x');
    nx = Number.parseInt(nxRaw, 10);
    ny = Number.parseInt(nyRaw, 10);
  } else if (arg.startsWith('--grid=')) {
    const [nxRaw, nyRaw] = arg.slice('--grid='.length).toLowerCase().split('x');
    nx = Number.parseInt(nxRaw, 10);
    ny = Number.parseInt(nyRaw, 10);
  } else if (arg === '--dt' && argv[i + 1]) dt = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--dt=')) dt = Number.parseInt(arg.slice('--dt='.length), 10);
  else if (arg === '--seed' && argv[i + 1]) seed = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--seed=')) seed = Number.parseInt(arg.slice('--seed='.length), 10);
  else if (arg === '--sample-every-days' && argv[i + 1]) sampleEveryDays = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--sample-every-days=')) sampleEveryDays = Number.parseInt(arg.slice('--sample-every-days='.length), 10);
  else if (arg === '--horizons-days' && argv[i + 1]) {
    horizonsDays = argv[++i].split(',').map((value) => Number.parseInt(value.trim(), 10)).filter(Number.isFinite);
  } else if (arg.startsWith('--horizons-days=')) {
    horizonsDays = arg.slice('--horizons-days='.length).split(',').map((value) => Number.parseInt(value.trim(), 10)).filter(Number.isFinite);
  } else if (arg === '--out' && argv[i + 1]) outPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
  else if (arg === '--md-out' && argv[i + 1]) mdOutPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--md-out=')) mdOutPath = path.resolve(arg.slice('--md-out='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--repro-check') reproCheck = true;
  else if (arg === '--no-repro-check') reproCheck = false;
}

const presetConfig = PLANETARY_PRESETS[preset] || PLANETARY_PRESETS.quick;
nx = Number.isFinite(nx) && nx > 0 ? nx : presetConfig.nx;
ny = Number.isFinite(ny) && ny > 0 ? ny : presetConfig.ny;
dt = Number.isFinite(dt) && dt > 0 ? dt : presetConfig.dt;
sampleEveryDays = Number.isFinite(sampleEveryDays) && sampleEveryDays > 0 ? sampleEveryDays : presetConfig.sampleEveryDays;
horizonsDays = Array.isArray(horizonsDays) && horizonsDays.length
  ? [...new Set(horizonsDays.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b)
  : presetConfig.horizonsDays.slice();
if (!Number.isFinite(seed)) seed = 12345;
if (reproCheck == null) reproCheck = preset === 'quick';

const effectiveReportBase = outPath || mdOutPath ? null : (reportBase || defaultReportBase);

const SECONDS_PER_DAY = 86400;
const DEFAULT_TROPICAL_LAT = 12;
const DEFAULT_DRY_MIN_LAT = 15;
const DEFAULT_DRY_MAX_LAT = 35;
const DEFAULT_STORM_MIN_LAT = 25;
const DEFAULT_STORM_MAX_LAT = 70;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = (value, digits = 3) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const roundSeries = (values, digits = 3) => values.map((value) => round(value, digits));
const clamp01 = (value) => clamp(value, 0, 1);

const stripKnownExtension = (filePath) => filePath.replace(/\.(json|md)$/i, '');

const dayToMonthIndex = (day) => {
  const normalized = ((day % 365) + 365) % 365;
  return Math.floor((normalized / 365) * 12);
};

const monthName = (monthIndex) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex] || `M${monthIndex + 1}`;

export const buildSampleTargetsDays = (horizonList, cadenceDays) => {
  const targets = new Set(horizonList);
  const maxHorizon = horizonList[horizonList.length - 1];
  for (let day = cadenceDays; day < maxHorizon; day += cadenceDays) {
    targets.add(day);
  }
  return [...targets].filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
};

const makeRowWeights = (latitudesDeg) => latitudesDeg.map((lat) => Math.max(0.05, Math.cos((lat * Math.PI) / 180)));

const zonalMean = (field, nx, ny) => {
  const out = new Array(ny).fill(0);
  for (let j = 0; j < ny; j += 1) {
    let total = 0;
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) total += field[row + i] || 0;
    out[j] = total / Math.max(1, nx);
  }
  return out;
};

const meanProfiles = (profiles) => {
  if (!profiles.length) return null;
  const first = profiles[0];
  const series = {};
  for (const key of Object.keys(first.series || {})) {
    const sampleSeries = profiles.map((profile) => profile.series?.[key]).filter((value) => Array.isArray(value) && value.length === first.latitudesDeg.length);
    if (!sampleSeries.length) continue;
    const aggregate = new Array(first.latitudesDeg.length).fill(0);
    for (const sample of sampleSeries) {
      for (let index = 0; index < sample.length; index += 1) {
        aggregate[index] += sample[index];
      }
    }
    series[key] = aggregate.map((value) => round(value / sampleSeries.length, key.includes('KgM2S') || key.includes('S_1') ? 5 : 3));
  }
  return {
    latitudesDeg: first.latitudesDeg.slice(),
    series
  };
};

const weightedBandMean = (series, latitudesDeg, rowWeights, lat0, lat1) => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const weight = rowWeights[j];
    total += series[j] * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const weightedBandCentroid = (series, latitudesDeg, rowWeights, lat0, lat1) => {
  let numerator = 0;
  let denominator = 0;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const value = Math.max(0, series[j]);
    const weight = rowWeights[j] * value;
    numerator += lat * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : 0;
};

const weightedBandWidth = (series, latitudesDeg, rowWeights, lat0, lat1, centerLat) => {
  let numerator = 0;
  let denominator = 0;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const value = Math.max(0, series[j]);
    const weight = rowWeights[j] * value;
    numerator += (lat - centerLat) ** 2 * weight;
    denominator += weight;
  }
  return denominator > 0 ? 2 * Math.sqrt(numerator / denominator) : 0;
};

const peakLatitude = (series, latitudesDeg, lat0, lat1) => {
  let bestIndex = -1;
  let bestValue = -Infinity;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    if (series[j] > bestValue) {
      bestValue = series[j];
      bestIndex = j;
    }
  }
  return bestIndex >= 0 ? latitudesDeg[bestIndex] : null;
};

const areaWeightedMean = (field, nx, ny, rowWeights) => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      total += (field[row + i] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const weightedFieldBandMean = (field, nx, ny, latitudesDeg, rowWeights, lat0, lat1, landMask = null, landMaskMode = 'all') => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      if (landMaskMode !== 'all' && landMask) {
        const isLand = landMask[idx] === 1;
        if (landMaskMode === 'land' && !isLand) continue;
        if (landMaskMode === 'ocean' && isLand) continue;
      }
      total += (field[idx] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const weightedFieldBandMeanWithFilter = (field, nx, ny, latitudesDeg, longitudesDeg, rowWeights, lat0, lat1, predicate = null) => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      if (predicate && !predicate({ idx, latDeg: lat, lonDeg: longitudesDeg[i] })) continue;
      total += (field[idx] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const getRepoCommitSha = () => {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const cloneConfigSnapshot = (core) => ({
  surfaceParams: { ...core.surfaceParams },
  advectParams: { ...core.advectParams },
  vertParams: { ...core.vertParams },
  microParams: { ...core.microParams },
  nudgeParams: { ...core.nudgeParams },
  windNudgeParams: { ...core.windNudgeParams },
  windEddyParams: { ...core.windEddyParams },
  windNudgeSpinupParams: { ...core.windNudgeSpinupParams },
  dynParams: { ...core.dynParams },
  massParams: { ...core.massParams },
  analysisIncrementParams: { ...core.analysisIncrementParams },
  radParams: { ...core.radParams },
  diagParams: { ...core.diagParams },
  lodParams: { ...core.lodParams }
});

const applyCoreConfigSnapshot = (core, snapshot) => {
  if (!snapshot) return;
  Object.assign(core.surfaceParams, snapshot.surfaceParams || {});
  Object.assign(core.advectParams, snapshot.advectParams || {});
  Object.assign(core.vertParams, snapshot.vertParams || {});
  Object.assign(core.microParams, snapshot.microParams || {});
  Object.assign(core.nudgeParams, snapshot.nudgeParams || {});
  Object.assign(core.windNudgeParams, snapshot.windNudgeParams || {});
  Object.assign(core.windEddyParams, snapshot.windEddyParams || {});
  Object.assign(core.windNudgeSpinupParams, snapshot.windNudgeSpinupParams || {});
  Object.assign(core.dynParams, snapshot.dynParams || {});
  Object.assign(core.massParams, snapshot.massParams || {});
  Object.assign(core.analysisIncrementParams, snapshot.analysisIncrementParams || {});
  Object.assign(core.radParams, snapshot.radParams || {});
  Object.assign(core.diagParams, snapshot.diagParams || {});
  Object.assign(core.lodParams, snapshot.lodParams || {});
};

const buildRunManifest = ({ core, terrainFallback, sampleTargetsDays, targetsSeconds }) => ({
  schema: 'satellite-wars.run-manifest.v1',
  generatedAt: new Date().toISOString(),
  gitCommit: getRepoCommitSha(),
  config: {
    preset,
    nx,
    ny,
    dtSeconds: dt,
    seed,
    sampleEveryDays,
    horizonsDays,
    sampleTargetsDays,
    targetSeconds: targetsSeconds,
    reproCheckEnabled: Boolean(reproCheck)
  },
  runtime: {
    modelDtSeconds: core.modelDt,
    moduleOrder: [
      'updateHydrostatic',
      'stepSurface2D5',
      'updateHydrostatic',
      'stepRadiation2D5',
      'updateHydrostatic',
      'stepWinds5',
      'stepWindNudge5',
      'stepWindEddyNudge5',
      'stepSurfacePressure5',
      'stepAdvection5',
      'stepVertical5',
      'updateHydrostatic',
      'stepMicrophysics5',
      'updateHydrostatic',
      'stepNudging5',
      'stepAnalysisIncrement5',
      'updateDiagnostics2D5'
    ],
    moduleTiming: core.getModuleTimingSummary ? core.getModuleTimingSummary() : null
  },
  terrain: terrainFallback || null,
  params: cloneConfigSnapshot(core)
});

const buildConservationSummary = ({ core }) => ({
  schema: 'satellite-wars.conservation-summary.v1',
  generatedAt: new Date().toISOString(),
  gitCommit: getRepoCommitSha(),
  conservationBudget: core.getConservationSummary ? core.getConservationSummary() : null
});

const areaWeightedMax = (field) => field.reduce((best, value) => Math.max(best, Number.isFinite(value) ? value : -Infinity), -Infinity);

const computeTropicalCycloneEnvironment = (diagnostics) => {
  const { grid, seaLevelPressurePa, wind10mSpeedMs, totalColumnWaterKgM2, sstK, seaIceFraction, cycloneSupportFields } = diagnostics;
  const { nx, ny, latitudesDeg } = grid;
  const zonalSlp = zonalMean(seaLevelPressurePa, nx, ny);
  const counts = { nh: 0, sh: 0 };
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      const vort = cycloneSupportFields.relativeVorticityS_1[idx] || 0;
      const signedSpinOk = lat >= 0 ? vort >= 2e-5 : vort <= -2e-5;
      if (!signedSpinOk) continue;
      if ((seaIceFraction[idx] || 0) > 0.2) continue;
      if ((sstK[idx] || 0) < 298.5) continue;
      if ((totalColumnWaterKgM2[idx] || 0) < 28) continue;
      if ((wind10mSpeedMs[idx] || 0) < 8) continue;
      if ((seaLevelPressurePa[idx] || 0) > (zonalSlp[j] || 101000) - 350) continue;
      counts[lat >= 0 ? 'nh' : 'sh'] += 1;
    }
  }
  return counts;
};

export const classifySnapshot = (diagnostics, targetDay) => {
  const {
    grid,
    landMask,
    precipRateMmHr,
    cloudTotalFraction,
    wind10mU,
    wind10mSpeedMs,
    totalColumnWaterKgM2,
    surfaceEvapRateMmHr,
    verticallyIntegratedVaporFluxNorthKgM_1S,
    verticallyIntegratedTotalWaterFluxNorthKgM_1S,
    cycloneSupportFields,
    convectiveMaskFrac,
    convectivePotentialFrac,
    convectiveOrganizationFrac,
    convectiveMassFluxKgM2S,
    convectiveDetrainmentMassKgM2,
    convectiveAnvilSourceFrac,
    resolvedAscentCloudBirthPotentialKgM2,
    largeScaleCondensationSourceKgM2,
    cloudReevaporationMassKgM2,
    precipReevaporationMassKgM2,
    importedAnvilPersistenceMassKgM2,
    carriedOverUpperCloudMassKgM2,
    weakErosionCloudSurvivalMassKgM2,
    upperCloudPathKgM2,
    lowLevelMoistureSourceTracersKgM2,
    lowLevelMoistureConvergenceS_1,
    lowerTroposphericRhFrac,
    subtropicalSubsidenceDryingFrac,
    surfaceEvapPotentialRateMmHr,
    surfaceEvapTransferCoeff,
    surfaceEvapWindSpeedMs,
    surfaceEvapHumidityGradientKgKg,
    surfaceEvapSurfaceTempK,
    surfaceEvapAirTempK,
    surfaceEvapSoilGateFrac,
    surfaceEvapRunoffLossRateMmHr,
    surfaceEvapSeaIceSuppressionFrac,
    surfaceEvapSurfaceSaturationMixingRatioKgKg,
    surfaceEvapAirMixingRatioKgKg,
    processMoistureBudget,
    transportTracing,
    verticalCloudBirthTracing,
    upperCloudResidenceTracing
  } = diagnostics;
  const { nx, ny, latitudesDeg } = grid;
  const longitudesDeg = Array.isArray(grid.longitudesDeg)
    ? grid.longitudesDeg
    : Array.from({ length: nx }, (_, index) => -180 + ((index + 0.5) * 360) / Math.max(1, nx));
  const rowWeights = makeRowWeights(latitudesDeg);
  const zonalPrecip = zonalMean(precipRateMmHr, nx, ny);
  const zonalCloud = zonalMean(cloudTotalFraction, nx, ny);
  const zonalU10 = zonalMean(wind10mU, nx, ny);
  const zonalTcw = zonalMean(totalColumnWaterKgM2, nx, ny);
  const zonalConvectiveFraction = zonalMean(convectiveMaskFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalConvectivePotential = zonalMean(convectivePotentialFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalConvectiveOrganization = zonalMean(convectiveOrganizationFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalConvectiveMassFlux = zonalMean(convectiveMassFluxKgM2S || new Array(nx * ny).fill(0), nx, ny);
  const zonalDetrainment = zonalMean(convectiveDetrainmentMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalAnvil = zonalMean(convectiveAnvilSourceFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalResolvedAscentCloudBirthPotential = zonalMean(resolvedAscentCloudBirthPotentialKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalLargeScaleCondensation = zonalMean(largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalCloudReevaporation = zonalMean(cloudReevaporationMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalPrecipReevaporation = zonalMean(precipReevaporationMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalImportedAnvilPersistence = zonalMean(importedAnvilPersistenceMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalCarriedOverUpperCloud = zonalMean(carriedOverUpperCloudMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalWeakErosionCloudSurvival = zonalMean(weakErosionCloudSurvivalMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalUpperCloudPath = zonalMean(upperCloudPathKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalMoistureConvergence = zonalMean(lowLevelMoistureConvergenceS_1 || new Array(nx * ny).fill(0), nx, ny);
  const zonalLowerRh = zonalMean(lowerTroposphericRhFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubsidenceDrying = zonalMean(subtropicalSubsidenceDryingFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSurfaceEvap = zonalMean(surfaceEvapRateMmHr || new Array(nx * ny).fill(0), nx, ny);
  const zonalSurfaceEvapPotential = zonalMean(surfaceEvapPotentialRateMmHr || new Array(nx * ny).fill(0), nx, ny);
  const zonalVaporFluxNorth = zonalMean(verticallyIntegratedVaporFluxNorthKgM_1S || new Array(nx * ny).fill(0), nx, ny);
  const zonalTotalWaterFluxNorth = zonalMean(verticallyIntegratedTotalWaterFluxNorthKgM_1S || new Array(nx * ny).fill(0), nx, ny);
  const sourceTracerZonal = Object.fromEntries(
    Object.entries(lowLevelMoistureSourceTracersKgM2 || {}).map(([key, field]) => [key, zonalMean(field || new Array(nx * ny).fill(0), nx, ny)])
  );
  const zonalStormIndex = zonalMean(
    precipRateMmHr.map((precip, idx) => Math.abs(cycloneSupportFields.relativeVorticityS_1[idx] || 0) * Math.max(0, precip || 0) * Math.max(1, wind10mSpeedMs[idx] || 0)),
    nx,
    ny
  );
  const globalPrecipMean = areaWeightedMean(precipRateMmHr, nx, ny, rowWeights);
  const globalCloudMean = areaWeightedMean(cloudTotalFraction, nx, ny, rowWeights);
  const globalTcwMean = areaWeightedMean(totalColumnWaterKgM2, nx, ny, rowWeights);
  const maxWind10m = areaWeightedMax(wind10mSpeedMs);
  const itczLat = weightedBandCentroid(zonalPrecip, latitudesDeg, rowWeights, -20, 20);
  const itczWidth = weightedBandWidth(zonalPrecip, latitudesDeg, rowWeights, -25, 25, itczLat);
  const equatorialPrecip = weightedBandMean(zonalPrecip, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const subtropicalDryNorth = weightedBandMean(zonalPrecip, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const subtropicalDrySouth = weightedBandMean(zonalPrecip, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const tropicalConvectiveFraction = weightedBandMean(zonalConvectiveFraction, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalConvectivePotential = weightedBandMean(zonalConvectivePotential, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalConvectiveOrganization = weightedBandMean(zonalConvectiveOrganization, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalConvectiveMassFlux = weightedBandMean(zonalConvectiveMassFlux, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalMoistureConvergence = weightedBandMean(zonalMoistureConvergence, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const subtropicalRhNorth = weightedBandMean(zonalLowerRh, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const subtropicalRhSouth = weightedBandMean(zonalLowerRh, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const subtropicalSubsidenceNorth = weightedBandMean(zonalSubsidenceDrying, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const subtropicalSubsidenceSouth = weightedBandMean(zonalSubsidenceDrying, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const tropicalUpperDetrainment = weightedBandMean(zonalDetrainment, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalAnvilPersistence = weightedBandMean(zonalAnvil, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const northDryBeltLargeScaleCondensation = weightedBandMean(zonalLargeScaleCondensation, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltResolvedAscentCloudBirthPotential = weightedBandMean(zonalResolvedAscentCloudBirthPotential, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltConvectiveDetrainment = weightedBandMean(zonalDetrainment, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltImportedAnvilPersistence = weightedBandMean(zonalImportedAnvilPersistence, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltCarriedOverUpperCloud = weightedBandMean(zonalCarriedOverUpperCloud, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltWeakErosionCloudSurvival = weightedBandMean(zonalWeakErosionCloudSurvival, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltCloudReevaporation = weightedBandMean(zonalCloudReevaporation, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltPrecipReevaporation = weightedBandMean(zonalPrecipReevaporation, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltUpperCloudPath = weightedBandMean(zonalUpperCloudPath, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltLandPrecip = weightedFieldBandMean(precipRateMmHr, nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanPrecip = weightedFieldBandMean(precipRateMmHr, nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandRh = weightedFieldBandMean(lowerTroposphericRhFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanRh = weightedFieldBandMean(lowerTroposphericRhFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandEvap = weightedFieldBandMean(surfaceEvapRateMmHr || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanEvap = weightedFieldBandMean(surfaceEvapRateMmHr || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltEvapPotential = weightedBandMean(zonalSurfaceEvapPotential, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltLandLargeScaleCondensation = weightedFieldBandMean(largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanLargeScaleCondensation = weightedFieldBandMean(largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandResolvedAscentCloudBirthPotential = weightedFieldBandMean(resolvedAscentCloudBirthPotentialKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanResolvedAscentCloudBirthPotential = weightedFieldBandMean(resolvedAscentCloudBirthPotentialKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandImportedAnvilPersistence = weightedFieldBandMean(importedAnvilPersistenceMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanImportedAnvilPersistence = weightedFieldBandMean(importedAnvilPersistenceMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandCarriedOverUpperCloud = weightedFieldBandMean(carriedOverUpperCloudMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanCarriedOverUpperCloud = weightedFieldBandMean(carriedOverUpperCloudMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandWeakErosionCloudSurvival = weightedFieldBandMean(weakErosionCloudSurvivalMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanWeakErosionCloudSurvival = weightedFieldBandMean(weakErosionCloudSurvivalMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const crossEquatorialVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, -5, 5);
  const northTransitionVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, 12, 22);
  const northDryBeltVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionTotalWaterFlux = weightedBandMean(zonalTotalWaterFluxNorth, latitudesDeg, rowWeights, 12, 22);
  const northDryBeltSourceMeans = Object.fromEntries(
    SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key }) => [
      key,
      round(weightedBandMean(sourceTracerZonal[key] || new Array(ny).fill(0), latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5)
    ])
  );
  northDryBeltSourceMeans.unattributedResidual = round(
    weightedBandMean(sourceTracerZonal.unattributedResidual || new Array(ny).fill(0), latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT),
    5
  );
  const northDryBeltSourceTotal = Object.values(northDryBeltSourceMeans)
    .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const northDryBeltAttributed = northDryBeltSourceTotal - Math.max(0, northDryBeltSourceMeans.unattributedResidual || 0);
  const northDryBeltSourceCoverage = northDryBeltSourceTotal > 0
    ? clamp01(northDryBeltAttributed / northDryBeltSourceTotal)
    : 0;
  const nhDryBeltSectorSummary = Object.fromEntries(
    NH_DRY_BELT_SOURCE_SECTOR_KEYS.map((sectorKey) => [
      sectorKey,
      {
        totalLowLevelSourceMeanKgM2: round(
          weightedFieldBandMeanWithFilter(
            Object.values(lowLevelMoistureSourceTracersKgM2 || {}).reduce((acc, field) => acc.map((value, index) => value + (field?.[index] || 0)), new Array(nx * ny).fill(0)),
            nx,
            ny,
            latitudesDeg,
            longitudesDeg,
            rowWeights,
            DEFAULT_DRY_MIN_LAT,
            DEFAULT_DRY_MAX_LAT,
            ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: landMask[idx] === 1 }) === sectorKey
          ),
          5
        ),
        largeScaleCondensationMeanKgM2: round(
          weightedFieldBandMeanWithFilter(
            largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0),
            nx,
            ny,
            latitudesDeg,
            longitudesDeg,
            rowWeights,
            DEFAULT_DRY_MIN_LAT,
            DEFAULT_DRY_MAX_LAT,
            ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: landMask[idx] === 1 }) === sectorKey
          ),
          5
        )
      }
    ])
  );
  const surfaceFluxDecomposition = {
    northDryBeltEvapMeanMmHr: round(weightedBandMean(zonalSurfaceEvap, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltEvapPotentialMeanMmHr: round(northDryBeltEvapPotential),
    northDryBeltTransferCoeffMean: round(weightedFieldBandMean(surfaceEvapTransferCoeff || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6),
    northDryBeltWindSpeedMeanMs: round(weightedFieldBandMean(surfaceEvapWindSpeedMs || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltHumidityGradientMeanKgKg: round(weightedFieldBandMean(surfaceEvapHumidityGradientKgKg || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6),
    northDryBeltSurfaceTempMeanK: round(weightedFieldBandMean(surfaceEvapSurfaceTempK || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltAirTempMeanK: round(weightedFieldBandMean(surfaceEvapAirTempK || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltSoilGateMeanFrac: round(weightedFieldBandMean(surfaceEvapSoilGateFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltRunoffLossMeanMmHr: round(weightedFieldBandMean(surfaceEvapRunoffLossRateMmHr || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltSeaIceSuppressionMeanFrac: round(weightedFieldBandMean(surfaceEvapSeaIceSuppressionFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltSurfaceQsMeanKgKg: round(weightedFieldBandMean(surfaceEvapSurfaceSaturationMixingRatioKgKg || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6),
    northDryBeltSurfaceQaMeanKgKg: round(weightedFieldBandMean(surfaceEvapAirMixingRatioKgKg || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6)
  };
  const tradesNorth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, 5, 25);
  const tradesSouth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, -25, -5);
  const westerliesNorth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, 30, 60);
  const westerliesSouth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, -60, -30);
  const stormTrackNorthLat = peakLatitude(zonalStormIndex, latitudesDeg, DEFAULT_STORM_MIN_LAT, DEFAULT_STORM_MAX_LAT);
  const stormTrackSouthLat = peakLatitude(zonalStormIndex, latitudesDeg, -DEFAULT_STORM_MAX_LAT, -DEFAULT_STORM_MIN_LAT);
  const tcEnvCounts = computeTropicalCycloneEnvironment(diagnostics);

  return {
    targetDay,
    monthIndex: dayToMonthIndex(targetDay),
    metrics: {
      globalPrecipMeanMmHr: round(globalPrecipMean),
      globalCloudMeanFrac: round(globalCloudMean),
      globalTcwMeanKgM2: round(globalTcwMean),
      maxWind10mMs: round(maxWind10m),
      itczLatDeg: round(itczLat),
      itczWidthDeg: round(itczWidth),
      equatorialPrecipMeanMmHr: round(equatorialPrecip),
      subtropicalDryNorthMeanMmHr: round(subtropicalDryNorth),
      subtropicalDrySouthMeanMmHr: round(subtropicalDrySouth),
      subtropicalDryNorthRatio: round(subtropicalDryNorth / Math.max(1e-6, equatorialPrecip)),
      subtropicalDrySouthRatio: round(subtropicalDrySouth / Math.max(1e-6, equatorialPrecip)),
      tropicalConvectiveFraction: round(tropicalConvectiveFraction),
      tropicalConvectivePotential: round(tropicalConvectivePotential),
      tropicalConvectiveOrganization: round(tropicalConvectiveOrganization),
      tropicalConvectiveMassFluxKgM2S: round(tropicalConvectiveMassFlux, 5),
      tropicalMoistureConvergenceS_1: round(tropicalMoistureConvergence, 6),
      subtropicalRhNorthMeanFrac: round(subtropicalRhNorth),
      subtropicalRhSouthMeanFrac: round(subtropicalRhSouth),
      northDryBeltLandPrecipMeanMmHr: round(northDryBeltLandPrecip),
      northDryBeltOceanPrecipMeanMmHr: round(northDryBeltOceanPrecip),
      northDryBeltLandRhMeanFrac: round(northDryBeltLandRh),
      northDryBeltOceanRhMeanFrac: round(northDryBeltOceanRh),
      northDryBeltLandEvapMeanMmHr: round(northDryBeltLandEvap),
      northDryBeltOceanEvapMeanMmHr: round(northDryBeltOceanEvap),
      northDryBeltEvapPotentialMeanMmHr: round(northDryBeltEvapPotential),
      northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2: round(northDryBeltResolvedAscentCloudBirthPotential, 5),
      northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2: round(northDryBeltLandResolvedAscentCloudBirthPotential, 5),
      northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2: round(northDryBeltOceanResolvedAscentCloudBirthPotential, 5),
      northDryBeltLargeScaleCondensationMeanKgM2: round(northDryBeltLargeScaleCondensation, 5),
      northDryBeltLandLargeScaleCondensationMeanKgM2: round(northDryBeltLandLargeScaleCondensation, 5),
      northDryBeltOceanLargeScaleCondensationMeanKgM2: round(northDryBeltOceanLargeScaleCondensation, 5),
      northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2: round(northDryBeltConvectiveDetrainment, 5),
      northDryBeltImportedAnvilPersistenceMeanKgM2: round(northDryBeltImportedAnvilPersistence, 5),
      northDryBeltLandImportedAnvilPersistenceMeanKgM2: round(northDryBeltLandImportedAnvilPersistence, 5),
      northDryBeltOceanImportedAnvilPersistenceMeanKgM2: round(northDryBeltOceanImportedAnvilPersistence, 5),
      northDryBeltCarriedOverUpperCloudMeanKgM2: round(northDryBeltCarriedOverUpperCloud, 5),
      northDryBeltLandCarriedOverUpperCloudMeanKgM2: round(northDryBeltLandCarriedOverUpperCloud, 5),
      northDryBeltOceanCarriedOverUpperCloudMeanKgM2: round(northDryBeltOceanCarriedOverUpperCloud, 5),
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: round(northDryBeltWeakErosionCloudSurvival, 5),
      northDryBeltLandWeakErosionCloudSurvivalMeanKgM2: round(northDryBeltLandWeakErosionCloudSurvival, 5),
      northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2: round(northDryBeltOceanWeakErosionCloudSurvival, 5),
      northDryBeltCloudReevaporationMeanKgM2: round(northDryBeltCloudReevaporation, 5),
      northDryBeltPrecipReevaporationMeanKgM2: round(northDryBeltPrecipReevaporation, 5),
      northDryBeltUpperCloudPathMeanKgM2: round(northDryBeltUpperCloudPath, 5),
      crossEquatorialVaporFluxNorthKgM_1S: round(crossEquatorialVaporFlux, 5),
      northTransitionVaporFluxNorthKgM_1S: round(northTransitionVaporFlux, 5),
      northDryBeltVaporFluxNorthKgM_1S: round(northDryBeltVaporFlux, 5),
      southDryBeltVaporFluxNorthKgM_1S: round(southDryBeltVaporFlux, 5),
      northTransitionTotalWaterFluxNorthKgM_1S: round(northTransitionTotalWaterFlux, 5),
      northDryBeltSourceNorthDryBeltOceanMeanKgM2: northDryBeltSourceMeans.northDryBeltOcean,
      northDryBeltSourceTropicalOceanNorthMeanKgM2: northDryBeltSourceMeans.tropicalOceanNorth,
      northDryBeltSourceTropicalOceanSouthMeanKgM2: northDryBeltSourceMeans.tropicalOceanSouth,
      northDryBeltSourceNorthExtratropicalOceanMeanKgM2: northDryBeltSourceMeans.northExtratropicalOcean,
      northDryBeltSourceLandRecyclingMeanKgM2: northDryBeltSourceMeans.landRecycling,
      northDryBeltSourceOtherOceanMeanKgM2: northDryBeltSourceMeans.otherOcean,
      northDryBeltSourceInitializationMemoryMeanKgM2: northDryBeltSourceMeans.initializationMemory,
      northDryBeltSourceAtmosphericCarryoverMeanKgM2: northDryBeltSourceMeans.atmosphericCarryover,
      northDryBeltSourceNudgingInjectionMeanKgM2: northDryBeltSourceMeans.nudgingInjection,
      northDryBeltSourceAnalysisInjectionMeanKgM2: northDryBeltSourceMeans.analysisInjection,
      northDryBeltSourceUnattributedResidualMeanKgM2: northDryBeltSourceMeans.unattributedResidual,
      northDryBeltSourceAttributionCoverageFrac: round(northDryBeltSourceCoverage, 5),
      subtropicalSubsidenceNorthMean: round(subtropicalSubsidenceNorth),
      subtropicalSubsidenceSouthMean: round(subtropicalSubsidenceSouth),
      upperDetrainmentTropicalKgM2: round(tropicalUpperDetrainment, 5),
      tropicalAnvilPersistenceFrac: round(tropicalAnvilPersistence),
      tropicalTradesNorthU10Ms: round(tradesNorth),
      tropicalTradesSouthU10Ms: round(tradesSouth),
      midlatitudeWesterliesNorthU10Ms: round(westerliesNorth),
      midlatitudeWesterliesSouthU10Ms: round(westerliesSouth),
      stormTrackNorthLatDeg: round(stormTrackNorthLat),
      stormTrackSouthLatDeg: round(stormTrackSouthLat),
      tropicalCycloneEnvironmentCountNh: tcEnvCounts.nh,
      tropicalCycloneEnvironmentCountSh: tcEnvCounts.sh
    },
    sourceAttribution: {
      northDryBeltLowLevelMeanKgM2: northDryBeltSourceMeans,
      northDryBeltAttributionCoverageFrac: round(northDryBeltSourceCoverage, 5),
      nhDryBeltSectorSummary
    },
    surfaceFluxDecomposition,
    transportTracing: transportTracing || null,
    verticalCloudBirthTracing: verticalCloudBirthTracing || null,
    upperCloudResidenceTracing: upperCloudResidenceTracing || null,
    profiles: {
      latitudesDeg: roundSeries(latitudesDeg),
      series: {
        precipRateMmHr: roundSeries(zonalPrecip),
        cloudTotalFraction: roundSeries(zonalCloud),
        wind10mU: roundSeries(zonalU10),
        totalColumnWaterKgM2: roundSeries(zonalTcw),
        stormTrackIndex: roundSeries(zonalStormIndex, 5),
        convectiveFraction: roundSeries(zonalConvectiveFraction),
        convectivePotential: roundSeries(zonalConvectivePotential),
        convectiveOrganization: roundSeries(zonalConvectiveOrganization),
        convectiveMassFluxKgM2S: roundSeries(zonalConvectiveMassFlux, 5),
        lowerTroposphericRhFrac: roundSeries(zonalLowerRh),
        lowerLevelMoistureConvergenceS_1: roundSeries(zonalMoistureConvergence, 6),
        subtropicalSubsidenceDryingFrac: roundSeries(zonalSubsidenceDrying, 5),
        surfaceEvapRateMmHr: roundSeries(zonalSurfaceEvap),
        surfaceEvapPotentialRateMmHr: roundSeries(zonalSurfaceEvapPotential),
        resolvedAscentCloudBirthPotentialKgM2: roundSeries(zonalResolvedAscentCloudBirthPotential, 5),
        largeScaleCondensationSourceKgM2: roundSeries(zonalLargeScaleCondensation, 5),
        cloudReevaporationMassKgM2: roundSeries(zonalCloudReevaporation, 5),
        precipReevaporationMassKgM2: roundSeries(zonalPrecipReevaporation, 5),
        importedAnvilPersistenceMassKgM2: roundSeries(zonalImportedAnvilPersistence, 5),
        carriedOverUpperCloudMassKgM2: roundSeries(zonalCarriedOverUpperCloud, 5),
        weakErosionCloudSurvivalMassKgM2: roundSeries(zonalWeakErosionCloudSurvival, 5),
        upperCloudPathKgM2: roundSeries(zonalUpperCloudPath, 5),
        sourceNorthDryBeltOceanKgM2: roundSeries(sourceTracerZonal.northDryBeltOcean || new Array(ny).fill(0), 5),
        sourceTropicalOceanNorthKgM2: roundSeries(sourceTracerZonal.tropicalOceanNorth || new Array(ny).fill(0), 5),
        sourceTropicalOceanSouthKgM2: roundSeries(sourceTracerZonal.tropicalOceanSouth || new Array(ny).fill(0), 5),
        sourceNorthExtratropicalOceanKgM2: roundSeries(sourceTracerZonal.northExtratropicalOcean || new Array(ny).fill(0), 5),
        sourceLandRecyclingKgM2: roundSeries(sourceTracerZonal.landRecycling || new Array(ny).fill(0), 5),
        sourceOtherOceanKgM2: roundSeries(sourceTracerZonal.otherOcean || new Array(ny).fill(0), 5),
        sourceInitializationMemoryKgM2: roundSeries(sourceTracerZonal.initializationMemory || new Array(ny).fill(0), 5),
        sourceUnattributedResidualKgM2: roundSeries(sourceTracerZonal.unattributedResidual || new Array(ny).fill(0), 5),
        verticallyIntegratedVaporFluxNorthKgM_1S: roundSeries(zonalVaporFluxNorth, 5),
        verticallyIntegratedTotalWaterFluxNorthKgM_1S: roundSeries(zonalTotalWaterFluxNorth, 5),
        upperDetrainmentKgM2: roundSeries(zonalDetrainment, 5),
        anvilPersistenceFrac: roundSeries(zonalAnvil)
      }
    },
    processMoistureBudget: processMoistureBudget || null
  };
};

export const buildMoistureAttributionReport = (processMoistureBudget, latestMetrics = {}) => {
  const modules = Object.entries(processMoistureBudget?.modules || {}).map(([module, summary]) => {
    const northDry = summary?.bands?.north_dry_belt || {};
    const northDryLand = summary?.bands?.north_dry_belt_land || {};
    const northDryOcean = summary?.bands?.north_dry_belt_ocean || {};
    const northDrySurface = Number(northDry.surfaceVaporDeltaKgKg) || 0;
    const northDryUpper = Number(northDry.upperVaporDeltaKgKg) || 0;
    return {
      module,
      callCount: summary?.callCount || 0,
      northDryBeltSurfaceVaporDeltaKgKg: round(northDrySurface, 6),
      northDryBeltUpperVaporDeltaKgKg: round(northDryUpper, 6),
      northDryBeltNetVaporDeltaKgKg: round(northDrySurface + northDryUpper, 6),
      northDryBeltSurfacePrecipDeltaMm: round(northDry.surfacePrecipDeltaMm, 5),
      northDryBeltLandSurfaceVaporDeltaKgKg: round(northDryLand.surfaceVaporDeltaKgKg, 6),
      northDryBeltOceanSurfaceVaporDeltaKgKg: round(northDryOcean.surfaceVaporDeltaKgKg, 6)
    };
  });

  const positiveNorthDryMoisteningDrivers = modules
    .filter((entry) => Number(entry.northDryBeltNetVaporDeltaKgKg) > 0)
    .sort((a, b) => (b.northDryBeltNetVaporDeltaKgKg || 0) - (a.northDryBeltNetVaporDeltaKgKg || 0));
  const strongestNorthDryDryingDrivers = modules
    .filter((entry) => Number(entry.northDryBeltNetVaporDeltaKgKg) < 0)
    .sort((a, b) => (a.northDryBeltNetVaporDeltaKgKg || 0) - (b.northDryBeltNetVaporDeltaKgKg || 0));
  const strongestNorthDryPrecipSinks = modules
    .filter((entry) => Number(entry.northDryBeltSurfacePrecipDeltaMm) > 0)
    .sort((a, b) => (b.northDryBeltSurfacePrecipDeltaMm || 0) - (a.northDryBeltSurfacePrecipDeltaMm || 0));

  return {
    schema: 'satellite-wars.moisture-attribution.v1',
    generatedAt: new Date().toISOString(),
    trackedModelDays: round((processMoistureBudget?.sampledModelSeconds || 0) / 86400, 3),
    latestMetrics: {
      subtropicalDryNorthRatio: latestMetrics?.subtropicalDryNorthRatio ?? null,
      northDryBeltLandPrecipMeanMmHr: latestMetrics?.northDryBeltLandPrecipMeanMmHr ?? null,
      northDryBeltOceanPrecipMeanMmHr: latestMetrics?.northDryBeltOceanPrecipMeanMmHr ?? null,
      northDryBeltLandRhMeanFrac: latestMetrics?.northDryBeltLandRhMeanFrac ?? null,
      northDryBeltOceanRhMeanFrac: latestMetrics?.northDryBeltOceanRhMeanFrac ?? null,
      northDryBeltLandEvapMeanMmHr: latestMetrics?.northDryBeltLandEvapMeanMmHr ?? null,
      northDryBeltOceanEvapMeanMmHr: latestMetrics?.northDryBeltOceanEvapMeanMmHr ?? null,
      northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      northDryBeltLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null,
      northDryBeltLandLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLandLargeScaleCondensationMeanKgM2 ?? null,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? null,
      northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2: latestMetrics?.northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2 ?? null,
      northDryBeltImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2 ?? null,
      northDryBeltLandImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltLandImportedAnvilPersistenceMeanKgM2 ?? null,
      northDryBeltOceanImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltOceanImportedAnvilPersistenceMeanKgM2 ?? null,
      northDryBeltCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltLandCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltLandCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltOceanCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltOceanCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2 ?? null,
      northDryBeltLandWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltLandWeakErosionCloudSurvivalMeanKgM2 ?? null,
      northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2 ?? null,
      northDryBeltCloudReevaporationMeanKgM2: latestMetrics?.northDryBeltCloudReevaporationMeanKgM2 ?? null,
      northDryBeltPrecipReevaporationMeanKgM2: latestMetrics?.northDryBeltPrecipReevaporationMeanKgM2 ?? null,
      northDryBeltUpperCloudPathMeanKgM2: latestMetrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null,
      crossEquatorialVaporFluxNorthKgM_1S: latestMetrics?.crossEquatorialVaporFluxNorthKgM_1S ?? null,
      northTransitionVaporFluxNorthKgM_1S: latestMetrics?.northTransitionVaporFluxNorthKgM_1S ?? null,
      northDryBeltVaporFluxNorthKgM_1S: latestMetrics?.northDryBeltVaporFluxNorthKgM_1S ?? null
    },
    northDryBeltGenerationAttribution: {
      resolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      landResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      oceanResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      largeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null,
      landLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLandLargeScaleCondensationMeanKgM2 ?? null,
      oceanLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? null,
      convectiveDetrainmentCloudSourceMeanKgM2: latestMetrics?.northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2 ?? null,
      importedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2 ?? null,
      landImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltLandImportedAnvilPersistenceMeanKgM2 ?? null,
      oceanImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltOceanImportedAnvilPersistenceMeanKgM2 ?? null,
      carriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
      landCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltLandCarriedOverUpperCloudMeanKgM2 ?? null,
      oceanCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltOceanCarriedOverUpperCloudMeanKgM2 ?? null,
      weakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2 ?? null,
      landWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltLandWeakErosionCloudSurvivalMeanKgM2 ?? null,
      oceanWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2 ?? null,
      cloudReevaporationMeanKgM2: latestMetrics?.northDryBeltCloudReevaporationMeanKgM2 ?? null,
      precipReevaporationMeanKgM2: latestMetrics?.northDryBeltPrecipReevaporationMeanKgM2 ?? null,
      upperCloudPathMeanKgM2: latestMetrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null
    },
    positiveNorthDryBeltMoisteningDrivers: positiveNorthDryMoisteningDrivers.slice(0, 8),
    strongestNorthDryBeltDryingDrivers: strongestNorthDryDryingDrivers.slice(0, 8),
    strongestNorthDryBeltPrecipSinks: strongestNorthDryPrecipSinks.slice(0, 8),
    precipitationRegimes: processMoistureBudget?.precipitationRegimes || {}
  };
};

export const buildSurfaceSourceAttributionReport = (latestSample = null) => ({
  schema: 'satellite-wars.surface-source-attribution.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  latestMetrics: {
    subtropicalDryNorthRatio: latestSample?.metrics?.subtropicalDryNorthRatio ?? null,
    northDryBeltSourceAttributionCoverageFrac: latestSample?.metrics?.northDryBeltSourceAttributionCoverageFrac ?? null
  },
  sourceAttribution: latestSample?.sourceAttribution || null
});

export const buildSurfaceFluxDecompositionReport = (latestSample = null) => ({
  schema: 'satellite-wars.surface-flux-decomposition.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  surfaceFluxDecomposition: latestSample?.surfaceFluxDecomposition || null
});

export const buildNhDryBeltSourceSectorReport = (latestSample = null) => ({
  schema: 'satellite-wars.nh-dry-belt-source-sector-summary.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  nhDryBeltSectorSummary: latestSample?.sourceAttribution?.nhDryBeltSectorSummary || null
});

const transportInterfaceByTarget = (transportTracing, targetLatDeg) => (
  (transportTracing?.interfaces || []).find((entry) => Number(entry?.targetLatDeg) === Number(targetLatDeg)) || null
);

const sumInterfaceLevelBandField = (interfaceSummary, fieldName) => Object.values(interfaceSummary?.levelBands || {})
  .reduce((sum, levelBand) => sum + (Number(levelBand?.[fieldName]) || 0), 0);

const findDominantNhDryBeltImport = (transportTracing, fieldName) => {
  const candidates = [];
  for (const targetLatDeg of [22, 35]) {
    const interfaceSummary = transportInterfaceByTarget(transportTracing, targetLatDeg);
    if (!interfaceSummary) continue;
    for (const [levelBandKey, levelBand] of Object.entries(interfaceSummary.levelBands || {})) {
      const signedFlux = Number(levelBand?.[fieldName]) || 0;
      const importMagnitude = targetLatDeg === 35 ? Math.max(0, -signedFlux) : Math.max(0, signedFlux);
      candidates.push({
        interfaceTargetLatDeg: targetLatDeg,
        levelBandKey,
        label: levelBand?.label || levelBandKey,
        signedFluxNorthKgM_1S: round(signedFlux, 5),
        importMagnitudeKgM_1S: round(importMagnitude, 5)
      });
    }
  }
  return candidates.sort((a, b) => (b.importMagnitudeKgM_1S || 0) - (a.importMagnitudeKgM_1S || 0))[0] || null;
};

const computeDirectionalExportSigma = (interfaceSummary, fieldName, direction = 'northward') => {
  let numerator = 0;
  let denominator = 0;
  for (const level of interfaceSummary?.modelLevels || []) {
    const signedFlux = Number(level?.[fieldName]) || 0;
    const magnitude = direction === 'northward'
      ? Math.max(0, signedFlux)
      : Math.max(0, -signedFlux);
    numerator += (Number(level?.sigmaMid) || 0) * magnitude;
    denominator += magnitude;
  }
  return denominator > 0 ? numerator / denominator : null;
};

const computeRecirculationProxy = (transportTracing, fieldName) => {
  const southBoundaryFlux = sumInterfaceLevelBandField(transportInterfaceByTarget(transportTracing, 22), fieldName);
  const northBoundaryFlux = sumInterfaceLevelBandField(transportInterfaceByTarget(transportTracing, 35), fieldName);
  return Math.max(0, Math.abs(southBoundaryFlux) + Math.abs(northBoundaryFlux) - Math.abs(southBoundaryFlux + northBoundaryFlux));
};

const computeReturnBranchIntensity = (transportTracing, bandKey, direction = 'equatorward') => {
  const band = (transportTracing?.bandLevelMatrix || []).find((entry) => entry?.key === bandKey);
  if (!band) return null;
  const levelBandKeys = ['boundaryLayer', 'lowerTroposphere'];
  const signedFluxes = levelBandKeys
    .map((key) => Number(band?.levelBands?.[key]?.massFluxNorthKgM_1S) || 0);
  if (direction === 'equatorward_nh') {
    return Math.max(...signedFluxes.map((value) => Math.max(0, -value)), 0);
  }
  if (direction === 'equatorward_sh') {
    return Math.max(...signedFluxes.map((value) => Math.max(0, value)), 0);
  }
  return Math.max(...signedFluxes.map((value) => Math.abs(value)), 0);
};

const buildTransportRootCauseAssessment = (latestSample = null) => {
  const transportTracing = latestSample?.transportTracing;
  const metrics = latestSample?.metrics || {};
  const north22 = transportInterfaceByTarget(transportTracing, 22);
  const north35 = transportInterfaceByTarget(transportTracing, 35);
  const southImportVapor = north22 ? Math.max(0, sumInterfaceLevelBandField(north22, 'vaporFluxNorthKgM_1S')) : 0;
  const northImportVapor = north35 ? Math.max(0, -sumInterfaceLevelBandField(north35, 'vaporFluxNorthKgM_1S')) : 0;
  const southImportCloud = north22 ? Math.max(0, sumInterfaceLevelBandField(north22, 'cloudFluxNorthKgM_1S')) : 0;
  const northImportCloud = north35 ? Math.max(0, -sumInterfaceLevelBandField(north35, 'cloudFluxNorthKgM_1S')) : 0;
  const localSourceProxy = (Number(metrics.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceLandRecyclingMeanKgM2) || 0);
  const totalAttributed = localSourceProxy
    + (Number(metrics.northDryBeltSourceTropicalOceanNorthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceTropicalOceanSouthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNorthExtratropicalOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceOtherOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAtmosphericCarryoverMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNudgingInjectionMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAnalysisInjectionMeanKgM2) || 0);
  const importedSourceProxy = Math.max(0, totalAttributed - localSourceProxy);
  const ruledIn = [];
  const ruledOut = [];
  const ambiguous = [];

  if (southImportVapor > northImportVapor * 1.25) {
    ruledIn.push('South-boundary transport across 22° dominates NH dry-belt vapor import.');
    ruledOut.push('NH dry-belt wet bias is not primarily driven by extratropical vapor import across 35°.');
  } else if (northImportVapor > southImportVapor * 1.25) {
    ruledIn.push('North-boundary transport across 35° materially contributes to NH dry-belt vapor import.');
  } else {
    ambiguous.push('North and south boundary vapor imports remain comparable in magnitude.');
  }

  if (southImportCloud > northImportCloud * 1.25) {
    ruledIn.push('Upper-cloud and condensate import from the tropical side is stronger than extratropical cloud import.');
  } else if (northImportCloud > southImportCloud * 1.25) {
    ambiguous.push('Extratropical cloud import remains competitive with tropical-side cloud transport.');
  } else {
    ambiguous.push('Cloud import is split across both NH dry-belt boundaries.');
  }

  if (totalAttributed > 0 && importedSourceProxy / totalAttributed >= 0.6) {
    ruledIn.push('Imported transport clearly outweighs local-source moisture in the NH dry-belt reservoir.');
    ruledOut.push('Local NH subtropical surface source alone cannot explain the wet bias.');
  } else {
    ambiguous.push('Local versus imported low-level source share is not yet decisively one-sided.');
  }

  return { ruledIn, ruledOut, ambiguous };
};

export const buildTransportInterfaceBudgetReport = (latestSample = null) => ({
  schema: 'satellite-wars.transport-interface-budget.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  dominantNhDryBeltVaporImport: findDominantNhDryBeltImport(latestSample?.transportTracing, 'vaporFluxNorthKgM_1S'),
  dominantNhDryBeltCloudImport: findDominantNhDryBeltImport(latestSample?.transportTracing, 'cloudFluxNorthKgM_1S'),
  interfaces: latestSample?.transportTracing?.interfaces || null
});

export const buildBandLevelFluxMatrixReport = (latestSample = null) => ({
  schema: 'satellite-wars.band-level-flux-matrix.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  levelBands: latestSample?.transportTracing?.levelBands || null,
  latitudeBands: latestSample?.transportTracing?.bandLevelMatrix || null
});

export const buildHadleyPartitionSummaryReport = (latestSample = null) => {
  const transportTracing = latestSample?.transportTracing;
  const metrics = latestSample?.metrics || {};
  const north12 = transportInterfaceByTarget(transportTracing, 12);
  const south12 = transportInterfaceByTarget(transportTracing, -12);
  const localSourceProxyKgM2 = (Number(metrics.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceLandRecyclingMeanKgM2) || 0);
  const attributedTotalKgM2 = localSourceProxyKgM2
    + (Number(metrics.northDryBeltSourceTropicalOceanNorthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceTropicalOceanSouthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNorthExtratropicalOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceOtherOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAtmosphericCarryoverMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNudgingInjectionMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAnalysisInjectionMeanKgM2) || 0);
  const importedSourceProxyKgM2 = Math.max(0, attributedTotalKgM2 - localSourceProxyKgM2);
  return {
    schema: 'satellite-wars.hadley-partition-summary.v1',
    generatedAt: new Date().toISOString(),
    targetDay: latestSample?.targetDay ?? null,
    lowLevelSourcePartition: {
      localSourceProxyKgM2: round(localSourceProxyKgM2, 5),
      importedSourceProxyKgM2: round(importedSourceProxyKgM2, 5),
      localSourceProxyFrac: attributedTotalKgM2 > 0 ? round(localSourceProxyKgM2 / attributedTotalKgM2, 5) : null,
      importedSourceProxyFrac: attributedTotalKgM2 > 0 ? round(importedSourceProxyKgM2 / attributedTotalKgM2, 5) : null
    },
    tropicalExportLevels: {
      northVaporExportSigma: round(computeDirectionalExportSigma(north12, 'vaporFluxNorthKgM_1S', 'northward'), 5),
      northCloudExportSigma: round(computeDirectionalExportSigma(north12, 'cloudFluxNorthKgM_1S', 'northward'), 5),
      southVaporExportSigma: round(computeDirectionalExportSigma(south12, 'vaporFluxNorthKgM_1S', 'southward'), 5),
      southCloudExportSigma: round(computeDirectionalExportSigma(south12, 'cloudFluxNorthKgM_1S', 'southward'), 5)
    },
    returnBranchIntensity: {
      northDryBeltEquatorwardMassFluxKgM_1S: round(computeReturnBranchIntensity(transportTracing, 'northDryBelt', 'equatorward_nh'), 5),
      southDryBeltEquatorwardMassFluxKgM_1S: round(computeReturnBranchIntensity(transportTracing, 'southDryBelt', 'equatorward_sh'), 5)
    },
    northDryBeltTransport: {
      dominantVaporImport: findDominantNhDryBeltImport(transportTracing, 'vaporFluxNorthKgM_1S'),
      dominantCloudImport: findDominantNhDryBeltImport(transportTracing, 'cloudFluxNorthKgM_1S'),
      vaporRecirculationProxyKgM_1S: round(computeRecirculationProxy(transportTracing, 'vaporFluxNorthKgM_1S'), 5),
      cloudRecirculationProxyKgM_1S: round(computeRecirculationProxy(transportTracing, 'cloudFluxNorthKgM_1S'), 5)
    },
    streamfunctionProxy: transportTracing?.streamfunctionProxy || null,
    rootCauseAssessment: buildTransportRootCauseAssessment(latestSample)
  };
};

const compactTransportSummary = (sample = null) => {
  if (!sample?.transportTracing) return null;
  return {
    dominantNhDryBeltVaporImport: findDominantNhDryBeltImport(sample.transportTracing, 'vaporFluxNorthKgM_1S'),
    dominantNhDryBeltCloudImport: findDominantNhDryBeltImport(sample.transportTracing, 'cloudFluxNorthKgM_1S')
  };
};

const dominantVerticalCloudBirthChannel = (verticalCloudBirthTracing = null) => {
  const channels = verticalCloudBirthTracing?.attribution?.northDryBeltChannelMeansKgM2 || null;
  if (!channels) return null;
  const [key, value] = Object.entries(channels)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))[0] || [];
  return key ? { key, meanKgM2: round(value, 5) } : null;
};

export const buildVerticalCloudBirthAttributionReport = (latestSample = null) => ({
  schema: 'satellite-wars.vertical-cloud-birth-attribution.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  dominantNhDryBeltChannel: dominantVerticalCloudBirthChannel(latestSample?.verticalCloudBirthTracing),
  attribution: latestSample?.verticalCloudBirthTracing?.attribution || null,
  rootCauseAssessment: latestSample?.verticalCloudBirthTracing?.rootCauseAssessment || null
});

export const buildVerticalCloudBirthHistogramsReport = (latestSample = null) => ({
  schema: 'satellite-wars.vertical-cloud-birth-histograms.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  histograms: latestSample?.verticalCloudBirthTracing?.histograms || null
});

export const buildDryBeltCloudOriginMatrixReport = (latestSample = null) => ({
  schema: 'satellite-wars.dry-belt-cloud-origin-matrix.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  dominantNhDryBeltChannel: dominantVerticalCloudBirthChannel(latestSample?.verticalCloudBirthTracing),
  originMatrix: latestSample?.verticalCloudBirthTracing?.originMatrix || null
});

const compactVerticalCloudBirthSummary = (sample = null) => {
  if (!sample?.verticalCloudBirthTracing) return null;
  return {
    dominantNhDryBeltChannel: dominantVerticalCloudBirthChannel(sample.verticalCloudBirthTracing),
    northDryBeltCarryOverSurvivalFrac: sample.verticalCloudBirthTracing?.attribution?.northDryBeltCarryOverSurvivalFrac ?? null,
    rootCauseAssessment: sample.verticalCloudBirthTracing?.rootCauseAssessment || null
  };
};

export const buildUpperCloudResidenceReport = (latestSample = null) => ({
  schema: 'satellite-wars.upper-cloud-residence.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  ageAttribution: latestSample?.upperCloudResidenceTracing?.ageAttribution || null,
  rootCauseAssessment: latestSample?.upperCloudResidenceTracing?.rootCauseAssessment || null
});

export const buildUpperCloudErosionBudgetReport = (latestSample = null) => ({
  schema: 'satellite-wars.upper-cloud-erosion-budget.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  erosionBudget: latestSample?.upperCloudResidenceTracing?.erosionBudget || null,
  rootCauseAssessment: latestSample?.upperCloudResidenceTracing?.rootCauseAssessment || null
});

export const buildUpperCloudVentilationSummaryReport = (latestSample = null) => ({
  schema: 'satellite-wars.upper-cloud-ventilation-summary.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  ventilation: latestSample?.upperCloudResidenceTracing?.ventilation || null,
  rootCauseAssessment: latestSample?.upperCloudResidenceTracing?.rootCauseAssessment || null
});

const compactUpperCloudResidenceSummary = (sample = null) => {
  if (!sample?.upperCloudResidenceTracing) return null;
  return {
    northDryBeltResidenceMeanDays: sample.upperCloudResidenceTracing?.ageAttribution?.northDryBeltResidenceMeanDays ?? null,
    northDryBeltTimeSinceImportMeanDays: sample.upperCloudResidenceTracing?.ageAttribution?.northDryBeltTimeSinceImportMeanDays ?? null,
    northDryBeltStaleFrac: sample.upperCloudResidenceTracing?.ageAttribution?.northDryBeltStaleFrac ?? null,
    northDryBeltAppliedErosionFrac: sample.upperCloudResidenceTracing?.erosionBudget?.northDryBeltAppliedErosionFrac ?? null,
    northDryBeltBlockedErosionFrac: sample.upperCloudResidenceTracing?.erosionBudget?.northDryBeltBlockedErosionFrac ?? null,
    dominantCloudImport: {
      interfaceTargetLatDeg: sample.upperCloudResidenceTracing?.ventilation?.dominantImportInterfaceTargetLatDeg ?? null,
      north35UpperTroposphereImportMagnitudeKgM_1S: sample.upperCloudResidenceTracing?.ventilation?.north35UpperTroposphereImportMagnitudeKgM_1S ?? null
    },
    rootCauseAssessment: sample.upperCloudResidenceTracing?.rootCauseAssessment || null
  };
};

const compactSampleForSummary = (sample = null) => {
  if (!sample) return sample;
  const { transportTracing, verticalCloudBirthTracing, upperCloudResidenceTracing, ...rest } = sample;
  return {
    ...rest,
    transportTracingSummary: compactTransportSummary(sample),
    verticalCloudBirthTracingSummary: compactVerticalCloudBirthSummary(sample),
    upperCloudResidenceTracingSummary: compactUpperCloudResidenceSummary(sample)
  };
};

export const buildRestartParityReport = ({ checkpointDay = null, referenceSamples = [], resumedSamples = [] } = {}) => {
  const compareKeys = [
    'subtropicalDryNorthRatio',
    'subtropicalDrySouthRatio',
    'itczWidthDeg',
    'subtropicalSubsidenceNorthMean',
    'subtropicalSubsidenceSouthMean',
    'tropicalTradesNorthU10Ms',
    'midlatitudeWesterliesNorthU10Ms'
  ];
  const byDay = new Map(referenceSamples.map((sample) => [sample.targetDay, sample]));
  const comparisons = [];
  let maxAbsMetricDelta = 0;
  for (const sample of resumedSamples) {
    const reference = byDay.get(sample.targetDay);
    if (!reference) continue;
    const metricDelta = {};
    for (const key of compareKeys) {
      const delta = (sample.metrics?.[key] || 0) - (reference.metrics?.[key] || 0);
      metricDelta[key] = round(delta, key.includes('KgM2S') ? 5 : 6);
      maxAbsMetricDelta = Math.max(maxAbsMetricDelta, Math.abs(delta));
    }
    comparisons.push({
      targetDay: sample.targetDay,
      metricDelta
    });
  }
  return {
    schema: 'satellite-wars.restart-parity.v1',
    generatedAt: new Date().toISOString(),
    checkpointDay,
    sampleCount: comparisons.length,
    maxAbsMetricDelta: round(maxAbsMetricDelta, 6),
    pass: maxAbsMetricDelta <= 1e-6,
    comparisons
  };
};

const runRestartParityCheck = async ({ configSnapshot, checkpointDay, sampleTargetsDays }) => {
  if (!(checkpointDay > 0)) return null;
  const checkpointSeconds = checkpointDay * SECONDS_PER_DAY;
  const remainingTargets = sampleTargetsDays.filter((day) => day >= checkpointDay);
  if (!remainingTargets.length) return null;

  const parityCore = new WeatherCore5({ nx, ny, dt, seed });
  await parityCore._initPromise;
  applyCoreConfigSnapshot(parityCore, configSnapshot);
  applyHeadlessTerrainFixture(parityCore);
  parityCore.advanceModelSeconds(checkpointSeconds);
  const checkpointSnapshot = parityCore.getStateSnapshot({ mode: 'full' });

  const uninterruptedSamples = [];
  let previousSeconds = checkpointSeconds;
  for (const targetDay of remainingTargets) {
    const targetSeconds = targetDay * SECONDS_PER_DAY;
    const deltaSeconds = Math.max(0, targetSeconds - previousSeconds);
    if (deltaSeconds > 0) parityCore.advanceModelSeconds(deltaSeconds);
    previousSeconds = targetSeconds;
    uninterruptedSamples.push(classifySnapshot(buildValidationDiagnostics(parityCore), targetDay));
  }

  const resumedCore = new WeatherCore5({ nx, ny, dt, seed });
  await resumedCore._initPromise;
  applyCoreConfigSnapshot(resumedCore, configSnapshot);
  applyHeadlessTerrainFixture(resumedCore);
  resumedCore.loadStateSnapshot(checkpointSnapshot);
  const resumedSamples = [];
  previousSeconds = checkpointSeconds;
  for (const targetDay of remainingTargets) {
    const targetSeconds = targetDay * SECONDS_PER_DAY;
    const deltaSeconds = Math.max(0, targetSeconds - previousSeconds);
    if (deltaSeconds > 0) resumedCore.advanceModelSeconds(deltaSeconds);
    previousSeconds = targetSeconds;
    resumedSamples.push(classifySnapshot(buildValidationDiagnostics(resumedCore), targetDay));
  }

  return buildRestartParityReport({
    checkpointDay,
    referenceSamples: uninterruptedSamples,
    resumedSamples
  });
};

export const computeSeasonalityScore = (samples) => {
  const buckets = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    nh: [],
    sh: []
  }));
  for (const sample of samples) {
    const bucket = buckets[sample.monthIndex];
    bucket.nh.push(sample.metrics.tropicalCycloneEnvironmentCountNh || 0);
    bucket.sh.push(sample.metrics.tropicalCycloneEnvironmentCountSh || 0);
  }
  const monthly = buckets.map((bucket) => ({
    monthIndex: bucket.monthIndex,
    month: monthName(bucket.monthIndex),
    nh: round(mean(bucket.nh), 2) ?? 0,
    sh: round(mean(bucket.sh), 2) ?? 0
  }));
  const avg = (indices, key) => mean(indices.map((index) => monthly[index]?.[key] || 0));
  const nhWarm = avg([5, 6, 7, 8], 'nh');
  const nhCool = avg([11, 0, 1], 'nh');
  const shWarm = avg([11, 0, 1], 'sh');
  const shCool = avg([5, 6, 7], 'sh');
  return {
    monthly,
    nhWarmSeasonMean: round(nhWarm),
    nhCoolSeasonMean: round(nhCool),
    shWarmSeasonMean: round(shWarm),
    shCoolSeasonMean: round(shCool),
    nhSeasonalityPass: nhWarm > Math.max(0.1, nhCool * 1.15),
    shSeasonalityPass: shWarm > Math.max(0.1, shCool * 1.15)
  };
};

export const buildMonthlyClimatology = (samples) => {
  const months = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    month: monthName(monthIndex),
    sampleDays: [],
    metrics: {},
    profiles: null
  }));
  const metricAccumulators = months.map(() => new Map());
  const profileAccumulators = months.map(() => []);

  for (const sample of samples) {
    const monthIndex = Number.isFinite(sample?.monthIndex) ? sample.monthIndex : dayToMonthIndex(sample?.targetDay || 0);
    const bucket = months[monthIndex];
    if (!bucket) continue;
    bucket.sampleDays.push(sample.targetDay);
    for (const [key, value] of Object.entries(sample.metrics || {})) {
      if (!Number.isFinite(value)) continue;
      const acc = metricAccumulators[monthIndex].get(key) || { sum: 0, count: 0 };
      acc.sum += value;
      acc.count += 1;
      metricAccumulators[monthIndex].set(key, acc);
    }
    if (sample.profiles?.latitudesDeg?.length && sample.profiles?.series) {
      profileAccumulators[monthIndex].push(sample.profiles);
    }
  }

  for (let monthIndex = 0; monthIndex < months.length; monthIndex += 1) {
    const bucket = months[monthIndex];
    bucket.sampleCount = bucket.sampleDays.length;
    bucket.sampleDays = bucket.sampleDays.map((value) => round(value, 2));
    bucket.metrics = Object.fromEntries(
      [...metricAccumulators[monthIndex].entries()].map(([key, acc]) => [
        key,
        round(acc.sum / Math.max(1, acc.count), key.includes('KgM2S') || key.includes('S_1') ? 5 : 3)
      ])
    );
    bucket.profiles = meanProfiles(profileAccumulators[monthIndex]);
  }
  return months;
};

const buildGapEntry = (warning, horizon) => {
  const metrics = horizon?.latest?.metrics || {};
  const seasonality = horizon?.seasonality || null;
  const entry = {
    code: warning,
    label: warning.replace(/_/g, ' '),
    category: 'other',
    metricKey: null,
    actual: null,
    target: null,
    severity: 0.25,
    horizonsDays: [horizon?.horizonDays].filter(Number.isFinite)
  };
  switch (warning) {
    case 'trade_winds_missing_north':
      entry.label = 'North trade winds too weak or reversed';
      entry.category = 'circulation';
      entry.metricKey = 'tropicalTradesNorthU10Ms';
      entry.actual = metrics.tropicalTradesNorthU10Ms;
      entry.target = '< -0.2 m/s';
      entry.severity = clamp01((Number(metrics.tropicalTradesNorthU10Ms) + 0.2) / 1.5);
      break;
    case 'trade_winds_missing_south':
      entry.label = 'South trade winds too weak or reversed';
      entry.category = 'circulation';
      entry.metricKey = 'tropicalTradesSouthU10Ms';
      entry.actual = metrics.tropicalTradesSouthU10Ms;
      entry.target = '< -0.2 m/s';
      entry.severity = clamp01((Number(metrics.tropicalTradesSouthU10Ms) + 0.2) / 1.5);
      break;
    case 'westerlies_missing_north':
      entry.label = 'North midlatitude westerlies too weak';
      entry.category = 'circulation';
      entry.metricKey = 'midlatitudeWesterliesNorthU10Ms';
      entry.actual = metrics.midlatitudeWesterliesNorthU10Ms;
      entry.target = '> 0.2 m/s';
      entry.severity = clamp01((0.2 - Number(metrics.midlatitudeWesterliesNorthU10Ms)) / 1.5);
      break;
    case 'westerlies_missing_south':
      entry.label = 'South midlatitude westerlies too weak';
      entry.category = 'circulation';
      entry.metricKey = 'midlatitudeWesterliesSouthU10Ms';
      entry.actual = metrics.midlatitudeWesterliesSouthU10Ms;
      entry.target = '> 0.2 m/s';
      entry.severity = clamp01((0.2 - Number(metrics.midlatitudeWesterliesSouthU10Ms)) / 1.5);
      break;
    case 'itcz_out_of_tropical_band':
      entry.label = 'ITCZ displaced out of tropical core';
      entry.category = 'moistureBelts';
      entry.metricKey = 'itczLatDeg';
      entry.actual = metrics.itczLatDeg;
      entry.target = '|lat| <= 12 deg';
      entry.severity = clamp01((Math.abs(Number(metrics.itczLatDeg)) - 12) / 8);
      break;
    case 'itcz_width_unrealistic':
      entry.label = 'ITCZ width unrealistic';
      entry.category = 'moistureBelts';
      entry.metricKey = 'itczWidthDeg';
      entry.actual = metrics.itczWidthDeg;
      entry.target = '6-24 deg';
      entry.severity = clamp01(
        Number(metrics.itczWidthDeg) < 6
          ? (6 - Number(metrics.itczWidthDeg)) / 6
          : (Number(metrics.itczWidthDeg) - 24) / 12
      );
      break;
    case 'north_subtropical_dry_belt_too_wet':
      entry.label = 'North subtropical dry belt too wet';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalDryNorthRatio';
      entry.actual = metrics.subtropicalDryNorthRatio;
      entry.target = '< 0.8';
      entry.severity = clamp01((Number(metrics.subtropicalDryNorthRatio) - 0.8) / 0.5);
      break;
    case 'south_subtropical_dry_belt_too_wet':
      entry.label = 'South subtropical dry belt too wet';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalDrySouthRatio';
      entry.actual = metrics.subtropicalDrySouthRatio;
      entry.target = '< 0.8';
      entry.severity = clamp01((Number(metrics.subtropicalDrySouthRatio) - 0.8) / 0.5);
      break;
    case 'north_subtropical_lower_troposphere_too_humid':
      entry.label = 'North subtropical lower troposphere too humid';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalRhNorthMeanFrac';
      entry.actual = metrics.subtropicalRhNorthMeanFrac;
      entry.target = '< 0.82';
      entry.severity = clamp01((Number(metrics.subtropicalRhNorthMeanFrac) - 0.82) / 0.12);
      break;
    case 'south_subtropical_lower_troposphere_too_humid':
      entry.label = 'South subtropical lower troposphere too humid';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalRhSouthMeanFrac';
      entry.actual = metrics.subtropicalRhSouthMeanFrac;
      entry.target = '< 0.82';
      entry.severity = clamp01((Number(metrics.subtropicalRhSouthMeanFrac) - 0.82) / 0.12);
      break;
    case 'north_subtropical_subsidence_too_weak':
      entry.label = 'North subtropical subsidence drying too weak';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalSubsidenceNorthMean';
      entry.actual = metrics.subtropicalSubsidenceNorthMean;
      entry.target = '> 0.03';
      entry.severity = clamp01((0.03 - Number(metrics.subtropicalSubsidenceNorthMean)) / 0.03);
      break;
    case 'south_subtropical_subsidence_too_weak':
      entry.label = 'South subtropical subsidence drying too weak';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalSubsidenceSouthMean';
      entry.actual = metrics.subtropicalSubsidenceSouthMean;
      entry.target = '> 0.03';
      entry.severity = clamp01((0.03 - Number(metrics.subtropicalSubsidenceSouthMean)) / 0.03);
      break;
    case 'north_storm_track_out_of_range':
      entry.label = 'North storm track misplaced';
      entry.category = 'stormTracks';
      entry.metricKey = 'stormTrackNorthLatDeg';
      entry.actual = metrics.stormTrackNorthLatDeg;
      entry.target = '30-65 deg';
      entry.severity = clamp01(
        Number(metrics.stormTrackNorthLatDeg) < 30
          ? (30 - Number(metrics.stormTrackNorthLatDeg)) / 20
          : (Number(metrics.stormTrackNorthLatDeg) - 65) / 20
      );
      break;
    case 'south_storm_track_out_of_range':
      entry.label = 'South storm track misplaced';
      entry.category = 'stormTracks';
      entry.metricKey = 'stormTrackSouthLatDeg';
      entry.actual = metrics.stormTrackSouthLatDeg;
      entry.target = '-65 to -30 deg';
      entry.severity = clamp01(
        Number(metrics.stormTrackSouthLatDeg) > -30
          ? (Number(metrics.stormTrackSouthLatDeg) + 30) / 20
          : (-65 - Number(metrics.stormTrackSouthLatDeg)) / 20
      );
      break;
    case 'cloud_field_unbalanced':
      entry.label = 'Global cloud field unbalanced';
      entry.category = 'cloudBalance';
      entry.metricKey = 'globalCloudMeanFrac';
      entry.actual = metrics.globalCloudMeanFrac;
      entry.target = '0.15-0.85';
      entry.severity = clamp01(
        Number(metrics.globalCloudMeanFrac) < 0.15
          ? (0.15 - Number(metrics.globalCloudMeanFrac)) / 0.2
          : (Number(metrics.globalCloudMeanFrac) - 0.85) / 0.2
      );
      break;
    case 'runaway_surface_winds':
      entry.label = 'Runaway surface winds';
      entry.category = 'stability';
      entry.metricKey = 'maxWind10mMs';
      entry.actual = metrics.maxWind10mMs;
      entry.target = '<= 120 m/s';
      entry.severity = clamp01((Number(metrics.maxWind10mMs) - 120) / 60);
      break;
    case 'runaway_global_precip':
      entry.label = 'Global precipitation runaway';
      entry.category = 'stability';
      entry.metricKey = 'globalPrecipMeanMmHr';
      entry.actual = metrics.globalPrecipMeanMmHr;
      entry.target = '<= 5 mm/hr';
      entry.severity = clamp01((Number(metrics.globalPrecipMeanMmHr) - 5) / 3);
      break;
    case 'column_water_drift':
      entry.label = 'Column water drift';
      entry.category = 'stability';
      entry.metricKey = 'globalTcwMeanKgM2';
      entry.actual = metrics.globalTcwMeanKgM2;
      entry.target = '5-80 kg/m²';
      entry.severity = clamp01(
        Number(metrics.globalTcwMeanKgM2) < 5
          ? (5 - Number(metrics.globalTcwMeanKgM2)) / 10
          : (Number(metrics.globalTcwMeanKgM2) - 80) / 40
      );
      break;
    case 'north_tropical_cyclone_seasonality_weak':
      entry.label = 'North tropical cyclone seasonality weak';
      entry.category = 'seasonality';
      entry.metricKey = 'nhWarmSeasonMean';
      entry.actual = seasonality?.nhWarmSeasonMean ?? null;
      entry.target = '> nhCoolSeasonMean * 1.15';
      entry.severity = clamp01(
        (Math.max(0.1, Number(seasonality?.nhCoolSeasonMean || 0) * 1.15) - Number(seasonality?.nhWarmSeasonMean || 0)) / 1.5
      );
      break;
    case 'south_tropical_cyclone_seasonality_weak':
      entry.label = 'South tropical cyclone seasonality weak';
      entry.category = 'seasonality';
      entry.metricKey = 'shWarmSeasonMean';
      entry.actual = seasonality?.shWarmSeasonMean ?? null;
      entry.target = '> shCoolSeasonMean * 1.15';
      entry.severity = clamp01(
        (Math.max(0.1, Number(seasonality?.shCoolSeasonMean || 0) * 1.15) - Number(seasonality?.shWarmSeasonMean || 0)) / 1.5
      );
      break;
    default:
      break;
  }
  entry.severity = round(entry.severity, 3) ?? 0.25;
  entry.actual = Number.isFinite(entry.actual) ? round(entry.actual, entry.metricKey?.includes('KgM2S') || entry.metricKey?.includes('S_1') ? 5 : 3) : entry.actual;
  return entry;
};

export const buildRealismGapReport = (horizons) => {
  const aggregated = new Map();
  for (const horizon of horizons) {
    for (const warning of horizon.warnings || []) {
      const next = buildGapEntry(warning, horizon);
      const current = aggregated.get(warning);
      if (!current) {
        aggregated.set(warning, next);
        continue;
      }
      current.horizonsDays = [...new Set([...current.horizonsDays, ...next.horizonsDays])].sort((a, b) => a - b);
      if ((next.severity || 0) >= (current.severity || 0)) {
        aggregated.set(warning, { ...current, ...next, horizonsDays: current.horizonsDays });
      }
    }
  }
  return [...aggregated.values()].sort((a, b) => (b.severity || 0) - (a.severity || 0) || (b.horizonsDays?.[b.horizonsDays.length - 1] || 0) - (a.horizonsDays?.[a.horizonsDays.length - 1] || 0));
};

export const evaluateHorizons = (samples, horizonDays) => {
  const warnings = [];
  const latest = samples.find((sample) => sample.targetDay === horizonDays) || samples[samples.length - 1];
  if (!latest) return { warnings: ['no_samples'], categories: {}, latest: null };
  const { metrics } = latest;
  const optionalPass = (value, predicate) => !Number.isFinite(value) || predicate(value);

  const categories = {
    circulation: metrics.tropicalTradesNorthU10Ms < -0.2
      && metrics.tropicalTradesSouthU10Ms < -0.2
      && metrics.midlatitudeWesterliesNorthU10Ms > 0.2
      && metrics.midlatitudeWesterliesSouthU10Ms > 0.2,
    moistureBelts: Math.abs(metrics.itczLatDeg) <= 12
      && optionalPass(metrics.itczWidthDeg, (value) => value >= 6 && value <= 24)
      && metrics.subtropicalDryNorthRatio < 0.8
      && metrics.subtropicalDrySouthRatio < 0.8
      && optionalPass(metrics.subtropicalRhNorthMeanFrac, (value) => value < 0.82)
      && optionalPass(metrics.subtropicalRhSouthMeanFrac, (value) => value < 0.82)
      && optionalPass(metrics.subtropicalSubsidenceNorthMean, (value) => value > 0.03)
      && optionalPass(metrics.subtropicalSubsidenceSouthMean, (value) => value > 0.03),
    stormTracks: Number.isFinite(metrics.stormTrackNorthLatDeg)
      && Number.isFinite(metrics.stormTrackSouthLatDeg)
      && metrics.stormTrackNorthLatDeg >= 30
      && metrics.stormTrackNorthLatDeg <= 65
      && metrics.stormTrackSouthLatDeg <= -30
      && metrics.stormTrackSouthLatDeg >= -65,
    cloudBalance: metrics.globalCloudMeanFrac >= 0.15 && metrics.globalCloudMeanFrac <= 0.85,
    stability: metrics.maxWind10mMs <= 120
      && metrics.globalPrecipMeanMmHr <= 5
      && metrics.globalTcwMeanKgM2 >= 5
      && metrics.globalTcwMeanKgM2 <= 80
  };

  if (!(metrics.tropicalTradesNorthU10Ms < -0.2)) warnings.push('trade_winds_missing_north');
  if (!(metrics.tropicalTradesSouthU10Ms < -0.2)) warnings.push('trade_winds_missing_south');
  if (!(metrics.midlatitudeWesterliesNorthU10Ms > 0.2)) warnings.push('westerlies_missing_north');
  if (!(metrics.midlatitudeWesterliesSouthU10Ms > 0.2)) warnings.push('westerlies_missing_south');
  if (!(Math.abs(metrics.itczLatDeg) <= 12)) warnings.push('itcz_out_of_tropical_band');
  if (!optionalPass(metrics.itczWidthDeg, (value) => value >= 6 && value <= 24)) warnings.push('itcz_width_unrealistic');
  if (!(metrics.subtropicalDryNorthRatio < 0.8)) warnings.push('north_subtropical_dry_belt_too_wet');
  if (!(metrics.subtropicalDrySouthRatio < 0.8)) warnings.push('south_subtropical_dry_belt_too_wet');
  if (!optionalPass(metrics.subtropicalRhNorthMeanFrac, (value) => value < 0.82)) warnings.push('north_subtropical_lower_troposphere_too_humid');
  if (!optionalPass(metrics.subtropicalRhSouthMeanFrac, (value) => value < 0.82)) warnings.push('south_subtropical_lower_troposphere_too_humid');
  if (!optionalPass(metrics.subtropicalSubsidenceNorthMean, (value) => value > 0.03)) warnings.push('north_subtropical_subsidence_too_weak');
  if (!optionalPass(metrics.subtropicalSubsidenceSouthMean, (value) => value > 0.03)) warnings.push('south_subtropical_subsidence_too_weak');
  if (!(Number.isFinite(metrics.stormTrackNorthLatDeg) && metrics.stormTrackNorthLatDeg >= 30 && metrics.stormTrackNorthLatDeg <= 65)) warnings.push('north_storm_track_out_of_range');
  if (!(Number.isFinite(metrics.stormTrackSouthLatDeg) && metrics.stormTrackSouthLatDeg <= -30 && metrics.stormTrackSouthLatDeg >= -65)) warnings.push('south_storm_track_out_of_range');
  if (!(metrics.globalCloudMeanFrac >= 0.15 && metrics.globalCloudMeanFrac <= 0.85)) warnings.push('cloud_field_unbalanced');
  if (!(metrics.maxWind10mMs <= 120)) warnings.push('runaway_surface_winds');
  if (!(metrics.globalPrecipMeanMmHr <= 5)) warnings.push('runaway_global_precip');
  if (!(metrics.globalTcwMeanKgM2 >= 5 && metrics.globalTcwMeanKgM2 <= 80)) warnings.push('column_water_drift');

  const seasonality = horizonDays >= 180 ? computeSeasonalityScore(samples) : null;
  if (seasonality) {
    categories.seasonality = seasonality.nhSeasonalityPass && seasonality.shSeasonalityPass;
    if (!seasonality.nhSeasonalityPass) warnings.push('north_tropical_cyclone_seasonality_weak');
    if (!seasonality.shSeasonalityPass) warnings.push('south_tropical_cyclone_seasonality_weak');
  }

  return {
    latest,
    categories,
    seasonality,
    warnings,
    overallPass: Object.values(categories).every(Boolean)
  };
};

const renderMarkdown = (summary) => {
  const lines = [
    '# Planetary Realism Status',
    '',
    `Generated: ${summary.generatedAt}`,
    `Preset: ${summary.config.preset}`,
    `Grid: ${summary.config.nx}x${summary.config.ny}`,
    `Model dt: ${summary.config.dtSeconds}s`,
    `Overall verdict: **${summary.overallPass ? 'PASS' : 'FAIL'}**`,
    ''
  ];

  if (summary.headlessTerrain?.source) {
    lines.push(`- Headless terrain source: ${summary.headlessTerrain.source}`);
    lines.push(`- Terrain parity available: ${summary.headlessTerrainParity}`);
    lines.push('');
  }

  for (const horizon of summary.horizons) {
    const latest = horizon.latest;
    if (!latest) continue;
    lines.push(`## ${horizon.horizonDays}-day audit`);
    lines.push('');
    lines.push(`- Pass: **${horizon.overallPass ? 'PASS' : 'FAIL'}**`);
    lines.push(`- ITCZ latitude/width: ${latest.metrics.itczLatDeg} / ${latest.metrics.itczWidthDeg} deg`);
    lines.push(`- Tropical convective fraction/org/mass flux: ${latest.metrics.tropicalConvectiveFraction} / ${latest.metrics.tropicalConvectiveOrganization} / ${latest.metrics.tropicalConvectiveMassFluxKgM2S}`);
    lines.push(`- Subtropical RH (N/S): ${latest.metrics.subtropicalRhNorthMeanFrac} / ${latest.metrics.subtropicalRhSouthMeanFrac}`);
    lines.push(`- North dry-belt land/ocean precip: ${latest.metrics.northDryBeltLandPrecipMeanMmHr} / ${latest.metrics.northDryBeltOceanPrecipMeanMmHr} mm/hr`);
    lines.push(`- North dry-belt land/ocean RH: ${latest.metrics.northDryBeltLandRhMeanFrac} / ${latest.metrics.northDryBeltOceanRhMeanFrac}`);
    lines.push(`- Cross-equatorial / north-transition / north-dry vapor flux: ${latest.metrics.crossEquatorialVaporFluxNorthKgM_1S} / ${latest.metrics.northTransitionVaporFluxNorthKgM_1S} / ${latest.metrics.northDryBeltVaporFluxNorthKgM_1S}`);
    lines.push(`- Subtropical subsidence drying (N/S): ${latest.metrics.subtropicalSubsidenceNorthMean} / ${latest.metrics.subtropicalSubsidenceSouthMean}`);
    lines.push(`- Tropical detrainment/anvil: ${latest.metrics.upperDetrainmentTropicalKgM2} kg/m² / ${latest.metrics.tropicalAnvilPersistenceFrac}`);
    lines.push(`- Tropical trades (N/S): ${latest.metrics.tropicalTradesNorthU10Ms} / ${latest.metrics.tropicalTradesSouthU10Ms} m/s`);
    lines.push(`- Midlatitude westerlies (N/S): ${latest.metrics.midlatitudeWesterliesNorthU10Ms} / ${latest.metrics.midlatitudeWesterliesSouthU10Ms} m/s`);
    lines.push(`- Storm-track peaks (N/S): ${latest.metrics.stormTrackNorthLatDeg} / ${latest.metrics.stormTrackSouthLatDeg} deg`);
    lines.push(`- Dry-belt ratios (N/S): ${latest.metrics.subtropicalDryNorthRatio} / ${latest.metrics.subtropicalDrySouthRatio}`);
    lines.push(`- Tropical cyclone environment counts (N/S): ${latest.metrics.tropicalCycloneEnvironmentCountNh} / ${latest.metrics.tropicalCycloneEnvironmentCountSh}`);
    lines.push(`- Global precip/cloud/tcw/max wind: ${latest.metrics.globalPrecipMeanMmHr} mm/hr / ${latest.metrics.globalCloudMeanFrac} / ${latest.metrics.globalTcwMeanKgM2} kg/m² / ${latest.metrics.maxWind10mMs} m/s`);
    if (horizon.warnings.length) {
      lines.push('- Warnings:');
      horizon.warnings.forEach((warning) => lines.push(`  - ${warning}`));
    } else {
      lines.push('- Warnings: none');
    }
    if (horizon.seasonality) {
      lines.push(`- NH warm/cool tropical cyclone environment: ${horizon.seasonality.nhWarmSeasonMean} / ${horizon.seasonality.nhCoolSeasonMean}`);
      lines.push(`- SH warm/cool tropical cyclone environment: ${horizon.seasonality.shWarmSeasonMean} / ${horizon.seasonality.shCoolSeasonMean}`);
    }
    lines.push('');
  }

  if (summary.realismGaps?.length) {
    lines.push('## Top realism gaps');
    lines.push('');
    summary.realismGaps.slice(0, 8).forEach((gap) => {
      lines.push(`- ${gap.label}: actual ${gap.actual} vs target ${gap.target} (severity ${gap.severity}, horizons ${gap.horizonsDays.join(', ')})`);
    });
    lines.push('');
  }

  if (summary.artifacts) {
    lines.push('## Rich artifacts');
    lines.push('');
    lines.push(`- Monthly climatology JSON: ${summary.artifacts.monthlyClimatologyJsonPath}`);
    lines.push(`- Sample zonal profiles JSON: ${summary.artifacts.sampleProfilesJsonPath}`);
    lines.push(`- Ranked realism gaps JSON: ${summary.artifacts.realismGapsJsonPath}`);
    if (summary.artifacts.moistureAttributionJsonPath) {
      lines.push(`- Moisture attribution JSON: ${summary.artifacts.moistureAttributionJsonPath}`);
    }
    if (summary.artifacts.runManifestJsonPath) {
      lines.push(`- Run manifest JSON: ${summary.artifacts.runManifestJsonPath}`);
    }
    if (summary.artifacts.conservationSummaryJsonPath) {
      lines.push(`- Conservation summary JSON: ${summary.artifacts.conservationSummaryJsonPath}`);
    }
    if (summary.artifacts.restartParityJsonPath) {
      lines.push(`- Restart parity JSON: ${summary.artifacts.restartParityJsonPath}`);
    }
    if (summary.artifacts.surfaceSourceAttributionJsonPath) {
      lines.push(`- Surface source attribution JSON: ${summary.artifacts.surfaceSourceAttributionJsonPath}`);
    }
    if (summary.artifacts.surfaceFluxDecompositionJsonPath) {
      lines.push(`- Surface flux decomposition JSON: ${summary.artifacts.surfaceFluxDecompositionJsonPath}`);
    }
    if (summary.artifacts.nhDryBeltSourceSectorSummaryJsonPath) {
      lines.push(`- NH dry-belt source sector JSON: ${summary.artifacts.nhDryBeltSourceSectorSummaryJsonPath}`);
    }
    lines.push('');
  }

  lines.push('## Default next priorities');
  lines.push('');
  summary.defaultNextPriorities.forEach((priority, index) => {
    lines.push(`${index + 1}. ${priority}`);
  });
  lines.push('');
  return `${lines.join('\n')}\n`;
};

const deriveArtifactBase = () => {
  if (effectiveReportBase) return effectiveReportBase;
  if (outPath) return stripKnownExtension(outPath);
  if (mdOutPath) return stripKnownExtension(mdOutPath);
  return null;
};

export async function main() {
  ensureCyclePlanReady({
    commandName: 'agent:planetary-realism-audit',
    artifactPath: outPath || mdOutPath || (effectiveReportBase ? `${effectiveReportBase}.json` : null),
    allowNoCycle: false,
    requireCycleState: true,
    allowedModes: ['quick', 'seasonal', 'annual', 'live']
  });
  if (typeof process !== 'undefined' && !process.env?.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }
  const sampleTargetsDays = buildSampleTargetsDays(horizonsDays, sampleEveryDays);
  const targetsSeconds = sampleTargetsDays.map((day) => day * SECONDS_PER_DAY);
  const core = new WeatherCore5({ nx, ny, dt, seed });
  await core._initPromise;
  const terrainFallback = applyHeadlessTerrainFixture(core);
  const configSnapshot = cloneConfigSnapshot(core);

  const samples = [];
  const timingByTarget = [];
  let previousSeconds = 0;
  for (const targetSeconds of targetsSeconds) {
    const startedAt = Date.now();
    const deltaSeconds = Math.max(0, targetSeconds - previousSeconds);
    if (deltaSeconds > 0) core.advanceModelSeconds(deltaSeconds);
    previousSeconds = targetSeconds;
    const diagnostics = buildValidationDiagnostics(core);
    samples.push(classifySnapshot(diagnostics, targetSeconds / SECONDS_PER_DAY));
    timingByTarget.push({
      targetDay: targetSeconds / SECONDS_PER_DAY,
      elapsedMs: Date.now() - startedAt
    });
  }

  const horizonSummaries = horizonsDays.map((horizonDaysValue) => {
    const horizonSamples = samples.filter((sample) => sample.targetDay <= horizonDaysValue);
    return {
      horizonDays: horizonDaysValue,
      ...evaluateHorizons(horizonSamples, horizonDaysValue),
      sampleCount: horizonSamples.length
    };
  });

  const overallPass = horizonSummaries.every((horizon) => horizon.overallPass);
  const defaultNextPriorities = [];
  const failedCategories = new Set();
  for (const horizon of horizonSummaries) {
    Object.entries(horizon.categories).forEach(([category, pass]) => {
      if (!pass) failedCategories.add(category);
    });
  }
  if (failedCategories.has('circulation')) defaultNextPriorities.push('Fix large-scale circulation and jet placement before returning to more mountain-only tuning.');
  if (failedCategories.has('stormTracks')) defaultNextPriorities.push('Improve storm organization and cyclone-support structure using the planetary audit, not only orographic ratios.');
  if (failedCategories.has('moistureBelts')) defaultNextPriorities.push('Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.');
  if (failedCategories.has('seasonality')) defaultNextPriorities.push('Run a seasonal or annual tropical-cyclone-environment audit and target the hemisphere/season that fails.');
  if (failedCategories.has('stability')) defaultNextPriorities.push('Stabilize multi-day drift and runaway tendencies before claiming any world-class improvement.');
  if (failedCategories.has('cloudBalance')) defaultNextPriorities.push('Re-audit cloud realism and cloud-belt structure instead of assuming precipitation fixes alone are enough.');
  if (!defaultNextPriorities.length) {
    defaultNextPriorities.push('Broaden live verification and polished-performance re-audits now that the offline planetary realism gates are healthy.');
  }
  const monthlyClimatology = buildMonthlyClimatology(samples);
  const realismGaps = buildRealismGapReport(horizonSummaries);
  const latestSample = horizonSummaries[horizonSummaries.length - 1]?.latest || samples[samples.length - 1] || null;
  const moistureAttribution = buildMoistureAttributionReport(latestSample?.processMoistureBudget, latestSample?.metrics);
  const runManifest = buildRunManifest({ core, terrainFallback, sampleTargetsDays, targetsSeconds });
  const conservationSummary = buildConservationSummary({ core });
  const surfaceSourceAttribution = buildSurfaceSourceAttributionReport(latestSample);
  const surfaceFluxDecomposition = buildSurfaceFluxDecompositionReport(latestSample);
  const nhDryBeltSourceSectorSummary = buildNhDryBeltSourceSectorReport(latestSample);
  const transportInterfaceBudget = buildTransportInterfaceBudgetReport(latestSample);
  const hadleyPartitionSummary = buildHadleyPartitionSummaryReport(latestSample);
  const bandLevelFluxMatrix = buildBandLevelFluxMatrixReport(latestSample);
  const verticalCloudBirthAttribution = buildVerticalCloudBirthAttributionReport(latestSample);
  const verticalCloudBirthHistograms = buildVerticalCloudBirthHistogramsReport(latestSample);
  const dryBeltCloudOriginMatrix = buildDryBeltCloudOriginMatrixReport(latestSample);
  const upperCloudResidence = buildUpperCloudResidenceReport(latestSample);
  const upperCloudErosionBudget = buildUpperCloudErosionBudgetReport(latestSample);
  const upperCloudVentilationSummary = buildUpperCloudVentilationSummaryReport(latestSample);
  const checkpointDay = sampleTargetsDays.find((day) => day > 0 && day < sampleTargetsDays[sampleTargetsDays.length - 1])
    || sampleTargetsDays[Math.max(0, Math.floor(sampleTargetsDays.length / 2))] || null;
  const restartParity = reproCheck
    ? await runRestartParityCheck({ configSnapshot, checkpointDay, sampleTargetsDays })
    : null;
  const artifactBase = deriveArtifactBase();
  const artifacts = artifactBase ? {
    monthlyClimatologyJsonPath: `${artifactBase}-monthly-climatology.json`,
    sampleProfilesJsonPath: `${artifactBase}-sample-profiles.json`,
    realismGapsJsonPath: `${artifactBase}-realism-gaps.json`,
    moistureAttributionJsonPath: `${artifactBase}-moisture-attribution.json`,
    runManifestJsonPath: `${artifactBase}-run-manifest.json`,
    conservationSummaryJsonPath: `${artifactBase}-conservation-summary.json`,
    restartParityJsonPath: `${artifactBase}-restart-parity.json`,
    surfaceSourceAttributionJsonPath: `${artifactBase}-surface-source-tracers.json`,
    surfaceFluxDecompositionJsonPath: `${artifactBase}-surface-flux-decomposition.json`,
    nhDryBeltSourceSectorSummaryJsonPath: `${artifactBase}-nh-dry-belt-source-sector-summary.json`,
    transportInterfaceBudgetJsonPath: `${artifactBase}-transport-interface-budget.json`,
    hadleyPartitionSummaryJsonPath: `${artifactBase}-hadley-partition-summary.json`,
    bandLevelFluxMatrixJsonPath: `${artifactBase}-band-level-flux-matrix.json`,
    verticalCloudBirthAttributionJsonPath: `${artifactBase}-vertical-cloud-birth-attribution.json`,
    verticalCloudBirthHistogramsJsonPath: `${artifactBase}-vertical-cloud-birth-histograms.json`,
    dryBeltCloudOriginMatrixJsonPath: `${artifactBase}-dry-belt-cloud-origin-matrix.json`,
    upperCloudResidenceJsonPath: `${artifactBase}-upper-cloud-residence.json`,
    upperCloudErosionBudgetJsonPath: `${artifactBase}-upper-cloud-erosion-budget.json`,
    upperCloudVentilationSummaryJsonPath: `${artifactBase}-upper-cloud-ventilation-summary.json`
  } : null;
  const summarySamples = samples.map((sample) => compactSampleForSummary(sample));
  const summaryHorizons = horizonSummaries.map((horizon) => ({
    ...horizon,
    latest: compactSampleForSummary(horizon.latest)
  }));

  const summary = {
    schema: 'satellite-wars.planetary-realism-audit.v2',
    generatedAt: new Date().toISOString(),
    overallPass,
    config: {
      preset,
      nx,
      ny,
      dtSeconds: dt,
      seed,
      sampleEveryDays,
      horizonsDays
    },
    headlessTerrain: terrainFallback,
    headlessTerrainParity: Boolean(terrainFallback?.after?.terrainSampleCount > 0),
    timings: timingByTarget,
    samples: summarySamples,
    monthlyClimatology,
    horizons: summaryHorizons,
    realismGaps,
    moistureAttribution,
    runManifest,
    conservationSummary,
    restartParity,
    surfaceSourceAttribution,
    surfaceFluxDecomposition,
    nhDryBeltSourceSectorSummary,
    transportInterfaceBudget,
    hadleyPartitionSummary,
    bandLevelFluxMatrix,
    verticalCloudBirthAttribution,
    verticalCloudBirthHistograms,
    dryBeltCloudOriginMatrix,
    upperCloudResidence,
    upperCloudErosionBudget,
    upperCloudVentilationSummary,
    artifacts,
    defaultNextPriorities
  };

  const markdown = renderMarkdown(summary);
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, toJson(summary));
  }
  if (mdOutPath) {
    fs.mkdirSync(path.dirname(mdOutPath), { recursive: true });
    fs.writeFileSync(mdOutPath, markdown);
  }
  if (effectiveReportBase) {
    fs.mkdirSync(path.dirname(effectiveReportBase), { recursive: true });
    fs.writeFileSync(`${effectiveReportBase}.json`, toJson(summary));
    fs.writeFileSync(`${effectiveReportBase}.md`, markdown);
  }
  if (artifacts) {
    fs.mkdirSync(path.dirname(artifacts.monthlyClimatologyJsonPath), { recursive: true });
    fs.writeFileSync(artifacts.monthlyClimatologyJsonPath, toJson(monthlyClimatology));
    fs.writeFileSync(
      artifacts.sampleProfilesJsonPath,
      toJson(samples.map((sample) => ({
        targetDay: sample.targetDay,
        monthIndex: sample.monthIndex,
        profiles: sample.profiles
      })))
    );
    fs.writeFileSync(artifacts.realismGapsJsonPath, toJson(realismGaps));
    fs.writeFileSync(artifacts.moistureAttributionJsonPath, toJson(moistureAttribution));
    fs.writeFileSync(artifacts.runManifestJsonPath, toJson(runManifest));
    fs.writeFileSync(artifacts.conservationSummaryJsonPath, toJson(conservationSummary));
    fs.writeFileSync(artifacts.restartParityJsonPath, toJson(restartParity));
    fs.writeFileSync(artifacts.surfaceSourceAttributionJsonPath, toJson(surfaceSourceAttribution));
    fs.writeFileSync(artifacts.surfaceFluxDecompositionJsonPath, toJson(surfaceFluxDecomposition));
    fs.writeFileSync(artifacts.nhDryBeltSourceSectorSummaryJsonPath, toJson(nhDryBeltSourceSectorSummary));
    fs.writeFileSync(artifacts.transportInterfaceBudgetJsonPath, toJson(transportInterfaceBudget));
    fs.writeFileSync(artifacts.hadleyPartitionSummaryJsonPath, toJson(hadleyPartitionSummary));
    fs.writeFileSync(artifacts.bandLevelFluxMatrixJsonPath, toJson(bandLevelFluxMatrix));
    fs.writeFileSync(artifacts.verticalCloudBirthAttributionJsonPath, toJson(verticalCloudBirthAttribution));
    fs.writeFileSync(artifacts.verticalCloudBirthHistogramsJsonPath, toJson(verticalCloudBirthHistograms));
    fs.writeFileSync(artifacts.dryBeltCloudOriginMatrixJsonPath, toJson(dryBeltCloudOriginMatrix));
    fs.writeFileSync(artifacts.upperCloudResidenceJsonPath, toJson(upperCloudResidence));
    fs.writeFileSync(artifacts.upperCloudErosionBudgetJsonPath, toJson(upperCloudErosionBudget));
    fs.writeFileSync(artifacts.upperCloudVentilationSummaryJsonPath, toJson(upperCloudVentilationSummary));
  }
  process.stdout.write(toJson(summary));
  return summary;
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  buildConservationSummary,
  PLANETARY_PRESETS,
  buildMoistureAttributionReport,
  buildNhDryBeltSourceSectorReport,
  buildRestartParityReport,
  buildSampleTargetsDays,
  buildRunManifest,
  buildMonthlyClimatology,
  buildRealismGapReport,
  buildTransportInterfaceBudgetReport,
  buildHadleyPartitionSummaryReport,
  buildBandLevelFluxMatrixReport,
  buildVerticalCloudBirthAttributionReport,
  buildVerticalCloudBirthHistogramsReport,
  buildDryBeltCloudOriginMatrixReport,
  buildUpperCloudResidenceReport,
  buildUpperCloudErosionBudgetReport,
  buildUpperCloudVentilationSummaryReport,
  buildSurfaceFluxDecompositionReport,
  buildSurfaceSourceAttributionReport,
  classifySnapshot,
  computeSeasonalityScore,
  dayToMonthIndex,
  evaluateHorizons,
  peakLatitude,
  weightedBandCentroid,
  weightedBandMean,
  zonalMean
};
