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
  assert.match(text, /const n = this\._sampleCloudNoise\(noiseField, advLon, advLat, grid\);/);
  assert.match(text, /getPerfStats\(\) \{/);
  assert.match(text, /paintCloudsMs/);
  assert.doesNotMatch(paintBody, /Math\.sin/);
});

test('Phase 8 live weather textures use native model resolution and Earth phase timing', () => {
  const earthPath = path.join(repoRoot, 'src', 'Earth.js');
  const text = fs.readFileSync(earthPath, 'utf8');

  assert.match(
    text,
    /this\.weatherField = new WeatherField\(\{\s*renderScale: 1\.5,\s*tickSeconds: 0\.35,/s
  );
  assert.match(
    text,
    /this\.analysisWeatherField = new WeatherField\(\{\s*renderScale: 1\.5,\s*tickSeconds: 0\.35,/s
  );
  assert.match(text, /phaseBreakdown = \{/);
  assert.match(text, /weatherFieldsMs/);
  assert.match(text, /windStreamlinesMs/);
});

test('Phase 8 live wind overlay is bounded for browser smoothness', () => {
  const windPath = path.join(repoRoot, 'src', 'WindStreamlineRenderer.js');
  const text = fs.readFileSync(windPath, 'utf8');

  assert.match(text, /const DEFAULT_WIDTH = 200;/);
  assert.match(text, /const DEFAULT_HEIGHT = 100;/);
  assert.match(text, /const PARTICLE_MULTIPLIER = 10;/);
  assert.match(text, /const DEFAULT_STEP_SECONDS = 800;/);
  assert.match(text, /const RENDER_FRAME_INTERVAL_SECONDS = 0\.15;/);
  assert.match(text, /const MAX_RENDER_SUBSTEPS = 1;/);
  assert.match(text, /this\.fieldUpdateCadenceSeconds = 1800;/);
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
