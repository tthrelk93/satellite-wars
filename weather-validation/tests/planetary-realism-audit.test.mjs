import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  _test as planetaryAuditTest
} from '../../scripts/agent/planetary-realism-audit.mjs';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);

test('planetary audit CLI rejects unknown flags and supports label artifact bases', () => {
  assert.deepEqual(
    planetaryAuditTest.collectUnknownAuditCliFlags(['--preset', 'quick', '--label=phase0-smoke', '--bogus']),
    ['--bogus']
  );
  assert.equal(
    planetaryAuditTest.resolveAuditLabelReportBase('phase0-smoke', { repoRoot }),
    path.join(repoRoot, 'weather-validation', 'output', 'phase0-smoke')
  );
  assert.equal(
    planetaryAuditTest.resolveAuditLabelReportBase('weather-validation/output/custom-audit.json', { repoRoot }),
    path.join(repoRoot, 'weather-validation', 'output', 'custom-audit')
  );
});

test('annual audit execution modes honor explicit no-counterfactuals', () => {
  assert.equal(
    planetaryAuditTest.resolveAuditExecutionModes({ preset: 'annual', counterfactuals: false }).runDeepProofDiagnostics,
    false
  );
  assert.equal(
    planetaryAuditTest.resolveAuditExecutionModes({ preset: 'annual', counterfactuals: null }).runDeepProofDiagnostics,
    true
  );
  assert.equal(
    planetaryAuditTest.resolveAuditExecutionModes({ preset: 'quick', counterfactuals: true }).runDeepProofDiagnostics,
    true
  );
});

test('audit artifact metadata preserves object schemas and wraps array payloads', () => {
  const auditRun = planetaryAuditTest.buildAuditRunMetadata({
    repoRoot,
    generatedAt: '2026-04-23T00:00:00.000Z',
    argv: ['--preset', 'quick', '--grid=48x24'],
    config: {
      preset: 'quick',
      nx: 48,
      ny: 24,
      dtSeconds: 1800,
      seed: 12345
    }
  });
  assert.equal(auditRun.preset, 'quick');
  assert.equal(auditRun.grid, '48x24');
  assert.equal(auditRun.dtSeconds, 1800);
  assert.equal(auditRun.seed, 12345);
  assert.equal(auditRun.flags.flags['--grid'], '48x24');
  assert.ok(Array.isArray(auditRun.changedFiles));

  const stampedObject = planetaryAuditTest.stampAuditArtifact(
    { schema: 'example.v1', value: 1 },
    auditRun,
    'objectArtifact'
  );
  assert.equal(stampedObject.schema, 'example.v1');
  assert.equal(stampedObject.auditRun.artifactKind, 'objectArtifact');
  assert.equal(stampedObject.auditRun.gitHash?.length > 0, true);

  const stampedArray = planetaryAuditTest.stampAuditArtifact([{ value: 1 }], auditRun, 'arrayArtifact');
  assert.equal(stampedArray.schema, 'satellite-wars.audit-artifact-wrapper.v1');
  assert.equal(stampedArray.auditRun.artifactKind, 'arrayArtifact');
  assert.deepEqual(stampedArray.data, [{ value: 1 }]);
});

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
  assert.equal(snapshot.profiles.series.lowerTroposphericOmegaPaS.length, 3);
  assert.equal(snapshot.profiles.series.midTroposphericOmegaPaS.length, 3);
  assert.equal(snapshot.profiles.series.dryingOmegaBridgeProjectedAppliedPaS.length, 3);
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

test('buildPhase7And9Reports preserve helper-opposition, initialization-memory, and sensitivity summaries', () => {
  const sampleDay10 = {
    targetDay: 10,
    metrics: {
      northDryBeltSourceNorthDryBeltOceanMeanKgM2: 1.2,
      northDryBeltSourceLandRecyclingMeanKgM2: 0.3,
      northDryBeltSourceTropicalOceanNorthMeanKgM2: 0.2,
      northDryBeltSourceTropicalOceanSouthMeanKgM2: 0.1,
      northDryBeltSourceNorthExtratropicalOceanMeanKgM2: 0.5,
      northDryBeltSourceOtherOceanMeanKgM2: 0.2,
      northDryBeltSourceInitializationMemoryMeanKgM2: 0.9,
      northDryBeltSourceAtmosphericCarryoverMeanKgM2: 2.4,
      northDryBeltSourceNudgingInjectionMeanKgM2: 0.05,
      northDryBeltSourceAnalysisInjectionMeanKgM2: 0.04,
      northDryBeltCarriedOverUpperCloudMeanKgM2: 0.6,
      northDryBeltLargeScaleCondensationMeanKgM2: 0.2
    },
    forcingOppositionTracing: {
      northDryBelt: {
        nudgingMoisteningMeanKgM2: 0.03,
        analysisMoisteningMeanKgM2: 0.01,
        nudgingTargetQvMismatchMeanKgKg: 0.002,
        nudgingTargetThetaMismatchMeanK: 0.8,
        nudgingTargetWindMismatchMeanMs: 1.2,
        analysisTargetQvMismatchMeanKgKg: 0.001,
        analysisTargetThetaMismatchMeanK: 0.6,
        analysisTargetWindMismatchMeanMs: 0.9,
        windTargetMismatchMeanMs: 1.5
      },
      levelBands: {
        upperTroposphere: { nudgingMoisteningMeanKgM2: 0.01 }
      },
      rootCauseAssessment: {
        ruledOut: ['helpers_small'],
        ruledIn: [],
        ambiguous: []
      }
    },
    numericalIntegrityTracing: {
      northDryBelt: {
        negativeClipMassMeanKgM2: 0.001,
        cloudLimiterMassMeanKgM2: 0.002,
        verticalCflClampMassMeanKgM2: 0.003
      },
      southDryBelt: {
        negativeClipMassMeanKgM2: 0.001,
        cloudLimiterMassMeanKgM2: 0.001,
        verticalCflClampMassMeanKgM2: 0.002
      },
      asymmetry: {
        cloudLimiterMassNorthToSouthRatio: 2
      },
      rootCauseAssessment: {
        ruledOut: ['numerics_small'],
        ruledIn: [],
        ambiguous: []
      }
    },
    upperCloudResidenceTracing: {
      ageAttribution: {
        northDryBeltStaleFrac: 0.91
      }
    },
    transportTracing: {
      interfaces: [
        {
          targetLatDeg: 35,
          levelBands: {
            upperTroposphere: {
              cloudFluxNorthKgM_1S: 3.2,
              vaporFluxNorthKgM_1S: 1.1
            }
          }
        }
      ]
    },
    verticalCloudBirthTracing: {
      attribution: {
        northDryBeltChannelMeansKgM2: {
          carryOverUpperCloudEntering: 0.8,
          saturationAdjustmentCloudBirth: 0.2
        }
      }
    },
    stormSpilloverTracing: {
      overall: {
        dominantCombinedRegime: 'persistent_zonal_background'
      }
    }
  };
  const sampleDay30 = {
    ...sampleDay10,
    targetDay: 30,
    metrics: {
      ...sampleDay10.metrics,
      northDryBeltSourceInitializationMemoryMeanKgM2: 0.4
    }
  };

  const forcing = planetaryAuditTest.buildForcingOppositionBudgetReport(sampleDay30);
  const mismatch = planetaryAuditTest.buildNudgingTargetMismatchReport(sampleDay30);
  const initMemory = planetaryAuditTest.buildInitializationMemoryReport([sampleDay10, sampleDay30], sampleDay30);
  const numerical = planetaryAuditTest.buildNumericalIntegritySummaryReport(sampleDay30);
  const dtSensitivity = planetaryAuditTest.buildDtSensitivityReport({
    baselineSample: sampleDay30,
    targetDay: 15,
    variants: [
      {
        variantName: 'dt_half',
        dtSeconds: 900,
        elapsedMs: 100,
        latest: sampleDay30
      }
    ]
  });
  const gridSensitivity = planetaryAuditTest.buildGridSensitivityReport({
    baselineSample: sampleDay30,
    targetDay: 15,
    variants: [
      {
        variantName: 'grid_coarse',
        nx: 36,
        ny: 18,
        elapsedMs: 120,
        latest: sampleDay30
      }
    ]
  });

  assert.equal(forcing.northDryBelt.nudgingMoisteningMeanKgM2, 0.03);
  assert.equal(mismatch.northDryBelt.windTargetMismatchMeanMs, 1.5);
  assert.equal(initMemory.milestones[0].requestedDay, 10);
  assert.equal(initMemory.milestones[1].sampledDay, 30);
  assert.equal(numerical.northDryBelt.verticalCflClampMassMeanKgM2, 0.003);
  assert.equal(numerical.numericalIntegrityScore.pass, true);
  assert.equal(dtSensitivity.storyStablePass, true);
  assert.equal(dtSensitivity.dryBeltRatioStablePass, true);
  assert.equal(dtSensitivity.pass, true);
  assert.equal(gridSensitivity.storyStablePass, true);
  assert.equal(gridSensitivity.rootCauseRankingStablePass, true);
  assert.equal(gridSensitivity.pass, true);

  const blockedScore = planetaryAuditTest.computeNumericalIntegrityScore({
    numericalIntegrityTracing: {
      northDryBelt: {
        supersaturationClampMassMeanKgM2: 5,
        verticalCflClampMassMeanKgM2: 100,
        cloudLimiterMassMeanKgM2: 0,
        negativeClipMassMeanKgM2: 0
      },
      southDryBelt: {
        supersaturationClampMassMeanKgM2: 3,
        verticalCflClampMassMeanKgM2: 80,
        cloudLimiterMassMeanKgM2: 0,
        negativeClipMassMeanKgM2: 0
      }
    }
  });
  assert.equal(blockedScore.pass, false);
  assert.ok(blockedScore.blockers.includes('vertical_cfl_limiter_mass_dominates'));
});

test('water-cycle budget report separates physical E/P closure from numerical transport residuals', () => {
  const report = planetaryAuditTest.buildWaterCycleBudgetReport({
    preset: 'annual',
    conservationSummary: {
      conservationBudget: {
        sampledModelSeconds: 365 * 86400,
        waterCycle: {
          sampledModelSeconds: 365 * 86400,
          evaporationMeanMm: 1000,
          precipitationMeanMm: 960,
          evapMinusPrecipMeanMm: 40,
          evapPrecipRelativeImbalance: 0.04,
          tcwDriftKgM2: 8,
          nudgingNetDeltaKgM2: 0.5,
          advectionNetDeltaKgM2: 0.02,
          verticalNetDeltaKgM2: 0.3,
          verticalUnaccountedDeltaKgM2: 0.3,
          verticalSubtropicalDryingDemandKgM2: 25,
          verticalCloudErosionToVaporKgM2: 5,
          transportNumericalResidualKgM2: 0.32,
          advectionRepairMeanKgM2: 12,
          advectionRepairAddedMeanKgM2: 6,
          advectionRepairRemovedMeanKgM2: 6,
          advectionRepairResidualMeanKgM2: 0.00001,
          tropicalSourceMidlatPolarDeltaKgM2: 0.2
        }
      }
    }
  });

  assert.equal(report.pass, true);
  assert.equal(report.annualReady, true);
  assert.equal(report.evapPrecipRelativeImbalance, 0.04);
  assert.equal(report.verticalSubtropicalDryingDemandKgM2, 25);

  const blocked = planetaryAuditTest.buildWaterCycleBudgetReport({
    preset: 'annual',
    conservationSummary: {
      conservationBudget: {
        sampledModelSeconds: 365 * 86400,
        waterCycle: {
          sampledModelSeconds: 365 * 86400,
          evaporationMeanMm: 1000,
          precipitationMeanMm: 700,
          evapMinusPrecipMeanMm: 300,
          evapPrecipRelativeImbalance: 0.3,
          tcwDriftKgM2: 60,
          advectionNetDeltaKgM2: 4,
          verticalNetDeltaKgM2: 2,
          verticalUnaccountedDeltaKgM2: 2,
          transportNumericalResidualKgM2: 6,
          advectionRepairMeanKgM2: 120,
          tropicalSourceMidlatPolarDeltaKgM2: 3
        }
      }
    }
  });

  assert.equal(blocked.pass, false);
  assert.ok(blocked.blockers.includes('evap_precip_imbalance'));
  assert.ok(blocked.blockers.includes('advection_net_water_source_sink'));
  assert.ok(blocked.blockers.includes('transport_numerical_residual'));
  assert.ok(blocked.blockers.includes('tropical_source_numerical_leakage'));
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

test('phase 10 reports preserve seasonal attribution stability and lag ranking', () => {
  const makeSample = ({ targetDay, monthIndex, carry, largeScale, dryRatio, initMemory }) => ({
    targetDay,
    monthIndex,
    metrics: {
      subtropicalDryNorthRatio: dryRatio,
      subtropicalRhNorthMeanFrac: 0.72 + carry * 0.02,
      northDryBeltUpperCloudPathMeanKgM2: carry + largeScale + 0.2,
      northDryBeltOceanPrecipMeanMmHr: 0.25 + carry * 0.05,
      northDryBeltSourceNorthDryBeltOceanMeanKgM2: 0.8,
      northDryBeltSourceLandRecyclingMeanKgM2: 0.2,
      northDryBeltSourceTropicalOceanNorthMeanKgM2: 0.3,
      northDryBeltSourceTropicalOceanSouthMeanKgM2: 0.1,
      northDryBeltSourceNorthExtratropicalOceanMeanKgM2: 0.2,
      northDryBeltSourceOtherOceanMeanKgM2: 0.1,
      northDryBeltSourceInitializationMemoryMeanKgM2: initMemory,
      northDryBeltSourceAtmosphericCarryoverMeanKgM2: carry * 8,
      northDryBeltSourceNudgingInjectionMeanKgM2: 0.01,
      northDryBeltSourceAnalysisInjectionMeanKgM2: 0,
      northDryBeltCarriedOverUpperCloudMeanKgM2: carry,
      northDryBeltImportedAnvilPersistenceMeanKgM2: carry * 0.35,
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: carry * 0.85,
      northDryBeltLargeScaleCondensationMeanKgM2: largeScale,
      northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2: largeScale * 0.35,
      northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2: 0.01,
      northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: 8
    },
    upperCloudResidenceTracing: {
      ageAttribution: {
        northDryBeltStaleFrac: 0.88
      },
      erosionBudget: {
        northDryBeltBlockedErosionFrac: 0.9
      },
      ventilation: {
        north35UpperTroposphereImportMagnitudeKgM_1S: 3.6
      }
    },
    thermodynamicSupportTracing: {
      classification: {
        radiationSupportScore: 0.2,
        moistureSupportScore: 0.3
      }
    },
    forcingOppositionTracing: {
      northDryBelt: {
        nudgingMoisteningMeanKgM2: 0.01,
        analysisMoisteningMeanKgM2: 0,
        nativeDryingSupportMeanKgM2: 10,
        windOpposedDryingCorrectionMean: 50,
        nudgingTargetQvMismatchMeanKgKg: 0.0005
      }
    },
    numericalIntegrityTracing: {
      northDryBelt: {
        supersaturationClampMassMeanKgM2: 5,
        verticalCflClampMassMeanKgM2: 100,
        cloudLimiterMassMeanKgM2: 0,
        negativeClipMassMeanKgM2: 0
      }
    },
    stormSpilloverTracing: {
      overall: {
        regimes: {
          persistent_zonal_background: { combinedContributionFrac: 0.86 },
          synoptic_storm_leakage: { combinedContributionFrac: 0.02 },
          tropical_spillover: { combinedContributionFrac: 0.01 },
          subtropical_marine_deck_drizzle: { combinedContributionFrac: 0.11 }
        }
      }
    }
  });

  const samples = [
    makeSample({ targetDay: 15, monthIndex: 0, carry: 0.4, largeScale: 0.12, dryRatio: 0.82, initMemory: 0.5 }),
    makeSample({ targetDay: 30, monthIndex: 1, carry: 0.55, largeScale: 0.14, dryRatio: 0.9, initMemory: 0.42 }),
    makeSample({ targetDay: 45, monthIndex: 2, carry: 0.7, largeScale: 0.16, dryRatio: 0.98, initMemory: 0.34 }),
    makeSample({ targetDay: 60, monthIndex: 3, carry: 0.85, largeScale: 0.18, dryRatio: 1.06, initMemory: 0.26 }),
    makeSample({ targetDay: 75, monthIndex: 4, carry: 1.0, largeScale: 0.2, dryRatio: 1.14, initMemory: 0.18 }),
    makeSample({ targetDay: 90, monthIndex: 5, carry: 1.15, largeScale: 0.22, dryRatio: 1.22, initMemory: 0.1 })
  ];

  const monthlyAttribution = planetaryAuditTest.buildMonthlyAttributionClimatology(samples);
  const seasonalRanking = planetaryAuditTest.buildSeasonalRootCauseRanking(samples);
  const lagAnalysis = planetaryAuditTest.buildAttributionLagAnalysis(samples);

  assert.equal(monthlyAttribution.months[0].dominantFamily.key, 'importedCloudPersistence');
  assert.equal(seasonalRanking.dominantAnnualFamily.key, 'importedCloudPersistence');
  assert.equal(seasonalRanking.stability.stableAcrossMonthsPass, true);
  assert.equal(seasonalRanking.rootCauseAssessment.ruledIn[0], 'Seasonal attribution stays anchored on Imported cloud persistence.');
  assert.ok([
    'importedCloudPersistenceScore',
    'sourceAtmosphericCarryoverMeanKgM2'
  ].includes(lagAnalysis.predictorRanking[0].predictorKey));
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

test('phase 11 counterfactual ranking surfaces stable causal candidates', () => {
  const baselineSample = {
    metrics: {
      subtropicalDryNorthRatio: 1.1,
      subtropicalRhNorthMeanFrac: 0.86,
      northDryBeltUpperCloudPathMeanKgM2: 0.35,
      northDryBeltCarriedOverUpperCloudMeanKgM2: 0.28,
      northDryBeltLargeScaleCondensationMeanKgM2: 0.14,
      itczWidthDeg: 23.6,
      subtropicalSubsidenceSouthMean: 0.038,
      tropicalTradesNorthU10Ms: -0.7,
      tropicalTradesSouthU10Ms: -0.5,
      midlatitudeWesterliesNorthU10Ms: 1.1,
      midlatitudeWesterliesSouthU10Ms: 0.9
    }
  };
  const variants = [
    {
      key: 'upperCloudErosion',
      label: 'Upper-cloud erosion boost',
      family: 'Blocked upper-cloud erosion',
      description: 'Remove blocked erosion mass.',
      strength: 0.18,
      elapsedMs: 1200,
      interventionSummary: { removedCloudKgM2: 0.08, removedVaporKgM2: 0.01, returnedCloudToVaporKgM2: 0, affectedCellSteps: 42 },
      latest: {
        metrics: {
          subtropicalDryNorthRatio: 0.95,
          subtropicalRhNorthMeanFrac: 0.82,
          northDryBeltUpperCloudPathMeanKgM2: 0.22,
          northDryBeltCarriedOverUpperCloudMeanKgM2: 0.16,
          northDryBeltLargeScaleCondensationMeanKgM2: 0.11,
          itczWidthDeg: 23.5,
          subtropicalSubsidenceSouthMean: 0.039,
          tropicalTradesNorthU10Ms: -0.72,
          tropicalTradesSouthU10Ms: -0.49,
          midlatitudeWesterliesNorthU10Ms: 1.08,
          midlatitudeWesterliesSouthU10Ms: 0.88
        }
      }
    },
    {
      key: 'sourceMoisture',
      label: 'Source moisture ablation',
      family: 'Source moisture supply',
      description: 'Reduce source vapor.',
      strength: 0.18,
      elapsedMs: 1000,
      interventionSummary: { removedCloudKgM2: 0, removedVaporKgM2: 0.05, returnedCloudToVaporKgM2: 0, affectedCellSteps: 30 },
      latest: {
        metrics: {
          subtropicalDryNorthRatio: 1.14,
          subtropicalRhNorthMeanFrac: 0.87,
          northDryBeltUpperCloudPathMeanKgM2: 0.34,
          northDryBeltCarriedOverUpperCloudMeanKgM2: 0.27,
          northDryBeltLargeScaleCondensationMeanKgM2: 0.15,
          itczWidthDeg: 24.4,
          subtropicalSubsidenceSouthMean: 0.027,
          tropicalTradesNorthU10Ms: -0.12,
          tropicalTradesSouthU10Ms: -0.18,
          midlatitudeWesterliesNorthU10Ms: 0.1,
          midlatitudeWesterliesSouthU10Ms: 0.15
        }
      }
    }
  ];
  const sensitivityReport = planetaryAuditTest.buildCounterfactualPathwaySensitivityReport({
    baselineSample,
    targetDay: 30,
    variants,
    sensitivityVariantsByKey: {
      upperCloudErosion: [
        {
          scenarioKey: 'dt_half',
          scenarioLabel: 'DT half',
          improvement: {
            dryRatioImprovement: 0.11,
            directionalImprovementScore: 0.41
          },
          storyComparison: { stable: true }
        }
      ]
    }
  });
  const rankingReport = planetaryAuditTest.buildRootCauseCandidateRankingReport(sensitivityReport);

  assert.equal(sensitivityReport.topCandidates[0].key, 'upperCloudErosion');
  assert.equal(sensitivityReport.pathways[0].improvement.directionalImprovementPass, true);
  assert.equal(sensitivityReport.pathways[0].sensitivity.directionalSensitivityPass, true);
  assert.equal(rankingReport.primaryCandidate.key, 'upperCloudErosion');
  assert.equal(rankingReport.closureReadyPass, true);
  assert.ok(rankingReport.rootCauseAssessment.ruledOut.some((line) => line.includes('Source moisture ablation')));
});

test('phase D coupled counterfactual reports rank stable guardrail-safe bundles', () => {
  const baselineSample = {
    metrics: {
      subtropicalDryNorthRatio: 1.1,
      subtropicalRhNorthMeanFrac: 0.86,
      northDryBeltUpperCloudPathMeanKgM2: 0.35,
      northDryBeltCarriedOverUpperCloudMeanKgM2: 0.28,
      northDryBeltLargeScaleCondensationMeanKgM2: 0.14,
      itczWidthDeg: 23.6,
      subtropicalSubsidenceSouthMean: 0.038,
      tropicalTradesNorthU10Ms: -0.7,
      tropicalTradesSouthU10Ms: -0.5,
      midlatitudeWesterliesNorthU10Ms: 1.1,
      midlatitudeWesterliesSouthU10Ms: 0.9
    }
  };
  const bundles = [
    {
      key: 'import_erosion_saturation_adjustment',
      label: 'Import + erosion + saturation-adjustment maintenance',
      family: 'Coupled vertical maintenance',
      description: 'Reduce imported cloud persistence, improve erosion, and soften maintenance rebound together.',
      strength: 0.55,
      components: [
        { key: 'upperImport', label: 'Upper import throttle' },
        { key: 'upperCloudErosion', label: 'Upper-cloud erosion boost' },
        { key: 'saturationAdjustmentBirth', label: 'Saturation-adjustment clamp' }
      ],
      elapsedMs: 2100,
      interventionSummary: {
        removedCloudKgM2: 0.12,
        removedVaporKgM2: 0.01,
        returnedCloudToVaporKgM2: 0.03
      },
      latest: {
        metrics: {
          subtropicalDryNorthRatio: 0.93,
          subtropicalRhNorthMeanFrac: 0.8,
          northDryBeltUpperCloudPathMeanKgM2: 0.18,
          northDryBeltCarriedOverUpperCloudMeanKgM2: 0.14,
          northDryBeltLargeScaleCondensationMeanKgM2: 0.09,
          itczWidthDeg: 23.4,
          subtropicalSubsidenceSouthMean: 0.041,
          tropicalTradesNorthU10Ms: -0.73,
          tropicalTradesSouthU10Ms: -0.52,
          midlatitudeWesterliesNorthU10Ms: 1.05,
          midlatitudeWesterliesSouthU10Ms: 0.86
        }
      }
    },
    {
      key: 'maintenance_plus_radiative_support',
      label: 'Maintenance + radiative support',
      family: 'Coupled local maintenance',
      description: 'Attack maintenance without touching import.',
      strength: 0.65,
      components: [
        { key: 'saturationAdjustmentBirth', label: 'Saturation-adjustment clamp' },
        { key: 'radiativeMaintenance', label: 'Radiative maintenance reduction' }
      ],
      elapsedMs: 1900,
      interventionSummary: {
        removedCloudKgM2: 0.04,
        removedVaporKgM2: 0,
        returnedCloudToVaporKgM2: 0.01
      },
      latest: {
        metrics: {
          subtropicalDryNorthRatio: 1.08,
          subtropicalRhNorthMeanFrac: 0.85,
          northDryBeltUpperCloudPathMeanKgM2: 0.3,
          northDryBeltCarriedOverUpperCloudMeanKgM2: 0.24,
          northDryBeltLargeScaleCondensationMeanKgM2: 0.13,
          itczWidthDeg: 24.2,
          subtropicalSubsidenceSouthMean: 0.029,
          tropicalTradesNorthU10Ms: -0.12,
          tropicalTradesSouthU10Ms: -0.18,
          midlatitudeWesterliesNorthU10Ms: 0.19,
          midlatitudeWesterliesSouthU10Ms: 0.15
        }
      }
    }
  ];

  const matrix = planetaryAuditTest.buildCoupledCounterfactualMatrixReport({
    baselineSample,
    targetDay: 30,
    bundles,
    sensitivityVariantsByKey: {
      import_erosion_saturation_adjustment: [
        {
          scenarioKey: 'dt_half',
          scenarioLabel: 'DT half',
          improvement: {
            dryRatioImprovement: 0.14,
            directionalImprovementScore: 0.49
          },
          storyComparison: { stable: true }
        },
        {
          scenarioKey: 'grid_coarse',
          scenarioLabel: 'Grid coarse',
          improvement: {
            dryRatioImprovement: 0.11,
            directionalImprovementScore: 0.33
          },
          storyComparison: { stable: true }
        }
      ],
      maintenance_plus_radiative_support: [
        {
          scenarioKey: 'dt_half',
          scenarioLabel: 'DT half',
          improvement: {
            dryRatioImprovement: -0.02,
            directionalImprovementScore: -0.12
          },
          storyComparison: { stable: false }
        }
      ]
    }
  });
  const ranking = planetaryAuditTest.buildCoupledCounterfactualRankingReport(matrix);
  const guardrails = planetaryAuditTest.buildCoupledCounterfactualGuardrailsReport(matrix);

  assert.equal(matrix.topBundles[0].key, 'import_erosion_saturation_adjustment');
  assert.equal(matrix.bundles[0].sensitivity.tolerableSensitivityPass, true);
  assert.equal(ranking.bestBundle.key, 'import_erosion_saturation_adjustment');
  assert.equal(ranking.exitCriteriaPass, true);
  assert.equal(guardrails.exitCriteriaPass, true);
  assert.equal(guardrails.bundles[0].guardrails.itczWidthPass, true);
  assert.ok(ranking.rootCauseAssessment.ruledOut.some((line) => line.includes('Maintenance + radiative support')));
});

test('phase A observer-effect reports distinguish baseline drift from tracing variants', () => {
  const trustedBaseline = {
    artifactPath: '/tmp/trusted-phase1.json',
    metrics: {
      itczWidthDeg: 23.646,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.519,
      subtropicalSubsidenceNorthMean: 0.065,
      subtropicalSubsidenceSouthMean: 0.038,
      tropicalTradesNorthU10Ms: -0.788,
      tropicalTradesSouthU10Ms: -0.328,
      midlatitudeWesterliesNorthU10Ms: 1.192,
      midlatitudeWesterliesSouthU10Ms: 0.943
    }
  };
  const variants = [
    {
      key: 'full',
      label: 'Current full tracing',
      instrumentationMode: 'full',
      latest: {
        targetDay: 30,
        metrics: {
          itczWidthDeg: 27.36,
          subtropicalDryNorthRatio: 1.772,
          subtropicalDrySouthRatio: 1.437,
          subtropicalSubsidenceNorthMean: 0.085,
          subtropicalSubsidenceSouthMean: 0.033,
          tropicalTradesNorthU10Ms: -0.743,
          tropicalTradesSouthU10Ms: -0.373,
          midlatitudeWesterliesNorthU10Ms: 0.532,
          midlatitudeWesterliesSouthU10Ms: 0.851
        }
      },
      runManifest: {
        runtime: {
          moduleOrder: ['a', 'b'],
          moduleTiming: { modules: {} }
        }
      }
    },
    {
      key: 'noop',
      label: 'Current no-op tracing',
      instrumentationMode: 'noop',
      latest: {
        targetDay: 30,
        metrics: {
          itczWidthDeg: 27.36,
          subtropicalDryNorthRatio: 1.772,
          subtropicalDrySouthRatio: 1.437,
          subtropicalSubsidenceNorthMean: 0.085,
          subtropicalSubsidenceSouthMean: 0.033,
          tropicalTradesNorthU10Ms: -0.743,
          tropicalTradesSouthU10Ms: -0.373,
          midlatitudeWesterliesNorthU10Ms: 0.532,
          midlatitudeWesterliesSouthU10Ms: 0.851
        }
      },
      runManifest: {
        runtime: {
          moduleOrder: ['a', 'b'],
          moduleTiming: { modules: {} }
        }
      }
    },
    {
      key: 'disabled',
      label: 'Current tracing disabled',
      instrumentationMode: 'disabled',
      latest: {
        targetDay: 30,
        metrics: {
          itczWidthDeg: 27.31,
          subtropicalDryNorthRatio: 1.75,
          subtropicalDrySouthRatio: 1.42,
          subtropicalSubsidenceNorthMean: 0.084,
          subtropicalSubsidenceSouthMean: 0.034,
          tropicalTradesNorthU10Ms: -0.744,
          tropicalTradesSouthU10Ms: -0.372,
          midlatitudeWesterliesNorthU10Ms: 0.54,
          midlatitudeWesterliesSouthU10Ms: 0.852
        }
      },
      runManifest: {
        runtime: {
          moduleOrder: ['a', 'b'],
          moduleTiming: { modules: {} }
        }
      }
    }
  ];

  const parityReport = planetaryAuditTest.buildObserverEffectModuleOrderParityReport(variants);
  const diffReport = planetaryAuditTest.buildObserverEffectBaselineDiffReport({
    trustedBaseline,
    variants,
    moduleOrderParity: parityReport
  });
  const markdown = planetaryAuditTest.renderObserverEffectBaselineDiffMarkdown(diffReport);

  assert.equal(diffReport.assessment.baselineReconciledPass, false);
  assert.equal(diffReport.assessment.likelyCause, 'branch_drift_or_audit_semantics_drift');
  assert.equal(diffReport.comparisons.fullVsNoop.itczWidthDeg.delta, 0);
  assert.equal(parityReport.parity.every((entry) => entry.sameOrderAsReference), true);
  assert.ok(markdown.includes('Observer-Effect Baseline Diff'));
});

test('phase B cloud-transition reports surface the first persistent module and sector split', () => {
  const sample = {
    targetDay: 30,
    cloudTransitionLedgerTracing: {
      summary: {
        attributedUpperCloudPathChangeFrac: 0.972,
        firstPersistentProblemModule: 'stepVertical5',
        dominantPersistentModule: 'stepVertical5',
        persistentScoreByModule: {
          stepAdvection5: 0.02,
          stepVertical5: 0.19,
          stepMicrophysics5: 0.08,
          stepRadiation2D5: 0.03
        }
      },
      modules: {
        stepVertical5: {
          bands: {
            upperTroposphere: {
              actualNetCloudDeltaMeanKgM2: 0.041,
              attributedCoverageFrac: 0.981,
              transitions: {
                importedCloudEntering: 0.11,
                importedCloudSurvivingUnchanged: 0.094,
                cloudErodedAway: 0.021,
                cloudConvertedIntoLocalCondensationSupport: 0.056,
                unattributedResidual: 0.002
              }
            }
          }
        }
      },
      sectoral: {
        stepVertical5: {
          eastPacific: {
            bands: {
              upperTroposphere: {
                actualNetCloudDeltaMeanKgM2: 0.055,
                transitions: {
                  importedCloudSurvivingUnchanged: 0.12
                }
              }
            }
          }
        }
      },
      cells: [
        {
          cellIndex: 42,
          latDeg: 22.5,
          lonDeg: -131.25,
          sectorKey: 'eastPacific',
          modules: {
            stepVertical5: {
              upperTroposphere: {
                netCloudDeltaKgM2: 0.08,
                transitions: {
                  importedCloudSurvivingUnchanged: 0.12
                }
              }
            }
          }
        }
      ],
      rootCauseAssessment: {
        ruledIn: ['The first module that turns imported cloud into persistent problem cloud is stepVertical5.'],
        ruledOut: [],
        ambiguous: []
      }
    }
  };

  const full = planetaryAuditTest.buildCloudTransitionLedgerReport(sample);
  const summary = planetaryAuditTest.buildCloudTransitionLedgerSummaryReport(sample);
  const sector = planetaryAuditTest.buildCloudTransitionLedgerSectorSplitReport(sample);

  assert.equal(full.summary.firstPersistentProblemModule, 'stepVertical5');
  assert.equal(full.modules.stepVertical5.bands.upperTroposphere.transitions.importedCloudSurvivingUnchanged, 0.094);
  assert.equal(summary.summary.attributedUpperCloudPathChangeFrac, 0.972);
  assert.equal(sector.sectoral.stepVertical5.eastPacific.bands.upperTroposphere.transitions.importedCloudSurvivingUnchanged, 0.12);
});

test('phase C corridor replay reports preserve checkpoints, slices, and module toggle deltas', () => {
  const phaseCReplay = {
    targetDay: 30,
    targets: [
      {
        sectorKey: 'eastPacific',
        cellIndex: 42,
        latDeg: 22.5,
        lonDeg: -131.25,
        bandKey: 'midTroposphere',
        score: 12.44
      }
    ],
    checkpoints: {
      eastPacific: {
        sectorKey: 'eastPacific',
        cellIndex: 42,
        latDeg: 22.5,
        lonDeg: -131.25,
        bandKey: 'midTroposphere',
        score: 12.44,
        checkpoints: {
          importArrival: { stepIndex: 480, simTimeSeconds: 864000 },
          failedErosion: { stepIndex: 486, simTimeSeconds: 874800 }
        }
      }
    },
    slices: {
      eastPacific: [
        {
          eventKey: 'importArrival',
          checkpointStepIndex: 480,
          checkpointSimTimeSeconds: 864000,
          windowSteps: 6,
          preWindowTotalsByModule: {
            stepVertical5: {
              actualNetCloudDeltaKgM2: 0.02,
              transitions: { importedCloudSurvivingUnchanged: 0.08 }
            }
          },
          eventStepByModule: {
            stepVertical5: {
              actualNetCloudDeltaKgM2: 0.03,
              transitions: { importedCloudEntering: 0.12 }
            }
          },
          postWindowTotalsByModule: {
            stepMicrophysics5: {
              actualNetCloudDeltaKgM2: 0.01,
              transitions: { cloudConvertedIntoLocalCondensationSupport: 0.04 }
            }
          }
        }
      ]
    },
    moduleToggleDeltas: {
      eastPacific: {
        importArrival: {
          toggles: {
            stepVertical5: {
              windows: {
                24: {
                  deltaVsBaseline: {
                    targetCellCloudPathDeltaKgM2: -0.11
                  }
                }
              }
            }
          }
        }
      }
    },
    rootCauseAssessment: {
      ruledIn: ['Replay toggles show the vertical-path handoff is the first causal break in at least two corridor events.'],
      ruledOut: [],
      ambiguous: []
    }
  };

  const catalog = planetaryAuditTest.buildCorridorReplayCatalogReport(phaseCReplay);
  const slices = planetaryAuditTest.buildCorridorStepSliceAttributionReport(phaseCReplay);
  const toggles = planetaryAuditTest.buildCorridorModuleToggleDeltasReport(phaseCReplay);

  assert.equal(catalog.targets[0].sectorKey, 'eastPacific');
  assert.equal(catalog.checkpoints.eastPacific.checkpoints.importArrival.stepIndex, 480);
  assert.equal(slices.slices.eastPacific[0].eventKey, 'importArrival');
  assert.equal(toggles.deltas.eastPacific.importArrival.toggles.stepVertical5.windows[24].deltaVsBaseline.targetCellCloudPathDeltaKgM2, -0.11);
});
