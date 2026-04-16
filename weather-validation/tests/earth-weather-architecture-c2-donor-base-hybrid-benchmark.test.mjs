import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateMetricRows,
  evaluateGate,
  classifyHybridFailure,
  renderArchitectureC2Markdown
} from '../../scripts/agent/earth-weather-architecture-c2-donor-base-hybrid-benchmark.mjs';

test('evaluateMetricRows marks hybrid improvements relative to the trusted target', () => {
  const rows = evaluateMetricRows({
    offMetrics: {
      itczWidthDeg: 25.9,
      subtropicalDryNorthRatio: 1.53,
      subtropicalDrySouthRatio: 1.2,
      midlatitudeWesterliesNorthU10Ms: 0.53,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14,
      crossEquatorialVaporFluxNorthKgM_1S: 320
    },
    onMetrics: {
      itczWidthDeg: 24.8,
      subtropicalDryNorthRatio: 1.28,
      subtropicalDrySouthRatio: 1.05,
      midlatitudeWesterliesNorthU10Ms: 0.84,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13,
      crossEquatorialVaporFluxNorthKgM_1S: 200
    },
    targetMetrics: {
      itczWidthDeg: 23.6,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.52,
      midlatitudeWesterliesNorthU10Ms: 1.19,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.12
    }
  });
  assert.equal(rows.find((row) => row.key === 'itczWidthDeg').improved, true);
  assert.equal(rows.find((row) => row.key === 'midlatitudeWesterliesNorthU10Ms').improved, true);
  assert.equal(rows.find((row) => row.key === 'crossEquatorialVaporFluxNorthKgM_1S').improved, true);
});

test('evaluateGate requires enough improvements and no severe regressions for C2', () => {
  const gate = evaluateGate([
    { improved: true, severeRegression: false },
    { improved: true, severeRegression: false },
    { improved: true, severeRegression: false },
    { improved: true, severeRegression: false },
    { improved: false, severeRegression: false },
    { improved: false, severeRegression: false }
  ], 4);
  assert.equal(gate.pass, true);
});

test('classifyHybridFailure distinguishes missing dependencies and core APIs', () => {
  assert.equal(
    classifyHybridFailure('TypeError: core.getCloudTransitionLedgerRaw is not a function', [], ''),
    'integration_blocked_missing_core_api'
  );
  assert.equal(
    classifyHybridFailure('', [], 'Error [ERR_MODULE_NOT_FOUND]: Cannot find module'),
    'integration_blocked_missing_dependency'
  );
});

test('renderArchitectureC2Markdown includes decision and overlay bundle', () => {
  const markdown = renderArchitectureC2Markdown({
    decision: { verdict: 'quick_reject', nextMove: 'Architecture C3' },
    quickRows: null,
    quickGate: null,
    currentQuickPath: '/tmp/current.json',
    hybridQuickPath: null,
    missingCoreMethods: ['getCloudTransitionLedgerRaw'],
    overlayFiles: ['src/weather/v2/microphysics5.js'],
    failure: {
      classification: 'integration_blocked_missing_core_api',
      stderr: 'TypeError: core.getCloudTransitionLedgerRaw is not a function'
    }
  });
  assert.match(markdown, /Architecture C2 Donor-Base Hybrid Worktree Benchmark/);
  assert.match(markdown, /integration_blocked_missing_core_api/);
  assert.match(markdown, /src\/weather\/v2\/microphysics5\.js/);
});
