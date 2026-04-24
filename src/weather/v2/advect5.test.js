import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { stepAdvection5 } from './advect5.js';

const globalWaterMean = (state, grid) => {
  let total = 0;
  let weightTotal = 0;
  for (let k = 0; k < state.N; k += 1) {
    const row = Math.floor(k / grid.nx);
    const weight = Math.max(0.05, grid.cosLat[row] || 0);
    let column = 0;
    for (let lev = 0; lev < state.nz; lev += 1) {
      const idx = lev * state.N + k;
      const dp = state.pHalf[(lev + 1) * state.N + k] - state.pHalf[lev * state.N + k];
      column += (
        Math.max(0, state.qv[idx] || 0)
        + Math.max(0, state.qc[idx] || 0)
        + Math.max(0, state.qi[idx] || 0)
        + Math.max(0, state.qr[idx] || 0)
        + Math.max(0, state.qs[idx] || 0)
      ) * (dp / 9.80665);
    }
    total += column * weight;
    weightTotal += weight;
  }
  return total / weightTotal;
};

test('stepAdvection5 advects snow condensate with the rest of atmospheric water', () => {
  const grid = {
    nx: 2,
    ny: 2,
    count: 4,
    invDx: new Float32Array([1, 1]),
    invDy: new Float32Array([1, 1]),
    sinLat: new Float32Array([0, 0]),
    latDeg: new Float32Array([-10, 10]),
    polarWeight: new Float32Array([0, 0]),
    cellLonDeg: 180
  };
  const state = createState5({ grid, nz: 1, sigmaHalf: new Float32Array([0, 1]) });
  state.instrumentationEnabled = false;
  state.u.fill(1);
  state.v.fill(0);
  state.qs[0] = 0;
  state.qs[1] = 0.004;
  state.qs[2] = 0;
  state.qs[3] = 0.004;

  stepAdvection5({
    dt: 0.5,
    grid,
    state,
    scratch: {
      tmpU: new Float32Array(state.SZ),
      tmpV: new Float32Array(state.SZ),
      tmp3D: new Float32Array(state.SZ),
      rowA: new Float32Array(grid.nx),
      rowB: new Float32Array(grid.nx)
    }
  });

  assert.ok(state.qs[0] > 0);
  assert.ok(state.qs[1] < 0.004);
  assert.ok(state.qs[2] > 0);
  assert.ok(state.qs[3] < 0.004);
});

test('stepAdvection5 repairs semi-Lagrangian global water drift', () => {
  const grid = {
    nx: 2,
    ny: 2,
    count: 4,
    invDx: new Float32Array([0, 0]),
    invDy: new Float32Array([1, 1]),
    sinLat: new Float32Array([0, 0]),
    latDeg: new Float32Array([-30, 30]),
    cosLat: new Float32Array([1, 0.5]),
    polarWeight: new Float32Array([0, 0]),
    cellLonDeg: 180
  };
  const state = createState5({ grid, nz: 1, sigmaHalf: new Float32Array([0, 1]) });
  state.instrumentationEnabled = false;
  for (let k = 0; k < state.N; k += 1) {
    state.pHalf[k] = 0;
    state.pHalf[state.N + k] = 100000;
  }
  state.u.fill(0);
  state.v.fill(1);
  state.qv[0] = 0.016;
  state.qv[1] = 0.014;
  state.qv[2] = 0.002;
  state.qv[3] = 0.003;

  const before = globalWaterMean(state, grid);
  stepAdvection5({
    dt: 0.5,
    grid,
    state,
    scratch: {
      tmpU: new Float32Array(state.SZ),
      tmpV: new Float32Array(state.SZ),
      tmp3D: new Float32Array(state.SZ),
      rowA: new Float32Array(grid.nx),
      rowB: new Float32Array(grid.nx)
    }
  });
  const after = globalWaterMean(state, grid);

  assert.ok(Math.abs(after - before) < 1e-5);
  assert.ok(state.numericalAdvectionWaterRepairMassMeanKgM2 > 0);
});
