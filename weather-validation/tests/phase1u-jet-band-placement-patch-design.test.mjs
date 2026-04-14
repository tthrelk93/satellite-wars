import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1UJetBandPlacementPatchDesign,
  renderPhase1UReport
} from '../../scripts/agent/phase1u-jet-band-placement-patch-design.mjs';

test('phase 1U selects a poleward-projected bridge design when the current bridge is trapped equatorward', () => {
  const summary = buildPhase1UJetBandPlacementPatchDesign({
    baselineMetrics: {
      itczWidthDeg: 23.646,
      subtropicalDryNorthRatio: 1.1,
      midlatitudeWesterliesNorthU10Ms: 1.192
    },
    offMetrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06637,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01565
    },
    onMetrics: {
      itczWidthDeg: 25.837,
      subtropicalDryNorthRatio: 1.517,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06845,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01705,
      northTransitionDryingOmegaBridgeAppliedMeanPaS: 0.00206,
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: 0.00145
    },
    offProfileSample: {
      profiles: {
        latitudesDeg: [48.75, 41.25, 33.75, 26.25, 18.75, 11.25, 3.75],
        series: {
          wind10mU: [1.4, 0.58, -0.09, 1.36, -0.326, -1.141, -0.676],
          stormTrackIndex: [0.0001, 0.00013, 0.00008, 0.00004, 0.00001, 0.00001, 0.00001],
          largeScaleCondensationSourceKgM2: [0.24, 0.19, 0.14, 0.126, 0.11, 0.128, 0.076]
        }
      }
    },
    onProfileSample: {
      profiles: {
        latitudesDeg: [48.75, 41.25, 33.75, 26.25, 18.75, 11.25, 3.75],
        series: {
          wind10mU: [1.4, 0.58, -0.09, 1.359, -0.327, -1.141, -0.676],
          stormTrackIndex: [0.0001, 0.00013, 0.00008, 0.00004, 0.00001, 0.00001, 0.00001],
          largeScaleCondensationSourceKgM2: [0.2399, 0.1899, 0.1400, 0.1168, 0.1047, 0.1587, 0.0981]
        }
      }
    },
    paths: {
      baselinePath: '/tmp/baseline.json',
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      offProfilesPath: '/tmp/off-profiles.json',
      onProfilesPath: '/tmp/on-profiles.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'poleward_projected_transition_bridge_required');
  assert.equal(summary.nextPhase, 'Phase 1V: Implement Poleward Jet-Entry Bridge Patch');
  assert.equal(summary.currentLaneGeometry.subtropicalSubsidenceLat1, 35);
  assert.ok(summary.bandDeltas.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2 > 0);
  assert.equal(summary.bandDeltas.jetBandNorth.wind10mUDelta, 0);
  assert.equal(summary.patchDesign.suggestedParams.dryingOmegaBridgeTargetLat0, 30);
  const rendered = renderPhase1UReport(summary);
  assert.match(rendered, /Phase 1U Jet-Band Placement Patch Design/);
  assert.match(rendered, /Poleward Jet-Entry Bridge Patch/);
});
