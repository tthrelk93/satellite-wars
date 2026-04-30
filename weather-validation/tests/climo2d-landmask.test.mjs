import test from 'node:test';
import assert from 'node:assert/strict';
import { maskElevToLand } from '../../src/weather/v2/climo2d.js';

test('maskElevToLand zeros ocean elevations while preserving land terrain', () => {
  const elev = new Float32Array([1200, 80, 2500, 15, 0]);
  const landMask = new Uint8Array([1, 0, 1, 0, 1]);

  maskElevToLand(elev, landMask);

  assert.deepEqual(Array.from(elev), [1200, 0, 2500, 0, 0]);
});
