const EPS = 1e-6;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const ANALYSIS_SCHEMA = 'satellite-wars.weather-analysis.case.v1';

export function normalizeStructuredGrid(grid) {
  const latitudesDeg = Array.isArray(grid?.latitudesDeg)
    ? grid.latitudesDeg.slice()
    : Array.isArray(grid?.latitudes)
      ? grid.latitudes.slice()
      : null;
  const longitudesDeg = Array.isArray(grid?.longitudesDeg)
    ? grid.longitudesDeg.slice()
    : Array.isArray(grid?.longitudes)
      ? grid.longitudes.slice()
      : null;
  if (!latitudesDeg?.length || !longitudesDeg?.length) {
    throw new Error('Analysis grid must define latitudesDeg/latitudes and longitudesDeg/longitudes.');
  }
  return {
    nx: longitudesDeg.length,
    ny: latitudesDeg.length,
    count: latitudesDeg.length * longitudesDeg.length,
    latitudesDeg,
    longitudesDeg
  };
}

const isAscending = (values) => values.length < 2 || values[values.length - 1] >= values[0];

const wrapLongitudeDeg = (lonDeg, firstLonDeg) => {
  let value = lonDeg;
  while (value < firstLonDeg) value += 360;
  while (value >= firstLonDeg + 360) value -= 360;
  return value;
};

const findLatitudeBracket = (latitudesDeg, targetLatDeg) => {
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
        return { i0: i, i1: i + 1, t: (targetLatDeg - a) / Math.max(EPS, b - a) };
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
        return { i0: i, i1: i + 1, t: (a - targetLatDeg) / Math.max(EPS, a - b) };
      }
    }
  }
  const last = latitudesDeg.length - 1;
  return { i0: last, i1: last, t: 0 };
};

const findLongitudeBracket = (longitudesDeg, targetLonDeg) => {
  const firstLon = longitudesDeg[0];
  const wrappedLon = wrapLongitudeDeg(targetLonDeg, firstLon);
  for (let i = 0; i < longitudesDeg.length; i += 1) {
    const lon0 = longitudesDeg[i];
    const lon1 = i === longitudesDeg.length - 1 ? longitudesDeg[0] + 360 : longitudesDeg[i + 1];
    if (wrappedLon >= lon0 && wrappedLon <= lon1 + EPS) {
      return {
        i0: i,
        i1: (i + 1) % longitudesDeg.length,
        t: clamp((wrappedLon - lon0) / Math.max(EPS, lon1 - lon0), 0, 1)
      };
    }
  }
  return { i0: 0, i1: 0, t: 0 };
};

export function remapStructuredGrid2D(values, sourceGridLike, targetGridLike) {
  const sourceGrid = normalizeStructuredGrid(sourceGridLike);
  const targetGrid = normalizeStructuredGrid(targetGridLike);
  if (!Array.isArray(values) || values.length !== sourceGrid.count) {
    throw new Error(`Expected field of length ${sourceGrid.count}, got ${values?.length ?? 'null'}.`);
  }

  const out = new Float32Array(targetGrid.count);
  for (let j = 0; j < targetGrid.ny; j += 1) {
    const latBracket = findLatitudeBracket(sourceGrid.latitudesDeg, targetGrid.latitudesDeg[j]);
    for (let i = 0; i < targetGrid.nx; i += 1) {
      const lonBracket = findLongitudeBracket(sourceGrid.longitudesDeg, targetGrid.longitudesDeg[i]);
      const idx00 = latBracket.i0 * sourceGrid.nx + lonBracket.i0;
      const idx10 = latBracket.i0 * sourceGrid.nx + lonBracket.i1;
      const idx01 = latBracket.i1 * sourceGrid.nx + lonBracket.i0;
      const idx11 = latBracket.i1 * sourceGrid.nx + lonBracket.i1;
      const top = values[idx00] + (values[idx10] - values[idx00]) * lonBracket.t;
      const bottom = values[idx01] + (values[idx11] - values[idx01]) * lonBracket.t;
      out[j * targetGrid.nx + i] = top + (bottom - top) * latBracket.t;
    }
  }
  return out;
}

export function normalizePressureFieldMap(fieldMap, expectedCount) {
  const entries = Object.entries(fieldMap || {})
    .map(([pressurePa, values]) => ({ pressurePa: Number(pressurePa), values }))
    .filter((entry) => Number.isFinite(entry.pressurePa) && Array.isArray(entry.values))
    .sort((a, b) => b.pressurePa - a.pressurePa);
  if (!entries.length) return [];
  entries.forEach((entry) => {
    if (entry.values.length !== expectedCount) {
      throw new Error(`Pressure level ${entry.pressurePa} length ${entry.values.length} does not match grid count ${expectedCount}.`);
    }
  });
  return entries;
}

export function remapPressureFieldMap(fieldMap, sourceGridLike, targetGridLike) {
  const sourceGrid = normalizeStructuredGrid(sourceGridLike);
  const targetGrid = normalizeStructuredGrid(targetGridLike);
  const entries = normalizePressureFieldMap(fieldMap, sourceGrid.count);
  const remapped = new Map();
  entries.forEach((entry) => {
    remapped.set(entry.pressurePa, remapStructuredGrid2D(entry.values, sourceGrid, targetGrid));
  });
  return remapped;
}

export function interpolatePressureFieldAtCell(fieldMap, targetPressurePa, cellIndex) {
  const entries = Array.from(fieldMap.entries()).sort((a, b) => b[0] - a[0]);
  if (!entries.length) return null;
  if (entries.length === 1 || targetPressurePa >= entries[0][0]) return entries[0][1][cellIndex];
  if (targetPressurePa <= entries[entries.length - 1][0]) return entries[entries.length - 1][1][cellIndex];

  for (let i = 0; i < entries.length - 1; i += 1) {
    const [p0, values0] = entries[i];
    const [p1, values1] = entries[i + 1];
    if (targetPressurePa <= p0 && targetPressurePa >= p1) {
      const span = Math.log(p1) - Math.log(p0);
      const t = Math.abs(span) > EPS
        ? clamp((Math.log(targetPressurePa) - Math.log(p0)) / span, 0, 1)
        : 0;
      return values0[cellIndex] + (values1[cellIndex] - values0[cellIndex]) * t;
    }
  }

  return entries[entries.length - 1][1][cellIndex];
}

export function saturationMixingRatio(T, p) {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  return Math.min((eps * esClamped) / Math.max(1, p - esClamped), 0.2);
}

export function specificHumidityFromRelativeHumidity(relativeHumidity, temperatureK, pressurePa) {
  const rhFraction = relativeHumidity > 1.2 ? relativeHumidity / 100 : relativeHumidity;
  return clamp(rhFraction, 0, 1.5) * saturationMixingRatio(temperatureK, pressurePa);
}

export function potentialTemperatureFromTemperature(temperatureK, pressurePa, p0 = 100000) {
  const kappa = 287.05 / 1004;
  return temperatureK / Math.pow(Math.max(EPS, pressurePa) / p0, kappa);
}

export function computeModelMidPressurePa({ surfacePressurePa, sigmaHalf, pTop = 20000 }) {
  const nz = sigmaHalf.length - 1;
  const N = surfacePressurePa.length;
  const out = new Float32Array(nz * N);
  for (let cell = 0; cell < N; cell += 1) {
    const ps = Math.max(pTop + 100, surfacePressurePa[cell]);
    for (let lev = 0; lev < nz; lev += 1) {
      const p1 = pTop + (ps - pTop) * sigmaHalf[lev];
      const p2 = pTop + (ps - pTop) * sigmaHalf[lev + 1];
      out[lev * N + cell] = Math.sqrt(Math.max(pTop, p1) * Math.max(pTop, p2));
    }
  }
  return out;
}

export function validateAnalysisDataset(dataset) {
  if (!dataset || typeof dataset !== 'object') {
    throw new Error('Analysis dataset is required.');
  }
  const grid = normalizeStructuredGrid(dataset.grid);
  const fields = dataset.fields || {};
  if (!Array.isArray(fields.surfacePressurePa) || fields.surfacePressurePa.length !== grid.count) {
    throw new Error('Analysis dataset must define fields.surfacePressurePa on the source grid.');
  }
  if (!fields.uByPressurePa || !fields.vByPressurePa) {
    throw new Error('Analysis dataset must define uByPressurePa and vByPressurePa.');
  }
  if (!fields.temperatureKByPressurePa && !fields.thetaKByPressurePa) {
    throw new Error('Analysis dataset must define temperatureKByPressurePa or thetaKByPressurePa.');
  }
  if (!fields.specificHumidityKgKgByPressurePa && !fields.relativeHumidityByPressurePa) {
    throw new Error('Analysis dataset must define specificHumidityKgKgByPressurePa or relativeHumidityByPressurePa.');
  }

  return {
    ...dataset,
    grid,
    fields
  };
}
