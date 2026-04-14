import { g, Rd, Cp, Lv, Lf } from '../constants.js';
import {
  CLOUD_BIRTH_LEVEL_BAND_COUNT,
  cloudBirthBandOffset,
  findCloudBirthLevelBandIndex,
  sigmaMidAtLevel
} from './cloudBirthTracing5.js';
import {
  INSTRUMENTATION_LEVEL_BAND_COUNT,
  findInstrumentationLevelBandIndex,
  instrumentationBandOffset
} from './instrumentationBands5.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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

const applyThetaLatent = (thetaVal, dq, latentHeat, Pi) => thetaVal + (latentHeat / Cp * dq) / Pi;
const isUpperCloudSigma = (sigmaMid) => sigmaMid <= 0.55;
const SUBTROPICAL_MAINTENANCE_DIAG = {
  supportThreshold: 0.05,
  suppressMax: 0.55,
  oceanBoost: 0.15,
  subsiding0: 0.55,
  subsiding1: 0.9,
  organization0: 0.12,
  organization1: 0.4,
  massFlux0: 0.1,
  massFlux1: 0.45,
  ascent0: 0.04,
  ascent1: 0.14,
  supersat0: 0.02,
  supersat1: 0.16,
  sigmaLo0: 0.18,
  sigmaLo1: 0.32,
  sigmaHi0: 0.8,
  sigmaHi1: 0.94
};
const sumUpperCloudMassAtCell = (state, pHalf, sigmaHalf, nz, cellIndex, qFields = ['qc', 'qi', 'qr', 'qs']) => {
  let upperCloudMass = 0;
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
    if (!isUpperCloudSigma(sigmaMid)) continue;
    const dp = pHalf[(lev + 1) * state.N + cellIndex] - pHalf[lev * state.N + cellIndex];
    if (dp <= 0) continue;
    let layerMixingRatio = 0;
    for (const fieldName of qFields) {
      const field = state[fieldName];
      if (field?.length === state.N * nz) layerMixingRatio += Number(field[lev * state.N + cellIndex]) || 0;
    }
    upperCloudMass += layerMixingRatio * (dp / g);
  }
  return upperCloudMass;
};

const accumulateBandValue = (field, bandIndex, cell, cellCount, value, enabled = true) => {
  if (
    !enabled
    ||
    !(field instanceof Float32Array)
    || field.length !== cellCount * INSTRUMENTATION_LEVEL_BAND_COUNT
    || !Number.isFinite(value)
    || value === 0
  ) return;
  field[instrumentationBandOffset(bandIndex, cell, cellCount)] += value;
};

export function stepMicrophysics5({ dt, state, params = {} }) {
  if (!state || !Number.isFinite(dt) || dt <= 0) return;
  const traceEnabled = state.instrumentationEnabled !== false;
  const recordBandValue = (field, bandIndex, cell, cellCount, value) => {
    accumulateBandValue(field, bandIndex, cell, cellCount, value, traceEnabled);
  };
  const {
    p0 = 100000,
    pTop = 20000,
    qc0 = 8e-4,
    qi0 = 4e-4,
    qs0 = 6e-4,
    kAutoRain = 3e-4,
    kAutoSnow = 3e-4,
    kAccreteRain = 2e-4,
    kAccreteSnow = 2e-4,
    autoMaxFrac = 0.25,
    precipEffMicro = 0.85,
    tauFreeze = 5400,
    tauMelt = 5400,
    tauFreezeRain = 3600,
    tauMeltSnow = 3600,
    Tfreeze = 273.15,
    TiceFull = 253.15,
    kFallRain = 1 / 3600,
    kFallSnow = 1 / (3 * 3600),
    tauEvapCloudMin = 900,
    tauEvapCloudMax = 7200,
    tauEvapRainMin = 900,
    tauEvapRainMax = 28800,
    tauSubSnowMin = 1200,
    tauSubSnowMax = 36000,
    dThetaMaxMicroPerStep = 1.0,
    dThetaMaxMicroPerStepConv = 2.5,
    rhEvap0 = 0.9,
    rhEvap1 = 0.3,
    tauIceAgg = 12 * 3600,
    iceAggMaxFrac = 0.08,
    precipRateMax = 200,
    enableConvectiveOutcome = false,
    convTauEvapCloudScale = 0.35,
    convKAutoScale = 2.0,
    convPrecipEffBoost = 0.15,
    terrainLeeOmega0 = 0.15,
    terrainLeeOmega1 = 1.2,
    terrainLeeEvapBoost = 1.0,
    terrainLeeWarmRainSuppress = 0.9,
    terrainDeliveryProtectExposure0 = 0.5,
    terrainDeliveryProtectExposure1 = 8.0,
    enableSoftLiveStateMaintenanceSuppression = false,
    softLiveStateMaintenanceSuppressionScale = 2.0,
    softLiveStateMaintenanceSuppressionMaxFrac = 0.4,
    enableShoulderAbsorptionGuard = false,
    shoulderAbsorptionGuardScale = 1.6,
    shoulderAbsorptionGuardMaxFrac = 0.2,
    enable = true
  } = params;
  if (!enable) return;

  const { N, nz, theta, qv, qc, qi, qr, qs, precipRate, precipRainRate, precipSnowRate, precipAccum, pHalf, pMid, omega, T: Tstate, sigmaHalf } = state;
  if (!state.largeScaleCondensationSource || state.largeScaleCondensationSource.length !== N) {
    state.largeScaleCondensationSource = new Float32Array(N);
  }
  if (!state.cloudReevaporationMass || state.cloudReevaporationMass.length !== N) {
    state.cloudReevaporationMass = new Float32Array(N);
  }
  if (!state.precipReevaporationMass || state.precipReevaporationMass.length !== N) {
    state.precipReevaporationMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentCloudBirthAccumMass || state.saturationAdjustmentCloudBirthAccumMass.length !== N) {
    state.saturationAdjustmentCloudBirthAccumMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentEventCount || state.saturationAdjustmentEventCount.length !== N) {
    state.saturationAdjustmentEventCount = new Uint32Array(N);
  }
  if (!state.saturationAdjustmentSupersaturationMassWeighted || state.saturationAdjustmentSupersaturationMassWeighted.length !== N) {
    state.saturationAdjustmentSupersaturationMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentOmegaMassWeighted || state.saturationAdjustmentOmegaMassWeighted.length !== N) {
    state.saturationAdjustmentOmegaMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMaintenanceCandidateMass || state.saturationAdjustmentMaintenanceCandidateMass.length !== N) {
    state.saturationAdjustmentMaintenanceCandidateMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMaintenancePotentialSuppressedMass || state.saturationAdjustmentMaintenancePotentialSuppressedMass.length !== N) {
    state.saturationAdjustmentMaintenancePotentialSuppressedMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMaintenanceCandidateEventCount || state.saturationAdjustmentMaintenanceCandidateEventCount.length !== N) {
    state.saturationAdjustmentMaintenanceCandidateEventCount = new Uint32Array(N);
  }
  if (!state.saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted || state.saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted.length !== N) {
    state.saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMaintenanceCandidateOmegaMassWeighted || state.saturationAdjustmentMaintenanceCandidateOmegaMassWeighted.length !== N) {
    state.saturationAdjustmentMaintenanceCandidateOmegaMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineEventMass || state.saturationAdjustmentMarineEventMass.length !== N) {
    state.saturationAdjustmentMarineEventMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineSubtropicalSupportMassWeighted || state.saturationAdjustmentMarineSubtropicalSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineSubtropicalSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineWeakEngineSupportMassWeighted || state.saturationAdjustmentMarineWeakEngineSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineWeakEngineSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineWeakAscentSupportMassWeighted || state.saturationAdjustmentMarineWeakAscentSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineWeakAscentSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted || state.saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineLayerWindowSupportMassWeighted || state.saturationAdjustmentMarineLayerWindowSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineLayerWindowSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted || state.saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted.length !== N) {
    state.saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineFreshSubtropicalBandMassWeighted || state.saturationAdjustmentMarineFreshSubtropicalBandMassWeighted.length !== N) {
    state.saturationAdjustmentMarineFreshSubtropicalBandMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted || state.saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineFreshOrganizedSupportMassWeighted || state.saturationAdjustmentMarineFreshOrganizedSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineFreshOrganizedSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentMarineFreshRhMidSupportMassWeighted || state.saturationAdjustmentMarineFreshRhMidSupportMassWeighted.length !== N) {
    state.saturationAdjustmentMarineFreshRhMidSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentLiveGateCandidateMass || state.saturationAdjustmentLiveGateCandidateMass.length !== N) {
    state.saturationAdjustmentLiveGateCandidateMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentLiveGatePotentialSuppressedMass || state.saturationAdjustmentLiveGatePotentialSuppressedMass.length !== N) {
    state.saturationAdjustmentLiveGatePotentialSuppressedMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentLiveGateEventCount || state.saturationAdjustmentLiveGateEventCount.length !== N) {
    state.saturationAdjustmentLiveGateEventCount = new Uint32Array(N);
  }
  if (!state.saturationAdjustmentLiveGateSupportMassWeighted || state.saturationAdjustmentLiveGateSupportMassWeighted.length !== N) {
    state.saturationAdjustmentLiveGateSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentSoftLiveGateCandidateMass || state.saturationAdjustmentSoftLiveGateCandidateMass.length !== N) {
    state.saturationAdjustmentSoftLiveGateCandidateMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentSoftLiveGatePotentialSuppressedMass || state.saturationAdjustmentSoftLiveGatePotentialSuppressedMass.length !== N) {
    state.saturationAdjustmentSoftLiveGatePotentialSuppressedMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentSoftLiveGateEventCount || state.saturationAdjustmentSoftLiveGateEventCount.length !== N) {
    state.saturationAdjustmentSoftLiveGateEventCount = new Uint32Array(N);
  }
  if (!state.saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted || state.saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted.length !== N) {
    state.saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentSoftLiveGateAscentModulationMassWeighted || state.saturationAdjustmentSoftLiveGateAscentModulationMassWeighted.length !== N) {
    state.saturationAdjustmentSoftLiveGateAscentModulationMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentSoftLiveGateAppliedSuppressionMass || state.saturationAdjustmentSoftLiveGateAppliedSuppressionMass.length !== N) {
    state.saturationAdjustmentSoftLiveGateAppliedSuppressionMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentShoulderGuardCandidateMass || state.saturationAdjustmentShoulderGuardCandidateMass.length !== N) {
    state.saturationAdjustmentShoulderGuardCandidateMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentShoulderGuardPotentialSuppressedMass || state.saturationAdjustmentShoulderGuardPotentialSuppressedMass.length !== N) {
    state.saturationAdjustmentShoulderGuardPotentialSuppressedMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentShoulderGuardEventCount || state.saturationAdjustmentShoulderGuardEventCount.length !== N) {
    state.saturationAdjustmentShoulderGuardEventCount = new Uint32Array(N);
  }
  if (!state.saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted || state.saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted.length !== N) {
    state.saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentShoulderGuardBandWindowMassWeighted || state.saturationAdjustmentShoulderGuardBandWindowMassWeighted.length !== N) {
    state.saturationAdjustmentShoulderGuardBandWindowMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentShoulderGuardSelectorSupportMassWeighted || state.saturationAdjustmentShoulderGuardSelectorSupportMassWeighted.length !== N) {
    state.saturationAdjustmentShoulderGuardSelectorSupportMassWeighted = new Float32Array(N);
  }
  if (!state.saturationAdjustmentShoulderGuardAppliedSuppressionMass || state.saturationAdjustmentShoulderGuardAppliedSuppressionMass.length !== N) {
    state.saturationAdjustmentShoulderGuardAppliedSuppressionMass = new Float32Array(N);
  }
  if (!state.weakAscentCloudBirthAccumMass || state.weakAscentCloudBirthAccumMass.length !== N) {
    state.weakAscentCloudBirthAccumMass = new Float32Array(N);
  }
  if (!state.strongAscentCloudBirthAccumMass || state.strongAscentCloudBirthAccumMass.length !== N) {
    state.strongAscentCloudBirthAccumMass = new Float32Array(N);
  }
  if (!state.saturationAdjustmentCloudBirthByBandMass || state.saturationAdjustmentCloudBirthByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.saturationAdjustmentCloudBirthByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.microphysicsCloudToPrecipByBandMass || state.microphysicsCloudToPrecipByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.microphysicsCloudToPrecipByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.cloudReevaporationByBandMass || state.cloudReevaporationByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.cloudReevaporationByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.precipReevaporationByBandMass || state.precipReevaporationByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.precipReevaporationByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.microphysicsUpperCloudInputMass || state.microphysicsUpperCloudInputMass.length !== N) {
    state.microphysicsUpperCloudInputMass = new Float32Array(N);
  }
  if (!state.microphysicsUpperCloudSaturationBirthMass || state.microphysicsUpperCloudSaturationBirthMass.length !== N) {
    state.microphysicsUpperCloudSaturationBirthMass = new Float32Array(N);
  }
  if (!state.microphysicsUpperCloudCloudReevaporationMass || state.microphysicsUpperCloudCloudReevaporationMass.length !== N) {
    state.microphysicsUpperCloudCloudReevaporationMass = new Float32Array(N);
  }
  if (!state.microphysicsUpperCloudPrecipReevaporationMass || state.microphysicsUpperCloudPrecipReevaporationMass.length !== N) {
    state.microphysicsUpperCloudPrecipReevaporationMass = new Float32Array(N);
  }
  if (!state.microphysicsUpperCloudSedimentationExportMass || state.microphysicsUpperCloudSedimentationExportMass.length !== N) {
    state.microphysicsUpperCloudSedimentationExportMass = new Float32Array(N);
  }
  if (!state.microphysicsUpperCloudCloudToPrecipMass || state.microphysicsUpperCloudCloudToPrecipMass.length !== N) {
    state.microphysicsUpperCloudCloudToPrecipMass = new Float32Array(N);
  }
  if (!state.microphysicsUpperCloudOutputMass || state.microphysicsUpperCloudOutputMass.length !== N) {
    state.microphysicsUpperCloudOutputMass = new Float32Array(N);
  }
  if (!state.microphysicsUpperCloudResidualMass || state.microphysicsUpperCloudResidualMass.length !== N) {
    state.microphysicsUpperCloudResidualMass = new Float32Array(N);
  }
  state.largeScaleCondensationSource.fill(0);
  state.cloudReevaporationMass.fill(0);
  state.precipReevaporationMass.fill(0);
  state.saturationAdjustmentMaintenanceCandidateMass.fill(0);
  state.saturationAdjustmentMaintenancePotentialSuppressedMass.fill(0);
  state.saturationAdjustmentMaintenanceCandidateEventCount.fill(0);
  state.saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted.fill(0);
  state.saturationAdjustmentMaintenanceCandidateOmegaMassWeighted.fill(0);
  state.saturationAdjustmentMarineEventMass.fill(0);
  state.saturationAdjustmentMarineSubtropicalSupportMassWeighted.fill(0);
  state.saturationAdjustmentMarineWeakEngineSupportMassWeighted.fill(0);
  state.saturationAdjustmentMarineWeakAscentSupportMassWeighted.fill(0);
  state.saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted.fill(0);
  state.saturationAdjustmentMarineLayerWindowSupportMassWeighted.fill(0);
  state.saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted.fill(0);
  state.saturationAdjustmentMarineFreshSubtropicalBandMassWeighted.fill(0);
  state.saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted.fill(0);
  state.saturationAdjustmentMarineFreshOrganizedSupportMassWeighted.fill(0);
  state.saturationAdjustmentMarineFreshRhMidSupportMassWeighted.fill(0);
  state.saturationAdjustmentLiveGateCandidateMass.fill(0);
  state.saturationAdjustmentLiveGatePotentialSuppressedMass.fill(0);
  state.saturationAdjustmentLiveGateEventCount.fill(0);
  state.saturationAdjustmentLiveGateSupportMassWeighted.fill(0);
  state.saturationAdjustmentSoftLiveGateCandidateMass.fill(0);
  state.saturationAdjustmentSoftLiveGatePotentialSuppressedMass.fill(0);
  state.saturationAdjustmentSoftLiveGateEventCount.fill(0);
  state.saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted.fill(0);
  state.saturationAdjustmentSoftLiveGateAscentModulationMassWeighted.fill(0);
  state.saturationAdjustmentSoftLiveGateAppliedSuppressionMass.fill(0);
  state.saturationAdjustmentShoulderGuardCandidateMass.fill(0);
  state.saturationAdjustmentShoulderGuardPotentialSuppressedMass.fill(0);
  state.saturationAdjustmentShoulderGuardEventCount.fill(0);
  state.saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted.fill(0);
  state.saturationAdjustmentShoulderGuardBandWindowMassWeighted.fill(0);
  state.saturationAdjustmentShoulderGuardSelectorSupportMassWeighted.fill(0);
  state.saturationAdjustmentShoulderGuardAppliedSuppressionMass.fill(0);
  state.microphysicsUpperCloudSaturationBirthMass.fill(0);
  state.microphysicsUpperCloudCloudReevaporationMass.fill(0);
  state.microphysicsUpperCloudPrecipReevaporationMass.fill(0);
  state.microphysicsUpperCloudSedimentationExportMass.fill(0);
  state.microphysicsUpperCloudCloudToPrecipMass.fill(0);
  state.microphysicsUpperCloudOutputMass.fill(0);
  state.microphysicsUpperCloudResidualMass.fill(0);
  if (precipRate) precipRate.fill(0);
  if (precipRainRate) precipRainRate.fill(0);
  if (precipSnowRate) precipSnowRate.fill(0);

  for (let k = 0; k < N; k += 1) {
    state.microphysicsUpperCloudInputMass[k] = sumUpperCloudMassAtCell(state, pHalf, sigmaHalf, nz, k);
  }

  const kappa = Rd / Cp;
  const iceDenom = Math.max(1e-6, Tfreeze - TiceFull);
  const evapDenom = Math.max(1e-6, rhEvap0 - rhEvap1);
  const basePrecipEff = clamp(precipEffMicro, 0, 1);
  const autoMax = Math.max(0, autoMaxFrac);
  const iceAggMax = clamp(iceAggMaxFrac, 0, 1);
  const tauIceAggSafe = Math.max(1e-6, tauIceAgg);
  const Ls = Lv + Lf;
  const lowLevelStart = Math.max(0, nz - 4);

  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    for (let k = 0; k < N; k++) {
      const idx = base + k;
      const p = Math.max(pTop, pMid[idx]);
      const dpCell = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      const massCell = dpCell > 0 ? dpCell / g : 0;
      const cloudBirthBandIndex = findCloudBirthLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, nz));
      const Pi = Math.pow(p / p0, kappa);
      const Tcell = Number.isFinite(Tstate?.[idx]) ? Tstate[idx] : theta[idx] * Pi;
      const qsat = saturationMixingRatio(Tcell, p);
      const iceFrac = clamp((Tfreeze - Tcell) / iceDenom, 0, 1);
      const warmFrac = 1 - iceFrac;

      const convOrganization = enableConvectiveOutcome && state.convectiveOrganization
        ? state.convectiveOrganization[k]
        : 0;
      const convMassFlux = enableConvectiveOutcome && state.convectiveMassFlux
        ? state.convectiveMassFlux[k]
        : 0;
      const subtropicalDrying = enableConvectiveOutcome && state.subtropicalSubsidenceDrying
        ? state.subtropicalSubsidenceDrying[k]
        : 0;
      const subtropicalDryingStrength = smoothstep(0.01, 0.08, subtropicalDrying);
      const anvilSource = enableConvectiveOutcome && state.convectiveAnvilSource
        ? state.convectiveAnvilSource[k]
        : 0;
      const convMaskBoost = enableConvectiveOutcome && state.convMask && state.convMask[k] === 1 ? 0.15 : 0;
      const convMassFluxStrength = smoothstep(0.002, 0.03, convMassFlux);
      const convStrength = enableConvectiveOutcome
        ? clamp(0.65 * convOrganization + 0.2 * convMassFluxStrength + convMaskBoost, 0, 1)
        : 0;
      const organizedOutflow = enableConvectiveOutcome
        ? clamp(0.55 * convOrganization + 0.2 * convMassFluxStrength + 0.25 * anvilSource, 0, 1)
        : 0;
      const marginalSubsiding = enableConvectiveOutcome
        ? clamp(0.75 * subtropicalDryingStrength + 0.15 * (1 - convOrganization) + 0.1 * (1 - convMassFluxStrength), 0, 1)
        : 0;
      const terrainOmegaSurface = Number.isFinite(state.terrainOmegaSurface?.[k]) ? state.terrainOmegaSurface[k] : 0;
      const deliveryExposure = Number.isFinite(state.orographicDeliveryExposureAccum?.[k])
        ? state.orographicDeliveryExposureAccum[k]
        : 0;
      const leeBase = lev >= lowLevelStart
        ? smoothstep(terrainLeeOmega0, terrainLeeOmega1, terrainOmegaSurface)
        : 0;
      const deliveryProtect = lev >= lowLevelStart
        ? smoothstep(terrainDeliveryProtectExposure0, terrainDeliveryProtectExposure1, deliveryExposure)
        : 0;
      const leeNoDelivery = clamp(leeBase * (1 - deliveryProtect), 0, 1);
      const evapScale = 1 + leeNoDelivery * Math.max(0, terrainLeeEvapBoost);
      const tauEvapCloudScaleEff = enableConvectiveOutcome
        ? clamp(
            1
              + organizedOutflow * Math.max(0, 1 / Math.max(convTauEvapCloudScale, 1e-3) - 1)
              - 0.7 * marginalSubsiding,
            0.35,
            2.5
          )
        : 1;
      const tauEvapCloudMinEffBase = Math.max(1, tauEvapCloudMin * tauEvapCloudScaleEff);
      const tauEvapCloudMaxEffBase = Math.max(1, tauEvapCloudMax * tauEvapCloudScaleEff);
      const tauEvapCloudMinEff = Math.max(1, tauEvapCloudMinEffBase / evapScale);
      const tauEvapCloudMaxEff = Math.max(1, tauEvapCloudMaxEffBase / evapScale);
      const tauEvapRainMinEff = Math.max(1, tauEvapRainMin / evapScale);
      const tauEvapRainMaxEff = Math.max(1, tauEvapRainMax / evapScale);
      const tauSubSnowMinEff = tauSubSnowMin;
      const tauSubSnowMaxEff = tauSubSnowMax;
      const leeWarmRainSuppress = 1 - leeNoDelivery * clamp(terrainLeeWarmRainSuppress, 0, 1);
      const organizedWarmRainSuppress = 1 - 0.2 * organizedOutflow;
      const subtropicalDrizzleSuppress = 1 - 0.68 * marginalSubsiding;
      const warmRainSuppress = clamp(
        leeWarmRainSuppress * organizedWarmRainSuppress * subtropicalDrizzleSuppress,
        0.1,
        1
      );
      const kAutoRainEff = kAutoRain * warmRainSuppress * (1 + 0.25 * convMassFluxStrength);
      const kAutoSnowEff = kAutoSnow * (1 + 0.15 * convMassFluxStrength + 0.15 * organizedOutflow);
      const precipEff = clamp(
        (
          basePrecipEff
          + 0.45 * convPrecipEffBoost * convMassFluxStrength
          + 0.35 * convPrecipEffBoost * organizedOutflow
          - 1.15 * convPrecipEffBoost * marginalSubsiding
          - 0.1 * subtropicalDryingStrength
        ) * warmRainSuppress,
        0.05,
        1
      );
      const dThetaCapEff = Math.max(
        0,
        dThetaMaxMicroPerStep + convStrength * Math.max(0, dThetaMaxMicroPerStepConv - dThetaMaxMicroPerStep)
      );

      let qvVal = qv[idx];
      let qcVal = qc[idx];
      let qiVal = qi[idx];
      let qrVal = qr[idx];
      let qsVal = qs[idx];
      let thetaVal = theta[idx];
      let cloudToPrecipMass = 0;

      const applyLatentCap = (dq, latentHeat) => {
        if (dThetaCapEff <= 0) return dq;
        const dqThetaCap = (dThetaCapEff * Pi * Cp) / latentHeat;
        return Math.min(dq, dqThetaCap);
      };

      if (qvVal > qsat) {
        const supersaturationFrac = Math.max(0, (qvVal - qsat) / Math.max(1e-8, qsat));
        const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
        const omegaTop = Number.isFinite(omega?.[lev * N + k]) ? omega[lev * N + k] : 0;
        const omegaBot = Number.isFinite(omega?.[(lev + 1) * N + k]) ? omega[(lev + 1) * N + k] : 0;
        const ascentMagnitudePaS = Math.max(0, -0.5 * (omegaTop + omegaBot));
        const isOceanColumn = state.landMask?.[k] !== 1;
        const freshSubtropicalSuppression = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              Number.isFinite(state.freshSubtropicalSuppressionDiag?.[k])
                ? state.freshSubtropicalSuppressionDiag[k]
                : Number.isFinite(state._freshSubtropicalSuppression?.[k])
                  ? state._freshSubtropicalSuppression[k]
                  : 0,
              0,
              1
            )
          : 0;
        const freshSubtropicalBand = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              Number.isFinite(state.freshSubtropicalBandDiag?.[k])
                ? state.freshSubtropicalBandDiag[k]
                : 0,
              0,
              1
            )
          : 0;
        const freshNeutralToSubsidingSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              Number.isFinite(state.freshNeutralToSubsidingSupportDiag?.[k])
                ? state.freshNeutralToSubsidingSupportDiag[k]
                : 0,
              0,
              1
            )
          : 0;
        const freshOrganizedSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              Number.isFinite(state.freshOrganizedSupportDiag?.[k])
                ? state.freshOrganizedSupportDiag[k]
                : Number.isFinite(state._freshOrganizedSupport?.[k])
                  ? state._freshOrganizedSupport[k]
                  : 0,
              0,
              1
            )
          : 0;
        const freshRhMidSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              Number.isFinite(state.freshRhMidSupportDiag?.[k])
                ? state.freshRhMidSupportDiag[k]
                : 0,
              0,
              1
            )
          : 0;
        const subtropicalSupport = enableConvectiveOutcome && isOceanColumn
          ? smoothstep(SUBTROPICAL_MAINTENANCE_DIAG.subsiding0, SUBTROPICAL_MAINTENANCE_DIAG.subsiding1, marginalSubsiding)
          : 0;
        const weakOrganizationSupport = enableConvectiveOutcome && isOceanColumn
          ? 1 - smoothstep(SUBTROPICAL_MAINTENANCE_DIAG.organization0, SUBTROPICAL_MAINTENANCE_DIAG.organization1, organizedOutflow)
          : 0;
        const weakMassFluxSupport = enableConvectiveOutcome && isOceanColumn
          ? 1 - smoothstep(SUBTROPICAL_MAINTENANCE_DIAG.massFlux0, SUBTROPICAL_MAINTENANCE_DIAG.massFlux1, convMassFluxStrength)
          : 0;
        const weakEngineSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(0.65 * weakOrganizationSupport + 0.35 * weakMassFluxSupport, 0, 1)
          : 0;
        const weakAscentSupport = enableConvectiveOutcome && isOceanColumn
          ? 1 - smoothstep(SUBTROPICAL_MAINTENANCE_DIAG.ascent0, SUBTROPICAL_MAINTENANCE_DIAG.ascent1, ascentMagnitudePaS)
          : 0;
        const marginalSupersaturationSupport = enableConvectiveOutcome && isOceanColumn
          ? 1 - smoothstep(SUBTROPICAL_MAINTENANCE_DIAG.supersat0, SUBTROPICAL_MAINTENANCE_DIAG.supersat1, supersaturationFrac)
          : 0;
        const maintenanceLayerSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              smoothstep(SUBTROPICAL_MAINTENANCE_DIAG.sigmaLo0, SUBTROPICAL_MAINTENANCE_DIAG.sigmaLo1, sigmaMid)
              * (1 - smoothstep(SUBTROPICAL_MAINTENANCE_DIAG.sigmaHi0, SUBTROPICAL_MAINTENANCE_DIAG.sigmaHi1, sigmaMid)),
              0,
              1
            )
          : 0;
        const maintenanceSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
                * (1 + SUBTROPICAL_MAINTENANCE_DIAG.oceanBoost)
                * subtropicalSupport
                * weakEngineSupport
                * weakAscentSupport
                * marginalSupersaturationSupport
                * maintenanceLayerSupport,
              0,
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
            )
          : 0;
        const liveGateSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
                * (1 + SUBTROPICAL_MAINTENANCE_DIAG.oceanBoost)
                * freshSubtropicalSuppression
                * weakEngineSupport
                * weakAscentSupport
                * marginalSupersaturationSupport
                * maintenanceLayerSupport,
              0,
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
            )
          : 0;
        const softLiveGateSelectorSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              freshSubtropicalSuppression
                * (0.6 + 0.4 * freshSubtropicalBand)
                * weakEngineSupport
                * (1 - 0.5 * freshOrganizedSupport)
                * marginalSupersaturationSupport
                * (0.45 + 0.55 * maintenanceLayerSupport),
              0,
              1
            )
          : 0;
        const softLiveGateAscentModulation = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              0.35
                + 0.45 * weakAscentSupport
                + 0.2 * Math.max(freshNeutralToSubsidingSupport, weakAscentSupport),
              0.35,
              1
            )
          : 0;
        const softLiveGateSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
                * (1 + SUBTROPICAL_MAINTENANCE_DIAG.oceanBoost)
                * softLiveGateSelectorSupport
                * softLiveGateAscentModulation,
              0,
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
            )
          : 0;
        const dryingOmegaBridgeApplied = enableConvectiveOutcome && isOceanColumn
          ? Math.max(0, Number.isFinite(state.dryingOmegaBridgeAppliedDiag?.[k]) ? state.dryingOmegaBridgeAppliedDiag[k] : 0)
          : 0;
        const shoulderBridgeSilenceSupport = enableConvectiveOutcome && isOceanColumn
          ? 1 - smoothstep(5e-5, 3.5e-4, dryingOmegaBridgeApplied)
          : 0;
        const shoulderBandWindowSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              smoothstep(0.04, 0.22, freshSubtropicalBand)
                * (1 - smoothstep(0.56, 0.82, freshSubtropicalBand)),
              0,
              1
            )
          : 0;
        const shoulderAscentModulation = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              0.45
                + 0.4 * weakAscentSupport
                + 0.15 * Math.max(freshNeutralToSubsidingSupport, weakAscentSupport),
              0.45,
              1
            )
          : 0;
        const shoulderSelectorSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              shoulderBridgeSilenceSupport
                * shoulderBandWindowSupport
                * weakEngineSupport
                * marginalSupersaturationSupport
                * shoulderAscentModulation
                * (1 - 0.6 * freshOrganizedSupport),
              0,
              1
            )
          : 0;
        const shoulderGuardSupport = enableConvectiveOutcome && isOceanColumn
          ? clamp(
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
                * shoulderSelectorSupport,
              0,
              SUBTROPICAL_MAINTENANCE_DIAG.suppressMax
            )
          : 0;
        const dqRaw = applyLatentCap(qvVal - qsat, iceFrac > 0.5 ? Ls : Lv);
        const softLiveGateSuppressionFrac = enableSoftLiveStateMaintenanceSuppression
          && isOceanColumn
          && softLiveGateSelectorSupport >= SUBTROPICAL_MAINTENANCE_DIAG.supportThreshold
          ? clamp(
              softLiveGateSupport * softLiveStateMaintenanceSuppressionScale,
              0,
              softLiveStateMaintenanceSuppressionMaxFrac
            )
          : 0;
        const shoulderGuardSuppressionFrac = enableShoulderAbsorptionGuard
          && isOceanColumn
          && shoulderSelectorSupport >= SUBTROPICAL_MAINTENANCE_DIAG.supportThreshold
          ? clamp(
              shoulderGuardSupport * shoulderAbsorptionGuardScale,
              0,
              shoulderAbsorptionGuardMaxFrac
            )
          : 0;
        const combinedSuppressionFrac = Math.max(softLiveGateSuppressionFrac, shoulderGuardSuppressionFrac);
        const effectiveShoulderGuardSuppressionFrac = shoulderGuardSuppressionFrac >= softLiveGateSuppressionFrac
          ? shoulderGuardSuppressionFrac
          : 0;
        const dqSuppressed = dqRaw * combinedSuppressionFrac;
        let dq = dqRaw - dqSuppressed;
        if (dq > 0) {
          qvVal -= dq;
          if (traceEnabled && massCell > 0) {
            const condMass = dq * massCell;
            const condMassRaw = dqRaw * massCell;
            const condSuppressedMass = dqSuppressed * massCell;
            const condShoulderSuppressedMass = dqRaw * effectiveShoulderGuardSuppressionFrac * massCell;
            const numericalBandIndex = findInstrumentationLevelBandIndex(sigmaMid);
            state.largeScaleCondensationSource[k] += condMass;
            if (isOceanColumn) {
              state.saturationAdjustmentMarineEventMass[k] += condMass;
              state.saturationAdjustmentMarineSubtropicalSupportMassWeighted[k] += subtropicalSupport * condMass;
              state.saturationAdjustmentMarineWeakEngineSupportMassWeighted[k] += weakEngineSupport * condMass;
              state.saturationAdjustmentMarineWeakAscentSupportMassWeighted[k] += weakAscentSupport * condMass;
              state.saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted[k] += marginalSupersaturationSupport * condMass;
              state.saturationAdjustmentMarineLayerWindowSupportMassWeighted[k] += maintenanceLayerSupport * condMass;
              state.saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted[k] += freshSubtropicalSuppression * condMass;
              state.saturationAdjustmentMarineFreshSubtropicalBandMassWeighted[k] += freshSubtropicalBand * condMass;
              state.saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted[k] += freshNeutralToSubsidingSupport * condMass;
              state.saturationAdjustmentMarineFreshOrganizedSupportMassWeighted[k] += freshOrganizedSupport * condMass;
              state.saturationAdjustmentMarineFreshRhMidSupportMassWeighted[k] += freshRhMidSupport * condMass;
            }
            if (maintenanceSupport >= SUBTROPICAL_MAINTENANCE_DIAG.supportThreshold) {
              state.saturationAdjustmentMaintenanceCandidateMass[k] += condMassRaw;
              state.saturationAdjustmentMaintenancePotentialSuppressedMass[k] += condMassRaw * maintenanceSupport;
              state.saturationAdjustmentMaintenanceCandidateEventCount[k] += 1;
              state.saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted[k] += supersaturationFrac * condMassRaw;
              state.saturationAdjustmentMaintenanceCandidateOmegaMassWeighted[k] += ascentMagnitudePaS * condMassRaw;
            }
            if (liveGateSupport >= SUBTROPICAL_MAINTENANCE_DIAG.supportThreshold) {
              state.saturationAdjustmentLiveGateCandidateMass[k] += condMassRaw;
              state.saturationAdjustmentLiveGatePotentialSuppressedMass[k] += condMassRaw * liveGateSupport;
              state.saturationAdjustmentLiveGateEventCount[k] += 1;
              state.saturationAdjustmentLiveGateSupportMassWeighted[k] += liveGateSupport * condMassRaw;
            }
            if (softLiveGateSelectorSupport >= SUBTROPICAL_MAINTENANCE_DIAG.supportThreshold) {
              state.saturationAdjustmentSoftLiveGateCandidateMass[k] += condMassRaw;
              state.saturationAdjustmentSoftLiveGatePotentialSuppressedMass[k] += condMassRaw * softLiveGateSupport;
              state.saturationAdjustmentSoftLiveGateEventCount[k] += 1;
              state.saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted[k] += softLiveGateSelectorSupport * condMassRaw;
              state.saturationAdjustmentSoftLiveGateAscentModulationMassWeighted[k] += softLiveGateAscentModulation * condMassRaw;
              state.saturationAdjustmentSoftLiveGateAppliedSuppressionMass[k] += condSuppressedMass;
            }
            if (shoulderSelectorSupport >= SUBTROPICAL_MAINTENANCE_DIAG.supportThreshold) {
              state.saturationAdjustmentShoulderGuardCandidateMass[k] += condMassRaw;
              state.saturationAdjustmentShoulderGuardPotentialSuppressedMass[k] += condMassRaw * shoulderGuardSupport;
              state.saturationAdjustmentShoulderGuardEventCount[k] += 1;
              state.saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted[k] += shoulderBridgeSilenceSupport * condMassRaw;
              state.saturationAdjustmentShoulderGuardBandWindowMassWeighted[k] += shoulderBandWindowSupport * condMassRaw;
              state.saturationAdjustmentShoulderGuardSelectorSupportMassWeighted[k] += shoulderSelectorSupport * condMassRaw;
              state.saturationAdjustmentShoulderGuardAppliedSuppressionMass[k] += condShoulderSuppressedMass;
            }
            if (isUpperCloudSigma(sigmaMid)) {
              state.microphysicsUpperCloudSaturationBirthMass[k] += condMass;
            }
            state.saturationAdjustmentCloudBirthAccumMass[k] += condMass;
            state.saturationAdjustmentEventCount[k] += 1;
            state.saturationAdjustmentSupersaturationMassWeighted[k] += supersaturationFrac * condMass;
            state.numericalSupersaturationClampCount[k] += 1;
            state.numericalSupersaturationClampMass[k] += condMass;
            recordBandValue(state.numericalSupersaturationClampByBandMass, numericalBandIndex, k, N, condMass);
            state.saturationAdjustmentOmegaMassWeighted[k] += ascentMagnitudePaS * condMass;
            if (ascentMagnitudePaS <= 0.08) state.weakAscentCloudBirthAccumMass[k] += condMass;
            if (ascentMagnitudePaS >= 0.18) state.strongAscentCloudBirthAccumMass[k] += condMass;
            state.saturationAdjustmentCloudBirthByBandMass[cloudBirthBandOffset(cloudBirthBandIndex, k, N)] += condMass;
          }
          if (iceFrac > 0.5) {
            qiVal += dq;
            thetaVal = applyThetaLatent(thetaVal, dq, Ls, Pi);
          } else {
            qcVal += dq;
            thetaVal = applyThetaLatent(thetaVal, dq, Lv, Pi);
          }
        }
      } else if (qvVal < qsat) {
        const RH = clamp(qvVal / Math.max(1e-8, qsat), 0, 2);
        const tauEvapCloud = tauEvapCloudMinEff + (tauEvapCloudMaxEff - tauEvapCloudMinEff) * RH;
        const tauEvapRain = tauEvapRainMinEff + (tauEvapRainMaxEff - tauEvapRainMinEff) * RH;
        const tauSubSnow = tauSubSnowMinEff + (tauSubSnowMaxEff - tauSubSnowMinEff) * RH;
        let deficit = qsat - qvVal;

        const evaporate = (storeVal, tau, latentHeat, bucket) => {
          if (storeVal <= 0 || deficit <= 0) return [storeVal, 0];
          let dq = Math.min(storeVal, deficit * dt / Math.max(1e-6, tau));
          dq = applyLatentCap(dq, latentHeat);
          if (dq <= 0) return [storeVal, 0];
          deficit -= dq;
          qvVal += dq;
          if (traceEnabled && massCell > 0) {
            if (bucket === 'cloud') state.cloudReevaporationMass[k] += dq * massCell;
            else if (bucket === 'precip') state.precipReevaporationMass[k] += dq * massCell;
            if (isUpperCloudSigma(sigmaMidAtLevel(sigmaHalf, lev, nz))) {
              if (bucket === 'cloud') state.microphysicsUpperCloudCloudReevaporationMass[k] += dq * massCell;
              else if (bucket === 'precip') state.microphysicsUpperCloudPrecipReevaporationMass[k] += dq * massCell;
            }
            if (bucket === 'cloud') state.cloudReevaporationByBandMass[cloudBirthBandOffset(cloudBirthBandIndex, k, N)] += dq * massCell;
            else if (bucket === 'precip') state.precipReevaporationByBandMass[cloudBirthBandOffset(cloudBirthBandIndex, k, N)] += dq * massCell;
          }
          thetaVal = applyThetaLatent(thetaVal, -dq, latentHeat, Pi);
          return [storeVal - dq, dq];
        };

        [qcVal] = evaporate(qcVal, tauEvapCloud, Lv, 'cloud');
        [qiVal] = evaporate(qiVal, tauEvapCloud, Ls, 'cloud');
        [qrVal] = evaporate(qrVal, tauEvapRain, Lv, 'precip');
        [qsVal] = evaporate(qsVal, tauSubSnow, Ls, 'precip');
      }

      const qCond = qcVal + qiVal;
      if (qCond > 0) {
        const qiTarget = qCond * iceFrac;
        const qcTarget = qCond - qiTarget;
        const tauPhase = iceFrac >= 0.5 ? tauFreeze : tauMelt;
        const frac = clamp(dt / Math.max(1e-6, tauPhase), 0, 1);
        const dQc = frac * (qcTarget - qcVal);
        qcVal += dQc;
        qiVal -= dQc;
        if (dQc < 0) {
          thetaVal = applyThetaLatent(thetaVal, -dQc, Lf, Pi);
        } else if (dQc > 0) {
          thetaVal = applyThetaLatent(thetaVal, -dQc, Lf, Pi);
        }
      }

      if (qrVal > 0 && iceFrac > 0) {
        const freezeFrac = clamp((dt / Math.max(1e-6, tauFreezeRain)) * iceFrac, 0, 0.5);
        const dqFreeze = qrVal * freezeFrac;
        qrVal -= dqFreeze;
        qsVal += dqFreeze;
        thetaVal = applyThetaLatent(thetaVal, dqFreeze, Lf, Pi);
      }
      if (qsVal > 0 && warmFrac > 0) {
        const meltFrac = clamp((dt / Math.max(1e-6, tauMeltSnow)) * warmFrac, 0, 0.5);
        const dqMelt = qsVal * meltFrac;
        qsVal -= dqMelt;
        qrVal += dqMelt;
        thetaVal = applyThetaLatent(thetaVal, -dqMelt, Lf, Pi);
      }

      if (qcVal > 0) {
        const excess = Math.max(0, qcVal - qc0);
        const fracAuto = clamp(kAutoRainEff * dt, 0, autoMax);
        const dqAuto = Math.min(qcVal, fracAuto * excess);
        const dqAccrete = Math.min(qcVal - dqAuto, qcVal * qrVal * kAccreteRain * dt * precipEff);
        qcVal -= dqAuto + dqAccrete;
        qrVal += dqAuto + dqAccrete;
        cloudToPrecipMass += dqAuto + dqAccrete;
      }

      if (qiVal > 0) {
        const excess = Math.max(0, qiVal - qi0);
        const fracAuto = clamp(kAutoSnowEff * dt, 0, autoMax);
        const dqAuto = Math.min(qiVal, fracAuto * excess);
        const fracAgg = clamp((dt / tauIceAggSafe) * precipEff, 0, iceAggMax);
        const dqAgg = Math.min(qiVal - dqAuto, qiVal * fracAgg);
        qiVal -= dqAuto + dqAgg;
        qsVal += dqAuto + dqAgg;
        cloudToPrecipMass += dqAuto + dqAgg;
      }

      if (qcVal > 0 && qsVal > 0 && iceFrac > 0.25) {
        const dqRime = Math.min(qcVal, qcVal * qsVal * kAccreteSnow * dt * precipEff);
        qcVal -= dqRime;
        qsVal += dqRime;
        thetaVal = applyThetaLatent(thetaVal, dqRime, Lf, Pi);
        cloudToPrecipMass += dqRime;
      }

      if (traceEnabled && massCell > 0 && cloudToPrecipMass > 0) {
        state.microphysicsCloudToPrecipByBandMass[cloudBirthBandOffset(cloudBirthBandIndex, k, N)] += cloudToPrecipMass * massCell;
        if (isUpperCloudSigma(sigmaMidAtLevel(sigmaHalf, lev, nz))) {
          state.microphysicsUpperCloudCloudToPrecipMass[k] += cloudToPrecipMass * massCell;
        }
      }

      const numericalBandIndex = findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, nz));
      const negativeClipMass = massCell > 0
        ? ((-Math.min(0, qvVal)) + (-Math.min(0, qcVal)) + (-Math.min(0, qiVal)) + (-Math.min(0, qrVal)) + (-Math.min(0, qsVal))) * massCell
        : 0;
      const cloudLimiterMass = massCell > 0
        ? ((-Math.min(0, qcVal)) + (-Math.min(0, qiVal)) + (-Math.min(0, qrVal)) + (-Math.min(0, qsVal))) * massCell
        : 0;
      const negativeClipCount = (qvVal < 0) + (qcVal < 0) + (qiVal < 0) + (qrVal < 0) + (qsVal < 0);
      const cloudLimiterCount = (qcVal < 0) + (qiVal < 0) + (qrVal < 0) + (qsVal < 0);
      if (negativeClipCount > 0) {
        state.numericalNegativeClipCount[k] += negativeClipCount;
        state.numericalNegativeClipMass[k] += negativeClipMass;
        recordBandValue(state.numericalNegativeClipByBandMass, numericalBandIndex, k, N, negativeClipMass);
      }
      if (cloudLimiterCount > 0) {
        state.numericalCloudLimiterCount[k] += cloudLimiterCount;
        state.numericalCloudLimiterMass[k] += cloudLimiterMass;
        recordBandValue(state.numericalCloudLimiterByBandMass, numericalBandIndex, k, N, cloudLimiterMass);
      }
      qv[idx] = Math.max(0, qvVal);
      qc[idx] = Math.max(0, qcVal);
      qi[idx] = Math.max(0, qiVal);
      qr[idx] = Math.max(0, qrVal);
      qs[idx] = Math.max(0, qsVal);
      theta[idx] = thetaVal;
    }
  }

  const sediment = (store, fallRate, rateOut, latentMelt = false) => {
    const fallFrac = clamp(fallRate * dt, 0, 1);
    if (fallFrac <= 0) return;
    for (let lev = nz - 1; lev >= 0; lev--) {
      const base = lev * N;
      const baseHalf = lev * N;
      const baseHalfNext = (lev + 1) * N;
      const baseHalfBelow = (lev + 2) * N;
      for (let k = 0; k < N; k++) {
        const idx = base + k;
        let qVal = store[idx];
        if (qVal <= 0) continue;
        const dpLev = pHalf[baseHalfNext + k] - pHalf[baseHalf + k];
        if (dpLev <= 0) continue;
        const mLev = dpLev / g;
        const massOut = qVal * mLev * fallFrac;
        if (massOut <= 0) continue;
        const currentSigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
        const currentInUpper = isUpperCloudSigma(currentSigmaMid);
        store[idx] = qVal - massOut / mLev;
        if (lev === nz - 1) {
          if (precipAccum) precipAccum[k] += massOut;
          if (rateOut) rateOut[k] += massOut * (3600 / dt);
          if (precipRate) precipRate[k] += massOut * (3600 / dt);
          if (currentInUpper) state.microphysicsUpperCloudSedimentationExportMass[k] += massOut;
        } else {
          const dpBelow = pHalf[baseHalfBelow + k] - pHalf[baseHalfNext + k];
          if (dpBelow > 0) {
            const mBelow = dpBelow / g;
            const belowSigmaMid = sigmaMidAtLevel(sigmaHalf, lev + 1, nz);
            if (currentInUpper && !isUpperCloudSigma(belowSigmaMid)) {
              state.microphysicsUpperCloudSedimentationExportMass[k] += massOut;
            }
            store[base + N + k] += massOut / mBelow;
          } else {
            if (currentInUpper) state.microphysicsUpperCloudSedimentationExportMass[k] += massOut;
            store[idx] += massOut / mLev;
          }
        }
      }
    }
  };

  sediment(qs, kFallSnow, precipSnowRate);
  sediment(qr, kFallRain, precipRainRate);

  for (let m = 0; m < qv.length; m++) {
    if (qv[m] < 0) qv[m] = 0;
    if (qc[m] < 0) qc[m] = 0;
    if (qi[m] < 0) qi[m] = 0;
    if (qr[m] < 0) qr[m] = 0;
    if (qs[m] < 0) qs[m] = 0;
  }

  for (let k = 0; k < N; k += 1) {
    const outputMass = sumUpperCloudMassAtCell(state, pHalf, sigmaHalf, nz, k);
    state.microphysicsUpperCloudOutputMass[k] = outputMass;
    state.microphysicsUpperCloudResidualMass[k] = (
      (state.microphysicsUpperCloudInputMass[k] || 0)
      + (state.microphysicsUpperCloudSaturationBirthMass[k] || 0)
      - (state.microphysicsUpperCloudCloudReevaporationMass[k] || 0)
      - (state.microphysicsUpperCloudPrecipReevaporationMass[k] || 0)
      - (state.microphysicsUpperCloudSedimentationExportMass[k] || 0)
      - outputMass
    );
  }

  if (precipRate) {
    for (let k = 0; k < N; k++) {
      if (precipRate[k] > precipRateMax) precipRate[k] = precipRateMax;
      if (precipRate[k] < 0) precipRate[k] = 0;
      if (precipRainRate && precipRainRate[k] < 0) precipRainRate[k] = 0;
      if (precipSnowRate && precipSnowRate[k] < 0) precipSnowRate[k] = 0;
    }
  }
}
