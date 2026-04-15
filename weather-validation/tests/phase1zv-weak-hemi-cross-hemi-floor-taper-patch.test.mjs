import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZVWeakHemiCrossHemiFloorTaperPatch } from '../../scripts/agent/phase1zv-weak-hemi-cross-hemi-floor-taper-patch.mjs';

test('phase 1ZV keeps a weak-hemi floor taper when the main guardrails improve', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.912 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.535 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.199 + (overrides.subtropicalDrySouthRatio || 0),
          midlatitudeWesterliesNorthU10Ms: 0.531 + (overrides.midlatitudeWesterliesNorthU10Ms || 0),
          crossEquatorialVaporFluxNorthKgM_1S: 143.99575 + (overrides.crossEq || 0),
          tropicalShoulderLargeScaleCondensationMeanKgM2: 0.1075 + (overrides.shoulder || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14926 + (overrides.northDryBeltOceanCond || 0),
          southTransitionSubtropicalCrossHemiFloorShareMeanFrac: 0.24904 + (overrides.southFloorShare || 0),
          southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac: 0.14444 + (overrides.southOverhang || 0),
          southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac: 0 + (overrides.southTaper || 0),
          northTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac: 0 + (overrides.northTaper || 0)
        },
        profiles: {
          latitudesDeg: [-11.25, -3.75, 3.75, 11.25, 18.75, 26.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.13363 + (overrides.s11 || 0),
              0.0616 + (overrides.s3 || 0),
              0.10148 + (overrides.n3 || 0),
              0.11169 + (overrides.n11 || 0),
              0.17311 + (overrides.n18 || 0),
              0.15814 + (overrides.n26 || 0)
            ]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZVWeakHemiCrossHemiFloorTaperPatch({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: -0.072,
      subtropicalDryNorthRatio: -0.024,
      subtropicalDrySouthRatio: -0.004,
      crossEq: 1.21412,
      shoulder: 0.00423,
      northDryBeltOceanCond: -0.01518,
      southFloorShare: -0.12934,
      southOverhang: -0.06893,
      southTaper: 0.00691,
      s11: -0.0215,
      s3: 0.01019,
      n3: -0.00238,
      n11: 0.02481,
      n18: -0.01008,
      n26: -0.01896
    }),
    paths: {
      offPath: '/tmp/phase1zv-off.json',
      onPath: '/tmp/phase1zv-on.json',
      reportPath: '/tmp/phase1zv.md',
      jsonPath: '/tmp/phase1zv.json'
    }
  });

  assert.equal(summary.keepPatch, true);
  assert.equal(summary.verdict, 'guardrail_improvement_with_north_source_rebound');
  assert.equal(summary.nextPhase, 'Phase 1ZW: North Source Rebound Attribution');
  assert.equal(summary.metrics.subtropicalDryNorthRatio, -0.024);
  assert.equal(summary.condensationDeltas.northSource11N, 0.02481);
});
