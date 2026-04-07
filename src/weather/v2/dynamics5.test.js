import { createState5 } from './state5';
import { stepWinds5 } from './dynamics5';

const makeScratch = (N) => ({
  lapU: new Float32Array(N),
  lapV: new Float32Array(N),
  lapLapU: new Float32Array(N),
  lapLapV: new Float32Array(N),
  rowA: new Float32Array(N),
  rowB: new Float32Array(N)
});

const makeGrid = () => ({
  nx: 1,
  ny: 1,
  count: 1,
  invDx: new Float32Array([1]),
  invDy: new Float32Array([1]),
  f: new Float32Array([0]),
  latDeg: new Float32Array([45]),
  polarWeight: new Float32Array([0]),
  sinLat: new Float32Array([Math.sin(Math.PI / 4)]),
  cosLat: new Float32Array([Math.cos(Math.PI / 4)])
});

describe('dynamics5 drag tapering', () => {
  test('concentrates strong drag in the near-surface layers instead of linearly damping the full column', () => {
    const sigmaHalf = new Float32Array([0, 0.4, 0.7, 0.85, 1.0]);
    const grid = makeGrid();
    const state = createState5({ grid, nz: 4, sigmaHalf });
    const geo = { elev: new Float32Array([0]) };

    for (let lev = 0; lev < state.nz; lev += 1) {
      state.u[lev] = 10;
      state.v[lev] = 0;
      state.phiMid[lev] = 0;
    }

    stepWinds5({
      dt: 3600,
      grid,
      state,
      geo,
      params: {
        maxWind: 70,
        tauDragSurface: 6 * 3600,
        tauDragTop: 24 * 3600,
        dragSigmaStart: 0.72,
        dragSigmaEnd: 0.98,
        dragSigmaExponent: 2.0,
        roughnessSigmaStart: 0.82,
        roughnessSigmaEnd: 1.0,
        roughnessSigmaExponent: 1.5,
        nuLaplacian: 0,
        quadDragAlphaSurface: 0,
        tropicsDragBoost: 0,
        terrainDragBoost: 0,
        landRoughnessBoost: 0,
        polarFilterEverySteps: 0,
        extraFilterEverySteps: 0,
        enableMetricTerms: false
      },
      scratch: makeScratch(1)
    });

    const topU = state.u[0];
    const midU = state.u[1];
    const lowerU = state.u[2];
    const surfaceU = state.u[3];

    expect(topU).toBeGreaterThan(9.5);
    expect(midU).toBeGreaterThan(9.4);
    expect(lowerU).toBeGreaterThan(8.9);
    expect(surfaceU).toBeLessThan(9.1);
    expect(surfaceU).toBeLessThan(lowerU - 0.15);
    expect(lowerU).toBeLessThan(midU);
    expect(midU).toBeLessThanOrEqual(topU + 1e-6);
  });

  test('keeps land roughness penalties confined to the true near-surface layer', () => {
    const sigmaHalf = new Float32Array([0, 0.4, 0.7, 0.85, 1.0]);
    const grid = makeGrid();
    const oceanState = createState5({ grid, nz: 4, sigmaHalf });
    const landState = createState5({ grid, nz: 4, sigmaHalf });
    const oceanGeo = { elev: new Float32Array([0]) };
    const landGeo = { elev: new Float32Array([5000]) };

    for (let lev = 0; lev < 4; lev += 1) {
      oceanState.u[lev] = 10;
      landState.u[lev] = 10;
      oceanState.v[lev] = 0;
      landState.v[lev] = 0;
      oceanState.phiMid[lev] = 0;
      landState.phiMid[lev] = 0;
    }
    landState.landMask[0] = 1;

    const params = {
      maxWind: 70,
      tauDragSurface: 6 * 3600,
      tauDragTop: 24 * 3600,
      dragSigmaStart: 0.72,
      dragSigmaEnd: 0.98,
      dragSigmaExponent: 2.0,
      roughnessSigmaStart: 0.82,
      roughnessSigmaEnd: 1.0,
      roughnessSigmaExponent: 1.5,
      nuLaplacian: 0,
      quadDragAlphaSurface: 0,
      tropicsDragBoost: 0,
      terrainDragBoost: 0,
      landRoughnessBoost: 0.3,
      polarFilterEverySteps: 0,
      extraFilterEverySteps: 0,
      enableMetricTerms: false
    };

    stepWinds5({ dt: 3600, grid, state: oceanState, geo: oceanGeo, params, scratch: makeScratch(1) });
    stepWinds5({ dt: 3600, grid, state: landState, geo: landGeo, params, scratch: makeScratch(1) });

    expect(landState.u[0]).toBeCloseTo(oceanState.u[0], 6);
    expect(landState.u[1]).toBeCloseTo(oceanState.u[1], 6);
    expect(landState.u[3]).toBeLessThan(oceanState.u[3]);
  });
});
