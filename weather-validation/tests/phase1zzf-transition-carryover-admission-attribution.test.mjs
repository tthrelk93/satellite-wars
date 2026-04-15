import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZZFTransitionCarryoverAdmissionAttribution } from '../../scripts/agent/phase1zzf-transition-carryover-admission-attribution.mjs';

test('phase 1ZZF identifies omega support as the admission limiter when overlap and dry support are already live', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.905 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.533 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.197 + (overrides.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1544 + (overrides.northDryBeltOceanCond || 0),
          midlatitudeWesterliesNorthU10Ms: 0.531 + (overrides.midlatitudeWesterliesNorthU10Ms || 0),
          northsideLeakCarrierSignalMean: 0.06339 + (overrides.northsideLeakCarrierSignalMean || 0)
        },
        profiles: {
          latitudesDeg: [26.25, 18.75, 11.25, 3.75, -11.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.109 + (overrides.n26 || 0),
              0.104 + (overrides.n18 || 0),
              0.115 + (overrides.n11 || 0),
              0.102 + (overrides.n3 || 0),
              0.108 + (overrides.s11 || 0)
            ],
            carriedOverUpperCloudMassKgM2: [
              0.185 + (overrides.carry26 || 0),
              0.187 + (overrides.carry18 || 0),
              0.087 + (overrides.carry11 || 0),
              0.129 + (overrides.carry3 || 0),
              0.164 + (overrides.carryS11 || 0)
            ],
            subtropicalSubsidenceDryingFrac: [
              0.089 + (overrides.dry26 || 0),
              0.1267 + (overrides.dry18 || 0),
              0 + (overrides.dry11 || 0),
              0 + (overrides.dry3 || 0),
              0 + (overrides.dryS11 || 0)
            ],
            lowLevelOmegaEffectivePaS: [
              0.132 + (overrides.omega26 || 0),
              0.08 + (overrides.omega18 || 0),
              0.041 + (overrides.omega11 || 0),
              0.018 + (overrides.omega3 || 0),
              0.022 + (overrides.omegaS11 || 0)
            ],
            freshSubtropicalBandDiagFrac: [
              1,
              1,
              0.084,
              0,
              0.084
            ],
            freshNeutralToSubsidingSupportDiagFrac: [
              0.388,
              0.523,
              0.364,
              0.354,
              0.274
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
              0.00516 + (overrides.taper26 || 0),
              0,
              0,
              0,
              0
            ],
            atlanticDryCoreReceiverTaperAppliedDiag: [
              0.00141 + (overrides.taperApplied26 || 0),
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

  const summary = buildPhase1ZZFTransitionCarryoverAdmissionAttribution({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      n26: 0.00032,
      n18: 0.00166,
      n11: -0.0051,
      n3: -0.00869,
      s11: 0.0002
    }),
    paths: {
      offPath: '/tmp/phase1zzf-off.json',
      onPath: '/tmp/phase1zzf-on.json',
      reportPath: '/tmp/phase1zzf.md',
      jsonPath: '/tmp/phase1zzf.json'
    }
  });

  assert.equal(summary.keepPatch, false);
  assert.equal(summary.verdict, 'omega_support_below_transition_admission');
  assert.equal(summary.nextPhase, 'Phase 1ZZG: Transition Omega Admission Design');
  assert.equal(summary.gateInputs.carrierSignal, 0.06339);
  assert.equal(summary.gateInputs.overlapMass, 0.187);
  assert.equal(summary.gateInputs.dryDriver, 0.1267);
  assert.equal(summary.gateInputs.existingOmegaPaS, 0.08);
  assert.equal(summary.supportRanking[0].key, 'omegaSupport');
});
