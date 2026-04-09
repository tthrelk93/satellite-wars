#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WeatherCore5 } from '../../src/weather/v2/core5.js';
import { buildValidationDiagnostics } from '../../src/weather/validation/diagnostics.js';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { ensureCyclePlanReady } from './plan-guard.mjs';
import { PLANETARY_PRESETS, buildSampleTargetsDays, classifySnapshot, evaluateHorizons } from './planetary-realism-audit.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const argv = process.argv.slice(2);
let preset = null;
let seed = 12345;
let candidatesFile = null;
let outPath = null;
let mdOutPath = null;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--preset' && argv[i + 1]) preset = argv[++i];
  else if (arg.startsWith('--preset=')) preset = arg.slice('--preset='.length);
  else if (arg === '--seed' && argv[i + 1]) seed = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--seed=')) seed = Number.parseInt(arg.slice('--seed='.length), 10);
  else if (arg === '--candidates-file' && argv[i + 1]) candidatesFile = path.resolve(argv[++i]);
  else if (arg.startsWith('--candidates-file=')) candidatesFile = path.resolve(arg.slice('--candidates-file='.length));
  else if (arg === '--out' && argv[i + 1]) outPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
  else if (arg === '--md-out' && argv[i + 1]) mdOutPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--md-out=')) mdOutPath = path.resolve(arg.slice('--md-out='.length));
}

const { cycleState } = ensureCyclePlanReady({
  commandName: 'agent:planetary-candidate-sweep',
  artifactPath: outPath || mdOutPath,
  allowNoCycle: false,
  requireCycleState: true,
  allowedModes: ['quick', 'seasonal', 'annual', 'live']
});

const effectivePreset = preset || cycleState?.defaultAuditPreset || 'quick';
const presetConfig = PLANETARY_PRESETS[effectivePreset];
if (!presetConfig) throw new Error(`Unsupported preset ${JSON.stringify(effectivePreset)} for candidate sweep.`);
if (!candidatesFile) throw new Error('Missing required --candidates-file');
if (!outPath) throw new Error('Missing required --out');
if (!Number.isFinite(seed)) seed = 12345;

const candidates = JSON.parse(fs.readFileSync(candidatesFile, 'utf8'));
if (!Array.isArray(candidates) || !candidates.length) {
  throw new Error('Candidate sweep file must be a non-empty JSON array.');
}

const setPath = (root, dottedPath, value) => {
  const parts = dottedPath.split('.').map((entry) => entry.trim()).filter(Boolean);
  if (!parts.length) return;
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      throw new Error(`Cannot assign ${dottedPath}; missing intermediate object ${parts.slice(0, i + 1).join('.')}`);
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
};

const applyCandidateSet = (core, setSpec = {}) => {
  for (const [key, value] of Object.entries(setSpec)) {
    setPath(core, key, value);
  }
};

const runCandidate = async (candidate) => {
  process.env.NODE_ENV = 'production';
  const core = new WeatherCore5({
    nx: presetConfig.nx,
    ny: presetConfig.ny,
    dt: presetConfig.dt,
    seed
  });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  applyCandidateSet(core, candidate.set || candidate.overrides || {});

  const targets = buildSampleTargetsDays(presetConfig.horizonsDays, presetConfig.sampleEveryDays);
  const samples = [];
  let simDay = 0;
  for (const targetDay of targets) {
    const deltaDays = Math.max(0, targetDay - simDay);
    if (deltaDays > 0) {
      core.advanceModelSeconds(deltaDays * 86400);
      simDay = targetDay;
    }
    samples.push(classifySnapshot(buildValidationDiagnostics(core), targetDay));
  }
  const horizonDays = presetConfig.horizonsDays[presetConfig.horizonsDays.length - 1];
  const evaluation = evaluateHorizons(samples, horizonDays);
  const latest = samples.find((sample) => sample.targetDay === horizonDays) || samples[samples.length - 1];
  return {
    name: candidate.name,
    applied: candidate.set || candidate.overrides || {},
    horizonDays,
    latestMetrics: latest?.metrics || {},
    warnings: evaluation.warnings,
    overallPass: evaluation.overallPass,
    categories: evaluation.categories
  };
};

const baselineResult = await runCandidate({ name: 'baseline', set: {} });
const candidateResults = [];
for (const candidate of candidates) {
  if (!candidate?.name) throw new Error('Each candidate must have a name.');
  candidateResults.push(await runCandidate(candidate));
}

const keyMetrics = [
  'tropicalTradesNorthU10Ms',
  'tropicalTradesSouthU10Ms',
  'midlatitudeWesterliesSouthU10Ms',
  'subtropicalDryNorthRatio',
  'itczLatDeg'
];

const deltaResults = candidateResults.map((candidate) => ({
  ...candidate,
  deltaFromBaseline: Object.fromEntries(
    keyMetrics.map((key) => [
      key,
      Number.isFinite(candidate.latestMetrics[key]) && Number.isFinite(baselineResult.latestMetrics[key])
        ? Number((candidate.latestMetrics[key] - baselineResult.latestMetrics[key]).toFixed(3))
        : null
    ])
  )
}));

const payload = {
  schema: 'satellite-wars.planetary-candidate-sweep.v1',
  generatedAt: new Date().toISOString(),
  preset: effectivePreset,
  horizonDays: baselineResult.horizonDays,
  baseline: baselineResult,
  candidates: deltaResults
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

if (mdOutPath) {
  const lines = [
    '# Planetary Candidate Sweep',
    '',
    `Preset: \`${effectivePreset}\``,
    `Horizon: ${baselineResult.horizonDays} days`,
    '',
    '## Baseline',
    '',
    `- Warnings: ${(baselineResult.warnings || []).join(', ') || 'none'}`,
    '',
    '## Candidates',
    '',
    ...deltaResults.flatMap((candidate) => [
      `### ${candidate.name}`,
      '',
      `- Warnings: ${(candidate.warnings || []).join(', ') || 'none'}`,
      ...keyMetrics.map((key) => `- ${key}: ${candidate.latestMetrics[key]} (delta ${candidate.deltaFromBaseline[key]})`),
      ''
    ])
  ];
  fs.mkdirSync(path.dirname(mdOutPath), { recursive: true });
  fs.writeFileSync(mdOutPath, `${lines.join('\n')}\n`);
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
