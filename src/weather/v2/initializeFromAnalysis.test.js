import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { initializeV2FromAnalysis } from './initializeFromAnalysis.js';

const buildDataset = () => ({
  schema: 'satellite-wars.weather-analysis.case.v1',
  caseId: 'unit-test-analysis',
  validTime: '2026-01-15T00:00:00Z',
  grid: {
    latitudesDeg: [30, -30],
    longitudesDeg: [-90, 90]
  },
  fields: {
    surfacePressurePa: [101000, 100500, 99500, 99000],
    surfaceTemperatureK: [298, 300, 292, 294],
    surfaceGeopotentialM2S2: [0, 0, 1200, 800],
    uByPressurePa: {
      100000: [5, 6, 7, 8],
      70000: [10, 11, 12, 13],
      50000: [15, 16, 17, 18]
    },
    vByPressurePa: {
      100000: [-2, -1, 0, 1],
      70000: [2, 3, 4, 5],
      50000: [6, 7, 8, 9]
    },
    temperatureKByPressurePa: {
      100000: [298, 300, 292, 294],
      70000: [282, 284, 278, 280],
      50000: [254, 256, 250, 252]
    },
    relativeHumidityByPressurePa: {
      100000: [0.7, 0.65, 0.6, 0.55],
      70000: [0.55, 0.5, 0.45, 0.4],
      50000: [0.3, 0.32, 0.28, 0.26]
    }
  }
});

test('initializeV2FromAnalysis remaps and interpolates analysis data onto model levels', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 8 });
  const state = createState5({ grid: { count: 4 }, nz: 8, sigmaHalf });
  state.landMask.set([0, 1, 1, 0]);
  state.soilCap.fill(100);
  const geo = { elev: new Float32Array(4) };
  const grid = {
    nx: 2,
    ny: 2,
    latDeg: new Float32Array([30, -30]),
    lonDeg: new Float32Array([-90, 90])
  };

  const result = initializeV2FromAnalysis({
    grid,
    state,
    geo,
    analysis: buildDataset(),
    params: { pTop: 20000 }
  });

  assert.equal(result.source, 'analysis');
  assert.equal(result.caseId, 'unit-test-analysis');
  assert.equal(state.ps.length, 4);
  assert.equal(state.Ts.length, 4);
  for (const value of state.ps) assert.ok(Number.isFinite(value));
  for (const value of state.Ts) assert.ok(Number.isFinite(value));
  for (const value of state.theta) assert.ok(Number.isFinite(value));
  for (const value of state.qv) assert.ok(value >= 0 && value <= 0.03);
  for (const value of state.u) assert.ok(Number.isFinite(value));
  for (const value of state.v) assert.ok(Number.isFinite(value));
  for (const value of state.qc) assert.equal(value, 0);
  for (const value of state.qi) assert.equal(value, 0);
  for (const value of state.qr) assert.equal(value, 0);
  assert.ok(geo.elev[2] > 0);
  assert.ok(state.soilW[1] > 0);
  assert.equal(state.soilW[0], 0);
});
