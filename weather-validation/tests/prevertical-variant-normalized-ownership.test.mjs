import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as normalizedTest } from '../../scripts/agent/prevertical-variant-normalized-ownership.mjs';

test('rankOwnerByAbsoluteSignal chooses the largest absolute contributor', () => {
  const ranking = normalizedTest.rankOwnerByAbsoluteSignal({
    previousStepResidualUpperCloud: -0.19,
    currentStepAdvectedUpperCloud: 0.03,
    currentStepLocalUpperCloud: 0
  });

  assert.equal(ranking.key, 'previousStepResidualUpperCloud');
  assert.equal(ranking.absoluteValue, 0.19);
});

test('summarizeVariant falls back to corridor scope when the target cell collapses', () => {
  const summary = normalizedTest.summarizeVariant({
    variant: { name: 'grid_coarse' },
    firstMaterialBoundary: 'endPreviousStepMicrophysics5',
    ownershipExcess: {
      targetCell: {
        previousStepResidualUpperCloud: 0,
        currentStepAdvectedUpperCloud: 0,
        currentStepLocalUpperCloud: 0,
        reprocessedUpperCloud: 0
      },
      corridorBand: {
        previousStepResidualUpperCloud: -0.19485,
        currentStepAdvectedUpperCloud: -0.02752,
        currentStepLocalUpperCloud: 0,
        reprocessedUpperCloud: 0
      }
    },
    counterfactuals: {},
    retentionDecision: 'coupled'
  });

  assert.equal(summary.normalizedScope, 'corridorBand');
  assert.equal(summary.normalizedOwner.key, 'previousStepResidualUpperCloud');
  assert.equal(summary.normalizedBoundary, 'endPreviousStepMicrophysics5');
});

test('buildAssessment passes when informative variants agree and collapsed variants are separated', () => {
  const assessment = normalizedTest.buildAssessment([
    {
      variant: { name: 'baseline' },
      normalizedScope: 'corridorBand',
      normalizedOwner: { key: 'previousStepResidualUpperCloud' },
      normalizedBoundary: 'endPreviousStepMicrophysics5',
      boundaryStableCandidate: true
    },
    {
      variant: { name: 'grid_coarse' },
      normalizedScope: 'corridorBand',
      normalizedOwner: { key: 'previousStepResidualUpperCloud' },
      normalizedBoundary: 'endPreviousStepMicrophysics5',
      boundaryStableCandidate: true
    },
    {
      variant: { name: 'dt_half' },
      normalizedScope: 'signalCollapsed',
      normalizedOwner: { key: null },
      normalizedBoundary: null,
      boundaryStableCandidate: false
    }
  ]);

  assert.equal(assessment.exitCriteriaPass, true);
  assert.equal(assessment.normalizedStableOwner, 'previousStepResidualUpperCloud');
  assert.deepEqual(assessment.collapsedSignalVariants, ['dt_half']);
  assert.equal(assessment.recommendation, 'ownership-family-stable-repair-numerical-signal-collapse');
});
