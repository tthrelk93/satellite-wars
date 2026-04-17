import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC9Decision,
  renderArchitectureC9Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.mjs';

test('classifyC9Decision recognizes restored runtime fixture contracts', () => {
  const decision = classifyC9Decision({
    exitCode: 0,
    summaryExists: true,
    stderr: '',
    stdout: ''
  });

  assert.equal(decision.verdict, 'runtime_fixture_contract_restored');
  assert.equal(decision.nextMove, 'Architecture C10: cycled hybrid benchmark rerun');
});

test('classifyC9Decision recognizes remaining fixture ENOENT failures', () => {
  const decision = classifyC9Decision({
    exitCode: 1,
    summaryExists: false,
    stderr: 'Error: ENOENT ... scripts/agent/fixtures/headless-terrain-180x90.json',
    stdout: ''
  });

  assert.equal(decision.verdict, 'runtime_fixture_contract_incomplete');
  assert.equal(decision.nextMove, 'Architecture C10: donor-worktree runtime dependency attribution');
});

test('renderArchitectureC9Markdown includes rerun facts', () => {
  const markdown = renderArchitectureC9Markdown({
    decision: {
      verdict: 'runtime_fixture_contract_restored',
      nextMove: 'Architecture C10: cycled hybrid benchmark rerun'
    },
    bridgeSummary: {
      bridgedFiles: ['src/weather/v2/core5.js'],
      rewrittenImportCount: 4
    },
    cycleContract: {
      cycleId: 'cycle-2026-04-16-architecture-c9'
    },
    quickArtifactPath: '/tmp/quick.json',
    runContext: {
      exitCode: 0,
      summaryExists: true,
      stdoutSnippet: '',
      stderrSnippet: ''
    }
  });

  assert.match(markdown, /Architecture C9 Donor-Worktree Runtime Fixture Repair/);
  assert.match(markdown, /fixture overlay restored/);
  assert.match(markdown, /summary exists: true/);
});
