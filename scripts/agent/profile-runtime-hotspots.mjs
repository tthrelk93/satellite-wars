#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import {
  dominantParticleEvolvePhase,
  PARTICLE_EVOLVE_PHASE_KEYS
} from '../../src/windParticlePerf.js';
import { ensureCyclePlanReady } from './plan-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_STATE_PATH = path.join(repoRoot, 'weather-validation/output/agent-dev-server.json');
const HOTSPOT_WINDOW_SECONDS = 240;
const TOP_SPIKE_COUNT = 8;

const argv = process.argv.slice(2);
let inputPath = null;
let outPath = null;
let statePath = DEFAULT_STATE_PATH;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--out' && argv[i + 1]) outPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
  else if (arg === '--state' && argv[i + 1]) statePath = path.resolve(argv[++i]);
  else if (arg.startsWith('--state=')) statePath = path.resolve(arg.slice('--state='.length));
  else if (!arg.startsWith('--') && !inputPath) inputPath = path.resolve(arg);
}

const readJsonIfExists = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
};

if (!inputPath) {
  const state = readJsonIfExists(statePath);
  inputPath = state?.weatherLogPath || null;
}

if (!inputPath) {
  throw new Error('No log path supplied and no dev-server state file with a weather log path was found.');
}

ensureCyclePlanReady({
  commandName: 'agent:profile-runtime-hotspots',
  artifactPath: outPath,
  allowNoCycle: false,
  requireCycleState: true
});

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
};

const summarizeSeries = (values) => {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return {
    samples: finite.length,
    p50: quantile(finite, 0.5),
    p95: quantile(finite, 0.95),
    max: Math.max(...finite)
  };
};

const nearestEvent = (events, simTimeSeconds, maxDeltaSeconds) => {
  if (!Number.isFinite(simTimeSeconds) || !events.length) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const event of events) {
    if (!Number.isFinite(event.simTimeSeconds)) continue;
    const delta = Math.abs(event.simTimeSeconds - simTimeSeconds);
    if (delta < bestDelta) {
      best = event;
      bestDelta = delta;
    }
  }
  if (!best || bestDelta > maxDeltaSeconds) return null;
  return { ...best, deltaSeconds: bestDelta };
};

const dominantPerfStage = (perf) => {
  if (!perf) return 'missing_perf_breakdown';
  const candidates = [
    ['field_rebuild', perf.fieldRebuilt ? perf.buildFieldMs : null],
    ['particle_evolve', perf.evolveParticlesMs],
    ['draw', perf.drawMs]
  ].filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!candidates.length) return 'unknown';
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][0];
};

const dominantWeatherFieldStage = (perf) => {
  if (!perf) return null;
  const candidates = [
    ['weather_field_paint_clouds', perf.paintCloudsMs],
    ['weather_field_paint_debug', perf.paintDebugMs],
    ['weather_field_physics', perf.physicsMs],
    ['weather_field_logger', perf.loggerMs],
    ['weather_field_auto_log', perf.autoLogMs]
  ].filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][0];
};

const dominantEarthStage = (breakdown) => {
  if (!breakdown) return null;
  const candidates = Object.entries(breakdown)
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b[1] - a[1]);
  return `earth_${candidates[0][0]}`;
};

const summarizePhaseBreakdowns = (phaseBreakdowns) => Object.fromEntries(
  PARTICLE_EVOLVE_PHASE_KEYS.map((phaseKey) => [
    phaseKey,
    summarizeSeries(phaseBreakdowns.map((phases) => phases?.[phaseKey]))
  ])
);

const functionHintsFor = (area) => {
  if (area === 'WindStreamlineRenderer._buildField') {
    return ['src/WindStreamlineRenderer.js:_buildField', 'src/WindStreamlineRenderer.js:_shouldRebuildField'];
  }
  if (area === 'WindStreamlineRenderer._evolveParticles') {
    return ['src/WindStreamlineRenderer.js:_evolveParticles', 'src/WindStreamlineRenderer.js:sampleFieldBilinear'];
  }
  if (area === 'WindStreamlineRenderer._draw') {
    return ['src/WindStreamlineRenderer.js:_draw'];
  }
  if (area === 'Earth wind/model diagnostics cadence') {
    return ['src/Earth.js:_maybeLogWindDiagnostics', 'src/Earth.js:_logWindModelDiagnostics'];
  }
  if (area === 'WeatherField._paintClouds') {
    return ['src/WeatherField.js:_paintClouds', 'src/WeatherField.js:_sampleCloudNoise'];
  }
  if (area === 'WeatherField.update logger/physics') {
    return ['src/WeatherField.js:update', 'src/weather/WeatherLogger.js:_buildV2Stats'];
  }
  if (area === 'Earth.update phase breakdown') {
    return ['src/Earth.js:update'];
  }
  return [];
};

const simPerfEvents = [];
const windVizEvents = [];
const windModelEvents = [];
let lineCount = 0;

const reader = readline.createInterface({
  input: fs.createReadStream(inputPath, 'utf8'),
  crlfDelay: Infinity
});

for await (const line of reader) {
  if (!line.trim()) continue;
  lineCount += 1;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch (_) {
    continue;
  }
  const event = entry?.event;
  const payload = entry?.payload ?? null;
  const sim = entry?.sim ?? {};
  const eventMeta = {
    simTimeSeconds: Number.isFinite(sim.simTimeSeconds) ? sim.simTimeSeconds : null,
    simDay: Number.isFinite(sim.simDay) ? sim.simDay : null,
    todHours: Number.isFinite(sim.todHours) ? sim.todHours : null,
    payload
  };
  if (event === 'simPerf' && payload) {
    simPerfEvents.push({
      ...eventMeta,
      updateMs: Number.isFinite(payload.updateMs) ? payload.updateMs : null,
      simLagSeconds: Number.isFinite(payload.simLagSeconds) ? payload.simLagSeconds : null,
      simStepsSkipped: Number.isFinite(payload.simStepsSkipped) ? payload.simStepsSkipped : null,
      phaseBreakdown: payload.phaseBreakdown ?? null,
      weatherFieldPerf: payload.weatherFieldPerf ?? null,
      analysisWeatherFieldPerf: payload.analysisWeatherFieldPerf ?? null,
      windStreamlinePerf: payload.windStreamlinePerf ?? null
    });
  } else if (event === 'windVizDiagnostics' && payload) {
    windVizEvents.push(eventMeta);
  } else if (event === 'windModelDiagnostics' && payload) {
    windModelEvents.push(eventMeta);
  }
}

const updateValues = simPerfEvents.map((event) => event.updateMs).filter((value) => Number.isFinite(value));
const p95UpdateMs = quantile(updateValues, 0.95);
const topSpikes = [...simPerfEvents]
  .filter((event) => Number.isFinite(event.updateMs))
  .sort((a, b) => b.updateMs - a.updateMs)
  .slice(0, TOP_SPIKE_COUNT)
  .map((event) => {
    const nearestViz = nearestEvent(windVizEvents, event.simTimeSeconds, HOTSPOT_WINDOW_SECONDS);
    const nearestModel = nearestEvent(windModelEvents, event.simTimeSeconds, HOTSPOT_WINDOW_SECONDS);
    const perf = event.windStreamlinePerf ?? nearestViz?.payload?.perf ?? null;
    const framePhases = nearestViz?.payload?.frame?.perfPhases ?? null;
    const evolvePhases = perf?.evolveParticlesPhases ?? framePhases;
    const earthStage = dominantEarthStage(event.phaseBreakdown);
    const weatherFieldStage = dominantWeatherFieldStage(event.weatherFieldPerf);
    const analysisWeatherFieldStage = dominantWeatherFieldStage(event.analysisWeatherFieldPerf);
    const dominantStage = weatherFieldStage || analysisWeatherFieldStage || earthStage || dominantPerfStage(perf);
    const dominantEvolvePhase = dominantParticleEvolvePhase(evolvePhases);
    return {
      updateMs: event.updateMs,
      simLagSeconds: event.simLagSeconds,
      simTimeSeconds: event.simTimeSeconds,
      simDay: event.simDay,
      todHours: event.todHours,
      likelyCause: dominantStage,
      phaseBreakdown: event.phaseBreakdown ?? null,
      weatherFieldPerf: event.weatherFieldPerf
        ? {
          updateMs: event.weatherFieldPerf.updateMs ?? null,
          paintCloudsMs: event.weatherFieldPerf.paintCloudsMs ?? null,
          paintDebugMs: event.weatherFieldPerf.paintDebugMs ?? null,
          physicsMs: event.weatherFieldPerf.physicsMs ?? null,
          loggerMs: event.weatherFieldPerf.loggerMs ?? null,
          autoLogMs: event.weatherFieldPerf.autoLogMs ?? null,
          painted: event.weatherFieldPerf.painted ?? null,
          useExternalCore: event.weatherFieldPerf.useExternalCore ?? null
        }
        : null,
      analysisWeatherFieldPerf: event.analysisWeatherFieldPerf
        ? {
          updateMs: event.analysisWeatherFieldPerf.updateMs ?? null,
          paintCloudsMs: event.analysisWeatherFieldPerf.paintCloudsMs ?? null,
          paintDebugMs: event.analysisWeatherFieldPerf.paintDebugMs ?? null,
          physicsMs: event.analysisWeatherFieldPerf.physicsMs ?? null,
          loggerMs: event.analysisWeatherFieldPerf.loggerMs ?? null,
          autoLogMs: event.analysisWeatherFieldPerf.autoLogMs ?? null,
          painted: event.analysisWeatherFieldPerf.painted ?? null,
          useExternalCore: event.analysisWeatherFieldPerf.useExternalCore ?? null
        }
        : null,
      windVizDeltaSeconds: nearestViz?.deltaSeconds ?? null,
      modelDiagDeltaSeconds: nearestModel?.deltaSeconds ?? null,
      fieldRebuilt: perf?.fieldRebuilt ?? null,
      directWindStreamlinePerf: event.windStreamlinePerf
        ? {
          totalMs: event.windStreamlinePerf.totalMs ?? null,
          buildFieldMs: event.windStreamlinePerf.buildFieldMs ?? null,
          evolveParticlesMs: event.windStreamlinePerf.evolveParticlesMs ?? null,
          drawMs: event.windStreamlinePerf.drawMs ?? null,
          renderSteps: event.windStreamlinePerf.renderSteps ?? null,
          fieldRebuilt: event.windStreamlinePerf.fieldRebuilt ?? null
        }
        : null,
      windVizPerf: perf
        ? {
          totalMs: perf.totalMs ?? null,
          buildFieldMs: perf.buildFieldMs ?? null,
          evolveParticlesMs: perf.evolveParticlesMs ?? null,
          evolveParticlesPhases: evolvePhases,
          dominantEvolvePhase,
          drawMs: perf.drawMs ?? null,
          renderSteps: perf.renderSteps ?? null,
          fieldAgeSimSeconds: perf.fieldAgeSimSeconds ?? null
        }
        : null,
      windVizField: nearestViz?.payload?.field
        ? {
          meanStepPx: nearestViz.payload.field.meanStepPx ?? null,
          clippedFrac: nearestViz.payload.field.clippedFrac ?? null,
          validFrac: nearestViz.payload.field.validFrac ?? null
        }
        : null,
      windVizFrame: nearestViz?.payload?.frame
        ? {
          particleCount: nearestViz.payload.frame.particleCount ?? null,
          movedFrac: nearestViz.payload.frame.movedFrac ?? null,
          respawnedFrac: nearestViz.payload.frame.respawnedFrac ?? null,
          outOfBoundsFrac: nearestViz.payload.frame.outOfBoundsFrac ?? null
        }
        : null
    };
  });

const perfBreakdowns = [
  ...windVizEvents.map((event) => event.payload?.perf ?? null),
  ...simPerfEvents.map((event) => event.windStreamlinePerf ?? null)
]
  .filter(Boolean);
const weatherFieldBreakdowns = simPerfEvents
  .map((event) => event.weatherFieldPerf ?? null)
  .filter(Boolean);
const analysisWeatherFieldBreakdowns = simPerfEvents
  .map((event) => event.analysisWeatherFieldPerf ?? null)
  .filter(Boolean);
const earthPhaseBreakdowns = simPerfEvents
  .map((event) => event.phaseBreakdown ?? null)
  .filter(Boolean);
const evolvePhaseBreakdowns = windVizEvents
  .map((event) => event.payload?.perf?.evolveParticlesPhases ?? event.payload?.frame?.perfPhases ?? null)
  .filter(Boolean);

const causeCounts = {};
for (const spike of topSpikes) {
  causeCounts[spike.likelyCause] = (causeCounts[spike.likelyCause] || 0) + 1;
}

const topSpikeFieldRebuildCount = topSpikes.filter((spike) => spike.fieldRebuilt === true).length;
const topSpikeNearModelDiagCount = topSpikes.filter((spike) => Number.isFinite(spike.modelDiagDeltaSeconds)).length;
const evolvePhaseCauseCounts = {};
for (const spike of topSpikes) {
  const phase = spike.windVizPerf?.dominantEvolvePhase;
  if (spike.likelyCause === 'particle_evolve' && phase) {
    evolvePhaseCauseCounts[phase] = (evolvePhaseCauseCounts[phase] || 0) + 1;
  }
}
const recommendedEvolvePhase = Object.entries(evolvePhaseCauseCounts)
  .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

let recommendedArea = 'collect_more_profiling_evidence';
let rationale = 'No hotspot pattern was strong enough yet to justify another code experiment.';
if (!perfBreakdowns.length) {
  recommendedArea = 'instrument_wind_streamline_perf';
  rationale = 'Runtime logs do not yet contain renderer perf breakdowns, so another tweak would still be speculative.';
} else if ((causeCounts.field_rebuild || 0) >= Math.max(3, Math.ceil(topSpikes.length / 2))) {
  recommendedArea = 'WindStreamlineRenderer._buildField';
  rationale = 'Most of the worst spikes align with frames whose dominant cost was field rebuilding.';
} else if ((causeCounts.particle_evolve || 0) >= Math.max(3, Math.ceil(topSpikes.length / 2))) {
  recommendedArea = 'WindStreamlineRenderer._evolveParticles';
  rationale = 'Most of the worst spikes align with frames dominated by particle evolution work.';
} else if ((causeCounts.draw || 0) >= Math.max(3, Math.ceil(topSpikes.length / 2))) {
  recommendedArea = 'WindStreamlineRenderer._draw';
  rationale = 'Most of the worst spikes align with draw-heavy frames rather than rebuild or evolution work.';
} else if (topSpikeNearModelDiagCount >= Math.max(3, Math.ceil(topSpikes.length / 2))) {
  recommendedArea = 'Earth wind/model diagnostics cadence';
  rationale = 'A large share of the worst spikes land near wind-model diagnostic ticks, so cadence and diagnostic payload work still matter.';
} else if ((causeCounts.weather_field_paint_clouds || 0) >= Math.max(3, Math.ceil(topSpikes.length / 2))) {
  recommendedArea = 'WeatherField._paintClouds';
  rationale = 'Most of the worst Earth.update spikes are dominated by live cloud texture painting.';
} else if (
  (causeCounts.weather_field_logger || 0) + (causeCounts.weather_field_auto_log || 0) + (causeCounts.weather_field_physics || 0) >= Math.max(3, Math.ceil(topSpikes.length / 2))
) {
  recommendedArea = 'WeatherField.update logger/physics';
  rationale = 'Most of the worst Earth.update spikes are inside WeatherField live update work rather than the wind renderer.';
} else if (Object.keys(causeCounts).some((key) => key.startsWith('earth_'))) {
  recommendedArea = 'Earth.update phase breakdown';
  rationale = 'The Earth.update phase breakdown is now present but does not yet point to a narrower helper category.';
}

const report = {
  schema: 'satellite-wars.hotspot-profile.v1',
  generatedAt: new Date().toISOString(),
  inputPath,
  lineCount,
  hotspotWindowSeconds: HOTSPOT_WINDOW_SECONDS,
  perfInstrumentationPresent: perfBreakdowns.length > 0,
  simPerf: {
    samples: updateValues.length,
    updateMs: summarizeSeries(updateValues),
    spikeThresholdMs: p95UpdateMs
  },
  windVizPerf: {
    samples: perfBreakdowns.length,
    totalMs: summarizeSeries(perfBreakdowns.map((perf) => perf.totalMs)),
    buildFieldMs: summarizeSeries(perfBreakdowns.map((perf) => perf.buildFieldMs)),
    evolveParticlesMs: summarizeSeries(perfBreakdowns.map((perf) => perf.evolveParticlesMs)),
    evolveParticlesPhases: summarizePhaseBreakdowns(evolvePhaseBreakdowns),
    drawMs: summarizeSeries(perfBreakdowns.map((perf) => perf.drawMs)),
    renderSteps: summarizeSeries(perfBreakdowns.map((perf) => perf.renderSteps)),
    rebuildFrames: perfBreakdowns.filter((perf) => perf.fieldRebuilt === true).length
  },
  earthPhasePerf: {
    samples: earthPhaseBreakdowns.length,
    workerMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.workerMs)),
    weatherFieldsMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.weatherFieldsMs)),
    weatherVolumeMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.weatherVolumeMs)),
    sensorsMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.sensorsMs)),
    radarMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.radarMs)),
    cloudIntelMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.cloudIntelMs)),
    windStreamlinesMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.windStreamlinesMs)),
    windDiagnosticsMs: summarizeSeries(earthPhaseBreakdowns.map((perf) => perf.windDiagnosticsMs))
  },
  weatherFieldPerf: {
    samples: weatherFieldBreakdowns.length,
    updateMs: summarizeSeries(weatherFieldBreakdowns.map((perf) => perf.updateMs)),
    paintCloudsMs: summarizeSeries(weatherFieldBreakdowns.map((perf) => perf.paintCloudsMs)),
    paintDebugMs: summarizeSeries(weatherFieldBreakdowns.map((perf) => perf.paintDebugMs)),
    physicsMs: summarizeSeries(weatherFieldBreakdowns.map((perf) => perf.physicsMs)),
    loggerMs: summarizeSeries(weatherFieldBreakdowns.map((perf) => perf.loggerMs)),
    autoLogMs: summarizeSeries(weatherFieldBreakdowns.map((perf) => perf.autoLogMs)),
    paintedFrames: weatherFieldBreakdowns.filter((perf) => perf.painted === true).length
  },
  analysisWeatherFieldPerf: {
    samples: analysisWeatherFieldBreakdowns.length,
    updateMs: summarizeSeries(analysisWeatherFieldBreakdowns.map((perf) => perf.updateMs)),
    paintCloudsMs: summarizeSeries(analysisWeatherFieldBreakdowns.map((perf) => perf.paintCloudsMs)),
    paintDebugMs: summarizeSeries(analysisWeatherFieldBreakdowns.map((perf) => perf.paintDebugMs)),
    physicsMs: summarizeSeries(analysisWeatherFieldBreakdowns.map((perf) => perf.physicsMs)),
    loggerMs: summarizeSeries(analysisWeatherFieldBreakdowns.map((perf) => perf.loggerMs)),
    autoLogMs: summarizeSeries(analysisWeatherFieldBreakdowns.map((perf) => perf.autoLogMs)),
    paintedFrames: analysisWeatherFieldBreakdowns.filter((perf) => perf.painted === true).length
  },
  topSpikes,
  spikeCauseSummary: {
    causeCounts,
    topSpikeFieldRebuildCount,
    topSpikeNearModelDiagCount,
    evolvePhaseCauseCounts
  },
  recommendedNextFocus: {
    area: recommendedArea,
    rationale,
    functionHints: functionHintsFor(recommendedArea),
    evolvePhase: recommendedArea === 'WindStreamlineRenderer._evolveParticles'
      ? recommendedEvolvePhase
      : null
  }
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
