import test from 'node:test';
import assert from 'node:assert/strict';
import {
  _test as planetaryAuditTest
} from '../../scripts/agent/planetary-realism-audit.mjs';

test('buildSampleTargetsDays merges horizons with cadence without duplicates', () => {
  assert.deepEqual(
    planetaryAuditTest.buildSampleTargetsDays([30, 90], 30),
    [30, 60, 90]
  );
});

test('computeSeasonalityScore detects stronger tropical environment support in warm season', () => {
  const samples = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    samples.push({
      monthIndex,
      metrics: {
        tropicalCycloneEnvironmentCountNh: [0.2, 0.2, 0.3, 0.4, 0.5, 1.2, 1.6, 1.8, 1.4, 0.8, 0.4, 0.2][monthIndex],
        tropicalCycloneEnvironmentCountSh: [1.4, 1.2, 0.8, 0.5, 0.3, 0.2, 0.2, 0.2, 0.3, 0.6, 1.0, 1.3][monthIndex]
      }
    });
  }
  const score = planetaryAuditTest.computeSeasonalityScore(samples);
  assert.equal(score.nhSeasonalityPass, true);
  assert.equal(score.shSeasonalityPass, true);
});

test('evaluateHorizons flags missing trades and storm tracks', () => {
  const evaluation = planetaryAuditTest.evaluateHorizons([
    {
      targetDay: 30,
      metrics: {
        tropicalTradesNorthU10Ms: 0.1,
        tropicalTradesSouthU10Ms: 0.0,
        midlatitudeWesterliesNorthU10Ms: -0.1,
        midlatitudeWesterliesSouthU10Ms: 0.0,
        itczLatDeg: 18,
        subtropicalDryNorthRatio: 0.95,
        subtropicalDrySouthRatio: 0.9,
        stormTrackNorthLatDeg: 20,
        stormTrackSouthLatDeg: -10,
        globalCloudMeanFrac: 0.95,
        maxWind10mMs: 130,
        globalPrecipMeanMmHr: 6,
        globalTcwMeanKgM2: 100
      }
    }
  ], 30);
  assert.equal(evaluation.overallPass, false);
  assert.ok(evaluation.warnings.includes('trade_winds_missing_north'));
  assert.ok(evaluation.warnings.includes('north_storm_track_out_of_range'));
  assert.ok(evaluation.warnings.includes('runaway_surface_winds'));
});

test('classifySnapshot reports broad convection and subtropical drying diagnostics', () => {
  const nx = 2;
  const ny = 3;
  const diagnostics = {
    grid: {
      nx,
      ny,
      latitudesDeg: [20, 0, -20]
    },
    landMask: [
      1, 0,
      0, 0,
      1, 0
    ],
    precipRateMmHr: [
      0.4, 0.4,
      2.0, 1.8,
      0.5, 0.5
    ],
    cloudTotalFraction: new Array(nx * ny).fill(0.5),
    wind10mU: [
      -0.8, -0.7,
      -0.3, -0.2,
      -0.7, -0.8
    ],
    wind10mSpeedMs: new Array(nx * ny).fill(10),
    totalColumnWaterKgM2: new Array(nx * ny).fill(30),
    surfaceEvapRateMmHr: [
      0.06, 0.04,
      0.12, 0.11,
      0.05, 0.04
    ],
    verticallyIntegratedVaporFluxNorthKgM_1S: [
      0.12, 0.1,
      0.4, 0.35,
      -0.08, -0.07
    ],
    verticallyIntegratedTotalWaterFluxNorthKgM_1S: [
      0.14, 0.12,
      0.44, 0.4,
      -0.06, -0.05
    ],
    convectiveMaskFrac: [
      0, 0,
      1, 1,
      0, 0
    ],
    convectivePotentialFrac: [
      0.1, 0.1,
      0.95, 0.9,
      0.1, 0.1
    ],
    convectiveOrganizationFrac: [
      0.1, 0.1,
      0.9, 0.8,
      0.1, 0.1
    ],
    convectiveMassFluxKgM2S: [
      0.001, 0.001,
      0.02, 0.018,
      0.001, 0.001
    ],
    convectiveDetrainmentMassKgM2: [
      0.01, 0.01,
      0.12, 0.11,
      0.01, 0.01
    ],
    convectiveAnvilSourceFrac: [
      0.1, 0.1,
      0.7, 0.75,
      0.1, 0.1
    ],
    resolvedAscentCloudBirthPotentialKgM2: [
      0.04, 0.05,
      0.03, 0.03,
      0.06, 0.07
    ],
    largeScaleCondensationSourceKgM2: [
      0.08, 0.06,
      0.04, 0.05,
      0.09, 0.08
    ],
    cloudReevaporationMassKgM2: [
      0.01, 0.02,
      0.03, 0.02,
      0.02, 0.02
    ],
    precipReevaporationMassKgM2: [
      0.02, 0.02,
      0.01, 0.01,
      0.03, 0.03
    ],
    importedAnvilPersistenceMassKgM2: [
      0.03, 0.04,
      0.02, 0.02,
      0.05, 0.05
    ],
    carriedOverUpperCloudMassKgM2: [
      0.06, 0.07,
      0.03, 0.03,
      0.08, 0.09
    ],
    weakErosionCloudSurvivalMassKgM2: [
      0.04, 0.04,
      0.01, 0.01,
      0.05, 0.06
    ],
    upperCloudPathKgM2: [
      0.1, 0.12,
      0.2, 0.18,
      0.14, 0.15
    ],
    lowerTroposphericRhFrac: [
      0.6, 0.62,
      0.85, 0.84,
      0.58, 0.57
    ],
    subtropicalSubsidenceDryingFrac: [
      0.08, 0.09,
      0.01, 0.01,
      0.08, 0.09
    ],
    cycloneSupportFields: {
      relativeVorticityS_1: new Array(nx * ny).fill(3e-5)
    },
    seaLevelPressurePa: new Array(nx * ny).fill(100000),
    sstK: new Array(nx * ny).fill(300),
    seaIceFraction: new Array(nx * ny).fill(0)
  };

  const snapshot = planetaryAuditTest.classifySnapshot(diagnostics, 30);

  assert.ok(snapshot.metrics.itczWidthDeg > 0);
  assert.ok(snapshot.metrics.tropicalConvectiveFraction > 0.5);
  assert.ok(snapshot.metrics.tropicalConvectivePotential > 0.5);
  assert.ok(snapshot.metrics.tropicalConvectiveMassFluxKgM2S > 0.01);
  assert.ok(snapshot.metrics.subtropicalSubsidenceNorthMean > 0.05);
  assert.ok(snapshot.metrics.tropicalAnvilPersistenceFrac > 0.6);
  assert.ok(snapshot.metrics.crossEquatorialVaporFluxNorthKgM_1S > 0);
  assert.ok(snapshot.metrics.northDryBeltLandPrecipMeanMmHr > 0);
  assert.ok(snapshot.metrics.northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2 > 0);
  assert.ok(snapshot.metrics.northDryBeltLargeScaleCondensationMeanKgM2 > 0);
  assert.ok(snapshot.metrics.northDryBeltImportedAnvilPersistenceMeanKgM2 > 0);
  assert.ok(snapshot.metrics.northDryBeltCarriedOverUpperCloudMeanKgM2 > 0);
  assert.ok(snapshot.metrics.northDryBeltWeakErosionCloudSurvivalMeanKgM2 > 0);
  assert.ok(snapshot.metrics.northDryBeltUpperCloudPathMeanKgM2 > 0);
  assert.equal(snapshot.profiles.latitudesDeg.length, 3);
  assert.equal(snapshot.profiles.series.convectivePotential.length, 3);
  assert.equal(snapshot.profiles.series.surfaceEvapRateMmHr.length, 3);
  assert.equal(snapshot.profiles.series.resolvedAscentCloudBirthPotentialKgM2.length, 3);
  assert.equal(snapshot.profiles.series.largeScaleCondensationSourceKgM2.length, 3);
  assert.equal(snapshot.profiles.series.carriedOverUpperCloudMassKgM2.length, 3);
  assert.equal(snapshot.profiles.series.weakErosionCloudSurvivalMassKgM2.length, 3);
});

test('buildMoistureAttributionReport ranks moistening drivers and keeps regime totals', () => {
  const report = planetaryAuditTest.buildMoistureAttributionReport(
    {
      sampledModelSeconds: 3 * 86400,
      modules: {
        stepAdvection5: {
          callCount: 12,
          bands: {
            north_dry_belt: {
              surfaceVaporDeltaKgKg: 0.0024,
              upperVaporDeltaKgKg: 0.0011,
              surfacePrecipDeltaMm: 0.2
            },
            north_dry_belt_land: { surfaceVaporDeltaKgKg: 0.0008 },
            north_dry_belt_ocean: { surfaceVaporDeltaKgKg: 0.0016 }
          }
        },
        stepMicrophysics5: {
          callCount: 12,
          bands: {
            north_dry_belt: {
              surfaceVaporDeltaKgKg: -0.0004,
              upperVaporDeltaKgKg: -0.0001,
              surfacePrecipDeltaMm: 1.8
            },
            north_dry_belt_land: { surfaceVaporDeltaKgKg: -0.0001 },
            north_dry_belt_ocean: { surfaceVaporDeltaKgKg: -0.0003 }
          }
        }
      },
      precipitationRegimes: {
        deep_core_tropical: { surfacePrecipDeltaMm: 8 },
        tropical_transition_spillover: { surfacePrecipDeltaMm: 2 },
        marginal_subtropical: { surfacePrecipDeltaMm: 1 },
        large_scale_other: { surfacePrecipDeltaMm: 3 }
      }
    },
    {
      subtropicalDryNorthRatio: 1.2,
      northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2: 0.05,
      northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2: 0.01,
      northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2: 0.04,
      northDryBeltLargeScaleCondensationMeanKgM2: 0.08,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.07,
      northDryBeltLandLargeScaleCondensationMeanKgM2: 0.01,
      northDryBeltImportedAnvilPersistenceMeanKgM2: 0.03,
      northDryBeltCarriedOverUpperCloudMeanKgM2: 0.04,
      northDryBeltLandCarriedOverUpperCloudMeanKgM2: 0.01,
      northDryBeltOceanCarriedOverUpperCloudMeanKgM2: 0.03,
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.025,
      northDryBeltLandWeakErosionCloudSurvivalMeanKgM2: 0.006,
      northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2: 0.019,
      northDryBeltCloudReevaporationMeanKgM2: 0.02,
      northDryBeltPrecipReevaporationMeanKgM2: 0.01,
      northDryBeltUpperCloudPathMeanKgM2: 0.12,
      northTransitionVaporFluxNorthKgM_1S: 0.22,
      northDryBeltVaporFluxNorthKgM_1S: 0.14
    }
  );

  assert.equal(report.positiveNorthDryBeltMoisteningDrivers[0].module, 'stepAdvection5');
  assert.equal(report.strongestNorthDryBeltPrecipSinks[0].module, 'stepMicrophysics5');
  assert.equal(report.precipitationRegimes.deep_core_tropical.surfacePrecipDeltaMm, 8);
  assert.equal(report.northDryBeltGenerationAttribution.resolvedAscentCloudBirthPotentialMeanKgM2, 0.05);
  assert.equal(report.northDryBeltGenerationAttribution.oceanLargeScaleCondensationMeanKgM2, 0.07);
  assert.equal(report.northDryBeltGenerationAttribution.oceanCarriedOverUpperCloudMeanKgM2, 0.03);
});

test('buildMonthlyClimatology averages metrics and zonal profiles by month', () => {
  const monthly = planetaryAuditTest.buildMonthlyClimatology([
    {
      targetDay: 10,
      monthIndex: 0,
      metrics: {
        itczWidthDeg: 12,
        subtropicalDryNorthRatio: 0.9
      },
      profiles: {
        latitudesDeg: [-10, 0, 10],
        series: {
          precipRateMmHr: [1, 2, 1],
          convectiveMassFluxKgM2S: [0.01, 0.02, 0.01]
        }
      }
    },
    {
      targetDay: 20,
      monthIndex: 0,
      metrics: {
        itczWidthDeg: 14,
        subtropicalDryNorthRatio: 1.1
      },
      profiles: {
        latitudesDeg: [-10, 0, 10],
        series: {
          precipRateMmHr: [2, 3, 2],
          convectiveMassFluxKgM2S: [0.02, 0.03, 0.02]
        }
      }
    }
  ]);

  assert.equal(monthly[0].sampleCount, 2);
  assert.equal(monthly[0].metrics.itczWidthDeg, 13);
  assert.equal(monthly[0].metrics.subtropicalDryNorthRatio, 1);
  assert.equal(monthly[0].profiles.series.precipRateMmHr[1], 2.5);
  assert.equal(monthly[0].profiles.series.convectiveMassFluxKgM2S[1], 0.025);
});

test('buildRealismGapReport ranks strongest moisture gaps first', () => {
  const gaps = planetaryAuditTest.buildRealismGapReport([
    {
      horizonDays: 30,
      warnings: [
        'north_subtropical_dry_belt_too_wet',
        'trade_winds_missing_north'
      ],
      latest: {
        metrics: {
          subtropicalDryNorthRatio: 1.35,
          tropicalTradesNorthU10Ms: 0.05
        }
      }
    }
  ]);

  assert.equal(gaps[0].code, 'north_subtropical_dry_belt_too_wet');
  assert.ok(gaps[0].severity > gaps[1].severity);
});

test('surface-source and restart-parity reports preserve the new phase-0/1 sidecars', () => {
  const sample = {
    targetDay: 30,
    metrics: {
      subtropicalDryNorthRatio: 1.1,
      northDryBeltSourceAttributionCoverageFrac: 0.98
    },
    sourceAttribution: {
      northDryBeltLowLevelMeanKgM2: {
        northDryBeltOcean: 0.12,
        atmosphericCarryover: 0.2,
        unattributedResidual: 0.01
      },
      northDryBeltAttributionCoverageFrac: 0.98,
      nhDryBeltSectorSummary: {
        atlantic: {
          totalLowLevelSourceMeanKgM2: 0.1
        }
      }
    },
    surfaceFluxDecomposition: {
      northDryBeltEvapMeanMmHr: 0.2,
      northDryBeltHumidityGradientMeanKgKg: 0.01
    }
  };
  const sourceReport = planetaryAuditTest.buildSurfaceSourceAttributionReport(sample);
  const fluxReport = planetaryAuditTest.buildSurfaceFluxDecompositionReport(sample);
  const sectorReport = planetaryAuditTest.buildNhDryBeltSourceSectorReport(sample);
  const parityReport = planetaryAuditTest.buildRestartParityReport({
    checkpointDay: 15,
    referenceSamples: [{ targetDay: 30, metrics: { subtropicalDryNorthRatio: 1.1, itczWidthDeg: 23, subtropicalDrySouthRatio: 0.5, subtropicalSubsidenceNorthMean: 0.06, subtropicalSubsidenceSouthMean: 0.04, tropicalTradesNorthU10Ms: -0.8, midlatitudeWesterliesNorthU10Ms: 1.2 } }],
    resumedSamples: [{ targetDay: 30, metrics: { subtropicalDryNorthRatio: 1.1, itczWidthDeg: 23, subtropicalDrySouthRatio: 0.5, subtropicalSubsidenceNorthMean: 0.06, subtropicalSubsidenceSouthMean: 0.04, tropicalTradesNorthU10Ms: -0.8, midlatitudeWesterliesNorthU10Ms: 1.2 } }]
  });

  assert.equal(sourceReport.latestMetrics.northDryBeltSourceAttributionCoverageFrac, 0.98);
  assert.equal(sourceReport.sourceAttribution.northDryBeltLowLevelMeanKgM2.atmosphericCarryover, 0.2);
  assert.equal(fluxReport.surfaceFluxDecomposition.northDryBeltEvapMeanMmHr, 0.2);
  assert.equal(sectorReport.nhDryBeltSectorSummary.atlantic.totalLowLevelSourceMeanKgM2, 0.1);
  assert.equal(parityReport.pass, true);
});
