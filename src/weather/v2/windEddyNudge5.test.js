import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { stepWindEddyNudge5 } from './windEddyNudge5.js';

function makeGrid() {
  return {
    nx: 2,
    ny: 1,
    latDeg: new Float32Array([45]),
    cosLat: new Float32Array([Math.cos(45 * Math.PI / 180)])
  };
}

test('stepWindEddyNudge5 applies EKE scaling even when spatial climatology targets are present', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 2 }, nz: 6, sigmaHalf });
  const grid = makeGrid();
  const levS = state.nz - 1;
  const base = levS * state.N;

  state.u.fill(0);
  state.v.fill(0);
  state.u[base + 0] = 0;
  state.u[base + 1] = 10;

  const beforeDeviation = Math.abs(state.u[base + 1] - 5);
  const result = stepWindEddyNudge5({
    dt: 86400,
    grid,
    state,
    climo: {
      hasWind: true,
      hasWind500: true,
      windNowU: new Float32Array([4, 6]),
      windNowV: new Float32Array([0, 0]),
      wind500NowU: new Float32Array([12, 14]),
      wind500NowV: new Float32Array([0, 0])
    },
    params: {
      tauSeconds: 86400,
      scaleClampMin: 0.5,
      scaleClampMax: 2.0,
      enableWithSpatialTargets: true
    }
  });

  const afterMean = (state.u[base + 0] + state.u[base + 1]) / 2;
  const afterDeviation = Math.abs(state.u[base + 1] - afterMean);

  assert.equal(result.didApply, true);
  assert.equal(result.source, 'spatial-climatology+eke-target');
  assert.ok(result.maxScale > 1);
  assert.ok(afterDeviation > beforeDeviation);
});

test('stepWindEddyNudge5 deficit-aware relaxation restores collapsed variance faster', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const baseState = createState5({ grid: { count: 2 }, nz: 6, sigmaHalf });
  const boostedState = createState5({ grid: { count: 2 }, nz: 6, sigmaHalf });
  const grid = makeGrid();
  const levS = baseState.nz - 1;
  const baseIdx = levS * baseState.N;

  for (const state of [baseState, boostedState]) {
    state.u.fill(0);
    state.v.fill(0);
    state.u[baseIdx + 0] = 0;
    state.u[baseIdx + 1] = 1;
  }

  const beforeDeviation = Math.abs(baseState.u[baseIdx + 1] - 0.5);
  const common = {
    dt: 120,
    grid,
    climo: {
      hasWind: true,
      hasWind500: true,
      windNowU: new Float32Array([4, 6]),
      windNowV: new Float32Array([0, 0]),
      wind500NowU: new Float32Array([12, 14]),
      wind500NowV: new Float32Array([0, 0])
    },
    params: {
      tauSeconds: 10 * 86400,
      scaleClampMin: 0.5,
      scaleClampMax: 3.0,
      enableWithSpatialTargets: true
    }
  };

  const baseResult = stepWindEddyNudge5({
    ...common,
    state: baseState,
    params: {
      ...common.params,
      deficitRelaxBoostMax: 1.0
    }
  });
  const boostedResult = stepWindEddyNudge5({
    ...common,
    state: boostedState,
    params: {
      ...common.params,
      deficitRelaxBoostMax: 24.0
    }
  });

  const baseDeviation = Math.abs(baseState.u[baseIdx + 1] - ((baseState.u[baseIdx + 0] + baseState.u[baseIdx + 1]) / 2));
  const boostedDeviation = Math.abs(boostedState.u[baseIdx + 1] - ((boostedState.u[baseIdx + 0] + boostedState.u[baseIdx + 1]) / 2));

  assert.equal(baseResult.didApply, true);
  assert.equal(boostedResult.didApply, true);
  assert.ok(baseDeviation > beforeDeviation);
  assert.ok(boostedDeviation > baseDeviation);
  assert.ok(boostedResult.maxScale >= baseResult.maxScale);
});

test('stepWindEddyNudge5 can still be explicitly disabled when spatial climatology targets are present', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 6 });
  const state = createState5({ grid: { count: 2 }, nz: 6, sigmaHalf });
  const grid = makeGrid();
  const levS = state.nz - 1;
  const base = levS * state.N;

  state.u.fill(0);
  state.v.fill(0);
  state.u[base + 0] = 0;
  state.u[base + 1] = 10;

  const result = stepWindEddyNudge5({
    dt: 86400,
    grid,
    state,
    climo: {
      hasWind: true,
      hasWind500: true,
      windNowU: new Float32Array([4, 6]),
      windNowV: new Float32Array([0, 0]),
      wind500NowU: new Float32Array([12, 14]),
      wind500NowV: new Float32Array([0, 0])
    },
    params: {
      tauSeconds: 86400,
      enableWithSpatialTargets: false
    }
  });

  assert.equal(result.didApply, false);
  assert.equal(result.source, 'spatial-climatology-disabled');
  assert.equal(state.u[base + 0], 0);
  assert.equal(state.u[base + 1], 10);
});
