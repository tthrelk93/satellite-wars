#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { ensureCyclePlanReady } from './plan-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_STATE_PATH = path.join(repoRoot, 'weather-validation/output/agent-dev-server.json');

const argv = process.argv.slice(2);
let inputPath = null;
let outPath = null;
let statePath = DEFAULT_STATE_PATH;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--out' && argv[i + 1]) outPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
  else if (arg === '--state' && argv[i + 1]) statePath = path.resolve(argv[++i]);
  else if (arg.startsWith('--state=')) statePath = path.resolve(arg.slice('--state='.length));
  else if (!arg.startsWith('--') && !inputPath) inputPath = path.resolve(arg);
}

const readJsonIfExists = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
};

if (!inputPath) {
  const state = readJsonIfExists(statePath);
  inputPath = state?.weatherLogPath || null;
}

if (!inputPath) {
  throw new Error('No log path supplied and no dev-server state file with a weather log path was found.');
}

ensureCyclePlanReady({
  commandName: 'agent:summarize-runtime-log',
  artifactPath: outPath,
  allowNoCycle: false,
  requireCycleState: true
});

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
};

const simPerfUpdateMs = [];
const simPerfLagSeconds = [];
const simPerfStepsSkipped = [];
let latestWindTargets = null;
let latestWindModel = null;
let latestWindVizDiagnostics = null;
let latestWindComparison = null;
let validationSnapshotCount = 0;
let lineCount = 0;

const reader = readline.createInterface({
  input: fs.createReadStream(inputPath, 'utf8'),
  crlfDelay: Infinity
});

for await (const line of reader) {
  if (!line.trim()) continue;
  lineCount += 1;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch (_) {
    continue;
  }
  const event = entry?.event;
  const payload = entry?.payload ?? null;
  if (event === 'simPerf' && payload) {
    if (Number.isFinite(payload.updateMs)) simPerfUpdateMs.push(payload.updateMs);
    if (Number.isFinite(payload.simLagSeconds)) simPerfLagSeconds.push(payload.simLagSeconds);
    if (Number.isFinite(payload.simStepsSkipped)) simPerfStepsSkipped.push(payload.simStepsSkipped);
  } else if (event === 'windTargetsStatus' && payload) {
    latestWindTargets = {
      simTimeSeconds: entry?.sim?.simTimeSeconds ?? null,
      ...payload
    };
  } else if (event === 'windModelDiagnostics' && payload) {
    latestWindModel = {
      simTimeSeconds: entry?.sim?.simTimeSeconds ?? null,
      ...payload
    };
  } else if (event === 'windVizDiagnostics' && payload) {
    latestWindVizDiagnostics = {
      simTimeSeconds: entry?.sim?.simTimeSeconds ?? null,
      ...payload
    };
  } else if (event === 'windReferenceComparison' && payload) {
    latestWindComparison = {
      simTimeSeconds: entry?.sim?.simTimeSeconds ?? null,
      ...payload
    };
  } else if (event === 'validationSnapshot') {
    validationSnapshotCount += 1;
  }
}

const stepsSkippedTotal = simPerfStepsSkipped.reduce((sum, value) => sum + value, 0);
const warnings = [];

const updateMsP95 = quantile(simPerfUpdateMs, 0.95);
const updateMsMax = simPerfUpdateMs.length ? Math.max(...simPerfUpdateMs) : null;
const lagP95 = quantile(simPerfLagSeconds, 0.95);
const lagMax = simPerfLagSeconds.length ? Math.max(...simPerfLagSeconds) : null;

if (updateMsP95 != null && updateMsP95 > 12) warnings.push('earth_update_p95_high');
if (updateMsMax != null && updateMsMax > 25) warnings.push('earth_update_max_high');
if (lagP95 != null && lagP95 > 240) warnings.push('sim_lag_p95_high');
if (lagMax != null && lagMax > 600) warnings.push('sim_lag_max_high');
if (stepsSkippedTotal > 0) warnings.push('sim_steps_skipped');
if (latestWindTargets?.pass?.overall === false) warnings.push('wind_targets_failing');

const summary = {
  schema: 'satellite-wars.runtime-summary.v1',
  generatedAt: new Date().toISOString(),
  inputPath,
  lineCount,
  validationSnapshotCount,
  runtimeHealth: {
    likelySmoothEnough: warnings.length === 0,
    warnings
  },
  simPerf: {
    samples: simPerfUpdateMs.length,
    updateMs: {
      p50: quantile(simPerfUpdateMs, 0.5),
      p95: updateMsP95,
      max: updateMsMax
    },
    simLagSeconds: {
      p50: quantile(simPerfLagSeconds, 0.5),
      p95: lagP95,
      max: lagMax
    },
    stepsSkippedTotal
  },
  latestWindTargets,
  latestWindModel,
  latestWindVizDiagnostics,
  latestWindComparison
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
