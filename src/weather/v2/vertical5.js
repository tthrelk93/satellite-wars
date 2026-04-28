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
export const circularDayDistance = (dayA, dayB) => {
  const wrapped = Math.abs((((dayA - dayB) % 365) + 365) % 365);
  return Math.min(wrapped, 365 - wrapped);
};
export const seasonalWindowSupport = (dayOfYear, peakDay, halfWidthDays) => {
  const distance = circularDayDistance(dayOfYear, peakDay);
  const width = Math.max(1, halfWidthDays);
  return 1 - smoothstep(width * 0.45, width, distance);
};
export const normalizeLonDeg = (lonDeg) => {
  let lon = Number.isFinite(lonDeg) ? lonDeg : 0;
  while (lon < -180) lon += 360;
  while (lon >= 180) lon -= 360;
  return lon;
};
export const tropicalCycloneBasinSeasonSupport = ({ latDeg = 0, lonDeg = 0, dayOfYear = 0 } = {}) => {
  const lat = Number.isFinite(latDeg) ? latDeg : 0;
  const lon = normalizeLonDeg(lonDeg);
  const day = ((Number(dayOfYear) || 0) % 365 + 365) % 365;
  if (lat < 0) {
    return 0.08 + 0.92 * seasonalWindowSupport(day, 45, 115);
  }
  if (lon >= -100 && lon <= -10) {
    return 0.08 + 0.92 * seasonalWindowSupport(day, 255, 95);
  }
  if (lon >= -170 && lon < -100) {
    return 0.1 + 0.9 * seasonalWindowSupport(day, 235, 105);
  }
  if (lon >= 105 || lon <= -145) {
    return 0.22 + 0.78 * seasonalWindowSupport(day, 240, 150);
  }
  if (lon >= 40 && lon <= 110) {
    return 0.08 + 0.92 * Math.max(
      seasonalWindowSupport(day, 135, 55),
      seasonalWindowSupport(day, 310, 60)
    );
  }
  return 0.12 + 0.88 * seasonalWindowSupport(day, 245, 105);
};
export const computeTropicalCycloneGenesisPotential = ({
  latDeg = 0,
  isLand = false,
  seaIceFrac = 0,
  sstK = 0,
  boundaryQv = 0,
  midQv = 0,
  shearMs = 0,
  signedVorticityS_1 = 0,
  convectionSupport = 0,
  lowLevelConvergenceS_1 = 0,
  seasonSupport = 1,
  scale = 1
} = {}) => {
  const latAbs = Math.abs(Number.isFinite(latDeg) ? latDeg : 0);
  if (isLand || seaIceFrac > 0.15) return 0;
  const latitudeSupport = smoothstep(5, 9, latAbs) * (1 - smoothstep(30, 36, latAbs));
  const sstSupport = smoothstep(298.2, 301.5, sstK);
  const humiditySupport = clamp01(
    0.62 * smoothstep(0.011, 0.019, boundaryQv)
      + 0.38 * smoothstep(0.004, 0.010, midQv)
  );
  const shearSupport = 1 - smoothstep(9, 24, shearMs);
  const vorticitySupport = smoothstep(1e-6, 9e-6, signedVorticityS_1);
  const organizedConvectionSupport = clamp01(
    0.72 * clamp01(convectionSupport)
      + 0.28 * smoothstep(0.000001, 0.000008, lowLevelConvergenceS_1)
  );
  return clamp01(
    Math.max(0, scale)
      * latitudeSupport
      * clamp01(seasonSupport)
      * sstSupport
      * humiditySupport
      * (0.35 + 0.65 * shearSupport)
      * (0.32 + 0.68 * vorticitySupport)
      * (0.35 + 0.65 * organizedConvectionSupport)
  );
};
export const computeTornadoRiskPotential = ({
  latDeg = 0,
  isLand = false,
  surfaceTempK = 0,
  boundaryQv = 0,
  instabilityK = 0,
  shearMs = 0,
  liftSupport = 0,
  stormModeSupport = 0,
  seasonSupport = 1,
  scale = 1
} = {}) => {
  if (!isLand) return 0;
  const latAbs = Math.abs(Number.isFinite(latDeg) ? latDeg : 0);
  const latitudeSupport = smoothstep(18, 27, latAbs) * (1 - smoothstep(55, 63, latAbs));
  const warmSupport = smoothstep(289, 302, surfaceTempK);
  const moistureSupport = smoothstep(0.009, 0.0175, boundaryQv);
  const instabilitySupport = smoothstep(2, 13, instabilityK);
  const shearSupport = smoothstep(10, 28, shearMs);
  return clamp01(
    Math.max(0, scale)
      * latitudeSupport
      * clamp01(seasonSupport)
      * warmSupport
      * moistureSupport
      * instabilitySupport
      * shearSupport
      * (0.35 + 0.65 * clamp01(liftSupport))
      * (0.4 + 0.6 * clamp01(stormModeSupport))
  );
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
const scaleUpperCloudMassAtCell = (state, pHalf, sigmaHalf, nz, cellIndex, keepFrac, { evaporateToVapor = false } = {}) => {
  const boundedKeepFrac = clamp01(keepFrac);
  const removeFrac = 1 - boundedKeepFrac;
  let convertedMass = 0;
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
    if (!isUpperCloudSigma(sigmaMid)) continue;
    const idx = lev * state.N + cellIndex;
    const condensateMixingRatio =
      (Number(state.qc[idx]) || 0)
      + (Number(state.qi[idx]) || 0)
      + (Number(state.qr[idx]) || 0)
      + (Number(state.qs[idx]) || 0);
    const removedMixingRatio = condensateMixingRatio * removeFrac;
    state.qc[idx] *= boundedKeepFrac;
    state.qi[idx] *= boundedKeepFrac;
    state.qr[idx] *= boundedKeepFrac;
    state.qs[idx] *= boundedKeepFrac;
    if (evaporateToVapor && removedMixingRatio > 0) {
      state.qv[idx] += removedMixingRatio;
      const dp = pHalf[(lev + 1) * state.N + cellIndex] - pHalf[lev * state.N + cellIndex];
      if (dp > 0) convertedMass += removedMixingRatio * (dp / g);
    }
  }
  return convertedMass;
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
export const computeSubtropicalDescentVentilationPaS = ({
  enabled,
  sourceDriver,
  latShape,
  walkerSubsidenceSupport,
  convectiveOrganization,
  convectivePotential,
  existingOmegaPaS,
  source0,
  source1,
  maxPaS,
  maxStepPaS,
  organizationMax,
  potentialMax
}) => {
  if (!enabled) return 0;
  const ventilationSourceSupport = smoothstep(source0, source1, sourceDriver);
  const weakOrganizationVent = 1 - smoothstep(
    organizationMax * 0.55,
    organizationMax,
    convectiveOrganization
  );
  const weakPotentialVent = 1 - smoothstep(
    potentialMax * 0.55,
    potentialMax,
    convectivePotential
  );
  const targetDescentPaS = Math.max(0, maxPaS)
    * clamp01(latShape)
    * ventilationSourceSupport
    * weakOrganizationVent
    * weakPotentialVent
    * (0.75 + 0.25 * clamp01(walkerSubsidenceSupport));
  const existingDescentPaS = Math.max(0, existingOmegaPaS);
  return clamp(targetDescentPaS - existingDescentPaS, 0, Math.max(0, maxStepPaS));
};
export const computeHadleyReturnFlowWindTendencyMs = ({
  enabled,
  latDeg,
  currentV,
  dryDriver,
  sourceDriver,
  latShape,
  descentSupport,
  circulationSupport,
  returnFlowCouplingFrac,
  walkerSubsidenceSupport,
  dt,
  tauSeconds,
  maxMs,
  maxStepMs,
  source0,
  source1,
  dry0,
  dry1
}) => {
  if (!enabled || !Number.isFinite(latDeg) || Math.abs(latDeg) < 1e-6) return 0;
  const sourceSupport = smoothstep(source0, source1, sourceDriver);
  const drySupport = smoothstep(dry0, dry1, dryDriver);
  const couplingSupport = smoothstep(0.005, 0.08, returnFlowCouplingFrac);
  const support = clamp01(
    clamp01(latShape)
      * sourceSupport
      * drySupport
      * (0.45 + 0.35 * clamp01(descentSupport) + 0.2 * clamp01(circulationSupport))
      * (0.75 + 0.25 * couplingSupport)
      * (0.82 + 0.36 * clamp01(walkerSubsidenceSupport))
  );
  if (!(support > 0)) return 0;
  const equatorwardSign = latDeg >= 0 ? -1 : 1;
  const targetV = equatorwardSign * Math.max(0, maxMs) * support;
  const relax = clamp(dt / Math.max(1, tauSeconds), 0, 1);
  const delta = (targetV - currentV) * relax;
  if (!(delta * equatorwardSign > 0)) return 0;
  return equatorwardSign * Math.min(Math.abs(delta), Math.max(0, maxStepMs));
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
  'tropicalCoreConvectiveMuBoost',
  'tropicalCoreRainoutBoost',
  'equatorialCoreConvectiveMuBoost',
  'equatorialCoreRainoutBoost',
  'equatorialCoreWidthDeg',
  'rainforestSurfaceConvectionBoost',
  'rainforestSurfaceOrganizationBoost',
  'rainforestSurfaceMuBoost',
  'rainforestSurfaceRainoutBoost',
  'buoyTrigK',
  'dThetaMaxConvPerStep',
  'enableLargeScaleVerticalAdvection',
  'verticalAdvectionCflMax',
  'verticalAdvectionMaxSubsteps',
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
  'enableSubtropicalDescentVentilation',
  'subtropicalDescentVentilationSource0',
  'subtropicalDescentVentilationSource1',
  'subtropicalDescentVentilationMaxPaS',
  'subtropicalDescentVentilationMaxStepPaS',
  'subtropicalDescentVentilationOrganizationMax',
  'subtropicalDescentVentilationPotentialMax',
  'enableCirculationReboundContainment',
  'circulationReboundContainmentScale',
  'circulationReboundOrganizationScale',
  'circulationReboundActivityScale',
  'circulationReboundSourceScale',
  'enableTransitionReturnFlowCoupling',
  'circulationReturnFlowCouplingOpportunity0',
  'circulationReturnFlowCouplingOpportunity1',
  'circulationReturnFlowCouplingMaxFrac',
  'enableHadleyReturnFlowWindCoupling',
  'hadleyReturnFlowWindTau',
  'hadleyReturnFlowWindMaxMs',
  'hadleyReturnFlowWindMaxStepMs',
  'hadleyReturnFlowWindSigmaTop',
  'hadleyReturnFlowWindSigmaBottom',
  'hadleyReturnFlowWindSource0',
  'hadleyReturnFlowWindSource1',
  'hadleyReturnFlowWindDry0',
  'hadleyReturnFlowWindDry1',
  'enableWalkerLongitudinalCoupling',
  'walkerLongitudinalCouplingScale',
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
  'enableFrontalAscentConcentration',
  'frontalAscentPeakLatDeg',
  'frontalAscentSeasonalShiftDeg',
  'frontalAscentWidthDeg',
  'frontalAscentMinLatDeg',
  'frontalAscentMaxLatDeg',
  'frontalAscentMaxPaS',
  'frontalAscentMaxStepPaS',
  'frontalAscentSigmaTop',
  'frontalAscentSigmaBottom',
  'frontalAscentConcentrationPower',
  'frontalAscentCompensationFloor',
  'frontalAscentMinSupport',
  'frontalAscentDiffuseDampingFrac',
  'frontalAscentDiffuseDampingMaxStepPaS',
  'frontalAscentCoreGatherSupport',
  'enableSevereWeatherEnvironments',
  'tropicalCycloneGenesisScale',
  'tropicalCycloneEmbeddedVortexThreshold',
  'tornadoRiskScale',
  'enableEquatorialEdgeSubsidenceGuard',
  'equatorialEdgeSubsidenceGuardMaxPaS',
  'equatorialEdgeSubsidenceGuardSourceLat0',
  'equatorialEdgeSubsidenceGuardSourceLat1',
  'equatorialEdgeSubsidenceGuardTargetLat0',
  'equatorialEdgeSubsidenceGuardTargetLat1',
  'equatorialEdgeSubsidenceGuardProjectedMaxPaS',
  // R9-β4: Tropical ascent seed — Gaussian ω injection in the deep tropics
  // to bootstrap the Hadley ascending branch out of a no-ITCZ feedback state.
  // Default OFF.  See weather-validation/reports/r9-beta3-subsidence-is-hyperactive.md.
  'enableTropicalAscentSeed',
  'tropicalAscentSeedPeakPaS',
  'tropicalAscentSeedCenterLatDeg',
  'tropicalAscentSeedWidthDeg',
  'tropicalAscentSeedSigmaHi',
  'tropicalAscentSeedSigmaLo',
  'tropicalAscentSeedFadeStartDay',
  'tropicalAscentSeedFadeDurationDays',
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
  'enableAtlanticTransitionCarryoverContainment',
  'atlanticTransitionCarryoverContainmentSignal0',
  'atlanticTransitionCarryoverContainmentSignal1',
  'atlanticTransitionCarryoverContainmentLat0',
  'atlanticTransitionCarryoverContainmentLat1',
  'atlanticTransitionCarryoverContainmentOverlap0',
  'atlanticTransitionCarryoverContainmentOverlap1',
  'atlanticTransitionCarryoverContainmentDry0',
  'atlanticTransitionCarryoverContainmentDry1',
  'atlanticTransitionCarryoverContainmentOmega0',
  'atlanticTransitionCarryoverContainmentOmega1',
  'atlanticTransitionCarryoverContainmentMaxFrac',
  'enableWeakHemiCrossHemiFloorTaper',
  'weakHemiCrossHemiFloorTaperPenalty0',
  'weakHemiCrossHemiFloorTaperPenalty1',
  'weakHemiCrossHemiFloorTaperOverhang0',
  'weakHemiCrossHemiFloorTaperOverhang1',
  'weakHemiCrossHemiFloorTaperMaxFrac',
  'upperCloudWeakErosionSupportScale',
  'upperCloudPersistenceSupportScale',
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
    tropicalCoreConvectiveMuBoost = 0,
    tropicalCoreRainoutBoost = 0,
    equatorialCoreConvectiveMuBoost = 0,
    equatorialCoreRainoutBoost = 0,
    equatorialCoreWidthDeg = 6,
    rainforestSurfaceConvectionBoost = 0,
    rainforestSurfaceOrganizationBoost = 0,
    rainforestSurfaceMuBoost = 0,
    rainforestSurfaceRainoutBoost = 0,
    buoyTrigK = 0.0,
    dThetaMaxConvPerStep = 2.5,

    // Large-scale vertical advection (omega-based)
    enableLargeScaleVerticalAdvection = true,
    verticalAdvectionCflMax = 0.4,
    verticalAdvectionMaxSubsteps = 8,
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
    enableSubtropicalDescentVentilation = false,
    subtropicalDescentVentilationSource0 = 0.12,
    subtropicalDescentVentilationSource1 = 0.22,
    subtropicalDescentVentilationMaxPaS = 0.045,
    subtropicalDescentVentilationMaxStepPaS = 0.018,
    subtropicalDescentVentilationOrganizationMax = 0.14,
    subtropicalDescentVentilationPotentialMax = 0.38,
    enableCirculationReboundContainment = true,
    circulationReboundContainmentScale = 1.35,
    circulationReboundOrganizationScale = 0.6,
    circulationReboundActivityScale = 0.35,
    circulationReboundSourceScale = 0.75,
    enableTransitionReturnFlowCoupling = true,
    circulationReturnFlowCouplingOpportunity0 = 0.00004,
    circulationReturnFlowCouplingOpportunity1 = 0.00032,
    circulationReturnFlowCouplingMaxFrac = 0.32,
    enableHadleyReturnFlowWindCoupling = true,
    hadleyReturnFlowWindTau = 3 * 3600,
    hadleyReturnFlowWindMaxMs = 5.8,
    hadleyReturnFlowWindMaxStepMs = 1.2,
    hadleyReturnFlowWindSigmaTop = 0.62,
    hadleyReturnFlowWindSigmaBottom = 0.98,
    hadleyReturnFlowWindSource0 = 0.05,
    hadleyReturnFlowWindSource1 = 0.2,
    hadleyReturnFlowWindDry0 = 0.05,
    hadleyReturnFlowWindDry1 = 0.2,
    enableWalkerLongitudinalCoupling = true,
    walkerLongitudinalCouplingScale = 0.25,
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
    enableFrontalAscentConcentration = false,
    frontalAscentPeakLatDeg = 47,
    frontalAscentSeasonalShiftDeg = 5,
    frontalAscentWidthDeg = 10,
    frontalAscentMinLatDeg = 30,
    frontalAscentMaxLatDeg = 62,
    frontalAscentMaxPaS = 0.055,
    frontalAscentMaxStepPaS = 0.035,
    frontalAscentSigmaTop = 0.42,
    frontalAscentSigmaBottom = 0.98,
    frontalAscentConcentrationPower = 1.35,
    frontalAscentCompensationFloor = 0.28,
    frontalAscentMinSupport = 0.025,
    frontalAscentDiffuseDampingFrac = 0,
    frontalAscentDiffuseDampingMaxStepPaS = 0.045,
    frontalAscentCoreGatherSupport = 0.08,
    enableSevereWeatherEnvironments = true,
    tropicalCycloneGenesisScale = 1.0,
    tropicalCycloneEmbeddedVortexThreshold = 0.24,
    tornadoRiskScale = 1.0,
    enableEquatorialEdgeSubsidenceGuard = false,
    equatorialEdgeSubsidenceGuardMaxPaS = 0.007,
    equatorialEdgeSubsidenceGuardSourceLat0 = 8,
    equatorialEdgeSubsidenceGuardSourceLat1 = 14,
    equatorialEdgeSubsidenceGuardTargetLat0 = 2,
    equatorialEdgeSubsidenceGuardTargetLat1 = 6,
    equatorialEdgeSubsidenceGuardProjectedMaxPaS = 0.0035,
    // R9-β4: tropical ascent seed (negative ω injection)
    enableTropicalAscentSeed = false,
    tropicalAscentSeedPeakPaS = 0.05,          // magnitude; applied as negative (ascent)
    tropicalAscentSeedCenterLatDeg = 0,
    tropicalAscentSeedWidthDeg = 10,
    tropicalAscentSeedSigmaHi = 0.7,            // envelope top (sigma; ≈ 700 hPa)
    tropicalAscentSeedSigmaLo = 0.3,            // envelope bottom (sigma; ≈ 300 hPa)
    tropicalAscentSeedFadeStartDay = 20,
    tropicalAscentSeedFadeDurationDays = 20,
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
  if (!state.hadleyReturnFlowWindSupportDiag || state.hadleyReturnFlowWindSupportDiag.length !== N) state.hadleyReturnFlowWindSupportDiag = new Float32Array(N);
  if (!state.hadleyReturnFlowWindAppliedDiag || state.hadleyReturnFlowWindAppliedDiag.length !== N) state.hadleyReturnFlowWindAppliedDiag = new Float32Array(N);
  if (!state.walkerLongitudinalSubsidenceSupportDiag || state.walkerLongitudinalSubsidenceSupportDiag.length !== N) state.walkerLongitudinalSubsidenceSupportDiag = new Float32Array(N);
  if (!state.dryingOmegaBridgeAppliedDiag || state.dryingOmegaBridgeAppliedDiag.length !== N) state.dryingOmegaBridgeAppliedDiag = new Float32Array(N);
  if (!state.dryingOmegaBridgeLocalAppliedDiag || state.dryingOmegaBridgeLocalAppliedDiag.length !== N) state.dryingOmegaBridgeLocalAppliedDiag = new Float32Array(N);
  if (!state.dryingOmegaBridgeProjectedAppliedDiag || state.dryingOmegaBridgeProjectedAppliedDiag.length !== N) state.dryingOmegaBridgeProjectedAppliedDiag = new Float32Array(N);
  if (!state.frontalAscentSupportDiag || state.frontalAscentSupportDiag.length !== N) state.frontalAscentSupportDiag = new Float32Array(N);
  if (!state.frontalAscentAddedDiag || state.frontalAscentAddedDiag.length !== N) state.frontalAscentAddedDiag = new Float32Array(N);
  if (!state.frontalAscentCompensationDiag || state.frontalAscentCompensationDiag.length !== N) state.frontalAscentCompensationDiag = new Float32Array(N);
  if (!state.frontalBaroclinicSupportDiag || state.frontalBaroclinicSupportDiag.length !== N) state.frontalBaroclinicSupportDiag = new Float32Array(N);
  if (!state.frontalJetSupportDiag || state.frontalJetSupportDiag.length !== N) state.frontalJetSupportDiag = new Float32Array(N);
  if (!state.frontalLandOceanSupportDiag || state.frontalLandOceanSupportDiag.length !== N) state.frontalLandOceanSupportDiag = new Float32Array(N);
  if (!state.frontalMoistureSupportDiag || state.frontalMoistureSupportDiag.length !== N) state.frontalMoistureSupportDiag = new Float32Array(N);
  if (!state.stormGenesisPotentialDiag || state.stormGenesisPotentialDiag.length !== N) state.stormGenesisPotentialDiag = new Float32Array(N);
  if (!state.stormDeepeningPotentialDiag || state.stormDeepeningPotentialDiag.length !== N) state.stormDeepeningPotentialDiag = new Float32Array(N);
  if (!state.stormOcclusionPotentialDiag || state.stormOcclusionPotentialDiag.length !== N) state.stormOcclusionPotentialDiag = new Float32Array(N);
  if (!state.stormDecayPotentialDiag || state.stormDecayPotentialDiag.length !== N) state.stormDecayPotentialDiag = new Float32Array(N);
  if (!state.stormPrecipShieldDiag || state.stormPrecipShieldDiag.length !== N) state.stormPrecipShieldDiag = new Float32Array(N);
  if (!state.stormWarmSectorDiag || state.stormWarmSectorDiag.length !== N) state.stormWarmSectorDiag = new Float32Array(N);
  if (!state.stormColdSectorDiag || state.stormColdSectorDiag.length !== N) state.stormColdSectorDiag = new Float32Array(N);
  if (!state.tropicalCycloneGenesisPotentialDiag || state.tropicalCycloneGenesisPotentialDiag.length !== N) state.tropicalCycloneGenesisPotentialDiag = new Float32Array(N);
  if (!state.tropicalCycloneEmbeddedVortexDiag || state.tropicalCycloneEmbeddedVortexDiag.length !== N) state.tropicalCycloneEmbeddedVortexDiag = new Float32Array(N);
  if (!state.tropicalCycloneShearSupportDiag || state.tropicalCycloneShearSupportDiag.length !== N) state.tropicalCycloneShearSupportDiag = new Float32Array(N);
  if (!state.tropicalCycloneHumiditySupportDiag || state.tropicalCycloneHumiditySupportDiag.length !== N) state.tropicalCycloneHumiditySupportDiag = new Float32Array(N);
  if (!state.tropicalCycloneVorticitySupportDiag || state.tropicalCycloneVorticitySupportDiag.length !== N) state.tropicalCycloneVorticitySupportDiag = new Float32Array(N);
  if (!state.tropicalCycloneBasinSeasonSupportDiag || state.tropicalCycloneBasinSeasonSupportDiag.length !== N) state.tropicalCycloneBasinSeasonSupportDiag = new Float32Array(N);
  if (!state.tornadoRiskPotentialDiag || state.tornadoRiskPotentialDiag.length !== N) state.tornadoRiskPotentialDiag = new Float32Array(N);
  if (!state.tornadoInstabilitySupportDiag || state.tornadoInstabilitySupportDiag.length !== N) state.tornadoInstabilitySupportDiag = new Float32Array(N);
  if (!state.tornadoShearSupportDiag || state.tornadoShearSupportDiag.length !== N) state.tornadoShearSupportDiag = new Float32Array(N);
  if (!state.tornadoLiftSupportDiag || state.tornadoLiftSupportDiag.length !== N) state.tornadoLiftSupportDiag = new Float32Array(N);
  if (!state.tornadoStormModeSupportDiag || state.tornadoStormModeSupportDiag.length !== N) state.tornadoStormModeSupportDiag = new Float32Array(N);
  if (!state._frontalAscentOmegaDelta || state._frontalAscentOmegaDelta.length !== N) state._frontalAscentOmegaDelta = new Float32Array(N);
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
  if (!state.verticalSubtropicalDryingDemandMass || state.verticalSubtropicalDryingDemandMass.length !== N) {
    state.verticalSubtropicalDryingDemandMass = new Float32Array(N);
  }
  if (!state.verticalCloudErosionToVaporMass || state.verticalCloudErosionToVaporMass.length !== N) {
    state.verticalCloudErosionToVaporMass = new Float32Array(N);
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
  const hadleyReturnFlowWindSupportDiag = state.hadleyReturnFlowWindSupportDiag;
  const hadleyReturnFlowWindAppliedDiag = state.hadleyReturnFlowWindAppliedDiag;
  const walkerLongitudinalSubsidenceSupportDiag = state.walkerLongitudinalSubsidenceSupportDiag;
  const dryingOmegaBridgeAppliedDiag = state.dryingOmegaBridgeAppliedDiag;
  const dryingOmegaBridgeLocalAppliedDiag = state.dryingOmegaBridgeLocalAppliedDiag;
  const dryingOmegaBridgeProjectedAppliedDiag = state.dryingOmegaBridgeProjectedAppliedDiag;
  const frontalAscentSupportDiag = state.frontalAscentSupportDiag;
  const frontalAscentAddedDiag = state.frontalAscentAddedDiag;
  const frontalAscentCompensationDiag = state.frontalAscentCompensationDiag;
  const frontalBaroclinicSupportDiag = state.frontalBaroclinicSupportDiag;
  const frontalJetSupportDiag = state.frontalJetSupportDiag;
  const frontalLandOceanSupportDiag = state.frontalLandOceanSupportDiag;
  const frontalMoistureSupportDiag = state.frontalMoistureSupportDiag;
  const stormGenesisPotentialDiag = state.stormGenesisPotentialDiag;
  const stormDeepeningPotentialDiag = state.stormDeepeningPotentialDiag;
  const stormOcclusionPotentialDiag = state.stormOcclusionPotentialDiag;
  const stormDecayPotentialDiag = state.stormDecayPotentialDiag;
  const stormPrecipShieldDiag = state.stormPrecipShieldDiag;
  const stormWarmSectorDiag = state.stormWarmSectorDiag;
  const stormColdSectorDiag = state.stormColdSectorDiag;
  const tropicalCycloneGenesisPotentialDiag = state.tropicalCycloneGenesisPotentialDiag;
  const tropicalCycloneEmbeddedVortexDiag = state.tropicalCycloneEmbeddedVortexDiag;
  const tropicalCycloneShearSupportDiag = state.tropicalCycloneShearSupportDiag;
  const tropicalCycloneHumiditySupportDiag = state.tropicalCycloneHumiditySupportDiag;
  const tropicalCycloneVorticitySupportDiag = state.tropicalCycloneVorticitySupportDiag;
  const tropicalCycloneBasinSeasonSupportDiag = state.tropicalCycloneBasinSeasonSupportDiag;
  const tornadoRiskPotentialDiag = state.tornadoRiskPotentialDiag;
  const tornadoInstabilitySupportDiag = state.tornadoInstabilitySupportDiag;
  const tornadoShearSupportDiag = state.tornadoShearSupportDiag;
  const tornadoLiftSupportDiag = state.tornadoLiftSupportDiag;
  const tornadoStormModeSupportDiag = state.tornadoStormModeSupportDiag;
  const frontalAscentOmegaDelta = state._frontalAscentOmegaDelta;
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
  const verticalSubtropicalDryingDemandMass = state.verticalSubtropicalDryingDemandMass;
  const verticalCloudErosionToVaporMass = state.verticalCloudErosionToVaporMass;
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
  hadleyReturnFlowWindSupportDiag.fill(0);
  hadleyReturnFlowWindAppliedDiag.fill(0);
  walkerLongitudinalSubsidenceSupportDiag.fill(0);
  dryingOmegaBridgeAppliedDiag.fill(0);
  dryingOmegaBridgeLocalAppliedDiag.fill(0);
  dryingOmegaBridgeProjectedAppliedDiag.fill(0);
  frontalAscentSupportDiag.fill(0);
  frontalAscentAddedDiag.fill(0);
  frontalAscentCompensationDiag.fill(0);
  frontalBaroclinicSupportDiag.fill(0);
  frontalJetSupportDiag.fill(0);
  frontalLandOceanSupportDiag.fill(0);
  frontalMoistureSupportDiag.fill(0);
  stormGenesisPotentialDiag.fill(0);
  stormDeepeningPotentialDiag.fill(0);
  stormOcclusionPotentialDiag.fill(0);
  stormDecayPotentialDiag.fill(0);
  stormPrecipShieldDiag.fill(0);
  stormWarmSectorDiag.fill(0);
  stormColdSectorDiag.fill(0);
  tropicalCycloneGenesisPotentialDiag.fill(0);
  tropicalCycloneEmbeddedVortexDiag.fill(0);
  tropicalCycloneShearSupportDiag.fill(0);
  tropicalCycloneHumiditySupportDiag.fill(0);
  tropicalCycloneVorticitySupportDiag.fill(0);
  tropicalCycloneBasinSeasonSupportDiag.fill(0);
  tornadoRiskPotentialDiag.fill(0);
  tornadoInstabilitySupportDiag.fill(0);
  tornadoShearSupportDiag.fill(0);
  tornadoLiftSupportDiag.fill(0);
  tornadoStormModeSupportDiag.fill(0);
  frontalAscentOmegaDelta.fill(0);
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
        w += (qv[idx] + qc[idx] + qi[idx] + qr[idx] + qs[idx]) * (dp / g);
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

  if (
    enableFrontalAscentConcentration &&
    dt > 0 &&
    grid.latDeg &&
    grid.latDeg.length >= ny &&
    sigmaHalf &&
    sigmaHalf.length >= nz + 1
  ) {
    const levS = nz - 1;
    const lowBase = levS * N;
    const upperJetLev = clamp(Math.floor(nz * 0.32), 0, nz - 1);
    const upperJetBase = upperJetLev * N;
    const midBase = clamp(Math.floor(nz * 0.58), 0, nz - 1) * N;
    const dayOfYear = ((Number(state.timeUTC) || 0) / 86400) % 365;
    const seasonalPhase = Math.cos((2 * Math.PI * (dayOfYear - 15)) / 365);
    const minLat = Math.max(20, Math.min(frontalAscentMinLatDeg, frontalAscentMaxLatDeg - 2));
    const maxLat = Math.min(75, Math.max(frontalAscentMaxLatDeg, minLat + 2));
    const peakLat = clamp(frontalAscentPeakLatDeg, minLat, maxLat);
    const beltWidth = Math.max(3, frontalAscentWidthDeg);
    const maxAscentPaS = Math.max(0, frontalAscentMaxPaS);
    const maxStepPaS = Math.max(0, frontalAscentMaxStepPaS);
    const supportFloor = clamp01(frontalAscentMinSupport);
    const diffuseDampingFrac = clamp01(frontalAscentDiffuseDampingFrac);
    const diffuseDampingMaxStepPaS = Math.max(0, frontalAscentDiffuseDampingMaxStepPaS);
    const coreGatherSupport = clamp01(frontalAscentCoreGatherSupport);
    const concentrationPower = Math.max(0.25, frontalAscentConcentrationPower);
    const compensationFloor = Math.max(0.02, frontalAscentCompensationFloor);
    const topSigma = Math.max(0, Math.min(frontalAscentSigmaTop, frontalAscentSigmaBottom));
    const bottomSigma = Math.min(1, Math.max(frontalAscentSigmaTop, frontalAscentSigmaBottom));
    const sigmaRamp = Math.max(0.03, (bottomSigma - topSigma) * 0.25);
    const lonField = lonDeg && lonDeg.length >= nx ? lonDeg : null;
    const landField = landMask && landMask.length === N ? landMask : null;

    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      const rowN = Math.max(0, j - 1) * nx;
      const rowS = Math.min(ny - 1, j + 1) * nx;
      const lat = grid.latDeg[j] || 0;
      const latAbs = Math.abs(lat);
      const hemi = lat >= 0 ? 1 : -1;
      const seasonalCenter = clamp(peakLat - hemi * frontalAscentSeasonalShiftDeg * seasonalPhase, minLat, maxLat);
      const latitudeWindow = smoothstep(minLat - 3, minLat + 2, latAbs)
        * (1 - smoothstep(maxLat - 2, maxLat + 3, latAbs));
      const belt = latitudeWindow * Math.exp(-((latAbs - seasonalCenter) ** 2) / Math.max(1e-6, 2 * beltWidth * beltWidth));
      if (!(belt > 0)) continue;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const wavePhase = (2 * Math.PI * dayOfYear) / 12;

      for (let i = 0; i < nx; i += 1) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const kE = row + iE;
        const kW = row + iW;
        const kN = rowN + i;
        const kS = rowS + i;
        const dTdx = (T[lowBase + kE] - T[lowBase + kW]) * 0.5 * invDxRow;
        const dTdy = (T[lowBase + kN] - T[lowBase + kS]) * 0.5 * invDyRow;
        const gradKPer1000Km = Math.hypot(dTdx, dTdy) * 1e6;
        const baroclinicSupport = smoothstep(1.5, 7.5, gradKPer1000Km);
        const uLow = u[lowBase + k] || 0;
        const uJet = u[upperJetBase + k] || 0;
        const jetSupport = clamp01(
          0.62 * smoothstep(1.5, 18, uJet)
            + 0.38 * smoothstep(1.0, 15, uJet - uLow)
        );
        const moistureSupport = smoothstep(0.0015, 0.0075, qv[lowBase + k] || 0);
        let landOceanSupport = 0;
        if (landField) {
          const landHere = landField[k] === 1;
          const landEdge = (landField[kE] === 1) !== landHere
            || (landField[kW] === 1) !== landHere
            || (landField[kN] === 1) !== landHere
            || (landField[kS] === 1) !== landHere;
          if (landEdge) landOceanSupport = 1;
          else {
            const neighborThermalContrast = Math.max(
              Math.abs((T[lowBase + kE] || 0) - (T[lowBase + k] || 0)),
              Math.abs((T[lowBase + kW] || 0) - (T[lowBase + k] || 0)),
              Math.abs((T[lowBase + kN] || 0) - (T[lowBase + k] || 0)),
              Math.abs((T[lowBase + kS] || 0) - (T[lowBase + k] || 0))
            );
            landOceanSupport = 0.45 * smoothstep(1.5, 8, neighborThermalContrast);
          }
        }
        const lonRadians = ((lonField ? lonField[i] : -180 + ((i + 0.5) * 360) / Math.max(1, nx)) * Math.PI) / 180;
        const waveRaw = 0.52
          + 0.28 * Math.sin(3 * lonRadians + wavePhase * hemi)
          + 0.2 * Math.sin(5 * lonRadians - 0.7 * wavePhase);
        const waveSupport = Math.pow(clamp01(waveRaw), concentrationPower);
        const dynamicSupport = clamp01(
          0.12
            + 0.32 * baroclinicSupport
            + 0.24 * jetSupport
            + 0.18 * moistureSupport
            + 0.14 * landOceanSupport
        );
        const support = belt * waveSupport * dynamicSupport;
        if (support <= supportFloor) continue;
        frontalAscentSupportDiag[k] = support;
        frontalBaroclinicSupportDiag[k] = baroclinicSupport;
        frontalJetSupportDiag[k] = jetSupport;
        frontalLandOceanSupportDiag[k] = landOceanSupport;
        frontalMoistureSupportDiag[k] = moistureSupport;

        const warmAdvection = hemi * (v[lowBase + k] || 0);
        const coldAdvection = -warmAdvection;
        const cloudShield = smoothstep(0.01, 0.25, (
          (qc[midBase + k] || 0) + (qi[midBase + k] || 0) + (qr[midBase + k] || 0) + (qs[midBase + k] || 0)
        ) * 1000);
        const priorPrecipShield = smoothstep(0.015, 0.16, state.precipRate?.[k] || 0);
        const ascentSeed = smoothstep(0.1, 0.55, support);
        stormGenesisPotentialDiag[k] = clamp01(support * (0.5 * baroclinicSupport + 0.3 * jetSupport + 0.2 * moistureSupport));
        stormDeepeningPotentialDiag[k] = clamp01(support * ascentSeed * (0.55 + 0.45 * jetSupport));
        stormPrecipShieldDiag[k] = clamp01(support * Math.max(priorPrecipShield, cloudShield));
        stormOcclusionPotentialDiag[k] = clamp01(support * stormPrecipShieldDiag[k] * (1 - 0.65 * baroclinicSupport));
        stormDecayPotentialDiag[k] = clamp01(support * (1 - moistureSupport) * (1 - 0.6 * jetSupport));
        stormWarmSectorDiag[k] = clamp01(support * smoothstep(0.4, 6, warmAdvection));
        stormColdSectorDiag[k] = clamp01(support * smoothstep(0.4, 6, coldAdvection));
      }
    }

    if (maxAscentPaS > 0 && maxStepPaS > 0) {
      for (let lev = 1; lev < nz; lev += 1) {
        const sigma = clamp01(sigmaHalf[lev]);
        if (sigma < topSigma || sigma > bottomSigma) continue;
        const verticalWeight = smoothstep(topSigma, topSigma + sigmaRamp, sigma)
          * (1 - smoothstep(bottomSigma - sigmaRamp, bottomSigma, sigma));
        if (!(verticalWeight > 0)) continue;
        frontalAscentOmegaDelta.fill(0);
        for (let j = 0; j < ny; j += 1) {
          const row = j * nx;
          let rowAscentDeltaSum = 0;
          let rowCompWeightSum = 0;
          for (let i = 0; i < nx; i += 1) {
            const k = row + i;
            const support = frontalAscentSupportDiag[k];
            const existingAscent = Math.max(0, -omega[lev * N + k]);
            const saturatedAscentTaper = 1 - smoothstep(0.22, 0.55, existingAscent);
            const ascentDelta = support > supportFloor
              ? -Math.min(maxStepPaS, maxAscentPaS * support * verticalWeight * saturatedAscentTaper)
              : 0;
            frontalAscentOmegaDelta[k] = ascentDelta;
            rowAscentDeltaSum += ascentDelta;
            rowCompWeightSum += compensationFloor + Math.pow(1 - clamp01(support), 1.5);
          }
          if (!(rowAscentDeltaSum < 0) || !(rowCompWeightSum > 0)) continue;
          for (let i = 0; i < nx; i += 1) {
            const k = row + i;
            const support = frontalAscentSupportDiag[k];
            const compWeight = compensationFloor + Math.pow(1 - clamp01(support), 1.5);
            const compensationDelta = (-rowAscentDeltaSum * compWeight) / rowCompWeightSum;
            const ascentDelta = frontalAscentOmegaDelta[k];
            omega[lev * N + k] += ascentDelta + compensationDelta;
            if (-ascentDelta > frontalAscentAddedDiag[k]) {
              frontalAscentAddedDiag[k] = -ascentDelta;
            }
            if (compensationDelta > frontalAscentCompensationDiag[k]) {
              frontalAscentCompensationDiag[k] = compensationDelta;
            }
          }
        }
      }

      if (diffuseDampingFrac > 0 && diffuseDampingMaxStepPaS > 0) {
        for (let lev = 1; lev < nz; lev += 1) {
          const sigma = clamp01(sigmaHalf[lev]);
          if (sigma < topSigma || sigma > bottomSigma) continue;
          const verticalWeight = smoothstep(topSigma, topSigma + sigmaRamp, sigma)
            * (1 - smoothstep(bottomSigma - sigmaRamp, bottomSigma, sigma));
          if (!(verticalWeight > 0)) continue;
          frontalAscentOmegaDelta.fill(0);
          for (let j = 0; j < ny; j += 1) {
            const row = j * nx;
            let rowDampDeltaSum = 0;
            let rowCoreWeightSum = 0;
            for (let i = 0; i < nx; i += 1) {
              const k = row + i;
              const support = frontalAscentSupportDiag[k];
              const diffuseWeight = 1 - smoothstep(coreGatherSupport * 0.5, Math.max(coreGatherSupport, supportFloor + 0.01), support);
              const existingAscent = Math.max(0, -omega[lev * N + k]);
              const dampDelta = Math.min(
                diffuseDampingMaxStepPaS,
                existingAscent * diffuseDampingFrac * diffuseWeight * verticalWeight
              );
              frontalAscentOmegaDelta[k] = dampDelta;
              rowDampDeltaSum += dampDelta;
              rowCoreWeightSum += Math.pow(smoothstep(coreGatherSupport, 0.55, support), 1.25);
            }
            if (!(rowDampDeltaSum > 0) || !(rowCoreWeightSum > 0)) continue;
            for (let i = 0; i < nx; i += 1) {
              const k = row + i;
              const coreWeight = Math.pow(smoothstep(coreGatherSupport, 0.55, frontalAscentSupportDiag[k]), 1.25);
              const gatherDelta = -(rowDampDeltaSum * coreWeight) / rowCoreWeightSum;
              const dampDelta = frontalAscentOmegaDelta[k];
              omega[lev * N + k] += dampDelta + gatherDelta;
              if (-gatherDelta > frontalAscentAddedDiag[k]) {
                frontalAscentAddedDiag[k] = -gatherDelta;
              }
              if (dampDelta > frontalAscentCompensationDiag[k]) {
                frontalAscentCompensationDiag[k] = dampDelta;
              }
            }
          }
        }
      }
    }
  }

  if (enableLargeScaleVerticalAdvection && dt > 0) {
    const cflMax = clamp(verticalAdvectionCflMax, 0, 1);
    if (cflMax > 0) {
      const maxSubsteps = Math.max(1, Math.floor(verticalAdvectionMaxSubsteps || 1));
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
      if (!state._vertAdvLayerMass || state._vertAdvLayerMass.length !== nz) {
        state._vertAdvLayerMass = new Float64Array(nz);
      }
      const layerMass = state._vertAdvLayerMass;
      const computeTransport = (lev, k) => {
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
        return { omegaMid, sigmaMid, transportScale };
      };
      const recordVerticalCflClamp = (lev, k, sigmaMid, rawFrac) => {
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
      };
      for (let k = 0; k < N; k++) {
        let columnDelivery = 0;
        let columnExposure = 0;
        const terrainFlowForcing = terrainFlowForcingDiag[k];
        let maxRawFrac = 0;
        for (let lev = 0; lev < nz; lev++) {
          const dpLev = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
          layerMass[lev] = dpLev > 0 ? dpLev / g : 0;
        }
        const computeInterfaceTransport = (iface) => {
          const levAbove = iface - 1;
          const levBelow = iface;
          const above = computeTransport(levAbove, k);
          const below = computeTransport(levBelow, k);
          const sigmaMid = clamp01(0.5 * (above.sigmaMid + below.sigmaMid));
          const transportScale = 0.5 * (above.transportScale + below.transportScale);
          return {
            omegaMid: 0.5 * (above.omegaMid + below.omegaMid),
            sigmaMid,
            transportScale
          };
        };
        for (let iface = 1; iface < nz; iface++) {
          const { omegaMid, transportScale } = computeInterfaceTransport(iface);
          if (omegaMid === 0) continue;
          const sourceLev = omegaMid > 0 ? iface - 1 : iface;
          const dpSource = pHalf[(sourceLev + 1) * N + k] - pHalf[sourceLev * N + k];
          if (dpSource > 0) {
            maxRawFrac = Math.max(maxRawFrac, (Math.abs(omegaMid) * dt * transportScale) / dpSource);
          }
        }
        const substeps = Math.max(1, Math.min(maxSubsteps, Math.ceil(maxRawFrac / cflMax)));
        const subDt = dt / substeps;
        const dThetaLimit = dThetaMaxVertAdvPerStep > 0 ? dThetaMaxVertAdvPerStep / substeps : 0;
        for (let substep = 0; substep < substeps; substep++) {
          for (let lev = 0; lev < nz; lev++) {
            const idx = lev * N + k;
            qvNext[idx] = qv[idx];
            thetaNext[idx] = theta[idx];
          }
          for (let iface = 1; iface < nz; iface++) {
            const { omegaMid, sigmaMid, transportScale } = computeInterfaceTransport(iface);
            if (omegaMid === 0) continue;
            const sourceLev = omegaMid > 0 ? iface - 1 : iface;
            const destLev = omegaMid > 0 ? iface : iface - 1;
            const idxSource = sourceLev * N + k;
            const idxDest = destLev * N + k;
            const sourceMass = layerMass[sourceLev];
            const destMass = layerMass[destLev];
            const dpSource = pHalf[(sourceLev + 1) * N + k] - pHalf[sourceLev * N + k];
            if (!(sourceMass > 0) || !(destMass > 0) || !(dpSource > 0)) continue;
            const rawFrac = (Math.abs(omegaMid) * subDt * transportScale) / dpSource;
            const frac = clamp(rawFrac, 0, cflMax);
            if (!(frac > 0)) continue;
            if (rawFrac > cflMax) recordVerticalCflClamp(sourceLev, k, sigmaMid, rawFrac);
            const qvMass = Math.max(0, qv[idxSource] || 0) * sourceMass * frac;
            qvNext[idxSource] -= qvMass / sourceMass;
            qvNext[idxDest] += qvMass / destMass;
            thetaNext[idxDest] += frac * ((theta[idxSource] || 0) - (theta[idxDest] || 0));
            if (omegaMid < 0 && traceEnabled && qvMass > 0 && sigmaMid <= 0.55) {
              resolvedAscentCloudBirthPotential[k] += qvMass;
              verticalUpperCloudResolvedBirthMass[k] += qvMass;
              resolvedAscentCloudBirthAccumMass[k] += qvMass;
              const bandIndex = findCloudBirthLevelBandIndex(sigmaMid);
              resolvedAscentCloudBirthByBandMass[cloudBirthBandOffset(bandIndex, k, N)] += qvMass;
            }
            if (omegaMid < 0 && terrainFlowForcing > 0 && destLev >= lowLevelStart) {
              columnExposure += (-omegaMid) * subDt;
              columnDelivery += qvMass;
            }
          }
          for (let lev = 0; lev < nz; lev++) {
            const idx = lev * N + k;
            if (qvNext[idx] < 0) {
              const clippedMass = layerMass[lev] > 0 ? (-qvNext[idx]) * layerMass[lev] : 0;
              state.numericalNegativeClipCount[k] += 1;
              state.numericalNegativeClipMass[k] += clippedMass;
              recordBandValue(
                state.numericalNegativeClipByBandMass,
                findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, nz)),
                k,
                N,
                clippedMass
              );
            }
            qv[idx] = Math.max(0, qvNext[idx]);
            if (dThetaLimit > 0) {
              const dTheta = thetaNext[idx] - theta[idx];
              theta[idx] += clamp(dTheta, -dThetaLimit, dThetaLimit);
            } else {
              theta[idx] = thetaNext[idx];
            }
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
    if (!state._walkerColumnTropicalSource || state._walkerColumnTropicalSource.length !== nx) {
      state._walkerColumnTropicalSource = new Float32Array(nx);
    }
    if (!state._walkerColumnTropicalWeight || state._walkerColumnTropicalWeight.length !== nx) {
      state._walkerColumnTropicalWeight = new Float32Array(nx);
    }
    if (!state._walkerColumnSource || state._walkerColumnSource.length !== nx) {
      state._walkerColumnSource = new Float32Array(nx);
    }
    const omegaPos = state._omegaPosScratch;
    const instabArr = state._instabScratch;
    const rowConvectiveSource = state._rowConvectiveSource;
    const rowConvectiveSourceRaw = state._rowConvectiveSourceRaw;
    const rowTransitionSuppressedSource = state._rowTransitionSuppressedSource;
    const walkerColumnTropicalSource = state._walkerColumnTropicalSource;
    const walkerColumnTropicalWeight = state._walkerColumnTropicalWeight;
    const walkerColumnSource = state._walkerColumnSource;
    rowConvectiveSource.fill(0);
    rowConvectiveSourceRaw.fill(0);
    rowTransitionSuppressedSource.fill(0);
    walkerColumnTropicalSource.fill(0);
    walkerColumnTropicalWeight.fill(0);
    walkerColumnSource.fill(0);
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
      const colIndex = k - rowIndex * nx;
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
      const tropicalCoreOnlySupport = tropicalCore * (1 - subtropicalBand);
      const equatorialCoreSupport = latDeg
        ? 1 - smoothstep(Math.max(1, equatorialCoreWidthDeg), Math.max(2, equatorialCoreWidthDeg + 2), latAbs)
        : 1;
      const rainforestCanopy = clamp01(state.rainforestCanopySupport?.[k] || 0);
      const rainforestEvapSupport = smoothstep(0.012, 0.07, state.surfaceEvapRate?.[k] || 0);
      const rainforestSoilSupport = smoothstep(0.06, 0.28, state.soilMoistureFraction?.[k] || 0);
      const rainforestSurfaceSupport = clamp01(
        rainforestCanopy
          * tropicalCoreOnlySupport
          * (0.45 + 0.35 * rainforestEvapSupport + 0.2 * rainforestSoilSupport)
      );
      potentialTarget = clamp01(
        potentialTarget
          + Math.max(0, rainforestSurfaceConvectionBoost) * rainforestSurfaceSupport * (1 - potentialTarget)
      );
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
        0.15 * rhMidSupport +
        Math.max(0, rainforestSurfaceOrganizationBoost) * rainforestSurfaceSupport
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
        && (ascentSupport > 0.05 || moistureConvergenceSupport > 0.05 || rainforestSurfaceSupport > 0.12)
        && (instabSupport > 0.05 || rainforestSurfaceSupport > 0.18);
      if (!hasSupport) continue;

      convMask[k] = activity > 0.22 ? 1 : 0;
      if (convMask[k] === 1) convectiveColumnsCount += 1;

      const dpSurface = pHalf[(levS + 1) * N + k] - pHalf[levS * N + k];
      const massSurface = dpSurface / g;
      const mu = clamp(
        baseMu
          * activity
          * (0.55 + 0.95 * activityOrganization + 0.3 * tropicalCore)
          * (1 + Math.max(0, tropicalCoreConvectiveMuBoost) * tropicalCoreOnlySupport)
          * (1 + Math.max(0, equatorialCoreConvectiveMuBoost) * equatorialCoreSupport)
          * (1 + Math.max(0, rainforestSurfaceMuBoost) * rainforestSurfaceSupport)
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
      const retainedColumnSourceContribution = retainedSourceContribution - concentrationPenaltyContribution;
      rowConvectiveSourceRaw[rowIndex] += rawSourceContribution;
      rowTransitionSuppressedSource[rowIndex] += suppressedSourceContribution;
      rowConvectiveSource[rowIndex] += retainedColumnSourceContribution;
      if (latAbs <= tropicalOrganizationBandDeg) {
        walkerColumnTropicalSource[colIndex] += retainedColumnSourceContribution * columnWeight;
        walkerColumnTropicalWeight[colIndex] += columnWeight;
      }
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
          + Math.max(0, tropicalCoreRainoutBoost) * tropicalCoreOnlySupport * (0.55 + 0.45 * rhMidSupport)
          + Math.max(0, equatorialCoreRainoutBoost) * equatorialCoreSupport * (0.55 + 0.45 * rhMidSupport)
          + Math.max(0, rainforestSurfaceRainoutBoost) * rainforestSurfaceSupport * (0.55 + 0.45 * rhMidSupport)
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
      let walkerSourceSum = 0;
      let walkerSourceCount = 0;
      for (let i = 0; i < nx; i += 1) {
        const columnWeight = walkerColumnTropicalWeight[i] || 0;
        const columnSource = columnWeight > eps ? walkerColumnTropicalSource[i] / columnWeight : 0;
        walkerColumnSource[i] = columnSource;
        walkerSourceSum += columnSource;
        walkerSourceCount += 1;
      }
      const walkerMeanSource = walkerSourceCount > 0 ? walkerSourceSum / walkerSourceCount : 0;
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
          const walkerColumnSourceValue = walkerColumnSource[i] || 0;
          const walkerSourceAnomaly = walkerMeanSource > eps
            ? (walkerMeanSource - walkerColumnSourceValue) / Math.max(walkerMeanSource, eps)
            : 0;
          const walkerSubsidenceSupport = enableWalkerLongitudinalCoupling
            ? clamp01(0.5 + clamp(walkerSourceAnomaly, -1, 1) * clamp(walkerLongitudinalCouplingScale, 0, 1))
            : 0.5;
          walkerLongitudinalSubsidenceSupportDiag[k] = walkerSubsidenceSupport;
          const ventilationDeltaPaS = computeSubtropicalDescentVentilationPaS({
            enabled: enableSubtropicalDescentVentilation,
            sourceDriver,
            latShape,
            walkerSubsidenceSupport,
            convectiveOrganization: convectiveOrganization[k],
            convectivePotential: convectivePotential[k],
            existingOmegaPaS: lowLevelOmegaEffective[k],
            source0: subtropicalDescentVentilationSource0,
            source1: subtropicalDescentVentilationSource1,
            maxPaS: subtropicalDescentVentilationMaxPaS,
            maxStepPaS: subtropicalDescentVentilationMaxStepPaS,
            organizationMax: subtropicalDescentVentilationOrganizationMax,
            potentialMax: subtropicalDescentVentilationPotentialMax
          });
          if (ventilationDeltaPaS > 0) {
            lowLevelOmegaEffective[k] += ventilationDeltaPaS;
            omega[levS * N + k] += ventilationDeltaPaS;
            if (levS > 0) omega[(levS - 1) * N + k] += ventilationDeltaPaS * 0.35;
          }
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
          const descentSupport = smoothstep(-0.005, 0.08, lowLevelOmegaEffective[k]);
          const localOrganizationRelief = 1 - 0.45 * convectiveOrganization[k];
          const localMoistureExportSupport = 0.62 + 0.38 * (1 - clamp01(lowLevelMoistureConvergence[k] * 21600));
          const dryDriver = clamp01(
            2.05 * coupledSourceDriver
              * latShape
              * descentSupport
              * localOrganizationRelief
              * localMoistureExportSupport
              * (0.92 + 0.18 * walkerSubsidenceSupport)
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
          const returnFlowWindSupportProbe = Math.abs(computeHadleyReturnFlowWindTendencyMs({
            enabled: enableHadleyReturnFlowWindCoupling,
            latDeg: lat,
            currentV: 0,
            dryDriver: taperedDryDriver,
            sourceDriver: coupledSourceDriver,
            latShape,
            descentSupport,
            circulationSupport: balanceContract.circulationSupport,
            returnFlowCouplingFrac,
            walkerSubsidenceSupport,
            dt: 1,
            tauSeconds: 1,
            maxMs: 1,
            maxStepMs: 1,
            source0: hadleyReturnFlowWindSource0,
            source1: hadleyReturnFlowWindSource1,
            dry0: hadleyReturnFlowWindDry0,
            dry1: hadleyReturnFlowWindDry1
          }));
          hadleyReturnFlowWindSupportDiag[k] = returnFlowWindSupportProbe;
          if (enableHadleyReturnFlowWindCoupling && returnFlowWindSupportProbe > 0) {
            let maxAppliedWindDelta = 0;
            const windMidSigma = 0.5 * (hadleyReturnFlowWindSigmaTop + hadleyReturnFlowWindSigmaBottom);
            for (let lev = 0; lev < nz; lev += 1) {
              const sigmaMid = sigmaHalf
                ? clamp01(0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]))
                : clamp01((lev + 0.5) / Math.max(1, nz));
              if (sigmaMid < hadleyReturnFlowWindSigmaTop || sigmaMid > hadleyReturnFlowWindSigmaBottom) continue;
              const lowerRamp = smoothstep(hadleyReturnFlowWindSigmaTop, windMidSigma, sigmaMid);
              const upperRamp = 1 - smoothstep(windMidSigma, hadleyReturnFlowWindSigmaBottom, sigmaMid);
              const layerWeight = clamp01(Math.min(lowerRamp, upperRamp) * 1.8);
              if (!(layerWeight > 0)) continue;
              const idx = lev * N + k;
              const deltaV = computeHadleyReturnFlowWindTendencyMs({
                enabled: true,
                latDeg: lat,
                currentV: v[idx],
                dryDriver: taperedDryDriver,
                sourceDriver: coupledSourceDriver,
                latShape,
                descentSupport,
                circulationSupport: balanceContract.circulationSupport,
                returnFlowCouplingFrac,
                walkerSubsidenceSupport,
                dt,
                tauSeconds: hadleyReturnFlowWindTau,
                maxMs: hadleyReturnFlowWindMaxMs * layerWeight,
                maxStepMs: hadleyReturnFlowWindMaxStepMs * layerWeight,
                source0: hadleyReturnFlowWindSource0,
                source1: hadleyReturnFlowWindSource1,
                dry0: hadleyReturnFlowWindDry0,
                dry1: hadleyReturnFlowWindDry1
              });
              if (deltaV === 0) continue;
              v[idx] += deltaV;
              maxAppliedWindDelta = Math.max(maxAppliedWindDelta, Math.abs(deltaV));
            }
            hadleyReturnFlowWindAppliedDiag[k] = maxAppliedWindDelta;
          }
          subtropicalSubsidenceDrying[k] = taperedDryDriver;
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
            const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
            if (dq > 0 && dp > 0) verticalSubtropicalDryingDemandMass[k] += dq * (dp / g);
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

  if (enableSevereWeatherEnvironments && grid.latDeg && grid.latDeg.length >= ny) {
    const levS = nz - 1;
    const levM = Math.max(1, Math.floor(nz * 0.5));
    const levU = Math.max(0, Math.floor(nz * 0.24));
    const lowBase = levS * N;
    const midBase = levM * N;
    const upperBase = levU * N;
    const dayOfYear = ((Number(state.timeUTC) || 0) / 86400) % 365;
    const sstField = state.sstNow && state.sstNow.length === N ? state.sstNow : null;
    const seaIceField = state.seaIceFrac && state.seaIceFrac.length === N ? state.seaIceFrac : null;
    const surfaceTempField = state.Ts && state.Ts.length === N ? state.Ts : null;
    const embeddedThreshold = Math.max(0.02, tropicalCycloneEmbeddedVortexThreshold);

    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      const rowN = Math.max(0, j - 1) * nx;
      const rowS = Math.min(ny - 1, j + 1) * nx;
      const lat = grid.latDeg[j] || 0;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      for (let i = 0; i < nx; i += 1) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const kE = row + iE;
        const kW = row + iW;
        const kN = rowN + i;
        const kS = rowS + i;
        const idxS = lowBase + k;
        const idxM = midBase + k;
        const idxU = upperBase + k;
        const shearMs = Math.hypot(
          (u[idxU] || 0) - (u[idxS] || 0),
          (v[idxU] || 0) - (v[idxS] || 0)
        );
        const relativeVorticityS_1 = (
          ((v[lowBase + kE] || 0) - (v[lowBase + kW] || 0)) * 0.5 * invDxRow
        ) - (
          ((u[lowBase + kN] || 0) - (u[lowBase + kS] || 0)) * 0.5 * invDyRow
        );
        const signedVorticityS_1 = (lat >= 0 ? 1 : -1) * relativeVorticityS_1;
        const boundaryQv = qv[idxS] || 0;
        const midQv = qv[idxM] || 0;
        const humiditySupport = clamp01(
          0.62 * smoothstep(0.011, 0.019, boundaryQv)
            + 0.38 * smoothstep(0.004, 0.010, midQv)
        );
        const shearSupport = 1 - smoothstep(9, 24, shearMs);
        const vorticitySupport = smoothstep(1e-6, 9e-6, signedVorticityS_1);
        const convectivePrecipSupport = smoothstep(0.015, 0.12, state.precipConvectiveRate?.[k] || 0);
        const convectionSupport = Math.max(
          convectiveOrganization[k] || 0,
          smoothstep(5e-4, 0.02, convectiveMassFlux[k] || 0),
          convectivePrecipSupport,
          convectiveAnvilSource[k] || 0
        );
        const basinSeasonSupport = tropicalCycloneBasinSeasonSupport({
          latDeg: lat,
          lonDeg: lonDeg?.[i] ?? -180 + ((i + 0.5) * 360) / Math.max(1, nx),
          dayOfYear
        });
        const tcGenesisPotential = computeTropicalCycloneGenesisPotential({
          latDeg: lat,
          isLand: landMask?.[k] === 1,
          seaIceFrac: seaIceField?.[k] || 0,
          sstK: sstField?.[k] || surfaceTempField?.[k] || T[idxS] || 0,
          boundaryQv,
          midQv,
          shearMs,
          signedVorticityS_1,
          convectionSupport,
          lowLevelConvergenceS_1: lowLevelMoistureConvergence[k] || 0,
          seasonSupport: basinSeasonSupport,
          scale: tropicalCycloneGenesisScale
        });
        tropicalCycloneGenesisPotentialDiag[k] = tcGenesisPotential;
        tropicalCycloneShearSupportDiag[k] = shearSupport;
        tropicalCycloneHumiditySupportDiag[k] = humiditySupport;
        tropicalCycloneVorticitySupportDiag[k] = vorticitySupport;
        tropicalCycloneBasinSeasonSupportDiag[k] = basinSeasonSupport;
        tropicalCycloneEmbeddedVortexDiag[k] = clamp01(
          tcGenesisPotential
            * smoothstep(embeddedThreshold * 0.65, embeddedThreshold * 1.35, tcGenesisPotential)
            * (0.55 + 0.45 * vorticitySupport)
            * (0.65 + 0.35 * clamp01(convectionSupport))
        );

        const seasonSupport = (lat >= 0 ? 0.08 : 0.1) + (lat >= 0 ? 0.92 : 0.9) * seasonalWindowSupport(
          dayOfYear,
          lat >= 0 ? 145 : 330,
          120
        );
        const instabilityK = state._instabScratch?.[k] || 0;
        const instabilitySupport = smoothstep(2, 13, instabilityK);
        const liftSupport = Math.max(
          frontalAscentSupportDiag[k] || 0,
          smoothstep(0.000001, 0.000008, lowLevelMoistureConvergence[k] || 0),
          smoothstep(0.02, 0.15, -(lowLevelOmegaEffective[k] || 0))
        );
        const stormModeSupport = Math.max(
          stormGenesisPotentialDiag[k] || 0,
          stormWarmSectorDiag[k] || 0,
          (frontalAscentSupportDiag[k] || 0) * (convectiveOrganization[k] || 0)
        );
        const tornadoRiskPotential = computeTornadoRiskPotential({
          latDeg: lat,
          isLand: landMask?.[k] === 1,
          surfaceTempK: surfaceTempField?.[k] || T[idxS] || 0,
          boundaryQv,
          instabilityK,
          shearMs,
          liftSupport,
          stormModeSupport,
          seasonSupport,
          scale: tornadoRiskScale
        });
        tornadoRiskPotentialDiag[k] = tornadoRiskPotential;
        tornadoInstabilitySupportDiag[k] = instabilitySupport;
        tornadoShearSupportDiag[k] = smoothstep(10, 28, shearMs);
        tornadoLiftSupportDiag[k] = liftSupport;
        tornadoStormModeSupportDiag[k] = stormModeSupport;
      }
    }
  }

  // R9-β4: Tropical ascent seed.  Gaussian ω injection in the deep tropics
  // to bootstrap the Hadley ascending branch out of a no-ITCZ feedback state.
  // Diagnosis memo: weather-validation/reports/r9-beta3-subsidence-is-hyperactive.md
  //
  // Guarded by enableTropicalAscentSeed (default false).  Fades linearly
  // between fadeStartDay and fadeStartDay + fadeDurationDays so the
  // self-sustaining circulation (if any) becomes visible after the seed
  // is removed.  Applied as an additive omega perturbation after dynamical
  // omega is computed, matching the pattern of the equatorial-edge
  // subsidence guardrail above.
  if (enableTropicalAscentSeed && tropicalAscentSeedPeakPaS > 0) {
    const elapsedDays = (state.timeUTC || 0) / 86400;
    const fadeStart = Number(tropicalAscentSeedFadeStartDay) || 0;
    const fadeDur = Math.max(1, Number(tropicalAscentSeedFadeDurationDays) || 1);
    let fade = 1;
    if (elapsedDays > fadeStart) {
      fade = Math.max(0, 1 - (elapsedDays - fadeStart) / fadeDur);
    }
    if (fade > 0) {
      const latDegSeed = grid.latDeg;
      const centerLat = Number(tropicalAscentSeedCenterLatDeg) || 0;
      const widthLat = Math.max(1, Number(tropicalAscentSeedWidthDeg) || 10);
      const sigHi = Math.max(0.05, Math.min(0.95, Number(tropicalAscentSeedSigmaHi) || 0.7));
      const sigLo = Math.max(0.05, Math.min(0.95, Number(tropicalAscentSeedSigmaLo) || 0.3));
      const sigMid = 0.5 * (sigHi + sigLo);
      const sigSpanHalf = Math.max(1e-3, 0.5 * (sigHi - sigLo));
      const peak = Number(tropicalAscentSeedPeakPaS) || 0;
      for (let lv = 0; lv <= nz; lv += 1) {
        const s = sigmaHalf?.[lv] ?? 0;
        if (s < sigLo || s > sigHi) continue;
        const sD = (s - sigMid) / sigSpanHalf;
        const sEnv = Math.exp(-0.5 * sD * sD);
        if (sEnv < 0.01) continue;
        for (let j = 0; j < ny; j += 1) {
          const latVal = latDegSeed?.[j] ?? 0;
          const latD = (latVal - centerLat) / widthLat;
          const latEnv = Math.exp(-0.5 * latD * latD);
          if (latEnv < 0.01) continue;
          const seedPaS = -peak * fade * sEnv * latEnv;
          const rowBase = lv * N + j * nx;
          for (let i = 0; i < nx; i += 1) {
            omega[rowBase + i] += seedPaS;
          }
        }
      }
    }
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
      verticalCloudErosionToVaporMass[k] += scaleUpperCloudMassAtCell(state, pHalf, sigmaHalf, nz, k, keepFrac, {
        evaporateToVapor: true
      });
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
      verticalCloudErosionToVaporMass[k] += scaleUpperCloudMassAtCell(state, pHalf, sigmaHalf, nz, k, keepFrac, {
        evaporateToVapor: true
      });
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
      ? ((-Math.min(0, qv[m])) + (-Math.min(0, qc[m])) + (-Math.min(0, qi[m])) + (-Math.min(0, qr[m])) + (-Math.min(0, qs[m]))) * (dpLev / g)
      : 0;
    const cloudClipMass = dpLev > 0
      ? ((-Math.min(0, qc[m])) + (-Math.min(0, qi[m])) + (-Math.min(0, qr[m])) + (-Math.min(0, qs[m]))) * (dpLev / g)
      : 0;
    const clipCount = (qv[m] < 0) + (qc[m] < 0) + (qi[m] < 0) + (qr[m] < 0) + (qs[m] < 0);
    const cloudClipCount = (qc[m] < 0) + (qi[m] < 0) + (qr[m] < 0) + (qs[m] < 0);
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
    qs[m] = Math.max(0, qs[m]);
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
      w += (qv[idx] + qc[idx] + qi[idx] + qr[idx] + qs[idx]) * (dp / g);
      }
      const delta = Math.abs(w - waterBefore[s]);
      if (delta > 1e-6) {
        console.warn(`[V2 vertical] water non-conservation sample k=${k} delta=${delta.toExponential(3)}`);
        break;
      }
    }
  }
}
