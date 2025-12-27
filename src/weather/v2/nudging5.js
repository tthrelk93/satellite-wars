const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const NUDGE_ALLOWED_PARAMS = new Set([
  'enable',
  'enablePs',
  'enableUpper',
  'tauPs',
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
    enableUpper = false,
    tauPs = 30 * 86400,
    smoothLon = 31,
    smoothLat = 9
  } = params;
  if (!enable || !enablePs) return;
  if (!climo.hasSlp || !climo.slpNow || climo.slpNow.length !== state.ps.length) return;

  const { tmp2D, tmp2D2 } = scratch;
  if (!tmp2D || !tmp2D2) return;

  smoothBox2D({
    grid,
    src: climo.slpNow,
    tmp: tmp2D,
    out: tmp2D2,
    smoothLon,
    smoothLat
  });

  const { ps } = state;
  const coeff = dt / tauPs;
  for (let k = 0; k < ps.length; k++) {
    ps[k] += (tmp2D2[k] - ps[k]) * coeff;
    ps[k] = clamp(ps[k], 50000, 110000);
  }

  void enableUpper;
}
