import { armAnalysisIncrement5, clearAnalysisIncrement5, stepAnalysisIncrement5 } from './analysisIncrement5';
import { createState5 } from './state5';

const makeState = () => createState5({
  grid: { count: 2 },
  nz: 2,
  sigmaHalf: new Float32Array([0, 0.5, 1])
});

describe('analysisIncrement5', () => {
  test('applies residual corrections smoothly across the armed window', () => {
    const state = makeState();
    state.ps[0] = 100000;
    state.Ts[0] = 290;
    state.u[0] = 5;
    state.v[0] = -3;
    state.theta[0] = 300;
    state.qv[0] = 0.01;

    state.analysisIauPs[0] = 10 / 10;
    state.analysisIauTs[0] = 5 / 10;
    state.analysisIauU[0] = 2 / 10;
    state.analysisIauV[0] = -4 / 10;
    state.analysisIauTheta[0] = 8 / 10;
    state.analysisIauQv[0] = 0.01 / 10;
    armAnalysisIncrement5(state, 10);

    const first = stepAnalysisIncrement5({ dt: 4, state });
    expect(first.didApply).toBe(true);
    expect(state.ps[0]).toBeCloseTo(100004, 4);
    expect(state.Ts[0]).toBeCloseTo(292, 4);
    expect(state.u[0]).toBeCloseTo(5.8, 4);
    expect(state.v[0]).toBeCloseTo(-4.6, 4);
    expect(state.theta[0]).toBeCloseTo(303.2, 4);
    expect(state.qv[0]).toBeCloseTo(0.014, 4);
    expect(state.analysisIauRemainingSeconds).toBeCloseTo(6, 6);

    const second = stepAnalysisIncrement5({ dt: 6, state });
    expect(second.didApply).toBe(true);
    expect(state.ps[0]).toBeCloseTo(100010, 4);
    expect(state.Ts[0]).toBeCloseTo(295, 4);
    expect(state.u[0]).toBeCloseTo(7, 4);
    expect(state.v[0]).toBeCloseTo(-7, 4);
    expect(state.theta[0]).toBeCloseTo(308, 4);
    expect(state.qv[0]).toBeCloseTo(0.02, 4);
    expect(state.analysisIauRemainingSeconds).toBe(0);
    expect(Array.from(state.analysisIauPs)).toEqual([0, 0]);
  });

  test('respects field clamps and can be cleared explicitly', () => {
    const state = makeState();
    state.ps[0] = 109990;
    state.theta[0] = 379.5;
    state.qv[0] = 0.039;
    state.analysisIauPs[0] = 5;
    state.analysisIauTheta[0] = 1;
    state.analysisIauQv[0] = 0.01;
    armAnalysisIncrement5(state, 10);

    stepAnalysisIncrement5({
      dt: 5,
      state,
      params: {
        psMin: 50000,
        psMax: 110000,
        thetaMin: 180,
        thetaMax: 380,
        qvMax: 0.04
      }
    });

    expect(state.ps[0]).toBe(110000);
    expect(state.theta[0]).toBe(380);
    expect(state.qv[0]).toBeCloseTo(0.04, 6);

    clearAnalysisIncrement5(state);
    expect(state.analysisIauRemainingSeconds).toBe(0);
    expect(Array.from(state.analysisIauTheta)).toEqual([0, 0, 0, 0]);
  });
});
