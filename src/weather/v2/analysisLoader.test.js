import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadAnalysisDataset } from './analysisLoader.js';

const repoRoot = '/Users/agentt/.openclaw/workspace/Developer/satellite-wars';

const makeFileFetch = () => async (url) => {
  const filePath = url.startsWith('http')
    ? new URL(url).pathname
    : path.isAbsolute(url)
      ? url
      : path.join(repoRoot, url.replace(/^\//, ''));
  try {
    const body = await fs.readFile(filePath, 'utf8');
    return {
      ok: true,
      async json() {
        return JSON.parse(body);
      }
    };
  } catch {
    return { ok: false };
  }
};

test('loadAnalysisDataset resolves the checked-in manifest and fixture', async () => {
  const dataset = await loadAnalysisDataset({
    manifestUrl: path.join(repoRoot, 'public/analysis/manifest.json'),
    fetchImpl: makeFileFetch()
  });
  assert.equal(dataset.caseId, 'fixture-global-2026-01-15');
  assert.equal(dataset.grid.latitudesDeg.length, 7);
  assert.equal(dataset.grid.longitudesDeg.length, 12);
  assert.ok(Array.isArray(dataset.fields.surfacePressurePa));
  assert.ok(dataset.fields.uByPressurePa['100000'].length > 0);
});
