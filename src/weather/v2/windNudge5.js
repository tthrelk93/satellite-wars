import { LAT_DEG, U10M_ZONAL_MEAN_TARGET, SOURCE_FIXTURE_COUNT } from './windClimoTargets.js';
import { findClosestLevelIndex } from './verticalGrid.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

function applyUpperWindCap(u, v, idx, targetU, targetV, params = {}) {
  const factor = Number.isFinite(params.upperWindCapFactor) ? params.upperWindCapFactor : 0;
  if (factor <= 0) return;
  const offset = Number.isFinite(params.upperWindCapOffset) ? params.upperWindCapOffset : 0;
  const minCap = Number.isFinite(params.upperWindCapMin) ? params.upperWindCapMin : 0;
  const dynamicMinCap = Number.isFinite(params.dynamicUpperWindCapMin)
    ? params.dynamicUpperWindCapMin
    : minCap;
  const maxCap = Number.isFinite(params.maxUpperSpeed) && params.maxUpperSpeed > 0
    ? params.maxUpperSpeed
    : Infinity;
  let capSpeed = Math.hypot(targetU, targetV) * factor + offset;
  capSpeed = Math.max(capSpeed, minCap, dynamicMinCap);
  capSpeed = Math.min(capSpeed, maxCap);
  if (!(capSpeed > 0)) return;
  const speed = Math.hypot(u[idx], v[idx]);
  if (!(speed > capSpeed)) return;
  const s = capSpeed / speed;
  u[idx] *= s;
  v[idx] *= s;
}

const sampleTargetU = (latDeg) => {
  const latArr = LAT_DEG;
  const uArr = U10M_ZONAL_MEAN_TARGET;
  if (!latArr || !uArr || latArr.length === 0 || uArr.length === 0) return 0;
  const n = Math.min(latArr.length, uArr.length);
  const step = n > 1 ? latArr[0] - latArr[1] : 1;
  if (!Number.isFinite(step) || step === 0) return uArr[0];
  if (latDeg >= latArr[0]) return uArr[0];
  if (latDeg <= latArr[n - 1]) return uArr[n - 1];
  const idx = (latArr[0] - latDeg) / step;
  const i0 = Math.max(0, Math.min(n - 1, Math.floor(idx)));
  const i1 = Math.min(n - 1, i0 + 1);
  const t = clamp(idx - i0, 0, 1);
  return uArr[i0] + (uArr[i1] - uArr[i0]) * t;
};

const hasSpatialWindTargets = (climo) => Boolean(
  climo?.hasWind && climo?.windNowU && climo?.windNowV &&
  (climo?.hasWind500 || climo?.hasWind250)
);

export function stepWindNudge5({ dt, grid, state, climo, params = {} }) {
  if (!grid || !state || !Number.isFinite(dt) || dt <= 0) return { didApply: false };
  if (params.enable === false) return { didApply: false };

  const { nx, ny } = grid;
  const { N, nz, u, v } = state;
  if (!nx || !ny || !N || !nz || !u || !v) return { didApply: false };

  const levS = nz - 1;
  const levU = findClosestLevelIndex(state.sigmaHalf, 0.28);
  const tauSurfaceSeconds = Number.isFinite(params.tauSurfaceSeconds) ? params.tauSurfaceSeconds : 7 * 86400;
  const tauUpperSeconds = Number.isFinite(params.tauUpperSeconds) ? params.tauUpperSeconds : 10 * 86400;
  const tauVSeconds = Number.isFinite(params.tauVSeconds) ? params.tauVSeconds : 20 * 86400;
  const relaxS = clamp(dt / tauSurfaceSeconds, 0, 1);
  const relaxU = clamp(dt / tauUpperSeconds, 0, 1);
  const relaxV = clamp(dt / tauVSeconds, 0, 1);
  const upperJetScale = Number.isFinite(params.upperJetScale) ? params.upperJetScale : 2.2;
  const upperJetLatDeg = Number.isFinite(params.upperJetLatDeg) ? params.upperJetLatDeg : 35;
  const upperJetWidthDeg = Number.isFinite(params.upperJetWidthDeg) ? params.upperJetWidthDeg : 12;

  let sumErrS = 0;
  let sumErrU = 0;
  let sumWSurface = 0;
  let sumWUpper = 0;
  let maxAbsCorrection = 0;

  if (hasSpatialWindTargets(climo) && params.useSpatialTargets !== false) {
    const targetSurfaceU = climo.windNowU;
    const targetSurfaceV = climo.windNowV;
    const hasBlendableUpperTargets = Boolean(
      climo.hasWind500 && climo.hasWind250
      && climo.wind500NowU && climo.wind500NowV
      && climo.wind250NowU && climo.wind250NowV
      && state.pMid?.length === nz * N
    );
    const targetUpperU = climo.hasWind500 ? climo.wind500NowU : climo.wind250NowU;
    const targetUpperV = climo.hasWind500 ? climo.wind500NowV : climo.wind250NowV;

    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      const latDeg = Number.isFinite(grid.latDeg?.[j]) ? grid.latDeg[j] : 90 - ((j + 0.5) / ny) * 180;
      const absLat = Math.abs(latDeg);
      const weight = Number.isFinite(grid.cosLat?.[j])
        ? Math.max(0, grid.cosLat[j])
        : Math.max(0, Math.cos(latDeg * Math.PI / 180));
      const jetCapFloor = (Number.isFinite(params.upperWindCapMin) ? params.upperWindCapMin : 0)
        + (Number.isFinite(params.upperWindCapJetBoost) ? params.upperWindCapJetBoost : 0)
          * Math.exp(-Math.pow((absLat - upperJetLatDeg) / upperJetWidthDeg, 2));
      const capParams = Number.isFinite(jetCapFloor)
        ? { ...params, dynamicUpperWindCapMin: jetCapFloor }
        : params;
      for (let i = 0; i < nx; i += 1) {
        const k = row + i;
        const idxS = levS * N + k;
        const duS = (targetSurfaceU[k] - u[idxS]) * relaxS;
        const dvS = (targetSurfaceV[k] - v[idxS]) * relaxV;
        u[idxS] += duS;
        v[idxS] += dvS;
        sumErrS += ((u[idxS] - targetSurfaceU[k]) ** 2 + (v[idxS] - targetSurfaceV[k]) ** 2) * weight;
        sumWSurface += weight;
        maxAbsCorrection = Math.max(maxAbsCorrection, Math.abs(duS), Math.abs(dvS));

        const pMid = state.pMid;
        if (pMid?.length === nz * N) {
          for (let lev = 0; lev < nz; lev += 1) {
            const idxU = lev * N + k;
            const pLev = pMid[idxU];
            if (!Number.isFinite(pLev) || pLev < 15000 || pLev > 50000) continue;
            let targetUpperUk = targetUpperU[k];
            let targetUpperVk = targetUpperV[k];
            if (hasBlendableUpperTargets) {
              const w250 = clamp((50000 - pLev) / (50000 - 25000), 0, 1);
              targetUpperUk = lerp(climo.wind500NowU[k], climo.wind250NowU[k], w250);
              targetUpperVk = lerp(climo.wind500NowV[k], climo.wind250NowV[k], w250);
            }
            const duU = (targetUpperUk - u[idxU]) * relaxU;
            const dvU = (targetUpperVk - v[idxU]) * relaxV;
            u[idxU] += duU;
            v[idxU] += dvU;
            applyUpperWindCap(u, v, idxU, targetUpperUk, targetUpperVk, capParams);
            sumErrU += ((u[idxU] - targetUpperUk) ** 2 + (v[idxU] - targetUpperVk) ** 2) * weight;
            sumWUpper += weight;
            maxAbsCorrection = Math.max(maxAbsCorrection, Math.abs(duU), Math.abs(dvU));
          }
        } else {
          const idxU = levU * N + k;
          let targetUpperUk = targetUpperU[k];
          let targetUpperVk = targetUpperV[k];
          if (hasBlendableUpperTargets) {
            const pLev = state.pMid[idxU];
            const w250 = Number.isFinite(pLev)
              ? clamp((50000 - pLev) / (50000 - 25000), 0, 1)
              : 0;
            targetUpperUk = lerp(climo.wind500NowU[k], climo.wind250NowU[k], w250);
            targetUpperVk = lerp(climo.wind500NowV[k], climo.wind250NowV[k], w250);
          }
          const duU = (targetUpperUk - u[idxU]) * relaxU;
          const dvU = (targetUpperVk - v[idxU]) * relaxV;
          u[idxU] += duU;
          v[idxU] += dvU;
          applyUpperWindCap(u, v, idxU, targetUpperUk, targetUpperVk, capParams);
          sumErrU += ((u[idxU] - targetUpperUk) ** 2 + (v[idxU] - targetUpperVk) ** 2) * weight;
          sumWUpper += weight;
          maxAbsCorrection = Math.max(maxAbsCorrection, Math.abs(duU), Math.abs(dvU));
        }
      }
    }

    return {
      didApply: true,
      source: 'spatial-climatology',
      rmseSurface: sumWSurface > 0 ? Math.sqrt(sumErrS / sumWSurface) : null,
      rmseUpper: sumWUpper > 0 ? Math.sqrt(sumErrU / sumWUpper) : null,
      maxAbsCorrection
    };
  }

  if (SOURCE_FIXTURE_COUNT !== 8 || !LAT_DEG?.length || !U10M_ZONAL_MEAN_TARGET?.length) {
    return { didApply: false };
  }

  for (let j = 0; j < ny; j++) {
    let sumUS = 0;
    let sumVS = 0;
    let sumUU = 0;
    let sumVU = 0;
    let count = 0;
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = row + i;
      const idxS = levS * N + k;
      const idxU = levU * N + k;
      const uS = u[idxS];
      const vS = v[idxS];
      const uU = u[idxU];
      const vU = v[idxU];
      if (!Number.isFinite(uS) || !Number.isFinite(vS) || !Number.isFinite(uU) || !Number.isFinite(vU)) continue;
      sumUS += uS;
      sumVS += vS;
      sumUU += uU;
      sumVU += vU;
      count += 1;
    }
    if (count === 0) continue;
    const uMeanS = sumUS / count;
    const vMeanS = sumVS / count;
    const uMeanU = sumUU / count;
    const vMeanU = sumVU / count;
    const latDeg = Number.isFinite(grid.latDeg?.[j])
      ? grid.latDeg[j]
      : 90 - ((j + 0.5) / ny) * 180;
    const absLat = Math.abs(latDeg);
    const targetS = sampleTargetU(latDeg);
    const jet = Math.exp(-Math.pow((absLat - upperJetLatDeg) / upperJetWidthDeg, 2));
    const targetU = jet * upperJetScale * Math.max(0, targetS);
    const jetCapFloor = (Number.isFinite(params.upperWindCapMin) ? params.upperWindCapMin : 0)
      + (Number.isFinite(params.upperWindCapJetBoost) ? params.upperWindCapJetBoost : 0) * jet;
    const capParams = Number.isFinite(jetCapFloor)
      ? { ...params, dynamicUpperWindCapMin: jetCapFloor }
      : params;

    const duS = (targetS - uMeanS) * relaxS;
    const duU = (targetU - uMeanU) * relaxU;
    const dvS = (0 - vMeanS) * relaxV;
    const dvU = (0 - vMeanU) * relaxV;
    const weight = Number.isFinite(grid.cosLat?.[j])
      ? Math.max(0, grid.cosLat[j])
      : Math.max(0, Math.cos(latDeg * Math.PI / 180));
    sumErrS += (uMeanS - targetS) * (uMeanS - targetS) * weight;
    sumErrU += (uMeanU - targetU) * (uMeanU - targetU) * weight;
    sumWSurface += weight;
    sumWUpper += weight;
    maxAbsCorrection = Math.max(maxAbsCorrection, Math.abs(duS), Math.abs(duU), Math.abs(dvS), Math.abs(dvU));

    for (let i = 0; i < nx; i++) {
      const k = row + i;
      const idxS = levS * N + k;
      const idxU = levU * N + k;
      u[idxS] += duS;
      v[idxS] += dvS;
      u[idxU] += duU;
      v[idxU] += dvU;
      applyUpperWindCap(u, v, idxU, targetU, 0, capParams);
    }
  }

  return {
    didApply: true,
    source: 'zonal-fallback',
    rmseSurface: sumWSurface > 0 ? Math.sqrt(sumErrS / sumWSurface) : null,
    rmseUpper: sumWUpper > 0 ? Math.sqrt(sumErrU / sumWUpper) : null,
    maxAbsCorrection
  };
}
