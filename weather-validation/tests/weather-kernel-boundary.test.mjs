import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WEATHER_KERNEL_CONTRACT_VERSION,
  WEATHER_KERNEL_DIAGNOSTICS_SCHEMA,
  WEATHER_KERNEL_EVENT_SEED_SCHEMA,
  WEATHER_KERNEL_GRID_FIELDS_SCHEMA,
  assertWeatherKernelEventSeed,
  assertWeatherKernelSnapshot,
  createWeatherKernelEventSeed,
  createWeatherKernel,
  normalizeWeatherKernelConfig
} from '../../src/weather/kernel/index.js';
import { runWeatherKernelReplay } from '../../src/weather/kernel/replay.js';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

const walkFiles = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, out);
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }
  return out;
};

test('weather kernel normalizes config and runs headless through the versioned boundary', async () => {
  const config = normalizeWeatherKernelConfig({
    nx: 12,
    ny: 6,
    dt: 3600,
    seed: 12345,
    instrumentationMode: 'disabled'
  });
  assert.deepEqual(
    {
      nx: config.nx,
      ny: config.ny,
      dt: config.dt,
      seed: config.seed,
      instrumentationMode: config.instrumentationMode,
      maxInternalDt: config.maxInternalDt
    },
    {
      nx: 12,
      ny: 6,
      dt: 3600,
      seed: 12345,
      instrumentationMode: 'disabled',
      maxInternalDt: 900
    }
  );

  const kernel = createWeatherKernel(config);
  await kernel.whenReady();
  const stepsRan = kernel.advanceModelSeconds(3600);
  assert.ok(stepsRan > 0);
  assert.equal(kernel.contractVersion, WEATHER_KERNEL_CONTRACT_VERSION);
  assert.equal(kernel.manifest.contractVersion, WEATHER_KERNEL_CONTRACT_VERSION);
  const snapshot = kernel.getSnapshot({ mode: 'compact' });
  assertWeatherKernelSnapshot(snapshot);
  assert.equal(snapshot.manifest.config.nx, 12);
  assert.equal(snapshot.manifest.config.ny, 6);
  assert.equal(snapshot.fields.u.length, 72);
  const gridFields = kernel.getGridFields({ mode: 'compact' });
  assert.equal(gridFields.schema, WEATHER_KERNEL_GRID_FIELDS_SCHEMA);
  assert.equal(gridFields.fields.precipRate.length, 72);
  const diagnostics = kernel.getDiagnostics({ mode: 'compact' });
  assert.equal(diagnostics.schema, WEATHER_KERNEL_DIAGNOSTICS_SCHEMA);
  assert.equal(diagnostics.contractVersion, WEATHER_KERNEL_CONTRACT_VERSION);
});

test('weather kernel event seeds are versioned products for future event layers', () => {
  const eventSeed = createWeatherKernelEventSeed({
    type: 'tropical-cyclone',
    timeUTC: 180 * 86400,
    seed: 9876,
    basin: 'atlantic',
    sourceSnapshotDigest: 'abc123ef',
    environment: {
      sstC: 29.1,
      shearMS: 7.2,
      humidity01: 0.78
    }
  });
  assert.equal(eventSeed.schema, WEATHER_KERNEL_EVENT_SEED_SCHEMA);
  assert.equal(eventSeed.contractVersion, WEATHER_KERNEL_CONTRACT_VERSION);
  assert.equal(eventSeed.type, 'tropical-cyclone');
  assert.equal(eventSeed.basin, 'atlantic');
  assertWeatherKernelEventSeed(eventSeed);
});

test('weather kernel replay is deterministic for same seed and config', async () => {
  const replayConfig = {
    nx: 12,
    ny: 6,
    dt: 3600,
    seed: 12345,
    instrumentationMode: 'disabled'
  };
  const first = await runWeatherKernelReplay({
    config: replayConfig,
    steps: 4,
    stepSeconds: 3600,
    snapshotMode: 'compact'
  });
  const second = await runWeatherKernelReplay({
    config: replayConfig,
    steps: 4,
    stepSeconds: 3600,
    snapshotMode: 'compact'
  });

  assert.equal(first.digest, second.digest);
  assert.equal(first.snapshot.timeUTC, second.snapshot.timeUTC);
  assert.equal(first.manifest.contractVersion, WEATHER_KERNEL_CONTRACT_VERSION);
});

test('runtime app code reaches WeatherCore5 only through the weather-kernel boundary', () => {
  const srcRoot = path.join(repoRoot, 'src');
  const offenders = [];
  for (const file of walkFiles(srcRoot)) {
    const relative = path.relative(repoRoot, file).replaceAll(path.sep, '/');
    if (!relative.endsWith('.js')) continue;
    if (relative.startsWith('src/weather/v2/')) continue;
    if (relative.startsWith('src/weather/kernel/')) continue;
    if (relative.endsWith('.test.js')) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (/from\s+['"][^'"]*weather\/v2\/core5(?:\.js)?['"]/.test(text)) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});
