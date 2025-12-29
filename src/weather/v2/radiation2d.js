import { cosZenith } from '../solar';
import { Cp, Rd, g } from '../constants';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);

const P0 = 100000;
const KAPPA = Rd / Cp;
const DEG2RAD = Math.PI / 180;

export function stepRadiation2D5({ dt, grid, state, timeUTC, params = {} }) {
  if (!grid || !state || !Number.isFinite(dt) || dt <= 0) return;
  const {
    enable = true,
    S0 = 1361,
    kSw = 0.12,
    albedoOcean = 0.06,
    albedoLand = 0.2,
    eps0 = 0.75,
    kWv = 12.0,
    kCld = 0.1,
    tauRadLower = 30 * 86400,
    tauRadUpper = 15 * 86400,
    TeqLowerEqK = 288,
    TeqLowerPoleK = 253,
    TeqUpperEqK = 255,
    TeqUpperPoleK = 235,
    TeqLatShape = 'sin2',
    heatFracLower = 0.65,
    heatFracUpper = 0.35,
    dThetaMaxPerStep = 1.0,
    kTau = 80,
    radIceFactor = 0.7,
    pTop = 20000,
    // New flags to refine vertical profiles
    enableFullColumnLW,
    enableSigmaLWProfile = true,
    enableSwMassDistribution = true
  } = params;
  if (!enable) return;

  const { nx, ny, latDeg, lonDeg } = grid;
  const {
    N,
    nz,
    theta,
    qv,
    qc,
    qi,
    pHalf,
    pMid,
    ps,
    T,
    landMask,
    albedo
  } = state;

  const dayOfYear = (timeUTC / 86400) % 365;
  const levLowA = Math.max(0, nz - 2);
  const levLowB = nz - 1;
  const levHighA = Math.min(1, nz - 1);
  const levHighB = Math.min(2, nz - 1);

  for (let j = 0; j < ny; j++) {
    const lat = latDeg[j];
    const latRad = lat * DEG2RAD;
    const latAbs = Math.abs(lat);
    const latNorm = clamp01(latAbs / 90);
    const sinLat = Math.sin(latRad);
    const latShape = TeqLatShape === 'linear' ? latNorm : sinLat * sinLat;
    const TeqLower = TeqLowerEqK - (TeqLowerEqK - TeqLowerPoleK) * latShape;
    const TeqUpper = TeqUpperEqK - (TeqUpperEqK - TeqUpperPoleK) * latShape;
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const cosZ = cosZenith(latRad, lonDeg[i], timeUTC, dayOfYear);
      const SW_toa = S0 * cosZ;

      let lwpLow = 0;
      let lwpHigh = 0;
      let wvCol = 0;

      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const mAir = dp / g;
        wvCol += qv[idx] * mAir;
        const qcEff = qc[idx] + (qi ? radIceFactor * qi[idx] : 0);
        if (lev === levLowA || lev === levLowB) {
          lwpLow += qcEff * mAir;
        } else if (lev === levHighA || lev === levHighB) {
          lwpHigh += qcEff * mAir;
        }
      }

      const tauCloud = kTau * (lwpLow + lwpHigh);
      const eps = clamp01(eps0 + kWv * (wvCol / 50) + kCld * (tauCloud / 10));

      const albedoVal = albedo && albedo.length === N
        ? albedo[k]
        : (landMask && landMask[k] === 1 ? albedoLand : albedoOcean);

      const SW_sfc = SW_toa * (1 - albedoVal) * Math.exp(-kSw * tauCloud);
      const lwFactorUpper = 0.8 + 0.2 * eps;
      const lwFactorLower = 0.6 + 0.4 * eps;

      // Pre-compute sum of SW weights if distributing by mass across column
      let swWeightSum = 0;
      let swWeights = null;
      const swFracTotal = heatFracLower + heatFracUpper;
      if (enableSwMassDistribution && SW_sfc > 0 && swFracTotal > 0) {
        swWeights = new Array(nz);
        for (let lev = 0; lev < nz; lev++) {
          const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
          const mAir = Math.max(1e-6, dp / g);
          const idxTmp = lev * N + k;
          const pLevTmp = Math.max(pTop, pMid[idxTmp]);
          const sigmaTmp = clamp01((pLevTmp - pTop) / Math.max(1e-6, ps[k] - pTop));
          const shape = 0.4 + 0.6 * sigmaTmp; // bias slightly toward lower troposphere
          const w = mAir * shape;
          swWeights[lev] = w;
          swWeightSum += w;
        }
      }

      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k;
        const pLev = Math.max(pTop, pMid[idx]);
        const PiLev = Math.pow(pLev / P0, KAPPA);
        const TLev = Number.isFinite(T[idx]) ? T[idx] : (theta[idx] * PiLev);

        let dT = 0;

        if (SW_sfc > 0) {
          if (enableSwMassDistribution && swWeights && swWeightSum > 0 && swFracTotal > 0) {
            const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
            const mAir = Math.max(1e-6, dp / g);
            const frac = swWeights[lev] / swWeightSum;
            dT += (SW_sfc * swFracTotal) * frac / (Cp * mAir);
          } else {
            const heatFrac = lev === levLowB ? heatFracLower : lev === levHighB ? heatFracUpper : 0;
            if (heatFrac > 0) {
              const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
              const mAir = Math.max(1e-6, dp / g);
              dT += (SW_sfc * heatFrac) / (Cp * mAir);
            }
          }
        }

        const sigma = clamp01((pLev - pTop) / Math.max(1e-6, ps[k] - pTop));
        const prof = enableSigmaLWProfile ? sigma : (nz > 1 ? lev / (nz - 1) : 1);
        const TeqLev = TeqUpper + (TeqLower - TeqUpper) * prof;
        const tauLev = tauRadUpper + (tauRadLower - tauRadUpper) * prof;
        const lwFactor = lwFactorUpper + (lwFactorLower - lwFactorUpper) * prof;
        dT += -((TLev - TeqLev) / tauLev) * lwFactor;

        let dTheta = (dT * dt) / PiLev;
        dTheta = clamp(dTheta, -dThetaMaxPerStep, dThetaMaxPerStep);
        theta[idx] += dTheta;
      }
    }
  }
}
