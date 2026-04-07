import { createState5 } from './state5';
import { stepVertical5 } from './vertical5';

describe('vertical5 large-scale vertical advection', () => {
  test('keeps thin upper layers bounded during strong ascent-driven transport', () => {
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

    expect(state.theta[0]).toBeGreaterThan(260);
    expect(state.theta[0]).toBeLessThanOrEqual(320);
    expect(state.qv[0]).toBeGreaterThan(0.002);
    expect(state.qv[0]).toBeLessThanOrEqual(0.02);
    expect(state.theta[1]).toBeGreaterThanOrEqual(260);
    expect(state.theta[1]).toBeLessThanOrEqual(320);
  });
});

describe('vertical5 boundary-layer momentum mixing', () => {
  test('mixes upper momentum toward the surface while conserving column momentum', () => {
    const sigmaHalf = new Float32Array([0, 0.25, 0.55, 1]);
    const state = createState5({
      grid: { count: 1 },
      nz: 3,
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
    state.pHalf[1] = 35000;
    state.pHalf[2] = 65000;
    state.pHalf[3] = 100000;
    state.pMid[0] = 27500;
    state.pMid[1] = 50000;
    state.pMid[2] = 82500;
    state.theta[0] = 295;
    state.theta[1] = 300;
    state.theta[2] = 304;
    state.u[1] = 10;
    state.u[2] = 0;
    state.v[1] = -4;
    state.v[2] = 0;
    state.T[0] = 245;
    state.T[1] = 265;
    state.T[2] = 290;

    const dpMid = state.pHalf[2] - state.pHalf[1];
    const dpSurface = state.pHalf[3] - state.pHalf[2];
    const uMomentumBefore = state.u[1] * dpMid + state.u[2] * dpSurface;
    const vMomentumBefore = state.v[1] * dpMid + state.v[2] * dpSurface;

    stepVertical5({
      dt: 60,
      grid,
      state,
      params: {
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        tauPblUnstable: 600,
        tauPblStable: 1e9,
        pblDepthFrac: 0.75,
        pblTaper: 0,
        maxMixFracPbl: 0.5,
        pblMixCondensate: false
      }
    });

    const uMomentumAfter = state.u[1] * dpMid + state.u[2] * dpSurface;
    const vMomentumAfter = state.v[1] * dpMid + state.v[2] * dpSurface;

    expect(state.u[2]).toBeGreaterThan(0);
    expect(state.u[1]).toBeLessThan(10);
    expect(state.v[2]).toBeLessThan(0);
    expect(state.v[1]).toBeGreaterThan(-4);
    expect(Math.abs(uMomentumAfter - uMomentumBefore)).toBeLessThan(0.01);
    expect(Math.abs(vMomentumAfter - vMomentumBefore)).toBeLessThan(0.01);
  });

  test('can disable momentum exchange without disabling scalar PBL mixing', () => {
    const sigmaHalf = new Float32Array([0, 0.25, 0.55, 1]);
    const state = createState5({
      grid: { count: 1 },
      nz: 3,
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
    state.pHalf[1] = 35000;
    state.pHalf[2] = 65000;
    state.pHalf[3] = 100000;
    state.pMid[0] = 27500;
    state.pMid[1] = 50000;
    state.pMid[2] = 82500;
    state.theta[0] = 295;
    state.theta[1] = 300;
    state.theta[2] = 304;
    state.qv[1] = 0.002;
    state.qv[2] = 0.010;
    state.u[1] = 10;
    state.u[2] = 0;
    state.T[0] = 245;
    state.T[1] = 265;
    state.T[2] = 290;

    stepVertical5({
      dt: 60,
      grid,
      state,
      params: {
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        enablePblMomentumMix: false,
        tauPblUnstable: 600,
        tauPblStable: 1e9,
        pblDepthFrac: 0.75,
        pblTaper: 0,
        maxMixFracPbl: 0.5,
        pblMixCondensate: false
      }
    });

    expect(state.qv[2]).toBeLessThan(0.010);
    expect(state.qv[1]).toBeGreaterThan(0.002);
    expect(state.u[1]).toBe(10);
    expect(state.u[2]).toBe(0);
  });

  test('uses a shallower marine-stable PBL and a deeper land-unstable PBL', () => {
    const sigmaHalf = new Float32Array([0, 0.1, 0.25, 0.45, 0.7, 0.85, 1]);
    const state = createState5({
      grid: { count: 2 },
      nz: 6,
      sigmaHalf
    });
    const grid = {
      nx: 2,
      ny: 1,
      invDx: new Float32Array([1]),
      invDy: new Float32Array([1]),
      cosLat: new Float32Array([1])
    };

    const pHalfByLev = [20000, 28000, 40000, 56000, 76000, 88000, 100000];
    const pMidByLev = [24000, 34000, 48000, 66000, 82000, 94000];
    const tempByLev = [225, 238, 252, 268, 282, 295];
    for (let lev = 0; lev <= 6; lev += 1) {
      for (let k = 0; k < 2; k += 1) {
        state.pHalf[lev * 2 + k] = pHalfByLev[lev];
        if (lev < 6) {
          state.pMid[lev * 2 + k] = pMidByLev[lev];
          state.T[lev * 2 + k] = tempByLev[lev];
          state.theta[lev * 2 + k] = 300 - lev;
        }
      }
    }
    state.ps[0] = 100000;
    state.ps[1] = 100000;

    // Column 0: stable marine boundary layer.
    state.theta[8] = 304;
    state.theta[10] = 300;
    state.landMask[0] = 0;

    // Column 1: unstable land boundary layer.
    state.theta[9] = 299;
    state.theta[11] = 303;
    state.landMask[1] = 1;

    stepVertical5({
      dt: 60,
      grid,
      state,
      params: {
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        pblDepthFracStable: 0.14,
        pblDepthFracUnstable: 0.22,
        pblDepthFracLandBonus: 0.02,
        pblDepthFracOceanPenalty: 0.02,
        maxMixFracPbl: 0.2,
        pblMixCondensate: false
      }
    });

    expect(state._pblTopIndex[0]).toBeGreaterThan(state._pblTopIndex[1]);
    expect(state._pblTopIndex[0]).toBe(5);
    expect(state._pblTopIndex[1]).toBe(4);
  });
});
