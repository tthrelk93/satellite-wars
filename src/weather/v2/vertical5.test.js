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
