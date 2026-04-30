import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZNMirroredBilateralEdgeSourceWindowPatch } from '../../scripts/agent/phase1zn-mirrored-bilateral-edge-source-window-patch.mjs';

test('phase 1ZN identifies bilateral activation with north-edge overresponse', () => {
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
          lowerTroposphericOmegaPaS: [-0.09261, 0.14679, 0.12463, 0.17391, 0.43981, -0.32162],
          equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0, 0, 0, 0, 0, 0],
          equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0, 0, 0, 0, 0, 0],
          equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: [0, 0, 0, 0, 0, 0],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0, 0, 0.12187, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0.02437, 0, 0]
        }
      }
    }]
  };
  const onAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.905,
        subtropicalDryNorthRatio: 1.533,
        subtropicalDrySouthRatio: 1.197,
        midlatitudeWesterliesNorthU10Ms: 0.531,
        northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1544
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.10715, 0.05851, 0.1083, 0.13552, 0.11945, 0.18333],
          lowerTroposphericOmegaPaS: [-0.0928, 0.1468, 0.12466, 0.17391, 0.43987, -0.32173],
          equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0, 0.00054, 0.00072, 0, 0, 0],
          equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0.10521, 0, 0, 0.13665, 0, 0],
          equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: [0, 0.47609, 0.41485, 0, 0, 0],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0, 0, 0.11361, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0.02272, 0, 0]
        }
      }
    }]
  };
  const phase1zmSummary = {
    verdict: 'signed_latitude_window_inheritance',
    nextPhase: 'Phase 1ZN: Implement Mirrored Bilateral Edge-Source Window Patch'
  };

  const summary = buildPhase1ZNMirroredBilateralEdgeSourceWindowPatch({
    offAudit,
    onAudit,
    phase1zmSummary,
    paths: {
      offPath: '/tmp/phase1zn-off.json',
      onPath: '/tmp/phase1zn-on.json',
      phase1zmPath: '/tmp/phase1zm.json',
      reportPath: '/tmp/phase1zn.md',
      jsonPath: '/tmp/phase1zn.json'
    }
  });

  assert.equal(summary.verdict, 'bilateral_activation_with_nh_edge_overresponse');
  assert.equal(summary.keepPatch, false);
  assert.equal(summary.bilateralActivation, true);
  assert.equal(summary.nextPhase, 'Phase 1ZO: Bilateral Edge Outcome Attribution');
  assert.equal(summary.slices.southSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac, 0.10521);
  assert.equal(summary.slices.southEdge.on.equatorialEdgeSubsidenceGuardAppliedDiagPaS, 0.00054);
  assert.ok((summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((summary.slices.spillover.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
});
