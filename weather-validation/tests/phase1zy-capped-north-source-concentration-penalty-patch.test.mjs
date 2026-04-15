import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZYCappedNorthSourceConcentrationPenaltyPatch } from '../../scripts/agent/phase1zy-capped-north-source-concentration-penalty-patch.mjs';

test('phase 1ZY rejects a source cap that improves 11.25N but redistributes into the dry-belt core', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.84 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.511 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.195 + (overrides.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13408 + (overrides.northDryBeltOceanCond || 0),
          midlatitudeWesterliesNorthU10Ms: 0.531 + (overrides.midlatitudeWesterliesNorthU10Ms || 0),
          crossEquatorialVaporFluxNorthKgM_1S: 145.20987 + (overrides.crossEq || 0)
        },
        profiles: {
          latitudesDeg: [26.25, 18.75, 11.25, 3.75, -3.75, -11.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.10737 + (overrides.n26 || 0),
              0.0994 + (overrides.n18 || 0),
              0.1365 + (overrides.n11 || 0),
              0.0991 + (overrides.n3 || 0),
              0.07179 + (overrides.s3 || 0),
              0.11213 + (overrides.s11 || 0)
            ],
            northSourceConcentrationPenaltyDiagFrac: [
              0,
              0,
              0 + (overrides.penalty11 || 0),
              0,
              0,
              0
            ],
            northSourceConcentrationAppliedDiag: [
              0,
              0,
              0 + (overrides.applied11 || 0),
              0,
              0,
              0
            ],
            equatorialEdgeNorthsideLeakPenaltyDiagFrac: [
              0,
              0,
              0.06339 + (overrides.leak11 || 0),
              0,
              0,
              0
            ],
            totalColumnWaterKgM2: [
              37.25 + (overrides.tcw26 || 0),
              38.129 + (overrides.tcw18 || 0),
              43.127 + (overrides.tcw11 || 0),
              43.87 + (overrides.tcw3 || 0),
              38.477 + (overrides.tcwS3 || 0),
              36.606 + (overrides.tcwS11 || 0)
            ],
            lowerTroposphericOmegaPaS: [
              0.27532,
              0.43815,
              0.17338 + (overrides.lowerOmega11 || 0),
              0.12483,
              0.145,
              -0.09376
            ],
            midTroposphericOmegaPaS: [
              0.31613,
              0.44885,
              0.17431 + (overrides.midOmega11 || 0),
              0.14926,
              0.17391,
              -0.1064
            ]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZYCappedNorthSourceConcentrationPenaltyPatch({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: -0.028,
      subtropicalDryNorthRatio: -0.004,
      northDryBeltOceanCond: 0.00199,
      crossEq: 0.33263,
      n26: 0.0084,
      n18: -0.00425,
      n11: -0.0306,
      n3: 0.00749,
      s3: 0.00001,
      s11: 0.02652,
      penalty11: 0.00583,
      applied11: 0.0022,
      leak11: 0.00035,
      tcw11: -0.03,
      lowerOmega11: -0.00006,
      midOmega11: -0.00033
    }),
    paths: {
      offPath: '/tmp/phase1zy-off.json',
      onPath: '/tmp/phase1zy-on.json',
      reportPath: '/tmp/phase1zy.md',
      jsonPath: '/tmp/phase1zy.json'
    }
  });

  assert.equal(summary.keepPatch, false);
  assert.equal(summary.verdict, 'north_source_relief_with_dry_core_redistribution');
  assert.equal(summary.nextPhase, 'Phase 1ZZ: Source-Cap Redistribution Attribution');
  assert.equal(summary.sourceLaneDeltas.source11N, -0.0306);
  assert.equal(summary.sourceLaneDeltas.dryCore26N, 0.0084);
  assert.equal(summary.liveState.northSourcePenalty11N, 0.00583);
});
