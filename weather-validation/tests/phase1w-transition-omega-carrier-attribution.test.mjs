import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1WTransitionOmegaCarrierAttribution
} from '../../scripts/agent/phase1w-transition-omega-carrier-attribution.mjs';

function makeAudit({ metrics, profiles }) {
  return {
    samples: [
      {
        metrics,
        profiles: {
          latitudesDeg: profiles.latitudesDeg,
          series: profiles.series
        }
      }
    ]
  };
}

test('phase 1W ranks missing projected-share application ahead of downstream carrier stories', () => {
  const latitudesDeg = [11.25, 18.75, 26.25, 33.75, 41.25, 48.75];
  const offAudit = makeAudit({
    metrics: {
      itczWidthDeg: 25.83,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531
    },
    profiles: {
      latitudesDeg,
      series: {
        dryingOmegaBridgeAppliedPaS: [0, 0, 0, 0, 0, 0],
        dryingOmegaBridgeLocalAppliedPaS: [0, 0, 0, 0, 0, 0],
        dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0, 0, 0],
        lowerTroposphericOmegaPaS: [0.01, 0.01, 0.02, 0.03, 0.04, 0.04],
        midTroposphericOmegaPaS: [0.001, 0.001, 0.002, 0.003, 0.004, 0.004],
        upperTroposphericOmegaPaS: [0, 0, 0.001, 0.001, 0.002, 0.002],
        wind10mU: [0.1, 0.2, 0.3, 0.4, 0.5, 0.55],
        stormTrackIndex: [0.00001, 0.00001, 0.00002, 0.00003, 0.00005, 0.00005],
        largeScaleCondensationSourceKgM2: [0.08, 0.09, 0.14, 0.12, 0.1, 0.09]
      }
    }
  });
  const onAudit = makeAudit({
    metrics: {
      itczWidthDeg: 25.84,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531
    },
    profiles: {
      latitudesDeg,
      series: {
        dryingOmegaBridgeAppliedPaS: [0, 0.001, 0.0015, 0, 0, 0],
        dryingOmegaBridgeLocalAppliedPaS: [0, 0.001, 0.0015, 0, 0, 0],
        dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0, 0, 0],
        lowerTroposphericOmegaPaS: [0.01, 0.011, 0.021, 0.03, 0.04, 0.04],
        midTroposphericOmegaPaS: [0.001, 0.001, 0.002, 0.003, 0.004, 0.004],
        upperTroposphericOmegaPaS: [0, 0, 0.001, 0.001, 0.002, 0.002],
        wind10mU: [0.1, 0.2, 0.3, 0.4, 0.5, 0.55],
        stormTrackIndex: [0.00001, 0.00001, 0.00002, 0.00003, 0.00005, 0.00005],
        largeScaleCondensationSourceKgM2: [0.095, 0.088, 0.13, 0.118, 0.1, 0.09]
      }
    }
  });

  const summary = buildPhase1WTransitionOmegaCarrierAttribution({
    baselineMetrics: { itczWidthDeg: 23.646, subtropicalDryNorthRatio: 1.1, midlatitudeWesterliesNorthU10Ms: 1.192 },
    offMetrics: offAudit.samples[0].metrics,
    onMetrics: onAudit.samples[0].metrics,
    offSample: offAudit.samples[0],
    onSample: onAudit.samples[0],
    paths: { baselinePath: 'baseline.json', offPath: 'off.json', onPath: 'on.json' }
  });

  assert.equal(summary.verdict, 'projected_share_unapplied_before_transition_entry');
  assert.equal(summary.nextPhase, 'Phase 1X: Projected-Share Application Repair');
  assert.equal(summary.bandDiagnostics.targetEntryNorth.projectedBridgeOnPaS, 0);
  assert.ok(summary.ranking[0].score >= summary.ranking[1].score);
});
