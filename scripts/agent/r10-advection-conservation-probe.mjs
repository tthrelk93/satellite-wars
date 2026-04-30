#!/usr/bin/env node
/**
 * R10 advection conservation probe.
 *
 * Baseline (pre-R10) from R8 budget:
 *   stepAdvection5 per-day ΔColumn = -0.418 kg/m² (vapor -1.366, condensate +0.948)
 *
 * With R10's mass-conservation correction we expect stepAdvection5 per-day
 * ΔColumn ≈ 0 (to within floating-point round-off).  This probe runs a
 * 60-day spinup with conservation tracking and prints per-module deltas.
 *
 * Success criteria:
 *   - stepAdvection5 globalColumnWaterMean delta per day: |value| < 0.02 kg/m²
 *   - Global TCW not drifting wildly (±10% of R7 baseline 30.2 kg/m²)
 *   - No NaN/Infinity anywhere
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
core.resetConservationDiagnostics?.();
core.advanceModelSeconds(spinupDays * 86400);

const summary = core.getConservationSummary();
const budget = summary?.conservationBudget || summary;

console.log('=== R10 advection-conservation probe ===');
console.log(`Spin-up:              ${spinupDays} days, ${nx}×${ny} grid, dt=${dt}s`);
console.log(`Sampled model seconds: ${budget.sampledModelSeconds}`);
console.log(`Sample count:          ${budget.sampleCount}`);
console.log();

const modules = budget.modules || {};
const sampledDays = (budget.sampledModelSeconds || 1) / 86400;

const moduleRow = (name) => {
  const mod = modules[name];
  if (!mod) return null;
  const d = mod.delta || {};
  const rate = (key) => (d[key] || 0) / sampledDays;
  return {
    ΔColumn: rate('globalColumnWaterMeanKgM2'),
    Vapor:   rate('globalVaporMeanKgM2'),
    Cond:    rate('globalCondensateMeanKgM2'),
    Precip:  rate('globalPrecipAccumMeanMm')
  };
};

const pad = (n, w = 9) => {
  if (!Number.isFinite(n)) return '   n/a  ';
  const s = (n >= 0 ? '+' : '') + n.toFixed(4);
  return s.padStart(w);
};

console.log('Per-module per-day deltas (kg/m²/day, cos-lat weighted):');
console.log('  Module                  ΔColumn    Vapor    Cond    PrecipAccum');
const names = ['stepSurface2D5', 'stepAdvection5', 'stepVertical5', 'stepMicrophysics5', 'stepNudging5'];
for (const n of names) {
  const r = moduleRow(n);
  if (!r) { console.log(`  ${n.padEnd(22)} [no data]`); continue; }
  console.log(`  ${n.padEnd(22)}  ${pad(r.ΔColumn)}  ${pad(r.Vapor)}  ${pad(r.Cond)}  ${pad(r.Precip)}`);
}

console.log();
console.log('Expected (R7 baseline, pre-R10):');
console.log('  stepAdvection5  ΔColumn ≈ -0.418 kg/m²/day  (this IS the leak)');
console.log();
console.log('R10 target:');
console.log('  stepAdvection5  ΔColumn ≈  0.000 kg/m²/day  (leak closed)');

// Net daily column change
let netDelta = 0;
for (const n of names) {
  const mod = modules[n];
  if (!mod) continue;
  netDelta += (mod.delta?.globalColumnWaterMeanKgM2 || 0);
}
netDelta /= sampledDays;
console.log();
console.log(`Net column-water drift (all modules combined): ${pad(netDelta)} kg/m²/day`);

// Final TCW vs R7 baseline
const finalSnapshot = core._captureConservationSnapshot ? core._captureConservationSnapshot() : null;
if (finalSnapshot) {
  console.log(`Final global TCW: ${finalSnapshot.globalColumnWaterMeanKgM2.toFixed(2)} kg/m² (R7 baseline: 30.2)`);
  console.log(`Final global vapor: ${finalSnapshot.globalVaporMeanKgM2.toFixed(2)} kg/m²`);
  console.log(`Final surface temp: ${finalSnapshot.globalSurfaceTempMeanK.toFixed(2)} K`);
}

const advDelta = Math.abs(moduleRow('stepAdvection5')?.ΔColumn || 0);
console.log();
if (advDelta < 0.05) {
  console.log('✓ R10 advection conservation PASSES: |ΔColumn| < 0.05 kg/m²/day');
  process.exit(0);
} else {
  console.log(`✗ R10 advection conservation FAILS: |ΔColumn| = ${advDelta.toFixed(4)} kg/m²/day ≥ 0.05`);
  process.exit(1);
}
