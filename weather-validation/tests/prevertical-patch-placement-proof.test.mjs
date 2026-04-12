import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as u6Test } from '../../scripts/agent/prevertical-patch-placement-proof.mjs';

test('summarizePlacementScenario computes proving-instant and previous-step reductions', () => {
  const summary = u6Test.summarizePlacementScenario({
    scenario: {
      name: 'historicalMicrophysicsOnly',
      provingInstant: {
        targetCellUpperCloudMassKgM2: 1.5,
        corridorUpperCloudMassKgM2: 3
      },
      endPreviousStepMicrophysics: {
        targetCellUpperCloudMassKgM2: 1.2,
        corridorUpperCloudMassKgM2: 2.4
      },
      currentInstrumentationLedger: null
    },
    currentBaseline: {
      provingInstant: {
        targetCellUpperCloudMassKgM2: 4,
        corridorUpperCloudMassKgM2: 8
      },
      endPreviousStepMicrophysics: {
        targetCellUpperCloudMassKgM2: 3.2,
        corridorUpperCloudMassKgM2: 6.4
      }
    },
    historicalBaseline: {
      provingInstant: {
        targetCellUpperCloudMassKgM2: 0,
        corridorUpperCloudMassKgM2: 0
      },
      endPreviousStepMicrophysics: {
        targetCellUpperCloudMassKgM2: 0,
        corridorUpperCloudMassKgM2: 0
      }
    }
  });

  assert.equal(summary.targetReductionFrac, 0.625);
  assert.equal(summary.corridorReductionFrac, 0.625);
  assert.equal(summary.previousStepTargetReductionFrac, 0.625);
  assert.equal(summary.previousStepCorridorReductionFrac, 0.625);
});

test('choosePatchPlacement prefers a clear single-owner microphysics result', () => {
  const result = u6Test.choosePatchPlacement({
    verticalOnly: {
      name: 'historicalVerticalOnly',
      score: 0.22,
      targetReductionFrac: 0.18
    },
    microphysicsOnly: {
      name: 'historicalMicrophysicsOnly',
      score: 0.86,
      targetReductionFrac: 0.91
    },
    coordinated: {
      name: 'historicalVerticalAndMicrophysics',
      score: 0.89,
      targetReductionFrac: 0.93
    },
    u2Report: {
      primaryOwnerRanking: {
        targetCell: { key: 'previousStepResidualUpperCloud' }
      }
    },
    u4Report: {
      rootCauseAssessment: {
        decision: 'retention-local-maintenance-without-full-globe'
      }
    },
    normalizedReport: {
      assessment: {
        normalizedStableOwner: 'previousStepResidualUpperCloud'
      }
    }
  });

  assert.equal(result.primaryOwner, 'stepMicrophysics5');
  assert.equal(result.secondaryOwner, null);
  assert.equal(result.winningScenario, 'historicalMicrophysicsOnly');
});

test('buildFalsificationRule targets the chosen owner family', () => {
  assert.match(
    u6Test.buildFalsificationRule({
      placement: { primaryOwner: 'stepMicrophysics5' }
    }),
    /endPreviousStepMicrophysics5/
  );
  assert.match(
    u6Test.buildFalsificationRule({
      placement: { primaryOwner: 'stepVertical5' }
    }),
    /post-vertical handoff/
  );
});
