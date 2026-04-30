import {
  WEATHER_EVENT_MATCH_RADIUS_KM,
  WEATHER_EVENT_MAX_ACTIVE_BY_TYPE,
  WEATHER_EVENT_TYPES,
  WEATHER_EVENT_TYPE_LIST
} from './eventTypes.js';
import { computeSevereWeatherEnvironment } from './severeWeatherSystems.js';

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const normalizeLonDeg = (lonDeg) => {
  let lon = Number.isFinite(lonDeg) ? lonDeg : 0;
  while (lon < -180) lon += 360;
  while (lon >= 180) lon -= 360;
  return lon;
};

export const dayOfYearFromSeconds = (timeUTC = 0) => {
  const day = Math.floor((Number(timeUTC) || 0) / 86400);
  return ((day % 365) + 365) % 365;
};

export const circularSeasonSupport = (dayOfYear, peakDay, halfWidthDays) => {
  const day = ((Number(dayOfYear) || 0) % 365 + 365) % 365;
  const peak = ((Number(peakDay) || 0) % 365 + 365) % 365;
  const delta = Math.abs(((day - peak + 182.5) % 365 + 365) % 365 - 182.5);
  return clamp01(1 - smoothstep(0.62, 1.18, delta / Math.max(1, halfWidthDays)));
};

export const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const lat1 = ((a.latDeg || 0) * Math.PI) / 180;
  const lat2 = ((b.latDeg || 0) * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = (normalizeLonDeg((b.lonDeg || 0) - (a.lonDeg || 0)) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
};

const sample = (field, index, fallback = 0) => (
  field && Number.isFinite(field[index]) ? field[index] : fallback
);

const sampleWrapped = (field, grid, i, j, di = 0, dj = 0, fallback = 0) => {
  if (!field || !grid?.nx || !grid?.ny) return fallback;
  const ii = ((i + di) % grid.nx + grid.nx) % grid.nx;
  const jj = Math.max(0, Math.min(grid.ny - 1, j + dj));
  return sample(field, jj * grid.nx + ii, fallback);
};

const cellMeta = (grid, index) => {
  const nx = grid?.nx || 1;
  const ny = grid?.ny || 1;
  const i = ((index % nx) + nx) % nx;
  const j = Math.max(0, Math.min(ny - 1, Math.floor(index / nx)));
  const latDeg = Number.isFinite(grid?.latDeg?.[j])
    ? grid.latDeg[j]
    : 90 - ((j + 0.5) * 180) / Math.max(1, ny);
  const lonDeg = Number.isFinite(grid?.lonDeg?.[i])
    ? grid.lonDeg[i]
    : -180 + ((i + 0.5) * 360) / Math.max(1, nx);
  return { i, j, latDeg, lonDeg: normalizeLonDeg(lonDeg) };
};

export const classifyTropicalCycloneBasin = ({ latDeg = 0, lonDeg = 0 } = {}) => {
  const lat = Number(latDeg) || 0;
  const lon = normalizeLonDeg(lonDeg);
  const absLat = Math.abs(lat);
  if (absLat < 4 || absLat > 35) return null;
  if (lat >= 0) {
    if (lon >= -100 && lon <= -10 && lat >= 5 && lat <= 35) return 'atlantic';
    if (lon >= -170 && lon < -100 && lat >= 5 && lat <= 32) return 'east-pacific';
    if ((lon >= 100 || lon < -170) && lat >= 4 && lat <= 32) return 'west-pacific';
    if (lon >= 40 && lon <= 100 && lat >= 5 && lat <= 30) return 'north-indian';
  } else {
    if (lon >= 35 && lon <= 115 && lat <= -5 && lat >= -35) return 'south-indian';
    if ((lon >= 115 || lon <= -80) && lat <= -5 && lat >= -35) return 'south-pacific';
  }
  return null;
};

export const tropicalCycloneSeasonSupport = ({ basin, latDeg = 0, dayOfYear = 0 } = {}) => {
  if (!basin) return 0;
  if (basin === 'atlantic') return circularSeasonSupport(dayOfYear, 252, 96);
  if (basin === 'east-pacific') return circularSeasonSupport(dayOfYear, 236, 105);
  if (basin === 'west-pacific') return Math.max(0.28, circularSeasonSupport(dayOfYear, 245, 135));
  if (basin === 'north-indian') {
    return Math.max(circularSeasonSupport(dayOfYear, 145, 52), circularSeasonSupport(dayOfYear, 305, 55));
  }
  if (latDeg < 0) return circularSeasonSupport(dayOfYear, 45, 92);
  return 0;
};

const classifyMonsoonRegion = ({ latDeg, lonDeg }) => {
  const lon = normalizeLonDeg(lonDeg);
  if (latDeg >= 5 && latDeg <= 30 && lon >= 65 && lon <= 105) return 'south-asian-monsoon';
  if (latDeg >= 2 && latDeg <= 22 && lon >= -20 && lon <= 35) return 'west-african-monsoon';
  if (latDeg >= 0 && latDeg <= 25 && lon >= 105 && lon <= 150) return 'maritime-continent-monsoon';
  if (latDeg >= 15 && latDeg <= 33 && lon >= -115 && lon <= -95) return 'north-american-monsoon';
  if (latDeg <= -5 && latDeg >= -28 && lon >= 110 && lon <= 155) return 'australian-monsoon';
  return null;
};

const monsoonSeasonSupport = (region, dayOfYear) => {
  if (region === 'south-asian-monsoon') return circularSeasonSupport(dayOfYear, 210, 82);
  if (region === 'west-african-monsoon') return circularSeasonSupport(dayOfYear, 220, 80);
  if (region === 'maritime-continent-monsoon') return Math.max(0.35, circularSeasonSupport(dayOfYear, 20, 100));
  if (region === 'north-american-monsoon') return circularSeasonSupport(dayOfYear, 205, 58);
  if (region === 'australian-monsoon') return circularSeasonSupport(dayOfYear, 35, 88);
  return 0;
};

const classifyDesertRegion = ({ latDeg, lonDeg }) => {
  const lon = normalizeLonDeg(lonDeg);
  if (latDeg >= 15 && latDeg <= 33 && lon >= -20 && lon <= 45) return 'sahara-sahel';
  if (latDeg >= 16 && latDeg <= 32 && lon >= 35 && lon <= 65) return 'arabian-desert';
  if (latDeg >= 24 && latDeg <= 40 && lon >= -125 && lon <= -100) return 'southwest-us';
  if (latDeg <= -15 && latDeg >= -34 && lon >= 115 && lon <= 145) return 'australian-outback';
  if (latDeg <= -15 && latDeg >= -30 && lon >= -78 && lon <= -65) return 'atacama';
  return null;
};

const isGreatPlains = ({ latDeg, lonDeg }) => (
  latDeg >= 30 && latDeg <= 45 && normalizeLonDeg(lonDeg) >= -105 && normalizeLonDeg(lonDeg) <= -90
);

const westCoastMoistureCorridor = ({ latDeg, lonDeg }) => {
  const lon = normalizeLonDeg(lonDeg);
  const absLat = Math.abs(latDeg);
  if (absLat < 25 || absLat > 60) return null;
  if (latDeg > 0 && lon >= -170 && lon <= -115) return 'north-pacific-atmospheric-river';
  if (latDeg < 0 && lon >= -95 && lon <= -70) return 'south-pacific-atmospheric-river';
  if (latDeg > 0 && lon >= -45 && lon <= 10) return 'north-atlantic-atmospheric-river';
  return null;
};

const makeCandidate = ({
  type,
  index,
  grid,
  score,
  intensity = score,
  timeUTC,
  basin = null,
  region = null,
  radiusKm,
  environment = {},
  motionVector = null,
  physicalValidity = true
}) => {
  const meta = cellMeta(grid, index);
  return {
    type,
    sourceIndex: index,
    timeUTC,
    i: meta.i,
    j: meta.j,
    latDeg: meta.latDeg,
    lonDeg: meta.lonDeg,
    basin,
    region,
    score: Number(clamp01(score).toFixed(5)),
    intensity: Number(clamp01(intensity).toFixed(5)),
    radiusKm: Math.round(radiusKm),
    motionVector,
    environment: {
      ...environment,
      physicalValidity: Boolean(physicalValidity)
    }
  };
};

const selectTopSpatialCandidates = (items, type) => {
  const limit = WEATHER_EVENT_MAX_ACTIVE_BY_TYPE[type] || 6;
  const minDistanceKm = Math.max(180, (WEATHER_EVENT_MATCH_RADIUS_KM[type] || 700) * 0.55);
  const selected = [];
  const sorted = [...items].sort((a, b) => b.score - a.score);
  for (const item of sorted) {
    if (selected.length >= limit) break;
    if (selected.every((other) => haversineKm(item, other) >= minDistanceKm)) {
      selected.push(item);
    }
  }
  return selected;
};

export function detectWeatherEventCandidates({
  grid,
  fields = {},
  state = {},
  timeUTC = 0
} = {}) {
  const nx = grid?.nx || 0;
  const ny = grid?.ny || 0;
  const count = grid?.count || nx * ny;
  if (!nx || !ny || !count) {
    return {
      timeUTC,
      dayOfYear: dayOfYearFromSeconds(timeUTC),
      candidates: [],
      rejected: { missingGrid: 1 }
    };
  }

  const dayOfYear = dayOfYearFromSeconds(timeUTC);
  const buckets = Object.fromEntries(WEATHER_EVENT_TYPE_LIST.map((type) => [type, []]));
  const rejected = {
    tropicalColdOrDry: 0,
    tropicalWrongSurface: 0,
    tornadoWrongSeasonOrRegion: 0,
    tornadoMissingIngredients: 0,
    genericRainRejected: 0,
    midlatitudeOutOfBelt: 0,
    absurdPlacement: 0
  };
  const lowLevelWindU = fields.u || state.u || null;
  const lowLevelWindV = fields.v || state.v || null;
  const upperWindU = fields.uU || null;
  const upperWindV = fields.vU || null;
  const precip = fields.precipRate || state.precipRate || null;
  const convectivePrecip = state.precipConvectiveRate || null;
  const sst = state.sstNow || fields.sstNow || null;
  const seaIce = state.seaIceFrac || fields.seaIceFrac || null;
  const landMask = state.landMask || fields.landMask || null;
  const surfaceTemp = state.Ts || fields.Ts || null;
  const rhLow = fields.RH || null;
  const rhUpper = fields.RHU || null;
  const vort = fields.vort || null;
  const omegaLower = fields.omegaL || null;
  const omegaUpper = fields.omegaU || null;
  const tauLow = fields.tauLow || null;
  const tauHigh = fields.tauHigh || null;

  for (let k = 0; k < count; k += 1) {
    const meta = cellMeta(grid, k);
    const { latDeg, lonDeg } = meta;
    const absLat = Math.abs(latDeg);
    const isLand = sample(landMask, k, 0) === 1;
    const windU = sample(lowLevelWindU, k);
    const windV = sample(lowLevelWindV, k);
    const windMs = Math.hypot(windU, windV);
    const upperU = sample(upperWindU, k, windU);
    const upperV = sample(upperWindV, k, windV);
    const shearMs = Math.hypot(upperU - windU, upperV - windV);
    const precipRate = Math.max(0, sample(precip, k));
    const convectiveRate = Math.max(0, sample(convectivePrecip, k));
    const sstK = sample(sst, k, sample(surfaceTemp, k, 288));
    const tsK = sample(surfaceTemp, k, sstK);
    const seaIceFrac = clamp01(sample(seaIce, k));
    const humidity01 = Math.max(
      clamp01(sample(state.tropicalCycloneHumiditySupportDiag, k)),
      smoothstep(0.52, 0.92, sample(rhLow, k, 0.55)),
      smoothstep(0.42, 0.80, sample(rhUpper, k, 0.45))
    );
    const shearSupport01 = Math.max(
      clamp01(sample(state.tropicalCycloneShearSupportDiag, k)),
      1 - smoothstep(10, 25, shearMs)
    );
    const convection01 = Math.max(
      clamp01(sample(state.convectiveOrganization, k)),
      smoothstep(0.04, 0.28, precipRate),
      smoothstep(0.015, 0.16, convectiveRate),
      smoothstep(0.0004, 0.018, sample(state.convectiveMassFlux, k))
    );
    const vorticity01 = Math.max(
      clamp01(sample(state.tropicalCycloneVorticitySupportDiag, k)),
      smoothstep(1e-6, 9e-6, Math.max(0, (latDeg >= 0 ? 1 : -1) * sample(vort, k)))
    );

    const midlatitudeBelt = smoothstep(28, 36, absLat) * (1 - smoothstep(62, 70, absLat));
    const stormGenesis = clamp01(sample(state.stormGenesisPotentialDiag, k));
    const stormDeepening = clamp01(sample(state.stormDeepeningPotentialDiag, k));
    const frontalSupport = Math.max(
      clamp01(sample(state.frontalAscentSupportDiag, k)),
      0.55 * stormGenesis + 0.45 * stormDeepening
    );
    const stormShield = Math.max(
      clamp01(sample(state.stormPrecipShieldDiag, k)),
      smoothstep(0.08, 0.45, precipRate),
      smoothstep(2.5, 14, sample(tauLow, k) + sample(tauHigh, k))
    );
    if (midlatitudeBelt > 0.05) {
      const cycloneScore = clamp01(midlatitudeBelt * (0.44 * stormGenesis + 0.34 * stormDeepening + 0.12 * stormShield + 0.10 * smoothstep(8, 32, windMs)));
      if (cycloneScore >= 0.13) {
        buckets[WEATHER_EVENT_TYPES.EXTRATROPICAL_CYCLONE].push(makeCandidate({
          type: WEATHER_EVENT_TYPES.EXTRATROPICAL_CYCLONE,
          index: k,
          grid,
          timeUTC,
          score: cycloneScore,
          intensity: Math.max(cycloneScore, stormDeepening),
          radiusKm: 850 + 450 * stormShield,
          region: latDeg >= 0 ? 'north-midlatitude-storm-track' : 'south-midlatitude-storm-track',
          motionVector: { uMs: windU, vMs: windV },
          environment: {
            midlatitudeBelt01: Number(midlatitudeBelt.toFixed(3)),
            stormGenesis01: stormGenesis,
            deepening01: stormDeepening,
            precipShield01: stormShield,
            windMs: Number(windMs.toFixed(2))
          }
        }));
      }
      const frontScore = clamp01(midlatitudeBelt * (0.55 * frontalSupport + 0.20 * stormShield + 0.15 * Math.max(clamp01(sample(state.stormWarmSectorDiag, k)), clamp01(sample(state.stormColdSectorDiag, k))) + 0.10 * smoothstep(6, 24, windMs)));
      if (frontScore >= 0.12) {
        buckets[WEATHER_EVENT_TYPES.FRONT].push(makeCandidate({
          type: WEATHER_EVENT_TYPES.FRONT,
          index: k,
          grid,
          timeUTC,
          score: frontScore,
          intensity: Math.max(frontScore, frontalSupport),
          radiusKm: 700 + 500 * frontScore,
          region: latDeg >= 0 ? 'north-frontal-zone' : 'south-frontal-zone',
          motionVector: { uMs: windU, vMs: windV },
          environment: {
            frontalSupport01: Number(frontalSupport.toFixed(3)),
            warmSector01: Number(clamp01(sample(state.stormWarmSectorDiag, k)).toFixed(3)),
            coldSector01: Number(clamp01(sample(state.stormColdSectorDiag, k)).toFixed(3)),
            precipShield01: Number(stormShield.toFixed(3))
          }
        }));
      }
    } else if (stormGenesis > 0.25 || stormDeepening > 0.25) {
      rejected.midlatitudeOutOfBelt += 1;
    }

    const basin = classifyTropicalCycloneBasin({ latDeg, lonDeg });
    if (basin) {
      const basinSeasonSupport01 = Math.max(
        clamp01(sample(state.tropicalCycloneBasinSeasonSupportDiag, k)),
        tropicalCycloneSeasonSupport({ basin, latDeg, dayOfYear })
      );
      const warmOcean01 = smoothstep(299.15, 301.35, sstK);
      const tcDiag = Math.max(
        clamp01(sample(state.tropicalCycloneGenesisPotentialDiag, k)),
        0.85 * clamp01(sample(state.tropicalCycloneEmbeddedVortexDiag, k))
      );
      const tcEnvironmentScore = clamp01(
        warmOcean01
          * humidity01
          * Math.max(0.18, shearSupport01)
          * Math.max(0.18, vorticity01)
          * Math.max(0.12, convection01)
          * Math.max(0.08, basinSeasonSupport01)
      );
      const tcScore = clamp01(0.52 * tcDiag + 0.48 * Math.sqrt(tcEnvironmentScore));
      const physicallyValid = !isLand
        && seaIceFrac < 0.08
        && sstK >= 299.15
        && humidity01 >= 0.18
        && shearSupport01 >= 0.08
        && basinSeasonSupport01 >= 0.05
        && convection01 >= 0.04;
      if (!physicallyValid) {
        if (isLand || seaIceFrac >= 0.08) rejected.tropicalWrongSurface += 1;
        else rejected.tropicalColdOrDry += 1;
      } else if (tcScore >= 0.17) {
        const common = {
          index: k,
          grid,
          timeUTC,
          basin,
          region: basin,
          motionVector: { uMs: windU, vMs: windV },
          environment: {
            sstK: Number(sstK.toFixed(2)),
            seaIceFrac: Number(seaIceFrac.toFixed(3)),
            humidity01: Number(humidity01.toFixed(3)),
            shearMs: Number(shearMs.toFixed(2)),
            shearSupport01: Number(shearSupport01.toFixed(3)),
            vorticity01: Number(vorticity01.toFixed(3)),
            convection01: Number(convection01.toFixed(3)),
            basinSeasonSupport01: Number(basinSeasonSupport01.toFixed(3)),
            genesisPotential01: Number(tcDiag.toFixed(3)),
            embeddedVortex01: Number(clamp01(sample(state.tropicalCycloneEmbeddedVortexDiag, k)).toFixed(3))
          }
        };
        const hurricaneReady = tcScore >= 0.46
          && basinSeasonSupport01 >= 0.22
          && warmOcean01 >= 0.24
          && humidity01 >= 0.35
          && shearSupport01 >= 0.18
          && convection01 >= 0.14;
        if (hurricaneReady) {
          buckets[WEATHER_EVENT_TYPES.HURRICANE].push(makeCandidate({
            ...common,
            type: WEATHER_EVENT_TYPES.HURRICANE,
            score: tcScore,
            intensity: Math.max(tcScore, clamp01(sample(state.tropicalCycloneEmbeddedVortexDiag, k))),
            radiusKm: 220 + 360 * tcScore
          }));
        } else {
          buckets[WEATHER_EVENT_TYPES.TROPICAL_DISTURBANCE].push(makeCandidate({
            ...common,
            type: WEATHER_EVENT_TYPES.TROPICAL_DISTURBANCE,
            score: tcScore,
            intensity: Math.max(0.15, tcScore * 0.82),
            radiusKm: 180 + 260 * tcScore
          }));
        }
      }
    }

    const rhWest = sampleWrapped(rhLow, grid, meta.i, meta.j, -1, 0, sample(rhLow, k, 0.45));
    const rhEast = sampleWrapped(rhLow, grid, meta.i, meta.j, 1, 0, sample(rhLow, k, 0.45));
    const drylineMoistureGradient = Math.max(0, rhEast - rhWest);
    const severeEnvironment = computeSevereWeatherEnvironment({
      isLand,
      latDeg,
      lonDeg,
      dayOfYear,
      surfaceTempK: tsK,
      rhLow: sample(rhLow, k, 0.45),
      rhUpper: sample(rhUpper, k, 0.38),
      shearMs,
      convectiveOrganization: sample(state.convectiveOrganization, k),
      convectivePrecipRate: convectiveRate,
      precipRate,
      lowLevelConvergence: sample(state.lowLevelMoistureConvergence, k),
      omegaLower: sample(omegaLower, k),
      frontalSupport,
      warmSectorSupport: clamp01(sample(state.stormWarmSectorDiag, k)),
      coldSectorSupport: clamp01(sample(state.stormColdSectorDiag, k)),
      stormGenesis,
      tornadoRiskDiag: clamp01(sample(state.tornadoRiskPotentialDiag, k)),
      instabilityDiag: clamp01(sample(state.tornadoInstabilitySupportDiag, k)),
      shearDiag: clamp01(sample(state.tornadoShearSupportDiag, k)),
      liftDiag: clamp01(sample(state.tornadoLiftSupportDiag, k)),
      stormModeDiag: clamp01(sample(state.tornadoStormModeSupportDiag, k)),
      drylineMoistureGradient
    });
    const tornadoWarmSeason01 = severeEnvironment.warmSeason01;
    const tornadoRisk01 = severeEnvironment.severeWeatherIndex01;
    const plains = isGreatPlains({ latDeg, lonDeg });
    const tornadicIngredientsOk = severeEnvironment.physicallyTornadic
      && severeEnvironment.ingredientMin01 >= 0.24
      && severeEnvironment.rainOnlyPenalty01 < 0.42;
    if (isLand && plains && tornadoWarmSeason01 >= 0.12 && tornadoRisk01 >= 0.18 && tornadicIngredientsOk) {
      buckets[WEATHER_EVENT_TYPES.TORNADO_OUTBREAK].push(makeCandidate({
        type: WEATHER_EVENT_TYPES.TORNADO_OUTBREAK,
        index: k,
        grid,
        timeUTC,
        score: clamp01(tornadoRisk01 * (0.72 + 0.28 * Math.max(severeEnvironment.frontalSupport01, severeEnvironment.drylineSupport01))),
        intensity: Math.max(tornadoRisk01, convection01),
        radiusKm: 320 + 240 * tornadoRisk01,
        region: 'great-plains',
        motionVector: { uMs: windU, vMs: windV },
        environment: {
          ...Object.fromEntries(Object.entries(severeEnvironment).map(([key, value]) => [
            key,
            Number.isFinite(value) ? Number(value.toFixed(3)) : value
          ])),
          shearMs: Number(shearMs.toFixed(2)),
          precipRateMmHr: Number(precipRate.toFixed(3)),
          drylineMoistureGradient: Number(drylineMoistureGradient.toFixed(3))
        }
      }));
      if (
        tornadoRisk01 >= 0.42
        && severeEnvironment.capeProxy01 >= 0.48
        && severeEnvironment.shear01 >= 0.48
        && severeEnvironment.lift01 >= 0.38
        && severeEnvironment.stormMode01 >= 0.42
      ) {
        buckets[WEATHER_EVENT_TYPES.TORNADO_TOUCHDOWN].push(makeCandidate({
          type: WEATHER_EVENT_TYPES.TORNADO_TOUCHDOWN,
          index: k,
          grid,
          timeUTC,
          score: clamp01(tornadoRisk01 * 0.92 + severeEnvironment.ingredientMin01 * 0.08),
          intensity: Math.max(tornadoRisk01, severeEnvironment.ingredientProduct01),
          radiusKm: 18 + 42 * tornadoRisk01,
          region: 'great-plains-touchdown',
          motionVector: { uMs: windU, vMs: windV },
          environment: {
            ...Object.fromEntries(Object.entries(severeEnvironment).map(([key, value]) => [
              key,
              Number.isFinite(value) ? Number(value.toFixed(3)) : value
            ])),
            parentOutbreak: true,
            shearMs: Number(shearMs.toFixed(2)),
            drylineMoistureGradient: Number(drylineMoistureGradient.toFixed(3))
          }
        }));
      }
    } else if (tornadoRisk01 > 0.25 && plains) {
      if (tornadoWarmSeason01 < 0.12) rejected.tornadoWrongSeasonOrRegion += 1;
      else rejected.tornadoMissingIngredients += 1;
    } else if (precipRate > 0.18 && isLand && severeEnvironment.rainOnlyPenalty01 >= 0.35) {
      rejected.genericRainRejected += 1;
    }

    const supercellScore = clamp01(
      tornadoRisk01
        * Math.max(0.35, severeEnvironment.forcingSupport01)
        * (severeEnvironment.ingredientMin01 >= 0.20 ? 1 : 0)
    );
    if (supercellScore >= 0.15) {
      buckets[WEATHER_EVENT_TYPES.SUPERCELL].push(makeCandidate({
        type: WEATHER_EVENT_TYPES.SUPERCELL,
        index: k,
        grid,
        timeUTC,
        score: supercellScore,
        intensity: Math.max(supercellScore, tornadoRisk01),
        radiusKm: 120 + 180 * supercellScore,
        region: plains ? 'great-plains' : 'continental-warm-sector',
        motionVector: { uMs: windU, vMs: windV },
        environment: {
          ...Object.fromEntries(Object.entries(severeEnvironment).map(([key, value]) => [
            key,
            Number.isFinite(value) ? Number(value.toFixed(3)) : value
          ])),
          shearMs: Number(shearMs.toFixed(2)),
          precipRateMmHr: Number(precipRate.toFixed(3)),
          drylineMoistureGradient: Number(drylineMoistureGradient.toFixed(3))
        }
      }));
    }

    const mcsSeason01 = absLat < 18 ? 0.75 : circularSeasonSupport(dayOfYear, latDeg >= 0 ? 195 : 20, 105);
    const mcsScore = clamp01((0.42 * convection01 + 0.28 * smoothstep(0.12, 0.8, precipRate) + 0.18 * humidity01 + 0.12 * Math.max(stormGenesis, frontalSupport)) * mcsSeason01 * (1 - smoothstep(48, 62, absLat)));
    if (mcsScore >= 0.22) {
      buckets[WEATHER_EVENT_TYPES.MCS].push(makeCandidate({
        type: WEATHER_EVENT_TYPES.MCS,
        index: k,
        grid,
        timeUTC,
        score: mcsScore,
        intensity: Math.max(mcsScore, convection01),
        radiusKm: 260 + 420 * mcsScore,
        region: absLat < 18 ? 'tropical-convective-cluster' : 'warm-season-midlatitude-mcs',
        motionVector: { uMs: windU, vMs: windV },
        environment: {
          convection01: Number(convection01.toFixed(3)),
          precipRateMmHr: Number(precipRate.toFixed(3)),
          humidity01: Number(humidity01.toFixed(3)),
          season01: Number(mcsSeason01.toFixed(3))
        }
      }));
    }

    const monsoonRegion = classifyMonsoonRegion({ latDeg, lonDeg });
    if (monsoonRegion) {
      const monsoonSeason01 = monsoonSeasonSupport(monsoonRegion, dayOfYear);
      const monsoonScore = clamp01(monsoonSeason01 * (0.40 * convection01 + 0.25 * humidity01 + 0.20 * smoothstep(0.08, 0.8, precipRate) + 0.15 * smoothstep(0.000001, 0.000009, sample(state.lowLevelMoistureConvergence, k))));
      if (monsoonScore >= 0.20) {
        buckets[WEATHER_EVENT_TYPES.MONSOON_BURST].push(makeCandidate({
          type: WEATHER_EVENT_TYPES.MONSOON_BURST,
          index: k,
          grid,
          timeUTC,
          score: monsoonScore,
          intensity: Math.max(monsoonScore, convection01),
          radiusKm: 520 + 520 * monsoonScore,
          region: monsoonRegion,
          motionVector: { uMs: windU, vMs: windV },
          environment: {
            monsoonSeason01: Number(monsoonSeason01.toFixed(3)),
            convection01: Number(convection01.toFixed(3)),
            precipRateMmHr: Number(precipRate.toFixed(3)),
            humidity01: Number(humidity01.toFixed(3))
          }
        }));
      }
    }

    const desertRegion = classifyDesertRegion({ latDeg, lonDeg });
    if (desertRegion && isLand) {
      const rhMean = 0.65 * sample(rhLow, k, 0.35) + 0.35 * sample(rhUpper, k, 0.30);
      const dryness01 = 1 - smoothstep(0.28, 0.62, rhMean);
      const hot01 = smoothstep(296, 311, tsK);
      const windDust01 = smoothstep(7, 18, windMs);
      const noRain01 = 1 - smoothstep(0.006, 0.08, precipRate);
      const dustScore = clamp01(dryness01 * (0.34 * hot01 + 0.44 * windDust01 + 0.22 * noRain01));
      if (dustScore >= 0.18) {
        buckets[WEATHER_EVENT_TYPES.DUST_EVENT].push(makeCandidate({
          type: WEATHER_EVENT_TYPES.DUST_EVENT,
          index: k,
          grid,
          timeUTC,
          score: dustScore,
          intensity: Math.max(dustScore, windDust01),
          radiusKm: 300 + 420 * dustScore,
          region: desertRegion,
          motionVector: { uMs: windU, vMs: windV },
          environment: {
            dryness01: Number(dryness01.toFixed(3)),
            windMs: Number(windMs.toFixed(2)),
            surfaceTempK: Number(tsK.toFixed(2)),
            precipRateMmHr: Number(precipRate.toFixed(4))
          }
        }));
      }
    }

    const cold01 = 1 - smoothstep(267, 276, tsK);
    const blizzardScore = clamp01(
      smoothstep(35, 55, absLat)
        * cold01
        * smoothstep(0.04, 0.5, precipRate)
        * smoothstep(8, 24, windMs)
        * (isLand || seaIceFrac > 0.15 ? 1 : 0.35)
    );
    if (blizzardScore >= 0.20) {
      buckets[WEATHER_EVENT_TYPES.BLIZZARD].push(makeCandidate({
        type: WEATHER_EVENT_TYPES.BLIZZARD,
        index: k,
        grid,
        timeUTC,
        score: blizzardScore,
        intensity: Math.max(blizzardScore, smoothstep(14, 30, windMs)),
        radiusKm: 360 + 440 * blizzardScore,
        region: latDeg >= 0 ? 'northern-cold-sector' : 'southern-cold-sector',
        motionVector: { uMs: windU, vMs: windV },
        environment: {
          cold01: Number(cold01.toFixed(3)),
          precipRateMmHr: Number(precipRate.toFixed(3)),
          windMs: Number(windMs.toFixed(2)),
          seaIceFrac: Number(seaIceFrac.toFixed(3))
        }
      }));
    }

    const arRegion = westCoastMoistureCorridor({ latDeg, lonDeg });
    if (arRegion && !isLand) {
      const moisture01 = Math.max(humidity01, smoothstep(0.48, 0.90, sample(rhLow, k, 0.55)));
      const ascent01 = smoothstep(0.03, 0.22, -Math.min(sample(omegaLower, k), sample(omegaUpper, k)));
      const vaporFlux01 = smoothstep(5.5, 22, windMs * moisture01);
      const arScore = clamp01(vaporFlux01 * (0.48 * moisture01 + 0.22 * ascent01 + 0.18 * smoothstep(0.03, 0.35, precipRate) + 0.12 * smoothstep(30, 55, absLat)));
      if (arScore >= 0.19) {
        buckets[WEATHER_EVENT_TYPES.ATMOSPHERIC_RIVER].push(makeCandidate({
          type: WEATHER_EVENT_TYPES.ATMOSPHERIC_RIVER,
          index: k,
          grid,
          timeUTC,
          score: arScore,
          intensity: Math.max(arScore, vaporFlux01),
          radiusKm: 700 + 650 * arScore,
          region: arRegion,
          motionVector: { uMs: windU, vMs: windV },
          environment: {
            moisture01: Number(moisture01.toFixed(3)),
            vaporFlux01: Number(vaporFlux01.toFixed(3)),
            ascent01: Number(ascent01.toFixed(3)),
            windMs: Number(windMs.toFixed(2))
          }
        }));
      }
    }

    if (absLat > 80 && (stormGenesis > 0.2 || tornadoRisk01 > 0.2 || convection01 > 0.5)) {
      rejected.absurdPlacement += 1;
    }
  }

  const candidates = WEATHER_EVENT_TYPE_LIST.flatMap((type) => selectTopSpatialCandidates(buckets[type], type))
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));

  return {
    timeUTC,
    dayOfYear,
    candidates,
    rejected,
    countsByType: Object.fromEntries(WEATHER_EVENT_TYPE_LIST.map((type) => [type, candidates.filter((c) => c.type === type).length]))
  };
}
