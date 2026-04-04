import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { computeModelMidPressurePa } from './analysisData.js';
import { stepSurface2D5 } from './surface2d.js';

const makeGrid = () => ({
  nx: 2,
  ny: 1,
  latDeg: new Float32Array([0]),
  invDx: new Float32Array([1 / 100000]),
  invDy: new Float32Array([1 / 100000])
});

test('stepSurface2D5 evolves slab-ocean SST with net surface flux and weak restoring', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  state.T.fill(280);
  state.theta.fill(290);
  state.qv.fill(0.004);
  state.Ts.fill(279);
  state.sstNow.fill(279);
  state.surfaceRadiativeFlux.fill(300);
  state.landMask.fill(0);
  const levS = state.nz - 1;
  for (let k = 0; k < state.N; k += 1) {
    state.u[levS * state.N + k] = 5;
    state.v[levS * state.N + k] = 0;
  }

  stepSurface2D5({
    dt: 86400,
    grid,
    state,
    climo: { sstNow: new Float32Array([280, 280]) },
    geo: { elev: new Float32Array([0, 0]) },
    params: { enableLandClimoTs: false }
  });

  assert.ok(state.sstNow[0] > 279);
});

test('stepSurface2D5 can grow sea ice when the ocean is below freezing', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  state.T.fill(268);
  state.theta.fill(285);
  state.qv.fill(0.002);
  state.Ts.fill(269);
  state.sstNow.fill(270.5);
  state.surfaceRadiativeFlux.fill(-150);
  state.landMask.fill(0);
  const levS = state.nz - 1;
  for (let k = 0; k < state.N; k += 1) {
    state.u[levS * state.N + k] = 3;
    state.v[levS * state.N + k] = 0;
  }

  stepSurface2D5({
    dt: 86400,
    grid,
    state,
    climo: { sstNow: new Float32Array([271, 271]) },
    geo: { elev: new Float32Array([0, 0]) },
    params: { enableLandClimoTs: false }
  });

  assert.ok(state.seaIceFrac[0] > 0);
  assert.ok(state.seaIceThicknessM[0] > 0);
  assert.ok(state.sstNow[0] >= 271.35);
});
