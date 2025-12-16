// advect.js: semi-Lagrangian advection for scalar and vector fields
import { clampLat } from './grid';

export function bilinear(field, lon, lat, nx, ny) {
  const i0 = Math.floor(lon);
  const j0 = Math.floor(lat);
  const i1 = (i0 + 1) % nx;
  const j1 = Math.min(ny - 1, j0 + 1);
  const fi = lon - i0;
  const fj = lat - j0;

  const k00 = j0 * nx + i0;
  const k10 = j0 * nx + i1;
  const k01 = j1 * nx + i0;
  const k11 = j1 * nx + i1;

  const vTop = field[k00] * (1 - fi) + field[k10] * fi;
  const vBot = field[k01] * (1 - fi) + field[k11] * fi;
  return vTop * (1 - fj) + vBot * fj;
}

export function advectScalar({
  src,
  dst,
  u,
  v,
  dt,
  grid,
  kappa = 0 // m^2/s
}) {
  const { nx, ny, cellLonDeg, cellLatDeg, cosLat } = grid;
  const minKmPerDegLon = 20;
  const kmPerDegLat = 111.0;
  for (let j = 0; j < ny; j++) {
    const kmPerDegLon = Math.max(minKmPerDegLon, kmPerDegLat * cosLat[j]);
    const dx = kmPerDegLon * 1000 * cellLonDeg;
    const dy = kmPerDegLat * 1000 * cellLatDeg;
    const invDx2 = 1 / (dx * dx);
    const invDy2 = 1 / (dy * dy);
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const dLon = (u[k] / 1000 / kmPerDegLon) * dt;
      const dLat = (v[k] / 1000 / kmPerDegLat) * dt;
      let srcLon = i - dLon / cellLonDeg;
      let srcLat = j - dLat / cellLatDeg;
      srcLon = ((srcLon % nx) + nx) % nx;
      srcLat = clampLat(srcLat, ny);
      let val = bilinear(src, srcLon, srcLat, nx, ny);
      if (kappa > 0) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const jN = Math.max(0, j - 1);
        const jS = Math.min(ny - 1, j + 1);
        const kE = j * nx + iE;
        const kW = j * nx + iW;
        const kN = jN * nx + i;
        const kS = jS * nx + i;
        const lap =
          (src[kE] + src[kW] - 2 * src[k]) * invDx2 +
          (src[kN] + src[kS] - 2 * src[k]) * invDy2;
        val += kappa * dt * lap;
      }
      dst[k] = val;
    }
  }
}

export function advectVector({
  uSrc,
  vSrc,
  uDst,
  vDst,
  u,
  v,
  dt,
  grid,
  kappa = 0
}) {
  advectScalar({ src: uSrc, dst: uDst, u, v, dt, grid, kappa });
  advectScalar({ src: vSrc, dst: vDst, u, v, dt, grid, kappa });
}
