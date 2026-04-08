import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const scriptPath = path.join(repoRoot, 'scripts', 'agent', 'summarize-cycle-streak.mjs');

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeCheckpoint = (dirPath, text) => {
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'checkpoint.md'), text);
};

const runSummary = (rootDir) => JSON.parse(execFileSync(
  process.execPath,
  [scriptPath, '--limit', '8'],
  {
    encoding: 'utf8',
    env: {
      ...process.env,
      SATELLITE_WARS_REPO_ROOT: rootDir,
      SATELLITE_WARS_OUTPUT_DIR: path.join(rootDir, 'weather-validation', 'output'),
      SATELLITE_WARS_STATUS_JSON_PATH: path.join(rootDir, 'weather-validation', 'reports', 'world-class-weather-status.json')
    }
  }
));

test('keeps only the newest incomplete cycle active and surfaces older incomplete cycles separately', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-streak-active-'));
  const outputDir = path.join(rootDir, 'weather-validation', 'output');
  const reportsDir = path.join(rootDir, 'weather-validation', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });
  writeJson(path.join(reportsDir, 'world-class-weather-status.json'), {});

  fs.mkdirSync(path.join(outputDir, 'cycle-2026-04-08T00-33-30Z-current-harness-run'), { recursive: true });
  writeCheckpoint(
    path.join(outputDir, 'cycle-2026-04-08T00-17-23Z-headless-terrain-parity-harness'),
    '# Checkpoint\n\n## Outcome\nVerified permanent harness improvement.\n'
  );
  fs.mkdirSync(path.join(outputDir, 'cycle-2026-04-07T23-05-00Z-orographic-warm-rain-terrain'), { recursive: true });
  writeCheckpoint(
    path.join(outputDir, 'cycle-2026-04-07T22-25-00Z-orographic-mountain-roughness'),
    '# Checkpoint\n\n## Outcome\nNO NEW VERIFIED PROGRESS\n'
  );
  writeJson(
    path.join(outputDir, 'cycle-2026-04-07T22-25-00Z-orographic-mountain-roughness', 'runtime-summary.json'),
    { lineCount: 0, runtimeHealth: { likelySmoothEnough: true, warnings: [] } }
  );

  const summary = runSummary(rootDir);
  assert.equal(summary.activeCycle?.id, 'cycle-2026-04-08T00-33-30Z-current-harness-run');
  assert.deepEqual(
    summary.staleIncompleteCycles.map((cycle) => cycle.id),
    ['cycle-2026-04-07T23-05-00Z-orographic-warm-rain-terrain']
  );
  assert.equal(summary.streaks.consecutiveNoProgress, 0);
  assert.match(
    summary.recommendations.join('\n'),
    /Do not treat older incomplete cycle directories as the active run/
  );
});

test('surfaces abandoned incomplete cycles even when there is no current active cycle', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-streak-stale-only-'));
  const outputDir = path.join(rootDir, 'weather-validation', 'output');
  const reportsDir = path.join(rootDir, 'weather-validation', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });
  writeJson(path.join(reportsDir, 'world-class-weather-status.json'), {});

  writeCheckpoint(
    path.join(outputDir, 'cycle-2026-04-08T00-17-23Z-headless-terrain-parity-harness'),
    '# Checkpoint\n\n## Outcome\nVerified permanent harness improvement.\n'
  );
  fs.mkdirSync(path.join(outputDir, 'cycle-2026-04-07T23-05-00Z-orographic-warm-rain-terrain'), { recursive: true });
  writeCheckpoint(
    path.join(outputDir, 'cycle-2026-04-07T22-25-00Z-orographic-mountain-roughness'),
    '# Checkpoint\n\n## Outcome\nNO NEW VERIFIED PROGRESS\n'
  );

  const summary = runSummary(rootDir);
  assert.equal(summary.activeCycle, null);
  assert.deepEqual(
    summary.staleIncompleteCycles.map((cycle) => cycle.id),
    ['cycle-2026-04-07T23-05-00Z-orographic-warm-rain-terrain']
  );
  assert.equal(summary.recentCycles[0].id, 'cycle-2026-04-08T00-17-23Z-headless-terrain-parity-harness');
});
