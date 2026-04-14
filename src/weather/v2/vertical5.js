import { Cp, Rd, g, Lv } from '../constants.js';
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

const P0 = 100000;
const KAPPA = Rd / Cp;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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
const isUpperCloudSigma = (sigmaMid) => sigmaMid <= 0.55;
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
const scaleUpperCloudMassAtCell = (state, sigmaHalf, nz, cellIndex, keepFrac) => {
  const boundedKeepFrac = clamp01(keepFrac);
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
    if (!isUpperCloudSigma(sigmaMid)) continue;
    const idx = lev * state.N + cellIndex;
    state.qc[idx] *= boundedKeepFrac;
    state.qi[idx] *= boundedKeepFrac;
    state.qr[idx] *= boundedKeepFrac;
    state.qs[idx] *= boundedKeepFrac;
  }
};
const computeCirculationReboundContainment = ({
  enabled,
  tropicalCore,
  subtropicalBand,
  subtropicalSuppression,
  neutralToSubsidingSupport,
  organizedSupport,
  potentialTarget,
  containmentScale,
  organizationScale,
  activityScale,
  sourceScale
}) => {
  if (!enabled) {
    return {
      support: 0,
      organizationSuppressFrac: 0,
      activitySuppressFrac: 0,
      sourceSuppressFrac: 0
    };
  }
  const transitionEnvelope = clamp01(
    subtropicalBand * (1 - smoothstep(0.82, 0.98, tropicalCore))
  );
  if (transitionEnvelope <= 0) {
    return {
      support: 0,
      organizationSuppressFrac: 0,
      activitySuppressFrac: 0,
      sourceSuppressFrac: 0
    };
  }
  const weakEngineSupport = clamp01(
    0.55 * (1 - organizedSupport) +
    0.45 * (1 - potentialTarget)
  );
  const support = clamp01(
    transitionEnvelope * (
      0.42 * subtropicalSuppression +
      0.28 * neutralToSubsidingSupport +
      0.2 * weakEngineSupport +
      0.1 * (1 - tropicalCore)
    )
  );
  const appliedSupport = clamp01(support * containmentScale);
  return {
    support,
    organizationSuppressFrac: clamp01(appliedSupport * organizationScale),
    activitySuppressFrac: clamp01(appliedSupport * activityScale),
    sourceSuppressFrac: clamp01(
      appliedSupport
      * (0.7 + 0.3 * neutralToSubsidingSupport)
      * sourceScale
    )
  };
};
const VERTICAL_ALLOWED_PARAMS = new Set([
  'enableMixing',
  'enableConvection',
  'enableConvectiveMixing',
  'enableConvectiveOutcome',
  'mu0',
  'tauConv',
  'tauPblUnstable',
  'tauPblStable',
  'pblDepthFrac',
  'maxMixFracPbl',
  'pblTaper',
  'pblMixCondensate',
  'pblCondMixScale',
  'rhTrig',
  'rhMidMin',
  'omegaTrig',
  'instabTrig',
  'qvTrig',
  'thetaeCoeff',
  'thetaeQvCap',
  'convPotentialGrowTau',
  'convPotentialDecayTau',
  'convOrganizationGrowTau',
  'convOrganizationDecayTau',
  'convMinPotential',
  'convMinOrganization',
  'pblWarmRain',
  'qcAuto0',
  'tauAuto',
  'autoMaxFrac',
  'entrainFrac',
  'detrainTopFrac',
  'convRainoutBase',
  'convRainoutOrganizationWeight',
  'convRainoutHumidityWeight',
  'buoyTrigK',
  'dThetaMaxConvPerStep',
  'enableLargeScaleVerticalAdvection',
  'verticalAdvectionCflMax',
  'verticalAdvectionSigmaTaperExp',
  'dThetaMaxVertAdvPerStep',
  'enableOmegaMassFix',
  'omegaMassFixSigmaTaperExp',
  'orographicLiftScale',
  'orographicLeeSubsidenceScale',
  'orographicDecayFrac',
  'terrainSlopeRef',
  'terrainDirectionalBlend',
  'terrainLeeOmega0',
  'terrainLeeOmega1',
  'terrainLeeAscentDamp',
  'terrainLeeOmegaFloorBlend',
  'terrainDeliveryProtectExposure0',
  'terrainDeliveryProtectExposure1',
  'tropicalOrganizationBandDeg',
  'subtropicalSubsidenceLat0',
  'subtropicalSubsidenceLat1',
  'subtropicalSubsidenceTau',
  'subtropicalSubsidenceMaxDryFrac',
  'subtropicalSubsidenceThetaStepK',
  'subtropicalSubsidenceTopSigma',
  'subtropicalSubsidenceBottomSigma',
  'subtropicalSubsidenceCrossHemiFloorFrac',
  'subtropicalSubsidenceWeakHemiBoost',
  'enableCirculationReboundContainment',
  'circulationReboundContainmentScale',
  'circulationReboundOrganizationScale',
  'circulationReboundActivityScale',
  'circulationReboundSourceScale',
  'enableCarryInputDominanceOverride',
  'carryInputSubtropicalSuppressionMin',
  'carryInputOrganizedSupportMax',
  'carryInputPotentialMax',
  'carryInputDominanceMin',
  'carryInputMinResidualMassKgM2',
  'carryInputClearFrac',
  'eps',
  'debugConservation'
]);
const verticalWarnedParams = new Set();
const warnUnknownVerticalParams = (params) => {
  if (!params || typeof params !== 'object') return;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  const unknown = Object.keys(params).filter(
    (key) => !VERTICAL_ALLOWED_PARAMS.has(key) && !verticalWarnedParams.has(key)
  );
  if (!unknown.length) return;
  unknown.forEach((key) => verticalWarnedParams.add(key));
  console.warn(`[V2 vertical] Unknown params: ${unknown.join(', ')}`);
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

export function stepVertical5({ dt, grid, state, geo, params = {} }) {
  if (!grid || !state) return;
  warnUnknownVerticalParams(params);
  const traceEnabled = state.instrumentationEnabled !== false;
  const recordBandValue = (field, bandIndex, cell, cellCount, value) => {
    accumulateBandValue(field, bandIndex, cell, cellCount, value, traceEnabled);
  };

  const {
    enableMixing = true,
    enableConvection = true,
    enableConvectiveMixing = false,
    enableConvectiveOutcome = false,
    // Deep convection strength: either a fixed per-step parcel mass fraction (mu0),
    // or dt-scaled via tauConv (preferred for stability across dt).
    mu0 = 0.05,
    tauConv = 2 * 3600,

    // PBL mixing
    // PBL mixing (timescale-based)
    tauPblUnstable = 6 * 3600,
    tauPblStable = 2 * 86400,
    pblDepthFrac = 0.35,
    maxMixFracPbl = 0.2,
    pblTaper = 0.85,
    pblMixCondensate = true,
    pblCondMixScale = 0.35,

    // Deep convection triggers
    rhTrig = 0.75,
    rhMidMin = 0.25,
    omegaTrig = 0.3, // ascent defined as negative omega tail
    instabTrig = 3,
    qvTrig = 0.002,
    thetaeCoeff = 10,
    thetaeQvCap = 0.03,
    convPotentialGrowTau = 90 * 60,
    convPotentialDecayTau = 8 * 3600,
    convOrganizationGrowTau = 2 * 3600,
    convOrganizationDecayTau = 14 * 3600,
    convMinPotential = 0.15,
    convMinOrganization = 0.18,

    // PBL warm rain
    pblWarmRain = true,
    qcAuto0 = 7e-4,
    tauAuto = 4 * 3600,
    autoMaxFrac = 0.2,

    // Plume/detrainment
    entrainFrac = 0.2,
    detrainTopFrac = 0.7,
    convRainoutBase = 0.28,
    convRainoutOrganizationWeight = 0.32,
    convRainoutHumidityWeight = 0.2,
    buoyTrigK = 0.0,
    dThetaMaxConvPerStep = 2.5,

    // Large-scale vertical advection (omega-based)
    enableLargeScaleVerticalAdvection = true,
    verticalAdvectionCflMax = 0.4,
    verticalAdvectionSigmaTaperExp = 2.0,
    dThetaMaxVertAdvPerStep = 2.0,

    // Omega correction to match applied surface pressure tendency
    enableOmegaMassFix = true,
    omegaMassFixSigmaTaperExp = 2.0,
    orographicLiftScale = 1.0,
    orographicLeeSubsidenceScale = 0.35,
    orographicDecayFrac = 0.35,
    terrainSlopeRef = 0.003,
    terrainDirectionalBlend = 0.05,
    terrainLeeOmega0 = 0.15,
    terrainLeeOmega1 = 1.2,
    terrainLeeAscentDamp = 1.0,
    terrainLeeOmegaFloorBlend = 1.0,
    terrainDeliveryProtectExposure0 = 0.5,
    terrainDeliveryProtectExposure1 = 8.0,
    tropicalOrganizationBandDeg = 15,
    subtropicalSubsidenceLat0 = 15,
    subtropicalSubsidenceLat1 = 35,
    subtropicalSubsidenceTau = 12 * 3600,
    subtropicalSubsidenceMaxDryFrac = 0.2,
    subtropicalSubsidenceThetaStepK = 0.6,
    subtropicalSubsidenceTopSigma = 0.35,
    subtropicalSubsidenceBottomSigma = 0.85,
    subtropicalSubsidenceCrossHemiFloorFrac = 0.45,
    subtropicalSubsidenceWeakHemiBoost = 0.0,
    enableCirculationReboundContainment = true,
    circulationReboundContainmentScale = 1.35,
    circulationReboundOrganizationScale = 0.6,
    circulationReboundActivityScale = 0.35,
    circulationReboundSourceScale = 0.75,
    enableCarryInputDominanceOverride = true,
    carryInputSubtropicalSuppressionMin = 0.74243,
    carryInputOrganizedSupportMax = 0.22504,
    carryInputPotentialMax = 0.24341,
    carryInputDominanceMin = 0.93785,
    carryInputMinResidualMassKgM2 = 3.40503,
    carryInputClearFrac = 1.0,

    // Numerical/heating
    eps = 1e-12
  } = params;

  const { nx, ny, invDx, invDy, cosLat } = grid;
  const { N, nz, u, v, omega, theta, qv, qc, qi, qr, qs, T, pHalf, pMid, sigmaHalf, dpsDtApplied } = state;

  // Persistent organized-convection state used by both plume physics and microphysics.
  if (!state.convMask || state.convMask.length !== N) state.convMask = new Uint8Array(N);
  if (!state.convectivePotential || state.convectivePotential.length !== N) state.convectivePotential = new Float32Array(N);
  if (!state.convectiveOrganization || state.convectiveOrganization.length !== N) state.convectiveOrganization = new Float32Array(N);
  if (!state.convectiveMassFlux || state.convectiveMassFlux.length !== N) state.convectiveMassFlux = new Float32Array(N);
  if (!state.convectiveDetrainmentMass || state.convectiveDetrainmentMass.length !== N) state.convectiveDetrainmentMass = new Float32Array(N);
  if (!state.convectiveRainoutFraction || state.convectiveRainoutFraction.length !== N) state.convectiveRainoutFraction = new Float32Array(N);
  if (!state.convectiveAnvilSource || state.convectiveAnvilSource.length !== N) state.convectiveAnvilSource = new Float32Array(N);
  if (!state.convectiveHeatingProxy || state.convectiveHeatingProxy.length !== N) state.convectiveHeatingProxy = new Float32Array(N);
  if (!state.convectiveTopLevel || state.convectiveTopLevel.length !== N) state.convectiveTopLevel = new Float32Array(N);
  if (!state.lowLevelMoistureConvergence || state.lowLevelMoistureConvergence.length !== N) state.lowLevelMoistureConvergence = new Float32Array(N);
  if (!state.lowLevelOmegaEffective || state.lowLevelOmegaEffective.length !== N) state.lowLevelOmegaEffective = new Float32Array(N);
  if (!state.subtropicalSubsidenceDrying || state.subtropicalSubsidenceDrying.length !== N) state.subtropicalSubsidenceDrying = new Float32Array(N);
  if (!state.freshPotentialTargetDiag || state.freshPotentialTargetDiag.length !== N) state.freshPotentialTargetDiag = new Float32Array(N);
  if (!state.freshOrganizedSupportDiag || state.freshOrganizedSupportDiag.length !== N) state.freshOrganizedSupportDiag = new Float32Array(N);
  if (!state.freshSubtropicalSuppressionDiag || state.freshSubtropicalSuppressionDiag.length !== N) state.freshSubtropicalSuppressionDiag = new Float32Array(N);
  if (!state.freshSubtropicalBandDiag || state.freshSubtropicalBandDiag.length !== N) state.freshSubtropicalBandDiag = new Float32Array(N);
  if (!state.freshNeutralToSubsidingSupportDiag || state.freshNeutralToSubsidingSupportDiag.length !== N) state.freshNeutralToSubsidingSupportDiag = new Float32Array(N);
  if (!state.freshRhMidSupportDiag || state.freshRhMidSupportDiag.length !== N) state.freshRhMidSupportDiag = new Float32Array(N);
  if (!state.circulationReboundContainmentDiag || state.circulationReboundContainmentDiag.length !== N) state.circulationReboundContainmentDiag = new Float32Array(N);
  if (!state.circulationReboundActivitySuppressionDiag || state.circulationReboundActivitySuppressionDiag.length !== N) state.circulationReboundActivitySuppressionDiag = new Float32Array(N);
  if (!state.circulationReboundSourceSuppressionDiag || state.circulationReboundSourceSuppressionDiag.length !== N) state.circulationReboundSourceSuppressionDiag = new Float32Array(N);
  if (!state.subtropicalSourceDriverDiag || state.subtropicalSourceDriverDiag.length !== N) state.subtropicalSourceDriverDiag = new Float32Array(N);
  if (!state.subtropicalSourceDriverFloorDiag || state.subtropicalSourceDriverFloorDiag.length !== N) state.subtropicalSourceDriverFloorDiag = new Float32Array(N);
  if (!state.subtropicalLocalHemiSourceDiag || state.subtropicalLocalHemiSourceDiag.length !== N) state.subtropicalLocalHemiSourceDiag = new Float32Array(N);
  if (!state.subtropicalMeanTropicalSourceDiag || state.subtropicalMeanTropicalSourceDiag.length !== N) state.subtropicalMeanTropicalSourceDiag = new Float32Array(N);
  if (!state.subtropicalCrossHemiFloorShareDiag || state.subtropicalCrossHemiFloorShareDiag.length !== N) state.subtropicalCrossHemiFloorShareDiag = new Float32Array(N);
  if (!state.subtropicalWeakHemiFracDiag || state.subtropicalWeakHemiFracDiag.length !== N) state.subtropicalWeakHemiFracDiag = new Float32Array(N);
  if (!state._freshPotentialTarget || state._freshPotentialTarget.length !== N) state._freshPotentialTarget = new Float32Array(N);
  if (!state._freshOrganizedSupport || state._freshOrganizedSupport.length !== N) state._freshOrganizedSupport = new Float32Array(N);
  if (!state._freshSubtropicalSuppression || state._freshSubtropicalSuppression.length !== N) state._freshSubtropicalSuppression = new Float32Array(N);
  if (!state.resolvedAscentCloudBirthPotential || state.resolvedAscentCloudBirthPotential.length !== N) state.resolvedAscentCloudBirthPotential = new Float32Array(N);
  if (!state.upperCloudPath || state.upperCloudPath.length !== N) state.upperCloudPath = new Float32Array(N);
  if (!state.importedAnvilPersistenceMass || state.importedAnvilPersistenceMass.length !== N) state.importedAnvilPersistenceMass = new Float32Array(N);
  if (!state.carriedOverUpperCloudMass || state.carriedOverUpperCloudMass.length !== N) state.carriedOverUpperCloudMass = new Float32Array(N);
  if (!state.weakErosionCloudSurvivalMass || state.weakErosionCloudSurvivalMass.length !== N) state.weakErosionCloudSurvivalMass = new Float32Array(N);
  if (!state.verticalUpperCloudInputMass || state.verticalUpperCloudInputMass.length !== N) state.verticalUpperCloudInputMass = new Float32Array(N);
  if (!state.verticalUpperCloudResolvedBirthMass || state.verticalUpperCloudResolvedBirthMass.length !== N) state.verticalUpperCloudResolvedBirthMass = new Float32Array(N);
  if (!state.verticalUpperCloudConvectiveBirthMass || state.verticalUpperCloudConvectiveBirthMass.length !== N) state.verticalUpperCloudConvectiveBirthMass = new Float32Array(N);
  if (!state.verticalUpperCloudCarrySurvivingMass || state.verticalUpperCloudCarrySurvivingMass.length !== N) state.verticalUpperCloudCarrySurvivingMass = new Float32Array(N);
  if (!state.verticalUpperCloudAppliedErosionMass || state.verticalUpperCloudAppliedErosionMass.length !== N) state.verticalUpperCloudAppliedErosionMass = new Float32Array(N);
  if (!state.verticalUpperCloudHandedToMicrophysicsMass || state.verticalUpperCloudHandedToMicrophysicsMass.length !== N) state.verticalUpperCloudHandedToMicrophysicsMass = new Float32Array(N);
  if (!state.verticalUpperCloudResidualMass || state.verticalUpperCloudResidualMass.length !== N) state.verticalUpperCloudResidualMass = new Float32Array(N);
  if (!state.carryInputOverrideHitCount || state.carryInputOverrideHitCount.length !== N) state.carryInputOverrideHitCount = new Float32Array(N);
  if (!state.carryInputOverrideRemovedMass || state.carryInputOverrideRemovedMass.length !== N) state.carryInputOverrideRemovedMass = new Float32Array(N);
  if (!state.carryInputOverrideInputMass || state.carryInputOverrideInputMass.length !== N) state.carryInputOverrideInputMass = new Float32Array(N);
  if (!state.carryInputOverrideAccumHitCount || state.carryInputOverrideAccumHitCount.length !== N) state.carryInputOverrideAccumHitCount = new Float32Array(N);
  if (!state.carryInputOverrideAccumRemovedMass || state.carryInputOverrideAccumRemovedMass.length !== N) state.carryInputOverrideAccumRemovedMass = new Float32Array(N);
  if (!state.carryInputOverrideAccumInputMass || state.carryInputOverrideAccumInputMass.length !== N) state.carryInputOverrideAccumInputMass = new Float32Array(N);
  if (!state.resolvedAscentCloudBirthAccumMass || state.resolvedAscentCloudBirthAccumMass.length !== N) state.resolvedAscentCloudBirthAccumMass = new Float32Array(N);
  if (!state.convectiveDetrainmentCloudBirthAccumMass || state.convectiveDetrainmentCloudBirthAccumMass.length !== N) state.convectiveDetrainmentCloudBirthAccumMass = new Float32Array(N);
  if (!state.carryOverUpperCloudEnteringAccumMass || state.carryOverUpperCloudEnteringAccumMass.length !== N) state.carryOverUpperCloudEnteringAccumMass = new Float32Array(N);
  if (!state.carryOverUpperCloudSurvivingAccumMass || state.carryOverUpperCloudSurvivingAccumMass.length !== N) state.carryOverUpperCloudSurvivingAccumMass = new Float32Array(N);
  if (!state.resolvedAscentCloudBirthByBandMass || state.resolvedAscentCloudBirthByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.resolvedAscentCloudBirthByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.convectiveDetrainmentCloudBirthByBandMass || state.convectiveDetrainmentCloudBirthByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.convectiveDetrainmentCloudBirthByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.carryOverUpperCloudEnteringByBandMass || state.carryOverUpperCloudEnteringByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.carryOverUpperCloudEnteringByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.carryOverUpperCloudSurvivingByBandMass || state.carryOverUpperCloudSurvivingByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.carryOverUpperCloudSurvivingByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.prevUpperCloudBandMass || state.prevUpperCloudBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.prevUpperCloudBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.upperCloudResidenceTimeSeconds || state.upperCloudResidenceTimeSeconds.length !== N) state.upperCloudResidenceTimeSeconds = new Float32Array(N);
  if (!state.upperCloudTimeSinceLocalBirthSeconds || state.upperCloudTimeSinceLocalBirthSeconds.length !== N) state.upperCloudTimeSinceLocalBirthSeconds = new Float32Array(N);
  if (!state.upperCloudTimeSinceImportSeconds || state.upperCloudTimeSinceImportSeconds.length !== N) state.upperCloudTimeSinceImportSeconds = new Float32Array(N);
  if (!state.upperCloudFreshBornMass || state.upperCloudFreshBornMass.length !== N) state.upperCloudFreshBornMass = new Float32Array(N);
  if (!state.upperCloudRecentlyImportedMass || state.upperCloudRecentlyImportedMass.length !== N) state.upperCloudRecentlyImportedMass = new Float32Array(N);
  if (!state.upperCloudStaleMass || state.upperCloudStaleMass.length !== N) state.upperCloudStaleMass = new Float32Array(N);
  if (!state.upperCloudPassiveSurvivalMass || state.upperCloudPassiveSurvivalMass.length !== N) state.upperCloudPassiveSurvivalMass = new Float32Array(N);
  if (!state.upperCloudRegenerationMass || state.upperCloudRegenerationMass.length !== N) state.upperCloudRegenerationMass = new Float32Array(N);
  if (!state.upperCloudOscillatoryMass || state.upperCloudOscillatoryMass.length !== N) state.upperCloudOscillatoryMass = new Float32Array(N);
  if (!state.upperCloudPotentialErosionMass || state.upperCloudPotentialErosionMass.length !== N) state.upperCloudPotentialErosionMass = new Float32Array(N);
  if (!state.upperCloudAppliedErosionMass || state.upperCloudAppliedErosionMass.length !== N) state.upperCloudAppliedErosionMass = new Float32Array(N);
  if (!state.upperCloudBlockedErosionMass || state.upperCloudBlockedErosionMass.length !== N) state.upperCloudBlockedErosionMass = new Float32Array(N);
  if (!state.upperCloudBlockedByWeakSubsidenceMass || state.upperCloudBlockedByWeakSubsidenceMass.length !== N) state.upperCloudBlockedByWeakSubsidenceMass = new Float32Array(N);
  if (!state.upperCloudBlockedByWeakDescentVentMass || state.upperCloudBlockedByWeakDescentVentMass.length !== N) state.upperCloudBlockedByWeakDescentVentMass = new Float32Array(N);
  if (!state.upperCloudBlockedByLocalSupportMass || state.upperCloudBlockedByLocalSupportMass.length !== N) state.upperCloudBlockedByLocalSupportMass = new Float32Array(N);
  if (!state.upperCloudResidenceTimeMassWeightedSeconds || state.upperCloudResidenceTimeMassWeightedSeconds.length !== N) state.upperCloudResidenceTimeMassWeightedSeconds = new Float32Array(N);
  if (!state.upperCloudTimeSinceLocalBirthMassWeightedSeconds || state.upperCloudTimeSinceLocalBirthMassWeightedSeconds.length !== N) state.upperCloudTimeSinceLocalBirthMassWeightedSeconds = new Float32Array(N);
  if (!state.upperCloudTimeSinceImportMassWeightedSeconds || state.upperCloudTimeSinceImportMassWeightedSeconds.length !== N) state.upperCloudTimeSinceImportMassWeightedSeconds = new Float32Array(N);
  if (!state.upperCloudFreshBornAccumMass || state.upperCloudFreshBornAccumMass.length !== N) state.upperCloudFreshBornAccumMass = new Float32Array(N);
  if (!state.upperCloudRecentlyImportedAccumMass || state.upperCloudRecentlyImportedAccumMass.length !== N) state.upperCloudRecentlyImportedAccumMass = new Float32Array(N);
  if (!state.upperCloudStaleAccumMass || state.upperCloudStaleAccumMass.length !== N) state.upperCloudStaleAccumMass = new Float32Array(N);
  if (!state.upperCloudPassiveSurvivalAccumMass || state.upperCloudPassiveSurvivalAccumMass.length !== N) state.upperCloudPassiveSurvivalAccumMass = new Float32Array(N);
  if (!state.upperCloudRegenerationAccumMass || state.upperCloudRegenerationAccumMass.length !== N) state.upperCloudRegenerationAccumMass = new Float32Array(N);
  if (!state.upperCloudOscillatoryAccumMass || state.upperCloudOscillatoryAccumMass.length !== N) state.upperCloudOscillatoryAccumMass = new Float32Array(N);
  if (!state.upperCloudPotentialErosionAccumMass || state.upperCloudPotentialErosionAccumMass.length !== N) state.upperCloudPotentialErosionAccumMass = new Float32Array(N);
  if (!state.upperCloudAppliedErosionAccumMass || state.upperCloudAppliedErosionAccumMass.length !== N) state.upperCloudAppliedErosionAccumMass = new Float32Array(N);
  if (!state.upperCloudBlockedErosionAccumMass || state.upperCloudBlockedErosionAccumMass.length !== N) state.upperCloudBlockedErosionAccumMass = new Float32Array(N);
  if (!state.upperCloudBlockedByWeakSubsidenceAccumMass || state.upperCloudBlockedByWeakSubsidenceAccumMass.length !== N) state.upperCloudBlockedByWeakSubsidenceAccumMass = new Float32Array(N);
  if (!state.upperCloudBlockedByWeakDescentVentAccumMass || state.upperCloudBlockedByWeakDescentVentAccumMass.length !== N) state.upperCloudBlockedByWeakDescentVentAccumMass = new Float32Array(N);
  if (!state.upperCloudBlockedByLocalSupportAccumMass || state.upperCloudBlockedByLocalSupportAccumMass.length !== N) state.upperCloudBlockedByLocalSupportAccumMass = new Float32Array(N);
  if (!state.upperCloudPotentialErosionByBandMass || state.upperCloudPotentialErosionByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.upperCloudPotentialErosionByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.upperCloudAppliedErosionByBandMass || state.upperCloudAppliedErosionByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.upperCloudAppliedErosionByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.upperCloudBlockedErosionByBandMass || state.upperCloudBlockedErosionByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.upperCloudBlockedErosionByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  const convMask = state.convMask;
  const convectivePotential = state.convectivePotential;
  const convectiveOrganization = state.convectiveOrganization;
  const convectiveMassFlux = state.convectiveMassFlux;
  const convectiveDetrainmentMass = state.convectiveDetrainmentMass;
  const convectiveRainoutFraction = state.convectiveRainoutFraction;
  const convectiveAnvilSource = state.convectiveAnvilSource;
  const convectiveHeatingProxy = state.convectiveHeatingProxy;
  const convectiveTopLevel = state.convectiveTopLevel;
  const lowLevelMoistureConvergence = state.lowLevelMoistureConvergence;
  const lowLevelOmegaEffective = state.lowLevelOmegaEffective;
  const subtropicalSubsidenceDrying = state.subtropicalSubsidenceDrying;
  const freshPotentialTargetPublicDiag = state.freshPotentialTargetDiag;
  const freshOrganizedSupportPublicDiag = state.freshOrganizedSupportDiag;
  const freshSubtropicalSuppressionPublicDiag = state.freshSubtropicalSuppressionDiag;
  const freshSubtropicalBandPublicDiag = state.freshSubtropicalBandDiag;
  const freshNeutralToSubsidingSupportPublicDiag = state.freshNeutralToSubsidingSupportDiag;
  const freshRhMidSupportPublicDiag = state.freshRhMidSupportDiag;
  const circulationReboundContainmentDiag = state.circulationReboundContainmentDiag;
  const circulationReboundActivitySuppressionDiag = state.circulationReboundActivitySuppressionDiag;
  const circulationReboundSourceSuppressionDiag = state.circulationReboundSourceSuppressionDiag;
  const subtropicalSourceDriverDiag = state.subtropicalSourceDriverDiag;
  const subtropicalSourceDriverFloorDiag = state.subtropicalSourceDriverFloorDiag;
  const subtropicalLocalHemiSourceDiag = state.subtropicalLocalHemiSourceDiag;
  const subtropicalMeanTropicalSourceDiag = state.subtropicalMeanTropicalSourceDiag;
  const subtropicalCrossHemiFloorShareDiag = state.subtropicalCrossHemiFloorShareDiag;
  const subtropicalWeakHemiFracDiag = state.subtropicalWeakHemiFracDiag;
  const freshPotentialTargetDiag = state._freshPotentialTarget;
  const freshOrganizedSupportDiag = state._freshOrganizedSupport;
  const freshSubtropicalSuppressionDiag = state._freshSubtropicalSuppression;
  const resolvedAscentCloudBirthPotential = state.resolvedAscentCloudBirthPotential;
  const upperCloudPath = state.upperCloudPath;
  const importedAnvilPersistenceMass = state.importedAnvilPersistenceMass;
  const carriedOverUpperCloudMass = state.carriedOverUpperCloudMass;
  const weakErosionCloudSurvivalMass = state.weakErosionCloudSurvivalMass;
  const verticalUpperCloudInputMass = state.verticalUpperCloudInputMass;
  const verticalUpperCloudResolvedBirthMass = state.verticalUpperCloudResolvedBirthMass;
  const verticalUpperCloudConvectiveBirthMass = state.verticalUpperCloudConvectiveBirthMass;
  const verticalUpperCloudCarrySurvivingMass = state.verticalUpperCloudCarrySurvivingMass;
  const verticalUpperCloudAppliedErosionMass = state.verticalUpperCloudAppliedErosionMass;
  const verticalUpperCloudHandedToMicrophysicsMass = state.verticalUpperCloudHandedToMicrophysicsMass;
  const verticalUpperCloudResidualMass = state.verticalUpperCloudResidualMass;
  const carryInputOverrideHitCount = state.carryInputOverrideHitCount;
  const carryInputOverrideRemovedMass = state.carryInputOverrideRemovedMass;
  const carryInputOverrideInputMass = state.carryInputOverrideInputMass;
  const carryInputOverrideAccumHitCount = state.carryInputOverrideAccumHitCount;
  const carryInputOverrideAccumRemovedMass = state.carryInputOverrideAccumRemovedMass;
  const carryInputOverrideAccumInputMass = state.carryInputOverrideAccumInputMass;
  const resolvedAscentCloudBirthAccumMass = state.resolvedAscentCloudBirthAccumMass;
  const convectiveDetrainmentCloudBirthAccumMass = state.convectiveDetrainmentCloudBirthAccumMass;
  const carryOverUpperCloudEnteringAccumMass = state.carryOverUpperCloudEnteringAccumMass;
  const carryOverUpperCloudSurvivingAccumMass = state.carryOverUpperCloudSurvivingAccumMass;
  const resolvedAscentCloudBirthByBandMass = state.resolvedAscentCloudBirthByBandMass;
  const convectiveDetrainmentCloudBirthByBandMass = state.convectiveDetrainmentCloudBirthByBandMass;
  const carryOverUpperCloudEnteringByBandMass = state.carryOverUpperCloudEnteringByBandMass;
  const carryOverUpperCloudSurvivingByBandMass = state.carryOverUpperCloudSurvivingByBandMass;
  const prevUpperCloudBandMass = state.prevUpperCloudBandMass;
  const upperCloudResidenceTimeSeconds = state.upperCloudResidenceTimeSeconds;
  const upperCloudTimeSinceLocalBirthSeconds = state.upperCloudTimeSinceLocalBirthSeconds;
  const upperCloudTimeSinceImportSeconds = state.upperCloudTimeSinceImportSeconds;
  const upperCloudFreshBornMass = state.upperCloudFreshBornMass;
  const upperCloudRecentlyImportedMass = state.upperCloudRecentlyImportedMass;
  const upperCloudStaleMass = state.upperCloudStaleMass;
  const upperCloudPassiveSurvivalMass = state.upperCloudPassiveSurvivalMass;
  const upperCloudRegenerationMass = state.upperCloudRegenerationMass;
  const upperCloudOscillatoryMass = state.upperCloudOscillatoryMass;
  const upperCloudPotentialErosionMass = state.upperCloudPotentialErosionMass;
  const upperCloudAppliedErosionMass = state.upperCloudAppliedErosionMass;
  const upperCloudBlockedErosionMass = state.upperCloudBlockedErosionMass;
  const upperCloudBlockedByWeakSubsidenceMass = state.upperCloudBlockedByWeakSubsidenceMass;
  const upperCloudBlockedByWeakDescentVentMass = state.upperCloudBlockedByWeakDescentVentMass;
  const upperCloudBlockedByLocalSupportMass = state.upperCloudBlockedByLocalSupportMass;
  const upperCloudResidenceTimeMassWeightedSeconds = state.upperCloudResidenceTimeMassWeightedSeconds;
  const upperCloudTimeSinceLocalBirthMassWeightedSeconds = state.upperCloudTimeSinceLocalBirthMassWeightedSeconds;
  const upperCloudTimeSinceImportMassWeightedSeconds = state.upperCloudTimeSinceImportMassWeightedSeconds;
  const upperCloudFreshBornAccumMass = state.upperCloudFreshBornAccumMass;
  const upperCloudRecentlyImportedAccumMass = state.upperCloudRecentlyImportedAccumMass;
  const upperCloudStaleAccumMass = state.upperCloudStaleAccumMass;
  const upperCloudPassiveSurvivalAccumMass = state.upperCloudPassiveSurvivalAccumMass;
  const upperCloudRegenerationAccumMass = state.upperCloudRegenerationAccumMass;
  const upperCloudOscillatoryAccumMass = state.upperCloudOscillatoryAccumMass;
  const upperCloudPotentialErosionAccumMass = state.upperCloudPotentialErosionAccumMass;
  const upperCloudAppliedErosionAccumMass = state.upperCloudAppliedErosionAccumMass;
  const upperCloudBlockedErosionAccumMass = state.upperCloudBlockedErosionAccumMass;
  const upperCloudBlockedByWeakSubsidenceAccumMass = state.upperCloudBlockedByWeakSubsidenceAccumMass;
  const upperCloudBlockedByWeakDescentVentAccumMass = state.upperCloudBlockedByWeakDescentVentAccumMass;
  const upperCloudBlockedByLocalSupportAccumMass = state.upperCloudBlockedByLocalSupportAccumMass;
  const upperCloudPotentialErosionByBandMass = state.upperCloudPotentialErosionByBandMass;
  const upperCloudAppliedErosionByBandMass = state.upperCloudAppliedErosionByBandMass;
  const upperCloudBlockedErosionByBandMass = state.upperCloudBlockedErosionByBandMass;
  convMask.fill(0);
  convectiveMassFlux.fill(0);
  convectiveDetrainmentMass.fill(0);
  convectiveRainoutFraction.fill(0);
  convectiveAnvilSource.fill(0);
  convectiveHeatingProxy.fill(0);
  convectiveTopLevel.fill(nz - 1);
  lowLevelMoistureConvergence.fill(0);
  lowLevelOmegaEffective.fill(0);
  subtropicalSubsidenceDrying.fill(0);
  freshPotentialTargetPublicDiag.fill(0);
  freshOrganizedSupportPublicDiag.fill(0);
  freshSubtropicalSuppressionPublicDiag.fill(0);
  freshSubtropicalBandPublicDiag.fill(0);
  freshNeutralToSubsidingSupportPublicDiag.fill(0);
  freshRhMidSupportPublicDiag.fill(0);
  circulationReboundContainmentDiag.fill(0);
  circulationReboundActivitySuppressionDiag.fill(0);
  circulationReboundSourceSuppressionDiag.fill(0);
  subtropicalSourceDriverDiag.fill(0);
  subtropicalSourceDriverFloorDiag.fill(0);
  subtropicalLocalHemiSourceDiag.fill(0);
  subtropicalMeanTropicalSourceDiag.fill(0);
  subtropicalCrossHemiFloorShareDiag.fill(0);
  subtropicalWeakHemiFracDiag.fill(0);
  freshPotentialTargetDiag.fill(0);
  freshOrganizedSupportDiag.fill(0);
  freshSubtropicalSuppressionDiag.fill(0);
  resolvedAscentCloudBirthPotential.fill(0);
  upperCloudPath.fill(0);
  importedAnvilPersistenceMass.fill(0);
  carriedOverUpperCloudMass.fill(0);
  weakErosionCloudSurvivalMass.fill(0);
  verticalUpperCloudInputMass.fill(0);
  verticalUpperCloudResolvedBirthMass.fill(0);
  verticalUpperCloudConvectiveBirthMass.fill(0);
  verticalUpperCloudCarrySurvivingMass.fill(0);
  verticalUpperCloudAppliedErosionMass.fill(0);
  verticalUpperCloudHandedToMicrophysicsMass.fill(0);
  verticalUpperCloudResidualMass.fill(0);
  carryInputOverrideHitCount.fill(0);
  carryInputOverrideRemovedMass.fill(0);
  carryInputOverrideInputMass.fill(0);
  upperCloudFreshBornMass.fill(0);
  upperCloudRecentlyImportedMass.fill(0);
  upperCloudStaleMass.fill(0);
  upperCloudPassiveSurvivalMass.fill(0);
  upperCloudRegenerationMass.fill(0);
  upperCloudOscillatoryMass.fill(0);
  upperCloudPotentialErosionMass.fill(0);
  upperCloudAppliedErosionMass.fill(0);
  upperCloudBlockedErosionMass.fill(0);
  upperCloudBlockedByWeakSubsidenceMass.fill(0);
  upperCloudBlockedByWeakDescentVentMass.fill(0);
  upperCloudBlockedByLocalSupportMass.fill(0);
  if (!traceEnabled) {
    prevUpperCloudBandMass.fill(0);
  }

  if (!state.terrainFlowForcing || state.terrainFlowForcing.length !== N) {
    state.terrainFlowForcing = new Float32Array(N);
  }
  if (!state.terrainSlopeFactor || state.terrainSlopeFactor.length !== N) {
    state.terrainSlopeFactor = new Float32Array(N);
  }
  if (!state.terrainOmegaSurface || state.terrainOmegaSurface.length !== N) {
    state.terrainOmegaSurface = new Float32Array(N);
  }
  if (!state.orographicDeliveryAccum || state.orographicDeliveryAccum.length !== N) {
    state.orographicDeliveryAccum = new Float32Array(N);
  }
  if (!state.orographicDeliveryExposureAccum || state.orographicDeliveryExposureAccum.length !== N) {
    state.orographicDeliveryExposureAccum = new Float32Array(N);
  }
  if (!state.orographicDeliveryLastStep || state.orographicDeliveryLastStep.length !== N) {
    state.orographicDeliveryLastStep = new Float32Array(N);
  }
  if (!state.orographicDeliveryActiveSteps || state.orographicDeliveryActiveSteps.length !== N) {
    state.orographicDeliveryActiveSteps = new Uint32Array(N);
  }
  if (!state.terrainLeeNoDelivery || state.terrainLeeNoDelivery.length !== N) {
    state.terrainLeeNoDelivery = new Float32Array(N);
  }
  const terrainFlowForcingDiag = state.terrainFlowForcing;
  const terrainSlopeFactorDiag = state.terrainSlopeFactor;
  const terrainOmegaSurfaceDiag = state.terrainOmegaSurface;
  const terrainLeeNoDeliveryDiag = state.terrainLeeNoDelivery;
  const orographicDeliveryAccum = state.orographicDeliveryAccum;
  const orographicDeliveryExposureAccum = state.orographicDeliveryExposureAccum;
  const orographicDeliveryLastStep = state.orographicDeliveryLastStep;
  const orographicDeliveryActiveSteps = state.orographicDeliveryActiveSteps;
  terrainFlowForcingDiag.fill(0);
  terrainSlopeFactorDiag.fill(0);
  terrainOmegaSurfaceDiag.fill(0);
  terrainLeeNoDeliveryDiag.fill(0);
  orographicDeliveryLastStep.fill(0);

  let convectiveColumnsCount = 0;
  let totalCondensed = 0;
  let totalDetrainedQc = 0;
  let totalRainProduced = 0;
  let nOmegaPos = 0;
  let convTopLevMean = null;
  let convCondMassMean = 0;
  const debugConservation = params.debugConservation;
  const sampleCols = debugConservation ? 8 : 0;
  if (sampleCols > 0 && !state._waterSample) state._waterSample = new Float32Array(sampleCols);
  const waterBefore = sampleCols > 0 ? state._waterSample : null;
  if (waterBefore) {
    for (let s = 0; s < sampleCols; s++) {
      const k = Math.min(N - 1, Math.floor((N / sampleCols) * s));
      let w = 0;
      for (let lev = 0; lev < nz; lev++) {
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const idx = lev * N + k;
        w += (qv[idx] + qc[idx] + qi[idx] + qr[idx]) * (dp / g);
      }
      waterBefore[s] = w;
    }
  }

  for (let k = 0; k < N; k += 1) {
    verticalUpperCloudInputMass[k] = sumUpperCloudMassAtCell(state, pHalf, sigmaHalf, nz, k);
  }

  // Omega diagnostic at interfaces
  for (let idx = 0; idx < N; idx++) omega[idx] = 0;
  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    const omegaBase = lev * N;
    const omegaNext = (lev + 1) * N;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const cosC = cosLat[j];
      const cosN = cosLat[jN];
      const cosS = cosLat[jS];
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const kE = row + iE;
        const kW = row + iW;
        const kN = rowN + i;
        const kS = rowS + i;
        const du_dx = (u[base + kE] - u[base + kW]) * 0.5 * invDxRow;
        const dvcos_dy = (v[base + kN] * cosN - v[base + kS] * cosS) * 0.5 * invDyRow;
        const div = du_dx + dvcos_dy / cosC;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        omega[omegaNext + k] = omega[omegaBase + k] - div * dp;
      }
    }
  }

  const levSurface = nz - 1;
  const surfaceBase = levSurface * N;
  for (let j = 0; j < ny; j++) {
    const row = j * nx;
    const jN = Math.max(0, j - 1);
    const jS = Math.min(ny - 1, j + 1);
    const rowN = jN * nx;
    const rowS = jS * nx;
    const invDxRow = invDx[j];
    const invDyRow = invDy[j];
    const cosC = cosLat[j];
    const cosN = cosLat[jN];
    const cosS = cosLat[jS];
    for (let i = 0; i < nx; i++) {
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const k = row + i;
      const kE = row + iE;
      const kW = row + iW;
      const kN = rowN + i;
      const kS = rowS + i;
      const du_dx = (u[surfaceBase + kE] - u[surfaceBase + kW]) * 0.5 * invDxRow;
      const dvcos_dy = (v[surfaceBase + kN] * cosN - v[surfaceBase + kS] * cosS) * 0.5 * invDyRow;
      const div = du_dx + dvcos_dy / cosC;
      lowLevelMoistureConvergence[k] = Math.max(0, -div);
    }
  }

  const elevField = geo?.elev && geo.elev.length === N ? geo.elev : null;
  if (elevField && orographicLiftScale !== 0) {
    const levS = nz - 1;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const slopeXLocal = (elevField[row + iE] - elevField[row + iW]) * 0.5 * invDxRow;
        const slopeYLocal = (elevField[rowN + i] - elevField[rowS + i]) * 0.5 * invDyRow;
        const idxS = levS * N + k;
        const directionalBlend = clamp(terrainDirectionalBlend, 0, 1);
        let slopeMag = Math.hypot(slopeXLocal, slopeYLocal);
        let terrainNormalFlow = u[idxS] * slopeXLocal + v[idxS] * slopeYLocal;
        if (directionalBlend > 0) {
          const iE2 = (i + 2) % nx;
          const iW2 = (i - 2 + nx) % nx;
          const jN2 = Math.max(0, j - 2);
          const jS2 = Math.min(ny - 1, j + 2);
          const rowN2 = jN2 * nx;
          const rowS2 = jS2 * nx;
          const slopeXBroad = (elevField[row + iE2] - elevField[row + iW2]) * 0.25 * invDxRow;
          const slopeYBroad = (elevField[rowN2 + i] - elevField[rowS2 + i]) * 0.25 * invDyRow;
          const terrainNormalFlowBroad = u[idxS] * slopeXBroad + v[idxS] * slopeYBroad;
          terrainNormalFlow += (terrainNormalFlowBroad - terrainNormalFlow) * directionalBlend;
          const slopeMagBroad = Math.hypot(slopeXBroad, slopeYBroad);
          slopeMag += (slopeMagBroad - slopeMag) * directionalBlend;
        }
        const slopeFactor = clamp(slopeMag / Math.max(1e-6, terrainSlopeRef), 0, 3);
        const nearSurfaceT = Math.max(180, T[idxS]);
        const rho = Math.max(0.2, pMid[idxS] / Math.max(1e-6, Rd * nearSurfaceT));
        const leeScale = clamp(orographicLeeSubsidenceScale, 0, 1);
        const terrainFlowForcing = terrainNormalFlow >= 0
          ? terrainNormalFlow
          : terrainNormalFlow * leeScale;
        const wTerrain = terrainFlowForcing * slopeFactor;
        const omegaTerrain = -rho * g * wTerrain * orographicLiftScale;
        terrainFlowForcingDiag[k] = terrainFlowForcing;
        terrainSlopeFactorDiag[k] = slopeFactor;
        terrainOmegaSurfaceDiag[k] = omegaTerrain;
        for (let lev = 1; lev <= nz; lev++) {
          const decay = Math.exp(-Math.max(0, levS - (lev - 1)) * orographicDecayFrac);
          omega[lev * N + k] += omegaTerrain * decay;
        }
      }
    }
  }

  for (let k = 0; k < N; k++) {
    const terrainLeeBase = smoothstep(
      terrainLeeOmega0,
      terrainLeeOmega1,
      Number.isFinite(terrainOmegaSurfaceDiag[k]) ? terrainOmegaSurfaceDiag[k] : 0
    );
    const deliveryProtect = smoothstep(
      terrainDeliveryProtectExposure0,
      terrainDeliveryProtectExposure1,
      Number.isFinite(orographicDeliveryExposureAccum[k]) ? orographicDeliveryExposureAccum[k] : 0
    );
    terrainLeeNoDeliveryDiag[k] = clamp(terrainLeeBase * (1 - deliveryProtect), 0, 1);
  }

  if (
    enableOmegaMassFix &&
    sigmaHalf &&
    sigmaHalf.length >= nz + 1 &&
    dpsDtApplied &&
    dpsDtApplied.length === N
  ) {
    for (let k = 0; k < N; k++) {
      const omegaSurf = omega[nz * N + k];
      const target = dpsDtApplied[k];
      if (!Number.isFinite(omegaSurf) || !Number.isFinite(target)) continue;
      const delta = target - omegaSurf;
      if (delta === 0) continue;
      const taperExp = Math.max(0, omegaMassFixSigmaTaperExp);
      for (let lev = 0; lev <= nz; lev++) {
        const sigma = clamp01(sigmaHalf[lev]);
        const weight = taperExp > 0 ? Math.pow(sigma, taperExp) : sigma;
        omega[lev * N + k] += delta * weight;
      }
    }
  }

  if (enableLargeScaleVerticalAdvection && dt > 0) {
    const cflMax = clamp(verticalAdvectionCflMax, 0, 1);
    if (cflMax > 0) {
      if (!state._vertAdvQv || state._vertAdvQv.length !== qv.length) {
        state._vertAdvQv = new Float32Array(qv.length);
      }
      if (!state._vertAdvTheta || state._vertAdvTheta.length !== theta.length) {
        state._vertAdvTheta = new Float32Array(theta.length);
      }
      const qvNext = state._vertAdvQv;
      const thetaNext = state._vertAdvTheta;
      const taperExp = Math.max(0, verticalAdvectionSigmaTaperExp);
      const levS = nz - 1;
      const lowLevelStart = Math.max(0, nz - 4);
      for (let k = 0; k < N; k++) {
        let columnDelivery = 0;
        let columnExposure = 0;
        const terrainFlowForcing = terrainFlowForcingDiag[k];
        for (let lev = 0; lev < nz; lev++) {
          const idx = lev * N + k;
          let qvUpdated = qv[idx];
          let thetaUpdated = theta[idx];
          const omegaTop = omega[lev * N + k];
          const omegaBot = omega[(lev + 1) * N + k];
          const omegaMidRaw = 0.5 * (omegaTop + omegaBot);
          const sigmaMid = sigmaHalf && sigmaHalf.length > lev + 1
            ? clamp01(0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]))
            : 1;
          const transportScale = taperExp > 0 ? Math.pow(sigmaMid, taperExp) : 1;
          const leeNoDelivery = lev >= lowLevelStart ? terrainLeeNoDeliveryDiag[k] : 0;
          const leeOmegaFloorBlend = leeNoDelivery * clamp(terrainLeeOmegaFloorBlend, 0, 1);
          const terrainOmegaMid = lev >= lowLevelStart
            ? Math.max(0, terrainOmegaSurfaceDiag[k]) * Math.exp(-Math.max(0, levS - lev) * orographicDecayFrac)
            : 0;
          let omegaMidEffective = omegaMidRaw;
          if (leeOmegaFloorBlend > 0 && terrainOmegaMid > omegaMidEffective) {
            omegaMidEffective += (terrainOmegaMid - omegaMidEffective) * leeOmegaFloorBlend;
          }
          const ascentDamp = 1 - leeNoDelivery * clamp(terrainLeeAscentDamp, 0, 1);
          const omegaMid = omegaMidEffective < 0 ? omegaMidEffective * ascentDamp : omegaMidEffective;

          if (omegaMid < 0 && lev < nz - 1) {
            const idxBelow = (lev + 1) * N + k;
            const dpNeighbor = pMid[idxBelow] - pMid[idx];
            if (dpNeighbor > 0) {
              const rawFrac = ((-omegaMid) * dt * transportScale) / dpNeighbor;
              const frac = clamp(rawFrac, 0, cflMax);
              if (rawFrac > cflMax) {
                const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
                const excessMass = dpLev > 0 ? (dpLev / g) * Math.max(0, rawFrac - cflMax) : 0;
                state.numericalVerticalCflClampCount[k] += 1;
                state.numericalVerticalCflClampMass[k] += excessMass;
                recordBandValue(
                  state.numericalVerticalCflClampByBandMass,
                  findInstrumentationLevelBandIndex(sigmaMid),
                  k,
                  N,
                  excessMass
                );
              }
              const qvDelta = frac * (qv[idxBelow] - qv[idx]);
              qvUpdated += qvDelta;
              thetaUpdated += frac * (theta[idxBelow] - theta[idx]);
              if (traceEnabled && qvDelta > 0 && sigmaMid <= 0.55) {
                const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
                if (dpLev > 0) {
                  const cloudBirthMass = qvDelta * (dpLev / g);
                  resolvedAscentCloudBirthPotential[k] += cloudBirthMass;
                  verticalUpperCloudResolvedBirthMass[k] += cloudBirthMass;
                  resolvedAscentCloudBirthAccumMass[k] += cloudBirthMass;
                  const bandIndex = findCloudBirthLevelBandIndex(sigmaMid);
                  resolvedAscentCloudBirthByBandMass[cloudBirthBandOffset(bandIndex, k, N)] += cloudBirthMass;
                }
              }
              if (terrainFlowForcing > 0 && lev >= lowLevelStart) {
                columnExposure += (-omegaMid) * dt;
                if (qvDelta > 0) {
                  const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
                  if (dpLev > 0) {
                    columnDelivery += qvDelta * (dpLev / g);
                  }
                }
              }
            }
          } else if (omegaMid > 0 && lev > 0) {
            const idxAbove = (lev - 1) * N + k;
            const dpNeighbor = pMid[idx] - pMid[idxAbove];
            if (dpNeighbor > 0) {
              const rawFrac = (omegaMid * dt * transportScale) / dpNeighbor;
              const frac = clamp(rawFrac, 0, cflMax);
              if (rawFrac > cflMax) {
                const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
                const excessMass = dpLev > 0 ? (dpLev / g) * Math.max(0, rawFrac - cflMax) : 0;
                state.numericalVerticalCflClampCount[k] += 1;
                state.numericalVerticalCflClampMass[k] += excessMass;
                recordBandValue(
                  state.numericalVerticalCflClampByBandMass,
                  findInstrumentationLevelBandIndex(sigmaMid),
                  k,
                  N,
                  excessMass
                );
              }
              qvUpdated += frac * (qv[idxAbove] - qv[idx]);
              thetaUpdated += frac * (theta[idxAbove] - theta[idx]);
            }
          }

          if (qvUpdated < 0) {
            const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
            const clippedMass = dpLev > 0 ? (-qvUpdated) * (dpLev / g) : 0;
            state.numericalNegativeClipCount[k] += 1;
            state.numericalNegativeClipMass[k] += clippedMass;
            recordBandValue(
              state.numericalNegativeClipByBandMass,
              findInstrumentationLevelBandIndex(sigmaMid),
              k,
              N,
              clippedMass
            );
          }
          qvNext[idx] = Math.max(0, qvUpdated);
          if (dThetaMaxVertAdvPerStep > 0) {
            const dTheta = thetaUpdated - theta[idx];
            thetaNext[idx] =
              theta[idx] + clamp(dTheta, -dThetaMaxVertAdvPerStep, dThetaMaxVertAdvPerStep);
          } else {
            thetaNext[idx] = thetaUpdated;
          }
        }
        orographicDeliveryLastStep[k] = columnDelivery;
        if (terrainFlowForcing > 0 && columnExposure > 0) {
          orographicDeliveryExposureAccum[k] += columnExposure;
          if (columnDelivery > 0) {
            orographicDeliveryAccum[k] += columnDelivery;
            orographicDeliveryActiveSteps[k] += 1;
          }
        }
      }
      qv.set(qvNext);
      theta.set(thetaNext);
      for (let m = 0; m < qv.length; m++) {
        if (qv[m] < 0) {
          const cell = m % N;
          const lev = Math.floor(m / N);
          const dpLev = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
          const clippedMass = dpLev > 0 ? (-qv[m]) * (dpLev / g) : 0;
          state.numericalNegativeClipCount[cell] += 1;
          state.numericalNegativeClipMass[cell] += clippedMass;
          recordBandValue(
            state.numericalNegativeClipByBandMass,
            findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, nz)),
            cell,
            N,
            clippedMass
          );
          qv[m] = 0;
        }
      }
    }
  }

  // Always-on PBL mixing (near-surface stability-dependent, depth-aware)
  if (enableMixing) {
    if (nz >= 2) {
      if (!state._pblTopIndex) state._pblTopIndex = new Uint16Array(N);
      const pblTopIndex = state._pblTopIndex;
      for (let k = 0; k < N; k++) {
        const pSurf = pHalf[nz * N + k];
        const pTop = pHalf[k]; // interface at model top
        const pTopPbl = pSurf - pblDepthFrac * (pSurf - pTop);
        let levTopPbl = nz - 1;
        for (let lev = nz - 1; lev >= 0; lev--) {
          if (pMid[lev * N + k] < pTopPbl) {
            levTopPbl = Math.min(nz - 1, lev + 1);
            break;
          }
        }
        pblTopIndex[k] = levTopPbl;
        if (levTopPbl >= nz - 1) continue; // only surface in PBL

        for (let lev = nz - 1; lev > levTopPbl; lev--) {
          const levBelow = lev;
          const levAbove = lev - 1;
          const idxB = levBelow * N + k;
          const idxA = levAbove * N + k;
          const dpB = pHalf[(levBelow + 1) * N + k] - pHalf[levBelow * N + k];
          const dpA = pHalf[levBelow * N + k] - pHalf[levAbove * N + k];
          const stable = theta[idxA] > theta[idxB];
          const tau = stable ? tauPblStable : tauPblUnstable;
          const mixFracBase = clamp(dt / Math.max(tau, eps), 0, maxMixFracPbl);
          const h = (nz - 1 - lev) / Math.max(1, nz - 1 - levTopPbl); // 0 at surface, 1 near PBL top
          let mixFrac = mixFracBase * (1 - pblTaper * h);
          mixFrac = clamp(mixFrac, 0, maxMixFracPbl);

          const denom = Math.max(1e-6, dpA + dpB);
          const thetaMean = (theta[idxA] * dpA + theta[idxB] * dpB) / denom;
          theta[idxA] += mixFrac * (thetaMean - theta[idxA]);
          theta[idxB] += mixFrac * (thetaMean - theta[idxB]);

          const qvMean = (qv[idxA] * dpA + qv[idxB] * dpB) / denom;
          qv[idxA] += mixFrac * (qvMean - qv[idxA]);
          qv[idxB] += mixFrac * (qvMean - qv[idxB]);

          if (pblMixCondensate) {
            const mixFracC = mixFrac * pblCondMixScale;
            const qcMean = (qc[idxA] * dpA + qc[idxB] * dpB) / denom;
            qc[idxA] += mixFracC * (qcMean - qc[idxA]);
            qc[idxB] += mixFracC * (qcMean - qc[idxB]);

            const qiMean = (qi[idxA] * dpA + qi[idxB] * dpB) / denom;
            qi[idxA] += mixFracC * (qiMean - qi[idxA]);
            qi[idxB] += mixFracC * (qiMean - qi[idxB]);

            const qrMean = (qr[idxA] * dpA + qr[idxB] * dpB) / denom;
            qr[idxA] += mixFracC * (qrMean - qr[idxA]);
            qr[idxB] += mixFracC * (qrMean - qr[idxB]);
          }
        }
      }
      // Warm-rain autoconversion in PBL layers
      if (pblWarmRain) {
        const fracAuto = clamp(dt / Math.max(tauAuto, eps), 0, autoMaxFrac);
        for (let k = 0; k < N; k++) {
          const levTopPbl = clamp(pblTopIndex ? pblTopIndex[k] : nz - 1, 0, nz - 1);
          if (levTopPbl >= nz) continue;
          for (let lev = levTopPbl; lev < nz; lev++) {
            const idx = lev * N + k;
            if (qc[idx] > qcAuto0) {
              const dq = fracAuto * (qc[idx] - qcAuto0);
              qc[idx] -= dq;
              qr[idx] += dq;
              state.pblAutoConvertedTotal = (state.pblAutoConvertedTotal || 0) + dq;
            }
          }
        }
      }
      // clamp only PBL-mixed layers
      for (let k = 0; k < N; k++) {
        const levTopPbl = clamp(pblTopIndex ? pblTopIndex[k] : nz - 1, 0, nz - 1);
        for (let lev = levTopPbl; lev < nz; lev++) {
          const idx = lev * N + k;
          const bandIndex = findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, nz));
          const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
          const clipMass = dpLev > 0
            ? ((-Math.min(0, qv[idx])) + (-Math.min(0, qc[idx])) + (-Math.min(0, qi[idx])) + (-Math.min(0, qr[idx]))) * (dpLev / g)
            : 0;
          const cloudClipMass = dpLev > 0
            ? ((-Math.min(0, qc[idx])) + (-Math.min(0, qi[idx])) + (-Math.min(0, qr[idx]))) * (dpLev / g)
            : 0;
          const clipCount = (qv[idx] < 0) + (qc[idx] < 0) + (qi[idx] < 0) + (qr[idx] < 0);
          const cloudClipCount = (qc[idx] < 0) + (qi[idx] < 0) + (qr[idx] < 0);
          if (clipCount > 0) {
            state.numericalNegativeClipCount[k] += clipCount;
            state.numericalNegativeClipMass[k] += clipMass;
            accumulateBandValue(state.numericalNegativeClipByBandMass, bandIndex, k, N, clipMass);
          }
          if (cloudClipCount > 0) {
            state.numericalCloudLimiterCount[k] += cloudClipCount;
            state.numericalCloudLimiterMass[k] += cloudClipMass;
            accumulateBandValue(state.numericalCloudLimiterByBandMass, bandIndex, k, N, cloudClipMass);
          }
          qv[idx] = Math.max(0, qv[idx]);
          qc[idx] = Math.max(0, qc[idx]);
          qi[idx] = Math.max(0, qi[idx]);
          qr[idx] = Math.max(0, qr[idx]);
        }
      }
    }
  }

  // Deep convection with entrainment/detrainment
  if (enableConvection) {
    if (!state._omegaPosScratch) state._omegaPosScratch = new Float32Array(N);
    if (!state._instabScratch) state._instabScratch = new Float32Array(N);
    if (!state._rowConvectiveSource || state._rowConvectiveSource.length !== ny) {
      state._rowConvectiveSource = new Float32Array(ny);
    }
    const omegaPos = state._omegaPosScratch;
    const instabArr = state._instabScratch;
    const rowConvectiveSource = state._rowConvectiveSource;
    rowConvectiveSource.fill(0);
    nOmegaPos = 0;
    const omegaThreshDynamic = Math.max(omegaTrig, state.vertMetrics?.omegaPosP90 || 0);
    const muMax = clamp01(mu0);
    const detrainTop = clamp01(detrainTopFrac);
    const baseMu = Number.isFinite(tauConv) && tauConv > 0
      ? clamp(dt / Math.max(tauConv, eps), 0, muMax)
      : muMax;
    const latDeg = grid.latDeg || null;
    let convTopLevSum = 0;
    let convPlumeCount = 0;
    let convCondMassSum = 0;
    let convPotentialWeightedSum = 0;
    let convOrganizationWeightedSum = 0;
    let convMassFluxWeightedSum = 0;
    let lowLevelConvergenceWeightedSum = 0;
    let totalWeightAll = 0;
    for (let j = 0; j < ny; j++) {
      totalWeightAll += cosLat[j] * nx;
    }

    const depositHydrometeor = (field, k, lev, condMassLev, latentHeat = Lv) => {
      if (condMassLev <= 0) return 0;
      const idx = lev * N + k;
      const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      if (dpLev <= 0) return 0;
      const massLev = dpLev / g;
      let dq = condMassLev / massLev;
      const pLev = Math.max(100, pMid[idx]);
      const PiLev = Math.pow(pLev / P0, KAPPA);
      const dTheta = (latentHeat / Cp * dq) / PiLev;
      if (dThetaMaxConvPerStep > 0 && dTheta > dThetaMaxConvPerStep) {
        const scale = dThetaMaxConvPerStep / dTheta;
        dq *= scale;
      }
      field[idx] += dq;
      theta[idx] += (latentHeat / Cp * dq) / PiLev;
      return dq * massLev;
    };

    for (let k = 0; k < N; k++) {
      const levS = nz - 1;
      const levM = Math.max(1, Math.floor(nz / 2));
      const convTopLev = 1;
      const idxS = levS * N + k;
      const idxM = levM * N + k;
      const rowIndex = Math.floor(k / nx);
      const columnWeight = cosLat[rowIndex];

      const p1 = Math.max(100, pHalf[levS * N + k]);
      const p2 = Math.max(100, pHalf[(levS + 1) * N + k]);
      const pMidS = Math.sqrt(p1 * p2);
      const PiS = Math.pow(pMidS / P0, KAPPA);
      const TS = theta[idxS] * PiS;
      const qsS = saturationMixingRatio(TS, pMidS);
      const qvS = qv[idxS];
      const rhS = qvS / Math.max(qsS, eps);

      const leeNoDelivery = terrainLeeNoDeliveryDiag[k];
      const leeOmegaFloorBlend = leeNoDelivery * clamp(terrainLeeOmegaFloorBlend, 0, 1);
      const omegaLowRaw = omega[levS * N + k];
      let omegaLowEffectiveCol = omegaLowRaw;
      const terrainOmegaLow = Math.max(0, terrainOmegaSurfaceDiag[k]) * Math.exp(-orographicDecayFrac);
      if (leeOmegaFloorBlend > 0 && terrainOmegaLow > omegaLowEffectiveCol) {
        omegaLowEffectiveCol += (terrainOmegaLow - omegaLowEffectiveCol) * leeOmegaFloorBlend;
      }
      const ascentDamp = 1 - leeNoDelivery * clamp(terrainLeeAscentDamp, 0, 1);
      const omegaLow = omegaLowEffectiveCol < 0 ? omegaLowEffectiveCol * ascentDamp : omegaLowEffectiveCol;
      lowLevelOmegaEffective[k] = omegaLow;
      if (omegaLow < 0) omegaPos[nOmegaPos++] = -omegaLow;

      const pMidM = Math.max(100, pMid[idxM]);
      const PiM = Math.pow(pMidM / P0, KAPPA);
      const TM = theta[idxM] * PiM;
      const qsMid = saturationMixingRatio(TM, pMidM);
      const rhMid = qv[idxM] / Math.max(qsMid, eps);
      const qvThetaeS = Math.min(qvS, thetaeQvCap);
      const qvThetaeM = Math.min(qv[idxM], thetaeQvCap);
      const thetaeS = theta[idxS] * (1 + thetaeCoeff * qvThetaeS);
      const thetaeM = theta[idxM] * (1 + thetaeCoeff * qvThetaeM);
      const instab = thetaeS - thetaeM;
      instabArr[k] = instab;

      const qvSupport = smoothstep(qvTrig * 0.5, Math.max(qvTrig * 3, qvTrig + 0.003), qvS);
      const rhSupport = smoothstep(Math.max(0, rhTrig - 0.15), Math.min(1, rhTrig + 0.08), rhS);
      const rhMidSupport = smoothstep(Math.max(0, rhMidMin * 0.6), Math.min(1, rhMidMin + 0.35), rhMid);
      const ascentSupport = smoothstep(Math.max(0.03, omegaThreshDynamic * 0.35), Math.max(0.08, omegaThreshDynamic * 2.2), -omegaLow);
      const instabSupport = smoothstep(Math.max(0.5, instabTrig * 0.35), Math.max(1.5, instabTrig * 1.8), instab);
      const moistureConvergenceSupport = clamp01(lowLevelMoistureConvergence[k] * 21600);
      let potentialTarget = clamp01(
        (
          1.15 * qvSupport +
          1.0 * rhSupport +
          0.9 * rhMidSupport +
          1.25 * ascentSupport +
          1.2 * instabSupport +
          1.0 * moistureConvergenceSupport
        ) / 6.5
      );
      const latAbs = Math.abs(latDeg?.[rowIndex] ?? 0);
      const tropicalCore = latDeg
        ? 1 - smoothstep(Math.max(6, tropicalOrganizationBandDeg * 0.55), tropicalOrganizationBandDeg + 2, latAbs)
        : 1;
      const subtropicalBand = latDeg
        ? smoothstep(subtropicalSubsidenceLat0 - 5, subtropicalSubsidenceLat0 + 2, latAbs)
            * (1 - smoothstep(subtropicalSubsidenceLat1 - 4, subtropicalSubsidenceLat1 + 2, latAbs))
        : 0;
      const organizedSupport = clamp01(
        0.5 * moistureConvergenceSupport +
        0.35 * ascentSupport +
        0.15 * rhMidSupport
      );
      const neutralToSubsidingSupport = smoothstep(-0.015, 0.18, omegaLow);
      const subtropicalSuppression = clamp01(
        subtropicalBand * (
          0.5 +
          0.4 * neutralToSubsidingSupport +
          0.35 * (1 - organizedSupport) +
          0.25 * (1 - rhMidSupport)
        )
      );
      potentialTarget = clamp01(
        potentialTarget
          * (0.84 + 0.24 * tropicalCore)
          * (1 - 0.62 * subtropicalSuppression)
      );
      freshSubtropicalBandPublicDiag[k] = subtropicalBand;
      freshNeutralToSubsidingSupportPublicDiag[k] = neutralToSubsidingSupport;
      freshRhMidSupportPublicDiag[k] = rhMidSupport;
      freshPotentialTargetPublicDiag[k] = potentialTarget;
      freshOrganizedSupportPublicDiag[k] = organizedSupport;
      freshSubtropicalSuppressionPublicDiag[k] = subtropicalSuppression;
      freshPotentialTargetDiag[k] = potentialTarget;
      freshOrganizedSupportDiag[k] = organizedSupport;
      freshSubtropicalSuppressionDiag[k] = subtropicalSuppression;
      const circulationReboundContainment = computeCirculationReboundContainment({
        enabled: enableCirculationReboundContainment,
        tropicalCore,
        subtropicalBand,
        subtropicalSuppression,
        neutralToSubsidingSupport,
        organizedSupport,
        potentialTarget,
        containmentScale: circulationReboundContainmentScale,
        organizationScale: circulationReboundOrganizationScale,
        activityScale: circulationReboundActivityScale,
        sourceScale: circulationReboundSourceScale
      });
      circulationReboundContainmentDiag[k] = circulationReboundContainment.support;
      circulationReboundActivitySuppressionDiag[k] = circulationReboundContainment.activitySuppressFrac;
      circulationReboundSourceSuppressionDiag[k] = circulationReboundContainment.sourceSuppressFrac;
      const potentialPrev = convectivePotential[k];
      const potentialTau = potentialTarget >= potentialPrev ? convPotentialGrowTau : convPotentialDecayTau;
      const potentialAlpha = 1 - Math.exp(-dt / Math.max(potentialTau, eps));
      convectivePotential[k] = clamp01(
        potentialPrev + (potentialTarget - potentialPrev) * potentialAlpha
      );

      const organizationPrev = convectiveOrganization[k];
      const persistentOrganizationSupport = Math.max(
        organizationPrev * 0.82,
        ascentSupport * rhMidSupport
      );
      const organizationTarget = clamp01(
        (
          0.5 * convectivePotential[k] +
          0.28 * moistureConvergenceSupport +
          0.22 * persistentOrganizationSupport +
          0.12 * tropicalCore * Math.max(convectivePotential[k], moistureConvergenceSupport)
        ) * (0.84 + 0.32 * tropicalCore)
          * (1 - 0.82 * subtropicalSuppression)
          * (1 - circulationReboundContainment.organizationSuppressFrac)
      );
      const organizationDecayScale = subtropicalSuppression > 0.15 && organizationTarget < organizationPrev
        ? 0.55
        : 1;
      const organizationTau = organizationTarget >= organizationPrev
        ? convOrganizationGrowTau
        : convOrganizationDecayTau * organizationDecayScale;
      const organizationAlpha = 1 - Math.exp(-dt / Math.max(organizationTau, eps));
      convectiveOrganization[k] = clamp01(
        organizationPrev + (organizationTarget - organizationPrev) * organizationAlpha
      );

      convPotentialWeightedSum += convectivePotential[k] * columnWeight;
      convOrganizationWeightedSum += convectiveOrganization[k] * columnWeight;
      lowLevelConvergenceWeightedSum += lowLevelMoistureConvergence[k] * columnWeight;

      const activityPotential = smoothstep(convMinPotential, 0.95, convectivePotential[k]);
      const activityOrganization = smoothstep(convMinOrganization, 0.95, convectiveOrganization[k]);
      const activity = clamp01(
        (0.35 * activityPotential + 0.65 * activityOrganization)
        * (0.92 + 0.16 * tropicalCore)
        * (1 - 0.4 * subtropicalSuppression)
        * (1 - circulationReboundContainment.activitySuppressFrac)
      );
      const hasSupport = activity > 0
        && (qvSupport > 0.08 || rhSupport > 0.08)
        && (ascentSupport > 0.05 || moistureConvergenceSupport > 0.05)
        && instabSupport > 0.05;
      if (!hasSupport) continue;

      convMask[k] = activity > 0.22 ? 1 : 0;
      if (convMask[k] === 1) convectiveColumnsCount += 1;

      const dpSurface = pHalf[(levS + 1) * N + k] - pHalf[levS * N + k];
      const massSurface = dpSurface / g;
      const mu = clamp(
        baseMu
          * activity
          * (0.55 + 0.95 * activityOrganization + 0.3 * tropicalCore)
          * (1 - 0.45 * subtropicalSuppression),
        0,
        0.35
      );
      convectiveMassFlux[k] = massSurface > 0 && dt > 0 ? (mu * massSurface) / dt : 0;
      convMassFluxWeightedSum += convectiveMassFlux[k] * columnWeight;
      const convMassFluxSupport = smoothstep(0.0005, 0.02, convectiveMassFlux[k]);
      rowConvectiveSource[rowIndex] += (
        0.95 * Math.pow(convectiveOrganization[k], 1.1) * (0.85 + 0.15 * tropicalCore)
        + 0.75 * convMassFluxSupport
      ) * (1 - circulationReboundContainment.sourceSuppressFrac);
      if (mu <= 1e-6 || massSurface <= 0) continue;

      const entrainEff = clamp(
        entrainFrac * (
          1.35 -
          0.7 * convectiveOrganization[k] -
          0.18 * tropicalCore +
          0.45 * (1 - rhMidSupport) +
          0.2 * subtropicalSuppression
        ),
        0.03,
        0.75
      );
      const detrainTopEff = clamp(
        detrainTop +
          0.22 * convectiveOrganization[k] +
          0.12 * tropicalCore +
          0.08 * instabSupport -
          0.12 * (1 - rhMidSupport) -
          0.05 * subtropicalSuppression,
        0.45,
        0.97
      );
      const rainoutFrac = clamp(
        convRainoutBase
          - 0.55 * convRainoutOrganizationWeight * convectiveOrganization[k]
          + 0.7 * convRainoutHumidityWeight * (1 - rhMidSupport)
          + 0.18 * subtropicalSuppression
          + 0.08 * (1 - moistureConvergenceSupport)
          + 0.08 * convMassFluxSupport * tropicalCore
          - 0.08 * tropicalCore,
        0.08,
        0.88
      );
      convectiveRainoutFraction[k] = rainoutFrac;

      if (enableConvectiveMixing) {
        for (let lev = levS; lev > convTopLev; lev--) {
          const levBelow = lev;
          const levAbove = lev - 1;
          const idxB = levBelow * N + k;
          const idxA = levAbove * N + k;

          const dpB = pHalf[(levBelow + 1) * N + k] - pHalf[levBelow * N + k];
          const dpA = pHalf[(levAbove + 1) * N + k] - pHalf[levAbove * N + k];
          const denom = Math.max(1e-6, dpA + dpB);

          const thetaMean = (theta[idxA] * dpA + theta[idxB] * dpB) / denom;
          theta[idxA] += mu * (thetaMean - theta[idxA]);
          theta[idxB] += mu * (thetaMean - theta[idxB]);

          const qvMean = (qv[idxA] * dpA + qv[idxB] * dpB) / denom;
          qv[idxA] += mu * (qvMean - qv[idxA]);
          qv[idxB] += mu * (qvMean - qv[idxB]);
        }
      } else {
        let thetaP = theta[idxS];
        let qvP = qv[idxS];
        let qCondTotal = 0;
        let plumeTopLev = levS;

        for (let lev = levS - 1; lev >= 0; lev--) {
          const idxEnv = lev * N + k;
          const thetaEnv = theta[idxEnv];
          const qvEnv = qv[idxEnv];
          thetaP = (1 - entrainEff) * thetaP + entrainEff * thetaEnv;
          qvP = (1 - entrainEff) * qvP + entrainEff * qvEnv;

          const pLev = Math.max(100, pMid[idxEnv]);
          const Pi = Math.pow(pLev / P0, KAPPA);
          let Tparcel = thetaP * Pi;
          const qs = saturationMixingRatio(Tparcel, pLev);
          if (qvP > qs) {
            const dq = qvP - qs;
            qvP -= dq;
            qCondTotal += dq;
            thetaP += (Lv / Cp * dq) / Pi;
            Tparcel = thetaP * Pi;
          }
          const Tenv = thetaEnv * Pi;
          const buoyK = Tparcel - Tenv;
          if (buoyK < buoyTrigK) break;
          plumeTopLev = lev;
        }

        if (plumeTopLev <= levS - 1) {
          convTopLevSum += plumeTopLev;
          convPlumeCount += 1;
        }

        if (plumeTopLev <= levS - 1 && qCondTotal > 0) {
          const condMass = mu * qCondTotal * massSurface;
          const levTop = plumeTopLev;
          const levBelow = Math.min(levTop + 1, levS);
          const cloudMass = condMass * (1 - rainoutFrac);
          const rainMass = Math.max(0, condMass - cloudMass);
          const cloudBelowFrac = levBelow === levTop ? 0 : 1 - detrainTopEff;

          const usedCloudMassTop = depositHydrometeor(qc, k, levTop, cloudMass * detrainTopEff);
          let usedCloudMass = usedCloudMassTop;
          if (cloudBelowFrac > 0) {
            const usedCloudMassBelow = depositHydrometeor(qc, k, levBelow, cloudMass * cloudBelowFrac);
            usedCloudMass += usedCloudMassBelow;
            if (usedCloudMassBelow > 0) {
              if (isUpperCloudSigma(sigmaMidAtLevel(sigmaHalf, levBelow, nz))) {
                verticalUpperCloudConvectiveBirthMass[k] += usedCloudMassBelow;
              }
              const bandIndexBelow = findCloudBirthLevelBandIndex(sigmaMidAtLevel(sigmaHalf, levBelow, nz));
              convectiveDetrainmentCloudBirthByBandMass[cloudBirthBandOffset(bandIndexBelow, k, N)] += usedCloudMassBelow;
            }
          }
          if (usedCloudMassTop > 0) {
            if (isUpperCloudSigma(sigmaMidAtLevel(sigmaHalf, levTop, nz))) {
              verticalUpperCloudConvectiveBirthMass[k] += usedCloudMassTop;
            }
            const bandIndexTop = findCloudBirthLevelBandIndex(sigmaMidAtLevel(sigmaHalf, levTop, nz));
            convectiveDetrainmentCloudBirthByBandMass[cloudBirthBandOffset(bandIndexTop, k, N)] += usedCloudMassTop;
          }

          let usedRainMass = 0;
          if (rainMass > 0) {
            const levRain = Math.min(
              levBelow + (convectiveOrganization[k] > 0.6 && levBelow < levS ? 1 : 0),
              levS
            );
            const rainTopFrac = clamp(0.35 + 0.3 * convectiveOrganization[k], 0.2, 0.75);
            usedRainMass += depositHydrometeor(qr, k, levRain, rainMass * rainTopFrac);
            const levRain2 = Math.min(levRain + 1, levS);
            if (levRain2 !== levRain) {
              usedRainMass += depositHydrometeor(qr, k, levRain2, rainMass * (1 - rainTopFrac));
            }
          }

          const usedCondMass = usedCloudMass + usedRainMass;
          if (usedCondMass > 0) {
            qv[idxS] = Math.max(0, qv[idxS] - usedCondMass / massSurface);
            convectiveDetrainmentMass[k] = usedCloudMass;
            convectiveDetrainmentCloudBirthAccumMass[k] += usedCloudMass;
            convectiveHeatingProxy[k] = usedCondMass / Math.max(dt, eps);
            convectiveTopLevel[k] = plumeTopLev;
            const anvilDepth = 1 - plumeTopLev / Math.max(1, nz - 1);
            convectiveAnvilSource[k] = clamp01(
              (
                0.75 * convectiveOrganization[k] +
                0.25 * convMassFluxSupport
              ) * anvilDepth * (1 - rainoutFrac * 0.85) * (0.9 + 0.1 * tropicalCore)
            );
            convCondMassSum += usedCondMass * columnWeight;
            totalCondensed += usedCondMass;
            totalDetrainedQc += usedCloudMass;
            totalRainProduced += usedRainMass;
          }
        }
      }
    }

    let subsidenceDryingWeightedSum = 0;
    if (latDeg) {
      for (let j = 0; j < ny; j++) rowConvectiveSource[j] /= Math.max(1, nx);
      let nhSource = 0;
      let nhWeight = 0;
      let shSource = 0;
      let shWeight = 0;
      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs > tropicalOrganizationBandDeg) continue;
        const weight = cosLat[j];
        if (lat >= 0) {
          nhSource += rowConvectiveSource[j] * weight;
          nhWeight += weight;
        } else {
          shSource += rowConvectiveSource[j] * weight;
          shWeight += weight;
        }
      }
      nhSource = nhWeight > 0 ? nhSource / nhWeight : 0;
      shSource = shWeight > 0 ? shSource / shWeight : 0;
      const meanTropicalSource = (nhSource * nhWeight + shSource * shWeight) / Math.max(eps, nhWeight + shWeight);
      const subtropicalAlpha = 1 - Math.exp(-dt / Math.max(subtropicalSubsidenceTau, eps));
      const subtropicalMidSigma = 0.5 * (subtropicalSubsidenceTopSigma + subtropicalSubsidenceBottomSigma);

      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs < subtropicalSubsidenceLat0 || latAbs > subtropicalSubsidenceLat1) continue;
        const hemiSource = lat >= 0 ? nhSource : shSource;
        const weakHemiFrac = meanTropicalSource > eps
          ? clamp01((meanTropicalSource - hemiSource) / Math.max(meanTropicalSource, eps))
          : 0;
        const sourceDriverFloor = Math.max(
          hemiSource,
          meanTropicalSource * clamp(subtropicalSubsidenceCrossHemiFloorFrac, 0, 1)
        );
        const sourceDriver = sourceDriverFloor * (
          1 + clamp(subtropicalSubsidenceWeakHemiBoost, 0, 1.5) * weakHemiFrac
        );
        const latShape = smoothstep(subtropicalSubsidenceLat0 - 2, subtropicalSubsidenceLat0 + 4, latAbs)
          * (1 - smoothstep(subtropicalSubsidenceLat1 - 3, subtropicalSubsidenceLat1 + 2, latAbs));
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          subtropicalSourceDriverDiag[k] = sourceDriver;
          subtropicalSourceDriverFloorDiag[k] = sourceDriverFloor;
          subtropicalLocalHemiSourceDiag[k] = hemiSource;
          subtropicalMeanTropicalSourceDiag[k] = meanTropicalSource;
          subtropicalWeakHemiFracDiag[k] = weakHemiFrac;
          subtropicalCrossHemiFloorShareDiag[k] = sourceDriverFloor > eps
            ? clamp01(Math.max(0, sourceDriverFloor - hemiSource) / sourceDriverFloor)
            : 0;
          const descentSupport = smoothstep(-0.01, 0.24, lowLevelOmegaEffective[k]);
          const localOrganizationRelief = 1 - 0.45 * convectiveOrganization[k];
          const localMoistureExportSupport = 0.62 + 0.38 * (1 - clamp01(lowLevelMoistureConvergence[k] * 21600));
          const dryDriver = clamp01(
            2.05 * sourceDriver
              * latShape
              * descentSupport
              * localOrganizationRelief
              * localMoistureExportSupport
              * (1 - 0.24 * convectivePotential[k])
          );
          subtropicalSubsidenceDrying[k] = dryDriver;
          if (dryDriver <= 0) continue;
          const dryFracBase = clamp(
            subtropicalAlpha * dryDriver * (1.12 + 0.42 * latShape),
            0,
            subtropicalSubsidenceMaxDryFrac
          );
          for (let lev = 0; lev < nz; lev++) {
            const sigmaMid = sigmaHalf
              ? clamp01(0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]))
              : clamp01((lev + 0.5) / Math.max(1, nz));
            if (sigmaMid < subtropicalSubsidenceTopSigma || sigmaMid > subtropicalSubsidenceBottomSigma) continue;
            const lowerRamp = smoothstep(subtropicalSubsidenceTopSigma, subtropicalMidSigma, sigmaMid);
            const upperRamp = 1 - smoothstep(subtropicalMidSigma, subtropicalSubsidenceBottomSigma, sigmaMid);
            const layerWeight = clamp01(Math.min(lowerRamp, upperRamp) * 1.8);
            if (layerWeight <= 0) continue;
            const idx = lev * N + k;
            const dryFrac = dryFracBase * layerWeight;
            const dq = qv[idx] * dryFrac;
            qv[idx] = Math.max(0, qv[idx] - dq);
            theta[idx] += subtropicalSubsidenceThetaStepK * dryFrac * (0.65 + 0.55 * layerWeight);
          }
          subsidenceDryingWeightedSum += dryDriver * cosLat[j];
        }
      }
    }

    convTopLevMean = convPlumeCount > 0 ? convTopLevSum / convPlumeCount : null;
    convCondMassMean = totalWeightAll > 0 ? convCondMassSum / totalWeightAll : 0;
    state.vertMetricsContinuous = {
      convectivePotentialMean: totalWeightAll > 0 ? convPotentialWeightedSum / totalWeightAll : 0,
      convectiveOrganizationMean: totalWeightAll > 0 ? convOrganizationWeightedSum / totalWeightAll : 0,
      convectiveMassFluxMeanKgM2S: totalWeightAll > 0 ? convMassFluxWeightedSum / totalWeightAll : 0,
      lowLevelMoistureConvergenceMeanS_1: totalWeightAll > 0 ? lowLevelConvergenceWeightedSum / totalWeightAll : 0,
      subtropicalSubsidenceDryingMean: totalWeightAll > 0 ? subsidenceDryingWeightedSum / totalWeightAll : 0
    };
  }

  if (enableCarryInputDominanceOverride) {
    for (let k = 0; k < N; k += 1) {
      const actualInputMass = verticalUpperCloudInputMass[k] || 0;
      if (!(actualInputMass >= carryInputMinResidualMassKgM2)) continue;
      if ((freshPotentialTargetDiag[k] || 0) > carryInputPotentialMax) continue;
      if ((freshOrganizedSupportDiag[k] || 0) > carryInputOrganizedSupportMax) continue;
      if ((freshSubtropicalSuppressionDiag[k] || 0) < carryInputSubtropicalSuppressionMin) continue;

      const upperCloudMass = sumUpperCloudMassAtCell(state, pHalf, sigmaHalf, nz, k);
      if (!(upperCloudMass > 0)) continue;
      const explicitBirthMass =
        Math.max(0, verticalUpperCloudResolvedBirthMass[k] || 0)
        + Math.max(0, verticalUpperCloudConvectiveBirthMass[k] || 0);
      const carrySurvivingEstimate = clamp(
        Math.min(actualInputMass, Math.max(0, upperCloudMass - explicitBirthMass)),
        0,
        actualInputMass
      );
      const carryInputDominance = actualInputMass > eps ? carrySurvivingEstimate / actualInputMass : 0;
      if (carryInputDominance < carryInputDominanceMin) continue;

      const removalMass = upperCloudMass * clamp01(carryInputClearFrac);
      if (!(removalMass > 0)) continue;
      const keepFrac = Math.max(0, (upperCloudMass - removalMass) / Math.max(upperCloudMass, eps));
      scaleUpperCloudMassAtCell(state, sigmaHalf, nz, k, keepFrac);
      carryInputOverrideHitCount[k] += 1;
      carryInputOverrideRemovedMass[k] += removalMass;
      carryInputOverrideInputMass[k] += actualInputMass;
      carryInputOverrideAccumHitCount[k] += 1;
      carryInputOverrideAccumRemovedMass[k] += removalMass;
      carryInputOverrideAccumInputMass[k] += actualInputMass;
    }
  }

  if (!state._prevUpperCloudPath || state._prevUpperCloudPath.length !== N) {
    state._prevUpperCloudPath = new Float32Array(N);
  }
  const prevUpperCloudPath = state._prevUpperCloudPath;
  if (!traceEnabled) prevUpperCloudPath.fill(0);
  if (traceEnabled) for (let k = 0; k < N; k++) {
    let upperCloudMass = 0;
    const upperCloudBandMass = new Float32Array(CLOUD_BIRTH_LEVEL_BAND_COUNT);
    for (let lev = 0; lev < nz; lev++) {
      const sigmaMid = sigmaHalf
        ? clamp01(0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]))
        : clamp01((lev + 0.5) / Math.max(1, nz));
      if (sigmaMid > 0.55) continue;
      const idx = lev * N + k;
      const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
      if (dp <= 0) continue;
      const layerCloudMass = ((qc[idx] || 0) + (qi[idx] || 0) + (qr[idx] || 0) + (qs[idx] || 0)) * (dp / g);
      upperCloudMass += layerCloudMass;
      const bandIndex = findCloudBirthLevelBandIndex(sigmaMid);
      upperCloudBandMass[bandIndex] += layerCloudMass;
    }
    upperCloudPath[k] = upperCloudMass;
    const previousUpperCloudMass = prevUpperCloudPath[k] || 0;
    const overlap = Math.min(prevUpperCloudPath[k] || 0, upperCloudMass);
    carriedOverUpperCloudMass[k] = overlap;
    const weakLocalOrganization = 1 - smoothstep(0.12, 0.42, convectiveOrganization[k]);
    const weakLocalMassFlux = 1 - smoothstep(5e-4, 0.004, convectiveMassFlux[k]);
    const weakLocalDetrainment = 1 - smoothstep(0.001, 0.02, convectiveDetrainmentMass[k]);
    const weakLocalAnvilSource = 1 - smoothstep(0.05, 0.35, convectiveAnvilSource[k]);
    const weakSubsidenceErosion = 1 - smoothstep(0.01, 0.08, subtropicalSubsidenceDrying[k]);
    const weakDescentVent = 1 - smoothstep(0.02, 0.18, Math.max(0, lowLevelOmegaEffective[k]));
    const weakErosionSupport = clamp01(
      0.4 * weakSubsidenceErosion +
      0.25 * weakDescentVent +
      0.2 * weakLocalOrganization +
      0.1 * weakLocalMassFlux +
      0.05 * weakLocalAnvilSource
    );
    weakErosionCloudSurvivalMass[k] = overlap * weakErosionSupport;
    const persistenceSupport = clamp01(
      0.35 * weakLocalOrganization +
      0.25 * weakLocalMassFlux +
      0.2 * weakLocalDetrainment +
      0.2 * weakLocalAnvilSource
    );
    importedAnvilPersistenceMass[k] = overlap * persistenceSupport;
    const localBirthMass = Math.max(0, upperCloudMass - overlap);
    const resolvedBirthMass = verticalUpperCloudResolvedBirthMass[k] || 0;
    const convectiveBirthMass = verticalUpperCloudConvectiveBirthMass[k] || 0;
    const previousResidenceSeconds = upperCloudResidenceTimeSeconds[k] || 0;
    const previousLocalBirthSeconds = upperCloudTimeSinceLocalBirthSeconds[k] || 0;
    const previousImportSeconds = upperCloudTimeSinceImportSeconds[k] || 0;
    const nextResidenceSeconds = upperCloudMass > 0
      ? (overlap * (previousResidenceSeconds + dt) + localBirthMass * 0) / upperCloudMass
      : 0;
    const nextLocalBirthSeconds = upperCloudMass > 0
      ? (overlap * (previousLocalBirthSeconds + dt) + localBirthMass * 0) / upperCloudMass
      : 0;
    const nextImportSeconds = overlap > 0 ? previousImportSeconds + dt : 0;
    upperCloudResidenceTimeSeconds[k] = nextResidenceSeconds;
    upperCloudTimeSinceLocalBirthSeconds[k] = nextLocalBirthSeconds;
    upperCloudTimeSinceImportSeconds[k] = nextImportSeconds;
    upperCloudResidenceTimeMassWeightedSeconds[k] += upperCloudMass * nextResidenceSeconds;
    upperCloudTimeSinceLocalBirthMassWeightedSeconds[k] += upperCloudMass * nextLocalBirthSeconds;
    upperCloudTimeSinceImportMassWeightedSeconds[k] += overlap * nextImportSeconds;
    const recentlyImportedThresholdSeconds = 36 * 3600;
    const recentlyImportedMass = overlap > 0 && nextImportSeconds <= recentlyImportedThresholdSeconds ? overlap : 0;
    const staleMass = Math.max(0, upperCloudMass - localBirthMass - recentlyImportedMass);
    upperCloudFreshBornMass[k] = localBirthMass;
    upperCloudRecentlyImportedMass[k] = recentlyImportedMass;
    upperCloudStaleMass[k] = staleMass;
    upperCloudFreshBornAccumMass[k] += localBirthMass;
    upperCloudRecentlyImportedAccumMass[k] += recentlyImportedMass;
    upperCloudStaleAccumMass[k] += staleMass;
    const appliedErosionMass = Math.max(0, previousUpperCloudMass - overlap);
    const potentialErosionMass = previousUpperCloudMass;
    const blockedErosionMass = Math.max(0, potentialErosionMass - appliedErosionMass);
    upperCloudPotentialErosionMass[k] = potentialErosionMass;
    upperCloudAppliedErosionMass[k] = appliedErosionMass;
    upperCloudBlockedErosionMass[k] = blockedErosionMass;
    upperCloudPotentialErosionAccumMass[k] += potentialErosionMass;
    upperCloudAppliedErosionAccumMass[k] += appliedErosionMass;
    upperCloudBlockedErosionAccumMass[k] += blockedErosionMass;
    const weakLocalSupport = clamp01(
      0.2 * weakLocalOrganization +
      0.1 * weakLocalMassFlux +
      0.05 * weakLocalAnvilSource
    );
    const supportTotal = Math.max(
      eps,
      0.4 * weakSubsidenceErosion + 0.25 * weakDescentVent + weakLocalSupport
    );
    const blockedByWeakSubsidence = blockedErosionMass * (0.4 * weakSubsidenceErosion) / supportTotal;
    const blockedByWeakDescentVent = blockedErosionMass * (0.25 * weakDescentVent) / supportTotal;
    const blockedByLocalSupport = blockedErosionMass * weakLocalSupport / supportTotal;
    upperCloudBlockedByWeakSubsidenceMass[k] = blockedByWeakSubsidence;
    upperCloudBlockedByWeakDescentVentMass[k] = blockedByWeakDescentVent;
    upperCloudBlockedByLocalSupportMass[k] = blockedByLocalSupport;
    upperCloudBlockedByWeakSubsidenceAccumMass[k] += blockedByWeakSubsidence;
    upperCloudBlockedByWeakDescentVentAccumMass[k] += blockedByWeakDescentVent;
    upperCloudBlockedByLocalSupportAccumMass[k] += blockedByLocalSupport;
    const passiveSurvivalMass = overlap > 0 && localBirthMass <= upperCloudMass * 0.1 ? overlap : 0;
    const regenerationMass = overlap > 0 && localBirthMass > upperCloudMass * 0.1 ? localBirthMass : 0;
    const oscillatoryMass = overlap > 0 && localBirthMass > upperCloudMass * 0.05 && appliedErosionMass > potentialErosionMass * 0.05
      ? Math.min(overlap, localBirthMass)
      : 0;
    upperCloudPassiveSurvivalMass[k] = passiveSurvivalMass;
    upperCloudRegenerationMass[k] = regenerationMass;
    upperCloudOscillatoryMass[k] = oscillatoryMass;
    upperCloudPassiveSurvivalAccumMass[k] += passiveSurvivalMass;
    upperCloudRegenerationAccumMass[k] += regenerationMass;
    upperCloudOscillatoryAccumMass[k] += oscillatoryMass;
    const actualInputMass = verticalUpperCloudInputMass[k] || 0;
    const survivingCarryMass = clamp(
      Math.min(actualInputMass, Math.max(0, upperCloudMass - resolvedBirthMass - convectiveBirthMass)),
      0,
      actualInputMass
    );
    const handoffAppliedErosionMass = Math.max(0, actualInputMass - survivingCarryMass);
    verticalUpperCloudCarrySurvivingMass[k] = survivingCarryMass;
    verticalUpperCloudAppliedErosionMass[k] = handoffAppliedErosionMass;
    verticalUpperCloudHandedToMicrophysicsMass[k] = upperCloudMass;
    verticalUpperCloudResidualMass[k] = (
      actualInputMass
      + resolvedBirthMass
      + convectiveBirthMass
      - upperCloudMass
    );
    let enteringMass = 0;
    let survivingMass = 0;
    for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BAND_COUNT; bandIndex += 1) {
      const offset = cloudBirthBandOffset(bandIndex, k, N);
      const previousMass = prevUpperCloudBandMass[offset] || 0;
      const currentMass = upperCloudBandMass[bandIndex] || 0;
      const bandOverlap = Math.min(previousMass, currentMass);
      const bandAppliedErosionMass = Math.max(0, previousMass - bandOverlap);
      const bandBlockedErosionMass = Math.max(0, previousMass - bandAppliedErosionMass);
      upperCloudPotentialErosionByBandMass[offset] += previousMass;
      upperCloudAppliedErosionByBandMass[offset] += bandAppliedErosionMass;
      upperCloudBlockedErosionByBandMass[offset] += bandBlockedErosionMass;
      if (previousMass > 0) {
        carryOverUpperCloudEnteringByBandMass[offset] += previousMass;
        enteringMass += previousMass;
      }
      if (bandOverlap > 0) {
        carryOverUpperCloudSurvivingByBandMass[offset] += bandOverlap;
        survivingMass += bandOverlap;
      }
      prevUpperCloudBandMass[offset] = currentMass;
    }
    carryOverUpperCloudEnteringAccumMass[k] += enteringMass;
    carryOverUpperCloudSurvivingAccumMass[k] += survivingMass;
    upperCloudAppliedErosionMass[k] += handoffAppliedErosionMass;
    upperCloudBlockedErosionMass[k] = Math.max(0, upperCloudBlockedErosionMass[k] - handoffAppliedErosionMass);
    upperCloudAppliedErosionAccumMass[k] += handoffAppliedErosionMass;
    upperCloudBlockedErosionAccumMass[k] = Math.max(0, upperCloudBlockedErosionAccumMass[k] - handoffAppliedErosionMass);
    prevUpperCloudPath[k] = upperCloudMass;
  }

  // Positivity guards
  const len3d = theta.length;
  for (let m = 0; m < len3d; m++) {
    const cell = m % N;
    const lev = Math.floor(m / N);
    const bandIndex = findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, nz));
    const dpLev = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
    const clipMass = dpLev > 0
      ? ((-Math.min(0, qv[m])) + (-Math.min(0, qc[m])) + (-Math.min(0, qi[m])) + (-Math.min(0, qr[m]))) * (dpLev / g)
      : 0;
    const cloudClipMass = dpLev > 0
      ? ((-Math.min(0, qc[m])) + (-Math.min(0, qi[m])) + (-Math.min(0, qr[m]))) * (dpLev / g)
      : 0;
    const clipCount = (qv[m] < 0) + (qc[m] < 0) + (qi[m] < 0) + (qr[m] < 0);
    const cloudClipCount = (qc[m] < 0) + (qi[m] < 0) + (qr[m] < 0);
    if (clipCount > 0) {
      state.numericalNegativeClipCount[cell] += clipCount;
      state.numericalNegativeClipMass[cell] += clipMass;
      recordBandValue(state.numericalNegativeClipByBandMass, bandIndex, cell, N, clipMass);
    }
    if (cloudClipCount > 0) {
      state.numericalCloudLimiterCount[cell] += cloudClipCount;
      state.numericalCloudLimiterMass[cell] += cloudClipMass;
      recordBandValue(state.numericalCloudLimiterByBandMass, bandIndex, cell, N, cloudClipMass);
    }
    qv[m] = Math.max(0, qv[m]);
    qc[m] = Math.max(0, qc[m]);
    qi[m] = Math.max(0, qi[m]);
    qr[m] = Math.max(0, qr[m]);
  }

  let omegaSurfMinusDpsDtRms = null;
  if (dpsDtApplied && dpsDtApplied.length === N) {
    let sumSq = 0;
    let count = 0;
    const omegaSurfaceBase = nz * N;
    for (let k = 0; k < N; k++) {
      const omegaSurf = omega[omegaSurfaceBase + k];
      const target = dpsDtApplied[k];
      if (!Number.isFinite(omegaSurf) || !Number.isFinite(target)) continue;
      const diff = omegaSurf - target;
      sumSq += diff * diff;
      count++;
    }
    omegaSurfMinusDpsDtRms = count > 0 ? Math.sqrt(sumSq / count) : null;
  }

  // Metrics helpers for tuning and logging
  const percentile = (arr, n, p) => {
    const count = Math.min(n, arr.length);
    if (count <= 0) return 0;
    const view = arr.subarray(0, count);
    view.sort();
    const idx = clamp(Math.floor((count - 1) * p), 0, count - 1);
    return view[idx];
  };
  const omegaView = state._omegaPosScratch || new Float32Array(0);
  const instabView = state._instabScratch || new Float32Array(0);
  const omegaP50 = percentile(omegaView, nOmegaPos, 0.5);
  const omegaP90 = percentile(omegaView, nOmegaPos, 0.9);
  const omegaP95 = percentile(omegaView, nOmegaPos, 0.95);
  const instabP50 = percentile(instabView, N, 0.5);
  const instabP90 = percentile(instabView, N, 0.9);
  const instabP95 = percentile(instabView, N, 0.95);

  state.convectiveColumnsCount = convectiveColumnsCount;
  state.totalCondensed = totalCondensed;
  state.totalDetrainedQc = totalDetrainedQc;
  state.totalRainProduced = totalRainProduced;
  const continuousMetrics = state.vertMetricsContinuous || {};
  state.vertMetrics = {
    omegaPosP50: omegaP50,
    omegaPosP90: omegaP90,
    omegaPosP95: omegaP95,
    instabP50,
    instabP90,
    instabP95,
    convectiveFraction: convectiveColumnsCount / Math.max(1, N),
    convTopLevMean,
    convCondMassTotalKgM2: convCondMassMean,
    omegaSurfMinusDpsDtRms,
    convectivePotentialMean: continuousMetrics.convectivePotentialMean ?? 0,
    convectiveOrganizationMean: continuousMetrics.convectiveOrganizationMean ?? 0,
    convectiveMassFluxMeanKgM2S: continuousMetrics.convectiveMassFluxMeanKgM2S ?? 0,
    lowLevelMoistureConvergenceMeanS_1: continuousMetrics.lowLevelMoistureConvergenceMeanS_1 ?? 0,
    subtropicalSubsidenceDryingMean: continuousMetrics.subtropicalSubsidenceDryingMean ?? 0
  };

  if (sampleCols > 0 && waterBefore) {
    for (let s = 0; s < sampleCols; s++) {
      const k = Math.min(N - 1, Math.floor((N / sampleCols) * s));
      let w = 0;
      for (let lev = 0; lev < nz; lev++) {
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const idx = lev * N + k;
        w += (qv[idx] + qc[idx] + qi[idx] + qr[idx]) * (dp / g);
      }
      const delta = Math.abs(w - waterBefore[s]);
      if (delta > 1e-6) {
        console.warn(`[V2 vertical] water non-conservation sample k=${k} delta=${delta.toExponential(3)}`);
        break;
      }
    }
  }
}
