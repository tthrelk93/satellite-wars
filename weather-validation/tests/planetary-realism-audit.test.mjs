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

test('buildUpperCloudPhase5Reports surfaces residence, erosion, and ventilation evidence', () => {
  const sample = {
    targetDay: 30,
    upperCloudResidenceTracing: {
      ageAttribution: {
        northDryBeltResidenceMeanDays: 4.2,
        northDryBeltTimeSinceImportMeanDays: 2.8,
        northDryBeltStaleFrac: 0.74
      },
      erosionBudget: {
        northDryBeltPotentialErosionMeanKgM2: 0.4,
        northDryBeltAppliedErosionMeanKgM2: 0.08,
        northDryBeltBlockedErosionMeanKgM2: 0.32,
        northDryBeltAppliedErosionFrac: 0.2,
        northDryBeltBlockedErosionFrac: 0.8,
        levelBands: {
          upperTroposphere: {
            appliedFrac: 0.18,
            blockedFrac: 0.82
          }
        }
      },
      ventilation: {
        dominantImportInterfaceTargetLatDeg: 35,
        north35UpperTroposphereCloudFluxNorthKgM_1S: -6.31,
        north35UpperTroposphereImportMagnitudeKgM_1S: 6.31,
        northDryBeltRadiativePersistenceSupportMeanWm2: 0.32,
        regimePersistence: {
          passiveSurvivalFrac: 0.7,
          regenerationFrac: 0.2,
          oscillatoryFrac: 0.1
        }
      },
      rootCauseAssessment: {
        ruledIn: ['Passive survival dominates.'],
        ruledOut: ['Strong radiative maintenance is not dominant.'],
        ambiguous: []
      }
    }
  };

  const residence = planetaryAuditTest.buildUpperCloudResidenceReport(sample);
  const erosion = planetaryAuditTest.buildUpperCloudErosionBudgetReport(sample);
  const ventilation = planetaryAuditTest.buildUpperCloudVentilationSummaryReport(sample);

  assert.equal(residence.ageAttribution.northDryBeltResidenceMeanDays, 4.2);
  assert.equal(erosion.erosionBudget.northDryBeltBlockedErosionFrac, 0.8);
  assert.equal(erosion.erosionBudget.levelBands.upperTroposphere.blockedFrac, 0.82);
  assert.equal(ventilation.ventilation.north35UpperTroposphereImportMagnitudeKgM_1S, 6.31);
  assert.equal(ventilation.rootCauseAssessment.ruledIn[0], 'Passive survival dominates.');
});

test('buildPhase6ThermodynamicReports surface stability and radiative maintenance evidence', () => {
  const sample = {
    targetDay: 30,
    profiles: {
      latitudesDeg: [-20, 0, 20],
      series: {
        boundaryLayerRhFrac: [0.4, 0.6, 0.5],
        lowerTroposphericRhFrac: [0.35, 0.55, 0.45],
        midTroposphericRhFrac: [0.2, 0.4, 0.3],
        boundaryLayerThetaeK: [300, 320, 310],
        lowerTroposphereThetaeK: [295, 315, 304],
        thetaeGradientBoundaryMinusLowerK: [5, 5, 6],
        boundaryLayerMseJkg: [305000, 325000, 315000],
        lowerTroposphereMseJkg: [295000, 315000, 305000],
        mseGradientBoundaryMinusLowerJkg: [10000, 10000, 10000],
        lowerTroposphericInversionStrengthK: [1, 0.5, 0.8],
        surfaceCloudShortwaveShieldingWm2: [30, 60, 45],
        upperCloudClearSkyLwCoolingWm2: [5, 8, 6],
        upperCloudCloudyLwCoolingWm2: [7, 10, 8],
        upperCloudLwCloudEffectWm2: [2, 3, 2],
        upperCloudNetCloudRadiativeEffectWm2: [12, 18, 15]
      }
    },
    thermodynamicSupportTracing: {
      stability: {
        northDryBeltBoundaryLayerRhMeanFrac: 0.51,
        northDryBeltInversionStrengthMeanK: 0.84
      },
      radiation: {
        northDryBeltSurfaceCloudShieldingMeanWm2: 44.5,
        northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: 15.4
      },
      classification: {
        moistureSupportScore: 0.41,
        radiationSupportScore: 0.28,
        dynamicsSupportScore: 0.77,
        primaryRegime: 'dynamicsSupported',
        secondaryRegime: 'moistureSupported',
        radiativeRole: 'negligible',
        thermodynamicRole: 'secondary',
        dynamicRole: 'primary'
      },
      rootCauseAssessment: {
        ruledIn: ['Dynamics remain primary.'],
        ruledOut: ['Radiative support is not primary.'],
        ambiguous: []
      }
    }
  };

  const support = planetaryAuditTest.buildThermodynamicSupportSummaryReport(sample);
  const radiative = planetaryAuditTest.buildRadiativeCloudMaintenanceReport(sample);
  const profiles = planetaryAuditTest.buildBoundaryLayerStabilityProfilesReport(sample);

  assert.equal(support.classification.primaryRegime, 'dynamicsSupported');
  assert.equal(radiative.radiation.northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2, 15.4);
  assert.equal(profiles.stabilitySeries.boundaryLayerRhFrac[1], 0.6);
  assert.equal(profiles.radiativeSeries.upperCloudNetCloudRadiativeEffectWm2[2], 15);
});

test('buildPhase8StormSpilloverReports expose regime coverage and transient leakage', () => {
  const sample = {
    targetDay: 30,
    stormSpilloverTracing: {
      overall: {
        assignedCombinedContributionFrac: 1,
        dominantCombinedRegime: 'persistent_zonal_background',
        regimes: {
          persistent_zonal_background: { combinedContributionFrac: 0.56 },
          tropical_spillover: { combinedContributionFrac: 0.14 },
          subtropical_marine_deck_drizzle: { combinedContributionFrac: 0.1 },
          synoptic_storm_leakage: { combinedContributionFrac: 0.2 }
        }
      },
      sectoralRegimes: {
        eastPacific: {
          dominantCombinedRegime: 'synoptic_storm_leakage',
          regimes: {
            synoptic_storm_leakage: { combinedContributionFrac: 0.48 }
          }
        }
      },
      eventCatalog: {
        precipThresholdMmHr: 0.15,
        topEvents: [
          {
            regimeKey: 'synoptic_storm_leakage',
            sectorKey: 'eastPacific',
            severityScore: 0.91
          }
        ]
      },
      transientEddyLeakage: {
        dominantCloudEddyImport: {
          targetLatDeg: 35,
          sectorKey: 'eastPacific',
          levelBandKey: 'upperTroposphere',
          cloudFluxEddyComponentKgM_1S: 3.21
        }
      },
      rootCauseAssessment: {
        ruledIn: ['Leakage matters.'],
        ruledOut: [],
        ambiguous: []
      }
    }
  };

  const catalog = planetaryAuditTest.buildStormSpilloverCatalogReport(sample);
  const regimes = planetaryAuditTest.buildSectoralDryBeltRegimesReport(sample);
  const leakage = planetaryAuditTest.buildTransientEddyLeakageSummaryReport(sample);

  assert.equal(catalog.eventCatalog.topEvents[0].sectorKey, 'eastPacific');
  assert.equal(regimes.overall.dominantCombinedRegime, 'persistent_zonal_background');
  assert.equal(regimes.sectoralRegimes.eastPacific.dominantCombinedRegime, 'synoptic_storm_leakage');
  assert.equal(leakage.transientEddyLeakage.dominantCloudEddyImport.levelBandKey, 'upperTroposphere');
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

test('transport phase reports rank NH dry-belt import pathways and return-branch structure', () => {
  const sample = {
    targetDay: 30,
    metrics: {
      northDryBeltSourceNorthDryBeltOceanMeanKgM2: 0.2,
      northDryBeltSourceLandRecyclingMeanKgM2: 0.05,
      northDryBeltSourceTropicalOceanNorthMeanKgM2: 0.25,
      northDryBeltSourceTropicalOceanSouthMeanKgM2: 0.1,
      northDryBeltSourceNorthExtratropicalOceanMeanKgM2: 0.03,
      northDryBeltSourceOtherOceanMeanKgM2: 0.02,
      northDryBeltSourceInitializationMemoryMeanKgM2: 0.01,
      northDryBeltSourceAtmosphericCarryoverMeanKgM2: 0.34,
      northDryBeltSourceNudgingInjectionMeanKgM2: 0.01,
      northDryBeltSourceAnalysisInjectionMeanKgM2: 0.0
    },
    transportTracing: {
      levelBands: [
        { key: 'boundaryLayer', label: 'Boundary layer' },
        { key: 'lowerTroposphere', label: 'Lower troposphere' },
        { key: 'upperTroposphere', label: 'Upper troposphere' }
      ],
      interfaces: [
        {
          targetLatDeg: -12,
          modelLevels: [
            { sigmaMid: 0.22, vaporFluxNorthKgM_1S: -0.02, cloudFluxNorthKgM_1S: -0.03 },
            { sigmaMid: 0.74, vaporFluxNorthKgM_1S: -0.05, cloudFluxNorthKgM_1S: -0.01 }
          ],
          levelBands: {
            upperTroposphere: { label: 'Upper troposphere', vaporFluxNorthKgM_1S: -0.02, cloudFluxNorthKgM_1S: -0.03 },
            lowerTroposphere: { label: 'Lower troposphere', vaporFluxNorthKgM_1S: -0.05, cloudFluxNorthKgM_1S: -0.01 }
          }
        },
        {
          targetLatDeg: 12,
          modelLevels: [
            { sigmaMid: 0.22, vaporFluxNorthKgM_1S: 0.03, cloudFluxNorthKgM_1S: 0.04 },
            { sigmaMid: 0.74, vaporFluxNorthKgM_1S: 0.06, cloudFluxNorthKgM_1S: 0.01 }
          ],
          levelBands: {
            upperTroposphere: { label: 'Upper troposphere', vaporFluxNorthKgM_1S: 0.03, cloudFluxNorthKgM_1S: 0.04 },
            lowerTroposphere: { label: 'Lower troposphere', vaporFluxNorthKgM_1S: 0.06, cloudFluxNorthKgM_1S: 0.01 }
          }
        },
        {
          targetLatDeg: 22,
          modelLevels: [
            { sigmaMid: 0.22, vaporFluxNorthKgM_1S: 0.02, cloudFluxNorthKgM_1S: 0.05 },
            { sigmaMid: 0.74, vaporFluxNorthKgM_1S: 0.11, cloudFluxNorthKgM_1S: 0.01 }
          ],
          levelBands: {
            upperTroposphere: { label: 'Upper troposphere', vaporFluxNorthKgM_1S: 0.02, cloudFluxNorthKgM_1S: 0.05 },
            boundaryLayer: { label: 'Boundary layer', vaporFluxNorthKgM_1S: 0.11, cloudFluxNorthKgM_1S: 0.01 }
          }
        },
        {
          targetLatDeg: 35,
          modelLevels: [
            { sigmaMid: 0.22, vaporFluxNorthKgM_1S: -0.01, cloudFluxNorthKgM_1S: -0.02 },
            { sigmaMid: 0.74, vaporFluxNorthKgM_1S: -0.03, cloudFluxNorthKgM_1S: -0.01 }
          ],
          levelBands: {
            upperTroposphere: { label: 'Upper troposphere', vaporFluxNorthKgM_1S: -0.01, cloudFluxNorthKgM_1S: -0.02 },
            boundaryLayer: { label: 'Boundary layer', vaporFluxNorthKgM_1S: -0.03, cloudFluxNorthKgM_1S: -0.01 }
          }
        }
      ],
      bandLevelMatrix: [
        {
          key: 'northDryBelt',
          levelBands: {
            boundaryLayer: { massFluxNorthKgM_1S: -0.08 },
            lowerTroposphere: { massFluxNorthKgM_1S: -0.05 }
          }
        },
        {
          key: 'southDryBelt',
          levelBands: {
            boundaryLayer: { massFluxNorthKgM_1S: 0.06 },
            lowerTroposphere: { massFluxNorthKgM_1S: 0.04 }
          }
        }
      ],
      streamfunctionProxy: {
        latitudesDeg: [-20, 0, 20],
        sigmaMid: [0.22, 0.74],
        massStreamfunctionProxyKgS: [
          [1, 2, 3],
          [4, 5, 6]
        ]
      }
    }
  };

  const budgetReport = planetaryAuditTest.buildTransportInterfaceBudgetReport(sample);
  const hadleyReport = planetaryAuditTest.buildHadleyPartitionSummaryReport(sample);
  const matrixReport = planetaryAuditTest.buildBandLevelFluxMatrixReport(sample);

  assert.equal(budgetReport.dominantNhDryBeltVaporImport.interfaceTargetLatDeg, 22);
  assert.equal(budgetReport.dominantNhDryBeltVaporImport.levelBandKey, 'boundaryLayer');
  assert.equal(hadleyReport.tropicalExportLevels.northVaporExportSigma, 0.56667);
  assert.equal(hadleyReport.returnBranchIntensity.northDryBeltEquatorwardMassFluxKgM_1S, 0.08);
  assert.equal(hadleyReport.lowLevelSourcePartition.importedSourceProxyFrac, 0.75248);
  assert.ok(hadleyReport.rootCauseAssessment.ruledIn.some((line) => line.includes('22')));
  assert.equal(matrixReport.latitudeBands[0].key, 'northDryBelt');
  assert.deepEqual(hadleyReport.streamfunctionProxy.massStreamfunctionProxyKgS[1], [4, 5, 6]);
});

test('vertical cloud-birth reports surface the dominant NH dry-belt channel and histograms', () => {
  const sample = {
    targetDay: 30,
    verticalCloudBirthTracing: {
      attribution: {
        northDryBeltChannelMeansKgM2: {
          resolvedAscentCloudBirth: 0.04,
          saturationAdjustmentCloudBirth: 0.11,
          convectiveDetrainmentCloudBirth: 0.001,
          carryOverUpperCloudEntering: 0.35,
          carryOverUpperCloudSurviving: 0.29
        },
        northDryBeltCarryOverSurvivalFrac: 0.82857
      },
      histograms: {
        supersaturation: [
          { key: 'pct1to3', sampleCount: 3, eventCount: 11, cloudBirthMassKgM2: 0.08 }
        ],
        ascentMagnitudePaS: [
          { key: 'organized', sampleCount: 2, eventCount: 9, cloudBirthMassKgM2: 0.06 }
        ]
      },
      originMatrix: {
        sectors: [{ key: 'atlantic', label: 'Atlantic' }],
        levelBands: [{ key: 'upperTroposphere', label: 'Upper troposphere' }],
        channels: [{ key: 'carryOverUpperCloudSurviving', label: 'Carry-over upper cloud surviving step' }],
        matrixBySector: {
          atlantic: {
            label: 'Atlantic',
            carryOverUpperCloudSurviving: 0.31,
            levelBands: {
              upperTroposphere: {
                label: 'Upper troposphere',
                carryOverUpperCloudSurviving: 0.28
              }
            }
          }
        }
      },
      rootCauseAssessment: {
        ruledIn: ['Persistent carried-over upper cloud outweighs local NH dry-belt cloud birth channels.'],
        ruledOut: ['Local convective detrainment is not the main NH dry-belt cloud-birth source.'],
        ambiguous: []
      }
    }
  };

  const attributionReport = planetaryAuditTest.buildVerticalCloudBirthAttributionReport(sample);
  const histogramsReport = planetaryAuditTest.buildVerticalCloudBirthHistogramsReport(sample);
  const matrixReport = planetaryAuditTest.buildDryBeltCloudOriginMatrixReport(sample);

  assert.equal(attributionReport.dominantNhDryBeltChannel.key, 'carryOverUpperCloudEntering');
  assert.equal(attributionReport.attribution.northDryBeltCarryOverSurvivalFrac, 0.82857);
  assert.equal(histogramsReport.histograms.supersaturation[0].eventCount, 11);
  assert.equal(matrixReport.originMatrix.matrixBySector.atlantic.levelBands.upperTroposphere.carryOverUpperCloudSurviving, 0.28);
});
