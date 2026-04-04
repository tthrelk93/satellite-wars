import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { computeModelMidPressurePa } from './analysisData.js';
import { stepNudging5 } from './nudging5.js';

const makeGrid = () => ({
  nx: 2,
  ny: 2,
  latDeg: new Float32Array([30, -30])
});

test('stepNudging5 can nudge theta, qv, u, and v through the full column from analysis targets', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 4 }, nz: 6, sigmaHalf });
  const grid = makeGrid();
  state.ps.fill(100000);
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  state.theta.fill(280);
  state.qv.fill(0.001);
  state.u.fill(0);
  state.v.fill(0);
  state.landMask.set([0, 1, 0, 1]);
  state.soilCap.fill(100);
  state.soilW.fill(100);
  state.analysisTargets = {
    thetaKByPressurePa: new Map([
      [100000, new Float32Array([300, 301, 302, 303])],
      [50000, new Float32Array([320, 321, 322, 323])],
      [25000, new Float32Array([340, 341, 342, 343])]
    ]),
    specificHumidityKgKgByPressurePa: new Map([
      [100000, new Float32Array([0.010, 0.011, 0.012, 0.013])],
      [50000, new Float32Array([0.005, 0.006, 0.007, 0.008])],
      [25000, new Float32Array([0.001, 0.002, 0.003, 0.004])]
    ]),
    uByPressurePa: new Map([
      [100000, new Float32Array([5, 6, 7, 8])],
      [50000, new Float32Array([15, 16, 17, 18])],
      [25000, new Float32Array([25, 26, 27, 28])]
    ]),
    vByPressurePa: new Map([
      [100000, new Float32Array([1, 2, 3, 4])],
      [50000, new Float32Array([5, 6, 7, 8])],
      [25000, new Float32Array([9, 10, 11, 12])]
    ])
  };
  const climo = {
    sstNow: new Float32Array(4),
    hasSlp: false,
    hasT2m: false,
    hasWind: false,
    hasWind500: false,
    hasWind250: false,
    hasQ2m: false,
    hasQ700: false,
    hasQ250: false,
    hasT700: false,
    hasT250: false
  };
  const scratch = { tmp2D: new Float32Array(4), tmp2D2: new Float32Array(4) };

  stepNudging5({
    dt: 86400,
    grid,
    state,
    climo,
    scratch,
    params: {
      enable: true,
      enableThetaColumn: true,
      enableQvColumn: true,
      enableWindColumn: true,
      thetaSource: 'analysis',
      qvSource: 'analysis',
      windSource: 'analysis',
      tauThetaColumn: 86400,
      tauQvColumn: 86400,
      tauWindColumn: 86400,
      enableThetaS: false,
      enableQvS: false,
      enablePs: false
    }
  });

  assert.ok(state.theta[0] > 280);
  assert.ok(state.qv[0] > 0.001);
  assert.ok(state.u[0] > 0);
  assert.ok(state.v[0] > 0);
  assert.ok(state.theta[state.theta.length - 1] > 280);
});
