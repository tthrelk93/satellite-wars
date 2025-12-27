import { createLatLonGrid } from '../grid';
import { Omega } from '../constants';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createLatLonGridV2(nx = 180, ny = 90, { minDxMeters = 80000, polarLatStartDeg = 60 } = {}) {
  const grid = createLatLonGrid(nx, ny);
  const f = new Float32Array(ny);
  const invDx = new Float32Array(ny);
  const invDy = new Float32Array(ny);
  const polarWeight = new Float32Array(ny);
  const kmPerDegLat = 111.0;
  const dy = kmPerDegLat * 1000 * grid.cellLatDeg;
  const invDyConst = 1 / dy;

  for (let j = 0; j < ny; j++) {
    const dx = Math.max(minDxMeters, kmPerDegLat * 1000 * grid.cellLonDeg * grid.cosLat[j]);
    invDx[j] = 1 / dx;
    invDy[j] = invDyConst;
    f[j] = 2 * Omega * grid.sinLat[j];
    const latAbs = Math.abs(grid.latDeg[j]);
    polarWeight[j] = clamp01((latAbs - polarLatStartDeg) / (90 - polarLatStartDeg));
  }

  return {
    ...grid,
    f,
    invDx,
    invDy,
    polarWeight,
    minDxMeters,
    kmPerDegLat
  };
}
