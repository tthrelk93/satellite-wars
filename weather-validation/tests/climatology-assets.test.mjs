import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const climoDir = path.join(repoRoot, 'public', 'climo');
const manifestPath = path.join(climoDir, 'manifest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const referencedFiles = [
  ...(manifest.sst?.files ?? []),
  ...(manifest.seaIce?.files ?? []),
  ...(manifest.optionalNudging?.slp?.files ?? []),
  ...(manifest.optionalNudging?.wind?.files ?? []),
  ...(manifest.optionalNudging?.wind500?.files ?? []),
  ...(manifest.optionalNudging?.wind250?.files ?? []),
  ...(manifest.optionalNudging?.t2m?.files ?? []),
  ...(manifest.optionalNudging?.q2m?.files ?? []),
  ...(manifest.optionalNudging?.q700?.files ?? []),
  ...(manifest.optionalNudging?.q250?.files ?? []),
  ...(manifest.optionalNudging?.t700?.files ?? []),
  ...(manifest.optionalNudging?.t250?.files ?? []),
  manifest.topography?.file,
  manifest.albedo?.file,
  manifest.soilCap?.file
].filter(Boolean);

test('climatology manifest does not reference missing asset files', () => {
  for (const relativePath of referencedFiles) {
    const absolutePath = path.join(climoDir, relativePath);
    assert.ok(
      fs.existsSync(absolutePath),
      `Expected climatology asset to exist: public/climo/${relativePath}`
    );
    const stats = fs.statSync(absolutePath);
    assert.ok(stats.size > 0, `Expected climatology asset to be non-empty: public/climo/${relativePath}`);
  }
});
