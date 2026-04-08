import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  summarizeCore,
  prepareAtomicJsonOutput,
  commitAtomicJsonOutput,
  failAtomicJsonOutput
} from '../../scripts/agent/orographic-audit.mjs';

const makeMockCore = ({ useRhField }) => {
  const nx = 6;
  const ny = 3;
  const nz = 2;
  const N = nx * ny;
  const surfaceBase = (nz - 1) * N;
  const interfaceBase = nz * N;

  const elev = new Float32Array([
    0, 1500, 3200, 3200, 1500, 0,
    0, 1800, 3400, 3400, 1800, 0,
    0, 1600, 3000, 3000, 1600, 0
  ]);

  const qv = new Float32Array(nz * N).fill(0.0045);
  const qc = new Float32Array(nz * N).fill(0.0008);
  const qr = new Float32Array(nz * N).fill(0.0016);
  const pMid = new Float32Array(nz * N).fill(90000);
  const theta = new Float32Array(nz * N).fill(293);
  const T = new Float32Array(nz * N).fill(285);
  const soilCap = new Float32Array(N).fill(1);
  const soilW = new Float32Array(N).fill(0.7);
  const cloudLow = new Float32Array(N).fill(0.85);
  const precipRate = new Float32Array(N);
  const omega = new Float32Array((nz + 1) * N);
  const u = new Float32Array(nz * N);
  const v = new Float32Array(nz * N);
  const RH = new Float32Array(N);

  const surfaceRhByColumn = [0.65, 0.7, 0.82, 1.18, 1.1, 0.95];
  const surfacePrecipByColumn = [0.4, 0.6, 1.2, 2.1, 1.8, 0.9];
  const surfaceOmegaByColumn = [-0.5, -0.8, -1.1, -3.2, -2.8, -1.5];

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const k = j * nx + i;
      const idxS = surfaceBase + k;
      u[idxS] = 8;
      v[idxS] = 0;
      RH[k] = surfaceRhByColumn[i];
      precipRate[k] = surfacePrecipByColumn[i];
      omega[surfaceBase + k] = surfaceOmegaByColumn[i];
      omega[interfaceBase + k] = surfaceOmegaByColumn[i] - 0.2;
      soilW[k] = i >= 3 ? 0.55 : 0.85;
      qv[idxS] = 0.0035 + i * 0.00035;
      qc[idxS] = 0.0004 + i * 0.0001;
      qr[idxS] = 0.0008 + i * 0.0002;
    }
  }

  return {
    timeUTC: 75600,
    grid: {
      nx,
      ny,
      invDx: new Float32Array(ny).fill(1 / 100000),
      invDy: new Float32Array(ny).fill(1 / 100000),
      latDeg: new Float32Array([-45, -30, -20]),
      lonDeg: new Float32Array([-79, -76, -73, -70, -67, -64])
    },
    state: {
      N,
      nz,
      u,
      v,
      qv,
      qc,
      qr,
      pMid,
      theta,
      T,
      soilW,
      soilCap,
      omega
    },
    fields: {
      precipRate,
      cloudLow,
      ...(useRhField ? { RH } : {})
    },
    geo: { elev }
  };
};

test('summarizeCore uses existing near-surface RH diagnostics when present', () => {
  const summary = summarizeCore(makeMockCore({ useRhField: true }), 75600);
  const andes = summary.regions.find((region) => region.name === 'Andes');

  assert.ok(summary.global.terrainSampleCount > 0);
  assert.ok(summary.global.rhLowUpslopeVsDownslope > 0);
  assert.ok(Number.isFinite(summary.global.terrainFlowContrast));
  assert.ok(Number.isFinite(summary.global.moistureFluxNormalContrast));
  assert.ok(andes);
  assert.ok(andes.upslope.rhLowMean > 0);
  assert.ok(andes.downslope.rhLowMean > 0);
  assert.ok(andes.rhLowRatio > 0);
});

test('summarizeCore falls back to thermodynamic RH when RH diagnostics are absent', () => {
  const summary = summarizeCore(makeMockCore({ useRhField: false }), 75600);
  const andes = summary.regions.find((region) => region.name === 'Andes');

  assert.ok(summary.global.rhLowUpslopeVsDownslope > 0);
  assert.ok(andes);
  assert.ok(andes.upslope.rhLowMean > 0);
  assert.ok(andes.downslope.rhLowMean > 0);
  assert.ok(andes.rhLowRatio > 0);
});

test('summarizeCore reports terrain-flow and moisture-flux contrasts for orographic diagnosis', () => {
  const summary = summarizeCore(makeMockCore({ useRhField: true }), 75600);
  const andes = summary.regions.find((region) => region.name === 'Andes');

  assert.ok(summary.global.terrainFlowContrast > 0);
  assert.ok(summary.global.moistureFluxNormalContrast > 0);
  assert.ok(summary.global.terrainFlowQuantiles.q90 > summary.global.terrainFlowQuantiles.q10);
  assert.ok(andes);
  assert.ok(andes.terrainFlowQuantiles.q75 > andes.terrainFlowQuantiles.q25);
  assert.ok(andes.upslope.terrainFlowMean > 0);
  assert.ok(andes.downslope.terrainFlowMean < 0);
  assert.ok(andes.upslope.moistureFluxNormalMean > 0);
  assert.ok(andes.downslope.moistureFluxNormalMean < 0);
  assert.ok(Number.isFinite(andes.upslope.latMean));
  assert.ok(Number.isFinite(andes.upslope.lonMean));
  assert.ok(Number.isFinite(andes.downslope.latMean));
  assert.ok(Number.isFinite(andes.downslope.lonMean));
  assert.ok(Number.isFinite(andes.upslope.slopeMagMean));
  assert.ok(Number.isFinite(andes.downslope.slopeMagMean));
  assert.ok(andes.upslope.lonMax >= andes.upslope.lonMin);
  assert.ok(andes.downslope.lonMax >= andes.downslope.lonMin);
  assert.ok(andes.terrainFlowContrast > 0);
  assert.ok(andes.moistureFluxNormalContrast > 0);
});

test('summarizeCore separates terrain-forced omega from residual omega structure', () => {
  const summary = summarizeCore(makeMockCore({ useRhField: true }), 75600);
  const andes = summary.regions.find((region) => region.name === 'Andes');

  assert.ok(Number.isFinite(summary.global.terrainOmegaLowContrast));
  assert.ok(Number.isFinite(summary.global.omegaLowResidualContrast));
  assert.ok(andes);
  assert.ok(andes.upslope.terrainOmegaLowMean < 0);
  assert.ok(andes.downslope.terrainOmegaLowMean > 0);
  assert.ok(andes.terrainOmegaLowContrast < 0);
  assert.ok(andes.terrainOmegaSurfaceContrast < 0);
  assert.ok(andes.omegaLowResidualContrast > 0);
  assert.ok(andes.omegaLowContrast > 0);
  assert.ok(Number.isFinite(andes.upslope.slopeFactorMean));
  assert.ok(Number.isFinite(andes.downslope.slopeFactorMean));
});

test('prepareAtomicJsonOutput removes stale final output until the fresh audit commits', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satwars-orographic-audit-'));
  const outPath = path.join(tempDir, 'candidate-terrain-directional-blend-050-audit.json');
  fs.writeFileSync(outPath, JSON.stringify({ stale: true, overrides: { vertParams: { terrainDirectionalBlend: 0.5 } } }));

  const outputState = prepareAtomicJsonOutput(outPath, {
    seed: 12345,
    targets: [75600, 105480],
    overrides: { vertParams: { terrainDirectionalBlend: 0.05 } }
  });

  assert.ok(outputState);
  assert.equal(fs.existsSync(outPath), false);
  assert.equal(fs.existsSync(outputState.runningPath), true);
  const runningState = JSON.parse(fs.readFileSync(outputState.runningPath, 'utf8'));
  assert.equal(runningState.status, 'running');
  assert.equal(runningState.overrides.vertParams.terrainDirectionalBlend, 0.05);

  commitAtomicJsonOutput(outputState, {
    schema: 'satellite-wars.orographic-audit.v1',
    overrides: { vertParams: { terrainDirectionalBlend: 0.05 } }
  });

  assert.equal(fs.existsSync(outPath), true);
  assert.equal(fs.existsSync(outputState.runningPath), false);
  const written = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(written.overrides.vertParams.terrainDirectionalBlend, 0.05);
});

test('failAtomicJsonOutput leaves failure state instead of stale final output', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satwars-orographic-audit-fail-'));
  const outPath = path.join(tempDir, 'candidate-terrain-directional-blend-050-audit.json');
  fs.writeFileSync(outPath, JSON.stringify({ stale: true }));

  const outputState = prepareAtomicJsonOutput(outPath, { seed: 7 });
  failAtomicJsonOutput(outputState, new Error('boom'));

  assert.equal(fs.existsSync(outPath), false);
  assert.equal(fs.existsSync(outputState.tempPath), false);
  assert.equal(fs.existsSync(outputState.runningPath), true);
  const runningState = JSON.parse(fs.readFileSync(outputState.runningPath, 'utf8'));
  assert.equal(runningState.status, 'failed');
  assert.equal(runningState.error, 'boom');
});
