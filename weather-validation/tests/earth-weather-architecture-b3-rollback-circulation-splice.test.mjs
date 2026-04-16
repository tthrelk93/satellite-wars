import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateMetricRows,
  evaluateGate,
  rankCandidateResults,
  renderArchitectureB3Markdown
} from '../../scripts/agent/earth-weather-architecture-b3-rollback-circulation-splice.mjs';

test('evaluateMetricRows marks target-relative improvements for Architecture B3 candidates', () => {
  const rows = evaluateMetricRows({
    offMetrics: {
      itczWidthDeg: 26.2,
      subtropicalDryNorthRatio: 1.55,
      subtropicalDrySouthRatio: 1.21,
      midlatitudeWesterliesNorthU10Ms: 0.53,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.17,
      crossEquatorialVaporFluxNorthKgM_1S: 320
    },
    onMetrics: {
      itczWidthDeg: 25.2,
      subtropicalDryNorthRatio: 1.28,
      subtropicalDrySouthRatio: 1.03,
      midlatitudeWesterliesNorthU10Ms: 0.93,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.15,
      crossEquatorialVaporFluxNorthKgM_1S: 180
    },
    targetMetrics: {
      itczWidthDeg: 23.8,
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

test('evaluateGate requires enough improvements and no severe regressions for Architecture B3', () => {
  const failingGate = evaluateGate([
    { key: 'itczWidthDeg', improved: false, severeRegression: true },
    { key: 'subtropicalDryNorthRatio', improved: true, severeRegression: false },
    { key: 'subtropicalDrySouthRatio', improved: true, severeRegression: false },
    { key: 'midlatitudeWesterliesNorthU10Ms', improved: true, severeRegression: false },
    { key: 'northDryBeltOceanLargeScaleCondensationMeanKgM2', improved: true, severeRegression: false },
    { key: 'crossEquatorialVaporFluxNorthKgM_1S', improved: false, severeRegression: false }
  ], 4);
  assert.equal(failingGate.pass, false);
  assert.deepEqual(failingGate.severeRegressions, ['itczWidthDeg']);

  const passingGate = evaluateGate([
    { key: 'itczWidthDeg', improved: true, severeRegression: false },
    { key: 'subtropicalDryNorthRatio', improved: true, severeRegression: false },
    { key: 'subtropicalDrySouthRatio', improved: true, severeRegression: false },
    { key: 'midlatitudeWesterliesNorthU10Ms', improved: true, severeRegression: false },
    { key: 'northDryBeltOceanLargeScaleCondensationMeanKgM2', improved: false, severeRegression: false },
    { key: 'crossEquatorialVaporFluxNorthKgM_1S', improved: false, severeRegression: false }
  ], 4);
  assert.equal(passingGate.pass, true);
});

test('rankCandidateResults prefers passing and non-regressing B3 candidates', () => {
  const ranked = rankCandidateResults([
    {
      mode: 'port-a',
      gate: { pass: false, severeRegressions: ['itczWidthDeg'], improvedCount: 3 },
      distanceGain: 2
    },
    {
      mode: 'port-b',
      gate: { pass: true, severeRegressions: [], improvedCount: 4 },
      distanceGain: -1
    },
    {
      mode: 'port-c',
      gate: { pass: false, severeRegressions: [], improvedCount: 2 },
      distanceGain: 4
    }
  ]);
  assert.deepEqual(ranked.map((candidate) => candidate.mode), ['port-b', 'port-c', 'port-a']);
});

test('renderArchitectureB3Markdown includes selected candidate and decision', () => {
  const markdown = renderArchitectureB3Markdown({
    quickCandidates: [
      {
        mode: 'ported-floor-soft-containment-omega',
        label: 'Ported Floor + Soft Containment + Omega',
        description: 'Test candidate',
        gate: { improvedCount: 4, severeRegressions: [], pass: true },
        rows: [
          { label: 'ITCZ width', off: 26.2, on: 25.4, improved: true, severeRegression: false }
        ],
        distanceGain: 0.8,
        circulationSummary: {
          northTransitionLowLevelOmegaEffectiveMeanPaS: 0.07,
          northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.02,
          northDryBeltCirculationReturnFlowOpportunityMeanFrac: 0.001,
          northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0.002,
          northTransitionCirculationReboundContainmentMeanFrac: 0.45
        }
      }
    ],
    selectedCandidate: {
      mode: 'ported-floor-soft-containment-omega',
      label: 'Ported Floor + Soft Containment + Omega',
      gate: { pass: true }
    },
    annualRows: null,
    annualGate: null,
    offQuickSummary: {
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01,
      northDryBeltCirculationReturnFlowOpportunityMeanFrac: 0,
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0,
      northTransitionCirculationReboundContainmentMeanFrac: 0.8
    },
    selectedQuickSummary: {
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.07,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.02,
      northDryBeltCirculationReturnFlowOpportunityMeanFrac: 0.001,
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0.002,
      northTransitionCirculationReboundContainmentMeanFrac: 0.45
    },
    annualSummaries: null,
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Move to Architecture C.'
    }
  });

  assert.match(markdown, /Architecture B3 Rollback Circulation Splice/);
  assert.match(markdown, /ported-floor-soft-containment-omega/);
  assert.match(markdown, /Move to Architecture C/);
});
