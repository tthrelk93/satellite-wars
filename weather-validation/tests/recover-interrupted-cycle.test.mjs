import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { recoverInterruptedCycle } from '../../scripts/agent/recover-interrupted-cycle.mjs';

const runGit = (repoRoot, args) => execFileSync(
  'git',
  ['-C', repoRoot, ...args],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }
);

const initTempRepo = () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'satwars-recover-cycle-'));
  runGit(repoRoot, ['init']);
  runGit(repoRoot, ['config', 'user.name', 'OpenClaw Test']);
  runGit(repoRoot, ['config', 'user.email', 'test@example.com']);
  fs.mkdirSync(path.join(repoRoot, 'src', 'weather', 'v2'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'), 'export const value = 1;\n');
  runGit(repoRoot, ['add', '.']);
  runGit(repoRoot, ['commit', '-m', 'Initial']);
  return repoRoot;
};

test('recoverInterruptedCycle is a no-op when there is no active cycle', () => {
  const repoRoot = initTempRepo();
  const outputDir = path.join(repoRoot, 'weather-validation', 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const result = recoverInterruptedCycle({ repoRoot, outputDir });

  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'no_active_cycle');
});

test('recoverInterruptedCycle surfaces a dirty worktree when no active cycle exists', () => {
  const repoRoot = initTempRepo();
  const outputDir = path.join(repoRoot, 'weather-validation', 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'), 'export const value = 3;\n');

  const result = recoverInterruptedCycle({ repoRoot, outputDir });

  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'dirty_worktree_without_active_cycle');
  assert.deepEqual(result.dirtyTrackedPaths, ['src/weather/v2/vertical5.js']);
});

test('recoverInterruptedCycle closes the stale cycle, snapshots the patch, and restores tracked files', () => {
  const repoRoot = initTempRepo();
  const outputDir = path.join(repoRoot, 'weather-validation', 'output');
  const cycleDir = path.join(outputDir, 'cycle-2026-04-08T06-58-15Z-terrain-coupling-slope-softening');
  fs.mkdirSync(cycleDir, { recursive: true });
  fs.writeFileSync(path.join(cycleDir, 'plan.md'), '# Plan\n');
  fs.writeFileSync(path.join(cycleDir, 'validation-weather-validate-test.txt'), 'PASS\n');
  fs.writeFileSync(path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'), 'export const value = 2;\n');

  const result = recoverInterruptedCycle({ repoRoot, outputDir });
  const checkpointText = fs.readFileSync(path.join(cycleDir, 'checkpoint.md'), 'utf8');
  const evidenceSummary = JSON.parse(fs.readFileSync(path.join(cycleDir, 'evidence-summary.json'), 'utf8'));
  const restoredContent = fs.readFileSync(path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'), 'utf8');

  assert.equal(result.recovered, true);
  assert.match(checkpointText, /NO NEW VERIFIED PROGRESS/);
  assert.match(checkpointText, /recovered automatically/i);
  assert.equal(restoredContent, 'export const value = 1;\n');
  assert.equal(runGit(repoRoot, ['status', '--short', '--untracked-files=no']).trim(), '');
  assert.deepEqual(evidenceSummary.recovery.dirtyTrackedPaths, ['src/weather/v2/vertical5.js']);
  assert.ok(fs.existsSync(path.join(cycleDir, 'interrupted-worktree.patch')));
  assert.ok(fs.existsSync(path.join(cycleDir, 'interrupted-cycle-recovery.json')));
});
