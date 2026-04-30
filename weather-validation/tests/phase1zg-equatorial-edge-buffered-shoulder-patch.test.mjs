import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZGEquatorialEdgeBufferedShoulderPatch } from '../../scripts/agent/phase1zg-equatorial-edge-buffered-shoulder-patch.mjs';

test('phase 1ZG keeps the buffered shoulder patch when climate guardrails improve despite an edge residual', () => {
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
          shoulderAbsorptionGuardCandidateMassKgM2: [0.04151, 0.08619, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0, 0, 0, 0],
          shoulderAbsorptionGuardEventCount: [1.14583, 2, 0, 0],
          totalColumnWaterKgM2: [43.876, 43.119, 38.233, 30.909]
        }
      }
    }]
  };
  const onAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.571,
        subtropicalDryNorthRatio: 1.421,
        subtropicalDrySouthRatio: 1.154,
        midlatitudeWesterliesNorthU10Ms: 0.531,
        tropicalShoulderCoreLargeScaleCondensationMeanKgM2: 0.10619
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.12278, 0.0893, 0.08503, 0.17612],
          shoulderAbsorptionGuardCandidateMassKgM2: [0.11161, 0.06461, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.02352, 0.01615, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0.02352, 0.01615, 0, 0],
          shoulderAbsorptionGuardEventCount: [1.66667, 1.95833, 0, 0],
          totalColumnWaterKgM2: [43.347, 42.445, 35.748, 30.498]
        }
      }
    }]
  };

  const summary = buildPhase1ZGEquatorialEdgeBufferedShoulderPatch({
    offAudit,
    onAudit,
    paths: {
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.keepPatch, true);
  assert.equal(summary.verdict, 'keep_with_equatorial_edge_residual');
  assert.equal(summary.nextPhase, 'Phase 1ZH: Equatorial-Edge Candidate Rebound Attribution');
  assert.ok((summary.metrics.itczWidthDeg || 0) < 0);
  assert.ok((summary.slices.equatorialEdge.deltas.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.equal(summary.slices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
});
