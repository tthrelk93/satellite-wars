#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_STATE_PATH = path.join(repoRoot, 'weather-validation/output/agent-dev-server.json');

const argv = process.argv.slice(2);
let profile = process.env.OPENCLAW_BROWSER_PROFILE || 'openclaw';
let statePath = DEFAULT_STATE_PATH;
let targetUrl = null;
let keepDuplicates = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--profile' && argv[i + 1]) profile = argv[++i];
  else if (arg.startsWith('--profile=')) profile = arg.slice('--profile='.length);
  else if (arg === '--state' && argv[i + 1]) statePath = path.resolve(argv[++i]);
  else if (arg.startsWith('--state=')) statePath = path.resolve(arg.slice('--state='.length));
  else if (arg === '--keep-duplicates') keepDuplicates = true;
  else if (!arg.startsWith('--') && !targetUrl) targetUrl = arg;
}

const readJsonIfExists = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
};

if (!targetUrl) {
  const state = readJsonIfExists(statePath);
  targetUrl = state?.url || null;
}

if (!targetUrl) {
  throw new Error('No target URL supplied and no dev-server state file with a URL was found.');
}

const normalizedTargetUrl = new URL(targetUrl).href;
const normalizedTarget = new URL(normalizedTargetUrl);

const runBrowser = (args, { expectJson = false, allowFailure = false } = {}) => {
  const fullArgs = ['browser', '--browser-profile', profile];
  if (expectJson) fullArgs.push('--json');
  fullArgs.push(...args);
  const result = spawnSync('openclaw', fullArgs, {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr || result.stdout || `openclaw ${fullArgs.join(' ')} failed`);
  }
  if (!expectJson) return result.stdout?.trim() || '';
  const text = result.stdout?.trim();
  if (!text) return null;
  return JSON.parse(text);
};

const flattenTabs = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  for (const key of ['tabs', 'targets', 'items', 'data']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
};

const tabIdOf = (tab) => tab?.id ?? tab?.targetId ?? tab?.tabId ?? tab?.target?.id ?? null;
const tabUrlOf = (tab) => tab?.url ?? tab?.targetUrl ?? tab?.pageUrl ?? tab?.target?.url ?? null;
const tabTitleOf = (tab) => tab?.title ?? tab?.target?.title ?? null;
const tabFocused = (tab) => Boolean(tab?.focused ?? tab?.active ?? tab?.selected ?? tab?.current);

const scoreTab = (tab) => {
  const rawUrl = tabUrlOf(tab);
  if (!rawUrl) return -Infinity;
  let url;
  try {
    url = new URL(rawUrl);
  } catch (_) {
    return -Infinity;
  }
  let score = 0;
  if (url.href === normalizedTarget.href) score += 100;
  if (url.origin === normalizedTarget.origin) score += 50;
  if (url.pathname === normalizedTarget.pathname) score += 10;
  if (tabFocused(tab)) score += 5;
  if ((tabTitleOf(tab) || '').toLowerCase().includes('satellite')) score += 2;
  return score;
};

runBrowser(['start']);
const initialTabs = flattenTabs(runBrowser(['tabs'], { expectJson: true }) || []);
const sortedTabs = [...initialTabs].sort((a, b) => scoreTab(b) - scoreTab(a));
const matchingTabs = sortedTabs.filter((tab) => scoreTab(tab) > 0 && tabIdOf(tab));
const primary = matchingTabs[0] || null;
const duplicateIds = keepDuplicates ? [] : matchingTabs.slice(1).map(tabIdOf).filter(Boolean);

for (const id of duplicateIds) {
  runBrowser(['close', id], { allowFailure: true });
}

let action = 'opened';
let targetId = null;

if (primary) {
  targetId = tabIdOf(primary);
  runBrowser(['focus', targetId]);
  runBrowser(['navigate', normalizedTarget.href]);
  action = 'reused';
} else {
  runBrowser(['open', normalizedTarget.href]);
  const refreshedTabs = flattenTabs(runBrowser(['tabs'], { expectJson: true }) || []);
  const bestAfterOpen = [...refreshedTabs].sort((a, b) => scoreTab(b) - scoreTab(a))[0] || null;
  targetId = tabIdOf(bestAfterOpen);
  if (targetId) {
    runBrowser(['focus', targetId], { allowFailure: true });
  }
}

process.stdout.write(`${JSON.stringify({
  action,
  profile,
  url: normalizedTarget.href,
  targetId,
  closedDuplicateIds: duplicateIds
}, null, 2)}\n`);
