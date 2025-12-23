import { Cp, Lv } from './constants';
import { saturationMixingRatio } from './surface';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

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

  const w0 = 0.005;
  const w1 = 0.05;
  const RH0 = 0.82;
  const RH0U = 0.7;
  const C = 0.6e-3;
  const CUpper = 0.4e-3;
  const CStrat = 0.4e-3;
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

    if (w > w0 && rh > RH0) {
      const asc = Math.min(1, w / w1);
      const rhFactor = clamp01((rh - RH0) / (1 - RH0));
      const dq = Math.min(qv[k], qv[k] * asc * rhFactor * C * dt);
      if (dq > 0) {
        qv[k] -= dq;
        qc[k] += dq;
        T[k] += (Lv / Cp) * dq;
      }
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

    if (w < -0.02 && qc[k] > 0 && rh < 0.8) {
      const f = Math.min(1, Math.abs(w) / 0.08);
      const tau = tauSubLowBase - 10 * 3600 * f;
      qc[k] *= Math.exp(-dt / Math.max(1, tau));
    }

    const qsU = saturationMixingRatio(TU[k], 50000);
    const rhU = qvU[k] / Math.max(1e-8, qsU);
    const wU = omegaU[k];
    if (wU > w0 && rhU > RH0U) {
      const ascU = Math.min(1, wU / w1);
      const rhFactorU = clamp01((rhU - RH0U) / (1 - RH0U));
      const dqU = Math.min(qvU[k], qvU[k] * ascU * rhFactorU * CUpper * dt);
      if (dqU > 0) {
        qvU[k] -= dqU;
        qcU[k] += dqU;
        TU[k] += (Lv / Cp) * dqU;
      }
    }

    if (wU < -0.02 && qcU[k] > 0 && rhU < 0.75) {
      const fU = Math.min(1, Math.abs(wU) / 0.08);
      const tauU = tauSubHighBase - 10 * 3600 * fU;
      qcU[k] *= Math.exp(-dt / Math.max(1, tauU));
    }

    qv[k] = Math.max(0, qv[k]);
    qvU[k] = Math.max(0, qvU[k]);
    qc[k] = Math.max(0, qc[k]);
    qcU[k] = Math.max(0, qcU[k]);
  });
}
