#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { WeatherCore5 } from '../../src/weather/v2/core5.js';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { ensureCyclePlanReady } from './plan-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = process.argv.slice(2);
let targets = [75600, 105480];
let outPath = null;
let seed = 12345;
let overrides = {};
let overridesFile = null;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--targets' && argv[i + 1]) {
    targets = argv[++i].split(',').map((value) => Number(value.trim())).filter(Number.isFinite);
  } else if (arg.startsWith('--targets=')) {
    targets = arg.slice('--targets='.length).split(',').map((value) => Number(value.trim())).filter(Number.isFinite);
  } else if (arg === '--out' && argv[i + 1]) {
    outPath = path.resolve(argv[++i]);
  } else if (arg.startsWith('--out=')) {
    outPath = path.resolve(arg.slice('--out='.length));
  } else if (arg === '--seed' && argv[i + 1]) {
    seed = Number.parseInt(argv[++i], 10);
  } else if (arg.startsWith('--seed=')) {
    seed = Number.parseInt(arg.slice('--seed='.length), 10);
  } else if (arg === '--overrides-json' && argv[i + 1]) {
    overrides = JSON.parse(argv[++i]);
  } else if (arg.startsWith('--overrides-json=')) {
    overrides = JSON.parse(arg.slice('--overrides-json='.length));
  } else if (arg === '--overrides-file' && argv[i + 1]) {
    overridesFile = path.resolve(argv[++i]);
  } else if (arg.startsWith('--overrides-file=')) {
    overridesFile = path.resolve(arg.slice('--overrides-file='.length));
  }
}

if (overridesFile) {
  overrides = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
}

ensureCyclePlanReady({
  commandName: 'agent:orographic-audit',
  artifactPath: outPath,
  allowNoCycle: true
});

targets = [...new Set(targets)].filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
if (!targets.length) targets = [75600, 105480];
if (!Number.isFinite(seed)) seed = 12345;

const normLon = (lon) => ((lon + 540) % 360) - 180;
const inLonRange = (lon, a, b) => {
  lon = normLon(lon);
  a = normLon(a);
  b = normLon(b);
  if (a <= b) return lon >= a && lon <= b;
  return lon >= a || lon <= b;
};

const mean = (entries, selector) => (
  entries.length
    ? entries.reduce((sum, entry) => sum + selector(entry), 0) / entries.length
    : 0
);

const minValue = (entries, selector) => (
  entries.length
    ? entries.reduce((best, entry) => Math.min(best, selector(entry)), Infinity)
    : 0
);

const maxValue = (entries, selector) => (
  entries.length
    ? entries.reduce((best, entry) => Math.max(best, selector(entry)), -Infinity)
    : 0
);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const P0 = 100000;
const KAPPA = 287.05 / 1004;
const G = 9.81;
const RD = 287.05;
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function prepareAtomicJsonOutput(outFilePath, metadata = {}) {
  if (!outFilePath) return null;
  const finalPath = path.resolve(outFilePath);
  const tempPath = `${finalPath}.tmp`;
  const runningPath = `${finalPath}.running.json`;
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  fs.rmSync(tempPath, { force: true });
  fs.rmSync(finalPath, { force: true });
  fs.writeFileSync(runningPath, toJson({
    schema: 'satellite-wars.orographic-audit.running.v1',
    status: 'running',
    startedAt: new Date().toISOString(),
    outPath: finalPath,
    ...metadata
  }));
  return { finalPath, tempPath, runningPath };
}

export function commitAtomicJsonOutput(outputState, value) {
  if (!outputState) return;
  fs.writeFileSync(outputState.tempPath, toJson(value));
  fs.renameSync(outputState.tempPath, outputState.finalPath);
  fs.rmSync(outputState.runningPath, { force: true });
}

export function failAtomicJsonOutput(outputState, error) {
  if (!outputState) return;
  fs.rmSync(outputState.tempPath, { force: true });
  const message = error instanceof Error ? error.message : String(error);
  fs.writeFileSync(outputState.runningPath, toJson({
    schema: 'satellite-wars.orographic-audit.running.v1',
    status: 'failed',
    failedAt: new Date().toISOString(),
    outPath: outputState.finalPath,
    error: message
  }));
}

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

const getRhLow = ({ fields, state, k, idxS }) => {
  if (fields?.RH && Number.isFinite(fields.RH[k])) {
    return fields.RH[k];
  }
  const p = Math.max(20000, state.pMid[idxS]);
  const theta = state.theta?.[idxS];
  const T = Number.isFinite(state.T?.[idxS])
    ? state.T[idxS]
    : Number.isFinite(theta)
      ? theta * Math.pow(p / P0, KAPPA)
      : NaN;
  if (!Number.isFinite(T)) return 0;
  const qs = saturationMixingRatio(T, p);
  return clamp(state.qv[idxS] / Math.max(1e-8, qs), 0, 2);
};

const applyOverrides = (core, nextOverrides) => {
  const buckets = [
    'vertParams',
    'microParams',
    'surfaceParams',
    'dynParams',
    'nudgeParams',
    'windNudgeParams',
    'windEddyParams',
    'diagParams'
  ];
  for (const bucket of buckets) {
    if (nextOverrides?.[bucket] && typeof nextOverrides[bucket] === 'object') {
      Object.assign(core[bucket], nextOverrides[bucket]);
    }
  }
};

const summarizeGroup = (entries) => ({
  count: entries.length,
  latMean: mean(entries, (entry) => entry.lat),
  lonMean: mean(entries, (entry) => entry.lon),
  latMin: minValue(entries, (entry) => entry.lat),
  latMax: maxValue(entries, (entry) => entry.lat),
  lonMin: minValue(entries, (entry) => entry.lon),
  lonMax: maxValue(entries, (entry) => entry.lon),
  terrainFlowMean: mean(entries, (entry) => entry.upslope),
  moistureFluxNormalMean: mean(entries, (entry) => entry.moistureFluxNormal),
  precipMean: mean(entries, (entry) => entry.precip),
  cloudMean: mean(entries, (entry) => entry.cloudLow),
  qcLowMean: mean(entries, (entry) => entry.qcLow),
  qrLowMean: mean(entries, (entry) => entry.qrLow),
  qvLowMean: mean(entries, (entry) => entry.qvLow),
  rhLowMean: mean(entries, (entry) => entry.rhLow),
  soilFracMean: mean(entries, (entry) => entry.soilFrac),
  pLowMean: mean(entries, (entry) => entry.pLow),
  elevMean: mean(entries, (entry) => entry.elev),
  slopeMagMean: mean(entries, (entry) => entry.slopeMag),
  slopeFactorMean: mean(entries, (entry) => entry.slopeFactor),
  terrainOmegaLowMean: mean(entries, (entry) => entry.terrainOmegaLow),
  terrainOmegaSurfaceMean: mean(entries, (entry) => entry.terrainOmegaSurface),
  omegaLowResidualMean: mean(entries, (entry) => entry.omegaLowResidual),
  omegaSurfaceResidualMean: mean(entries, (entry) => entry.omegaSurfaceResidual),
  omegaLowMean: mean(entries, (entry) => entry.omegaLow),
  omegaSurfaceMean: mean(entries, (entry) => entry.omegaSurface)
});

export function summarizeCore(core, targetSeconds) {
  const { grid, state, fields, geo } = core;
  const { nx, ny, invDx, invDy, latDeg, lonDeg } = grid;
  const { N, nz, u, v, qv, qc, qr, pMid, soilW, soilCap, omega } = state;
  const levS = nz - 1;
  const elev = geo.elev;
  const precip = fields.precipRate || state.precipRate;
  const cloudLow = fields.cloudLow;
  const orographicLiftScale = Number.isFinite(core?.vertParams?.orographicLiftScale)
    ? core.vertParams.orographicLiftScale
    : 1.0;
  const orographicDecayFrac = Number.isFinite(core?.vertParams?.orographicDecayFrac)
    ? core.vertParams.orographicDecayFrac
    : 0.35;
  const terrainSlopeRef = Number.isFinite(core?.vertParams?.terrainSlopeRef)
    ? core.vertParams.terrainSlopeRef
    : 0.003;
  const terrainSlopeExponent = Number.isFinite(core?.vertParams?.terrainSlopeExponent)
    ? core.vertParams.terrainSlopeExponent
    : 0.6;

  const terrain = [];
  const regions = [
    { name: 'Andes', lat0: -50, lat1: -15, lon0: -78, lon1: -64, entries: [] },
    { name: 'Rockies', lat0: 32, lat1: 58, lon0: -128, lon1: -104, entries: [] },
    { name: 'Himalaya-Tibet', lat0: 25, lat1: 40, lon0: 70, lon1: 105, entries: [] }
  ];

  for (let j = 0; j < ny; j += 1) {
    const row = j * nx;
    const jN = Math.max(0, j - 1);
    const jS = Math.min(ny - 1, j + 1);
    const rowN = jN * nx;
    const rowS = jS * nx;
    const invDxRow = invDx[j];
    const invDyRow = invDy[j];
    for (let i = 0; i < nx; i += 1) {
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const k = row + i;
      const slopeX = (elev[row + iE] - elev[row + iW]) * 0.5 * invDxRow;
      const slopeY = (elev[rowN + i] - elev[rowS + i]) * 0.5 * invDyRow;
      const slopeMag = Math.hypot(slopeX, slopeY);
      if (elev[k] < 1000 || slopeMag < 0.001) continue;

      const idxS = levS * N + k;
      const cap = soilCap[k];
      const soilFrac = cap > 1e-6 ? soilW[k] / cap : 0;
      const terrainFlow = u[idxS] * slopeX + v[idxS] * slopeY;
      const slopeRatio = Math.max(0, slopeMag / Math.max(1e-6, terrainSlopeRef));
      const slopeFactor = clamp(Math.pow(slopeRatio, Math.max(0.25, terrainSlopeExponent)), 0, 3);
      const nearSurfaceT = Math.max(180, state.T?.[idxS] ?? 0);
      const rho = Math.max(0.2, pMid[idxS] / Math.max(1e-6, RD * nearSurfaceT));
      const terrainOmegaSurface = -rho * G * terrainFlow * slopeFactor * orographicLiftScale;
      const terrainOmegaLow = terrainOmegaSurface * Math.exp(-orographicDecayFrac);
      const omegaLow = omega[levS * N + k];
      const omegaSurface = omega[nz * N + k];
      const entry = {
        upslope: terrainFlow,
        moistureFluxNormal: terrainFlow * qv[idxS],
        precip: precip[k],
        cloudLow: cloudLow[k],
        qcLow: qc[idxS],
        qrLow: qr[idxS],
        qvLow: qv[idxS],
        rhLow: getRhLow({ fields, state, k, idxS }),
        soilFrac,
        pLow: pMid[idxS],
        elev: elev[k],
        slopeMag,
        slopeFactor,
        terrainOmegaLow,
        terrainOmegaSurface,
        omegaLowResidual: omegaLow - terrainOmegaLow,
        omegaSurfaceResidual: omegaSurface - terrainOmegaSurface,
        omegaLow,
        omegaSurface,
        lat: latDeg[j],
        lon: normLon(lonDeg[i])
      };
      terrain.push(entry);
      for (const region of regions) {
        if (entry.lat >= region.lat0 && entry.lat <= region.lat1 && inLonRange(entry.lon, region.lon0, region.lon1)) {
          region.entries.push(entry);
        }
      }
    }
  }

  terrain.sort((a, b) => a.upslope - b.upslope);
  const q10 = terrain[Math.floor(0.10 * Math.max(0, terrain.length - 1))]?.upslope ?? 0;
  const q90 = terrain[Math.floor(0.90 * Math.max(0, terrain.length - 1))]?.upslope ?? 0;
  const low = terrain.filter((entry) => entry.upslope <= q10);
  const high = terrain.filter((entry) => entry.upslope >= q90);

  const summarizeRegion = (region) => {
    if (!region.entries.length) return { name: region.name, count: 0 };
    const sorted = [...region.entries].sort((a, b) => a.upslope - b.upslope);
    const q25 = sorted[Math.floor(0.25 * Math.max(0, sorted.length - 1))]?.upslope ?? 0;
    const q75 = sorted[Math.floor(0.75 * Math.max(0, sorted.length - 1))]?.upslope ?? 0;
    const downslope = sorted.filter((entry) => entry.upslope <= q25);
    const upslope = sorted.filter((entry) => entry.upslope >= q75);
    return {
      name: region.name,
      count: region.entries.length,
      terrainFlowQuantiles: { q25, q75 },
      upslope: summarizeGroup(upslope),
      downslope: summarizeGroup(downslope),
      precipRatio: mean(upslope, (entry) => entry.precip) / Math.max(1e-6, mean(downslope, (entry) => entry.precip)),
      cloudRatio: mean(upslope, (entry) => entry.cloudLow) / Math.max(1e-6, mean(downslope, (entry) => entry.cloudLow)),
      qcLowRatio: mean(upslope, (entry) => entry.qcLow) / Math.max(1e-9, mean(downslope, (entry) => entry.qcLow)),
      qrLowRatio: mean(upslope, (entry) => entry.qrLow) / Math.max(1e-9, mean(downslope, (entry) => entry.qrLow)),
      qvLowRatio: mean(upslope, (entry) => entry.qvLow) / Math.max(1e-9, mean(downslope, (entry) => entry.qvLow)),
      rhLowRatio: mean(upslope, (entry) => entry.rhLow) / Math.max(1e-9, mean(downslope, (entry) => entry.rhLow)),
      soilFracRatio: mean(upslope, (entry) => entry.soilFrac) / Math.max(1e-9, mean(downslope, (entry) => entry.soilFrac)),
      pLowRatio: mean(upslope, (entry) => entry.pLow) / Math.max(1e-9, mean(downslope, (entry) => entry.pLow)),
      elevRatio: mean(upslope, (entry) => entry.elev) / Math.max(1e-9, mean(downslope, (entry) => entry.elev)),
      terrainFlowContrast: mean(upslope, (entry) => entry.upslope) - mean(downslope, (entry) => entry.upslope),
      moistureFluxNormalContrast: mean(upslope, (entry) => entry.moistureFluxNormal) - mean(downslope, (entry) => entry.moistureFluxNormal),
      terrainOmegaLowContrast: mean(upslope, (entry) => entry.terrainOmegaLow) - mean(downslope, (entry) => entry.terrainOmegaLow),
      terrainOmegaSurfaceContrast: mean(upslope, (entry) => entry.terrainOmegaSurface) - mean(downslope, (entry) => entry.terrainOmegaSurface),
      omegaLowResidualContrast: mean(upslope, (entry) => entry.omegaLowResidual) - mean(downslope, (entry) => entry.omegaLowResidual),
      omegaSurfaceResidualContrast: mean(upslope, (entry) => entry.omegaSurfaceResidual) - mean(downslope, (entry) => entry.omegaSurfaceResidual),
      omegaLowContrast: mean(upslope, (entry) => entry.omegaLow) - mean(downslope, (entry) => entry.omegaLow),
      omegaSurfaceContrast: mean(upslope, (entry) => entry.omegaSurface) - mean(downslope, (entry) => entry.omegaSurface)
    };
  };

  return {
    targetSeconds,
    timeUTC: core.timeUTC,
    global: {
      terrainSampleCount: terrain.length,
      terrainFlowQuantiles: { q10, q90 },
      precipUpslopeVsDownslope: mean(high, (entry) => entry.precip) / Math.max(1e-6, mean(low, (entry) => entry.precip)),
      cloudUpslopeVsDownslope: mean(high, (entry) => entry.cloudLow) / Math.max(1e-6, mean(low, (entry) => entry.cloudLow)),
      qcLowUpslopeVsDownslope: mean(high, (entry) => entry.qcLow) / Math.max(1e-9, mean(low, (entry) => entry.qcLow)),
      qrLowUpslopeVsDownslope: mean(high, (entry) => entry.qrLow) / Math.max(1e-9, mean(low, (entry) => entry.qrLow)),
      qvLowUpslopeVsDownslope: mean(high, (entry) => entry.qvLow) / Math.max(1e-9, mean(low, (entry) => entry.qvLow)),
      rhLowUpslopeVsDownslope: mean(high, (entry) => entry.rhLow) / Math.max(1e-9, mean(low, (entry) => entry.rhLow)),
      soilFracUpslopeVsDownslope: mean(high, (entry) => entry.soilFrac) / Math.max(1e-9, mean(low, (entry) => entry.soilFrac)),
      pLowUpslopeVsDownslope: mean(high, (entry) => entry.pLow) / Math.max(1e-9, mean(low, (entry) => entry.pLow)),
      elevUpslopeVsDownslope: mean(high, (entry) => entry.elev) / Math.max(1e-9, mean(low, (entry) => entry.elev)),
      terrainFlowContrast: mean(high, (entry) => entry.upslope) - mean(low, (entry) => entry.upslope),
      moistureFluxNormalContrast: mean(high, (entry) => entry.moistureFluxNormal) - mean(low, (entry) => entry.moistureFluxNormal),
      terrainOmegaLowContrast: mean(high, (entry) => entry.terrainOmegaLow) - mean(low, (entry) => entry.terrainOmegaLow),
      terrainOmegaSurfaceContrast: mean(high, (entry) => entry.terrainOmegaSurface) - mean(low, (entry) => entry.terrainOmegaSurface),
      omegaLowResidualContrast: mean(high, (entry) => entry.omegaLowResidual) - mean(low, (entry) => entry.omegaLowResidual),
      omegaSurfaceResidualContrast: mean(high, (entry) => entry.omegaSurfaceResidual) - mean(low, (entry) => entry.omegaSurfaceResidual),
      omegaLowContrast: mean(high, (entry) => entry.omegaLow) - mean(low, (entry) => entry.omegaLow),
      omegaSurfaceContrast: mean(high, (entry) => entry.omegaSurface) - mean(low, (entry) => entry.omegaSurface)
    },
    regions: regions.map(summarizeRegion)
  };
}

export async function main() {
  const outputState = prepareAtomicJsonOutput(outPath, {
    seed,
    targets,
    overrides,
    overridesFile
  });
  const startedAtMs = Date.now();
  const timings = {
    initMs: null,
    terrainFallbackMs: null,
    totalMs: null,
    targets: []
  };

  try {
    console.error(`[orographic-audit] init start seed=${seed} targets=${targets.join(',')}`);
    const initStartedAtMs = Date.now();
    const core = new WeatherCore5({ seed });
    await core._initPromise;
    timings.initMs = Date.now() - initStartedAtMs;
    console.error(`[orographic-audit] init complete in ${timings.initMs} ms`);

    const terrainFallbackStartedAtMs = Date.now();
    const terrainFallback = applyHeadlessTerrainFixture(core);
    timings.terrainFallbackMs = Date.now() - terrainFallbackStartedAtMs;
    console.error(
      `[orographic-audit] terrain source=${terrainFallback.source} applied=${terrainFallback.applied} ` +
      `samples=${terrainFallback.after?.terrainSampleCount ?? 0} elevMax=${(terrainFallback.after?.elevMax ?? 0).toFixed(2)} ` +
      `in ${timings.terrainFallbackMs} ms`
    );

    applyOverrides(core, overrides);

    const snapshots = [];
    for (const targetSeconds of targets) {
      const targetStartedAtMs = Date.now();
      const advanceSeconds = Math.max(0, targetSeconds - core.timeUTC);
      console.error(`[orographic-audit] target=${targetSeconds} advanceSeconds=${advanceSeconds}`);
      if (targetSeconds > core.timeUTC) {
        core.advanceModelSeconds(targetSeconds - core.timeUTC);
      }
      const summarizeStartedAtMs = Date.now();
      const snapshot = summarizeCore(core, targetSeconds);
      const finishedAtMs = Date.now();
      timings.targets.push({
        targetSeconds,
        advanceMs: summarizeStartedAtMs - targetStartedAtMs,
        summarizeMs: finishedAtMs - summarizeStartedAtMs,
        totalMs: finishedAtMs - targetStartedAtMs,
        terrainSampleCount: snapshot.global?.terrainSampleCount ?? 0
      });
      console.error(
        `[orographic-audit] target=${targetSeconds} done totalMs=${finishedAtMs - targetStartedAtMs} ` +
        `terrainSampleCount=${snapshot.global?.terrainSampleCount ?? 0}`
      );
      snapshots.push(snapshot);
    }

    timings.totalMs = Date.now() - startedAtMs;

    const summary = {
      schema: 'satellite-wars.orographic-audit.v1',
      generatedAt: new Date().toISOString(),
      seed,
      overrides,
      targets,
      headlessTerrainSource: terrainFallback.source,
      headlessTerrainFixture: terrainFallback,
      headlessTerrainParity: snapshots.some((snapshot) => (snapshot.global?.terrainSampleCount || 0) > 0),
      warnings: snapshots.some((snapshot) => (snapshot.global?.terrainSampleCount || 0) > 0)
        ? []
        : ['headless_terrain_unavailable'],
      timings,
      snapshots
    };

    commitAtomicJsonOutput(outputState, summary);
    process.stdout.write(toJson(summary));
    return summary;
  } catch (error) {
    failAtomicJsonOutput(outputState, error);
    throw error;
  }
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}
