#!/usr/bin/env node
/**
 * R7 SH dry-belt decomposition probe.
 *
 * Why is subtropicalDrySouthRatio stuck at 0.885 > 0.8 gate?
 *   ratio = <precip>_{-35…-15°S} / <precip>_{-12…+12°}
 *
 * The audit emits a rich per-sector breakdown for NH dry belt but not SH, so
 * this probe mirrors the relevant slices: SH-subtrop land vs ocean precip,
 * SH-subtrop evap, SH-subtrop RH, SH-subtrop low-level ω, and the same for
 * the NH subtrop for side-by-side comparison.  We also compute per-latitude
 * precip in the SH tropics (0…-12°) to see whether equatorial precip is
 * skewed NH, which would inflate the ratio even if SH subtrop precip is low.
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

const nx = 48; const ny = 24; const dt = 3600; const spinupDays = 180;
const core = new WeatherCore5({ nx, ny, dt, seed: 42, instrumentationMode: 'full' });
await core._initPromise;
applyHeadlessTerrainFixture(core);
core.clearReplayDisabledModules?.();
core.advanceModelSeconds(spinupDays * 86400);
const snap = buildValidationDiagnostics(core);
const lat = snap.grid.latitudesDeg;
const land = snap.landMask;

const hemiFilter = (latMin, latMax, landFilter /* 'land' | 'ocean' | 'all' */) => {
  return (i, j) => {
    const l = lat[j];
    if (l < latMin || l > latMax) return false;
    const isLand = land[j * nx + i] === 1;
    if (landFilter === 'land' && !isLand) return false;
    if (landFilter === 'ocean' && isLand) return false;
    return true;
  };
};

const meanWhere = (field, pass) => {
  let s = 0; let c = 0;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if (!pass(i, j)) continue;
      const v = field[j * nx + i];
      if (Number.isFinite(v)) { s += v; c += 1; }
    }
  }
  return c > 0 ? s / c : NaN;
};

const rows = (lo, hi) => {
  const js = [];
  for (let j = 0; j < ny; j += 1) if (lat[j] >= lo && lat[j] <= hi) js.push(j);
  return js;
};

const report = (label, latLo, latHi) => {
  const precipTotal = meanWhere(snap.precipRateMmHr, hemiFilter(latLo, latHi, 'all'));
  const precipLand = meanWhere(snap.precipRateMmHr, hemiFilter(latLo, latHi, 'land'));
  const precipOcean = meanWhere(snap.precipRateMmHr, hemiFilter(latLo, latHi, 'ocean'));
  const evapTotal = meanWhere(snap.surfaceEvapRateMmHr, hemiFilter(latLo, latHi, 'all'));
  const evapOcean = meanWhere(snap.surfaceEvapRateMmHr, hemiFilter(latLo, latHi, 'ocean'));
  const rhLow = meanWhere(snap.lowerTroposphericRhFrac, hemiFilter(latLo, latHi, 'all'));
  const rhLowOcean = meanWhere(snap.lowerTroposphericRhFrac, hemiFilter(latLo, latHi, 'ocean'));
  const rhBl = meanWhere(snap.boundaryLayerRhFrac, hemiFilter(latLo, latHi, 'all'));
  const omegaLow = meanWhere(snap.lowerTroposphericOmegaPaS, hemiFilter(latLo, latHi, 'all'));
  const subsidenceDry = meanWhere(snap.subtropicalSubsidenceDryingFrac, hemiFilter(latLo, latHi, 'all'));
  const tcw = meanWhere(snap.totalColumnWaterKgM2, hemiFilter(latLo, latHi, 'all'));
  const lcsSrc = meanWhere(snap.largeScaleCondensationSourceKgM2, hemiFilter(latLo, latHi, 'all'));
  let nLand = 0, nOcean = 0;
  for (let j = 0; j < ny; j += 1) {
    if (lat[j] < latLo || lat[j] > latHi) continue;
    for (let i = 0; i < nx; i += 1) {
      if (land[j * nx + i] === 1) nLand += 1; else nOcean += 1;
    }
  }
  const landFrac = nLand / Math.max(1, nLand + nOcean);
  console.log(`\n${label} (${latLo}°…${latHi}°, land frac ${(landFrac * 100).toFixed(1)}%):`);
  console.log(`  precip total/land/ocean (mm/hr):  ${precipTotal.toFixed(4)} / ${precipLand.toFixed(4)} / ${precipOcean.toFixed(4)}`);
  console.log(`  evap total/ocean       (mm/hr):  ${evapTotal.toFixed(4)} / ${evapOcean.toFixed(4)}`);
  console.log(`  RH low/BL (frac)              :  ${rhLow.toFixed(3)} / ${rhBl.toFixed(3)}   (ocean-only low: ${rhLowOcean.toFixed(3)})`);
  console.log(`  ω_low mean              (Pa/s):  ${omegaLow.toFixed(4)}`);
  console.log(`  subtropical subsidence drying  :  ${subsidenceDry.toFixed(4)}`);
  console.log(`  TCW                   (kg/m²) :  ${tcw.toFixed(2)}`);
  console.log(`  large-scale-condensation source (kg/m²): ${lcsSrc.toFixed(5)}`);
  return { precipTotal, precipLand, precipOcean, evapOcean, rhLow, omegaLow, tcw };
};

console.log('=== R7 SH vs NH dry-belt decomposition ===');
const shDry = report('SH dry belt', -35, -15);
const nhDry = report('NH dry belt', 15, 35);
const eq = report('Equatorial',   -12, 12);
const shTrop = report('SH tropic',  -12,   0);
const nhTrop = report('NH tropic',    0,  12);
const shTransition = report('SH transition (-22..-12)', -22, -12);
const nhTransition = report('NH transition (12..22)',    12,  22);

console.log('\n=== Ratios ===');
console.log(`  NH dry / equator:    ${(nhDry.precipTotal / eq.precipTotal).toFixed(3)}  (gate < 0.8)`);
console.log(`  SH dry / equator:    ${(shDry.precipTotal / eq.precipTotal).toFixed(3)}  (gate < 0.8)`);
console.log(`  SH dry ocean / eq:   ${(shDry.precipOcean / eq.precipTotal).toFixed(3)}`);
console.log(`  SH tropic / NH tropic precip: ${(shTrop.precipTotal / nhTrop.precipTotal).toFixed(3)}   ← ITCZ asymmetry`);
console.log(`  SH transition / equator:  ${(shTransition.precipTotal / eq.precipTotal).toFixed(3)}   ← leakage risk`);
console.log(`  NH transition / equator:  ${(nhTransition.precipTotal / eq.precipTotal).toFixed(3)}`);

// Per-row precip in SH dry and SH transition
console.log('\n=== Per-row precip [SH dry band -35..-15] ===');
for (const j of rows(-35, -15)) {
  const l = lat[j];
  let sumAll = 0, sumLand = 0, sumOcean = 0, nAll = 0, nLand = 0, nOcean = 0;
  for (let i = 0; i < nx; i += 1) {
    const v = snap.precipRateMmHr[j * nx + i];
    if (Number.isFinite(v)) { sumAll += v; nAll += 1; }
    const isLand = land[j * nx + i] === 1;
    if (isLand && Number.isFinite(v)) { sumLand += v; nLand += 1; } else if (!isLand && Number.isFinite(v)) { sumOcean += v; nOcean += 1; }
  }
  console.log(`  ${l.toFixed(2).padStart(7)}°  precip total=${(nAll?sumAll/nAll:0).toFixed(4)}  land=${(nLand?sumLand/nLand:0).toFixed(4)} (${nLand}/${nx})  ocean=${(nOcean?sumOcean/nOcean:0).toFixed(4)} (${nOcean}/${nx})`);
}
