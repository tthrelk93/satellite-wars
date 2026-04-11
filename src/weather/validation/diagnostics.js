import { g, Rd, Cp, Re } from '../constants.js';
import { computeGeopotentialHeightByPressure, DEFAULT_PRESSURE_LEVELS_PA } from '../v2/verticalGrid.js';
import { SURFACE_MOISTURE_SOURCE_TRACERS } from '../v2/sourceTracing5.js';

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
