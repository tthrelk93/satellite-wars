import { g, Rd, Cp, Re, Lv } from '../constants.js';
import { computeGeopotentialHeightByPressure, DEFAULT_PRESSURE_LEVELS_PA } from '../v2/verticalGrid.js';
import {
  NH_DRY_BELT_SOURCE_SECTORS,
  SURFACE_MOISTURE_SOURCE_TRACERS,
  classifyNhDryBeltSector
} from '../v2/sourceTracing5.js';
import { CLOUD_BIRTH_LEVEL_BANDS, cloudBirthBandOffset } from '../v2/cloudBirthTracing5.js';
import { INSTRUMENTATION_LEVEL_BANDS } from '../v2/instrumentationBands5.js';

const EPS = 1e-6;
const P0 = 100000;
const KAPPA = Rd / Cp;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const round = (value, digits = 3) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const scaleToUnit = (value, min, max) => clamp01((value - min) / Math.max(EPS, max - min));
const TRANSPORT_INTERFACE_TARGETS_DEG = [-35, -22, -12, 0, 12, 22, 35];
const TRANSPORT_LEVEL_BANDS = INSTRUMENTATION_LEVEL_BANDS.map((band) => ({ ...band }));
const TRANSPORT_LATITUDE_BANDS = [
  { key: 'southExtratropics', label: 'South extratropics', lat0: -60, lat1: -35 },
  { key: 'southDryBelt', label: 'South dry belt', lat0: -35, lat1: -15 },
  { key: 'southTransition', label: 'South transition', lat0: -22, lat1: -12 },
  { key: 'tropicalCore', label: 'Tropical core', lat0: -12, lat1: 12 },
  { key: 'northTransition', label: 'North transition', lat0: 12, lat1: 22 },
  { key: 'northDryBelt', label: 'North dry belt', lat0: 15, lat1: 35 },
  { key: 'northExtratropics', label: 'North extratropics', lat0: 35, lat1: 60 }
];
const VERTICAL_CLOUD_BIRTH_CHANNELS = [
  { key: 'resolvedAscentCloudBirth', label: 'Resolved-ascent cloud birth' },
  { key: 'saturationAdjustmentCloudBirth', label: 'Saturation-adjustment cloud birth' },
  { key: 'convectiveDetrainmentCloudBirth', label: 'Convective detrainment cloud birth' },
  { key: 'carryOverUpperCloudEntering', label: 'Carry-over upper cloud entering step' },
  { key: 'carryOverUpperCloudSurviving', label: 'Carry-over upper cloud surviving step' }
];
const CLOUD_BIRTH_SUPERSATURATION_BINS = [
  { key: 'sub1pct', label: '<1%', min: 0, max: 0.01 },
  { key: 'pct1to3', label: '1-3%', min: 0.01, max: 0.03 },
  { key: 'pct3to6', label: '3-6%', min: 0.03, max: 0.06 },
  { key: 'pct6to10', label: '6-10%', min: 0.06, max: 0.1 },
  { key: 'gt10pct', label: '>10%', min: 0.1, max: Infinity }
];
const CLOUD_BIRTH_ASCENT_BINS = [
  { key: 'weak', label: '<0.03 Pa/s', min: 0, max: 0.03 },
  { key: 'modest', label: '0.03-0.08 Pa/s', min: 0.03, max: 0.08 },
  { key: 'organized', label: '0.08-0.18 Pa/s', min: 0.08, max: 0.18 },
  { key: 'strong', label: '0.18-0.35 Pa/s', min: 0.18, max: 0.35 },
  { key: 'extreme', label: '>0.35 Pa/s', min: 0.35, max: Infinity }
];
const STORM_SPILLOVER_REGIMES = [
  { key: 'persistent_zonal_background', label: 'Persistent zonal background' },
  { key: 'tropical_spillover', label: 'Tropical spillover' },
  { key: 'subtropical_marine_deck_drizzle', label: 'Subtropical marine deck / drizzle' },
  { key: 'synoptic_storm_leakage', label: 'Synoptic storm leakage' }
];
const STORM_SPILLOVER_INTERFACE_TARGETS_DEG = [22, 35];
const STORM_SPILLOVER_LEVEL_BANDS = [
  { key: 'lowerTroposphere', label: 'Lower troposphere', minSigma: 0.65, maxSigma: 0.85 },
  { key: 'midTroposphere', label: 'Mid troposphere', minSigma: 0.35, maxSigma: 0.65 },
  { key: 'upperTroposphere', label: 'Upper troposphere', minSigma: 0.0, maxSigma: 0.35 }
];

const saturationMixingRatio = (T, p) => {
  const Tuse = Math.max(180, Math.min(330, T));
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

const computeSeaLevelPressurePa = (core) => {
  const ps = core?.state?.ps;
  const Ts = core?.fields?.Ts;
  const elev = core?.geo?.elev;
  if (!ps || !Ts || !elev) return [];
  const out = new Array(ps.length);
  for (let i = 0; i < ps.length; i += 1) {
    const tMean = Math.max(180, Ts[i] + 0.5 * 0.0065 * Math.max(0, elev[i] || 0));
    out[i] = ps[i] * Math.exp((g * Math.max(0, elev[i] || 0)) / Math.max(EPS, Rd * tMean));
  }
  return out;
};

const computeColumnIntegralKgM2 = (state, selector) => {
  const { N, nz, pHalf } = state;
  const out = new Array(N).fill(0);
  for (let cell = 0; cell < N; cell += 1) {
    let total = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      const idx = lev * N + cell;
      const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
      total += selector(idx) * (dp / g);
    }
    out[cell] = total;
  }
  return out;
};

const computeTotalColumnWaterKgM2 = (state) => {
  const { qv, qc, qi, qr, qs } = state;
  return computeColumnIntegralKgM2(state, (idx) => qv[idx] + qc[idx] + (qi?.[idx] || 0) + (qr?.[idx] || 0) + (qs?.[idx] || 0));
};

const computeLayerCondensatePathKgM2 = (state, minSigma, maxSigma) => {
  const { N, nz, sigmaHalf, pHalf, qc, qi, qr, qs } = state;
  const out = new Array(N).fill(0);
  for (let cell = 0; cell < N; cell += 1) {
    let total = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = sigmaHalf && sigmaHalf.length > lev + 1
        ? 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1])
        : (lev + 0.5) / Math.max(1, nz);
      if (sigmaMid < minSigma || sigmaMid > maxSigma) continue;
      const idx = lev * N + cell;
      const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
      total += ((qc?.[idx] || 0) + (qi?.[idx] || 0) + (qr?.[idx] || 0) + (qs?.[idx] || 0)) * (dp / g);
    }
    out[cell] = total;
  }
  return out;
};

const computeLayerFieldPathKgM2 = (state, field, minSigma, maxSigma) => {
  const { N, nz, sigmaHalf, pHalf } = state;
  const out = new Array(N).fill(0);
  if (!field || field.length !== state.SZ) return out;
  for (let cell = 0; cell < N; cell += 1) {
    let total = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = sigmaHalf && sigmaHalf.length > lev + 1
        ? 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1])
        : (lev + 0.5) / Math.max(1, nz);
      if (sigmaMid < minSigma || sigmaMid > maxSigma) continue;
      const idx = lev * N + cell;
      const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
      total += (field[idx] || 0) * (dp / g);
    }
    out[cell] = total;
  }
  return out;
};

const computeLayerMeanRelativeHumidity = (state, minSigma, maxSigma) => {
  const { N, nz, sigmaHalf, pHalf, pMid, qv, theta, T } = state;
  const out = new Array(N).fill(0);
  for (let cell = 0; cell < N; cell += 1) {
    let total = 0;
    let weightTotal = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = sigmaHalf && sigmaHalf.length > lev + 1
        ? 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1])
        : (lev + 0.5) / Math.max(1, nz);
      if (sigmaMid < minSigma || sigmaMid > maxSigma) continue;
      const idx = lev * N + cell;
      const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
      const p = Math.max(100, pMid[idx]);
      const Pi = Math.pow(p / P0, KAPPA);
      const tempK = Number.isFinite(T?.[idx]) ? T[idx] : theta[idx] * Pi;
      const qsat = saturationMixingRatio(tempK, p);
      total += Math.max(0, Math.min(2, qv[idx] / Math.max(EPS, qsat))) * dp;
      weightTotal += dp;
    }
    out[cell] = weightTotal > 0 ? total / weightTotal : 0;
  }
  return out;
};

const computeLayerMeanDerived = (state, minSigma, maxSigma, selector) => {
  const { N, nz, sigmaHalf, pHalf } = state;
  const out = new Array(N).fill(0);
  for (let cell = 0; cell < N; cell += 1) {
    let total = 0;
    let weightTotal = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = sigmaHalf && sigmaHalf.length > lev + 1
        ? 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1])
        : (lev + 0.5) / Math.max(1, nz);
      if (sigmaMid < minSigma || sigmaMid > maxSigma) continue;
      const idx = lev * N + cell;
      const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
      total += selector(idx, lev, cell) * dp;
      weightTotal += dp;
    }
    out[cell] = weightTotal > 0 ? total / weightTotal : 0;
  }
  return out;
};

const computeLayerMeanPotentialTemperature = (state, minSigma, maxSigma) => (
  computeLayerMeanDerived(state, minSigma, maxSigma, (idx) => state.theta[idx] || 0)
);

const computeLayerMeanThetaeK = (state, minSigma, maxSigma, { thetaeCoeff = 10, thetaeQvCap = 0.03 } = {}) => (
  computeLayerMeanDerived(state, minSigma, maxSigma, (idx) => {
    const thetaK = state.theta[idx] || 0;
    const qv = Math.min(state.qv[idx] || 0, thetaeQvCap);
    return thetaK * (1 + thetaeCoeff * qv);
  })
);

const computeLayerMeanMseJkg = (state, minSigma, maxSigma) => (
  computeLayerMeanDerived(state, minSigma, maxSigma, (idx) => {
    const p = Math.max(100, state.pMid[idx]);
    const Pi = Math.pow(p / P0, KAPPA);
    const tempK = Number.isFinite(state.T?.[idx]) ? state.T[idx] : (state.theta[idx] || 0) * Pi;
    return Cp * tempK + (state.phiMid?.[idx] || 0) + Lv * (state.qv[idx] || 0);
  })
);

const computeLayerMeanOmegaPaS = (state, minSigma, maxSigma) => (
  computeLayerMeanDerived(state, minSigma, maxSigma, (_idx, lev, cell) => {
    if (!state.omega) return 0;
    const lowerInterface = state.omega[lev * state.N + cell] || 0;
    const upperInterface = state.omega[(lev + 1) * state.N + cell] || 0;
    return 0.5 * (lowerInterface + upperInterface);
  })
);

const computeVerticallyIntegratedFlux = (state, componentField, tracerSelector) => {
  const { N, nz, pHalf } = state;
  const out = new Array(N).fill(0);
  for (let cell = 0; cell < N; cell += 1) {
    let total = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      const idx = lev * N + cell;
      const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
      total += componentField[idx] * tracerSelector(idx) * (dp / g);
    }
    out[cell] = total;
  }
  return out;
};

const arrayOrZeros = (arrLike, length) => Array.from(arrLike || new Float32Array(length));
const sliceBandField = (field, bandIndex, cellCount) => {
  if (!(field instanceof Float32Array) || field.length !== cellCount * INSTRUMENTATION_LEVEL_BANDS.length) {
    return new Float32Array(cellCount);
  }
  return field.subarray(bandIndex * cellCount, (bandIndex + 1) * cellCount);
};
const sliceCloudBirthBandField = (field, bandIndex, cellCount) => {
  if (
    !(field instanceof Float32Array || field instanceof Float64Array)
    || field.length !== cellCount * CLOUD_BIRTH_LEVEL_BANDS.length
  ) {
    return new Float32Array(cellCount);
  }
  return field.subarray(bandIndex * cellCount, (bandIndex + 1) * cellCount);
};

const sigmaMidAtLevel = (sigmaHalf, lev, nz) => (
  sigmaHalf && sigmaHalf.length > lev + 1
    ? 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1])
    : (lev + 0.5) / Math.max(1, nz)
);

const makeRowWeights = (latitudesDeg) => latitudesDeg.map((lat) => Math.max(0.05, Math.cos((lat * Math.PI) / 180)));

const weightedFieldBandMean = (field, nx, ny, latitudesDeg, rowWeights, lat0, lat1, landMask = null, landMaskMode = 'all') => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      if (landMaskMode !== 'all' && landMask) {
        const isLand = landMask[idx] === 1;
        if (landMaskMode === 'land' && !isLand) continue;
        if (landMaskMode === 'ocean' && isLand) continue;
      }
      total += (field[idx] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const weightedFieldBandMeanWithFilter = (field, nx, ny, latitudesDeg, longitudesDeg, rowWeights, lat0, lat1, predicate = null) => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      if (predicate && !predicate({ idx, latDeg: lat, lonDeg: longitudesDeg[i] })) continue;
      total += (field[idx] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const resolveLatitudeInterface = (latitudesDeg, targetLatDeg) => {
  if (!Array.isArray(latitudesDeg) || latitudesDeg.length < 2) return null;
  let best = null;
  let bestDistance = Infinity;
  for (let row = 0; row < latitudesDeg.length - 1; row += 1) {
    const latNorthDeg = latitudesDeg[row];
    const latSouthDeg = latitudesDeg[row + 1];
    const latMin = Math.min(latNorthDeg, latSouthDeg);
    const latMax = Math.max(latNorthDeg, latSouthDeg);
    const latMidDeg = 0.5 * (latNorthDeg + latSouthDeg);
    const distance = Math.abs(latMidDeg - targetLatDeg);
    if (targetLatDeg >= latMin && targetLatDeg <= latMax) {
      return {
        targetLatDeg,
        rowNorth: row,
        rowSouth: row + 1,
        latNorthDeg,
        latSouthDeg,
        latMidDeg
      };
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      best = {
        targetLatDeg,
        rowNorth: row,
        rowSouth: row + 1,
        latNorthDeg,
        latSouthDeg,
        latMidDeg
      };
    }
  }
  return best;
};

const findClosestLatitudeRow = (latitudesDeg, targetLatDeg) => {
  if (!Array.isArray(latitudesDeg) || !latitudesDeg.length) return -1;
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let row = 0; row < latitudesDeg.length; row += 1) {
    const distance = Math.abs((latitudesDeg[row] || 0) - targetLatDeg);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = row;
    }
  }
  return bestIndex;
};

const createFluxAccumulator = () => ({
  totalWeight: 0,
  sampleCount: 0,
  sumVelocityMs: 0,
  sumLayerMassKgM2: 0,
  sumPressurePa: 0,
  sumMassFluxNorthKgM_1S: 0,
  sumVaporMassKgM2: 0,
  sumVaporFluxNorthKgM_1S: 0,
  sumCloudMassKgM2: 0,
  sumCloudFluxNorthKgM_1S: 0,
  sumTotalWaterMassKgM2: 0,
  sumTotalWaterFluxNorthKgM_1S: 0,
  sourceTracerFluxNorthKgM_1S: Object.fromEntries(
    SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key }) => [key, 0])
  )
});

const accumulateFluxAccumulator = (
  accumulator,
  {
    sampleWeight = 1,
    velocityMs = 0,
    layerMassKgM2 = 0,
    pressurePa = 0,
    vaporMixingRatioKgKg = 0,
    cloudMixingRatioKgKg = 0,
    sourceMixingRatiosKgKg = {}
  }
) => {
  const weight = Math.max(EPS, sampleWeight);
  const vaporMassKgM2 = Math.max(0, vaporMixingRatioKgKg || 0) * layerMassKgM2;
  const cloudMassKgM2 = Math.max(0, cloudMixingRatioKgKg || 0) * layerMassKgM2;
  const totalWaterMassKgM2 = vaporMassKgM2 + cloudMassKgM2;
  accumulator.totalWeight += weight;
  accumulator.sampleCount += 1;
  accumulator.sumVelocityMs += velocityMs * weight;
  accumulator.sumLayerMassKgM2 += layerMassKgM2 * weight;
  accumulator.sumPressurePa += pressurePa * weight;
  accumulator.sumMassFluxNorthKgM_1S += velocityMs * layerMassKgM2 * weight;
  accumulator.sumVaporMassKgM2 += vaporMassKgM2 * weight;
  accumulator.sumVaporFluxNorthKgM_1S += velocityMs * vaporMassKgM2 * weight;
  accumulator.sumCloudMassKgM2 += cloudMassKgM2 * weight;
  accumulator.sumCloudFluxNorthKgM_1S += velocityMs * cloudMassKgM2 * weight;
  accumulator.sumTotalWaterMassKgM2 += totalWaterMassKgM2 * weight;
  accumulator.sumTotalWaterFluxNorthKgM_1S += velocityMs * totalWaterMassKgM2 * weight;
  for (const { key } of SURFACE_MOISTURE_SOURCE_TRACERS) {
    accumulator.sourceTracerFluxNorthKgM_1S[key] += velocityMs * Math.max(0, sourceMixingRatiosKgKg[key] || 0) * layerMassKgM2 * weight;
  }
};

const finalizeFluxAccumulator = (accumulator) => {
  const denom = Math.max(EPS, accumulator.totalWeight);
  const velocityMeanMs = accumulator.sumVelocityMs / denom;
  const layerMassMeanKgM2 = accumulator.sumLayerMassKgM2 / denom;
  const pressureMidMeanPa = accumulator.sumPressurePa / denom;
  const vaporMassMeanKgM2 = accumulator.sumVaporMassKgM2 / denom;
  const cloudMassMeanKgM2 = accumulator.sumCloudMassKgM2 / denom;
  const totalWaterMassMeanKgM2 = accumulator.sumTotalWaterMassKgM2 / denom;
  const vaporFluxNorthKgM_1S = accumulator.sumVaporFluxNorthKgM_1S / denom;
  const cloudFluxNorthKgM_1S = accumulator.sumCloudFluxNorthKgM_1S / denom;
  const totalWaterFluxNorthKgM_1S = accumulator.sumTotalWaterFluxNorthKgM_1S / denom;
  const massFluxNorthKgM_1S = accumulator.sumMassFluxNorthKgM_1S / denom;
  const vaporFluxZonalMeanComponentKgM_1S = velocityMeanMs * vaporMassMeanKgM2;
  const cloudFluxZonalMeanComponentKgM_1S = velocityMeanMs * cloudMassMeanKgM2;
  const totalWaterFluxZonalMeanComponentKgM_1S = velocityMeanMs * totalWaterMassMeanKgM2;
  return {
    sampleCount: accumulator.sampleCount,
    velocityMeanMs,
    layerMassMeanKgM2,
    pressureMidMeanPa,
    massFluxNorthKgM_1S,
    vaporMassMeanKgM2,
    vaporFluxNorthKgM_1S,
    vaporFluxZonalMeanComponentKgM_1S,
    vaporFluxEddyComponentKgM_1S: vaporFluxNorthKgM_1S - vaporFluxZonalMeanComponentKgM_1S,
    cloudMassMeanKgM2,
    cloudFluxNorthKgM_1S,
    cloudFluxZonalMeanComponentKgM_1S,
    cloudFluxEddyComponentKgM_1S: cloudFluxNorthKgM_1S - cloudFluxZonalMeanComponentKgM_1S,
    totalWaterMassMeanKgM2,
    totalWaterFluxNorthKgM_1S,
    totalWaterFluxZonalMeanComponentKgM_1S,
    totalWaterFluxEddyComponentKgM_1S: totalWaterFluxNorthKgM_1S - totalWaterFluxZonalMeanComponentKgM_1S,
    sourceTracerFluxNorthKgM_1S: Object.fromEntries(
      Object.entries(accumulator.sourceTracerFluxNorthKgM_1S).map(([key, value]) => [key, value / denom])
    )
  };
};

const buildTransportTracing = (state, grid) => {
  const { nx, ny } = grid;
  const { N, nz, sigmaHalf, pHalf, pMid, v, qv, qc, qi, qr, qs } = state;
  const tracerFields = SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key, field, label }) => ({
    key,
    label,
    field: state[field]
  }));
  const interfaceSummaries = [];

  for (const targetLatDeg of TRANSPORT_INTERFACE_TARGETS_DEG) {
    const interfaceInfo = resolveLatitudeInterface(Array.from(grid.latDeg || []), targetLatDeg);
    if (!interfaceInfo) continue;
    const modelLevelAccumulators = Array.from({ length: nz }, () => createFluxAccumulator());
    const bandAccumulators = Object.fromEntries(TRANSPORT_LEVEL_BANDS.map((band) => [band.key, createFluxAccumulator()]));
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
      const levelBand = TRANSPORT_LEVEL_BANDS.find((band) => sigmaMid >= band.minSigma && sigmaMid < band.maxSigma)
        || TRANSPORT_LEVEL_BANDS[TRANSPORT_LEVEL_BANDS.length - 1];
      for (let i = 0; i < nx; i += 1) {
        const northCell = interfaceInfo.rowNorth * nx + i;
        const southCell = interfaceInfo.rowSouth * nx + i;
        const northIdx = lev * N + northCell;
        const southIdx = lev * N + southCell;
        const velocityMs = 0.5 * ((v[northIdx] || 0) + (v[southIdx] || 0));
        const dpNorthPa = pHalf[(lev + 1) * N + northCell] - pHalf[lev * N + northCell];
        const dpSouthPa = pHalf[(lev + 1) * N + southCell] - pHalf[lev * N + southCell];
        const layerMassKgM2 = Math.max(0, 0.5 * (dpNorthPa + dpSouthPa) / g);
        const pressurePa = 0.5 * ((pMid[northIdx] || 0) + (pMid[southIdx] || 0));
        const vaporMixingRatioKgKg = 0.5 * ((qv[northIdx] || 0) + (qv[southIdx] || 0));
        const cloudMixingRatioKgKg = 0.5 * (
          (qc[northIdx] || 0) + (qi[northIdx] || 0) + (qr[northIdx] || 0) + (qs[northIdx] || 0)
          + (qc[southIdx] || 0) + (qi[southIdx] || 0) + (qr[southIdx] || 0) + (qs[southIdx] || 0)
        );
        const sourceMixingRatiosKgKg = Object.fromEntries(
          tracerFields.map(({ key, field }) => [
            key,
            field instanceof Float32Array && field.length === qv.length
              ? 0.5 * ((field[northIdx] || 0) + (field[southIdx] || 0))
              : 0
          ])
        );
        const sample = {
          velocityMs,
          layerMassKgM2,
          pressurePa,
          vaporMixingRatioKgKg,
          cloudMixingRatioKgKg,
          sourceMixingRatiosKgKg
        };
        accumulateFluxAccumulator(modelLevelAccumulators[lev], sample);
        accumulateFluxAccumulator(bandAccumulators[levelBand.key], sample);
      }
    }
    interfaceSummaries.push({
      targetLatDeg,
      latNorthDeg: interfaceInfo.latNorthDeg,
      latSouthDeg: interfaceInfo.latSouthDeg,
      latMidDeg: interfaceInfo.latMidDeg,
      rowNorthIndex: interfaceInfo.rowNorth,
      rowSouthIndex: interfaceInfo.rowSouth,
      modelLevels: modelLevelAccumulators.map((accumulator, lev) => ({
        levelIndex: lev,
        sigmaMid: sigmaMidAtLevel(sigmaHalf, lev, nz),
        ...finalizeFluxAccumulator(accumulator)
      })),
      levelBands: Object.fromEntries(
        TRANSPORT_LEVEL_BANDS.map((band) => [
          band.key,
          {
            label: band.label,
            minSigma: band.minSigma,
            maxSigma: band.maxSigma,
            ...finalizeFluxAccumulator(bandAccumulators[band.key])
          }
        ])
      )
    });
  }

  const bandLevelMatrix = TRANSPORT_LATITUDE_BANDS.map((latBand) => {
    const accumulators = Object.fromEntries(TRANSPORT_LEVEL_BANDS.map((levelBand) => [levelBand.key, createFluxAccumulator()]));
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
      const levelBand = TRANSPORT_LEVEL_BANDS.find((band) => sigmaMid >= band.minSigma && sigmaMid < band.maxSigma)
        || TRANSPORT_LEVEL_BANDS[TRANSPORT_LEVEL_BANDS.length - 1];
      for (let row = 0; row < ny; row += 1) {
        const latDeg = grid.latDeg[row];
        if (latDeg < latBand.lat0 || latDeg > latBand.lat1) continue;
        const rowWeight = Math.max(0.05, grid.cosLat?.[row] || 0);
        for (let i = 0; i < nx; i += 1) {
          const idx = lev * N + row * nx + i;
          const layerMassKgM2 = Math.max(0, (pHalf[(lev + 1) * N + row * nx + i] - pHalf[lev * N + row * nx + i]) / g);
          const sourceMixingRatiosKgKg = Object.fromEntries(
            tracerFields.map(({ key, field }) => [key, field instanceof Float32Array && field.length === qv.length ? field[idx] || 0 : 0])
          );
          accumulateFluxAccumulator(accumulators[levelBand.key], {
            sampleWeight: rowWeight,
            velocityMs: v[idx] || 0,
            layerMassKgM2,
            pressurePa: pMid[idx] || 0,
            vaporMixingRatioKgKg: qv[idx] || 0,
            cloudMixingRatioKgKg: (qc[idx] || 0) + (qi[idx] || 0) + (qr[idx] || 0) + (qs[idx] || 0),
            sourceMixingRatiosKgKg
          });
        }
      }
    }
    return {
      ...latBand,
      levelBands: Object.fromEntries(
        TRANSPORT_LEVEL_BANDS.map((levelBand) => [
          levelBand.key,
          {
            label: levelBand.label,
            minSigma: levelBand.minSigma,
            maxSigma: levelBand.maxSigma,
            ...finalizeFluxAccumulator(accumulators[levelBand.key])
          }
        ])
      )
    };
  });

  const zonalMeanMassFluxNorthKgM_1S = Array.from({ length: nz }, () => new Array(ny).fill(0));
  for (let lev = 0; lev < nz; lev += 1) {
    for (let row = 0; row < ny; row += 1) {
      let total = 0;
      for (let i = 0; i < nx; i += 1) {
        const idx = lev * N + row * nx + i;
        const layerMassKgM2 = Math.max(0, (pHalf[(lev + 1) * N + row * nx + i] - pHalf[lev * N + row * nx + i]) / g);
        total += (v[idx] || 0) * layerMassKgM2;
      }
      zonalMeanMassFluxNorthKgM_1S[lev][row] = total / Math.max(1, nx);
    }
  }
  const massStreamfunctionProxyKgS = Array.from({ length: nz }, () => new Array(ny).fill(0));
  for (let row = 0; row < ny; row += 1) {
    const streamfactor = 2 * Math.PI * Re * Math.max(0.05, grid.cosLat?.[row] || 0);
    let cumulativeMassFluxNorthKgM_1S = 0;
    for (let lev = 0; lev < nz; lev += 1) {
      cumulativeMassFluxNorthKgM_1S += zonalMeanMassFluxNorthKgM_1S[lev][row];
      massStreamfunctionProxyKgS[lev][row] = streamfactor * cumulativeMassFluxNorthKgM_1S;
    }
  }

  return {
    schema: 'satellite-wars.transport-tracing.v1',
    interfaceTargetsDeg: TRANSPORT_INTERFACE_TARGETS_DEG.slice(),
    levelBands: TRANSPORT_LEVEL_BANDS.map((band) => ({ ...band })),
    latitudeBands: TRANSPORT_LATITUDE_BANDS.map((band) => ({ ...band })),
    interfaces: interfaceSummaries,
    bandLevelMatrix,
    streamfunctionProxy: {
      latitudesDeg: Array.from(grid.latDeg || []),
      sigmaMid: Array.from({ length: nz }, (_, lev) => sigmaMidAtLevel(sigmaHalf, lev, nz)),
      zonalMeanMassFluxNorthKgM_1S,
      massStreamfunctionProxyKgS
    }
  };
};

const buildHistogramTemplate = (bins) => bins.map((bin) => ({
  key: bin.key,
  label: bin.label,
  sampleCount: 0,
  eventCount: 0,
  cloudBirthMassKgM2: 0
}));

const findHistogramBin = (bins, value) => bins.findIndex((bin) => value >= bin.min && value < bin.max);

const buildVerticalCloudBirthTracing = (state, grid) => {
  if (!state?.resolvedAscentCloudBirthAccumMass || !grid) return null;
  const { nx, ny, landMask } = grid;
  const latitudesDeg = Array.from(grid.latDeg || []);
  const longitudesDeg = Array.from(grid.lonDeg || []);
  const rowWeights = makeRowWeights(latitudesDeg);
  const cellCount = state.N;
  const stateLandMask = Array.from(state.landMask || new Uint8Array(cellCount));
  const channelFields = {
    resolvedAscentCloudBirth: arrayOrZeros(state.resolvedAscentCloudBirthAccumMass, cellCount),
    saturationAdjustmentCloudBirth: arrayOrZeros(state.saturationAdjustmentCloudBirthAccumMass, cellCount),
    convectiveDetrainmentCloudBirth: arrayOrZeros(state.convectiveDetrainmentCloudBirthAccumMass, cellCount),
    carryOverUpperCloudEntering: arrayOrZeros(state.carryOverUpperCloudEnteringAccumMass, cellCount),
    carryOverUpperCloudSurviving: arrayOrZeros(state.carryOverUpperCloudSurvivingAccumMass, cellCount)
  };
  const bandFields = {
    resolvedAscentCloudBirth: state.resolvedAscentCloudBirthByBandMass,
    saturationAdjustmentCloudBirth: state.saturationAdjustmentCloudBirthByBandMass,
    convectiveDetrainmentCloudBirth: state.convectiveDetrainmentCloudBirthByBandMass,
    carryOverUpperCloudEntering: state.carryOverUpperCloudEnteringByBandMass,
    carryOverUpperCloudSurviving: state.carryOverUpperCloudSurvivingByBandMass
  };
  const northDryBeltChannelMeansKgM2 = Object.fromEntries(
    VERTICAL_CLOUD_BIRTH_CHANNELS.map(({ key }) => [
      key,
      Number(
        weightedFieldBandMean(
          channelFields[key],
          nx,
          ny,
          latitudesDeg,
          rowWeights,
          15,
          35
        ).toFixed(5)
      )
    ])
  );
  const northDryBeltLandChannelMeansKgM2 = Object.fromEntries(
    VERTICAL_CLOUD_BIRTH_CHANNELS.map(({ key }) => [
      key,
      Number(
        weightedFieldBandMean(
          channelFields[key],
          nx,
          ny,
          latitudesDeg,
          rowWeights,
          15,
          35,
          stateLandMask,
          'land'
        ).toFixed(5)
      )
    ])
  );
  const northDryBeltOceanChannelMeansKgM2 = Object.fromEntries(
    VERTICAL_CLOUD_BIRTH_CHANNELS.map(({ key }) => [
      key,
      Number(
        weightedFieldBandMean(
          channelFields[key],
          nx,
          ny,
          latitudesDeg,
          rowWeights,
          15,
          35,
          stateLandMask,
          'ocean'
        ).toFixed(5)
      )
    ])
  );

  const northDryBeltLevelBandChannelMeansKgM2 = Object.fromEntries(
    CLOUD_BIRTH_LEVEL_BANDS.map((band, bandIndex) => {
      const channelMeans = Object.fromEntries(
        VERTICAL_CLOUD_BIRTH_CHANNELS.map(({ key }) => {
          const field = arrayOrZeros(bandFields[key]?.subarray?.(bandIndex * cellCount, (bandIndex + 1) * cellCount), cellCount);
          return [
            key,
            Number(
              weightedFieldBandMean(
                field,
                nx,
                ny,
                latitudesDeg,
                rowWeights,
                15,
                35
              ).toFixed(5)
            )
          ];
        })
      );
      return [band.key, { label: band.label, ...channelMeans }];
    })
  );

  const northDryBeltSectorChannelMeansKgM2 = Object.fromEntries(
    NH_DRY_BELT_SOURCE_SECTORS.map(({ key, label }) => [
      key,
      {
        label,
        ...Object.fromEntries(
          VERTICAL_CLOUD_BIRTH_CHANNELS.map(({ key: channelKey }) => [
            channelKey,
            Number(
              weightedFieldBandMeanWithFilter(
                channelFields[channelKey],
                nx,
                ny,
                latitudesDeg,
                longitudesDeg,
                rowWeights,
                15,
                35,
                ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: stateLandMask[idx] === 1 }) === key
              ).toFixed(5)
            )
          ])
        ),
        levelBands: Object.fromEntries(
          CLOUD_BIRTH_LEVEL_BANDS.map((band, bandIndex) => {
            const values = Object.fromEntries(
              VERTICAL_CLOUD_BIRTH_CHANNELS.map(({ key: channelKey }) => {
                const field = arrayOrZeros(bandFields[channelKey]?.subarray?.(bandIndex * cellCount, (bandIndex + 1) * cellCount), cellCount);
                return [
                  channelKey,
                  Number(
                    weightedFieldBandMeanWithFilter(
                      field,
                      nx,
                      ny,
                      latitudesDeg,
                      longitudesDeg,
                      rowWeights,
                      15,
                      35,
                      ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: stateLandMask[idx] === 1 }) === key
                    ).toFixed(5)
                  )
                ];
              })
            );
            return [band.key, { label: band.label, ...values }];
          })
        )
      }
    ])
  );

  const supersaturationBins = buildHistogramTemplate(CLOUD_BIRTH_SUPERSATURATION_BINS);
  const ascentBins = buildHistogramTemplate(CLOUD_BIRTH_ASCENT_BINS);
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < 15 || lat > 35) continue;
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      const eventCount = Number(state.saturationAdjustmentEventCount?.[idx]) || 0;
      const cloudBirthMass = Number(state.saturationAdjustmentCloudBirthAccumMass?.[idx]) || 0;
      if (eventCount <= 0 || cloudBirthMass <= 0) continue;
      const meanSupersaturation = (Number(state.saturationAdjustmentSupersaturationMassWeighted?.[idx]) || 0) / Math.max(EPS, cloudBirthMass);
      const meanAscentPaS = (Number(state.saturationAdjustmentOmegaMassWeighted?.[idx]) || 0) / Math.max(EPS, cloudBirthMass);
      const supersatIndex = findHistogramBin(CLOUD_BIRTH_SUPERSATURATION_BINS, meanSupersaturation);
      if (supersatIndex >= 0) {
        supersaturationBins[supersatIndex].sampleCount += 1;
        supersaturationBins[supersatIndex].eventCount += eventCount;
        supersaturationBins[supersatIndex].cloudBirthMassKgM2 += cloudBirthMass;
      }
      const ascentIndex = findHistogramBin(CLOUD_BIRTH_ASCENT_BINS, meanAscentPaS);
      if (ascentIndex >= 0) {
        ascentBins[ascentIndex].sampleCount += 1;
        ascentBins[ascentIndex].eventCount += eventCount;
        ascentBins[ascentIndex].cloudBirthMassKgM2 += cloudBirthMass;
      }
    }
  }
  const histograms = {
    supersaturation: supersaturationBins.map((bin) => ({
      ...bin,
      cloudBirthMassKgM2: Number(bin.cloudBirthMassKgM2.toFixed(5))
    })),
    ascentMagnitudePaS: ascentBins.map((bin) => ({
      ...bin,
      cloudBirthMassKgM2: Number(bin.cloudBirthMassKgM2.toFixed(5))
    }))
  };

  const carryOverSurvivalFrac = northDryBeltChannelMeansKgM2.carryOverUpperCloudEntering > EPS
    ? northDryBeltChannelMeansKgM2.carryOverUpperCloudSurviving / northDryBeltChannelMeansKgM2.carryOverUpperCloudEntering
    : 0;
  const rootCauseAssessment = { ruledIn: [], ruledOut: [], ambiguous: [] };
  if (northDryBeltChannelMeansKgM2.carryOverUpperCloudSurviving > northDryBeltChannelMeansKgM2.saturationAdjustmentCloudBirth * 1.25
    && northDryBeltChannelMeansKgM2.carryOverUpperCloudSurviving > northDryBeltChannelMeansKgM2.resolvedAscentCloudBirth * 1.5) {
    rootCauseAssessment.ruledIn.push('Persistent carried-over upper cloud outweighs local NH dry-belt cloud birth channels.');
  } else {
    rootCauseAssessment.ambiguous.push('Local cloud birth and carried-over cloud remain closer than expected.');
  }
  if (northDryBeltChannelMeansKgM2.convectiveDetrainmentCloudBirth < Math.max(EPS, northDryBeltChannelMeansKgM2.saturationAdjustmentCloudBirth * 0.1)) {
    rootCauseAssessment.ruledOut.push('Local convective detrainment is not the main NH dry-belt cloud-birth source.');
  }
  if (northDryBeltChannelMeansKgM2.saturationAdjustmentCloudBirth > northDryBeltChannelMeansKgM2.resolvedAscentCloudBirth * 1.25) {
    rootCauseAssessment.ruledIn.push('Saturation-adjustment cloud birth is the dominant local generation pathway once cloud is in-band.');
  } else {
    rootCauseAssessment.ambiguous.push('Resolved-ascent and saturation-adjustment local birth remain comparable.');
  }
  if (carryOverSurvivalFrac >= 0.75) {
    rootCauseAssessment.ruledIn.push('A large fraction of imported upper cloud survives each step, pointing to weak erosion/ventilation.');
  } else if (northDryBeltChannelMeansKgM2.carryOverUpperCloudEntering > EPS) {
    rootCauseAssessment.ruledOut.push('Imported upper cloud is not surviving efficiently enough to be the only driver.');
  }

  return {
    schema: 'satellite-wars.vertical-cloud-birth-tracing.v1',
    levelBands: CLOUD_BIRTH_LEVEL_BANDS.map((band) => ({ ...band })),
    channelDefinitions: VERTICAL_CLOUD_BIRTH_CHANNELS.map((channel) => ({ ...channel })),
    attribution: {
      northDryBeltChannelMeansKgM2,
      northDryBeltLandChannelMeansKgM2,
      northDryBeltOceanChannelMeansKgM2,
      northDryBeltLevelBandChannelMeansKgM2,
      northDryBeltSectorChannelMeansKgM2,
      northDryBeltCarryOverSurvivalFrac: Number(carryOverSurvivalFrac.toFixed(5))
    },
    histograms,
    originMatrix: {
      sectors: NH_DRY_BELT_SOURCE_SECTORS.map((sector) => ({ ...sector })),
      levelBands: CLOUD_BIRTH_LEVEL_BANDS.map((band) => ({ ...band })),
      channels: VERTICAL_CLOUD_BIRTH_CHANNELS.map((channel) => ({ ...channel })),
      matrixBySector: northDryBeltSectorChannelMeansKgM2
    },
    rootCauseAssessment
  };
};

const buildUpperCloudResidenceTracing = (state, grid, transportTracing = null) => {
  if (!state?.upperCloudResidenceTimeSeconds || !grid) return null;
  const { nx, ny } = grid;
  const latitudesDeg = Array.from(grid.latDeg || []);
  const rowWeights = makeRowWeights(latitudesDeg);
  const stateLandMask = Array.from(state.landMask || new Uint8Array(state.N));
  const upperCloudPath = arrayOrZeros(state.upperCloudPath, state.N);
  const residenceSeconds = arrayOrZeros(state.upperCloudResidenceTimeSeconds, state.N);
  const localBirthSeconds = arrayOrZeros(state.upperCloudTimeSinceLocalBirthSeconds, state.N);
  const importSeconds = arrayOrZeros(state.upperCloudTimeSinceImportSeconds, state.N);
  const freshBornMass = arrayOrZeros(state.upperCloudFreshBornMass, state.N);
  const recentlyImportedMass = arrayOrZeros(state.upperCloudRecentlyImportedMass, state.N);
  const staleMass = arrayOrZeros(state.upperCloudStaleMass, state.N);
  const passiveSurvivalMass = arrayOrZeros(state.upperCloudPassiveSurvivalMass, state.N);
  const regenerationMass = arrayOrZeros(state.upperCloudRegenerationMass, state.N);
  const oscillatoryMass = arrayOrZeros(state.upperCloudOscillatoryMass, state.N);
  const potentialErosionMass = arrayOrZeros(state.upperCloudPotentialErosionMass, state.N);
  const appliedErosionMass = arrayOrZeros(state.upperCloudAppliedErosionMass, state.N);
  const blockedErosionMass = arrayOrZeros(state.upperCloudBlockedErosionMass, state.N);
  const blockedByWeakSubsidenceMass = arrayOrZeros(state.upperCloudBlockedByWeakSubsidenceMass, state.N);
  const blockedByWeakDescentVentMass = arrayOrZeros(state.upperCloudBlockedByWeakDescentVentMass, state.N);
  const blockedByLocalSupportMass = arrayOrZeros(state.upperCloudBlockedByLocalSupportMass, state.N);
  const radiativeSupport = arrayOrZeros(state.upperCloudRadiativePersistenceSupportWm2, state.N);
  const shortwaveAbsorption = arrayOrZeros(state.upperCloudShortwaveAbsorptionWm2, state.N);
  const longwaveRelaxationBoost = arrayOrZeros(state.upperCloudLongwaveRelaxationBoost, state.N);

  const northUpperCloudPathMeanKgM2 = weightedFieldBandMean(upperCloudPath, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northFreshMeanKgM2 = weightedFieldBandMean(freshBornMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northRecentImportedMeanKgM2 = weightedFieldBandMean(recentlyImportedMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northStaleMeanKgM2 = weightedFieldBandMean(staleMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northPotentialErosionMeanKgM2 = weightedFieldBandMean(potentialErosionMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northAppliedErosionMeanKgM2 = weightedFieldBandMean(appliedErosionMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northBlockedErosionMeanKgM2 = weightedFieldBandMean(blockedErosionMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northPassiveMeanKgM2 = weightedFieldBandMean(passiveSurvivalMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northRegenerationMeanKgM2 = weightedFieldBandMean(regenerationMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northOscillatoryMeanKgM2 = weightedFieldBandMean(oscillatoryMass, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northResidenceMeanDays = weightedFieldBandMean(residenceSeconds, nx, ny, latitudesDeg, rowWeights, 15, 35) / 86400;
  const northTimeSinceLocalBirthMeanDays = weightedFieldBandMean(localBirthSeconds, nx, ny, latitudesDeg, rowWeights, 15, 35) / 86400;
  const northTimeSinceImportMeanDays = weightedFieldBandMean(importSeconds, nx, ny, latitudesDeg, rowWeights, 15, 35) / 86400;
  const northRadiativeSupportMeanWm2 = weightedFieldBandMean(radiativeSupport, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northUpperCloudSwAbsorptionMeanWm2 = weightedFieldBandMean(shortwaveAbsorption, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northUpperCloudLwBoostMean = weightedFieldBandMean(longwaveRelaxationBoost, nx, ny, latitudesDeg, rowWeights, 15, 35);

  const northClassifiedFrac = northUpperCloudPathMeanKgM2 > EPS
    ? (northFreshMeanKgM2 + northRecentImportedMeanKgM2 + northStaleMeanKgM2) / northUpperCloudPathMeanKgM2
    : 0;
  const northFreshFrac = northUpperCloudPathMeanKgM2 > EPS ? northFreshMeanKgM2 / northUpperCloudPathMeanKgM2 : 0;
  const northRecentImportedFrac = northUpperCloudPathMeanKgM2 > EPS ? northRecentImportedMeanKgM2 / northUpperCloudPathMeanKgM2 : 0;
  const northStaleFrac = northUpperCloudPathMeanKgM2 > EPS ? northStaleMeanKgM2 / northUpperCloudPathMeanKgM2 : 0;
  const northAppliedErosionFrac = northPotentialErosionMeanKgM2 > EPS ? northAppliedErosionMeanKgM2 / northPotentialErosionMeanKgM2 : 0;
  const northBlockedErosionFrac = northPotentialErosionMeanKgM2 > EPS ? northBlockedErosionMeanKgM2 / northPotentialErosionMeanKgM2 : 0;

  const regimeAccumTotal = weightedFieldBandMean(
    arrayOrZeros(state.upperCloudPassiveSurvivalAccumMass, state.N).map((value, index) => (
      value
      + (state.upperCloudRegenerationAccumMass?.[index] || 0)
      + (state.upperCloudOscillatoryAccumMass?.[index] || 0)
    )),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    15,
    35
  );
  const regimePersistence = {
    passiveSurvivalFrac: regimeAccumTotal > EPS
      ? Number((weightedFieldBandMean(arrayOrZeros(state.upperCloudPassiveSurvivalAccumMass, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35) / regimeAccumTotal).toFixed(5))
      : 0,
    regenerationFrac: regimeAccumTotal > EPS
      ? Number((weightedFieldBandMean(arrayOrZeros(state.upperCloudRegenerationAccumMass, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35) / regimeAccumTotal).toFixed(5))
      : 0,
    oscillatoryFrac: regimeAccumTotal > EPS
      ? Number((weightedFieldBandMean(arrayOrZeros(state.upperCloudOscillatoryAccumMass, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35) / regimeAccumTotal).toFixed(5))
      : 0
  };

  const erosionByLevelBand = Object.fromEntries(
    CLOUD_BIRTH_LEVEL_BANDS.map((band, bandIndex) => {
      const base = bandIndex * state.N;
      const potentialField = arrayOrZeros(state.upperCloudPotentialErosionByBandMass?.subarray?.(base, base + state.N), state.N);
      const appliedField = arrayOrZeros(state.upperCloudAppliedErosionByBandMass?.subarray?.(base, base + state.N), state.N);
      const blockedField = arrayOrZeros(state.upperCloudBlockedErosionByBandMass?.subarray?.(base, base + state.N), state.N);
      const potentialMean = weightedFieldBandMean(potentialField, nx, ny, latitudesDeg, rowWeights, 15, 35);
      const appliedMean = weightedFieldBandMean(appliedField, nx, ny, latitudesDeg, rowWeights, 15, 35);
      const blockedMean = weightedFieldBandMean(blockedField, nx, ny, latitudesDeg, rowWeights, 15, 35);
      return [band.key, {
        label: band.label,
        potentialErosionMeanKgM2: Number(potentialMean.toFixed(5)),
        appliedErosionMeanKgM2: Number(appliedMean.toFixed(5)),
        blockedErosionMeanKgM2: Number(blockedMean.toFixed(5)),
        appliedFrac: potentialMean > EPS ? Number((appliedMean / potentialMean).toFixed(5)) : 0,
        blockedFrac: potentialMean > EPS ? Number((blockedMean / potentialMean).toFixed(5)) : 0
      }];
    })
  );

  const dominantCloudImport = ((transportTracing?.interfaces || []).find((entry) => Number(entry?.targetLatDeg) === 35)?.levelBands?.upperTroposphere) || null;
  const upperCloudVentilation = {
    dominantImportInterfaceTargetLatDeg: 35,
    north35UpperTroposphereCloudFluxNorthKgM_1S: dominantCloudImport ? Number((dominantCloudImport.cloudFluxNorthKgM_1S || 0).toFixed(5)) : null,
    north35UpperTroposphereImportMagnitudeKgM_1S: dominantCloudImport
      ? Number(Math.max(0, -(dominantCloudImport.cloudFluxNorthKgM_1S || 0)).toFixed(5))
      : null,
    northDryBeltRadiativePersistenceSupportMeanWm2: Number(northRadiativeSupportMeanWm2.toFixed(5)),
    northDryBeltUpperCloudShortwaveAbsorptionMeanWm2: Number(northUpperCloudSwAbsorptionMeanWm2.toFixed(5)),
    northDryBeltUpperCloudLongwaveRelaxationBoostMean: Number(northUpperCloudLwBoostMean.toFixed(5)),
    northDryBeltAppliedErosionFrac: Number(northAppliedErosionFrac.toFixed(5)),
    northDryBeltBlockedErosionFrac: Number(northBlockedErosionFrac.toFixed(5))
  };

  const rootCauseAssessment = { ruledIn: [], ruledOut: [], ambiguous: [] };
  if (northStaleFrac >= 0.5 && northAppliedErosionFrac <= 0.2) {
    rootCauseAssessment.ruledIn.push('NH dry-belt upper cloud is dominated by older imported/stale cloud with weak effective erosion.');
  } else {
    rootCauseAssessment.ambiguous.push('NH dry-belt upper cloud is not yet dominated by a single stale-cloud regime.');
  }
  if (regimePersistence.passiveSurvivalFrac > regimePersistence.regenerationFrac * 1.25) {
    rootCauseAssessment.ruledIn.push('Passive survival is more important than repeated local regeneration.');
  } else if (regimePersistence.regenerationFrac > regimePersistence.passiveSurvivalFrac * 1.25) {
    rootCauseAssessment.ruledIn.push('Repeated regeneration remains competitive with passive survival.');
  } else {
    rootCauseAssessment.ambiguous.push('Passive survival and regeneration remain comparable.');
  }
  if (northBlockedErosionMeanKgM2 > northAppliedErosionMeanKgM2 * 1.25) {
    rootCauseAssessment.ruledIn.push('Blocked erosion outweighs applied erosion in the NH dry belt.');
  }
  if (northRadiativeSupportMeanWm2 <= 0.5) {
    rootCauseAssessment.ruledOut.push('Strong radiative maintenance is not obviously the main persistence mechanism in the NH dry belt.');
  } else {
    rootCauseAssessment.ambiguous.push('Radiative support may still be reinforcing persistence and should be checked against Phase 6.');
  }

  return {
    schema: 'satellite-wars.upper-cloud-residence-tracing.v1',
    ageAttribution: {
      northDryBeltResidenceMeanDays: Number(northResidenceMeanDays.toFixed(5)),
      northDryBeltTimeSinceLocalBirthMeanDays: Number(northTimeSinceLocalBirthMeanDays.toFixed(5)),
      northDryBeltTimeSinceImportMeanDays: Number(northTimeSinceImportMeanDays.toFixed(5)),
      northDryBeltUpperCloudPathMeanKgM2: Number(northUpperCloudPathMeanKgM2.toFixed(5)),
      northDryBeltFreshBornFrac: Number(northFreshFrac.toFixed(5)),
      northDryBeltRecentlyImportedFrac: Number(northRecentImportedFrac.toFixed(5)),
      northDryBeltStaleFrac: Number(northStaleFrac.toFixed(5)),
      northDryBeltClassifiedFrac: Number(northClassifiedFrac.toFixed(5)),
      northDryBeltLandResidenceMeanDays: Number((weightedFieldBandMean(residenceSeconds, nx, ny, latitudesDeg, rowWeights, 15, 35, stateLandMask, 'land') / 86400).toFixed(5)),
      northDryBeltOceanResidenceMeanDays: Number((weightedFieldBandMean(residenceSeconds, nx, ny, latitudesDeg, rowWeights, 15, 35, stateLandMask, 'ocean') / 86400).toFixed(5))
    },
    erosionBudget: {
      northDryBeltPotentialErosionMeanKgM2: Number(northPotentialErosionMeanKgM2.toFixed(5)),
      northDryBeltAppliedErosionMeanKgM2: Number(northAppliedErosionMeanKgM2.toFixed(5)),
      northDryBeltBlockedErosionMeanKgM2: Number(northBlockedErosionMeanKgM2.toFixed(5)),
      northDryBeltBlockedByWeakSubsidenceMeanKgM2: Number(weightedFieldBandMean(blockedByWeakSubsidenceMass, nx, ny, latitudesDeg, rowWeights, 15, 35).toFixed(5)),
      northDryBeltBlockedByWeakDescentVentMeanKgM2: Number(weightedFieldBandMean(blockedByWeakDescentVentMass, nx, ny, latitudesDeg, rowWeights, 15, 35).toFixed(5)),
      northDryBeltBlockedByLocalSupportMeanKgM2: Number(weightedFieldBandMean(blockedByLocalSupportMass, nx, ny, latitudesDeg, rowWeights, 15, 35).toFixed(5)),
      northDryBeltAppliedErosionFrac: Number(northAppliedErosionFrac.toFixed(5)),
      northDryBeltBlockedErosionFrac: Number(northBlockedErosionFrac.toFixed(5)),
      levelBands: erosionByLevelBand
    },
    ventilation: {
      ...upperCloudVentilation,
      regimePersistence
    },
    rootCauseAssessment
  };
};

const buildCloudTransitionLedgerTracing = (core, state, grid) => {
  const rawLedger = typeof core?.getCloudTransitionLedgerRaw === 'function'
    ? core.getCloudTransitionLedgerRaw()
    : null;
  if (!rawLedger || !state || !grid) return null;

  const { nx, ny } = grid;
  const latitudesDeg = Array.from(grid.latDeg || []);
  const longitudesDeg = Array.from(grid.lonDeg || []);
  const rowWeights = makeRowWeights(latitudesDeg);
  const stateLandMask = Array.from(state.landMask || new Uint8Array(state.N));
  const transitionKeys = (rawLedger.transitionDefinitions || []).map((entry) => entry.key);
  const dryBeltCells = [];
  let totalAbsNet = 0;
  let totalAbsAccounted = 0;
  let totalAbsResidual = 0;
  const persistentScoreByModule = {};

  const summarizeBandMeans = (field, bandIndex, predicate = null) => {
    const bandField = sliceCloudBirthBandField(field, bandIndex, state.N);
    if (!predicate) {
      return Number(weightedFieldBandMean(bandField, nx, ny, latitudesDeg, rowWeights, 15, 35).toFixed(5));
    }
    return Number(
      weightedFieldBandMeanWithFilter(
        bandField,
        nx,
        ny,
        latitudesDeg,
        longitudesDeg,
        rowWeights,
        15,
        35,
        predicate
      ).toFixed(5)
    );
  };

  const modules = Object.fromEntries(
    Object.entries(rawLedger.modules || {}).map(([moduleName, moduleSummary]) => {
      const bands = Object.fromEntries(
        CLOUD_BIRTH_LEVEL_BANDS.map((band, bandIndex) => {
          const transitions = Object.fromEntries(
            transitionKeys.map((transitionKey) => [
              transitionKey,
              summarizeBandMeans(moduleSummary.transitions?.[transitionKey], bandIndex)
            ])
          );
          const actualNetCloudDeltaMeanKgM2 = summarizeBandMeans(moduleSummary.netCloudDeltaByBandCell, bandIndex);
          const residualMeanKgM2 = transitions.unattributedResidual || 0;
          const grossAttributedMeanKgM2 = Object.entries(transitions)
            .reduce((sum, [transitionKey, value]) => sum + (transitionKey === 'unattributedResidual' ? 0 : Math.abs(value || 0)), 0);
          const attributedCoverageFrac = grossAttributedMeanKgM2 + Math.abs(residualMeanKgM2) > EPS
            ? Number((grossAttributedMeanKgM2 / Math.max(EPS, grossAttributedMeanKgM2 + Math.abs(residualMeanKgM2))).toFixed(5))
            : 1;
          const netCloudChangeClosureFrac = Math.abs(actualNetCloudDeltaMeanKgM2) > EPS
            ? Number((1 - (Math.abs(residualMeanKgM2) / Math.max(EPS, Math.abs(actualNetCloudDeltaMeanKgM2)))).toFixed(5))
            : 1;
          totalAbsNet += Math.abs(actualNetCloudDeltaMeanKgM2);
          totalAbsAccounted += grossAttributedMeanKgM2;
          totalAbsResidual += Math.abs(residualMeanKgM2);
          return [band.key, {
            label: band.label,
            minSigma: band.minSigma,
            maxSigma: band.maxSigma,
            actualNetCloudDeltaMeanKgM2,
            attributedCoverageFrac,
            netCloudChangeClosureFrac,
            transitions
          }];
        })
      );

      const upperBand = bands.upperTroposphere || null;
      const midBand = bands.midTroposphere || null;
      persistentScoreByModule[moduleName] = Number(((
        (upperBand?.transitions?.importedCloudSurvivingUnchanged || 0)
        + (upperBand?.transitions?.cloudConvertedIntoLocalCondensationSupport || 0)
        + (midBand?.transitions?.importedCloudSurvivingUnchanged || 0)
        + (midBand?.transitions?.cloudConvertedIntoLocalCondensationSupport || 0)
        + (upperBand?.transitions?.cloudKeptAliveByRadiativePersistence || 0)
        - (upperBand?.transitions?.cloudErodedAway || 0)
        - (upperBand?.transitions?.cloudLostToReevaporation || 0)
        - (midBand?.transitions?.cloudErodedAway || 0)
        - (midBand?.transitions?.cloudLostToReevaporation || 0)
      )).toFixed(5));

      return [moduleName, {
        module: moduleName,
        callCount: moduleSummary.callCount || 0,
        sampledModelSeconds: moduleSummary.sampledModelSeconds || 0,
        bands
      }];
    })
  );

  const sectoral = Object.fromEntries(
    Object.keys(modules).map((moduleName) => [
      moduleName,
      Object.fromEntries(
        NH_DRY_BELT_SOURCE_SECTORS.map(({ key, label }) => [
          key,
          {
            label,
            bands: Object.fromEntries(
              CLOUD_BIRTH_LEVEL_BANDS.map((band, bandIndex) => [
                band.key,
                {
                  label: band.label,
                  actualNetCloudDeltaMeanKgM2: summarizeBandMeans(
                    rawLedger.modules?.[moduleName]?.netCloudDeltaByBandCell,
                    bandIndex,
                    ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: stateLandMask[idx] === 1 }) === key
                  ),
                  transitions: Object.fromEntries(
                    transitionKeys.map((transitionKey) => [
                      transitionKey,
                      summarizeBandMeans(
                        rawLedger.modules?.[moduleName]?.transitions?.[transitionKey],
                        bandIndex,
                        ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: stateLandMask[idx] === 1 }) === key
                      )
                    ])
                  )
                }
              ])
            )
          }
        ])
      )
    ])
  );

  for (let row = 0; row < ny; row += 1) {
    const latDeg = latitudesDeg[row];
    if (latDeg < 15 || latDeg > 35) continue;
    for (let i = 0; i < nx; i += 1) {
      const idx = row * nx + i;
      const isLand = stateLandMask[idx] === 1;
      const sectorKey = classifyNhDryBeltSector({ lonDeg: longitudesDeg[i], isLand });
      const cellModules = {};
      for (const [moduleName, moduleSummary] of Object.entries(rawLedger.modules || {})) {
        const bandEntries = {};
        for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BANDS.length; bandIndex += 1) {
          const offset = cloudBirthBandOffset(bandIndex, idx, state.N);
          const netCloudDeltaKgM2 = Number((moduleSummary.netCloudDeltaByBandCell?.[offset] || 0).toFixed(5));
          const transitions = Object.fromEntries(
            transitionKeys.map((transitionKey) => [
              transitionKey,
              Number((moduleSummary.transitions?.[transitionKey]?.[offset] || 0).toFixed(5))
            ])
          );
          const hasSignal = Math.abs(netCloudDeltaKgM2) > 1e-5 || Object.values(transitions).some((value) => Math.abs(value) > 1e-5);
          if (!hasSignal) continue;
          bandEntries[CLOUD_BIRTH_LEVEL_BANDS[bandIndex].key] = {
            label: CLOUD_BIRTH_LEVEL_BANDS[bandIndex].label,
            netCloudDeltaKgM2,
            transitions
          };
        }
        if (Object.keys(bandEntries).length) {
          cellModules[moduleName] = bandEntries;
        }
      }
      if (Object.keys(cellModules).length) {
        dryBeltCells.push({
          cellIndex: idx,
          latDeg: Number(latDeg.toFixed(3)),
          lonDeg: Number(longitudesDeg[i].toFixed(3)),
          isLand,
          sectorKey,
          modules: cellModules
        });
      }
    }
  }

  const coverageFrac = totalAbsAccounted + totalAbsResidual > EPS
    ? Number((totalAbsAccounted / Math.max(EPS, totalAbsAccounted + totalAbsResidual)).toFixed(5))
    : 1;
  const netClosureCoverageFrac = totalAbsNet > EPS
    ? Number((1 - (totalAbsResidual / Math.max(EPS, totalAbsNet))).toFixed(5))
    : 1;
  const persistenceModuleOrder = ['stepVertical5', 'stepMicrophysics5', 'stepRadiation2D5'];
  const firstPersistentProblemModule = persistenceModuleOrder.find((moduleName) => (persistentScoreByModule[moduleName] || 0) > 0.01) || null;
  const dominantPersistentModule = Object.entries(persistentScoreByModule)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || null;
  const rootCauseAssessment = { ruledIn: [], ruledOut: [], ambiguous: [] };
  if (coverageFrac >= 0.95) {
    rootCauseAssessment.ruledIn.push('Phase B attributes at least 95% of NH dry-belt upper-cloud-path change to explicit module-local transitions.');
  } else {
    rootCauseAssessment.ambiguous.push('Phase B still leaves too much NH dry-belt upper-cloud-path change unattributed.');
  }
  if (firstPersistentProblemModule) {
    rootCauseAssessment.ruledIn.push(`The first module that turns imported cloud into persistent problem cloud is ${firstPersistentProblemModule}.`);
  } else {
    rootCauseAssessment.ambiguous.push('No single early module yet clears the persistence threshold on the current ledger.');
  }
  if ((persistentScoreByModule.stepVertical5 || 0) > Math.max(persistentScoreByModule.stepMicrophysics5 || 0, persistentScoreByModule.stepRadiation2D5 || 0) + 0.01) {
    rootCauseAssessment.ruledIn.push('Vertical-path carryover survival and local maintenance dominate over downstream reinforcement.');
  } else {
    rootCauseAssessment.ambiguous.push('Vertical and downstream maintenance still remain close enough that the first hard failure is not unique.');
  }

  return {
    schema: 'satellite-wars.cloud-transition-ledger-tracing.v1',
    bandDefinitions: CLOUD_BIRTH_LEVEL_BANDS.map((band) => ({ ...band })),
    transitionDefinitions: rawLedger.transitionDefinitions || [],
    modules,
    sectoral,
    cells: dryBeltCells,
    summary: {
      attributedUpperCloudPathChangeFrac: coverageFrac,
      netCloudChangeClosureFrac: netClosureCoverageFrac,
      totalAbsAttributedTransitionMeanKgM2: Number(totalAbsAccounted.toFixed(5)),
      totalAbsNetCloudDeltaMeanKgM2: Number(totalAbsNet.toFixed(5)),
      totalAbsResidualMeanKgM2: Number(totalAbsResidual.toFixed(5)),
      firstPersistentProblemModule,
      dominantPersistentModule,
      persistentScoreByModule: Object.fromEntries(
        Object.entries(persistentScoreByModule).map(([key, value]) => [key, Number((value || 0).toFixed(5))])
      )
    },
    rootCauseAssessment
  };
};

const buildThermodynamicSupportTracing = (state, grid, upperCloudResidenceTracing = null, derived = {}) => {
  if (!state || !grid) return null;
  const { nx, ny } = grid;
  const latitudesDeg = Array.from(grid.latDeg || []);
  const rowWeights = makeRowWeights(latitudesDeg);
  const stateLandMask = Array.from(state.landMask || new Uint8Array(state.N));

  const boundaryLayerRh = derived.boundaryLayerRhFrac || computeLayerMeanRelativeHumidity(state, 0.85, 1.0);
  const lowerTroposphereRh = derived.lowerTroposphericRhFrac || computeLayerMeanRelativeHumidity(state, 0.45, 0.85);
  const midTroposphereRh = derived.midTroposphericRhFrac || computeLayerMeanRelativeHumidity(state, 0.25, 0.55);
  const boundaryLayerTheta = derived.boundaryLayerPotentialTemperatureK || computeLayerMeanPotentialTemperature(state, 0.85, 1.0);
  const lowerTroposphereTheta = derived.lowerTropospherePotentialTemperatureK || computeLayerMeanPotentialTemperature(state, 0.65, 0.85);
  const boundaryLayerThetae = derived.boundaryLayerThetaeK || computeLayerMeanThetaeK(state, 0.85, 1.0);
  const lowerTroposphereThetae = derived.lowerTroposphereThetaeK || computeLayerMeanThetaeK(state, 0.65, 0.85);
  const boundaryLayerMse = derived.boundaryLayerMseJkg || computeLayerMeanMseJkg(state, 0.85, 1.0);
  const lowerTroposphereMse = derived.lowerTroposphereMseJkg || computeLayerMeanMseJkg(state, 0.65, 0.85);
  const inversionStrength = derived.lowerTroposphericInversionStrengthK
    || lowerTroposphereTheta.map((value, index) => Math.max(0, value - (boundaryLayerTheta[index] || 0)));
  const thetaeGradient = derived.thetaeGradientBoundaryMinusLowerK
    || boundaryLayerThetae.map((value, index) => (value || 0) - (lowerTroposphereThetae[index] || 0));
  const mseGradient = derived.mseGradientBoundaryMinusLowerJkg
    || boundaryLayerMse.map((value, index) => (value || 0) - (lowerTroposphereMse[index] || 0));

  const upperCloudClearSkyLwCooling = arrayOrZeros(state.upperCloudClearSkyLwCoolingWm2, state.N);
  const upperCloudCloudyLwCooling = arrayOrZeros(state.upperCloudCloudyLwCoolingWm2, state.N);
  const upperCloudLwCloudEffect = arrayOrZeros(state.upperCloudLwCloudEffectWm2, state.N);
  const upperCloudNetCloudRadiativeEffect = arrayOrZeros(state.upperCloudNetCloudRadiativeEffectWm2, state.N);
  const surfaceCloudShortwaveShielding = arrayOrZeros(state.surfaceCloudShortwaveShieldingWm2, state.N);
  const largeScaleCondensation = arrayOrZeros(state.largeScaleCondensationSource, state.N);
  const upperCloudPath = arrayOrZeros(state.upperCloudPath, state.N);

  const northBoundaryLayerRhMean = weightedFieldBandMean(boundaryLayerRh, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northLowerRhMean = weightedFieldBandMean(lowerTroposphereRh, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northMidRhMean = weightedFieldBandMean(midTroposphereRh, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northBoundaryThetaeMean = weightedFieldBandMean(boundaryLayerThetae, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northLowerThetaeMean = weightedFieldBandMean(lowerTroposphereThetae, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northBoundaryMseMean = weightedFieldBandMean(boundaryLayerMse, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northLowerMseMean = weightedFieldBandMean(lowerTroposphereMse, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northThetaeGradientMean = weightedFieldBandMean(thetaeGradient, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northMseGradientMean = weightedFieldBandMean(mseGradient, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northInversionStrengthMean = weightedFieldBandMean(inversionStrength, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northSurfaceCloudShieldingMean = weightedFieldBandMean(surfaceCloudShortwaveShielding, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northUpperClearSkyLwCoolingMean = weightedFieldBandMean(upperCloudClearSkyLwCooling, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northUpperCloudyLwCoolingMean = weightedFieldBandMean(upperCloudCloudyLwCooling, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northUpperLwCloudEffectMean = weightedFieldBandMean(upperCloudLwCloudEffect, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northUpperNetCloudRadiativeEffectMean = weightedFieldBandMean(upperCloudNetCloudRadiativeEffect, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northLargeScaleCondensationMean = weightedFieldBandMean(largeScaleCondensation, nx, ny, latitudesDeg, rowWeights, 15, 35);
  const northUpperCloudPathMean = weightedFieldBandMean(upperCloudPath, nx, ny, latitudesDeg, rowWeights, 15, 35);

  const staleFrac = Number(upperCloudResidenceTracing?.ageAttribution?.northDryBeltStaleFrac) || 0;
  const blockedErosionFrac = Number(upperCloudResidenceTracing?.erosionBudget?.northDryBeltBlockedErosionFrac) || 0;
  const importMagnitude = Number(upperCloudResidenceTracing?.ventilation?.north35UpperTroposphereImportMagnitudeKgM_1S) || 0;

  const moistureSupportScore = clamp01(
    0.25 * scaleToUnit(northBoundaryLayerRhMean, 0.35, 0.8) +
    0.2 * scaleToUnit(northLowerRhMean, 0.3, 0.75) +
    0.1 * scaleToUnit(northMidRhMean, 0.2, 0.6) +
    0.2 * scaleToUnit(northThetaeGradientMean, 0, 12) +
    0.1 * scaleToUnit(northMseGradientMean, 0, 25000) +
    0.15 * scaleToUnit(
      northLargeScaleCondensationMean / Math.max(EPS, northUpperCloudPathMean),
      0.1,
      0.9
    )
  );
  const radiationSupportScore = clamp01(
    0.35 * scaleToUnit(northUpperNetCloudRadiativeEffectMean, 0, 60) +
    0.25 * scaleToUnit(northSurfaceCloudShieldingMean, 10, 120) +
    0.2 * scaleToUnit(weightedFieldBandMean(arrayOrZeros(state.upperCloudShortwaveAbsorptionWm2, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5, 80) +
    0.2 * scaleToUnit(northUpperLwCloudEffectMean, 0, 20)
  );
  const dynamicsSupportScore = clamp01(
    0.45 * staleFrac +
    0.35 * blockedErosionFrac +
    0.2 * scaleToUnit(importMagnitude, 0.02, 0.2)
  );

  const regimeScores = [
    { key: 'moistureSupported', score: Number(moistureSupportScore.toFixed(5)) },
    { key: 'radiationSupported', score: Number(radiationSupportScore.toFixed(5)) },
    { key: 'dynamicsSupported', score: Number(dynamicsSupportScore.toFixed(5)) }
  ].sort((a, b) => b.score - a.score);
  const primaryRegime = regimeScores[0]?.score - (regimeScores[1]?.score || 0) <= 0.08 ? 'mixed' : regimeScores[0]?.key || 'mixed';
  const secondaryRegime = primaryRegime === 'mixed' ? regimeScores[0]?.key || null : regimeScores[1]?.key || null;
  const radiativeRole = radiationSupportScore >= Math.max(moistureSupportScore, dynamicsSupportScore) + 0.08
    ? 'primary'
    : radiationSupportScore >= 0.35
      ? 'secondary'
      : 'negligible';
  const thermodynamicRole = moistureSupportScore >= Math.max(radiationSupportScore, dynamicsSupportScore) + 0.08
    ? 'primary'
    : moistureSupportScore >= 0.35
      ? 'secondary'
      : 'negligible';
  const dynamicRole = dynamicsSupportScore >= Math.max(radiationSupportScore, moistureSupportScore) + 0.08
    ? 'primary'
    : dynamicsSupportScore >= 0.35
      ? 'secondary'
      : 'negligible';

  const rootCauseAssessment = { ruledIn: [], ruledOut: [], ambiguous: [] };
  if (dynamicRole === 'primary') {
    rootCauseAssessment.ruledIn.push('Transport/erosion dynamics remain the primary maintenance pathway for NH dry-belt upper cloud.');
  } else if (primaryRegime === 'mixed') {
    rootCauseAssessment.ambiguous.push('Thermodynamic and dynamical support remain mixed enough that neither is yet a clean primary driver.');
  }
  if (radiativeRole === 'primary') {
    rootCauseAssessment.ruledIn.push('Radiative support is strong enough to be a primary upper-cloud maintenance mechanism.');
  } else if (radiativeRole === 'secondary') {
    rootCauseAssessment.ruledIn.push('Radiative support looks secondary rather than primary for NH dry-belt cloud persistence.');
  } else {
    rootCauseAssessment.ruledOut.push('Radiative support does not look like the primary cause of NH dry-belt cloud persistence.');
  }
  if (thermodynamicRole === 'primary') {
    rootCauseAssessment.ruledIn.push('The NH dry belt is thermodynamically hospitable enough to be a primary cloud-maintenance environment.');
  } else if (thermodynamicRole === 'secondary') {
    rootCauseAssessment.ruledIn.push('Boundary-layer humidity and stability likely reinforce persistence as a secondary factor.');
  } else {
    rootCauseAssessment.ruledOut.push('Boundary-layer thermodynamic support does not look primary on the current quick audit.');
  }

  return {
    schema: 'satellite-wars.thermodynamic-support-tracing.v1',
    stability: {
      northDryBeltBoundaryLayerRhMeanFrac: Number(northBoundaryLayerRhMean.toFixed(5)),
      northDryBeltLowerTroposphereRhMeanFrac: Number(northLowerRhMean.toFixed(5)),
      northDryBeltMidTroposphereRhMeanFrac: Number(northMidRhMean.toFixed(5)),
      northDryBeltBoundaryLayerThetaeMeanK: Number(northBoundaryThetaeMean.toFixed(5)),
      northDryBeltLowerTroposphereThetaeMeanK: Number(northLowerThetaeMean.toFixed(5)),
      northDryBeltThetaeGradientBoundaryMinusLowerK: Number(northThetaeGradientMean.toFixed(5)),
      northDryBeltBoundaryLayerMseMeanJkg: Number(northBoundaryMseMean.toFixed(3)),
      northDryBeltLowerTroposphereMseMeanJkg: Number(northLowerMseMean.toFixed(3)),
      northDryBeltMseGradientBoundaryMinusLowerJkg: Number(northMseGradientMean.toFixed(3)),
      northDryBeltInversionStrengthMeanK: Number(northInversionStrengthMean.toFixed(5)),
      northDryBeltLandInversionStrengthMeanK: Number(weightedFieldBandMean(inversionStrength, nx, ny, latitudesDeg, rowWeights, 15, 35, stateLandMask, 'land').toFixed(5)),
      northDryBeltOceanInversionStrengthMeanK: Number(weightedFieldBandMean(inversionStrength, nx, ny, latitudesDeg, rowWeights, 15, 35, stateLandMask, 'ocean').toFixed(5))
    },
    radiation: {
      northDryBeltSurfaceCloudShieldingMeanWm2: Number(northSurfaceCloudShieldingMean.toFixed(5)),
      northDryBeltUpperCloudClearSkyLwCoolingMeanWm2: Number(northUpperClearSkyLwCoolingMean.toFixed(5)),
      northDryBeltUpperCloudCloudyLwCoolingMeanWm2: Number(northUpperCloudyLwCoolingMean.toFixed(5)),
      northDryBeltUpperCloudLwCloudEffectMeanWm2: Number(northUpperLwCloudEffectMean.toFixed(5)),
      northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: Number(northUpperNetCloudRadiativeEffectMean.toFixed(5)),
      northDryBeltUpperCloudRadiativePersistenceSupportMeanWm2: Number(weightedFieldBandMean(arrayOrZeros(state.upperCloudRadiativePersistenceSupportWm2, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35).toFixed(5))
    },
    classification: {
      moistureSupportScore: Number(moistureSupportScore.toFixed(5)),
      radiationSupportScore: Number(radiationSupportScore.toFixed(5)),
      dynamicsSupportScore: Number(dynamicsSupportScore.toFixed(5)),
      primaryRegime,
      secondaryRegime,
      radiativeRole,
      thermodynamicRole,
      dynamicRole
    },
    rootCauseAssessment
  };
};

const weightedAccumulationMean = (field, nx, ny, latitudesDeg, rowWeights, lat0, lat1, landMask = null, landMaskMode = 'all') => (
  weightedFieldBandMean(field, nx, ny, latitudesDeg, rowWeights, lat0, lat1, landMask, landMaskMode)
);

const weightedCountNormalizedMean = (field, countField, nx, ny, latitudesDeg, rowWeights, lat0, lat1, landMask = null, landMaskMode = 'all') => {
  const normalized = new Float32Array(field?.length || 0);
  if (field?.length && countField?.length === field.length) {
    for (let index = 0; index < field.length; index += 1) {
      const count = countField[index] || 0;
      normalized[index] = count > 0 ? (field[index] || 0) / count : 0;
    }
  }
  return weightedFieldBandMean(normalized, nx, ny, latitudesDeg, rowWeights, lat0, lat1, landMask, landMaskMode);
};

const buildForcingOppositionTracing = (state, grid) => {
  if (!state?.helperNativeDryingSupportMass || !grid) return null;
  const { nx, ny } = grid;
  const latitudesDeg = Array.from(grid.latDeg || []);
  const rowWeights = makeRowWeights(latitudesDeg);
  const landMask = Array.from(state.landMask || new Uint8Array(state.N));
  const northDryBelt = {
    nativeDryingSupportMeanKgM2: round(weightedAccumulationMean(state.helperNativeDryingSupportMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    nudgingMoisteningMeanKgM2: round(weightedAccumulationMean(state.nudgingMoisteningMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    nudgingOpposedDryingMeanKgM2: round(weightedAccumulationMean(state.nudgingOpposedDryingMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    analysisMoisteningMeanKgM2: round(weightedAccumulationMean(state.analysisMoisteningMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    analysisOpposedDryingMeanKgM2: round(weightedAccumulationMean(state.analysisOpposedDryingMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    windOpposedDryingCorrectionMean: round(weightedAccumulationMean(state.windOpposedDryingCorrection, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    nudgingTargetQvMismatchMeanKgKg: round(weightedCountNormalizedMean(state.nudgingTargetQvMismatchAccum, state.nudgingTargetQvSampleCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 6),
    nudgingTargetThetaMismatchMeanK: round(weightedCountNormalizedMean(state.nudgingTargetThetaMismatchAccum, state.nudgingTargetThetaSampleCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    nudgingTargetWindMismatchMeanMs: round(weightedCountNormalizedMean(state.nudgingTargetWindMismatchAccum, state.nudgingTargetWindSampleCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    analysisTargetQvMismatchMeanKgKg: round(weightedCountNormalizedMean(state.analysisTargetQvMismatchAccum, state.analysisTargetQvSampleCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 6),
    analysisTargetThetaMismatchMeanK: round(weightedCountNormalizedMean(state.analysisTargetThetaMismatchAccum, state.analysisTargetThetaSampleCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    analysisTargetWindMismatchMeanMs: round(weightedCountNormalizedMean(state.analysisTargetWindMismatchAccum, state.analysisTargetWindSampleCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    windTargetMismatchMeanMs: round(weightedCountNormalizedMean(state.windTargetMismatchAccum, state.windTargetSampleCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5)
  };
  const northDryBeltLandOcean = {
    land: {
      nativeDryingSupportMeanKgM2: round(weightedAccumulationMean(state.helperNativeDryingSupportMass, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'land'), 5),
      nudgingMoisteningMeanKgM2: round(weightedAccumulationMean(state.nudgingMoisteningMass, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'land'), 5),
      analysisMoisteningMeanKgM2: round(weightedAccumulationMean(state.analysisMoisteningMass, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'land'), 5),
      windOpposedDryingCorrectionMean: round(weightedAccumulationMean(state.windOpposedDryingCorrection, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'land'), 5)
    },
    ocean: {
      nativeDryingSupportMeanKgM2: round(weightedAccumulationMean(state.helperNativeDryingSupportMass, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'ocean'), 5),
      nudgingMoisteningMeanKgM2: round(weightedAccumulationMean(state.nudgingMoisteningMass, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'ocean'), 5),
      analysisMoisteningMeanKgM2: round(weightedAccumulationMean(state.analysisMoisteningMass, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'ocean'), 5),
      windOpposedDryingCorrectionMean: round(weightedAccumulationMean(state.windOpposedDryingCorrection, nx, ny, latitudesDeg, rowWeights, 15, 35, landMask, 'ocean'), 5)
    }
  };
  const levelBands = Object.fromEntries(
    INSTRUMENTATION_LEVEL_BANDS.map((band, bandIndex) => [
      band.key,
      {
        label: band.label,
        nativeDryingSupportMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.helperNativeDryingSupportByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
        nudgingMoisteningMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.nudgingMoisteningByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
        nudgingOpposedDryingMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.nudgingOpposedDryingByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
        analysisMoisteningMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.analysisMoisteningByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
        analysisOpposedDryingMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.analysisOpposedDryingByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
        windOpposedDryingCorrectionMean: round(weightedAccumulationMean(sliceBandField(state.windOpposedDryingByBandCorrection, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
        nudgingQvTargetMismatchAccumMean: round(weightedAccumulationMean(sliceBandField(state.nudgingQvTargetMismatchByBand, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 6),
        analysisQvTargetMismatchAccumMean: round(weightedAccumulationMean(sliceBandField(state.analysisQvTargetMismatchByBand, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 6),
        windTargetMismatchAccumMean: round(weightedAccumulationMean(sliceBandField(state.windTargetMismatchByBand, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5)
      }
    ])
  );
  const helperMoistening = (northDryBelt.nudgingMoisteningMeanKgM2 || 0) + (northDryBelt.analysisMoisteningMeanKgM2 || 0);
  const opposedDrying = (northDryBelt.nudgingOpposedDryingMeanKgM2 || 0) + (northDryBelt.analysisOpposedDryingMeanKgM2 || 0);
  const nativeDrying = northDryBelt.nativeDryingSupportMeanKgM2 || 0;
  const ruledIn = [];
  const ruledOut = [];
  const ambiguous = [];
  if (nativeDrying > 0 && helperMoistening / nativeDrying < 0.08 && opposedDrying / nativeDrying < 0.08) {
    ruledOut.push('Helper moisture terms are too small to be the primary NH dry-belt driver.');
  } else if (nativeDrying > 0 && (helperMoistening / nativeDrying > 0.25 || opposedDrying / nativeDrying > 0.25)) {
    ruledIn.push('Helper forcing materially opposes native dry-belt clearing support.');
  } else {
    ambiguous.push('Helper forcing remains secondary-sized but not fully exonerated.');
  }
  if ((northDryBeltLandOcean.ocean.nudgingMoisteningMeanKgM2 || 0) > (northDryBeltLandOcean.land.nudgingMoisteningMeanKgM2 || 0) * 1.5) {
    ruledIn.push('Ocean-side nudging moistening outweighs land-side nudging within the NH dry belt.');
  }
  return {
    schema: 'satellite-wars.forcing-opposition-tracing.v1',
    northDryBelt,
    northDryBeltLandOcean,
    levelBands,
    rootCauseAssessment: { ruledIn, ruledOut, ambiguous }
  };
};

const buildNumericalIntegrityTracing = (state, grid) => {
  if (!state?.numericalBacktraceClampCount || !grid) return null;
  const { nx, ny } = grid;
  const latitudesDeg = Array.from(grid.latDeg || []);
  const rowWeights = makeRowWeights(latitudesDeg);
  const north = {
    backtraceClampCountMean: round(weightedAccumulationMean(state.numericalBacktraceClampCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    backtraceClampExcessCellsMean: round(weightedAccumulationMean(state.numericalBacktraceClampExcessCells, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    negativeClipCountMean: round(weightedAccumulationMean(state.numericalNegativeClipCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    negativeClipMassMeanKgM2: round(weightedAccumulationMean(state.numericalNegativeClipMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 7),
    supersaturationClampCountMean: round(weightedAccumulationMean(state.numericalSupersaturationClampCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    supersaturationClampMassMeanKgM2: round(weightedAccumulationMean(state.numericalSupersaturationClampMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 7),
    cloudLimiterCountMean: round(weightedAccumulationMean(state.numericalCloudLimiterCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    cloudLimiterMassMeanKgM2: round(weightedAccumulationMean(state.numericalCloudLimiterMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 7),
    verticalCflClampCountMean: round(weightedAccumulationMean(state.numericalVerticalCflClampCount, nx, ny, latitudesDeg, rowWeights, 15, 35), 5),
    verticalCflClampMassMeanKgM2: round(weightedAccumulationMean(state.numericalVerticalCflClampMass, nx, ny, latitudesDeg, rowWeights, 15, 35), 7)
  };
  const south = {
    backtraceClampCountMean: round(weightedAccumulationMean(state.numericalBacktraceClampCount, nx, ny, latitudesDeg, rowWeights, -35, -15), 5),
    backtraceClampExcessCellsMean: round(weightedAccumulationMean(state.numericalBacktraceClampExcessCells, nx, ny, latitudesDeg, rowWeights, -35, -15), 5),
    negativeClipCountMean: round(weightedAccumulationMean(state.numericalNegativeClipCount, nx, ny, latitudesDeg, rowWeights, -35, -15), 5),
    negativeClipMassMeanKgM2: round(weightedAccumulationMean(state.numericalNegativeClipMass, nx, ny, latitudesDeg, rowWeights, -35, -15), 7),
    supersaturationClampCountMean: round(weightedAccumulationMean(state.numericalSupersaturationClampCount, nx, ny, latitudesDeg, rowWeights, -35, -15), 5),
    supersaturationClampMassMeanKgM2: round(weightedAccumulationMean(state.numericalSupersaturationClampMass, nx, ny, latitudesDeg, rowWeights, -35, -15), 7),
    cloudLimiterCountMean: round(weightedAccumulationMean(state.numericalCloudLimiterCount, nx, ny, latitudesDeg, rowWeights, -35, -15), 5),
    cloudLimiterMassMeanKgM2: round(weightedAccumulationMean(state.numericalCloudLimiterMass, nx, ny, latitudesDeg, rowWeights, -35, -15), 7),
    verticalCflClampCountMean: round(weightedAccumulationMean(state.numericalVerticalCflClampCount, nx, ny, latitudesDeg, rowWeights, -35, -15), 5),
    verticalCflClampMassMeanKgM2: round(weightedAccumulationMean(state.numericalVerticalCflClampMass, nx, ny, latitudesDeg, rowWeights, -35, -15), 7)
  };
  const levelBands = Object.fromEntries(
    INSTRUMENTATION_LEVEL_BANDS.map((band, bandIndex) => [
      band.key,
      {
        label: band.label,
        northNegativeClipMassMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.numericalNegativeClipByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 7),
        northSupersaturationClampMassMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.numericalSupersaturationClampByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 7),
        northCloudLimiterMassMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.numericalCloudLimiterByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 7),
        northVerticalCflClampMassMeanKgM2: round(weightedAccumulationMean(sliceBandField(state.numericalVerticalCflClampByBandMass, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 7),
        northBacktraceClampCountMean: round(weightedAccumulationMean(sliceBandField(state.numericalBacktraceClampByBandCount, bandIndex, state.N), nx, ny, latitudesDeg, rowWeights, 15, 35), 5)
      }
    ])
  );
  const asymmetry = {
    negativeClipMassNorthToSouthRatio: round((north.negativeClipMassMeanKgM2 || 0) / Math.max(EPS, south.negativeClipMassMeanKgM2 || 0), 5),
    supersaturationClampMassNorthToSouthRatio: round((north.supersaturationClampMassMeanKgM2 || 0) / Math.max(EPS, south.supersaturationClampMassMeanKgM2 || 0), 5),
    cloudLimiterMassNorthToSouthRatio: round((north.cloudLimiterMassMeanKgM2 || 0) / Math.max(EPS, south.cloudLimiterMassMeanKgM2 || 0), 5),
    verticalCflClampMassNorthToSouthRatio: round((north.verticalCflClampMassMeanKgM2 || 0) / Math.max(EPS, south.verticalCflClampMassMeanKgM2 || 0), 5)
  };
  const ruledIn = [];
  const ruledOut = [];
  const ambiguous = [];
  const numericalMassTotal = (north.negativeClipMassMeanKgM2 || 0)
    + (north.supersaturationClampMassMeanKgM2 || 0)
    + (north.cloudLimiterMassMeanKgM2 || 0)
    + (north.verticalCflClampMassMeanKgM2 || 0);
  if (numericalMassTotal < 0.02) {
    ruledOut.push('Numerical clipping and clamp mass are too small to be the primary NH dry-belt driver.');
  } else {
    ambiguous.push('Numerical limiter mass is non-zero and still worth checking against dt/grid sensitivity.');
  }
  if ((asymmetry.cloudLimiterMassNorthToSouthRatio || 0) > 2 || (asymmetry.verticalCflClampMassNorthToSouthRatio || 0) > 2) {
    ruledIn.push('A north-heavy numerical asymmetry remains present and must be falsified with sensitivity runs.');
  }
  return {
    schema: 'satellite-wars.numerical-integrity-tracing.v1',
    advectionWaterRepairMassMeanKgM2: round(state.numericalAdvectionWaterRepairMassMeanKgM2 || 0, 7),
    northDryBelt: north,
    southDryBelt: south,
    levelBands,
    asymmetry,
    rootCauseAssessment: { ruledIn, ruledOut, ambiguous }
  };
};

const buildStormSpilloverTracing = ({
  state,
  grid,
  landMask,
  precipRateMmHr,
  cloudTotalFraction,
  cloudLowFraction,
  cloudHighFraction,
  upperCloudPathKgM2,
  convectiveAnvilSourceFrac,
  convectiveOrganizationFrac,
  convectiveMassFluxKgM2S,
  carriedOverUpperCloudMassKgM2,
  importedAnvilPersistenceMassKgM2,
  weakErosionCloudSurvivalMassKgM2,
  largeScaleCondensationSourceKgM2,
  subtropicalSubsidenceDryingFrac,
  surfaceCloudShortwaveShieldingWm2,
  lowLevelMoistureConvergenceS_1,
  lowerTroposphericRhFrac,
  cycloneSupportFields
} = {}) => {
  if (!state || !grid || !cycloneSupportFields) return null;

  const { nx, ny } = grid;
  const latitudesDeg = Array.from(grid.latDeg || []);
  const longitudesDeg = Array.from(grid.lonDeg || []);
  const rowWeights = makeRowWeights(latitudesDeg);
  const stateLandMask = Array.from(landMask || state.landMask || new Uint8Array(state.N));
  const slp = Array.from(cycloneSupportFields.seaLevelPressurePa || new Float32Array(state.N));
  const vort = Array.from(cycloneSupportFields.relativeVorticityS_1 || new Float32Array(state.N));
  const wind10m = Array.from(cycloneSupportFields.wind10mSpeedMs || new Float32Array(state.N));
  const omegaLower = Array.from(cycloneSupportFields.omegaLowerPaS || new Float32Array(state.N));
  const omegaUpper = Array.from(cycloneSupportFields.omegaUpperPaS || new Float32Array(state.N));
  const zonalSlp = new Array(ny).fill(0);

  for (let row = 0; row < ny; row += 1) {
    let sum = 0;
    for (let i = 0; i < nx; i += 1) sum += slp[row * nx + i] || 0;
    zonalSlp[row] = sum / Math.max(1, nx);
  }

  const makeRegimeAccumulator = () => ({
    cellCount: 0,
    precipContributionWeighted: 0,
    cloudContributionWeighted: 0,
    combinedContributionWeighted: 0,
    synopticScoreWeighted: 0,
    tropicalScoreWeighted: 0,
    marineScoreWeighted: 0,
    backgroundScoreWeighted: 0,
    meanPrecipRateMmHrWeighted: 0,
    meanUpperCloudPathKgM2Weighted: 0,
    meanAbsVorticityS_1Weighted: 0,
    meanSlpAnomalyPaWeighted: 0,
    meanOmegaUpperPaSWeighted: 0,
    meanCloudHighFracWeighted: 0,
    meanCloudLowFracWeighted: 0
  });

  const makeRegimeSummaryMap = () => Object.fromEntries(
    STORM_SPILLOVER_REGIMES.map(({ key, label }) => [key, { label, ...makeRegimeAccumulator() }])
  );

  const overallRegimes = makeRegimeSummaryMap();
  const sectorRegimes = Object.fromEntries(
    NH_DRY_BELT_SOURCE_SECTORS.map(({ key, label }) => [key, { label, regimes: makeRegimeSummaryMap() }])
  );
  const sectorEvents = Object.fromEntries(
    NH_DRY_BELT_SOURCE_SECTORS.map(({ key, label }) => [key, { label, eventCount: 0, topEvents: [] }])
  );
  const topEvents = [];
  let totalPrecipWeighted = 0;
  let totalCloudWeighted = 0;
  let totalCombinedWeighted = 0;

  const pushTopEvent = (collection, event, limit = 8) => {
    collection.push(event);
    collection.sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0));
    if (collection.length > limit) collection.length = limit;
  };

  const accumulateRegime = (accumulator, regimeKey, {
    precipWeighted,
    cloudWeighted,
    combinedWeighted,
    synopticScore,
    tropicalScore,
    marineScore,
    backgroundScore,
    precip,
    upperCloud,
    absVorticity,
    slpAnomaly,
    omegaUpperPaS,
    cloudHighFracValue,
    cloudLowFracValue
  }) => {
    const regime = accumulator[regimeKey];
    if (!regime) return;
    regime.cellCount += 1;
    regime.precipContributionWeighted += precipWeighted;
    regime.cloudContributionWeighted += cloudWeighted;
    regime.combinedContributionWeighted += combinedWeighted;
    regime.synopticScoreWeighted += synopticScore * combinedWeighted;
    regime.tropicalScoreWeighted += tropicalScore * combinedWeighted;
    regime.marineScoreWeighted += marineScore * combinedWeighted;
    regime.backgroundScoreWeighted += backgroundScore * combinedWeighted;
    regime.meanPrecipRateMmHrWeighted += precip * combinedWeighted;
    regime.meanUpperCloudPathKgM2Weighted += upperCloud * combinedWeighted;
    regime.meanAbsVorticityS_1Weighted += absVorticity * combinedWeighted;
    regime.meanSlpAnomalyPaWeighted += slpAnomaly * combinedWeighted;
    regime.meanOmegaUpperPaSWeighted += omegaUpperPaS * combinedWeighted;
    regime.meanCloudHighFracWeighted += cloudHighFracValue * combinedWeighted;
    regime.meanCloudLowFracWeighted += cloudLowFracValue * combinedWeighted;
  };

  for (let row = 0; row < ny; row += 1) {
    const latDeg = latitudesDeg[row];
    if (latDeg < 15 || latDeg > 35) continue;
    const rowWeight = rowWeights[row];
    for (let i = 0; i < nx; i += 1) {
      const idx = row * nx + i;
      const precip = Math.max(0, precipRateMmHr?.[idx] || 0);
      const upperCloud = Math.max(0, upperCloudPathKgM2?.[idx] || 0);
      if (precip <= EPS && upperCloud <= EPS) continue;
      const isLand = stateLandMask[idx] === 1;
      const sectorKey = classifyNhDryBeltSector({ lonDeg: longitudesDeg[i], isLand });
      const cloudHigh = Math.max(0, cloudHighFraction?.[idx] || 0);
      const cloudLow = Math.max(0, cloudLowFraction?.[idx] || 0);
      const cloudTotal = Math.max(0, cloudTotalFraction?.[idx] || 0);
      const convAnvil = Math.max(0, convectiveAnvilSourceFrac?.[idx] || 0);
      const convOrg = Math.max(0, convectiveOrganizationFrac?.[idx] || 0);
      const convMassFlux = Math.max(0, convectiveMassFluxKgM2S?.[idx] || 0);
      const importedUpperCloud = Math.max(0,
        (importedAnvilPersistenceMassKgM2?.[idx] || 0)
        + (carriedOverUpperCloudMassKgM2?.[idx] || 0)
        + (weakErosionCloudSurvivalMassKgM2?.[idx] || 0)
      );
      const largeScaleCondensation = Math.max(0, largeScaleCondensationSourceKgM2?.[idx] || 0);
      const subsidenceDrying = Math.max(0, subtropicalSubsidenceDryingFrac?.[idx] || 0);
      const surfaceShielding = Math.max(0, surfaceCloudShortwaveShieldingWm2?.[idx] || 0);
      const lowerRh = Math.max(0, lowerTroposphericRhFrac?.[idx] || 0);
      const moistureConvergence = Math.max(0, lowLevelMoistureConvergenceS_1?.[idx] || 0);
      const absVorticity = Math.abs(vort[idx] || 0);
      const slpAnomaly = Math.max(0, (zonalSlp[row] || 0) - (slp[idx] || 0));
      const ascentSignal = Math.max(0, -(0.65 * (omegaUpper[idx] || 0) + 0.35 * (omegaLower[idx] || 0)));
      const latEdgeFactor = scaleToUnit(22 - latDeg, 0, 10);
      const oceanFactor = isLand ? 0 : 1;

      const synopticScore = clamp01(
        0.24 * scaleToUnit(absVorticity, 1e-5, 7e-5)
        + 0.22 * scaleToUnit(slpAnomaly, 100, 1800)
        + 0.16 * scaleToUnit(ascentSignal, 0.01, 0.18)
        + 0.14 * scaleToUnit(wind10m[idx] || 0, 6, 22)
        + 0.12 * scaleToUnit(precip, 0.1, 2.0)
        + 0.12 * scaleToUnit(cloudHigh, 0.15, 0.85)
      );
      const tropicalScore = clamp01(
        0.24 * scaleToUnit(convAnvil, 0.05, 0.4)
        + 0.18 * scaleToUnit(convOrg, 0.12, 0.55)
        + 0.14 * scaleToUnit(convMassFlux, 0.0005, 0.0055)
        + 0.16 * latEdgeFactor
        + 0.12 * scaleToUnit(moistureConvergence, 0, 3e-5)
        + 0.16 * scaleToUnit(importedUpperCloud, 0.05, 0.6)
      );
      const marineScore = clamp01(
        0.26 * oceanFactor
        + 0.22 * scaleToUnit(cloudLow, 0.2, 0.9)
        + 0.16 * scaleToUnit(surfaceShielding, 20, 180)
        + 0.12 * (1 - scaleToUnit(upperCloud, 0.1, 0.45))
        + 0.12 * (1 - scaleToUnit(precip, 0.05, 0.8))
        + 0.12 * (1 - synopticScore)
      );
      const backgroundScore = clamp01(
        0.28 * scaleToUnit(importedUpperCloud, 0.08, 0.8)
        + 0.24 * scaleToUnit(largeScaleCondensation, 0.03, 0.2)
        + 0.14 * scaleToUnit(cloudHigh, 0.15, 0.85)
        + 0.12 * scaleToUnit(lowerRh, 0.35, 0.75)
        + 0.12 * (1 - synopticScore)
        + 0.1 * (1 - tropicalScore)
      );

      let regimeKey = 'persistent_zonal_background';
      if (synopticScore >= Math.max(tropicalScore, marineScore, backgroundScore) && (precip >= 0.1 || cloudHigh >= 0.2)) {
        regimeKey = 'synoptic_storm_leakage';
      } else if (
        tropicalScore >= Math.max(synopticScore, marineScore, backgroundScore)
        && latDeg <= 24
        && (convAnvil >= 0.08 || convOrg >= 0.15 || convMassFlux >= 0.0008)
      ) {
        regimeKey = 'tropical_spillover';
      } else if (
        marineScore >= Math.max(synopticScore, tropicalScore, backgroundScore)
        && !isLand
        && cloudLow >= 0.2
      ) {
        regimeKey = 'subtropical_marine_deck_drizzle';
      }

      const precipWeighted = precip * rowWeight;
      const cloudWeighted = upperCloud * rowWeight;
      const combinedWeighted = precipWeighted + cloudWeighted;
      totalPrecipWeighted += precipWeighted;
      totalCloudWeighted += cloudWeighted;
      totalCombinedWeighted += combinedWeighted;
      accumulateRegime(overallRegimes, regimeKey, {
        precipWeighted,
        cloudWeighted,
        combinedWeighted,
        synopticScore,
        tropicalScore,
        marineScore,
        backgroundScore,
        precip,
        upperCloud,
        absVorticity,
        slpAnomaly,
        omegaUpperPaS: omegaUpper[idx] || 0,
        cloudHighFracValue: cloudHigh,
        cloudLowFracValue: cloudLow
      });
      accumulateRegime(sectorRegimes[sectorKey].regimes, regimeKey, {
        precipWeighted,
        cloudWeighted,
        combinedWeighted,
        synopticScore,
        tropicalScore,
        marineScore,
        backgroundScore,
        precip,
        upperCloud,
        absVorticity,
        slpAnomaly,
        omegaUpperPaS: omegaUpper[idx] || 0,
        cloudHighFracValue: cloudHigh,
        cloudLowFracValue: cloudLow
      });

      const severityScore = Number((
        (regimeKey === 'synoptic_storm_leakage' ? synopticScore : 0.5 * Math.max(synopticScore, tropicalScore, backgroundScore, marineScore))
        * (Math.max(precip, 0.25 * upperCloud) + 0.25 * scaleToUnit(absVorticity, 1e-5, 7e-5))
      ).toFixed(5));
      if (precip >= 0.15 || (regimeKey === 'synoptic_storm_leakage' && upperCloud >= 0.2)) {
        const event = {
          regimeKey,
          sectorKey,
          latDeg: Number(latDeg.toFixed(3)),
          lonDeg: Number(longitudesDeg[i].toFixed(3)),
          isLand,
          precipRateMmHr: Number(precip.toFixed(5)),
          upperCloudPathKgM2: Number(upperCloud.toFixed(5)),
          relativeVorticityS_1: Number((vort[idx] || 0).toFixed(8)),
          slpAnomalyPa: Number(slpAnomaly.toFixed(3)),
          omegaUpperPaS: Number((omegaUpper[idx] || 0).toFixed(5)),
          omegaLowerPaS: Number((omegaLower[idx] || 0).toFixed(5)),
          cloudHighFrac: Number(cloudHigh.toFixed(5)),
          cloudLowFrac: Number(cloudLow.toFixed(5)),
          convectiveAnvilFrac: Number(convAnvil.toFixed(5)),
          convectiveOrganizationFrac: Number(convOrg.toFixed(5)),
          largeScaleCondensationKgM2: Number(largeScaleCondensation.toFixed(5)),
          importedUpperCloudProxyKgM2: Number(importedUpperCloud.toFixed(5)),
          severityScore
        };
        sectorEvents[sectorKey].eventCount += 1;
        pushTopEvent(sectorEvents[sectorKey].topEvents, event, 6);
        pushTopEvent(topEvents, event, 20);
      }
    }
  }

  const computeRegimeTotals = (regimeMap) => Object.values(regimeMap).reduce((totals, regime) => ({
    precip: totals.precip + (regime.precipContributionWeighted || 0),
    cloud: totals.cloud + (regime.cloudContributionWeighted || 0),
    combined: totals.combined + (regime.combinedContributionWeighted || 0)
  }), { precip: 0, cloud: 0, combined: 0 });

  const finalizeRegimeMap = (regimeMap, totals = computeRegimeTotals(regimeMap)) => Object.fromEntries(
    Object.entries(regimeMap).map(([key, value]) => {
      const denom = Math.max(EPS, value.combinedContributionWeighted);
      return [
        key,
        {
          label: value.label,
          cellCount: value.cellCount,
          precipContributionWeighted: Number(value.precipContributionWeighted.toFixed(5)),
          cloudContributionWeighted: Number(value.cloudContributionWeighted.toFixed(5)),
          combinedContributionWeighted: Number(value.combinedContributionWeighted.toFixed(5)),
          precipContributionFrac: Number((value.precipContributionWeighted / Math.max(EPS, totals.precip)).toFixed(5)),
          cloudContributionFrac: Number((value.cloudContributionWeighted / Math.max(EPS, totals.cloud)).toFixed(5)),
          combinedContributionFrac: Number((value.combinedContributionWeighted / Math.max(EPS, totals.combined)).toFixed(5)),
          meanSynopticScore: Number((value.synopticScoreWeighted / denom).toFixed(5)),
          meanTropicalScore: Number((value.tropicalScoreWeighted / denom).toFixed(5)),
          meanMarineScore: Number((value.marineScoreWeighted / denom).toFixed(5)),
          meanBackgroundScore: Number((value.backgroundScoreWeighted / denom).toFixed(5)),
          meanPrecipRateMmHr: Number((value.meanPrecipRateMmHrWeighted / denom).toFixed(5)),
          meanUpperCloudPathKgM2: Number((value.meanUpperCloudPathKgM2Weighted / denom).toFixed(5)),
          meanAbsVorticityS_1: Number((value.meanAbsVorticityS_1Weighted / denom).toFixed(8)),
          meanSlpAnomalyPa: Number((value.meanSlpAnomalyPaWeighted / denom).toFixed(5)),
          meanOmegaUpperPaS: Number((value.meanOmegaUpperPaSWeighted / denom).toFixed(5)),
          meanCloudHighFrac: Number((value.meanCloudHighFracWeighted / denom).toFixed(5)),
          meanCloudLowFrac: Number((value.meanCloudLowFracWeighted / denom).toFixed(5))
        }
      ];
    })
  );

  const overallSummary = finalizeRegimeMap(overallRegimes, {
    precip: totalPrecipWeighted,
    cloud: totalCloudWeighted,
    combined: totalCombinedWeighted
  });
  const sectoralSummary = Object.fromEntries(
    Object.entries(sectorRegimes).map(([sectorKey, sectorValue]) => {
      const finalizedRegimes = finalizeRegimeMap(sectorValue.regimes);
      const dominantCombined = Object.entries(finalizedRegimes).sort(
        (a, b) => (Number(b[1].combinedContributionFrac) || 0) - (Number(a[1].combinedContributionFrac) || 0)
      )[0]?.[0] || null;
      return [
        sectorKey,
        {
          label: sectorValue.label,
          dominantCombinedRegime: dominantCombined,
          regimes: finalizedRegimes
        }
      ];
    })
  );

  const interfaceLeakage = STORM_SPILLOVER_INTERFACE_TARGETS_DEG.map((targetLatDeg) => {
    const interfaceInfo = resolveLatitudeInterface(latitudesDeg, targetLatDeg);
    if (!interfaceInfo) return null;
    const sectorReferenceRow = findClosestLatitudeRow(latitudesDeg, clamp(targetLatDeg, 18, 28));
    const sectorBandAccumulators = Object.fromEntries(
      NH_DRY_BELT_SOURCE_SECTORS.map(({ key }) => [
        key,
        Object.fromEntries(STORM_SPILLOVER_LEVEL_BANDS.map((band) => [band.key, createFluxAccumulator()]))
      ])
    );
    for (let lev = 0; lev < state.nz; lev += 1) {
      const sigmaMid = sigmaMidAtLevel(state.sigmaHalf, lev, state.nz);
      const levelBand = STORM_SPILLOVER_LEVEL_BANDS.find((band) => sigmaMid >= band.minSigma && sigmaMid < band.maxSigma)
        || STORM_SPILLOVER_LEVEL_BANDS[STORM_SPILLOVER_LEVEL_BANDS.length - 1];
      for (let i = 0; i < nx; i += 1) {
        const northCell = interfaceInfo.rowNorth * nx + i;
        const southCell = interfaceInfo.rowSouth * nx + i;
        const northIdx = lev * state.N + northCell;
        const southIdx = lev * state.N + southCell;
        const layerMassKgM2 = Math.max(
          0,
          0.5 * (
            (state.pHalf[(lev + 1) * state.N + northCell] - state.pHalf[lev * state.N + northCell])
            + (state.pHalf[(lev + 1) * state.N + southCell] - state.pHalf[lev * state.N + southCell])
          ) / g
        );
        const sourceMixingRatiosKgKg = Object.fromEntries(
          SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key, field }) => [
            key,
            state[field] instanceof Float32Array && state[field].length === state.qv.length
              ? 0.5 * ((state[field][northIdx] || 0) + (state[field][southIdx] || 0))
              : 0
          ])
        );
        const sectorKey = classifyNhDryBeltSector({
          lonDeg: longitudesDeg[i],
          isLand: stateLandMask[sectorReferenceRow * nx + i] === 1
        });
        accumulateFluxAccumulator(sectorBandAccumulators[sectorKey][levelBand.key], {
          velocityMs: 0.5 * ((state.v[northIdx] || 0) + (state.v[southIdx] || 0)),
          layerMassKgM2,
          pressurePa: 0.5 * ((state.pMid[northIdx] || 0) + (state.pMid[southIdx] || 0)),
          vaporMixingRatioKgKg: 0.5 * ((state.qv[northIdx] || 0) + (state.qv[southIdx] || 0)),
          cloudMixingRatioKgKg: 0.5 * (
            (state.qc[northIdx] || 0) + (state.qi[northIdx] || 0) + (state.qr[northIdx] || 0) + (state.qs[northIdx] || 0)
            + (state.qc[southIdx] || 0) + (state.qi[southIdx] || 0) + (state.qr[southIdx] || 0) + (state.qs[southIdx] || 0)
          ),
          sourceMixingRatiosKgKg
        });
      }
    }
    return {
      targetLatDeg,
      latMidDeg: Number(interfaceInfo.latMidDeg.toFixed(3)),
      sectors: Object.fromEntries(
        NH_DRY_BELT_SOURCE_SECTORS.map(({ key, label }) => [
          key,
          {
            label,
            levelBands: Object.fromEntries(
              STORM_SPILLOVER_LEVEL_BANDS.map((band) => [
                band.key,
                {
                  label: band.label,
                  minSigma: band.minSigma,
                  maxSigma: band.maxSigma,
                  ...finalizeFluxAccumulator(sectorBandAccumulators[key][band.key])
                }
              ])
            )
          }
        ])
      )
    };
  }).filter(Boolean);

  const dominantEddyFlux = (fieldKey) => {
    const candidates = [];
    for (const interfaceSummary of interfaceLeakage) {
      for (const { key: sectorKey, label: sectorLabel } of NH_DRY_BELT_SOURCE_SECTORS) {
        for (const band of STORM_SPILLOVER_LEVEL_BANDS) {
          const summary = interfaceSummary.sectors?.[sectorKey]?.levelBands?.[band.key];
          const value = Number(summary?.[fieldKey]) || 0;
          if (value <= 0) continue;
          candidates.push({
            targetLatDeg: interfaceSummary.targetLatDeg,
            sectorKey,
            sectorLabel,
            levelBandKey: band.key,
            levelBandLabel: band.label,
            [fieldKey]: Number(value.toFixed(5))
          });
        }
      }
    }
    candidates.sort((a, b) => (b[fieldKey] || 0) - (a[fieldKey] || 0));
    return candidates[0] || null;
  };

  const dominantPrecipRegime = Object.entries(overallSummary)
    .sort((a, b) => (Number(b[1].precipContributionFrac) || 0) - (Number(a[1].precipContributionFrac) || 0))[0]?.[0] || null;
  const dominantCloudRegime = Object.entries(overallSummary)
    .sort((a, b) => (Number(b[1].cloudContributionFrac) || 0) - (Number(a[1].cloudContributionFrac) || 0))[0]?.[0] || null;
  const dominantCombinedRegime = Object.entries(overallSummary)
    .sort((a, b) => (Number(b[1].combinedContributionFrac) || 0) - (Number(a[1].combinedContributionFrac) || 0))[0]?.[0] || null;
  const assignedPrecipFrac = totalPrecipWeighted > EPS ? 1 : 0;
  const assignedCloudFrac = totalCloudWeighted > EPS ? 1 : 0;
  const assignedCombinedFrac = totalCombinedWeighted > EPS ? 1 : 0;

  const rootCauseAssessment = { ruledIn: [], ruledOut: [], ambiguous: [] };
  const synopticCombinedFrac = overallSummary.synoptic_storm_leakage?.combinedContributionFrac || 0;
  const backgroundCombinedFrac = overallSummary.persistent_zonal_background?.combinedContributionFrac || 0;
  const dominantCloudLeakage = dominantEddyFlux('cloudFluxEddyComponentKgM_1S');
  if (
    synopticCombinedFrac >= 0.35
    && dominantCloudLeakage?.targetLatDeg === 35
    && dominantCloudLeakage?.levelBandKey === 'upperTroposphere'
  ) {
    rootCauseAssessment.ruledIn.push('Sectoral synoptic storm leakage appears to be a primary NH dry-belt cloud/precip source.');
  } else if (backgroundCombinedFrac >= 0.45 && synopticCombinedFrac < 0.25) {
    rootCauseAssessment.ruledOut.push('Sectoral storm leakage does not look like the primary NH dry-belt regime; persistent background cloud dominates.');
  } else {
    rootCauseAssessment.ambiguous.push('Sectoral synoptic leakage contributes meaningfully but is not yet isolated as the dominant dry-belt regime.');
  }
  if ((overallSummary.tropical_spillover?.combinedContributionFrac || 0) >= 0.25) {
    rootCauseAssessment.ruledIn.push('Tropical spillover remains a secondary contributor at the equatorward edge of the NH dry belt.');
  }
  if ((overallSummary.subtropical_marine_deck_drizzle?.combinedContributionFrac || 0) >= 0.25) {
    rootCauseAssessment.ruledIn.push('Subtropical marine-deck / drizzle conditions remain a meaningful ocean-side contributor.');
  }

  return {
    schema: 'satellite-wars.storm-spillover-tracing.v1',
    regimeDefinitions: STORM_SPILLOVER_REGIMES.map((entry) => ({ ...entry })),
    interfaceTargetsDeg: STORM_SPILLOVER_INTERFACE_TARGETS_DEG.slice(),
    levelBands: STORM_SPILLOVER_LEVEL_BANDS.map((entry) => ({ ...entry })),
    overall: {
      assignedPrecipContributionFrac: Number(assignedPrecipFrac.toFixed(5)),
      assignedCloudContributionFrac: Number(assignedCloudFrac.toFixed(5)),
      assignedCombinedContributionFrac: Number(assignedCombinedFrac.toFixed(5)),
      dominantPrecipRegime,
      dominantCloudRegime,
      dominantCombinedRegime,
      regimes: overallSummary
    },
    sectoralRegimes: sectoralSummary,
    eventCatalog: {
      precipThresholdMmHr: 0.15,
      topEvents,
      sectors: sectorEvents
    },
    transientEddyLeakage: {
      interfaces: interfaceLeakage,
      dominantVaporEddyImport: dominantEddyFlux('vaporFluxEddyComponentKgM_1S'),
      dominantCloudEddyImport: dominantCloudLeakage
    },
    rootCauseAssessment
  };
};

export function buildValidationDiagnostics(core, { pressureLevelsPa = DEFAULT_PRESSURE_LEVELS_PA } = {}) {
  const grid = core?.grid;
  const state = core?.state;
  const fields = core?.fields;
  if (!grid || !state || !fields) {
    throw new Error('Validation diagnostics require a ready weather core.');
  }

  const wind10mU = Array.from(fields.u || []);
  const wind10mV = Array.from(fields.v || []);
  const wind10mSpeedMs = wind10mU.map((u, index) => Math.hypot(u, wind10mV[index] || 0));
  const seaLevelPressurePa = computeSeaLevelPressurePa(core);
  const lowLevelSourceTracers = Object.fromEntries(
    SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key, field }) => [key, computeLayerFieldPathKgM2(state, state[field], 0.65, 1.0)])
  );
  const lowLevelVaporPath = computeLayerFieldPathKgM2(state, state.qv, 0.65, 1.0);
  const boundaryLayerRhFrac = computeLayerMeanRelativeHumidity(state, 0.85, 1.0);
  const lowerTroposphericRhFrac = computeLayerMeanRelativeHumidity(state, 0.45, 0.85);
  const midTroposphericRhFrac = computeLayerMeanRelativeHumidity(state, 0.25, 0.55);
  const lowerTroposphericOmegaPaS = computeLayerMeanOmegaPaS(state, 0.45, 0.85);
  const midTroposphericOmegaPaS = computeLayerMeanOmegaPaS(state, 0.25, 0.55);
  const upperTroposphericOmegaPaS = computeLayerMeanOmegaPaS(state, 0.0, 0.25);
  const boundaryLayerPotentialTemperatureK = computeLayerMeanPotentialTemperature(state, 0.85, 1.0);
  const lowerTropospherePotentialTemperatureK = computeLayerMeanPotentialTemperature(state, 0.65, 0.85);
  const boundaryLayerThetaeK = computeLayerMeanThetaeK(state, 0.85, 1.0);
  const lowerTroposphereThetaeK = computeLayerMeanThetaeK(state, 0.65, 0.85);
  const boundaryLayerMseJkg = computeLayerMeanMseJkg(state, 0.85, 1.0);
  const lowerTroposphereMseJkg = computeLayerMeanMseJkg(state, 0.65, 0.85);
  const lowerTroposphericInversionStrengthK = lowerTropospherePotentialTemperatureK.map((value, index) => (
    Math.max(0, value - (boundaryLayerPotentialTemperatureK[index] || 0))
  ));
  const thetaeGradientBoundaryMinusLowerK = boundaryLayerThetaeK.map((value, index) => (
    (value || 0) - (lowerTroposphereThetaeK[index] || 0)
  ));
  const mseGradientBoundaryMinusLowerJkg = boundaryLayerMseJkg.map((value, index) => (
    (value || 0) - (lowerTroposphereMseJkg[index] || 0)
  ));
  const transportTracing = buildTransportTracing(state, grid);
  const verticalCloudBirthTracing = buildVerticalCloudBirthTracing(state, grid);
  const upperCloudResidenceTracing = buildUpperCloudResidenceTracing(state, grid, transportTracing);
  const cloudTransitionLedgerTracing = buildCloudTransitionLedgerTracing(core, state, grid);
  const thermodynamicSupportTracing = buildThermodynamicSupportTracing(state, grid, upperCloudResidenceTracing, {
    boundaryLayerRhFrac,
    lowerTroposphericRhFrac,
    midTroposphericRhFrac,
    boundaryLayerPotentialTemperatureK,
    lowerTropospherePotentialTemperatureK,
    boundaryLayerThetaeK,
    lowerTroposphereThetaeK,
    boundaryLayerMseJkg,
    lowerTroposphereMseJkg,
    lowerTroposphericInversionStrengthK,
    thetaeGradientBoundaryMinusLowerK,
    mseGradientBoundaryMinusLowerJkg
  });
  const forcingOppositionTracing = buildForcingOppositionTracing(state, grid);
  const numericalIntegrityTracing = buildNumericalIntegrityTracing(state, grid);
  const cycloneSupportFields = {
    relativeVorticityS_1: Array.from(fields.vort || []),
    omegaLowerPaS: Array.from(fields.omegaL || []),
    omegaUpperPaS: Array.from(fields.omegaU || []),
    wind10mSpeedMs,
    seaLevelPressurePa
  };
  const stormSpilloverTracing = buildStormSpilloverTracing({
    state,
    grid,
    landMask: state.landMask,
    precipRateMmHr: Array.from(fields.precipRate || state.precipRate || []),
    cloudTotalFraction: Array.from(fields.cloud || []),
    cloudLowFraction: Array.from(fields.cloudLow || []),
    cloudHighFraction: Array.from(fields.cloudHigh || []),
    upperCloudPathKgM2: computeLayerCondensatePathKgM2(state, 0, 0.55),
    convectiveAnvilSourceFrac: arrayOrZeros(state.convectiveAnvilSource, state.N),
    convectiveOrganizationFrac: arrayOrZeros(state.convectiveOrganization, state.N),
    convectiveMassFluxKgM2S: arrayOrZeros(state.convectiveMassFlux, state.N),
    carriedOverUpperCloudMassKgM2: arrayOrZeros(state.carriedOverUpperCloudMass, state.N),
    importedAnvilPersistenceMassKgM2: arrayOrZeros(state.importedAnvilPersistenceMass, state.N),
    weakErosionCloudSurvivalMassKgM2: arrayOrZeros(state.weakErosionCloudSurvivalMass, state.N),
    largeScaleCondensationSourceKgM2: arrayOrZeros(state.largeScaleCondensationSource, state.N),
    subtropicalSubsidenceDryingFrac: arrayOrZeros(state.subtropicalSubsidenceDrying, state.N),
    surfaceCloudShortwaveShieldingWm2: arrayOrZeros(state.surfaceCloudShortwaveShieldingWm2, state.N),
    lowLevelMoistureConvergenceS_1: arrayOrZeros(state.lowLevelMoistureConvergence, state.N),
    lowerTroposphericRhFrac,
    cycloneSupportFields
  });
  const lowLevelSourceResidual = lowLevelVaporPath.map((value, index) => {
    let attributed = 0;
    for (const tracer of Object.values(lowLevelSourceTracers)) attributed += tracer[index] || 0;
    return Math.max(0, value - attributed);
  });

  return {
    schema: 'satellite-wars.weather-validation.snapshot.v2',
    simTimeSeconds: core.timeUTC,
    grid: {
      nx: grid.nx,
      ny: grid.ny,
      latitudesDeg: Array.from(grid.latDeg || []),
      longitudesDeg: Array.from(grid.lonDeg || [])
    },
    landMask: Array.from(state.landMask || []),
    pressureLevelsPa: pressureLevelsPa.slice(),
    seaLevelPressurePa,
    surfacePressurePa: Array.from(state.ps || []),
    wind10mU,
    wind10mV,
    wind10mSpeedMs,
    geopotentialHeightMByPressurePa: Object.fromEntries(
      Object.entries(computeGeopotentialHeightByPressure(state, pressureLevelsPa)).map(([pressurePa, values]) => [pressurePa, Array.from(values)])
    ),
    totalColumnWaterKgM2: computeTotalColumnWaterKgM2(state),
    precipRateMmHr: Array.from(fields.precipRate || state.precipRate || []),
    precipRainRateMmHr: Array.from(state.precipRainRate || []),
    precipSnowRateMmHr: Array.from(state.precipSnowRate || []),
    precipAccumMm: Array.from(state.precipAccum || []),
    surfaceEvapRateMmHr: Array.from(state.surfaceEvapRate || []),
    surfaceEvapPotentialRateMmHr: Array.from(state.surfaceEvapPotentialRate || []),
    surfaceEvapTransferCoeff: Array.from(state.surfaceEvapTransferCoeff || []),
    surfaceEvapWindSpeedMs: Array.from(state.surfaceEvapWindSpeed || []),
    surfaceEvapHumidityGradientKgKg: Array.from(state.surfaceEvapHumidityGradient || []),
    surfaceEvapSurfaceTempK: Array.from(state.surfaceEvapSurfaceTemp || []),
    surfaceEvapAirTempK: Array.from(state.surfaceEvapAirTemp || []),
    surfaceEvapSoilGateFrac: Array.from(state.surfaceEvapSoilGate || []),
    surfaceEvapRunoffLossRateMmHr: Array.from(state.surfaceEvapRunoffLossRate || []),
    surfaceEvapSeaIceSuppressionFrac: Array.from(state.surfaceEvapSeaIceSuppression || []),
    surfaceEvapSurfaceSaturationMixingRatioKgKg: Array.from(state.surfaceEvapSurfaceSaturationMixingRatio || []),
    surfaceEvapAirMixingRatioKgKg: Array.from(state.surfaceEvapAirMixingRatio || []),
    surfaceLatentFluxWm2: Array.from(state.surfaceLatentFlux || []),
    surfaceSensibleFluxWm2: Array.from(state.surfaceSensibleFlux || []),
    cloudWaterPathKgM2: computeColumnIntegralKgM2(state, (idx) => (state.qc?.[idx] || 0) + (state.qr?.[idx] || 0)),
    snowWaterPathKgM2: computeColumnIntegralKgM2(state, (idx) => (state.qi?.[idx] || 0) + (state.qs?.[idx] || 0)),
    upperCloudPathKgM2: computeLayerCondensatePathKgM2(state, 0, 0.55),
    verticallyIntegratedVaporFluxNorthKgM_1S: computeVerticallyIntegratedFlux(state, state.v, (idx) => state.qv[idx] || 0),
    verticallyIntegratedTotalWaterFluxNorthKgM_1S: computeVerticallyIntegratedFlux(
      state,
      state.v,
      (idx) => (state.qv[idx] || 0) + (state.qc?.[idx] || 0) + (state.qi?.[idx] || 0) + (state.qr?.[idx] || 0) + (state.qs?.[idx] || 0)
    ),
    sstK: Array.from(state.sstNow || []),
    seaIceFraction: Array.from(state.seaIceFrac || []),
    seaIceThicknessM: Array.from(state.seaIceThicknessM || []),
    opticalDepthProxyLow: Array.from(fields.tauLow || []),
    opticalDepthProxyHigh: Array.from(fields.tauHigh || []),
    opticalDepthProxyTotal: Array.from(fields.tauTotal || []),
    cloudLowFraction: Array.from(fields.cloudLow || []),
    cloudHighFraction: Array.from(fields.cloudHigh || []),
    cloudTotalFraction: Array.from(fields.cloud || []),
    boundaryLayerRhFrac,
    lowerTroposphericRhFrac,
    midTroposphericRhFrac,
    lowerTroposphericOmegaPaS,
    midTroposphericOmegaPaS,
    upperTroposphericOmegaPaS,
    boundaryLayerPotentialTemperatureK,
    lowerTropospherePotentialTemperatureK,
    boundaryLayerThetaeK,
    lowerTroposphereThetaeK,
    boundaryLayerMseJkg,
    lowerTroposphereMseJkg,
    lowerTroposphericInversionStrengthK,
    thetaeGradientBoundaryMinusLowerK,
    mseGradientBoundaryMinusLowerJkg,
    convectiveMaskFrac: arrayOrZeros(state.convMask, state.N),
    convectivePotentialFrac: arrayOrZeros(state.convectivePotential, state.N),
    convectiveOrganizationFrac: arrayOrZeros(state.convectiveOrganization, state.N),
    convectiveMassFluxKgM2S: arrayOrZeros(state.convectiveMassFlux, state.N),
    convectiveDetrainmentMassKgM2: arrayOrZeros(state.convectiveDetrainmentMass, state.N),
    convectiveRainoutFraction: arrayOrZeros(state.convectiveRainoutFraction, state.N),
    convectiveAnvilSourceFrac: arrayOrZeros(state.convectiveAnvilSource, state.N),
    convectiveHeatingProxyKgM2S: arrayOrZeros(state.convectiveHeatingProxy, state.N),
    convectiveTopLevelIndex: arrayOrZeros(state.convectiveTopLevel, state.N),
    northsideLeakCarrierSignalMean: Number.isFinite(state.northsideLeakCarrierSignalMean)
      ? state.northsideLeakCarrierSignalMean
      : 0,
    lowLevelMoistureConvergenceS_1: arrayOrZeros(state.lowLevelMoistureConvergence, state.N),
    lowLevelOmegaEffectivePaS: arrayOrZeros(state.lowLevelOmegaEffective, state.N),
    subtropicalSubsidenceDryingFrac: arrayOrZeros(state.subtropicalSubsidenceDrying, state.N),
    freshPotentialTargetDiagFrac: arrayOrZeros(state.freshPotentialTargetDiag, state.N),
    freshOrganizedSupportDiagFrac: arrayOrZeros(state.freshOrganizedSupportDiag, state.N),
    freshSubtropicalSuppressionDiagFrac: arrayOrZeros(state.freshSubtropicalSuppressionDiag, state.N),
    freshSubtropicalBandDiagFrac: arrayOrZeros(state.freshSubtropicalBandDiag, state.N),
    freshShoulderLatitudeWindowDiagFrac: arrayOrZeros(state.freshShoulderLatitudeWindowDiag, state.N),
    freshShoulderEquatorialEdgeWindowDiagFrac: arrayOrZeros(state.freshShoulderEquatorialEdgeWindowDiag, state.N),
    freshShoulderInnerWindowDiagFrac: arrayOrZeros(state.freshShoulderInnerWindowDiag, state.N),
    freshShoulderEquatorialEdgeGateSupportDiagFrac: arrayOrZeros(state.freshShoulderEquatorialEdgeGateSupportDiag, state.N),
    freshShoulderTargetEntryExclusionDiagFrac: arrayOrZeros(state.freshShoulderTargetEntryExclusionDiag, state.N),
    freshNeutralToSubsidingSupportDiagFrac: arrayOrZeros(state.freshNeutralToSubsidingSupportDiag, state.N),
    freshRhMidSupportDiagFrac: arrayOrZeros(state.freshRhMidSupportDiag, state.N),
    circulationReboundContainmentDiagFrac: arrayOrZeros(state.circulationReboundContainmentDiag, state.N),
    circulationReboundActivitySuppressionDiagFrac: arrayOrZeros(state.circulationReboundActivitySuppressionDiag, state.N),
    circulationReboundSourceSuppressionDiagFrac: arrayOrZeros(state.circulationReboundSourceSuppressionDiag, state.N),
    circulationReboundRawSourceDiagFrac: arrayOrZeros(state.circulationReboundRawSourceDiag, state.N),
    circulationReboundSuppressedSourceDiagFrac: arrayOrZeros(state.circulationReboundSuppressedSourceDiag, state.N),
    circulationReturnFlowOpportunityDiagFrac: arrayOrZeros(state.circulationReturnFlowOpportunityDiag, state.N),
    circulationReturnFlowCouplingAppliedDiagFrac: arrayOrZeros(state.circulationReturnFlowCouplingAppliedDiag, state.N),
    dryingOmegaBridgeAppliedDiagPaS: arrayOrZeros(state.dryingOmegaBridgeAppliedDiag, state.N),
    dryingOmegaBridgeLocalAppliedDiagPaS: arrayOrZeros(state.dryingOmegaBridgeLocalAppliedDiag, state.N),
    dryingOmegaBridgeProjectedAppliedDiagPaS: arrayOrZeros(state.dryingOmegaBridgeProjectedAppliedDiag, state.N),
    equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: arrayOrZeros(state.equatorialEdgeSubsidenceGuardSourceSupportDiag, state.N),
    equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: arrayOrZeros(state.equatorialEdgeSubsidenceGuardTargetWeightDiag, state.N),
    equatorialEdgeSubsidenceGuardAppliedDiagPaS: arrayOrZeros(state.equatorialEdgeSubsidenceGuardAppliedDiag, state.N),
    equatorialEdgeNorthsideLeakSourceWindowDiagFrac: arrayOrZeros(state.equatorialEdgeNorthsideLeakSourceWindowDiag, state.N),
    equatorialEdgeNorthsideLeakRiskDiagFrac: arrayOrZeros(state.equatorialEdgeNorthsideLeakRiskDiag, state.N),
    equatorialEdgeNorthsideLeakAdmissionRiskDiagFrac: arrayOrZeros(state.equatorialEdgeNorthsideLeakAdmissionRiskDiag, state.N),
    equatorialEdgeNorthsideLeakPenaltyDiagFrac: arrayOrZeros(state.equatorialEdgeNorthsideLeakPenaltyDiag, state.N),
    northSourceConcentrationPenaltyDiagFrac: arrayOrZeros(state.northSourceConcentrationPenaltyDiag, state.N),
    northSourceConcentrationAppliedDiag: arrayOrZeros(state.northSourceConcentrationAppliedDiag, state.N),
    atlanticDryCoreReceiverTaperDiagFrac: arrayOrZeros(state.atlanticDryCoreReceiverTaperDiag, state.N),
    atlanticDryCoreReceiverTaperAppliedDiag: arrayOrZeros(state.atlanticDryCoreReceiverTaperAppliedDiag, state.N),
    atlanticTransitionCarryoverContainmentDiagFrac: arrayOrZeros(state.atlanticTransitionCarryoverContainmentDiag, state.N),
    atlanticTransitionCarryoverContainmentAppliedDiag: arrayOrZeros(state.atlanticTransitionCarryoverContainmentAppliedDiag, state.N),
    subtropicalSourceDriverDiagFrac: arrayOrZeros(state.subtropicalSourceDriverDiag, state.N),
    subtropicalSourceDriverFloorDiagFrac: arrayOrZeros(state.subtropicalSourceDriverFloorDiag, state.N),
    subtropicalLocalHemiSourceDiagFrac: arrayOrZeros(state.subtropicalLocalHemiSourceDiag, state.N),
    subtropicalMeanTropicalSourceDiagFrac: arrayOrZeros(state.subtropicalMeanTropicalSourceDiag, state.N),
    subtropicalCrossHemiFloorShareDiagFrac: arrayOrZeros(state.subtropicalCrossHemiFloorShareDiag, state.N),
    subtropicalBalancePartitionSupportDiagFrac: arrayOrZeros(state.subtropicalBalancePartitionSupportDiag, state.N),
    subtropicalBalanceCirculationSupportDiagFrac: arrayOrZeros(state.subtropicalBalanceCirculationSupportDiag, state.N),
    subtropicalBalanceContractSupportDiagFrac: arrayOrZeros(state.subtropicalBalanceContractSupportDiag, state.N),
    subtropicalWeakHemiFracDiag: arrayOrZeros(state.subtropicalWeakHemiFracDiag, state.N),
    subtropicalWeakHemiFloorOverhangDiagFrac: arrayOrZeros(state.subtropicalWeakHemiFloorOverhangDiag, state.N),
    subtropicalWeakHemiFloorTaperAppliedDiagFrac: arrayOrZeros(state.subtropicalWeakHemiFloorTaperAppliedDiag, state.N),
    resolvedAscentCloudBirthPotentialKgM2: arrayOrZeros(state.resolvedAscentCloudBirthPotential, state.N),
    largeScaleCondensationSourceKgM2: arrayOrZeros(state.largeScaleCondensationSource, state.N),
    saturationAdjustmentMaintenanceCandidateMassKgM2: arrayOrZeros(state.saturationAdjustmentMaintenanceCandidateMass, state.N),
    saturationAdjustmentMaintenancePotentialSuppressedMassKgM2: arrayOrZeros(state.saturationAdjustmentMaintenancePotentialSuppressedMass, state.N),
    saturationAdjustmentMaintenanceCandidateEventCount: Array.from(state.saturationAdjustmentMaintenanceCandidateEventCount || new Uint32Array(state.N)),
    saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted: arrayOrZeros(state.saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted, state.N),
    saturationAdjustmentMaintenanceCandidateOmegaMassWeighted: arrayOrZeros(state.saturationAdjustmentMaintenanceCandidateOmegaMassWeighted, state.N),
    saturationAdjustmentMarineEventMassKgM2: arrayOrZeros(state.saturationAdjustmentMarineEventMass, state.N),
    saturationAdjustmentMarineSubtropicalSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineSubtropicalSupportMassWeighted, state.N),
    saturationAdjustmentMarineWeakEngineSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineWeakEngineSupportMassWeighted, state.N),
    saturationAdjustmentMarineWeakAscentSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineWeakAscentSupportMassWeighted, state.N),
    saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted, state.N),
    saturationAdjustmentMarineLayerWindowSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineLayerWindowSupportMassWeighted, state.N),
    saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted, state.N),
    saturationAdjustmentMarineFreshSubtropicalBandMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineFreshSubtropicalBandMassWeighted, state.N),
    saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted, state.N),
    saturationAdjustmentMarineFreshOrganizedSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineFreshOrganizedSupportMassWeighted, state.N),
    saturationAdjustmentMarineFreshRhMidSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentMarineFreshRhMidSupportMassWeighted, state.N),
    saturationAdjustmentLiveGateCandidateMassKgM2: arrayOrZeros(state.saturationAdjustmentLiveGateCandidateMass, state.N),
    saturationAdjustmentLiveGatePotentialSuppressedMassKgM2: arrayOrZeros(state.saturationAdjustmentLiveGatePotentialSuppressedMass, state.N),
    saturationAdjustmentLiveGateEventCount: Array.from(state.saturationAdjustmentLiveGateEventCount || new Uint32Array(state.N)),
    saturationAdjustmentLiveGateSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentLiveGateSupportMassWeighted, state.N),
    saturationAdjustmentSoftLiveGateCandidateMassKgM2: arrayOrZeros(state.saturationAdjustmentSoftLiveGateCandidateMass, state.N),
    saturationAdjustmentSoftLiveGatePotentialSuppressedMassKgM2: arrayOrZeros(state.saturationAdjustmentSoftLiveGatePotentialSuppressedMass, state.N),
    saturationAdjustmentSoftLiveGateEventCount: Array.from(state.saturationAdjustmentSoftLiveGateEventCount || new Uint32Array(state.N)),
    saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted, state.N),
    saturationAdjustmentSoftLiveGateAscentModulationMassWeighted: arrayOrZeros(state.saturationAdjustmentSoftLiveGateAscentModulationMassWeighted, state.N),
    saturationAdjustmentSoftLiveGateAppliedSuppressionMassKgM2: arrayOrZeros(state.saturationAdjustmentSoftLiveGateAppliedSuppressionMass, state.N),
    saturationAdjustmentShoulderGuardCandidateMassKgM2: arrayOrZeros(state.saturationAdjustmentShoulderGuardCandidateMass, state.N),
    saturationAdjustmentShoulderGuardPotentialSuppressedMassKgM2: arrayOrZeros(state.saturationAdjustmentShoulderGuardPotentialSuppressedMass, state.N),
    saturationAdjustmentShoulderGuardEventCount: Array.from(state.saturationAdjustmentShoulderGuardEventCount || new Uint32Array(state.N)),
    saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted: arrayOrZeros(state.saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted, state.N),
    saturationAdjustmentShoulderGuardBandWindowMassWeighted: arrayOrZeros(state.saturationAdjustmentShoulderGuardBandWindowMassWeighted, state.N),
    saturationAdjustmentShoulderGuardSelectorSupportMassWeighted: arrayOrZeros(state.saturationAdjustmentShoulderGuardSelectorSupportMassWeighted, state.N),
    saturationAdjustmentShoulderGuardAppliedSuppressionMassKgM2: arrayOrZeros(state.saturationAdjustmentShoulderGuardAppliedSuppressionMass, state.N),
    saturationAdjustmentShoulderGuardRetainedVaporMassKgM2: arrayOrZeros(state.saturationAdjustmentShoulderGuardRetainedVaporMass, state.N),
    saturationAdjustmentShoulderGuardSinkExportMassKgM2: arrayOrZeros(state.saturationAdjustmentShoulderGuardSinkExportMass, state.N),
    saturationAdjustmentShoulderGuardBufferedRainoutMassKgM2: arrayOrZeros(state.saturationAdjustmentShoulderGuardBufferedRainoutMass, state.N),
    cloudReevaporationMassKgM2: arrayOrZeros(state.cloudReevaporationMass, state.N),
    precipReevaporationMassKgM2: arrayOrZeros(state.precipReevaporationMass, state.N),
    importedAnvilPersistenceMassKgM2: arrayOrZeros(state.importedAnvilPersistenceMass, state.N),
    carriedOverUpperCloudMassKgM2: arrayOrZeros(state.carriedOverUpperCloudMass, state.N),
    weakErosionCloudSurvivalMassKgM2: arrayOrZeros(state.weakErosionCloudSurvivalMass, state.N),
    carryInputOverrideHitCount: arrayOrZeros(state.carryInputOverrideHitCount, state.N),
    carryInputOverrideRemovedMassKgM2: arrayOrZeros(state.carryInputOverrideRemovedMass, state.N),
    carryInputOverrideInputMassKgM2: arrayOrZeros(state.carryInputOverrideInputMass, state.N),
    carryInputOverrideAccumHitCount: arrayOrZeros(state.carryInputOverrideAccumHitCount, state.N),
    carryInputOverrideAccumRemovedMassKgM2: arrayOrZeros(state.carryInputOverrideAccumRemovedMass, state.N),
    carryInputOverrideAccumInputMassKgM2: arrayOrZeros(state.carryInputOverrideAccumInputMass, state.N),
    upperCloudClearSkyLwCoolingWm2: arrayOrZeros(state.upperCloudClearSkyLwCoolingWm2, state.N),
    upperCloudCloudyLwCoolingWm2: arrayOrZeros(state.upperCloudCloudyLwCoolingWm2, state.N),
    upperCloudLwCloudEffectWm2: arrayOrZeros(state.upperCloudLwCloudEffectWm2, state.N),
    upperCloudNetCloudRadiativeEffectWm2: arrayOrZeros(state.upperCloudNetCloudRadiativeEffectWm2, state.N),
    surfaceCloudShortwaveShieldingWm2: arrayOrZeros(state.surfaceCloudShortwaveShieldingWm2, state.N),
    transportTracing,
    verticalCloudBirthTracing,
    upperCloudResidenceTracing,
    cloudTransitionLedgerTracing,
    thermodynamicSupportTracing,
    forcingOppositionTracing,
    numericalIntegrityTracing,
    stormSpilloverTracing,
    lowLevelMoistureSourceTracersKgM2: {
      ...lowLevelSourceTracers,
      unattributedResidual: lowLevelSourceResidual
    },
    processMoistureBudget: typeof core?.getClimateProcessBudgetSummary === 'function'
      ? core.getClimateProcessBudgetSummary()
      : null,
    conservationBudget: typeof core?.getConservationSummary === 'function'
      ? core.getConservationSummary()
      : null,
    moduleTiming: typeof core?.getModuleTimingSummary === 'function'
      ? core.getModuleTimingSummary()
      : null,
    cycloneSupportFields
  };
}

export {
  DEFAULT_PRESSURE_LEVELS_PA,
  TRANSPORT_INTERFACE_TARGETS_DEG,
  TRANSPORT_LEVEL_BANDS,
  TRANSPORT_LATITUDE_BANDS
};
