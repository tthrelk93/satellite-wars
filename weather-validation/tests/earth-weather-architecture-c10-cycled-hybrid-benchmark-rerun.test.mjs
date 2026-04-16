import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC10Decision,
  renderArchitectureC10Markdown
} from '../../scripts/agent/earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.mjs';

test('classifyC10Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC10Decision({
    quickGatePass: false,
    improvedCount: 4,
    severeRegressions: ['crossEquatorialVaporFluxNorthKgM_1S'],
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C11: cycled hybrid flux inversion attribution');
});

test('classifyC10Decision marks keep candidates when annual gate passes', () => {
  const decision = classifyC10Decision({
    quickGatePass: true,
    improvedCount: 5,
    severeRegressions: [],
    annualGatePass: true
  });

  assert.equal(decision.verdict, 'keep_candidate');
});

test('renderArchitectureC10Markdown includes quick gate context', () => {
  const markdown = renderArchitectureC10Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C11: cycled hybrid flux inversion attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 24.22,
        improved: true,
        severeRegression: false
      }
    ],
    quickGate: {
      improvedCount: 1,
      severeRegressions: ['crossEquatorialVaporFluxNorthKgM_1S'],
      pass: false
    },
    currentQuickPath: '/tmp/current.json',
    hybridQuickPath: '/tmp/hybrid.json',
    hybridAnnualPath: null,
    supportingArtifacts: {
      transportInterfaceBudgetJsonPath: '/tmp/transport.json'
    },
    bridgeSummary: {
      bridgedFiles: ['src/weather/v2/core5.js'],
      rewrittenImportCount: 4
    },
    failure: null
  });

  assert.match(markdown, /Architecture C10 Cycled Hybrid Benchmark Rerun/);
  assert.match(markdown, /quick gate pass: false/);
  assert.match(markdown, /Architecture C11: cycled hybrid flux inversion attribution/);
});
