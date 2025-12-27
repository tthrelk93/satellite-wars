const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 3031;
const LOG_DIR_NAME = 'logs';
const SCHEMA_ID = 'satellitewars.weatherlog';
const SCHEMA_VERSION = 1;

const readFileSafe = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (_) {
    return null;
  }
};

const readPackedRef = (gitDir, refName) => {
  const packedPath = path.join(gitDir, 'packed-refs');
  const packed = readFileSafe(packedPath);
  if (!packed) return null;
  const lines = packed.split('\n');
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('^')) continue;
    const [hash, ref] = line.split(' ');
    if (ref === refName) return hash;
  }
  return null;
};

const getGitCommit = () => {
  const gitDir = path.join(process.cwd(), '.git');
  const head = readFileSafe(path.join(gitDir, 'HEAD'));
  if (!head) return null;
  let hash = null;
  if (head.startsWith('ref:')) {
    const refName = head.replace('ref:', '').trim();
    hash = readFileSafe(path.join(gitDir, refName)) || readPackedRef(gitDir, refName);
  } else {
    hash = head;
  }
  if (!hash) return null;
  return hash.length > 7 ? hash.slice(0, 7) : hash;
};

const getGitDirty = () => null;

const formatUtcTag = (date) => {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
};

const countLines = (text) => {
  if (!text) return 0;
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (!trimmed) return 0;
  return trimmed.split('\n').filter(Boolean).length;
};

const buildSessionInfo = ({ logsDir }) => {
  const startedAt = new Date();
  const startedAtUtc = startedAt.toISOString();
  const runId = `run-${startedAt.getTime()}-${process.pid}-${Math.floor(Math.random() * 1e6)}`;
  const fileBase = `weather-${formatUtcTag(startedAt)}-${process.pid}.jsonl`;
  const filename = path.join(logsDir, fileBase);
  const relPath = path.relative(process.cwd(), filename).replace(/\\/g, '/');
  let appVersion = '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    appVersion = pkg.version || appVersion;
  } catch (_) {}
  const build = {
    appVersion,
    gitCommit: getGitCommit(),
    gitDirty: getGitDirty(),
    nodeEnv: process.env.NODE_ENV || 'development'
  };
  return {
    runId,
    filename,
    relPath,
    startedAtUtc,
    pid: process.pid,
    build
  };
};

const startWeatherLogServer = ({ port = DEFAULT_PORT } = {}) => {
  const logsDir = path.join(process.cwd(), LOG_DIR_NAME);
  fs.mkdirSync(logsDir, { recursive: true });

  const session = buildSessionInfo({ logsDir });
  fs.writeFileSync(session.filename, '', { flag: 'w' });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/session') {
      const payload = {
        schema: SCHEMA_ID,
        schemaVersion: SCHEMA_VERSION,
        runId: session.runId,
        filename: session.relPath,
        startedAtUtc: session.startedAtUtc,
        pid: session.pid,
        seqStart: 0,
        build: session.build
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/log') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        fs.appendFile(session.filename, body, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, lines: countLines(body) }));
        });
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });

  server.listen(port, () => {
    console.log(`[WeatherLogServer] listening on http://localhost:${port}`);
    console.log(`[WeatherLogServer] file=${session.relPath}`);
  });

  return { server, session };
};

if (require.main === module) {
  const port = Number.parseInt(process.env.WEATHER_LOG_PORT, 10) || DEFAULT_PORT;
  startWeatherLogServer({ port });
}

module.exports = { startWeatherLogServer };
