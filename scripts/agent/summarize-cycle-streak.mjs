#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(repoRoot, 'weather-validation', 'output');
const statusJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'world-class-weather-status.json');

const argv = process.argv.slice(2);
let limit = 12;
let outPath = null;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--limit' && argv[i + 1]) limit = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--limit=')) limit = Number.parseInt(arg.slice('--limit='.length), 10);
  else if (arg === '--out' && argv[i + 1]) outPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
}

if (!Number.isFinite(limit) || limit <= 0) limit = 12;

const readTextIfExists = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
};

const readJsonIfExists = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
};

const cycleDirs = fs.existsSync(outputDir)
  ? fs.readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('cycle-'))
    .map((entry) => entry.name)
    .sort()
    .reverse()
    .slice(0, limit)
  : [];

const cycleIdToFamily = (cycleId) => {
  const slug = cycleId.replace(/^cycle-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-/, '');
  return slug.split('-')[0] || slug;
};

const parseOutcome = (checkpointText) => {
  if (!checkpointText) return 'in_progress';
  if (checkpointText.includes('NO NEW VERIFIED PROGRESS')) return 'no_new_verified_progress';
  if (/##\s+Outcome/i.test(checkpointText)) return 'completed_nonzero';
  return 'completed_unknown';
};

const parseCycle = (cycleId) => {
  const cyclePath = path.join(outputDir, cycleId);
  const checkpointPath = path.join(cyclePath, 'checkpoint.md');
  const runtimeSummaryPath = path.join(cyclePath, 'runtime-summary.json');
  const evidenceSummaryPath = path.join(cyclePath, 'evidence-summary.json');
  const checkpointText = readTextIfExists(checkpointPath);
  const runtimeSummary = readJsonIfExists(runtimeSummaryPath);
  const evidenceSummary = readJsonIfExists(evidenceSummaryPath);
  return {
    id: cycleId,
    family: cycleIdToFamily(cycleId),
    path: cyclePath,
    outcome: parseOutcome(checkpointText),
    checkpointPath: fs.existsSync(checkpointPath) ? checkpointPath : null,
    runtimeSummaryPath: fs.existsSync(runtimeSummaryPath) ? runtimeSummaryPath : null,
    evidenceSummaryPath: fs.existsSync(evidenceSummaryPath) ? evidenceSummaryPath : null,
    runtimeLineCount: Number.isFinite(runtimeSummary?.lineCount) ? runtimeSummary.lineCount : null,
    likelySmoothEnough: runtimeSummary?.runtimeHealth?.likelySmoothEnough ?? null,
    warnings: Array.isArray(runtimeSummary?.runtimeHealth?.warnings) ? runtimeSummary.runtimeHealth.warnings : [],
    browserTrouble: Boolean(
      checkpointText && /hung|timed out|signal SIGKILL|taking longer|stuck on the DevTools\/browser side/i.test(checkpointText)
    ),
    summary: typeof evidenceSummary?.summary === 'string' ? evidenceSummary.summary : null
  };
};

const cycles = cycleDirs.map(parseCycle);
const activeCycle = cycles.find((cycle) => cycle.outcome === 'in_progress') || null;
const completedCycles = cycles.filter((cycle) => cycle.outcome !== 'in_progress');

const countLeading = (entries, predicate) => {
  let count = 0;
  for (const entry of entries) {
    if (!predicate(entry, count)) break;
    count += 1;
  }
  return count;
};

const consecutiveNoProgress = countLeading(
  completedCycles,
  (cycle) => cycle.outcome === 'no_new_verified_progress'
);

const noProgressFamily = completedCycles[0]?.outcome === 'no_new_verified_progress'
  ? completedCycles[0].family
  : null;

const sameFamilyNoProgress = noProgressFamily
  ? countLeading(
      completedCycles,
      (cycle) => cycle.outcome === 'no_new_verified_progress' && cycle.family === noProgressFamily
    )
  : 0;

const emptyRuntimeSummaryStreak = countLeading(
  completedCycles,
  (cycle) => cycle.outcome === 'no_new_verified_progress' && cycle.runtimeLineCount === 0
);

const browserTroubleStreak = countLeading(
  completedCycles,
  (cycle) => cycle.outcome === 'no_new_verified_progress' && cycle.browserTrouble
);

const statusJson = readJsonIfExists(statusJsonPath);
const baselineCommit = typeof statusJson?.baselineCommit === 'string' ? statusJson.baselineCommit : null;
let baselineCommitInfo = null;

if (baselineCommit) {
  try {
    const raw = execFileSync(
      'git',
      ['-C', repoRoot, 'show', '-s', '--format=%H%n%ct%n%s', baselineCommit],
      { encoding: 'utf8' }
    ).trim().split('\n');
    const [, unixTs, subject] = raw;
    const commitTimeMs = Number.parseInt(unixTs, 10) * 1000;
    baselineCommitInfo = {
      hash: baselineCommit,
      subject,
      committedAt: Number.isFinite(commitTimeMs) ? new Date(commitTimeMs).toISOString() : null,
      ageHours: Number.isFinite(commitTimeMs)
        ? Number(((Date.now() - commitTimeMs) / 3600000).toFixed(2))
        : null
    };
  } catch (_) {}
}

const soft = consecutiveNoProgress >= 3 || sameFamilyNoProgress >= 3 || emptyRuntimeSummaryStreak >= 2;
const hard = consecutiveNoProgress >= 6 || sameFamilyNoProgress >= 5;
const recommendations = [];

if (soft) {
  recommendations.push('Run a blocker-breaker cycle instead of another ordinary browser-first micro-experiment.');
}
if (sameFamilyNoProgress >= 3 && noProgressFamily) {
  recommendations.push(`Read the last 4 ${noProgressFamily} checkpoints before picking the next change.`);
}
if (emptyRuntimeSummaryStreak >= 2) {
  recommendations.push('Treat runtime-log capture as degraded until it produces non-empty summaries again.');
}
if (soft) {
  recommendations.push('Use a permanent offline harness to screen candidates before the single live browser verification run.');
  recommendations.push('Reuse the latest clean baseline for the same blocker family unless the code under test changes browser/init/logging behavior.');
}
if (hard) {
  recommendations.push('Do not continue ordinary experimentation. Land a new permanent diagnostic/harness improvement or keep the cron job disabled.');
}

const summary = {
  schema: 'satellite-wars.cycle-streak.v1',
  generatedAt: new Date().toISOString(),
  limit,
  activeCycle,
  lastVerifiedBaseline: {
    cycleId: statusJson?.latestCycle?.id ?? null,
    baselineCommit: baselineCommitInfo
  },
  streaks: {
    consecutiveNoProgress,
    sameFamilyNoProgress,
    noProgressFamily,
    emptyRuntimeSummaryStreak,
    browserTroubleStreak
  },
  stallGuardTriggered: {
    soft,
    hard
  },
  recommendations,
  recentCycles: cycles
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
