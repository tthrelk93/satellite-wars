import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels, findClosestLevelIndex } from './verticalGrid.js';
import { stepWindNudge5 } from './windNudge5.js';

test('stepWindNudge5 uses spatial climatology targets when available', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 4 }, nz: 6, sigmaHalf });
  const grid = {
    nx: 2,
    ny: 2,
    latDeg: new Float32Array([30, -30]),
    cosLat: new Float32Array([Math.cos(Math.PI / 6), Math.cos(Math.PI / 6)])
  };
  state.u.fill(0);
  state.v.fill(0);
  const levS = state.nz - 1;
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: false,
    windNowU: new Float32Array([5, 6, 7, 8]),
    windNowV: new Float32Array([1, 1, 1, 1]),
    wind500NowU: new Float32Array([15, 16, 17, 18]),
    wind500NowV: new Float32Array([2, 2, 2, 2])
  };

  const result = stepWindNudge5({
    dt: 86400,
    grid,
    state,
    climo,
    params: {
      tauSurfaceSeconds: 86400,
      tauUpperSeconds: 86400,
      tauVSeconds: 86400
    }
  });

  assert.equal(result.source, 'spatial-climatology');
  assert.equal(state.u[levS * state.N + 0], 5);
  assert.equal(state.v[levS * state.N + 0], 1);
  assert.equal(state.u[levU * state.N + 0], 15);
  assert.equal(state.v[levU * state.N + 0], 2);
});
