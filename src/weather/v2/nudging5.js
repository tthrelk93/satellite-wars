import { Rd, Cp } from '../constants';

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
  'tauPs',
  'tauThetaS',
  'tauQvS',
  'sstAirOffsetK',
  'rhTargetOceanEq',
  'rhTargetOceanPole',
  'rhTargetLandEq',
  'rhTargetLandPole',
  'qvCap',
  'smoothLon',
  'smoothLat',
  'cadenceSeconds'
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

export function stepNudging5({ dt, grid, state, climo, params = {}, scratch }) {
  if (!grid || !state || !climo || !scratch || !Number.isFinite(dt) || dt <= 0) return;
  warnUnknownNudgeParams(params);
  const {
    enable = true,
    enablePs = true,
    enableThetaS = false,
    enableQvS = false,
    enableUpper = false,
    tauPs = 30 * 86400,
    tauThetaS = 45 * 86400,
    tauQvS = 30 * 86400,
    sstAirOffsetK = -1,
    rhTargetOceanEq = 0.8,
    rhTargetOceanPole = 0.72,
    rhTargetLandEq = 0.7,
    rhTargetLandPole = 0.55,
    qvCap = 0.03,
    smoothLon = 31,
    smoothLat = 9
  } = params;
  if (!enable) return;

  const { tmp2D, tmp2D2 } = scratch;
  if (!tmp2D || !tmp2D2) return;

  const { nx, ny, latDeg } = grid;
  const { N, nz, ps, theta, qv, landMask, pMid, sstNow } = state;
  const slpNow = climo.hasSlp && climo.slpNow && climo.slpNow.length === ps.length ? climo.slpNow : null;
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
      ps[k] = clamp(ps[k], 50000, 110000);
    }
  }

  if (!enableThetaS && !enableQvS) {
    void enableUpper;
    return;
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
        const rhTarget = clamp(land ? rhLand : rhOcean, 0.1, 0.95);
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
      qv[idxS] += (tmp2D2[k] - qv[idxS]) * coeff;
      qv[idxS] = Math.max(0, qv[idxS]);
    }
  }

  void enableUpper;
}
