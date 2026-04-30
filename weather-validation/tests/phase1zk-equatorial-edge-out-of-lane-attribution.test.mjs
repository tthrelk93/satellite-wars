import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZKEquatorialEdgeOutOfLaneAttribution } from '../../scripts/agent/phase1zk-equatorial-edge-out-of-lane-attribution.mjs';

test('phase 1ZK identifies a bilateral equatorial-edge rebound outside the shoulder lane', () => {
  const latitudesDeg = [-3.75, 3.75, 11.25, 18.75, 33.75];
  const offAudit = {
    samples: [{
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.06309, 0.07641, 0.12779, 0.10309, 0.18497],
          precipRateMmHr: [0.103, 0.139, 0.159, 0.157, 0.14],
          convectiveMassFluxKgM2S: [0.00067, 0.00222, 0.0004, 0, 0],
          convectiveOrganization: [0.388, 0.453, 0.27, 0.012, 0.01],
          totalColumnWaterKgM2: [38.45, 43.876, 43.119, 38.233, 30.909],
          boundaryLayerRhFrac: [0.57, 0.547, 0.544, 0.479, 0.43],
          midTroposphericRhFrac: [0.41, 0.439, 0.4, 0.377, 0.34],
          lowerTroposphericOmegaPaS: [0.1451, 0.12506, 0.17318, 0.43743, 0.26],
          midTroposphericOmegaPaS: [0.17386, 0.14954, 0.17405, 0.44807, 0.28],
          upperTroposphericOmegaPaS: [0.0987, 0.08139, 0.08013, 0.21852, 0.13],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0, 0.08619, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0, 0],
          freshShoulderEquatorialEdgeWindowDiagFrac: [0, 1, 0, 0, 0],
          freshShoulderInnerWindowDiagFrac: [0, 0, 1, 0, 0],
          freshShoulderEquatorialEdgeGateSupportDiagFrac: [0, 0, 0, 0.87976, 0.8004],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 0, 1]
        }
      }
    }]
  };
  const onAudit = {
    samples: [{
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.09078, 0.10331, 0.07074, 0.08891, 0.17648],
          precipRateMmHr: [0.109, 0.141, 0.156, 0.146, 0.139],
          convectiveMassFluxKgM2S: [0.00068, 0.00219, 0.0004, 0, 0],
          convectiveOrganization: [0.386, 0.45, 0.269, 0.012, 0.01],
          totalColumnWaterKgM2: [38.593, 43.738, 42.572, 36.189, 30.5],
          boundaryLayerRhFrac: [0.571, 0.542, 0.545, 0.473, 0.43],
          midTroposphericRhFrac: [0.419, 0.44, 0.39, 0.347, 0.34],
          lowerTroposphericOmegaPaS: [0.13425, 0.1233, 0.17663, 0.44669, 0.261],
          midTroposphericOmegaPaS: [0.16349, 0.14723, 0.17699, 0.45801, 0.281],
          upperTroposphericOmegaPaS: [0.09404, 0.08016, 0.08152, 0.22367, 0.131],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0, 0.0395, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0.00988, 0, 0],
          freshShoulderEquatorialEdgeWindowDiagFrac: [0, 1, 0, 0, 0],
          freshShoulderInnerWindowDiagFrac: [0, 0, 1, 0, 0],
          freshShoulderEquatorialEdgeGateSupportDiagFrac: [0, 0, 0, 0.88237, 0.80116],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 0, 1]
        }
      }
    }]
  };
  const phase1zjSummary = { verdict: 'keep_with_out_of_lane_edge_residual', keepPatch: true };

  const summary = buildPhase1ZKEquatorialEdgeOutOfLaneAttribution({
    offAudit,
    onAudit,
    phase1zjSummary,
    paths: {
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      phase1zjPath: '/tmp/1zj.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'bilateral_equatorial_edge_subsidence_relaxation');
  assert.equal(summary.nextPhase, 'Phase 1ZL: Equatorial-Edge Subsidence Guard Design');
  assert.equal(summary.referenceSlices.northEdge.on.shoulderAbsorptionGuardCandidateMassKgM2, 0);
  assert.equal(summary.referenceSlices.northEdge.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
  assert.ok((summary.referenceSlices.northEdge.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((summary.referenceSlices.southEdge.delta.largeScaleCondensationSourceKgM2 || 0) > 0);
  assert.ok((summary.referenceSlices.northEdge.delta.lowerTroposphericOmegaPaS || 0) < 0);
  assert.ok((summary.referenceSlices.southEdge.delta.lowerTroposphericOmegaPaS || 0) < 0);
  assert.ok((summary.referenceSlices.innerShoulder.delta.largeScaleCondensationSourceKgM2 || 0) < 0);
  assert.equal(summary.referenceSlices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2, 0);
});
