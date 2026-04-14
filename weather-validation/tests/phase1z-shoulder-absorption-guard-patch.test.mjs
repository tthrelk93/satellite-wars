import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZShoulderAbsorptionGuardPatch } from '../../scripts/agent/phase1z-shoulder-absorption-guard-patch.mjs';

test('phase 1Z summary passes when the shoulder core dries and target-entry bridge stays alive', () => {
  const latitudesDeg = [3.75, 11.25, 26.25, 33.75, 48.75];
  const offSample = {
    profiles: {
      latitudesDeg,
      series: {
        largeScaleCondensationSourceKgM2: [0.09, 0.15, 0.12, 0.18, 0.04],
        shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0, 0],
        dryingOmegaBridgeLocalAppliedPaS: [0, 0, 0.0006, 0.0002, 0],
        dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0.0006, 0.0002],
        wind10mU: [0.4, 0.41, 0.5, 0.53, 0.6]
      }
    }
  };
  const onSample = {
    profiles: {
      latitudesDeg,
      series: {
        largeScaleCondensationSourceKgM2: [0.08, 0.11, 0.119, 0.179, 0.04],
        shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.01, 0.018, 0.002, 0, 0],
        dryingOmegaBridgeLocalAppliedPaS: [0, 0, 0.0006, 0.0002, 0],
        dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0.0006, 0.0002],
        wind10mU: [0.4, 0.41, 0.5, 0.53, 0.6]
      }
    }
  };

  const summary = buildPhase1ZShoulderAbsorptionGuardPatch({
    baselineMetrics: {
      itczWidthDeg: 23.646,
      subtropicalDryNorthRatio: 1.1,
      midlatitudeWesterliesNorthU10Ms: 1.192
    },
    offMetrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531
    },
    onMetrics: {
      itczWidthDeg: 25.8,
      subtropicalDryNorthRatio: 1.5,
      subtropicalDrySouthRatio: 1.19,
      midlatitudeWesterliesNorthU10Ms: 0.531
    },
    offSample,
    onSample,
    paths: {
      baselinePath: '/tmp/base.json',
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'kept_patch');
  assert.equal(summary.exitCriteria.shoulderCondensationPass, true);
  assert.equal(summary.exitCriteria.targetEntryProjectedBridgePass, true);
  assert.ok((summary.bandDiagnostics.tropicalShoulderCoreNorth.guardAppliedOnKgM2 || 0) > 0);
});
