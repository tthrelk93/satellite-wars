import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const scriptPath = path.join(repoRoot, 'scripts', 'agent', 'start-cycle.mjs');

test('start-cycle writes plan and cycle-state with seasonal continuation enabled', () => {
  const fakeRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'satwars-start-cycle-'));
  fs.mkdirSync(path.join(fakeRepo, 'scripts', 'agent'), { recursive: true });
  fs.mkdirSync(path.join(fakeRepo, 'weather-validation', 'output'), { recursive: true });
  fs.copyFileSync(scriptPath, path.join(fakeRepo, 'scripts', 'agent', 'start-cycle.mjs'));

  const output = execFileSync(
    process.execPath,
    [path.join(fakeRepo, 'scripts', 'agent', 'start-cycle.mjs'),
      '--mode', 'seasonal',
      '--focus-area', 'large-scale circulation and jet placement',
      '--question', 'Does the 90-day run recover southern westerlies?',
      '--hypothesis', 'A stronger broad wind-restoring tendency should improve southern westerlies.',
      '--expected-src', 'src/weather/v2/core5.js,src/weather/v2/windNudge5.js',
      '--pass', '90-day audit improves southern westerlies.',
      '--fail', '90-day audit shows no meaningful circulation gain.'
    ],
    {
      cwd: fakeRepo,
      encoding: 'utf8'
    }
  );

  const result = JSON.parse(output);
  const cycleState = JSON.parse(fs.readFileSync(result.cycleStatePath, 'utf8'));
  const planText = fs.readFileSync(result.planPath, 'utf8');

  assert.equal(cycleState.mode, 'seasonal');
  assert.equal(cycleState.resumeAcrossHeartbeats, true);
  assert.equal(cycleState.horizonDays, 90);
  assert.match(planText, /Resume across heartbeats: yes/);
  assert.match(planText, /large-scale circulation and jet placement/);
});

test('start-cycle supports live browser verification mode', () => {
  const fakeRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'satwars-start-cycle-live-'));
  fs.mkdirSync(path.join(fakeRepo, 'scripts', 'agent'), { recursive: true });
  fs.mkdirSync(path.join(fakeRepo, 'weather-validation', 'output'), { recursive: true });
  fs.copyFileSync(scriptPath, path.join(fakeRepo, 'scripts', 'agent', 'start-cycle.mjs'));

  const output = execFileSync(
    process.execPath,
    [path.join(fakeRepo, 'scripts', 'agent', 'start-cycle.mjs'),
      '--mode', 'live',
      '--focus-area', 'live browser realism and runtime telemetry signoff',
      '--question', 'Does the latest verified baseline still look Earth-like in the browser and produce non-empty runtime telemetry?',
      '--hypothesis', 'A fresh localhost run on the latest verified baseline should keep the current physics gains visible in-app and yield usable runtime telemetry.',
      '--expected-src', 'src/App.js,src/Earth.js',
      '--pass', 'Live localhost run loads and runtime telemetry is non-empty.',
      '--fail', 'Browser/runtime signoff fails or telemetry is empty.'
    ],
    {
      cwd: fakeRepo,
      encoding: 'utf8'
    }
  );

  const result = JSON.parse(output);
  const cycleState = JSON.parse(fs.readFileSync(result.cycleStatePath, 'utf8'));
  const planText = fs.readFileSync(result.planPath, 'utf8');

  assert.equal(cycleState.mode, 'live');
  assert.equal(cycleState.resumeAcrossHeartbeats, false);
  assert.equal(cycleState.defaultAuditPreset, 'live');
  assert.match(planText, /Browser-backed live verification/);
  assert.match(planText, /live browser realism and runtime telemetry signoff/);
});
