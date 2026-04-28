import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSimAdvanceByTruthBudget,
  computeFixedStepBudget
} from '../../src/weather/simAdvanceBudget.js';

test('clampSimAdvanceByTruthBudget leaves requested advance untouched when there is no active lead reading', () => {
  assert.equal(clampSimAdvanceByTruthBudget(7200, null, 12 * 3600), 7200);
  assert.equal(clampSimAdvanceByTruthBudget(7200, Number.NaN, 12 * 3600), 7200);
});

test('clampSimAdvanceByTruthBudget limits queued advance to the remaining truth-worker budget', () => {
  assert.equal(clampSimAdvanceByTruthBudget(86400, 9 * 3600, 12 * 3600), 3 * 3600);
});

test('clampSimAdvanceByTruthBudget blocks new advance when the truth-worker lead already exceeds budget', () => {
  assert.equal(clampSimAdvanceByTruthBudget(600, 12 * 3600, 12 * 3600), 0);
  assert.equal(clampSimAdvanceByTruthBudget(600, 15 * 3600, 12 * 3600), 0);
});

test('computeFixedStepBudget snaps near-threshold accumulated time into a fixed sim step', () => {
  assert.deepEqual(computeFixedStepBudget(119.99999995, 120, 4, 1e-4), {
    stepsAvailable: 1,
    stepsToRun: 1,
    stepsSkipped: 0,
    deltaSimSeconds: 120,
    remainingSeconds: 0
  });
});

test('computeFixedStepBudget preserves backlog after the per-frame step cap', () => {
  assert.deepEqual(computeFixedStepBudget(1260, 120, 4, 1e-4), {
    stepsAvailable: 10,
    stepsToRun: 4,
    stepsSkipped: 6,
    deltaSimSeconds: 480,
    remainingSeconds: 780
  });
});
