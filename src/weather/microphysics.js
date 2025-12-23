// microphysics.js: saturation, condensation, warm-rain (Kessler-like)
import { Cp, Lv } from './constants';
import { saturationMixingRatio } from './surface';

export function stepMicrophysics({ dt, fields }) {
  const { T, qv, qc, qr, ps } = fields;
  const len = T.length;

  const qc0 = 1e-3; // autoconversion threshold kg/kg
  const kAuto = 1.5e-3;
  const kEvap = 0.6;
  const kFall = 0.4;
  const kCloudEvap = 0.5; // 1/s (tunable)

  for (let k = 0; k < len; k++) {
    const qs = saturationMixingRatio(T[k], ps[k]);
    // Condensation / evaporation between vapor and cloud
    if (qv[k] > qs) {
      const dq = qv[k] - qs;
      qv[k] -= dq;
      qc[k] += dq;
      T[k] += (Lv / Cp) * dq;
    } else if (qv[k] < qs && qc[k] > 0) {
      const dq = Math.min(qc[k], (qs - qv[k]) * kCloudEvap * dt);
      qv[k] += dq;
      qc[k] -= dq;
      T[k] -= (Lv / Cp) * dq;
    }

    // Autoconversion cloud -> rain
    if (qc[k] > qc0) {
      const excess = qc[k] - qc0;
      const rain = excess * kAuto * dt;
      qc[k] -= rain;
      qr[k] += rain;
    }

    // Rain evaporation if subsaturated
    const qs2 = saturationMixingRatio(T[k], ps[k]);
    const RH = Math.min(1, qv[k] / Math.max(1e-8, qs2));
    if (RH < 0.9 && qr[k] > 0) {
      const ev = Math.min(qr[k], kEvap * (1 - RH) * dt);
      qr[k] -= ev;
      qv[k] += ev;
      T[k] -= (Lv / Cp) * ev;
    }

    // Fallout
    const fall = qr[k] * kFall * dt;
    qr[k] = Math.max(0, qr[k] - fall);
    // precipRate updated elsewhere (diagnostics)

    // Clamp
    qv[k] = Math.max(0, qv[k]);
    qc[k] = Math.max(0, qc[k]);
    qr[k] = Math.max(0, qr[k]);
  }
}

export function stepUpperCloudMicrophysics({ dt, fields }) {
  const { TU, qvU, qcU } = fields;
  const len = TU.length;
  const P_UPPER = 50000;
  const kCloudEvap = 0.2;
  const tauAnvil = 36 * 3600;

  for (let k = 0; k < len; k++) {
    const qs = saturationMixingRatio(TU[k], P_UPPER);
    if (qvU[k] > qs) {
      const dq = qvU[k] - qs;
      qvU[k] -= dq;
      qcU[k] += dq;
      TU[k] += (Lv / Cp) * dq;
    } else if (qvU[k] < qs && qcU[k] > 0) {
      const dq = Math.min(qcU[k], (qs - qvU[k]) * kCloudEvap * dt);
      qvU[k] += dq;
      qcU[k] -= dq;
      TU[k] -= (Lv / Cp) * dq;
    }

    if (tauAnvil > 0) {
      qcU[k] *= Math.exp(-dt / tauAnvil);
    }

    qvU[k] = Math.max(0, qvU[k]);
    qcU[k] = Math.max(0, qcU[k]);
  }
}
