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

const writeText = (filePath, text) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
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

test('triggers the physics guard after two consecutive non-physics commits', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-streak-physics-guard-'));
  const outputDir = path.join(rootDir, 'weather-validation', 'output');
  const reportsDir = path.join(rootDir, 'weather-validation', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });
  writeJson(path.join(reportsDir, 'world-class-weather-status.json'), {});

  execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test Agent'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'src', 'Earth.js'), 'export const earth = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'physics commit'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'scripts', 'agent', 'probe.mjs'), 'export const probe = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'diagnostic commit'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'weather-validation', 'tests', 'probe.test.mjs'), 'export const testProbe = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'test commit'], { cwd: rootDir, stdio: 'ignore' });

  const summary = runSummary(rootDir);
  assert.equal(summary.physicsGuard.triggered, true);
  assert.equal(summary.physicsGuard.consecutiveNonPhysicsCommits, 2);
  assert.equal(summary.physicsGuard.lastPhysicsCommit?.subject, 'physics commit');
  assert.match(
    summary.recommendations.join('\n'),
    /The next cycle must target real weather or performance code under src\//
  );
});

test('allows bounded same-focus retries before recommending cron disable', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-streak-retry-budget-'));
  const outputDir = path.join(rootDir, 'weather-validation', 'output');
  const reportsDir = path.join(rootDir, 'weather-validation', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });
  writeJson(path.join(reportsDir, 'world-class-weather-status.json'), {});

  execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test Agent'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'src', 'weather', 'v2', 'core5.js'), 'export const weather = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'physics commit'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'scripts', 'agent', 'audit.mjs'), 'export const audit = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'diagnostic commit'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'weather-validation', 'reports', 'note.md'), '# note\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'report commit'], { cwd: rootDir, stdio: 'ignore' });

  const focusArea = 'precipitation placement/conversion after upslope moisture transport';
  const writeNoProgressCycle = (cycleId) => {
    const dir = path.join(outputDir, cycleId);
    writeCheckpoint(dir, '# Checkpoint\n\n## Outcome\nNO NEW VERIFIED PROGRESS\n');
    writeJson(path.join(dir, 'evidence-summary.json'), {
      focusArea,
      blocker: {
        type: 'physics_hypothesis_falsified',
        details: 'The same focus area still needs another bounded physics try.'
      },
      artifacts: {
        checkpoint: `weather-validation/output/${cycleId}/checkpoint.md`,
        postfixAudit: `weather-validation/output/${cycleId}/postfix-orographic-audit.json`
      },
      changedFiles: [
        {
          path: 'src/weather/v2/microphysics5.js',
          attempted: true,
          reverted: true
        }
      ]
    });
  };

  writeNoProgressCycle('cycle-2026-04-08T01-00-00Z-orographic-precip-placement-a');
  writeNoProgressCycle('cycle-2026-04-08T02-00-00Z-orographic-precip-placement-b');

  const retrySummary = runSummary(rootDir);
  assert.equal(retrySummary.physicsGuard.triggered, true);
  assert.equal(retrySummary.physicsGuard.allowRetry, true);
  assert.equal(retrySummary.physicsGuard.shouldDisableForPhysicsStall, false);
  assert.equal(retrySummary.physicsGuard.sameFocusValuableNoProgress, 2);
  assert.match(
    retrySummary.recommendations.join('\n'),
    /Stay on precipitation placement\/conversion after upslope moisture transport/
  );

  writeNoProgressCycle('cycle-2026-04-08T03-00-00Z-orographic-precip-placement-c');

  const disableSummary = runSummary(rootDir);
  assert.equal(disableSummary.physicsGuard.allowRetry, false);
  assert.equal(disableSummary.physicsGuard.shouldDisableForPhysicsStall, true);
  assert.equal(disableSummary.physicsGuard.sameFocusValuableNoProgress, 3);
  assert.match(
    disableSummary.recommendations.join('\n'),
    /Disable cron only if the next precipitation placement\/conversion after upslope moisture transport cycle still cannot land a verified src\/ fix/
  );
});

test('keeps broad dry-belt blockers in quick mode even when annual evidence is still missing', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-streak-climate-mode-'));
  const reportsDir = path.join(rootDir, 'weather-validation', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  writeJson(path.join(reportsDir, 'world-class-weather-status.json'), {
    blockingGaps: [
      'Northern subtropical dry-belt moisture partitioning is still the dominant planetary blocker.',
      'Annual / 365-day evidence is still required before any long-horizon or world-class claim.'
    ]
  });

  execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test Agent'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'src', 'weather', 'v2', 'core5.js'), 'export const weather = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'climate fix'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'src', 'Earth.js'), 'export const earth = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'runtime fix'], { cwd: rootDir, stdio: 'ignore' });

  writeText(path.join(rootDir, 'scripts', 'agent', 'probe.mjs'), 'export const probe = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'probe helper'], { cwd: rootDir, stdio: 'ignore' });

  const summary = runSummary(rootDir);
  assert.equal(summary.climateGuard.triggered, true);
  assert.equal(summary.climateGuard.recommendedFocusArea, 'ITCZ placement and subtropical dry-belt moisture partitioning');
  assert.equal(summary.climateGuard.recommendedMode, 'quick');
});
