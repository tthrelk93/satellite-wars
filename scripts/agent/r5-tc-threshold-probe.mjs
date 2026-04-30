#!/usr/bin/env node
/**
 * R5 tropical cyclone threshold probe.
 *
 * Spin up the WeatherCore5 to a statistically steady state, then snapshot
 * the tropical belt (lat |phi| in [5, 30]) and report, per hemisphere:
 *   - pass counts for each individual TC detector threshold
 *   - the joint pass count (i.e. the metric reported by the audit)
 *   - distribution summaries for vorticity, SLP anomaly, TCW, SST, wind
 *
 * This lets us see which threshold is actually binding at 48x24.
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
const stepsPerDay = Math.round(86400 / dt);

const core = new WeatherCore5({ nx, ny, dt, seed: 42, instrumentationMode: 'full' });
await core._initPromise;
applyHeadlessTerrainFixture(core);
core.clearReplayDisabledModules?.();

process.stdout.write(`Spinning up for ${spinupDays} days... `);
core.advanceModelSeconds(spinupDays * 86400);
process.stdout.write('done.\n');

const snapshot = buildValidationDiagnostics(core);

const {
  grid,
  seaLevelPressurePa,
  wind10mSpeedMs,
  totalColumnWaterKgM2,
  sstK,
  seaIceFraction,
  cycloneSupportFields
} = snapshot;

const { latitudesDeg } = grid;
const vort = cycloneSupportFields.relativeVorticityS_1;

const zonalMeanSlp = (ny, nx, field) => {
  const means = new Array(ny).fill(0);
  for (let j = 0; j < ny; j += 1) {
    let s = 0; let c = 0;
    for (let i = 0; i < nx; i += 1) {
      const v = field[j * nx + i];
      if (Number.isFinite(v)) { s += v; c += 1; }
    }
    means[j] = c > 0 ? s / c : 101000;
  }
  return means;
};
const zonalSlp = zonalMeanSlp(ny, nx, seaLevelPressurePa);

const tallyHemi = (hemi) => {
  const band = [];
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
    if (hemi === 'nh' && lat < 0) continue;
    if (hemi === 'sh' && lat >= 0) continue;
    band.push(j);
  }
  const totalCells = band.length * nx;
  const tally = { vort: 0, seaIce: 0, sst: 0, tcw: 0, wind: 0, slp: 0, joint: 0 };
  const dists = { vort: [], slp: [], tcw: [], sst: [], wind: [] };
  for (const j of band) {
    const lat = latitudesDeg[j];
    for (let i = 0; i < nx; i += 1) {
      const idx = j * nx + i;
      const v = vort[idx] || 0;
      const signedOk = lat >= 0 ? v >= 2e-5 : v <= -2e-5;
      const iceOk = (seaIceFraction[idx] || 0) <= 0.2;
      const sstOk = (sstK[idx] || 0) >= 298.5;
      const tcwOk = (totalColumnWaterKgM2[idx] || 0) >= 28;
      const windOk = (wind10mSpeedMs[idx] || 0) >= 8;
      const slpOk = (seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) - 350;
      if (signedOk) tally.vort += 1;
      if (iceOk) tally.seaIce += 1;
      if (sstOk) tally.sst += 1;
      if (tcwOk) tally.tcw += 1;
      if (windOk) tally.wind += 1;
      if (slpOk) tally.slp += 1;
      if (signedOk && iceOk && sstOk && tcwOk && windOk && slpOk) tally.joint += 1;
      dists.vort.push(v);
      dists.slp.push((seaLevelPressurePa[idx] || 0) - (zonalSlp[j] || 101000));
      dists.tcw.push(totalColumnWaterKgM2[idx] || 0);
      dists.sst.push(sstK[idx] || 0);
      dists.wind.push(wind10mSpeedMs[idx] || 0);
    }
  }
  const pct = (n) => ((n / totalCells) * 100).toFixed(1);
  const stat = (arr) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    const p = (q) => sorted[Math.floor(q * (sorted.length - 1))];
    return { min: p(0), p10: p(0.1), p50: p(0.5), p90: p(0.9), max: p(1) };
  };
  return { hemi, totalCells, tally, pct, stat, dists };
};

const format = (r) => {
  const { hemi, totalCells, tally, pct, stat, dists } = r;
  console.log(`\n=== ${hemi.toUpperCase()} (5-30° band, ${totalCells} cells) ===`);
  console.log(`  vort signed >= 2e-5 :   ${tally.vort} (${pct(tally.vort)}%)`);
  console.log(`  sea ice <= 0.2      :   ${tally.seaIce} (${pct(tally.seaIce)}%)`);
  console.log(`  SST >= 298.5 K      :   ${tally.sst} (${pct(tally.sst)}%)`);
  console.log(`  TCW >= 28 kg/m2     :   ${tally.tcw} (${pct(tally.tcw)}%)`);
  console.log(`  wind10m >= 8 m/s    :   ${tally.wind} (${pct(tally.wind)}%)`);
  console.log(`  SLP <= zonal - 350  :   ${tally.slp} (${pct(tally.slp)}%)`);
  console.log(`  JOINT (all)         :   ${tally.joint} (${pct(tally.joint)}%)`);
  console.log(`  vort distribution   :   min=${stat(dists.vort).min.toExponential(2)}  p50=${stat(dists.vort).p50.toExponential(2)}  p90=${stat(dists.vort).p90.toExponential(2)}  max=${stat(dists.vort).max.toExponential(2)}`);
  const sl = stat(dists.slp);
  console.log(`  SLP anomaly (Pa)    :   min=${sl.min.toFixed(0)}  p10=${sl.p10.toFixed(0)}  p50=${sl.p50.toFixed(0)}  p90=${sl.p90.toFixed(0)}  max=${sl.max.toFixed(0)}`);
  const t = stat(dists.tcw);
  console.log(`  TCW (kg/m2)         :   min=${t.min.toFixed(1)}  p50=${t.p50.toFixed(1)}  p90=${t.p90.toFixed(1)}  max=${t.max.toFixed(1)}`);
  const ss = stat(dists.sst);
  console.log(`  SST (K)             :   min=${ss.min.toFixed(1)}  p50=${ss.p50.toFixed(1)}  p90=${ss.p90.toFixed(1)}  max=${ss.max.toFixed(1)}`);
  const w = stat(dists.wind);
  console.log(`  wind10m (m/s)       :   min=${w.min.toFixed(1)}  p50=${w.p50.toFixed(1)}  p90=${w.p90.toFixed(1)}  max=${w.max.toFixed(1)}`);
};

format(tallyHemi('nh'));
format(tallyHemi('sh'));

// Sensitivity: joint pass counts under alternative vorticity thresholds
const sensitivityJoint = (vortThresh) => {
  const scan = (hemi) => {
    let joint = 0;
    for (let j = 0; j < ny; j += 1) {
      const lat = latitudesDeg[j];
      if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
      if (hemi === 'nh' && lat < 0) continue;
      if (hemi === 'sh' && lat >= 0) continue;
      for (let i = 0; i < nx; i += 1) {
        const idx = j * nx + i;
        const v = vort[idx] || 0;
        const signedOk = lat >= 0 ? v >= vortThresh : v <= -vortThresh;
        const iceOk = (seaIceFraction[idx] || 0) <= 0.2;
        const sstOk = (sstK[idx] || 0) >= 298.5;
        const tcwOk = (totalColumnWaterKgM2[idx] || 0) >= 28;
        const windOk = (wind10mSpeedMs[idx] || 0) >= 8;
        const slpOk = (seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) - 350;
        if (signedOk && iceOk && sstOk && tcwOk && windOk && slpOk) joint += 1;
      }
    }
    return joint;
  };
  return { nh: scan('nh'), sh: scan('sh') };
};

console.log('\n=== Vorticity threshold sensitivity (joint pass count) ===');
for (const t of [2.0e-5, 1.5e-5, 1.0e-5, 7.5e-6, 5.0e-6, 2.5e-6, 0]) {
  const s = sensitivityJoint(t);
  console.log(`  vort >= ${t.toExponential(2)}  =>  NH=${s.nh}  SH=${s.sh}`);
}

// Alternative: absolute vorticity (f + zeta) with Gray-style threshold
console.log('\n=== Absolute-vorticity variant (|f + zeta| >= threshold) ===');
const OMEGA_EARTH = 7.2921e-5;
const f = (lat) => 2 * OMEGA_EARTH * Math.sin(lat * Math.PI / 180);
const absVortJoint = (absThresh) => {
  const scan = (hemi) => {
    let joint = 0;
    for (let j = 0; j < ny; j += 1) {
      const lat = latitudesDeg[j];
      if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
      if (hemi === 'nh' && lat < 0) continue;
      if (hemi === 'sh' && lat >= 0) continue;
      const flat = f(lat);
      for (let i = 0; i < nx; i += 1) {
        const idx = j * nx + i;
        const v = vort[idx] || 0;
        const absVort = Math.abs(flat + v);
        const vorticitySignOk = lat >= 0 ? (flat + v) > 0 : (flat + v) < 0;
        if (!(absVort >= absThresh && vorticitySignOk)) continue;
        if ((seaIceFraction[idx] || 0) > 0.2) continue;
        if ((sstK[idx] || 0) < 298.5) continue;
        if ((totalColumnWaterKgM2[idx] || 0) < 28) continue;
        if ((wind10mSpeedMs[idx] || 0) < 8) continue;
        if ((seaLevelPressurePa[idx] || 0) > (zonalSlp[j] || 101000) - 350) continue;
        joint += 1;
      }
    }
    return joint;
  };
  return { nh: scan('nh'), sh: scan('sh') };
};
for (const t of [4e-5, 3e-5, 2e-5, 1.5e-5, 1e-5]) {
  const s = absVortJoint(t);
  console.log(`  |f+zeta| >= ${t.toExponential(2)}  =>  NH=${s.nh}  SH=${s.sh}`);
}

// Drop-one analysis: joint pass with each criterion removed
const dropOne = () => {
  const results = { nh: {}, sh: {} };
  const criteria = ['vort', 'ice', 'sst', 'tcw', 'wind', 'slp', 'none'];
  for (const drop of criteria) {
    for (const hemi of ['nh', 'sh']) {
      let joint = 0;
      for (let j = 0; j < ny; j += 1) {
        const lat = latitudesDeg[j];
        if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
        if (hemi === 'nh' && lat < 0) continue;
        if (hemi === 'sh' && lat >= 0) continue;
        for (let i = 0; i < nx; i += 1) {
          const idx = j * nx + i;
          const v = vort[idx] || 0;
          const signedOk = lat >= 0 ? v >= 2e-5 : v <= -2e-5;
          const iceOk = (seaIceFraction[idx] || 0) <= 0.2;
          const sstOk = (sstK[idx] || 0) >= 298.5;
          const tcwOk = (totalColumnWaterKgM2[idx] || 0) >= 28;
          const windOk = (wind10mSpeedMs[idx] || 0) >= 8;
          const slpOk = (seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) - 350;
          const checks = {
            vort: drop === 'vort' || signedOk,
            ice: drop === 'ice' || iceOk,
            sst: drop === 'sst' || sstOk,
            tcw: drop === 'tcw' || tcwOk,
            wind: drop === 'wind' || windOk,
            slp: drop === 'slp' || slpOk
          };
          if (Object.values(checks).every(Boolean)) joint += 1;
        }
      }
      results[hemi][drop] = joint;
    }
  }
  return results;
};

console.log('\n=== Drop-one joint analysis (what happens when we relax each criterion) ===');
const drops = dropOne();
for (const drop of ['none', 'vort', 'ice', 'sst', 'tcw', 'wind', 'slp']) {
  console.log(`  drop ${drop.padEnd(5)} => NH=${drops.nh[drop]}  SH=${drops.sh[drop]}`);
}

// Pair-drop analysis
console.log('\n=== Drop-two joint analysis ===');
const criteria = ['vort', 'sst', 'tcw', 'wind', 'slp'];
for (let a = 0; a < criteria.length; a += 1) {
  for (let b = a + 1; b < criteria.length; b += 1) {
    const ca = criteria[a]; const cb = criteria[b];
    let nhJoint = 0; let shJoint = 0;
    for (const hemi of ['nh', 'sh']) {
      for (let j = 0; j < ny; j += 1) {
        const lat = latitudesDeg[j];
        if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
        if (hemi === 'nh' && lat < 0) continue;
        if (hemi === 'sh' && lat >= 0) continue;
        for (let i = 0; i < nx; i += 1) {
          const idx = j * nx + i;
          const v = vort[idx] || 0;
          const checks = {
            vort: lat >= 0 ? v >= 2e-5 : v <= -2e-5,
            sst: (sstK[idx] || 0) >= 298.5,
            tcw: (totalColumnWaterKgM2[idx] || 0) >= 28,
            wind: (wind10mSpeedMs[idx] || 0) >= 8,
            slp: (seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) - 350
          };
          delete checks[ca]; delete checks[cb];
          if (Object.values(checks).every(Boolean)) {
            if (hemi === 'nh') nhJoint += 1; else shJoint += 1;
          }
        }
      }
    }
    console.log(`  drop ${ca}+${cb} => NH=${nhJoint}  SH=${shJoint}`);
  }
}

// Candidate coarse-grid threshold set
const candidateVariants = [
  { label: 'baseline 2e-5/298.5/28/8/-350', vort: 2e-5, sst: 298.5, tcw: 28, wind: 8, slp: -350 },
  { label: 'relax vort   1e-5/298.5/28/8/-350', vort: 1e-5, sst: 298.5, tcw: 28, wind: 8, slp: -350 },
  { label: 'relax vort+sst 1e-5/297.5/28/8/-350', vort: 1e-5, sst: 297.5, tcw: 28, wind: 8, slp: -350 },
  { label: 'relax vort+sst+tcw 1e-5/297.5/25/8/-350', vort: 1e-5, sst: 297.5, tcw: 25, wind: 8, slp: -350 },
  { label: '4-of-6 strict (any 4 pass)', fourOfSix: true, vort: 2e-5, sst: 298.5, tcw: 28, wind: 8, slp: -350 },
  { label: '5-of-6 strict (any 5 pass)', nOfSix: 5, vort: 2e-5, sst: 298.5, tcw: 28, wind: 8, slp: -350 }
];

console.log('\n=== Candidate detector variants ===');
for (const variant of candidateVariants) {
  const scan = (hemi) => {
    let joint = 0;
    for (let j = 0; j < ny; j += 1) {
      const lat = latitudesDeg[j];
      if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
      if (hemi === 'nh' && lat < 0) continue;
      if (hemi === 'sh' && lat >= 0) continue;
      for (let i = 0; i < nx; i += 1) {
        const idx = j * nx + i;
        const v = vort[idx] || 0;
        const checks = [
          lat >= 0 ? v >= variant.vort : v <= -variant.vort,
          (seaIceFraction[idx] || 0) <= 0.2,
          (sstK[idx] || 0) >= variant.sst,
          (totalColumnWaterKgM2[idx] || 0) >= variant.tcw,
          (wind10mSpeedMs[idx] || 0) >= variant.wind,
          (seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) + variant.slp
        ];
        const passes = checks.filter(Boolean).length;
        const need = variant.fourOfSix ? 4 : (variant.nOfSix ?? 6);
        if (passes >= need) joint += 1;
      }
    }
    return joint;
  };
  const nh = scan('nh'); const sh = scan('sh');
  console.log(`  ${variant.label.padEnd(44)}  NH=${String(nh).padStart(3)}  SH=${String(sh).padStart(3)}`);
}

// Simulate the PROPOSED detector logic: hard(vort + ice) + N-of-4 magnitudes
console.log('\n=== Proposed detector (hard vort/ice + N-of-4 magnitudes) ===');
for (const need of [4, 3, 2, 1]) {
  const scan = (hemi) => {
    let joint = 0;
    for (let j = 0; j < ny; j += 1) {
      const lat = latitudesDeg[j];
      if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
      if (hemi === 'nh' && lat < 0) continue;
      if (hemi === 'sh' && lat >= 0) continue;
      for (let i = 0; i < nx; i += 1) {
        const idx = j * nx + i;
        const v = vort[idx] || 0;
        const signedOk = lat >= 0 ? v >= 2e-5 : v <= -2e-5;
        const iceOk = (seaIceFraction[idx] || 0) <= 0.2;
        if (!signedOk || !iceOk) continue;
        let passes = 0;
        if ((sstK[idx] || 0) >= 298.5) passes += 1;
        if ((totalColumnWaterKgM2[idx] || 0) >= 28) passes += 1;
        if ((wind10mSpeedMs[idx] || 0) >= 8) passes += 1;
        if ((seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) - 350) passes += 1;
        if (passes >= need) joint += 1;
      }
    }
    return joint;
  };
  console.log(`  vort+ice + ${need}-of-4 magnitudes  =>  NH=${scan('nh')}  SH=${scan('sh')}`);
}

// Grid-aware vorticity threshold
console.log('\n=== Grid-aware vort + N-of-4 magnitudes ===');
for (const vt of [2e-5, 1.5e-5, 1e-5, 7.5e-6, 5e-6]) {
  for (const need of [3, 2]) {
    const scan = (hemi) => {
      let joint = 0;
      for (let j = 0; j < ny; j += 1) {
        const lat = latitudesDeg[j];
        if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
        if (hemi === 'nh' && lat < 0) continue;
        if (hemi === 'sh' && lat >= 0) continue;
        for (let i = 0; i < nx; i += 1) {
          const idx = j * nx + i;
          const v = vort[idx] || 0;
          const signedOk = lat >= 0 ? v >= vt : v <= -vt;
          const iceOk = (seaIceFraction[idx] || 0) <= 0.2;
          if (!signedOk || !iceOk) continue;
          let passes = 0;
          if ((sstK[idx] || 0) >= 298.5) passes += 1;
          if ((totalColumnWaterKgM2[idx] || 0) >= 28) passes += 1;
          if ((wind10mSpeedMs[idx] || 0) >= 8) passes += 1;
          if ((seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) - 350) passes += 1;
          if (passes >= need) joint += 1;
        }
      }
      return joint;
    };
    console.log(`  vort >= ${vt.toExponential(2)} + ${need}-of-4 mag  =>  NH=${scan('nh')}  SH=${scan('sh')}`);
  }
}

console.log('\nGrid:', nx, 'x', ny, '  spinup:', spinupDays, 'days');
