import { g, Cp, Rd } from '../constants.js';
import { findClosestLevelIndex } from './verticalGrid.js';

const saturationMixingRatio = (T, p) => {
  const Tuse = Math.max(180, Math.min(330, T));
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

const P0 = 100000;
const KAPPA = Rd / Cp;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / Math.max(1e-8, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export function updateDiagnostics2D5({ dt, grid, state, outFields, params = {} }) {
  if (!grid || !state || !outFields) return;

  const {
    enableNewCoverage = true,
    kTauLowLiquid = 20,
    kTauLowRain = 6,
    kTauLowIce = 20,
    kTauHighIce = 10,
    kTauHighLiquid = 30,
    tauMaxLow = 50,
    tauMaxHigh = 50,
    tauCloudLowSeconds = 2 * 3600,
    tauCloudHighSeconds = 4 * 3600,
    convAnvilTauSeconds = 6 * 3600,
    convAnvilBoost = 0.5,
    qc0Low = 5e-5,
    qc1Low = 8e-4,
    qc0High = 1e-5,
    qc1High = 4e-4,
    rhLow0 = 0.78,
    rhLow1 = 0.98,
    rhHigh0 = 0.55,
    rhHigh1 = 0.9,
    pTop = 20000,
    levVort = null,
    levUpper = null
  } = params;

  const dtSeconds = Number.isFinite(dt) && dt > 0 ? dt : 120;
  const { nx, ny, invDx, invDy, cosLat } = grid;
  const { N, nz, u, v, qv, qc, qi, qr, pHalf, pMid, theta, T, omega, cloudFrac3D, cloudTau3D } = state;

  if (!state._convAnvil || state._convAnvil.length !== N) state._convAnvil = new Float32Array(N);
  if (!state._cloudLowCov || state._cloudLowCov.length !== N) state._cloudLowCov = new Float32Array(N);
  if (!state._cloudHighCov || state._cloudHighCov.length !== N) state._cloudHighCov = new Float32Array(N);

  const convAnvil = state._convAnvil;
  const cloudLowCov = state._cloudLowCov;
  const cloudHighCov = state._cloudHighCov;
  const convMask = state.convMask;
  const tauCloudLow = Math.max(1e-6, tauCloudLowSeconds);
  const tauCloudHigh = Math.max(1e-6, tauCloudHighSeconds);
  const aLow = 1 - Math.exp(-dtSeconds / tauCloudLow);
  const aHigh = 1 - Math.exp(-dtSeconds / tauCloudHigh);
  const convAnvilDecay = Math.exp(-dtSeconds / Math.max(1e-6, convAnvilTauSeconds));

  let tauLowClamp = 0;
  let tauHighClamp = 0;

  const levU = Number.isFinite(levUpper)
    ? Math.min(Math.max(0, levUpper), nz - 1)
    : findClosestLevelIndex(state.sigmaHalf, 0.28);
  const lowSigmaCut = 0.72;
  const highSigmaCut = 0.35;

  for (let k = 0; k < N; k++) {
    let cloudLowRaw = 0;
    let cloudHighRaw = 0;
    let cloudTotalRaw = 0;
    let tauLow = 0;
    let tauHigh = 0;
    let tauTotal = 0;
    let cwpLow = 0;
    let cwpHigh = 0;

    const prevTauLow = outFields.tauLow[k] || 0;
    const prevTauHigh = outFields.tauHigh[k] || 0;

    for (let lev = 0; lev < nz; lev++) {
      const idx = lev * N + k;
      const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      const mAir = Math.max(0, dp / g);
      const pLev = Math.max(pTop, pMid[idx]);
      const sigma = clamp01((pLev - pTop) / Math.max(1e-6, state.ps[k] - pTop));
      const Pi = Math.pow(pLev / P0, KAPPA);
      const TLev = (T && T[idx]) || (theta[idx] * Pi);
      const qs = saturationMixingRatio(TLev, pLev);
      const rh = Math.max(0, Math.min(2, qv[idx] / Math.max(1e-8, qs)));
      const omegaMid = 0.5 * (omega[lev * N + k] + omega[(lev + 1) * N + k]);

      const condLiq = qc[idx] + 0.35 * qr[idx];
      const condIce = qi[idx] + 0.15 * qr[idx];
      const condTotal = condLiq + condIce;

      const qc0 = sigma > lowSigmaCut ? qc0Low : qc0High;
      const qc1 = sigma > lowSigmaCut ? qc1Low : qc1High;
      const rh0 = sigma > lowSigmaCut ? rhLow0 : rhHigh0;
      const rh1 = sigma > lowSigmaCut ? rhLow1 : rhHigh1;
      const condFactor = smoothstep(qc0, qc1, condTotal);
      const rhFactor = smoothstep(rh0, rh1, rh);
      const ascFactor = smoothstep(0.01, 0.25, -omegaMid);
      const convFactor = convMask && convMask[k] === 1 && sigma < 0.55 ? 0.2 : 0;
      const frac = clamp01(Math.max(condFactor, rhFactor * (0.55 + 0.45 * ascFactor)) + convFactor);

      const tauLayerRaw = (sigma > lowSigmaCut)
        ? (kTauLowLiquid * condLiq + kTauLowRain * qr[idx] + kTauLowIce * qi[idx]) * mAir
        : (kTauHighLiquid * condLiq + kTauHighIce * condIce) * mAir;
      const tauLayer = Math.max(0, tauLayerRaw);

      cloudFrac3D[idx] = frac;
      cloudTau3D[idx] = tauLayer;
      cloudTotalRaw = 1 - (1 - cloudTotalRaw) * (1 - frac);
      tauTotal += tauLayer;

      if (sigma > lowSigmaCut) {
        cloudLowRaw = 1 - (1 - cloudLowRaw) * (1 - frac);
        tauLow += tauLayer;
        cwpLow += condTotal * mAir;
      }
      if (sigma < highSigmaCut) {
        cloudHighRaw = 1 - (1 - cloudHighRaw) * (1 - frac);
        tauHigh += tauLayer;
        cwpHigh += condTotal * mAir;
      }
    }

    let anvil = convAnvil[k] * convAnvilDecay;
    if (convMask && convMask[k] === 1) anvil = 1;
    convAnvil[k] = anvil;

    const cloudLowTarget = cloudLowRaw;
    const cloudHighTarget = 1 - (1 - cloudHighRaw) * (1 - convAnvilBoost * anvil);

    let cloudLow = cloudLowTarget;
    let cloudHigh = cloudHighTarget;
    if (enableNewCoverage) {
      cloudLowCov[k] += aLow * (cloudLowTarget - cloudLowCov[k]);
      cloudHighCov[k] += aHigh * (cloudHighTarget - cloudHighCov[k]);
      cloudLow = clamp01(cloudLowCov[k]);
      cloudHigh = clamp01(cloudHighCov[k]);
    } else {
      cloudLowCov[k] = cloudLowTarget;
      cloudHighCov[k] = cloudHighTarget;
    }

    outFields.cwpLow[k] = cwpLow;
    outFields.cwpHigh[k] = cwpHigh;
    outFields.tauLow[k] = Math.min(tauMaxLow, tauLow);
    outFields.tauHigh[k] = Math.min(tauMaxHigh, tauHigh);
    outFields.tauTotal[k] = tauTotal;
    outFields.tauLowDelta[k] = Math.abs(outFields.tauLow[k] - prevTauLow);
    outFields.tauHighDelta[k] = Math.abs(outFields.tauHigh[k] - prevTauHigh);
    outFields.cloudLow[k] = cloudLow;
    outFields.cloudHigh[k] = cloudHigh;
    outFields.cloud[k] = Math.max(cloudTotalRaw, 1 - (1 - cloudLow) * (1 - cloudHigh));

    if (tauLow > tauMaxLow) tauLowClamp += 1;
    if (tauHigh > tauMaxHigh) tauHighClamp += 1;

    const levBot = nz - 1;
    const idxS = levBot * N + k;
    const pS = Math.max(pTop, pMid[idxS]);
    const PiS = Math.pow(pS / P0, KAPPA);
    const TSurf = (T && T[idxS]) || (theta[idxS] * PiS);
    const qsSurf = saturationMixingRatio(TSurf, pS);
    outFields.RH[k] = Math.max(0, Math.min(2, qv[idxS] / Math.max(1e-8, qsSurf)));

    const idxU = levU * N + k;
    const pU = Math.max(pTop, pMid[idxU]);
    const PiU = Math.pow(pU / P0, KAPPA);
    const TUpper = (T && T[idxU]) || (theta[idxU] * PiU);
    const qsUpper = saturationMixingRatio(TUpper, pU);
    outFields.RHU[k] = Math.max(0, Math.min(2, qv[idxU] / Math.max(1e-8, qsUpper)));
    outFields.omegaL[k] = 0.5 * (omega[levBot * N + k] + omega[(levBot + 1) * N + k]);
    outFields.omegaU[k] = 0.5 * (omega[levU * N + k] + omega[Math.min(nz, levU + 1) * N + k]);
  }

  outFields.tauLowClampCount = tauLowClamp;
  outFields.tauHighClampCount = tauHighClamp;
  outFields.tauLowAboveMax = tauLowClamp;
  outFields.tauHighAboveMax = tauHighClamp;

  const lev = Number.isFinite(levVort)
    ? Math.min(Math.max(0, levVort), nz - 1)
    : findClosestLevelIndex(state.sigmaHalf, 0.52);
  const base = lev * N;
  for (let j = 0; j < ny; j++) {
    const invDxRow = invDx[j];
    const invDyRow = invDy[j];
    const row = j * nx;
    const rowN = (j > 0 ? j - 1 : 0) * nx;
    const rowS = (j < ny - 1 ? j + 1 : ny - 1) * nx;
    const cosC = cosLat[j];
    const cosN = cosLat[j > 0 ? j - 1 : 0];
    const cosS = cosLat[j < ny - 1 ? j + 1 : ny - 1];
    for (let i = 0; i < nx; i++) {
      const iE = i + 1 < nx ? i + 1 : 0;
      const iW = i - 1 >= 0 ? i - 1 : nx - 1;
      const k = row + i;
      const idxE = base + row + iE;
      const idxW = base + row + iW;
      const idxN = base + rowN + i;
      const idxS = base + rowS + i;

      const dudx = (u[idxE] - u[idxW]) * 0.5 * invDxRow;
      const dvcos_dy = (v[idxN] * cosN - v[idxS] * cosS) * 0.5 * invDyRow;
      const dvdx = (v[idxE] - v[idxW]) * 0.5 * invDxRow;
      const ducos_dy = (u[idxN] * cosN - u[idxS] * cosS) * 0.5 * invDyRow;

      outFields.div[k] = dudx + dvcos_dy / cosC;
      outFields.vort[k] = dvdx - ducos_dy / cosC;
    }
  }
}
