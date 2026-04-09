import test from 'node:test';
import assert from 'node:assert/strict';

import { sampleFieldBilinear, sampleFieldBilinearInRange } from './WindStreamlineRenderer.js';

const approx = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} ≈ ${expected}`);
};

const assertSample = (actual, expected) => {
  assert.equal(actual.valid, expected.valid);
  approx(actual.dx, expected.dx);
  approx(actual.dy, expected.dy);
  approx(actual.speed, expected.speed);
};

const buildField = () => ({
  width: 3,
  height: 2,
  fieldDx: new Float32Array([1, 2, 3, 4, 5, 6]),
  fieldDy: new Float32Array([10, 20, 30, 40, 50, 60]),
  fieldSpeed: new Float32Array([100, 200, 300, 400, 500, 600]),
  fieldValid: new Uint8Array([1, 1, 1, 1, 1, 1])
});

test('sampleFieldBilinearInRange matches weighted interpolation on the all-valid fast path', () => {
  const { width, height, fieldDx, fieldDy, fieldSpeed, fieldValid } = buildField();
  const sample = sampleFieldBilinearInRange(
    1.25,
    0.5,
    width,
    height,
    fieldDx,
    fieldDy,
    fieldSpeed,
    fieldValid
  );

  assertSample(sample, {
    dx: 3.75,
    dy: 37.5,
    speed: 375,
    valid: true
  });
});

test('sampleFieldBilinear normalizes surviving weights and reuses the provided output object', () => {
  const { width, height, fieldDx, fieldDy, fieldSpeed, fieldValid } = buildField();
  fieldValid[2] = 0;
  fieldValid[4] = 0;

  const out = { dx: 123, dy: 456, speed: 789, valid: false };
  const sample = sampleFieldBilinearInRange(
    1.25,
    0.5,
    width,
    height,
    fieldDx,
    fieldDy,
    fieldSpeed,
    fieldValid,
    out
  );

  assert.equal(sample, out);
  assertSample(sample, {
    dx: 3,
    dy: 30,
    speed: 300,
    valid: true
  });
});

test('sampleFieldBilinear wraps x coordinates before delegating to the in-range fast path', () => {
  const { width, height, fieldDx, fieldDy, fieldSpeed, fieldValid } = buildField();

  const wrapped = sampleFieldBilinear(
    -0.25,
    0.75,
    width,
    height,
    fieldDx,
    fieldDy,
    fieldSpeed,
    fieldValid
  );
  const inRange = sampleFieldBilinearInRange(
    2.75,
    0.75,
    width,
    height,
    fieldDx,
    fieldDy,
    fieldSpeed,
    fieldValid
  );

  assertSample(wrapped, inRange);
});

test('sampleFieldBilinear marks out-of-range samples invalid', () => {
  const { width, height, fieldDx, fieldDy, fieldSpeed, fieldValid } = buildField();
  const sample = sampleFieldBilinear(
    1.5,
    height,
    width,
    height,
    fieldDx,
    fieldDy,
    fieldSpeed,
    fieldValid
  );

  assert.deepEqual(sample, { dx: 0, dy: 0, speed: 0, valid: false });
});
