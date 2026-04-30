import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as u5Test } from '../../scripts/agent/prevertical-numerical-ownership-check.mjs';

test('determineRetentionDecision prefers retention-dominant when retention clears and carryover reproduces', () => {
  const decision = u5Test.determineRetentionDecision({
    retentionOff: { targetReductionFrac: 0.92 },
    advectionOff: { targetReductionFrac: 0.08 },
    carryoverOnly: { targetReproductionFrac: 0.97 },
    advectionOnly: { targetReproductionFrac: 0.04 }
  });

  assert.equal(decision, 'retention-dominant');
});

test('buildCrossVariantAssessment passes only when owner, boundary, and decision are stable', () => {
  const report = u5Test.buildCrossVariantAssessment([
    {
      primaryOwner: {
        targetCell: { key: 'previousStepResidualUpperCloud' },
        corridorBand: { key: 'previousStepResidualUpperCloud' }
      },
      firstMaterialBoundary: 'endPreviousStepMicrophysics5',
      retentionDecision: 'retention-dominant'
    },
    {
      primaryOwner: {
        targetCell: { key: 'previousStepResidualUpperCloud' },
        corridorBand: { key: 'previousStepResidualUpperCloud' }
      },
      firstMaterialBoundary: 'endPreviousStepMicrophysics5',
      retentionDecision: 'retention-dominant'
    }
  ]);

  assert.equal(report.exitCriteriaPass, true);
  assert.equal(report.stablePrimaryTargetOwner, 'previousStepResidualUpperCloud');
  assert.equal(report.stableFirstBoundary, 'endPreviousStepMicrophysics5');
});

test('buildCrossVariantAssessment fails when the boundary or decision flips', () => {
  const report = u5Test.buildCrossVariantAssessment([
    {
      primaryOwner: {
        targetCell: { key: 'previousStepResidualUpperCloud' },
        corridorBand: { key: 'previousStepResidualUpperCloud' }
      },
      firstMaterialBoundary: 'endPreviousStepMicrophysics5',
      retentionDecision: 'retention-dominant'
    },
    {
      primaryOwner: {
        targetCell: { key: 'previousStepResidualUpperCloud' },
        corridorBand: { key: 'previousStepResidualUpperCloud' }
      },
      firstMaterialBoundary: 'afterStepAdvection5',
      retentionDecision: 'coupled'
    }
  ]);

  assert.equal(report.exitCriteriaPass, false);
  assert.equal(report.sameFirstBoundaryPass, false);
  assert.equal(report.sameRetentionDecisionPass, false);
});
