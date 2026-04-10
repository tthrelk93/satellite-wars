import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { stepVertical5 } from './vertical5.js';

test('stepVertical5 keeps thin upper layers bounded during strong ascent-driven transport', () => {
  const sigmaHalf = new Float32Array([0, 0.5, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 2,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 30000;
  state.pHalf[2] = 100000;
  state.pMid[0] = 25000;
  state.pMid[1] = 65000;
  state.theta[0] = 260;
  state.theta[1] = 320;
  state.qv[0] = 0.002;
  state.qv[1] = 0.02;
  state.T[0] = 220;
  state.T[1] = 290;
  state.dpsDtApplied[0] = -1000;

  stepVertical5({
    dt: 60,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvection: false,
      enableOmegaMassFix: true,
      enableLargeScaleVerticalAdvection: true,
      verticalAdvectionCflMax: 0.4,
      verticalAdvectionSigmaTaperExp: 2,
      dThetaMaxVertAdvPerStep: 0
    }
  });

  assert.ok(state.theta[0] > 260);
  assert.ok(state.theta[0] <= 320);
  assert.ok(state.qv[0] > 0.002);
  assert.ok(state.qv[0] <= 0.02);
  assert.ok(state.theta[1] >= 260);
  assert.ok(state.theta[1] <= 320);
});

test('stepVertical5 builds a persistent continuous convective state from moist ascent', () => {
  const sigmaHalf = new Float32Array([0, 0.35, 0.7, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 3,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([5]),
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 35000;
  state.pHalf[2] = 65000;
  state.pHalf[3] = 100000;
  state.pMid[0] = 27500;
  state.pMid[1] = 50000;
  state.pMid[2] = 82500;
  state.theta[0] = 303;
  state.theta[1] = 295;
  state.theta[2] = 304;
  state.qv[0] = 0.001;
  state.qv[1] = 0.008;
  state.qv[2] = 0.02;
  state.T[0] = 250;
  state.T[1] = 275;
  state.T[2] = 299;
  state.u.fill(0);
  state.v.fill(0);
  state.dpsDtApplied[0] = -1800;

  stepVertical5({
    dt: 1800,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvectiveMixing: false,
      enableConvection: true,
      enableOmegaMassFix: true,
      enableLargeScaleVerticalAdvection: true
    }
  });

  assert.ok(state.convectivePotential[0] > 0.1);
  assert.ok(state.convectiveOrganization[0] > 0.01);
  assert.ok(state.convectiveMassFlux[0] > 0);
  assert.ok(state.convectiveRainoutFraction[0] > 0);
  assert.ok(state.convMask[0] === 0 || state.convMask[0] === 1);
});
