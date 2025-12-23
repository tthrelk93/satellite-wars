import { cosZenith } from './solar';
import { saturationMixingRatio } from './surface';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function stepVerticalExchange({ dt, grid, fields, geo, params = {}, dayOfYear, timeUTC }) {
  const { nx, ny, cellLonDeg, cellLatDeg, cosLat, latDeg, lonDeg } = grid;
  const {
    hL,
    hU,
    u,
    v,
    T,
    TU,
    qv,
    qvU,
    cloud,
    Ts,
    ps
  } = fields;

  const hMin = Number.isFinite(params.hMin) ? params.hMin : 500;
  const tauMixDay = 3 * 3600;
  const tauMixNightClear = 9 * 3600;
  const tauMixNightCloudy = 14 * 3600;
  const kmPerDegLat = 111.0;
  const day = Number.isFinite(dayOfYear)
    ? dayOfYear
    : ((Number.isFinite(timeUTC) ? timeUTC : 0) / 86400) % 365;
  const time = Number.isFinite(timeUTC) ? timeUTC : 0;

  for (let j = 0; j < ny; j++) {
    const kmPerDegLon = Math.max(20, kmPerDegLat * cosLat[j]);
    const dx = kmPerDegLon * 1000 * cellLonDeg;
    const dy = kmPerDegLat * 1000 * cellLatDeg;
    const invDx = 1 / dx;
    const invDy = 1 / dy;
    const latRad = (latDeg[j] * Math.PI) / 180;
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const cosZ = cosZenith(latRad, lonDeg[i], time, day);
      const cloudFrac = clamp01(cloud[k] || 0);
      const isDay = cosZ > 0.01;
      let tauMix = isDay
        ? tauMixDay
        : (tauMixNightClear + (tauMixNightCloudy - tauMixNightClear) * cloudFrac);

      const stable = Math.max(0, TU[k] - T[k]);
      tauMix *= 1 + stable / 8;
      const wind = Math.hypot(u[k], v[k]);
      tauMix *= 1 / (1 + wind / 20);

      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const kE = j * nx + iE;
      const kW = j * nx + iW;
      const kN = jN * nx + i;
      const kS = jS * nx + i;

      const div = (u[kE] - u[kW]) * 0.5 * invDx + (v[kN] - v[kS]) * 0.5 * invDy;
      const conv = Math.max(0, -div);
      const qsSurf = saturationMixingRatio(Ts[k], ps[k]);
      const buoy = Math.max(0, (Ts[k] - T[k]) * 0.5 + (qv[k] - 0.7 * qsSurf) * 300);
      const horizScale = 0.5 * (dx + dy);
      const wConv = conv * horizScale;
      const activity = wConv * buoy;
      if (activity > 0.15) {
        tauMix *= 0.35;
      } else if (activity > 0.05) {
        tauMix *= 0.6;
      }

      let m = dt / tauMix;
      if (!Number.isFinite(m) || m <= 0) continue;
      m = Math.max(0, Math.min(0.5, m));

      const ML = Math.max(hL[k], hMin);
      const MU = Math.max(hU[k], hMin);
      const ratio = ML / MU;

      const dT = TU[k] - T[k];
      const dQ = qvU[k] - qv[k];

      T[k] += m * dT;
      TU[k] -= m * dT * ratio;
      qv[k] += m * dQ;
      qvU[k] -= m * dQ * ratio;

      T[k] = Math.max(180, Math.min(330, T[k]));
      TU[k] = Math.max(180, Math.min(330, TU[k]));
      qv[k] = Math.max(0, qv[k]);
      qvU[k] = Math.max(0, qvU[k]);
    }
  }
}
