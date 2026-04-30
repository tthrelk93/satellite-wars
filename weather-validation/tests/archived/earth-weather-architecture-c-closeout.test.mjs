import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyArchitectureCCloseout,
  renderArchitectureCCloseoutMarkdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c-closeout.mjs';

test('classifyArchitectureCCloseout closes Architecture C around C62', () => {
  const decision = classifyArchitectureCCloseout({
    candidates: [
      {
        id: 'C62',
        quickVerdict: 'quick_reject',
        metrics: { crossEquatorialVaporFluxNorthKgM_1S: -318.32449 }
      },
      {
        id: 'C66',
        quickVerdict: 'quick_reject',
        metrics: { crossEquatorialVaporFluxNorthKgM_1S: -356.31833 }
      },
      {
        id: 'C68',
        quickVerdict: 'quick_reject',
        metrics: { crossEquatorialVaporFluxNorthKgM_1S: -357.91328 }
      },
      {
        id: 'C70',
        quickVerdict: 'quick_reject',
        metrics: { crossEquatorialVaporFluxNorthKgM_1S: -348.97338 }
      }
    ]
  });

  assert.equal(decision.verdict, 'architecture_c_exhausted_best_reference_c62');
  assert.equal(decision.architectureExhausted, true);
  assert.equal(decision.bestReferenceCandidate, 'C62');
  assert.equal(decision.doNotContinue, 'C71+');
  assert.equal(decision.nextMove, 'Architecture D1: signed transport-budget decomposition design');
});

test('renderArchitectureCCloseoutMarkdown explicitly stops C71 plus and starts Architecture D', () => {
  const markdown = renderArchitectureCCloseoutMarkdown({
    baseline: {
      itczWidthDeg: 25.91,
      subtropicalDryNorthRatio: 1.534,
      subtropicalDrySouthRatio: 1.199,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413,
      crossEquatorialVaporFluxNorthKgM_1S: 143.95306
    },
    candidates: [
      {
        id: 'C62',
        quickVerdict: 'quick_reject',
        reportPath: '/tmp/c62.md',
        signal: 'Best retained late-C reference candidate.',
        metrics: {
          itczWidthDeg: 23.386,
          subtropicalDryNorthRatio: 1.057,
          subtropicalDrySouthRatio: 0.487,
          midlatitudeWesterliesNorthU10Ms: 1.214,
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13629,
          crossEquatorialVaporFluxNorthKgM_1S: -318.32449
        }
      }
    ],
    decision: {
      verdict: 'architecture_c_exhausted_best_reference_c62',
      architectureExhausted: true,
      bestReferenceCandidate: 'C62',
      doNotContinue: 'C71+',
      nextArchitecture: 'Architecture D: core transport-sign rebuild',
      nextMove: 'Architecture D1: signed transport-budget decomposition design',
      reasons: [
        'All four meaningful late Architecture C candidates remain quick rejects.'
      ]
    }
  });

  assert.match(markdown, /Earth Weather Architecture C Closeout/);
  assert.match(markdown, /do not continue: `C71\+`/);
  assert.match(markdown, /Architecture D: core transport-sign rebuild/);
  assert.match(markdown, /signed transport-budget decomposition design/);
});
