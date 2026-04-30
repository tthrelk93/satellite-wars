import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZOBilateralEdgeOutcomeAttribution } from '../../scripts/agent/phase1zo-bilateral-edge-outcome-attribution.mjs';

test('phase 1ZO identifies northside fanout without a humidification recharge signature', () => {
  const latitudesDeg = [-3.75, 3.75, 11.25, 18.75, 26.25, 33.75];
  const offAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.91,
        subtropicalDryNorthRatio: 1.534,
        subtropicalDrySouthRatio: 1.199,
        northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413,
        tropicalShoulderCoreLargeScaleCondensationMeanKgM2: 0.11873,
        northDryBeltOceanRhMeanFrac: 0.464,
        subtropicalRhNorthMeanFrac: 0.47
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.05852, 0.09574, 0.14212, 0.10718, 0.11556, 0.1794],
          totalColumnWaterKgM2: [38.433, 43.871, 43.205, 38.429, 37.469, 31.057],
          boundaryLayerRhFrac: [0.57, 0.545, 0.546, 0.479, 0.564, 0.794],
          midTroposphericRhFrac: [0.41, 0.441, 0.405, 0.386, 0.414, 0.616],
          lowerTroposphericOmegaPaS: [0.14679, 0.12463, 0.17391, 0.43981, 0.26984, -0.32162],
          equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0, 0, 0, 0, 0, 0],
          equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0, 0, 0, 0, 0, 0],
          equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: [0, 0, 0, 0, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0.02437, 0, 0, 0]
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
        northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1544,
        tropicalShoulderCoreLargeScaleCondensationMeanKgM2: 0.12179,
        northDryBeltOceanRhMeanFrac: 0.463,
        subtropicalRhNorthMeanFrac: 0.47
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.05851, 0.1083, 0.13552, 0.11945, 0.12644, 0.18333],
          totalColumnWaterKgM2: [38.439, 43.866, 43.212, 38.413, 37.462, 31.053],
          boundaryLayerRhFrac: [0.57, 0.544, 0.547, 0.479, 0.563, 0.794],
          midTroposphericRhFrac: [0.41, 0.442, 0.406, 0.386, 0.414, 0.616],
          lowerTroposphericOmegaPaS: [0.1468, 0.12466, 0.17391, 0.43987, 0.26979, -0.32173],
          equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0.00054, 0.00072, 0, 0, 0, 0],
          equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0, 0, 0.13665, 0, 0, 0],
          equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: [0.47609, 0.41485, 0, 0, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0.02272, 0, 0, 0]
        }
      }
    }]
  };

  const phase1znSummary = {
    verdict: 'bilateral_activation_with_nh_edge_overresponse',
    keepPatch: false,
    bilateralActivation: true
  };

  const summary = buildPhase1ZOBilateralEdgeOutcomeAttribution({
    offAudit,
    onAudit,
    phase1znSummary,
    paths: {
      offPath: '/tmp/phase1zn-off.json',
      onPath: '/tmp/phase1zn-on.json',
      phase1znPath: '/tmp/phase1zn.json',
      reportPath: '/tmp/phase1zo.md',
      jsonPath: '/tmp/phase1zo.json'
    }
  });

  assert.equal(summary.verdict, 'northside_condensation_fanout_without_humidification');
  assert.equal(summary.nextPhase, 'Phase 1ZP: Northside Fanout Containment Design');
  assert.ok((summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((summary.slices.northSpillover.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((summary.slices.northDryBeltCore.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((summary.slices.northSource.delta.largeScaleCondensationSourceKgM2 || 0) < 0);
  assert.ok((summary.scores.humidificationScore || 0) < 0.2);
});
