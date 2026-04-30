export const WEATHER_VISUAL_MODES = [
  { value: 'visible', label: 'Visible Light' },
  { value: 'satellite', label: 'Cinematic Satellite' },
  { value: 'infrared', label: 'Infrared' },
  { value: 'waterVapor', label: 'Water Vapor' },
  { value: 'radar', label: 'Radar' }
];

const MODE_SET = new Set(WEATHER_VISUAL_MODES.map((mode) => mode.value));

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const mix = (a, b, t) => a + (b - a) * clamp01(t);
const mixColor = (a, b, t) => [
  Math.round(mix(a[0], b[0], t)),
  Math.round(mix(a[1], b[1], t)),
  Math.round(mix(a[2], b[2], t))
];

const colorRamp = (stops, t) => {
  const x = clamp01(t);
  if (x <= stops[0].t) return stops[0].c;
  for (let i = 1; i < stops.length; i += 1) {
    if (x <= stops[i].t) {
      const a = stops[i - 1];
      const b = stops[i];
      return mixColor(a.c, b.c, (x - a.t) / Math.max(1e-6, b.t - a.t));
    }
  }
  return stops[stops.length - 1].c;
};

export function normalizeWeatherVisualMode(mode) {
  return MODE_SET.has(mode) ? mode : 'visible';
}

export function classifyVisualWeatherCell({
  cloudLow = 0,
  cloudHigh = 0,
  tauLow = 0,
  tauHigh = 0,
  precipRateMmHr = 0,
  windSpeedMs = 0,
  temperatureK = 288,
  landMask = 0,
  soilMoisture01 = 0.35,
  lightningRate = 0,
  hailRisk = 0,
  tornadoTrackMask = 0,
  terrainLift01 = 0,
  eventType = null,
  sourceKind = null,
  latDeg = 0
} = {}) {
  const low = clamp01(cloudLow);
  const high = clamp01(cloudHigh);
  const tau = Math.max(0, tauLow + tauHigh);
  const precip = Math.max(0, precipRateMmHr);
  const wind = Math.max(0, windSpeedMs);
  const absLat = Math.abs(Number.isFinite(latDeg) ? latDeg : 0);
  const isHurricane = eventType === 'hurricane' || sourceKind === 'hurricane';
  const isSevere = sourceKind === 'severe'
    || eventType === 'supercell'
    || eventType === 'tornado-outbreak'
    || eventType === 'tornado-touchdown';
  const isFront = eventType === 'front'
    || eventType === 'extratropical-cyclone'
    || eventType === 'atmospheric-river'
    || eventType === 'blizzard'
    || sourceKind === 'synoptic';
  const isCold = Number.isFinite(temperatureK) && temperatureK < 273.5;
  const marine = landMask < 0.45;
  const drySubtropics = landMask > 0.55
    && absLat >= 12
    && absLat <= 36
    && temperatureK > 296
    && soilMoisture01 < 0.28;

  const cumulonimbusTower = clamp01(
    smoothstep(0.45, 3.2, precip)
    * (0.45 + 0.45 * high + 0.35 * low)
    + lightningRate * 0.45
    + hailRisk * 0.35
    + (isSevere ? 0.42 : 0)
  );
  const anvil = clamp01(
    smoothstep(0.34, 0.82, high)
    * (0.25 + 0.55 * cumulonimbusTower + 0.25 * smoothstep(3, 16, tauHigh))
    + (isSevere ? 0.35 : 0)
  );
  const stratocumulusDeck = clamp01(
    smoothstep(0.34, 0.72, low)
    * (1 - smoothstep(0.28, 0.58, high))
    * (1 - smoothstep(0.2, 1.1, precip))
    * (marine ? 1.0 : 0.48)
  );
  const hurricaneSpiral = clamp01((isHurricane ? 0.72 : 0) + smoothstep(0.45, 0.95, high) * (isHurricane ? 0.28 : 0));
  const frontalShield = clamp01((isFront ? 0.6 : 0) + smoothstep(0.22, 0.72, low + high) * (isFront ? 0.38 : 0));
  const rainShaft = clamp01(smoothstep(0.18, 2.8, precip) * (isCold ? 0.25 : 1));
  const snowShaft = clamp01(smoothstep(0.08, 1.6, precip) * (isCold || eventType === 'blizzard' ? 1 : 0));
  const lightning = clamp01(lightningRate + cumulonimbusTower * 0.28 + tornadoTrackMask * 0.5);
  const dust = clamp01(drySubtropics
    ? smoothstep(5, 13, wind) * (1 - smoothstep(0.05, 0.24, precip)) * (1 - smoothstep(0.12, 0.36, low + high))
    : 0);
  const fog = clamp01(
    smoothstep(0.28, 0.64, low)
    * (1 - smoothstep(0.18, 0.42, high))
    * (1 - smoothstep(0.04, 0.35, precip))
    * (1 - smoothstep(3.5, 7.5, wind))
  );
  const seaSpray = clamp01(marine ? smoothstep(11, 22, wind) * (0.25 + rainShaft * 0.75) : 0);
  const stormSurgeCue = clamp01(isHurricane ? smoothstep(0.45, 1, hurricaneSpiral) * smoothstep(13, 35, wind) : 0);

  return {
    cloudOpacity: clamp01(Math.max(low, high, smoothstep(0.15, 1.4, tau))),
    stratocumulusDeck,
    anvil,
    hurricaneSpiral,
    frontalShield,
    cumulonimbusTower,
    rainShaft,
    snowShaft,
    lightning,
    hail: clamp01(hailRisk),
    tornado: clamp01(tornadoTrackMask),
    dust,
    fog,
    seaSpray,
    stormSurgeCue,
    terrainLift: clamp01(terrainLift01)
  };
}

const RADAR_STOPS = [
  { t: 0.00, c: [31, 41, 55] },
  { t: 0.18, c: [34, 197, 94] },
  { t: 0.40, c: [250, 204, 21] },
  { t: 0.62, c: [249, 115, 22] },
  { t: 0.80, c: [239, 68, 68] },
  { t: 1.00, c: [168, 85, 247] }
];

const IR_STOPS = [
  { t: 0.00, c: [31, 41, 55] },
  { t: 0.35, c: [37, 99, 235] },
  { t: 0.62, c: [168, 85, 247] },
  { t: 0.82, c: [244, 114, 182] },
  { t: 1.00, c: [255, 255, 255] }
];

const WV_STOPS = [
  { t: 0.00, c: [5, 20, 45] },
  { t: 0.34, c: [22, 101, 138] },
  { t: 0.66, c: [45, 212, 191] },
  { t: 1.00, c: [226, 252, 255] }
];

export function renderVisualWeatherColor({
  mode = 'visible',
  isHigh = false,
  cloud = 0,
  tau = 0,
  precipRateMmHr = 0,
  temperatureK = 288,
  windSpeedMs = 0,
  visual = {},
  noise = 0.5,
  baseShade = 235,
  baseValue = 0,
  baseAlpha = 0
} = {}) {
  const normalized = normalizeWeatherVisualMode(mode);
  const precip = Math.max(0, precipRateMmHr);
  const cloudStrength = clamp01(Math.max(cloud, baseValue, smoothstep(0.12, 3.8, tau)));
  const alphaBase = clamp01(baseAlpha);
  if (normalized === 'radar') {
    const radarSignal = clamp01(
      smoothstep(0.02, 9.5, precip)
      + (visual.hail || 0) * 0.18
      + (visual.tornado || 0) * 0.12
    );
    const color = colorRamp(RADAR_STOPS, radarSignal);
    return {
      r: color[0],
      g: color[1],
      b: color[2],
      a: isHigh ? Math.min(0.22, radarSignal * 0.32) : Math.min(0.84, radarSignal * 0.9)
    };
  }
  if (normalized === 'infrared') {
    const coldCloud = clamp01((isHigh ? 0.42 : 0.12) + cloudStrength * 0.72 + smoothstep(270, 235, temperatureK) * 0.22);
    const color = colorRamp(IR_STOPS, coldCloud);
    return {
      r: color[0],
      g: color[1],
      b: color[2],
      a: Math.min(isHigh ? 0.82 : 0.48, alphaBase * (isHigh ? 1.25 : 0.8) + coldCloud * (isHigh ? 0.22 : 0.08))
    };
  }
  if (normalized === 'waterVapor') {
    const vapor = clamp01((isHigh ? 0.44 : 0.16) * cloudStrength + (visual.anvil || 0) * 0.38 + smoothstep(0.25, 2.4, precip) * 0.18);
    const color = colorRamp(WV_STOPS, vapor);
    return {
      r: color[0],
      g: color[1],
      b: color[2],
      a: Math.min(isHigh ? 0.76 : 0.34, alphaBase * (isHigh ? 1.05 : 0.45) + vapor * 0.34)
    };
  }

  let color = [baseShade, baseShade, baseShade];
  if (visual.dust > 0.08) color = mixColor(color, [190, 142, 82], visual.dust * 0.85);
  if (visual.stratocumulusDeck > 0.1) color = mixColor(color, [218, 226, 222], visual.stratocumulusDeck * 0.55);
  if (visual.frontalShield > 0.1) color = mixColor(color, [230, 236, 242], visual.frontalShield * 0.48);
  if (visual.anvil > 0.1) color = mixColor(color, [252, 254, 255], visual.anvil * 0.7);
  if (visual.cumulonimbusTower > 0.1) color = mixColor(color, [255, 255, 255], visual.cumulonimbusTower * 0.8);
  if (visual.hurricaneSpiral > 0.1) color = mixColor(color, [242, 248, 255], visual.hurricaneSpiral * 0.65);
  if (visual.rainShaft > 0.12) color = mixColor(color, [178, 203, 222], visual.rainShaft * 0.5);
  if (visual.snowShaft > 0.12) color = mixColor(color, [235, 250, 255], visual.snowShaft * 0.6);
  if (visual.fog > 0.18) color = mixColor(color, [205, 217, 218], visual.fog * 0.55);

  const satelliteBoost = normalized === 'satellite' ? 1.12 : 1.0;
  const shadeNoise = normalized === 'satellite' ? 18 * (noise - 0.5) : 8 * (noise - 0.5);
  return {
    r: clamp(Math.round(color[0] * satelliteBoost + shadeNoise), 0, 255),
    g: clamp(Math.round(color[1] * satelliteBoost + shadeNoise), 0, 255),
    b: clamp(Math.round(color[2] * satelliteBoost + shadeNoise), 0, 255),
    a: Math.min(0.92, alphaBase * (normalized === 'satellite' ? 1.12 : 1.0) + (visual.fog || 0) * 0.08)
  };
}

const pushCue = (cues, cue) => {
  if (!cue || !Number.isFinite(cue.latDeg) || !Number.isFinite(cue.lonDeg)) return;
  cues.push({
    ...cue,
    intensity01: clamp01(cue.intensity01 ?? cue.intensity ?? 0.35),
    radiusKm: clamp(cue.radiusKm ?? 120, 12, 1200)
  });
};

const getRegionPoint = (region, scoreFn) => {
  const fields = region?.fields || {};
  const nx = region?.grid?.nx || 0;
  const count = region?.grid?.count || (nx * (region?.grid?.ny || 0));
  if (!nx || !count || !fields.latDeg || !fields.lonDeg) return null;
  let best = null;
  let bestScore = -Infinity;
  for (let p = 0; p < count; p += 1) {
    const score = scoreFn(fields, p);
    if (score > bestScore) {
      bestScore = score;
      best = {
        p,
        score,
        latDeg: fields.latDeg[p],
        lonDeg: fields.lonDeg[p]
      };
    }
  }
  return best && bestScore > 0 ? best : null;
};

export function buildVisualWeatherCueProduct({
  core = null,
  eventProduct = null,
  localDownscale = null,
  maxCues = 72
} = {}) {
  const cues = [];
  const events = Array.isArray(eventProduct?.activeEvents) ? eventProduct.activeEvents : [];
  for (const event of events) {
    const center = event.hurricane?.center || event.severeWeather?.center || event.center;
    if (!center) continue;
    const intensity = clamp01(event.hurricane?.intensity01 ?? event.intensity01 ?? event.severeWeather?.environmentIndex01 ?? 0.35);
    if (event.type === 'hurricane' || event.type === 'tropical-disturbance') {
      pushCue(cues, { type: 'hurricaneSpiral', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: event.hurricane?.rainShieldRadiusKm || event.radiusKm || 520, intensity01: intensity, eventId: event.id });
      pushCue(cues, { type: 'rainShaft', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: 95 + 180 * intensity, intensity01: intensity, eventId: event.id });
      if (event.type === 'hurricane' && intensity > 0.45) {
        pushCue(cues, { type: 'stormSurgeCue', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: 180 + 260 * intensity, intensity01: intensity, eventId: event.id });
        pushCue(cues, { type: 'seaSpray', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: 150 + 220 * intensity, intensity01: intensity, eventId: event.id });
      }
    } else if (event.severeWeather) {
      pushCue(cues, { type: 'cumulonimbusTower', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: 80 + 190 * intensity, intensity01: intensity, eventId: event.id });
      pushCue(cues, { type: 'anvil', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: event.severeWeather?.satelliteSignature?.anvilRadiusKm || 160 + 220 * intensity, intensity01: intensity, eventId: event.id });
      pushCue(cues, { type: 'lightning', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: 52 + 100 * intensity, intensity01: intensity, eventId: event.id });
      for (const track of event.severeWeather?.touchdownTracks || []) {
        const midLat = ((track.start?.latDeg || center.latDeg) + (track.end?.latDeg || center.latDeg)) * 0.5;
        const midLon = ((track.start?.lonDeg || center.lonDeg) + (track.end?.lonDeg || center.lonDeg)) * 0.5;
        pushCue(cues, { type: 'tornadoTrack', latDeg: midLat, lonDeg: midLon, radiusKm: 32, intensity01: intensity, eventId: event.id });
      }
    } else if (['front', 'extratropical-cyclone', 'atmospheric-river', 'blizzard', 'mcs'].includes(event.type)) {
      pushCue(cues, { type: 'frontalShield', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: event.radiusKm || 520, intensity01: intensity, eventId: event.id });
      pushCue(cues, { type: event.type === 'blizzard' ? 'snowShaft' : 'rainShaft', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: 120 + 240 * intensity, intensity01: intensity, eventId: event.id });
    } else if (event.type === 'dust-event') {
      pushCue(cues, { type: 'dust', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: event.radiusKm || 420, intensity01: intensity, eventId: event.id });
    } else if (event.type === 'monsoon-burst') {
      pushCue(cues, { type: 'rainShaft', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: event.radiusKm || 420, intensity01: intensity, eventId: event.id });
      pushCue(cues, { type: 'anvil', latDeg: center.latDeg, lonDeg: center.lonDeg, radiusKm: 200 + 260 * intensity, intensity01: intensity, eventId: event.id });
    }
  }

  for (const region of localDownscale?.regions || []) {
    const rainPoint = getRegionPoint(region, (fields, p) => (fields.rainRateMmHr?.[p] || 0) * (fields.detailWeight?.[p] || 0));
    const lightningPoint = getRegionPoint(region, (fields, p) => (fields.lightningRate?.[p] || 0) + (fields.tornadoTrackMask?.[p] || 0) * 1.5);
    const fogPoint = getRegionPoint(region, (fields, p) => {
      const rain = fields.rainRateMmHr?.[p] || 0;
      const low = fields.cloudLow?.[p] || 0;
      const high = fields.cloudHigh?.[p] || 0;
      return low * (1 - high) * (1 - smoothstep(0.08, 0.45, rain)) * (fields.detailWeight?.[p] || 0);
    });
    if (rainPoint && rainPoint.score > 0.35) {
      const cold = false;
      pushCue(cues, {
        type: cold ? 'snowShaft' : 'rainShaft',
        latDeg: rainPoint.latDeg,
        lonDeg: rainPoint.lonDeg,
        radiusKm: Math.max(35, Math.min(240, (region.radiusKm || 300) * 0.2)),
        intensity01: smoothstep(0.2, 7.5, rainPoint.score),
        eventId: region.eventId
      });
    }
    if (lightningPoint && lightningPoint.score > 0.18) {
      pushCue(cues, {
        type: (region.fields?.tornadoTrackMask?.[lightningPoint.p] || 0) > 0.24 ? 'tornadoTrack' : 'lightning',
        latDeg: lightningPoint.latDeg,
        lonDeg: lightningPoint.lonDeg,
        radiusKm: 42 + 110 * clamp01(lightningPoint.score),
        intensity01: clamp01(lightningPoint.score),
        eventId: region.eventId
      });
    }
    if (region.source === 'focus' && fogPoint && fogPoint.score > 0.32) {
      pushCue(cues, {
        type: 'fog',
        latDeg: fogPoint.latDeg,
        lonDeg: fogPoint.lonDeg,
        radiusKm: Math.max(60, Math.min(220, (region.radiusKm || 300) * 0.25)),
        intensity01: clamp01(fogPoint.score),
        eventId: region.eventId
      });
    }
  }

  if (core?.grid && core?.fields) {
    const { grid, fields, geo, state } = core;
    const stepJ = Math.max(3, Math.floor(grid.ny / 12));
    const stepI = Math.max(4, Math.floor(grid.nx / 18));
    for (let j = 0; j < grid.ny; j += stepJ) {
      for (let i = 0; i < grid.nx; i += stepI) {
        const k = j * grid.nx + i;
        const latDeg = grid.latDeg?.[j] ?? 0;
        const lonDeg = grid.lonDeg?.[i] ?? 0;
        const u = fields.u?.[k] || 0;
        const v = fields.v?.[k] || 0;
        const visual = classifyVisualWeatherCell({
          cloudLow: fields.cloudLow?.[k] || 0,
          cloudHigh: fields.cloudHigh?.[k] || 0,
          tauLow: fields.tauLow?.[k] || 0,
          tauHigh: fields.tauHigh?.[k] || 0,
          precipRateMmHr: fields.precipRate?.[k] || 0,
          windSpeedMs: Math.hypot(u, v),
          temperatureK: fields.Ts?.[k] || state?.Ts?.[k] || 288,
          landMask: geo?.landMask?.[k] || 0,
          soilMoisture01: state?.soilMoistureFraction?.[k] || 0.35,
          latDeg
        });
        if (visual.stratocumulusDeck > 0.62) {
          pushCue(cues, { type: 'stratocumulusDeck', latDeg, lonDeg, radiusKm: 180, intensity01: visual.stratocumulusDeck });
        } else if (visual.dust > 0.48) {
          pushCue(cues, { type: 'dust', latDeg, lonDeg, radiusKm: 220, intensity01: visual.dust });
        } else if (visual.seaSpray > 0.55) {
          pushCue(cues, { type: 'seaSpray', latDeg, lonDeg, radiusKm: 150, intensity01: visual.seaSpray });
        }
      }
    }
  }

  cues.sort((a, b) => (b.intensity01 * b.radiusKm) - (a.intensity01 * a.radiusKm));
  const selected = cues.slice(0, Math.max(0, maxCues));
  return {
    schema: 'satellite-wars.visual-weather-cues.v1',
    timeUTC: Number.isFinite(core?.timeUTC) ? core.timeUTC : localDownscale?.timeUTC ?? 0,
    cueCount: selected.length,
    cues: selected,
    countsByType: selected.reduce((acc, cue) => {
      acc[cue.type] = (acc[cue.type] || 0) + 1;
      return acc;
    }, {})
  };
}

export const _visualWeatherTestInternals = {
  clamp01,
  smoothstep,
  colorRamp
};
