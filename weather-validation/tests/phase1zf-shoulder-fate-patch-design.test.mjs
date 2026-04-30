import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1ZFShoulderFatePatchDesign
} from '../../scripts/agent/phase1zf-shoulder-fate-patch-design.mjs';

test('phase 1ZF chooses buffered rainout with an equatorial-edge redesign over sink export', () => {
  const summary = {
    ranking: [
      {
        key: 'buffered_rainout',
        score: 0.98969,
        deltas: {
          tropicalShoulderCoreCondensationKgM2: 0.00099,
          shoulderSpilloverKgM2: -0.01452,
          subtropicalDrySouthRatio: -0.009
        }
      },
      {
        key: 'sink_export',
        score: 0.83333,
        deltas: {
          tropicalShoulderCoreCondensationKgM2: -0.01967,
          shoulderSpilloverKgM2: -0.03469,
          subtropicalDrySouthRatio: 0.105
        }
      },
      {
        key: 'retain',
        score: 0.17051,
        deltas: {
          tropicalShoulderCoreCondensationKgM2: 0.01603,
          shoulderSpilloverKgM2: 0.00635,
          subtropicalDrySouthRatio: 0.005
        }
      }
    ],
    winner: {
      key: 'buffered_rainout',
      score: 0.98969,
      deltas: {
        tropicalShoulderCoreCondensationKgM2: 0.00099,
        shoulderSpilloverKgM2: -0.01452,
        subtropicalDrySouthRatio: -0.009
      }
    }
  };

  const latitudesDeg = [3.75, 11.25, 18.75, 33.75];
  const offAudit = {
    samples: [{
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.07641, 0.12779, 0.10309, 0.18497],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0, 0, 0, 0],
          totalColumnWaterKgM2: [43.876, 43.119, 38.233, 30.909],
          lowerTroposphericRhFrac: [0.47, 0.414, 0.356, 0.658],
          midTroposphericRhFrac: [0.439, 0.4, 0.377, 0.604]
        }
      }
    }]
  };
  const candidateAudit = {
    samples: [{
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.08408, 0.1221, 0.08857, 0.17247],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.00781, 0.02025, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0.00781, 0.02025, 0, 0],
          totalColumnWaterKgM2: [43.681, 42.703, 36.925, 30.694],
          lowerTroposphericRhFrac: [0.469, 0.404, 0.34, 0.653],
          midTroposphericRhFrac: [0.438, 0.389, 0.353, 0.591]
        }
      }
    }]
  };

  const result = buildPhase1ZFShoulderFatePatchDesign({
    summary,
    offAudit,
    candidateAudit,
    paths: {
      summaryPath: '/tmp/summary.json',
      offPath: '/tmp/off.json',
      candidatePath: '/tmp/candidate.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(result.verdict, 'equatorial_edge_buffered_underreach');
  assert.equal(result.nextPhase, 'Phase 1ZG: Implement Equatorial-Edge Buffered Shoulder Fate Patch');
  assert.equal(result.designChoice.baseFate, 'buffered_rainout');
  assert.ok((result.evidence.equatorialEdge.deltas.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((result.evidence.innerShoulder.deltas.largeScaleCondensationSourceKgM2 || 0) < 0);
  assert.equal(result.evidence.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
});
