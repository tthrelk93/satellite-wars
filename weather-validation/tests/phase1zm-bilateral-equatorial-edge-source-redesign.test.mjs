import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZMBilateralEquatorialEdgeSourceRedesign } from '../../scripts/agent/phase1zm-bilateral-equatorial-edge-source-redesign.mjs';

test('phase 1ZM identifies signed-latitude window inheritance as the bilateral source failure', () => {
  const summary = buildPhase1ZMBilateralEquatorialEdgeSourceRedesign({
    phase1zlSummary: {
      slices: {
        southSource: {
          on: {
            equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: 0,
            freshShoulderInnerWindowDiagFrac: 0
          }
        },
        northSource: {
          on: {
            equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: 0.1367,
            freshShoulderInnerWindowDiagFrac: 1
          }
        },
        southEdge: {
          on: {
            equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: 0,
            equatorialEdgeSubsidenceGuardAppliedDiagPaS: 0,
            freshShoulderEquatorialEdgeWindowDiagFrac: 0
          },
          delta: {
            largeScaleCondensationSourceKgM2: 0.00126
          }
        },
        northEdge: {
          on: {
            equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: 0.41491,
            equatorialEdgeSubsidenceGuardAppliedDiagPaS: 0.00072,
            freshShoulderEquatorialEdgeWindowDiagFrac: 1
          },
          delta: {
            largeScaleCondensationSourceKgM2: 0.00657
          }
        },
        targetEntry: {
          on: {
            freshShoulderTargetEntryExclusionDiagFrac: 1
          }
        }
      }
    },
    paths: {
      phase1zlPath: '/tmp/phase1zl.json',
      reportPath: '/tmp/phase1zm.md',
      jsonPath: '/tmp/phase1zm.json'
    }
  });

  assert.equal(summary.verdict, 'signed_latitude_window_inheritance');
  assert.equal(summary.nextPhase, 'Phase 1ZN: Implement Mirrored Bilateral Edge-Source Window Patch');
  assert.equal(summary.inheritedFailure.sourceMirrorGap, 0.1367);
  assert.equal(summary.inheritedFailure.targetMirrorGap, 0.41491);
  assert.equal(summary.inheritedFailure.appliedMirrorGap, 0.00072);
  assert.equal(summary.evidence.southSource.freshShoulderInnerWindowDiagFrac, 0);
  assert.equal(summary.evidence.northSource.freshShoulderInnerWindowDiagFrac, 1);
  assert.equal(summary.evidence.southEdge.freshShoulderEquatorialEdgeWindowDiagFrac, 0);
  assert.equal(summary.evidence.northEdge.freshShoulderEquatorialEdgeWindowDiagFrac, 1);
});
