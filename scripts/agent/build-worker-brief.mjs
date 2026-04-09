#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { findNewestActiveCycleDir, readCycleState } from './plan-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const reportsDir = path.join(repoRoot, 'weather-validation', 'reports');
const outputDir = path.join(repoRoot, 'weather-validation', 'output');
const workerBriefBase = path.join(reportsDir, 'worker-brief');

const readJsonIfExists = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
};

const readTextIfExists = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
};

const runNodeJson = (scriptRelativePath, args = []) => {
  const output = execFileSync(
    'node',
    [path.join(repoRoot, scriptRelativePath), ...args],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }
  );
  return JSON.parse(output);
};

const runGit = (args) => execFileSync(
  'git',
  ['-C', repoRoot, ...args],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }
);

const extractBulletsFromSection = (markdown, heading) => {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const startIndex = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (startIndex < 0) return [];
  const bullets = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ')) break;
    if (trimmed.startsWith('- ')) bullets.push(trimmed.slice(2));
    if (/^\d+\.\s+/.test(trimmed)) bullets.push(trimmed.replace(/^\d+\.\s+/, ''));
  }
  return bullets;
};

const worldStatusMd = readTextIfExists(path.join(reportsDir, 'world-class-weather-status.md'));
const worldStatusJson = readJsonIfExists(path.join(reportsDir, 'world-class-weather-status.json'));
const planetaryStatus = readJsonIfExists(path.join(reportsDir, 'planetary-realism-status.json'));
const earthAccuracyMd = readTextIfExists(path.join(reportsDir, 'earth-accuracy-status.md'));
const cycleStreak = runNodeJson('scripts/agent/summarize-cycle-streak.mjs');
const activeCycleDir = findNewestActiveCycleDir(outputDir);
const activeCycleState = activeCycleDir ? readCycleState(activeCycleDir) : null;

const recentCommits = runGit(['log', '-n', '6', '--format=%h %s']).trim().split('\n').filter(Boolean);
const verdictMatch = worldStatusMd?.match(/Verdict:\s*(.+)/i);
const latestCycleMatch = worldStatusMd?.match(/Latest verified cycle:\s*`([^`]+)`/i);
const overallPassMatch = earthAccuracyMd?.match(/Overall pass:\s*\*\*(PASS|FAIL)\*\*/i);
const blockingGaps = extractBulletsFromSection(worldStatusMd, 'What still blocks "world class"');
const defaultNextPriorities = extractBulletsFromSection(worldStatusMd, 'Default next priority');
const planetaryPriorities = Array.isArray(planetaryStatus?.defaultNextPriorities) ? planetaryStatus.defaultNextPriorities : [];
const planetaryWarnings = Array.isArray(planetaryStatus?.horizons)
  ? planetaryStatus.horizons.flatMap((horizon) => horizon?.warnings || [])
  : [];
const liveVerificationDue = blockingGaps.some((gap) => /live browser realism|fresh live run|runtime smoothness still need/i.test(gap));

const brief = {
  schema: 'satellite-wars.worker-brief.v1',
  generatedAt: new Date().toISOString(),
  verdict: verdictMatch?.[1]?.trim() || worldStatusJson?.verdict || 'unknown',
  latestVerifiedCycle: latestCycleMatch?.[1] || worldStatusJson?.latestCycle?.id || null,
  benchmarkOverallPass: overallPassMatch?.[1] === 'PASS',
  lastPhysicsCommit: cycleStreak?.physicsGuard?.lastPhysicsCommit || null,
  currentPhysicsGuard: cycleStreak?.physicsGuard || null,
  currentStallGuard: cycleStreak?.stallGuardTriggered || null,
  activeCycle: activeCycleDir ? {
    id: path.basename(activeCycleDir),
    path: path.relative(repoRoot, activeCycleDir),
    mode: activeCycleState?.mode || null,
    resumeAcrossHeartbeats: Boolean(activeCycleState?.resumeAcrossHeartbeats),
    lastTouchedAt: activeCycleState?.lastTouchedAt || null,
    focusArea: activeCycleState?.focusArea || null
  } : null,
  liveVerificationDue,
  blockingGaps,
  defaultNextPriorities,
  planetaryWarnings,
  planetaryPriorities,
  recentCommits
};

const rankedPriorities = [
  ...(liveVerificationDue ? ['Run a browser-backed live verification cycle on the latest verified baseline before another headless-only tuning cycle.'] : []),
  ...planetaryPriorities,
  ...blockingGaps,
  ...defaultNextPriorities,
  ...(cycleStreak?.recommendations || [])
].filter(Boolean);

const markdown = [
  '# Worker Brief',
  '',
  `Generated: ${brief.generatedAt}`,
  `Verdict: ${brief.verdict}`,
  `Latest verified cycle: ${brief.latestVerifiedCycle || 'unknown'}`,
  `Benchmark suite: ${brief.benchmarkOverallPass ? 'PASS' : 'unknown'}`,
  '',
  '## Active cycle',
  '',
  ...(brief.activeCycle ? [
    `- Active cycle id: ${brief.activeCycle.id}`,
    `- Focus area: ${brief.activeCycle.focusArea || 'unknown'}`,
    `- Mode: ${brief.activeCycle.mode || 'unknown'}`,
    `- Resume across heartbeats: ${brief.activeCycle.resumeAcrossHeartbeats ? 'yes' : 'no'}`,
    `- Last touched: ${brief.activeCycle.lastTouchedAt || 'unknown'}`,
    '- Resume this cycle instead of starting a fresh one unless recovery or a blocker-family change explicitly says otherwise.'
  ] : ['- No active cycle. Start a fresh one with `npm run agent:start-cycle -- ...` before heavy work.']),
  '',
  '## Live verification debt',
  '',
  `- Fresh live browser verification due: ${liveVerificationDue ? 'yes' : 'no'}`,
  ...(liveVerificationDue
    ? ['- The next fresh cycle must be `live` mode unless an active long-horizon cycle is already being resumed.']
    : ['- No forced live-verification debt is currently flagged by the latest verified baseline.']),
  '',
  '## Startup shortcut',
  '',
  '- Refresh this file, then read it first.',
  '- Only reopen the full realism/smoothness/blocker-breaker playbooks if you are entering a new blocker family or this brief points to them explicitly.',
  '- Prefer the highest failing broad-realism category from `planetary-realism-status` before another narrow terrain retune unless the planetary audit still ranks terrain highest.',
  ...(liveVerificationDue ? ['- Because live verification is due, the next fresh cycle should be `live` mode and should start the canonical dev server/browser path before further headless-only tuning.'] : []),
  '',
  '## Current guards',
  '',
  `- Physics guard triggered: ${Boolean(brief.currentPhysicsGuard?.triggered)}`,
  `- Consecutive non-physics commits: ${brief.currentPhysicsGuard?.consecutiveNonPhysicsCommits ?? 'n/a'}`,
  `- Same-focus no-progress count: ${brief.currentPhysicsGuard?.sameFocusNoProgress ?? 'n/a'}`,
  `- Same-focus valuable no-progress count: ${brief.currentPhysicsGuard?.sameFocusValuableNoProgress ?? 'n/a'}`,
  `- Allow retry: ${Boolean(brief.currentPhysicsGuard?.allowRetry)}`,
  `- Disable for physics stall: ${Boolean(brief.currentPhysicsGuard?.shouldDisableForPhysicsStall)}`,
  '',
  '## Ranked priorities',
  '',
  ...rankedPriorities.map((priority, index) => `${index + 1}. ${priority}`),
  '',
  '## Planetary warnings',
  '',
  ...(planetaryWarnings.length ? planetaryWarnings.map((warning) => `- ${warning}`) : ['- none']),
  '',
  '## Recent commits',
  '',
  ...recentCommits.map((line) => `- ${line}`),
  ''
].join('\n');

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(`${workerBriefBase}.json`, `${JSON.stringify(brief, null, 2)}\n`);
fs.writeFileSync(`${workerBriefBase}.md`, `${markdown}\n`);
process.stdout.write(`${JSON.stringify(brief, null, 2)}\n`);
