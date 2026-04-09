import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherCore5 } from './core5.js';

test('WeatherCore5 defaults keep the stronger broad-circulation surface wind restore enabled', async () => {
  const core = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await core._initPromise;

  assert.equal(core.windNudgeParams.tauSurfaceSeconds, 8 * 3600);
  assert.equal(core.windNudgeSpinupParams.tauSurfaceStartSeconds, 6 * 3600);
});
