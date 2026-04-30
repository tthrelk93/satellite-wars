import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherCore5 } from './core5.js';

function assertFloatArrayClose(actual, expected, epsilon = 1e-6) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    const delta = Math.abs(actual[i] - expected[i]);
    assert.ok(delta <= epsilon, `index ${i} delta ${delta} exceeded ${epsilon}`);
  }
}

test('WeatherCore5 compact snapshots include runtime scalars needed by worker mirrors', async () => {
  const source = new WeatherCore5({ nx: 12, ny: 6, dt: 120, seed: 12345 });
  await source._initPromise;
  source.advanceModelSeconds(3900);

  const snapshot = source.getStateSnapshot({ mode: 'compact' });
  assert.equal(snapshot.mode, 'compact');
  assert.equal(typeof snapshot.runtime, 'object');
  assert.ok(Number.isFinite(snapshot.runtime.accumSeconds));
  assert.equal(snapshot.runtime.dynStepIndex, source._dynStepIndex);
  assert.equal(snapshot.runtime.nudgeAccumSeconds, source._nudgeAccumSeconds);
  assert.equal(snapshot.runtime.windNudgeSpinupSeconds, source._windNudgeSpinupSeconds);
  assert.equal(snapshot.runtime.simSpeed, source.simSpeed);

  const restored = new WeatherCore5({ nx: 12, ny: 6, dt: 120, seed: 99999 });
  await restored._initPromise;
  const applied = restored.applyStateSnapshot(snapshot, { restoreRuntime: true });

  assert.equal(applied, true);
  assert.equal(restored.timeUTC, source.timeUTC);
  assert.equal(restored._accum, source._accum);
  assert.equal(restored._dynStepIndex, source._dynStepIndex);
  assert.equal(restored._nudgeAccumSeconds, source._nudgeAccumSeconds);
  assert.equal(restored._climoAccumSeconds, source._climoAccumSeconds);
  assert.equal(restored._windNudgeSpinupSeconds, source._windNudgeSpinupSeconds);
  assert.equal(restored.simSpeed, source.simSpeed);
  assertFloatArrayClose(restored.fields.u, source.fields.u);
  assertFloatArrayClose(restored.fields.v, source.fields.v);
  assertFloatArrayClose(restored.fields.uU, source.fields.uU);
  assertFloatArrayClose(restored.fields.vU, source.fields.vU);
  assertFloatArrayClose(restored.fields.ps, source.fields.ps);
});

test('WeatherCore5 full snapshots restore runtime state and continue deterministically', async () => {
  const source = new WeatherCore5({ nx: 12, ny: 6, dt: 120, seed: 12345 });
  await source._initPromise;
  source.advanceModelSeconds(3900);

  const snapshot = source.getStateSnapshot({ mode: 'full' });
  assert.equal(typeof snapshot.runtime, 'object');
  assert.ok(Number.isFinite(snapshot.runtime.accumSeconds));

  const restored = new WeatherCore5({ nx: 12, ny: 6, dt: 120, seed: 99999 });
  await restored._initPromise;
  const applied = restored.applyStateSnapshot(snapshot, { restoreRuntime: true });

  assert.equal(applied, true);
  assert.equal(restored.timeUTC, source.timeUTC);
  assert.equal(restored._accum, source._accum);
  assert.equal(restored._dynStepIndex, source._dynStepIndex);
  assert.equal(restored._nudgeAccumSeconds, source._nudgeAccumSeconds);
  assert.equal(restored._climoAccumSeconds, source._climoAccumSeconds);
  assert.equal(restored._windNudgeSpinupSeconds, source._windNudgeSpinupSeconds);

  assertFloatArrayClose(restored.fields.u, source.fields.u);
  assertFloatArrayClose(restored.fields.v, source.fields.v);
  assertFloatArrayClose(restored.fields.uU, source.fields.uU);
  assertFloatArrayClose(restored.fields.vU, source.fields.vU);
  assertFloatArrayClose(restored.fields.ps, source.fields.ps);

  source.advanceModelSeconds(60);
  restored.advanceModelSeconds(60);

  assert.equal(restored.timeUTC, source.timeUTC);
  assert.equal(restored._accum, source._accum);
  assert.equal(restored._dynStepIndex, source._dynStepIndex);
  assertFloatArrayClose(restored.fields.u, source.fields.u);
  assertFloatArrayClose(restored.fields.v, source.fields.v);
  assertFloatArrayClose(restored.fields.ps, source.fields.ps);
});
