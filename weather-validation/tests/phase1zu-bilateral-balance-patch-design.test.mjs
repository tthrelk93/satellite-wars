import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZUBilateralBalancePatchDesign } from '../../scripts/agent/phase1zu-bilateral-balance-patch-design.mjs';

test('phase 1ZU identifies weak-hemi cross-hemi floor overhang and chooses floor taper patch family', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.905 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.533 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.197 + (overrides.subtropicalDrySouthRatio || 0),
          crossEquatorialVaporFluxNorthKgM_1S: 144.21014 + (overrides.crossEq || 0),
          equatorialPrecipMeanMmHr: 0.138 + (overrides.eqPrecip || 0),
          northTransitionSubtropicalLocalHemiSourceMeanFrac: 0.16842 + (overrides.northLocal || 0),
          northTransitionSubtropicalMeanTropicalSourceMeanFrac: 0.10765 + (overrides.northMean || 0),
          northTransitionSubtropicalCrossHemiFloorShareMeanFrac: 0 + (overrides.northFloorShare || 0),
          southTransitionSubtropicalLocalHemiSourceMeanFrac: 0.04689 + (overrides.southLocal || 0),
          southTransitionSubtropicalMeanTropicalSourceMeanFrac: 0.10765 + (overrides.southMean || 0),
          southTransitionSubtropicalSourceDriverFloorMeanFrac: 0.06244 + (overrides.southFloor || 0),
          southTransitionSubtropicalCrossHemiFloorShareMeanFrac: 0.24904 + (overrides.southFloorShare || 0),
          southTransitionSubtropicalWeakHemiFracMean: 0.56444 + (overrides.southWeakHemi || 0)
        },
        profiles: {
          latitudesDeg: [-11.25, 11.25],
          series: {
            equatorialEdgeNorthsideLeakPenaltyDiagFrac: [
              0 + (overrides.southLeak || 0),
              0 + (overrides.northLeak || 0)
            ]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZUBilateralBalancePatchDesign({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: 0.007,
      subtropicalDryNorthRatio: 0.002,
      subtropicalDrySouthRatio: 0.002,
      crossEq: -0.21439,
      eqPrecip: -0.001,
      northLeak: 0.06225
    }),
    phase1ztSummary: {
      verdict: 'cross_equatorial_compensation_without_local_recharge',
      nextPhase: 'Phase 1ZU: Bilateral Balance Patch Design',
      slices: {
        northSource: { delta: { largeScaleCondensationSourceKgM2: -0.02383 } },
        northEdge: { delta: { largeScaleCondensationSourceKgM2: -0.00682 } },
        southSource: { delta: { largeScaleCondensationSourceKgM2: 0.02648 } },
        southEdge: { delta: { largeScaleCondensationSourceKgM2: 0.00309 } }
      }
    },
    paths: {
      offPath: '/tmp/phase1zs-off.json',
      onPath: '/tmp/phase1zs-on.json',
      phase1ztPath: '/tmp/phase1zt.json',
      reportPath: '/tmp/phase1zu.md',
      jsonPath: '/tmp/phase1zu.json'
    }
  });

  assert.equal(summary.verdict, 'weak_hemi_crosshemi_floor_overhang');
  assert.equal(summary.nextPhase, 'Phase 1ZV: Implement Weak-Hemisphere Cross-Hemi Floor Taper Patch');
  assert.equal(summary.liveBalanceState.northsideLeakPenalty11N, 0.06225);
  assert.equal(summary.overhangAnalysis.southNeutralCrossHemiFloorFrac, 0.43558);
  assert.equal(summary.overhangAnalysis.weakHemiFloorOverhangFrac, 0.14445);
  assert.equal(summary.overhangAnalysis.southMirrorNetCondDelta, 0.02957);
});
