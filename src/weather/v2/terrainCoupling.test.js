import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { updateHydrostatic } from './hydrostatic.js';
import { stepVertical5 } from './vertical5.js';

const makeGrid = () => ({
  nx: 3,
  ny: 2,
  count: 6,
  invDx: new Float32Array([1 / 100000, 1 / 100000]),
  invDy: new Float32Array([1 / 100000, 1 / 100000]),
  cosLat: new Float32Array([1, 1]),
  latDeg: new Float32Array([10, -10])
});

test('updateHydrostatic incorporates terrain height into geopotential', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.theta.fill(290);
  state.qv.fill(0.004);

  updateHydrostatic(state, { pTop: 20000, terrainHeightM: new Float32Array([0, 1500]) });

  const lowLev = 3 * state.N;
  assert.ok(state.phiMid[lowLev + 1] > state.phiMid[lowLev + 0]);
});

test('stepVertical5 adds terrain-driven omega for upslope flow', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const runCase = (elev) => {
    const state = createState5({ grid, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.theta.fill(290);
    state.qv.fill(0.004);
    updateHydrostatic(state, { pTop: 20000, terrainHeightM: elev });
    const levS = state.nz - 1;
    for (let k = 0; k < state.N; k += 1) {
      state.u[levS * state.N + k] = 20;
      state.v[levS * state.N + k] = 0;
    }
    stepVertical5({
      dt: 60,
      grid,
      state,
      geo: { elev },
      params: {
        enableMixing: false,
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        orographicLiftScale: 1.0
      }
    });
    return state;
  };

  const flat = runCase(new Float32Array([0, 0, 0, 0, 0, 0]));
  const terrain = runCase(new Float32Array([0, 1000, 2000, 0, 1000, 2000]));
  let maxDiff = 0;
  for (let i = 0; i < terrain.omega.length; i += 1) {
    maxDiff = Math.max(maxDiff, Math.abs(terrain.omega[i] - flat.omega[i]));
  }
  assert.ok(maxDiff > 0);
});
