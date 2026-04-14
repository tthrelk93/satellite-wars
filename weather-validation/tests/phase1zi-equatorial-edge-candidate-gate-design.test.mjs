import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZIEquatorialEdgeCandidateGateDesign } from '../../scripts/agent/phase1zi-equatorial-edge-candidate-gate-design.mjs';

test('phase 1ZI selects a split-lane gate when only the equatorial edge still rebounds', () => {
  const phase1zbReportText = `
## Key Slices

- shoulder \`3.75°N\`: off candidate \`0.04151\`, on candidate \`0.06893\`, on applied \`0.0122\`, on latitude window \`1\`
- shoulder \`11.25°N\`: on candidate \`0.12488\`, on applied \`0.02496\`, on latitude window \`1\`
- target entry \`33.75°N\`: off/on candidate \`0\` / \`0\`, off/on applied \`0\` / \`0\`, on exclusion \`1\`
`;

  const phase1zgSummary = {
    slices: {
      equatorialEdge: {
        deltas: {
          largeScaleCondensationSourceKgM2: 0.04637,
          shoulderAbsorptionGuardCandidateMassKgM2: 0.0701,
          shoulderAbsorptionGuardEventCount: 0.52084,
          shoulderAbsorptionGuardAppliedSuppressionKgM2: 0.02352
        }
      },
      innerShoulder: {
        deltas: {
          largeScaleCondensationSourceKgM2: -0.03849
        }
      },
      spillover: {
        deltas: {
          largeScaleCondensationSourceKgM2: -0.01806
        }
      },
      targetEntry: {
        on: {
          shoulderAbsorptionGuardAppliedSuppressionKgM2: 0
        }
      }
    }
  };

  const phase1zhSummary = {
    verdict: 'raw_equatorial_edge_candidate_rebound',
    conclusion: 'The remaining shoulder failure is no longer suppressed-mass fate or selector leakage.'
  };

  const summary = buildPhase1ZIEquatorialEdgeCandidateGateDesign({
    phase1zbReportText,
    phase1zgSummary,
    phase1zhSummary,
    paths: {
      phase1zbPath: '/tmp/1zb.md',
      phase1zgPath: '/tmp/1zg.json',
      phase1zhPath: '/tmp/1zh.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'single_lane_geometry_overadmits_equatorial_edge');
  assert.equal(summary.nextPhase, 'Phase 1ZJ: Implement Split-Lane Equatorial-Edge Candidate Gate Patch');
  assert.equal(summary.designChoice.key, 'split_lane_subtropical_support_gate');
  assert.ok((summary.evidence.phase1zg.edgeCandidateDeltaKgM2 || 0) > 0);
  assert.ok((summary.evidence.phase1zg.innerCondensationDeltaKgM2 || 0) < 0);
  assert.equal(summary.evidence.phase1zg.targetEntryAppliedSuppressionKgM2, 0);
});
