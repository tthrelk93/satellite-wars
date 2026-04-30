const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

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

const circularSeasonSupport = (dayOfYear, peakDay, halfWidthDays) => {
  const day = ((Number(dayOfYear) || 0) % 365 + 365) % 365;
  const peak = ((Number(peakDay) || 0) % 365 + 365) % 365;
  const delta = Math.abs(((day - peak + 182.5) % 365 + 365) % 365 - 182.5);
  return clamp01(1 - smoothstep(0.62, 1.18, delta / Math.max(1, halfWidthDays)));
};

const hashString = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

const deterministicUnit = (seed, salt) => {
  const hash = hashString(`${seed}|${salt}`);
  return (hash % 1000003) / 1000003;
};

const movePoint = ({ latDeg, lonDeg }, eastKm, northKm) => {
  const lat = Number(latDeg) || 0;
  const lon = Number(lonDeg) || 0;
  const nextLat = Math.max(-89.8, Math.min(89.8, lat + northKm / 111));
  const lonScale = Math.max(0.18, Math.cos((lat * Math.PI) / 180));
  const nextLon = normalizeLonDeg(lon + eastKm / (111 * lonScale));
  return {
    latDeg: Number(nextLat.toFixed(3)),
    lonDeg: Number(nextLon.toFixed(3))
  };
};

const vectorInfo = (motionVector = null, fallbackHemisphere = 1) => {
  const u = Number.isFinite(motionVector?.uMs) ? motionVector.uMs : 11;
  const v = Number.isFinite(motionVector?.vMs) ? motionVector.vMs : 2.5 * fallbackHemisphere;
  const speed = Math.max(1, Math.hypot(u, v));
  return {
    uMs: Number(u.toFixed(2)),
    vMs: Number(v.toFixed(2)),
    speedMs: Number(speed.toFixed(2)),
    eastUnit: u / speed,
    northUnit: v / speed
  };
};

const buildOrientedPolygon = ({ center, lengthKm, widthKm, motionVector, rearFrac = 0.32, frontFrac = 0.68 }) => {
  const vec = vectorInfo(motionVector, center?.latDeg >= 0 ? 1 : -1);
  const sideEast = -vec.northUnit;
  const sideNorth = vec.eastUnit;
  const rearKm = -lengthKm * rearFrac;
  const frontKm = lengthKm * frontFrac;
  const halfWidth = widthKm / 2;
  const points = [
    movePoint(center, vec.eastUnit * rearKm + sideEast * halfWidth, vec.northUnit * rearKm + sideNorth * halfWidth),
    movePoint(center, vec.eastUnit * frontKm + sideEast * halfWidth * 0.62, vec.northUnit * frontKm + sideNorth * halfWidth * 0.62),
    movePoint(center, vec.eastUnit * frontKm - sideEast * halfWidth * 0.62, vec.northUnit * frontKm - sideNorth * halfWidth * 0.62),
    movePoint(center, vec.eastUnit * rearKm - sideEast * halfWidth, vec.northUnit * rearKm - sideNorth * halfWidth)
  ];
  return points;
};

const touchdownScaleLabel = (score) => {
  if (score >= 0.86) return 'EF3+';
  if (score >= 0.70) return 'EF2';
  if (score >= 0.54) return 'EF1';
  return 'EF0';
};

export function computeSevereWeatherEnvironment({
  isLand = false,
  latDeg = 0,
  lonDeg = 0,
  dayOfYear = 0,
  surfaceTempK = 288,
  rhLow = 0,
  rhUpper = 0,
  shearMs = 0,
  convectiveOrganization = 0,
  convectivePrecipRate = 0,
  precipRate = 0,
  lowLevelConvergence = 0,
  omegaLower = 0,
  frontalSupport = 0,
  warmSectorSupport = 0,
  coldSectorSupport = 0,
  stormGenesis = 0,
  tornadoRiskDiag = 0,
  instabilityDiag = 0,
  shearDiag = 0,
  liftDiag = 0,
  stormModeDiag = 0,
  drylineMoistureGradient = 0
} = {}) {
  const lon = normalizeLonDeg(lonDeg);
  const absLat = Math.abs(latDeg);
  const plainsCore01 = latDeg >= 30 && latDeg <= 45 && lon >= -105 && lon <= -90 ? 1 : 0;
  const continentSevereBelt01 = smoothstep(22, 30, absLat) * (1 - smoothstep(52, 62, absLat));
  const warmSeason01 = circularSeasonSupport(dayOfYear, latDeg >= 0 ? 150 : 330, 92);
  const warmSurface01 = smoothstep(292, 304, surfaceTempK);
  const moisture01 = Math.max(
    smoothstep(0.56, 0.82, rhLow),
    smoothstep(0.46, 0.76, rhUpper)
  );
  const capeProxy01 = Math.max(
    clamp01(instabilityDiag),
    clamp01(warmSurface01 * (0.55 + 0.45 * moisture01)),
    smoothstep(0.015, 0.18, convectivePrecipRate) * Math.max(0.4, clamp01(convectiveOrganization))
  );
  const shear01 = Math.max(clamp01(shearDiag), smoothstep(12, 28, shearMs));
  const drylineSupport01 = clamp01(
    (isLand ? 1 : 0)
      * plainsCore01
      * warmSurface01
      * smoothstep(0.08, 0.32, drylineMoistureGradient)
  );
  const frontalSupport01 = Math.max(
    clamp01(frontalSupport),
    0.55 * clamp01(warmSectorSupport) + 0.45 * clamp01(coldSectorSupport)
  );
  const lift01 = Math.max(
    clamp01(liftDiag),
    frontalSupport01,
    drylineSupport01,
    smoothstep(0.000001, 0.000009, lowLevelConvergence),
    smoothstep(0.015, 0.13, -omegaLower),
    smoothstep(0.02, 0.20, convectivePrecipRate)
  );
  const stormMode01 = Math.max(
    clamp01(stormModeDiag),
    clamp01(stormGenesis),
    clamp01(convectiveOrganization) * (0.45 + 0.55 * shear01),
    frontalSupport01 * clamp01(convectiveOrganization),
    drylineSupport01 * (0.45 + 0.55 * shear01)
  );
  const forcingSupport01 = Math.max(frontalSupport01, drylineSupport01, lift01 * 0.72);
  const ingredientMin01 = Math.min(capeProxy01, shear01, moisture01, lift01, stormMode01);
  const ingredientProduct01 = Math.pow(
    Math.max(0, capeProxy01 * shear01 * moisture01 * lift01 * stormMode01),
    0.2
  );
  const rainOnlyPenalty01 = smoothstep(0.16, 0.8, precipRate) * (1 - shear01) * (1 - capeProxy01);
  const severeWeatherIndex01 = clamp01(
    (isLand ? 1 : 0)
      * continentSevereBelt01
      * warmSeason01
      * (0.45 * ingredientProduct01 + 0.25 * ingredientMin01 + 0.20 * forcingSupport01 + 0.10 * clamp01(tornadoRiskDiag))
      * (1 - 0.65 * rainOnlyPenalty01)
  );
  return {
    severeWeatherIndex01,
    capeProxy01: clamp01(capeProxy01),
    shear01: clamp01(shear01),
    moisture01: clamp01(moisture01),
    lift01: clamp01(lift01),
    stormMode01: clamp01(stormMode01),
    frontalSupport01: clamp01(frontalSupport01),
    drylineSupport01,
    forcingSupport01: clamp01(forcingSupport01),
    warmSeason01,
    warmSurface01,
    ingredientMin01: clamp01(ingredientMin01),
    ingredientProduct01: clamp01(ingredientProduct01),
    rainOnlyPenalty01: clamp01(rainOnlyPenalty01),
    plainsCore01,
    physicallyTornadic: Boolean(
      isLand
        && severeWeatherIndex01 >= 0.20
        && capeProxy01 >= 0.30
        && shear01 >= 0.34
        && moisture01 >= 0.34
        && lift01 >= 0.24
        && stormMode01 >= 0.28
        && forcingSupport01 >= 0.20
        && warmSeason01 >= 0.15
    )
  };
}

const classifyStormMode = (environment = {}) => {
  const dryline = environment.drylineSupport01 || 0;
  const front = environment.frontalSupport01 || 0;
  const shear = environment.shear01 || 0;
  const stormMode = environment.stormMode01 || 0;
  if (dryline >= 0.42 && shear >= 0.50 && stormMode >= 0.48) return 'discrete-dryline-supercell';
  if (front >= 0.55 && stormMode >= 0.46) return 'frontal-supercell-cluster';
  if (front >= 0.35 && shear >= 0.40) return 'qlcs-embedded-supercell';
  return 'isolated-supercell';
};

const buildTouchdownTracks = ({ eventId, center, motionVector, intensity01, environment, count, timeUTC }) => {
  const vec = vectorInfo(motionVector, center.latDeg >= 0 ? 1 : -1);
  const tracks = [];
  const baseWidthM = 55 + 620 * intensity01 * Math.max(0.35, environment.shear01 || 0.35);
  const baseLengthKm = 7 + 58 * intensity01 * Math.max(0.35, environment.stormMode01 || 0.35);
  for (let n = 0; n < count; n += 1) {
    const lateral = (deterministicUnit(eventId, `lat-${n}`) - 0.5) * 170;
    const along = (deterministicUnit(eventId, `along-${n}`) - 0.5) * 120;
    const sideEast = -vec.northUnit;
    const sideNorth = vec.eastUnit;
    const trackCenter = movePoint(
      center,
      vec.eastUnit * along + sideEast * lateral,
      vec.northUnit * along + sideNorth * lateral
    );
    const lengthKm = baseLengthKm * (0.72 + deterministicUnit(eventId, `len-${n}`) * 0.56);
    const widthM = baseWidthM * (0.55 + deterministicUnit(eventId, `wid-${n}`) * 0.80);
    const start = movePoint(trackCenter, vec.eastUnit * -lengthKm * 0.48, vec.northUnit * -lengthKm * 0.48);
    const end = movePoint(trackCenter, vec.eastUnit * lengthKm * 0.52, vec.northUnit * lengthKm * 0.52);
    const durationMinutes = 6 + Math.round(28 * intensity01 * (0.55 + deterministicUnit(eventId, `dur-${n}`)));
    const damageSwath = buildOrientedPolygon({
      center: trackCenter,
      lengthKm,
      widthKm: Math.max(0.18, widthM / 1000),
      motionVector,
      rearFrac: 0.50,
      frontFrac: 0.50
    });
    const efScore = clamp01(0.38 + intensity01 * 0.55 + (deterministicUnit(eventId, `ef-${n}`) - 0.5) * 0.12);
    tracks.push({
      id: `${eventId}:td-${n + 1}`,
      startTimeUTC: timeUTC + n * 420,
      endTimeUTC: timeUTC + n * 420 + durationMinutes * 60,
      start,
      end,
      lengthKm: Number(lengthKm.toFixed(1)),
      maxWidthM: Math.round(widthM),
      efScaleProxy: touchdownScaleLabel(efScore),
      intensity01: Number(clamp01(efScore).toFixed(3)),
      damageSwath
    });
  }
  return tracks;
};

export function buildSevereWeatherSystem(candidate, previousEvent = null) {
  const environment = candidate.environment || {};
  const center = {
    latDeg: Number(candidate.latDeg.toFixed(3)),
    lonDeg: Number(normalizeLonDeg(candidate.lonDeg).toFixed(3))
  };
  const eventId = previousEvent?.id || `${candidate.type}:${candidate.region || 'severe'}:${candidate.sourceIndex || 0}`;
  const intensity01 = clamp01(previousEvent?.intensity01 ?? candidate.intensity ?? candidate.score ?? environment.severeWeatherIndex01 ?? 0);
  const stormMode = classifyStormMode(environment);
  const vec = vectorInfo(candidate.motionVector, center.latDeg >= 0 ? 1 : -1);
  const touchdownCount = candidate.type === 'tornado-touchdown'
    ? 1
    : candidate.type === 'tornado-outbreak'
      ? Math.max(1, Math.min(7, Math.round(1 + intensity01 * 5 + (environment.drylineSupport01 || 0))))
      : intensity01 >= 0.58 && environment.physicallyTornadic ? 1 : 0;
  const touchdownTracks = buildTouchdownTracks({
    eventId,
    center,
    motionVector: candidate.motionVector,
    intensity01,
    environment,
    count: touchdownCount,
    timeUTC: candidate.timeUTC || previousEvent?.lastSeenTimeUTC || 0
  });
  const warningLengthKm = candidate.type === 'tornado-touchdown' ? 90 : 210 + 230 * intensity01;
  const warningWidthKm = candidate.type === 'tornado-touchdown' ? 42 : 95 + 120 * intensity01;
  const warningPolygon = buildOrientedPolygon({
    center,
    lengthKm: warningLengthKm,
    widthKm: warningWidthKm,
    motionVector: candidate.motionVector
  });
  const hookStrength01 = clamp01(
    0.34 * (environment.stormMode01 || 0)
      + 0.30 * (environment.shear01 || 0)
      + 0.22 * (environment.lift01 || 0)
      + 0.14 * intensity01
  );
  const coupletMs = 10 + 56 * intensity01 * Math.max(0.35, environment.shear01 || 0.35);
  return {
    schema: 'satellite-wars.severe-weather-system.v1',
    type: candidate.type,
    center,
    stormMode,
    environmentIndex01: Number((environment.severeWeatherIndex01 ?? intensity01).toFixed(3)),
    ingredients: {
      capeProxy01: Number((environment.capeProxy01 || 0).toFixed(3)),
      shear01: Number((environment.shear01 || 0).toFixed(3)),
      moisture01: Number((environment.moisture01 || 0).toFixed(3)),
      lift01: Number((environment.lift01 || 0).toFixed(3)),
      stormMode01: Number((environment.stormMode01 || 0).toFixed(3)),
      frontalSupport01: Number((environment.frontalSupport01 || 0).toFixed(3)),
      drylineSupport01: Number((environment.drylineSupport01 || 0).toFixed(3)),
      warmSeason01: Number((environment.warmSeason01 || 0).toFixed(3))
    },
    motionVector: {
      uMs: vec.uMs,
      vMs: vec.vMs,
      speedMs: vec.speedMs
    },
    radarSignature: {
      maxReflectivityDbz: Math.round(47 + 23 * intensity01),
      hookEcho: hookStrength01 >= 0.42,
      hookEchoStrength01: Number(hookStrength01.toFixed(3)),
      velocityCouplet: touchdownCount > 0 || hookStrength01 >= 0.52,
      gateToGateShearMs: Number(coupletMs.toFixed(1)),
      mesocycloneDiameterKm: Math.round(4 + 18 * (1 - intensity01) + 8 * hookStrength01),
      debrisSignatureLikely: touchdownCount > 0 && intensity01 >= 0.58
    },
    satelliteSignature: {
      anvilRadiusKm: Math.round(55 + 260 * intensity01),
      overshootingTop: intensity01 >= 0.42,
      enhancedV: intensity01 >= 0.58 && (environment.shear01 || 0) >= 0.45,
      coldestCloudTopK: Math.round(215 - 32 * intensity01),
      blowoffDirectionDeg: Math.round(((Math.atan2(vec.eastUnit, vec.northUnit) * 180) / Math.PI + 360) % 360)
    },
    warningPolygon,
    touchdownTracks,
    damageSwaths: touchdownTracks.map((track) => ({
      id: `${track.id}:swath`,
      polygon: track.damageSwath,
      maxWidthM: track.maxWidthM,
      efScaleProxy: track.efScaleProxy
    }))
  };
}
