import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZZDAtlanticTransitionCarryoverContainmentDesign } from '../../scripts/agent/phase1zzd-atlantic-transition-carryover-containment-design.mjs';

test('phase 1ZZD ranks Atlantic transition carryover containment above source or resolved-ascent fixes', () => {
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
          latitudesDeg: [26.25, 18.75],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.11577 + (overrides.n26 || 0),
              0.09515 + (overrides.n18 || 0)
            ],
            totalColumnWaterKgM2: [
              37.128 + (overrides.tcw26 || 0),
              37.994 + (overrides.tcw18 || 0)
            ],
            lowerTroposphericOmegaPaS: [
              0.27765 + (overrides.omega26 || 0),
              0.43713 + (overrides.omega18 || 0)
            ],
            midTroposphericRhFrac: [
              0.398 + (overrides.midRh26 || 0),
              0.372 + (overrides.midRh18 || 0)
            ],
            surfaceEvapRateMmHr: [
              0.189 + (overrides.evap26 || 0),
              0.211 + (overrides.evap18 || 0)
            ],
            sourceNorthDryBeltOceanKgM2: [
              2.44135 + (overrides.src26 || 0),
              2.44384 + (overrides.src18 || 0)
            ],
            sourceTropicalOceanNorthKgM2: [
              0.13173 + (overrides.trop26 || 0),
              0.33559 + (overrides.trop18 || 0)
            ],
            resolvedAscentCloudBirthPotentialKgM2: [
              0.02989 + (overrides.birth26 || 0),
              0.04279 + (overrides.birth18 || 0)
            ],
            importedAnvilPersistenceMassKgM2: [
              0.16408 + (overrides.imp26 || 0),
              0.13765 + (overrides.imp18 || 0)
            ],
            carriedOverUpperCloudMassKgM2: [
              0.16408 + (overrides.carry26 || 0),
              0.13765 + (overrides.carry18 || 0)
            ],
            weakErosionCloudSurvivalMassKgM2: [
              0.16255 + (overrides.weak26 || 0),
              0.13574 + (overrides.weak18 || 0)
            ],
            upperCloudPathKgM2: [
              0.13716 + (overrides.path26 || 0),
              0.13733 + (overrides.path18 || 0)
            ],
            atlanticDryCoreReceiverTaperDiagFrac: [
              0 + (overrides.taper26 || 0),
              0
            ],
            atlanticDryCoreReceiverTaperAppliedDiag: [
              0 + (overrides.applied26 || 0),
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

  const summary = buildPhase1ZZDAtlanticTransitionCarryoverContainmentDesign({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: 0.077,
      subtropicalDryNorthRatio: 0.017,
      subtropicalDrySouthRatio: 0.003,
      northDryBeltOceanCond: -0.00039,
      n26: -0.0097,
      n18: 0.00891,
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
      reportPath: '/tmp/phase1zzd.md',
      jsonPath: '/tmp/phase1zzd.json'
    }
  });

  assert.equal(summary.verdict, 'atlantic_transition_overlap_survival_taper_preferred');
  assert.equal(summary.nextPhase, 'Phase 1ZZE: Implement Atlantic Transition Carryover Containment Patch');
  assert.equal(summary.ranking[0].key, 'atlantic_transition_carryover_containment');
  assert.equal(summary.ranking.at(-1).key, 'atlantic_transition_resolved_ascent_cap');
  assert.equal(summary.signals.spilloverCarrySurvivingDelta, 4.24108);
  assert.equal(summary.signals.spilloverNorthDryBeltSourceDelta, -0.00223);
});
