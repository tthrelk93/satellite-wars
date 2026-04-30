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

// R9-β2: shorten ocean restore tau to snap SST back to Earth climatology
// faster than the atmospheric flux bias can drift it.  Default: 120 days
// (matches atmospheric deep-ocean timescale).  R9_SST_TAU_DAYS env overrides.
const sstTauDays = Number(process.env.R9_SST_TAU_DAYS || 0);
if (sstTauDays > 0) {
  core.surfaceParams.oceanRestoreTau = sstTauDays * 86400;
  console.log(`[R9-β2 SST TAU] ${sstTauDays}d (was 120d)`);
}

// R9-β4: enable tropical ascent seed to bootstrap Hadley ascending branch.
// R9_ASCENT_SEED=1 turns it on with defaults.
const ascentSeedOn = process.env.R9_ASCENT_SEED === '1';
if (ascentSeedOn) {
  Object.assign(core.vertParams, {
    enableTropicalAscentSeed: true,
    tropicalAscentSeedPeakPaS: Number(process.env.R9_ASCENT_PEAK || 0.05),
    tropicalAscentSeedCenterLatDeg: Number(process.env.R9_ASCENT_CENTER || 0),
    tropicalAscentSeedWidthDeg: Number(process.env.R9_ASCENT_WIDTH || 10),
    tropicalAscentSeedSigmaHi: Number(process.env.R9_ASCENT_SIGMA_HI || 0.7),
    tropicalAscentSeedSigmaLo: Number(process.env.R9_ASCENT_SIGMA_LO || 0.3),
    tropicalAscentSeedFadeStartDay: Number(process.env.R9_ASCENT_FADE_START || 30),
    tropicalAscentSeedFadeDurationDays: Number(process.env.R9_ASCENT_FADE_DURATION || 20)
  });
  const p = core.vertParams;
  console.log(`[R9-β4 ASCENT SEED ON] peak=${p.tropicalAscentSeedPeakPaS}Pa/s center=${p.tropicalAscentSeedCenterLatDeg}° width=${p.tropicalAscentSeedWidthDeg}° σ=[${p.tropicalAscentSeedSigmaLo}, ${p.tropicalAscentSeedSigmaHi}] fade=${p.tropicalAscentSeedFadeStartDay}d+${p.tropicalAscentSeedFadeDurationDays}d`);
} else {
  console.log('[R9-β4 ASCENT SEED OFF — baseline]');
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
const sstClimo = core.climo?.sstNow;             // Float32Array(N), K
const hasSst = Boolean(core.climo?.hasSst ?? (sstClimo && sstClimo.length === state.N));
const latArr = core.grid.latDeg;

// R9-β3 instrumentation: ω@700hPa and surface radiative flux for
// subsidence and radiation-budget diagnosis.
const omega = state.omega;                        // (nz+1)*N, Pa/s
const sigmaHalf = state.sigmaHalf;                // length nz+1
const surfRad = state.surfaceRadiativeFlux;       // Float32Array(N), W/m²
const nzState = state.nz;
// Find half-level closest to sigma=0.7 (≈ 700 hPa)
let lev700 = 0;
let lev500 = 0;
{
  let best700 = Infinity, best500 = Infinity;
  for (let lv = 0; lv <= nzState; lv += 1) {
    const s = sigmaHalf?.[lv] ?? 0;
    if (Math.abs(s - 0.7) < best700) { best700 = Math.abs(s - 0.7); lev700 = lv; }
    if (Math.abs(s - 0.5) < best500) { best500 = Math.abs(s - 0.5); lev500 = lv; }
  }
}
console.log(`[R9-β3] Using half-level lev700=${lev700} (σ=${sigmaHalf?.[lev700]?.toFixed(3)}), lev500=${lev500} (σ=${sigmaHalf?.[lev500]?.toFixed(3)})`);

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
console.log(`Climo hasT2m: ${hasT2m}  hasSst: ${hasSst}`);
console.log();

// Per-row zonal means
console.log('Row-by-row (row 0 = N pole, row ' + (ny2 - 1) + ' = S pole):');
console.log('  lat   landfrac  Ts_land  Ts_ocn  sstClimo  Δ(ocn-climo)  t2m_land  Tair    E/Epot');
for (let j = 0; j < ny2; j += 1) {
  const lat = latArr[j];
  let nLand = 0, nOcn = 0;
  let TsLand = 0, TsOcn = 0, t2mLand = 0, sstClimoOcn = 0, Tairj = 0, Ej = 0, Epj = 0;
  for (let i = 0; i < nx2; i += 1) {
    const k = j * nx2 + i;
    const isLand = landMask[k] === 1;
    const tair = Tair?.[k] ?? 0;
    Tairj += tair;
    Ej += evap?.[k] ?? 0;
    Epj += evapPot?.[k] ?? 0;
    if (isLand) {
      nLand += 1;
      TsLand += Ts[k];
      if (hasT2m) t2mLand += t2mClimo[k];
    } else {
      nOcn += 1;
      TsOcn += Ts[k];
      if (hasSst) sstClimoOcn += sstClimo[k];
    }
  }
  const landFrac = nLand / nx2;
  const TsL = nLand > 0 ? TsLand / nLand : NaN;
  const TsO = nOcn > 0 ? TsOcn / nOcn : NaN;
  const sstC = nOcn > 0 ? sstClimoOcn / nOcn : NaN;
  const delta = Number.isFinite(TsO) && Number.isFinite(sstC) ? TsO - sstC : NaN;
  const t2mL = nLand > 0 ? t2mLand / nLand : NaN;
  const TairJ = Tairj / nx2;
  const EJ = Ej / nx2;
  const EpJ = Epj / nx2;
  const ratio = EpJ > 0 ? EJ / EpJ : NaN;
  console.log(
    `  ${lat.toFixed(1).padStart(6)}  ${pct(landFrac)}    ${fmt(TsL)}  ${fmt(TsO)}  ${fmt(sstC)}   ${fmt(delta, 7, 3)}     ${fmt(t2mL)}   ${fmt(TairJ)}  ${pct(ratio)}`
  );
}

// Summary for specific bands
console.log();
console.log('Latitude-band summaries:');
const bandStats = (minLat, maxLat, label) => {
  let nLand = 0, nOcn = 0;
  let TsLand = 0, TsOcn = 0, t2mLand = 0, sstClimoOcn = 0, Tair_sum = 0, E = 0, Ep = 0;
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
        if (hasSst) sstClimoOcn += sstClimo[k];
      }
    }
  }
  const TsL = nLand > 0 ? TsLand / nLand : NaN;
  const TsO = nOcn > 0 ? TsOcn / nOcn : NaN;
  const sstC = nOcn > 0 ? sstClimoOcn / nOcn : NaN;
  const delta = Number.isFinite(TsO) && Number.isFinite(sstC) ? TsO - sstC : NaN;
  const t2mL = nLand > 0 ? t2mLand / nLand : NaN;
  const TairM = nAll > 0 ? Tair_sum / nAll : NaN;
  const TsAll = (TsLand + TsOcn) / Math.max(1, nLand + nOcn);
  console.log(`  ${label.padEnd(24)}  Ts_land=${fmt(TsL)}  Ts_ocn=${fmt(TsO)}  sstClimo=${fmt(sstC)}  Δ=${fmt(delta, 6, 2)}  t2m_land=${fmt(t2mL)}  Tair=${fmt(TairM)}  E/Epot=${pct(Ep > 0 ? E / Ep : NaN)}`);
};
bandStats(-6, 6, 'Deep tropics (±6°)');
bandStats(-12, 12, 'Tropics (±12°)');
bandStats(15, 35, 'NH subtrop 15–35°');
bandStats(-35, -15, 'SH subtrop -35–-15°');
bandStats(35, 65, 'NH midlat 35–65°');
bandStats(-65, -35, 'SH midlat -65–-35°');
bandStats(65, 90, 'NH polar 65–90°');
bandStats(-90, -65, 'SH polar -90–-65°');

// R9-β3: subsidence (ω@500/700) and surface radiation per band
console.log();
console.log('R9-β3 subsidence & surface radiation:');
console.log('  (ω positive = descending; Earth subtrop ω@700 ≈ +0.02 to +0.05 Pa/s)');
const bandOmega = (minLat, maxLat, label) => {
  let nAll = 0, nLand = 0, nOcn = 0;
  let w700 = 0, w500 = 0, srLand = 0, srOcn = 0;
  for (let j = 0; j < ny2; j += 1) {
    const lat = latArr[j];
    if (lat < minLat || lat > maxLat) continue;
    for (let i = 0; i < nx2; i += 1) {
      const k = j * nx2 + i;
      nAll += 1;
      w700 += omega?.[lev700 * state.N + k] ?? 0;
      w500 += omega?.[lev500 * state.N + k] ?? 0;
      if (landMask[k] === 1) {
        nLand += 1;
        srLand += surfRad?.[k] ?? 0;
      } else {
        nOcn += 1;
        srOcn += surfRad?.[k] ?? 0;
      }
    }
  }
  const w7 = nAll > 0 ? w700 / nAll : NaN;
  const w5 = nAll > 0 ? w500 / nAll : NaN;
  const srL = nLand > 0 ? srLand / nLand : NaN;
  const srO = nOcn > 0 ? srOcn / nOcn : NaN;
  console.log(`  ${label.padEnd(24)}  ω700=${fmt(w7 * 1000, 7, 2)} mPa/s  ω500=${fmt(w5 * 1000, 7, 2)} mPa/s  srLand=${fmt(srL, 7, 1)} W/m²  srOcn=${fmt(srO, 7, 1)} W/m²`);
};
bandOmega(-6, 6, 'Deep tropics (±6°)');
bandOmega(-12, 12, 'Tropics (±12°)');
bandOmega(15, 35, 'NH subtrop 15–35°');
bandOmega(-35, -15, 'SH subtrop -35–-15°');
bandOmega(35, 65, 'NH midlat 35–65°');
bandOmega(-65, -35, 'SH midlat -65–-35°');
bandOmega(65, 90, 'NH polar 65–90°');
bandOmega(-90, -65, 'SH polar -90–-65°');

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
