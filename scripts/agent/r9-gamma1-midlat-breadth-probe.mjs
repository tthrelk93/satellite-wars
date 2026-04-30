#!/usr/bin/env node
/**
 * R9-γ-1 midlatitude storm-track breadth probe.
 *
 * Goal: determine WHY NH midlat zonal-mean ω@500 = -0.107 Pa/s when
 * Earth's value is ~-0.02 Pa/s. Candidates:
 *   (a) Storms cover too much of the zonal band (breadth issue)
 *   (b) Individual storms are too intense (amplitude issue)
 *   (c) Too many active storms at any time (frequency issue)
 *
 * Metrics:
 *   - Per-row ω@500 and ω@700 (seeing the meridional profile)
 *   - Fraction of zonal cells with ω<-0.05 Pa/s (ascent-coverage fraction)
 *   - Peak ω magnitude in each row (intensity of strongest ascent)
 *   - Stddev of ω across the zonal band (variability — high = few intense
 *     storms, low = broad uniform ascent)
 *
 * Earth reference (ERA5 zonal annual mean at 500 hPa, approximate):
 *   - Equator    ω ≈ -0.030 Pa/s (strong ITCZ ascent)
 *   - ±15°       ω ≈ -0.005 Pa/s (tropical Hadley)
 *   - ±25°       ω ≈ +0.030 Pa/s (subtropical descent)
 *   - ±45°       ω ≈ -0.020 Pa/s (midlat storm-track ascent)
 *   - ±65°       ω ≈ -0.010 Pa/s
 *   - poles      ω ≈ ~0 or slightly positive
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installNodeClimoLoader } from './climatology-node-loader.mjs';
installNodeClimoLoader();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const { WeatherCore5 } = await import(path.join(repoRoot, 'src/weather/v2/core5.js'));
const { applyHeadlessTerrainFixture } = await import(path.join(repoRoot, 'scripts/agent/headless-terrain-fixture.mjs'));

const nx = 48;
const ny = 24;
const dt = 3600;
const spinupDays = Number(process.env.R9G_SPINUP_DAYS || 60);

const core = new WeatherCore5({ nx, ny, dt, seed: 42, instrumentationMode: 'full' });
await core._initPromise;
applyHeadlessTerrainFixture(core);
core.clearReplayDisabledModules?.();

// R9-γ-1 A/B: enable a guarded midlat-breadth limiter if the flag is set.
// We haven't implemented it yet — this is the diagnostic phase.
// But support it here so we can run the same probe before/after.
const narrowOn = process.env.R9G_NARROW === '1';
if (narrowOn) {
  Object.assign(core.vertParams, {
    enableMidlatAscentNarrowing: true,
    midlatAscentNarrowingMaxFrac: Number(process.env.R9G_NARROW_MAX_FRAC || 0.35),
    midlatAscentNarrowingLat0: Number(process.env.R9G_NARROW_LAT0 || 30),
    midlatAscentNarrowingLat1: Number(process.env.R9G_NARROW_LAT1 || 65),
    midlatAscentNarrowingThresholdPaS: Number(process.env.R9G_NARROW_THRESHOLD || 0.03)
  });
  console.log(`[R9-γ-1 NARROWING ON] maxFrac=${core.vertParams.midlatAscentNarrowingMaxFrac} latBand=[${core.vertParams.midlatAscentNarrowingLat0}..${core.vertParams.midlatAscentNarrowingLat1}] threshold=${core.vertParams.midlatAscentNarrowingThresholdPaS}Pa/s`);
} else {
  console.log('[R9-γ-1 NARROWING OFF — baseline]');
}

core.advanceModelSeconds(spinupDays * 86400);

const state = core.state;
const omega = state.omega;
const sigmaHalf = state.sigmaHalf;
const latArr = core.grid.latDeg;
const N = state.N;
const nz = state.nz;
const nx2 = core.grid.nx;
const ny2 = core.grid.ny;

// Find half-levels closest to 500 and 700 hPa
let lev500 = 0, lev700 = 0;
{
  let b5 = Infinity, b7 = Infinity;
  for (let lv = 0; lv <= nz; lv += 1) {
    const s = sigmaHalf?.[lv] ?? 0;
    if (Math.abs(s - 0.5) < b5) { b5 = Math.abs(s - 0.5); lev500 = lv; }
    if (Math.abs(s - 0.7) < b7) { b7 = Math.abs(s - 0.7); lev700 = lv; }
  }
}

const fmt = (n, w = 7, d = 2) => {
  if (!Number.isFinite(n)) return '   n/a '.padStart(w);
  return n.toFixed(d).padStart(w);
};
const pct = (n) => {
  if (!Number.isFinite(n)) return ' n/a';
  return (n * 100).toFixed(0).padStart(3) + '%';
};

// ERA5-approximate zonal-mean ω@500 (Pa/s) by latitude (linear interpolation)
function earthOmega500(latDeg) {
  const abs = Math.abs(latDeg);
  // Tabulated approximation (Pa/s); negative = ascent
  const table = [
    [0, -0.030],
    [10, -0.015],
    [15, -0.005],
    [20, +0.015],
    [25, +0.030],
    [30, +0.025],
    [40, -0.010],
    [45, -0.020],
    [50, -0.020],
    [55, -0.015],
    [65, -0.010],
    [80, +0.005],
    [90, +0.005]
  ];
  for (let i = 0; i < table.length - 1; i += 1) {
    const [a, va] = table[i];
    const [b, vb] = table[i + 1];
    if (abs >= a && abs <= b) {
      const f = (abs - a) / Math.max(1e-6, b - a);
      return va + f * (vb - va);
    }
  }
  return 0;
}

console.log('=== R9-γ-1 midlat storm-track breadth probe ===');
console.log(`Spin-up: ${spinupDays} days, ${nx2}×${ny2} grid`);
console.log(`lev500=${lev500} (σ=${sigmaHalf?.[lev500]?.toFixed(3)})  lev700=${lev700} (σ=${sigmaHalf?.[lev700]?.toFixed(3)})`);
console.log();

console.log('Per-row zonal-mean ω and breadth metrics at 500 hPa:');
console.log('  lat    ω_mean    Earth_ω  ratio  |  ω_peak_asc  ω_peak_desc  ascFrac(<-0.05)  descFrac(>+0.03)  ω_stddev');
for (let j = 0; j < ny2; j += 1) {
  const lat = latArr[j];
  let sum = 0, sum2 = 0, n = 0;
  let peakAsc = 0, peakDesc = 0;
  let nAsc = 0, nDesc = 0;
  for (let i = 0; i < nx2; i += 1) {
    const k = j * nx2 + i;
    const w = omega?.[lev500 * N + k] ?? 0;
    sum += w;
    sum2 += w * w;
    n += 1;
    if (w < peakAsc) peakAsc = w;
    if (w > peakDesc) peakDesc = w;
    if (w < -0.05) nAsc += 1;
    if (w > +0.03) nDesc += 1;
  }
  const mean = n > 0 ? sum / n : 0;
  const variance = n > 0 ? sum2 / n - mean * mean : 0;
  const stddev = Math.sqrt(Math.max(0, variance));
  const earthW = earthOmega500(lat);
  const ratio = earthW !== 0 ? mean / earthW : (mean === 0 ? 1 : Infinity);
  const ratioStr = Number.isFinite(ratio) ? ratio.toFixed(2).padStart(5) : '  inf';
  console.log(
    `  ${lat.toFixed(1).padStart(6)}  ${fmt(mean * 1000, 7, 2)}  ${fmt(earthW * 1000, 7, 2)}  ${ratioStr}×  |  ${fmt(peakAsc * 1000, 8, 2)}   ${fmt(peakDesc * 1000, 9, 2)}    ${pct(nAsc / nx2)}              ${pct(nDesc / nx2)}             ${fmt(stddev * 1000, 7, 3)}`
  );
}

console.log();
console.log('Latitude-band summaries (ω@500, mPa/s):');
const bandSummary = (minLat, maxLat, label) => {
  let sum = 0, sum2 = 0, n = 0, nAsc = 0;
  let earthSum = 0;
  for (let j = 0; j < ny2; j += 1) {
    const lat = latArr[j];
    if (lat < minLat || lat > maxLat) continue;
    const earthW = earthOmega500(lat);
    for (let i = 0; i < nx2; i += 1) {
      const k = j * nx2 + i;
      const w = omega?.[lev500 * N + k] ?? 0;
      sum += w;
      sum2 += w * w;
      if (w < -0.05) nAsc += 1;
      n += 1;
      earthSum += earthW;
    }
  }
  const mean = n > 0 ? sum / n : 0;
  const variance = n > 0 ? sum2 / n - mean * mean : 0;
  const stddev = Math.sqrt(Math.max(0, variance));
  const ascFrac = n > 0 ? nAsc / n : 0;
  const earthMean = n > 0 ? earthSum / n : 0;
  const ratio = earthMean !== 0 ? mean / earthMean : (mean === 0 ? 1 : Infinity);
  console.log(`  ${label.padEnd(28)}  model=${fmt(mean * 1000, 7, 2)}  earth=${fmt(earthMean * 1000, 7, 2)}  ratio=${Number.isFinite(ratio) ? ratio.toFixed(2).padStart(5) : '  inf'}×  ascFrac=${pct(ascFrac)}  σ=${fmt(stddev * 1000, 6, 2)}`);
};
bandSummary(-6, 6, 'Deep tropics (±6°)');
bandSummary(-12, 12, 'Tropics (±12°)');
bandSummary(15, 35, 'NH subtrop 15–35°');
bandSummary(-35, -15, 'SH subtrop -35–-15°');
bandSummary(35, 55, 'NH storm track 35–55°');
bandSummary(-55, -35, 'SH storm track -55–-35°');
bandSummary(55, 75, 'NH poleward 55–75°');
bandSummary(-75, -55, 'SH poleward -75–-55°');
bandSummary(75, 90, 'NH polar 75–90°');
bandSummary(-90, -75, 'SH polar -90–-75°');

// Look for storm-track cells specifically: peaks of ascent
console.log();
console.log('Peak ascent cells globally (ω@500 < -0.15 Pa/s) — storm-track cores:');
let shown = 0;
const stormCells = [];
for (let k = 0; k < N; k += 1) {
  const w = omega?.[lev500 * N + k] ?? 0;
  if (w < -0.15) {
    const j = Math.floor(k / nx2);
    const i = k % nx2;
    stormCells.push({ lat: latArr[j], lon: (i / nx2) * 360, w });
  }
}
stormCells.sort((a, b) => a.w - b.w);
console.log(`  Total cells with ω < -0.15 Pa/s: ${stormCells.length} out of ${N}`);
for (const c of stormCells.slice(0, 10)) {
  console.log(`    lat=${c.lat.toFixed(1).padStart(6)}  lon=${c.lon.toFixed(0).padStart(4)}  ω=${(c.w * 1000).toFixed(1)} mPa/s`);
}

// Also compute cumulative mass flux to visualize Hadley/Ferrel/Polar cells
console.log();
console.log('Meridional streamfunction proxy — cumulative ω from pole (S→N):');
console.log('  lat    cumΨ@500 (arb units)');
let cumSum = 0;
const cosLats = latArr.map((lat) => Math.cos(lat * Math.PI / 180));
for (let j = ny2 - 1; j >= 0; j -= 1) {
  let rowSum = 0;
  for (let i = 0; i < nx2; i += 1) {
    rowSum += omega?.[lev500 * N + j * nx2 + i] ?? 0;
  }
  const rowMean = rowSum / nx2;
  cumSum += rowMean * cosLats[j];
  console.log(`  ${latArr[j].toFixed(1).padStart(6)}  ${(cumSum * 1000).toFixed(2).padStart(10)}`);
}
