import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as u2Test } from '../../scripts/agent/prevertical-provenance-ownership.mjs';

test('classifyInterpolatedContribution reclassifies off-cell source mass as current-step advected', () => {
  const classified = u2Test.classifyInterpolatedContribution({
    destinationCellIndex: 9,
    totalAfter: 1,
    sources: [
      {
        sourceCellIndex: 9,
        weight: 0.25,
        previousStepResidualUpperCloud: 0.4,
        currentStepAdvectedUpperCloud: 0,
        currentStepLocalUpperCloud: 0,
        reprocessedUpperCloud: 0.1
      },
      {
        sourceCellIndex: 8,
        weight: 0.75,
        previousStepResidualUpperCloud: 0.6,
        currentStepAdvectedUpperCloud: 0,
        currentStepLocalUpperCloud: 0,
        reprocessedUpperCloud: 0.2
      }
    ]
  });

  assert.ok(Math.abs(classified.previousStepResidualUpperCloud - 0.13793103) < 1e-8);
  assert.ok(Math.abs(classified.reprocessedUpperCloud - 0.03448276) < 1e-8);
  assert.ok(Math.abs(classified.currentStepAdvectedUpperCloud - 0.82758621) < 1e-8);
  assert.equal(classified.currentStepLocalUpperCloud, 0);
});

test('buildOwnershipExcess subtracts historical provenance bucket by bucket', () => {
  const excess = u2Test.buildOwnershipExcess({
    currentSnapshot: {
      targetCell: {
        provenanceKgM2: {
          previousStepResidualUpperCloud: 3,
          currentStepAdvectedUpperCloud: 0.4,
          currentStepLocalUpperCloud: 0,
          reprocessedUpperCloud: 0.2
        }
      },
      corridorBand: {
        provenanceKgM2: {
          previousStepResidualUpperCloud: 6,
          currentStepAdvectedUpperCloud: 1,
          currentStepLocalUpperCloud: 0,
          reprocessedUpperCloud: 0.5
        }
      }
    },
    historicalSnapshot: {
      targetCell: {
        provenanceKgM2: {
          previousStepResidualUpperCloud: 0.2,
          currentStepAdvectedUpperCloud: 0,
          currentStepLocalUpperCloud: 0,
          reprocessedUpperCloud: 0
        }
      },
      corridorBand: {
        provenanceKgM2: {
          previousStepResidualUpperCloud: 0.5,
          currentStepAdvectedUpperCloud: 0.1,
          currentStepLocalUpperCloud: 0,
          reprocessedUpperCloud: 0
        }
      }
    }
  });

  assert.equal(excess.targetCell.previousStepResidualUpperCloud, 2.8);
  assert.equal(excess.targetCell.currentStepAdvectedUpperCloud, 0.4);
  assert.equal(excess.corridorBand.reprocessedUpperCloud, 0.5);
});

test('rankPrimaryOwner returns the largest provenance family', () => {
  const owner = u2Test.rankPrimaryOwner({
    previousStepResidualUpperCloud: 5.1,
    currentStepAdvectedUpperCloud: 0.7,
    currentStepLocalUpperCloud: 0,
    reprocessedUpperCloud: 1.3
  });

  assert.equal(owner.key, 'previousStepResidualUpperCloud');
  assert.equal(owner.value, 5.1);
});
