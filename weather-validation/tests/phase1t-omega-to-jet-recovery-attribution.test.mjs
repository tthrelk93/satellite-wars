import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1TOmegaToJetRecoveryAttribution,
  renderPhase1TReport
} from '../../scripts/agent/phase1t-omega-to-jet-recovery-attribution.mjs';

test('phase 1T ranks equatorward absorption before jet band when omega moves but jet-band profiles stay flat', () => {
  const summary = buildPhase1TOmegaToJetRecoveryAttribution({
    baselineMetrics: {
      itczWidthDeg: 23.646,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.519,
      midlatitudeWesterliesNorthU10Ms: 1.192
    },
    offMetrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northTransitionDryingOmegaBridgeAppliedMeanPaS: 0,
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: 0,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06637,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01565
    },
    onMetrics: {
      itczWidthDeg: 25.837,
      subtropicalDryNorthRatio: 1.517,
      subtropicalDrySouthRatio: 1.193,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northTransitionDryingOmegaBridgeAppliedMeanPaS: 0.00206,
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: 0.00145,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06845,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01705
    },
    offProfileSample: {
      profiles: {
        latitudesDeg: [48.75, 41.25, 33.75, 26.25, 18.75, 11.25, 3.75],
        series: {
          wind10mU: [1.4, 0.58, -0.09, 1.36, -0.326, -1.141, -0.676],
          stormTrackIndex: [0.0001, 0.00013, 0.00008, 0.00004, 0.00001, 0.00001, 0.00001],
          largeScaleCondensationSourceKgM2: [0.24, 0.19, 0.14, 0.126, 0.11, 0.128, 0.076],
          subtropicalSubsidenceDryingFrac: [0, 0.03, 0.07, 0.085, 0.08, 0.01, 0]
        }
      }
    },
    onProfileSample: {
      profiles: {
        latitudesDeg: [48.75, 41.25, 33.75, 26.25, 18.75, 11.25, 3.75],
        series: {
          wind10mU: [1.4, 0.58, -0.09, 1.359, -0.327, -1.141, -0.677],
          stormTrackIndex: [0.0001, 0.00013, 0.00008, 0.00004, 0.00001, 0.00001, 0.00001],
          largeScaleCondensationSourceKgM2: [0.2399, 0.18995, 0.13995, 0.1168, 0.1047, 0.1587, 0.0981],
          subtropicalSubsidenceDryingFrac: [0, 0.03, 0.07, 0.085, 0.08, 0.01001, 0]
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

  assert.equal(summary.verdict, 'equatorward_absorption_before_jet_band');
  assert.equal(summary.nextPhase, 'Phase 1U: Jet-Band Placement Patch Design');
  assert.ok(summary.bridgeSignals.northTransitionLowLevelOmegaEffectiveDeltaPaS > 0);
  assert.equal(summary.bandDeltas.jetBandNorth.wind10mUDelta, 0);
  assert.ok(summary.bandDeltas.tropicalShoulderNorth.largeScaleCondensationDeltaKgM2 > 0);
  assert.ok(summary.bandDeltas.dryBeltCoreNorth.largeScaleCondensationDeltaKgM2 < 0);
  const rendered = renderPhase1TReport(summary);
  assert.match(rendered, /Phase 1T Omega-To-Jet Recovery Attribution/);
  assert.match(rendered, /Jet-Band Placement Patch Design/);
});
