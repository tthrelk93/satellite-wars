import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as u3Test } from '../../scripts/agent/prevertical-supply-vs-retention-counterfactuals.mjs';

test('summarizeScenario computes excess and reduction against the frozen baseline', () => {
  const summary = u3Test.summarizeScenario({
    name: 'retentionOffCorridorLocal',
    snapshot: {
      targetCellUpperCloudMassKgM2: 1.2,
      corridorUpperCloudMassKgM2: 3.4
    },
    historicalBaseline: {
      targetCellUpperCloudMassKgM2: 0.2,
      corridorUpperCloudMassKgM2: 1.4
    },
    currentBaseline: {
      targetExcessKgM2: 2,
      corridorExcessKgM2: 4
    }
  });

  assert.equal(summary.targetExcessKgM2, 1);
  assert.equal(summary.corridorExcessKgM2, 2);
  assert.equal(summary.targetReductionFrac, 0.5);
  assert.equal(summary.corridorReductionFrac, 0.5);
  assert.equal(summary.targetReproductionFrac, 0.5);
});

test('classifyOutcome returns retention-dominant when retention clears the excess and advection does not', () => {
  const result = u3Test.classifyOutcome({
    retentionOff: { targetReductionFrac: 0.82 },
    advectionOff: { targetReductionFrac: 0.12 },
    carryoverOnly: { targetReproductionFrac: 0.88 },
    advectionOnly: { targetReproductionFrac: 0.19 }
  });

  assert.equal(result.decision, 'retention-dominant');
  assert.ok(result.ruledIn.some((line) => line.includes('Current upper-cloud carryover is sufficient')));
});

test('classifyOutcome returns coupled when both retention and advection materially matter', () => {
  const result = u3Test.classifyOutcome({
    retentionOff: { targetReductionFrac: 0.54 },
    advectionOff: { targetReductionFrac: 0.47 },
    carryoverOnly: { targetReproductionFrac: 0.51 },
    advectionOnly: { targetReproductionFrac: 0.44 }
  });

  assert.equal(result.decision, 'coupled');
  assert.ok(result.ruledIn.some((line) => line.includes('Both the inherited reservoir and current-step advection')));
});
