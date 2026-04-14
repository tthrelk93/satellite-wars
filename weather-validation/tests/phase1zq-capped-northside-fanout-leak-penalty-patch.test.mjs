import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZQCappedNorthsideFanoutLeakPenaltyPatch } from '../../scripts/agent/phase1zq-capped-northside-fanout-leak-penalty-patch.mjs';

test('phase 1ZQ reports an inert northside leak penalty when source support stays live but penalty admission is zero', () => {
  const makeAudit = (penalty) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.905,
          subtropicalDryNorthRatio: 1.533,
          subtropicalDrySouthRatio: 1.197,
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1544,
          midlatitudeWesterliesNorthU10Ms: 0.531
        },
        profiles: {
          latitudesDeg: [-3.75, 3.75, 11.25, 18.75, 26.25],
          series: {
            largeScaleCondensationSourceKgM2: [0.05851, 0.1083, 0.13552, 0.11945, 0.12644],
            equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0.00054, 0.00072, 0, 0, 0],
            equatorialEdgeNorthsideLeakPenaltyDiagFrac: [0, 0, penalty, 0, 0],
            equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0, 0, 0.13665, 0, 0],
            equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: [0.47609, 0.41485, 0, 0, 0],
            totalColumnWaterKgM2: [38.439, 43.866, 43.212, 38.413, 37.462],
            boundaryLayerRhFrac: [0.57, 0.544, 0.547, 0.479, 0.563],
            lowerTroposphericOmegaPaS: [0.1468, 0.12466, 0.17391, 0.43987, 0.26979]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZQCappedNorthsideFanoutLeakPenaltyPatch({
    offAudit: makeAudit(0),
    onAudit: makeAudit(0),
    phase1zpSummary: {
      verdict: 'northside_source_leak_penalty_preferred',
      ranking: [{ key: 'northside_source_leak_penalty' }]
    },
    paths: {
      offPath: '/tmp/phase1zq-off.json',
      onPath: '/tmp/phase1zq-on.json',
      phase1zpPath: '/tmp/phase1zp.json',
      reportPath: '/tmp/phase1zq.md',
      jsonPath: '/tmp/phase1zq.json'
    }
  });

  assert.equal(summary.verdict, 'northside_leak_penalty_inert_zero_live_admission');
  assert.equal(summary.keepPatch, false);
  assert.equal(summary.nextPhase, 'Phase 1ZR: Northside Leak Penalty Admission Attribution');
  assert.equal(summary.slices.northSource.on.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac, 0.13665);
  assert.equal(summary.slices.northSource.on.equatorialEdgeNorthsideLeakPenaltyDiagFrac, 0);
});
