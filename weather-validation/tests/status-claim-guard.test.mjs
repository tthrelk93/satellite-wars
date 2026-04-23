import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  validateWorldClassStatusClaims
} from '../../scripts/agent/status-claim-guard.mjs';

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeText = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
};

const createVerifiedStatusFixture = ({ status = 'verified-improvement', artifactName = 'runtime-summary.json' } = {}) => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'satwars-claim-guard-'));
  const reportsDir = path.join(repoRoot, 'weather-validation', 'reports');
  const cycleId = 'cycle-2026-04-23T00-00-00Z-claim-guard';
  const cycleDir = path.join(repoRoot, 'weather-validation', 'output', cycleId);
  const artifactPath = path.join(cycleDir, artifactName);
  writeJson(artifactPath, { schema: 'example.runtime.v1' });
  writeJson(path.join(cycleDir, 'evidence-summary.json'), {
    schema: 'satellite-wars.evidence-summary.v1',
    cycleId,
    status,
    artifacts: {
      runtimeSummary: `weather-validation/output/${cycleId}/${artifactName}`
    }
  });
  writeText(path.join(cycleDir, 'checkpoint.md'), '# Checkpoint\n\n## Outcome\nVerified improvement.\n');
  writeText(path.join(reportsDir, 'world-class-weather-status.md'), [
    '# World-Class Weather Status',
    '',
    '## Current baseline',
    '',
    `- Latest verified cycle: \`${cycleId}\``,
    '',
    '## Fresh evidence from the latest cycle',
    '',
    `- \`weather-validation/output/${cycleId}/${artifactName}\``,
    ''
  ].join('\n'));
  writeJson(path.join(reportsDir, 'world-class-weather-status.json'), {
    schema: 'satellite-wars.world-class-status.v1',
    latestCycle: {
      id: cycleId,
      runtimeSummaryPath: `weather-validation/output/${cycleId}/${artifactName}`
    }
  });
  return { repoRoot, reportsDir, cycleId, artifactPath };
};

test('status claim guard accepts verified status backed by matching JSON artifacts', () => {
  const fixture = createVerifiedStatusFixture();
  const result = validateWorldClassStatusClaims({
    repoRoot: fixture.repoRoot,
    reportsDir: fixture.reportsDir
  });
  assert.equal(result.ok, true);
  assert.equal(result.latestCycleId, fixture.cycleId);
  assert.deepEqual(result.failures, []);
  assert.equal(result.checkedJsonArtifacts.length, 1);
});

test('status claim guard rejects verified status with missing JSON evidence', () => {
  const fixture = createVerifiedStatusFixture();
  fs.unlinkSync(fixture.artifactPath);
  const result = validateWorldClassStatusClaims({
    repoRoot: fixture.repoRoot,
    reportsDir: fixture.reportsDir
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Referenced JSON artifact is missing')));
});

test('status claim guard rejects no-progress evidence under verified wording', () => {
  const fixture = createVerifiedStatusFixture({ status: 'no-verified-progress' });
  const result = validateWorldClassStatusClaims({
    repoRoot: fixture.repoRoot,
    reportsDir: fixture.reportsDir
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('does not record a verified improvement')));
});

test('status claim guard rejects markdown and JSON cycle mismatch', () => {
  const fixture = createVerifiedStatusFixture();
  writeJson(path.join(fixture.reportsDir, 'world-class-weather-status.json'), {
    schema: 'satellite-wars.world-class-status.v1',
    latestCycle: {
      id: 'cycle-2026-04-23T00-00-01Z-wrong-cycle'
    }
  });
  const result = validateWorldClassStatusClaims({
    repoRoot: fixture.repoRoot,
    reportsDir: fixture.reportsDir
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('does not match JSON latest cycle')));
});
