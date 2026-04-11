import { SURFACE_MOISTURE_SOURCE_TRACERS } from './sourceTracing5.js';
import { CLOUD_BIRTH_LEVEL_BAND_COUNT } from './cloudBirthTracing5.js';

const makeArray = (size, value = 0) => {
  const arr = new Float32Array(size);
  if (value !== 0) arr.fill(value);
  return arr;
};

export function createState5({ grid, nz = 26, sigmaHalf } = {}) {
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
  const surfaceEvapRate = makeArray(N);
  const surfaceLatentFlux = makeArray(N);
  const surfaceSensibleFlux = makeArray(N);
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
  const subtropicalSubsidenceDrying = makeArray(N);
  const resolvedAscentCloudBirthPotential = makeArray(N);
  const largeScaleCondensationSource = makeArray(N);
  const cloudReevaporationMass = makeArray(N);
  const precipReevaporationMass = makeArray(N);
  const upperCloudPath = makeArray(N);
  const importedAnvilPersistenceMass = makeArray(N);
  const carriedOverUpperCloudMass = makeArray(N);
  const weakErosionCloudSurvivalMass = makeArray(N);
  const resolvedAscentCloudBirthAccumMass = makeArray(N);
  const saturationAdjustmentCloudBirthAccumMass = makeArray(N);
  const convectiveDetrainmentCloudBirthAccumMass = makeArray(N);
  const carryOverUpperCloudEnteringAccumMass = makeArray(N);
  const carryOverUpperCloudSurvivingAccumMass = makeArray(N);
  const saturationAdjustmentEventCount = new Uint32Array(N);
  const saturationAdjustmentSupersaturationMassWeighted = makeArray(N);
  const saturationAdjustmentOmegaMassWeighted = makeArray(N);
  const weakAscentCloudBirthAccumMass = makeArray(N);
  const strongAscentCloudBirthAccumMass = makeArray(N);
  const resolvedAscentCloudBirthByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const saturationAdjustmentCloudBirthByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const convectiveDetrainmentCloudBirthByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const carryOverUpperCloudEnteringByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  const carryOverUpperCloudSurvivingByBandMass = makeArray(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
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
    surfaceEvapRate,
    surfaceLatentFlux,
    surfaceSensibleFlux,
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
    subtropicalSubsidenceDrying,
    resolvedAscentCloudBirthPotential,
    largeScaleCondensationSource,
    cloudReevaporationMass,
    precipReevaporationMass,
    upperCloudPath,
    importedAnvilPersistenceMass,
    carriedOverUpperCloudMass,
    weakErosionCloudSurvivalMass,
    resolvedAscentCloudBirthAccumMass,
    saturationAdjustmentCloudBirthAccumMass,
    convectiveDetrainmentCloudBirthAccumMass,
    carryOverUpperCloudEnteringAccumMass,
    carryOverUpperCloudSurvivingAccumMass,
    saturationAdjustmentEventCount,
    saturationAdjustmentSupersaturationMassWeighted,
    saturationAdjustmentOmegaMassWeighted,
    weakAscentCloudBirthAccumMass,
    strongAscentCloudBirthAccumMass,
    resolvedAscentCloudBirthByBandMass,
    saturationAdjustmentCloudBirthByBandMass,
    convectiveDetrainmentCloudBirthByBandMass,
    carryOverUpperCloudEnteringByBandMass,
    carryOverUpperCloudSurvivingByBandMass,
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
    upperCloudShortwaveAbsorptionWm2,
    upperCloudLongwaveRelaxationBoost,
    upperCloudRadiativePersistenceSupportWm2,
    upperCloudClearSkyLwCoolingWm2,
    upperCloudCloudyLwCoolingWm2,
    upperCloudLwCloudEffectWm2,
    upperCloudNetCloudRadiativeEffectWm2,
    surfaceCloudShortwaveShieldingWm2,
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
