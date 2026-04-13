import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as nextBoundaryTest } from '../../scripts/agent/phase1b-next-boundary-ownership-proof.mjs';

test('buildVerdict passes when target and corridor next-boundary reservoirs both shrink materially', () => {
  const verdict = nextBoundaryTest.buildVerdict({
    materialThreshold: 0.05,
    baseline: {
      handoff: {
        targetCell: { carrySurvivingKgM2: 3.5 },
        corridorBand: { carrySurvivingKgM2: 8.5 }
      },
      nextBoundary: {
        targetCell: { ownedPreviousStepResidualUpperCloudKgM2: 3.0 },
        corridorBand: { ownedPreviousStepResidualUpperCloudKgM2: 7.2 }
      }
    },
    candidate: {
      handoff: {
        targetCell: { carrySurvivingKgM2: 1.0 },
        corridorBand: { carrySurvivingKgM2: 4.0 }
      },
      nextBoundary: {
        targetCell: { ownedPreviousStepResidualUpperCloudKgM2: 1.4 },
        corridorBand: { ownedPreviousStepResidualUpperCloudKgM2: 4.5 }
      }
    }
  });

  assert.equal(verdict.pass, true);
  assert.equal(verdict.targetNextBoundaryReductionKgM2, 1.6);
  assert.equal(verdict.corridorNextBoundaryReductionKgM2, 2.7);
  assert.equal(verdict.targetReductionSurvivalFrac, 0.64);
});

test('buildVerdict fails when handoff improvement does not materially survive to the next boundary', () => {
  const verdict = nextBoundaryTest.buildVerdict({
    materialThreshold: 0.05,
    baseline: {
      handoff: {
        targetCell: { carrySurvivingKgM2: 3.5 },
        corridorBand: { carrySurvivingKgM2: 8.5 }
      },
      nextBoundary: {
        targetCell: { ownedPreviousStepResidualUpperCloudKgM2: 3.0 },
        corridorBand: { ownedPreviousStepResidualUpperCloudKgM2: 7.2 }
      }
    },
    candidate: {
      handoff: {
        targetCell: { carrySurvivingKgM2: 1.0 },
        corridorBand: { carrySurvivingKgM2: 4.0 }
      },
      nextBoundary: {
        targetCell: { ownedPreviousStepResidualUpperCloudKgM2: 2.98 },
        corridorBand: { ownedPreviousStepResidualUpperCloudKgM2: 7.18 }
      }
    }
  });

  assert.equal(verdict.pass, false);
  assert.ok(verdict.explanation.includes('does not yet produce a material reduction'));
});
