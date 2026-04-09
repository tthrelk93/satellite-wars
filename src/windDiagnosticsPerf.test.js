import test from 'node:test';
import assert from 'node:assert/strict';

import { createWindDiagnosticsPerfPayload, measureWindDiagnosticsPhase } from './windDiagnosticsPerf.js';

test('createWindDiagnosticsPerfPayload seeds due flags and empty phase metrics', () => {
  const payload = createWindDiagnosticsPerfPayload({
    modelDue: true,
    referenceDue: false,
    vizDue: true,
    windStreamlinesVisible: true
  });

  assert.deepEqual(payload.due, { model: true, reference: false, viz: true });
  assert.equal(payload.windStreamlinesVisible, true);
  assert.deepEqual(payload.phases.model, { ms: null, updated: false });
  assert.deepEqual(payload.phases.targets, { ms: null, updated: false });
  assert.equal(payload.anyUpdated, false);
});

test('measureWindDiagnosticsPhase records phase timing and updated state', () => {
  const payload = createWindDiagnosticsPerfPayload({});
  const marks = [5, 8];
  let index = 0;
  const nowFn = () => marks[index++];

  const updated = measureWindDiagnosticsPhase(payload, 'model', () => true, nowFn);

  assert.equal(updated, true);
  assert.deepEqual(payload.phases.model, { ms: 3, updated: true });
  assert.equal(payload.anyUpdated, true);
});

test('measureWindDiagnosticsPhase records non-updating phases without flipping anyUpdated', () => {
  const payload = createWindDiagnosticsPerfPayload({});
  const marks = [10, 11.5];
  let index = 0;
  const nowFn = () => marks[index++];

  const updated = measureWindDiagnosticsPhase(payload, 'referenceComparison', () => false, nowFn);

  assert.equal(updated, false);
  assert.deepEqual(payload.phases.referenceComparison, { ms: 1.5, updated: false });
  assert.equal(payload.anyUpdated, false);
});
