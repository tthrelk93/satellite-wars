import test from 'node:test';
import assert from 'node:assert/strict';
import { stepWindEddyNudge5 } from './windEddyNudge5.js';

const buildState = () => {
  const nx = 8;
  const ny = 4;
  const N = nx * ny;
  const u = new Float32Array(N);
  const v = new Float32Array(N);
  for (let j = 0; j < ny; j += 1) {
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const sign = i % 2 === 0 ? 1 : -1;
      u[row + i] = 3 + sign * 0.05;
      v[row + i] = sign * 0.03;
    }
  }
  return { N, nz: 1, u, v };
};

const rowVariance = (state, nx, rowIndex) => {
  const row = rowIndex * nx;
  let meanU = 0;
  let meanV = 0;
  for (let i = 0; i < nx; i += 1) {
    meanU += state.u[row + i];
    meanV += state.v[row + i];
  }
  meanU /= nx;
  meanV /= nx;
  let sum = 0;
  for (let i = 0; i < nx; i += 1) {
    const du = state.u[row + i] - meanU;
    const dv = state.v[row + i] - meanV;
    sum += du * du + dv * dv;
  }
  return sum / nx;
};

test('stepWindEddyNudge5 stays disabled when spatial wind targets own the field', () => {
  const grid = { nx: 8, ny: 4, latDeg: new Float32Array([60, 20, -20, -60]) };
  const state = buildState();

  const result = stepWindEddyNudge5({
    dt: 60,
    grid,
    state,
    climo: { hasWind: true, hasWind500: true, hasWind250: false },
    params: { tauSeconds: 60, scaleClampMax: 4.0 }
  });

  assert.equal(result.didApply, false);
  assert.equal(result.source, 'spatial-climatology-disabled-fallback');
});

test('stepWindEddyNudge5 can explicitly boost surface variance with spatial targets present', () => {
  const grid = { nx: 8, ny: 4, latDeg: new Float32Array([60, 20, -20, -60]) };
  const state = buildState();
  const before = rowVariance(state, grid.nx, 1);

  const result = stepWindEddyNudge5({
    dt: 60,
    grid,
    state,
    climo: { hasWind: true, hasWind500: true, hasWind250: false },
    params: {
      tauSeconds: 60,
      scaleClampMax: 4.0,
      allowWithSpatialTargets: true
    }
  });
  const after = rowVariance(state, grid.nx, 1);

  assert.equal(result.didApply, true);
  assert.ok(result.maxScale > 1, `expected a variance boost, got maxScale=${result.maxScale}`);
  assert.ok(after > before, `expected row variance to grow, got before=${before} after=${after}`);
});
