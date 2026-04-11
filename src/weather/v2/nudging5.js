import { Rd, Cp } from '../constants.js';
import { interpolatePressureFieldAtCell } from './analysisData.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const P0 = 100000;
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
const NUDGE_ALLOWED_PARAMS = new Set([
  'enable',
  'enablePs',
  'enableThetaS',
  'enableQvS',
  'enableUpper',
  'enableThetaColumn',
  'enableQvColumn',
  'enableWindColumn',
  'thetaSource',
  'qvSource',
  'windSource',
  'tauPs',
  'tauThetaS',
  'tauQvS',
  'tauThetaColumn',
  'tauQvColumn',
  'tauWindColumn',
  'sstAirOffsetK',
  'rhTargetOceanEq',
  'rhTargetOceanPole',
  'rhTargetLandEq',
  'rhTargetLandPole',
  'qvCap',
  'landQvNudgeScale',
  'oceanQvNudgeScale',
  'organizedConvectionQvSurfaceRelief',
  'organizedConvectionQvColumnRelief',
  'organizedConvectionThetaColumnRelief',
  'subtropicalSubsidenceQvRelief',
  'smoothLon',
  'smoothLat',
  'cadenceSeconds',
  'psMin',
  'psMax'
]);
const nudgeWarnedParams = new Set();
const warnUnknownNudgeParams = (params) => {
  if (!params || typeof params !== 'object') return;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  const unknown = Object.keys(params).filter(
    (key) => !NUDGE_ALLOWED_PARAMS.has(key) && !nudgeWarnedParams.has(key)
  );
  if (!unknown.length) return;
  unknown.forEach((key) => nudgeWarnedParams.add(key));
  console.warn(`[V2 nudging] Unknown params: ${unknown.join(', ')}`);
};

const wrapLon = (i, nx) => {
  if (i < 0) return i + nx;
  if (i >= nx) return i - nx;
  return i;
};

const clampLat = (j, ny) => {
  if (j < 0) return 0;
  if (j >= ny) return ny - 1;
  return j;
};

const smoothBox2D = ({ grid, src, tmp, out, smoothLon, smoothLat }) => {
  const { nx, ny } = grid;
  if (smoothLon <= 1 && smoothLat <= 1) {
    out.set(src);
    return;
  }

  const lonWindow = Math.max(1, Math.floor(smoothLon));
  const latWindow = Math.max(1, Math.floor(smoothLat));
  const lonHalf = Math.floor(lonWindow / 2);
  const latHalf = Math.floor(latWindow / 2);
  const invLon = 1 / lonWindow;
  const invLat = 1 / latWindow;

  for (let j = 0; j < ny; j++) {
    const row = j * nx;
    let sum = 0;
    for (let di = -lonHalf; di <= lonHalf; di++) {
      const ii = wrapLon(di, nx);
      sum += src[row + ii];
    }
    for (let i = 0; i < nx; i++) {
      tmp[row + i] = sum * invLon;
      const iAdd = wrapLon(i + lonHalf + 1, nx);
      const iSub = wrapLon(i - lonHalf, nx);
      sum += src[row + iAdd] - src[row + iSub];
    }
  }

  for (let i = 0; i < nx; i++) {
    let sum = 0;
    for (let dj = -latHalf; dj <= latHalf; dj++) {
      const jj = clampLat(dj, ny);
      sum += tmp[jj * nx + i];
    }
    for (let j = 0; j < ny; j++) {
      out[j * nx + i] = sum * invLat;
      const jAdd = clampLat(j + latHalf + 1, ny);
      const jSub = clampLat(j - latHalf, ny);
      sum += tmp[jAdd * nx + i] - tmp[jSub * nx + i];
    }
  }
};

const buildClimoTargetMaps = (climo) => {
  const windU = new Map();
  const windV = new Map();
  const temperature = new Map();
  const qv = new Map();

  if (climo?.hasWind && climo.windNowU && climo.windNowV) {
    windU.set(100000, climo.windNowU);
    windV.set(100000, climo.windNowV);
  }
  if (climo?.hasWind500 && climo.wind500NowU && climo.wind500NowV) {
    windU.set(50000, climo.wind500NowU);
    windV.set(50000, climo.wind500NowV);
  }
  if (climo?.hasWind250 && climo.wind250NowU && climo.wind250NowV) {
    windU.set(25000, climo.wind250NowU);
    windV.set(25000, climo.wind250NowV);
  }
  if (climo?.hasT2m && climo.t2mNow) temperature.set(100000, climo.t2mNow);
  if (climo?.hasT700 && climo.t700Now) temperature.set(70000, climo.t700Now);
  if (climo?.hasT250 && climo.t250Now) temperature.set(25000, climo.t250Now);
  if (climo?.hasQ2m && climo.q2mNow) qv.set(100000, climo.q2mNow);
  if (climo?.hasQ700 && climo.q700Now) qv.set(70000, climo.q700Now);
  if (climo?.hasQ250 && climo.q250Now) qv.set(25000, climo.q250Now);

  return {
    windU: windU.size ? windU : null,
    windV: windV.size ? windV : null,
    temperature: temperature.size ? temperature : null,
    qv: qv.size ? qv : null,
    surfacePressurePa: climo?.hasSlp ? climo.slpNow : null
  };
};

const selectTargetMap = (source, analysisMap, climoMap) => {
  if (source === 'analysis') return analysisMap || null;
  if (source === 'climatology') return climoMap || null;
  return analysisMap || climoMap || null;
};

export function stepNudging5({ dt, grid, state, climo, params = {}, scratch }) {
  if (!grid || !state || !climo || !scratch || !Number.isFinite(dt) || dt <= 0) return;
  warnUnknownNudgeParams(params);
  const {
    enable = true,
    enablePs = true,
    enableThetaS = false,
    enableQvS = false,
    enableThetaColumn = false,
    enableQvColumn = false,
    enableWindColumn = false,
    thetaSource = 'auto',
    qvSource = 'auto',
    windSource = 'auto',
    tauPs = 30 * 86400,
    tauThetaS = 45 * 86400,
    tauQvS = 30 * 86400,
    tauThetaColumn = 15 * 86400,
    tauQvColumn = 12 * 86400,
    tauWindColumn = 10 * 86400,
    sstAirOffsetK = -1,
    rhTargetOceanEq = 0.8,
    rhTargetOceanPole = 0.72,
    rhTargetLandEq = 0.7,
    rhTargetLandPole = 0.55,
    qvCap = 0.03,
    landQvNudgeScale = 0.5,
    oceanQvNudgeScale = 1.0,
    organizedConvectionQvSurfaceRelief = 0.65,
    organizedConvectionQvColumnRelief = 0.8,
    organizedConvectionThetaColumnRelief = 0.45,
    subtropicalSubsidenceQvRelief = 0.85,
    smoothLon = 31,
    smoothLat = 9,
    psMin = 50000,
    psMax = 110000
  } = params;
  if (!enable) return;

  const { tmp2D, tmp2D2 } = scratch;
  if (!tmp2D || !tmp2D2) return;

  const { nx, ny, latDeg } = grid;
  const { N, nz, ps, theta, qv, landMask, pMid, sstNow, soilW, soilCap, u, v } = state;
  const convectiveOrganization = state.convectiveOrganization;
  const subtropicalSubsidenceDrying = state.subtropicalSubsidenceDrying;
  const climoTargets = buildClimoTargetMaps(climo);
  const analysisTargets = state.analysisTargets || null;
  const slpNow = climoTargets.surfacePressurePa;
  const t2mNow = climo.hasT2m && climo.t2mNow && climo.t2mNow.length === N ? climo.t2mNow : null;
  const sstField = climo.sstNow && climo.sstNow.length === N ? climo.sstNow : sstNow;

  if (enablePs && slpNow) {
    smoothBox2D({
      grid,
      src: slpNow,
      tmp: tmp2D,
      out: tmp2D2,
      smoothLon,
      smoothLat
    });

    const coeff = clamp(dt / tauPs, 0, 1);
    for (let k = 0; k < ps.length; k++) {
      ps[k] += (tmp2D2[k] - ps[k]) * coeff;
      ps[k] = clamp(ps[k], psMin, psMax);
    }
  }

  const levS = nz - 1;
  const thetaBase = 285;
  const thetaEquatorBoost = 12;
  const thetaPoleDrop = 22;

  for (let j = 0; j < ny; j++) {
    const latAbs = Math.abs(latDeg[j]);
    const humidLat = smoothstep(60, 0, latAbs);
    const thetaLat = thetaBase + thetaEquatorBoost * humidLat - thetaPoleDrop * (1 - humidLat);
    const tBaseline = thetaLat - 2;
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = row + i;
      const land = landMask[k] === 1;
      let tTarget = tBaseline;
      if (!land) {
        if (sstField && sstField.length === N) {
          tTarget = sstField[k] + sstAirOffsetK;
        }
      } else if (t2mNow) {
        tTarget = t2mNow[k];
      }
      tmp2D[k] = clamp(tTarget, 200, 330);
    }
  }

  smoothBox2D({
    grid,
    src: tmp2D,
    tmp: tmp2D2,
    out: tmp2D,
    smoothLon,
    smoothLat
  });

  if (enableThetaS && pMid) {
    const coeff = clamp(dt / tauThetaS, 0, 1);
    for (let k = 0; k < N; k++) {
      const idxS = levS * N + k;
      const pS = Math.max(100, pMid[idxS]);
      const PiS = Math.pow(pS / P0, KAPPA);
      const thetaTarget = tmp2D[k] / PiS;
      theta[idxS] += (thetaTarget - theta[idxS]) * coeff;
      theta[idxS] = clamp(theta[idxS], 200, 400);
    }
  }

  if (enableQvS && pMid) {
    for (let j = 0; j < ny; j++) {
      const latAbs = Math.abs(latDeg[j]);
      const humidLat = smoothstep(60, 0, latAbs);
      const rhOcean = lerp(rhTargetOceanPole, rhTargetOceanEq, humidLat);
      const rhLand = lerp(rhTargetLandPole, rhTargetLandEq, humidLat);
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        const land = landMask[k] === 1;
        const dryBeltRelief = smoothstep(14, 34, latAbs)
          * smoothstep(-0.02, 0.25, state.lowLevelOmegaEffective?.[k] || 0);
        const subtropicalDrying = state.subtropicalSubsidenceDrying?.[k] || 0;
        const subtropicalDryingStrength = smoothstep(0.01, 0.08, subtropicalDrying);
        const rhTarget = clamp(
          (land ? rhLand : rhOcean) * (1 - 0.6 * dryBeltRelief - 0.52 * subtropicalDryingStrength),
          0.08,
          0.95
        );
        const idxS = levS * N + k;
        const pS = Math.max(100, pMid[idxS]);
        const qs = saturationMixingRatio(tmp2D[k], pS);
        tmp2D2[k] = clamp(rhTarget * qs, 0, qvCap);
      }
    }

    smoothBox2D({
      grid,
      src: tmp2D2,
      tmp: tmp2D,
      out: tmp2D2,
      smoothLon,
      smoothLat
    });

    const coeff = clamp(dt / tauQvS, 0, 1);
    for (let k = 0; k < N; k++) {
      const idxS = levS * N + k;
      const land = landMask[k] === 1;
      const row = Math.floor(k / nx);
      const latAbs = Math.abs(latDeg[row]);
      let scale = land ? landQvNudgeScale : oceanQvNudgeScale;
      const dryBeltRelief = smoothstep(14, 34, latAbs)
        * smoothstep(-0.02, 0.25, state.lowLevelOmegaEffective?.[k] || 0);
      const subtropicalDrying = subtropicalSubsidenceDrying?.[k] || 0;
      const subtropicalDryingStrength = smoothstep(0.01, 0.08, subtropicalDrying);
      const organizedReliefSource = 0.75 * (convectiveOrganization?.[k] || 0)
        + 0.25 * (state.convectivePotential?.[k] || 0);
      const convRelief = 1 - clamp01(organizedReliefSource * organizedConvectionQvSurfaceRelief);
      const subsidenceRelief = 1 - clamp01(
        Math.max(subtropicalDryingStrength, dryBeltRelief * 1.4) * subtropicalSubsidenceQvRelief
      );
      if (land) {
        const cap = soilCap ? soilCap[k] : 0;
        const avail = cap > 0 ? clamp01((soilW ? soilW[k] : 0) / cap) : 0;
        scale *= lerp(0.2, 1.0, avail);
      }
      const dryBeltMoistureSuppression = 1 - clamp01(0.55 * dryBeltRelief + 0.95 * subtropicalDryingStrength);
      scale *= Math.min(convRelief, subsidenceRelief) * dryBeltMoistureSuppression;
      qv[idxS] += (tmp2D2[k] - qv[idxS]) * coeff * scale;
      qv[idxS] = clamp(qv[idxS], 0, qvCap);
    }
  }

  const thetaTargetMap = selectTargetMap(
    thetaSource,
    analysisTargets?.thetaKByPressurePa || analysisTargets?.temperatureKByPressurePa || null,
    climoTargets.temperature
  );
  if (enableThetaColumn && thetaTargetMap && pMid) {
    const coeff = clamp(dt / tauThetaColumn, 0, 1);
    const useTemperature = thetaTargetMap === climoTargets.temperature || thetaTargetMap === analysisTargets?.temperatureKByPressurePa;
    for (let cell = 0; cell < N; cell += 1) {
      for (let lev = 0; lev < nz; lev += 1) {
        const idx = lev * N + cell;
        const pTarget = pMid[idx];
        const targetValue = interpolatePressureFieldAtCell(thetaTargetMap, pTarget, cell);
        if (!Number.isFinite(targetValue)) continue;
        const thetaTarget = useTemperature ? targetValue / Math.pow(pTarget / P0, KAPPA) : targetValue;
        const organizedReliefSource = 0.7 * (convectiveOrganization?.[cell] || 0)
          + 0.3 * (state.convectivePotential?.[cell] || 0);
        const relief = 1 - clamp01(organizedReliefSource * organizedConvectionThetaColumnRelief);
        theta[idx] += (thetaTarget - theta[idx]) * coeff * relief;
      }
    }
  }

  const qvTargetMap = selectTargetMap(
    qvSource,
    analysisTargets?.specificHumidityKgKgByPressurePa || null,
    climoTargets.qv
  );
  if (enableQvColumn && qvTargetMap && pMid) {
    const coeff = clamp(dt / tauQvColumn, 0, 1);
    for (let cell = 0; cell < N; cell += 1) {
      const row = Math.floor(cell / nx);
      const latAbs = Math.abs(latDeg[row]);
      const dryBeltRelief = smoothstep(14, 34, latAbs)
        * smoothstep(-0.02, 0.25, state.lowLevelOmegaEffective?.[cell] || 0);
      const subtropicalDryingStrength = smoothstep(0.01, 0.08, subtropicalSubsidenceDrying?.[cell] || 0);
      for (let lev = 0; lev < nz; lev += 1) {
        const idx = lev * N + cell;
        const targetValue = interpolatePressureFieldAtCell(qvTargetMap, pMid[idx], cell);
        if (!Number.isFinite(targetValue)) continue;
        const organizedReliefSource = 0.75 * (convectiveOrganization?.[cell] || 0)
          + 0.25 * (state.convectivePotential?.[cell] || 0);
        const convRelief = 1 - clamp01(organizedReliefSource * organizedConvectionQvColumnRelief);
        const subsidenceRelief = 1 - clamp01(
          Math.max(subtropicalDryingStrength, dryBeltRelief * 1.4) * subtropicalSubsidenceQvRelief
        );
        const dryBeltMoistureSuppression = 1 - clamp01(0.45 * dryBeltRelief + 1.05 * subtropicalDryingStrength);
        qv[idx] += (clamp(targetValue, 0, qvCap) - qv[idx]) * coeff * Math.min(convRelief, subsidenceRelief) * dryBeltMoistureSuppression;
        qv[idx] = clamp(qv[idx], 0, qvCap);
      }
    }
  }

  const windUTargetMap = selectTargetMap(windSource, analysisTargets?.uByPressurePa || null, climoTargets.windU);
  const windVTargetMap = selectTargetMap(windSource, analysisTargets?.vByPressurePa || null, climoTargets.windV);
  if (enableWindColumn && windUTargetMap && windVTargetMap && pMid) {
    const coeff = clamp(dt / tauWindColumn, 0, 1);
    for (let cell = 0; cell < N; cell += 1) {
      for (let lev = 0; lev < nz; lev += 1) {
        const idx = lev * N + cell;
        const pTarget = pMid[idx];
        const uTarget = interpolatePressureFieldAtCell(windUTargetMap, pTarget, cell);
        const vTarget = interpolatePressureFieldAtCell(windVTargetMap, pTarget, cell);
        if (!Number.isFinite(uTarget) || !Number.isFinite(vTarget)) continue;
        u[idx] += (uTarget - u[idx]) * coeff;
        v[idx] += (vTarget - v[idx]) * coeff;
      }
    }
  }
}
