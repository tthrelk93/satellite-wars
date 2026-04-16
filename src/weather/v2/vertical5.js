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
import { classifyNhDryBeltSector } from './sourceTracing5.js';

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
export const computeTransitionReturnFlowCouplingFrac = ({
  enabled,
  returnFlowOpportunity,
  opportunity0,
  opportunity1,
  maxFrac
}) => {
  if (!enabled) return 0;
  return clamp(
    maxFrac * smoothstep(opportunity0, opportunity1, returnFlowOpportunity),
    0,
    maxFrac
  );
};
export const computeSubtropicalBalanceContract = ({
  dryDriver,
  sourceDriver,
  latShape,
  descentSupport,
  existingOmegaPaS,
  crossHemiFloorShare,
  weakHemiFloorTaperFrac,
  organizedSupport,
  convectivePotential
}) => {
  const partitionSupport = clamp01(
    0.55 * smoothstep(0.04, 0.18, dryDriver)
      + 0.25 * clamp01(latShape)
      + 0.2 * smoothstep(0.06, 0.24, sourceDriver)
  );
  const circulationSupport = clamp01(
    0.4 * clamp01(descentSupport)
      + 0.2 * smoothstep(0.04, 0.18, Math.max(0, existingOmegaPaS))
      + 0.15 * (1 - clamp01(crossHemiFloorShare))
      + 0.1 * smoothstep(0.015, 0.11, weakHemiFloorTaperFrac)
      + 0.15 * (1 - clamp01(0.55 * organizedSupport + 0.45 * convectivePotential))
  );
  return {
    partitionSupport,
    circulationSupport,
    contractSupport: clamp01(partitionSupport * (0.4 + 0.6 * circulationSupport))
  };
};
export const computeDryingOmegaBridgePaS = ({
  enabled,
  dryDriver,
  suppressedSource,
  latShape,
  organizedSupport,
  convectivePotential,
  neutralToSubsidingSupport,
  existingOmegaPaS,
  dry0,
  dry1,
  suppressedSource0,
  suppressedSource1,
  maxPaS
}) => {
  if (!enabled) return 0;
  const drySupport = smoothstep(dry0, dry1, dryDriver);
  const sourceSupport = smoothstep(suppressedSource0, suppressedSource1, suppressedSource);
  const weakEngineSupport = clamp01(
    0.6 * (1 - clamp01(organizedSupport)) +
    0.4 * (1 - clamp01(convectivePotential))
  );
  const neutralSupport = clamp01(neutralToSubsidingSupport);
  const existingDescentTaper = 1 - smoothstep(0.08, 0.22, Math.max(0, existingOmegaPaS));
  return clamp(
    maxPaS
      * clamp01(latShape)
      * drySupport
      * sourceSupport
      * weakEngineSupport
      * (0.55 + 0.45 * neutralSupport)
      * existingDescentTaper,
    0,
    maxPaS
  );
};
export const computeDryingOmegaBridgeSourceSupport = ({
  enabled,
  latAbs,
  sourceLat0,
  sourceLat1,
  leakLat0,
  leakLat1
}) => {
  if (!enabled) return 0;
  const sourceWindow = smoothstep(sourceLat0 - 2, sourceLat0 + 2, latAbs)
    * (1 - smoothstep(sourceLat1 - 2, sourceLat1 + 2, latAbs));
  const leakPenalty = smoothstep(leakLat0, leakLat1, latAbs);
  return clamp01(sourceWindow * leakPenalty);
};
export const computeDryingOmegaBridgeTargetWeight = ({
  enabled,
  latAbs,
  targetLat0,
  targetLat1,
  organizedSupport,
  convectivePotential,
  neutralToSubsidingSupport,
  existingOmegaPaS
}) => {
  if (!enabled) return 0;
  const targetWindow = smoothstep(targetLat0 - 2, targetLat0 + 2, latAbs)
    * (1 - smoothstep(targetLat1 - 2, targetLat1 + 2, latAbs));
  const weakEngineSupport = clamp01(
    0.6 * (1 - clamp01(organizedSupport)) +
    0.4 * (1 - clamp01(convectivePotential))
  );
  const neutralSupport = clamp01(neutralToSubsidingSupport);
  const existingDescentTaper = 1 - smoothstep(0.08, 0.22, Math.max(0, existingOmegaPaS));
  return clamp01(
    targetWindow
      * weakEngineSupport
      * (0.55 + 0.45 * neutralSupport)
      * existingDescentTaper
  );
};
export const computeProjectedOmegaBridgeCellPaS = ({
  enabled,
  budgetPaS,
  targetWeight,
  totalTargetWeight,
  projectedMaxPaS
}) => {
  if (!enabled) return 0;
  if (!(budgetPaS > 0) || !(targetWeight > 0) || !(totalTargetWeight > 1e-12)) return 0;
  return clamp(
    budgetPaS * (targetWeight / totalTargetWeight),
    0,
    projectedMaxPaS
  );
};
export const computeEquatorialEdgeSubsidenceGuardSourceSupport = ({
  enabled,
  latAbs,
  sourceLat0,
  sourceLat1,
  sourceWindow,
  subtropicalBand,
  neutralToSubsidingSupport,
  existingOmegaPaS
}) => {
  if (!enabled) return 0;
  const bilateralSourceWindow = sourceWindow ?? (
    smoothstep(sourceLat0 - 2, sourceLat0 + 2, latAbs)
      * (1 - smoothstep(sourceLat1 - 2, sourceLat1 + 2, latAbs))
  );
  const localDescentSupport = smoothstep(0.04, 0.18, Math.max(0, existingOmegaPaS));
  return clamp01(
    clamp01(bilateralSourceWindow)
      * (0.45 + 0.55 * clamp01(subtropicalBand))
      * (0.4 + 0.6 * clamp01(neutralToSubsidingSupport))
      * localDescentSupport
  );
};
export const computeEquatorialEdgeNorthsideLeakPenaltyFrac = ({
  enabled,
  sourceWindow,
  admissionRisk,
  risk0,
  risk1,
  maxFrac
}) => {
  if (!enabled) return 0;
  return clamp(
    maxFrac * clamp01(sourceWindow) * smoothstep(risk0, risk1, admissionRisk),
    0,
    maxFrac
  );
};
export const computeEquatorialEdgeNorthsideLeakSourceWindowFrac = ({
  enabled,
  latDeg,
  lat0,
  lat1
}) => {
  if (!enabled || !(latDeg > 0)) return 0;
  return clamp01(
    smoothstep(lat0 - 1.5, lat0 + 1.5, latDeg)
      * (1 - smoothstep(lat1 - 1.5, lat1 + 1.5, latDeg))
  );
};
export const computeEquatorialEdgeNorthsideLeakRiskFrac = ({
  enabled,
  subtropicalBand,
  neutralToSubsidingSupport,
  existingOmegaPaS
}) => {
  if (!enabled) return 0;
  return clamp01(
    0.55 * clamp01(subtropicalBand)
      + 0.3 * clamp01(neutralToSubsidingSupport)
      + 0.15 * smoothstep(0.05, 0.18, Math.max(0, existingOmegaPaS))
  );
};
export const computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac = ({
  enabled,
  sourceWindow,
  fanoutRisk
}) => {
  if (!enabled) return 0;
  if (!(sourceWindow > 1e-12) || !(fanoutRisk > 0)) return 0;
  return clamp01(fanoutRisk / sourceWindow);
};
export const computeWeakHemiCrossHemiFloorTaperFrac = ({
  enabled,
  meanTropicalSource,
  hemiSource,
  sourceDriverFloor,
  weakHemiFrac,
  crossHemiFloorShare,
  northsideLeakPenaltySignal,
  penalty0,
  penalty1,
  overhang0,
  overhang1,
  maxFrac
}) => {
  if (!enabled) return 0;
  if (!(meanTropicalSource > 1e-12) || !(sourceDriverFloor > hemiSource)) return 0;
  if (!(weakHemiFrac > 0) || !(crossHemiFloorShare > 0) || !(northsideLeakPenaltySignal > 0)) return 0;
  const effectiveFloorFrac = sourceDriverFloor / meanTropicalSource;
  const neutralFloorFrac = hemiSource / meanTropicalSource;
  const overhangFrac = Math.max(0, effectiveFloorFrac - neutralFloorFrac);
  if (!(overhangFrac > 0)) return 0;
  const leakGate = smoothstep(penalty0, penalty1, northsideLeakPenaltySignal);
  const weakGate = smoothstep(0.15, 0.45, weakHemiFrac);
  const floorGate = smoothstep(0.05, 0.2, crossHemiFloorShare);
  const overhangGate = smoothstep(overhang0, overhang1, overhangFrac);
  return clamp(
    Math.min(overhangFrac, maxFrac) * leakGate * weakGate * floorGate * overhangGate,
    0,
    Math.min(overhangFrac, maxFrac)
  );
};
export const computeNorthSourceConcentrationPenaltyFrac = ({
  enabled,
  latDeg,
  leakPenaltyFrac,
  sourceSupport,
  signal0,
  signal1,
  support0,
  support1,
  maxFrac
}) => {
  if (!enabled) return 0;
  if (!(latDeg > 0) || !(leakPenaltyFrac > 0) || !(sourceSupport > 0)) return 0;
  return clamp(
    maxFrac
      * smoothstep(signal0, signal1, leakPenaltyFrac)
      * smoothstep(support0, support1, sourceSupport),
    0,
    maxFrac
  );
};
export const computeAtlanticDryCoreReceiverTaperFrac = ({
  enabled,
  latDeg,
  lonDeg,
  isLand,
  northsideLeakPenaltySignal,
  dryDriver,
  existingOmegaPaS,
  signal0,
  signal1,
  lat0,
  lat1,
  dry0,
  dry1,
  omega0,
  omega1,
  maxFrac
}) => {
  if (!enabled || !(latDeg > 0) || isLand) return 0;
  if (classifyNhDryBeltSector({ lonDeg, isLand }) !== 'atlantic') return 0;
  const latAbs = Math.abs(latDeg);
  const latSupport = smoothstep(lat0 - 1.5, lat0 + 1.5, latAbs)
    * (1 - smoothstep(lat1 - 1.5, lat1 + 1.5, latAbs));
  if (!(latSupport > 0)) return 0;
  return clamp(
    maxFrac
      * latSupport
      * smoothstep(signal0, signal1, northsideLeakPenaltySignal)
      * smoothstep(dry0, dry1, dryDriver)
      * smoothstep(omega0, omega1, Math.max(0, existingOmegaPaS)),
    0,
    maxFrac
  );
};
export const computeAtlanticTransitionCarryoverContainmentFrac = ({
  enabled,
  receiverPatchEnabled,
  latDeg,
  lonDeg,
  isLand,
  carrierSignal,
  overlapMass,
  dryDriver,
  existingOmegaPaS,
  signal0,
  signal1,
  lat0,
  lat1,
  overlap0,
  overlap1,
  dry0,
  dry1,
  omega0,
  omega1,
  maxFrac
}) => {
  if (!enabled || !receiverPatchEnabled || !(latDeg > 0) || isLand) return 0;
  if (classifyNhDryBeltSector({ lonDeg, isLand }) !== 'atlantic') return 0;
  const latAbs = Math.abs(latDeg);
  const latSupport = smoothstep(lat0 - 1.5, lat0 + 1.5, latAbs)
    * (1 - smoothstep(lat1 - 1.5, lat1 + 1.5, latAbs));
  if (!(latSupport > 0)) return 0;
  return clamp(
    maxFrac
      * latSupport
      * smoothstep(signal0, signal1, carrierSignal)
      * smoothstep(overlap0, overlap1, overlapMass)
      * smoothstep(dry0, dry1, dryDriver)
      * smoothstep(omega0, omega1, Math.max(0, existingOmegaPaS)),
    0,
    maxFrac
  );
};
export const computeEquatorialEdgeSubsidenceGuardTargetWeight = ({
  enabled,
  latAbs,
  targetLat0,
  targetLat1,
  targetWindow,
  edgeGateSupport,
  organizedSupport,
  convectivePotential,
  existingOmegaPaS
}) => {
  if (!enabled) return 0;
  const bilateralTargetWindow = targetWindow ?? (
    smoothstep(targetLat0 - 1.5, targetLat0 + 1.5, latAbs)
      * (1 - smoothstep(targetLat1 - 1.5, targetLat1 + 1.5, latAbs))
  );
  const weakEngineSupport = clamp01(
    0.6 * (1 - clamp01(organizedSupport)) +
    0.4 * (1 - clamp01(convectivePotential))
  );
  const missingEdgeSupport = 1 - clamp01(edgeGateSupport);
  const existingDescentTaper = 1 - smoothstep(0.08, 0.2, Math.max(0, existingOmegaPaS));
  return clamp01(
    clamp01(bilateralTargetWindow)
      * weakEngineSupport
      * (0.55 + 0.45 * missingEdgeSupport)
      * existingDescentTaper
  );
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
  'enableTransitionReturnFlowCoupling',
  'circulationReturnFlowCouplingOpportunity0',
  'circulationReturnFlowCouplingOpportunity1',
  'circulationReturnFlowCouplingMaxFrac',
  'enableDryingOmegaBridge',
  'dryingOmegaBridgeDry0',
  'dryingOmegaBridgeDry1',
  'dryingOmegaBridgeSuppressedSource0',
  'dryingOmegaBridgeSuppressedSource1',
  'dryingOmegaBridgeMaxPaS',
  'dryingOmegaBridgeProjectedShareMaxFrac',
  'dryingOmegaBridgeSourceLat0',
  'dryingOmegaBridgeSourceLat1',
  'dryingOmegaBridgeTargetLat0',
  'dryingOmegaBridgeTargetLat1',
  'dryingOmegaBridgeEquatorwardLeakLat0',
  'dryingOmegaBridgeEquatorwardLeakLat1',
  'dryingOmegaBridgeProjectedMaxPaS',
  'enableEquatorialEdgeSubsidenceGuard',
  'equatorialEdgeSubsidenceGuardMaxPaS',
  'equatorialEdgeSubsidenceGuardSourceLat0',
  'equatorialEdgeSubsidenceGuardSourceLat1',
  'equatorialEdgeSubsidenceGuardTargetLat0',
  'equatorialEdgeSubsidenceGuardTargetLat1',
  'equatorialEdgeSubsidenceGuardProjectedMaxPaS',
  'enableNorthsideFanoutLeakPenalty',
  'northsideFanoutLeakPenaltyMaxFrac',
  'northsideFanoutLeakPenaltyLat0',
  'northsideFanoutLeakPenaltyLat1',
  'northsideFanoutLeakPenaltyRisk0',
  'northsideFanoutLeakPenaltyRisk1',
  'enableNorthSourceConcentrationPenalty',
  'northSourceConcentrationPenaltySignal0',
  'northSourceConcentrationPenaltySignal1',
  'northSourceConcentrationPenaltySupport0',
  'northSourceConcentrationPenaltySupport1',
  'northSourceConcentrationPenaltyMaxFrac',
  'enableAtlanticDryCoreReceiverTaper',
  'atlanticDryCoreReceiverTaperSignal0',
  'atlanticDryCoreReceiverTaperSignal1',
  'atlanticDryCoreReceiverTaperLat0',
  'atlanticDryCoreReceiverTaperLat1',
  'atlanticDryCoreReceiverTaperDry0',
  'atlanticDryCoreReceiverTaperDry1',
  'atlanticDryCoreReceiverTaperOmega0',
  'atlanticDryCoreReceiverTaperOmega1',
  'atlanticDryCoreReceiverTaperMaxFrac',
  'enableWeakHemiCrossHemiFloorTaper',
  'weakHemiCrossHemiFloorTaperPenalty0',
  'weakHemiCrossHemiFloorTaperPenalty1',
  'weakHemiCrossHemiFloorTaperOverhang0',
  'weakHemiCrossHemiFloorTaperOverhang1',
  'weakHemiCrossHemiFloorTaperMaxFrac',
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
    enableTransitionReturnFlowCoupling = false,
    circulationReturnFlowCouplingOpportunity0 = 0.0002,
    circulationReturnFlowCouplingOpportunity1 = 0.0012,
    circulationReturnFlowCouplingMaxFrac = 0.14,
    enableDryingOmegaBridge = false,
    dryingOmegaBridgeDry0 = 0.08,
    dryingOmegaBridgeDry1 = 0.16,
    dryingOmegaBridgeSuppressedSource0 = 0.0007,
    dryingOmegaBridgeSuppressedSource1 = 0.0016,
    dryingOmegaBridgeMaxPaS = 0.018,
    dryingOmegaBridgeProjectedShareMaxFrac = 0.65,
    dryingOmegaBridgeSourceLat0 = 20,
    dryingOmegaBridgeSourceLat1 = 30,
    dryingOmegaBridgeTargetLat0 = 30,
    dryingOmegaBridgeTargetLat1 = 45,
    dryingOmegaBridgeEquatorwardLeakLat0 = 18,
    dryingOmegaBridgeEquatorwardLeakLat1 = 22,
    dryingOmegaBridgeProjectedMaxPaS = 0.006,
    enableEquatorialEdgeSubsidenceGuard = false,
    equatorialEdgeSubsidenceGuardMaxPaS = 0.007,
    equatorialEdgeSubsidenceGuardSourceLat0 = 8,
    equatorialEdgeSubsidenceGuardSourceLat1 = 14,
    equatorialEdgeSubsidenceGuardTargetLat0 = 2,
    equatorialEdgeSubsidenceGuardTargetLat1 = 6,
    equatorialEdgeSubsidenceGuardProjectedMaxPaS = 0.0035,
    enableNorthsideFanoutLeakPenalty = false,
    northsideFanoutLeakPenaltyMaxFrac = 0.28,
    northsideFanoutLeakPenaltyLat0 = 9,
    northsideFanoutLeakPenaltyLat1 = 13,
    northsideFanoutLeakPenaltyRisk0 = 0.32,
    northsideFanoutLeakPenaltyRisk1 = 0.5,
    enableNorthSourceConcentrationPenalty = false,
    northSourceConcentrationPenaltySignal0 = 0.035,
    northSourceConcentrationPenaltySignal1 = 0.065,
    northSourceConcentrationPenaltySupport0 = 0.08,
    northSourceConcentrationPenaltySupport1 = 0.16,
    northSourceConcentrationPenaltyMaxFrac = 0.14,
    enableAtlanticDryCoreReceiverTaper = false,
    atlanticDryCoreReceiverTaperSignal0 = 0.04,
    atlanticDryCoreReceiverTaperSignal1 = 0.075,
    atlanticDryCoreReceiverTaperLat0 = 22,
    atlanticDryCoreReceiverTaperLat1 = 30,
    atlanticDryCoreReceiverTaperDry0 = 0.12,
    atlanticDryCoreReceiverTaperDry1 = 0.24,
    atlanticDryCoreReceiverTaperOmega0 = 0.12,
    atlanticDryCoreReceiverTaperOmega1 = 0.26,
    atlanticDryCoreReceiverTaperMaxFrac = 0.16,
    enableAtlanticTransitionCarryoverContainment = false,
    atlanticTransitionCarryoverContainmentSignal0 = 0.04,
    atlanticTransitionCarryoverContainmentSignal1 = 0.075,
    atlanticTransitionCarryoverContainmentLat0 = 18,
    atlanticTransitionCarryoverContainmentLat1 = 22.5,
    atlanticTransitionCarryoverContainmentOverlap0 = 0.08,
    atlanticTransitionCarryoverContainmentOverlap1 = 0.18,
    atlanticTransitionCarryoverContainmentDry0 = 0.12,
    atlanticTransitionCarryoverContainmentDry1 = 0.24,
    atlanticTransitionCarryoverContainmentOmega0 = 0.12,
    atlanticTransitionCarryoverContainmentOmega1 = 0.26,
    atlanticTransitionCarryoverContainmentMaxFrac = 0.18,
    enableWeakHemiCrossHemiFloorTaper = false,
    weakHemiCrossHemiFloorTaperPenalty0 = 0.02,
    weakHemiCrossHemiFloorTaperPenalty1 = 0.06,
    weakHemiCrossHemiFloorTaperOverhang0 = 0.06,
    weakHemiCrossHemiFloorTaperOverhang1 = 0.12,
    weakHemiCrossHemiFloorTaperMaxFrac = 0.145,
    upperCloudWeakErosionSupportScale = 1.0,
    upperCloudPersistenceSupportScale = 1.0,
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

  const { nx, ny, invDx, invDy, cosLat, lonDeg } = grid;
  const { N, nz, u, v, omega, theta, qv, qc, qi, qr, qs, T, pHalf, pMid, sigmaHalf, dpsDtApplied, landMask } = state;

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
  if (!state.freshShoulderLatitudeWindowDiag || state.freshShoulderLatitudeWindowDiag.length !== N) state.freshShoulderLatitudeWindowDiag = new Float32Array(N);
  if (!state.freshShoulderEquatorialEdgeWindowDiag || state.freshShoulderEquatorialEdgeWindowDiag.length !== N) state.freshShoulderEquatorialEdgeWindowDiag = new Float32Array(N);
  if (!state.freshShoulderInnerWindowDiag || state.freshShoulderInnerWindowDiag.length !== N) state.freshShoulderInnerWindowDiag = new Float32Array(N);
  if (!state.freshShoulderEquatorialEdgeGateSupportDiag || state.freshShoulderEquatorialEdgeGateSupportDiag.length !== N) state.freshShoulderEquatorialEdgeGateSupportDiag = new Float32Array(N);
  if (!state.freshShoulderTargetEntryExclusionDiag || state.freshShoulderTargetEntryExclusionDiag.length !== N) state.freshShoulderTargetEntryExclusionDiag = new Float32Array(N);
  if (!state.freshNeutralToSubsidingSupportDiag || state.freshNeutralToSubsidingSupportDiag.length !== N) state.freshNeutralToSubsidingSupportDiag = new Float32Array(N);
  if (!state.freshRhMidSupportDiag || state.freshRhMidSupportDiag.length !== N) state.freshRhMidSupportDiag = new Float32Array(N);
  if (!state.circulationReboundContainmentDiag || state.circulationReboundContainmentDiag.length !== N) state.circulationReboundContainmentDiag = new Float32Array(N);
  if (!state.circulationReboundActivitySuppressionDiag || state.circulationReboundActivitySuppressionDiag.length !== N) state.circulationReboundActivitySuppressionDiag = new Float32Array(N);
  if (!state.circulationReboundSourceSuppressionDiag || state.circulationReboundSourceSuppressionDiag.length !== N) state.circulationReboundSourceSuppressionDiag = new Float32Array(N);
  if (!state.circulationReboundRawSourceDiag || state.circulationReboundRawSourceDiag.length !== N) state.circulationReboundRawSourceDiag = new Float32Array(N);
  if (!state.circulationReboundSuppressedSourceDiag || state.circulationReboundSuppressedSourceDiag.length !== N) state.circulationReboundSuppressedSourceDiag = new Float32Array(N);
  if (!state.circulationReturnFlowOpportunityDiag || state.circulationReturnFlowOpportunityDiag.length !== N) state.circulationReturnFlowOpportunityDiag = new Float32Array(N);
  if (!state.circulationReturnFlowCouplingAppliedDiag || state.circulationReturnFlowCouplingAppliedDiag.length !== N) state.circulationReturnFlowCouplingAppliedDiag = new Float32Array(N);
  if (!state.dryingOmegaBridgeAppliedDiag || state.dryingOmegaBridgeAppliedDiag.length !== N) state.dryingOmegaBridgeAppliedDiag = new Float32Array(N);
  if (!state.dryingOmegaBridgeLocalAppliedDiag || state.dryingOmegaBridgeLocalAppliedDiag.length !== N) state.dryingOmegaBridgeLocalAppliedDiag = new Float32Array(N);
  if (!state.dryingOmegaBridgeProjectedAppliedDiag || state.dryingOmegaBridgeProjectedAppliedDiag.length !== N) state.dryingOmegaBridgeProjectedAppliedDiag = new Float32Array(N);
  if (!state.equatorialEdgeSubsidenceGuardSourceSupportDiag || state.equatorialEdgeSubsidenceGuardSourceSupportDiag.length !== N) state.equatorialEdgeSubsidenceGuardSourceSupportDiag = new Float32Array(N);
  if (!state.equatorialEdgeSubsidenceGuardTargetWeightDiag || state.equatorialEdgeSubsidenceGuardTargetWeightDiag.length !== N) state.equatorialEdgeSubsidenceGuardTargetWeightDiag = new Float32Array(N);
  if (!state.equatorialEdgeSubsidenceGuardAppliedDiag || state.equatorialEdgeSubsidenceGuardAppliedDiag.length !== N) state.equatorialEdgeSubsidenceGuardAppliedDiag = new Float32Array(N);
  if (!state.equatorialEdgeNorthsideLeakSourceWindowDiag || state.equatorialEdgeNorthsideLeakSourceWindowDiag.length !== N) state.equatorialEdgeNorthsideLeakSourceWindowDiag = new Float32Array(N);
  if (!state.equatorialEdgeNorthsideLeakRiskDiag || state.equatorialEdgeNorthsideLeakRiskDiag.length !== N) state.equatorialEdgeNorthsideLeakRiskDiag = new Float32Array(N);
  if (!state.equatorialEdgeNorthsideLeakAdmissionRiskDiag || state.equatorialEdgeNorthsideLeakAdmissionRiskDiag.length !== N) state.equatorialEdgeNorthsideLeakAdmissionRiskDiag = new Float32Array(N);
  if (!state.equatorialEdgeNorthsideLeakPenaltyDiag || state.equatorialEdgeNorthsideLeakPenaltyDiag.length !== N) state.equatorialEdgeNorthsideLeakPenaltyDiag = new Float32Array(N);
  if (!state.northSourceConcentrationPenaltyDiag || state.northSourceConcentrationPenaltyDiag.length !== N) state.northSourceConcentrationPenaltyDiag = new Float32Array(N);
  if (!state.northSourceConcentrationAppliedDiag || state.northSourceConcentrationAppliedDiag.length !== N) state.northSourceConcentrationAppliedDiag = new Float32Array(N);
  if (!state.atlanticDryCoreReceiverTaperDiag || state.atlanticDryCoreReceiverTaperDiag.length !== N) state.atlanticDryCoreReceiverTaperDiag = new Float32Array(N);
  if (!state.atlanticDryCoreReceiverTaperAppliedDiag || state.atlanticDryCoreReceiverTaperAppliedDiag.length !== N) state.atlanticDryCoreReceiverTaperAppliedDiag = new Float32Array(N);
  if (!state.atlanticTransitionCarryoverContainmentDiag || state.atlanticTransitionCarryoverContainmentDiag.length !== N) state.atlanticTransitionCarryoverContainmentDiag = new Float32Array(N);
  if (!state.atlanticTransitionCarryoverContainmentAppliedDiag || state.atlanticTransitionCarryoverContainmentAppliedDiag.length !== N) state.atlanticTransitionCarryoverContainmentAppliedDiag = new Float32Array(N);
  if (!state.subtropicalSourceDriverDiag || state.subtropicalSourceDriverDiag.length !== N) state.subtropicalSourceDriverDiag = new Float32Array(N);
  if (!state.subtropicalSourceDriverFloorDiag || state.subtropicalSourceDriverFloorDiag.length !== N) state.subtropicalSourceDriverFloorDiag = new Float32Array(N);
  if (!state.subtropicalLocalHemiSourceDiag || state.subtropicalLocalHemiSourceDiag.length !== N) state.subtropicalLocalHemiSourceDiag = new Float32Array(N);
  if (!state.subtropicalMeanTropicalSourceDiag || state.subtropicalMeanTropicalSourceDiag.length !== N) state.subtropicalMeanTropicalSourceDiag = new Float32Array(N);
  if (!state.subtropicalCrossHemiFloorShareDiag || state.subtropicalCrossHemiFloorShareDiag.length !== N) state.subtropicalCrossHemiFloorShareDiag = new Float32Array(N);
  if (!state.subtropicalBalancePartitionSupportDiag || state.subtropicalBalancePartitionSupportDiag.length !== N) state.subtropicalBalancePartitionSupportDiag = new Float32Array(N);
  if (!state.subtropicalBalanceCirculationSupportDiag || state.subtropicalBalanceCirculationSupportDiag.length !== N) state.subtropicalBalanceCirculationSupportDiag = new Float32Array(N);
  if (!state.subtropicalBalanceContractSupportDiag || state.subtropicalBalanceContractSupportDiag.length !== N) state.subtropicalBalanceContractSupportDiag = new Float32Array(N);
  if (!state.subtropicalWeakHemiFracDiag || state.subtropicalWeakHemiFracDiag.length !== N) state.subtropicalWeakHemiFracDiag = new Float32Array(N);
  if (!state.subtropicalWeakHemiFloorOverhangDiag || state.subtropicalWeakHemiFloorOverhangDiag.length !== N) state.subtropicalWeakHemiFloorOverhangDiag = new Float32Array(N);
  if (!state.subtropicalWeakHemiFloorTaperAppliedDiag || state.subtropicalWeakHemiFloorTaperAppliedDiag.length !== N) state.subtropicalWeakHemiFloorTaperAppliedDiag = new Float32Array(N);
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
  const freshShoulderLatitudeWindowPublicDiag = state.freshShoulderLatitudeWindowDiag;
  const freshShoulderEquatorialEdgeWindowPublicDiag = state.freshShoulderEquatorialEdgeWindowDiag;
  const freshShoulderInnerWindowPublicDiag = state.freshShoulderInnerWindowDiag;
  const freshShoulderEquatorialEdgeGateSupportPublicDiag = state.freshShoulderEquatorialEdgeGateSupportDiag;
  const freshShoulderTargetEntryExclusionPublicDiag = state.freshShoulderTargetEntryExclusionDiag;
  const freshNeutralToSubsidingSupportPublicDiag = state.freshNeutralToSubsidingSupportDiag;
  const freshRhMidSupportPublicDiag = state.freshRhMidSupportDiag;
  const circulationReboundContainmentDiag = state.circulationReboundContainmentDiag;
  const circulationReboundActivitySuppressionDiag = state.circulationReboundActivitySuppressionDiag;
  const circulationReboundSourceSuppressionDiag = state.circulationReboundSourceSuppressionDiag;
  const circulationReboundRawSourceDiag = state.circulationReboundRawSourceDiag;
  const circulationReboundSuppressedSourceDiag = state.circulationReboundSuppressedSourceDiag;
  const circulationReturnFlowOpportunityDiag = state.circulationReturnFlowOpportunityDiag;
  const circulationReturnFlowCouplingAppliedDiag = state.circulationReturnFlowCouplingAppliedDiag;
  const dryingOmegaBridgeAppliedDiag = state.dryingOmegaBridgeAppliedDiag;
  const dryingOmegaBridgeLocalAppliedDiag = state.dryingOmegaBridgeLocalAppliedDiag;
  const dryingOmegaBridgeProjectedAppliedDiag = state.dryingOmegaBridgeProjectedAppliedDiag;
  const equatorialEdgeSubsidenceGuardSourceSupportDiag = state.equatorialEdgeSubsidenceGuardSourceSupportDiag;
  const equatorialEdgeSubsidenceGuardTargetWeightDiag = state.equatorialEdgeSubsidenceGuardTargetWeightDiag;
  const equatorialEdgeSubsidenceGuardAppliedDiag = state.equatorialEdgeSubsidenceGuardAppliedDiag;
  const equatorialEdgeNorthsideLeakSourceWindowDiag = state.equatorialEdgeNorthsideLeakSourceWindowDiag;
  const equatorialEdgeNorthsideLeakRiskDiag = state.equatorialEdgeNorthsideLeakRiskDiag;
  const equatorialEdgeNorthsideLeakAdmissionRiskDiag = state.equatorialEdgeNorthsideLeakAdmissionRiskDiag;
  const equatorialEdgeNorthsideLeakPenaltyDiag = state.equatorialEdgeNorthsideLeakPenaltyDiag;
  const northSourceConcentrationPenaltyDiag = state.northSourceConcentrationPenaltyDiag;
  const northSourceConcentrationAppliedDiag = state.northSourceConcentrationAppliedDiag;
  const atlanticDryCoreReceiverTaperDiag = state.atlanticDryCoreReceiverTaperDiag;
  const atlanticDryCoreReceiverTaperAppliedDiag = state.atlanticDryCoreReceiverTaperAppliedDiag;
  const atlanticTransitionCarryoverContainmentDiag = state.atlanticTransitionCarryoverContainmentDiag;
  const atlanticTransitionCarryoverContainmentAppliedDiag = state.atlanticTransitionCarryoverContainmentAppliedDiag;
  const subtropicalSourceDriverDiag = state.subtropicalSourceDriverDiag;
  const subtropicalSourceDriverFloorDiag = state.subtropicalSourceDriverFloorDiag;
  const subtropicalLocalHemiSourceDiag = state.subtropicalLocalHemiSourceDiag;
  const subtropicalMeanTropicalSourceDiag = state.subtropicalMeanTropicalSourceDiag;
  const subtropicalCrossHemiFloorShareDiag = state.subtropicalCrossHemiFloorShareDiag;
  const subtropicalBalancePartitionSupportDiag = state.subtropicalBalancePartitionSupportDiag;
  const subtropicalBalanceCirculationSupportDiag = state.subtropicalBalanceCirculationSupportDiag;
  const subtropicalBalanceContractSupportDiag = state.subtropicalBalanceContractSupportDiag;
  const subtropicalWeakHemiFracDiag = state.subtropicalWeakHemiFracDiag;
  const subtropicalWeakHemiFloorOverhangDiag = state.subtropicalWeakHemiFloorOverhangDiag;
  const subtropicalWeakHemiFloorTaperAppliedDiag = state.subtropicalWeakHemiFloorTaperAppliedDiag;
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
  circulationReboundRawSourceDiag.fill(0);
  circulationReboundSuppressedSourceDiag.fill(0);
  circulationReturnFlowOpportunityDiag.fill(0);
  circulationReturnFlowCouplingAppliedDiag.fill(0);
  dryingOmegaBridgeAppliedDiag.fill(0);
  dryingOmegaBridgeLocalAppliedDiag.fill(0);
  dryingOmegaBridgeProjectedAppliedDiag.fill(0);
  equatorialEdgeSubsidenceGuardSourceSupportDiag.fill(0);
  equatorialEdgeSubsidenceGuardTargetWeightDiag.fill(0);
  equatorialEdgeSubsidenceGuardAppliedDiag.fill(0);
  equatorialEdgeNorthsideLeakSourceWindowDiag.fill(0);
  equatorialEdgeNorthsideLeakRiskDiag.fill(0);
  equatorialEdgeNorthsideLeakAdmissionRiskDiag.fill(0);
  equatorialEdgeNorthsideLeakPenaltyDiag.fill(0);
  northSourceConcentrationPenaltyDiag.fill(0);
  northSourceConcentrationAppliedDiag.fill(0);
  atlanticDryCoreReceiverTaperDiag.fill(0);
  atlanticDryCoreReceiverTaperAppliedDiag.fill(0);
  atlanticTransitionCarryoverContainmentDiag.fill(0);
  atlanticTransitionCarryoverContainmentAppliedDiag.fill(0);
  subtropicalSourceDriverDiag.fill(0);
  subtropicalSourceDriverFloorDiag.fill(0);
  subtropicalLocalHemiSourceDiag.fill(0);
  subtropicalMeanTropicalSourceDiag.fill(0);
  subtropicalCrossHemiFloorShareDiag.fill(0);
  subtropicalBalancePartitionSupportDiag.fill(0);
  subtropicalBalanceCirculationSupportDiag.fill(0);
  subtropicalBalanceContractSupportDiag.fill(0);
  subtropicalWeakHemiFracDiag.fill(0);
  subtropicalWeakHemiFloorOverhangDiag.fill(0);
  subtropicalWeakHemiFloorTaperAppliedDiag.fill(0);
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

  let northsideLeakCarrierSignalMean = 0;
  state.northsideLeakCarrierSignalMean = 0;

  // Deep convection with entrainment/detrainment
  if (enableConvection) {
    if (!state._omegaPosScratch) state._omegaPosScratch = new Float32Array(N);
    if (!state._instabScratch) state._instabScratch = new Float32Array(N);
    if (!state._rowConvectiveSource || state._rowConvectiveSource.length !== ny) {
      state._rowConvectiveSource = new Float32Array(ny);
    }
    if (!state._rowConvectiveSourceRaw || state._rowConvectiveSourceRaw.length !== ny) {
      state._rowConvectiveSourceRaw = new Float32Array(ny);
    }
    if (!state._rowTransitionSuppressedSource || state._rowTransitionSuppressedSource.length !== ny) {
      state._rowTransitionSuppressedSource = new Float32Array(ny);
    }
    const omegaPos = state._omegaPosScratch;
    const instabArr = state._instabScratch;
    const rowConvectiveSource = state._rowConvectiveSource;
    const rowConvectiveSourceRaw = state._rowConvectiveSourceRaw;
    const rowTransitionSuppressedSource = state._rowTransitionSuppressedSource;
    rowConvectiveSource.fill(0);
    rowConvectiveSourceRaw.fill(0);
    rowTransitionSuppressedSource.fill(0);
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
      const shoulderEquatorialEdgeWindow = latDeg
        ? clamp01(
            smoothstep(1.5, 3.25, latDeg[rowIndex])
              * (1 - smoothstep(5.5, 7.25, latDeg[rowIndex]))
          )
        : 0;
      const shoulderInnerWindow = latDeg
        ? clamp01(
            smoothstep(7.5, 9.25, latDeg[rowIndex])
              * (1 - smoothstep(11.75, 13.75, latDeg[rowIndex]))
          )
        : 0;
      const shoulderLatitudeWindow = Math.max(shoulderEquatorialEdgeWindow, shoulderInnerWindow);
      const shoulderTargetEntryExclusion = latDeg
        ? clamp01(
            smoothstep(28, 33, latDeg[rowIndex])
              * (1 - smoothstep(45, 50, latDeg[rowIndex]))
          )
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
      const shoulderEquatorialEdgeGateSupport = clamp01(
        smoothstep(0.16, 0.42, subtropicalSuppression)
          * (0.7 + 0.3 * smoothstep(0.12, 0.36, subtropicalBand))
          * (0.75 + 0.25 * neutralToSubsidingSupport)
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
      freshShoulderLatitudeWindowPublicDiag[k] = shoulderLatitudeWindow;
      freshShoulderEquatorialEdgeWindowPublicDiag[k] = shoulderEquatorialEdgeWindow;
      freshShoulderInnerWindowPublicDiag[k] = shoulderInnerWindow;
      freshShoulderEquatorialEdgeGateSupportPublicDiag[k] = shoulderEquatorialEdgeGateSupport;
      freshShoulderTargetEntryExclusionPublicDiag[k] = shoulderTargetEntryExclusion;
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
      const rawSourceContribution = (
        0.95 * Math.pow(convectiveOrganization[k], 1.1) * (0.85 + 0.15 * tropicalCore)
        + 0.75 * convMassFluxSupport
      );
      const suppressedSourceContribution = rawSourceContribution * circulationReboundContainment.sourceSuppressFrac;
      const equatorialEdgeSourceSupport = computeEquatorialEdgeSubsidenceGuardSourceSupport({
        enabled: enableEquatorialEdgeSubsidenceGuard,
        latAbs,
        sourceLat0: equatorialEdgeSubsidenceGuardSourceLat0,
        sourceLat1: equatorialEdgeSubsidenceGuardSourceLat1,
        sourceWindow: clamp01(
          smoothstep(equatorialEdgeSubsidenceGuardSourceLat0 - 2, equatorialEdgeSubsidenceGuardSourceLat0 + 2, latAbs)
            * (1 - smoothstep(equatorialEdgeSubsidenceGuardSourceLat1 - 2, equatorialEdgeSubsidenceGuardSourceLat1 + 2, latAbs))
        ),
        subtropicalBand,
        neutralToSubsidingSupport,
        existingOmegaPaS: omegaLow
      });
      const northsideLeakSourceWindow = computeEquatorialEdgeNorthsideLeakSourceWindowFrac({
        enabled: enableNorthsideFanoutLeakPenalty,
        latDeg: latDeg?.[rowIndex] ?? 0,
        lat0: northsideFanoutLeakPenaltyLat0,
        lat1: northsideFanoutLeakPenaltyLat1
      });
      const northsideLeakRisk = computeEquatorialEdgeNorthsideLeakRiskFrac({
        enabled: enableNorthsideFanoutLeakPenalty,
        subtropicalBand,
        neutralToSubsidingSupport,
        existingOmegaPaS: omegaLow
      });
      const northsideLeakAdmissionRisk = computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac({
        enabled: enableNorthsideFanoutLeakPenalty,
        sourceWindow: northsideLeakSourceWindow,
        fanoutRisk: northsideLeakRisk
      });
      const northsideLeakPenaltyFrac = computeEquatorialEdgeNorthsideLeakPenaltyFrac({
        enabled: enableNorthsideFanoutLeakPenalty,
        sourceWindow: northsideLeakSourceWindow,
        admissionRisk: northsideLeakAdmissionRisk,
        risk0: northsideFanoutLeakPenaltyRisk0,
        risk1: northsideFanoutLeakPenaltyRisk1,
        maxFrac: northsideFanoutLeakPenaltyMaxFrac
      });
      const northSourceConcentrationPenaltyFrac = computeNorthSourceConcentrationPenaltyFrac({
        enabled: enableNorthSourceConcentrationPenalty,
        latDeg: latDeg?.[rowIndex] ?? 0,
        leakPenaltyFrac: northsideLeakPenaltyFrac,
        sourceSupport: equatorialEdgeSourceSupport,
        signal0: northSourceConcentrationPenaltySignal0,
        signal1: northSourceConcentrationPenaltySignal1,
        support0: northSourceConcentrationPenaltySupport0,
        support1: northSourceConcentrationPenaltySupport1,
        maxFrac: northSourceConcentrationPenaltyMaxFrac
      });
      const retainedSourceContribution = rawSourceContribution - suppressedSourceContribution;
      const concentrationPenaltyContribution = Math.max(0, retainedSourceContribution) * northSourceConcentrationPenaltyFrac;
      rowConvectiveSourceRaw[rowIndex] += rawSourceContribution;
      rowTransitionSuppressedSource[rowIndex] += suppressedSourceContribution;
      rowConvectiveSource[rowIndex] += retainedSourceContribution - concentrationPenaltyContribution;
      circulationReboundRawSourceDiag[k] = rawSourceContribution;
      circulationReboundSuppressedSourceDiag[k] = suppressedSourceContribution;
      northSourceConcentrationPenaltyDiag[k] = northSourceConcentrationPenaltyFrac;
      northSourceConcentrationAppliedDiag[k] = concentrationPenaltyContribution;
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
      for (let j = 0; j < ny; j++) {
        rowConvectiveSource[j] /= Math.max(1, nx);
        rowConvectiveSourceRaw[j] /= Math.max(1, nx);
        rowTransitionSuppressedSource[j] /= Math.max(1, nx);
      }
      let nhSource = 0;
      let nhWeight = 0;
      let shSource = 0;
      let shWeight = 0;
      let nhTransitionSuppressedSource = 0;
      let nhTransitionWeight = 0;
      let shTransitionSuppressedSource = 0;
      let shTransitionWeight = 0;
      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        const weight = cosLat[j];
        if (latAbs <= tropicalOrganizationBandDeg) {
          if (lat >= 0) {
            nhSource += rowConvectiveSource[j] * weight;
            nhWeight += weight;
          } else {
            shSource += rowConvectiveSource[j] * weight;
            shWeight += weight;
          }
        }
        if (latAbs >= 12 && latAbs <= 22) {
          if (lat >= 0) {
            nhTransitionSuppressedSource += rowTransitionSuppressedSource[j] * weight;
            nhTransitionWeight += weight;
          } else {
            shTransitionSuppressedSource += rowTransitionSuppressedSource[j] * weight;
            shTransitionWeight += weight;
          }
        }
      }
      nhSource = nhWeight > 0 ? nhSource / nhWeight : 0;
      shSource = shWeight > 0 ? shSource / shWeight : 0;
      nhTransitionSuppressedSource = nhTransitionWeight > 0 ? nhTransitionSuppressedSource / nhTransitionWeight : 0;
      shTransitionSuppressedSource = shTransitionWeight > 0 ? shTransitionSuppressedSource / shTransitionWeight : 0;
      const meanTropicalSource = (nhSource * nhWeight + shSource * shWeight) / Math.max(eps, nhWeight + shWeight);
      let northsideLeakPenaltySignalMean = 0;
      {
        let northsideLeakPenaltySum = 0;
        let northsideLeakPenaltyWeightSum = 0;
        for (let j = 0; j < ny; j++) {
          const lat = latDeg[j];
          if (!(lat > 0)) continue;
          const row = j * nx;
          for (let i = 0; i < nx; i++) {
            const k = row + i;
            const sourceWindow = computeEquatorialEdgeNorthsideLeakSourceWindowFrac({
              enabled: true,
              latDeg: lat,
              lat0: northsideFanoutLeakPenaltyLat0,
              lat1: northsideFanoutLeakPenaltyLat1
            });
            if (!(sourceWindow > 0)) continue;
            const fanoutRisk = computeEquatorialEdgeNorthsideLeakRiskFrac({
              enabled: true,
              subtropicalBand: freshSubtropicalBandPublicDiag[k] || 0,
              neutralToSubsidingSupport: freshNeutralToSubsidingSupportPublicDiag[k] || 0,
              existingOmegaPaS: lowLevelOmegaEffective[k]
            });
            const admissionRisk = computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac({
              enabled: true,
              sourceWindow,
              fanoutRisk
            });
            const penaltyFrac = computeEquatorialEdgeNorthsideLeakPenaltyFrac({
              enabled: true,
              sourceWindow,
              admissionRisk,
              risk0: northsideFanoutLeakPenaltyRisk0,
              risk1: northsideFanoutLeakPenaltyRisk1,
              maxFrac: northsideFanoutLeakPenaltyMaxFrac
            });
            const weight = sourceWindow * cosLat[j];
            northsideLeakPenaltySum += penaltyFrac * weight;
            northsideLeakPenaltyWeightSum += weight;
          }
        }
        northsideLeakCarrierSignalMean = northsideLeakPenaltyWeightSum > eps
          ? northsideLeakPenaltySum / northsideLeakPenaltyWeightSum
          : 0;
        state.northsideLeakCarrierSignalMean = northsideLeakCarrierSignalMean;
        northsideLeakPenaltySignalMean = (enableWeakHemiCrossHemiFloorTaper && enableNorthsideFanoutLeakPenalty)
          ? northsideLeakCarrierSignalMean
          : 0;
      }
      const subtropicalAlpha = 1 - Math.exp(-dt / Math.max(subtropicalSubsidenceTau, eps));
      const subtropicalMidSigma = 0.5 * (subtropicalSubsidenceTopSigma + subtropicalSubsidenceBottomSigma);
      const levS = nz - 1;
      const nhProjectedOmegaBridgeBudgetByX = new Float32Array(nx);
      const shProjectedOmegaBridgeBudgetByX = new Float32Array(nx);
      const projectedOmegaBridgeTargetWeight = new Float32Array(N);
      const nhProjectedOmegaBridgeTargetWeightByX = new Float32Array(nx);
      const shProjectedOmegaBridgeTargetWeightByX = new Float32Array(nx);
      const nhEquatorialEdgeSubsidenceGuardBudgetByX = new Float32Array(nx);
      const shEquatorialEdgeSubsidenceGuardBudgetByX = new Float32Array(nx);
      const equatorialEdgeSubsidenceGuardTargetWeight = new Float32Array(N);
      const nhEquatorialEdgeSubsidenceGuardTargetWeightByX = new Float32Array(nx);
      const shEquatorialEdgeSubsidenceGuardTargetWeightByX = new Float32Array(nx);

      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs < subtropicalSubsidenceLat0 || latAbs > subtropicalSubsidenceLat1) continue;
        const hemiSource = lat >= 0 ? nhSource : shSource;
        const weakHemiFrac = meanTropicalSource > eps
          ? clamp01((meanTropicalSource - hemiSource) / Math.max(meanTropicalSource, eps))
          : 0;
        const sourceDriverFloorBase = Math.max(
          hemiSource,
          meanTropicalSource * clamp(subtropicalSubsidenceCrossHemiFloorFrac, 0, 1)
        );
        const crossHemiFloorShareBase = sourceDriverFloorBase > eps
          ? clamp01(Math.max(0, sourceDriverFloorBase - hemiSource) / sourceDriverFloorBase)
          : 0;
        const weakHemiFloorOverhangFrac = meanTropicalSource > eps
          ? Math.max(0, (sourceDriverFloorBase / Math.max(meanTropicalSource, eps)) - (hemiSource / Math.max(meanTropicalSource, eps)))
          : 0;
        const weakHemiFloorTaperFrac = computeWeakHemiCrossHemiFloorTaperFrac({
          enabled: enableWeakHemiCrossHemiFloorTaper,
          meanTropicalSource,
          hemiSource,
          sourceDriverFloor: sourceDriverFloorBase,
          weakHemiFrac,
          crossHemiFloorShare: crossHemiFloorShareBase,
          northsideLeakPenaltySignal: northsideLeakPenaltySignalMean,
          penalty0: weakHemiCrossHemiFloorTaperPenalty0,
          penalty1: weakHemiCrossHemiFloorTaperPenalty1,
          overhang0: weakHemiCrossHemiFloorTaperOverhang0,
          overhang1: weakHemiCrossHemiFloorTaperOverhang1,
          maxFrac: weakHemiCrossHemiFloorTaperMaxFrac
        });
        const sourceDriverFloor = Math.max(
          hemiSource,
          sourceDriverFloorBase - meanTropicalSource * weakHemiFloorTaperFrac
        );
        const sourceDriver = sourceDriverFloor * (
          1 + clamp(subtropicalSubsidenceWeakHemiBoost, 0, 1.5) * weakHemiFrac
        );
        const latShape = smoothstep(subtropicalSubsidenceLat0 - 2, subtropicalSubsidenceLat0 + 4, latAbs)
          * (1 - smoothstep(subtropicalSubsidenceLat1 - 3, subtropicalSubsidenceLat1 + 2, latAbs));
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          const hemiTransitionSuppressedSource = lat >= 0 ? nhTransitionSuppressedSource : shTransitionSuppressedSource;
          const returnFlowOpportunity = clamp01(
            2.2 * hemiTransitionSuppressedSource
            * latShape
            * smoothstep(-0.01, 0.24, lowLevelOmegaEffective[k])
            * (0.7 + 0.3 * (1 - convectiveOrganization[k]))
          );
          const returnFlowCouplingFrac = computeTransitionReturnFlowCouplingFrac({
            enabled: enableTransitionReturnFlowCoupling,
            returnFlowOpportunity,
            opportunity0: circulationReturnFlowCouplingOpportunity0,
            opportunity1: circulationReturnFlowCouplingOpportunity1,
            maxFrac: circulationReturnFlowCouplingMaxFrac
          });
          const coupledSourceDriver = sourceDriver * (1 + returnFlowCouplingFrac);
          subtropicalSourceDriverDiag[k] = sourceDriver;
          subtropicalSourceDriverFloorDiag[k] = sourceDriverFloor;
          subtropicalLocalHemiSourceDiag[k] = hemiSource;
          subtropicalMeanTropicalSourceDiag[k] = meanTropicalSource;
          subtropicalWeakHemiFracDiag[k] = weakHemiFrac;
          subtropicalWeakHemiFloorOverhangDiag[k] = weakHemiFloorOverhangFrac;
          subtropicalWeakHemiFloorTaperAppliedDiag[k] = weakHemiFloorTaperFrac;
          circulationReturnFlowOpportunityDiag[k] = returnFlowOpportunity;
          circulationReturnFlowCouplingAppliedDiag[k] = coupledSourceDriver - sourceDriver;
          subtropicalCrossHemiFloorShareDiag[k] = sourceDriverFloor > eps
            ? clamp01(Math.max(0, sourceDriverFloor - hemiSource) / sourceDriverFloor)
            : 0;
          const descentSupport = smoothstep(-0.01, 0.24, lowLevelOmegaEffective[k]);
          const localOrganizationRelief = 1 - 0.45 * convectiveOrganization[k];
          const localMoistureExportSupport = 0.62 + 0.38 * (1 - clamp01(lowLevelMoistureConvergence[k] * 21600));
          const dryDriver = clamp01(
            2.05 * coupledSourceDriver
              * latShape
              * descentSupport
              * localOrganizationRelief
              * localMoistureExportSupport
              * (1 - 0.24 * convectivePotential[k])
          );
          const atlanticDryCoreReceiverTaperFrac = computeAtlanticDryCoreReceiverTaperFrac({
            enabled: enableAtlanticDryCoreReceiverTaper,
            latDeg: lat,
            lonDeg: lonDeg?.[i] || 0,
            isLand: landMask?.[k] === 1,
            northsideLeakPenaltySignal: enableNorthsideFanoutLeakPenalty
              ? northsideLeakPenaltySignalMean
              : northsideLeakCarrierSignalMean,
            dryDriver,
            existingOmegaPaS: lowLevelOmegaEffective[k],
            signal0: atlanticDryCoreReceiverTaperSignal0,
            signal1: atlanticDryCoreReceiverTaperSignal1,
            lat0: atlanticDryCoreReceiverTaperLat0,
            lat1: atlanticDryCoreReceiverTaperLat1,
            dry0: atlanticDryCoreReceiverTaperDry0,
            dry1: atlanticDryCoreReceiverTaperDry1,
            omega0: atlanticDryCoreReceiverTaperOmega0,
            omega1: atlanticDryCoreReceiverTaperOmega1,
            maxFrac: atlanticDryCoreReceiverTaperMaxFrac
          });
          const taperedDryDriver = dryDriver * (1 - atlanticDryCoreReceiverTaperFrac);
          atlanticDryCoreReceiverTaperDiag[k] = atlanticDryCoreReceiverTaperFrac;
          atlanticDryCoreReceiverTaperAppliedDiag[k] = dryDriver - taperedDryDriver;
          subtropicalSubsidenceDrying[k] = taperedDryDriver;
          const balanceContract = computeSubtropicalBalanceContract({
            dryDriver: taperedDryDriver,
            sourceDriver: coupledSourceDriver,
            latShape,
            descentSupport,
            existingOmegaPaS: lowLevelOmegaEffective[k],
            crossHemiFloorShare: subtropicalCrossHemiFloorShareDiag[k],
            weakHemiFloorTaperFrac,
            organizedSupport: convectiveOrganization[k],
            convectivePotential: convectivePotential[k]
          });
          subtropicalBalancePartitionSupportDiag[k] = balanceContract.partitionSupport;
          subtropicalBalanceCirculationSupportDiag[k] = balanceContract.circulationSupport;
          subtropicalBalanceContractSupportDiag[k] = balanceContract.contractSupport;
          const omegaBridgePaS = computeDryingOmegaBridgePaS({
            enabled: enableDryingOmegaBridge,
            dryDriver: taperedDryDriver,
            suppressedSource: hemiTransitionSuppressedSource,
            latShape,
            organizedSupport: convectiveOrganization[k],
            convectivePotential: convectivePotential[k],
            neutralToSubsidingSupport: freshNeutralToSubsidingSupportPublicDiag[k] || 0,
            existingOmegaPaS: lowLevelOmegaEffective[k],
            dry0: dryingOmegaBridgeDry0,
            dry1: dryingOmegaBridgeDry1,
            suppressedSource0: dryingOmegaBridgeSuppressedSource0,
            suppressedSource1: dryingOmegaBridgeSuppressedSource1,
            maxPaS: dryingOmegaBridgeMaxPaS
          });
          const projectedSourceSupport = computeDryingOmegaBridgeSourceSupport({
            enabled: enableDryingOmegaBridge,
            latAbs,
            sourceLat0: dryingOmegaBridgeSourceLat0,
            sourceLat1: dryingOmegaBridgeSourceLat1,
            leakLat0: dryingOmegaBridgeEquatorwardLeakLat0,
            leakLat1: dryingOmegaBridgeEquatorwardLeakLat1
          });
          const projectedOmegaBridgeFrac = clamp01(
            projectedSourceSupport * clamp01(dryingOmegaBridgeProjectedShareMaxFrac)
          );
          const projectedOmegaBridgeBudgetPaS = omegaBridgePaS * projectedOmegaBridgeFrac;
          const localOmegaBridgePaS = Math.max(0, omegaBridgePaS - projectedOmegaBridgeBudgetPaS);
          dryingOmegaBridgeAppliedDiag[k] = localOmegaBridgePaS;
          dryingOmegaBridgeLocalAppliedDiag[k] = localOmegaBridgePaS;
          if (projectedOmegaBridgeBudgetPaS > 0) {
            if (lat >= 0) nhProjectedOmegaBridgeBudgetByX[i] += projectedOmegaBridgeBudgetPaS;
            else shProjectedOmegaBridgeBudgetByX[i] += projectedOmegaBridgeBudgetPaS;
          }
          if (localOmegaBridgePaS > 0) {
            lowLevelOmegaEffective[k] += localOmegaBridgePaS;
            omega[levS * N + k] += localOmegaBridgePaS;
            if (levS > 0) omega[(levS - 1) * N + k] += localOmegaBridgePaS * 0.35;
          }
          if (taperedDryDriver <= 0) continue;
          const dryFracBase = clamp(
            subtropicalAlpha * taperedDryDriver * (1.12 + 0.42 * latShape),
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
          subsidenceDryingWeightedSum += taperedDryDriver * cosLat[j];
        }
      }

      projectedOmegaBridgeTargetWeight.fill(0);
      nhProjectedOmegaBridgeTargetWeightByX.fill(0);
      shProjectedOmegaBridgeTargetWeightByX.fill(0);
      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs < dryingOmegaBridgeTargetLat0 - 2 || latAbs > dryingOmegaBridgeTargetLat1 + 2) continue;
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          const targetWeight = computeDryingOmegaBridgeTargetWeight({
            enabled: enableDryingOmegaBridge,
            latAbs,
            targetLat0: dryingOmegaBridgeTargetLat0,
            targetLat1: dryingOmegaBridgeTargetLat1,
            organizedSupport: convectiveOrganization[k],
            convectivePotential: convectivePotential[k],
            neutralToSubsidingSupport: freshNeutralToSubsidingSupportPublicDiag[k] || 0,
            existingOmegaPaS: lowLevelOmegaEffective[k]
          });
          projectedOmegaBridgeTargetWeight[k] = targetWeight;
          if (targetWeight > 0) {
            if (lat >= 0) nhProjectedOmegaBridgeTargetWeightByX[i] += targetWeight;
            else shProjectedOmegaBridgeTargetWeightByX[i] += targetWeight;
          }
        }
      }

      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs < dryingOmegaBridgeTargetLat0 - 2 || latAbs > dryingOmegaBridgeTargetLat1 + 2) continue;
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          const targetWeight = projectedOmegaBridgeTargetWeight[k] || 0;
          if (!(targetWeight > 0)) continue;
          const hemiBudgetByX = lat >= 0 ? nhProjectedOmegaBridgeBudgetByX : shProjectedOmegaBridgeBudgetByX;
          const hemiTargetWeightByX = lat >= 0 ? nhProjectedOmegaBridgeTargetWeightByX : shProjectedOmegaBridgeTargetWeightByX;
          const totalBudget = hemiBudgetByX[i] || 0;
          const totalTargetWeight = hemiTargetWeightByX[i] || 0;
          if (!(totalBudget > 0) || !(totalTargetWeight > eps)) continue;
          const projectedOmegaBridgePaS = computeProjectedOmegaBridgeCellPaS({
            enabled: enableDryingOmegaBridge,
            budgetPaS: totalBudget,
            targetWeight,
            totalTargetWeight,
            projectedMaxPaS: dryingOmegaBridgeProjectedMaxPaS
          });
          if (!(projectedOmegaBridgePaS > 0)) continue;
          dryingOmegaBridgeProjectedAppliedDiag[k] += projectedOmegaBridgePaS;
          dryingOmegaBridgeAppliedDiag[k] += projectedOmegaBridgePaS;
          lowLevelOmegaEffective[k] += projectedOmegaBridgePaS;
          omega[levS * N + k] += projectedOmegaBridgePaS;
          if (levS > 0) omega[(levS - 1) * N + k] += projectedOmegaBridgePaS * 0.35;
        }
      }

      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs < equatorialEdgeSubsidenceGuardSourceLat0 - 2 || latAbs > equatorialEdgeSubsidenceGuardSourceLat1 + 2) continue;
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          const equatorialEdgeSourceSupport = computeEquatorialEdgeSubsidenceGuardSourceSupport({
            enabled: enableEquatorialEdgeSubsidenceGuard,
            latAbs,
            sourceLat0: equatorialEdgeSubsidenceGuardSourceLat0,
            sourceLat1: equatorialEdgeSubsidenceGuardSourceLat1,
            sourceWindow: clamp01(
              smoothstep(equatorialEdgeSubsidenceGuardSourceLat0 - 2, equatorialEdgeSubsidenceGuardSourceLat0 + 2, latAbs)
                * (1 - smoothstep(equatorialEdgeSubsidenceGuardSourceLat1 - 2, equatorialEdgeSubsidenceGuardSourceLat1 + 2, latAbs))
            ),
            subtropicalBand: freshSubtropicalBandPublicDiag[k] || 0,
            neutralToSubsidingSupport: freshNeutralToSubsidingSupportPublicDiag[k] || 0,
            existingOmegaPaS: lowLevelOmegaEffective[k]
          });
          equatorialEdgeSubsidenceGuardSourceSupportDiag[k] = equatorialEdgeSourceSupport;
          if (equatorialEdgeSourceSupport <= 0) continue;
          const weakEngineSupport = clamp01(
            0.6 * (1 - clamp01(convectiveOrganization[k])) +
            0.4 * (1 - clamp01(convectivePotential[k]))
          );
          const northsideLeakSourceWindow = computeEquatorialEdgeNorthsideLeakSourceWindowFrac({
            enabled: enableNorthsideFanoutLeakPenalty,
            latDeg: lat,
            lat0: northsideFanoutLeakPenaltyLat0,
            lat1: northsideFanoutLeakPenaltyLat1
          });
          const northsideLeakRisk = computeEquatorialEdgeNorthsideLeakRiskFrac({
            enabled: enableNorthsideFanoutLeakPenalty,
            subtropicalBand: freshSubtropicalBandPublicDiag[k] || 0,
            neutralToSubsidingSupport: freshNeutralToSubsidingSupportPublicDiag[k] || 0,
            existingOmegaPaS: lowLevelOmegaEffective[k]
          });
          const northsideLeakAdmissionRisk = computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac({
            enabled: enableNorthsideFanoutLeakPenalty,
            sourceWindow: northsideLeakSourceWindow,
            fanoutRisk: northsideLeakRisk
          });
          const northsideLeakPenaltyFrac = computeEquatorialEdgeNorthsideLeakPenaltyFrac({
            enabled: enableNorthsideFanoutLeakPenalty,
            sourceWindow: northsideLeakSourceWindow,
            admissionRisk: northsideLeakAdmissionRisk,
            risk0: northsideFanoutLeakPenaltyRisk0,
            risk1: northsideFanoutLeakPenaltyRisk1,
            maxFrac: northsideFanoutLeakPenaltyMaxFrac
          });
          equatorialEdgeNorthsideLeakSourceWindowDiag[k] = northsideLeakSourceWindow;
          equatorialEdgeNorthsideLeakRiskDiag[k] = northsideLeakRisk;
          equatorialEdgeNorthsideLeakAdmissionRiskDiag[k] = northsideLeakAdmissionRisk;
          equatorialEdgeNorthsideLeakPenaltyDiag[k] = northsideLeakPenaltyFrac;
          const sourceBudgetPaS = equatorialEdgeSubsidenceGuardMaxPaS
            * equatorialEdgeSourceSupport
            * weakEngineSupport
            * (1 - northsideLeakPenaltyFrac);
          if (!(sourceBudgetPaS > 0)) continue;
          if (lat >= 0) nhEquatorialEdgeSubsidenceGuardBudgetByX[i] += sourceBudgetPaS;
          else shEquatorialEdgeSubsidenceGuardBudgetByX[i] += sourceBudgetPaS;
        }
      }

      equatorialEdgeSubsidenceGuardTargetWeight.fill(0);
      nhEquatorialEdgeSubsidenceGuardTargetWeightByX.fill(0);
      shEquatorialEdgeSubsidenceGuardTargetWeightByX.fill(0);
      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs < equatorialEdgeSubsidenceGuardTargetLat0 - 2 || latAbs > equatorialEdgeSubsidenceGuardTargetLat1 + 2) continue;
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          const targetWeight = computeEquatorialEdgeSubsidenceGuardTargetWeight({
            enabled: enableEquatorialEdgeSubsidenceGuard,
            latAbs,
            targetLat0: equatorialEdgeSubsidenceGuardTargetLat0,
            targetLat1: equatorialEdgeSubsidenceGuardTargetLat1,
            targetWindow: clamp01(
              smoothstep(equatorialEdgeSubsidenceGuardTargetLat0 - 1.5, equatorialEdgeSubsidenceGuardTargetLat0 + 1.5, latAbs)
                * (1 - smoothstep(equatorialEdgeSubsidenceGuardTargetLat1 - 1.5, equatorialEdgeSubsidenceGuardTargetLat1 + 1.5, latAbs))
            ),
            edgeGateSupport: freshShoulderEquatorialEdgeGateSupportPublicDiag[k] || 0,
            organizedSupport: convectiveOrganization[k],
            convectivePotential: convectivePotential[k],
            existingOmegaPaS: lowLevelOmegaEffective[k]
          });
          equatorialEdgeSubsidenceGuardTargetWeight[k] = targetWeight;
          equatorialEdgeSubsidenceGuardTargetWeightDiag[k] = targetWeight;
          if (targetWeight > 0) {
            if (lat >= 0) nhEquatorialEdgeSubsidenceGuardTargetWeightByX[i] += targetWeight;
            else shEquatorialEdgeSubsidenceGuardTargetWeightByX[i] += targetWeight;
          }
        }
      }

      for (let j = 0; j < ny; j++) {
        const lat = latDeg[j];
        const latAbs = Math.abs(lat);
        if (latAbs < equatorialEdgeSubsidenceGuardTargetLat0 - 2 || latAbs > equatorialEdgeSubsidenceGuardTargetLat1 + 2) continue;
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          const targetWeight = equatorialEdgeSubsidenceGuardTargetWeight[k] || 0;
          if (!(targetWeight > 0)) continue;
          const hemiBudgetByX = lat >= 0 ? nhEquatorialEdgeSubsidenceGuardBudgetByX : shEquatorialEdgeSubsidenceGuardBudgetByX;
          const hemiTargetWeightByX = lat >= 0 ? nhEquatorialEdgeSubsidenceGuardTargetWeightByX : shEquatorialEdgeSubsidenceGuardTargetWeightByX;
          const totalBudget = hemiBudgetByX[i] || 0;
          const totalTargetWeight = hemiTargetWeightByX[i] || 0;
          if (!(totalBudget > 0) || !(totalTargetWeight > eps)) continue;
          const guardPaS = computeProjectedOmegaBridgeCellPaS({
            enabled: enableEquatorialEdgeSubsidenceGuard,
            budgetPaS: totalBudget,
            targetWeight,
            totalTargetWeight,
            projectedMaxPaS: equatorialEdgeSubsidenceGuardProjectedMaxPaS
          });
          if (!(guardPaS > 0)) continue;
          equatorialEdgeSubsidenceGuardAppliedDiag[k] += guardPaS;
          lowLevelOmegaEffective[k] += guardPaS;
          omega[levS * N + k] += guardPaS;
          if (levS > 0) omega[(levS - 1) * N + k] += guardPaS * 0.35;
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
    const lat = grid.latDeg?.[Math.floor(k / nx)] ?? 0;
    const lon = lonDeg?.[k % nx] ?? 0;
    const candidateOverlap = Math.min(previousUpperCloudMass, upperCloudMass);
    const atlanticTransitionCarryoverContainmentFrac = computeAtlanticTransitionCarryoverContainmentFrac({
      enabled: enableAtlanticTransitionCarryoverContainment,
      receiverPatchEnabled: enableAtlanticDryCoreReceiverTaper,
      latDeg: lat,
      lonDeg: lon,
      isLand: landMask?.[k] === 1,
      carrierSignal: northsideLeakCarrierSignalMean,
      overlapMass: candidateOverlap,
      dryDriver: subtropicalSubsidenceDrying[k] || 0,
      existingOmegaPaS: lowLevelOmegaEffective[k],
      signal0: atlanticTransitionCarryoverContainmentSignal0,
      signal1: atlanticTransitionCarryoverContainmentSignal1,
      lat0: atlanticTransitionCarryoverContainmentLat0,
      lat1: atlanticTransitionCarryoverContainmentLat1,
      overlap0: atlanticTransitionCarryoverContainmentOverlap0,
      overlap1: atlanticTransitionCarryoverContainmentOverlap1,
      dry0: atlanticTransitionCarryoverContainmentDry0,
      dry1: atlanticTransitionCarryoverContainmentDry1,
      omega0: atlanticTransitionCarryoverContainmentOmega0,
      omega1: atlanticTransitionCarryoverContainmentOmega1,
      maxFrac: atlanticTransitionCarryoverContainmentMaxFrac
    });
    atlanticTransitionCarryoverContainmentDiag[k] = atlanticTransitionCarryoverContainmentFrac;
    if (atlanticTransitionCarryoverContainmentFrac > 0 && upperCloudMass > eps && candidateOverlap > 0) {
      const removalMass = Math.min(candidateOverlap * atlanticTransitionCarryoverContainmentFrac, upperCloudMass);
      const keepFrac = Math.max(0, (upperCloudMass - removalMass) / Math.max(upperCloudMass, eps));
      scaleUpperCloudMassAtCell(state, sigmaHalf, nz, k, keepFrac);
      upperCloudMass *= keepFrac;
      for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BAND_COUNT; bandIndex += 1) {
        upperCloudBandMass[bandIndex] *= keepFrac;
      }
      atlanticTransitionCarryoverContainmentAppliedDiag[k] = removalMass;
    }
    const overlap = Math.min(previousUpperCloudMass, upperCloudMass);
    carriedOverUpperCloudMass[k] = overlap;
    const weakLocalOrganization = 1 - smoothstep(0.12, 0.42, convectiveOrganization[k]);
    const weakLocalMassFlux = 1 - smoothstep(5e-4, 0.004, convectiveMassFlux[k]);
    const weakLocalDetrainment = 1 - smoothstep(0.001, 0.02, convectiveDetrainmentMass[k]);
    const weakLocalAnvilSource = 1 - smoothstep(0.05, 0.35, convectiveAnvilSource[k]);
    const weakSubsidenceErosion = 1 - smoothstep(0.01, 0.08, subtropicalSubsidenceDrying[k]);
    const weakDescentVent = 1 - smoothstep(0.02, 0.18, Math.max(0, lowLevelOmegaEffective[k]));
    const weakErosionSupport = clamp01(
      (
        0.4 * weakSubsidenceErosion +
        0.25 * weakDescentVent +
        0.2 * weakLocalOrganization +
        0.1 * weakLocalMassFlux +
        0.05 * weakLocalAnvilSource
      ) * Math.max(0, upperCloudWeakErosionSupportScale)
    );
    weakErosionCloudSurvivalMass[k] = overlap * weakErosionSupport;
    const persistenceSupport = clamp01(
      (
        0.35 * weakLocalOrganization +
        0.25 * weakLocalMassFlux +
        0.2 * weakLocalDetrainment +
        0.2 * weakLocalAnvilSource
      ) * Math.max(0, upperCloudPersistenceSupportScale)
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
