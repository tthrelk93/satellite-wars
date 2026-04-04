import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolatePressureLevel, remapStructuredGrid2D } from '../lib/remap.mjs';

const approxEqualArray = (actual, expected, tolerance = 1e-6) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) <= tolerance, `index ${index}: expected ${expected[index]}, got ${value}`);
  });
};

test('remapStructuredGrid2D preserves a linear lat/lon field under bilinear remapping', () => {
  const sourceGrid = {
    latitudesDeg: [30, -30],
    longitudesDeg: [-90, 90]
  };
  const targetGrid = {
    latitudesDeg: [30, 0, -30],
    longitudesDeg: [-90, 0, 90]
  };

  const field = [];
  sourceGrid.latitudesDeg.forEach((latDeg) => {
    sourceGrid.longitudesDeg.forEach((lonDeg) => {
      field.push(latDeg + lonDeg / 10);
    });
  });

  const remapped = remapStructuredGrid2D(field, sourceGrid, targetGrid);
  const expected = [];
  targetGrid.latitudesDeg.forEach((latDeg) => {
    targetGrid.longitudesDeg.forEach((lonDeg) => {
      expected.push(latDeg + lonDeg / 10);
    });
  });

  approxEqualArray(remapped, expected, 1e-6);
});

test('interpolatePressureLevel interpolates linearly in log-pressure space', () => {
  const byPressure = {
    70000: [3000, 3100],
    40000: [7000, 7100]
  };

  const interpolated = interpolatePressureLevel(byPressure, 50000);
  const t = (Math.log(50000) - Math.log(70000)) / (Math.log(40000) - Math.log(70000));
  const expected = [
    3000 + (7000 - 3000) * t,
    3100 + (7100 - 3100) * t
  ];

  approxEqualArray(interpolated, expected, 1e-6);
});
