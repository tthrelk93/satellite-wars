import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCycloneTrackError, computePrecipSkill, vectorRmse, weightedRmse } from '../lib/metrics.mjs';

test('weightedRmse computes expected scalar RMSE', () => {
  const actual = weightedRmse([1, 3], [2, 1], [1, 1]);
  assert.ok(Math.abs(actual - Math.sqrt(2.5)) < 1e-12);
});

test('vectorRmse computes Euclidean RMSE across vector components', () => {
  const actual = vectorRmse([3, 0], [4, 0], [0, 0], [0, 0], [1, 1]);
  assert.ok(Math.abs(actual - Math.sqrt(12.5)) < 1e-12);
});

test('computePrecipSkill returns bias and categorical scores', () => {
  const result = computePrecipSkill([0.2, 0.0, 2.0, 7.0], [0.1, 0.0, 0.0, 6.0], [0.1, 1, 5]);
  assert.ok(Math.abs(result.biasMmHr - 0.775) < 1e-12);
  assert.deepEqual(result.categorical[0], {
    thresholdMmHr: 0.1,
    hits: 2,
    misses: 0,
    falseAlarms: 1,
    correctNegatives: 1,
    frequencyBias: 1.5,
    pod: 1,
    far: 1 / 3,
    csi: 2 / 3
  });
});

test('computeCycloneTrackError aligns storms by id and lead hour', () => {
  const model = {
    tracks: [
      {
        stormId: 'AL01',
        points: [
          { leadHours: 0, latDeg: 10, lonDeg: -60 },
          { leadHours: 6, latDeg: 11, lonDeg: -58 }
        ]
      }
    ]
  };
  const truth = {
    tracks: [
      {
        stormId: 'AL01',
        points: [
          { leadHours: 0, latDeg: 10, lonDeg: -60 },
          { leadHours: 6, latDeg: 10.5, lonDeg: -58.5 }
        ]
      }
    ]
  };

  const result = computeCycloneTrackError(model, truth);
  assert.equal(result.storms.length, 1);
  assert.equal(result.storms[0].pointErrorsKm.length, 2);
  assert.ok(result.meanErrorKm >= 0);
  assert.ok(result.maxErrorKm >= result.meanErrorKm);
});
