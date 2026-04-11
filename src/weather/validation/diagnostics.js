import { g, Rd, Cp } from '../constants.js';
import { computeGeopotentialHeightByPressure, DEFAULT_PRESSURE_LEVELS_PA } from '../v2/verticalGrid.js';
import { SURFACE_MOISTURE_SOURCE_TRACERS } from '../v2/sourceTracing5.js';

const EPS = 1e-6;
const P0 = 100000;
const KAPPA = Rd / Cp;

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

export { DEFAULT_PRESSURE_LEVELS_PA };
