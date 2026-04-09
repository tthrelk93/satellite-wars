import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProbeProgress,
  deriveProbeProgressPath,
  updateProbeProgress
} from '../../scripts/agent/orographic-probe-progress.mjs';

test('deriveProbeProgressPath appends a partial artifact suffix', () => {
  assert.equal(
    deriveProbeProgressPath('/tmp/probe.json'),
    '/tmp/probe.partial.json'
  );
  assert.equal(
    deriveProbeProgressPath('/tmp/probe-artifact'),
    '/tmp/probe-artifact.partial.json'
  );
  assert.equal(deriveProbeProgressPath(null), null);
});

test('updateProbeProgress records the latest probe state and caps the timeline', () => {
  let progress = createProbeProgress({
    targetSeconds: 105480,
    resetMode: 'zero',
    pageTargetId: 'tab-1',
    outPath: '/tmp/probe.json',
    screenshotPath: '/tmp/probe.png'
  });

  for (let i = 0; i < 30; i += 1) {
    progress = updateProbeProgress(progress, {
      phase: 'wait-for-sim-parity',
      probeState: { simTimeSeconds: i * 120 },
      note: `tick-${i}`,
      extra: { iteration: i }
    });
  }

  assert.equal(progress.status, 'running');
  assert.equal(progress.phase, 'wait-for-sim-parity');
  assert.deepEqual(progress.lastProbeState, { simTimeSeconds: 29 * 120 });
  assert.equal(progress.timeline.length, 25);
  assert.equal(progress.timeline[0].iteration, 5);
  assert.equal(progress.timeline.at(-1).iteration, 29);

  progress = updateProbeProgress(progress, {
    status: 'failed',
    phase: 'error',
    error: new Error('Timed out waiting for sim parity')
  });

  assert.equal(progress.status, 'failed');
  assert.equal(progress.phase, 'error');
  assert.equal(progress.error.message, 'Timed out waiting for sim parity');
});
