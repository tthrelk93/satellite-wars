import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

test('Phase 8 live weather worker startup does not fall back to main-thread truth stepping', () => {
  const earthPath = path.join(repoRoot, 'src', 'Earth.js');
  const text = fs.readFileSync(earthPath, 'utf8');

  assert.match(
    text,
    /this\._weatherWorkerPendingEnable = false;\s*this\._weatherWorkerLastRequestRealMs = 0;\s*this\.weatherField\?\.setUseExternalCore\?\.\(true\);/s
  );
  assert.match(
    text,
    /if \(delta > 0\.5\) \{\s*if \(payload\) \{\s*this\._applyWeatherWorkerState\(payload\);\s*\}\s*this\._weatherWorkerAccumSeconds \+= delta;/s
  );
  assert.match(
    text,
    /this\._weatherWorkerPendingEnable = true;\s*this\.weatherField\?\.setUseExternalCore\?\.\(true\);\s*return;/s
  );
});

test('Phase 8 live worker catch-up uses bounded chunks, in-flight accounting, and stall recovery', () => {
  const earthPath = path.join(repoRoot, 'src', 'Earth.js');
  const text = fs.readFileSync(earthPath, 'utf8');

  assert.match(text, /const WEATHER_WORKER_MAX_STEP_SECONDS = 60 \* 60;/);
  assert.match(text, /const WEATHER_WORKER_STALL_MS = 30000;/);
  assert.match(text, /this\._weatherWorkerInFlightSeconds = 0;/);
  assert.match(text, /this\._weatherWorkerInFlightStartMs = 0;/);
  assert.match(text, /_recoverStalledWeatherWorker\(nowMs = performance\.now\(\)\)/);
  assert.match(text, /this\._weatherWorkerInFlightSeconds = stepSeconds;/);
  assert.match(text, /workerInFlightSeconds/);
  assert.match(text, /effectiveVisibleLeadSeconds/);
  assert.match(text, /instrumentationMode: 'disabled'/);
  assert.match(text, /weatherWorkerSync: this\.getWeatherWorkerSyncStatus\(simTimeSeconds\)/);
});

test('Phase 8 live weather worker disables audit-only instrumentation', () => {
  const workerPath = path.join(repoRoot, 'src', 'workers', 'weatherCore.worker.js');
  const corePath = path.join(repoRoot, 'src', 'weather', 'v2', 'core5.js');
  const workerText = fs.readFileSync(workerPath, 'utf8');
  const coreText = fs.readFileSync(corePath, 'utf8');

  assert.match(workerText, /instrumentationMode: payload\.instrumentationMode === 'disabled' \? 'disabled' : 'full'/);
  assert.match(coreText, /this\.instrumentationMode === 'disabled' \|\| this\.state\?\.instrumentationEnabled === false/);
});

test('Phase 8 live app clock uses epsilon-safe fixed-step budgeting', () => {
  const appPath = path.join(repoRoot, 'src', 'App.js');
  const text = fs.readFileSync(appPath, 'utf8');

  assert.match(text, /computeFixedStepBudget/);
  assert.match(text, /const FIXED_SIM_STEP_EPSILON_SECONDS = 1e-4;/);
  assert.match(text, /const stepBudget = computeFixedStepBudget\(/);
  assert.match(text, /simAccumSeconds = stepBudget\.remainingSeconds;/);
});

test('Phase 8 live auto logging keeps broad climate diagnostics out of the render loop by default', () => {
  const loggerPath = path.join(repoRoot, 'src', 'weather', 'WeatherLogger.js');
  const text = fs.readFileSync(loggerPath, 'utf8');

  assert.match(text, /includeBroadClimateStats = false/);
  assert.match(text, /this\.includeBroadClimateStats = Boolean\(includeBroadClimateStats\);/);
  assert.match(
    text,
    /if \(this\.includeBroadClimateStats\) \{\s*try \{\s*out\.broadClimate = buildBroadClimateStats\(buildValidationDiagnostics\(core\)\);/s
  );
});

test('Phase 8 live cloud paint uses cached noise and exports paint timing', () => {
  const weatherFieldPath = path.join(repoRoot, 'src', 'WeatherField.js');
  const text = fs.readFileSync(weatherFieldPath, 'utf8');
  const paintStart = text.indexOf('_paintClouds(simTimeSeconds)');
  const paintEnd = text.indexOf('_paintDebug()', paintStart);
  const paintBody = text.slice(paintStart, paintEnd);

  assert.match(text, /this\._cloudNoiseLow = this\._buildCloudNoise/);
  assert.match(text, /this\._cloudNoiseHigh = this\._buildCloudNoise/);
  assert.match(text, /_blendScalarLongitudeSeam/);
  assert.match(text, /_blendTextureLongitudeSeam/);
  assert.match(text, /_softenLayerCanvas/);
  assert.match(text, /CLOUD_TEXTURE_SOFTEN_BLUR_PX/);
  assert.match(text, /const n = this\._sampleCloudNoise\(noiseField, advLon, advLat, grid\);/);
  assert.match(text, /getPerfStats\(\) \{/);
  assert.match(text, /paintCloudsMs/);
  assert.doesNotMatch(paintBody, /Math\.sin/);
});

test('Phase 8 live weather textures use native model resolution and Earth phase timing', () => {
  const earthPath = path.join(repoRoot, 'src', 'Earth.js');
  const text = fs.readFileSync(earthPath, 'utf8');

  assert.match(text, /const LIVE_WEATHER_GRID_NX = 96;/);
  assert.match(text, /const LIVE_WEATHER_GRID_NY = 48;/);
  assert.match(text, /const LIVE_WEATHER_RENDER_SCALE = 3;/);
  assert.match(
    text,
    /this\.weatherField = new WeatherField\(\{\s*nx: LIVE_WEATHER_GRID_NX,\s*ny: LIVE_WEATHER_GRID_NY,\s*renderScale: LIVE_WEATHER_RENDER_SCALE,\s*tickSeconds: 0\.35,/s
  );
  assert.match(
    text,
    /this\.analysisWeatherField = new WeatherField\(\{\s*nx: LIVE_WEATHER_GRID_NX,\s*ny: LIVE_WEATHER_GRID_NY,\s*renderScale: LIVE_WEATHER_RENDER_SCALE,\s*tickSeconds: 0\.35,\s*seed: this\.weatherSeed,\s*autoLogEnabled: false/s
  );
  assert.match(
    text,
    /this\.forecastWeatherField = new WeatherField\(\{\s*nx: LIVE_WEATHER_GRID_NX,\s*ny: LIVE_WEATHER_GRID_NY,\s*renderScale: LIVE_WEATHER_RENDER_SCALE,\s*tickSeconds: 9999,\s*seed: this\.weatherSeed,\s*autoLogEnabled: false/s
  );
  assert.match(text, /phaseBreakdown = \{/);
  assert.match(text, /weatherFieldsMs/);
  assert.match(text, /windStreamlinesMs/);
});

test('Phase 8 live default view shows real weather without fog or debug overlays', () => {
  const appPath = path.join(repoRoot, 'src', 'App.js');
  const text = fs.readFileSync(appPath, 'utf8');

  assert.match(text, /earth\.setWeatherVisible\(showWeatherLayerRef\.current\);/);
  assert.match(text, /const \[showFogLayer, setShowFogLayer\] = useState\(false\);/);
  assert.match(text, /const \[showWindStreamlines, setShowWindStreamlines\] = useState\(false\);/);
  assert.match(text, /const \[showDebugPanel, setShowDebugPanel\] = useState\(false\);/);
  assert.match(text, /setShowDebugPanel\(false\);/);
});

test('Phase 8 live wind overlay is bounded for browser smoothness', () => {
  const windPath = path.join(repoRoot, 'src', 'WindStreamlineRenderer.js');
  const text = fs.readFileSync(windPath, 'utf8');

  assert.match(text, /const DEFAULT_WIDTH = 160;/);
  assert.match(text, /const DEFAULT_HEIGHT = 80;/);
  assert.match(text, /const PARTICLE_MULTIPLIER = 10;/);
  assert.match(text, /const DEFAULT_STEP_SECONDS = 900;/);
  assert.match(text, /const RENDER_FRAME_INTERVAL_SECONDS = 0\.15;/);
  assert.match(text, /const MAX_RENDER_SUBSTEPS = 1;/);
  assert.match(text, /this\.fieldUpdateCadenceSeconds = 1800;/);
  const earthPath = path.join(repoRoot, 'src', 'Earth.js');
  const earthText = fs.readFileSync(earthPath, 'utf8');
  assert.match(earthText, /this\.windStreamlineMaterial = new THREE\.MeshBasicMaterial\(\{\s*map: this\.windStreamlineRenderer\.texture,\s*transparent: true,\s*opacity: 0\.38,/s);
  assert.match(earthText, /this\.windStreamlineDiagnosticsEnabled = true;/);
  assert.match(earthText, /this\.windStreamlinesVisible \|\| this\.windStreamlineDiagnosticsEnabled/);
});

test('Phase 8 live wind model diagnostics are area-weighted on the lat-lon grid', () => {
  const earthPath = path.join(repoRoot, 'src', 'Earth.js');
  const text = fs.readFileSync(earthPath, 'utf8');

  assert.match(text, /const computeWeightedPercentiles = \(samples, percentiles\) => \{/);
  assert.match(text, /Number\.isFinite\(grid\.cosLat\?\.\[j\]\) \? grid\.cosLat\[j\]/);
  assert.match(text, /meanSpeed: sumWeight > 0 \? sumSpeed \/ sumWeight : null/);
});

test('Phase 8 runtime summary separates smoothness warnings from visual wind target warnings', () => {
  const summaryPath = path.join(repoRoot, 'scripts', 'agent', 'summarize-runtime-log.mjs');
  const text = fs.readFileSync(summaryPath, 'utf8');

  assert.match(text, /const runtimeWarnings = \[\];/);
  assert.match(text, /const visualWarnings = \[\];/);
  assert.match(text, /const modelWindWarnings = \[\];/);
  assert.match(text, /modelWindWarnings\.push\('wind_model_targets_failing'\);/);
  assert.match(text, /visualWarnings\.push\('wind_viz_targets_failing'\);/);
  assert.match(text, /likelySmoothEnough: runtimeWarnings\.length === 0/);
  assert.match(text, /visualLayerHealth: \{/);
  assert.match(text, /modelWindHealth: \{/);
});
