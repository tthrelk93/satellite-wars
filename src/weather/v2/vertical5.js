import { Cp, Rd, g } from '../constants';

const P0 = 100000;
const KAPPA = Rd / Cp;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const VERTICAL_ALLOWED_PARAMS = new Set([
  'enableMixing',
  'enableConvection',
  'enableConvectiveMixing',
  'enableConvectiveOutcome',
  'mu0',
  'tauConv',
  'tauPblUnstable',
  'tauPblStable',
  'pblDepthFrac',
  'maxMixFracPbl',
  'pblTaper',
  'pblMixCondensate',
  'pblCondMixScale',
  'rhTrig',
  'rhMidMin',
  'omegaTrig',
  'instabTrig',
  'qvTrig',
  'thetaeCoeff',
  'thetaeQvCap',
  'pblWarmRain',
  'qcAuto0',
  'tauAuto',
  'autoMaxFrac',
  'eps',
  'debugConservation'
]);
const verticalWarnedParams = new Set();
const warnUnknownVerticalParams = (params) => {
  if (!params || typeof params !== 'object') return;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  const unknown = Object.keys(params).filter(
    (key) => !VERTICAL_ALLOWED_PARAMS.has(key) && !verticalWarnedParams.has(key)
  );
  if (!unknown.length) return;
  unknown.forEach((key) => verticalWarnedParams.add(key));
  console.warn(`[V2 vertical] Unknown params: ${unknown.join(', ')}`);
};

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

export function stepVertical5({ dt, grid, state, params = {} }) {
  if (!grid || !state) return;
  warnUnknownVerticalParams(params);

  const {
    enableMixing = true,
    enableConvection = true,
    enableConvectiveMixing = true,
    enableConvectiveOutcome = false,
    // Deep convection strength: either a fixed per-step parcel mass fraction (mu0),
    // or dt-scaled via tauConv (preferred for stability across dt).
    mu0 = 0.05,
    tauConv = 2 * 3600,

    // PBL mixing
    // PBL mixing (timescale-based)
    tauPblUnstable = 6 * 3600,
    tauPblStable = 2 * 86400,
    pblDepthFrac = 0.35,
    maxMixFracPbl = 0.2,
    pblTaper = 0.85,
    pblMixCondensate = true,
    pblCondMixScale = 0.35,

    // Deep convection triggers
    rhTrig = 0.75,
    rhMidMin = 0.25,
    omegaTrig = 0.3, // ascent defined as positive omega tail
    instabTrig = 3,
    qvTrig = 0.002,
    thetaeCoeff = 10,
    thetaeQvCap = 0.03,

    // PBL warm rain
    pblWarmRain = true,
    qcAuto0 = 7e-4,
    tauAuto = 4 * 3600,
    autoMaxFrac = 0.2,

    // Numerical/heating
    eps = 1e-12
  } = params;

  const { nx, ny, invDx, invDy, cosLat } = grid;
  const { N, nz, u, v, omega, theta, qv, qc, qi, qr, pHalf, pMid } = state;

  // Convective column mask (boolean per column) for microphysics overrides
  if (!state.convMask || state.convMask.length !== N) state.convMask = new Uint8Array(N);
  const convMask = state.convMask;
  convMask.fill(0);

  let convectiveColumnsCount = 0;
  let totalCondensed = 0;
  let totalDetrainedQc = 0;
  let totalRainProduced = 0;
  let nOmegaPos = 0;
  const debugConservation = params.debugConservation;
  const sampleCols = debugConservation ? 8 : 0;
  if (sampleCols > 0 && !state._waterSample) state._waterSample = new Float32Array(sampleCols);
  const waterBefore = sampleCols > 0 ? state._waterSample : null;
  if (waterBefore) {
    for (let s = 0; s < sampleCols; s++) {
      const k = Math.min(N - 1, Math.floor((N / sampleCols) * s));
      let w = 0;
      for (let lev = 0; lev < nz; lev++) {
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const idx = lev * N + k;
        w += (qv[idx] + qc[idx] + qi[idx] + qr[idx]) * (dp / g);
      }
      waterBefore[s] = w;
    }
  }

  // Omega diagnostic at interfaces
  for (let idx = 0; idx < N; idx++) omega[idx] = 0;
  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    const omegaBase = lev * N;
    const omegaNext = (lev + 1) * N;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const cosC = cosLat[j];
      const cosN = cosLat[jN];
      const cosS = cosLat[jS];
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const kE = row + iE;
        const kW = row + iW;
        const kN = rowN + i;
        const kS = rowS + i;
        const du_dx = (u[base + kE] - u[base + kW]) * 0.5 * invDxRow;
        const dvcos_dy = (v[base + kN] * cosN - v[base + kS] * cosS) * 0.5 * invDyRow;
        const div = du_dx + dvcos_dy / cosC;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        omega[omegaNext + k] = omega[omegaBase + k] - div * dp;
      }
    }
  }

  // Always-on PBL mixing (near-surface stability-dependent, depth-aware)
  if (enableMixing) {
    if (nz >= 2) {
      if (!state._pblTopIndex) state._pblTopIndex = new Uint16Array(N);
      const pblTopIndex = state._pblTopIndex;
      for (let k = 0; k < N; k++) {
        const pSurf = pHalf[nz * N + k];
        const pTop = pHalf[k]; // interface at model top
        const pTopPbl = pSurf - pblDepthFrac * (pSurf - pTop);
        let levTopPbl = nz - 1;
        for (let lev = nz - 1; lev >= 0; lev--) {
          if (pMid[lev * N + k] < pTopPbl) {
            levTopPbl = Math.min(nz - 1, lev + 1);
            break;
          }
        }
        pblTopIndex[k] = levTopPbl;
        if (levTopPbl >= nz - 1) continue; // only surface in PBL

        for (let lev = nz - 1; lev > levTopPbl; lev--) {
          const levBelow = lev;
          const levAbove = lev - 1;
          const idxB = levBelow * N + k;
          const idxA = levAbove * N + k;
          const dpB = pHalf[(levBelow + 1) * N + k] - pHalf[levBelow * N + k];
          const dpA = pHalf[levBelow * N + k] - pHalf[levAbove * N + k];
          const stable = theta[idxA] > theta[idxB];
          const tau = stable ? tauPblStable : tauPblUnstable;
          const mixFracBase = clamp(dt / Math.max(tau, eps), 0, maxMixFracPbl);
          const h = (nz - 1 - lev) / Math.max(1, nz - 1 - levTopPbl); // 0 at surface, 1 near PBL top
          let mixFrac = mixFracBase * (1 - pblTaper * h);
          mixFrac = clamp(mixFrac, 0, maxMixFracPbl);

          const denom = Math.max(1e-6, dpA + dpB);
          const thetaMean = (theta[idxA] * dpA + theta[idxB] * dpB) / denom;
          theta[idxA] += mixFrac * (thetaMean - theta[idxA]);
          theta[idxB] += mixFrac * (thetaMean - theta[idxB]);

          const qvMean = (qv[idxA] * dpA + qv[idxB] * dpB) / denom;
          qv[idxA] += mixFrac * (qvMean - qv[idxA]);
          qv[idxB] += mixFrac * (qvMean - qv[idxB]);

          if (pblMixCondensate) {
            const mixFracC = mixFrac * pblCondMixScale;
            const qcMean = (qc[idxA] * dpA + qc[idxB] * dpB) / denom;
            qc[idxA] += mixFracC * (qcMean - qc[idxA]);
            qc[idxB] += mixFracC * (qcMean - qc[idxB]);

            const qiMean = (qi[idxA] * dpA + qi[idxB] * dpB) / denom;
            qi[idxA] += mixFracC * (qiMean - qi[idxA]);
            qi[idxB] += mixFracC * (qiMean - qi[idxB]);

            const qrMean = (qr[idxA] * dpA + qr[idxB] * dpB) / denom;
            qr[idxA] += mixFracC * (qrMean - qr[idxA]);
            qr[idxB] += mixFracC * (qrMean - qr[idxB]);
          }
        }
      }
      // Warm-rain autoconversion in PBL layers
      if (pblWarmRain) {
        const fracAuto = clamp(dt / Math.max(tauAuto, eps), 0, autoMaxFrac);
        for (let k = 0; k < N; k++) {
          const levTopPbl = clamp(pblTopIndex ? pblTopIndex[k] : nz - 1, 0, nz - 1);
          if (levTopPbl >= nz) continue;
          for (let lev = levTopPbl; lev < nz; lev++) {
            const idx = lev * N + k;
            if (qc[idx] > qcAuto0) {
              const dq = fracAuto * (qc[idx] - qcAuto0);
              qc[idx] -= dq;
              qr[idx] += dq;
              state.pblAutoConvertedTotal = (state.pblAutoConvertedTotal || 0) + dq;
            }
          }
        }
      }
      // clamp only PBL-mixed layers
      for (let k = 0; k < N; k++) {
        const levTopPbl = clamp(pblTopIndex ? pblTopIndex[k] : nz - 1, 0, nz - 1);
        for (let lev = levTopPbl; lev < nz; lev++) {
          const idx = lev * N + k;
          qv[idx] = Math.max(0, qv[idx]);
          qc[idx] = Math.max(0, qc[idx]);
          qi[idx] = Math.max(0, qi[idx]);
          qr[idx] = Math.max(0, qr[idx]);
        }
      }
    }
  }

  // Deep convection with entrainment/detrainment
  if (enableConvection) {
    // scratch arrays for percentiles (allocated once on state)
    if (!state._omegaPosScratch) state._omegaPosScratch = new Float32Array(N);
    if (!state._instabScratch) state._instabScratch = new Float32Array(N);
    const omegaPos = state._omegaPosScratch;
    const instabArr = state._instabScratch;
    nOmegaPos = 0;
    const omegaThreshDynamic = Math.max(omegaTrig, state.vertMetrics?.omegaPosP90 || 0);

    for (let k = 0; k < N; k++) {
      const levS = nz - 1;
      const levM = Math.max(1, Math.floor(nz / 2));
      const convTopLev = 1;
      const idxS = levS * N + k;
      const idxM = levM * N + k;

      const p1 = Math.max(100, pHalf[levS * N + k]);
      const p2 = Math.max(100, pHalf[(levS + 1) * N + k]);
      const pMidS = Math.sqrt(p1 * p2);
      const PiS = Math.pow(pMidS / P0, KAPPA);
      const TS = theta[idxS] * PiS;
      const qsS = saturationMixingRatio(TS, pMidS);
      const qvS = qv[idxS];
      const rhS = qvS / Math.max(qsS, eps);

      const omegaLow = omega[levS * N + k];
      if (omegaLow > 0) omegaPos[nOmegaPos++] = omegaLow;
      const ascent = omegaLow > omegaThreshDynamic; // ascent based on positive tail

      const pMidM = Math.max(100, pMid[idxM]);
      const PiM = Math.pow(pMidM / P0, KAPPA);
      const TM = theta[idxM] * PiM;
      const qsMid = saturationMixingRatio(TM, pMidM);
      const rhMid = qv[idxM] / Math.max(qsMid, eps);
      const qvThetaeS = Math.min(qvS, thetaeQvCap);
      const qvThetaeM = Math.min(qv[idxM], thetaeQvCap);
      const thetaeS = theta[idxS] * (1 + thetaeCoeff * qvThetaeS);
      const thetaeM = theta[idxM] * (1 + thetaeCoeff * qvThetaeM);
      const instab = thetaeS - thetaeM;
      instabArr[k] = instab;

      if (!(qvS > qvTrig && rhS > rhTrig && rhMid > rhMidMin && ascent && instab > instabTrig)) continue;

      convectiveColumnsCount++;
      convMask[k] = 1;

      // Convective overturning as conservative vertical mixing (optional):
      // - Conserves column-integrated theta/qv/qc/qi/qr (up to clamp/roundoff)
      // - Relies on microphysics for condensation/precip after the vertical step
      if (enableConvectiveMixing) {
        const muMax = clamp01(mu0);
        const mu = Number.isFinite(tauConv) && tauConv > 0
          ? clamp(dt / Math.max(tauConv, eps), 0, muMax)
          : muMax;
        if (mu > 0) {
          const mixCondensate = true;
          const mixFracC = 0.6 * mu;

          for (let lev = levS; lev > convTopLev; lev--) {
            const levBelow = lev;
            const levAbove = lev - 1;
            const idxB = levBelow * N + k;
            const idxA = levAbove * N + k;

            const dpB = pHalf[(levBelow + 1) * N + k] - pHalf[levBelow * N + k];
            const dpA = pHalf[(levAbove + 1) * N + k] - pHalf[levAbove * N + k];
            const denom = Math.max(1e-6, dpA + dpB);

            const thetaMean = (theta[idxA] * dpA + theta[idxB] * dpB) / denom;
            theta[idxA] += mu * (thetaMean - theta[idxA]);
            theta[idxB] += mu * (thetaMean - theta[idxB]);

            const qvMean = (qv[idxA] * dpA + qv[idxB] * dpB) / denom;
            qv[idxA] += mu * (qvMean - qv[idxA]);
            qv[idxB] += mu * (qvMean - qv[idxB]);

            if (mixCondensate) {
              const qcMean = (qc[idxA] * dpA + qc[idxB] * dpB) / denom;
              qc[idxA] += mixFracC * (qcMean - qc[idxA]);
              qc[idxB] += mixFracC * (qcMean - qc[idxB]);

              const qiMean = (qi[idxA] * dpA + qi[idxB] * dpB) / denom;
              qi[idxA] += mixFracC * (qiMean - qi[idxA]);
              qi[idxB] += mixFracC * (qiMean - qi[idxB]);

              const qrMean = (qr[idxA] * dpA + qr[idxB] * dpB) / denom;
              qr[idxA] += mixFracC * (qrMean - qr[idxA]);
              qr[idxB] += mixFracC * (qrMean - qr[idxB]);
            }
          }
        }
      }
    }
  }

  // Positivity guards
  const len3d = theta.length;
  for (let m = 0; m < len3d; m++) {
    qv[m] = Math.max(0, qv[m]);
    qc[m] = Math.max(0, qc[m]);
    qi[m] = Math.max(0, qi[m]);
    qr[m] = Math.max(0, qr[m]);
  }

  // Metrics helpers for tuning and logging
  const percentile = (arr, n, p) => {
    const count = Math.min(n, arr.length);
    if (count <= 0) return 0;
    const view = arr.subarray(0, count);
    view.sort();
    const idx = clamp(Math.floor((count - 1) * p), 0, count - 1);
    return view[idx];
  };
  const omegaView = state._omegaPosScratch || new Float32Array(0);
  const instabView = state._instabScratch || new Float32Array(0);
  const omegaP50 = percentile(omegaView, nOmegaPos, 0.5);
  const omegaP90 = percentile(omegaView, nOmegaPos, 0.9);
  const omegaP95 = percentile(omegaView, nOmegaPos, 0.95);
  const instabP50 = percentile(instabView, N, 0.5);
  const instabP90 = percentile(instabView, N, 0.9);
  const instabP95 = percentile(instabView, N, 0.95);

  state.convectiveColumnsCount = convectiveColumnsCount;
  state.totalCondensed = totalCondensed;
  state.totalDetrainedQc = totalDetrainedQc;
  state.totalRainProduced = totalRainProduced;
  state.vertMetrics = {
    omegaPosP50: omegaP50,
    omegaPosP90: omegaP90,
    omegaPosP95: omegaP95,
    instabP50,
    instabP90,
    instabP95,
    convectiveFraction: convectiveColumnsCount / Math.max(1, N)
  };

  if (sampleCols > 0 && waterBefore) {
    for (let s = 0; s < sampleCols; s++) {
      const k = Math.min(N - 1, Math.floor((N / sampleCols) * s));
      let w = 0;
      for (let lev = 0; lev < nz; lev++) {
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const idx = lev * N + k;
        w += (qv[idx] + qc[idx] + qi[idx] + qr[idx]) * (dp / g);
      }
      const delta = Math.abs(w - waterBefore[s]);
      if (delta > 1e-6) {
        console.warn(`[V2 vertical] water non-conservation sample k=${k} delta=${delta.toExponential(3)}`);
        break;
      }
    }
  }
}
