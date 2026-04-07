import test from 'node:test';
import assert from 'node:assert/strict';
import { takeBoundedAccumulatedStep } from '../../src/weather/workerStepBudget.js';

test('takeBoundedAccumulatedStep caps oversized worker catch-up requests', () => {
  assert.deepEqual(takeBoundedAccumulatedStep(3 * 86400, 6 * 3600), {
    stepSeconds: 6 * 3600,
    remainingSeconds: 66 * 3600
  });
});

test('takeBoundedAccumulatedStep passes through small requests unchanged', () => {
  assert.deepEqual(takeBoundedAccumulatedStep(5400, 6 * 3600), {
    stepSeconds: 5400,
    remainingSeconds: 0
  });
});

test('takeBoundedAccumulatedStep rejects non-positive backlog', () => {
  assert.deepEqual(takeBoundedAccumulatedStep(0, 6 * 3600), {
    stepSeconds: 0,
    remainingSeconds: 0
  });
  assert.deepEqual(takeBoundedAccumulatedStep(-10, 6 * 3600), {
    stepSeconds: 0,
    remainingSeconds: 0
  });
});
