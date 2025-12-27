const { spawn } = require('child_process');
const { startWeatherLogServer } = require('./weather-log-server');

const DEFAULT_PORT = 3031;
const port = Number.parseInt(process.env.WEATHER_LOG_PORT, 10) || DEFAULT_PORT;
const { server } = startWeatherLogServer({ port });

const env = {
  ...process.env,
  WEATHER_LOG_PORT: String(port),
  REACT_APP_WEATHER_LOG_PORT: String(port),
  REACT_APP_AUTO_LOG: process.env.REACT_APP_AUTO_LOG || '1',
  REACT_APP_WEATHER_SEED: process.env.REACT_APP_WEATHER_SEED || process.env.WEATHER_SEED || '12345'
};

const cmd = process.platform === 'win32' ? 'react-scripts.cmd' : 'react-scripts';
const child = spawn(cmd, ['start'], { stdio: 'inherit', env });

const shutdown = (signal) => {
  if (child && !child.killed) {
    child.kill(signal);
  }
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code) => {
  server.close(() => {
    process.exit(code ?? 0);
  });
});
