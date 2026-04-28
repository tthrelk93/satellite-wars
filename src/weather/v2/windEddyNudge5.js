import { LAT_DEG, EKE10M_BY_LAT_TARGET, SOURCE_FIXTURE_COUNT } from './windClimoTargets.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

const sampleTargetEke = (latDeg) => {
  if (SOURCE_FIXTURE_COUNT !== 8 || !EKE10M_BY_LAT_TARGET?.length || !LAT_DEG?.length) {
    return 0;
  }
  const n = LAT_DEG.length;
  if (n === 0) return 0;
  if (latDeg >= LAT_DEG[0]) return EKE10M_BY_LAT_TARGET[0];
  if (latDeg <= LAT_DEG[n - 1]) return EKE10M_BY_LAT_TARGET[n - 1];
  for (let i = 0; i < n - 1; i++) {
    const lat0 = LAT_DEG[i];
    const lat1 = LAT_DEG[i + 1];
    if (latDeg <= lat0 && latDeg >= lat1) {
      const t = lat0 !== lat1 ? (lat0 - latDeg) / (lat0 - lat1) : 0;
      return lerp(EKE10M_BY_LAT_TARGET[i], EKE10M_BY_LAT_TARGET[i + 1], t);
    }
  }
  return 0;
};

export function stepWindEddyNudge5({ dt, grid, state, climo, params = {} }) {
  if (!grid || !state || !Number.isFinite(dt) || dt <= 0) return { didApply: false };
  if (
    climo?.hasWind
    && (climo?.hasWind500 || climo?.hasWind250)
    && params.allowFallbackOnly !== true
    && params.allowWithSpatialTargets !== true
  ) {
    return { didApply: false, source: 'spatial-climatology-disabled-fallback' };
  }
  if (SOURCE_FIXTURE_COUNT !== 8 || !EKE10M_BY_LAT_TARGET?.length) {
    return { didApply: false };
  }
  const { nx, ny } = grid;
  const { N, nz, u, v } = state;
  if (!nx || !ny || !N || !u || !v) return { didApply: false };

  const {
    tauSeconds = 10 * 86400,
    scaleClampMin = 0.5,
    scaleClampMax = 2.0,
    eps = 1e-6
  } = params;

  const relax = clamp01(dt / Math.max(1e-6, tauSeconds));
  if (relax <= 0) return { didApply: false };

  if (!state._eddyRowMeanU || state._eddyRowMeanU.length !== ny) {
    state._eddyRowMeanU = new Float32Array(ny);
  }
  if (!state._eddyRowMeanV || state._eddyRowMeanV.length !== ny) {
    state._eddyRowMeanV = new Float32Array(ny);
  }
  const rowMeanU = state._eddyRowMeanU;
  const rowMeanV = state._eddyRowMeanV;
  const levS = nz - 1;
  const base = levS * N;

  for (let j = 0; j < ny; j++) {
    let sumU = 0;
    let sumV = 0;
    let count = 0;
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      const idx = base + row + i;
      const u0 = u[idx];
      const v0 = v[idx];
      if (!Number.isFinite(u0) || !Number.isFinite(v0)) continue;
      sumU += u0;
      sumV += v0;
      count += 1;
    }
    rowMeanU[j] = count > 0 ? sumU / count : 0;
    rowMeanV[j] = count > 0 ? sumV / count : 0;
  }

  let sumEke = 0;
  let countEke = 0;
  let maxScale = 0;

  for (let j = 0; j < ny; j++) {
    const latDeg = Number.isFinite(grid.latDeg?.[j])
      ? grid.latDeg[j]
      : 90 - ((j + 0.5) / ny) * 180;
    const target = sampleTargetEke(latDeg);
    const row = j * nx;
    const uBar = rowMeanU[j];
    const vBar = rowMeanV[j];
    let ekeRowSum = 0;
    let countRow = 0;
    for (let i = 0; i < nx; i++) {
      const idx = base + row + i;
      const du = u[idx] - uBar;
      const dv = v[idx] - vBar;
      ekeRowSum += du * du + dv * dv;
      countRow += 1;
    }
    if (!countRow) continue;
    const ekeRow = ekeRowSum / countRow;
    const scaleRaw = Math.sqrt((target + eps) / (ekeRow + eps));
    const scale = Math.max(scaleClampMin, Math.min(scaleClampMax, scaleRaw));
    const blend = lerp(1, scale, relax);
    if (scale > maxScale) maxScale = scale;
    for (let i = 0; i < nx; i++) {
      const idx = base + row + i;
      const uPrime = u[idx] - uBar;
      const vPrime = v[idx] - vBar;
      u[idx] = uBar + uPrime * blend;
      v[idx] = vBar + vPrime * blend;
    }
    sumEke += ekeRow;
    countEke += 1;
  }

  return {
    didApply: true,
    ekeMean: countEke > 0 ? sumEke / countEke : null,
    maxScale
  };
}
