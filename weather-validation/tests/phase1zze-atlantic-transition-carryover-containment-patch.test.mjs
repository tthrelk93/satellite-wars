import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZZEAtlanticTransitionCarryoverContainmentPatch } from '../../scripts/agent/phase1zze-atlantic-transition-carryover-containment-patch.mjs';

test('phase 1ZZE keeps a receiver bundle only when transition spillover and guardrails both improve', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.889 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.524 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.198 + (overrides.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13646 + (overrides.northDryBeltOceanCond || 0),
          midlatitudeWesterliesNorthU10Ms: 0.531 + (overrides.midlatitudeWesterliesNorthU10Ms || 0)
        },
        profiles: {
          latitudesDeg: [26.25, 18.75, 11.25, 3.75, -11.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.10607 + (overrides.n26 || 0),
              0.10406 + (overrides.n18 || 0),
              0.10736 + (overrides.n11 || 0),
              0.0979 + (overrides.n3 || 0),
              0.10742 + (overrides.s11 || 0)
            ],
            importedAnvilPersistenceMassKgM2: [
              0.17318 + (overrides.imp26 || 0),
              0.16857 + (overrides.imp18 || 0),
              0.061 + (overrides.imp11 || 0),
              0.028 + (overrides.imp3 || 0),
              0.019 + (overrides.impS11 || 0)
            ],
            carriedOverUpperCloudMassKgM2: [
              0.17318 + (overrides.carry26 || 0),
              0.16857 + (overrides.carry18 || 0),
              0.061 + (overrides.carry11 || 0),
              0.028 + (overrides.carry3 || 0),
              0.019 + (overrides.carryS11 || 0)
            ],
            weakErosionCloudSurvivalMassKgM2: [
              0.17117 + (overrides.weak26 || 0),
              0.16621 + (overrides.weak18 || 0),
              0.059 + (overrides.weak11 || 0),
              0.027 + (overrides.weak3 || 0),
              0.018 + (overrides.weakS11 || 0)
            ],
            upperCloudPathKgM2: [
              0.14657 + (overrides.path26 || 0),
              0.17124 + (overrides.path18 || 0),
              0.082 + (overrides.path11 || 0),
              0.049 + (overrides.path3 || 0),
              0.031 + (overrides.pathS11 || 0)
            ],
            atlanticTransitionCarryoverContainmentDiagFrac: [
              0,
              0 + (overrides.containment18 || 0),
              0,
              0,
              0
            ],
            atlanticTransitionCarryoverContainmentAppliedDiag: [
              0,
              0 + (overrides.applied18 || 0),
              0,
              0,
              0
            ],
            atlanticDryCoreReceiverTaperDiagFrac: [
              0.00595 + (overrides.taper26 || 0),
              0,
              0,
              0,
              0
            ],
            atlanticDryCoreReceiverTaperAppliedDiag: [
              0.00164 + (overrides.taperApplied26 || 0),
              0,
              0,
              0,
              0
            ]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZZEAtlanticTransitionCarryoverContainmentPatch({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: -0.02,
      subtropicalDryNorthRatio: -0.01,
      subtropicalDrySouthRatio: -0.005,
      northDryBeltOceanCond: -0.003,
      n26: -0.004,
      n18: -0.007,
      n11: -0.002,
      n3: -0.001,
      s11: 0,
      imp18: -0.02,
      carry18: -0.02,
      weak18: -0.018,
      path18: -0.021,
      containment18: 0.061,
      applied18: 0.014,
      taper26: 0,
      taperApplied26: 0
    }),
    paths: {
      offPath: '/tmp/phase1zze-off.json',
      onPath: '/tmp/phase1zze-on.json',
      reportPath: '/tmp/phase1zze.md',
      jsonPath: '/tmp/phase1zze.json'
    }
  });

  assert.equal(summary.keepPatch, true);
  assert.equal(summary.verdict, 'atlantic_transition_carryover_containment_kept');
  assert.equal(summary.nextPhase, 'Phase 1ZZF: Residual Post-Atlantic Transition Containment Attribution');
  assert.equal(summary.laneDeltas.receiver26N, -0.004);
  assert.equal(summary.laneDeltas.spillover18N, -0.007);
  assert.equal(summary.liveState.transitionContainmentApplied18N, 0.014);
});
