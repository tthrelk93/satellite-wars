const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);

const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export function initializeV2FromClimo({ grid, state, geo, climo, params = {} }) {
  if (!grid || !state) return;
  const {
    p0 = 100000,
    thetaBase = 285,
    thetaEquatorBoost = 12,
    thetaPoleDrop = 22,
    qvOceanBase = 0.012,
    qvLandBase = 0.006,
    qvPoleFactor = 0.2,
    soilInitFrac = 0.6,
    psUseClimo = true,
    TsUseSst = true
  } = params;

  const { nx, ny, latDeg } = grid;
  const { N, nz, ps, Ts, soilW, soilCap, landMask, sstNow, theta, qv, qc, qi, qr } = state;
  const slpNow = climo?.hasSlp ? climo.slpNow : null;
  const t2mNow = climo?.hasT2m ? climo.t2mNow : null;

  const levS = nz - 1;
  const dTheta = 6;

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
      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k;
        theta[idx] = thetaSurface + (levS - lev) * dTheta;
        qv[idx] = qv0 * Math.exp(-(levS - lev) / 2);
      }
    }
  }

  qc.fill(0);
  qi.fill(0);
  qr.fill(0);
  void p0;
  void geo;
}
