import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherCore5 } from '../../src/weather/v2/core5.js';
import { applyHeadlessTerrainFixture, summarizeTerrain } from '../../scripts/agent/headless-terrain-fixture.mjs';

test('headless terrain fixture restores nonzero terrain to node WeatherCore5 audits', async () => {
  const core = new WeatherCore5({ seed: 12345 });
  await core._initPromise;

  const before = summarizeTerrain(core);
  assert.equal(before.terrainSampleCount, 0);
  assert.equal(before.elevMax, 0);

  const result = applyHeadlessTerrainFixture(core);
  const after = summarizeTerrain(core);

  assert.equal(result.applied, true);
  assert.equal(result.source, 'fixture');
  assert.ok(after.terrainSampleCount > 1000, `expected many terrain samples, got ${after.terrainSampleCount}`);
  assert.ok(after.elevMax > 3000, `expected realistic mountain height, got ${after.elevMax}`);
  assert.ok(after.landFrac > 0.2 && after.landFrac < 0.6, `unexpected land fraction ${after.landFrac}`);
});
