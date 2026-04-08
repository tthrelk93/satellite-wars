import { Cp, Rd, g, Lv } from '../constants.js';

const P0 = 100000;
const KAPPA = Rd / Cp;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
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
  'entrainFrac',
  'detrainTopFrac',
  'buoyTrigK',
  'dThetaMaxConvPerStep',
  'enableLargeScaleVerticalAdvection',
  'verticalAdvectionCflMax',
  'verticalAdvectionSigmaTaperExp',
  'dThetaMaxVertAdvPerStep',
  'enableOmegaMassFix',
  'omegaMassFixSigmaTaperExp',
  'orographicLiftScale',
  'orographicLeeSubsidenceScale',
  'orographicDecayFrac',
  'terrainSlopeRef',
  'terrainDirectionalBlend',
  'terrainLeeOmega0',
  'terrainLeeOmega1',
  'terrainLeeAscentDamp',
  'terrainDeliveryProtectExposure0',
  'terrainDeliveryProtectExposure1',
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

export function stepVertical5({ dt, grid, state, geo, params = {} }) {
  if (!grid || !state) return;
  warnUnknownVerticalParams(params);

  const {
    enableMixing = true,
    enableConvection = true,
    enableConvectiveMixing = false,
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
    omegaTrig = 0.3, // ascent defined as negative omega tail
    instabTrig = 3,
    qvTrig = 0.002,
    thetaeCoeff = 10,
    thetaeQvCap = 0.03,

    // PBL warm rain
    pblWarmRain = true,
    qcAuto0 = 7e-4,
    tauAuto = 4 * 3600,
    autoMaxFrac = 0.2,

    // Plume/detrainment
    entrainFrac = 0.2,
    detrainTopFrac = 0.7,
    buoyTrigK = 0.0,
    dThetaMaxConvPerStep = 2.5,

    // Large-scale vertical advection (omega-based)
    enableLargeScaleVerticalAdvection = true,
    verticalAdvectionCflMax = 0.4,
    verticalAdvectionSigmaTaperExp = 2.0,
    dThetaMaxVertAdvPerStep = 2.0,

    // Omega correction to match applied surface pressure tendency
    enableOmegaMassFix = true,
    omegaMassFixSigmaTaperExp = 2.0,
    orographicLiftScale = 1.0,
    orographicLeeSubsidenceScale = 0.35,
    orographicDecayFrac = 0.35,
    terrainSlopeRef = 0.003,
    terrainDirectionalBlend = 0.05,
    terrainLeeOmega0 = 0.3,
    terrainLeeOmega1 = 2.0,
    terrainLeeAscentDamp = 0.8,
    terrainDeliveryProtectExposure0 = 0.5,
    terrainDeliveryProtectExposure1 = 8.0,

    // Numerical/heating
    eps = 1e-12
  } = params;

  const { nx, ny, invDx, invDy, cosLat } = grid;
  const { N, nz, u, v, omega, theta, qv, qc, qi, qr, T, pHalf, pMid, sigmaHalf, dpsDtApplied } = state;

  // Convective column mask (boolean per column) for microphysics overrides
  if (!state.convMask || state.convMask.length !== N) state.convMask = new Uint8Array(N);
  const convMask = state.convMask;
  convMask.fill(0);

  if (!state.terrainFlowForcing || state.terrainFlowForcing.length !== N) {
    state.terrainFlowForcing = new Float32Array(N);
  }
  if (!state.terrainSlopeFactor || state.terrainSlopeFactor.length !== N) {
    state.terrainSlopeFactor = new Float32Array(N);
  }
  if (!state.terrainOmegaSurface || state.terrainOmegaSurface.length !== N) {
    state.terrainOmegaSurface = new Float32Array(N);
  }
  if (!state.orographicDeliveryAccum || state.orographicDeliveryAccum.length !== N) {
    state.orographicDeliveryAccum = new Float32Array(N);
  }
  if (!state.orographicDeliveryExposureAccum || state.orographicDeliveryExposureAccum.length !== N) {
    state.orographicDeliveryExposureAccum = new Float32Array(N);
  }
  if (!state.orographicDeliveryLastStep || state.orographicDeliveryLastStep.length !== N) {
    state.orographicDeliveryLastStep = new Float32Array(N);
  }
  if (!state.orographicDeliveryActiveSteps || state.orographicDeliveryActiveSteps.length !== N) {
    state.orographicDeliveryActiveSteps = new Uint32Array(N);
  }
  if (!state.terrainLeeNoDelivery || state.terrainLeeNoDelivery.length !== N) {
    state.terrainLeeNoDelivery = new Float32Array(N);
  }
  const terrainFlowForcingDiag = state.terrainFlowForcing;
  const terrainSlopeFactorDiag = state.terrainSlopeFactor;
  const terrainOmegaSurfaceDiag = state.terrainOmegaSurface;
  const terrainLeeNoDeliveryDiag = state.terrainLeeNoDelivery;
  const orographicDeliveryAccum = state.orographicDeliveryAccum;
  const orographicDeliveryExposureAccum = state.orographicDeliveryExposureAccum;
  const orographicDeliveryLastStep = state.orographicDeliveryLastStep;
  const orographicDeliveryActiveSteps = state.orographicDeliveryActiveSteps;
  terrainFlowForcingDiag.fill(0);
  terrainSlopeFactorDiag.fill(0);
  terrainOmegaSurfaceDiag.fill(0);
  terrainLeeNoDeliveryDiag.fill(0);
  orographicDeliveryLastStep.fill(0);

  let convectiveColumnsCount = 0;
  let totalCondensed = 0;
  let totalDetrainedQc = 0;
  let totalRainProduced = 0;
  let nOmegaPos = 0;
  let convTopLevMean = null;
  let convCondMassMean = 0;
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

  const elevField = geo?.elev && geo.elev.length === N ? geo.elev : null;
  if (elevField && orographicLiftScale !== 0) {
    const levS = nz - 1;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const slopeXLocal = (elevField[row + iE] - elevField[row + iW]) * 0.5 * invDxRow;
        const slopeYLocal = (elevField[rowN + i] - elevField[rowS + i]) * 0.5 * invDyRow;
        const idxS = levS * N + k;
        const directionalBlend = clamp(terrainDirectionalBlend, 0, 1);
        let slopeMag = Math.hypot(slopeXLocal, slopeYLocal);
        let terrainNormalFlow = u[idxS] * slopeXLocal + v[idxS] * slopeYLocal;
        if (directionalBlend > 0) {
          const iE2 = (i + 2) % nx;
          const iW2 = (i - 2 + nx) % nx;
          const jN2 = Math.max(0, j - 2);
          const jS2 = Math.min(ny - 1, j + 2);
          const rowN2 = jN2 * nx;
          const rowS2 = jS2 * nx;
          const slopeXBroad = (elevField[row + iE2] - elevField[row + iW2]) * 0.25 * invDxRow;
          const slopeYBroad = (elevField[rowN2 + i] - elevField[rowS2 + i]) * 0.25 * invDyRow;
          const terrainNormalFlowBroad = u[idxS] * slopeXBroad + v[idxS] * slopeYBroad;
          terrainNormalFlow += (terrainNormalFlowBroad - terrainNormalFlow) * directionalBlend;
          const slopeMagBroad = Math.hypot(slopeXBroad, slopeYBroad);
          slopeMag += (slopeMagBroad - slopeMag) * directionalBlend;
        }
        const slopeFactor = clamp(slopeMag / Math.max(1e-6, terrainSlopeRef), 0, 3);
        const nearSurfaceT = Math.max(180, T[idxS]);
        const rho = Math.max(0.2, pMid[idxS] / Math.max(1e-6, Rd * nearSurfaceT));
        const leeScale = clamp(orographicLeeSubsidenceScale, 0, 1);
        const terrainFlowForcing = terrainNormalFlow >= 0
          ? terrainNormalFlow
          : terrainNormalFlow * leeScale;
        const wTerrain = terrainFlowForcing * slopeFactor;
        const omegaTerrain = -rho * g * wTerrain * orographicLiftScale;
        terrainFlowForcingDiag[k] = terrainFlowForcing;
        terrainSlopeFactorDiag[k] = slopeFactor;
        terrainOmegaSurfaceDiag[k] = omegaTerrain;
        for (let lev = 1; lev <= nz; lev++) {
          const decay = Math.exp(-Math.max(0, levS - (lev - 1)) * orographicDecayFrac);
          omega[lev * N + k] += omegaTerrain * decay;
        }
      }
    }
  }

  for (let k = 0; k < N; k++) {
    const terrainLeeBase = smoothstep(
      terrainLeeOmega0,
      terrainLeeOmega1,
      Number.isFinite(terrainOmegaSurfaceDiag[k]) ? terrainOmegaSurfaceDiag[k] : 0
    );
    const deliveryProtect = smoothstep(
      terrainDeliveryProtectExposure0,
      terrainDeliveryProtectExposure1,
      Number.isFinite(orographicDeliveryExposureAccum[k]) ? orographicDeliveryExposureAccum[k] : 0
    );
    terrainLeeNoDeliveryDiag[k] = clamp(terrainLeeBase * (1 - deliveryProtect), 0, 1);
  }

  if (
    enableOmegaMassFix &&
    sigmaHalf &&
    sigmaHalf.length >= nz + 1 &&
    dpsDtApplied &&
    dpsDtApplied.length === N
  ) {
    for (let k = 0; k < N; k++) {
      const omegaSurf = omega[nz * N + k];
      const target = dpsDtApplied[k];
      if (!Number.isFinite(omegaSurf) || !Number.isFinite(target)) continue;
      const delta = target - omegaSurf;
      if (delta === 0) continue;
      const taperExp = Math.max(0, omegaMassFixSigmaTaperExp);
      for (let lev = 0; lev <= nz; lev++) {
        const sigma = clamp01(sigmaHalf[lev]);
        const weight = taperExp > 0 ? Math.pow(sigma, taperExp) : sigma;
        omega[lev * N + k] += delta * weight;
      }
    }
  }

  if (enableLargeScaleVerticalAdvection && dt > 0) {
    const cflMax = clamp(verticalAdvectionCflMax, 0, 1);
    if (cflMax > 0) {
      if (!state._vertAdvQv || state._vertAdvQv.length !== qv.length) {
        state._vertAdvQv = new Float32Array(qv.length);
      }
      if (!state._vertAdvTheta || state._vertAdvTheta.length !== theta.length) {
        state._vertAdvTheta = new Float32Array(theta.length);
      }
      const qvNext = state._vertAdvQv;
      const thetaNext = state._vertAdvTheta;
      const taperExp = Math.max(0, verticalAdvectionSigmaTaperExp);
      const lowLevelStart = Math.max(0, nz - 4);
      for (let k = 0; k < N; k++) {
        let columnDelivery = 0;
        let columnExposure = 0;
        const terrainFlowForcing = terrainFlowForcingDiag[k];
        for (let lev = 0; lev < nz; lev++) {
          const idx = lev * N + k;
          let qvUpdated = qv[idx];
          let thetaUpdated = theta[idx];
          const omegaTop = omega[lev * N + k];
          const omegaBot = omega[(lev + 1) * N + k];
          const omegaMidRaw = 0.5 * (omegaTop + omegaBot);
          const sigmaMid = sigmaHalf && sigmaHalf.length > lev + 1
            ? clamp01(0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]))
            : 1;
          const transportScale = taperExp > 0 ? Math.pow(sigmaMid, taperExp) : 1;
          const leeNoDelivery = lev >= lowLevelStart ? terrainLeeNoDeliveryDiag[k] : 0;
          const ascentDamp = 1 - leeNoDelivery * clamp(terrainLeeAscentDamp, 0, 1);
          const omegaMid = omegaMidRaw < 0 ? omegaMidRaw * ascentDamp : omegaMidRaw;

          if (omegaMid < 0 && lev < nz - 1) {
            const idxBelow = (lev + 1) * N + k;
            const dpNeighbor = pMid[idxBelow] - pMid[idx];
            if (dpNeighbor > 0) {
              const frac = clamp(((-omegaMid) * dt * transportScale) / dpNeighbor, 0, cflMax);
              const qvDelta = frac * (qv[idxBelow] - qv[idx]);
              qvUpdated += qvDelta;
              thetaUpdated += frac * (theta[idxBelow] - theta[idx]);
              if (terrainFlowForcing > 0 && lev >= lowLevelStart) {
                columnExposure += (-omegaMid) * dt;
                if (qvDelta > 0) {
                  const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
                  if (dpLev > 0) {
                    columnDelivery += qvDelta * (dpLev / g);
                  }
                }
              }
            }
          } else if (omegaMid > 0 && lev > 0) {
            const idxAbove = (lev - 1) * N + k;
            const dpNeighbor = pMid[idx] - pMid[idxAbove];
            if (dpNeighbor > 0) {
              const frac = clamp((omegaMid * dt * transportScale) / dpNeighbor, 0, cflMax);
              qvUpdated += frac * (qv[idxAbove] - qv[idx]);
              thetaUpdated += frac * (theta[idxAbove] - theta[idx]);
            }
          }

          qvNext[idx] = Math.max(0, qvUpdated);
          if (dThetaMaxVertAdvPerStep > 0) {
            const dTheta = thetaUpdated - theta[idx];
            thetaNext[idx] =
              theta[idx] + clamp(dTheta, -dThetaMaxVertAdvPerStep, dThetaMaxVertAdvPerStep);
          } else {
            thetaNext[idx] = thetaUpdated;
          }
        }
        orographicDeliveryLastStep[k] = columnDelivery;
        if (terrainFlowForcing > 0 && columnExposure > 0) {
          orographicDeliveryExposureAccum[k] += columnExposure;
          if (columnDelivery > 0) {
            orographicDeliveryAccum[k] += columnDelivery;
            orographicDeliveryActiveSteps[k] += 1;
          }
        }
      }
      qv.set(qvNext);
      theta.set(thetaNext);
      for (let m = 0; m < qv.length; m++) {
        if (qv[m] < 0) qv[m] = 0;
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
    const muMax = clamp01(mu0);
    const entrain = clamp01(entrainFrac);
    const detrainTop = clamp01(detrainTopFrac);
    let convTopLevSum = 0;
    let convPlumeCount = 0;
    let convCondMassSum = 0;
    let totalWeightAll = 0;
    for (let j = 0; j < ny; j++) {
      totalWeightAll += cosLat[j] * nx;
    }

    const detrainAt = (k, lev, condMassLev) => {
      if (condMassLev <= 0) return 0;
      const idx = lev * N + k;
      const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      if (dpLev <= 0) return 0;
      const massLev = dpLev / g;
      let dqDetrain = condMassLev / massLev;
      const pLev = Math.max(100, pMid[idx]);
      const PiLev = Math.pow(pLev / P0, KAPPA);
      const dTheta = (Lv / Cp * dqDetrain) / PiLev;
      if (dThetaMaxConvPerStep > 0 && dTheta > dThetaMaxConvPerStep) {
        const scale = dThetaMaxConvPerStep / dTheta;
        dqDetrain *= scale;
      }
      qc[idx] += dqDetrain;
      theta[idx] += (Lv / Cp * dqDetrain) / PiLev;
      return dqDetrain * massLev;
    };

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

      const leeNoDelivery = terrainLeeNoDeliveryDiag[k];
      const ascentDamp = 1 - leeNoDelivery * clamp(terrainLeeAscentDamp, 0, 1);
      const omegaLowRaw = omega[levS * N + k];
      const omegaLow = omegaLowRaw < 0 ? omegaLowRaw * ascentDamp : omegaLowRaw;
      if (omegaLow < 0) omegaPos[nOmegaPos++] = -omegaLow;
      const ascent = -omegaLow > omegaThreshDynamic; // ascent based on negative tail

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

      const mu = Number.isFinite(tauConv) && tauConv > 0
        ? clamp(dt / Math.max(tauConv, eps), 0, muMax)
        : muMax;

      if (enableConvectiveMixing) {
        if (mu > 0) {
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
          }
        }
      } else if (mu > 0) {
        const dpSurface = pHalf[(levS + 1) * N + k] - pHalf[levS * N + k];
        const massSurface = dpSurface / g;
        let thetaP = theta[idxS];
        let qvP = qv[idxS];
        let qCondTotal = 0;
        let plumeTopLev = levS;

        for (let lev = levS - 1; lev >= 0; lev--) {
          const idxEnv = lev * N + k;
          const thetaEnv = theta[idxEnv];
          const qvEnv = qv[idxEnv];
          thetaP = (1 - entrain) * thetaP + entrain * thetaEnv;
          qvP = (1 - entrain) * qvP + entrain * qvEnv;

          const pLev = Math.max(100, pMid[idxEnv]);
          const Pi = Math.pow(pLev / P0, KAPPA);
          let Tparcel = thetaP * Pi;
          const qs = saturationMixingRatio(Tparcel, pLev);
          if (qvP > qs) {
            const dq = qvP - qs;
            qvP -= dq;
            qCondTotal += dq;
            thetaP += (Lv / Cp * dq) / Pi;
            Tparcel = thetaP * Pi;
          }
          const Tenv = thetaEnv * Pi;
          const buoyK = Tparcel - Tenv;
          if (buoyK < buoyTrigK) break;
          plumeTopLev = lev;
        }

        if (plumeTopLev <= levS - 1) {
          convTopLevSum += plumeTopLev;
          convPlumeCount++;
        }

        if (plumeTopLev <= levS - 1 && qCondTotal > 0 && massSurface > 0) {
          const condMass = mu * qCondTotal * massSurface;
          const levTop = plumeTopLev;
          const levBelow = Math.min(levTop + 1, levS);
          const topFrac = detrainTop;
          const belowFrac = levBelow === levTop ? 0 : 1 - topFrac;

          let usedMass = detrainAt(k, levTop, condMass * topFrac);
          if (belowFrac > 0) {
            usedMass += detrainAt(k, levBelow, condMass * belowFrac);
          }
          if (usedMass > 0) {
            const dqSrc = usedMass / massSurface;
            qv[idxS] = Math.max(0, qv[idxS] - dqSrc);
            const j = Math.floor(k / nx);
            convCondMassSum += usedMass * cosLat[j];
            totalCondensed += usedMass;
            totalDetrainedQc += usedMass;
          }
        }
      }
    }

    convTopLevMean = convPlumeCount > 0 ? convTopLevSum / convPlumeCount : null;
    convCondMassMean = totalWeightAll > 0 ? convCondMassSum / totalWeightAll : 0;
  }

  // Positivity guards
  const len3d = theta.length;
  for (let m = 0; m < len3d; m++) {
    qv[m] = Math.max(0, qv[m]);
    qc[m] = Math.max(0, qc[m]);
    qi[m] = Math.max(0, qi[m]);
    qr[m] = Math.max(0, qr[m]);
  }

  let omegaSurfMinusDpsDtRms = null;
  if (dpsDtApplied && dpsDtApplied.length === N) {
    let sumSq = 0;
    let count = 0;
    const omegaSurfaceBase = nz * N;
    for (let k = 0; k < N; k++) {
      const omegaSurf = omega[omegaSurfaceBase + k];
      const target = dpsDtApplied[k];
      if (!Number.isFinite(omegaSurf) || !Number.isFinite(target)) continue;
      const diff = omegaSurf - target;
      sumSq += diff * diff;
      count++;
    }
    omegaSurfMinusDpsDtRms = count > 0 ? Math.sqrt(sumSq / count) : null;
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
    convectiveFraction: convectiveColumnsCount / Math.max(1, N),
    convTopLevMean,
    convCondMassTotalKgM2: convCondMassMean,
    omegaSurfMinusDpsDtRms
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
