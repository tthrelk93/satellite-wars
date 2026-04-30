import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZZBAtlanticReceiverEfficiencyTaperPatch } from '../../scripts/agent/phase1zzb-atlantic-receiver-efficiency-taper-patch.mjs';

test('phase 1ZZB rejects an Atlantic receiver taper that relieves 26.25N but spills into 18.75N', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.812 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.507 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.195 + (overrides.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13607 + (overrides.northDryBeltOceanCond || 0),
          midlatitudeWesterliesNorthU10Ms: 0.531 + (overrides.midlatitudeWesterliesNorthU10Ms || 0)
        },
        profiles: {
          latitudesDeg: [26.25, 18.75, 11.25, 3.75, -11.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.11577 + (overrides.n26 || 0),
              0.09515 + (overrides.n18 || 0),
              0.1059 + (overrides.n11 || 0),
              0.10659 + (overrides.n3 || 0),
              0.13865 + (overrides.s11 || 0)
            ],
            totalColumnWaterKgM2: [
              37.128 + (overrides.tcw26 || 0),
              37.994 + (overrides.tcw18 || 0),
              43.097 + (overrides.tcw11 || 0),
              43.912 + (overrides.tcw3 || 0),
              36.623 + (overrides.tcwS11 || 0)
            ],
            lowerTroposphericOmegaPaS: [
              0.27765 + (overrides.lowerOmega26 || 0),
              0.43713 + (overrides.lowerOmega18 || 0),
              0.17332 + (overrides.lowerOmega11 || 0),
              0.12441 + (overrides.lowerOmega3 || 0),
              -0.09425 + (overrides.lowerOmegaS11 || 0)
            ],
            midTroposphericRhFrac: [
              0.398 + (overrides.midRh26 || 0),
              0.372 + (overrides.midRh18 || 0),
              0.398 + (overrides.midRh11 || 0),
              0.439 + (overrides.midRh3 || 0),
              0.555 + (overrides.midRhS11 || 0)
            ],
            atlanticDryCoreReceiverTaperDiagFrac: [
              0 + (overrides.taper26 || 0),
              0,
              0,
              0,
              0
            ],
            atlanticDryCoreReceiverTaperAppliedDiag: [
              0 + (overrides.applied26 || 0),
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

  const summary = buildPhase1ZZBAtlanticReceiverEfficiencyTaperPatch({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: 0.077,
      subtropicalDryNorthRatio: 0.017,
      subtropicalDrySouthRatio: 0.003,
      northDryBeltOceanCond: -0.00039,
      n26: -0.0097,
      n18: 0.00891,
      n11: 0.00146,
      n3: -0.00869,
      s11: -0.03123,
      taper26: 0.00595,
      applied26: 0.00164,
      tcw26: 0.308,
      lowerOmega26: -0.00626,
      midRh26: 0.014,
      tcw18: 0.342,
      lowerOmega18: 0.00268,
      midRh18: 0.011
    }),
    paths: {
      offPath: '/tmp/phase1zzb-off.json',
      onPath: '/tmp/phase1zzb-on.json',
      reportPath: '/tmp/phase1zzb.md',
      jsonPath: '/tmp/phase1zzb.json'
    }
  });

  assert.equal(summary.keepPatch, false);
  assert.equal(summary.verdict, 'atlantic_receiver_relief_with_transition_spillover');
  assert.equal(summary.nextPhase, 'Phase 1ZZC: Atlantic Receiver Spillover Attribution');
  assert.equal(summary.laneDeltas.atlanticReceiver26N, -0.0097);
  assert.equal(summary.laneDeltas.spillover18N, 0.00891);
  assert.equal(summary.liveState.atlanticReceiverTaper26N, 0.00595);
});
