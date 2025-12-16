// convection.js: simple instability and convergence-based convection trigger
import { Cp, Lv } from './constants';
import { saturationMixingRatio } from './surface';

export function stepConvection({ dt, fields, geo, grid }) {
  const { nx, ny, cellLonDeg, cellLatDeg, cosLat } = grid;
  const { T, Ts, qv, qc, ps, u, v } = fields;
  const { elev } = geo;

  const kmPerDegLat = 111.0;
  for (let j = 0; j < ny; j++) {
    const kmPerDegLon = kmPerDegLat * cosLat[j];
    const invDx = 1 / (kmPerDegLon * 1000 * cellLonDeg);
    const invDy = 1 / (kmPerDegLat * 1000 * cellLatDeg);
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

      // Convergence proxy
      const div = (u[kE] - u[kW]) * 0.5 * invDx + (v[kN] - v[kS]) * 0.5 * invDy;
      const conv = Math.max(0, -div);

      // Instability proxy: surface warmer/moister than air
      const qsSurf = saturationMixingRatio(Ts[k], ps[k]);
      const buoy = Math.max(0, (Ts[k] - T[k]) * 0.5 + (qv[k] - 0.7 * qsSurf) * 300);

      // Orographic lift (wind blowing up slope) — NOT "being high"
      const deDx = (elev[kE] - elev[kW]) * 0.5 * invDx; // dimensionless slope
      const deDy = (elev[kN] - elev[kS]) * 0.5 * invDy;
      const upslopeW = Math.max(0, u[k] * deDx + v[k] * deDy); // ~ m/s vertical proxy

      // Convert convergence (1/s) to an equivalent vertical velocity scale (m/s)
      const wConv = conv * 100000; // 100 km scale (tunable)
      const lift = Math.min(2.0, wConv + upslopeW); // cap to avoid runaway

      // Trigger combines lift + buoyancy (unitless-ish)
      const trigger = lift * buoy;
      if (trigger > 0.15) {
        // Tune coefficient so dq is ~1e-4..1e-3 per step under moderate storms
        const dq = Math.min(qv[k], trigger * 1.0e-5 * dt);
        qv[k] -= dq;
        qc[k] += dq;
        T[k] += (Lv / Cp) * dq;
      }
    }
  }
}

