// fields.js: allocation and initialization of model state
import { createLatLonGrid } from './grid';
import { computeDensity } from './dynamics';

export function createFields(grid) {
  const { count } = grid;
  return {
    u: new Float32Array(count),
    v: new Float32Array(count),
    T: new Float32Array(count),
    qv: new Float32Array(count),
    qc: new Float32Array(count),
    qr: new Float32Array(count),
    ps: new Float32Array(count),
    rho: new Float32Array(count),
    Ts: new Float32Array(count),
    RH: new Float32Array(count),
    cloud: new Float32Array(count),
    precipRate: new Float32Array(count),
    // diagnostics / helpers
    rad: new Array(count)
  };
}

export function initAtmosphere(fields, grid) {
  const { nx, ny, latDeg } = grid;
  const { u, v, T, qv, qc, qr, ps, Ts } = fields;
  for (let j = 0; j < ny; j++) {
    const lat = latDeg[j];
    const baseT = 300 - 40 * Math.pow(Math.sin((lat * Math.PI) / 180), 2);
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const noise = (Math.random() - 0.5) * 1.5;
      T[k] = baseT + noise;
      Ts[k] = T[k];
      ps[k] = 101000 - 40 * Math.abs(lat);
      qv[k] = 0.006 + 0.01 * Math.max(0, 1 - Math.abs(lat) / 60) + (Math.random() - 0.5) * 0.002;
      qc[k] = 0;
      qr[k] = 0;
      u[k] = 4 * Math.sin((lat * Math.PI) / 180); // weak jets
      v[k] = 0;
      fields.rad[k] = { Rnet: 0 };
    }
  }
  computeDensity(fields);
}

