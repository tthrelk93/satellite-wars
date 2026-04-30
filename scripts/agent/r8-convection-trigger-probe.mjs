#!/usr/bin/env node
/**
 * R8 convective-trigger probe.
 *
 * From the R8 budget probe we learned:
 *   - Tropical P = 0.021 mm/hr (12% of Earth's 0.18 mm/hr)
 *   - Tropical RH_low = 0.39 (Earth 0.65-0.80)
 *   - Tropical TCW = 46 kg/m² (high) — moisture is upstairs, not in BL
 *   - Convective fraction 0.125 (should be ~0.35-0.55)
 *
 * Hypothesis: convection scheme fires rarely in tropics because the
 * surface RH trigger (rhTrig = 0.72) gates rhSupport via
 *   rhSupport = smoothstep(rhTrig - 0.15, rhTrig + 0.08, rhS)
 *              = smoothstep(0.57, 0.80, rhS)
 * and the tropics live near 0.4 RH → rhSupport ≈ 0.
 *
 * This probe samples per-row statistics of:
 *   - convectivePotential (evolving state 0..1)
 *   - convectiveOrganization (evolving state 0..1)
 *   - convMask (binary: is convection firing right now?)
 *   - subtropicalSuppression (diagnostic, gates convection in [15..35])
 *   - surface RH vs lower-tropospheric RH
 *   - low-level omega (ascent magnitude)
 *   - instability (thetaE surface − thetaE mid)
 *
 * We want to see:
 *   (a) Is the convMask frequency low in tropics?  If yes, the trigger
 *       is too strict — RH_low below rhTrig−0.15.
 *   (b) Is convectiveOrganization low in tropics?  If yes, the organization
 *       build-up is too slow or gated too hard.
 *   (c) Is subtropicalSuppression bleeding into tropics (below 15° abs
 *       lat)?  That was the R1-R4 fix terrain; might be over-eager now.
 *   (d) How does lowest-layer RH vs lower-tropospheric RH differ?  If BL
 *       is dry but mid is wet, that explains TCW-high/precip-low.
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
const state = core.state;
const lat = snap.grid.latitudesDeg;

const rowMean = (field) => {
  const out = new Float64Array(ny);
  for (let j = 0; j < ny; j += 1) {
    let s = 0; let c = 0;
    for (let i = 0; i < nx; i += 1) {
      const v = field?.[j * nx + i];
      if (Number.isFinite(v)) { s += v; c += 1; }
    }
    out[j] = c > 0 ? s / c : NaN;
  }
  return out;
};

const rowFrac = (field, pred) => {
  const out = new Float64Array(ny);
  for (let j = 0; j < ny; j += 1) {
    let s = 0;
    for (let i = 0; i < nx; i += 1) {
      if (pred(field?.[j * nx + i])) s += 1;
    }
    out[j] = s / nx;
  }
  return out;
};

// Surface (lowest level) vars; lower-trop and mid-trop from snap.
const convPotential = state.convectivePotential;
const convOrganization = state.convectiveOrganization;
const convMask = state.convMask;
const subtropSuppression = state.freshSubtropicalSuppressionDiag;
const freshOrganizedSupport = state.freshOrganizedSupportDiag;
const potentialTargetField = state.freshPotentialTargetDiag;
const rhLower = snap.lowerTroposphericRhFrac;
const rhBoundary = snap.boundaryLayerRhFrac;
const omegaLow = snap.lowerTroposphericOmegaPaS;

const convPotentialRow = rowMean(convPotential);
const convOrgRow = rowMean(convOrganization);
const convMaskFracRow = rowFrac(convMask, (v) => v === 1);
const subtropSupressionRow = rowMean(subtropSuppression);
const freshOrgRow = rowMean(freshOrganizedSupport);
const potentialTargetRow = rowMean(potentialTargetField);
const rhLowerRow = rowMean(rhLower);
const rhBoundaryRow = rowMean(rhBoundary);
const omegaLowRow = rowMean(omegaLow);

console.log('=== R8 convection-trigger probe ===');
console.log('\nPer-row zonal means (48 columns each row):');
console.log('  lat    convMask%  convPot  convOrg  potTarget  subtropSup  freshOrg  RH_BL   RH_low  omega_low');
for (let j = 0; j < ny; j += 1) {
  const l = lat[j];
  console.log(
    `  ${l.toFixed(1).padStart(6)}`
    + `  ${(convMaskFracRow[j] * 100).toFixed(1).padStart(7)}%`
    + `  ${convPotentialRow[j].toFixed(3).padStart(6)}`
    + `  ${convOrgRow[j].toFixed(3).padStart(6)}`
    + `  ${potentialTargetRow[j].toFixed(3).padStart(8)}`
    + `  ${subtropSupressionRow[j].toFixed(3).padStart(9)}`
    + `  ${freshOrgRow[j].toFixed(3).padStart(7)}`
    + `  ${rhBoundaryRow[j].toFixed(3).padStart(5)}`
    + `  ${rhLowerRow[j].toFixed(3).padStart(5)}`
    + `  ${omegaLowRow[j].toFixed(4).padStart(8)}`
  );
}

// Band summaries
const band = (label, latMin, latMax) => {
  const js = [];
  for (let j = 0; j < ny; j += 1) if (lat[j] >= latMin && lat[j] <= latMax) js.push(j);
  const avg = (arr) => {
    let s = 0; let c = 0;
    for (const j of js) { if (Number.isFinite(arr[j])) { s += arr[j]; c += 1; } }
    return c > 0 ? s / c : NaN;
  };
  console.log(
    `\n${label} (${latMin}° to ${latMax}°):`
    + `\n  convMask fraction = ${(avg(convMaskFracRow) * 100).toFixed(2)}%`
    + `\n  convPotential     = ${avg(convPotentialRow).toFixed(3)}`
    + `\n  convOrganization  = ${avg(convOrgRow).toFixed(3)}`
    + `\n  potTarget         = ${avg(potentialTargetRow).toFixed(3)}   (must exceed convMinPotential=0.15 before conv fires)`
    + `\n  subtropSuppression= ${avg(subtropSupressionRow).toFixed(3)}`
    + `\n  RH (BL / lower)   = ${avg(rhBoundaryRow).toFixed(3)} / ${avg(rhLowerRow).toFixed(3)}`
    + `\n  omega_low         = ${avg(omegaLowRow).toFixed(4)} Pa/s`
  );
};

band('Deep tropics',      -6,   6);
band('Tropics',          -12,  12);
band('ITCZ shoulder N',    6,  15);
band('ITCZ shoulder S',  -15,  -6);
band('NH subtrop',        15,  35);
band('SH subtrop',       -35, -15);
band('NH midlat',         35,  65);
band('SH midlat',        -65, -35);

// Smoking-gun summary
console.log('\n=== Smoking-gun summary ===');
const tropMaskPct = 0;
let tropMaskSum = 0, tropMaskCount = 0;
let tropPotSum = 0, tropOrgSum = 0;
for (let j = 0; j < ny; j += 1) {
  if (lat[j] < -12 || lat[j] > 12) continue;
  tropMaskSum += convMaskFracRow[j];
  tropPotSum += convPotentialRow[j];
  tropOrgSum += convOrgRow[j];
  tropMaskCount += 1;
}
const tropMaskAvg = tropMaskSum / tropMaskCount;
const tropPotAvg = tropPotSum / tropMaskCount;
const tropOrgAvg = tropOrgSum / tropMaskCount;

console.log(`Tropical convMask active fraction:  ${(tropMaskAvg * 100).toFixed(1)}%`);
console.log(`Tropical convPotential mean:        ${tropPotAvg.toFixed(3)} (threshold 0.15 to start producing activity)`);
console.log(`Tropical convOrganization mean:     ${tropOrgAvg.toFixed(3)} (threshold 0.18 to start producing activity)`);
console.log(`\nEarth-like target: convMask ~35-55%, convPot+Org both approaching 0.4-0.6 in ITCZ.`);
