import { WEATHER_EVENT_TYPES } from './eventTypes.js';

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

const normalizeLonDeg = (lonDeg) => {
  let lon = Number.isFinite(lonDeg) ? lonDeg : 0;
  while (lon < -180) lon += 360;
  while (lon >= 180) lon -= 360;
  return lon;
};

const categoryFromWindMs = (windMs) => {
  if (!(windMs >= 33)) return 'tropical-storm';
  if (windMs >= 70) return 'category-5';
  if (windMs >= 58) return 'category-4';
  if (windMs >= 50) return 'category-3';
  if (windMs >= 43) return 'category-2';
  return 'category-1';
};

const bearingDeg = (from, to) => {
  if (!from || !to) return null;
  const lat1 = (from.latDeg * Math.PI) / 180;
  const lat2 = (to.latDeg * Math.PI) / 180;
  const dLon = ((normalizeLonDeg(to.lonDeg - from.lonDeg)) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  return (angle + 360) % 360;
};

const distanceKm = (a, b) => {
  if (!a || !b) return 0;
  const lat1 = (a.latDeg * Math.PI) / 180;
  const lat2 = (b.latDeg * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = (normalizeLonDeg(b.lonDeg - a.lonDeg) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
};

export function buildHurricaneSystem(candidate, previousEvent = null) {
  const environment = candidate?.environment || {};
  const intensity = clamp01(candidate?.intensity ?? candidate?.score ?? 0);
  const embedded = clamp01(environment.embeddedVortex01);
  const organization = clamp01(environment.convection01);
  const humidity = clamp01(environment.humidity01);
  const shearSupport = clamp01(environment.shearSupport01);
  const basinSeason = clamp01(environment.basinSeasonSupport01);
  const structure01 = clamp01(0.32 * intensity + 0.2 * embedded + 0.18 * organization + 0.16 * humidity + 0.14 * shearSupport);
  const warmCore01 = clamp01((environment.sstK - 299.15) / 4.5);
  const hurricane01 = clamp01(0.64 * structure01 + 0.22 * warmCore01 + 0.14 * basinSeason);

  const maxWindMs = lerp(18, 74, hurricane01);
  const category = categoryFromWindMs(maxWindMs);
  const pressureProxyHpa = Math.round(lerp(1008, 910, hurricane01));
  const radiusKm = Math.round(lerp(180, 520, Math.max(structure01, organization)));
  const radiusMaxWindKm = Math.round(lerp(75, 24, hurricane01));
  const rainShieldRadiusKm = Math.round(lerp(radiusKm * 1.15, radiusKm * 1.85, humidity));
  const eyeRadiusKm = maxWindMs >= 33 ? Math.round(lerp(44, 14, hurricane01)) : null;
  const motion = candidate?.motionVector || { uMs: 0, vMs: 0 };
  const speedKmH = Math.min(55, Math.max(4, Math.hypot(motion.uMs || 0, motion.vMs || 0) * 3.6));
  const priorTrack = Array.isArray(previousEvent?.track) ? previousEvent.track : [];
  const track = [
    ...priorTrack.slice(-23),
    {
      timeUTC: candidate.timeUTC,
      latDeg: Number(candidate.latDeg.toFixed(3)),
      lonDeg: Number(normalizeLonDeg(candidate.lonDeg).toFixed(3)),
      intensity01: Number(hurricane01.toFixed(3)),
      maxWindMs: Number(maxWindMs.toFixed(2)),
      pressureProxyHpa
    }
  ];
  const previousPoint = track.length >= 2 ? track[track.length - 2] : null;
  const latestPoint = track[track.length - 1];
  const trackHeadingDeg = bearingDeg(previousPoint, latestPoint);
  const trackSpeedKmH = previousPoint
    ? Math.min(70, Math.max(2, distanceKm(previousPoint, latestPoint) / Math.max(1, (latestPoint.timeUTC - previousPoint.timeUTC) / 3600)))
    : speedKmH;

  return {
    schema: 'satellite-wars.weather-events.hurricane-system.v1',
    type: WEATHER_EVENT_TYPES.HURRICANE,
    center: {
      latDeg: latestPoint.latDeg,
      lonDeg: latestPoint.lonDeg
    },
    basin: candidate.basin || null,
    intensity01: Number(hurricane01.toFixed(3)),
    radiusKm,
    pressureProxyHpa,
    maxWindMs: Number(maxWindMs.toFixed(2)),
    category,
    eyeRadiusKm,
    eyewallRadiusKm: radiusMaxWindKm,
    rainShieldRadiusKm,
    track,
    windField: {
      maxWindMs: Number(maxWindMs.toFixed(2)),
      radiusMaxWindKm,
      galeRadiusKm: Math.round(radiusKm * 0.72),
      hurricaneRadiusKm: maxWindMs >= 33 ? Math.round(radiusKm * 0.34) : 0,
      outerRadiusKm: radiusKm,
      motionAsymmetryMs: Number(Math.min(9, trackSpeedKmH / 12).toFixed(2)),
      quadrants: {
        ne: Number(lerp(0.92, 1.12, hurricane01).toFixed(2)),
        se: Number(lerp(0.86, 1.04, shearSupport).toFixed(2)),
        sw: Number(lerp(0.76, 0.96, humidity).toFixed(2)),
        nw: Number(lerp(0.82, 1.05, organization).toFixed(2))
      }
    },
    rainShield: {
      radiusKm: rainShieldRadiusKm,
      maxRateMmHr: Number(lerp(0.35, 4.8, Math.max(humidity, organization, hurricane01)).toFixed(3)),
      spiralBandCount: Math.max(2, Math.min(6, Math.round(2 + 4 * organization))),
      asymmetry: Number((1 - shearSupport * 0.55).toFixed(3))
    },
    satelliteSignature: {
      eyeClarity01: Number(clamp01((hurricane01 - 0.48) / 0.42).toFixed(3)),
      eyewallCompleteness01: Number(clamp01(0.45 * embedded + 0.35 * organization + 0.2 * shearSupport).toFixed(3)),
      spiralBandCount: Math.max(2, Math.min(6, Math.round(2 + 4 * organization))),
      coldCloudTopProxy01: Number(clamp01(0.42 * organization + 0.34 * humidity + 0.24 * intensity).toFixed(3))
    },
    radarSignature: {
      eyewallDbz: maxWindMs >= 33 ? Math.round(38 + 18 * hurricane01) : null,
      rainBandDbz: Math.round(28 + 18 * Math.max(humidity, organization)),
      coverageRadiusKm: rainShieldRadiusKm
    },
    forecastSignature: {
      trackHeadingDeg: Number.isFinite(trackHeadingDeg) ? Math.round(trackHeadingDeg) : null,
      trackSpeedKmH: Number(trackSpeedKmH.toFixed(2)),
      confidence01: Number(clamp01(0.45 + 0.25 * basinSeason + 0.2 * embedded + 0.1 * shearSupport).toFixed(3)),
      hazards: maxWindMs >= 33
        ? ['hurricane-force-winds', 'flooding-rain', 'coastal-surge-proxy']
        : ['tropical-storm-winds', 'heavy-rain']
    }
  };
}
