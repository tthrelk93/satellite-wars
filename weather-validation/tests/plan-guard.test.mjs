import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureCyclePlanReady, _test } from '../../scripts/agent/plan-guard.mjs';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'satwars-plan-guard-'));

test('resolveCycleDirFromArtifactPath finds the enclosing cycle directory', () => {
  const resolved = _test.resolveCycleDirFromArtifactPath('/tmp/foo/weather-validation/output/cycle-2026-04-08T06-17-39Z-andes-sampling-design/prefix-orographic-audit.json');
  assert.equal(resolved, '/tmp/foo/weather-validation/output/cycle-2026-04-08T06-17-39Z-andes-sampling-design');
});

test('ensureCyclePlanReady passes when the active cycle already has plan.md', () => {
  const repoRoot = makeTempDir();
  const outputDir = path.join(repoRoot, 'weather-validation', 'output');
  const cycleDir = path.join(outputDir, 'cycle-2026-04-08T06-17-39Z-andes-sampling-design');
  fs.mkdirSync(cycleDir, { recursive: true });
  fs.writeFileSync(path.join(cycleDir, 'plan.md'), '# Plan\n');

  const result = ensureCyclePlanReady({
    commandName: 'agent:orographic-audit',
    repoRoot,
    outputDir
  });

  assert.equal(result.cycleDir, cycleDir);
  assert.equal(result.planPath, path.join(cycleDir, 'plan.md'));
});

test('ensureCyclePlanReady aborts and auto-closes the cycle when artifacts exist without plan.md', () => {
  const repoRoot = makeTempDir();
  const outputDir = path.join(repoRoot, 'weather-validation', 'output');
  const cycleDir = path.join(outputDir, 'cycle-2026-04-08T06-17-39Z-andes-sampling-design');
  fs.mkdirSync(cycleDir, { recursive: true });
  fs.writeFileSync(path.join(cycleDir, 'prefix-orographic-audit.json'), '{}\n');

  assert.throws(() => ensureCyclePlanReady({
    commandName: 'agent:orographic-audit',
    repoRoot,
    outputDir
  }), /workflow violation/i);

  const checkpointPath = path.join(cycleDir, 'checkpoint.md');
  const violationPath = path.join(cycleDir, 'workflow-violation.json');
  assert.ok(fs.existsSync(checkpointPath));
  assert.ok(fs.existsSync(violationPath));
  assert.match(fs.readFileSync(checkpointPath, 'utf8'), /NO NEW VERIFIED PROGRESS/);
});
