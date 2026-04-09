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
