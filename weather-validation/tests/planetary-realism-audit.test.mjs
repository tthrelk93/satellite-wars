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
  assert.equal(snapshot.profiles.latitudesDeg.length, 3);
  assert.equal(snapshot.profiles.series.convectivePotential.length, 3);
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
