import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZJSplitLaneEquatorialEdgeCandidateGatePatch } from '../../scripts/agent/phase1zj-split-lane-equatorial-edge-candidate-gate-patch.mjs';

test('phase 1ZJ keeps the split-lane gate when it improves climate guardrails and pushes the edge residual out of lane', () => {
  const latitudesDeg = [3.75, 11.25, 18.75, 33.75];
  const offAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.834,
        subtropicalDryNorthRatio: 1.515,
        subtropicalDrySouthRatio: 1.192,
        midlatitudeWesterliesNorthU10Ms: 0.531,
        tropicalShoulderCoreLargeScaleCondensationMeanKgM2: 0.10188
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.07641, 0.12779, 0.10309, 0.18497],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0.08619, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0, 0, 0, 0],
          shoulderAbsorptionGuardEventCount: [0, 2, 0, 0],
          freshShoulderLatitudeWindowDiagFrac: [1, 1, 0, 0],
          freshShoulderEquatorialEdgeWindowDiagFrac: [1, 0, 0, 0],
          freshShoulderInnerWindowDiagFrac: [0, 1, 0, 0],
          freshShoulderEquatorialEdgeGateSupportDiagFrac: [0, 0, 0.87976, 0.8004],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 1]
        }
      }
    }]
  };
  const onAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.607,
        subtropicalDryNorthRatio: 1.429,
        subtropicalDrySouthRatio: 1.144,
        midlatitudeWesterliesNorthU10Ms: 0.531,
        tropicalShoulderCoreLargeScaleCondensationMeanKgM2: 0.08716
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.10331, 0.07074, 0.08891, 0.17648],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0.0395, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0.00988, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0, 0.00988, 0, 0],
          shoulderAbsorptionGuardEventCount: [0, 1.83333, 0, 0],
          freshShoulderLatitudeWindowDiagFrac: [1, 1, 0, 0],
          freshShoulderEquatorialEdgeWindowDiagFrac: [1, 0, 0, 0],
          freshShoulderInnerWindowDiagFrac: [0, 1, 0, 0],
          freshShoulderEquatorialEdgeGateSupportDiagFrac: [0, 0, 0.88237, 0.80116],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 1]
        }
      }
    }]
  };
  const phase1zgSummary = {
    slices: {
      equatorialEdge: {
        deltas: {
          largeScaleCondensationSourceKgM2: 0.04637,
          shoulderAbsorptionGuardCandidateMassKgM2: 0.0701,
          shoulderAbsorptionGuardAppliedSuppressionKgM2: 0.02352
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
      }
    }
  };

  const summary = buildPhase1ZJSplitLaneEquatorialEdgeCandidateGatePatch({
    offAudit,
    onAudit,
    phase1zgSummary,
    paths: {
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      phase1zgPath: '/tmp/1zg.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.keepPatch, true);
  assert.equal(summary.verdict, 'keep_with_out_of_lane_edge_residual');
  assert.equal(summary.nextPhase, 'Phase 1ZK: Equatorial-Edge Out-Of-Lane Attribution');
  assert.ok((summary.metrics.itczWidthDeg || 0) < 0);
  assert.ok((summary.metrics.subtropicalDryNorthRatio || 0) < 0);
  assert.ok((summary.metrics.subtropicalDrySouthRatio || 0) < 0);
  assert.equal(summary.slices.equatorialEdge.on.shoulderAbsorptionGuardCandidateMassKgM2, 0);
  assert.equal(summary.slices.equatorialEdge.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
  assert.equal(summary.slices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
  assert.ok((summary.phase1zgComparison.currentEdgeCondensationDeltaKgM2 || 0) < (summary.phase1zgComparison.priorEdgeCondensationDeltaKgM2 || 0));
});
