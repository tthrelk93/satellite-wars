import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZLEquatorialEdgeSubsidenceGuardPatch } from '../../scripts/agent/phase1zl-equatorial-edge-subsidence-guard-patch.mjs';

test('phase 1ZL identifies north-only partial activation and rejects the bilateral edge guard by default', () => {
  const latitudesDeg = [-11.25, -3.75, 3.75, 11.25, 18.75, 33.75];
  const offAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.91,
        subtropicalDryNorthRatio: 1.534,
        subtropicalDrySouthRatio: 1.199,
        midlatitudeWesterliesNorthU10Ms: 0.531,
        northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.10585, 0.05852, 0.09574, 0.14212, 0.10718, 0.1794],
          totalColumnWaterKgM2: [35.1, 39.2, 42.8, 44.6, 38.9, 30.8],
          boundaryLayerRhFrac: [0.62, 0.58, 0.55, 0.54, 0.48, 0.43],
          midTroposphericRhFrac: [0.42, 0.41, 0.44, 0.4, 0.38, 0.34],
          lowerTroposphericOmegaPaS: [-0.0928, 0.14679, 0.12463, 0.17391, 0.43981, -0.32162],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0, 0, 0.12187, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0.02437, 0, 0],
          equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0, 0, 0, 0, 0, 0],
          equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: [0, 0, 0, 0, 0, 0],
          equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0, 0, 0, 0, 0, 0],
          freshShoulderInnerWindowDiagFrac: [0, 0, 0, 1, 0, 0],
          freshShoulderEquatorialEdgeWindowDiagFrac: [0, 0, 1, 0, 0, 0],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 0, 0, 1]
        }
      }
    }]
  };

  const onAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.909,
        subtropicalDryNorthRatio: 1.535,
        subtropicalDrySouthRatio: 1.198,
        midlatitudeWesterliesNorthU10Ms: 0.531,
        northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14919
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.10692, 0.05978, 0.10231, 0.11129, 0.10951, 0.18329],
          totalColumnWaterKgM2: [35.15, 39.24, 42.86, 44.52, 38.93, 30.86],
          boundaryLayerRhFrac: [0.621, 0.581, 0.551, 0.538, 0.481, 0.431],
          midTroposphericRhFrac: [0.421, 0.412, 0.441, 0.392, 0.382, 0.341],
          lowerTroposphericOmegaPaS: [-0.0928, 0.14684, 0.12475, 0.17397, 0.43977, -0.3216],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0, 0, 0.08334, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0.01666, 0, 0],
          equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0, 0, 0, 0.1367, 0, 0],
          equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: [0, 0, 0.41491, 0, 0, 0],
          equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0, 0, 0.00072, 0, 0, 0],
          freshShoulderInnerWindowDiagFrac: [0, 0, 0, 1, 0, 0],
          freshShoulderEquatorialEdgeWindowDiagFrac: [0, 0, 1, 0, 0, 0],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 0, 0, 1]
        }
      }
    }]
  };

  const phase1zkSummary = {
    verdict: 'bilateral_equatorial_edge_subsidence_relaxation',
    nextPhase: 'Phase 1ZL: Equatorial-Edge Subsidence Guard Design'
  };

  const summary = buildPhase1ZLEquatorialEdgeSubsidenceGuardPatch({
    offAudit,
    onAudit,
    phase1zkSummary,
    paths: {
      offPath: '/tmp/phase1zl-off.json',
      onPath: '/tmp/phase1zl-on.json',
      phase1zkPath: '/tmp/phase1zk.json',
      reportPath: '/tmp/phase1zl.md',
      jsonPath: '/tmp/phase1zl.json'
    }
  });

  assert.equal(summary.verdict, 'north_only_partial_guard_activation');
  assert.equal(summary.keepPatch, false);
  assert.equal(summary.nextPhase, 'Phase 1ZM: Bilateral Equatorial-Edge Source Redesign');
  assert.equal(summary.slices.northSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac, 0.1367);
  assert.equal(summary.slices.southSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac, 0);
  assert.equal(summary.slices.northEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS, 0.00072);
  assert.equal(summary.slices.southEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS, 0);
  assert.ok((summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0) > 0);
});
