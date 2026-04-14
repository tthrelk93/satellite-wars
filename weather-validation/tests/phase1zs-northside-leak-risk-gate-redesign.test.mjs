import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZSNorthsideLeakRiskGateRedesign } from '../../scripts/agent/phase1zs-northside-leak-risk-gate-redesign.mjs';

test('phase 1ZS recognizes a live northside gate with south-mirror climate regression', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.905 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.533 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.197 + (overrides.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1544 + (overrides.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0),
          midlatitudeWesterliesNorthU10Ms: 0.531 + (overrides.midlatitudeWesterliesNorthU10Ms || 0)
        },
        profiles: {
          latitudesDeg: [-11.25, -3.75, 3.75, 11.25, 18.75, 26.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.10715 + (overrides.southSourceDelta || 0),
              0.05851 + (overrides.southEdgeDelta || 0),
              0.1083 + (overrides.northEdgeDelta || 0),
              0.13552 + (overrides.northSourceDelta || 0),
              0.11945 + (overrides.northSpilloverDelta || 0),
              0.12644 + (overrides.northCoreDelta || 0)
            ],
            equatorialEdgeNorthsideLeakPenaltyDiagFrac: [
              0,
              0,
              0,
              overrides.northPenaltyOn || 0,
              0,
              0
            ],
            equatorialEdgeNorthsideLeakSourceWindowDiagFrac: [0, 0, 0, overrides.northWindowOn || 0, 0, 0],
            equatorialEdgeNorthsideLeakRiskDiagFrac: [0.12808, 0, 0, overrides.northRiskOn || 0, 0, 0],
            equatorialEdgeSubsidenceGuardAppliedDiagPaS: [0, 0.00054, 0.00057, 0, 0, 0]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZSNorthsideLeakRiskGateRedesign({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: 0.007,
      subtropicalDryNorthRatio: 0.002,
      subtropicalDrySouthRatio: 0.002,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: -0.00514,
      northEdgeDelta: -0.00682,
      northSourceDelta: -0.02383,
      northSpilloverDelta: -0.00997,
      northCoreDelta: -0.00011,
      southEdgeDelta: 0.00309,
      southSourceDelta: 0.02648,
      northPenaltyOn: 0.06225,
      northWindowOn: 0.45833,
      northRiskOn: 0.16907
    }),
    phase1zrSummary: {
      verdict: 'supported_subset_risk_below_gate',
      nextPhase: 'Phase 1ZS: Northside Leak Risk Gate Redesign'
    },
    paths: {
      offPath: '/tmp/phase1zs-off.json',
      onPath: '/tmp/phase1zs-on.json',
      phase1zrPath: '/tmp/phase1zr.json',
      reportPath: '/tmp/phase1zs.md',
      jsonPath: '/tmp/phase1zs.json'
    }
  });

  assert.equal(summary.verdict, 'northside_gate_live_with_south_mirror_regression');
  assert.equal(summary.keepPatch, false);
  assert.equal(summary.nextPhase, 'Phase 1ZT: South Mirror Rebound Attribution');
  assert.equal(summary.slices.northSource.on.equatorialEdgeNorthsideLeakPenaltyDiagFrac, 0.06225);
  assert.equal(summary.slices.southSource.delta.largeScaleCondensationSourceKgM2, 0.02648);
});
