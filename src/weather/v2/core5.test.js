import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherCore5 } from './core5.js';

test('WeatherCore5 defaults keep the stronger broad-circulation surface wind restore enabled', async () => {
  const core = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await core._initPromise;

  assert.equal(core.windNudgeParams.tauSurfaceSeconds, 8 * 3600);
  assert.equal(core.windNudgeSpinupParams.tauSurfaceStartSeconds, 6 * 3600);
  assert.equal(core.vertParams.rhTrig, 0.72);
  assert.equal(core.vertParams.rhMidMin, 0.22);
  assert.equal(core.vertParams.omegaTrig, 0.2);
  assert.equal(core.vertParams.instabTrig, 2.5);
  assert.equal(core.vertParams.qvTrig, 0.0018);
  assert.equal(core.vertParams.thetaeCoeff, 10.5);
  assert.equal(core.microParams.precipEffMicro, 0.75);
});

test('WeatherCore5 refreshes runtime nudge params from current nudgeParams before nudging', async () => {
  const core = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await core._initPromise;

  assert.equal(core._nudgeParamsRuntime.enableQvColumn, true);

  core.nudgeParams.enableQvColumn = false;
  core.nudgeParams.tauQvColumn = 20 * 86400;
  core._nudgeAccumSeconds = core.nudgeParams.cadenceSeconds;
  core._stepOnce(core.modelDt);

  assert.equal(core._nudgeParamsRuntime.enableQvColumn, false);
  assert.equal(core._nudgeParamsRuntime.tauQvColumn, 20 * 86400);
});
