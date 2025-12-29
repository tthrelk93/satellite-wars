import { g, Cp, Rd } from '../constants';

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
const DIAG_ALLOWED_PARAMS = new Set([
  'enableNewCoverage',
  'kTauLowLiquid',
  'kTauLowIce',
  'kTauHighIce',
  'kTauHighLiquid',
  'tauMaxLow',
  'tauMaxHigh',
  'tauCloudLowSeconds',
  'tauCloudHighSeconds',
  'rhLow0',
  'rhLow1',
  'rhHigh0',
  'rhHigh1',
  'omegaLowSubs0',
  'omegaLowSubs1',
  'omegaHigh0',
  'omegaHigh1',
  'stabLow0K',
  'stabLow1K',
  'convAnvilTauSeconds',
  'convAnvilBoost',
  'convLowSuppress',
  'qc0Low',
  'qc1Low',
  'qc0High',
  'qc1High',
  'dpTauLowMaxPa',
  'tau0',
  'levVort',
  'levUpper',
  'pTop',
  'wTauHigh'
]);
const diagWarnedParams = new Set();
const warnUnknownDiagParams = (params) => {
  if (!params || typeof params !== 'object') return;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  const unknown = Object.keys(params).filter(
    (key) => !DIAG_ALLOWED_PARAMS.has(key) && !diagWarnedParams.has(key)
  );
  if (!unknown.length) return;
  unknown.forEach((key) => diagWarnedParams.add(key));
  console.warn(`[V2 diagnostics] Unknown params: ${unknown.join(', ')}`);
};

export function updateDiagnostics2D5({ dt, grid, state, outFields, params = {} }) {
  if (!grid || !state || !outFields) return;
  warnUnknownDiagParams(params);

  const {
    enableNewCoverage = true,
    kTauLowLiquid = 20,
    kTauLowIce = 20,
    kTauHighIce = 10,
    kTauHighLiquid = 30,
    tauMaxLow = 50,
    tauMaxHigh = 50,
    tauCloudLowSeconds = 3 * 3600,
    tauCloudHighSeconds = 6 * 3600,
    rhLow0 = 0.9,
    rhLow1 = 0.99,
    rhHigh0 = 0.55,
    rhHigh1 = 0.85,
    omegaLowSubs0 = 0.02,
    omegaLowSubs1 = 0.2,
    omegaHigh0 = 0.05,
    omegaHigh1 = 0.3,
    stabLow0K = 0.5,
    stabLow1K = 3.0,
    convAnvilTauSeconds = 6 * 3600,
    convAnvilBoost = 0.6,
    convLowSuppress = 0.5,
    qc0Low = 1e-4,
    qc1Low = 8e-4,
    qc0High = 0.002,
    qc1High = 0.004,
    dpTauLowMaxPa = 11000,
    tau0 = 6,
    levVort = 2,
    levUpper = 2,
    pTop = 20000,
    wTauHigh = 0
  } = params;

  const dtSeconds = Number.isFinite(dt) && dt > 0 ? dt : 120;
  const { nx, ny, invDx, invDy, cosLat } = grid;
  const { N, nz, u, v, qv, qc, qi, pHalf, pMid, theta, T, omega } = state;

  const levTop = 0;
  const levTop2 = Math.min(1, nz - 1);
  const levBot = nz - 1;
  const levBot2 = Math.max(nz - 2, 0);
  const levU = Math.min(Math.max(0, levUpper), nz - 1);

  let tauLowClamp = 0;
  let tauHighClamp = 0;
  let tauLowAbove = 0;
  let tauHighAbove = 0;

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
  const convAnvilTau = Math.max(1e-6, convAnvilTauSeconds);
  const convAnvilDecay = Math.exp(-dtSeconds / convAnvilTau);

  for (let k = 0; k < N; k++) {
    let lwpLow = 0;
    let cwpHighIce = 0;
    let cwpHighLiq = 0;
    let qcMeanLow = 0;
    let qcMeanHigh = 0;
    let weightLow = 0;
    let weightHigh = 0;

    // Low levels (bottom band) — use only bottommost layer
    {
      const lev = levBot;
      const base = lev * N + k;
      const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      const mAir = dp / g;
      const mAirEff = Math.min(dp, dpTauLowMaxPa) / g;
      lwpLow += qc[base] * mAirEff;
      qcMeanLow += qc[base] * mAir;
      weightLow += mAir;
    }

    // High levels (top band)
    {
      const lev = levTop;
      const base = lev * N + k;
      const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      const mAir = dp / g;
      const pLev = Math.max(pTop, pMid[base]);
      const Pi = Math.pow(pLev / P0, KAPPA);
      const TLev = (T && T[base]) || (theta[base] * Pi);
      const iceFracFallback = clamp01((273 - TLev) / 20);
      cwpHighIce += (qi[base] + qc[base] * iceFracFallback) * mAir;
      cwpHighLiq += qc[base] * (1 - iceFracFallback) * mAir;
      qcMeanHigh += (qc[base] + qi[base]) * mAir;
      weightHigh += mAir;
    }
    if (levTop2 !== levTop) {
      const lev = levTop2;
      const base = lev * N + k;
      const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      const mAir = dp / g;
      const pLev = Math.max(pTop, pMid[base]);
      const Pi = Math.pow(pLev / P0, KAPPA);
      const TLev = (T && T[base]) || (theta[base] * Pi);
      const iceFracFallback = clamp01((273 - TLev) / 20);
      cwpHighIce += (qi[base] + qc[base] * iceFracFallback) * mAir;
      cwpHighLiq += qc[base] * (1 - iceFracFallback) * mAir;
      qcMeanHigh += (qc[base] + qi[base]) * mAir;
      weightHigh += mAir;
    }

    qcMeanLow = weightLow > 0 ? qcMeanLow / weightLow : 0;
    qcMeanHigh = weightHigh > 0 ? qcMeanHigh / weightHigh : 0;

    const tauPhysLow = kTauLowLiquid * lwpLow;
    const tauPhysHigh = kTauHighIce * cwpHighIce + kTauHighLiquid * cwpHighLiq;

    const tauLow = Math.min(tauMaxLow, Math.max(0, tauPhysLow));
    const tauHigh = Math.min(tauMaxHigh, Math.max(0, tauPhysHigh));
    if (tauPhysLow > tauMaxLow) {
      tauLowClamp += 1;
      tauLowAbove += 1;
    }
    if (tauPhysHigh > tauMaxHigh) {
      tauHighClamp += 1;
      tauHighAbove += 1;
    }

    const levS = levBot;
    const idxS = levS * N + k;
    const pS = Math.max(pTop, pMid[idxS]);
    const PiS = Math.pow(pS / P0, KAPPA);
    const TSurf = (T && T[idxS]) || (theta[idxS] * PiS);
    const qsSurf = saturationMixingRatio(TSurf, pS);
    const RHlow = Math.max(0, Math.min(2, qv[idxS] / Math.max(1e-8, qsSurf)));

    const idxU = levU * N + k;
    const pU = Math.max(pTop, pMid[idxU]);
    const PiU = Math.pow(pU / P0, KAPPA);
    const TUpper = (T && T[idxU]) || (theta[idxU] * PiU);
    const qsUpper = saturationMixingRatio(TUpper, pU);
    const RHup = Math.max(0, Math.min(2, qv[idxU] / Math.max(1e-8, qsUpper)));

    const omegaBaseL = levS * N + k;
    const omegaNextL = (levS + 1) * N + k;
    const omegaBaseU = levU * N + k;
    const omegaNextU = Math.min(nz, levU + 1) * N + k;
    const omegaL = 0.5 * (omega[omegaBaseL] + omega[omegaNextL]);
    const omegaU = 0.5 * (omega[omegaBaseU] + omega[omegaNextU]);

    let cloudLow = 0;
    let cloudHigh = 0;

    if (enableNewCoverage) {
      let anvil = convAnvil[k] * convAnvilDecay;
      if (convMask && convMask[k] === 1) anvil = 1;
      convAnvil[k] = anvil;

      const rhFactorLow = smoothstep(rhLow0, rhLow1, RHlow);
      const dTheta = theta[levBot2 * N + k] - theta[levBot * N + k];
      const stab = smoothstep(stabLow0K, stabLow1K, dTheta);
      const subs = smoothstep(omegaLowSubs0, omegaLowSubs1, omegaL);
      const noConv = clamp01(1 - convLowSuppress * anvil);
      const cloudLowTarget = clamp01(rhFactorLow * stab * subs * noConv);

      const rhFactorHigh = smoothstep(rhHigh0, rhHigh1, RHup);
      const asc = smoothstep(omegaHigh0, omegaHigh1, -omegaU);
      const convBoost = clamp01(convAnvilBoost * anvil);
      const cloudHighTarget = 1 - (1 - rhFactorHigh * asc) * (1 - rhFactorHigh * convBoost);

      let lowCov = cloudLowCov[k];
      let highCov = cloudHighCov[k];
      lowCov += aLow * (cloudLowTarget - lowCov);
      highCov += aHigh * (cloudHighTarget - highCov);
      lowCov = clamp01(lowCov);
      highCov = clamp01(highCov);
      cloudLowCov[k] = lowCov;
      cloudHighCov[k] = highCov;
      cloudLow = lowCov;
      cloudHigh = highCov;
    } else {
      const cloudLowLegacy = smoothstep(qc0Low, qc1Low, qcMeanLow);
      const cloudHighQc = smoothstep(qc0High, qc1High, qcMeanHigh);
      const cloudHighTau = 1 - Math.exp(-tauHigh / Math.max(1e-6, tau0));
      const cloudHighLegacy = 1 - (1 - cloudHighQc) * (1 - clamp01(wTauHigh) * cloudHighTau);
      cloudLow = cloudLowLegacy;
      cloudHigh = cloudHighLegacy;
      cloudLowCov[k] = cloudLow;
      cloudHighCov[k] = cloudHigh;
    }

    outFields.cwpLow[k] = lwpLow;
    outFields.cwpHigh[k] = cwpHighIce + cwpHighLiq;
    outFields.tauLow[k] = tauLow;
    outFields.tauHigh[k] = tauHigh;
    outFields.cloudLow[k] = cloudLow;
    outFields.cloudHigh[k] = cloudHigh;
    outFields.cloud[k] = 1 - (1 - cloudLow) * (1 - cloudHigh);

    outFields.RH[k] = RHlow;
    outFields.RHU[k] = RHup;
    outFields.omegaL[k] = omegaL;
    outFields.omegaU[k] = omegaU;
  }

  outFields.tauLowClampCount = tauLowClamp;
  outFields.tauHighClampCount = tauHighClamp;
  outFields.tauLowAboveMax = tauLowAbove;
  outFields.tauHighAboveMax = tauHighAbove;

  const lev = Math.min(Math.max(0, levVort), nz - 1);
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
      const kE = row + iE;
      const kW = row + iW;
      const kN = rowN + i;
      const kS = rowS + i;
      const idx0 = base + k;
      const idxE = base + kE;
      const idxW = base + kW;
      const idxN = base + kN;
      const idxS = base + kS;

      const dudx = (u[idxE] - u[idxW]) * 0.5 * invDxRow;
      const dvcos_dy = (v[idxN] * cosN - v[idxS] * cosS) * 0.5 * invDyRow;
      const dvdx = (v[idxE] - v[idxW]) * 0.5 * invDxRow;
      const ducos_dy = (u[idxN] * cosN - u[idxS] * cosS) * 0.5 * invDyRow;

      outFields.div[k] = dudx + dvcos_dy / cosC;
      outFields.vort[k] = dvdx - ducos_dy / cosC;
    }
  }
}
