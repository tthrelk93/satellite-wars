import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as u4Test } from '../../scripts/agent/prevertical-reduced-order-experiments.mjs';

test('summarizeReproduction computes reproduction fractions against the frozen reference', () => {
  const summary = u4Test.summarizeReproduction({
    name: 'columnNoTransport',
    snapshot: {
      targetCellUpperCloudMassKgM2: 2.8,
      corridorUpperCloudMassKgM2: 5.6,
      notes: []
    },
    referenceExcess: {
      target: 4,
      corridor: 8
    }
  });

  assert.equal(summary.targetReproductionFrac, 0.7);
  assert.equal(summary.corridorReproductionFrac, 0.7);
});

test('classifyReducedOrderOutcome prefers the local-retention conclusion when column survives and advection-only fails', () => {
  const result = u4Test.classifyReducedOrderOutcome({
    column: { targetReproductionFrac: 0.88 },
    curtain: { targetReproductionFrac: 0.79 },
    advectionOnly: { targetReproductionFrac: 0.05 }
  });

  assert.equal(result.decision, 'retention-local-maintenance-without-full-globe');
  assert.ok(result.ruledOut.some((line) => line.includes('transport alone is insufficient')));
});

test('classifyReducedOrderOutcome stays cautious when reduced-order experiments do not reproduce enough', () => {
  const result = u4Test.classifyReducedOrderOutcome({
    column: { targetReproductionFrac: 0.31 },
    curtain: { targetReproductionFrac: 0.44 },
    advectionOnly: { targetReproductionFrac: 0.33 }
  });

  assert.equal(result.decision, 'requires-full-globe');
  assert.ok(result.ambiguous.length >= 2);
});
