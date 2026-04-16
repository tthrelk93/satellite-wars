import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateMetricRows,
  evaluateGate,
  renderArchitectureA1Markdown
} from '../../scripts/agent/earth-weather-architecture-a1-balance-contract.mjs';

test('evaluateMetricRows marks improvement relative to the trusted target', () => {
  const offMetrics = {
    itczWidthDeg: 25.2,
    subtropicalDryNorthRatio: 1.4,
    subtropicalDrySouthRatio: 1.0,
    midlatitudeWesterliesNorthU10Ms: 0.5,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.25,
    crossEquatorialVaporFluxNorthKgM_1S: 300
  };
  const onMetrics = {
    itczWidthDeg: 24.7,
    subtropicalDryNorthRatio: 1.2,
    subtropicalDrySouthRatio: 0.8,
    midlatitudeWesterliesNorthU10Ms: 0.9,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.19,
    crossEquatorialVaporFluxNorthKgM_1S: 180
  };
  const targetMetrics = {
    itczWidthDeg: 23.646,
    subtropicalDryNorthRatio: 1.1,
    subtropicalDrySouthRatio: 0.519,
    midlatitudeWesterliesNorthU10Ms: 1.192,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14
  };

  const rows = evaluateMetricRows({ offMetrics, onMetrics, targetMetrics, severeTolerance: 0.05 });

  assert.equal(rows.filter((row) => row.improved).length >= 4, true);
  assert.equal(rows.find((row) => row.key === 'crossEquatorialVaporFluxNorthKgM_1S').improved, true);
});

test('evaluateGate passes only when enough metrics improve without severe regressions', () => {
  const pass = evaluateGate([
    { improved: true, severeRegression: false, key: 'a' },
    { improved: true, severeRegression: false, key: 'b' },
    { improved: true, severeRegression: false, key: 'c' },
    { improved: true, severeRegression: false, key: 'd' },
    { improved: false, severeRegression: false, key: 'e' },
    { improved: false, severeRegression: false, key: 'f' }
  ], 4);
  assert.equal(pass.pass, true);

  const fail = evaluateGate([
    { improved: true, severeRegression: false, key: 'a' },
    { improved: true, severeRegression: true, key: 'b' },
    { improved: true, severeRegression: false, key: 'c' },
    { improved: true, severeRegression: false, key: 'd' },
    { improved: false, severeRegression: false, key: 'e' },
    { improved: false, severeRegression: false, key: 'f' }
  ], 4);
  assert.equal(fail.pass, false);
});

test('renderArchitectureA1Markdown includes the final decision', () => {
  const markdown = renderArchitectureA1Markdown({
    quickRows: [{ label: 'ITCZ width', off: 25, on: 24, improved: true, severeRegression: false }],
    quickGate: { improvedCount: 1, severeRegressions: [], pass: false },
    annualRows: null,
    annualGate: null,
    offQuick: {
      northTransitionSubtropicalBalancePartitionSupportMeanFrac: 0.1,
      northTransitionSubtropicalBalanceCirculationSupportMeanFrac: 0.2,
      northTransitionSubtropicalBalanceContractSupportMeanFrac: 0.1,
      northDryBeltSubtropicalBalanceContractSupportMeanFrac: 0.05,
      southTransitionSubtropicalBalanceContractSupportMeanFrac: 0.1,
      southDryBeltSubtropicalBalanceContractSupportMeanFrac: 0.05
    },
    onQuick: {
      northTransitionSubtropicalBalancePartitionSupportMeanFrac: 0.2,
      northTransitionSubtropicalBalanceCirculationSupportMeanFrac: 0.3,
      northTransitionSubtropicalBalanceContractSupportMeanFrac: 0.2,
      northDryBeltSubtropicalBalanceContractSupportMeanFrac: 0.08,
      southTransitionSubtropicalBalanceContractSupportMeanFrac: 0.12,
      southDryBeltSubtropicalBalanceContractSupportMeanFrac: 0.04
    },
    offAnnual: null,
    onAnnual: null,
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Move to Architecture A2.'
    }
  });

  assert.match(markdown, /quick_reject/);
  assert.match(markdown, /Move to Architecture A2/);
});
