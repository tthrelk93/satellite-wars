import { WEATHER_KERNEL_CONTRACT_VERSION } from '../kernel/contracts.js';

export const LOCAL_DOWNSCALE_PRODUCT_SCHEMA = 'satellite-wars.local-downscale.v1';
export const LOCAL_DOWNSCALE_REGION_SCHEMA = 'satellite-wars.local-downscale.region.v1';

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const normalizeLonDeg = (lonDeg) => {
  let lon = Number.isFinite(lonDeg) ? lonDeg : 0;
  while (lon < -180) lon += 360;
  while (lon >= 180) lon -= 360;
  return lon;
};

const hashUint = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

const hashUnit = (seed, x, y, salt = 0) => {
  let n = (Math.imul((x | 0) ^ seed, 374761393)
    ^ Math.imul((y | 0) ^ salt, 668265263)
    ^ Math.imul(seed + salt, 2246822519)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

const valueNoise = (seed, x, y, salt) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hashUnit(seed, x0, y0, salt);
  const n10 = hashUnit(seed, x0 + 1, y0, salt);
  const n01 = hashUnit(seed, x0, y0 + 1, salt);
  const n11 = hashUnit(seed, x0 + 1, y0 + 1, salt);
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  return nx0 * (1 - sy) + nx1 * sy;
};

const fbm = (seed, x, y, salt = 0) => {
  let amplitude = 0.55;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    total += amplitude * valueNoise(seed, x * frequency, y * frequency, salt + octave * 1009);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return norm > 0 ? total / norm : 0.5;
};

const bilinear = (field, x, y, nx, ny, fallback = 0) => {
  if (!field || !nx || !ny) return fallback;
  const lonWrapped = ((x % nx) + nx) % nx;
  const latClamped = Math.max(0, Math.min(ny - 1, y));
  const i0 = Math.floor(lonWrapped);
  const j0 = Math.floor(latClamped);
  const i1 = (i0 + 1) % nx;
  const j1 = Math.min(ny - 1, j0 + 1);
  const fi = lonWrapped - i0;
  const fj = latClamped - j0;
  const k00 = j0 * nx + i0;
  const k10 = j0 * nx + i1;
  const k01 = j1 * nx + i0;
  const k11 = j1 * nx + i1;
  const v00 = Number.isFinite(field[k00]) ? field[k00] : fallback;
  const v10 = Number.isFinite(field[k10]) ? field[k10] : fallback;
  const v01 = Number.isFinite(field[k01]) ? field[k01] : fallback;
  const v11 = Number.isFinite(field[k11]) ? field[k11] : fallback;
  const vTop = v00 * (1 - fi) + v10 * fi;
  const vBot = v01 * (1 - fi) + v11 * fi;
  return vTop * (1 - fj) + vBot * fj;
};

const sampleAtLatLon = (field, grid, latDeg, lonDeg, fallback = 0) => {
  if (!grid?.nx || !grid?.ny || !grid?.cellLonDeg || !grid?.cellLatDeg) return fallback;
  const x = (normalizeLonDeg(lonDeg) + 180) / grid.cellLonDeg - 0.5;
  const y = (90 - latDeg) / grid.cellLatDeg - 0.5;
  return bilinear(field, x, y, grid.nx, grid.ny, fallback);
};

const movePoint = ({ latDeg, lonDeg }, eastKm, northKm) => {
  const lat = Number.isFinite(latDeg) ? latDeg : 0;
  const lon = Number.isFinite(lonDeg) ? lonDeg : 0;
  const nextLat = clamp(lat + northKm / 111, -89.6, 89.6);
  const lonScale = Math.max(0.18, Math.cos((lat * Math.PI) / 180));
  return {
    latDeg: nextLat,
    lonDeg: normalizeLonDeg(lon + eastKm / (111 * lonScale))
  };
};

const motionBasis = (event = {}, center = {}) => {
  const safeEvent = event || {};
  const motion = safeEvent.hurricane?.motionVector || safeEvent.severeWeather?.motionVector || safeEvent.motionVector || { uMs: 9, vMs: center.latDeg >= 0 ? 2 : -2 };
  const u = Number.isFinite(motion.uMs) ? motion.uMs : 9;
  const v = Number.isFinite(motion.vMs) ? motion.vMs : center.latDeg >= 0 ? 2 : -2;
  const speed = Math.max(1e-6, Math.hypot(u, v));
  return {
    eastUnit: u / speed,
    northUnit: v / speed,
    sideEast: -v / speed,
    sideNorth: u / speed,
    uMs: u,
    vMs: v,
    speedMs: speed
  };
};

const distanceToSegmentKm = (point, start, end) => {
  if (!start || !end) return Infinity;
  const lat0 = Number(point.latDeg) || 0;
  const lon0 = Number(point.lonDeg) || 0;
  const lat1 = Number(start.latDeg) || 0;
  const lon1 = Number(start.lonDeg) || 0;
  const lat2 = Number(end.latDeg) || 0;
  const lon2 = Number(end.lonDeg) || 0;
  const meanLat = ((lat0 + lat1 + lat2) / 3) * Math.PI / 180;
  const x0 = lon0 * 111 * Math.max(0.18, Math.cos(meanLat));
  const y0 = lat0 * 111;
  const x1 = lon1 * 111 * Math.max(0.18, Math.cos(meanLat));
  const y1 = lat1 * 111;
  const x2 = lon2 * 111 * Math.max(0.18, Math.cos(meanLat));
  const y2 = lat2 * 111;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const denom = dx * dx + dy * dy || 1;
  const t = clamp(((x0 - x1) * dx + (y0 - y1) * dy) / denom, 0, 1);
  return Math.hypot(x0 - (x1 + dx * t), y0 - (y1 + dy * t));
};

const createRegionDescriptorFromEvent = (event) => {
  const center = event?.hurricane?.center || event?.severeWeather?.center || event?.center;
  if (!center || !Number.isFinite(center.latDeg) || !Number.isFinite(center.lonDeg)) return null;
  const intensity = clamp01(event.hurricane?.intensity01 ?? event.intensity01 ?? event.severeWeather?.environmentIndex01 ?? 0.3);
  const type = event.type || 'weather-event';
  const hurricaneRadius = event.hurricane?.rainShieldRadiusKm || event.radiusKm;
  const severeRadius = event.severeWeather?.satelliteSignature?.anvilRadiusKm || event.radiusKm;
  let radiusKm = clamp(event.radiusKm || 420, 180, 900);
  let gridSize = 25;
  let priority = 0.4 + intensity;
  let sourceKind = 'event';
  if (type === 'hurricane') {
    radiusKm = clamp(hurricaneRadius || 620, 360, 950);
    gridSize = 31;
    priority = 2.2 + intensity;
    sourceKind = 'hurricane';
  } else if (type === 'tropical-disturbance') {
    radiusKm = clamp(hurricaneRadius || 520, 300, 780);
    gridSize = 27;
    priority = 1.5 + intensity;
    sourceKind = 'tropical-disturbance';
  } else if (type === 'supercell' || type === 'tornado-outbreak' || type === 'tornado-touchdown') {
    radiusKm = clamp(severeRadius || event.radiusKm || 260, type === 'tornado-touchdown' ? 80 : 180, 520);
    gridSize = type === 'tornado-touchdown' ? 21 : 25;
    priority = 2.4 + intensity;
    sourceKind = 'severe';
  } else if (type === 'front' || type === 'extratropical-cyclone' || type === 'atmospheric-river' || type === 'blizzard') {
    radiusKm = clamp(event.radiusKm || 650, 360, 980);
    gridSize = 27;
    priority = 1.3 + intensity;
    sourceKind = 'synoptic';
  } else if (type === 'mcs' || type === 'monsoon-burst' || type === 'dust-event') {
    radiusKm = clamp(event.radiusKm || 460, 260, 800);
    gridSize = 25;
    priority = 1.1 + intensity;
  }
  return {
    id: `event:${event.id || `${type}:${center.latDeg}:${center.lonDeg}`}`,
    source: 'event',
    sourceKind,
    eventType: type,
    eventId: event.id || null,
    center: {
      latDeg: Number(center.latDeg),
      lonDeg: normalizeLonDeg(Number(center.lonDeg))
    },
    radiusKm,
    fadeRadiusKm: radiusKm * 1.12,
    gridSize,
    intensity,
    priority,
    event
  };
};

const createRegionDescriptorFromFocus = (focus, index) => {
  const center = focus?.center || focus;
  if (!center || !Number.isFinite(center.latDeg) || !Number.isFinite(center.lonDeg)) return null;
  const radiusKm = clamp(focus.radiusKm || 420, 160, 900);
  return {
    id: `focus:${focus.id || index}`,
    source: 'focus',
    sourceKind: focus.kind || 'camera',
    eventType: null,
    eventId: null,
    center: {
      latDeg: Number(center.latDeg),
      lonDeg: normalizeLonDeg(Number(center.lonDeg))
    },
    radiusKm,
    fadeRadiusKm: radiusKm * 1.15,
    gridSize: clamp(Math.round(focus.gridSize || 21), 13, 33),
    intensity: clamp01(focus.intensity01 ?? 0.35),
    priority: 0.9 + clamp01(focus.intensity01 ?? 0.35),
    event: null
  };
};

const terrainSample = ({ grid, geo, state, latDeg, lonDeg, uMs, vMs }) => {
  const elev = geo?.elev || null;
  if (!elev) {
    return { elevationM: 0, slope01: 0, upslope01: 0, terrainLift01: 0 };
  }
  const center = sampleAtLatLon(elev, grid, latDeg, lonDeg, 0);
  const east = sampleAtLatLon(elev, grid, latDeg, lonDeg + 0.35, center);
  const west = sampleAtLatLon(elev, grid, latDeg, lonDeg - 0.35, center);
  const north = sampleAtLatLon(elev, grid, latDeg + 0.35, lonDeg, center);
  const south = sampleAtLatLon(elev, grid, latDeg - 0.35, lonDeg, center);
  const dzdx = (east - west) / Math.max(1, 2 * 0.35 * 111000 * Math.max(0.18, Math.cos((latDeg * Math.PI) / 180)));
  const dzdy = (north - south) / Math.max(1, 2 * 0.35 * 111000);
  const slope = Math.hypot(dzdx, dzdy);
  const windSpeed = Math.max(1, Math.hypot(uMs || 0, vMs || 0));
  const normalFlow = ((uMs || 0) / windSpeed) * dzdx + ((vMs || 0) / windSpeed) * dzdy;
  const upslope01 = smoothstep(0.0007, 0.006, normalFlow);
  const terrainFlowDiag = sampleAtLatLon(state?.terrainFlowForcing, grid, latDeg, lonDeg, 0);
  const terrainLift01 = Math.max(upslope01, smoothstep(0.8, 5.5, Math.max(0, terrainFlowDiag)));
  return {
    elevationM: Number(center.toFixed(1)),
    slope01: clamp01(smoothstep(0.0008, 0.012, slope)),
    upslope01,
    terrainLift01
  };
};

const lineBand = (crossKm, widthKm) => Math.exp(-(crossKm * crossKm) / Math.max(1, 2 * widthKm * widthKm));
const radialRing = (rFrac, centerFrac, widthFrac) => Math.exp(-((rFrac - centerFrac) ** 2) / Math.max(1e-4, 2 * widthFrac * widthFrac));

const computeEventPattern = ({ descriptor, point, eastKm, northKm, rFrac, alongKm, crossKm, parent, terrain, seed, x, y }) => {
  const event = descriptor.event;
  const type = descriptor.eventType;
  const intensity = descriptor.intensity;
  const noise = fbm(seed, x * 0.37 + alongKm * 0.014, y * 0.37 + crossKm * 0.014, 31);
  const fine = fbm(seed, x * 1.1, y * 1.1, 997);
  const fade = 1 - smoothstep(0.72, 1.0, rFrac);
  let rainAdd = 0;
  let cloudLowAdd = 0;
  let cloudHighAdd = 0;
  let pressureDeltaPa = 0;
  let windPerturbU = 0;
  let windPerturbV = 0;
  let lightningRate = 0;
  let hailRisk = 0;
  let tornadoTrackMask = 0;
  let terrainRainBoost = 0;
  if (type === 'hurricane') {
    const spin = point.latDeg >= 0 ? 1 : -1;
    const eyeFrac = clamp((event?.hurricane?.eyeRadiusKm || 24) / Math.max(1, descriptor.radiusKm), 0.025, 0.16);
    const eyewall = radialRing(rFrac, Math.max(eyeFrac * 2.4, 0.16), 0.045 + 0.035 * (1 - intensity));
    const outerBand = radialRing((rFrac + 0.055 * Math.sin(4.2 * Math.atan2(northKm, eastKm))), 0.48, 0.07);
    const spiral = Math.max(0, Math.sin(5.0 * Math.atan2(northKm, eastKm) + 10.5 * rFrac + noise * 2.1));
    const rainBand = Math.max(eyewall, outerBand * (0.35 + 0.65 * spiral));
    rainAdd = (0.45 + 8.5 * intensity) * rainBand;
    cloudLowAdd = 0.18 + 0.55 * rainBand;
    cloudHighAdd = 0.22 + 0.62 * Math.max(eyewall, outerBand);
    pressureDeltaPa = -1 * (event?.hurricane?.pressureDeficitPa || 1200 * intensity) * Math.exp(-rFrac * rFrac * 5.8);
    const tangential = (event?.hurricane?.windField?.maxWindMs || (18 + 36 * intensity)) * Math.max(0, Math.min(1, rainBand + 0.22 * outerBand));
    const radius = Math.max(1, Math.hypot(eastKm, northKm));
    windPerturbU = spin * (-northKm / radius) * tangential;
    windPerturbV = spin * (eastKm / radius) * tangential;
    lightningRate = intensity * rainBand * 0.18;
  } else if (type === 'tropical-disturbance') {
    const cluster = Math.exp(-(eastKm * eastKm + northKm * northKm) / Math.max(1, 2 * (120 + 140 * intensity) ** 2));
    const brokenBand = radialRing(rFrac + 0.06 * (noise - 0.5), 0.38 + 0.08 * fine, 0.18);
    const convection = Math.max(cluster, brokenBand * (0.28 + 0.42 * noise));
    rainAdd = (0.16 + 2.1 * intensity) * convection;
    cloudLowAdd = 0.10 + 0.34 * convection;
    cloudHighAdd = 0.12 + 0.40 * Math.max(cluster, brokenBand);
    pressureDeltaPa = -180 * intensity * cluster;
    const radius = Math.max(1, Math.hypot(eastKm, northKm));
    const inflow = 3.5 * intensity * convection;
    windPerturbU = -(eastKm / radius) * inflow;
    windPerturbV = -(northKm / radius) * inflow;
    lightningRate = intensity * convection * 0.06;
  } else if (type === 'supercell' || type === 'tornado-outbreak' || type === 'tornado-touchdown') {
    const severe = event?.severeWeather || {};
    const hook = lineBand(crossKm + descriptor.radiusKm * 0.12, 22 + 36 * intensity) * smoothstep(-0.35, 0.25, alongKm / descriptor.radiusKm);
    const anvil = lineBand(crossKm, 80 + 80 * intensity) * smoothstep(-0.42, 0.88, alongKm / descriptor.radiusKm);
    const core = Math.exp(-(eastKm * eastKm + northKm * northKm) / Math.max(1, 2 * (55 + 75 * intensity) ** 2));
    const squall = Math.max(hook, core, anvil * 0.45);
    rainAdd = (0.25 + 4.8 * intensity) * Math.max(core, hook * (0.7 + 0.5 * fine));
    cloudLowAdd = 0.22 + 0.58 * squall;
    cloudHighAdd = 0.34 + 0.62 * anvil;
    pressureDeltaPa = -260 * intensity * core;
    windPerturbU = descriptor.radiusKm > 0 ? -crossKm / descriptor.radiusKm * 9 * intensity * hook : 0;
    windPerturbV = descriptor.radiusKm > 0 ? alongKm / descriptor.radiusKm * 5 * intensity * hook : 0;
    lightningRate = (0.2 + 2.4 * intensity) * Math.max(core, hook);
    hailRisk = clamp01((severe.ingredients?.shear01 || 0.5) * (severe.ingredients?.capeProxy01 || 0.5) * Math.max(core, hook) * 1.35);
    for (const track of severe.touchdownTracks || []) {
      const dist = distanceToSegmentKm(point, track.start, track.end);
      const widthKm = Math.max(2.5, (track.maxWidthM || 160) / 1000, descriptor.radiusKm / Math.max(1, descriptor.gridSize * 0.85));
      tornadoTrackMask = Math.max(tornadoTrackMask, Math.exp(-(dist * dist) / Math.max(0.08, 2 * widthKm * widthKm)));
    }
  } else if (type === 'front' || type === 'extratropical-cyclone' || type === 'mcs' || type === 'blizzard' || type === 'atmospheric-river') {
    const band = lineBand(crossKm, 42 + 70 * intensity) * (0.72 + 0.56 * noise);
    const comma = radialRing(rFrac, 0.42, 0.16) * smoothstep(-0.45, 0.45, alongKm / descriptor.radiusKm);
    const precipShield = Math.max(band, comma);
    rainAdd = (0.12 + 2.4 * intensity) * precipShield;
    cloudLowAdd = 0.18 + 0.46 * precipShield;
    cloudHighAdd = 0.12 + 0.32 * Math.max(band, comma);
    pressureDeltaPa = -420 * intensity * Math.exp(-rFrac * rFrac * 3.2);
    windPerturbU = -crossKm / Math.max(1, descriptor.radiusKm) * 7 * intensity * band;
    windPerturbV = alongKm / Math.max(1, descriptor.radiusKm) * 3 * intensity * band;
  } else if (descriptor.source === 'focus') {
    const parentStorm = smoothstep(0.08, 0.7, parent.rainRateMmHr) + 0.35 * Math.max(parent.cloudLow, parent.cloudHigh);
    rainAdd = parent.rainRateMmHr * 0.34 * (noise - 0.48) * parentStorm;
    cloudLowAdd = 0.18 * (noise - 0.45) * parentStorm;
    cloudHighAdd = 0.14 * (fine - 0.45) * parentStorm;
    windPerturbU = (noise - 0.5) * 2.5 * parentStorm;
    windPerturbV = (fine - 0.5) * 2.5 * parentStorm;
  }
  terrainRainBoost = terrain.terrainLift01 * Math.max(0, parent.rainRateMmHr + rainAdd) * 0.22;
  return {
    detailWeight: fade,
    rainAdd: fade * (rainAdd + terrainRainBoost),
    cloudLowAdd: fade * cloudLowAdd,
    cloudHighAdd: fade * cloudHighAdd,
    pressureDeltaPa: fade * pressureDeltaPa,
    windPerturbU: fade * windPerturbU,
    windPerturbV: fade * windPerturbV,
    lightningRate: fade * lightningRate,
    hailRisk: fade * hailRisk,
    tornadoTrackMask: fade * tornadoTrackMask,
    terrainRainBoost: fade * terrainRainBoost
  };
};

const buildRegion = ({ descriptor, grid, fields, state, geo, seed, timeUTC }) => {
  const n = descriptor.gridSize;
  const count = n * n;
  const half = (n - 1) / 2;
  const spacingKm = (descriptor.radiusKm * 2) / Math.max(1, n - 1);
  const latDeg = new Float32Array(count);
  const lonDeg = new Float32Array(count);
  const detailWeight = new Float32Array(count);
  const parentRainRateMmHr = new Float32Array(count);
  const rainRateMmHr = new Float32Array(count);
  const cloudLow = new Float32Array(count);
  const cloudHigh = new Float32Array(count);
  const windU = new Float32Array(count);
  const windV = new Float32Array(count);
  const windSpeedMs = new Float32Array(count);
  const visibilityKm = new Float32Array(count);
  const pressurePa = new Float32Array(count);
  const lightningRate = new Float32Array(count);
  const hailRisk = new Float32Array(count);
  const tornadoTrackMask = new Float32Array(count);
  const terrainLift01 = new Float32Array(count);
  const basis = motionBasis(descriptor.event, descriptor.center);
  const timeBucket = Math.floor((timeUTC || 0) / 1800);
  const regionSeed = hashUint(`${seed}|${descriptor.id}|${timeBucket}`);
  let maxDetailWeight = 0;
  let maxRain = 0;
  let maxLightning = 0;
  let maxHail = 0;
  let maxTornado = 0;
  let maxParentRain = 0;
  let maxParentCloud = 0;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const p = y * n + x;
      const localEastKm = (x - half) * spacingKm;
      const localNorthKm = (y - half) * spacingKm;
      const eastKm = basis.eastUnit * localEastKm + basis.sideEast * localNorthKm;
      const northKm = basis.northUnit * localEastKm + basis.sideNorth * localNorthKm;
      const point = movePoint(descriptor.center, eastKm, northKm);
      latDeg[p] = point.latDeg;
      lonDeg[p] = point.lonDeg;
      const rKm = Math.hypot(localEastKm, localNorthKm);
      const rFrac = rKm / Math.max(1, descriptor.radiusKm);
      const parent = {
        uMs: sampleAtLatLon(fields?.u, grid, point.latDeg, point.lonDeg, 0),
        vMs: sampleAtLatLon(fields?.v, grid, point.latDeg, point.lonDeg, 0),
        rainRateMmHr: Math.max(0, sampleAtLatLon(fields?.precipRate, grid, point.latDeg, point.lonDeg, 0)),
        cloudLow: clamp01(sampleAtLatLon(fields?.cloudLow || fields?.cloud, grid, point.latDeg, point.lonDeg, 0)),
        cloudHigh: clamp01(sampleAtLatLon(fields?.cloudHigh || fields?.cloud, grid, point.latDeg, point.lonDeg, 0)),
        pressurePa: sampleAtLatLon(fields?.slp || fields?.ps, grid, point.latDeg, point.lonDeg, 101325)
      };
      const terrain = terrainSample({
        grid,
        geo,
        state,
        latDeg: point.latDeg,
        lonDeg: point.lonDeg,
        uMs: parent.uMs,
        vMs: parent.vMs
      });
      const pattern = computeEventPattern({
        descriptor,
        point,
        eastKm,
        northKm,
        rFrac,
        alongKm: localEastKm,
        crossKm: localNorthKm,
        parent,
        terrain,
        seed: regionSeed,
        x,
        y
      });
      const parentStormSupport = smoothstep(0.03, 0.65, parent.rainRateMmHr) + 0.4 * Math.max(parent.cloudLow, parent.cloudHigh);
      const noEventCap = descriptor.source === 'focus'
        ? parent.rainRateMmHr * (1.22 + 0.24 * parentStormSupport) + 0.03
        : Infinity;
      const eventRainCap = descriptor.source === 'event'
        ? Math.max(parent.rainRateMmHr + 0.15, parent.rainRateMmHr * 4.5 + 9 * descriptor.intensity)
        : noEventCap;
      const rain = clamp(parent.rainRateMmHr + pattern.rainAdd, 0, eventRainCap);
      const low = clamp01(parent.cloudLow + pattern.cloudLowAdd + smoothstep(0.15, 2.2, rain) * 0.22);
      const high = clamp01(parent.cloudHigh + pattern.cloudHighAdd + smoothstep(0.15, 2.2, rain) * 0.18);
      const u = parent.uMs + pattern.windPerturbU;
      const v = parent.vMs + pattern.windPerturbV;
      const speed = Math.hypot(u, v);
      parentRainRateMmHr[p] = parent.rainRateMmHr;
      rainRateMmHr[p] = rain;
      cloudLow[p] = low;
      cloudHigh[p] = high;
      windU[p] = u;
      windV[p] = v;
      windSpeedMs[p] = speed;
      pressurePa[p] = parent.pressurePa + pattern.pressureDeltaPa;
      lightningRate[p] = Math.max(0, pattern.lightningRate);
      hailRisk[p] = clamp01(pattern.hailRisk);
      tornadoTrackMask[p] = clamp01(pattern.tornadoTrackMask);
      terrainLift01[p] = clamp01(terrain.terrainLift01);
      detailWeight[p] = clamp01(pattern.detailWeight);
      visibilityKm[p] = clamp(28 - rain * 5.5 - low * 4.2 - hailRisk[p] * 6 - tornadoTrackMask[p] * 12, 0.15, 30);
      maxDetailWeight = Math.max(maxDetailWeight, detailWeight[p]);
      maxRain = Math.max(maxRain, rain);
      maxLightning = Math.max(maxLightning, lightningRate[p]);
      maxHail = Math.max(maxHail, hailRisk[p]);
      maxTornado = Math.max(maxTornado, tornadoTrackMask[p]);
      maxParentRain = Math.max(maxParentRain, parent.rainRateMmHr);
      maxParentCloud = Math.max(maxParentCloud, parent.cloudLow, parent.cloudHigh);
    }
  }
  return {
    schema: LOCAL_DOWNSCALE_REGION_SCHEMA,
    id: descriptor.id,
    source: descriptor.source,
    sourceKind: descriptor.sourceKind,
    eventType: descriptor.eventType,
    eventId: descriptor.eventId,
    center: {
      latDeg: Number(descriptor.center.latDeg.toFixed(3)),
      lonDeg: Number(descriptor.center.lonDeg.toFixed(3))
    },
    radiusKm: Number(descriptor.radiusKm.toFixed(1)),
    fadeRadiusKm: Number(descriptor.fadeRadiusKm.toFixed(1)),
    spacingKm: Number(spacingKm.toFixed(2)),
    grid: { nx: n, ny: n, count },
    parentEnvelope: {
      maxRainRateMmHr: Number(maxParentRain.toFixed(3)),
      maxCloudFrac: Number(maxParentCloud.toFixed(3))
    },
    constraints: {
      deterministicSeed: regionSeed,
      fadesToParentAtEdge: true,
      globalTruthConstrained: true,
      eventTruthConstrained: descriptor.source === 'event',
      maxRainRateMmHr: Number(maxRain.toFixed(3))
    },
    fields: {
      latDeg,
      lonDeg,
      detailWeight,
      parentRainRateMmHr,
      rainRateMmHr,
      cloudLow,
      cloudHigh,
      windU,
      windV,
      windSpeedMs,
      visibilityKm,
      pressurePa,
      lightningRate,
      hailRisk,
      tornadoTrackMask,
      terrainLift01
    },
    summary: {
      maxDetailWeight: Number(maxDetailWeight.toFixed(3)),
      maxRainRateMmHr: Number(maxRain.toFixed(3)),
      maxLightningRate: Number(maxLightning.toFixed(3)),
      maxHailRisk: Number(maxHail.toFixed(3)),
      maxTornadoTrackMask: Number(maxTornado.toFixed(3))
    },
    tornadoTracks: descriptor.event?.severeWeather?.touchdownTracks
      ? descriptor.event.severeWeather.touchdownTracks.map((track) => ({ ...track }))
      : []
  };
};

export function buildLocalDownscaleProduct({
  grid,
  fields,
  state = null,
  geo = null,
  eventProduct = null,
  focusRegions = [],
  seed = 0,
  timeUTC = 0,
  maxRegions = 8
} = {}) {
  const descriptors = [];
  for (const event of eventProduct?.activeEvents || []) {
    const descriptor = createRegionDescriptorFromEvent(event);
    if (descriptor) descriptors.push(descriptor);
  }
  for (let i = 0; i < focusRegions.length; i += 1) {
    const descriptor = createRegionDescriptorFromFocus(focusRegions[i], i);
    if (descriptor) descriptors.push(descriptor);
  }
  descriptors.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const regions = descriptors
    .slice(0, Math.max(0, maxRegions))
    .map((descriptor) => buildRegion({
      descriptor,
      grid,
      fields,
      state,
      geo,
      seed,
      timeUTC
    }));
  return {
    schema: LOCAL_DOWNSCALE_PRODUCT_SCHEMA,
    contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
    timeUTC: Number.isFinite(timeUTC) ? Number(timeUTC) : 0,
    seed: Number.isFinite(seed) ? Number(seed) : 0,
    regionCount: regions.length,
    regions,
    summary: {
      countsBySource: regions.reduce((acc, region) => {
        acc[region.source] = (acc[region.source] || 0) + 1;
        return acc;
      }, {}),
      countsByKind: regions.reduce((acc, region) => {
        acc[region.sourceKind] = (acc[region.sourceKind] || 0) + 1;
        return acc;
      }, {}),
      maxRainRateMmHr: regions.reduce((max, region) => Math.max(max, region.summary.maxRainRateMmHr || 0), 0),
      maxLightningRate: regions.reduce((max, region) => Math.max(max, region.summary.maxLightningRate || 0), 0),
      maxHailRisk: regions.reduce((max, region) => Math.max(max, region.summary.maxHailRisk || 0), 0),
      maxTornadoTrackMask: regions.reduce((max, region) => Math.max(max, region.summary.maxTornadoTrackMask || 0), 0)
    }
  };
}
