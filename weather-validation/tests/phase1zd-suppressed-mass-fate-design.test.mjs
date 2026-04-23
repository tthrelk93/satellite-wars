import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZDSuppressedMassFateDesign } from '../../scripts/agent/phase1zd-suppressed-mass-fate-design.mjs';

test('phase 1ZD ranks fate-aware fixes ahead of another selector retune', () => {
  const reintegrationSummary = {
    verdict: 'same_lane_vapor_recharge',
    nextPhase: 'Phase 1ZD: Suppressed-Mass Fate Design',
    bandDiagnostics: {
      tropicalShoulderCoreNetCondensationDeltaKgM2: 0.01603,
      tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2: 0.03461,
      tropicalShoulderCoreAppliedSuppressionOnKgM2: 0.01858,
      tropicalShoulderCoreTcwDeltaKgM2: 0.1055,
      tropicalShoulderCoreMidRhDeltaFrac: 0.003,
      adjacentShoulderSpilloverDeltaKgM2: 0.00635,
      adjacentShoulderSpilloverTcwDeltaKgM2: 0.168,
      adjacentShoulderSpilloverMidRhDeltaFrac: 0.007
    },
    referenceSlices: {
      targetEntry33p75: {
        on: {
          shoulderAbsorptionGuardCandidateMassKgM2: 0,
          shoulderAbsorptionGuardAppliedSuppressionKgM2: 0,
          freshShoulderTargetEntryExclusionDiagFrac: 1
        }
      }
    }
  };

  const summary = buildPhase1ZDSuppressedMassFateDesign({
    reintegrationSummary,
    paths: {
      reintegrationJsonPath: '/tmp/reintegration.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'in_place_vapor_retention');
  assert.equal(summary.nextPhase, 'Phase 1ZE: Suppressed-Mass Fate Counterfactuals');
  assert.equal(summary.ranking[0].key, 'in_place_vapor_retention');
  assert.deepEqual(summary.designOptions.map((option) => option.key), [
    'delayed_rainout_or_buffered_removal',
    'local_sink_or_export_path',
    'selector_only_retune'
  ]);
  assert.equal(summary.witness.shoulderSuppressedMassKgM2, 0);
  assert.equal(summary.witness.qvSumDelta, 0);
  assert.equal(summary.witness.qcSumDelta, 0);
  assert.ok(summary.rootCauseAssessment.ruledIn.some((line) => line.includes('neutral evidence')));
});
