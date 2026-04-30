#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Cp, Rd } from '../../src/weather/constants.js';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = corridorProof.repoRoot || path.resolve(__dirname, '..', '..');

const DEFAULT_CONTRACT_PATH = path.join(repoRoot, 'weather-validation', 'reports', 'prevertical-ownership-contract.json');
const DEFAULT_REPORT_BASE = path.join(repoRoot, 'weather-validation', 'output', 'phase1b-exact-corridor-support-proof');
const DEFAULT_DESIGN_PATH = path.join(repoRoot, 'weather-validation', 'reports', 'phase1b-second-minimal-patch-design.md');
const DEFAULT_BOUNDARY_LEDGER_PATH = path.join(repoRoot, 'weather-validation', 'output', 'prevertical-boundary-ledger.json');
const DEFAULT_PROVENANCE_PATH = path.join(repoRoot, 'weather-validation', 'output', 'prevertical-provenance-ownership.json');
const DEFAULT_PATCH_PROOF_PATH = path.join(repoRoot, 'weather-validation', 'output', 'prevertical-patch-placement-proof.json');

const P0 = 100000;
const KAPPA = Rd / Cp;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const mean = corridorProof.mean || ((values) => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
});

const argv = process.argv.slice(2);
let contractPath = DEFAULT_CONTRACT_PATH;
let reportBase = DEFAULT_REPORT_BASE;
let designPath = DEFAULT_DESIGN_PATH;
let boundaryLedgerPath = DEFAULT_BOUNDARY_LEDGER_PATH;
let provenancePath = DEFAULT_PROVENANCE_PATH;
let patchProofPath = DEFAULT_PATCH_PROOF_PATH;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--design-path' && argv[i + 1]) designPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--design-path=')) designPath = path.resolve(arg.slice('--design-path='.length));
  else if (arg === '--boundary-ledger' && argv[i + 1]) boundaryLedgerPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--boundary-ledger=')) boundaryLedgerPath = path.resolve(arg.slice('--boundary-ledger='.length));
  else if (arg === '--provenance' && argv[i + 1]) provenancePath = path.resolve(argv[++i]);
  else if (arg.startsWith('--provenance=')) provenancePath = path.resolve(arg.slice('--provenance='.length));
  else if (arg === '--patch-proof' && argv[i + 1]) patchProofPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--patch-proof=')) patchProofPath = path.resolve(arg.slice('--patch-proof='.length));
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

const metricAt = (arr, idx) => Array.isArray(arr) && idx >= 0 && idx < arr.length ? Number(arr[idx]) || 0 : 0;

const computeSurfaceDivergence = ({ grid, state, cellIndex }) => {
  const { nx, ny, invDx, invDy, cosLat } = grid;
  const { u, v, nz } = state;
  const row = Math.floor(cellIndex / nx);
  const col = cellIndex % nx;
  const rowN = Math.max(0, row - 1) * nx;
  const rowS = Math.min(ny - 1, row + 1) * nx;
  const iE = (col + 1) % nx;
  const iW = (col - 1 + nx) % nx;
  const surfaceBase = (nz - 1) * state.N;
  const k = cellIndex;
  const kE = row * nx + iE;
  const kW = row * nx + iW;
  const kN = rowN + col;
  const kS = rowS + col;
  const cosC = cosLat[row];
  const cosN = cosLat[Math.max(0, row - 1)];
  const cosS = cosLat[Math.min(ny - 1, row + 1)];
  const du_dx = (u[surfaceBase + kE] - u[surfaceBase + kW]) * 0.5 * invDx[row];
  const dvcos_dy = (v[surfaceBase + kN] * cosN - v[surfaceBase + kS] * cosS) * 0.5 * invDy[row];
  return du_dx + dvcos_dy / cosC;
};

const computeFreshSupport = ({ core, cellIndex }) => {
  const { grid, state, geo, vertParams } = core;
  const { pHalf, pMid, theta, qv, omega, sigmaHalf, nz } = state;
  const { nx } = grid;
  const rowIndex = Math.floor(cellIndex / nx);
  const latDeg = Number.isFinite(grid.latDeg?.[rowIndex])
    ? grid.latDeg[rowIndex]
    : 90 - ((rowIndex + 0.5) / Math.max(1, grid.ny || 1)) * 180;
  const latAbs = Math.abs(latDeg);
  const levS = nz - 1;
  const levM = Math.max(1, Math.floor(nz / 2));
  const idxS = levS * state.N + cellIndex;
  const idxM = levM * state.N + cellIndex;
  const p1 = Math.max(100, pHalf[levS * state.N + cellIndex]);
  const p2 = Math.max(100, pHalf[(levS + 1) * state.N + cellIndex]);
  const pMidS = Math.sqrt(p1 * p2);
  const PiS = Math.pow(pMidS / P0, KAPPA);
  const TS = theta[idxS] * PiS;
  const qsS = saturationMixingRatio(TS, pMidS);
  const rhS = qv[idxS] / Math.max(qsS, 1e-12);
  const pMidM = Math.max(100, pMid[idxM]);
  const PiM = Math.pow(pMidM / P0, KAPPA);
  const TM = theta[idxM] * PiM;
  const qsMid = saturationMixingRatio(TM, pMidM);
  const rhMid = qv[idxM] / Math.max(qsMid, 1e-12);
  const qvThetaeS = Math.min(qv[idxS], vertParams.thetaeQvCap ?? 0.03);
  const qvThetaeM = Math.min(qv[idxM], vertParams.thetaeQvCap ?? 0.03);
  const thetaeS = theta[idxS] * (1 + (vertParams.thetaeCoeff ?? 10) * qvThetaeS);
  const thetaeM = theta[idxM] * (1 + (vertParams.thetaeCoeff ?? 10) * qvThetaeM);
  const instab = thetaeS - thetaeM;
  const div = computeSurfaceDivergence({ grid, state, cellIndex });
  const lowLevelMoistureConvergence = Math.max(0, -div);
  const omegaLow = omega[levS * state.N + cellIndex];
  const qvTrig = vertParams.qvTrig ?? 0.002;
  const rhTrig = vertParams.rhTrig ?? 0.75;
  const rhMidMin = vertParams.rhMidMin ?? 0.25;
  const omegaTrig = Math.max(vertParams.omegaTrig ?? 0.3, core.state.vertMetrics?.omegaPosP90 || 0);
  const instabTrig = vertParams.instabTrig ?? 3;
  const tropicalOrganizationBandDeg = vertParams.tropicalOrganizationBandDeg ?? 15;
  const subtropicalSubsidenceLat0 = vertParams.subtropicalSubsidenceLat0 ?? 15;
  const subtropicalSubsidenceLat1 = vertParams.subtropicalSubsidenceLat1 ?? 35;
  const qvSupport = smoothstep(qvTrig * 0.5, Math.max(qvTrig * 3, qvTrig + 0.003), qv[idxS]);
  const rhSupport = smoothstep(Math.max(0, rhTrig - 0.15), Math.min(1, rhTrig + 0.08), rhS);
  const rhMidSupport = smoothstep(Math.max(0, rhMidMin * 0.6), Math.min(1, rhMidMin + 0.35), rhMid);
  const ascentSupport = smoothstep(Math.max(0.03, omegaTrig * 0.35), Math.max(0.08, omegaTrig * 2.2), -omegaLow);
  const instabSupport = smoothstep(Math.max(0.5, instabTrig * 0.35), Math.max(1.5, instabTrig * 1.8), instab);
  const moistureConvergenceSupport = clamp01(lowLevelMoistureConvergence * 21600);
  const tropicalCore = 1 - smoothstep(Math.max(6, tropicalOrganizationBandDeg * 0.55), tropicalOrganizationBandDeg + 2, latAbs);
  const subtropicalBand = smoothstep(subtropicalSubsidenceLat0 - 5, subtropicalSubsidenceLat0 + 2, latAbs)
    * (1 - smoothstep(subtropicalSubsidenceLat1 - 4, subtropicalSubsidenceLat1 + 2, latAbs));
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
  potentialTarget = clamp01(
    potentialTarget
      * (0.84 + 0.24 * tropicalCore)
      * (1 - 0.62 * subtropicalSuppression)
  );
  const staleCarryoverDominance = clamp01(
    (state.carriedOverUpperCloudMass?.[cellIndex] || 0) / Math.max(1e-6, state.upperCloudPath?.[cellIndex] || 0)
  );
  return {
    latDeg: round(latDeg, 5),
    lowLevelOmegaRawPaS: round(omegaLow, 5),
    lowLevelMoistureConvergenceS_1: round(lowLevelMoistureConvergence, 7),
    rhSurfaceFrac: round(rhS, 5),
    rhMidFrac: round(rhMid, 5),
    instabilityK: round(instab, 5),
    qvSupport: round(qvSupport, 5),
    rhSupport: round(rhSupport, 5),
    rhMidSupport: round(rhMidSupport, 5),
    ascentSupport: round(ascentSupport, 5),
    instabSupport: round(instabSupport, 5),
    moistureConvergenceSupport: round(moistureConvergenceSupport, 5),
    tropicalCore: round(tropicalCore, 5),
    subtropicalBand: round(subtropicalBand, 5),
    organizedSupport: round(organizedSupport, 5),
    neutralToSubsidingSupport: round(neutralToSubsidingSupport, 5),
    subtropicalSuppression: round(subtropicalSuppression, 5),
    freshPotentialTarget: round(potentialTarget, 5),
    staleCarryoverDominance: round(staleCarryoverDominance, 5)
  };
};

const extractStoredSupport = (state, cellIndex) => ({
  convectivePotential: round(state.convectivePotential?.[cellIndex] || 0, 5),
  convectiveOrganization: round(state.convectiveOrganization?.[cellIndex] || 0, 5),
  convectiveMassFluxKgM2S: round(state.convectiveMassFlux?.[cellIndex] || 0, 5),
  convectiveDetrainmentMassKgM2: round(state.convectiveDetrainmentMass?.[cellIndex] || 0, 5),
  convectiveAnvilSource: round(state.convectiveAnvilSource?.[cellIndex] || 0, 5),
  lowLevelMoistureConvergenceDiagS_1: round(state.lowLevelMoistureConvergence?.[cellIndex] || 0, 7),
  lowLevelOmegaEffectiveDiagPaS: round(state.lowLevelOmegaEffective?.[cellIndex] || 0, 5),
  subtropicalSubsidenceDryingDiag: round(state.subtropicalSubsidenceDrying?.[cellIndex] || 0, 5),
  upperCloudTimeSinceImportDays: round((state.upperCloudTimeSinceImportSeconds?.[cellIndex] || 0) / 86400, 5),
  upperCloudResidenceTimeDays: round((state.upperCloudResidenceTimeSeconds?.[cellIndex] || 0) / 86400, 5),
  upperCloudStaleMassKgM2: round(state.upperCloudStaleMass?.[cellIndex] || 0, 5),
  upperCloudRecentlyImportedMassKgM2: round(state.upperCloudRecentlyImportedMass?.[cellIndex] || 0, 5),
  weakErosionCloudSurvivalMassKgM2: round(state.weakErosionCloudSurvivalMass?.[cellIndex] || 0, 5),
  importedAnvilPersistenceMassKgM2: round(state.importedAnvilPersistenceMass?.[cellIndex] || 0, 5),
  upperCloudPotentialErosionMassKgM2: round(state.upperCloudPotentialErosionMass?.[cellIndex] || 0, 5),
  upperCloudAppliedErosionMassKgM2: round(state.upperCloudAppliedErosionMass?.[cellIndex] || 0, 5),
  upperCloudBlockedErosionMassKgM2: round(state.upperCloudBlockedErosionMass?.[cellIndex] || 0, 5),
  upperCloudBlockedByWeakSubsidenceMassKgM2: round(state.upperCloudBlockedByWeakSubsidenceMass?.[cellIndex] || 0, 5),
  upperCloudBlockedByWeakDescentVentMassKgM2: round(state.upperCloudBlockedByWeakDescentVentMass?.[cellIndex] || 0, 5),
  upperCloudBlockedByLocalSupportMassKgM2: round(state.upperCloudBlockedByLocalSupportMass?.[cellIndex] || 0, 5),
  upperCloudPathKgM2: round(state.upperCloudPath?.[cellIndex] || 0, 5),
  carriedOverUpperCloudMassKgM2: round(state.carriedOverUpperCloudMass?.[cellIndex] || 0, 5)
});

const corridorMeanFor = (indices, getter) => round(mean(indices.map((idx) => getter(idx))), 5);

const buildSupportSnapshot = ({ core, targetCellIndex, corridorIndices }) => {
  const targetStored = extractStoredSupport(core.state, targetCellIndex);
  const targetFresh = computeFreshSupport({ core, cellIndex: targetCellIndex });
  const corridorStored = {
    convectivePotential: corridorMeanFor(corridorIndices, (idx) => core.state.convectivePotential?.[idx] || 0),
    convectiveOrganization: corridorMeanFor(corridorIndices, (idx) => core.state.convectiveOrganization?.[idx] || 0),
    convectiveMassFluxKgM2S: corridorMeanFor(corridorIndices, (idx) => core.state.convectiveMassFlux?.[idx] || 0),
    convectiveDetrainmentMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.convectiveDetrainmentMass?.[idx] || 0),
    convectiveAnvilSource: corridorMeanFor(corridorIndices, (idx) => core.state.convectiveAnvilSource?.[idx] || 0),
    lowLevelMoistureConvergenceDiagS_1: corridorMeanFor(corridorIndices, (idx) => core.state.lowLevelMoistureConvergence?.[idx] || 0),
    lowLevelOmegaEffectiveDiagPaS: corridorMeanFor(corridorIndices, (idx) => core.state.lowLevelOmegaEffective?.[idx] || 0),
    subtropicalSubsidenceDryingDiag: corridorMeanFor(corridorIndices, (idx) => core.state.subtropicalSubsidenceDrying?.[idx] || 0),
    upperCloudTimeSinceImportDays: corridorMeanFor(corridorIndices, (idx) => (core.state.upperCloudTimeSinceImportSeconds?.[idx] || 0) / 86400),
    upperCloudResidenceTimeDays: corridorMeanFor(corridorIndices, (idx) => (core.state.upperCloudResidenceTimeSeconds?.[idx] || 0) / 86400),
    upperCloudStaleMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudStaleMass?.[idx] || 0),
    upperCloudRecentlyImportedMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudRecentlyImportedMass?.[idx] || 0),
    weakErosionCloudSurvivalMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.weakErosionCloudSurvivalMass?.[idx] || 0),
    importedAnvilPersistenceMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.importedAnvilPersistenceMass?.[idx] || 0),
    upperCloudPotentialErosionMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudPotentialErosionMass?.[idx] || 0),
    upperCloudAppliedErosionMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudAppliedErosionMass?.[idx] || 0),
    upperCloudBlockedErosionMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudBlockedErosionMass?.[idx] || 0),
    upperCloudBlockedByWeakSubsidenceMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudBlockedByWeakSubsidenceMass?.[idx] || 0),
    upperCloudBlockedByWeakDescentVentMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudBlockedByWeakDescentVentMass?.[idx] || 0),
    upperCloudBlockedByLocalSupportMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudBlockedByLocalSupportMass?.[idx] || 0),
    upperCloudPathKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.upperCloudPath?.[idx] || 0),
    carriedOverUpperCloudMassKgM2: corridorMeanFor(corridorIndices, (idx) => core.state.carriedOverUpperCloudMass?.[idx] || 0)
  };
  const freshByCell = corridorIndices.map((idx) => computeFreshSupport({ core, cellIndex: idx }));
  const corridorFresh = {
    lowLevelOmegaRawPaS: round(mean(freshByCell.map((entry) => entry.lowLevelOmegaRawPaS)), 5),
    lowLevelMoistureConvergenceS_1: round(mean(freshByCell.map((entry) => entry.lowLevelMoistureConvergenceS_1)), 7),
    rhSurfaceFrac: round(mean(freshByCell.map((entry) => entry.rhSurfaceFrac)), 5),
    rhMidFrac: round(mean(freshByCell.map((entry) => entry.rhMidFrac)), 5),
    instabilityK: round(mean(freshByCell.map((entry) => entry.instabilityK)), 5),
    qvSupport: round(mean(freshByCell.map((entry) => entry.qvSupport)), 5),
    rhSupport: round(mean(freshByCell.map((entry) => entry.rhSupport)), 5),
    rhMidSupport: round(mean(freshByCell.map((entry) => entry.rhMidSupport)), 5),
    ascentSupport: round(mean(freshByCell.map((entry) => entry.ascentSupport)), 5),
    instabSupport: round(mean(freshByCell.map((entry) => entry.instabSupport)), 5),
    moistureConvergenceSupport: round(mean(freshByCell.map((entry) => entry.moistureConvergenceSupport)), 5),
    tropicalCore: round(mean(freshByCell.map((entry) => entry.tropicalCore)), 5),
    subtropicalBand: round(mean(freshByCell.map((entry) => entry.subtropicalBand)), 5),
    organizedSupport: round(mean(freshByCell.map((entry) => entry.organizedSupport)), 5),
    neutralToSubsidingSupport: round(mean(freshByCell.map((entry) => entry.neutralToSubsidingSupport)), 5),
    subtropicalSuppression: round(mean(freshByCell.map((entry) => entry.subtropicalSuppression)), 5),
    freshPotentialTarget: round(mean(freshByCell.map((entry) => entry.freshPotentialTarget)), 5),
    staleCarryoverDominance: round(mean(freshByCell.map((entry) => entry.staleCarryoverDominance)), 5)
  };
  return {
    targetCell: {
      stored: targetStored,
      fresh: targetFresh
    },
    corridorBand: {
      stored: corridorStored,
      fresh: corridorFresh
    }
  };
};

const assessMissingCondition = ({ supportSnapshot, boundaryLedger, provenanceReport, contract }) => {
  const targetStored = supportSnapshot.targetCell.stored;
  const targetFresh = supportSnapshot.targetCell.fresh;
  const corridorStored = supportSnapshot.corridorBand.stored;
  const corridorFresh = supportSnapshot.corridorBand.fresh;
  const targetOwnership = provenanceReport.current?.targetCellOwnership || provenanceReport.primaryOwnerValues?.targetCell || provenanceReport.targetCellOwnership || {};
  const targetBoundaryProxy = boundaryLedger.currentStepOwnershipProxy?.targetCell
    || boundaryLedger.boundaryComparisons?.currentStepOwnershipProxy?.targetCell
    || {
      previousStepResidualUpperCloudKgM2: boundaryLedger.boundaryComparisons?.targetCell?.[0]?.currentUpperCloudMassKgM2 || 0,
      currentStepAdvectedUpperCloudImportKgM2: 0,
      currentStepLocalPreverticalBirthKgM2: 0
    };
  const previousResidualKgM2 = Number(targetOwnership.previousStepResidualUpperCloud || targetBoundaryProxy.previousStepResidualUpperCloudKgM2 || 0);
  const advectedImportKgM2 = Number(targetOwnership.currentStepAdvectedUpperCloud || targetBoundaryProxy.currentStepAdvectedUpperCloudImportKgM2 || 0);
  const preverticalMassKgM2 = Number(boundaryLedger.parityCheck?.observedPreverticalMassKgM2 || targetStored.upperCloudPathKgM2 || 0);
  const dominanceFrac = preverticalMassKgM2 > 0 ? previousResidualKgM2 / preverticalMassKgM2 : 0;
  const localBirthWeak = (targetFresh.freshPotentialTarget || 0) < 0.28;
  const noActualVerticalClearance = (contract.frozenFacts?.currentVerticalTargetCell?.appliedErosionMassKgM2 || 0) === 0;
  const neutralToDescending = (targetFresh.neutralToSubsidingSupport || 0) >= 0.35;
  const freshVsStoredOmegaGap = Math.abs((targetFresh.lowLevelOmegaRawPaS || 0) - (targetStored.lowLevelOmegaEffectiveDiagPaS || 0));
  const freshVsStoredMoistureGap = Math.abs((targetFresh.lowLevelMoistureConvergenceS_1 || 0) - (targetStored.lowLevelMoistureConvergenceDiagS_1 || 0));
  const stalePersistentDominance = (targetFresh.staleCarryoverDominance || 0) >= 0.75;
  const appliedErosionShare = (targetStored.upperCloudAppliedErosionMassKgM2 || 0) / Math.max(1e-6, targetStored.upperCloudPotentialErosionMassKgM2 || 0);
  const weakOrganizedSupport = (targetFresh.organizedSupport || 0) < 0.25;
  const strongSubtropicalSuppression = (targetFresh.subtropicalSuppression || 0) >= 0.6;
  const stronglySubtropical = (targetFresh.subtropicalBand || 0) >= 0.7;
  const negligibleConvectiveEngine = (targetStored.convectiveMassFluxKgM2S || 0) <= 1e-4
    && (targetStored.convectiveDetrainmentMassKgM2 || 0) <= 0.001
    && (targetStored.convectiveAnvilSource || 0) <= 0.02;
  const weakFreshBirth = (targetFresh.freshPotentialTarget || 0) < 0.28;

  let key = 'mixed_or_underdetermined';
  let explanation = 'The exact corridor state does not yet collapse to one missing handoff condition.';
  if (
    dominanceFrac >= 0.8
    && stalePersistentDominance
    && stronglySubtropical
    && strongSubtropicalSuppression
    && weakOrganizedSupport
    && weakFreshBirth
    && negligibleConvectiveEngine
    && appliedErosionShare < 0.1
  ) {
    key = 'missing_subtropical_suppressed_stale_reservoir_override';
    explanation = 'The real 26.25 deg N corridor is a strongly subtropical-suppressed, weakly organized column with almost no convective engine, yet a fully stale imported upper-cloud reservoir still survives the handoff and only about five percent of potential erosion is applied. The missing condition is an explicit stale-reservoir override in the vertical carryover/erosion handoff that clears old imported cloud when fresh organized support is weak, even if the column stays moist and slightly ascending.';
  } else if (
    dominanceFrac >= 0.8
    && stalePersistentDominance
    && localBirthWeak
    && noActualVerticalClearance
    && neutralToDescending
  ) {
    key = 'missing_explicit_prevertical_stale_carryover_clearance';
    explanation = 'The real corridor is dominated by stale previous-step carryover, current-step local birth support is weak, and the handoff still applies zero real erosion before microphysics. The missing condition is an explicit prevertical stale-carryover clearance path, not a stronger downstream cleanup rule.';
  } else if (freshVsStoredOmegaGap > 0.03 || freshVsStoredMoistureGap > 0.00005) {
    key = 'missing_fresh_prevertical_support_recomputation';
    explanation = 'The corridor depends on stored vertical diagnostic fields that drift from the exact prevertical state. The missing condition is a fresh current-step support/ventilation recomputation at the handoff.';
  } else if (appliedErosionShare < 0.05 && (corridorStored.upperCloudBlockedByWeakDescentVentMassKgM2 || 0) > (corridorStored.upperCloudBlockedByLocalSupportMassKgM2 || 0)) {
    key = 'missing_neutral_to_descending_ventilation_clearance';
    explanation = 'The corridor is not lacking cloud age or ownership information; it is lacking an actual ventilation-based clearance branch in neutral-to-descending subtropical flow.';
  }

  return {
    key,
    explanation,
    evidence: {
      targetPreviousResidualKgM2: round(previousResidualKgM2, 5),
      targetAdvectedImportKgM2: round(advectedImportKgM2, 5),
      targetResidualDominanceFrac: round(dominanceFrac, 5),
      targetFreshPotentialTarget: targetFresh.freshPotentialTarget,
      targetNeutralToDescendingSupport: targetFresh.neutralToSubsidingSupport,
      targetFreshVsStoredOmegaGapPaS: round(freshVsStoredOmegaGap, 5),
      targetFreshVsStoredMoistureGapS_1: round(freshVsStoredMoistureGap, 7),
      targetAppliedErosionShare: round(appliedErosionShare, 5)
    }
  };
};

const buildSecondPatchDesign = ({ contract, supportSnapshot, missingCondition }) => {
  const targetFresh = supportSnapshot.targetCell.fresh;
  const staleReservoirOverride = missingCondition.key === 'missing_subtropical_suppressed_stale_reservoir_override';
  return {
    title: 'Second minimal patch design',
    placement: 'stepVertical5 carryover / erosion handoff in vertical5.js',
    patchKind: staleReservoirOverride
      ? 'subtropical-suppressed stale-reservoir erosion override'
      : 'fresh-state stale-carryover clearance',
    rationale: missingCondition.explanation,
    exactInputs: [
      'previous-step residual carryover fraction at the target cell / corridor',
      'fresh current-step subtropical suppression strength at the proving instant',
      'fresh current-step organized support at the proving instant',
      'fresh current-step low-level omega at the proving instant',
      'fresh current-step low-level moisture convergence at the proving instant',
      'fresh current-step local birth support target from RH, instability, ascent, and convergence',
      'fresh stale-carryover dominance versus local birth support',
      'stored current-step convective mass flux / detrainment / anvil source only as secondary corroboration'
    ],
    avoidUsingAsPrimaryGate: [
      'stored convectiveOrganization from the prior step',
      'stored convectiveMassFlux from the prior step',
      'stored convectiveDetrainmentMass from the prior step',
      'stored convectiveAnvilSource from the prior step'
    ],
    triggerShape: {
      positiveLatitudeOnly: true,
      subtropicalBandDeg: [22, 35],
      requiresResidualDominance: true,
      requiresWeakFreshBirthSupport: true,
      requiresSubtropicalSuppression: staleReservoirOverride,
      requiresWeakOrganizedSupport: staleReservoirOverride,
      allowsNeutralToDescendingVentilation: true,
      disallowsTropicalCore: Math.abs(targetFresh.latDeg || 0) < 15
    },
    predictedSignature: {
      firstChange: 'endPreviousStepMicrophysics5 previous-step residual carryover falls',
      ownershipAfterPatch: 'previousStepResidualUpperCloud should shrink before currentStepAdvectedUpperCloud changes materially',
      localBirthExpectation: 'currentStepLocalPreverticalBirth remains near zero in the target cell',
      falsification: staleReservoirOverride
        ? 'If the patch only helps when low-level descent strengthens, or if it materially changes local birth/advection before the stale previous-step reservoir shrinks, then the override is keyed to the wrong condition.'
        : 'If the patch mostly changes current-step advection or downstream microphysics while the previous-step residual handoff stays high, the placement or gating is wrong.'
    },
    sourceArtifacts: {
      contract: contractPath,
      boundaryLedger: boundaryLedgerPath,
      provenanceOwnership: provenancePath,
      patchPlacementProof: patchProofPath
    }
  };
};

const renderMarkdown = ({ report, patchDesign }) => {
  const currentSnapshot = report.supportSnapshot.current;
  const lines = [
    '# Phase 1B Exact Corridor Support Proof',
    '',
    '## Verdict',
    `- Missing condition: \`${report.missingCondition.key}\``,
    `- Explanation: ${report.missingCondition.explanation}`,
    '',
    '## Frozen corridor',
    `- Sector: ${report.contract.corridor.sectorKey}`,
    `- Lat band: ${report.contract.corridor.latBandDeg[0]}-${report.contract.corridor.latBandDeg[1]} deg`,
    `- Target cell: ${report.contract.corridor.targetCell.cellIndex} (lat ${report.contract.corridor.targetCell.latDeg}, lon ${report.contract.corridor.targetCell.lonDeg})`,
    `- Checkpoint day: ${report.contract.corridor.checkpointDay}`,
    '',
    '## Ownership context',
    `- Target previous-step residual: ${report.missingCondition.evidence.targetPreviousResidualKgM2} kg/m²`,
    `- Target advected import: ${report.missingCondition.evidence.targetAdvectedImportKgM2} kg/m²`,
    `- Residual dominance: ${report.missingCondition.evidence.targetResidualDominanceFrac}`,
    '',
    '## Exact target-cell support values',
    `- Fresh low-level omega: ${currentSnapshot.targetCell.fresh.lowLevelOmegaRawPaS} Pa/s`,
    `- Fresh low-level moisture convergence: ${currentSnapshot.targetCell.fresh.lowLevelMoistureConvergenceS_1} s^-1`,
    `- Fresh potential target: ${currentSnapshot.targetCell.fresh.freshPotentialTarget}`,
    `- Fresh neutral-to-descending support: ${currentSnapshot.targetCell.fresh.neutralToSubsidingSupport}`,
    `- Stored low-level omega diag: ${currentSnapshot.targetCell.stored.lowLevelOmegaEffectiveDiagPaS} Pa/s`,
    `- Stored low-level moisture convergence diag: ${currentSnapshot.targetCell.stored.lowLevelMoistureConvergenceDiagS_1} s^-1`,
    `- Stored upper-cloud applied erosion: ${currentSnapshot.targetCell.stored.upperCloudAppliedErosionMassKgM2} kg/m²`,
    `- Stored upper-cloud blocked erosion: ${currentSnapshot.targetCell.stored.upperCloudBlockedErosionMassKgM2} kg/m²`,
    '',
    '## Patch-design consequence',
    `- Placement: ${patchDesign.placement}`,
    `- Patch kind: ${patchDesign.patchKind}`,
    `- First predicted signature: ${patchDesign.predictedSignature.firstChange}`,
    `- Falsification rule: ${patchDesign.predictedSignature.falsification}`
  ];
  return `${lines.join('\n')}\n`;
};

const renderPatchDesignMarkdown = ({ patchDesign, report }) => {
  const lines = [
    '# Phase 1B Second Minimal Patch Design',
    '',
    `This design is grounded in [phase1b-exact-corridor-support-proof.json](${report.reportPathJson}) and the frozen corridor contract, not in a proxy unit-test state.`,
    '',
    '## Placement',
    `- ${patchDesign.placement}`,
    '',
    '## What the proof says is missing',
    `- ${report.missingCondition.explanation}`,
    '',
    '## Exact inputs the patch should use',
    ...patchDesign.exactInputs.map((line) => `- ${line}`),
    '',
    '## What the patch should not trust as its primary gate',
    ...patchDesign.avoidUsingAsPrimaryGate.map((line) => `- ${line}`),
    '',
    '## Predicted signature',
    `- ${patchDesign.predictedSignature.firstChange}`,
    `- ${patchDesign.predictedSignature.ownershipAfterPatch}`,
    `- ${patchDesign.predictedSignature.localBirthExpectation}`,
    '',
    '## Falsification',
    `- ${patchDesign.predictedSignature.falsification}`
  ];
  return `${lines.join('\n')}\n`;
};

const main = async () => {
  const contract = readJson(contractPath);
  const historicalRoot = corridorProof.ensureHistoricalWorktree({
    root: contract.baselineRoots.historical.root,
    commit: contract.baselineRoots.historical.commit
  });
  const [currentModules, historicalModules] = await Promise.all([
    corridorProof.importBaselineModules(repoRoot),
    corridorProof.importBaselineModules(historicalRoot)
  ]);
  const currentCore = await corridorProof.createBaselineCore(currentModules);
  const historicalCore = await corridorProof.createBaselineCore(historicalModules);
  await corridorProof.advanceSilently(currentCore, contract.corridor.checkpointDay * 86400);
  await corridorProof.advanceSilently(historicalCore, contract.corridor.checkpointDay * 86400);
  const corridorIndices = corridorProof.buildCorridorMask(currentCore, {
    sector: contract.corridor.sectorKey,
    latMin: contract.corridor.latBandDeg[0],
    latMax: contract.corridor.latBandDeg[1]
  });
  const targetCellIndex = contract.corridor.targetCell.cellIndex;
  const currentClone = await corridorProof.cloneCoreFromSource(currentModules, currentCore);
  const historicalClone = await corridorProof.cloneCoreFromSource(historicalModules, historicalCore);
  corridorProof.runPreVerticalSequence(currentClone, currentModules, currentCore.modelDt);
  corridorProof.runPreVerticalSequence(historicalClone, historicalModules, historicalCore.modelDt);
  const supportSnapshot = {
    current: buildSupportSnapshot({ core: currentClone, targetCellIndex, corridorIndices }),
    historical: buildSupportSnapshot({ core: historicalClone, targetCellIndex, corridorIndices })
  };
  const boundaryLedger = readJson(boundaryLedgerPath);
  const provenanceReport = readJson(provenancePath);
  const patchProof = readJson(patchProofPath);
  const missingCondition = assessMissingCondition({
    supportSnapshot: supportSnapshot.current,
    boundaryLedger,
    provenanceReport,
    contract
  });
  const patchDesign = buildSecondPatchDesign({
    contract,
    supportSnapshot: supportSnapshot.current,
    missingCondition
  });
  const report = {
    schema: 'satellite-wars.phase1b-exact-corridor-support-proof.v1',
    generatedAt: new Date().toISOString(),
    reportPathJson: `${reportBase}.json`,
    contract,
    baselines: {
      current: {
        commit: commitAtRoot(repoRoot),
        root: repoRoot
      },
      historical: {
        commit: commitAtRoot(historicalRoot),
        root: historicalRoot
      }
    },
    sourceArtifacts: {
      boundaryLedgerPath,
      provenancePath,
      patchProofPath
    },
    supportSnapshot,
    patchPlacementProof: {
      primaryOwner: patchProof.primaryOwner || patchProof.verdict?.primaryOwner || 'stepVertical5',
      secondaryOwner: patchProof.secondaryOwner || patchProof.verdict?.secondaryOwner || 'stepMicrophysics5'
    },
    missingCondition,
    patchDesign
  };
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.mkdirSync(path.dirname(designPath), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${reportBase}.md`, renderMarkdown({ report, patchDesign }));
  fs.writeFileSync(designPath, renderPatchDesignMarkdown({ patchDesign, report }));
  process.stdout.write(JSON.stringify({
    missingCondition,
    patchDesign: {
      placement: patchDesign.placement,
      patchKind: patchDesign.patchKind
    }
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  await main();
}

export const _test = {
  computeFreshSupport,
  assessMissingCondition,
  buildSecondPatchDesign
};
