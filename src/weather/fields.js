// fields.js: allocation and initialization of model state
import { computeDensity } from './dynamics';
import { saturationMixingRatio } from './surface';

export function createFields(grid) {
  const { count } = grid;
  return {
    u: new Float32Array(count),
    v: new Float32Array(count),
    uU: new Float32Array(count),
    vU: new Float32Array(count),
    hL: new Float32Array(count),
    hU: new Float32Array(count),
    T: new Float32Array(count),
    qv: new Float32Array(count),
    qvU: new Float32Array(count),
    qc: new Float32Array(count),
    qcU: new Float32Array(count),
    qr: new Float32Array(count),
    ps: new Float32Array(count),
    rho: new Float32Array(count),
    Ts: new Float32Array(count),
    TU: new Float32Array(count),
    RH: new Float32Array(count),
    RHU: new Float32Array(count),
    vort: new Float32Array(count),
    div: new Float32Array(count),
    divDynL: new Float32Array(count),
    divDynU: new Float32Array(count),
    omegaL: new Float32Array(count),
    omegaU: new Float32Array(count),
    cloud: new Float32Array(count),
    cloudLow: new Float32Array(count),
    cloudHigh: new Float32Array(count),
    cwp: new Float32Array(count),
    cwpLow: new Float32Array(count),
    cwpHigh: new Float32Array(count),
    tauLow: new Float32Array(count),
    tauHigh: new Float32Array(count),
    precipRate: new Float32Array(count),
    // diagnostics / helpers
    rad: new Array(count)
  };
}

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export function initAtmosphere(fields, grid, seed = 1, options = {}) {
  const { hL0 = 9000, hU0 = 3000, pScale = 10, p0 = 101325 } = options;
  const { nx, ny, latDeg } = grid;
  const {
    u,
    v,
    uU,
    vU,
    hL,
    hU,
    T,
    qv,
    qvU,
    qc,
    qcU,
    qr,
    ps,
    Ts,
    TU,
    RH,
    RHU,
    vort,
    div,
    divDynL,
    divDynU,
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
    precipRate
  } = fields;
  const P_UPPER = 50000;
  const rand = mulberry32(seed);
  for (let j = 0; j < ny; j++) {
    const lat = latDeg[j];
    const baseT = 300 - 40 * Math.pow(Math.sin((lat * Math.PI) / 180), 2);
    const tropicsFactor = Math.max(0, 1 - Math.abs(lat) / 30);
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const noise = (rand() - 0.5) * 1.5;
      T[k] = baseT + noise;
      Ts[k] = T[k];
      TU[k] = T[k] - 18;
      TU[k] = Math.max(180, Math.min(330, TU[k]));
      hL[k] = hL0 + (rand() - 0.5) * 40;
      hU[k] = hU0 + (rand() - 0.5) * 20;
      ps[k] = p0 + pScale * (hL[k] - hL0);
      const qs = saturationMixingRatio(T[k], ps[k]);
      const targetRH = 0.7 + 0.15 * Math.max(0, 1 - Math.abs(lat) / 70); // moister tropics, drier poles
      const humidityNoise = (rand() - 0.5) * 0.08;
      qv[k] = Math.max(0, (targetRH + humidityNoise) * qs);
      const RHU0 = 0.35 + 0.25 * tropicsFactor;
      const qsU = saturationMixingRatio(TU[k], P_UPPER);
      qvU[k] = Math.max(0, RHU0 * qsU);
      qc[k] = 0;
      qcU[k] = 0;
      qr[k] = 0;
      u[k] = 4 * Math.sin((lat * Math.PI) / 180); // weak jets
      v[k] = 0;
      uU[k] = 8 * Math.sin((lat * Math.PI) / 180);
      vU[k] = 0;
      RH[k] = 0;
      RHU[k] = 0;
      vort[k] = 0;
      div[k] = 0;
      divDynL[k] = 0;
      divDynU[k] = 0;
      omegaL[k] = 0;
      omegaU[k] = 0;
      cloud[k] = 0;
      cloudLow[k] = 0;
      cloudHigh[k] = 0;
      cwp[k] = 0;
      cwpLow[k] = 0;
      cwpHigh[k] = 0;
      tauLow[k] = 0;
      tauHigh[k] = 0;
      precipRate[k] = 0;
      fields.rad[k] = { Rnet: 0 };
    }
  }
  computeDensity(fields);
}
