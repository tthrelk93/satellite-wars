import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { computeModelMidPressurePa } from './analysisData.js';
import { stepMicrophysics5 } from './microphysics5.js';

const setupState = (tempK) => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 1 }, nz: 4, sigmaHalf });
  state.ps[0] = 100000;
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  for (let lev = 0; lev <= state.nz; lev += 1) {
    state.pHalf[lev] = 20000 + (state.ps[0] - 20000) * sigmaHalf[lev];
  }
  state.theta.fill(tempK / Math.pow(state.pMid[0] / 100000, 287.05 / 1004));
  state.T.fill(tempK);
  state.qv.fill(0.002);
  return state;
};

test('mixed-phase microphysics can form and precipitate snow in a cold column', () => {
  const state = setupState(263);
  state.qi.fill(0.0012);
  state.qc.fill(0.0005);

  stepMicrophysics5({ dt: 3600, state, params: { enableConvectiveOutcome: false } });

  assert.ok(state.qs.some((v) => v > 0) || state.precipSnowRate[0] > 0);
  assert.ok(state.precipSnowRate[0] >= 0);
  assert.ok(state.precipRate[0] >= state.precipSnowRate[0]);
  for (const arr of [state.qv, state.qc, state.qi, state.qr, state.qs]) {
    for (const value of arr) assert.ok(value >= 0);
  }
});

test('mixed-phase microphysics can melt snow into rain in a warm column', () => {
  const state = setupState(276);
  state.qs.fill(0.0015);

  stepMicrophysics5({ dt: 3600, state, params: { enableConvectiveOutcome: false } });

  assert.ok(state.qr.some((v) => v > 0) || state.precipRainRate[0] > 0);
  assert.ok(state.precipRainRate[0] >= 0);
  for (const arr of [state.qv, state.qc, state.qi, state.qr, state.qs]) {
    for (const value of arr) assert.ok(value >= 0);
  }
});

test('terrain-coupled lee columns evaporate and convert warm rain less when delivery exposure is absent', () => {
  const makeWarmState = () => {
    const state = setupState(279);
    state.qv.fill(0.004);
    state.qc.fill(0);
    state.qr.fill(0);
    const lowBase = (state.nz - 1) * state.N;
    state.qc[lowBase] = 0.0022;
    state.qr[lowBase] = 0.0020;
    state.terrainOmegaSurface = new Float32Array([2.4]);
    state.orographicDeliveryExposureAccum = new Float32Array([0]);
    return state;
  };

  const leeNoDelivery = makeWarmState();
  stepMicrophysics5({ dt: 900, state: leeNoDelivery, params: { enableConvectiveOutcome: false } });

  const leeWithDelivery = makeWarmState();
  leeWithDelivery.orographicDeliveryExposureAccum[0] = 12;
  stepMicrophysics5({ dt: 900, state: leeWithDelivery, params: { enableConvectiveOutcome: false } });

  const lowIdx = (leeNoDelivery.nz - 1) * leeNoDelivery.N;
  const noDeliveryHydrometeors = leeNoDelivery.qc[lowIdx] + leeNoDelivery.qr[lowIdx];
  const protectedHydrometeors = leeWithDelivery.qc[lowIdx] + leeWithDelivery.qr[lowIdx];

  assert.ok(noDeliveryHydrometeors < protectedHydrometeors);
  assert.ok(leeNoDelivery.precipRainRate[0] <= leeWithDelivery.precipRainRate[0]);
  assert.ok(leeNoDelivery.qv[lowIdx] >= leeWithDelivery.qv[lowIdx]);
});
