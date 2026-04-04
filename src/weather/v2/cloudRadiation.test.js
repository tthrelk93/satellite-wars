import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { computeModelMidPressurePa } from './analysisData.js';
import { updateDiagnostics2D5 } from './diagnostics2d.js';
import { stepRadiation2D5 } from './radiation2d.js';

const makeGrid = () => ({
  nx: 2,
  ny: 1,
  latDeg: new Float32Array([0]),
  lonDeg: new Float32Array([0, 180]),
  invDx: new Float32Array([1 / 100000]),
  invDy: new Float32Array([1 / 100000]),
  cosLat: new Float32Array([1])
});

const makeOutFields = (N) => ({
  cwpLow: new Float32Array(N),
  cwpHigh: new Float32Array(N),
  tauLow: new Float32Array(N),
  tauHigh: new Float32Array(N),
  tauTotal: new Float32Array(N),
  tauLowDelta: new Float32Array(N),
  tauHighDelta: new Float32Array(N),
  cloudLow: new Float32Array(N),
  cloudHigh: new Float32Array(N),
  cloud: new Float32Array(N),
  RH: new Float32Array(N),
  RHU: new Float32Array(N),
  omegaL: new Float32Array(N),
  omegaU: new Float32Array(N),
  div: new Float32Array(N),
  vort: new Float32Array(N)
});

test('updateDiagnostics2D5 derives cloud fraction from condensate-bearing state', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  for (let lev = 0; lev <= state.nz; lev += 1) {
    for (let cell = 0; cell < state.N; cell += 1) {
      state.pHalf[lev * state.N + cell] = 20000 + (state.ps[cell] - 20000) * sigmaHalf[lev];
    }
  }
  state.theta.fill(290);
  state.T.fill(280);
  state.qv.fill(0.008);
  state.qc[3 * state.N + 0] = 5e-4;
  state.qi[1 * state.N + 0] = 2e-4;

  const outFields = makeOutFields(state.N);
  updateDiagnostics2D5({ dt: 120, grid, state, outFields, params: {} });

  assert.ok(outFields.cloud[0] > 0);
  assert.ok(outFields.tauTotal[0] > 0);
  assert.ok(state.cloudFrac3D.some((v) => v > 0));
});

test('stepRadiation2D5 responds to full-column cloud optical depth', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const makeState = () => {
    const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
    for (let lev = 0; lev <= state.nz; lev += 1) {
      for (let cell = 0; cell < state.N; cell += 1) {
        state.pHalf[lev * state.N + cell] = 20000 + (state.ps[cell] - 20000) * sigmaHalf[lev];
      }
    }
    state.theta.fill(290);
    state.T.fill(280);
    state.Ts.fill(280);
    state.qv.fill(0.004);
    state.landMask.fill(0);
    return state;
  };

  const clear = makeState();
  const cloudy = makeState();
  cloudy.cloudFrac3D.fill(1);
  cloudy.cloudTau3D.fill(1.5);

  stepRadiation2D5({ dt: 120, grid, state: clear, timeUTC: 12 * 3600, params: {} });
  stepRadiation2D5({ dt: 120, grid, state: cloudy, timeUTC: 12 * 3600, params: {} });

  assert.ok(cloudy.surfaceRadiativeFlux[0] < clear.surfaceRadiativeFlux[0]);
});
