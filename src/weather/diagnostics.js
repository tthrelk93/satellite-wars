// diagnostics.js: derived quantities for rendering and debug
import { saturationMixingRatio } from './surface';

export function computeRH(fields) {
  const { T, qv, ps, RH } = fields;
  for (let k = 0; k < T.length; k++) {
    const qs = saturationMixingRatio(T[k], ps[k]);
    RH[k] = Math.max(0, Math.min(2, qv[k] / Math.max(1e-8, qs)));
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

export function computeCloudDensity(fields, cloudOut) {
  const { qc, RH, vort } = fields;
  const smoothstep = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let k = 0; k < qc.length; k++) {
    const qcTerm = 1.0 - Math.exp(-qc[k] / 0.0015); // softer than linear
    const rhTerm = 0.8 * smoothstep(0.85, 1.05, RH[k]); // allows stratiform clouds < 100% RH
    const vortTerm = vort ? Math.min(0.25, Math.abs(vort[k]) * 5000) : 0;
    cloudOut[k] = Math.max(0, Math.min(1, qcTerm + rhTerm + vortTerm));
  }
}

export function computePrecipRate(fields, precipOut) {
  const { qr, rho } = fields;
  const kFall = 0.4; // same as microphysics
  for (let k = 0; k < qr.length; k++) {
    precipOut[k] = Math.max(0, qr[k] * kFall * rho[k] * 3600); // mm/hr approx
  }
}

