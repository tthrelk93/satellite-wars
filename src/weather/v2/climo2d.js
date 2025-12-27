import { loadClimatology } from '../climatology';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const lerp = (a, b, t) => a + (b - a) * t;

const deriveLandMask = (source, threshold) => {
  if (!source) return null;
  const count = source.length;
  const mask = new Uint8Array(count);
  let landCount = 0;
  for (let k = 0; k < count; k++) {
    const land = source[k] > threshold;
    if (land) landCount += 1;
    mask[k] = land ? 1 : 0;
  }
  return { mask, landFrac: landCount / count };
};

export async function initClimo2D({ grid, seed } = {}) {
  const nx = grid?.nx ?? 180;
  const ny = grid?.ny ?? 90;
  const latDeg = grid?.latDeg;
  const N = nx * ny;

  let climo;
  try {
    climo = await loadClimatology({ nx, ny, latDeg });
  } catch (err) {
    climo = null;
  }

  const sstNow = new Float32Array(N);
  const iceNow = new Float32Array(N);
  const slpNow = new Float32Array(N);
  const t2mNow = new Float32Array(N);
  const soilCap = new Float32Array(N);
  const albedo = new Float32Array(N);
  const elev = new Float32Array(N);
  const landMask = new Uint8Array(N);

  const sstMonths = climo?.sstMonths && climo.sstMonths.length === 12 ? climo.sstMonths : null;
  const iceMonths = climo?.iceMonths && climo.iceMonths.length === 12 ? climo.iceMonths : null;
  const slpMonths = climo?.slpMonths && climo.slpMonths.length === 12 ? climo.slpMonths : null;
  const t2mMonths = climo?.t2mMonths && climo.t2mMonths.length === 12 ? climo.t2mMonths : null;
  const hasSlp = Boolean(slpMonths);
  const hasT2m = Boolean(t2mMonths);

  if (climo?.soilCap && climo.soilCap.length === N) soilCap.set(climo.soilCap);
  if (climo?.albedo && climo.albedo.length === N) albedo.set(climo.albedo);
  if (climo?.elev && climo.elev.length === N) elev.set(climo.elev);

  const updateClimoNow = ({ timeUTC, out }) => {
    if (!out?.sstNow || !sstMonths) return;
    const dayOfYear = (timeUTC / 86400) % 365;
    const monthFloat = (dayOfYear / 365) * 12;
    const m0 = Math.floor(monthFloat) % 12;
    const m1 = (m0 + 1) % 12;
    const f = monthFloat - Math.floor(monthFloat);

    const sst0 = sstMonths[m0];
    const sst1 = sstMonths[m1];
    const sstOut = out.sstNow;
    for (let k = 0; k < sstOut.length; k++) {
      sstOut[k] = lerp(sst0[k], sst1[k], f);
    }

    if (out.iceNow) {
      if (iceMonths) {
        const ice0 = iceMonths[m0];
        const ice1 = iceMonths[m1];
        const iceOut = out.iceNow;
        for (let k = 0; k < iceOut.length; k++) {
          iceOut[k] = clamp01(lerp(ice0[k], ice1[k], f));
        }
      } else {
        out.iceNow.fill(0);
      }
    }

    if (out.slpNow) {
      if (slpMonths) {
        const slp0 = slpMonths[m0];
        const slp1 = slpMonths[m1];
        const slpOut = out.slpNow;
        for (let k = 0; k < slpOut.length; k++) {
          slpOut[k] = lerp(slp0[k], slp1[k], f);
        }
      } else {
        out.slpNow.fill(0);
      }
    }

    if (out.t2mNow) {
      if (t2mMonths) {
        const t20 = t2mMonths[m0];
        const t21 = t2mMonths[m1];
        const t2Out = out.t2mNow;
        for (let k = 0; k < t2Out.length; k++) {
          t2Out[k] = lerp(t20[k], t21[k], f);
        }
      } else {
        out.t2mNow.fill(0);
      }
    }
  };

  updateClimoNow({ timeUTC: 0, out: { sstNow, iceNow, slpNow, t2mNow } });

  const landCandidates = [
    climo?.soilCap ? { name: 'soilCap', source: soilCap, threshold: 0.01 } : null,
    climo?.elev ? { name: 'elev', source: elev, threshold: 5 } : null,
    climo?.albedo ? { name: 'albedo', source: albedo, threshold: 0.08 } : null
  ].filter(Boolean);

  let fallback = null;
  let chosen = null;
  for (const candidate of landCandidates) {
    const result = deriveLandMask(candidate.source, candidate.threshold);
    if (!result) continue;
    if (!fallback) fallback = { ...result, name: candidate.name };
    if (result.landFrac >= 0.05 && result.landFrac <= 0.95) {
      chosen = { ...result, name: candidate.name };
      break;
    }
  }
  if (!chosen && fallback) {
    chosen = fallback;
  }
  if (chosen?.mask && chosen.mask.length === landMask.length) {
    landMask.set(chosen.mask);
  }

  void seed;

  return {
    ready: true,
    landMask,
    sstNow,
    iceNow,
    slpNow,
    t2mNow,
    hasSlp,
    hasT2m,
    soilCap,
    albedo,
    elev,
    updateClimoNow
  };
}
