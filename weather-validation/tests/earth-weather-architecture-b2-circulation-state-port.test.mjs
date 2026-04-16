import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateMetricRows,
  evaluateGate,
  rankCandidateResults,
  renderArchitectureB2Markdown
} from '../../scripts/agent/earth-weather-architecture-b2-circulation-state-port.mjs';

test('evaluateMetricRows marks target-relative improvements for Architecture B2 candidates', () => {
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
    subtropicalDryNorthRatio: 1.25,
    subtropicalDrySouthRatio: 0.78,
    midlatitudeWesterliesNorthU10Ms: 0.9,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.2,
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

test('evaluateGate requires enough improvements and no severe regressions', () => {
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

test('rankCandidateResults prefers passing and non-regressing B2 candidates', () => {
  const ranked = rankCandidateResults([
    {
      mode: 'variant-a',
      gate: { pass: false, improvedCount: 4, severeRegressions: ['x'] },
      distanceGain: 1.2
    },
    {
      mode: 'variant-b',
      gate: { pass: false, improvedCount: 3, severeRegressions: [] },
      distanceGain: 0.8
    },
    {
      mode: 'variant-c',
      gate: { pass: true, improvedCount: 4, severeRegressions: [] },
      distanceGain: 0.4
    }
  ]);

  assert.equal(ranked[0].mode, 'variant-c');
  assert.equal(ranked[1].mode, 'variant-b');
});

test('renderArchitectureB2Markdown includes selected candidate and decision', () => {
  const markdown = renderArchitectureB2Markdown({
    quickCandidates: [
      {
        mode: 'soft-containment-omega-port',
        label: 'Soft Containment + Omega Port',
        description: 'desc',
        gate: { improvedCount: 2, severeRegressions: [], pass: false },
        rows: [{ label: 'ITCZ width', off: 25, on: 24, improved: true, severeRegression: false }],
        distanceGain: 0.25,
        circulationSummary: {
          northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06,
          northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.02,
          northDryBeltCirculationReturnFlowOpportunityMeanFrac: 0.001,
          northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0,
          northTransitionCirculationReboundContainmentMeanFrac: 0.7
        }
      }
    ],
    selectedCandidate: {
      mode: 'soft-containment-omega-port',
      label: 'Soft Containment + Omega Port',
      gate: { pass: false }
    },
    annualRows: null,
    annualGate: null,
    offQuickSummary: {
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.05,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01,
      northDryBeltCirculationReturnFlowOpportunityMeanFrac: 0,
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0,
      northTransitionCirculationReboundContainmentMeanFrac: 0
    },
    selectedQuickSummary: {
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.02,
      northDryBeltCirculationReturnFlowOpportunityMeanFrac: 0.001,
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0,
      northTransitionCirculationReboundContainmentMeanFrac: 0.7
    },
    annualSummaries: null,
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Move to Architecture B3.'
    }
  });

  assert.match(markdown, /Soft Containment \+ Omega Port/);
  assert.match(markdown, /quick_reject/);
  assert.match(markdown, /Architecture B3/);
});
