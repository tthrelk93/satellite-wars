import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as reconciliationTest } from '../../scripts/agent/phase1b-live-replay-reconciliation.mjs';

test('evaluateOldGateCompatibility isolates stale dominance and reservoir gates', () => {
  const result = reconciliationTest.evaluateOldGateCompatibility({
    oldAlignment: {
      triggerEnvelope: {
        mustFireWhen: {
          subtropicalSuppressionMin: 0.74243,
          organizedSupportMax: 0.22504,
          freshPotentialTargetMax: 0.24341,
          staleCarryoverDominanceMin: 0.95,
          previousStepResidualUpperCloudMinKgM2: 4.40574
        }
      }
    },
    liveCurrentState: {
      freshSubtropicalSuppression: 0.7815,
      freshOrganizedSupport: 0.19571,
      freshPotentialTarget: 0.21167,
      staleCarryoverDominance: 0.93172,
      verticalUpperCloudInputMassKgM2: 3.29604,
      upperCloudPathKgM2: 3.29604,
      carriedOverUpperCloudMassKgM2: 3.0706,
      upperCloudStaleMassKgM2: 3.0706
    }
  });

  assert.equal(result.supportFamilyStillValid, true);
  assert.deepEqual(
    result.mismatchedGates.map((entry) => entry.gate),
    ['staleCarryoverDominance', 'previousStepResidualUpperCloud']
  );
});

test('buildReconciledTriggerContract preserves matching support gates and relaxes stale mass gates', () => {
  const liveCurrentState = {
    freshSubtropicalSuppression: 0.7815,
    freshOrganizedSupport: 0.19571,
    freshPotentialTarget: 0.21167,
    staleCarryoverDominance: 0.93172,
    verticalCarryInputDominance: 1,
    verticalUpperCloudInputMassKgM2: 3.29604,
    upperCloudPathKgM2: 3.29604,
    carriedOverUpperCloudMassKgM2: 3.0706,
    upperCloudStaleMassKgM2: 3.0706
  };
  const gateCompatibility = reconciliationTest.evaluateOldGateCompatibility({
    oldAlignment: {
      triggerEnvelope: {
        mustFireWhen: {
          subtropicalSuppressionMin: 0.74243,
          organizedSupportMax: 0.22504,
          freshPotentialTargetMax: 0.24341,
          staleCarryoverDominanceMin: 0.95,
          previousStepResidualUpperCloudMinKgM2: 4.40574
        }
      }
    },
    liveCurrentState
  });

  const reconciled = reconciliationTest.buildReconciledTriggerContract({
    oldAlignment: {
      triggerEnvelope: {
        mustFireWhen: {
          subtropicalSuppressionMin: 0.74243,
          organizedSupportMax: 0.22504,
          freshPotentialTargetMax: 0.24341,
          staleCarryoverDominanceMin: 0.95,
          previousStepResidualUpperCloudMinKgM2: 4.40574
        }
      }
    },
    liveCurrentState,
    gateCompatibility
  });

  assert.equal(reconciled.recommendedEnvelope.subtropicalSuppressionMin, 0.74243);
  assert.equal(reconciled.recommendedEnvelope.organizedSupportMax, 0.22504);
  assert.equal(reconciled.recommendedEnvelope.freshPotentialTargetMax, 0.24341);
  assert.equal(reconciled.recommendedEnvelope.staleCarryoverDominanceMin, null);
  assert.ok(reconciled.recommendedEnvelope.verticalCarryInputDominanceMin > 0.9);
  assert.ok(reconciled.recommendedEnvelope.previousStepResidualUpperCloudMinKgM2 < 4.40574);
});

test('buildMassContractDrift flags stale mass contract when live handoff is materially lighter', () => {
  const drift = reconciliationTest.buildMassContractDrift({
    oldAlignment: {
      frozenCurrentState: {
        upperCloudPathKgM2: 4.63762,
        carriedOverUpperCloudMassKgM2: 4.63762,
        upperCloudStaleMassKgM2: 4.63762,
        verticalUpperCloudInputMassKgM2: 4.56883,
        verticalUpperCloudCarrySurvivingMassKgM2: 4.56883,
        verticalUpperCloudHandedToMicrophysicsMassKgM2: 4.56883
      }
    },
    liveCurrentState: {
      upperCloudPathKgM2: 3.29604,
      carriedOverUpperCloudMassKgM2: 3.0706,
      upperCloudStaleMassKgM2: 3.0706,
      verticalUpperCloudInputMassKgM2: 3.29604,
      verticalUpperCloudCarrySurvivingMassKgM2: 3.29604,
      verticalUpperCloudHandedToMicrophysicsMassKgM2: 3.29604
    }
  });

  assert.equal(drift.staleMassContract, true);
  assert.ok(drift.maxAbsDeltaKgM2 > 1);
});
