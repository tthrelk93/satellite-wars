#!/usr/bin/env node
/**
 * R7 Southern-hemisphere storm-track + dry-belt asymmetry probe.
 *
 * After R5 closed out the TC-environment residual, the only remaining planetary-
 * realism failures are SH-specific:
 *   - SH storm track at -26.25° vs target window -65 … -30°    (severity 0.188)
 *   - SH subtropical dry belt ratio 0.885 vs target < 0.8        (severity 0.170)
 * The NH equivalents pass, so this is a hemispheric-asymmetry problem, not a
 * global shortfall.  This probe spins up WeatherCore5 to a statistically steady
 * state at 48x24, then compares NH and SH zonal-mean dynamics to pinpoint which
 * component (jet latitude, baroclinicity, stationary eddies, Ferrel ascent,
 * precipitation band) is displaced.
 */
import fs from 'node:fs';
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

process.stdout.write(`[r7-probe] spinning up for ${spinupDays} days @ ${nx}x${ny}... `);
core.advanceModelSeconds(spinupDays * 86400);
process.stdout.write('done.\n');

const snap = buildValidationDiagnostics(core);
const { latitudesDeg } = snap.grid;

// ---- helpers -----------------------------------------------------------
const zonalMean = (field) => {
  const out = new Array(ny).fill(0);
  for (let j = 0; j < ny; j += 1) {
    let s = 0; let c = 0;
    for (let i = 0; i < nx; i += 1) {
      const v = field[j * nx + i];
      if (Number.isFinite(v)) { s += v; c += 1; }
    }
    out[j] = c > 0 ? s / c : 0;
  }
  return out;
};

const zonalStationaryVar = (field) => {
  // Stationary-eddy variance per row: <(X - X_zonal)^2>
  const out = new Array(ny).fill(0);
  const means = zonalMean(field);
  for (let j = 0; j < ny; j += 1) {
    let s = 0; let c = 0;
    for (let i = 0; i < nx; i += 1) {
      const v = field[j * nx + i];
      if (Number.isFinite(v)) {
        const d = v - means[j];
        s += d * d; c += 1;
      }
    }
    out[j] = c > 0 ? s / c : 0;
  }
  return out;
};

// Geostrophic zonal wind at a pressure level from geopotential height Z(lat,lon):
//   u_g = -(g/f) * dZ/dy
// We compute zonal-mean Z, then central-difference with latitude.
const OMEGA_EARTH = 7.2921e-5;
const REARTH_M = 6.371e6;
const GRAV = 9.80665;
const fCoriolis = (latDeg) => 2 * OMEGA_EARTH * Math.sin(latDeg * Math.PI / 180);

const geostrophicUFromZ = (zField) => {
  const zZonal = zonalMean(zField);
  const dy = (Math.PI / 180) * REARTH_M * (latitudesDeg[1] - latitudesDeg[0]); // metres per row
  const u = new Array(ny).fill(0);
  for (let j = 1; j < ny - 1; j += 1) {
    const lat = latitudesDeg[j];
    if (Math.abs(lat) < 3) { u[j] = 0; continue; } // avoid equatorial singularity
    const dZ = zZonal[j + 1] - zZonal[j - 1];
    const f = fCoriolis(lat);
    u[j] = -(GRAV / f) * (dZ / (2 * dy));
  }
  // extrapolate edges
  u[0] = u[1]; u[ny - 1] = u[ny - 2];
  return u;
};

// Argmax: return latitude of max of an array over a band, or the lat of min for polar lows.
const argMaxLat = (arr, latMin, latMax) => {
  let bestIdx = -1; let bestVal = -Infinity;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < latMin || lat > latMax) continue;
    const v = arr[j];
    if (v > bestVal) { bestVal = v; bestIdx = j; }
  }
  return bestIdx >= 0 ? { lat: latitudesDeg[bestIdx], value: bestVal } : { lat: NaN, value: NaN };
};

const argMinLat = (arr, latMin, latMax) => {
  let bestIdx = -1; let bestVal = Infinity;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < latMin || lat > latMax) continue;
    const v = arr[j];
    if (v < bestVal) { bestVal = v; bestIdx = j; }
  }
  return bestIdx >= 0 ? { lat: latitudesDeg[bestIdx], value: bestVal } : { lat: NaN, value: NaN };
};

// Meridional gradient (central difference in y)
const meridionalGradient = (arr) => {
  const dy = (Math.PI / 180) * REARTH_M * (latitudesDeg[1] - latitudesDeg[0]);
  const out = new Array(ny).fill(0);
  for (let j = 1; j < ny - 1; j += 1) {
    out[j] = (arr[j + 1] - arr[j - 1]) / (2 * dy);
  }
  out[0] = out[1]; out[ny - 1] = out[ny - 2];
  return out;
};

// ---- extract fields ----------------------------------------------------
const u10ZM = zonalMean(snap.wind10mU);
const v10ZM = zonalMean(snap.wind10mV);
const u10StatVar = zonalStationaryVar(snap.wind10mU);
const v10StatVar = zonalStationaryVar(snap.wind10mV);
const slpStatVar = zonalStationaryVar(snap.seaLevelPressurePa);
const precipZM = zonalMean(snap.precipRateMmHr);
const tcwZM = zonalMean(snap.totalColumnWaterKgM2);
const thetaLowZM = zonalMean(snap.lowerTropospherePotentialTemperatureK);
const dThetaLowDy = meridionalGradient(thetaLowZM);
const omegaLowZM = zonalMean(snap.lowerTroposphericOmegaPaS);
const omegaMidZM = zonalMean(snap.midTroposphericOmegaPaS);
const omegaUpperZM = zonalMean(snap.upperTroposphericOmegaPaS);
const lowCloudZM = zonalMean(snap.cloudLowFraction);
const highCloudZM = zonalMean(snap.cloudHighFraction);
const rhMidZM = zonalMean(snap.midTroposphericRhFrac);
const rhLowZM = zonalMean(snap.lowerTroposphericRhFrac);
const landMaskZM = zonalMean(snap.landMask);

// Geostrophic upper-level winds (250 hPa is a standard jet proxy; 500 hPa is mid-trop)
const z250 = snap.geopotentialHeightMByPressurePa[25000];
const z500 = snap.geopotentialHeightMByPressurePa[50000];
const z850 = snap.geopotentialHeightMByPressurePa[85000];
const u250ZM = z250 ? geostrophicUFromZ(z250) : new Array(ny).fill(NaN);
const u500ZM = z500 ? geostrophicUFromZ(z500) : new Array(ny).fill(NaN);
const u850ZM = z850 ? geostrophicUFromZ(z850) : new Array(ny).fill(NaN);

// Eddy-KE proxy (stationary-eddy kinetic energy at surface)
const ekeSurf = u10StatVar.map((u2, i) => 0.5 * (u2 + v10StatVar[i]));

// ---- asymmetry summary -------------------------------------------------
const summary = {};
for (const hemi of ['nh', 'sh']) {
  const [latMin, latMax] = hemi === 'nh' ? [5, 80] : [-80, -5];
  const poleward = hemi === 'nh' ? [30, 80] : [-80, -30];
  const subtrop = hemi === 'nh' ? [15, 35] : [-35, -15];
  const ferrelBand = hemi === 'nh' ? [30, 60] : [-60, -30];
  summary[hemi] = {
    u250Jet: argMaxLat(u250ZM, ...poleward),
    u500Jet: argMaxLat(u500ZM, ...poleward),
    u10Jet: argMaxLat(u10ZM, ...poleward),
    baroclinicityPeak: argMaxLat(dThetaLowDy.map((x) => hemi === 'nh' ? -x : x), latMin, latMax), // dT/dy negative in NH, positive in SH — take |dT/dy|
    ekeSurfPeak: argMaxLat(ekeSurf, ...poleward),
    slpStatVarPeak: argMaxLat(slpStatVar, ...poleward),
    ferrelAscentPeak: argMinLat(omegaLowZM, ...ferrelBand), // Ferrel ascends → negative omega
    ferrelAscentMid: argMinLat(omegaMidZM, ...ferrelBand),
    precipPeakSubtrop: argMaxLat(precipZM, ...subtrop),
    precipPeakExtratrop: argMaxLat(precipZM, ...poleward),
    tcwAtSubtropDry: tcwZM[argMaxLat(tcwZM.map((x, j) => {
      const lat = latitudesDeg[j];
      if (lat < subtrop[0] || lat > subtrop[1]) return -Infinity;
      return -x; // find minimum TCW in dry belt
    }), latMin, latMax).lat] ?? null,
    dryBeltOmegaLow: omegaLowZM.filter((_, j) => latitudesDeg[j] >= subtrop[0] && latitudesDeg[j] <= subtrop[1])
      .reduce((s, v, _, a) => s + v / a.length, 0),
    midLatOmegaLow: omegaLowZM.filter((_, j) => latitudesDeg[j] >= ferrelBand[0] && latitudesDeg[j] <= ferrelBand[1])
      .reduce((s, v, _, a) => s + v / a.length, 0)
  };
}

// ---- emit -------------------------------------------------------------
console.log('\n=== R7 SH/NH asymmetry probe ===');
console.log(`grid: ${nx}x${ny}   spinup: ${spinupDays} days   dt: ${dt}s`);

const row = (label, nhVal, shVal, extra = '') => {
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(3) : String(v));
  console.log(`  ${label.padEnd(34)}  NH: ${fmt(nhVal).padStart(10)}    SH: ${fmt(shVal).padStart(10)}   ${extra}`);
};

console.log('\n-- Jet latitudes (argmax zonal wind) --');
row('u250 jet lat (°)', summary.nh.u250Jet.lat, summary.sh.u250Jet.lat);
row('u250 jet max (m/s)', summary.nh.u250Jet.value, summary.sh.u250Jet.value);
row('u500 jet lat (°)', summary.nh.u500Jet.lat, summary.sh.u500Jet.lat);
row('u500 jet max (m/s)', summary.nh.u500Jet.value, summary.sh.u500Jet.value);
row('u10 jet lat (°)', summary.nh.u10Jet.lat, summary.sh.u10Jet.lat);
row('u10 jet max (m/s)', summary.nh.u10Jet.value, summary.sh.u10Jet.value);

console.log('\n-- Baroclinicity (|dθ/dy| peak) --');
row('baroclinic peak lat (°)', summary.nh.baroclinicityPeak.lat, summary.sh.baroclinicityPeak.lat);

console.log('\n-- Eddy signatures (stationary variance) --');
row('surface EKE peak lat (°)', summary.nh.ekeSurfPeak.lat, summary.sh.ekeSurfPeak.lat);
row('surface EKE peak (m²/s²)', summary.nh.ekeSurfPeak.value, summary.sh.ekeSurfPeak.value);
row('SLP stat-var peak lat (°)', summary.nh.slpStatVarPeak.lat, summary.sh.slpStatVarPeak.lat);
row('SLP stat-var peak (Pa²)', summary.nh.slpStatVarPeak.value, summary.sh.slpStatVarPeak.value);

console.log('\n-- Ferrel cell (lower-tropospheric ascent) --');
row('Ferrel ascent lat LOW (°)', summary.nh.ferrelAscentPeak.lat, summary.sh.ferrelAscentPeak.lat);
row('Ferrel omega LOW (Pa/s)', summary.nh.ferrelAscentPeak.value, summary.sh.ferrelAscentPeak.value);
row('Ferrel ascent lat MID (°)', summary.nh.ferrelAscentMid.lat, summary.sh.ferrelAscentMid.lat);
row('Ferrel omega MID (Pa/s)', summary.nh.ferrelAscentMid.value, summary.sh.ferrelAscentMid.value);

console.log('\n-- Precipitation peaks --');
row('subtrop precip peak lat (°)', summary.nh.precipPeakSubtrop.lat, summary.sh.precipPeakSubtrop.lat);
row('subtrop precip peak (mm/hr)', summary.nh.precipPeakSubtrop.value, summary.sh.precipPeakSubtrop.value);
row('extratrop precip peak lat (°)', summary.nh.precipPeakExtratrop.lat, summary.sh.precipPeakExtratrop.lat);
row('extratrop precip peak (mm/hr)', summary.nh.precipPeakExtratrop.value, summary.sh.precipPeakExtratrop.value);

console.log('\n-- Subtropical descent --');
row('subtrop omega LOW mean (Pa/s)', summary.nh.dryBeltOmegaLow, summary.sh.dryBeltOmegaLow);
row('midlat omega LOW mean (Pa/s)', summary.nh.midLatOmegaLow, summary.sh.midLatOmegaLow);

console.log('\n-- Land fraction (context) --');
const nhLandFrac = landMaskZM.filter((_, j) => latitudesDeg[j] >= 15 && latitudesDeg[j] <= 60).reduce((s, v, _, a) => s + v / a.length, 0);
const shLandFrac = landMaskZM.filter((_, j) => latitudesDeg[j] >= -60 && latitudesDeg[j] <= -15).reduce((s, v, _, a) => s + v / a.length, 0);
row('land fraction (15-60°)', nhLandFrac, shLandFrac);

// Full zonal profiles for the record
console.log('\n-- Full zonal profiles (lat, u250, u10, θ_low-zm, dθ/dy, ω_low, precip, EKE, SLP-var) --');
console.log('   lat    u250    u10    θ_low    dθ/dy      ω_low    precip    EKE    SLP-var');
for (let j = 0; j < ny; j += 1) {
  const lat = latitudesDeg[j];
  console.log(
    `  ${lat.toFixed(1).padStart(6)}  ${u250ZM[j].toFixed(2).padStart(6)}  ${u10ZM[j].toFixed(2).padStart(6)}  ${thetaLowZM[j].toFixed(1).padStart(6)}  ${(dThetaLowDy[j] * 1e6).toFixed(2).padStart(7)}   ${omegaLowZM[j].toFixed(4).padStart(8)}  ${precipZM[j].toFixed(4).padStart(6)}  ${ekeSurf[j].toFixed(2).padStart(6)}  ${slpStatVar[j].toFixed(0).padStart(6)}`
  );
}

// Save JSON artifact
const outDir = path.join(repoRoot, 'weather-validation/output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'r7-sh-nh-asymmetry-probe.json');
fs.writeFileSync(outPath, JSON.stringify({
  grid: { nx, ny, dt, spinupDays },
  latitudesDeg,
  profiles: {
    u10ZM, v10ZM, u250ZM, u500ZM, u850ZM,
    u10StatVar, v10StatVar, slpStatVar,
    thetaLowZM, dThetaLowDy,
    omegaLowZM, omegaMidZM, omegaUpperZM,
    precipZM, tcwZM,
    lowCloudZM, highCloudZM,
    rhLowZM, rhMidZM,
    landMaskZM,
    ekeSurf
  },
  summary,
  context: { nhLandFrac, shLandFrac }
}, null, 2));
console.log(`\n[r7-probe] saved artifact to ${path.relative(repoRoot, outPath)}`);
