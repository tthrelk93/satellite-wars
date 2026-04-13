import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as phase1eTest } from '../../scripts/agent/phase1e-proof-vs-climate-delta-attribution.mjs';

test('symmetricDirectionalDelta preserves harmful direction across opposite metric directions', () => {
  assert.ok(phase1eTest.symmetricDirectionalDelta(1.2, 0.5, -1) > 0);
  assert.ok(phase1eTest.symmetricDirectionalDelta(23.6, 26.4, 1) > 0);
});

test('buildFamilyRanking ranks the strongest rebound family first', () => {
  const ranking = phase1eTest.buildFamilyRanking({
    baselineMetrics: {
      itczWidthDeg: 23.6,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.52,
      midlatitudeWesterliesNorthU10Ms: 1.2,
      midlatitudeWesterliesSouthU10Ms: 0.94,
      crossEquatorialVaporFluxNorthKgM_1S: 10,
      northDryBeltLargeScaleCondensationMeanKgM2: 0.05,
      northDryBeltUpperCloudPathMeanKgM2: 0.08,
      northDryBeltImportedAnvilPersistenceMeanKgM2: 0.08,
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.08,
      northDryBeltCarriedOverUpperCloudMeanKgM2: 0.08,
      northDryBeltSurfaceCloudShieldingMeanWm2: 60,
      northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: 20,
      northDryBeltBoundaryLayerRhMeanFrac: 0.4,
      northDryBeltMidTroposphereRhMeanFrac: 0.3,
      globalCloudMeanFrac: 0.69,
      globalPrecipMeanMmHr: 0.15
    },
    patchedMetrics: {
      itczWidthDeg: 26.4,
      subtropicalDryNorthRatio: 1.7,
      subtropicalDrySouthRatio: 1.3,
      midlatitudeWesterliesNorthU10Ms: 0.53,
      midlatitudeWesterliesSouthU10Ms: 0.85,
      crossEquatorialVaporFluxNorthKgM_1S: 120,
      northDryBeltLargeScaleCondensationMeanKgM2: 0.09,
      northDryBeltUpperCloudPathMeanKgM2: 0.09,
      northDryBeltImportedAnvilPersistenceMeanKgM2: 0.081,
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.082,
      northDryBeltCarriedOverUpperCloudMeanKgM2: 0.081,
      northDryBeltSurfaceCloudShieldingMeanWm2: 61,
      northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: 20.1,
      northDryBeltBoundaryLayerRhMeanFrac: 0.41,
      northDryBeltMidTroposphereRhMeanFrac: 0.31,
      globalCloudMeanFrac: 0.7,
      globalPrecipMeanMmHr: 0.151
    }
  });

  assert.equal(ranking[0].key, 'circulation_moisture_reorganization');
  assert.ok(ranking[0].score > ranking[1].score);
});

test('buildPhase1EDeltaAttributionReport surfaces band deltas and dominant family', () => {
  const latitudesDeg = [-30, -15, 0, 15, 30];
  const baselineProfiles = [{
    targetDay: 30,
    profiles: {
      latitudesDeg,
      series: {
        cloudTotalFraction: [0.4, 0.45, 0.7, 0.5, 0.45],
        precipRateMmHr: [0.05, 0.08, 0.2, 0.09, 0.06],
        wind10mU: [0.9, -0.3, -0.1, -0.4, 1.1],
        convectiveOrganization: [0.1, 0.2, 0.7, 0.25, 0.15]
      }
    }
  }];
  const patchedProfiles = [{
    targetDay: 30,
    profiles: {
      latitudesDeg,
      series: {
        cloudTotalFraction: [0.48, 0.6, 0.76, 0.62, 0.58],
        precipRateMmHr: [0.09, 0.16, 0.24, 0.18, 0.11],
        wind10mU: [0.82, -0.28, -0.08, -0.25, 0.7],
        convectiveOrganization: [0.12, 0.26, 0.75, 0.31, 0.22]
      }
    }
  }];
  const report = phase1eTest.buildPhase1EDeltaAttributionReport({
    baselineSummary: {
      samples: [{ targetDay: 30, metrics: {
        itczWidthDeg: 23.6,
        subtropicalDryNorthRatio: 1.1,
        subtropicalDrySouthRatio: 0.52,
        midlatitudeWesterliesNorthU10Ms: 1.2,
        midlatitudeWesterliesSouthU10Ms: 0.94,
        crossEquatorialVaporFluxNorthKgM_1S: 12,
        northDryBeltLargeScaleCondensationMeanKgM2: 0.05,
        northDryBeltUpperCloudPathMeanKgM2: 0.08,
        northDryBeltImportedAnvilPersistenceMeanKgM2: 0.08,
        northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.08,
        northDryBeltCarriedOverUpperCloudMeanKgM2: 0.08,
        northDryBeltSurfaceCloudShieldingMeanWm2: 60,
        northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: 20,
        northDryBeltBoundaryLayerRhMeanFrac: 0.42,
        northDryBeltMidTroposphereRhMeanFrac: 0.31,
        globalCloudMeanFrac: 0.69,
        globalPrecipMeanMmHr: 0.15
      }}],
      runManifest: { config: { carryInputOverrideMode: 'off' } }
    },
    patchedSummary: {
      samples: [{ targetDay: 30, metrics: {
        itczWidthDeg: 26.4,
        subtropicalDryNorthRatio: 1.7,
        subtropicalDrySouthRatio: 1.3,
        midlatitudeWesterliesNorthU10Ms: 0.53,
        midlatitudeWesterliesSouthU10Ms: 0.85,
        crossEquatorialVaporFluxNorthKgM_1S: 120,
        northDryBeltLargeScaleCondensationMeanKgM2: 0.09,
        northDryBeltUpperCloudPathMeanKgM2: 0.09,
        northDryBeltImportedAnvilPersistenceMeanKgM2: 0.081,
        northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.082,
        northDryBeltCarriedOverUpperCloudMeanKgM2: 0.081,
        northDryBeltSurfaceCloudShieldingMeanWm2: 61,
        northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: 20.1,
        northDryBeltBoundaryLayerRhMeanFrac: 0.43,
        northDryBeltMidTroposphereRhMeanFrac: 0.32,
        globalCloudMeanFrac: 0.7,
        globalPrecipMeanMmHr: 0.151,
        northDryBeltCarryInputOverrideAccumHitMean: 0.61
      }}],
      runManifest: { config: { carryInputOverrideMode: 'on' } }
    },
    baselineProfiles,
    patchedProfiles,
    baselineSummaryPath: '/tmp/baseline.json',
    patchedSummaryPath: '/tmp/patched.json',
    reportBasePath: '/tmp/phase1e'
  });

  assert.equal(report.targetDay, 30);
  assert.equal(report.dominantCompensationFamily.key, 'circulation_moisture_reorganization');
  assert.ok(report.bandDeltaAttribution.cloudTotalFraction.find((row) => row.band === 'northTransition').delta > 0);
  assert.ok(report.patchedCarryOverrideFootprint.northDryBeltCarryInputOverrideAccumHitMean > 0);
});
