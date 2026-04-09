#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { findNewestActiveCycleDir, readCycleState } from './plan-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, '..', '..');
const defaultOutputDir = path.join(defaultRepoRoot, 'weather-validation', 'output');

const readJsonIfExists = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const runGit = (repoRoot, args) => execFileSync(
  'git',
  ['-C', repoRoot, ...args],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }
);

const listDirtyTrackedPaths = (repoRoot) => {
  try {
    return runGit(repoRoot, ['diff', '--name-only', 'HEAD'])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
};

const readDirtyPatch = (repoRoot, dirtyPaths) => {
  if (!dirtyPaths.length) return '';
  try {
    return runGit(repoRoot, ['diff', '--binary', 'HEAD', '--', ...dirtyPaths]);
  } catch (_) {
    return '';
  }
};

const restoreDirtyPaths = (repoRoot, dirtyPaths) => {
  if (!dirtyPaths.length) return;
  runGit(repoRoot, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...dirtyPaths]);
};

const rel = (repoRoot, targetPath) => path.relative(repoRoot, targetPath) || '.';

const buildCheckpoint = ({
  cycleId,
  repoRoot,
  patchPath,
  recoveryPath,
  dirtyPaths,
  artifactEntries
}) => {
  const dirtyList = dirtyPaths.length
    ? dirtyPaths.map((filePath) => `- \`${filePath}\``).join('\n')
    : '- no tracked worktree files needed restoration';
  const artifactList = artifactEntries.length
    ? artifactEntries.map((entry) => `- \`${entry}\``).join('\n')
    : '- no cycle-local artifacts were present beyond recovery files';
  return `# Checkpoint — ${cycleId}

## Outcome
NO NEW VERIFIED PROGRESS

## Recovery
This cycle was recovered automatically at the start of a later worker run because the previous run ended before clean finalization.

The recovery helper preserved the cycle-local artifacts, wrote the missing end-of-cycle records, and restored the tracked worktree back to \`HEAD\` before allowing the next fresh cycle to begin.

## Restored tracked files
${dirtyList}

## Preserved artifacts
${artifactList}

## Recovery records
- \`${rel(repoRoot, recoveryPath)}\`
${patchPath ? `- \`${rel(repoRoot, patchPath)}\`` : '- no interrupted worktree patch was needed'}

## Required follow-up
- inspect the recovered evidence before reusing the same hypothesis
- start a fresh cycle directory instead of continuing inside this recovered one
`;
};

const buildEvidenceSummary = ({
  cycleId,
  repoRoot,
  cycleDir,
  dirtyPaths,
  patchPath,
  recoveryPath
}) => {
  const existing = readJsonIfExists(path.join(cycleDir, 'evidence-summary.json')) || {};
  const artifactEntries = fs.existsSync(cycleDir)
    ? fs.readdirSync(cycleDir)
      .filter((entry) => !entry.startsWith('.'))
      .sort()
    : [];

  return {
    schema: 'satellite-wars.evidence-summary.v1',
    ...existing,
    cycleId,
    summary: existing.summary || 'Recovered an interrupted cycle before the next run and restored the tracked worktree to HEAD.',
    changedFiles: Array.isArray(existing.changedFiles) && existing.changedFiles.length
      ? existing.changedFiles
      : dirtyPaths.map((filePath) => ({
          path: filePath,
          recovered: true
        })),
    artifacts: Array.isArray(existing.artifacts) && existing.artifacts.length
      ? existing.artifacts
      : artifactEntries.map((entry) => rel(repoRoot, path.join(cycleDir, entry))),
    recovery: {
      recoveredAt: new Date().toISOString(),
      cycleDir: rel(repoRoot, cycleDir),
      dirtyTrackedPaths: dirtyPaths,
      recoveryRecord: rel(repoRoot, recoveryPath),
      interruptedPatch: patchPath ? rel(repoRoot, patchPath) : null
    }
  };
};

export function recoverInterruptedCycle({
  repoRoot = defaultRepoRoot,
  outputDir = defaultOutputDir,
  explicitCycleDir = process.env.SATELLITE_WARS_CYCLE_DIR || null
} = {}) {
  const dirtyTrackedPaths = listDirtyTrackedPaths(repoRoot);
  const cycleDir = explicitCycleDir
    ? path.resolve(explicitCycleDir)
    : findNewestActiveCycleDir(outputDir);

  if (!cycleDir) {
    if (dirtyTrackedPaths.length) {
      return {
        schema: 'satellite-wars.recovered-cycle.v1',
        recovered: false,
        reason: 'dirty_worktree_without_active_cycle',
        dirtyTrackedPaths
      };
    }
    return {
      schema: 'satellite-wars.recovered-cycle.v1',
      recovered: false,
      reason: 'no_active_cycle'
    };
  }

  const cycleId = path.basename(cycleDir);
  const cycleState = readCycleState(cycleDir);
  if (cycleState?.resumeAcrossHeartbeats && !dirtyTrackedPaths.length) {
    return {
      schema: 'satellite-wars.recovered-cycle.v1',
      recovered: false,
      reason: 'active_cycle_continuation_allowed',
      cycleId,
      cycleDir: rel(repoRoot, cycleDir),
      mode: cycleState.mode,
      resumeAcrossHeartbeats: true
    };
  }
  const dirtyPatch = readDirtyPatch(repoRoot, dirtyTrackedPaths);
  const patchPath = dirtyPatch
    ? path.join(cycleDir, 'interrupted-worktree.patch')
    : null;
  if (patchPath) fs.writeFileSync(patchPath, dirtyPatch);

  const recoveryPath = path.join(cycleDir, 'interrupted-cycle-recovery.json');
  const artifactEntriesBefore = fs.existsSync(cycleDir)
    ? fs.readdirSync(cycleDir).filter((entry) => !entry.startsWith('.')).sort()
    : [];

  const recoveryRecord = {
    schema: 'satellite-wars.recovered-cycle.v1',
    recovered: true,
    recoveredAt: new Date().toISOString(),
    cycleId,
    cycleDir: rel(repoRoot, cycleDir),
    dirtyTrackedPaths,
    interruptedPatch: patchPath ? rel(repoRoot, patchPath) : null,
    restoredToHead: true,
    artifactEntriesBeforeRecovery: artifactEntriesBefore
  };
  writeJson(recoveryPath, recoveryRecord);

  const evidenceSummaryPath = path.join(cycleDir, 'evidence-summary.json');
  writeJson(evidenceSummaryPath, buildEvidenceSummary({
    cycleId,
    repoRoot,
    cycleDir,
    dirtyPaths: dirtyTrackedPaths,
    patchPath,
    recoveryPath
  }));

  const checkpointPath = path.join(cycleDir, 'checkpoint.md');
  if (!fs.existsSync(checkpointPath)) {
    const artifactEntries = fs.readdirSync(cycleDir)
      .filter((entry) => !entry.startsWith('.'))
      .sort();
    fs.writeFileSync(checkpointPath, buildCheckpoint({
      cycleId,
      repoRoot,
      patchPath,
      recoveryPath,
      dirtyPaths: dirtyTrackedPaths,
      artifactEntries
    }));
  }

  restoreDirtyPaths(repoRoot, dirtyTrackedPaths);

  return {
    ...recoveryRecord,
    checkpointPath: rel(repoRoot, checkpointPath),
    evidenceSummaryPath: rel(repoRoot, evidenceSummaryPath)
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = recoverInterruptedCycle();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
