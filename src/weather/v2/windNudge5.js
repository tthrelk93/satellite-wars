import { LAT_DEG, U10M_ZONAL_MEAN_TARGET, SOURCE_FIXTURE_COUNT } from './windClimoTargets';
import { findClosestLevelIndex } from './verticalGrid';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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

export function stepWindNudge5({ dt, grid, state, params = {} }) {
  if (SOURCE_FIXTURE_COUNT !== 8 || !LAT_DEG?.length || !U10M_ZONAL_MEAN_TARGET?.length) {
    return { didApply: false };
  }
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
  const upperJetScale = Number.isFinite(params.upperJetScale) ? params.upperJetScale : 2.2;
  const upperJetLatDeg = Number.isFinite(params.upperJetLatDeg) ? params.upperJetLatDeg : 35;
  const upperJetWidthDeg = Number.isFinite(params.upperJetWidthDeg) ? params.upperJetWidthDeg : 12;

  const relaxS = clamp(dt / tauSurfaceSeconds, 0, 1);
  const relaxU = clamp(dt / tauUpperSeconds, 0, 1);
  const relaxV = clamp(dt / tauVSeconds, 0, 1);

  let sumErrS = 0;
  let sumErrU = 0;
  let sumW = 0;
  let maxAbsCorrection = 0;

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
      if (!Number.isFinite(uS) || !Number.isFinite(vS) || !Number.isFinite(uU) || !Number.isFinite(vU)) {
        continue;
      }
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

    const duS = (targetS - uMeanS) * relaxS;
    const duU = (targetU - uMeanU) * relaxU;
    const dvS = (0 - vMeanS) * relaxV;
    const dvU = (0 - vMeanU) * relaxV;
    const absCorr = Math.max(Math.abs(duS), Math.abs(duU), Math.abs(dvS), Math.abs(dvU));
    if (absCorr > maxAbsCorrection) maxAbsCorrection = absCorr;

    const weight = Number.isFinite(grid.cosLat?.[j])
      ? Math.max(0, grid.cosLat[j])
      : Math.max(0, Math.cos(latDeg * Math.PI / 180));
    sumErrS += (uMeanS - targetS) * (uMeanS - targetS) * weight;
    sumErrU += (uMeanU - targetU) * (uMeanU - targetU) * weight;
    sumW += weight;

    for (let i = 0; i < nx; i++) {
      const k = row + i;
      const idxS = levS * N + k;
      const idxU = levU * N + k;
      u[idxS] += duS;
      v[idxS] += dvS;
      u[idxU] += duU;
      v[idxU] += dvU;
    }
  }

  const rmseSurface = sumW > 0 ? Math.sqrt(sumErrS / sumW) : null;
  const rmseUpper = sumW > 0 ? Math.sqrt(sumErrU / sumW) : null;
  return { didApply: true, rmseSurface, rmseUpper, maxAbsCorrection };
}
