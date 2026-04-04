import { assertFieldLength, fieldIndex, normalizeGrid, toRadians } from './grid.mjs';

const EPS = 1e-9;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function wrapLongitudeDeg(lonDeg, firstLonDeg) {
  let value = lonDeg;
  while (value < firstLonDeg) value += 360;
  while (value >= firstLonDeg + 360) value -= 360;
  return value;
}

function isAscending(values) {
  return values.length < 2 || values[values.length - 1] >= values[0];
}

function findLatitudeBracket(latitudesDeg, targetLatDeg) {
  const ascending = isAscending(latitudesDeg);
  if (ascending) {
    if (targetLatDeg <= latitudesDeg[0]) return { i0: 0, i1: 0, t: 0 };
    if (targetLatDeg >= latitudesDeg[latitudesDeg.length - 1]) {
      const last = latitudesDeg.length - 1;
      return { i0: last, i1: last, t: 0 };
    }
    for (let i = 0; i < latitudesDeg.length - 1; i += 1) {
      const a = latitudesDeg[i];
      const b = latitudesDeg[i + 1];
      if (targetLatDeg >= a && targetLatDeg <= b) {
        const span = Math.max(EPS, b - a);
        return { i0: i, i1: i + 1, t: (targetLatDeg - a) / span };
      }
    }
  } else {
    if (targetLatDeg >= latitudesDeg[0]) return { i0: 0, i1: 0, t: 0 };
    if (targetLatDeg <= latitudesDeg[latitudesDeg.length - 1]) {
      const last = latitudesDeg.length - 1;
      return { i0: last, i1: last, t: 0 };
    }
    for (let i = 0; i < latitudesDeg.length - 1; i += 1) {
      const a = latitudesDeg[i];
      const b = latitudesDeg[i + 1];
      if (targetLatDeg <= a && targetLatDeg >= b) {
        const span = Math.max(EPS, a - b);
        return { i0: i, i1: i + 1, t: (a - targetLatDeg) / span };
      }
    }
  }
  const last = latitudesDeg.length - 1;
  return { i0: last, i1: last, t: 0 };
}

function findLongitudeBracket(longitudesDeg, targetLonDeg) {
  const firstLon = longitudesDeg[0];
  const wrappedLon = wrapLongitudeDeg(targetLonDeg, firstLon);
  for (let i = 0; i < longitudesDeg.length; i += 1) {
    const lon0 = longitudesDeg[i];
    const lon1 = i === longitudesDeg.length - 1 ? longitudesDeg[0] + 360 : longitudesDeg[i + 1];
    if (wrappedLon >= lon0 && wrappedLon <= lon1 + EPS) {
      const span = Math.max(EPS, lon1 - lon0);
      return { i0: i, i1: (i + 1) % longitudesDeg.length, t: clamp((wrappedLon - lon0) / span, 0, 1) };
    }
  }
  return { i0: 0, i1: 0, t: 0 };
}

export function remapStructuredGrid2D(values, sourceGridLike, targetGridLike) {
  const sourceGrid = normalizeGrid(sourceGridLike);
  const targetGrid = normalizeGrid(targetGridLike);
  assertFieldLength(values, sourceGrid, 'Remap source field');

  const out = new Array(targetGrid.count);
  for (let j = 0; j < targetGrid.ny; j += 1) {
    const latDeg = targetGrid.latitudesDeg[j];
    const latBracket = findLatitudeBracket(sourceGrid.latitudesDeg, latDeg);
    for (let i = 0; i < targetGrid.nx; i += 1) {
      const lonDeg = targetGrid.longitudesDeg[i];
      const lonBracket = findLongitudeBracket(sourceGrid.longitudesDeg, lonDeg);
      const v00 = values[fieldIndex(sourceGrid, lonBracket.i0, latBracket.i0)];
      const v10 = values[fieldIndex(sourceGrid, lonBracket.i1, latBracket.i0)];
      const v01 = values[fieldIndex(sourceGrid, lonBracket.i0, latBracket.i1)];
      const v11 = values[fieldIndex(sourceGrid, lonBracket.i1, latBracket.i1)];
      const tx = lonBracket.t;
      const ty = latBracket.t;
      const top = v00 + (v10 - v00) * tx;
      const bottom = v01 + (v11 - v01) * tx;
      out[fieldIndex(targetGrid, i, j)] = top + (bottom - top) * ty;
    }
  }
  return out;
}

export function interpolatePressureLevel(fieldByPressurePa, targetPressurePa) {
  if (!fieldByPressurePa || typeof fieldByPressurePa !== 'object') {
    throw new Error('Pressure-level field map is required.');
  }

  const entries = Object.entries(fieldByPressurePa)
    .map(([pressurePa, values]) => ({ pressurePa: Number(pressurePa), values }))
    .filter((entry) => Number.isFinite(entry.pressurePa) && Array.isArray(entry.values))
    .sort((a, b) => b.pressurePa - a.pressurePa);

  if (!entries.length) {
    throw new Error('No valid pressure levels available for interpolation.');
  }

  if (entries.length === 1 || targetPressurePa >= entries[0].pressurePa) {
    return entries[0].values.slice();
  }
  if (targetPressurePa <= entries[entries.length - 1].pressurePa) {
    return entries[entries.length - 1].values.slice();
  }

  for (let i = 0; i < entries.length - 1; i += 1) {
    const upper = entries[i + 1];
    const lower = entries[i];
    if (targetPressurePa <= lower.pressurePa && targetPressurePa >= upper.pressurePa) {
      if (lower.values.length !== upper.values.length) {
        throw new Error('Pressure levels must contain arrays of equal length.');
      }
      const lnTarget = Math.log(targetPressurePa);
      const lnLower = Math.log(lower.pressurePa);
      const lnUpper = Math.log(upper.pressurePa);
      const span = lnUpper - lnLower;
      const t = Math.abs(span) > EPS
        ? clamp((lnTarget - lnLower) / span, 0, 1)
        : 0;
      return lower.values.map((value, index) => value + (upper.values[index] - value) * t);
    }
  }

  return entries[entries.length - 1].values.slice();
}

export function remapLeadToTargetGrid(lead, sourceGridLike, targetGridLike, targetPressureLevelsPa = []) {
  const sourceGrid = normalizeGrid(sourceGridLike);
  const targetGrid = normalizeGrid(targetGridLike);
  const targetLevels = Array.isArray(targetPressureLevelsPa) ? targetPressureLevelsPa.slice() : [];

  const remapIfPresent = (fieldName) => {
    if (!Array.isArray(lead[fieldName])) return null;
    return remapStructuredGrid2D(lead[fieldName], sourceGrid, targetGrid);
  };

  const remapped = {
    leadHours: lead.leadHours,
    seaLevelPressurePa: remapIfPresent('seaLevelPressurePa'),
    surfacePressurePa: remapIfPresent('surfacePressurePa'),
    wind10mU: remapIfPresent('wind10mU'),
    wind10mV: remapIfPresent('wind10mV'),
    totalColumnWaterKgM2: remapIfPresent('totalColumnWaterKgM2'),
    precipRateMmHr: remapIfPresent('precipRateMmHr'),
    precipAccumMm: remapIfPresent('precipAccumMm'),
    cloudLowFraction: remapIfPresent('cloudLowFraction'),
    cloudHighFraction: remapIfPresent('cloudHighFraction'),
    cloudTotalFraction: remapIfPresent('cloudTotalFraction'),
    geopotentialHeightMByPressurePa: {}
  };

  const zByPressure = lead.geopotentialHeightMByPressurePa || {};
  const availableLevels = Object.keys(zByPressure)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const requestedLevels = targetLevels.length ? targetLevels : availableLevels;

  requestedLevels.forEach((pressurePa) => {
    const direct = zByPressure[String(pressurePa)];
    const interpolated = Array.isArray(direct)
      ? direct.slice()
      : interpolatePressureLevel(zByPressure, pressurePa);
    remapped.geopotentialHeightMByPressurePa[String(pressurePa)] = remapStructuredGrid2D(interpolated, sourceGrid, targetGrid);
  });

  return remapped;
}

export function greatCircleDistanceKm(lat1Deg, lon1Deg, lat2Deg, lon2Deg) {
  const dLat = toRadians(lat2Deg - lat1Deg);
  const dLon = toRadians(lon2Deg - lon1Deg);
  const lat1 = toRadians(lat1Deg);
  const lat2 = toRadians(lat2Deg);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return 6371 * c;
}
