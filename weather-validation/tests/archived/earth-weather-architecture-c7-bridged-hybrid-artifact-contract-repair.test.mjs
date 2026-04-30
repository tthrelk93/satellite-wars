import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExplicitMainInvocationSource,
  classifyC7Failure,
  renderArchitectureC7Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.mjs';

test('buildExplicitMainInvocationSource uses wrapper argv and explicit main call', () => {
  const source = buildExplicitMainInvocationSource({
    scriptPath: '/tmp/planetary-realism-audit.mjs',
    args: ['--preset', 'quick', '--report-base', '/tmp/out']
  });

  assert.match(source, /codex-architecture-c7-wrapper/);
  assert.match(source, /await import/);
  assert.match(source, /await mod\.main\(\)/);
  assert.match(source, /--report-base/);
});

test('classifyC7Failure recognizes the donor-worktree cycle guard block', () => {
  const decision = classifyC7Failure(
    '',
    'Error: [agent plan guard] agent:planetary-realism-audit requires an active cycle directory with plan.md before it can run.'
  );

  assert.equal(decision.verdict, 'cycle_guard_contract_block');
  assert.equal(decision.nextMove, 'Architecture C8: donor-worktree cycle contract repair');
});

test('renderArchitectureC7Markdown includes repaired benchmark context', () => {
  const markdown = renderArchitectureC7Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C8: bridged hybrid climate attribution design'
    },
    bridgeSummary: {
      bridgedFiles: ['src/weather/v2/core5.js'],
      rewrittenImportCount: 6,
      missingCoreMethodsAfterBridge: []
    },
    quickRows: [
      {
        key: 'itczWidthDeg',
        label: 'ITCZ width',
        off: 25.91,
        on: 25.7,
        improved: true,
        severeRegression: false
      }
    ],
    quickGate: {
      improvedCount: 1,
      severeRegressions: [],
      pass: false
    },
    currentQuickPath: '/tmp/current.json',
    hybridQuickPath: '/tmp/hybrid.json',
    hybridAnnualPath: null,
    runContext: {
      exitCode: 0,
      stdoutSnippet: '',
      stderrSnippet: ''
    },
    failure: null
  });

  assert.match(markdown, /Architecture C7 Bridged Hybrid Artifact Contract Repair/);
  assert.match(markdown, /explicit-main run exit code: 0/);
  assert.match(markdown, /Architecture C8: bridged hybrid climate attribution design/);
});
