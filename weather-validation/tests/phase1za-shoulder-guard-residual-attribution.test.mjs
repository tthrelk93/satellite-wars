import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZAResidualAttribution } from '../../scripts/agent/phase1za-shoulder-guard-residual-attribution.mjs';

test('phase 1ZA attribution ranks the equatorial shoulder miss ahead of the false-positive lane when 3.75N is untouched', () => {
  const latitudesDeg = [3.75, 11.25, 26.25, 33.75];
  const offAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.834,
        subtropicalDryNorthRatio: 1.515,
        subtropicalDrySouthRatio: 1.192,
        midlatitudeWesterliesNorthU10Ms: 0.531
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.07641, 0.12779, 0.12559, 0.18497],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0.07336, 0, 0.12706],
          shoulderAbsorptionGuardPotentialSuppressedMassKgM2: [0, 0.0031, 0, 0.02785],
          shoulderAbsorptionGuardEventCount: [0, 1.14583, 0, 2.60417],
          shoulderAbsorptionGuardBridgeSilenceFrac: [0, 0.07336, 0, 0.12706],
          shoulderAbsorptionGuardBandWindowFrac: [0, 0.01113, 0, 0.12703],
          shoulderAbsorptionGuardSelectorSupportFrac: [0, 0.00564, 0, 0.05063],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0],
          dryingOmegaBridgeLocalAppliedPaS: [0, 0, 0, 0],
          dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0],
          wind10mU: [-0.677, -1.14, 1.357, -0.089]
        }
      }
    }]
  };
  const onAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.792,
        subtropicalDryNorthRatio: 1.508,
        subtropicalDrySouthRatio: 1.193,
        midlatitudeWesterliesNorthU10Ms: 0.531
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.10207, 0.14696, 0.11529, 0.13135],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0.09505, 0, 0.07203],
          shoulderAbsorptionGuardPotentialSuppressedMassKgM2: [0, 0.00331, 0, 0.01584],
          shoulderAbsorptionGuardEventCount: [0, 1.35417, 0, 1.72917],
          shoulderAbsorptionGuardBridgeSilenceFrac: [0, 0.09505, 0, 0.07203],
          shoulderAbsorptionGuardBandWindowFrac: [0, 0.01442, 0, 0.07201],
          shoulderAbsorptionGuardSelectorSupportFrac: [0, 0.00602, 0, 0.0288],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0.0053, 0, 0.0141],
          dryingOmegaBridgeLocalAppliedPaS: [0, 0, 0, 0],
          dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0],
          wind10mU: [-0.677, -1.14, 1.357, -0.09]
        }
      }
    }]
  };

  const summary = buildPhase1ZAResidualAttribution({
    offAudit,
    onAudit,
    paths: {
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'equatorial_edge_shoulder_miss');
  assert.equal(summary.ranking[0].key, 'equatorial_edge_shoulder_miss');
  assert.equal(summary.nextPhase, 'Phase 1ZB: Latitude-Aware Shoulder Guard Redesign');
  assert.match(summary.redesignContract.likelyImplementationNeed, /latitude-aware discriminator/);
});
