import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels, findClosestLevelIndex } from './verticalGrid.js';
import { stepWindNudge5 } from './windNudge5.js';

test('stepWindNudge5 uses spatial climatology targets when available', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 4 }, nz: 6, sigmaHalf });
  const grid = {
    nx: 2,
    ny: 2,
    latDeg: new Float32Array([30, -30]),
    cosLat: new Float32Array([Math.cos(Math.PI / 6), Math.cos(Math.PI / 6)])
  };
  state.u.fill(0);
  state.v.fill(0);
  const levS = state.nz - 1;
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  for (let i = 0; i < state.N; i += 1) {
    state.pMid[levU * state.N + i] = 30000;
  }
  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: false,
    windNowU: new Float32Array([5, 6, 7, 8]),
    windNowV: new Float32Array([1, 1, 1, 1]),
    wind500NowU: new Float32Array([15, 16, 17, 18]),
    wind500NowV: new Float32Array([2, 2, 2, 2])
  };

  const result = stepWindNudge5({
    dt: 86400,
    grid,
    state,
    climo,
    params: {
      tauSurfaceSeconds: 86400,
      tauUpperSeconds: 86400,
      tauVSeconds: 86400
    }
  });

  assert.equal(result.source, 'spatial-climatology');
  assert.equal(state.u[levS * state.N + 0], 5);
  assert.equal(state.v[levS * state.N + 0], 1);
  assert.equal(state.u[levU * state.N + 0], 15);
  assert.equal(state.v[levU * state.N + 0], 2);
});

test('stepWindNudge5 blends 500 hPa and 250 hPa targets for upper-level nudging', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 4 }, nz: 6, sigmaHalf });
  const grid = {
    nx: 2,
    ny: 2,
    latDeg: new Float32Array([30, -30]),
    cosLat: new Float32Array([Math.cos(Math.PI / 6), Math.cos(Math.PI / 6)])
  };
  state.u.fill(0);
  state.v.fill(0);
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  for (let i = 0; i < state.N; i += 1) {
    state.pMid[levU * state.N + i] = 30000;
  }
  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: true,
    windNowU: new Float32Array([5, 6, 7, 8]),
    windNowV: new Float32Array([1, 1, 1, 1]),
    wind500NowU: new Float32Array([15, 16, 17, 18]),
    wind500NowV: new Float32Array([2, 2, 2, 2]),
    wind250NowU: new Float32Array([35, 36, 37, 38]),
    wind250NowV: new Float32Array([6, 6, 6, 6])
  };

  stepWindNudge5({
    dt: 86400,
    grid,
    state,
    climo,
    params: {
      tauSurfaceSeconds: 86400,
      tauUpperSeconds: 86400,
      tauVSeconds: 86400
    }
  });

  assert.equal(state.u[levU * state.N + 0], 31);
  assert.ok(Math.abs(state.v[levU * state.N + 0] - 5.2) < 1e-6);
});

test('stepWindNudge5 caps runaway upper winds relative to climatology targets', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 1 }, nz: 6, sigmaHalf });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([35]),
    cosLat: new Float32Array([Math.cos(35 * Math.PI / 180)])
  };
  state.u.fill(0);
  state.v.fill(0);
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  state.pMid[levU * state.N + 0] = 30000;
  state.u[levU * state.N + 0] = 100;
  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: true,
    windNowU: new Float32Array([5]),
    windNowV: new Float32Array([0]),
    wind500NowU: new Float32Array([15]),
    wind500NowV: new Float32Array([2]),
    wind250NowU: new Float32Array([35]),
    wind250NowV: new Float32Array([6])
  };

  stepWindNudge5({
    dt: 1,
    grid,
    state,
    climo,
    params: {
      tauSurfaceSeconds: 1e9,
      tauUpperSeconds: 1e9,
      tauVSeconds: 1e9,
      upperWindCapFactor: 2.5,
      upperWindCapOffset: 20,
      upperWindCapMin: 35,
      maxUpperSpeed: 70
    }
  });

  const cappedSpeed = Math.hypot(state.u[levU * state.N + 0], state.v[levU * state.N + 0]);
  assert.ok(cappedSpeed <= 70);
  assert.ok(cappedSpeed < 100);
});

test('stepWindNudge5 does not preserve a fixed base upper-air floor in weak-target bands', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 1 }, nz: 6, sigmaHalf });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([80]),
    cosLat: new Float32Array([Math.cos(80 * Math.PI / 180)])
  };
  state.u.fill(0);
  state.v.fill(0);
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  state.pMid[levU * state.N + 0] = 30000;
  state.u[levU * state.N + 0] = 100;
  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: true,
    windNowU: new Float32Array([2]),
    windNowV: new Float32Array([0]),
    wind500NowU: new Float32Array([5]),
    wind500NowV: new Float32Array([0]),
    wind250NowU: new Float32Array([5]),
    wind250NowV: new Float32Array([0])
  };

  stepWindNudge5({
    dt: 1,
    grid,
    state,
    climo,
    params: {
      tauSurfaceSeconds: 1e9,
      tauUpperSeconds: 1e9,
      tauVSeconds: 1e9,
      upperWindCapFactor: 1.6,
      upperWindCapOffset: 0,
      upperWindCapMin: 0
    }
  });

  const cappedSpeed = Math.hypot(state.u[levU * state.N + 0], state.v[levU * state.N + 0]);
  assert.ok(cappedSpeed <= 8 + 1e-6);
  assert.ok(cappedSpeed < 10);
});

test('stepWindNudge5 keeps moderate upper-air targets below runaway 2.5x inflation', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 1 }, nz: 6, sigmaHalf });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([55]),
    cosLat: new Float32Array([Math.cos(55 * Math.PI / 180)])
  };
  state.u.fill(0);
  state.v.fill(0);
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  state.pMid[levU * state.N + 0] = 30000;
  state.u[levU * state.N + 0] = 100;
  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: true,
    windNowU: new Float32Array([4]),
    windNowV: new Float32Array([0]),
    wind500NowU: new Float32Array([10]),
    wind500NowV: new Float32Array([0]),
    wind250NowU: new Float32Array([10]),
    wind250NowV: new Float32Array([0])
  };

  stepWindNudge5({
    dt: 1,
    grid,
    state,
    climo,
    params: {
      tauSurfaceSeconds: 1e9,
      tauUpperSeconds: 1e9,
      tauVSeconds: 1e9,
      upperWindCapFactor: 1.4,
      upperWindCapOffset: 0,
      upperWindCapMin: 0,
      upperWindCapJetBoost: 20,
      upperJetLatDeg: 35,
      upperJetWidthDeg: 12
    }
  });

  const cappedSpeed = Math.hypot(state.u[levU * state.N + 0], state.v[levU * state.N + 0]);
  assert.ok(cappedSpeed <= 14 + 1e-6);
  assert.ok(cappedSpeed < 16);
});

test('stepWindNudge5 still leaves headroom for strong jet targets after tightening the cap factor', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 1 }, nz: 6, sigmaHalf });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([35]),
    cosLat: new Float32Array([Math.cos(35 * Math.PI / 180)])
  };
  state.u.fill(0);
  state.v.fill(0);
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  state.pMid[levU * state.N + 0] = 25000;
  state.u[levU * state.N + 0] = 100;
  const climo = {
    hasWind: true,
    hasWind500: true,
    hasWind250: true,
    windNowU: new Float32Array([6]),
    windNowV: new Float32Array([0]),
    wind500NowU: new Float32Array([18]),
    wind500NowV: new Float32Array([0]),
    wind250NowU: new Float32Array([30]),
    wind250NowV: new Float32Array([0])
  };

  stepWindNudge5({
    dt: 1,
    grid,
    state,
    climo,
    params: {
      tauSurfaceSeconds: 1e9,
      tauUpperSeconds: 1e9,
      tauVSeconds: 1e9,
      upperWindCapFactor: 1.4,
      upperWindCapOffset: 0,
      upperWindCapMin: 0,
      upperWindCapJetBoost: 20,
      upperJetLatDeg: 35,
      upperJetWidthDeg: 12
    }
  });

  const cappedSpeed = Math.hypot(state.u[levU * state.N + 0], state.v[levU * state.N + 0]);
  assert.ok(cappedSpeed <= 42 + 1e-6);
  assert.ok(cappedSpeed > 40);
});
