#!/usr/bin/env node
/**
 * R9-γ-2 subtropical boundary-layer energy balance probe.
 *
 * Motivating question: R9-α found NH subtropical land Ts=275.74 K
 * while Tair=292.47 K (16.7 K inversion). R9-β3 explained the hot
 * air as adiabatic subsidence warming. R9-β4 showed the surface cold
 * bias is decoupled from circulation. R9-γ-1a just fixed the polar
 * grid noise. Now: what's actually setting Tsurf?
 *
 * Architectural insight from code review:
 *   - Land Ts is NOT flux-integrated. It is nudged toward a target
 *     `TsTargetLand` with timescale `landTauTs` (3 days default).
 *   - `TsTargetLand = climo.t2mNow[k]` when enableLandClimoTs=true
 *     (which is the default). Falls back to latitude baseline
 *     otherwise.
 *   - Radiative, sensible, and latent fluxes are computed for the
 *     bulk transfer, but their energy budget updates the ATMOSPHERE
 *     (via theta closure), not the land Ts.
 *   - Ocean Ts IS flux-integrated via net SR - SH - LH.
 *
 * So three testable questions:
 *   Q1. Is `t2mNow` (the nudging target) itself cold for NH subtrop?
 *       If yes, this is a CLIMO DATA issue, not physics.
 *   Q2. Is Ts actually tracking t2mNow, or is something dragging it
 *       off-target despite nudging?
 *   Q3. What is the surface flux picture (SH, LH, SR) doing? Even
 *       if the land Ts doesn't respond to fluxes directly, the flux
 *       picture tells us if the surface is energetically consistent.
 *
 * This probe reports per-band means and per-cell samples for the
 * NH and SH subtropical dry-belt regions.
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

core.advanceModelSeconds(spinupDays * 86400);

const state = core.state;
const grid = core.grid;
const climo = core.climo;
const latArr = grid.latDeg;
const N = state.N;
const nx2 = grid.nx;
const ny2 = grid.ny;

const Ts = state.Ts;
const landMask = state.landMask;
const surfaceSensibleFlux = state.surfaceSensibleFlux;
const surfaceLatentFlux = state.surfaceLatentFlux;
const surfaceRadiativeFlux = state.surfaceRadiativeFlux;
const surfaceEvapAirTemp = state.surfaceEvapAirTemp;
const surfaceEvapRate = state.surfaceEvapRate;
const surfaceEvapPotentialRate = state.surfaceEvapPotentialRate;
const surfaceEvapSoilGate = state.surfaceEvapSoilGate;
const soilW = state.soilW;
const soilCap = state.soilCap;
const surfaceCloudShortwaveShieldingWm2 = state.surfaceCloudShortwaveShieldingWm2;
const upperCloudClearSkyLwCoolingWm2 = state.upperCloudClearSkyLwCoolingWm2;
const upperCloudCloudyLwCoolingWm2 = state.upperCloudCloudyLwCoolingWm2;
const upperCloudLwCloudEffectWm2 = state.upperCloudLwCloudEffectWm2;

const t2mNow = climo?.t2mNow;
const sstNow = climo?.sstNow;
const hasT2m = Boolean(climo?.hasT2m && t2mNow && t2mNow.length === N);

const fmt = (n, w = 8, d = 2) => {
  if (!Number.isFinite(n)) return '   n/a '.padStart(w);
  return n.toFixed(d).padStart(w);
};
const pct = (n) => {
  if (!Number.isFinite(n)) return ' n/a';
  return (n * 100).toFixed(0).padStart(3) + '%';
};

// Earth reference values (ERA5 climo, very approximate monthly mean)
// For NH subtropical dry belt (Sahara/Arabia, 20-30°N) in February:
//   t2m ~ 285-292 K (land), SST ~ 295-298 K (ocean)
//   Net surface radiation (SR_net) ~ +80 to +140 W/m² (solar gain > LW loss)
//   Sensible H ~ 30-80 W/m² (upward)
//   Latent LH ~ 5-20 W/m² (very dry; evaporation limited)
// For SH subtrop, August (mirrored): similar ranges.
// For NH subtrop, same as above but absolute magnitudes vary by month.

console.log('=== R9-γ-2 subtropical BL energy balance probe ===');
console.log(`Spin-up: ${spinupDays} days, ${nx2}×${ny2} grid`);
console.log(`climo.hasT2m=${Boolean(climo?.hasT2m)}  t2mNow present=${hasT2m}`);
console.log(`Current simulated date: ${new Date((state.timeUTC || 0) * 1000).toISOString()}`);
console.log(`Day of year (approx): ${Math.floor((state.timeUTC / 86400) % 365)}`);
console.log();

const bandAnalysis = (minLat, maxLat, label) => {
  let nLand = 0, nOcean = 0;
  let sumTsLand = 0, sumTsOcean = 0;
  let sumTargetLand = 0;
  let sumTairLand = 0, sumTairOcean = 0;
  let sumSHLand = 0, sumSHOcean = 0;
  let sumLHLand = 0, sumLHOcean = 0;
  let sumSRLand = 0, sumSROcean = 0;
  let sumELand = 0, sumEOcean = 0;
  let sumEPotLand = 0, sumEPotOcean = 0;
  let sumSoilGateLand = 0;
  let sumSoilFracLand = 0;
  let sumSWShieldLand = 0, sumSWShieldOcean = 0;
  let sumLWClearLand = 0, sumLWClearOcean = 0;
  let sumLWCloudyLand = 0, sumLWCloudyOcean = 0;
  let sumSstClimoOcean = 0;

  for (let j = 0; j < ny2; j += 1) {
    const lat = latArr[j];
    if (lat < minLat || lat > maxLat) continue;
    for (let i = 0; i < nx2; i += 1) {
      const k = j * nx2 + i;
      const isLand = landMask[k] === 1;
      const ts = Ts[k];
      const target = hasT2m ? t2mNow[k] : NaN;
      const tair = surfaceEvapAirTemp?.[k] ?? NaN;
      const sh = surfaceSensibleFlux?.[k] ?? 0;
      const lh = surfaceLatentFlux?.[k] ?? 0;
      const sr = surfaceRadiativeFlux?.[k] ?? 0;
      const e = surfaceEvapRate?.[k] ?? 0;
      const ePot = surfaceEvapPotentialRate?.[k] ?? 0;
      const swShield = surfaceCloudShortwaveShieldingWm2?.[k] ?? 0;
      const lwClear = upperCloudClearSkyLwCoolingWm2?.[k] ?? 0;
      const lwCloudy = upperCloudCloudyLwCoolingWm2?.[k] ?? 0;
      if (isLand) {
        nLand += 1;
        sumTsLand += ts;
        if (Number.isFinite(target)) sumTargetLand += target;
        sumTairLand += tair;
        sumSHLand += sh;
        sumLHLand += lh;
        sumSRLand += sr;
        sumELand += e;
        sumEPotLand += ePot;
        const cap = Math.max(1e-6, soilCap?.[k] ?? 0);
        const avail = cap > 0 ? Math.min(1, Math.max(0, (soilW?.[k] ?? 0) / cap)) : 0;
        sumSoilFracLand += avail;
        sumSoilGateLand += surfaceEvapSoilGate?.[k] ?? 0;
        sumSWShieldLand += swShield;
        sumLWClearLand += lwClear;
        sumLWCloudyLand += lwCloudy;
      } else {
        nOcean += 1;
        sumTsOcean += ts;
        sumTairOcean += tair;
        sumSHOcean += sh;
        sumLHOcean += lh;
        sumSROcean += sr;
        sumEOcean += e;
        sumEPotOcean += ePot;
        sumSWShieldOcean += swShield;
        sumLWClearOcean += lwClear;
        sumLWCloudyOcean += lwCloudy;
        if (sstNow) sumSstClimoOcean += sstNow[k];
      }
    }
  }

  const TsLand = nLand > 0 ? sumTsLand / nLand : NaN;
  const TsOcean = nOcean > 0 ? sumTsOcean / nOcean : NaN;
  const targetLand = nLand > 0 ? sumTargetLand / nLand : NaN;
  const tairLand = nLand > 0 ? sumTairLand / nLand : NaN;
  const tairOcean = nOcean > 0 ? sumTairOcean / nOcean : NaN;
  const shLand = nLand > 0 ? sumSHLand / nLand : NaN;
  const shOcean = nOcean > 0 ? sumSHOcean / nOcean : NaN;
  const lhLand = nLand > 0 ? sumLHLand / nLand : NaN;
  const lhOcean = nOcean > 0 ? sumLHOcean / nOcean : NaN;
  const srLand = nLand > 0 ? sumSRLand / nLand : NaN;
  const srOcean = nOcean > 0 ? sumSROcean / nOcean : NaN;
  const eLand = nLand > 0 ? sumELand / nLand : NaN;
  const eOcean = nOcean > 0 ? sumEOcean / nOcean : NaN;
  const ePotLand = nLand > 0 ? sumEPotLand / nLand : NaN;
  const ePotOcean = nOcean > 0 ? sumEPotOcean / nOcean : NaN;
  const soilFracLand = nLand > 0 ? sumSoilFracLand / nLand : NaN;
  const soilGateLand = nLand > 0 ? sumSoilGateLand / nLand : NaN;
  const swShieldLand = nLand > 0 ? sumSWShieldLand / nLand : NaN;
  const lwClearLand = nLand > 0 ? sumLWClearLand / nLand : NaN;
  const lwCloudyLand = nLand > 0 ? sumLWCloudyLand / nLand : NaN;
  const swShieldOcean = nOcean > 0 ? sumSWShieldOcean / nOcean : NaN;
  const lwClearOcean = nOcean > 0 ? sumLWClearOcean / nOcean : NaN;
  const lwCloudyOcean = nOcean > 0 ? sumLWCloudyOcean / nOcean : NaN;
  const sstClimoOcean = nOcean > 0 ? sumSstClimoOcean / nOcean : NaN;

  console.log(`[${label}] nLand=${nLand} nOcean=${nOcean}`);
  if (nLand > 0) {
    console.log(`  LAND:`);
    console.log(`    Ts(state)=${fmt(TsLand)} K   Ts(target t2m)=${fmt(targetLand)} K   Δ(Ts-target)=${fmt(TsLand - targetLand)} K`);
    console.log(`    Tair(lowest)=${fmt(tairLand)} K   inversion(Tair-Ts)=${fmt(tairLand - TsLand)} K`);
    console.log(`    Surface fluxes (W/m²): SR_net=${fmt(srLand)}  SH=${fmt(shLand)}  LH=${fmt(lhLand)}  net(SR-SH-LH)=${fmt(srLand - shLand - lhLand)}`);
    console.log(`    Evap: E=${fmt(eLand, 8, 4)} mm/hr  E_pot=${fmt(ePotLand, 8, 4)} mm/hr  ratio=${fmt(eLand / Math.max(1e-9, ePotLand), 6, 3)}`);
    console.log(`    Soil: soilW/cap=${pct(soilFracLand)}  soilGate=${fmt(soilGateLand, 6, 3)}`);
    console.log(`    Clouds: SW_shield=${fmt(swShieldLand)} W/m²  upperLW_clear=${fmt(lwClearLand)} W/m²  upperLW_cloudy=${fmt(lwCloudyLand)} W/m²`);
  }
  if (nOcean > 0) {
    console.log(`  OCEAN:`);
    console.log(`    Ts(state)=${fmt(TsOcean)} K   SST(climo)=${fmt(sstClimoOcean)} K   Δ(Ts-climo)=${fmt(TsOcean - sstClimoOcean)} K`);
    console.log(`    Tair(lowest)=${fmt(tairOcean)} K   inversion(Tair-Ts)=${fmt(tairOcean - TsOcean)} K`);
    console.log(`    Surface fluxes (W/m²): SR_net=${fmt(srOcean)}  SH=${fmt(shOcean)}  LH=${fmt(lhOcean)}  net(SR-SH-LH)=${fmt(srOcean - shOcean - lhOcean)}`);
    console.log(`    Evap: E=${fmt(eOcean, 8, 4)} mm/hr  E_pot=${fmt(ePotOcean, 8, 4)} mm/hr`);
    console.log(`    Clouds: SW_shield=${fmt(swShieldOcean)} W/m²  upperLW_clear=${fmt(lwClearOcean)} W/m²`);
  }
  console.log();
};

bandAnalysis(15, 35, 'NH subtrop 15–35°');
bandAnalysis(-35, -15, 'SH subtrop -35–-15°');
bandAnalysis(-6, 6, 'Deep tropics ±6°');
bandAnalysis(35, 55, 'NH midlat 35–55°');
bandAnalysis(-55, -35, 'SH midlat -55–-35°');

// Per-cell coldest NH subtropical land samples
console.log('Five coldest NH subtropical (15–35°) land cells:');
const cells = [];
for (let j = 0; j < ny2; j += 1) {
  const lat = latArr[j];
  if (lat < 15 || lat > 35) continue;
  for (let i = 0; i < nx2; i += 1) {
    const k = j * nx2 + i;
    if (landMask[k] !== 1) continue;
    cells.push({ k, lat, lon: (i / nx2) * 360, ts: Ts[k], target: hasT2m ? t2mNow[k] : NaN, tair: surfaceEvapAirTemp?.[k] ?? NaN, sh: surfaceSensibleFlux?.[k] ?? 0, lh: surfaceLatentFlux?.[k] ?? 0, sr: surfaceRadiativeFlux?.[k] ?? 0, soilFrac: (soilW?.[k] ?? 0) / Math.max(1e-6, soilCap?.[k] ?? 1) });
  }
}
cells.sort((a, b) => a.ts - b.ts);
for (const c of cells.slice(0, 5)) {
  console.log(`  lat=${c.lat.toFixed(1).padStart(6)} lon=${c.lon.toFixed(0).padStart(4)} Ts=${fmt(c.ts)} target=${fmt(c.target)} Tair=${fmt(c.tair)} SR=${fmt(c.sr)} SH=${fmt(c.sh)} LH=${fmt(c.lh)} soilFrac=${pct(c.soilFrac)}`);
}

console.log();
console.log('Five hottest NH subtropical (15–35°) land cells:');
cells.sort((a, b) => b.ts - a.ts);
for (const c of cells.slice(0, 5)) {
  console.log(`  lat=${c.lat.toFixed(1).padStart(6)} lon=${c.lon.toFixed(0).padStart(4)} Ts=${fmt(c.ts)} target=${fmt(c.target)} Tair=${fmt(c.tair)} SR=${fmt(c.sr)} SH=${fmt(c.sh)} LH=${fmt(c.lh)} soilFrac=${pct(c.soilFrac)}`);
}

// Diagnostic: sanity-check the t2m climatology values per latitude
console.log();
console.log('t2m climatology vs zonal means per latitude (LAND ONLY):');
console.log('  lat    t2m_climo_mean(K)   Ts_mean(K)    Tair_mean(K)   ΔTair-Ts  nLand');
for (let j = 0; j < ny2; j += 1) {
  let nL = 0, sumT = 0, sumTs = 0, sumTair = 0;
  for (let i = 0; i < nx2; i += 1) {
    const k = j * nx2 + i;
    if (landMask[k] !== 1) continue;
    nL += 1;
    if (hasT2m) sumT += t2mNow[k];
    sumTs += Ts[k];
    sumTair += surfaceEvapAirTemp?.[k] ?? 0;
  }
  if (nL === 0) continue;
  const t2m = hasT2m ? sumT / nL : NaN;
  const ts = sumTs / nL;
  const tair = sumTair / nL;
  console.log(`  ${latArr[j].toFixed(1).padStart(6)}   ${fmt(t2m)}       ${fmt(ts)}     ${fmt(tair)}   ${fmt(tair - ts)}    ${nL}`);
}
