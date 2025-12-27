import { Cp, Lv } from './constants';
import { saturationMixingRatio } from './surface';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function stepStratiformClouds({ dt, fields, geo, grid }) {
  const {
    qv,
    qvU,
    qc,
    qcU,
    T,
    TU,
    ps,
    omegaL,
    omegaU
  } = fields;
  const len = qv.length;
  const nx = grid?.nx;
  const ny = grid?.ny;
  const latDeg = grid?.latDeg;
  const landMask = geo?.landMask;
  const sstNow = geo?.sstNow;

  const w0L = 0.0003;
  const w1L = 0.0018;
  const w0U = 0.0025;
  const w1U = 0.013;
  const RH0 = 0.82;
  const RH0U = 0.5;
  const C = 0.6e-3;
  const CUpper = 0.3e-3;
  const CStrat = 0.3e-3;
  const tauSubLowBase = 18 * 3600;
  const tauSubHighBase = 30 * 3600;

  const useGeo = Number.isFinite(nx) && Number.isFinite(ny) && latDeg && landMask && sstNow;
  const loop = useGeo
    ? (fn) => {
        for (let j = 0; j < ny; j++) {
          const latAbs = Math.abs(latDeg[j]);
          const subtropics = clamp01(1 - Math.abs(latAbs - 25) / 20);
          for (let i = 0; i < nx; i++) {
            fn(j * nx + i, subtropics);
          }
        }
      }
    : (fn) => {
        for (let k = 0; k < len; k++) {
          fn(k, 0);
        }
      };

  loop((k, subtropics) => {
    const qs = saturationMixingRatio(T[k], ps[k]);
    const rh = qv[k] / Math.max(1e-8, qs);
    const w = omegaL[k];

    const asc = smoothstep(w0L, w1L, w);
    const rhFactor = smoothstep(RH0, 1.0, rh);
    const dq = Math.min(qv[k], qv[k] * asc * rhFactor * C * dt);
    if (dq > 0) {
      qv[k] -= dq;
      qc[k] += dq;
      T[k] += (Lv / Cp) * dq;
    }

    if (useGeo && landMask[k] === 0) {
      const sst = sstNow[k];
      const stable = TU[k] - T[k];
      const moist = clamp01((rh - 0.7) / 0.25);
      const stableFactor = clamp01((stable - 1.5) / 6);
      const subsidence = clamp01((-w - 0.002) / 0.04);
      const cool = clamp01((299 - sst) / 8);
      const stratFactor = moist * stableFactor * subsidence * cool * subtropics;
      if (stratFactor > 0) {
        const dqStrat = Math.min(qv[k], qv[k] * stratFactor * CStrat * dt);
        if (dqStrat > 0) {
          qv[k] -= dqStrat;
          qc[k] += dqStrat;
          T[k] += (Lv / Cp) * dqStrat;
        }
      }
    }

    if (w < -0.0022 && qc[k] > 0 && rh < 0.8) {
      const f = Math.min(1, Math.abs(w) / 0.003);
      const tau = tauSubLowBase - 6 * 3600 * f;
      qc[k] *= Math.exp(-dt / Math.max(1, tau));
    }

    const qsU = saturationMixingRatio(TU[k], 50000);
    const rhU = qvU[k] / Math.max(1e-8, qsU);
    const wU = omegaU[k];
    const ascU = smoothstep(w0U, w1U, wU);
    const rhFactorU = smoothstep(RH0U, 1.0, rhU);
    const dqU = Math.min(qvU[k], qvU[k] * ascU * rhFactorU * CUpper * dt);
    if (dqU > 0) {
      qvU[k] -= dqU;
      qcU[k] += dqU;
      TU[k] += (Lv / Cp) * dqU;
    }

    if (wU < -0.01 && qcU[k] > 0 && rhU < 0.75) {
      const fU = Math.min(1, Math.abs(wU) / 0.03);
      const tauU = tauSubHighBase - 12 * 3600 * fU;
      qcU[k] *= Math.exp(-dt / Math.max(1, tauU));
    }

    qv[k] = Math.max(0, qv[k]);
    qvU[k] = Math.max(0, qvU[k]);
    qc[k] = Math.max(0, qc[k]);
    qcU[k] = Math.max(0, qcU[k]);
  });
}
