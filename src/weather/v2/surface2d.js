import { g, Cp, Lv, Rd } from '../constants';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);

const P0 = 100000;
const KAPPA = Rd / Cp;

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

export function stepSurface2D5({ dt, grid, state, params = {} }) {
  if (!grid || !state || !Number.isFinite(dt) || dt <= 0) return;
  const {
    enable = true,
    rhoAir = 1.2,
    CpAir = Cp,
    Lv: LvAir = Lv,
    Ce = 1.2e-3,
    Ch = 1.0e-3,
    windFloor = 1.0,
    oceanTauTs = 10 * 86400,
    landTauTs = 3 * 86400,
    TsMin = 200,
    TsMax = 330,
    evapMax = 2e-4,
    soilEvapExponent = 1.0,
    runoffEnabled = true,
    enableThetaClosure = true
  } = params;
  if (!enable) return;

  const { N, nz, theta, T, u, v, qv, Ts, soilW, soilCap, landMask, sstNow, precipRate, pHalf, pMid } = state;
  const levS = nz - 1;

  for (let k = 0; k < N; k++) {
    const land = landMask[k] === 1;
    let TsVal = Ts[k];
    const sst = sstNow[k];
    const idxS = levS * N + k;
    const Tair = T[idxS];
    const qvAir = qv[idxS];
    const uS = u[idxS];
    const vS = v[idxS];
    const U = Math.max(windFloor, Math.hypot(uS, vS));
    const pSurf = pMid[idxS];
    const PiS = Math.pow(Math.max(1e-6, pSurf) / P0, KAPPA);
    const qsTs = saturationMixingRatio(TsVal, pSurf);
    const dq = Math.max(0, qsTs - qvAir);
    let E = rhoAir * Ce * U * dq;
    if (E > evapMax) E = evapMax;

    if (land) {
      const cap = Math.max(1e-6, soilCap[k]);
      const avail = clamp01(soilW[k] / cap);
      const limit = Math.pow(avail, soilEvapExponent);
      E *= limit;
    }

    const H = rhoAir * CpAir * Ch * U * (TsVal - Tair);

    if (!land) {
      TsVal += (sst - TsVal) * (dt / oceanTauTs);
    } else {
      TsVal += (288 - TsVal) * (dt / landTauTs);
    }
    TsVal = clamp(TsVal, TsMin, TsMax);
    Ts[k] = TsVal;

    const dp0 = pHalf[(levS + 1) * N + k] - pHalf[levS * N + k];
    const m0 = Math.max(1e-6, dp0 / g);
    const dqv = (E * dt) / m0;
    qv[idxS] += dqv;
    if (enableThetaClosure) {
      // Close the latent and sensible flux loop at least approximately by applying
      // surface flux tendencies to the lowest-layer potential temperature.
      theta[idxS] += (H * dt) / (CpAir * m0 * Math.max(1e-6, PiS));
      theta[idxS] -= (LvAir / CpAir) * (dqv / Math.max(1e-6, PiS));
    }

    if (land) {
      const P = precipRate ? (precipRate[k] / 3600) : 0;
      soilW[k] += (P - E) * dt;
      if (soilW[k] < 0) soilW[k] = 0;
      const cap = soilCap[k];
      if (cap > 0 && soilW[k] > cap) {
        if (runoffEnabled) {
          soilW[k] = cap;
        } else {
          soilW[k] = cap;
        }
      }
    }
  }
}
