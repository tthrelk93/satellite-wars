import { g, Rd } from '../constants';

const DEFAULT_PRESSURE_LEVELS_PA = [85000, 70000, 50000, 25000];
const EPS = 1e-6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const interpolateColumnAtPressure = (field3d, pressure3d, nz, N, cellIndex, targetPressurePa) => {
  let nearest = null;
  for (let lev = 0; lev < nz; lev += 1) {
    const idx = lev * N + cellIndex;
    const p = pressure3d[idx];
    const value = field3d[idx];
    if (!Number.isFinite(p) || !Number.isFinite(value)) continue;
    nearest = value;
    if (Math.abs(p - targetPressurePa) < 1) return value;
    if (lev < nz - 1) {
      const nextIdx = (lev + 1) * N + cellIndex;
      const pNext = pressure3d[nextIdx];
      const valueNext = field3d[nextIdx];
      const inBracket = (p >= targetPressurePa && pNext <= targetPressurePa) || (p <= targetPressurePa && pNext >= targetPressurePa);
      if (inBracket && Number.isFinite(pNext) && Number.isFinite(valueNext)) {
        const lnP = Math.log(Math.max(EPS, p));
        const lnPNext = Math.log(Math.max(EPS, pNext));
        const lnTarget = Math.log(Math.max(EPS, targetPressurePa));
        const t = clamp((lnTarget - lnP) / Math.max(EPS, lnPNext - lnP), 0, 1);
        return value + (valueNext - value) * t;
      }
    }
  }
  return nearest;
};

const computeSeaLevelPressurePa = (core) => {
  const ps = core?.state?.ps;
  const Ts = core?.fields?.Ts;
  const elev = core?.geo?.elev;
  if (!ps || !Ts || !elev) return [];
  const out = new Array(ps.length);
  for (let i = 0; i < ps.length; i += 1) {
    const tMean = Math.max(180, Ts[i] + 0.5 * 0.0065 * Math.max(0, elev[i] || 0));
    out[i] = ps[i] * Math.exp((g * Math.max(0, elev[i] || 0)) / Math.max(EPS, Rd * tMean));
  }
  return out;
};

const computeTotalColumnWaterKgM2 = (state) => {
  const { N, nz, qv, qc, qi, qr, pHalf } = state;
  const out = new Array(N).fill(0);
  for (let cell = 0; cell < N; cell += 1) {
    let total = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      const idx = lev * N + cell;
      const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
      total += (qv[idx] + qc[idx] + (qi?.[idx] || 0) + (qr?.[idx] || 0)) * (dp / g);
    }
    out[cell] = total;
  }
  return out;
};

const computePressureLevelHeights = (state, pressureLevelsPa) => {
  const { N, nz, pMid, phiMid } = state;
  const byPressure = {};
  pressureLevelsPa.forEach((pressurePa) => {
    const field = new Array(N);
    for (let cell = 0; cell < N; cell += 1) {
      const geopotential = interpolateColumnAtPressure(phiMid, pMid, nz, N, cell, pressurePa);
      field[cell] = Number.isFinite(geopotential) ? geopotential / g : null;
    }
    byPressure[String(pressurePa)] = field;
  });
  return byPressure;
};

export function buildValidationDiagnostics(core, { pressureLevelsPa = DEFAULT_PRESSURE_LEVELS_PA } = {}) {
  const grid = core?.grid;
  const state = core?.state;
  const fields = core?.fields;
  if (!grid || !state || !fields) {
    throw new Error('Validation diagnostics require a ready weather core.');
  }

  const wind10mU = Array.from(fields.u || []);
  const wind10mV = Array.from(fields.v || []);
  const wind10mSpeedMs = wind10mU.map((u, index) => Math.hypot(u, wind10mV[index] || 0));

  return {
    schema: 'satellite-wars.weather-validation.snapshot.v1',
    simTimeSeconds: core.timeUTC,
    grid: {
      nx: grid.nx,
      ny: grid.ny,
      latitudesDeg: Array.from(grid.latDeg || []),
      longitudesDeg: Array.from(grid.lonDeg || [])
    },
    pressureLevelsPa: pressureLevelsPa.slice(),
    seaLevelPressurePa: computeSeaLevelPressurePa(core),
    surfacePressurePa: Array.from(state.ps || []),
    wind10mU,
    wind10mV,
    wind10mSpeedMs,
    geopotentialHeightMByPressurePa: computePressureLevelHeights(state, pressureLevelsPa),
    totalColumnWaterKgM2: computeTotalColumnWaterKgM2(state),
    precipRateMmHr: Array.from(fields.precipRate || state.precipRate || []),
    precipAccumMm: Array.from(state.precipAccum || []),
    cloudLowFraction: Array.from(fields.cloudLow || []),
    cloudHighFraction: Array.from(fields.cloudHigh || []),
    cloudTotalFraction: Array.from(fields.cloud || []),
    cycloneSupportFields: {
      relativeVorticityS_1: Array.from(fields.vort || []),
      wind10mSpeedMs,
      seaLevelPressurePa: computeSeaLevelPressurePa(core)
    }
  };
}

export { DEFAULT_PRESSURE_LEVELS_PA };
