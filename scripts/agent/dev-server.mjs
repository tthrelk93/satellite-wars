#!/usr/bin/env node
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const DEFAULT_WEATHER_LOG_PORT = 3031;
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_STATE_PATH = path.join(repoRoot, 'weather-validation/output/agent-dev-server.json');
const DEFAULT_LOG_PATH = path.join(repoRoot, 'weather-validation/output/current-cycle-dev-server.log');

const argv = process.argv.slice(2);
let host = DEFAULT_HOST;
let port = DEFAULT_PORT;
let weatherLogPort = DEFAULT_WEATHER_LOG_PORT;
let timeoutMs = DEFAULT_TIMEOUT_MS;
let statePath = DEFAULT_STATE_PATH;
let logPath = DEFAULT_LOG_PATH;
let restart = false;
let stop = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--restart') restart = true;
  else if (arg === '--stop') stop = true;
  else if (arg === '--host' && argv[i + 1]) host = argv[++i];
  else if (arg.startsWith('--host=')) host = arg.slice('--host='.length);
  else if (arg === '--port' && argv[i + 1]) port = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--port=')) port = Number.parseInt(arg.slice('--port='.length), 10);
  else if (arg === '--weather-log-port' && argv[i + 1]) weatherLogPort = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--weather-log-port=')) weatherLogPort = Number.parseInt(arg.slice('--weather-log-port='.length), 10);
  else if (arg === '--timeout' && argv[i + 1]) timeoutMs = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--timeout=')) timeoutMs = Number.parseInt(arg.slice('--timeout='.length), 10);
  else if (arg === '--state' && argv[i + 1]) statePath = path.resolve(argv[++i]);
  else if (arg.startsWith('--state=')) statePath = path.resolve(arg.slice('--state='.length));
  else if (arg === '--log' && argv[i + 1]) logPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--log=')) logPath = path.resolve(arg.slice('--log='.length));
}

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid --port value: ${port}`);
}
if (!Number.isFinite(weatherLogPort) || weatherLogPort <= 0) {
  throw new Error(`Invalid --weather-log-port value: ${weatherLogPort}`);
}
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error(`Invalid --timeout value: ${timeoutMs}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const deleteFileIfExists = (filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch (_) {}
};

const processAlive = (pid) => {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
};

const requestJson = (url) => new Promise((resolve, reject) => {
  const req = http.get(url, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if ((res.statusCode ?? 500) >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
  req.on('error', reject);
});

const requestOk = (url) => new Promise((resolve, reject) => {
  const req = http.get(url, (res) => {
    res.resume();
    res.on('end', () => {
      if ((res.statusCode ?? 500) >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      resolve(true);
    });
  });
  req.on('error', reject);
});

const waitForJsonEndpoint = async (url, maxWaitMs) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    try {
      return await requestJson(url);
    } catch (_) {
      await sleep(1000);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const waitForOkEndpoint = async (url, maxWaitMs) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    try {
      await requestOk(url);
      return true;
    } catch (_) {
      await sleep(1000);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const appUrl = `http://${host}:${port}/`;
const sessionUrl = `http://${host}:${weatherLogPort}/session`;

const stopExistingProcess = async (state) => {
  if (!state || !processAlive(state.pid)) {
    deleteFileIfExists(statePath);
    return false;
  }
  try {
    process.kill(state.pid, 'SIGTERM');
  } catch (_) {}
  const stopStart = Date.now();
  while (Date.now() - stopStart < 10000) {
    if (!processAlive(state.pid)) {
      deleteFileIfExists(statePath);
      return true;
    }
    await sleep(250);
  }
  try {
    process.kill(state.pid, 'SIGKILL');
  } catch (_) {}
  deleteFileIfExists(statePath);
  return true;
};

const existingState = readJsonIfExists(statePath);
if (stop) {
  const stopped = await stopExistingProcess(existingState);
  process.stdout.write(`${JSON.stringify({ stopped, statePath }, null, 2)}\n`);
  process.exit(0);
}

if (!restart && existingState?.pid && processAlive(existingState.pid)) {
  try {
    await waitForOkEndpoint(existingState.url || appUrl, 5000);
    const session = await waitForJsonEndpoint(existingState.sessionUrl || sessionUrl, 5000);
    const currentState = {
      ...existingState,
      sessionUrl: existingState.sessionUrl || sessionUrl,
      weatherLogPath: session?.filename ? path.resolve(repoRoot, session.filename) : existingState.weatherLogPath ?? null,
      weatherLogRunId: session?.runId ?? existingState.weatherLogRunId ?? null,
      weatherLogStartedAtUtc: session?.startedAtUtc ?? existingState.weatherLogStartedAtUtc ?? null,
      checkedAt: new Date().toISOString()
    };
    writeJson(statePath, currentState);
    process.stdout.write(`${JSON.stringify({ status: 'running', reused: true, state: currentState }, null, 2)}\n`);
    process.exit(0);
  } catch (_) {
    await stopExistingProcess(existingState);
  }
} else if (existingState?.pid) {
  await stopExistingProcess(existingState);
}

fs.mkdirSync(path.dirname(logPath), { recursive: true });
const outFd = fs.openSync(logPath, 'w');
const child = spawn(process.execPath, ['scripts/dev.js'], {
  cwd: repoRoot,
  detached: true,
  stdio: ['ignore', outFd, outFd],
  env: {
    ...process.env,
    BROWSER: 'none',
    HOST: host,
    PORT: String(port),
    WEATHER_LOG_PORT: String(weatherLogPort),
    REACT_APP_WEATHER_LOG_PORT: String(weatherLogPort)
  }
});
child.unref();
fs.closeSync(outFd);

await waitForOkEndpoint(appUrl, timeoutMs);
const session = await waitForJsonEndpoint(sessionUrl, timeoutMs);
const state = {
  schema: 'satellite-wars.agent-dev-server.v1',
  pid: child.pid,
  host,
  port,
  url: appUrl,
  sessionUrl,
  logPath,
  statePath,
  weatherLogPort,
  weatherLogPath: session?.filename ? path.resolve(repoRoot, session.filename) : null,
  weatherLogRunId: session?.runId ?? null,
  weatherLogStartedAtUtc: session?.startedAtUtc ?? null,
  startedAt: new Date().toISOString(),
  branch: 'codex/world-class-weather-loop'
};
writeJson(statePath, state);
process.stdout.write(`${JSON.stringify({ status: 'started', reused: false, state }, null, 2)}\n`);
