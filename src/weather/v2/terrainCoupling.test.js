import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { updateHydrostatic } from './hydrostatic.js';
import { stepVertical5 } from './vertical5.js';

const makeGrid = ({ nx = 3, ny = 2 } = {}) => ({
  nx,
  ny,
  count: nx * ny,
  invDx: new Float32Array(Array.from({ length: ny }, () => 1 / 100000)),
  invDy: new Float32Array(Array.from({ length: ny }, () => 1 / 100000)),
  cosLat: new Float32Array(Array.from({ length: ny }, () => 1)),
  latDeg: new Float32Array(Array.from({ length: ny }, (_, idx) => 10 - idx * 20))
});

test('updateHydrostatic incorporates terrain height into geopotential', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 2 }, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.theta.fill(290);
  state.qv.fill(0.004);

  updateHydrostatic(state, { pTop: 20000, terrainHeightM: new Float32Array([0, 1500]) });

  const lowLev = 3 * state.N;
  assert.ok(state.phiMid[lowLev + 1] > state.phiMid[lowLev + 0]);
});

test('stepVertical5 adds terrain-driven omega for upslope flow', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const runCase = (elev, orographicLiftScale = 1.0) => {
    const state = createState5({ grid, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.theta.fill(290);
    state.qv.fill(0.004);
    updateHydrostatic(state, { pTop: 20000, terrainHeightM: elev });
    const levS = state.nz - 1;
    for (let k = 0; k < state.N; k += 1) {
      state.u[levS * state.N + k] = 20;
      state.v[levS * state.N + k] = 0;
    }
    stepVertical5({
      dt: 60,
      grid,
      state,
      geo: { elev },
      params: {
        enableMixing: false,
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        orographicLiftScale
      }
    });
    return state;
  };

  const flat = runCase(new Float32Array([0, 0, 0, 0, 0, 0]));
  const terrain = runCase(new Float32Array([0, 1000, 2000, 0, 1000, 2000]));
  let maxDiff = 0;
  for (let i = 0; i < terrain.omega.length; i += 1) {
    maxDiff = Math.max(maxDiff, Math.abs(terrain.omega[i] - flat.omega[i]));
  }
  assert.ok(maxDiff > 0);
});

test('stepVertical5 scales terrain-driven omega with orographicLiftScale', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const elev = new Float32Array([0, 1000, 2000, 0, 1000, 2000]);
  const runCase = (orographicLiftScale) => {
    const state = createState5({ grid, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.theta.fill(290);
    state.qv.fill(0.004);
    updateHydrostatic(state, { pTop: 20000, terrainHeightM: elev });
    const levS = state.nz - 1;
    for (let k = 0; k < state.N; k += 1) {
      state.u[levS * state.N + k] = 20;
      state.v[levS * state.N + k] = 0;
    }
    stepVertical5({
      dt: 60,
      grid,
      state,
      geo: { elev },
      params: {
        enableMixing: false,
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        orographicLiftScale
      }
    });
    return state;
  };

  const terrainStrong = runCase(1.0);
  const terrainWeak = runCase(0.5);
  let strongMax = 0;
  let weakMax = 0;
  for (let i = 0; i < terrainStrong.omega.length; i += 1) {
    strongMax = Math.max(strongMax, Math.abs(terrainStrong.omega[i]));
    weakMax = Math.max(weakMax, Math.abs(terrainWeak.omega[i]));
  }
  assert.ok(weakMax > 0);
  assert.ok(strongMax > weakMax);
});

test('stepVertical5 damps lee-side terrain subsidence separately from upslope lift', () => {
  const grid = makeGrid();
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const elev = new Float32Array([1000, 1000, 1000, 0, 0, 0]);
  const runCase = (vWind, orographicLeeSubsidenceScale) => {
    const state = createState5({ grid, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.theta.fill(290);
    state.qv.fill(0.004);
    updateHydrostatic(state, { pTop: 20000, terrainHeightM: elev });
    const levS = state.nz - 1;
    for (let k = 0; k < state.N; k += 1) {
      state.u[levS * state.N + k] = 0;
      state.v[levS * state.N + k] = vWind;
    }
    stepVertical5({
      dt: 60,
      grid,
      state,
      geo: { elev },
      params: {
        enableMixing: false,
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        orographicLiftScale: 0.5,
        orographicLeeSubsidenceScale
      }
    });
    return state;
  };

  const upslope = runCase(20, 0.35);
  const leeFull = runCase(-20, 1.0);
  const leeDamped = runCase(-20, 0.35);
  const leeOff = runCase(-20, 0.0);
  let upslopeMin = 0;
  let leeFullMax = 0;
  let leeDampedMax = 0;
  let leeOffMax = 0;
  for (let i = 0; i < upslope.omega.length; i += 1) {
    upslopeMin = Math.min(upslopeMin, upslope.omega[i]);
    leeFullMax = Math.max(leeFullMax, leeFull.omega[i]);
    leeDampedMax = Math.max(leeDampedMax, leeDamped.omega[i]);
    leeOffMax = Math.max(leeOffMax, leeOff.omega[i]);
  }
  assert.ok(upslopeMin < 0);
  assert.ok(leeFullMax > leeDampedMax);
  assert.ok(leeDampedMax > leeOffMax);
  assert.equal(leeOffMax, 0);
});

test('stepVertical5 broad terrain sampling softens narrow-ridge lee forcing', () => {
  const grid = makeGrid({ nx: 7, ny: 2 });
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const elev = new Float32Array([
    0, 0, 800, 2600, 700, 0, 0,
    0, 0, 800, 2600, 700, 0, 0
  ]);
  const runCase = (terrainDirectionalBlend) => {
    const state = createState5({ grid, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.theta.fill(290);
    state.qv.fill(0.004);
    updateHydrostatic(state, { pTop: 20000, terrainHeightM: elev });
    const levS = state.nz - 1;
    for (let k = 0; k < state.N; k += 1) {
      state.u[levS * state.N + k] = 18;
      state.v[levS * state.N + k] = 0;
    }
    stepVertical5({
      dt: 60,
      grid,
      state,
      geo: { elev },
      params: {
        enableMixing: false,
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        orographicLiftScale: 0.5,
        orographicLeeSubsidenceScale: 0.35,
        terrainDirectionalBlend
      }
    });
    return state;
  };

  const localOnly = runCase(0.0);
  const broadBlend = runCase(0.75);
  let localLeeMax = 0;
  let broadLeeMax = 0;
  let broadUpslopeMin = 0;
  for (let i = 0; i < localOnly.omega.length; i += 1) {
    localLeeMax = Math.max(localLeeMax, localOnly.omega[i]);
    broadLeeMax = Math.max(broadLeeMax, broadBlend.omega[i]);
    broadUpslopeMin = Math.min(broadUpslopeMin, broadBlend.omega[i]);
  }

  assert.ok(localLeeMax > 0);
  assert.ok(broadLeeMax < localLeeMax);
  assert.ok(broadUpslopeMin < 0);
});

test('stepVertical5 tracks terrain-forced low-level moisture-delivery footprint', () => {
  const grid = makeGrid({ nx: 4, ny: 2 });
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const elev = new Float32Array([
    0, 600, 1800, 2600,
    0, 600, 1800, 2600
  ]);

  const runCase = (terrainHeightM) => {
    const state = createState5({ grid, nz: 4, sigmaHalf });
    state.ps.fill(100000);
    state.theta.fill(290);
    updateHydrostatic(state, { pTop: 20000, terrainHeightM });
    const levS = state.nz - 1;
    for (let k = 0; k < state.N; k += 1) {
      state.u[levS * state.N + k] = 22;
      state.v[levS * state.N + k] = 0;
      state.qv[(levS - 1) * state.N + k] = 0.0025;
      state.qv[levS * state.N + k] = 0.012;
    }

    stepVertical5({
      dt: 120,
      grid,
      state,
      geo: { elev: terrainHeightM },
      params: {
        enableMixing: false,
        enableConvection: false,
        enableOmegaMassFix: false,
        enableLargeScaleVerticalAdvection: true,
        verticalAdvectionCflMax: 0.8,
        orographicLiftScale: 1.0
      }
    });
    return state;
  };

  const flat = runCase(new Float32Array(elev.length).fill(0));
  const terrain = runCase(elev);

  const terrainMaxDelivery = Math.max(...terrain.orographicDeliveryAccum);
  const terrainMaxExposure = Math.max(...terrain.orographicDeliveryExposureAccum);
  const terrainMaxActiveSteps = Math.max(...terrain.orographicDeliveryActiveSteps);
  const flatMaxDelivery = Math.max(...flat.orographicDeliveryAccum);
  const flatMaxExposure = Math.max(...flat.orographicDeliveryExposureAccum);

  assert.ok(terrainMaxDelivery > 0);
  assert.ok(terrainMaxExposure > 0);
  assert.ok(terrainMaxActiveSteps > 0);
  assert.equal(flatMaxDelivery, 0);
  assert.equal(flatMaxExposure, 0);
});
