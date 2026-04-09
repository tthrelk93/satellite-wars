#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ensureCyclePlanReady } from './plan-guard.mjs';
import {
  flattenTabs,
  isTransientBrowserError,
  normalizeObservationTarget,
  selectMatchingTabs,
  tabIdOf
} from './browser-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_STATE_PATH = path.join(repoRoot, 'weather-validation/output/agent-dev-server.json');
const DEFAULT_BROWSER_TIMEOUT_MS = 60000;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;

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

ensureCyclePlanReady({
  commandName: 'agent:reuse-localhost-tab',
  allowNoCycle: true
});

const normalizedTarget = normalizeObservationTarget(targetUrl);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runBrowserOnce = (args, { expectJson = false, allowFailure = false } = {}) => {
  const fullArgs = ['browser', '--browser-profile', profile, '--timeout', String(DEFAULT_BROWSER_TIMEOUT_MS)];
  if (expectJson) fullArgs.push('--json');
  fullArgs.push(...args);
  const result = spawnSync('openclaw', fullArgs, {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  const stdout = result.stdout?.trim() || '';
  const stderr = result.stderr?.trim() || '';
  const failureText = stderr || stdout || `openclaw ${fullArgs.join(' ')} failed`;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(failureText);
  }
  if (!expectJson) return stdout;
  if (!stdout) return null;
  return JSON.parse(stdout);
};

const runBrowser = async (args, options = {}) => {
  let lastError = null;
  for (let attempt = 1; attempt <= DEFAULT_RETRY_COUNT; attempt += 1) {
    try {
      return runBrowserOnce(args, options);
    } catch (error) {
      lastError = error;
      if (attempt >= DEFAULT_RETRY_COUNT || !isTransientBrowserError(error?.message || '')) {
        break;
      }
      await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
};

const listTabs = async () => flattenTabs(await runBrowser(['tabs'], { expectJson: true }) || []);

const waitForTabs = async ({ requireMatch = false, timeoutMs = DEFAULT_BROWSER_TIMEOUT_MS } = {}) => {
  const deadline = Date.now() + timeoutMs;
  let lastTabs = [];
  while (Date.now() < deadline) {
    lastTabs = await listTabs().catch(() => []);
    if (!requireMatch || selectMatchingTabs(lastTabs, normalizedTarget).length > 0) {
      return lastTabs;
    }
    await sleep(1000);
  }
  return lastTabs;
};

await runBrowser(['start']);
await waitForTabs({ requireMatch: false, timeoutMs: 15000 });
const initialTabs = await waitForTabs({ requireMatch: false, timeoutMs: 15000 });
const matchingTabs = selectMatchingTabs(initialTabs, normalizedTarget);
const primary = matchingTabs[0] || null;
const duplicateIds = keepDuplicates ? [] : matchingTabs.slice(1).map(tabIdOf).filter(Boolean);

for (const id of duplicateIds) {
  await runBrowser(['close', id], { allowFailure: true });
}

let action = 'opened';
let targetId = null;

if (primary) {
  targetId = tabIdOf(primary);
  await runBrowser(['focus', targetId]);
  await runBrowser(['navigate', normalizedTarget.href]);
  action = 'reused';
} else {
  await runBrowser(['open', normalizedTarget.href]);
}

const refreshedTabs = await waitForTabs({ requireMatch: true, timeoutMs: 20000 });
const bestAfterNavigation = selectMatchingTabs(refreshedTabs, normalizedTarget)[0] || null;
if (bestAfterNavigation) {
  targetId = tabIdOf(bestAfterNavigation);
  if (targetId) {
    await runBrowser(['focus', targetId], { allowFailure: true });
  }
}

process.stdout.write(`${JSON.stringify({
  action,
  profile,
  url: normalizedTarget.href,
  targetId,
  closedDuplicateIds: duplicateIds
}, null, 2)}\n`);
