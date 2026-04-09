#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(repoRoot, 'weather-validation', 'output');

const MODE_CONFIG = {
  quick: {
    label: 'Quick planetary screen',
    horizonDays: 30,
    defaultAuditPreset: 'quick',
    resumeAcrossHeartbeats: false
  },
  seasonal: {
    label: 'Seasonal planetary audit',
    horizonDays: 90,
    defaultAuditPreset: 'seasonal',
    resumeAcrossHeartbeats: true
  },
  annual: {
    label: 'Annual planetary audit',
    horizonDays: 365,
    defaultAuditPreset: 'annual',
    resumeAcrossHeartbeats: true
  },
  terrain: {
    label: 'Terrain-specific audit',
    horizonDays: null,
    defaultAuditPreset: 'terrain',
    resumeAcrossHeartbeats: false
  },
  smoothness: {
    label: 'Runtime smoothness audit',
    horizonDays: null,
    defaultAuditPreset: 'smoothness',
    resumeAcrossHeartbeats: false
  }
};

const argv = process.argv.slice(2);
let slug = null;
let focusArea = null;
let blockerFamily = 'broad planetary realism';
let mode = 'quick';
let question = null;
let hypothesis = null;
let expectedSrc = [];
const currentEvidence = [];
const passCriteria = [];
const failCriteria = [];

const pushListValues = (target, value) => {
  if (!value) return;
  for (const item of value.split(/\s*\|\s*|\s*;\s*/).map((entry) => entry.trim()).filter(Boolean)) {
    target.push(item);
  }
};

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--slug' && argv[i + 1]) slug = argv[++i];
  else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
  else if (arg === '--focus-area' && argv[i + 1]) focusArea = argv[++i];
  else if (arg.startsWith('--focus-area=')) focusArea = arg.slice('--focus-area='.length);
  else if (arg === '--blocker-family' && argv[i + 1]) blockerFamily = argv[++i];
  else if (arg.startsWith('--blocker-family=')) blockerFamily = arg.slice('--blocker-family='.length);
  else if (arg === '--mode' && argv[i + 1]) mode = argv[++i];
  else if (arg.startsWith('--mode=')) mode = arg.slice('--mode='.length);
  else if (arg === '--question' && argv[i + 1]) question = argv[++i];
  else if (arg.startsWith('--question=')) question = arg.slice('--question='.length);
  else if (arg === '--hypothesis' && argv[i + 1]) hypothesis = argv[++i];
  else if (arg.startsWith('--hypothesis=')) hypothesis = arg.slice('--hypothesis='.length);
  else if (arg === '--expected-src' && argv[i + 1]) expectedSrc = argv[++i].split(',').map((entry) => entry.trim()).filter(Boolean);
  else if (arg.startsWith('--expected-src=')) expectedSrc = arg.slice('--expected-src='.length).split(',').map((entry) => entry.trim()).filter(Boolean);
  else if (arg === '--evidence' && argv[i + 1]) pushListValues(currentEvidence, argv[++i]);
  else if (arg.startsWith('--evidence=')) pushListValues(currentEvidence, arg.slice('--evidence='.length));
  else if (arg === '--pass' && argv[i + 1]) pushListValues(passCriteria, argv[++i]);
  else if (arg.startsWith('--pass=')) pushListValues(passCriteria, arg.slice('--pass='.length));
  else if (arg === '--fail' && argv[i + 1]) pushListValues(failCriteria, argv[++i]);
  else if (arg.startsWith('--fail=')) pushListValues(failCriteria, arg.slice('--fail='.length));
}

if (!focusArea) throw new Error('Missing required --focus-area');
if (!question) throw new Error('Missing required --question');
if (!hypothesis) throw new Error('Missing required --hypothesis');
if (!passCriteria.length) throw new Error('At least one --pass criterion is required');
if (!failCriteria.length) throw new Error('At least one --fail criterion is required');

mode = String(mode || 'quick').trim().toLowerCase();
if (!MODE_CONFIG[mode]) {
  throw new Error(`Unsupported --mode ${JSON.stringify(mode)}. Expected one of: ${Object.keys(MODE_CONFIG).join(', ')}`);
}

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 64) || 'worker-cycle';

const now = new Date();
const utcStamp = now.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
const finalSlug = slugify(slug || focusArea);
const cycleId = `cycle-${utcStamp}-${finalSlug}`;
const cycleDir = path.join(outputDir, cycleId);
const planPath = path.join(cycleDir, 'plan.md');
const cycleStatePath = path.join(cycleDir, 'cycle-state.json');
const modeConfig = MODE_CONFIG[mode];

fs.mkdirSync(cycleDir, { recursive: true });

const cycleState = {
  schema: 'satellite-wars.cycle-state.v1',
  cycleId,
  createdAt: now.toISOString(),
  status: 'planned',
  blockerFamily,
  focusArea,
  mode,
  modeLabel: modeConfig.label,
  defaultAuditPreset: modeConfig.defaultAuditPreset,
  horizonDays: modeConfig.horizonDays,
  resumeAcrossHeartbeats: modeConfig.resumeAcrossHeartbeats,
  measurementQuestion: question,
  hypothesis,
  expectedSrcPaths: expectedSrc,
  passCriteria,
  failCriteria
};

const planLines = [
  `# Plan — ${cycleId}`,
  '',
  '## Focus area',
  `- Primary blocker family: ${blockerFamily}`,
  `- Named target area: \`${focusArea}\``,
  '',
  '## Cycle mode',
  `- Mode: \`${mode}\``,
  `- Label: ${modeConfig.label}`,
  `- Default audit preset: \`${modeConfig.defaultAuditPreset}\``,
  `- Horizon: ${modeConfig.horizonDays ? `${modeConfig.horizonDays} days` : 'n/a'}`,
  `- Resume across heartbeats: ${modeConfig.resumeAcrossHeartbeats ? 'yes' : 'no'}`,
  '',
  '## Current evidence',
  ...(currentEvidence.length ? currentEvidence.map((entry) => `- ${entry}`) : ['- Fill in current-cycle evidence before heavy work begins.']),
  '',
  '## Hypothesis',
  hypothesis,
  '',
  '## Narrowest justified targets',
  ...(expectedSrc.length ? expectedSrc.map((entry) => `- \`${entry}\``) : ['- Add expected `src/` targets before claiming a verified physics improvement.']),
  '',
  '## Measurement question',
  question,
  '',
  '## Pass criteria',
  ...passCriteria.map((entry, index) => `${index + 1}. ${entry}`),
  '',
  '## Fail criteria',
  ...failCriteria.map((entry, index) => `${index + 1}. ${entry}`),
  '',
  '## Boundaries',
  '- Heavy audits, browser work, and runtime-log commands are only allowed after this cycle contract exists.',
  '- Ad hoc inline `node`, `python`, or shell sweeps that instantiate the weather core or browser are forbidden; use guarded helper scripts instead.',
  '- If this cycle spans multiple heartbeats, keep the same cycle open until `checkpoint.md` and `evidence-summary.json` are written.'
];

fs.writeFileSync(planPath, `${planLines.join('\n')}\n`);
fs.writeFileSync(cycleStatePath, `${JSON.stringify(cycleState, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  schema: 'satellite-wars.cycle-start.v1',
  cycleId,
  cycleDir,
  planPath,
  cycleStatePath,
  mode,
  horizonDays: modeConfig.horizonDays,
  resumeAcrossHeartbeats: modeConfig.resumeAcrossHeartbeats
}, null, 2)}\n`);
