#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WeatherCore5 } from '../../src/weather/v2/core5.js';

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
  precipMean: mean(entries, (entry) => entry.precip),
  cloudMean: mean(entries, (entry) => entry.cloudLow),
  qcLowMean: mean(entries, (entry) => entry.qcLow),
  qrLowMean: mean(entries, (entry) => entry.qrLow),
  qvLowMean: mean(entries, (entry) => entry.qvLow),
  rhLowMean: mean(entries, (entry) => entry.rhLow),
  soilFracMean: mean(entries, (entry) => entry.soilFrac),
  pLowMean: mean(entries, (entry) => entry.pLow),
  elevMean: mean(entries, (entry) => entry.elev),
  omegaLowMean: mean(entries, (entry) => entry.omegaLow),
  omegaSurfaceMean: mean(entries, (entry) => entry.omegaSurface)
});

function summarizeCore(core, targetSeconds) {
  const { grid, state, fields, geo } = core;
  const { nx, ny, invDx, invDy, latDeg, lonDeg } = grid;
  const { N, nz, u, v, qv, qc, qr, pMid, soilW, soilCap, omega } = state;
  const levS = nz - 1;
  const elev = geo.elev;
  const precip = fields.precipRate || state.precipRate;
  const cloudLow = fields.cloudLow;

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
      const entry = {
        upslope: u[idxS] * slopeX + v[idxS] * slopeY,
        precip: precip[k],
        cloudLow: cloudLow[k],
        qcLow: qc[idxS],
        qrLow: qr[idxS],
        qvLow: qv[idxS],
        rhLow: fields.rh3D ? fields.rh3D[idxS] : 0,
        soilFrac,
        pLow: pMid[idxS],
        elev: elev[k],
        omegaLow: omega[levS * N + k],
        omegaSurface: omega[nz * N + k],
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
      omegaLowContrast: mean(upslope, (entry) => entry.omegaLow) - mean(downslope, (entry) => entry.omegaLow),
      omegaSurfaceContrast: mean(upslope, (entry) => entry.omegaSurface) - mean(downslope, (entry) => entry.omegaSurface)
    };
  };

  return {
    targetSeconds,
    timeUTC: core.timeUTC,
    global: {
      terrainSampleCount: terrain.length,
      precipUpslopeVsDownslope: mean(high, (entry) => entry.precip) / Math.max(1e-6, mean(low, (entry) => entry.precip)),
      cloudUpslopeVsDownslope: mean(high, (entry) => entry.cloudLow) / Math.max(1e-6, mean(low, (entry) => entry.cloudLow)),
      qcLowUpslopeVsDownslope: mean(high, (entry) => entry.qcLow) / Math.max(1e-9, mean(low, (entry) => entry.qcLow)),
      qrLowUpslopeVsDownslope: mean(high, (entry) => entry.qrLow) / Math.max(1e-9, mean(low, (entry) => entry.qrLow)),
      qvLowUpslopeVsDownslope: mean(high, (entry) => entry.qvLow) / Math.max(1e-9, mean(low, (entry) => entry.qvLow)),
      rhLowUpslopeVsDownslope: mean(high, (entry) => entry.rhLow) / Math.max(1e-9, mean(low, (entry) => entry.rhLow)),
      soilFracUpslopeVsDownslope: mean(high, (entry) => entry.soilFrac) / Math.max(1e-9, mean(low, (entry) => entry.soilFrac)),
      pLowUpslopeVsDownslope: mean(high, (entry) => entry.pLow) / Math.max(1e-9, mean(low, (entry) => entry.pLow)),
      elevUpslopeVsDownslope: mean(high, (entry) => entry.elev) / Math.max(1e-9, mean(low, (entry) => entry.elev)),
      omegaLowContrast: mean(high, (entry) => entry.omegaLow) - mean(low, (entry) => entry.omegaLow),
      omegaSurfaceContrast: mean(high, (entry) => entry.omegaSurface) - mean(low, (entry) => entry.omegaSurface)
    },
    regions: regions.map(summarizeRegion)
  };
}

const core = new WeatherCore5({ seed });
await core._initPromise;
applyOverrides(core, overrides);

const snapshots = [];
for (const targetSeconds of targets) {
  if (targetSeconds > core.timeUTC) {
    core.advanceModelSeconds(targetSeconds - core.timeUTC);
  }
  snapshots.push(summarizeCore(core, targetSeconds));
}

const summary = {
  schema: 'satellite-wars.orographic-audit.v1',
  generatedAt: new Date().toISOString(),
  seed,
  overrides,
  targets,
  headlessTerrainParity: snapshots.some((snapshot) => (snapshot.global?.terrainSampleCount || 0) > 0),
  warnings: snapshots.some((snapshot) => (snapshot.global?.terrainSampleCount || 0) > 0)
    ? []
    : ['headless_terrain_unavailable'],
  snapshots
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
