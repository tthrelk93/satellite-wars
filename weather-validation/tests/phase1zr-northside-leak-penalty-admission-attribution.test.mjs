import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZRNorthsideLeakPenaltyAdmissionAttribution } from '../../scripts/agent/phase1zr-northside-leak-penalty-admission-attribution.mjs';

test('phase 1ZR identifies a live north source row whose supported subset still misses the leak-risk gate', () => {
  const audit = {
    samples: [
      {
        profiles: {
          latitudesDeg: [-11.25, 3.75, 11.25],
          series: {
            equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [0.10521, 0, 0.13665],
            equatorialEdgeNorthsideLeakSourceWindowDiagFrac: [0, 0, 0.45833],
            equatorialEdgeNorthsideLeakRiskDiagFrac: [0.12804, 0, 0.16908],
            equatorialEdgeNorthsideLeakPenaltyDiagFrac: [0, 0, 0],
            freshSubtropicalBandDiagFrac: [0.06111, 0, 0.08427],
            freshNeutralToSubsidingSupportDiagFrac: [0.288, 0, 0.36527],
            lowerTroposphericOmegaPaS: [-0.0928, 0.12466, 0.17391],
            largeScaleCondensationSourceKgM2: [0.10715, 0.1083, 0.13552]
          }
        }
      }
    ]
  };

  const summary = buildPhase1ZRNorthsideLeakPenaltyAdmissionAttribution({
    onAudit: audit,
    phase1zqSummary: {
      verdict: 'northside_leak_penalty_inert_zero_live_admission',
      keepPatch: false
    },
    paths: {
      onPath: '/tmp/phase1zr-on.json',
      phase1zqPath: '/tmp/phase1zq.json',
      reportPath: '/tmp/phase1zr.md',
      jsonPath: '/tmp/phase1zr.json'
    }
  });

  assert.equal(summary.verdict, 'supported_subset_risk_below_gate');
  assert.equal(summary.nextPhase, 'Phase 1ZS: Northside Leak Risk Gate Redesign');
  assert.equal(summary.scores.activeSourceFraction, 0.45833);
  assert.equal(summary.scores.activeSubsetRiskMean, 0.3689);
  assert.equal(summary.scores.riskMiss, 0.1811);
});
