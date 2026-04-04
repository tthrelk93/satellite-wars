import { g } from '../constants.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const EPS = 1e-6;

export const DEFAULT_PRESSURE_LEVELS_PA = [85000, 70000, 50000, 25000];

export function createSigmaHalfLevels({ nz, surfaceRefinement = 0.72 } = {}) {
  const levelCount = Math.max(2, Math.floor(Number(nz) || 0));
  const sigmaHalf = new Float32Array(levelCount + 1);
  sigmaHalf[0] = 0;
  for (let k = 1; k < levelCount; k += 1) {
    const x = k / levelCount;
    sigmaHalf[k] = Math.pow(x, surfaceRefinement);
  }
  sigmaHalf[levelCount] = 1;
  return sigmaHalf;
}

export function computeSigmaMid(sigmaHalf) {
  const nz = Math.max(0, (sigmaHalf?.length || 1) - 1);
  const sigmaMid = new Float32Array(nz);
  for (let lev = 0; lev < nz; lev += 1) {
    sigmaMid[lev] = 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]);
  }
  return sigmaMid;
}

export function findClosestLevelIndex(sigmaHalf, targetSigma) {
  const sigmaMid = computeSigmaMid(sigmaHalf);
  let bestIndex = 0;
  let bestError = Infinity;
  for (let lev = 0; lev < sigmaMid.length; lev += 1) {
    const error = Math.abs(sigmaMid[lev] - targetSigma);
    if (error < bestError) {
      bestError = error;
      bestIndex = lev;
    }
  }
  return bestIndex;
}

export function buildVerticalLayout({ sigmaHalf, pressureLevelsPa = DEFAULT_PRESSURE_LEVELS_PA } = {}) {
  const sigmaMid = computeSigmaMid(sigmaHalf);
  const nz = sigmaMid.length;
  const surface = Math.max(0, nz - 1);
  const boundaryLayer = findClosestLevelIndex(sigmaHalf, 0.85);
  const lowerTroposphere = findClosestLevelIndex(sigmaHalf, 0.72);
  const midTroposphere = findClosestLevelIndex(sigmaHalf, 0.52);
  const upperTroposphere = findClosestLevelIndex(sigmaHalf, 0.28);
  const tropopause = findClosestLevelIndex(sigmaHalf, 0.18);
  return {
    nz,
    sigmaMid,
    surface,
    boundaryLayer,
    lowerTroposphere,
    midTroposphere,
    upperTroposphere,
    tropopause,
    pressureLevelsPa: pressureLevelsPa.slice()
  };
}

export function interpolateColumnToPressure({ field3d, pMid, nz, N, cellIndex, targetPressurePa }) {
  let nearest = null;
  for (let lev = 0; lev < nz; lev += 1) {
    const idx = lev * N + cellIndex;
    const p = pMid[idx];
    const value = field3d[idx];
    if (!Number.isFinite(p) || !Number.isFinite(value)) continue;
    nearest = value;
    if (Math.abs(p - targetPressurePa) < 1) return value;
    if (lev < nz - 1) {
      const nextIdx = (lev + 1) * N + cellIndex;
      const pNext = pMid[nextIdx];
      const valueNext = field3d[nextIdx];
      const inBracket = (p >= targetPressurePa && pNext <= targetPressurePa) || (p <= targetPressurePa && pNext >= targetPressurePa);
      if (inBracket && Number.isFinite(pNext) && Number.isFinite(valueNext)) {
        const lnP = Math.log(Math.max(EPS, p));
        const lnPNext = Math.log(Math.max(EPS, pNext));
        const span = lnPNext - lnP;
        const t = Math.abs(span) > EPS
          ? clamp((Math.log(Math.max(EPS, targetPressurePa)) - lnP) / span, 0, 1)
          : 0;
        return value + (valueNext - value) * t;
      }
    }
  }
  return nearest;
}

export function interpolateFieldToPressureLevel({ field3d, pMid, nz, N, targetPressurePa }) {
  const out = new Float32Array(N);
  for (let cell = 0; cell < N; cell += 1) {
    const value = interpolateColumnToPressure({ field3d, pMid, nz, N, cellIndex: cell, targetPressurePa });
    out[cell] = Number.isFinite(value) ? value : NaN;
  }
  return out;
}

export function computeGeopotentialHeightByPressure(state, pressureLevelsPa = DEFAULT_PRESSURE_LEVELS_PA) {
  const { N, nz, pMid, phiMid } = state;
  const byPressure = {};
  pressureLevelsPa.forEach((pressurePa) => {
    const geopotential = interpolateFieldToPressureLevel({
      field3d: phiMid,
      pMid,
      nz,
      N,
      targetPressurePa: pressurePa
    });
    const height = new Float32Array(N);
    for (let i = 0; i < N; i += 1) {
      height[i] = geopotential[i] / g;
    }
    byPressure[String(pressurePa)] = height;
  });
  return byPressure;
}

export function levelSubarray(field3d, N, lev) {
  const offset = lev * N;
  return field3d.subarray(offset, offset + N);
}
