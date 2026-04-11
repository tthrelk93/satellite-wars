import { g, Rd, Cp, Re } from '../constants.js';
import { computeGeopotentialHeightByPressure, DEFAULT_PRESSURE_LEVELS_PA } from '../v2/verticalGrid.js';
import {
  NH_DRY_BELT_SOURCE_SECTORS,
  SURFACE_MOISTURE_SOURCE_TRACERS,
  classifyNhDryBeltSector
} from '../v2/sourceTracing5.js';
import { CLOUD_BIRTH_LEVEL_BANDS } from '../v2/cloudBirthTracing5.js';

const EPS = 1e-6;
const P0 = 100000;
const KAPPA = Rd / Cp;
const TRANSPORT_INTERFACE_TARGETS_DEG = [-35, -22, -12, 0, 12, 22, 35];
const TRANSPORT_LEVEL_BANDS = [
  { key: 'boundaryLayer', label: 'Boundary layer', minSigma: 0.85, maxSigma: 1.01 },
  { key: 'lowerTroposphere', label: 'Lower troposphere', minSigma: 0.65, maxSigma: 0.85 },
  { key: 'midTroposphere', label: 'Mid troposphere', minSigma: 0.35, maxSigma: 0.65 },
  { key: 'upperTroposphere', label: 'Upper troposphere', minSigma: 0.0, maxSigma: 0.35 }
];
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
  const transportTracing = buildTransportTracing(state, grid);
  const verticalCloudBirthTracing = buildVerticalCloudBirthTracing(state, grid);
  const upperCloudResidenceTracing = buildUpperCloudResidenceTracing(state, grid, transportTracing);
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
    lowerTroposphericRhFrac: computeLayerMeanRelativeHumidity(state, 0.45, 0.85),
    convectiveMaskFrac: arrayOrZeros(state.convMask, state.N),
    convectivePotentialFrac: arrayOrZeros(state.convectivePotential, state.N),
    convectiveOrganizationFrac: arrayOrZeros(state.convectiveOrganization, state.N),
    convectiveMassFluxKgM2S: arrayOrZeros(state.convectiveMassFlux, state.N),
    convectiveDetrainmentMassKgM2: arrayOrZeros(state.convectiveDetrainmentMass, state.N),
    convectiveRainoutFraction: arrayOrZeros(state.convectiveRainoutFraction, state.N),
    convectiveAnvilSourceFrac: arrayOrZeros(state.convectiveAnvilSource, state.N),
    convectiveHeatingProxyKgM2S: arrayOrZeros(state.convectiveHeatingProxy, state.N),
    convectiveTopLevelIndex: arrayOrZeros(state.convectiveTopLevel, state.N),
    lowLevelMoistureConvergenceS_1: arrayOrZeros(state.lowLevelMoistureConvergence, state.N),
    lowLevelOmegaEffectivePaS: arrayOrZeros(state.lowLevelOmegaEffective, state.N),
    subtropicalSubsidenceDryingFrac: arrayOrZeros(state.subtropicalSubsidenceDrying, state.N),
    resolvedAscentCloudBirthPotentialKgM2: arrayOrZeros(state.resolvedAscentCloudBirthPotential, state.N),
    largeScaleCondensationSourceKgM2: arrayOrZeros(state.largeScaleCondensationSource, state.N),
    cloudReevaporationMassKgM2: arrayOrZeros(state.cloudReevaporationMass, state.N),
    precipReevaporationMassKgM2: arrayOrZeros(state.precipReevaporationMass, state.N),
    importedAnvilPersistenceMassKgM2: arrayOrZeros(state.importedAnvilPersistenceMass, state.N),
    carriedOverUpperCloudMassKgM2: arrayOrZeros(state.carriedOverUpperCloudMass, state.N),
    weakErosionCloudSurvivalMassKgM2: arrayOrZeros(state.weakErosionCloudSurvivalMass, state.N),
    transportTracing,
    verticalCloudBirthTracing,
    upperCloudResidenceTracing,
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
    cycloneSupportFields: {
      relativeVorticityS_1: Array.from(fields.vort || []),
      wind10mSpeedMs,
      seaLevelPressurePa
    }
  };
}

export {
  DEFAULT_PRESSURE_LEVELS_PA,
  TRANSPORT_INTERFACE_TARGETS_DEG,
  TRANSPORT_LEVEL_BANDS,
  TRANSPORT_LATITUDE_BANDS
};
