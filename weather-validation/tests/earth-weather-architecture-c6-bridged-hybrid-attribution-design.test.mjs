import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC6Decision,
  renderArchitectureC6Markdown
} from '../../scripts/agent/earth-weather-architecture-c6-bridged-hybrid-attribution-design.mjs';

test('classifyC6Decision prefers report-base redirect when fallback report exists', () => {
  const decision = classifyC6Decision({
    exitCode: 0,
    expectedSummaryExists: false,
    fallbackReportExists: true,
    stdoutLooksLikeSummary: false,
    cycleViolationExists: false,
    newArtifacts: ['weather-validation/reports/planetary-realism-status.json']
  });

  assert.equal(decision.verdict, 'report_base_redirect_detected');
  assert.equal(decision.nextMove, 'Architecture C7: bridged hybrid artifact contract repair');
});

test('classifyC6Decision recognizes silent no-artifact exit', () => {
  const decision = classifyC6Decision({
    exitCode: 0,
    expectedSummaryExists: false,
    fallbackReportExists: false,
    stdoutLooksLikeSummary: false,
    cycleViolationExists: false,
    newArtifacts: []
  });

  assert.equal(decision.verdict, 'silent_no_artifact_exit');
});

test('renderArchitectureC6Markdown includes the bridged-run facts', () => {
  const markdown = renderArchitectureC6Markdown({
    decision: {
      verdict: 'silent_no_artifact_exit',
      nextMove: 'Architecture C7: bridged hybrid artifact contract repair'
    },
    attribution: {
      exitCode: 0,
      expectedSummaryExists: false,
      fallbackReportExists: false,
      stdoutLooksLikeSummary: false,
      cycleViolationExists: false,
      newArtifacts: [],
      stdoutSnippet: '',
      stderrSnippet: '',
      bridgeSummary: {
        bridgedFiles: ['src/weather/v2/core5.js'],
        rewrittenImportCount: 3,
        missingCoreMethodsAfterBridge: []
      }
    }
  });

  assert.match(markdown, /Architecture C6 Bridged Hybrid Attribution Design/);
  assert.match(markdown, /silent_no_artifact_exit/);
  assert.match(markdown, /rewritten relative import count: 3/);
});
