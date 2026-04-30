import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZTSouthMirrorReboundAttribution } from '../../scripts/agent/phase1zt-south-mirror-rebound-attribution.mjs';

test('phase 1ZT identifies south rebound as cross-equatorial compensation rather than local recharge', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.905 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.533 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.197 + (overrides.subtropicalDrySouthRatio || 0),
          crossEquatorialVaporFluxNorthKgM_1S: 144.21014 + (overrides.crossEq || 0),
          tropicalShoulderLargeScaleCondensationMeanKgM2: 0.12104 + (overrides.tropicalShoulder || 0),
          equatorialPrecipMeanMmHr: 0.138 + (overrides.eqPrecip || 0)
        },
        profiles: {
          latitudesDeg: [-11.25, -3.75, 3.75, 11.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.10715 + (overrides.southSourceCond || 0),
              0.05851 + (overrides.southEdgeCond || 0),
              0.1083 + (overrides.northEdgeCond || 0),
              0.13552 + (overrides.northSourceCond || 0)
            ],
            totalColumnWaterKgM2: [
              36.559 + (overrides.southSourceTcw || 0),
              38.439 + (overrides.southEdgeTcw || 0),
              43.866,
              43.212
            ],
            boundaryLayerRhFrac: [
              0.669 + (overrides.southSourceBlRh || 0),
              0.57 + (overrides.southEdgeBlRh || 0),
              0.544,
              0.547
            ],
            midTroposphericRhFrac: [0.554, 0.41, 0.442, 0.406],
            lowerTroposphericOmegaPaS: [
              -0.0928 + (overrides.southSourceOmega || 0),
              0.1468 + (overrides.southEdgeOmega || 0),
              0.12466,
              0.17391
            ],
            resolvedAscentCloudBirthPotentialKgM2: [0.03185, 0.02492, 0.02185, 0.02394],
            precipRateMmHr: [0.152, 0.103, 0.14, 0.156],
            cloudTotalFraction: [0.755, 0.778, 0.824, 0.788]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZTSouthMirrorReboundAttribution({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: 0.007,
      subtropicalDryNorthRatio: 0.002,
      subtropicalDrySouthRatio: 0.002,
      crossEq: -0.21439,
      tropicalShoulder: -0.01354,
      eqPrecip: -0.001,
      southSourceCond: 0.02648,
      southEdgeCond: 0.00309,
      northEdgeCond: -0.00682,
      northSourceCond: -0.02383,
      southSourceTcw: -0.002,
      southEdgeTcw: -0.008,
      southSourceBlRh: -0.001,
      southEdgeBlRh: 0,
      southSourceOmega: 0.00016,
      southEdgeOmega: 0.00006
    }),
    phase1zsSummary: {
      verdict: 'northside_gate_live_with_south_mirror_regression',
      keepPatch: false
    },
    paths: {
      offPath: '/tmp/phase1zs-off.json',
      onPath: '/tmp/phase1zs-on.json',
      phase1zsPath: '/tmp/phase1zs.json',
      reportPath: '/tmp/phase1zt.md',
      jsonPath: '/tmp/phase1zt.json'
    }
  });

  assert.equal(summary.verdict, 'cross_equatorial_compensation_without_local_recharge');
  assert.equal(summary.nextPhase, 'Phase 1ZU: Bilateral Balance Patch Design');
  assert.equal(summary.slices.southSource.delta.largeScaleCondensationSourceKgM2, 0.02648);
  assert.equal(summary.metrics.crossEquatorialVaporFluxNorthKgM_1S, -0.21439);
});
