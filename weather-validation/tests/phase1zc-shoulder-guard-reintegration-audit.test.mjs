import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZCShoulderGuardReintegrationAudit } from '../../scripts/agent/phase1zc-shoulder-guard-reintegration-audit.mjs';

test('phase 1ZC identifies same-lane vapor recharge after the latitude-aware selector is fixed', () => {
  const latitudesDeg = [3.75, 11.25, 18.75, 26.25, 33.75];
  const offAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.834,
        subtropicalDryNorthRatio: 1.515,
        subtropicalDrySouthRatio: 1.192
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.07641, 0.12779, 0.10309, 0.12559, 0.18497],
          shoulderAbsorptionGuardCandidateMassKgM2: [0.04151, 0.08619, 0, 0, 0],
          shoulderAbsorptionGuardPotentialSuppressedMassKgM2: [0.0089, 0.02022, 0, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardBandWindowFrac: [0.04151, 0.08619, 0, 0, 0],
          shoulderAbsorptionGuardSelectorSupportFrac: [0.01235, 0.04061, 0, 0, 0],
          freshShoulderLatitudeWindowDiagFrac: [1, 1, 0, 0, 0],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 0, 1],
          totalColumnWaterKgM2: [43.876, 43.119, 38.233, 37.291, 30.909],
          boundaryLayerRhFrac: [0.547, 0.544, 0.479, 0.562, 0.787],
          lowerTroposphericRhFrac: [0.47, 0.414, 0.356, 0.407, 0.658],
          midTroposphericRhFrac: [0.439, 0.4, 0.377, 0.404, 0.604],
          precipRateMmHr: [0.139, 0.159, 0.157, 0.22, 0.257]
        }
      }
    }]
  };
  const onAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.89,
        subtropicalDryNorthRatio: 1.527,
        subtropicalDrySouthRatio: 1.197
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.09188, 0.14437, 0.10944, 0.10811, 0.17971],
          shoulderAbsorptionGuardCandidateMassKgM2: [0.06893, 0.12488, 0, 0, 0],
          shoulderAbsorptionGuardPotentialSuppressedMassKgM2: [0.01315, 0.02797, 0, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.0122, 0.02496, 0, 0, 0],
          shoulderAbsorptionGuardBandWindowFrac: [0.06893, 0.12488, 0, 0, 0],
          shoulderAbsorptionGuardSelectorSupportFrac: [0.02404, 0.05073, 0, 0, 0],
          freshShoulderLatitudeWindowDiagFrac: [1, 1, 0, 0, 0],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 0, 1],
          totalColumnWaterKgM2: [43.967, 43.239, 38.401, 37.418, 31.03],
          boundaryLayerRhFrac: [0.546, 0.545, 0.479, 0.565, 0.792],
          lowerTroposphericRhFrac: [0.47, 0.416, 0.358, 0.408, 0.663],
          midTroposphericRhFrac: [0.441, 0.404, 0.384, 0.411, 0.612],
          precipRateMmHr: [0.139, 0.157, 0.16, 0.222, 0.256]
        }
      }
    }]
  };

  const summary = buildPhase1ZCShoulderGuardReintegrationAudit({
    offAudit,
    onAudit,
    paths: {
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'same_lane_vapor_recharge');
  assert.equal(summary.nextPhase, 'Phase 1ZD: Suppressed-Mass Fate Design');
  assert.equal(summary.ranking[0].key, 'same_lane_vapor_recharge');
  assert.equal(summary.referenceSlices.targetEntry33p75.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
  assert.ok((summary.bandDiagnostics.tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2 || 0) > 0);
  assert.ok((summary.bandDiagnostics.adjacentShoulderSpilloverDeltaKgM2 || 0) > 0);
});
