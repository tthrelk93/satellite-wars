import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1YEquatorwardAbsorptionGuardDesign
} from '../../scripts/agent/phase1y-equatorward-absorption-guard-design.mjs';

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

test('phase 1Y ranks remote shoulder absorption ahead of direct bridge leak', () => {
  const latitudesDeg = [3.75, 11.25, 18.75, 26.25, 33.75, 41.25];
  const offAudit = makeAudit({
    metrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531
    },
    profiles: {
      latitudesDeg,
      series: {
        largeScaleCondensationSourceKgM2: [0.08, 0.13, 0.1, 0.125, 0.185, 0.248],
        lowerTroposphericOmegaPaS: [0.125, 0.173, 0.437, 0.275, -0.308, -0.368],
        midTroposphericOmegaPaS: [0.15, 0.174, 0.448, 0.316, -0.294, -0.396],
        dryingOmegaBridgeLocalAppliedPaS: [0, 0, 0, 0, 0, 0],
        dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0, 0, 0],
        stormTrackIndex: [0.00001, 0.00001, 0.00001, 0.00005, 0.00011, 0.00015],
        wind10mU: [-0.68, -1.14, -0.33, 1.36, -0.09, 0.22]
      }
    }
  });
  const onAudit = makeAudit({
    metrics: {
      itczWidthDeg: 25.839,
      subtropicalDryNorthRatio: 1.517,
      subtropicalDrySouthRatio: 1.194,
      midlatitudeWesterliesNorthU10Ms: 0.531
    },
    profiles: {
      latitudesDeg,
      series: {
        largeScaleCondensationSourceKgM2: [0.096, 0.149, 0.103, 0.116, 0.185, 0.248],
        lowerTroposphericOmegaPaS: [0.125, 0.173, 0.438, 0.275, -0.309, -0.368],
        midTroposphericOmegaPaS: [0.149, 0.174, 0.448, 0.316, -0.295, -0.395],
        dryingOmegaBridgeLocalAppliedPaS: [0, 0, 0.00205, 0.00063, 0.00038, 0],
        dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0, 0.00065, 0.00018],
        stormTrackIndex: [0.00001, 0.00001, 0.00001, 0.00005, 0.00011, 0.00015],
        wind10mU: [-0.68, -1.14, -0.33, 1.36, -0.09, 0.22]
      }
    }
  });

  const summary = buildPhase1YEquatorwardAbsorptionGuardDesign({
    baselineMetrics: { itczWidthDeg: 23.646, subtropicalDryNorthRatio: 1.1, midlatitudeWesterliesNorthU10Ms: 1.192 },
    offMetrics: offAudit.samples[0].metrics,
    onMetrics: onAudit.samples[0].metrics,
    offSample: offAudit.samples[0],
    onSample: onAudit.samples[0],
    paths: { baselinePath: 'baseline.json', offPath: 'off.json', onPath: 'on.json' }
  });

  assert.equal(summary.verdict, 'remote_shoulder_absorption');
  assert.equal(summary.nextPhase, 'Phase 1Z: Implement Shoulder Absorption Guard Patch');
  assert.equal(summary.shoulderPeak.latitudeDeg, 11.25);
  assert.equal(summary.shoulderPeak.projectedBridgeOnPaS, 0);
  assert.ok(summary.ranking[0].score >= summary.ranking[1].score);
});
