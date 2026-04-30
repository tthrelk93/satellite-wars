import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEATHER_VISUAL_MODES,
  buildVisualWeatherCueProduct,
  classifyVisualWeatherCell,
  isCloudBackedHurricaneVisualEvent,
  normalizeWeatherVisualMode,
  renderVisualWeatherColor,
  shouldRenderDefaultWeatherCue
} from '../../src/weather/visuals/weatherVisualModes.js';

const maxAlphaColor = (mode, options = {}) => renderVisualWeatherColor({
  mode,
  cloud: 0.82,
  tau: 8,
  precipRateMmHr: 3.4,
  temperatureK: 240,
  visual: { anvil: 0.8, cumulonimbusTower: 0.65, rainShaft: 0.55 },
  baseAlpha: 0.52,
  baseValue: 0.72,
  ...options
});

const makeCoreFixture = () => {
  const nx = 6;
  const ny = 4;
  const count = nx * ny;
  const f32 = (value = 0) => {
    const arr = new Float32Array(count);
    if (value !== 0) arr.fill(value);
    return arr;
  };
  const fields = {
    u: f32(16),
    v: f32(2),
    cloudLow: f32(0.12),
    cloudHigh: f32(0.10),
    tauLow: f32(0.2),
    tauHigh: f32(0.2),
    precipRate: f32(0.02),
    Ts: f32(300)
  };
  const geo = {
    landMask: f32(0)
  };
  const state = {
    soilMoistureFraction: f32(0.35),
    Ts: fields.Ts
  };
  const stratocu = 0 * nx + 0;
  fields.cloudLow[stratocu] = 0.82;
  fields.tauLow[stratocu] = 5.0;
  const dust = 3 * nx + 4;
  geo.landMask[dust] = 1;
  state.soilMoistureFraction[dust] = 0.08;
  fields.Ts[dust] = 304;
  fields.u[dust] = 17;
  fields.cloudLow[dust] = 0.03;
  fields.cloudHigh[dust] = 0.02;
  return {
    grid: {
      nx,
      ny,
      count,
      latDeg: new Float32Array([-22, -5, 12, 24]),
      lonDeg: new Float32Array([-150, -90, -30, 30, 90, 150])
    },
    fields,
    geo,
    state,
    timeUTC: 42
  };
};

const hurricaneEvent = {
  id: 'hurricane:atlantic:visual-test',
  type: 'hurricane',
  center: { latDeg: 18, lonDeg: -55 },
  radiusKm: 720,
  intensity01: 0.82,
  hurricane: {
    center: { latDeg: 18, lonDeg: -55 },
    intensity01: 0.82,
    maxWindMs: 52,
    rainShieldRadiusKm: 760,
    windField: { maxWindMs: 52 },
    rainShield: { spiralBandCount: 4 },
    satelliteSignature: {
      eyeClarity01: 0.62,
      eyewallCompleteness01: 0.72,
      spiralBandCount: 4,
      coldCloudTopProxy01: 0.76
    }
  }
};

const severeEvent = {
  id: 'tornado-outbreak:great-plains:visual-test',
  type: 'tornado-outbreak',
  center: { latDeg: 36, lonDeg: -98 },
  radiusKm: 360,
  intensity01: 0.78,
  severeWeather: {
    center: { latDeg: 36, lonDeg: -98 },
    environmentIndex01: 0.78,
    satelliteSignature: { anvilRadiusKm: 310 },
    touchdownTracks: [
      {
        start: { latDeg: 35.6, lonDeg: -99.2 },
        end: { latDeg: 36.2, lonDeg: -97.6 }
      }
    ]
  }
};

const localDownscale = {
  regions: [
    {
      source: 'event',
      sourceKind: 'severe',
      eventId: severeEvent.id,
      radiusKm: 320,
      grid: { nx: 2, ny: 2, count: 4 },
      fields: {
        latDeg: new Float32Array([35.8, 36.0, 36.2, 36.4]),
        lonDeg: new Float32Array([-99.0, -98.4, -97.8, -97.2]),
        rainRateMmHr: new Float32Array([0.4, 4.5, 1.1, 0.3]),
        lightningRate: new Float32Array([0.05, 0.72, 0.2, 0.1]),
        tornadoTrackMask: new Float32Array([0, 0.52, 0.1, 0]),
        cloudLow: new Float32Array([0.42, 0.72, 0.48, 0.22]),
        cloudHigh: new Float32Array([0.18, 0.86, 0.72, 0.08]),
        detailWeight: new Float32Array([0.35, 0.98, 0.7, 0.2])
      }
    }
  ]
};

test('visual weather classification separates cloud decks storms dust and hazards from physical inputs', () => {
  const severe = classifyVisualWeatherCell({
    cloudLow: 0.72,
    cloudHigh: 0.86,
    tauHigh: 10,
    precipRateMmHr: 5.2,
    windSpeedMs: 24,
    temperatureK: 302,
    landMask: 1,
    lightningRate: 0.7,
    hailRisk: 0.46,
    tornadoTrackMask: 0.35,
    eventType: 'tornado-outbreak',
    sourceKind: 'severe',
    latDeg: 36
  });
  assert.ok(severe.cumulonimbusTower > 0.75);
  assert.ok(severe.anvil > 0.75);
  assert.ok(severe.lightning > 0.7);
  assert.ok(severe.hail > 0.4);
  assert.ok(severe.tornado > 0.3);

  const marineDeck = classifyVisualWeatherCell({
    cloudLow: 0.78,
    cloudHigh: 0.1,
    precipRateMmHr: 0.02,
    windSpeedMs: 5,
    landMask: 0,
    temperatureK: 288,
    latDeg: -22
  });
  assert.ok(marineDeck.stratocumulusDeck > 0.65);
  assert.ok(marineDeck.cumulonimbusTower < 0.2);

  const dryWind = classifyVisualWeatherCell({
    cloudLow: 0.02,
    cloudHigh: 0.01,
    precipRateMmHr: 0.0,
    windSpeedMs: 16,
    landMask: 1,
    soilMoisture01: 0.08,
    temperatureK: 304,
    latDeg: 24
  });
  assert.ok(dryWind.dust > 0.5);
  assert.ok(dryWind.fog < 0.1);
});

test('visual weather cue product turns global event and local truth into bounded renderer cues', () => {
  const product = buildVisualWeatherCueProduct({
    core: makeCoreFixture(),
    eventProduct: { activeEvents: [hurricaneEvent, severeEvent] },
    localDownscale,
    maxCues: 20
  });
  assert.equal(product.schema, 'satellite-wars.visual-weather-cues.v1');
  assert.ok(product.cueCount > 0);
  assert.ok(product.countsByType.hurricaneSpiral >= 1);
  assert.ok(product.countsByType.stormSurgeCue >= 1);
  assert.ok(product.countsByType.cumulonimbusTower >= 1);
  assert.ok(product.countsByType.anvil >= 1);
  assert.ok(product.countsByType.tornadoTrack >= 1);
  assert.ok(product.countsByType.stratocumulusDeck >= 1);
  assert.ok(product.countsByType.dust >= 1);
  assert.equal(product.cues.every((cue) => cue.radiusKm >= 12 && cue.radiusKm <= 1200), true);

  const symbolicTypes = new Set([
    'hurricaneSpiral',
    'stormSurgeCue',
    'cumulonimbusTower',
    'anvil',
    'rainShaft',
    'lightning',
    'tornadoTrack'
  ]);
  assert.equal(product.cues
    .filter((cue) => symbolicTypes.has(cue.type))
    .every((cue) => cue.displayInDefault === false && !shouldRenderDefaultWeatherCue(cue)), true);
  assert.equal(product.cues.filter(shouldRenderDefaultWeatherCue).length, 0);
  assert.equal(isCloudBackedHurricaneVisualEvent(hurricaneEvent), true);
});

test('tropical disturbances and weak hurricane events do not become default hurricane glyphs', () => {
  const disturbanceEvent = {
    ...hurricaneEvent,
    id: 'tropical-disturbance:visual-test',
    type: 'tropical-disturbance',
    hurricane: null,
    intensity01: 0.8
  };
  const weakHurricaneEvent = {
    ...hurricaneEvent,
    id: 'hurricane:weak-visual-test',
    intensity01: 0.42,
    hurricane: {
      ...hurricaneEvent.hurricane,
      intensity01: 0.42,
      maxWindMs: 29,
      windField: { maxWindMs: 29 },
      satelliteSignature: { eyeClarity01: 0.02, eyewallCompleteness01: 0.1, spiralBandCount: 2, coldCloudTopProxy01: 0.2 }
    }
  };
  const product = buildVisualWeatherCueProduct({
    eventProduct: { activeEvents: [disturbanceEvent, weakHurricaneEvent] },
    maxCues: 20
  });

  assert.equal(isCloudBackedHurricaneVisualEvent(disturbanceEvent), false);
  assert.equal(isCloudBackedHurricaneVisualEvent(weakHurricaneEvent), false);
  assert.equal(product.cues.some((cue) => cue.type === 'hurricaneSpiral'), false);
  assert.equal(product.cues.every((cue) => !shouldRenderDefaultWeatherCue(cue)), true);
});

test('cinematic weather modes are validated and render distinct state-tied colors', () => {
  assert.deepEqual(WEATHER_VISUAL_MODES.map((mode) => mode.value), [
    'visible',
    'satellite',
    'infrared',
    'waterVapor',
    'radar'
  ]);
  assert.equal(normalizeWeatherVisualMode('radar'), 'radar');
  assert.equal(normalizeWeatherVisualMode('unknown-mode'), 'visible');

  const visible = maxAlphaColor('visible');
  const infrared = maxAlphaColor('infrared');
  const waterVapor = maxAlphaColor('waterVapor');
  const radarWet = maxAlphaColor('radar', { isHigh: false, precipRateMmHr: 8.5 });
  const radarDry = maxAlphaColor('radar', { isHigh: false, precipRateMmHr: 0.0, visual: {} });

  assert.notDeepEqual([visible.r, visible.g, visible.b], [infrared.r, infrared.g, infrared.b]);
  assert.notDeepEqual([infrared.r, infrared.g, infrared.b], [waterVapor.r, waterVapor.g, waterVapor.b]);
  assert.ok(radarWet.a > radarDry.a + 0.35);
  assert.notDeepEqual([radarWet.r, radarWet.g, radarWet.b], [radarDry.r, radarDry.g, radarDry.b]);
});
