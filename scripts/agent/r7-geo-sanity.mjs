#!/usr/bin/env node
/**
 * Quick sanity check: dump zonal-mean geopotential height at 250/500/850 hPa
 * to verify my R7 probe's geostrophic-wind sign convention.  Expected: Z(250)
 * peaks near the equator (~10900 m) and decreases poleward (~10200 m at 60°).
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
const zonalMean = (field) => {
  const out = new Array(ny).fill(0);
  for (let j = 0; j < ny; j += 1) {
    let s = 0; let c = 0;
    for (let i = 0; i < nx; i += 1) { const v = field[j * nx + i]; if (Number.isFinite(v)) { s += v; c += 1; } }
    out[j] = c > 0 ? s / c : 0;
  }
  return out;
};

console.log('levels avail:', Object.keys(snap.geopotentialHeightMByPressurePa));
const z250 = snap.geopotentialHeightMByPressurePa[25000];
const z500 = snap.geopotentialHeightMByPressurePa[50000];
const z850 = snap.geopotentialHeightMByPressurePa[85000];
const lat = snap.grid.latitudesDeg;

console.log('\nlat    Z250     Z500     Z850    Tθlow');
const zm250 = zonalMean(z250);
const zm500 = zonalMean(z500);
const zm850 = zonalMean(z850);
const tm = zonalMean(snap.lowerTropospherePotentialTemperatureK);
for (let j = 0; j < ny; j += 1) {
  console.log(`  ${lat[j].toFixed(1).padStart(6)}   ${zm250[j].toFixed(0).padStart(6)}   ${zm500[j].toFixed(0).padStart(6)}   ${zm850[j].toFixed(0).padStart(6)}   ${tm[j].toFixed(1).padStart(6)}`);
}
