import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZHEquatorialEdgeCandidateReboundAttribution } from '../../scripts/agent/phase1zh-equatorial-edge-candidate-rebound-attribution.mjs';

test('phase 1ZH attributes the residual to raw equatorial-edge candidate rebound', () => {
  const summary = {
    slices: {
      equatorialEdge: {
        deltas: {
          largeScaleCondensationSourceKgM2: 0.04637,
          shoulderAbsorptionGuardCandidateMassKgM2: 0.0701,
          shoulderAbsorptionGuardAppliedSuppressionKgM2: 0.02352,
          shoulderAbsorptionGuardEventCount: 0.52084
        }
      },
      innerShoulder: {
        deltas: {
          largeScaleCondensationSourceKgM2: -0.03849
        }
      },
      spillover: {
        deltas: {
          largeScaleCondensationSourceKgM2: -0.01806
        }
      },
      targetEntry: {
        on: {
          shoulderAbsorptionGuardAppliedSuppressionKgM2: 0
        }
      }
    }
  };

  const result = buildPhase1ZHEquatorialEdgeCandidateReboundAttribution({
    summary,
    paths: {
      summaryPath: '/tmp/summary.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(result.verdict, 'raw_equatorial_edge_candidate_rebound');
  assert.equal(result.nextPhase, 'Phase 1ZI: Equatorial-Edge Candidate Gate Design');
  assert.ok((result.evidence.equatorialEdge.deltas.shoulderAbsorptionGuardCandidateMassKgM2 || 0) > 0);
  assert.ok((result.evidence.equatorialEdge.deltas.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.equal(result.evidence.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
});
