import { SURFACE_MOISTURE_SOURCE_TRACERS } from './sourceTracing5.js';
import { CLOUD_BIRTH_LEVEL_BAND_COUNT } from './cloudBirthTracing5.js';
import { INSTRUMENTATION_LEVEL_BAND_COUNT } from './instrumentationBands5.js';

const makeArray = (size, value = 0) => {
  const arr = new Float32Array(size);
  if (value !== 0) arr.fill(value);
  return arr;
};

export function createState5({ grid, nz = 26, sigmaHalf, instrumentationMode = 'full' } = {}) {
  const N = grid.count;
  const SZ = N * nz;

  const u = makeArray(SZ);
  const v = makeArray(SZ);
  const theta = makeArray(SZ, 290);
  const qv = makeArray(SZ);
  const qc = makeArray(SZ);
  const qi = makeArray(SZ);
  const qr = makeArray(SZ);
  const qs = makeArray(SZ);
  const cloudFrac3D = makeArray(SZ);
  const cloudTau3D = makeArray(SZ);

  const ps = makeArray(N, 101325);
  const dpsDtRaw = makeArray(N);
  const dpsDtApplied = makeArray(N);
  const Ts = makeArray(N, 288);
  const soilW = makeArray(N);
  const precipAccum = makeArray(N);
  const precipRate = makeArray(N);
  const precipRainRate = makeArray(N);
  const precipSnowRate = makeArray(N);
  const precipConvectiveAccum = makeArray(N);
  const precipStratiformAccum = makeArray(N);
  const precipConvectiveRate = makeArray(N);
  const precipStratiformRate = makeArray(N);
  const surfaceEvapAccum = makeArray(N);
  const surfaceEvapRate = makeArray(N);
  const surfaceLatentFlux = makeArray(N);
  const surfaceSensibleFlux = makeArray(N);
  const surfaceNetFlux = makeArray(N);
  const landEnergyTempTendency = makeArray(N);
  const landClimoTempTendency = makeArray(N);
  const landHeatCapacity = makeArray(N);
  const soilMoistureFraction = makeArray(N);
  const vegetationProxy = makeArray(N);
  const rainforestCanopySupport = makeArray(N);
  const rainforestRootZoneRechargeRate = makeArray(N);
  const oceanMixedLayerTempTendency = makeArray(N);
  const oceanClimoTempTendency = makeArray(N);
  const seaIceThermoTendency = makeArray(N);
  const sstNow = makeArray(N, 300);
  const seaIceFrac = makeArray(N);
  const seaIceThicknessM = makeArray(N);
  const surfaceRadiativeFlux = makeArray(N);
  const soilCap = makeArray(N);
  const landMask = new Uint8Array(N);
  const convMask = new Uint8Array(N);
  const convectivePotential = makeArray(N);
  const convectiveOrganization = makeArray(N);
  const convectiveMassFlux = makeArray(N);
  const convectiveDetrainmentMass = makeArray(N);
  const convectiveRainoutFraction = makeArray(N);
  const convectiveAnvilSource = makeArray(N);
  const convectiveHeatingProxy = makeArray(N);
  const convectiveTopLevel = makeArray(N);
  const lowLevelMoistureConvergence = makeArray(N);
  const lowLevelOmegaEffective = makeArray(N);
  const frontalAscentSupportDiag = makeArray(N);
  const frontalAscentAddedDiag = makeArray(N);
  const frontalAscentCompensationDiag = makeArray(N);
  const frontalBaroclinicSupportDiag = makeArray(N);
  const frontalJetSupportDiag = makeArray(N);
  const frontalLandOceanSupportDiag = makeArray(N);
  const frontalMoistureSupportDiag = makeArray(N);
  const stormGenesisPotentialDiag = makeArray(N);
  const stormDeepeningPotentialDiag = makeArray(N);
  const stormOcclusionPotentialDiag = makeArray(N);
  const stormDecayPotentialDiag = makeArray(N);
  const stormPrecipShieldDiag = makeArray(N);
  const stormWarmSectorDiag = makeArray(N);
  const stormColdSectorDiag = makeArray(N);
  const subtropicalSubsidenceDrying = makeArray(N);
  const freshPotentialTargetDiag = makeArray(N);
  const freshOrganizedSupportDiag = makeArray(N);
  const freshSubtropicalSuppressionDiag = makeArray(N);
  const freshSubtropicalBandDiag = makeArray(N);
  const freshShoulderLatitudeWindowDiag = makeArray(N);
  const freshShoulderEquatorialEdgeWindowDiag = makeArray(N);
  const freshShoulderInnerWindowDiag = makeArray(N);
  const freshShoulderEquatorialEdgeGateSupportDiag = makeArray(N);
  const freshShoulderTargetEntryExclusionDiag = makeArray(N);
  const freshNeutralToSubsidingSupportDiag = makeArray(N);
  const freshRhMidSupportDiag = makeArray(N);
  const circulationReboundContainmentDiag = makeArray(N);
  const circulationReboundActivitySuppressionDiag = makeArray(N);
  const circulationReboundSourceSuppressionDiag = makeArray(N);
  const circulationReboundRawSourceDiag = makeArray(N);
  const circulationReboundSuppressedSourceDiag = makeArray(N);
  const circulationReturnFlowOpportunityDiag = makeArray(N);
  const circulationReturnFlowCouplingAppliedDiag = makeArray(N);
  const hadleyReturnFlowWindSupportDiag = makeArray(N);
  const hadleyReturnFlowWindAppliedDiag = makeArray(N);
  const walkerLongitudinalSubsidenceSupportDiag = makeArray(N);
  const dryingOmegaBridgeAppliedDiag = makeArray(N);
  const dryingOmegaBridgeLocalAppliedDiag = makeArray(N);
  const dryingOmegaBridgeProjectedAppliedDiag = makeArray(N);
  const equatorialEdgeSubsidenceGuardSourceSupportDiag = makeArray(N);
  const equatorialEdgeSubsidenceGuardTargetWeightDiag = makeArray(N);
  const equatorialEdgeSubsidenceGuardAppliedDiag = makeArray(N);
  const equatorialEdgeNorthsideLeakSourceWindowDiag = makeArray(N);
  const equatorialEdgeNorthsideLeakRiskDiag = makeArray(N);
  const equatorialEdgeNorthsideLeakAdmissionRiskDiag = makeArray(N);
  const equatorialEdgeNorthsideLeakPenaltyDiag = makeArray(N);
  const northSourceConcentrationPenaltyDiag = makeArray(N);
  const northSourceConcentrationAppliedDiag = makeArray(N);
  const atlanticDryCoreReceiverTaperDiag = makeArray(N);
  const atlanticDryCoreReceiverTaperAppliedDiag = makeArray(N);
  const atlanticTransitionCarryoverContainmentDiag = makeArray(N);
  const atlanticTransitionCarryoverContainmentAppliedDiag = makeArray(N);
  const subtropicalSourceDriverDiag = makeArray(N);
  const subtropicalSourceDriverFloorDiag = makeArray(N);
  const subtropicalLocalHemiSourceDiag = makeArray(N);
  const subtropicalMeanTropicalSourceDiag = makeArray(N);
  const subtropicalCrossHemiFloorShareDiag = makeArray(N);
  const subtropicalBalancePartitionSupportDiag = makeArray(N);
  const subtropicalBalanceCirculationSupportDiag = makeArray(N);
  const subtropicalBalanceContractSupportDiag = makeArray(N);
  const subtropicalWeakHemiFracDiag = makeArray(N);
  const subtropicalWeakHemiFloorOverhangDiag = makeArray(N);
  const subtropicalWeakHemiFloorTaperAppliedDiag = makeArray(N);
  const resolvedAscentCloudBirthPotential = makeArray(N);
  const largeScaleCondensationSource = makeArray(N);
  const cloudReevaporationMass = makeArray(N);
  const precipReevaporationMass = makeArray(N);
  const upperCloudPath = makeArray(N);
  const importedAnvilPersistenceMass = makeArray(N);
  const carriedOverUpperCloudMass = makeArray(N);
  const weakErosionCloudSurvivalMass = makeArray(N);
  const verticalUpperCloudInputMass = makeArray(N);
  const verticalUpperCloudResolvedBirthMass = makeArray(N);
  const verticalUpperCloudConvectiveBirthMass = makeArray(N);
  const verticalUpperCloudCarrySurvivingMass = makeArray(N);
  const verticalUpperCloudAppliedErosionMass = makeArray(N);
  const verticalUpperCloudHandedToMicrophysicsMass = makeArray(N);
  const verticalUpperCloudResidualMass = makeArray(N);
  const carryInputOverrideHitCount = makeArray(N);
  const carryInputOverrideRemovedMass = makeArray(N);
  const carryInputOverrideInputMass = makeArray(N);
  const carryInputOverrideAccumHitCount = makeArray(N);
  const carryInputOverrideAccumRemovedMass = makeArray(N);
  const carryInputOverrideAccumInputMass = makeArray(N);
  const resolvedAscentCloudBirthAccumMass = makeArray(N);
  const saturationAdjustmentCloudBirthAccumMass = makeArray(N);
  const saturationAdjustmentRainoutMass = makeArray(N);
  const convectiveDetrainmentCloudBirthAccumMass = makeArray(N);
  const carryOverUpperCloudEnteringAccumMass = makeArray(N);
  const carryOverUpperCloudSurvivingAccumMass = makeArray(N);
  const saturationAdjustmentEventCount = new Uint32Array(N);
  const saturationAdjustmentSupersaturationMassWeighted = makeArray(N);
  const saturationAdjustmentOmegaMassWeighted = makeArray(N);
  const saturationAdjustmentMaintenanceCandidateMass = makeArray(N);
  const saturationAdjustmentMaintenancePotentialSuppressedMass = makeArray(N);
  const saturationAdjustmentMaintenanceCandidateEventCount = new Uint32Array(N);
  const saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted = makeArray(N);
  const saturationAdjustmentMaintenanceCandidateOmegaMassWeighted = makeArray(N);
  const saturationAdjustmentMarineEventMass = makeArray(N);
  const saturationAdjustmentMarineSubtropicalSupportMassWeighted = makeArray(N);
  const saturationAdjustmentMarineWeakEngineSupportMassWeighted = makeArray(N);
  const saturationAdjustmentMarineWeakAscentSupportMassWeighted = makeArray(N);
  const saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted = makeArray(N);
  const saturationAdjustmentMarineLayerWindowSupportMassWeighted = makeArray(N);
  const saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted = makeArray(N);
  const saturationAdjustmentMarineFreshSubtropicalBandMassWeighted = makeArray(N);
  const saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted = makeArray(N);
  const saturationAdjustmentMarineFreshOrganizedSupportMassWeighted = makeArray(N);
  const saturationAdjustmentMarineFreshRhMidSupportMassWeighted = makeArray(N);
  const saturationAdjustmentLiveGateCandidateMass = makeArray(N);
  const saturationAdjustmentLiveGatePotentialSuppressedMass = makeArray(N);
  const saturationAdjustmentLiveGateEventCount = new Uint32Array(N);
  const saturationAdjustmentLiveGateSupportMassWeighted = makeArray(N);
  const saturationAdjustmentSoftLiveGateCandidateMass = makeArray(N);
  const saturationAdjustmentSoftLiveGatePotentialSuppressedMass = makeArray(N);
  const saturationAdjustmentSoftLiveGateEventCount = new Uint32Array(N);
  const saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted = makeArray(N);
  const saturationAdjustmentSoftLiveGateAscentModulationMassWeighted = makeArray(N);
  const saturationAdjustmentSoftLiveGateAppliedSuppressionMass = makeArray(N);
  const saturationAdjustmentSoftLiveGateRetainedVaporMass = makeArray(N);
  const saturationAdjustmentSoftLiveGateSinkExportMass = makeArray(N);
  const saturationAdjustmentSoftLiveGateBufferedRainoutMass = makeArray(N);
  const saturationAdjustmentSoftLiveGateEquatorwardExportMass = makeArray(N);
  const saturationAdjustmentShoulderGuardCandidateMass = makeArray(N);
  const saturationAdjustmentShoulderGuardPotentialSuppressedMass = makeArray(N);
  const saturationAdjustmentShoulderGuardEventCount = new Uint32Array(N);
  const saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted = makeArray(N);
  const saturationAdjustmentShoulderGuardBandWindowMassWeighted = makeArray(N);
  const saturationAdjustmentShoulderGuardSelectorSupportMassWeighted = makeArray(N);
  const saturationAdjustmentShoulderGuardAppliedSuppressionMass = makeArray(N);
  const saturationAdjustmentShoulderGuardRetainedVaporMass = makeArray(N);
  const saturationAdjustmentShoulderGuardSinkExportMass = makeArray(N);
  const saturationAdjustmentShoulderGuardBufferedRainoutMass = makeArray(N);
  const weakAscentCloudBirthAccumMass = makeArray(N);
  const strongAscentCloudBirthAccumMass = makeArray(N);
  const resolvedAscentCloudBirthByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const saturationAdjustmentCloudBirthByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const convectiveDetrainmentCloudBirthByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const carryOverUpperCloudEnteringByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const carryOverUpperCloudSurvivingByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const advectedCloudImportByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const advectedCloudExportByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const prevUpperCloudBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const upperCloudResidenceTimeSeconds = makeArray(N);
  const upperCloudTimeSinceLocalBirthSeconds = makeArray(N);
  const upperCloudTimeSinceImportSeconds = makeArray(N);
  const upperCloudFreshBornMass = makeArray(N);
  const upperCloudRecentlyImportedMass = makeArray(N);
  const upperCloudStaleMass = makeArray(N);
  const upperCloudPassiveSurvivalMass = makeArray(N);
  const upperCloudRegenerationMass = makeArray(N);
  const upperCloudOscillatoryMass = makeArray(N);
  const upperCloudPotentialErosionMass = makeArray(N);
  const upperCloudAppliedErosionMass = makeArray(N);
  const upperCloudBlockedErosionMass = makeArray(N);
  const upperCloudBlockedByWeakSubsidenceMass = makeArray(N);
  const upperCloudBlockedByWeakDescentVentMass = makeArray(N);
  const upperCloudBlockedByLocalSupportMass = makeArray(N);
  const upperCloudResidenceTimeMassWeightedSeconds = makeArray(N);
  const upperCloudTimeSinceLocalBirthMassWeightedSeconds = makeArray(N);
  const upperCloudTimeSinceImportMassWeightedSeconds = makeArray(N);
  const upperCloudFreshBornAccumMass = makeArray(N);
  const upperCloudRecentlyImportedAccumMass = makeArray(N);
  const upperCloudStaleAccumMass = makeArray(N);
  const upperCloudPassiveSurvivalAccumMass = makeArray(N);
  const upperCloudRegenerationAccumMass = makeArray(N);
  const upperCloudOscillatoryAccumMass = makeArray(N);
  const upperCloudPotentialErosionAccumMass = makeArray(N);
  const upperCloudAppliedErosionAccumMass = makeArray(N);
  const upperCloudBlockedErosionAccumMass = makeArray(N);
  const upperCloudBlockedByWeakSubsidenceAccumMass = makeArray(N);
  const upperCloudBlockedByWeakDescentVentAccumMass = makeArray(N);
  const upperCloudBlockedByLocalSupportAccumMass = makeArray(N);
  const upperCloudPotentialErosionByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const upperCloudAppliedErosionByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const upperCloudBlockedErosionByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const microphysicsCloudToPrecipByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const cloudReevaporationByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const precipReevaporationByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const microphysicsUpperCloudInputMass = makeArray(N);
  const microphysicsUpperCloudSaturationBirthMass = makeArray(N);
  const microphysicsUpperCloudCloudReevaporationMass = makeArray(N);
  const microphysicsUpperCloudPrecipReevaporationMass = makeArray(N);
  const microphysicsUpperCloudSedimentationExportMass = makeArray(N);
  const microphysicsUpperCloudCloudToPrecipMass = makeArray(N);
  const microphysicsUpperCloudOutputMass = makeArray(N);
  const microphysicsUpperCloudResidualMass = makeArray(N);
  const radiativePersistenceEquivalentByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const upperCloudShortwaveAbsorptionWm2 = makeArray(N);
  const upperCloudLongwaveRelaxationBoost = makeArray(N);
  const upperCloudRadiativePersistenceSupportWm2 = makeArray(N);
  const upperCloudClearSkyLwCoolingWm2 = makeArray(N);
  const upperCloudCloudyLwCoolingWm2 = makeArray(N);
  const upperCloudLwCloudEffectWm2 = makeArray(N);
  const upperCloudNetCloudRadiativeEffectWm2 = makeArray(N);
  const surfaceCloudShortwaveShieldingWm2 = makeArray(N);
  const sourceTracer3D = Object.fromEntries(
    SURFACE_MOISTURE_SOURCE_TRACERS.map(({ field }) => [field, makeArray(SZ)])
  );
  const surfaceEvapPotentialRate = makeArray(N);
  const surfaceEvapTransferCoeff = makeArray(N);
  const surfaceEvapWindSpeed = makeArray(N);
  const surfaceEvapHumidityGradient = makeArray(N);
  const surfaceEvapSurfaceTemp = makeArray(N);
  const surfaceEvapAirTemp = makeArray(N);
  const surfaceEvapSoilGate = makeArray(N, 1);
  const surfaceEvapRunoffLossRate = makeArray(N);
  const surfaceEvapSeaIceSuppression = makeArray(N);
  const surfaceEvapSurfaceSaturationMixingRatio = makeArray(N);
  const surfaceEvapAirMixingRatio = makeArray(N);
  const helperNativeDryingSupportMass = makeArray(N);
  const helperNativeDryingSupportByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const nudgingMoisteningMass = makeArray(N);
  const nudgingOpposedDryingMass = makeArray(N);
  const nudgingTargetQvMismatchAccum = makeArray(N);
  const nudgingTargetThetaMismatchAccum = makeArray(N);
  const nudgingTargetWindMismatchAccum = makeArray(N);
  const nudgingTargetQvSampleCount = new Uint32Array(N);
  const nudgingTargetThetaSampleCount = new Uint32Array(N);
  const nudgingTargetWindSampleCount = new Uint32Array(N);
  const analysisMoisteningMass = makeArray(N);
  const analysisOpposedDryingMass = makeArray(N);
  const analysisTargetQvMismatchAccum = makeArray(N);
  const analysisTargetThetaMismatchAccum = makeArray(N);
  const analysisTargetWindMismatchAccum = makeArray(N);
  const analysisTargetQvSampleCount = new Uint32Array(N);
  const analysisTargetThetaSampleCount = new Uint32Array(N);
  const analysisTargetWindSampleCount = new Uint32Array(N);
  const windOpposedDryingCorrection = makeArray(N);
  const windTargetMismatchAccum = makeArray(N);
  const windTargetSampleCount = new Uint32Array(N);
  const nudgingMoisteningByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const nudgingOpposedDryingByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const analysisMoisteningByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const analysisOpposedDryingByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const nudgingQvTargetMismatchByBand = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const nudgingThetaTargetMismatchByBand = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const nudgingWindTargetMismatchByBand = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const analysisQvTargetMismatchByBand = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const analysisThetaTargetMismatchByBand = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const analysisWindTargetMismatchByBand = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const windOpposedDryingByBandCorrection = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const windTargetMismatchByBand = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const numericalBacktraceClampCount = makeArray(N);
  const numericalBacktraceClampExcessCells = makeArray(N);
  const numericalBacktraceClampByBandCount = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const numericalNegativeClipCount = makeArray(N);
  const numericalNegativeClipMass = makeArray(N);
  const numericalNegativeClipByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const numericalSupersaturationClampCount = makeArray(N);
  const numericalSupersaturationClampMass = makeArray(N);
  const numericalSupersaturationClampByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const numericalCloudLimiterCount = makeArray(N);
  const numericalCloudLimiterMass = makeArray(N);
  const numericalCloudLimiterByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const numericalVerticalCflClampCount = makeArray(N);
  const numericalVerticalCflClampMass = makeArray(N);
  const numericalVerticalCflClampByBandMass = makeArray(N * INSTRUMENTATION_LEVEL_BAND_COUNT);
  const numericalAdvectionWaterRepairMass = makeArray(N);
  const numericalAdvectionWaterAddedMass = makeArray(N);
  const numericalAdvectionWaterRemovedMass = makeArray(N);
  const verticalSubtropicalDryingDemandMass = makeArray(N);
  const verticalCloudErosionToVaporMass = makeArray(N);
  const analysisIauPs = makeArray(N);
  const analysisIauTs = makeArray(N);
  const analysisIauU = makeArray(SZ);
  const analysisIauV = makeArray(SZ);
  const analysisIauTheta = makeArray(SZ);
  const analysisIauQv = makeArray(SZ);

  const pHalf = makeArray((nz + 1) * N);
  const pMid = makeArray(nz * N);
  const phiHalf = makeArray((nz + 1) * N);
  const phiMid = makeArray(nz * N);
  const omega = makeArray((nz + 1) * N);
  const Tv = makeArray(SZ);
  const T = makeArray(SZ, 280);

  return {
    instrumentationMode,
    instrumentationEnabled: instrumentationMode !== 'disabled',
    N,
    nz,
    SZ,
    sigmaHalf,
    u,
    v,
    theta,
    qv,
    qc,
    qi,
    qr,
    qs,
    cloudFrac3D,
    cloudTau3D,
    ps,
    dpsDtRaw,
    dpsDtApplied,
    Ts,
    soilW,
    precipAccum,
    precipRate,
    precipRainRate,
    precipSnowRate,
    precipConvectiveAccum,
    precipStratiformAccum,
    precipConvectiveRate,
    precipStratiformRate,
    surfaceEvapAccum,
    surfaceEvapRate,
    surfaceLatentFlux,
    surfaceSensibleFlux,
    surfaceNetFlux,
    landEnergyTempTendency,
    landClimoTempTendency,
    landHeatCapacity,
    soilMoistureFraction,
    vegetationProxy,
    rainforestCanopySupport,
    rainforestRootZoneRechargeRate,
    oceanMixedLayerTempTendency,
    oceanClimoTempTendency,
    seaIceThermoTendency,
    landMask,
    convMask,
    convectivePotential,
    convectiveOrganization,
    convectiveMassFlux,
    convectiveDetrainmentMass,
    convectiveRainoutFraction,
    convectiveAnvilSource,
    convectiveHeatingProxy,
    convectiveTopLevel,
    lowLevelMoistureConvergence,
    lowLevelOmegaEffective,
    frontalAscentSupportDiag,
    frontalAscentAddedDiag,
    frontalAscentCompensationDiag,
    frontalBaroclinicSupportDiag,
    frontalJetSupportDiag,
    frontalLandOceanSupportDiag,
    frontalMoistureSupportDiag,
    stormGenesisPotentialDiag,
    stormDeepeningPotentialDiag,
    stormOcclusionPotentialDiag,
    stormDecayPotentialDiag,
    stormPrecipShieldDiag,
    stormWarmSectorDiag,
    stormColdSectorDiag,
    subtropicalSubsidenceDrying,
    freshPotentialTargetDiag,
    freshOrganizedSupportDiag,
    freshSubtropicalSuppressionDiag,
    freshSubtropicalBandDiag,
    freshShoulderLatitudeWindowDiag,
    freshShoulderEquatorialEdgeWindowDiag,
    freshShoulderInnerWindowDiag,
    freshShoulderEquatorialEdgeGateSupportDiag,
    freshShoulderTargetEntryExclusionDiag,
    freshNeutralToSubsidingSupportDiag,
    freshRhMidSupportDiag,
    circulationReboundContainmentDiag,
    circulationReboundActivitySuppressionDiag,
    circulationReboundSourceSuppressionDiag,
    circulationReboundRawSourceDiag,
    circulationReboundSuppressedSourceDiag,
    circulationReturnFlowOpportunityDiag,
    circulationReturnFlowCouplingAppliedDiag,
    hadleyReturnFlowWindSupportDiag,
    hadleyReturnFlowWindAppliedDiag,
    walkerLongitudinalSubsidenceSupportDiag,
    dryingOmegaBridgeAppliedDiag,
    dryingOmegaBridgeLocalAppliedDiag,
    dryingOmegaBridgeProjectedAppliedDiag,
    equatorialEdgeSubsidenceGuardSourceSupportDiag,
    equatorialEdgeSubsidenceGuardTargetWeightDiag,
    equatorialEdgeSubsidenceGuardAppliedDiag,
    equatorialEdgeNorthsideLeakSourceWindowDiag,
    equatorialEdgeNorthsideLeakRiskDiag,
    equatorialEdgeNorthsideLeakAdmissionRiskDiag,
    equatorialEdgeNorthsideLeakPenaltyDiag,
    northSourceConcentrationPenaltyDiag,
    northSourceConcentrationAppliedDiag,
    atlanticDryCoreReceiverTaperDiag,
    atlanticDryCoreReceiverTaperAppliedDiag,
    atlanticTransitionCarryoverContainmentDiag,
    atlanticTransitionCarryoverContainmentAppliedDiag,
    subtropicalSourceDriverDiag,
    subtropicalSourceDriverFloorDiag,
    subtropicalLocalHemiSourceDiag,
    subtropicalMeanTropicalSourceDiag,
    subtropicalCrossHemiFloorShareDiag,
    subtropicalBalancePartitionSupportDiag,
    subtropicalBalanceCirculationSupportDiag,
    subtropicalBalanceContractSupportDiag,
    subtropicalWeakHemiFracDiag,
    subtropicalWeakHemiFloorOverhangDiag,
    subtropicalWeakHemiFloorTaperAppliedDiag,
    resolvedAscentCloudBirthPotential,
    largeScaleCondensationSource,
    cloudReevaporationMass,
    precipReevaporationMass,
    upperCloudPath,
    importedAnvilPersistenceMass,
    carriedOverUpperCloudMass,
    weakErosionCloudSurvivalMass,
    verticalUpperCloudInputMass,
    verticalUpperCloudResolvedBirthMass,
    verticalUpperCloudConvectiveBirthMass,
    verticalUpperCloudCarrySurvivingMass,
    verticalUpperCloudAppliedErosionMass,
    verticalUpperCloudHandedToMicrophysicsMass,
    verticalUpperCloudResidualMass,
    carryInputOverrideHitCount,
    carryInputOverrideRemovedMass,
    carryInputOverrideInputMass,
    carryInputOverrideAccumHitCount,
    carryInputOverrideAccumRemovedMass,
    carryInputOverrideAccumInputMass,
    resolvedAscentCloudBirthAccumMass,
    saturationAdjustmentCloudBirthAccumMass,
    saturationAdjustmentRainoutMass,
    convectiveDetrainmentCloudBirthAccumMass,
    carryOverUpperCloudEnteringAccumMass,
    carryOverUpperCloudSurvivingAccumMass,
    saturationAdjustmentEventCount,
    saturationAdjustmentSupersaturationMassWeighted,
    saturationAdjustmentOmegaMassWeighted,
    saturationAdjustmentMaintenanceCandidateMass,
    saturationAdjustmentMaintenancePotentialSuppressedMass,
    saturationAdjustmentMaintenanceCandidateEventCount,
    saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted,
    saturationAdjustmentMaintenanceCandidateOmegaMassWeighted,
    saturationAdjustmentMarineEventMass,
    saturationAdjustmentMarineSubtropicalSupportMassWeighted,
    saturationAdjustmentMarineWeakEngineSupportMassWeighted,
    saturationAdjustmentMarineWeakAscentSupportMassWeighted,
    saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted,
    saturationAdjustmentMarineLayerWindowSupportMassWeighted,
    saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted,
    saturationAdjustmentMarineFreshSubtropicalBandMassWeighted,
    saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted,
    saturationAdjustmentMarineFreshOrganizedSupportMassWeighted,
    saturationAdjustmentMarineFreshRhMidSupportMassWeighted,
    saturationAdjustmentLiveGateCandidateMass,
    saturationAdjustmentLiveGatePotentialSuppressedMass,
    saturationAdjustmentLiveGateEventCount,
    saturationAdjustmentLiveGateSupportMassWeighted,
    saturationAdjustmentSoftLiveGateCandidateMass,
    saturationAdjustmentSoftLiveGatePotentialSuppressedMass,
    saturationAdjustmentSoftLiveGateEventCount,
    saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted,
    saturationAdjustmentSoftLiveGateAscentModulationMassWeighted,
    saturationAdjustmentSoftLiveGateAppliedSuppressionMass,
    saturationAdjustmentSoftLiveGateRetainedVaporMass,
    saturationAdjustmentSoftLiveGateSinkExportMass,
    saturationAdjustmentSoftLiveGateBufferedRainoutMass,
    saturationAdjustmentSoftLiveGateEquatorwardExportMass,
    saturationAdjustmentShoulderGuardCandidateMass,
    saturationAdjustmentShoulderGuardPotentialSuppressedMass,
    saturationAdjustmentShoulderGuardEventCount,
    saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted,
    saturationAdjustmentShoulderGuardBandWindowMassWeighted,
    saturationAdjustmentShoulderGuardSelectorSupportMassWeighted,
    saturationAdjustmentShoulderGuardAppliedSuppressionMass,
    saturationAdjustmentShoulderGuardRetainedVaporMass,
    saturationAdjustmentShoulderGuardSinkExportMass,
    saturationAdjustmentShoulderGuardBufferedRainoutMass,
    weakAscentCloudBirthAccumMass,
    strongAscentCloudBirthAccumMass,
    resolvedAscentCloudBirthByBandMass,
    saturationAdjustmentCloudBirthByBandMass,
    convectiveDetrainmentCloudBirthByBandMass,
    carryOverUpperCloudEnteringByBandMass,
    carryOverUpperCloudSurvivingByBandMass,
    advectedCloudImportByBandMass,
    advectedCloudExportByBandMass,
    prevUpperCloudBandMass,
    upperCloudResidenceTimeSeconds,
    upperCloudTimeSinceLocalBirthSeconds,
    upperCloudTimeSinceImportSeconds,
    upperCloudFreshBornMass,
    upperCloudRecentlyImportedMass,
    upperCloudStaleMass,
    upperCloudPassiveSurvivalMass,
    upperCloudRegenerationMass,
    upperCloudOscillatoryMass,
    upperCloudPotentialErosionMass,
    upperCloudAppliedErosionMass,
    upperCloudBlockedErosionMass,
    upperCloudBlockedByWeakSubsidenceMass,
    upperCloudBlockedByWeakDescentVentMass,
    upperCloudBlockedByLocalSupportMass,
    upperCloudResidenceTimeMassWeightedSeconds,
    upperCloudTimeSinceLocalBirthMassWeightedSeconds,
    upperCloudTimeSinceImportMassWeightedSeconds,
    upperCloudFreshBornAccumMass,
    upperCloudRecentlyImportedAccumMass,
    upperCloudStaleAccumMass,
    upperCloudPassiveSurvivalAccumMass,
    upperCloudRegenerationAccumMass,
    upperCloudOscillatoryAccumMass,
    upperCloudPotentialErosionAccumMass,
    upperCloudAppliedErosionAccumMass,
    upperCloudBlockedErosionAccumMass,
    upperCloudBlockedByWeakSubsidenceAccumMass,
    upperCloudBlockedByWeakDescentVentAccumMass,
    upperCloudBlockedByLocalSupportAccumMass,
    upperCloudPotentialErosionByBandMass,
    upperCloudAppliedErosionByBandMass,
    upperCloudBlockedErosionByBandMass,
    microphysicsCloudToPrecipByBandMass,
    cloudReevaporationByBandMass,
    precipReevaporationByBandMass,
    microphysicsUpperCloudInputMass,
    microphysicsUpperCloudSaturationBirthMass,
    microphysicsUpperCloudCloudReevaporationMass,
    microphysicsUpperCloudPrecipReevaporationMass,
    microphysicsUpperCloudSedimentationExportMass,
    microphysicsUpperCloudCloudToPrecipMass,
    microphysicsUpperCloudOutputMass,
    microphysicsUpperCloudResidualMass,
    radiativePersistenceEquivalentByBandMass,
    upperCloudShortwaveAbsorptionWm2,
    upperCloudLongwaveRelaxationBoost,
    upperCloudRadiativePersistenceSupportWm2,
    upperCloudClearSkyLwCoolingWm2,
    upperCloudCloudyLwCoolingWm2,
    upperCloudLwCloudEffectWm2,
    upperCloudNetCloudRadiativeEffectWm2,
    surfaceCloudShortwaveShieldingWm2,
    helperNativeDryingSupportMass,
    helperNativeDryingSupportByBandMass,
    nudgingMoisteningMass,
    nudgingOpposedDryingMass,
    nudgingTargetQvMismatchAccum,
    nudgingTargetThetaMismatchAccum,
    nudgingTargetWindMismatchAccum,
    nudgingTargetQvSampleCount,
    nudgingTargetThetaSampleCount,
    nudgingTargetWindSampleCount,
    analysisMoisteningMass,
    analysisOpposedDryingMass,
    analysisTargetQvMismatchAccum,
    analysisTargetThetaMismatchAccum,
    analysisTargetWindMismatchAccum,
    analysisTargetQvSampleCount,
    analysisTargetThetaSampleCount,
    analysisTargetWindSampleCount,
    windOpposedDryingCorrection,
    windTargetMismatchAccum,
    windTargetSampleCount,
    nudgingMoisteningByBandMass,
    nudgingOpposedDryingByBandMass,
    analysisMoisteningByBandMass,
    analysisOpposedDryingByBandMass,
    nudgingQvTargetMismatchByBand,
    nudgingThetaTargetMismatchByBand,
    nudgingWindTargetMismatchByBand,
    analysisQvTargetMismatchByBand,
    analysisThetaTargetMismatchByBand,
    analysisWindTargetMismatchByBand,
    windOpposedDryingByBandCorrection,
    windTargetMismatchByBand,
    numericalBacktraceClampCount,
    numericalBacktraceClampExcessCells,
    numericalBacktraceClampByBandCount,
    numericalNegativeClipCount,
    numericalNegativeClipMass,
    numericalNegativeClipByBandMass,
    numericalSupersaturationClampCount,
    numericalSupersaturationClampMass,
    numericalSupersaturationClampByBandMass,
    numericalCloudLimiterCount,
    numericalCloudLimiterMass,
    numericalCloudLimiterByBandMass,
    numericalVerticalCflClampCount,
    numericalVerticalCflClampMass,
    numericalVerticalCflClampByBandMass,
    numericalAdvectionWaterRepairMass,
    numericalAdvectionWaterAddedMass,
    numericalAdvectionWaterRemovedMass,
    verticalSubtropicalDryingDemandMass,
    verticalCloudErosionToVaporMass,
    ...sourceTracer3D,
    surfaceEvapPotentialRate,
    surfaceEvapTransferCoeff,
    surfaceEvapWindSpeed,
    surfaceEvapHumidityGradient,
    surfaceEvapSurfaceTemp,
    surfaceEvapAirTemp,
    surfaceEvapSoilGate,
    surfaceEvapRunoffLossRate,
    surfaceEvapSeaIceSuppression,
    surfaceEvapSurfaceSaturationMixingRatio,
    surfaceEvapAirMixingRatio,
    soilCap,
    analysisIauPs,
    analysisIauTs,
    analysisIauU,
    analysisIauV,
    analysisIauTheta,
    analysisIauQv,
    sstNow,
    seaIceFrac,
    seaIceThicknessM,
    surfaceRadiativeFlux,
    pHalf,
    pMid,
    phiHalf,
    phiMid,
    omega,
    Tv,
    T
  };
}
