import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderArchitectureC5Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.mjs';

test('renderArchitectureC5Markdown includes bridge summary and rerun decision', () => {
  const markdown = renderArchitectureC5Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C6: bridged hybrid attribution design'
    },
    bridgeSummary: {
      bridgedFiles: ['src/weather/v2/core5.js', 'src/weather/v2/grid.js'],
      rewrittenImportCount: 5,
      missingCoreMethodsAfterBridge: []
    },
    quickRows: [
      {
        key: 'itczWidthDeg',
        label: 'ITCZ width',
        off: 25.91,
        on: 25.8,
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
    failure: null
  });

  assert.match(markdown, /Architecture C5 Bridged Hybrid Rerun Benchmark/);
  assert.match(markdown, /bridged file count: 2/);
  assert.match(markdown, /Architecture C6: bridged hybrid attribution design/);
  assert.match(markdown, /ITCZ width/);
});
