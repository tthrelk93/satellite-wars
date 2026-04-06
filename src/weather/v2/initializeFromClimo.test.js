import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { initializeV2FromClimo } from './initializeFromClimo.js';

test('initializeV2FromClimo seeds spatial wind climatology through the full column when available', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const grid = {
    count: 2,
    nx: 2,
    ny: 1,
    latDeg: new Float32Array([35])
  };
  const state = createState5({ grid, nz: 6, sigmaHalf });
  const N = state.N;
  const pressuresByLevel = [20000, 30000, 45000, 60000, 80000, 95000];
  for (let lev = 0; lev < state.nz; lev += 1) {
    for (let cell = 0; cell < N; cell += 1) {
      state.pMid[lev * N + cell] = pressuresByLevel[lev];
    }
  }
  state.ps.fill(100000);
  state.landMask.fill(0);
  state.soilCap.fill(1);
  state.sstNow.fill(300);

  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: true,
    windNowU: new Float32Array([5, 10]),
    windNowV: new Float32Array([1, 2]),
    wind500NowU: new Float32Array([15, 20]),
    wind500NowV: new Float32Array([3, 4]),
    wind250NowU: new Float32Array([35, 40]),
    wind250NowV: new Float32Array([7, 8])
  };

  initializeV2FromClimo({ grid, state, geo: {}, climo });

  const idx = (lev, cell) => lev * N + cell;
  const levSurface = state.nz - 1;

  assert.equal(state.u[idx(levSurface, 0)], 5);
  assert.equal(state.v[idx(levSurface, 0)], 1);

  assert.ok(Math.abs(state.u[idx(3, 0)] - 13) < 1e-6);
  assert.ok(Math.abs(state.v[idx(3, 0)] - 2.6) < 1e-6);

  assert.ok(Math.abs(state.u[idx(2, 0)] - 19) < 1e-6);
  assert.ok(Math.abs(state.v[idx(2, 0)] - 3.8) < 1e-6);

  assert.ok(Math.abs(state.u[idx(1, 0)] - 31) < 1e-6);
  assert.ok(Math.abs(state.v[idx(1, 0)] - 6.2) < 1e-6);

  assert.equal(state.u[idx(0, 0)], 35);
  assert.equal(state.v[idx(0, 0)], 7);
});

test('initializeV2FromClimo interpolates lower-column winds against surface pressure, not the lowest midpoint', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 3 });
  const grid = {
    count: 1,
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([35])
  };
  const state = createState5({ grid, nz: 3, sigmaHalf });
  state.pMid.set(new Float32Array([
    30000,
    60000,
    95000
  ]));
  state.ps[0] = 100000;
  state.landMask[0] = 0;
  state.soilCap[0] = 1;
  state.sstNow[0] = 300;

  const climo = {
    hasWind: true,
    hasWind500: true,
    windNowU: new Float32Array([5]),
    windNowV: new Float32Array([1]),
    wind500NowU: new Float32Array([15]),
    wind500NowV: new Float32Array([3])
  };

  initializeV2FromClimo({ grid, state, geo: {}, climo });

  const idx = (lev) => lev * state.N;
  assert.ok(Math.abs(state.u[idx(1)] - 13) < 1e-6);
  assert.ok(Math.abs(state.v[idx(1)] - 2.6) < 1e-6);
});

test('initializeV2FromClimo derives layer pressures when hydrostatic pMid is not populated yet', () => {
  const sigmaHalf = new Float32Array([0, 0.25, 0.5, 1]);
  const grid = {
    count: 1,
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([35])
  };
  const state = createState5({ grid, nz: 3, sigmaHalf });
  state.pMid.fill(0);
  state.ps[0] = 100000;
  state.landMask[0] = 0;
  state.soilCap[0] = 1;
  state.sstNow[0] = 300;

  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: true,
    windNowU: new Float32Array([5]),
    windNowV: new Float32Array([1]),
    wind500NowU: new Float32Array([15]),
    wind500NowV: new Float32Array([3]),
    wind250NowU: new Float32Array([35]),
    wind250NowV: new Float32Array([7])
  };

  initializeV2FromClimo({ grid, state, geo: {}, climo });

  const pMidDerived = Math.sqrt((20000 + (100000 - 20000) * 0.25) * (20000 + (100000 - 20000) * 0.5));
  const w250 = (50000 - pMidDerived) / (50000 - 25000);
  const expectedU = 15 + (35 - 15) * w250;
  const expectedV = 3 + (7 - 3) * w250;

  assert.ok(Math.abs(state.u[1] - expectedU) < 1e-6);
  assert.ok(Math.abs(state.v[1] - expectedV) < 1e-6);
  assert.ok(state.u[1] < 35);
});
