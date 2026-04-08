#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, '..', '..');
const defaultOutputDir = path.join(defaultRepoRoot, 'weather-validation', 'output');

export const listCycleDirs = (outputDir) => {
  if (!fs.existsSync(outputDir)) return [];
  return fs.readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('cycle-'))
    .map((entry) => path.join(outputDir, entry.name))
    .sort()
    .reverse();
};

export const resolveCycleDirFromArtifactPath = (artifactPath) => {
  if (!artifactPath) return null;
  const resolved = path.resolve(artifactPath);
  const parts = resolved.split(path.sep).filter(Boolean);
  const cycleIndex = parts.findIndex((part) => part.startsWith('cycle-'));
  if (cycleIndex < 0) return null;
  const prefix = resolved.startsWith(path.sep) ? path.sep : '';
  return `${prefix}${path.join(...parts.slice(0, cycleIndex + 1))}`;
};

export const findNewestActiveCycleDir = (outputDir) => (
  listCycleDirs(outputDir).find((cycleDir) => !fs.existsSync(path.join(cycleDir, 'checkpoint.md'))) || null
);

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeCheckpointIfMissing = ({ cycleDir, commandName, repoRoot, artifactEntries, violationPath }) => {
  const checkpointPath = path.join(cycleDir, 'checkpoint.md');
  if (fs.existsSync(checkpointPath)) return checkpointPath;
  const cycleId = path.basename(cycleDir);
  const listedArtifacts = artifactEntries.length
    ? artifactEntries.map((entry) => `- \`${entry}\``).join('\n')
    : '- no cycle-local files had been written yet';
  const relViolationPath = path.relative(repoRoot, violationPath);
  const body = `# Checkpoint — ${cycleId}

## Outcome
NO NEW VERIFIED PROGRESS

## Workflow violation
\`${commandName}\` was invoked before \`plan.md\` existed for this cycle.

This cycle was aborted automatically by the plan guard so the worker cannot continue burning time or tokens on heavy audit/browser work without a declared hypothesis and pass/fail criteria.

## Artifact state at abort
${listedArtifacts}

## Recorded violation
- \`${relViolationPath}\`

## Required follow-up
- start a fresh cycle
- write \`plan.md\` first
- only then run heavy audit, browser, or runtime commands
`;
  fs.writeFileSync(checkpointPath, body);
  return checkpointPath;
};

export function ensureCyclePlanReady({
  commandName,
  repoRoot = defaultRepoRoot,
  outputDir = defaultOutputDir,
  artifactPath = null,
  explicitCycleDir = process.env.SATELLITE_WARS_CYCLE_DIR || null,
  allowNoCycle = true
} = {}) {
  const cycleDir = explicitCycleDir
    ? path.resolve(explicitCycleDir)
    : resolveCycleDirFromArtifactPath(artifactPath) || findNewestActiveCycleDir(outputDir);

  if (!cycleDir) {
    if (allowNoCycle) return { cycleDir: null, planPath: null };
    throw new Error(`[agent plan guard] ${commandName || 'agent command'} requires an active cycle directory with plan.md before it can run.`);
  }

  const planPath = path.join(cycleDir, 'plan.md');
  if (fs.existsSync(planPath)) {
    return { cycleDir, planPath };
  }

  const artifactEntries = fs.existsSync(cycleDir)
    ? fs.readdirSync(cycleDir).filter((entry) => entry !== '.DS_Store' && entry !== 'plan.md')
    : [];

  const violationPath = path.join(cycleDir, 'workflow-violation.json');
  writeJson(violationPath, {
    schema: 'satellite-wars.workflow-violation.v1',
    detectedAt: new Date().toISOString(),
    commandName: commandName || 'unknown',
    cycleDir,
    planPath,
    artifactEntries,
    reason: 'missing_plan_before_heavy_command'
  });
  writeCheckpointIfMissing({
    cycleDir,
    commandName: commandName || 'unknown',
    repoRoot,
    artifactEntries,
    violationPath
  });

  const artifactNote = artifactEntries.length
    ? ` Existing cycle-local artifacts: ${artifactEntries.slice(0, 8).join(', ')}${artifactEntries.length > 8 ? ', ...' : ''}.`
    : ' No cycle-local artifacts existed yet, but the heavy command would have started without a plan.';
  throw new Error(
    `[agent plan guard] ${commandName || 'agent command'} cannot continue because ${path.relative(repoRoot, planPath)} is missing.` +
    ` This is a workflow violation.${artifactNote} Write plan.md first and restart the cycle.`
  );
}

export const _test = {
  listCycleDirs,
  resolveCycleDirFromArtifactPath,
  findNewestActiveCycleDir
};
