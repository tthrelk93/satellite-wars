// diagnostics.js: derived quantities for rendering and debug
import { saturationMixingRatio } from './surface';

export function computeRH(fields) {
  const { T, qv, ps, RH } = fields;
  for (let k = 0; k < T.length; k++) {
    const qs = saturationMixingRatio(T[k], ps[k]);
    RH[k] = Math.max(0, Math.min(2, qv[k] / Math.max(1e-8, qs)));
  }
}

export function computeRHUpper(fields, RHUOut, pUpper = 50000) {
  const { TU, qvU } = fields;
  for (let k = 0; k < TU.length; k++) {
    const qs = saturationMixingRatio(TU[k], pUpper);
    RHUOut[k] = Math.max(0, Math.min(2, qvU[k] / Math.max(1e-8, qs)));
  }
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function computeOmegaProxy(fields, { hL = 1000, hU = 3000, wMax = 0.05, omegaScale = 1 } = {}) {
  const { divDynL, divDynU, omegaL, omegaU } = fields;
  if (!divDynL || !divDynU || !omegaL || !omegaU) return;
  for (let k = 0; k < divDynL.length; k++) {
    const wL = -divDynL[k] * hL * omegaScale;
    const wU = -divDynU[k] * hU * omegaScale;
    omegaL[k] = clamp(wL, -wMax, wMax);
    omegaU[k] = clamp(wU, -wMax, wMax);
  }
}

export function computeCloudOptics(fields, {
  hLow = 1500,
  hHigh = 5000,
  tauCoeffLow = 6,
  tauCoeffHigh = 3,
  tauMax = 20,
  tauTauLow = 3600,
  tauTauHigh = 14400
} = {}, dt = 0) {
  const {
    qc,
    qcU,
    rho,
    RH,
    RHU,
    omegaL,
    omegaU,
    cloud,
    cloudLow,
    cloudHigh,
    cwp,
    cwpLow,
    cwpHigh,
    tauLow,
    tauHigh,
    tauLowPrev,
    tauHighPrev,
    tauLowDelta,
    tauHighDelta
  } = fields;
  const hasDt = Number.isFinite(dt) && dt > 0;
  const alphaLow = hasDt ? Math.min(1, dt / Math.max(1, tauTauLow)) : 1;
  const alphaHigh = hasDt ? Math.min(1, dt / Math.max(1, tauTauHigh)) : 1;
  for (let k = 0; k < qc.length; k++) {
    const qcL = Math.max(0, qc[k]);
    const qcUpper = Math.max(0, qcU[k]);
    const rhoL = Math.max(0.1, rho[k]);
    const rhoU = 0.6 * rhoL;
    const cwpL = qcL * rhoL * hLow;
    const cwpH = qcUpper * rhoU * hHigh;
    cwpLow[k] = cwpL;
    cwpHigh[k] = cwpH;
    cwp[k] = cwpL + cwpH;

    let tauTargetL = clamp(tauCoeffLow * cwpL, 0, tauMax);
    let tauTargetH = clamp(tauCoeffHigh * cwpH, 0, tauMax);

    const rhGate = smoothstep(0.6, 0.9, RH[k]);
    const ascGate = smoothstep(0.0002, 0.002, omegaL[k]);
    const subGate = smoothstep(-0.004, 0.0, omegaL[k]);
    tauTargetL *= (0.045 + 0.955 * ascGate) * rhGate * subGate;

    const rhGateU = smoothstep(0.35, 0.58, RHU[k]);
    const ascGateU = smoothstep(0.0015, 0.015, omegaU[k]);
    const subGateU = smoothstep(-0.04, 0.0, omegaU[k]);
    tauTargetH *= (0.04 + 0.96 * ascGateU) * rhGateU * subGateU;

    tauLow[k] += (tauTargetL - tauLow[k]) * alphaLow;
    tauHigh[k] += (tauTargetH - tauHigh[k]) * alphaHigh;

    if (tauLowPrev && tauLowDelta) {
      if (hasDt) {
        tauLowDelta[k] = Math.abs(tauLow[k] - tauLowPrev[k]);
      } else {
        tauLowDelta[k] = 0;
      }
      tauLowPrev[k] = tauLow[k];
    }
    if (tauHighPrev && tauHighDelta) {
      if (hasDt) {
        tauHighDelta[k] = Math.abs(tauHigh[k] - tauHighPrev[k]);
      } else {
        tauHighDelta[k] = 0;
      }
      tauHighPrev[k] = tauHigh[k];
    }

    const cLow = 1 - Math.exp(-tauLow[k]);
    const cHigh = 1 - Math.exp(-tauHigh[k]);
    cloudLow[k] = cLow;
    cloudHigh[k] = cHigh;
    cloud[k] = 1 - (1 - cLow) * (1 - cHigh);
  }
}

export function computeVorticity(fields, grid, vortOut) {
  const { nx, ny, cellLonDeg, cellLatDeg, cosLat } = grid;
  const { u, v } = fields;
  const kmPerDegLat = 111.0;
  for (let j = 0; j < ny; j++) {
    const kmPerDegLon = Math.max(1.0, kmPerDegLat * cosLat[j]);

    const invDx = 1 / (kmPerDegLon * 1000 * cellLonDeg);
    const invDy = 1 / (kmPerDegLat * 1000 * cellLatDeg);
    for (let i = 0; i < nx; i++) {
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const k = j * nx + i;
      const kE = j * nx + iE;
      const kW = j * nx + iW;
      const kN = jN * nx + i;
      const kS = jS * nx + i;
      const dvdx = (v[kE] - v[kW]) * 0.5 * invDx;
      const dudy = (u[kN] - u[kS]) * 0.5 * invDy;
      vortOut[k] = dvdx - dudy;
    }
  }
}

export function computeDivergence(fields, grid, divOut) {
  const { nx, ny, cellLonDeg, cellLatDeg, cosLat } = grid;
  const { u, v } = fields;
  const kmPerDegLat = 111.0;
  for (let j = 0; j < ny; j++) {
    const kmPerDegLon = Math.max(1.0, kmPerDegLat * cosLat[j]);
    const invDx = 1 / (kmPerDegLon * 1000 * cellLonDeg);
    const invDy = 1 / (kmPerDegLat * 1000 * cellLatDeg);
    for (let i = 0; i < nx; i++) {
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const k = j * nx + i;
      const kE = j * nx + iE;
      const kW = j * nx + iW;
      const kN = jN * nx + i;
      const kS = jS * nx + i;
      const dudx = (u[kE] - u[kW]) * 0.5 * invDx;
      const dvdy = (v[kN] - v[kS]) * 0.5 * invDy;
      divOut[k] = dudx + dvdy;
    }
  }
}

export function computeCloudDensity(fields, cloudOut) {
  const { qc, RH, vort } = fields;
  const smoothstep = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let k = 0; k < qc.length; k++) {
    const qcTerm = 1.0 - Math.exp(-qc[k] / 0.0022); // softer than linear
    const rhTerm = 0.22 * smoothstep(0.95, 1.03, RH[k]); // damp near-saturation overcast
    const vortTerm = vort ? Math.min(0.2, Math.abs(vort[k]) * 4000) : 0;
    cloudOut[k] = Math.max(0, Math.min(1, qcTerm + rhTerm + vortTerm));
  }
}

export function computeCloudWaterPath(fields, cwpOut, columnHeight = 1000) {
  const { qc, qr, rho } = fields;
  for (let k = 0; k < qc.length; k++) {
    const condensate = qc[k] + (qr ? qr[k] : 0);
    cwpOut[k] = Math.max(0, condensate) * rho[k] * columnHeight;
  }
}

export function computePrecipRate(fields, precipOut) {
  const { qr, rho } = fields;
  const kFall = 1 / 3600; // same as microphysics
  const H_rain = 1500;
  for (let k = 0; k < qr.length; k++) {
    precipOut[k] = Math.max(0, qr[k] * kFall * rho[k] * H_rain * 3600); // mm/hr approx
  }
}
