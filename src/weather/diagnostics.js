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
    const kmPerDegLon = kmPerDegLat * cosLat[j];
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
  const { qc, RH } = fields;
  for (let k = 0; k < qc.length; k++) {
    const base = qc[k] * 400; // scale to ~0..1
    const rhBoost = Math.max(0, RH[k] - 1) * 0.6;
    cloudOut[k] = Math.max(0, Math.min(1, base + rhBoost));
  }
}

export function computePrecipRate(fields, precipOut) {
  const { qr, rho } = fields;
  const kFall = 0.4; // same as microphysics
  for (let k = 0; k < qr.length; k++) {
    precipOut[k] = Math.max(0, qr[k] * kFall * rho[k] * 3600); // mm/hr approx
  }
}

