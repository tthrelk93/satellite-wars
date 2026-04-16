import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateMetricRows,
  evaluateGate,
  rankCandidateResults,
  renderArchitectureB1Markdown
} from '../../scripts/agent/earth-weather-architecture-b1-circulation-scaffold.mjs';

test('evaluateMetricRows marks target-relative improvements for Architecture B1 candidates', () => {
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

test('rankCandidateResults prefers passing and non-regressing B1 candidates', () => {
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

test('renderArchitectureB1Markdown includes selected candidate and decision', () => {
  const markdown = renderArchitectureB1Markdown({
    quickCandidates: [
      {
        mode: 'narrow-band-light-drying',
        label: 'Narrow Band + Light Drying',
        description: 'desc',
        gate: { improvedCount: 3, severeRegressions: [], pass: false },
        rows: [{ label: 'ITCZ width', off: 25, on: 24, improved: true, severeRegression: false }],
        distanceGain: 0.25
      }
    ],
    selectedCandidate: {
      mode: 'narrow-band-light-drying',
      label: 'Narrow Band + Light Drying',
      gate: { pass: false }
    },
    annualRows: null,
    annualGate: null,
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Move to Architecture B2.'
    }
  });

  assert.match(markdown, /Narrow Band \+ Light Drying/);
  assert.match(markdown, /quick_reject/);
  assert.match(markdown, /Architecture B2/);
});
