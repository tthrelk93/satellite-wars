import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as alignmentTest } from '../../scripts/agent/phase1b-implementation-alignment-proof.mjs';

test('deriveRequiredVerticalDeltas marks carry-surviving and handed-to-microphysics as the main moving fields', () => {
  const result = alignmentTest.deriveRequiredVerticalDeltas({
    baseline: {
      upperCloudPathKgM2: 4.6,
      carriedOverUpperCloudMassKgM2: 4.6,
      upperCloudStaleMassKgM2: 4.6,
      upperCloudAppliedErosionMassKgM2: 0.2,
      upperCloudBlockedErosionMassKgM2: 4.4,
      verticalUpperCloudInputMassKgM2: 3.5,
      verticalUpperCloudResolvedBirthMassKgM2: 0.06,
      verticalUpperCloudConvectiveBirthMassKgM2: 0,
      verticalUpperCloudCarrySurvivingMassKgM2: 3.5,
      verticalUpperCloudAppliedErosionMassKgM2: 0,
      verticalUpperCloudHandedToMicrophysicsMassKgM2: 4.6,
      lowLevelOmegaEffectiveDiagPaS: -0.12,
      lowLevelMoistureConvergenceDiagS_1: 0.000002,
      convectivePotential: 0.2,
      convectiveOrganization: 0.03,
      convectiveMassFluxKgM2S: 0,
      convectiveDetrainmentMassKgM2: 0,
      convectiveAnvilSource: 0
    },
    synthetic: {
      upperCloudPathKgM2: 0.08,
      carriedOverUpperCloudMassKgM2: 0.08,
      upperCloudStaleMassKgM2: 0.08
    },
    intervention: {
      removedMassKgM2: 4.52
    }
  });

  assert.equal(result.mustChange.verticalUpperCloudCarrySurvivingMassKgM2.to, 0.08);
  assert.equal(result.mustChange.verticalUpperCloudHandedToMicrophysicsMassKgM2.to, 0.08);
  assert.equal(result.mustChange.verticalUpperCloudAppliedErosionMassKgM2.delta, 4.52);
  assert.equal(result.mustRemainStable.verticalUpperCloudInputMassKgM2, 3.5);
});

test('buildTriggerEnvelope preserves the exact-corridor weak-engine conditions', () => {
  const result = alignmentTest.buildTriggerEnvelope({
    supportSnapshot: {
      current: {
        targetCell: {
          fresh: {
            subtropicalSuppression: 0.8,
            organizedSupport: 0.2,
            freshPotentialTarget: 0.21,
            staleCarryoverDominance: 1,
            lowLevelOmegaRawPaS: -0.13
          },
          stored: {
            convectiveMassFluxKgM2S: 0,
            convectiveDetrainmentMassKgM2: 0,
            convectiveAnvilSource: 0
          }
        }
      }
    },
    patchPlacementProof: {
      targetPreviousStepResidualUpperCloudKgM2: 3.1
    }
  });

  assert.equal(result.mustNotRequire.strongerDescentThanObservedPaS, -0.13);
  assert.ok(result.mustFireWhen.subtropicalSuppressionMin > 0.7);
  assert.ok(result.mustFireWhen.organizedSupportMax < 0.25);
});

test('buildAlignmentVerdict returns a live signature contract from propagation proof targets', () => {
  const verdict = alignmentTest.buildAlignmentVerdict({
    requiredDeltas: {
      mustChange: {
        verticalUpperCloudCarrySurvivingMassKgM2: { delta: -4.4 },
        verticalUpperCloudHandedToMicrophysicsMassKgM2: { delta: -4.5 },
        verticalUpperCloudAppliedErosionMassKgM2: { delta: 4.5 }
      }
    },
    propagationProof: {
      scenarios: [
        {
          targetCell: {
            scenarioPostVerticalUpperCloudMassKgM2: 0.09
          }
        }
      ],
      failedPatchComparison: {
        bestSyntheticScenarioNextReplayBoundaryUpperCloudMassKgM2: 0.03
      }
    }
  });

  assert.equal(verdict.key, 'live_patch_must_reproduce_synthetic_vertical_signature');
  assert.equal(verdict.acceptanceTargets.targetPostVerticalUpperCloudMaxKgM2, 0.19);
  assert.equal(verdict.acceptanceTargets.targetNextReplayBoundaryUpperCloudMaxKgM2, 0.13);
});
