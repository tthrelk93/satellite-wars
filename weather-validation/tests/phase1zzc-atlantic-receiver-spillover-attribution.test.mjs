import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZZCAtlanticReceiverSpilloverAttribution } from '../../scripts/agent/phase1zzc-atlantic-receiver-spillover-attribution.mjs';

test('phase 1ZZC attributes 18.75N spillover to carryover maintenance instead of fresh source recharge', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.812 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.507 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.195 + (overrides.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13607 + (overrides.northDryBeltOceanCond || 0)
        },
        profiles: {
          latitudesDeg: [26.25, 18.75, 11.25, 3.75],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.11577 + (overrides.n26 || 0),
              0.09515 + (overrides.n18 || 0),
              0.1059 + (overrides.n11 || 0),
              0.10659 + (overrides.n3 || 0)
            ],
            totalColumnWaterKgM2: [
              37.128 + (overrides.tcw26 || 0),
              37.994 + (overrides.tcw18 || 0),
              43.097 + (overrides.tcw11 || 0),
              43.912 + (overrides.tcw3 || 0)
            ],
            lowerTroposphericOmegaPaS: [
              0.27765 + (overrides.omega26 || 0),
              0.43713 + (overrides.omega18 || 0),
              0.17332 + (overrides.omega11 || 0),
              0.12441 + (overrides.omega3 || 0)
            ],
            midTroposphericRhFrac: [
              0.398 + (overrides.midRh26 || 0),
              0.372 + (overrides.midRh18 || 0),
              0.398 + (overrides.midRh11 || 0),
              0.439 + (overrides.midRh3 || 0)
            ],
            surfaceEvapRateMmHr: [
              0.189 + (overrides.evap26 || 0),
              0.211 + (overrides.evap18 || 0),
              0.226 + (overrides.evap11 || 0),
              0.265 + (overrides.evap3 || 0)
            ],
            sourceNorthDryBeltOceanKgM2: [
              2.44135 + (overrides.src26 || 0),
              2.44384 + (overrides.src18 || 0),
              2.214 + (overrides.src11 || 0),
              1.516 + (overrides.src3 || 0)
            ],
            sourceTropicalOceanNorthKgM2: [
              0.13173 + (overrides.trop26 || 0),
              0.33559 + (overrides.trop18 || 0),
              0.954 + (overrides.trop11 || 0),
              1.583 + (overrides.trop3 || 0)
            ],
            resolvedAscentCloudBirthPotentialKgM2: [
              0.02989 + (overrides.birth26 || 0),
              0.04279 + (overrides.birth18 || 0),
              0.02395 + (overrides.birth11 || 0),
              0.0154 + (overrides.birth3 || 0)
            ],
            importedAnvilPersistenceMassKgM2: [
              0.16408 + (overrides.imp26 || 0),
              0.13765 + (overrides.imp18 || 0),
              0.053 + (overrides.imp11 || 0),
              0.028 + (overrides.imp3 || 0)
            ],
            carriedOverUpperCloudMassKgM2: [
              0.16408 + (overrides.carry26 || 0),
              0.13765 + (overrides.carry18 || 0),
              0.053 + (overrides.carry11 || 0),
              0.028 + (overrides.carry3 || 0)
            ],
            weakErosionCloudSurvivalMassKgM2: [
              0.16255 + (overrides.weak26 || 0),
              0.13574 + (overrides.weak18 || 0),
              0.052 + (overrides.weak11 || 0),
              0.027 + (overrides.weak3 || 0)
            ],
            upperCloudPathKgM2: [
              0.13716 + (overrides.path26 || 0),
              0.13733 + (overrides.path18 || 0),
              0.084 + (overrides.path11 || 0),
              0.051 + (overrides.path3 || 0)
            ],
            cloudReevaporationMassKgM2: [
              0.0797 + (overrides.cre26 || 0),
              0.05184 + (overrides.cre18 || 0),
              0.041 + (overrides.cre11 || 0),
              0.032 + (overrides.cre3 || 0)
            ],
            precipReevaporationMassKgM2: [
              0.02835 + (overrides.pre26 || 0),
              0.01689 + (overrides.pre18 || 0),
              0.011 + (overrides.pre11 || 0),
              0.009 + (overrides.pre3 || 0)
            ],
            atlanticDryCoreReceiverTaperDiagFrac: [
              0 + (overrides.taper26 || 0),
              0,
              0,
              0
            ],
            atlanticDryCoreReceiverTaperAppliedDiag: [
              0 + (overrides.applied26 || 0),
              0,
              0,
              0
            ]
          }
        }
      }
    ]
  });

  const offSectorSummary = {
    nhDryBeltSectorSummary: {
      continentalSubtropics: { largeScaleCondensationMeanKgM2: 0.11152, totalLowLevelSourceMeanKgM2: 6.08633 },
      eastPacific: { largeScaleCondensationMeanKgM2: 0.09923, totalLowLevelSourceMeanKgM2: 33.67601 },
      atlantic: { largeScaleCondensationMeanKgM2: 0.12835, totalLowLevelSourceMeanKgM2: 18.54526 },
      indoPacific: { largeScaleCondensationMeanKgM2: 0.15348, totalLowLevelSourceMeanKgM2: 26.03138 }
    }
  };
  const onSectorSummary = {
    nhDryBeltSectorSummary: {
      continentalSubtropics: { largeScaleCondensationMeanKgM2: 0.11162, totalLowLevelSourceMeanKgM2: 6.14332 },
      eastPacific: { largeScaleCondensationMeanKgM2: 0.1031, totalLowLevelSourceMeanKgM2: 33.65851 },
      atlantic: { largeScaleCondensationMeanKgM2: 0.12601, totalLowLevelSourceMeanKgM2: 18.7809 },
      indoPacific: { largeScaleCondensationMeanKgM2: 0.15325, totalLowLevelSourceMeanKgM2: 26.02903 }
    }
  };
  const offBirth = {
    attribution: {
      northDryBeltCarryOverSurvivalFrac: 0.9679,
      northDryBeltSectorChannelMeansKgM2: {
        atlantic: {
          resolvedAscentCloudBirth: 60.2164,
          saturationAdjustmentCloudBirth: 149.26181,
          convectiveDetrainmentCloudBirth: 0.09056,
          carryOverUpperCloudEntering: 179.77311,
          carryOverUpperCloudSurviving: 175.56553
        }
      }
    }
  };
  const onBirth = {
    attribution: {
      northDryBeltCarryOverSurvivalFrac: 0.96796,
      northDryBeltSectorChannelMeansKgM2: {
        atlantic: {
          resolvedAscentCloudBirth: 60.3265,
          saturationAdjustmentCloudBirth: 150.77757,
          convectiveDetrainmentCloudBirth: 0.09071,
          carryOverUpperCloudEntering: 184.09771,
          carryOverUpperCloudSurviving: 179.80661
        }
      }
    }
  };

  const summary = buildPhase1ZZCAtlanticReceiverSpilloverAttribution({
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
      tcw26: 0.308,
      tcw18: 0.342,
      omega26: -0.00626,
      omega18: 0.00268,
      midRh26: 0.014,
      midRh18: 0.011,
      evap26: -0.003,
      evap18: -0.001,
      src26: 0.00004,
      src18: -0.00223,
      trop26: -0.00005,
      trop18: -0.00018,
      birth26: 0,
      birth18: 0.00015,
      imp26: 0.0091,
      imp18: 0.03092,
      carry26: 0.0091,
      carry18: 0.03092,
      weak26: 0.00862,
      weak18: 0.03047,
      path26: 0.00941,
      path18: 0.03391,
      cre26: 0.00465,
      cre18: -0.0031,
      pre26: 0.00121,
      pre18: -0.00068,
      taper26: 0.00595,
      applied26: 0.00164
    }),
    offSectorSummary,
    onSectorSummary,
    offBirth,
    onBirth,
    paths: {
      offPath: '/tmp/phase1zzb-off.json',
      onPath: '/tmp/phase1zzb-on.json',
      offSectorPath: '/tmp/phase1zzb-off-nh-dry-belt-source-sector-summary.json',
      onSectorPath: '/tmp/phase1zzb-on-nh-dry-belt-source-sector-summary.json',
      offBirthPath: '/tmp/phase1zzb-off-vertical-cloud-birth-attribution.json',
      onBirthPath: '/tmp/phase1zzb-on-vertical-cloud-birth-attribution.json',
      reportPath: '/tmp/phase1zzc.md',
      jsonPath: '/tmp/phase1zzc.json'
    }
  });

  assert.equal(summary.verdict, 'atlantic_transition_carryover_spillover_without_source_recharge');
  assert.equal(summary.nextPhase, 'Phase 1ZZD: Atlantic Transition Carryover Containment Design');
  assert.equal(summary.spillover18N.condensationDelta, 0.00891);
  assert.equal(summary.spillover18N.northDryBeltOceanSourceDelta, -0.00223);
  assert.equal(summary.spillover18N.resolvedAscentBirthDelta, 0.00015);
  assert.equal(summary.spillover18N.importedAnvilPersistenceDelta, 0.03092);
  assert.equal(summary.atlanticBirthDeltas.carryOverUpperCloudEnteringDelta, 4.3246);
  assert.equal(summary.sectorDeltas.atlanticCondensationDelta, -0.00234);
  assert.equal(summary.sectorDeltas.eastPacificCondensationDelta, 0.00387);
});
