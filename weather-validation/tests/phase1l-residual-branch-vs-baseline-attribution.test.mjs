import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as phase1lTest } from '../../scripts/agent/phase1l-residual-branch-vs-baseline-attribution.mjs';

test('buildComparableProfileMetrics derives shared-band means from sample profiles', () => {
  const metrics = phase1lTest.buildComparableProfileMetrics({
    profiles: {
      latitudesDeg: [-30, -15, 0, 15, 30],
      series: {
        precipRateMmHr: [0.08, 0.12, 0.2, 0.14, 0.1],
        cloudTotalFraction: [0.5, 0.55, 0.7, 0.58, 0.52],
        lowerTroposphericRhFrac: [0.42, 0.48, 0.7, 0.5, 0.44],
        totalColumnWaterKgM2: [18, 24, 36, 26, 20],
        lowerLevelMoistureConvergenceS_1: [0.000002, 0.000004, 0.000006, 0.000005, 0.000003],
        subtropicalSubsidenceDryingFrac: [0.08, 0.03, 0.0, 0.02, 0.07],
        convectiveOrganization: [0.12, 0.2, 0.72, 0.24, 0.16],
        convectiveMassFluxKgM2S: [0.0001, 0.0003, 0.0012, 0.00035, 0.00012],
        anvilPersistenceFrac: [0.08, 0.12, 0.7, 0.14, 0.1]
      }
    }
  });

  assert.ok(metrics.northDryBeltPrecipMeanMmHr > 0);
  assert.ok(metrics.tropicalCoreConvectiveOrganizationMeanFrac > metrics.northTransitionConvectiveOrganizationMeanFrac);
  assert.ok(metrics.northDryBeltAnvilPersistenceMeanFrac > 0);
});

test('buildFamilyRanking surfaces broadened tropical response when transition rain and width worsen', () => {
  const ranking = phase1lTest.buildFamilyRanking({
    baselineMetrics: {
      itczWidthDeg: 23.6,
      northTransitionPrecipMeanMmHr: 0.08,
      southTransitionPrecipMeanMmHr: 0.07,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.52,
      tropicalCoreConvectiveOrganizationMeanFrac: 0.35,
      northDryBeltPrecipMeanMmHr: 0.08,
      northDryBeltCloudMeanFrac: 0.48,
      northDryBeltLowerRhMeanFrac: 0.4,
      northDryBeltTcwMeanKgM2: 22,
      northDryBeltMoistureConvergenceMeanS_1: 0.000003,
      midlatitudeWesterliesNorthU10Ms: 1.2,
      midlatitudeWesterliesSouthU10Ms: 0.94,
      northDryBeltSubsidenceDryingMeanFrac: 0.07,
      southDryBeltSubsidenceDryingMeanFrac: 0.04,
      northDryBeltAnvilPersistenceMeanFrac: 0.12
    },
    currentMetrics: {
      itczWidthDeg: 26.0,
      northTransitionPrecipMeanMmHr: 0.15,
      southTransitionPrecipMeanMmHr: 0.13,
      subtropicalDryNorthRatio: 1.5,
      subtropicalDrySouthRatio: 1.1,
      tropicalCoreConvectiveOrganizationMeanFrac: 0.34,
      northDryBeltPrecipMeanMmHr: 0.09,
      northDryBeltCloudMeanFrac: 0.5,
      northDryBeltLowerRhMeanFrac: 0.41,
      northDryBeltTcwMeanKgM2: 23,
      northDryBeltMoistureConvergenceMeanS_1: 0.0000035,
      midlatitudeWesterliesNorthU10Ms: 1.0,
      midlatitudeWesterliesSouthU10Ms: 0.9,
      northDryBeltSubsidenceDryingMeanFrac: 0.075,
      southDryBeltSubsidenceDryingMeanFrac: 0.035,
      northDryBeltAnvilPersistenceMeanFrac: 0.14
    }
  });

  assert.equal(ranking[0].key, 'broadened_tropical_response');
  assert.equal(phase1lTest.chooseNextPatchLane(ranking).key, 'phase1m-tropical-response-containment');
});

test('buildPhase1LResidualReport returns dominant family, current corroboration, and next lane', () => {
  const latitudesDeg = [-30, -15, 0, 15, 30];
  const baselineProfiles = [{
    targetDay: 30,
    profiles: {
      latitudesDeg,
      series: {
        precipRateMmHr: [0.05, 0.08, 0.2, 0.09, 0.06],
        cloudTotalFraction: [0.42, 0.46, 0.68, 0.5, 0.44],
        convectiveOrganization: [0.12, 0.2, 0.72, 0.24, 0.16],
        lowerTroposphericRhFrac: [0.4, 0.46, 0.72, 0.48, 0.42],
        wind10mU: [1.0, -0.35, -0.1, -0.3, 1.1],
        totalColumnWaterKgM2: [18, 24, 35, 25, 19],
        lowerLevelMoistureConvergenceS_1: [0.000002, 0.000004, 0.000006, 0.0000045, 0.0000025],
        subtropicalSubsidenceDryingFrac: [0.08, 0.03, 0.0, 0.02, 0.07],
        convectiveMassFluxKgM2S: [0.0001, 0.0003, 0.0011, 0.00033, 0.00011],
        anvilPersistenceFrac: [0.08, 0.11, 0.7, 0.13, 0.09]
      }
    }
  }];
  const currentProfiles = [{
    targetDay: 30,
    profiles: {
      latitudesDeg,
      series: {
        precipRateMmHr: [0.09, 0.13, 0.21, 0.15, 0.1],
        cloudTotalFraction: [0.5, 0.57, 0.71, 0.61, 0.55],
        convectiveOrganization: [0.14, 0.24, 0.71, 0.28, 0.19],
        lowerTroposphericRhFrac: [0.45, 0.52, 0.74, 0.56, 0.49],
        wind10mU: [0.78, -0.28, -0.08, -0.18, 0.72],
        totalColumnWaterKgM2: [20, 28, 36, 29, 23],
        lowerLevelMoistureConvergenceS_1: [0.0000025, 0.000005, 0.0000065, 0.0000053, 0.000003],
        subtropicalSubsidenceDryingFrac: [0.07, 0.025, 0.0, 0.015, 0.055],
        convectiveMassFluxKgM2S: [0.00012, 0.00034, 0.00108, 0.00035, 0.00013],
        anvilPersistenceFrac: [0.11, 0.16, 0.73, 0.18, 0.14]
      }
    }
  }];

  const report = phase1lTest.buildPhase1LResidualReport({
    trustedBaselineSummary: {
      samples: [{ targetDay: 30, metrics: {
        itczWidthDeg: 23.6,
        subtropicalDryNorthRatio: 1.1,
        subtropicalDrySouthRatio: 0.52,
        subtropicalSubsidenceNorthMean: 0.065,
        subtropicalSubsidenceSouthMean: 0.038,
        midlatitudeWesterliesNorthU10Ms: 1.2,
        midlatitudeWesterliesSouthU10Ms: 0.94,
        tropicalConvectiveOrganization: 0.33,
        tropicalConvectiveMassFluxKgM2S: 0.0009,
        equatorialPrecipMeanMmHr: 0.13
      }}],
      runManifest: { gitCommit: 'baseline123' }
    },
    currentSummary: {
      samples: [{ targetDay: 30, metrics: {
        itczWidthDeg: 25.9,
        subtropicalDryNorthRatio: 1.52,
        subtropicalDrySouthRatio: 1.19,
        subtropicalSubsidenceNorthMean: 0.086,
        subtropicalSubsidenceSouthMean: 0.032,
        midlatitudeWesterliesNorthU10Ms: 0.53,
        midlatitudeWesterliesSouthU10Ms: 0.85,
        tropicalConvectiveOrganization: 0.343,
        tropicalConvectiveMassFluxKgM2S: 0.0009,
        equatorialPrecipMeanMmHr: 0.138,
        northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1526,
        northDryBeltOceanMarineCondensationMeanKgM2: 0.1526,
        northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2: 0.04238,
        northDryBeltOceanSoftLiveGateHitMean: 3.55,
        northDryBeltOceanSoftLiveGateSelectorSupportMeanFrac: 0.56,
        northDryBeltImportedAnvilPersistenceMeanKgM2: 0.22,
        northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.22,
        northDryBeltCarriedOverUpperCloudMeanKgM2: 0.22,
        northDryBeltUpperCloudPathMeanKgM2: 0.21
      }}],
      runManifest: { gitCommit: 'current123', config: { softLiveGatePatchMode: 'default' } }
    },
    trustedBaselineProfiles: baselineProfiles,
    currentProfiles,
    trustedBaselineSummaryPath: '/tmp/trusted.json',
    currentSummaryPath: '/tmp/current.json',
    reportBasePath: '/tmp/phase1l'
  });

  assert.equal(report.targetDay, 30);
  assert.ok(report.dominantResidualFamily);
  assert.ok(report.nextPatchLane);
  assert.ok(report.currentCorroboration.northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2 > 0);
  assert.equal(report.current.softLiveGatePatchMode, 'default');
});
