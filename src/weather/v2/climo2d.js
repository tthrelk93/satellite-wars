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
  const windNowU = new Float32Array(N);
  const windNowV = new Float32Array(N);
  const wind500NowU = new Float32Array(N);
  const wind500NowV = new Float32Array(N);
  const wind250NowU = new Float32Array(N);
  const wind250NowV = new Float32Array(N);
  const q2mNow = new Float32Array(N);
  const q700Now = new Float32Array(N);
  const q250Now = new Float32Array(N);
  const t700Now = new Float32Array(N);
  const t250Now = new Float32Array(N);
  const soilCap = new Float32Array(N);
  const albedo = new Float32Array(N);
  const elev = new Float32Array(N);
  const landMask = new Uint8Array(N);

  const sstMonths = climo?.sstMonths && climo.sstMonths.length === 12 ? climo.sstMonths : null;
  const iceMonths = climo?.iceMonths && climo.iceMonths.length === 12 ? climo.iceMonths : null;
  const slpMonths = climo?.slpMonths && climo.slpMonths.length === 12 ? climo.slpMonths : null;
  const t2mMonths = climo?.t2mMonths && climo.t2mMonths.length === 12 ? climo.t2mMonths : null;
  const windMonthsU = climo?.windMonthsU && climo.windMonthsU.length === 12 ? climo.windMonthsU : null;
  const windMonthsV = climo?.windMonthsV && climo.windMonthsV.length === 12 ? climo.windMonthsV : null;
  const wind500MonthsU = climo?.wind500MonthsU && climo.wind500MonthsU.length === 12 ? climo.wind500MonthsU : null;
  const wind500MonthsV = climo?.wind500MonthsV && climo.wind500MonthsV.length === 12 ? climo.wind500MonthsV : null;
  const wind250MonthsU = climo?.wind250MonthsU && climo.wind250MonthsU.length === 12 ? climo.wind250MonthsU : null;
  const wind250MonthsV = climo?.wind250MonthsV && climo.wind250MonthsV.length === 12 ? climo.wind250MonthsV : null;
  const q2mMonths = climo?.q2mMonths && climo.q2mMonths.length === 12 ? climo.q2mMonths : null;
  const q700Months = climo?.q700Months && climo.q700Months.length === 12 ? climo.q700Months : null;
  const q250Months = climo?.q250Months && climo.q250Months.length === 12 ? climo.q250Months : null;
  const t700Months = climo?.t700Months && climo.t700Months.length === 12 ? climo.t700Months : null;
  const t250Months = climo?.t250Months && climo.t250Months.length === 12 ? climo.t250Months : null;
  const hasSlp = Boolean(slpMonths);
  const hasT2m = Boolean(t2mMonths);
  const hasWind = Boolean(windMonthsU && windMonthsV);
  const hasWind500 = Boolean(wind500MonthsU && wind500MonthsV);
  const hasWind250 = Boolean(wind250MonthsU && wind250MonthsV);
  const hasQ2m = Boolean(q2mMonths);
  const hasQ700 = Boolean(q700Months);
  const hasQ250 = Boolean(q250Months);
  const hasT700 = Boolean(t700Months);
  const hasT250 = Boolean(t250Months);

  if (climo?.soilCap && climo.soilCap.length === N) soilCap.set(climo.soilCap);
  if (climo?.albedo && climo.albedo.length === N) albedo.set(climo.albedo);
  if (climo?.elev && climo.elev.length === N) elev.set(climo.elev);

  const updateMonthlyField = (months, outField, m0, m1, f, fallbackValue = 0) => {
    if (!outField) return;
    if (months) {
      const field0 = months[m0];
      const field1 = months[m1];
      for (let k = 0; k < outField.length; k++) {
        outField[k] = lerp(field0[k], field1[k], f);
      }
    } else {
      outField.fill(fallbackValue);
    }
  };

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

    updateMonthlyField(slpMonths, out.slpNow, m0, m1, f, 0);
    updateMonthlyField(t2mMonths, out.t2mNow, m0, m1, f, 0);
    updateMonthlyField(windMonthsU, out.windNowU, m0, m1, f, 0);
    updateMonthlyField(windMonthsV, out.windNowV, m0, m1, f, 0);
    updateMonthlyField(wind500MonthsU, out.wind500NowU, m0, m1, f, 0);
    updateMonthlyField(wind500MonthsV, out.wind500NowV, m0, m1, f, 0);
    updateMonthlyField(wind250MonthsU, out.wind250NowU, m0, m1, f, 0);
    updateMonthlyField(wind250MonthsV, out.wind250NowV, m0, m1, f, 0);
    updateMonthlyField(q2mMonths, out.q2mNow, m0, m1, f, 0);
    updateMonthlyField(q700Months, out.q700Now, m0, m1, f, 0);
    updateMonthlyField(q250Months, out.q250Now, m0, m1, f, 0);
    updateMonthlyField(t700Months, out.t700Now, m0, m1, f, 0);
    updateMonthlyField(t250Months, out.t250Now, m0, m1, f, 0);
  };

  updateClimoNow({
    timeUTC: 0,
    out: {
      sstNow,
      iceNow,
      slpNow,
      t2mNow,
      windNowU,
      windNowV,
      wind500NowU,
      wind500NowV,
      wind250NowU,
      wind250NowV,
      q2mNow,
      q700Now,
      q250Now,
      t700Now,
      t250Now
    }
  });

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
    windNowU,
    windNowV,
    wind500NowU,
    wind500NowV,
    wind250NowU,
    wind250NowV,
    q2mNow,
    q700Now,
    q250Now,
    t700Now,
    t250Now,
    hasSlp,
    hasT2m,
    hasWind,
    hasWind500,
    hasWind250,
    hasQ2m,
    hasQ700,
    hasQ250,
    hasT700,
    hasT250,
    soilCap,
    albedo,
    elev,
    updateClimoNow
  };
}
