// surface.js: surface energy balance and fluxes
import { Cp, Lv, Rd } from './constants';

// Saturation vapor mixing ratio (Pa input)
export function saturationMixingRatio(T, p) {
  const Tc = T - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const qs = 0.622 * es / Math.max(1, p - es);
  return qs;
}

export function bulkFluxes({
  u,
  v,
  Tair,
  Ts,
  qv,
  p,
  rho,
  land,
  soilM,
  hbl = 1000,
  Ch = 0.0015,
  Ce = 0.0013
}) {
  const V = Math.hypot(u, v);
  const qs = saturationMixingRatio(Ts, p);
  let evap = rho * Ce * V * Math.max(0, qs - qv); // kg/m^2/s
  if (land) evap *= soilM;
  const H = rho * Cp * Ch * V * (Ts - Tair);
  return { evap, H };
}

export function updateSurface({
  dt,
  fields,
  geo,
  rad,
  grid,
  hbl = 1000
}) {
  const { nx, ny } = grid;
  const { Ts, T, qv, ps, u, v, rho } = fields;
  const { soilM, soilCap, landMask, sstNow, iceNow } = geo;

  const C_land = 2e6; // J/m^2/K
  const C_ocean = 4e8; // J/m^2/K
  const Gk = 0.00005; // ground relaxation
  const tauSST = 7 * 86400;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const land = landMask[k] === 1;
      const cap = land ? C_land : C_ocean;

      if (!land && sstNow) {
        Ts[k] += (sstNow[k] - Ts[k]) * (dt / tauSST);
      }

      const { Rnet } = rad[k];
      const flux = bulkFluxes({
        u: u[k],
        v: v[k],
        Tair: T[k],
        Ts: Ts[k],
        qv: qv[k],
        p: ps[k],
        rho: rho[k],
        land,
        soilM: soilCap ? soilCap[k] : soilM[k],
        hbl
      });
      if (!land && iceNow) {
        const ice = Math.max(0, Math.min(1, iceNow[k]));
        flux.evap *= 1 - ice;
      }
      const LE = Lv * flux.evap;
      const G = Gk * (Ts[k] - 280); // weak deep soil relax
      const dTs = (Rnet - flux.H - LE - G) / cap;
      Ts[k] = Ts[k] + dTs * dt;

      // Feedback to air layer (boundary layer depth hbl)
      T[k] += (flux.H / (rho[k] * Cp * hbl)) * dt;
      qv[k] += (flux.evap / (rho[k] * hbl)) * dt;
    }
  }
}
