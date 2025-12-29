import { Cp, Rd } from '../constants';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);

const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const KAPPA = Rd / Cp;

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

export function initializeV2FromClimo({ grid, state, geo, climo, params = {} }) {
  if (!grid || !state) return;
  const {
    p0 = 100000,
    pTop = 20000,
    thetaBase = 285,
    thetaEquatorBoost = 12,
    thetaPoleDrop = 22,
    qvOceanBase = 0.012,
    qvLandBase = 0.006,
    qvPoleFactor = 0.2,
    rhUpper = 0.15,
    soilInitFrac = 0.6,
    psUseClimo = true,
    TsUseSst = true
  } = params;

  const { nx, ny, latDeg } = grid;
  const { N, nz, ps, Ts, soilW, soilCap, landMask, sstNow, theta, qv, qc, qi, qr, sigmaHalf } = state;
  const slpNow = climo?.hasSlp ? climo.slpNow : null;
  const t2mNow = climo?.hasT2m ? climo.t2mNow : null;

  const levS = nz - 1;
  const dTheta = 6;
  const sigma = sigmaHalf && sigmaHalf.length >= nz + 1 ? sigmaHalf : null;

  for (let j = 0; j < ny; j++) {
    const latAbs = Math.abs(latDeg[j]);
    const humidLat = smoothstep(60, 0, latAbs);
    const thetaLat = thetaBase + thetaEquatorBoost * humidLat - thetaPoleDrop * (1 - humidLat);
    const TsBaseline = thetaLat - 2;
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const land = landMask[k] === 1;

      if (psUseClimo && slpNow && slpNow.length === N) {
        ps[k] = clamp(slpNow[k], 70000, 110000);
      }

      let TsVal = Ts[k];
      if (!land) {
        if (TsUseSst && sstNow && sstNow.length === N) {
          TsVal = sstNow[k] - 1;
        } else {
          TsVal = TsBaseline;
        }
      } else if (t2mNow && t2mNow.length === N) {
        TsVal = t2mNow[k];
      } else {
        TsVal = TsBaseline;
      }
      Ts[k] = TsVal;

      if (land) {
        const cap = soilCap ? soilCap[k] : 0;
        const init = clamp(soilInitFrac * cap, 0, cap);
        soilW[k] = init;
      } else {
        soilW[k] = 0;
      }

      const qvBase = land ? qvLandBase : qvOceanBase;
      const qv0 = qvBase * (humidLat + qvPoleFactor * (1 - humidLat));
      const thetaSurface = TsVal + 2;
      const pSurf = ps[k];
      let rhSurf = 0.7;
      if (sigma) {
        const p1 = pTop + (pSurf - pTop) * sigma[levS];
        const p2 = pTop + (pSurf - pTop) * sigma[levS + 1];
        const pMidSurf = Math.sqrt(Math.max(pTop, p1) * Math.max(pTop, p2));
        const PiSurf = Math.pow(pMidSurf / p0, KAPPA);
        const TSurf = thetaSurface * PiSurf;
        const qsSurf = saturationMixingRatio(TSurf, pMidSurf);
        rhSurf = qsSurf > 0 ? clamp(qv0 / qsSurf, 0.2, 0.9) : 0.7;
      }
      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k;
        theta[idx] = thetaSurface + (levS - lev) * dTheta;
        const qvOld = qv0 * Math.exp(-(levS - lev) / 2);
        const sigmaMid = sigma
          ? 0.5 * (sigma[lev] + sigma[lev + 1])
          : (lev + 0.5) / Math.max(1, nz);
        const rhCapLev = rhUpper + (rhSurf - rhUpper) * sigmaMid;
        let qvNew = qvOld;
        if (sigma) {
          const p1 = pTop + (pSurf - pTop) * sigma[lev];
          const p2 = pTop + (pSurf - pTop) * sigma[lev + 1];
          const pMid = Math.sqrt(Math.max(pTop, p1) * Math.max(pTop, p2));
          const Pi = Math.pow(pMid / p0, KAPPA);
          const T = theta[idx] * Pi;
          const qs = saturationMixingRatio(T, pMid);
          qvNew = Math.min(qvOld, rhCapLev * qs);
        } else {
          qvNew = Math.min(qvOld, rhCapLev * 0.02);
        }
        qv[idx] = clamp(qvNew, 0, 0.03);
      }
    }
  }

  qc.fill(0);
  qi.fill(0);
  qr.fill(0);
  void geo;
}
