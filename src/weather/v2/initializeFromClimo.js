import { potentialTemperatureFromTemperature } from './analysisData.js';
import { LAT_DEG, U10M_ZONAL_MEAN_TARGET, SOURCE_FIXTURE_COUNT } from './windClimoTargets.js';
import { findClosestLevelIndex } from './verticalGrid.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;

const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const sampleTargetU = (latDeg) => {
  if (SOURCE_FIXTURE_COUNT !== 8 || !LAT_DEG?.length || !U10M_ZONAL_MEAN_TARGET?.length) return 0;
  const n = Math.min(LAT_DEG.length, U10M_ZONAL_MEAN_TARGET.length);
  if (n === 0) return 0;
  const step = n > 1 ? LAT_DEG[0] - LAT_DEG[1] : 1;
  if (!Number.isFinite(step) || step === 0) return U10M_ZONAL_MEAN_TARGET[0];
  if (latDeg >= LAT_DEG[0]) return U10M_ZONAL_MEAN_TARGET[0];
  if (latDeg <= LAT_DEG[n - 1]) return U10M_ZONAL_MEAN_TARGET[n - 1];
  const idx = (LAT_DEG[0] - latDeg) / step;
  const i0 = Math.max(0, Math.min(n - 1, Math.floor(idx)));
  const i1 = Math.min(n - 1, i0 + 1);
  const t = clamp(idx - i0, 0, 1);
  return U10M_ZONAL_MEAN_TARGET[i0] + (U10M_ZONAL_MEAN_TARGET[i1] - U10M_ZONAL_MEAN_TARGET[i0]) * t;
};

const hasSpatialWindTargets = (climo) => Boolean(
  climo?.hasWind && climo?.windNowU && climo?.windNowV &&
  (climo?.hasWind500 || climo?.hasWind250)
);

const sampleVerticalWindTarget = ({ state, climo, cell, pLev, levS, idxS }) => {
  if (!Number.isFinite(pLev) || !climo?.windNowU || !climo?.windNowV) return null;

  const surfaceU = climo.windNowU[cell];
  const surfaceV = climo.windNowV[cell];
  if (!Number.isFinite(surfaceU) || !Number.isFinite(surfaceV)) return null;

  const wind500NowU = climo?.wind500NowU;
  const wind500NowV = climo?.wind500NowV;
  const wind250NowU = climo?.wind250NowU;
  const wind250NowV = climo?.wind250NowV;
  const has500 = Boolean(climo?.hasWind500 && wind500NowU && wind500NowV);
  const has250 = Boolean(climo?.hasWind250 && wind250NowU && wind250NowV);

  if (!has500 && !has250) return { u: surfaceU, v: surfaceV };

  if (pLev <= 50000) {
    if (has500 && has250) {
      const w250 = clamp((50000 - pLev) / (50000 - 25000), 0, 1);
      return {
        u: lerp(wind500NowU[cell], wind250NowU[cell], w250),
        v: lerp(wind500NowV[cell], wind250NowV[cell], w250)
      };
    }
    if (has250) return { u: wind250NowU[cell], v: wind250NowV[cell] };
    return { u: wind500NowU[cell], v: wind500NowV[cell] };
  }

  if (has500) {
    const pSurf = Number.isFinite(state?.ps?.[cell])
      ? state.ps[cell]
      : Number.isFinite(state?.pMid?.[idxS])
        ? state.pMid[idxS]
        : 100000;
    const denom = Math.max(1e-6, pSurf - 50000);
    const w500 = clamp((pSurf - pLev) / denom, 0, 1);
    return {
      u: lerp(surfaceU, wind500NowU[cell], w500),
      v: lerp(surfaceV, wind500NowV[cell], w500)
    };
  }

  return { u: surfaceU, v: surfaceV };
};

const interpolateLogPressure = (pTarget, p0, v0, p1, v1) => {
  const ln0 = Math.log(Math.max(1, p0));
  const ln1 = Math.log(Math.max(1, p1));
  const denom = ln1 - ln0;
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) return v0;
  const t = clamp((Math.log(Math.max(1, pTarget)) - ln0) / denom, 0, 1);
  return lerp(v0, v1, t);
};

const buildTemperatureAnchors = ({
  pSurf,
  pTop,
  TsVal,
  t700,
  t250,
  humidLat
}) => {
  const equatorWeight = clamp01(humidLat);
  const fallback700 = clamp(TsVal - lerp(34, 24, equatorWeight), 215, TsVal - 4);
  const t700Use = clamp(
    Number.isFinite(t700) ? t700 : fallback700,
    215,
    TsVal - 4
  );
  const fallback250 = clamp(t700Use - lerp(46, 38, equatorWeight), 185, t700Use - 4);
  const t250Use = clamp(
    Number.isFinite(t250) ? t250 : fallback250,
    185,
    t700Use - 4
  );
  const tTop = clamp(t250Use - 6, 180, t250Use);

  const anchors = [{ p: pSurf, T: TsVal }];
  if (pSurf > 70000 + 500) anchors.push({ p: 70000, T: t700Use });
  if (pSurf > 25000 + 500) anchors.push({ p: 25000, T: t250Use });
  anchors.push({ p: pTop, T: tTop });
  anchors.sort((a, b) => b.p - a.p);
  return anchors;
};

const sampleTemperatureFromAnchors = (pTarget, anchors) => {
  if (!anchors?.length) return null;
  if (pTarget >= anchors[0].p) return anchors[0].T;
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (pTarget <= a.p && pTarget >= b.p) {
      return interpolateLogPressure(pTarget, a.p, a.T, b.p, b.T);
    }
  }
  return anchors[anchors.length - 1].T;
};

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

const getLayerMidPressure = ({ state, sigma, pTop, cell, lev, idx }) => {
  const existing = state?.pMid?.[idx];
  if (Number.isFinite(existing) && existing > 0) return existing;
  const pSurf = Number.isFinite(state?.ps?.[cell]) ? state.ps[cell] : 100000;
  if (!sigma || sigma.length < lev + 2) return pSurf;
  const p1 = pTop + (pSurf - pTop) * sigma[lev];
  const p2 = pTop + (pSurf - pTop) * sigma[lev + 1];
  return Math.sqrt(Math.max(pTop, p1) * Math.max(pTop, p2));
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
  const { N, nz, ps, Ts, soilW, soilCap, landMask, sstNow, theta, qv, qc, qi, qr, sigmaHalf, u, v } = state;
  const slpNow = climo?.hasSlp ? climo.slpNow : null;
  const t2mNow = climo?.hasT2m ? climo.t2mNow : null;

  const levS = nz - 1;
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

      const pSurf = ps[k];
      const qvBase = land ? qvLandBase : qvOceanBase;
      const qv0 = qvBase * (humidLat + qvPoleFactor * (1 - humidLat));
      const t700Target = climo?.hasT700 && climo?.t700Now?.length === N ? climo.t700Now[k] : null;
      const t250Target = climo?.hasT250 && climo?.t250Now?.length === N ? climo.t250Now[k] : null;
      const tempAnchors = buildTemperatureAnchors({
        pSurf,
        pTop,
        TsVal,
        t700: t700Target,
        t250: t250Target,
        humidLat
      });

      let rhSurf = 0.7;
      if (sigma) {
        const p1 = pTop + (pSurf - pTop) * sigma[levS];
        const p2 = pTop + (pSurf - pTop) * sigma[levS + 1];
        const pMidSurf = Math.sqrt(Math.max(pTop, p1) * Math.max(pTop, p2));
        const TSurf = sampleTemperatureFromAnchors(pMidSurf, tempAnchors) ?? TsVal;
        const qsSurf = saturationMixingRatio(TSurf, pMidSurf);
        rhSurf = qsSurf > 0 ? clamp(qv0 / qsSurf, 0.2, 0.9) : 0.7;
      }

      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k;
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
          const T = sampleTemperatureFromAnchors(pMid, tempAnchors) ?? TsVal;
          theta[idx] = potentialTemperatureFromTemperature(T, pMid, p0);
          const qs = saturationMixingRatio(T, pMid);
          qvNew = Math.min(qvOld, rhCapLev * qs);
        } else {
          const frac = lev / Math.max(1, nz - 1);
          const T = lerp(tempAnchors[tempAnchors.length - 1].T, TsVal, frac);
          theta[idx] = potentialTemperatureFromTemperature(T, pSurf, p0);
          qvNew = Math.min(qvOld, rhCapLev * 0.02);
        }
        qv[idx] = clamp(qvNew, 0, 0.03);
      }
    }
  }

  if (u && v && hasSpatialWindTargets(climo)) {
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        const idxS = levS * N + k;
        const surfaceU = climo.windNowU[k];
        const surfaceV = climo.windNowV[k];
        if (Number.isFinite(surfaceU) && Number.isFinite(surfaceV)) {
          u[idxS] = surfaceU;
          v[idxS] = surfaceV;
        }

        if (state.pMid?.length === nz * N) {
          for (let lev = 0; lev < nz; lev += 1) {
            if (lev === levS) continue;
            const idx = lev * N + k;
            const pLev = getLayerMidPressure({ state, sigma, pTop, cell: k, lev, idx });
            const target = sampleVerticalWindTarget({ state, climo, cell: k, pLev, levS, idxS });
            if (!target) continue;
            u[idx] = target.u;
            v[idx] = target.v;
          }
        }
      }
    }
  } else if (SOURCE_FIXTURE_COUNT === 8 && u && v) {
    const levU = findClosestLevelIndex(sigmaHalf, 0.28);
    for (let j = 0; j < ny; j++) {
      const lat = Number.isFinite(latDeg?.[j])
        ? latDeg[j]
        : 90 - ((j + 0.5) / ny) * 180;
      const absLat = Math.abs(lat);
      const targetS = sampleTargetU(lat);
      const jet = Math.exp(-Math.pow((absLat - 35) / 12, 2));
      const targetU = jet * 2.2 * Math.max(0, targetS);
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        const idxS = levS * N + k;
        const idxU = levU * N + k;
        u[idxS] = targetS;
        v[idxS] = 0;
        u[idxU] = targetU;
        v[idxU] = 0;
      }
    }
  }

  qc.fill(0);
  qi.fill(0);
  qr.fill(0);
  void geo;
}
