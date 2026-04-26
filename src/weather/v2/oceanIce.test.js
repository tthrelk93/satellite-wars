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

test('stepSurface2D5 can boost evaporation over warm tropical open ocean', () => {
  const runCase = (boost) => {
    const grid = makeGrid();
    const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
    const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
    state.T.fill(300);
    state.theta.fill(300);
    state.qv.fill(0.004);
    state.Ts.fill(302);
    state.sstNow.fill(302);
    state.surfaceRadiativeFlux.fill(250);
    state.landMask.fill(0);
    const levS = state.nz - 1;
    for (let k = 0; k < state.N; k += 1) {
      state.u[levS * state.N + k] = 5;
      state.v[levS * state.N + k] = 0;
    }

    stepSurface2D5({
      dt: 3600,
      grid,
      state,
      climo: { sstNow: new Float32Array([302, 302]) },
      geo: { elev: new Float32Array([0, 0]) },
      params: {
        enableLandClimoTs: false,
        tropicalOceanEvapBoost: boost,
        tropicalOceanEvapLat0Deg: 8,
        tropicalOceanEvapLat1Deg: 18,
        tropicalOceanEvapSst0K: 296,
        tropicalOceanEvapSst1K: 301
      }
    });
    return state.surfaceEvapRate[0];
  };

  assert.ok(runCase(0.6) > runCase(0));
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

test('stepSurface2D5 heats dry land from the surface energy budget and reports biome proxies', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  state.T.fill(294);
  state.theta.fill(294);
  state.qv.fill(0.002);
  state.Ts.fill(292);
  state.surfaceRadiativeFlux.fill(260);
  state.landMask.fill(1);
  state.soilCap.fill(80);
  state.soilW.fill(8);
  const levS = state.nz - 1;
  for (let k = 0; k < state.N; k += 1) {
    state.u[levS * state.N + k] = 4;
    state.v[levS * state.N + k] = 0;
  }

  stepSurface2D5({
    dt: 3600,
    grid,
    state,
    climo: { t2mNow: new Float32Array([286, 286]), hasT2m: true },
    geo: {
      elev: new Float32Array([0, 0]),
      albedo: new Float32Array([0.34, 0.34])
    },
    params: {
      enableLandClimoTs: true,
      landTauTsDry: 30 * 86400,
      landTauTsWet: 70 * 86400,
      enableLandEnergyBudget: true,
      landEnergyMaxTempDeltaPerStepK: 2,
      landClimoMaxTempDeltaPerStepK: 0.1
    }
  });

  assert.ok(state.Ts[0] > 292, `expected positive land energy tendency to warm Ts, got ${state.Ts[0]}`);
  assert.ok(state.landEnergyTempTendency[0] > 0);
  assert.ok(Math.abs(state.landClimoTempTendency[0]) <= 0.1);
  assert.ok(state.landHeatCapacity[0] > 0);
  assert.ok(state.soilMoistureFraction[0] > 0 && state.soilMoistureFraction[0] < 0.2);
  assert.ok(state.vegetationProxy[0] < 0.1);
});

test('stepSurface2D5 gives humid tropical forest land transparent canopy and root-zone memory', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  state.T.fill(300);
  state.theta.fill(300);
  state.qv.fill(0.012);
  state.Ts.fill(300);
  state.surfaceRadiativeFlux.fill(180);
  state.precipRate.fill(0.04);
  state.landMask.fill(1);
  state.soilCap.fill(100);
  state.soilW.fill(5);
  const levS = state.nz - 1;
  for (let k = 0; k < state.N; k += 1) {
    state.u[levS * state.N + k] = 2;
    state.v[levS * state.N + k] = 0;
  }

  stepSurface2D5({
    dt: 3600,
    grid,
    state,
    climo: { t2mNow: new Float32Array([300, 300]), hasT2m: true },
    geo: {
      elev: new Float32Array([100, 100]),
      albedo: new Float32Array([0.16, 0.42])
    },
    params: {
      enableLandClimoTs: true,
      enableLandEnergyBudget: true
    }
  });

  assert.ok(state.rainforestCanopySupport[0] > 0.4);
  assert.ok(state.rainforestCanopySupport[1] < 0.05);
  assert.ok(state.rainforestRootZoneRechargeRate[0] > 0);
  assert.ok(state.soilMoistureFraction[0] > state.soilMoistureFraction[1]);
  assert.ok(state.landHeatCapacity[0] > state.landHeatCapacity[1]);
  assert.ok(state.vegetationProxy[0] > state.vegetationProxy[1]);
});
