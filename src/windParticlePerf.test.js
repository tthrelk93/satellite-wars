import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addParticleEvolvePhase,
  createParticleEvolvePhaseTotals,
  dominantParticleEvolvePhase,
  hasParticleEvolvePhaseData,
  mergeParticleEvolvePhaseTotals
} from './windParticlePerf.js';

test('createParticleEvolvePhaseTotals seeds all phase buckets at zero', () => {
  assert.deepEqual(createParticleEvolvePhaseTotals(), {
    clearBucketsMs: 0,
    respawnMs: 0,
    sample0Ms: 0,
    sample1Ms: 0,
    projectValidateMs: 0,
    bucketStageMs: 0
  });
});

test('addParticleEvolvePhase accumulates only recognized positive timings', () => {
  const totals = createParticleEvolvePhaseTotals();

  addParticleEvolvePhase(totals, 'sample0Ms', 1.25);
  addParticleEvolvePhase(totals, 'sample0Ms', 0.75);
  addParticleEvolvePhase(totals, 'unknownPhase', 99);
  addParticleEvolvePhase(totals, 'respawnMs', -1);

  assert.equal(totals.sample0Ms, 2);
  assert.equal(totals.respawnMs, 0);
  assert.equal(hasParticleEvolvePhaseData(totals), true);
});

test('mergeParticleEvolvePhaseTotals combines per-step timings and exposes the dominant phase', () => {
  const merged = mergeParticleEvolvePhaseTotals(
    {
      clearBucketsMs: 0.1,
      respawnMs: 0.4,
      sample0Ms: 1.5,
      sample1Ms: 1.2,
      projectValidateMs: 0.6,
      bucketStageMs: 0.3
    },
    {
      clearBucketsMs: 0.05,
      respawnMs: 0.1,
      sample0Ms: 0.4,
      sample1Ms: 1.1,
      projectValidateMs: 0.2,
      bucketStageMs: 0.1
    }
  );

  assert.deepEqual(merged, {
    clearBucketsMs: 0.15000000000000002,
    respawnMs: 0.5,
    sample0Ms: 1.9,
    sample1Ms: 2.3,
    projectValidateMs: 0.8,
    bucketStageMs: 0.4
  });
  assert.equal(dominantParticleEvolvePhase(merged), 'sample1Ms');
});
