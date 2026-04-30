#!/usr/bin/env node
/**
 * R8 global precipitation budget probe.
 *
 * At R7 close, the annual audit reports global-mean precip ≈ 0.031 mm/hr
 * (~0.74 mm/day) vs Earth ~0.11 mm/hr (~2.7 mm/day). The model is ~4× too
 * dry globally. TCW is 30.2 kg/m² (close to / slightly above Earth's ~24)
 * so the atmosphere is NOT short on water vapor — precipitation *efficiency*
 * is the suspect, not supply.
 *
 * This probe decomposes the column moisture budget at 180-day spinup:
 *   E (surface evap) ─┐
 *                     ├─► qv ──[condensation]──► qc/qi ──[autoconv]──► qr/qs
 *                     │                         │                       │
 *                     │                         └──[cloud reevap]──► qv │
 *                     │                                                 │
 *                     └──────────────[precip reevap]──────────────────► qv ──► (back into qv budget)
 *                                                                       │
 *                                                                       └──[precip to surface]──► P
 *
 * At equilibrium: <E>_global = <P>_global.  The stock is steady, so we can
 * tally every source and sink and check closure.  We report per-band and
 * per-row versions so we can see *where* the deficit lives (global, tropical
 * convection, subtropical, midlat, polar) and whether it's an evaporation
 * or precipitation-efficiency problem.
 *
 * Diagnostic fields available (checked via grep):
 *  - snap.precipRateMmHr              — precip reaching surface, mm/hr
 *  - snap.surfaceEvapRateMmHr         — surface evaporation, mm/hr
 *  - snap.largeScaleCondensationSourceKgM2 — qv→condensate per step (kg/m²)
 *  - state.precipReevaporationMass    — precip→qv per step (kg/m², per cell)
 *  - state.cloudReevaporationMass     — cloud→qv per step
 *  - snap.totalColumnWaterKgM2
 *
 * Hypothesis tests:
 *   H1 (evap too low):       <E> ≪ Earth's 0.11 mm/hr
 *   H2 (reevap too high):    precipReevap / condensationSource > 0.5
 *   H3 (condensation weak):  condensation < precip × 2 (would mean too little
 *                            cloud water is produced to sustain Earth-like
 *                            precipitation even with zero reevap)
 *   H4 (band-localized):     global deficit concentrated in a narrow band
 *                            (e.g. tropics or subtropics)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installNodeClimoLoader } from './climatology-node-loader.mjs';
installNodeClimoLoader();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const { WeatherCore5 } = await import(path.join(repoRoot, 'src/weather/v2/core5.js'));
const { buildValidationDiagnostics } = await import(path.join(repoRoot, 'src/weather/validation/diagnostics.js'));
const { applyHeadlessTerrainFixture } = await import(path.join(repoRoot, 'scripts/agent/headless-terrain-fixture.mjs'));

const nx = 48;
const ny = 24;
const dt = 3600;
const spinupDays = 180;

const core = new WeatherCore5({ nx, ny, dt, seed: 42, instrumentationMode: 'full' });
await core._initPromise;
applyHeadlessTerrainFixture(core);
core.clearReplayDisabledModules?.();
core.advanceModelSeconds(spinupDays * 86400);

const snap = buildValidationDiagnostics(core);
const lat = snap.grid.latitudesDeg;
const land = snap.landMask;
const state = core.state;

// ---------- Helpers ----------

// Convert per-step kg/m² to mm/hr.  1 kg/m² of liquid = 1 mm.  Multiply by (3600/dt).
const KG_M2_PER_STEP_TO_MM_HR = 3600 / dt;

// Many instrumentation arrays are per-level (N = nx*ny*nz).  Reduce to column
// by summing over levels.
const sumColumn = (field) => {
  if (!field) return new Float32Array(nx * ny);
  if (field.length === nx * ny) return field;
  const nz = Math.round(field.length / (nx * ny));
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const k = j * nx + i;
      let s = 0;
      for (let lev = 0; lev < nz; lev += 1) {
        const v = field[lev * nx * ny + k];
        if (Number.isFinite(v)) s += v;
      }
      out[k] = s;
    }
  }
  return out;
};

const bandFilter = (latMin, latMax, landFilter = 'all') => (i, j) => {
  const l = lat[j];
  if (l < latMin || l > latMax) return false;
  if (landFilter === 'all') return true;
  const isLand = land[j * nx + i] === 1;
  if (landFilter === 'land') return isLand;
  if (landFilter === 'ocean') return !isLand;
  return true;
};

const areaWeightedMean = (field, pass) => {
  let s = 0;
  let w = 0;
  for (let j = 0; j < ny; j += 1) {
    const wLat = Math.cos((lat[j] * Math.PI) / 180);
    for (let i = 0; i < nx; i += 1) {
      if (!pass(i, j)) continue;
      const v = field[j * nx + i];
      if (!Number.isFinite(v)) continue;
      s += v * wLat;
      w += wLat;
    }
  }
  return w > 0 ? s / w : NaN;
};

const simpleMean = (field, pass) => {
  let s = 0;
  let c = 0;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if (!pass(i, j)) continue;
      const v = field[j * nx + i];
      if (!Number.isFinite(v)) continue;
      s += v;
      c += 1;
    }
  }
  return c > 0 ? s / c : NaN;
};

// Reduce per-level state fields to per-column mm/hr equivalent.
const lscSource = snap.largeScaleCondensationSourceKgM2;
const precipReevapCol = sumColumn(state.precipReevaporationMass);
const cloudReevapCol = sumColumn(state.cloudReevaporationMass);

// Convert to mm/hr.
const lscSourceMmHr = new Float32Array(nx * ny);
const precipReevapMmHr = new Float32Array(nx * ny);
const cloudReevapMmHr = new Float32Array(nx * ny);
for (let k = 0; k < nx * ny; k += 1) {
  lscSourceMmHr[k] = lscSource[k] * KG_M2_PER_STEP_TO_MM_HR;
  precipReevapMmHr[k] = precipReevapCol[k] * KG_M2_PER_STEP_TO_MM_HR;
  cloudReevapMmHr[k] = cloudReevapCol[k] * KG_M2_PER_STEP_TO_MM_HR;
}

// Earth reference values (IPCC AR6 / Trenberth et al 2011 global budget):
const EARTH_P_MM_HR = 0.108; // ~2.59 mm/day
const EARTH_E_MM_HR = 0.108;

const EARTH_TROPICAL_P_MM_HR = 0.18;   // ITCZ band ~4.3 mm/day
const EARTH_SUBTROPICAL_P_MM_HR = 0.04; // descending branch ~1 mm/day
const EARTH_MIDLAT_P_MM_HR = 0.10;      // storm tracks ~2.4 mm/day

// ---------- Global diagnostics ----------

const g = (field) => areaWeightedMean(field, () => true);

const globalP = g(snap.precipRateMmHr);
const globalE = g(snap.surfaceEvapRateMmHr);
const globalLsc = g(lscSourceMmHr);
const globalPrecipReevap = g(precipReevapMmHr);
const globalCloudReevap = g(cloudReevapMmHr);
const globalTcw = g(snap.totalColumnWaterKgM2);

console.log('=== R8 global moisture budget (area-weighted, cos(lat)) ===');
console.log(`  Global P (surface)               = ${globalP.toFixed(5)} mm/hr  (Earth ${EARTH_P_MM_HR.toFixed(3)}; ratio ${(globalP / EARTH_P_MM_HR).toFixed(3)})`);
console.log(`  Global E (surface evap)          = ${globalE.toFixed(5)} mm/hr  (Earth ${EARTH_E_MM_HR.toFixed(3)}; ratio ${(globalE / EARTH_E_MM_HR).toFixed(3)})`);
console.log(`  P / E                            = ${(globalP / globalE).toFixed(3)}   (equilibrium closure → should be ~1)`);
console.log(`  Large-scale condensation source  = ${globalLsc.toFixed(5)} mm/hr`);
console.log(`  Precip reevap                    = ${globalPrecipReevap.toFixed(5)} mm/hr`);
console.log(`  Cloud reevap                     = ${globalCloudReevap.toFixed(5)} mm/hr`);
console.log(`  Condensation - precipReevap      = ${(globalLsc - globalPrecipReevap).toFixed(5)} mm/hr   (≈ P if autoconv is fast)`);
console.log(`  Precip reevap / condensation     = ${(globalPrecipReevap / Math.max(1e-8, globalLsc)).toFixed(3)}   (fraction of cond lost back to vapor as rain evap)`);
console.log(`  Cloud reevap / condensation      = ${(globalCloudReevap / Math.max(1e-8, globalLsc)).toFixed(3)}   (fraction of cond lost back to vapor as cloud evap)`);
console.log(`  Total reevap / condensation      = ${((globalPrecipReevap + globalCloudReevap) / Math.max(1e-8, globalLsc)).toFixed(3)}`);
console.log(`  Global TCW                       = ${globalTcw.toFixed(2)} kg/m²   (Earth ~24; ratio ${(globalTcw / 24).toFixed(2)})`);

// ---------- Hypothesis check ----------
console.log('\n=== Hypothesis diagnosis ===');
const h1 = globalE / EARTH_E_MM_HR;
const h2 = globalPrecipReevap / Math.max(1e-8, globalLsc);
const h3 = globalLsc / Math.max(1e-8, globalP);
console.log(`  H1 (evap too low):         E/E_earth   = ${h1.toFixed(3)}  ${h1 < 0.5 ? '[STRONG]' : h1 < 0.8 ? '[WEAK]' : '[rejected]'}`);
console.log(`  H2 (reevap too high):      reevap/cond = ${h2.toFixed(3)}  ${h2 > 0.5 ? '[STRONG]' : h2 > 0.3 ? '[WEAK]' : '[rejected]'}`);
console.log(`  H3 (condensation weak):    cond/P      = ${h3.toFixed(3)}  ${h3 < 2 ? '[condensation insufficient for Earth-like P]' : '[cond ok]'}`);

// ---------- Per-band diagnostics ----------

const band = (label, latMin, latMax, earthRef = null) => {
  const P = areaWeightedMean(snap.precipRateMmHr, bandFilter(latMin, latMax, 'all'));
  const E = areaWeightedMean(snap.surfaceEvapRateMmHr, bandFilter(latMin, latMax, 'all'));
  const Eocean = areaWeightedMean(snap.surfaceEvapRateMmHr, bandFilter(latMin, latMax, 'ocean'));
  const Pland = areaWeightedMean(snap.precipRateMmHr, bandFilter(latMin, latMax, 'land'));
  const Pocean = areaWeightedMean(snap.precipRateMmHr, bandFilter(latMin, latMax, 'ocean'));
  const lsc = areaWeightedMean(lscSourceMmHr, bandFilter(latMin, latMax, 'all'));
  const prReevap = areaWeightedMean(precipReevapMmHr, bandFilter(latMin, latMax, 'all'));
  const tcw = areaWeightedMean(snap.totalColumnWaterKgM2, bandFilter(latMin, latMax, 'all'));
  const rhLow = areaWeightedMean(snap.lowerTroposphericRhFrac, bandFilter(latMin, latMax, 'all'));
  const omLow = areaWeightedMean(snap.lowerTroposphericOmegaPaS, bandFilter(latMin, latMax, 'all'));
  console.log(`\n${label} (${latMin}° to ${latMax}°):`);
  console.log(`  P = ${P.toFixed(5)} (land ${Pland.toFixed(5)} / ocean ${Pocean.toFixed(5)}) mm/hr${earthRef !== null ? `   [Earth ~${earthRef.toFixed(3)}; ratio ${(P / earthRef).toFixed(2)}]` : ''}`);
  console.log(`  E = ${E.toFixed(5)} (ocean ${Eocean.toFixed(5)}) mm/hr`);
  console.log(`  P/E = ${(P / Math.max(1e-8, E)).toFixed(3)}`);
  console.log(`  cond source = ${lsc.toFixed(5)} mm/hr, precipReevap = ${prReevap.toFixed(5)} mm/hr`);
  console.log(`  reevap/cond = ${(prReevap / Math.max(1e-8, lsc)).toFixed(3)}`);
  console.log(`  TCW = ${tcw.toFixed(2)} kg/m², RH_low = ${rhLow.toFixed(3)}, ω_low = ${omLow.toFixed(4)} Pa/s`);
  return { P, E, lsc, prReevap, tcw, rhLow, omLow };
};

const tropical = band('Tropics',            -12,  12, EARTH_TROPICAL_P_MM_HR);
const subtropNh = band('NH subtropics',      15,  35, EARTH_SUBTROPICAL_P_MM_HR);
const subtropSh = band('SH subtropics',     -35, -15, EARTH_SUBTROPICAL_P_MM_HR);
const midlatNh = band('NH midlat',          35,  65, EARTH_MIDLAT_P_MM_HR);
const midlatSh = band('SH midlat',         -65, -35, EARTH_MIDLAT_P_MM_HR);
const polar    = band('Polar',              65,  90, 0.02);
const polarS   = band('Polar (S)',         -90, -65, 0.02);

// ---------- Per-row P, E, cond, reevap ----------
console.log('\n=== Per-row profile (zonal mean, simple mean over longitude) ===');
console.log('  lat       P        E        cond    prReevap  P/E    reevap/cond');
for (let j = 0; j < ny; j += 1) {
  const rowPass = (i, jj) => jj === j;
  const P = simpleMean(snap.precipRateMmHr, rowPass);
  const E = simpleMean(snap.surfaceEvapRateMmHr, rowPass);
  const lsc = simpleMean(lscSourceMmHr, rowPass);
  const pr = simpleMean(precipReevapMmHr, rowPass);
  const pe = P / Math.max(1e-8, E);
  const rc = pr / Math.max(1e-8, lsc);
  console.log(`  ${lat[j].toFixed(1).padStart(6)}   ${P.toFixed(4).padStart(7)}  ${E.toFixed(4).padStart(7)}  ${lsc.toFixed(4).padStart(7)}  ${pr.toFixed(4).padStart(7)}  ${pe.toFixed(2).padStart(5)}  ${rc.toFixed(3).padStart(5)}`);
}

// ---------- Summary for R8 doc ----------
console.log('\n=== R8 summary ===');
console.log(`  Global P deficit factor: ${(EARTH_P_MM_HR / globalP).toFixed(2)}× (model is 1/${(EARTH_P_MM_HR / globalP).toFixed(2)} of Earth)`);
console.log(`  Global E deficit factor: ${(EARTH_E_MM_HR / globalE).toFixed(2)}×`);
console.log(`  P/E closure:             ${(globalP / globalE).toFixed(3)} (≈1 means budget closes; <1 means hidden sink; >1 means hidden source)`);
const worstBand = [
  ['tropics', tropical.P, EARTH_TROPICAL_P_MM_HR],
  ['NH subtrop', subtropNh.P, EARTH_SUBTROPICAL_P_MM_HR],
  ['SH subtrop', subtropSh.P, EARTH_SUBTROPICAL_P_MM_HR],
  ['NH midlat', midlatNh.P, EARTH_MIDLAT_P_MM_HR],
  ['SH midlat', midlatSh.P, EARTH_MIDLAT_P_MM_HR],
].map(([name, v, earth]) => ({ name, ratio: v / earth, v, earth }))
  .sort((a, b) => a.ratio - b.ratio);
console.log('  Band ratios (P_model / P_earth):');
for (const b of worstBand) {
  console.log(`    ${b.name.padEnd(14)}: ${b.ratio.toFixed(2)}   (${b.v.toFixed(4)} vs ${b.earth.toFixed(4)} mm/hr)`);
}
