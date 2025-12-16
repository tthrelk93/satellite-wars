// dynamics.js: wind updates from pressure gradients + Coriolis + drag
import { Omega, g, Rd } from './constants';

export function stepWinds({ dt, grid, fields, geo, dragCoeff = 1e-5 }) {
  const { nx, ny, cellLonDeg, cellLatDeg, cosLat, sinLat } = grid;
  const minKmPerDegLon = 20;
  const { u, v, ps, rho } = fields;

  for (let j = 0; j < ny; j++) {
    const kmPerDegLat = 111.0;
    const kmPerDegLon = Math.max(minKmPerDegLon, kmPerDegLat * cosLat[j]);
    const invDx = 1 / (kmPerDegLon * 1000 * cellLonDeg);
    const invDy = 1 / (kmPerDegLat * 1000 * cellLatDeg);
    const f = 2 * Omega * sinLat[j];

    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const kE = j * nx + iE;
      const kW = j * nx + iW;
      const kN = jN * nx + i;
      const kS = jS * nx + i;

      const dPdx = (ps[kE] - ps[kW]) * 0.5 * invDx;
      const dPdy = (ps[kN] - ps[kS]) * 0.5 * invDy;

      const rhoHere = Math.max(0.9, rho[k]);
      let uNew = u[k] + (-dPdx / rhoHere + f * v[k]) * dt;
      let vNew = v[k] + (-dPdy / rhoHere - f * u[k]) * dt;

      const drag = dragCoeff * Math.hypot(uNew, vNew);
      u[k] = uNew * (1 - drag * dt);
      v[k] = vNew * (1 - drag * dt);
    }
  }
}

export function computeDensity(fields) {
  const { T, ps, rho } = fields;
  for (let k = 0; k < ps.length; k++) {
    rho[k] = ps[k] / (Rd * Math.max(180, Math.min(330, T[k])));
  }
}

