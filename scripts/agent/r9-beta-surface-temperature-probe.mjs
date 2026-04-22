#!/usr/bin/env node
/**
 * R9-β surface temperature diagnostic probe.
 *
 * Goal: identify WHY NH dry belt surface T = 286 K while air T = 292 K.
 * Candidates:
 *   (a) t2m climatology has cold subtropical bias
 *   (b) nudging tau too slow to reach target
 *   (c) zonal-mean is dominated by cold ocean/ice mixed into the "dry belt"
 *
 * Spin up 60 days at 48×24 grid. Print per-row zonal means of:
 *   - Tsurf (land only), Tsurf (ocean only)
 *   - t2mNow target (for land cells only)
 *   - Tair at surface level
 *   - Qs(Tsurf) vs Qa
 *   - Evap and potential evap
 *   - Land fraction
 *
 * Compare across latitudes 0–60° in 5° bins.
 *
 * Success: identify which lever to turn.
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
const spinupDays = 60;

const core = new WeatherCore5({ nx, ny, dt, seed: 42, instrumentationMode: 'full' });
await core._initPromise;
applyHeadlessTerrainFixture(core);
core.clearReplayDisabledModules?.();

// R9-β1: toggle subtropical land warm-bias flag via env var for A/B comparison.
// Default OFF (matches baseline); set R9_WARM_BIAS=1 to turn ON.
const flagOn = process.env.R9_WARM_BIAS === '1';
if (flagOn) {
  Object.assign(core.surfaceParams, {
    enableSubtropicalLandWarmBias: true,
    subtropWarmBoostK: Number(process.env.R9_BOOST_K || 10),
    subtropWarmCenterLatDeg: Number(process.env.R9_CENTER || 25),
    subtropWarmWidthDeg: Number(process.env.R9_WIDTH || 10)
  });
  console.log(`[R9-β1 FLAG ON] boost=${core.surfaceParams.subtropWarmBoostK}K center=${core.surfaceParams.subtropWarmCenterLatDeg}° width=${core.surfaceParams.subtropWarmWidthDeg}°`);
} else {
  console.log('[R9-β1 FLAG OFF — baseline]');
}

core.advanceModelSeconds(spinupDays * 86400);

const state = core.state;
const { N, Ts, landMask, latDeg, nx: gnx, ny: gny } = { ...state, ...core.grid };
const nx2 = core.grid.nx;
const ny2 = core.grid.ny;
const Tair = state.surfaceEvapAirTemp;         // air T at surface level
const Qs = state.surfaceEvapSurfaceSaturationMixingRatio;
const Qa = state.surfaceEvapAirMixingRatio;
const evap = state.surfaceEvapRate;             // mm/hr
const evapPot = state.surfaceEvapPotentialRate; // mm/hr
const t2mClimo = core.climo?.t2mNow;            // Float32Array(N), K
const hasT2m = Boolean(core.climo?.hasT2m);
const latArr = core.grid.latDeg;

const fmt = (n, w = 7, d = 2) => {
  if (!Number.isFinite(n)) return '   n/a '.padStart(w);
  return n.toFixed(d).padStart(w);
};
const pct = (n) => {
  if (!Number.isFinite(n)) return ' n/a';
  return (n * 100).toFixed(0).padStart(3) + '%';
};

console.log('=== R9-β surface temperature probe ===');
console.log(`Spin-up: ${spinupDays} days, ${nx2}×${ny2} grid`);
console.log(`Climo hasT2m: ${hasT2m}`);
console.log();

// Per-row zonal means
console.log('Row-by-row (row 0 = N pole, row ' + (ny2 - 1) + ' = S pole):');
console.log('  lat   landfrac  Ts_land  Ts_ocn  t2m_land  Tair    Qs-Qa     E      Epot    E/Epot');
for (let j = 0; j < ny2; j += 1) {
  const lat = latArr[j];
  let nLand = 0, nOcn = 0;
  let TsLand = 0, TsOcn = 0, t2mLand = 0, Tairj = 0, QsQa = 0, Ej = 0, Epj = 0;
  for (let i = 0; i < nx2; i += 1) {
    const k = j * nx2 + i;
    const isLand = landMask[k] === 1;
    const tair = Tair?.[k] ?? 0;
    Tairj += tair;
    const qs = Qs?.[k] ?? 0;
    const qa = Qa?.[k] ?? 0;
    QsQa += (qs - qa);
    Ej += evap?.[k] ?? 0;
    Epj += evapPot?.[k] ?? 0;
    if (isLand) {
      nLand += 1;
      TsLand += Ts[k];
      if (hasT2m) t2mLand += t2mClimo[k];
    } else {
      nOcn += 1;
      TsOcn += Ts[k];
    }
  }
  const landFrac = nLand / nx2;
  const TsL = nLand > 0 ? TsLand / nLand : NaN;
  const TsO = nOcn > 0 ? TsOcn / nOcn : NaN;
  const t2mL = nLand > 0 ? t2mLand / nLand : NaN;
  const TairJ = Tairj / nx2;
  const QsQaJ = QsQa / nx2;
  const EJ = Ej / nx2;
  const EpJ = Epj / nx2;
  const ratio = EpJ > 0 ? EJ / EpJ : NaN;
  console.log(
    `  ${lat.toFixed(1).padStart(6)}  ${pct(landFrac)}    ${fmt(TsL)}  ${fmt(TsO)}  ${fmt(t2mL)}   ${fmt(TairJ)}  ${fmt(QsQaJ, 7, 4)}  ${fmt(EJ, 7, 3)}  ${fmt(EpJ, 7, 3)}  ${pct(ratio)}`
  );
}

// Summary for specific bands
console.log();
console.log('Latitude-band summaries:');
const bandStats = (minLat, maxLat, label) => {
  let nLand = 0, nOcn = 0;
  let TsLand = 0, TsOcn = 0, t2mLand = 0, Tair_sum = 0, E = 0, Ep = 0;
  let nAll = 0;
  for (let j = 0; j < ny2; j += 1) {
    const lat = latArr[j];
    if (lat < minLat || lat > maxLat) continue;
    for (let i = 0; i < nx2; i += 1) {
      const k = j * nx2 + i;
      nAll += 1;
      Tair_sum += Tair?.[k] ?? 0;
      E += evap?.[k] ?? 0;
      Ep += evapPot?.[k] ?? 0;
      if (landMask[k] === 1) {
        nLand += 1;
        TsLand += Ts[k];
        if (hasT2m) t2mLand += t2mClimo[k];
      } else {
        nOcn += 1;
        TsOcn += Ts[k];
      }
    }
  }
  const TsL = nLand > 0 ? TsLand / nLand : NaN;
  const TsO = nOcn > 0 ? TsOcn / nOcn : NaN;
  const t2mL = nLand > 0 ? t2mLand / nLand : NaN;
  const TairM = nAll > 0 ? Tair_sum / nAll : NaN;
  const TsAll = (TsLand + TsOcn) / Math.max(1, nLand + nOcn);
  console.log(`  ${label.padEnd(24)}  Ts_land=${fmt(TsL)}  Ts_ocn=${fmt(TsO)}  Ts_all=${fmt(TsAll)}  t2m_land=${fmt(t2mL)}  Tair=${fmt(TairM)}  E/Epot=${pct(Ep > 0 ? E / Ep : NaN)}`);
};
bandStats(-6, 6, 'Deep tropics (±6°)');
bandStats(-12, 12, 'Tropics (±12°)');
bandStats(15, 35, 'NH subtrop 15–35°');
bandStats(-35, -15, 'SH subtrop -35–-15°');
bandStats(35, 65, 'NH midlat 35–65°');
bandStats(-65, -35, 'SH midlat -65–-35°');
bandStats(65, 90, 'NH polar 65–90°');
bandStats(-90, -65, 'SH polar -90–-65°');

// Check at specific sample cells
console.log();
console.log('Sample cells in NH dry belt (25–35°N, look at land cells):');
let shown = 0;
for (let j = 0; j < ny2 && shown < 6; j += 1) {
  const lat = latArr[j];
  if (lat < 25 || lat > 35) continue;
  for (let i = 0; i < nx2 && shown < 6; i += 1) {
    const k = j * nx2 + i;
    if (landMask[k] !== 1) continue;
    const elev = core.state.geo?.elev?.[k] ?? 0;
    const lonDeg = (i / nx2) * 360;
    console.log(`  lat=${lat.toFixed(1)} lon=${lonDeg.toFixed(0)}  Ts=${fmt(Ts[k])}  t2m=${fmt(hasT2m ? t2mClimo[k] : NaN)}  Tair=${fmt(Tair[k])}  elev=${fmt(elev, 6, 0)}m`);
    shown += 1;
  }
}
