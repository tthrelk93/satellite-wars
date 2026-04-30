import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCycleScopedOutputBase,
  classifyC8Decision,
  renderArchitectureC8Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.mjs';

test('buildCycleScopedOutputBase nests artifacts inside the cycle directory', () => {
  const outputBase = buildCycleScopedOutputBase(
    '/tmp/cycle-2026-04-15-architecture-c8',
    'earth-weather-architecture-c8-bridged-hybrid-quick'
  );

  assert.equal(
    outputBase,
    '/tmp/cycle-2026-04-15-architecture-c8/earth-weather-architecture-c8-bridged-hybrid-quick'
  );
});

test('classifyC8Decision recognizes restored cycle contracts', () => {
  const decision = classifyC8Decision({
    exitCode: 0,
    summaryExists: true,
    stderr: '',
    stdout: ''
  });

  assert.equal(decision.verdict, 'cycle_contract_restored');
  assert.equal(decision.nextMove, 'Architecture C9: cycled hybrid benchmark rerun');
});

test('classifyC8Decision recognizes persistent plan-guard failures', () => {
  const decision = classifyC8Decision({
    exitCode: 1,
    summaryExists: false,
    stderr: 'Error: [agent plan guard] missing plan',
    stdout: ''
  });

  assert.equal(decision.verdict, 'cycle_contract_repair_failed');
  assert.equal(decision.nextMove, 'Architecture C9: donor-worktree cycle attribution');
});

test('renderArchitectureC8Markdown includes cycle and run context', () => {
  const markdown = renderArchitectureC8Markdown({
    decision: {
      verdict: 'cycle_contract_restored',
      nextMove: 'Architecture C9: cycled hybrid benchmark rerun'
    },
    bridgeSummary: {
      bridgedFiles: ['src/weather/v2/core5.js'],
      rewrittenImportCount: 4
    },
    cycleContract: {
      cycleId: 'cycle-2026-04-15-architecture-c8',
      cycleDir: '/tmp/cycle-2026-04-15-architecture-c8',
      planPath: '/tmp/cycle-2026-04-15-architecture-c8/plan.md',
      cycleStatePath: '/tmp/cycle-2026-04-15-architecture-c8/cycle-state.json',
      mode: 'quick'
    },
    quickArtifactPath: '/tmp/quick.json',
    runContext: {
      exitCode: 0,
      summaryExists: true,
      stdoutSnippet: '',
      stderrSnippet: ''
    }
  });

  assert.match(markdown, /Architecture C8 Donor-Worktree Cycle Contract Repair/);
  assert.match(markdown, /cycle id: `cycle-2026-04-15-architecture-c8`/);
  assert.match(markdown, /quick summary exists: true/);
});
