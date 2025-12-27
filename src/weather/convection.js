// convection.js: simple instability and convergence-based convection trigger
import { Cp, Lv } from './constants';
import { saturationMixingRatio } from './surface';

export function stepConvection({ dt, fields, geo, grid }) {
  const { nx, ny, cellLonDeg, cellLatDeg, cosLat } = grid;
  const minKmPerDegLon = 20; // avoid runaway metrics near poles
  const { T, Ts, TU, qv, qvU, qc, qcU, ps, u, v, hL, hU, omegaL } = fields;
  const { elev } = geo;
  const hMin = 500;
  const tauConv = 2 * 3600;
  const smoothstep = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const kmPerDegLat = 111.0;
  for (let j = 0; j < ny; j++) {
    const kmPerDegLon = Math.max(minKmPerDegLon, kmPerDegLat * cosLat[j]);
    const dx = kmPerDegLon * 1000 * cellLonDeg;
    const dy = kmPerDegLat * 1000 * cellLatDeg;
    const invDx = 1 / dx;
    const invDy = 1 / dy;

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

      // Instability proxy: surface warmer/moister than air
      const qsSurf = saturationMixingRatio(Ts[k], ps[k]);
      const rhSurf = qv[k] / Math.max(1e-8, qsSurf);
      const buoy = Math.max(0, (Ts[k] - T[k]) * 0.5 + (qv[k] - 0.7 * qsSurf) * 300);
      const instability = Math.max(0, (T[k] - TU[k]) - 10);

      // Orographic lift (wind blowing up slope) -- NOT "being high"
      const deDx = (elev[kE] - elev[kW]) * 0.5 * invDx; // dimensionless slope
      const deDy = (elev[kN] - elev[kS]) * 0.5 * invDy;
      const upslopeW = Math.max(0, u[k] * deDx + v[k] * deDy); // ~ m/s vertical proxy

      const wAscent = Math.max(0, omegaL ? omegaL[k] : 0);
      const w0Conv = 0.0004;
      const w1Conv = 0.0025;
      const lift = smoothstep(w0Conv, w1Conv, wAscent + 0.2 * upslopeW);

      // Trigger combines lift + buoyancy (unitless-ish)
      const warmGate = (Ts[k] - T[k]) > 0.2;
      const moistureGate = rhSurf > 0.75 && warmGate;
      const trigger = moistureGate ? lift * (buoy + 0.08 * instability) : 0;
      if (trigger > 0.07) {
        const m = Math.max(0, Math.min(0.5, dt / tauConv));
        const ML = Math.max(hL[k], hMin);
        const MU = Math.max(hU[k], hMin);
        const ratio = ML / MU;
        const dT = TU[k] - T[k];
        const dQ = qvU[k] - qv[k];
        T[k] += m * dT;
        TU[k] -= m * dT * ratio;
        qv[k] += m * dQ;
        qvU[k] -= m * dQ * ratio;

        // Tune coefficient so dq is ~1e-4..1e-3 per step under moderate storms
        const dq = Math.min(qv[k], trigger * 1.2e-4 * dt);
        qv[k] -= dq;
        const detrainFrac = 0.75;
        const dqU = detrainFrac * dq;
        qc[k] += (1 - detrainFrac) * dq;
        qcU[k] += dqU;
        const heat = (Lv / Cp) * dq;
        T[k] += 0.3 * heat;
        TU[k] += 0.7 * heat;
        qv[k] = Math.max(0, qv[k]);
        qvU[k] = Math.max(0, qvU[k]);
      }
    }
  }
}
