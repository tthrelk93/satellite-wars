import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOCAL_DOWNSCALE_PRODUCT_SCHEMA,
  buildLocalDownscaleProduct
} from '../../src/weather/downscale/localDownscaling.js';
import { createLatLonGrid } from '../../src/weather/grid.js';
import { createWeatherKernel } from '../../src/weather/kernel/index.js';

const makeFixture = ({ nx = 36, ny = 18 } = {}) => {
  const grid = createLatLonGrid(nx, ny);
  const count = grid.count;
  const fields = {
    u: new Float32Array(count).fill(5),
    v: new Float32Array(count).fill(1),
    ps: new Float32Array(count).fill(101200),
    precipRate: new Float32Array(count).fill(0.08),
    cloudLow: new Float32Array(count).fill(0.22),
    cloudHigh: new Float32Array(count).fill(0.18)
  };
  const state = {
    terrainFlowForcing: new Float32Array(count)
  };
  const geo = {
    elev: new Float32Array(count)
  };
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const k = j * nx + i;
      const lat = grid.latDeg[j];
      const lon = grid.lonDeg[i];
      geo.elev[k] = Math.max(0, 2200 - Math.hypot(lat - 38, lon + 105) * 360);
      state.terrainFlowForcing[k] = Math.max(0, 3.5 - Math.hypot(lat - 38, lon + 105) * 0.4);
    }
  }
  return { grid, fields, state, geo };
};

const maxOf = (arrayLike) => Array.from(arrayLike || []).reduce((max, value) => Math.max(max, value), -Infinity);
const minOf = (arrayLike) => Array.from(arrayLike || []).reduce((min, value) => Math.min(min, value), Infinity);

const hurricaneEvent = {
  id: 'hurricane:atlantic:test',
  type: 'hurricane',
  region: 'atlantic',
  center: { latDeg: 18, lonDeg: -55 },
  radiusKm: 720,
  intensity01: 0.82,
  motionVector: { uMs: 6, vMs: 2 },
  hurricane: {
    center: { latDeg: 18, lonDeg: -55 },
    intensity01: 0.82,
    rainShieldRadiusKm: 720,
    pressureDeficitPa: 5200,
    eyeRadiusKm: 26,
    windField: { maxWindMs: 52 },
    motionVector: { uMs: 6, vMs: 2 }
  }
};

const severeEvent = {
  id: 'tornado-outbreak:great-plains:test',
  type: 'tornado-outbreak',
  region: 'great-plains',
  center: { latDeg: 36, lonDeg: -98 },
  radiusKm: 360,
  intensity01: 0.76,
  motionVector: { uMs: 18, vMs: 7 },
  severeWeather: {
    center: { latDeg: 36, lonDeg: -98 },
    environmentIndex01: 0.76,
    ingredients: {
      capeProxy01: 0.86,
      shear01: 0.82,
      moisture01: 0.74,
      lift01: 0.78,
      stormMode01: 0.84,
      frontalSupport01: 0.42,
      drylineSupport01: 0.72,
      warmSeason01: 1
    },
    motionVector: { uMs: 18, vMs: 7 },
    satelliteSignature: {
      anvilRadiusKm: 275,
      overshootingTop: true
    },
    touchdownTracks: [
      {
        id: 'td-1',
        start: { latDeg: 35.7, lonDeg: -99.2 },
        end: { latDeg: 36.3, lonDeg: -97.4 },
        maxWidthM: 650,
        efScaleProxy: 'EF2'
      }
    ]
  }
};

test('local downscale product creates deterministic hurricane-scale nested fields constrained by event truth', () => {
  const fixture = makeFixture();
  const eventProduct = { activeEvents: [hurricaneEvent] };
  const a = buildLocalDownscaleProduct({
    ...fixture,
    eventProduct,
    seed: 1234,
    timeUTC: 42 * 3600
  });
  const b = buildLocalDownscaleProduct({
    ...fixture,
    eventProduct,
    seed: 1234,
    timeUTC: 42 * 3600
  });
  assert.equal(a.schema, LOCAL_DOWNSCALE_PRODUCT_SCHEMA);
  assert.equal(a.regionCount, 1);
  assert.deepEqual(Array.from(a.regions[0].fields.rainRateMmHr), Array.from(b.regions[0].fields.rainRateMmHr));
  assert.deepEqual(Array.from(a.regions[0].fields.windU), Array.from(b.regions[0].fields.windU));

  const region = a.regions[0];
  const center = Math.floor(region.grid.ny / 2) * region.grid.nx + Math.floor(region.grid.nx / 2);
  assert.equal(region.sourceKind, 'hurricane');
  assert.equal(region.constraints.fadesToParentAtEdge, true);
  assert.equal(region.constraints.globalTruthConstrained, true);
  assert.ok(region.fields.detailWeight[center] > 0.95);
  assert.ok(region.fields.detailWeight[0] < 0.12);
  assert.ok(maxOf(region.fields.rainRateMmHr) > maxOf(region.fields.parentRainRateMmHr) + 1);
  assert.ok(minOf(region.fields.pressurePa) < 99000);
  assert.ok(maxOf(region.fields.windSpeedMs) > 30);
});

test('severe local downscale exposes lightning hail and tornado-track detail only from severe event truth', () => {
  const fixture = makeFixture();
  fixture.fields.precipRate.fill(0.18);
  fixture.fields.cloudLow.fill(0.45);
  const product = buildLocalDownscaleProduct({
    ...fixture,
    eventProduct: { activeEvents: [severeEvent] },
    seed: 88,
    timeUTC: 150 * 86400
  });
  const region = product.regions[0];
  assert.equal(region.sourceKind, 'severe');
  assert.equal(region.tornadoTracks.length, 1);
  assert.ok(maxOf(region.fields.lightningRate) > 0.5);
  assert.ok(maxOf(region.fields.hailRisk) > 0.3);
  assert.ok(maxOf(region.fields.tornadoTrackMask) > 0.35);
  assert.ok(minOf(region.fields.visibilityKm) < 20);
});

test('focus-region downscaling fades away and does not invent severe hazards from generic rain', () => {
  const fixture = makeFixture();
  fixture.fields.precipRate.fill(0.06);
  fixture.fields.cloudLow.fill(0.24);
  fixture.fields.cloudHigh.fill(0.18);
  const product = buildLocalDownscaleProduct({
    ...fixture,
    eventProduct: { activeEvents: [] },
    focusRegions: [{ id: 'camera', latDeg: 40, lonDeg: -100, radiusKm: 320, gridSize: 21 }],
    seed: 17,
    timeUTC: 12 * 3600
  });
  const region = product.regions[0];
  assert.equal(region.source, 'focus');
  assert.equal(region.sourceKind, 'camera');
  assert.ok(region.fields.detailWeight[0] < 0.12);
  assert.ok(maxOf(region.fields.rainRateMmHr) <= 0.125);
  assert.equal(maxOf(region.fields.lightningRate), 0);
  assert.equal(maxOf(region.fields.hailRisk), 0);
  assert.equal(maxOf(region.fields.tornadoTrackMask), 0);
});

test('weather kernel exposes deterministic camera focus downscaling through the public boundary', async () => {
  const kernel = createWeatherKernel({ nx: 36, ny: 18, seed: 55 });
  await kernel.ready;
  kernel.setLocalFocusRegions([
    { id: 'camera-primary', kind: 'camera', center: { latDeg: 34, lonDeg: -96 }, radiusKm: 300, gridSize: 21 }
  ]);
  const a = kernel.getLocalDownscaleProduct({ force: true });
  const b = kernel.getLocalDownscaleProduct({ force: true });
  assert.equal(a.regionCount, 1);
  assert.equal(a.regions[0].source, 'focus');
  assert.equal(a.regions[0].sourceKind, 'camera');
  assert.deepEqual(Array.from(a.regions[0].fields.rainRateMmHr), Array.from(b.regions[0].fields.rainRateMmHr));
  assert.equal(maxOf(a.regions[0].fields.tornadoTrackMask), 0);
});
