#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = corridorProof.repoRoot || path.resolve(__dirname, '..', '..');

const DEFAULT_CONTRACT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'prevertical-ownership-contract.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-boundary-ledger'
);
const MATERIAL_DIVERGENCE_THRESHOLD_KGM2 = 0.05;
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;
const BOUNDARY_ORDER = [
  'endPreviousStepMicrophysics5',
  'endPreviousFullStep',
  'startCurrentStep',
  'afterStepSurface2D5',
  'afterStepRadiation2D5',
  'afterWindUpdates',
  'afterStepSurfacePressure5',
  'afterStepAdvection5',
  'preStepVertical5'
];

let contractPath = DEFAULT_CONTRACT_PATH;
let reportBase = DEFAULT_REPORT_BASE;
let materialThreshold = MATERIAL_DIVERGENCE_THRESHOLD_KGM2;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--material-threshold' && argv[i + 1]) materialThreshold = Number.parseFloat(argv[++i]);
  else if (arg.startsWith('--material-threshold=')) materialThreshold = Number.parseFloat(arg.slice('--material-threshold='.length));
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const sum = corridorProof.sum || ((values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0));
const mean = corridorProof.mean || ((values) => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
});

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const sigmaMidAtLevel = (sigmaHalf, lev) => 0.5 * ((sigmaHalf?.[lev] || 0) + (sigmaHalf?.[lev + 1] || 0));

const sumUpperCloudMassAtCell = (state, cellIndex) => {
  if (!state?.pHalf || !state?.sigmaHalf) return 0;
  const { N, nz, pHalf, sigmaHalf, qc, qi, qr } = state;
  const qs = state.qs;
  let totalMass = 0;
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
    if (!(dp > 0)) continue;
    const idx = lev * N + cellIndex;
    const mixingRatio = (qc?.[idx] || 0) + (qi?.[idx] || 0) + (qr?.[idx] || 0) + (qs?.[idx] || 0);
    if (!(mixingRatio > 0)) continue;
    totalMass += mixingRatio * (dp / G);
  }
  return totalMass;
};

const sumForIndices = (indices, getter) => {
  let total = 0;
  for (const idx of indices) {
    total += Number(getter(idx)) || 0;
  }
  return total;
};

const weightedMeanForIndices = (indices, valueGetter, weightGetter) => {
  let weightTotal = 0;
  let weightedTotal = 0;
  for (const idx of indices) {
    const weight = Number(weightGetter(idx)) || 0;
    if (!(weight > 0)) continue;
    weightTotal += weight;
    weightedTotal += (Number(valueGetter(idx)) || 0) * weight;
  }
  if (!(weightTotal > 0)) return 0;
  return weightedTotal / weightTotal;
};

const computeMassClosureFrac = (actualMass, ownership) => {
  const reconstructed = (
    (ownership.previousStepResidualUpperCloudKgM2 || 0)
    + (ownership.currentStepAdvectedUpperCloudImportKgM2 || 0)
    + (ownership.currentStepLocalPreverticalBirthKgM2 || 0)
    - (ownership.currentStepAdvectedUpperCloudExportKgM2 || 0)
  );
  const residual = actualMass - reconstructed;
  const scale = Math.max(
    1e-6,
    Math.abs(ownership.previousStepResidualUpperCloudKgM2 || 0)
    + Math.abs(ownership.currentStepAdvectedUpperCloudImportKgM2 || 0)
    + Math.abs(ownership.currentStepAdvectedUpperCloudExportKgM2 || 0)
    + Math.abs(ownership.currentStepLocalPreverticalBirthKgM2 || 0)
    + Math.abs(actualMass || 0)
  );
  return {
    closureResidualKgM2: round(residual, 5),
    closureFrac: round(Math.max(0, 1 - Math.abs(residual) / scale), 5)
  };
};

const createBoundarySnapshot = ({
  boundary,
  core,
  targetCell,
  corridorIndices,
  ownershipTarget,
  ownershipCorridor,
  previousBoundary = null,
  note = null,
  skipped = false
}) => {
  const targetMass = sumUpperCloudMassAtCell(core.state, targetCell.cellIndex);
  const corridorMass = sumForIndices(corridorIndices, (idx) => sumUpperCloudMassAtCell(core.state, idx));
  const targetStaleMass = Number(core.state.upperCloudStaleMass?.[targetCell.cellIndex]) || 0;
  const corridorStaleMass = sumForIndices(corridorIndices, (idx) => core.state.upperCloudStaleMass?.[idx] || 0);
  const targetImportAge = Number(core.state.upperCloudTimeSinceImportSeconds?.[targetCell.cellIndex]) || 0;
  const targetResidenceAge = Number(core.state.upperCloudResidenceTimeSeconds?.[targetCell.cellIndex]) || 0;
  const corridorImportAge = weightedMeanForIndices(
    corridorIndices,
    (idx) => core.state.upperCloudTimeSinceImportSeconds?.[idx] || 0,
    (idx) => sumUpperCloudMassAtCell(core.state, idx)
  );
  const corridorResidenceAge = weightedMeanForIndices(
    corridorIndices,
    (idx) => core.state.upperCloudResidenceTimeSeconds?.[idx] || 0,
    (idx) => sumUpperCloudMassAtCell(core.state, idx)
  );
  const targetClosure = computeMassClosureFrac(targetMass, ownershipTarget);
  const corridorClosure = computeMassClosureFrac(corridorMass, ownershipCorridor);

  return {
    boundary,
    dynStepIndex: core._dynStepIndex,
    simTimeSeconds: core.timeUTC,
    skipped,
    note,
    targetCell: {
      upperCloudMassKgM2: round(targetMass, 5),
      staleMassKgM2: round(targetStaleMass, 5),
      staleFraction: round(targetMass > 0 ? targetStaleMass / targetMass : 0, 5),
      timeSinceImportSeconds: round(targetImportAge, 5),
      residenceTimeSeconds: round(targetResidenceAge, 5),
      deltaFromPreviousBoundaryKgM2: round(
        targetMass - (previousBoundary?.targetCell?.upperCloudMassKgM2 || 0),
        5
      ),
      ownershipProxy: {
        ...ownershipTarget,
        ...targetClosure
      }
    },
    corridorBand: {
      upperCloudMassKgM2: round(corridorMass, 5),
      staleMassKgM2: round(corridorStaleMass, 5),
      staleFraction: round(corridorMass > 0 ? corridorStaleMass / corridorMass : 0, 5),
      timeSinceImportSeconds: round(corridorImportAge, 5),
      residenceTimeSeconds: round(corridorResidenceAge, 5),
      deltaFromPreviousBoundaryKgM2: round(
        corridorMass - (previousBoundary?.corridorBand?.upperCloudMassKgM2 || 0),
        5
      ),
      ownershipProxy: {
        ...ownershipCorridor,
        ...corridorClosure
      }
    }
  };
};

const makeOwnershipSeed = (mass) => ({
  previousStepResidualUpperCloudKgM2: round(mass, 5),
  currentStepAdvectedUpperCloudImportKgM2: 0,
  currentStepAdvectedUpperCloudExportKgM2: 0,
  currentStepLocalPreverticalBirthKgM2: 0
});

const updateOwnershipForBoundary = ({ previousSnapshot, currentSnapshot, ownership, mode }) => {
  const next = { ...ownership };
  const delta = (currentSnapshot?.upperCloudMassKgM2 || 0) - (previousSnapshot?.upperCloudMassKgM2 || 0);
  if (mode === 'advection') {
    if (delta > 0) next.currentStepAdvectedUpperCloudImportKgM2 = round((next.currentStepAdvectedUpperCloudImportKgM2 || 0) + delta, 5);
    if (delta < 0) next.currentStepAdvectedUpperCloudExportKgM2 = round((next.currentStepAdvectedUpperCloudExportKgM2 || 0) + Math.abs(delta), 5);
  } else if (delta > 0) {
    next.currentStepLocalPreverticalBirthKgM2 = round((next.currentStepLocalPreverticalBirthKgM2 || 0) + delta, 5);
  }
  return next;
};

const computeStepCadence = (core) => {
  const lodActive = core.lodParams?.enable && core.simSpeed > core.lodParams.simSpeedThreshold;
  const microEvery = Math.max(1, Number(core.lodParams?.microphysicsEvery) || 1);
  const radEvery = Math.max(1, Number(core.lodParams?.radiationEvery) || 1);
  return {
    doRadiation: !lodActive || (core._dynStepIndex % radEvery === 0),
    doMicrophysics: !lodActive || (core._dynStepIndex % microEvery === 0)
  };
};

const advanceToDay = async (core, day) => {
  await corridorProof.suppressProcessOutput(async () => {
    core.advanceModelSeconds(day * 86400);
  });
};

const buildConfiguredCore = async (modules, contract) => corridorProof.suppressProcessOutput(async () => {
  const core = new modules.WeatherCore5({
    nx: contract.corridor.grid.nx,
    ny: contract.corridor.grid.ny,
    dt: contract.corridor.grid.dtSeconds,
    seed: 12345
  });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  return core;
});

const captureCurrentStepBoundaryTrace = async ({ checkpointCore, modules, targetCell, corridorIndices }) => {
  return corridorProof.suppressProcessOutput(async () => {
    const clone = await corridorProof.cloneCoreFromSource(modules, checkpointCore);
    const targetSeed = makeOwnershipSeed(sumUpperCloudMassAtCell(clone.state, targetCell.cellIndex));
    const corridorSeed = makeOwnershipSeed(sumForIndices(corridorIndices, (idx) => sumUpperCloudMassAtCell(clone.state, idx)));
    const boundaries = {};

    boundaries.startCurrentStep = createBoundarySnapshot({
      boundary: 'startCurrentStep',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: targetSeed,
      ownershipCorridor: corridorSeed,
      previousBoundary: null,
      note: 'Frozen checkpoint state at the start of the current replay step.'
    });

    modules.stepSurface2D5({
      dt: clone.modelDt,
      grid: clone.grid,
      state: clone.state,
      climo: clone.climo,
      geo: clone.geo,
      params: clone.surfaceParams
    });
    if (typeof clone._updateHydrostatic === 'function') clone._updateHydrostatic();

    let targetOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.startCurrentStep.targetCell,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepSurface2D5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetSeed,
        ownershipCorridor: corridorSeed
      }).targetCell,
      ownership: targetSeed,
      mode: 'local'
    });
    let corridorOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.startCurrentStep.corridorBand,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepSurface2D5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: corridorSeed,
        ownershipCorridor: corridorSeed
      }).corridorBand,
      ownership: corridorSeed,
      mode: 'local'
    });
    boundaries.afterStepSurface2D5 = createBoundarySnapshot({
      boundary: 'afterStepSurface2D5',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: targetOwnership,
      ownershipCorridor: corridorOwnership,
      previousBoundary: boundaries.startCurrentStep,
      note: 'Includes the hydrostatic refresh that follows stepSurface2D5 in core5.'
    });

    const { doRadiation } = computeStepCadence(clone);
    if (doRadiation) {
      modules.stepRadiation2D5({
        dt: clone.modelDt,
        grid: clone.grid,
        state: clone.state,
        timeUTC: clone.timeUTC,
        params: clone.radParams
      });
      if (typeof clone._updateHydrostatic === 'function') clone._updateHydrostatic();
    }
    targetOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterStepSurface2D5.targetCell,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepRadiation2D5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).targetCell,
      ownership: targetOwnership,
      mode: 'local'
    });
    corridorOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterStepSurface2D5.corridorBand,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepRadiation2D5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).corridorBand,
      ownership: corridorOwnership,
      mode: 'local'
    });
    boundaries.afterStepRadiation2D5 = createBoundarySnapshot({
      boundary: 'afterStepRadiation2D5',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: targetOwnership,
      ownershipCorridor: corridorOwnership,
      previousBoundary: boundaries.afterStepSurface2D5,
      note: doRadiation
        ? 'Includes the hydrostatic refresh that follows stepRadiation2D5 in core5.'
        : 'Radiation was skipped by cadence; this boundary mirrors afterStepSurface2D5.',
      skipped: !doRadiation
    });

    clone.dynParams.stepIndex = clone._dynStepIndex;
    modules.stepWinds5({
      dt: clone.modelDt,
      grid: clone.grid,
      state: clone.state,
      geo: clone.geo,
      params: {
        ...clone.dynParams,
        diagnosticsLevel: clone.verticalLayout?.upperTroposphere ?? null,
        collectDiagnostics: false
      },
      scratch: clone._dynScratch
    });
    const spinupParams = clone.windNudgeSpinupParams;
    if (spinupParams?.enable) {
      const durationSeconds = Number.isFinite(spinupParams.durationSeconds) ? spinupParams.durationSeconds : 0;
      clone._windNudgeSpinupSeconds = Math.min(
        clone._windNudgeSpinupSeconds + clone.modelDt,
        durationSeconds > 0 ? durationSeconds : clone._windNudgeSpinupSeconds + clone.modelDt
      );
    }
    const dur = Number.isFinite(spinupParams?.durationSeconds) ? spinupParams.durationSeconds : 0;
    const r01 = dur > 0 ? Math.min(1, clone._windNudgeSpinupSeconds / dur) : 1;
    const r = r01 * r01 * (3 - 2 * r01);
    const lerp = (a, b, t) => a + (b - a) * t;
    const tauSurfaceEff = lerp(
      spinupParams?.tauSurfaceStartSeconds ?? clone.windNudgeParams.tauSurfaceSeconds,
      clone.windNudgeParams.tauSurfaceSeconds,
      r
    );
    const tauUpperEff = lerp(
      spinupParams?.tauUpperStartSeconds ?? clone.windNudgeParams.tauUpperSeconds,
      clone.windNudgeParams.tauUpperSeconds,
      r
    );
    const tauVEff = lerp(
      spinupParams?.tauVStartSeconds ?? clone.windNudgeParams.tauVSeconds,
      clone.windNudgeParams.tauVSeconds,
      r
    );
    modules.stepWindNudge5({
      dt: clone.modelDt,
      grid: clone.grid,
      state: clone.state,
      climo: clone.climo,
      params: {
        ...clone.windNudgeParams,
        tauSurfaceSeconds: tauSurfaceEff,
        tauUpperSeconds: tauUpperEff,
        tauVSeconds: tauVEff,
        maxUpperSpeed: clone.dynParams?.maxWind ?? null
      }
    });
    if (clone.windEddyParams?.enable) {
      modules.stepWindEddyNudge5({
        dt: clone.modelDt,
        grid: clone.grid,
        state: clone.state,
        climo: clone.climo,
        params: clone.windEddyParams
      });
    }
    targetOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterStepRadiation2D5.targetCell,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterWindUpdates',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).targetCell,
      ownership: targetOwnership,
      mode: 'local'
    });
    corridorOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterStepRadiation2D5.corridorBand,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterWindUpdates',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).corridorBand,
      ownership: corridorOwnership,
      mode: 'local'
    });
    boundaries.afterWindUpdates = createBoundarySnapshot({
      boundary: 'afterWindUpdates',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: targetOwnership,
      ownershipCorridor: corridorOwnership,
      previousBoundary: boundaries.afterStepRadiation2D5
    });

    modules.stepSurfacePressure5({
      dt: clone.modelDt,
      grid: clone.grid,
      state: clone.state,
      params: clone.massParams,
      scratch: clone._dynScratch
    });
    targetOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterWindUpdates.targetCell,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepSurfacePressure5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).targetCell,
      ownership: targetOwnership,
      mode: 'local'
    });
    corridorOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterWindUpdates.corridorBand,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepSurfacePressure5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).corridorBand,
      ownership: corridorOwnership,
      mode: 'local'
    });
    boundaries.afterStepSurfacePressure5 = createBoundarySnapshot({
      boundary: 'afterStepSurfacePressure5',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: targetOwnership,
      ownershipCorridor: corridorOwnership,
      previousBoundary: boundaries.afterWindUpdates,
      note: 'Optional support boundary. Surface pressure does not directly move cloud, but it can shift pressure-integrated mass diagnostics.'
    });

    clone.advectParams.stepIndex = clone._dynStepIndex;
    modules.stepAdvection5({
      dt: clone.modelDt,
      grid: clone.grid,
      state: clone.state,
      params: clone.advectParams,
      scratch: clone._dynScratch
    });
    targetOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterStepSurfacePressure5.targetCell,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepAdvection5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).targetCell,
      ownership: targetOwnership,
      mode: 'advection'
    });
    corridorOwnership = updateOwnershipForBoundary({
      previousSnapshot: boundaries.afterStepSurfacePressure5.corridorBand,
      currentSnapshot: createBoundarySnapshot({
        boundary: 'afterStepAdvection5',
        core: clone,
        targetCell,
        corridorIndices,
        ownershipTarget: targetOwnership,
        ownershipCorridor: corridorOwnership
      }).corridorBand,
      ownership: corridorOwnership,
      mode: 'advection'
    });
    boundaries.afterStepAdvection5 = createBoundarySnapshot({
      boundary: 'afterStepAdvection5',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: targetOwnership,
      ownershipCorridor: corridorOwnership,
      previousBoundary: boundaries.afterStepSurfacePressure5
    });
    boundaries.preStepVertical5 = createBoundarySnapshot({
      boundary: 'preStepVertical5',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: targetOwnership,
      ownershipCorridor: corridorOwnership,
      previousBoundary: boundaries.afterStepAdvection5,
      note: 'No physics module runs between afterStepAdvection5 and stepVertical5 in the replay contract.'
    });
    return boundaries;
  });
};

const capturePreviousStepMicroBoundary = async ({ prevStartCore, modules, targetCell, corridorIndices }) => {
  return corridorProof.suppressProcessOutput(async () => {
    const clone = await corridorProof.cloneCoreFromSource(modules, prevStartCore);
    corridorProof.runPreVerticalSequence(clone, modules, clone.modelDt);
    modules.stepVertical5({
      dt: clone.modelDt,
      grid: clone.grid,
      state: clone.state,
      geo: clone.geo,
      params: clone.vertParams,
      scratch: clone._dynScratch
    });
    if (typeof clone._closeSurfaceSourceTracerBudget === 'function') {
      clone._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
    }
    if (typeof clone._updateHydrostatic === 'function') clone._updateHydrostatic();
    const { doMicrophysics } = computeStepCadence(clone);
    if (typeof clone.vertParams?.enableConvectiveOutcome === 'boolean') {
      clone.microParams.enableConvectiveOutcome = clone.vertParams.enableConvectiveOutcome;
    }
    if (doMicrophysics) {
      modules.stepMicrophysics5({ dt: clone.modelDt, state: clone.state, params: clone.microParams });
      if (typeof clone._closeSurfaceSourceTracerBudget === 'function') {
        clone._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
      }
    }
    return createBoundarySnapshot({
      boundary: 'endPreviousStepMicrophysics5',
      core: clone,
      targetCell,
      corridorIndices,
      ownershipTarget: makeOwnershipSeed(sumUpperCloudMassAtCell(clone.state, targetCell.cellIndex)),
      ownershipCorridor: makeOwnershipSeed(sumForIndices(corridorIndices, (idx) => sumUpperCloudMassAtCell(clone.state, idx))),
      previousBoundary: null,
      note: 'Recovered by replaying the immediately preceding step through stepMicrophysics5 only.'
    });
  });
};

const buildBaselineTrace = async ({ label, root, contract }) => {
  const modules = await corridorProof.importBaselineModules(root);
  const checkpointCore = await buildConfiguredCore(modules, contract);
  const dtDays = contract.corridor.grid.dtSeconds / 86400;
  await advanceToDay(checkpointCore, contract.corridor.checkpointDay);

  const corridorIndices = corridorProof.buildCorridorMask(checkpointCore, {
    sector: contract.corridor.sectorKey,
    latMin: contract.corridor.latBandDeg[0],
    latMax: contract.corridor.latBandDeg[1]
  });
  const targetCell = contract.corridor.targetCell;
  const targetInCorridor = corridorIndices.includes(targetCell.cellIndex);
  if (!targetInCorridor) {
    throw new Error(`Frozen target cell ${targetCell.cellIndex} is not inside the replayed corridor for ${label}.`);
  }

  const prevStartCore = await buildConfiguredCore(modules, contract);
  await advanceToDay(prevStartCore, contract.corridor.checkpointDay - dtDays);
  const endPreviousStepMicrophysics5 = await capturePreviousStepMicroBoundary({
    prevStartCore,
    modules,
    targetCell,
    corridorIndices
  });

  const startSeedTarget = makeOwnershipSeed(sumUpperCloudMassAtCell(checkpointCore.state, targetCell.cellIndex));
  const startSeedCorridor = makeOwnershipSeed(sumForIndices(corridorIndices, (idx) => sumUpperCloudMassAtCell(checkpointCore.state, idx)));
  const endPreviousFullStep = createBoundarySnapshot({
    boundary: 'endPreviousFullStep',
    core: checkpointCore,
    targetCell,
    corridorIndices,
    ownershipTarget: startSeedTarget,
    ownershipCorridor: startSeedCorridor,
    previousBoundary: endPreviousStepMicrophysics5,
    note: 'This boundary is physically identical to startCurrentStep because the previous full step ends at the current checkpoint.'
  });
  const currentStepBoundaries = await captureCurrentStepBoundaryTrace({
    checkpointCore,
    modules,
    targetCell,
    corridorIndices
  });

  return {
    label,
    root,
    commit: commitAtRoot(root),
    targetCell,
    corridorIndices,
    boundaries: {
      endPreviousStepMicrophysics5,
      endPreviousFullStep,
      ...currentStepBoundaries
    }
  };
};

const buildBoundaryComparisons = ({ currentTrace, historicalTrace, thresholdKgM2 }) => {
  const targetCell = [];
  const corridorBand = [];
  for (const boundary of BOUNDARY_ORDER) {
    const currentBoundary = currentTrace.boundaries[boundary];
    const historicalBoundary = historicalTrace.boundaries[boundary];
    const targetDelta = round(
      (currentBoundary?.targetCell?.upperCloudMassKgM2 || 0)
      - (historicalBoundary?.targetCell?.upperCloudMassKgM2 || 0),
      5
    );
    const corridorDelta = round(
      (currentBoundary?.corridorBand?.upperCloudMassKgM2 || 0)
      - (historicalBoundary?.corridorBand?.upperCloudMassKgM2 || 0),
      5
    );
    targetCell.push({
      boundary,
      currentUpperCloudMassKgM2: currentBoundary?.targetCell?.upperCloudMassKgM2 ?? null,
      historicalUpperCloudMassKgM2: historicalBoundary?.targetCell?.upperCloudMassKgM2 ?? null,
      deltaUpperCloudMassKgM2: targetDelta,
      absDeltaUpperCloudMassKgM2: round(Math.abs(targetDelta), 5),
      currentClosureFrac: currentBoundary?.targetCell?.ownershipProxy?.closureFrac ?? null,
      historicalClosureFrac: historicalBoundary?.targetCell?.ownershipProxy?.closureFrac ?? null
    });
    corridorBand.push({
      boundary,
      currentUpperCloudMassKgM2: currentBoundary?.corridorBand?.upperCloudMassKgM2 ?? null,
      historicalUpperCloudMassKgM2: historicalBoundary?.corridorBand?.upperCloudMassKgM2 ?? null,
      deltaUpperCloudMassKgM2: corridorDelta,
      absDeltaUpperCloudMassKgM2: round(Math.abs(corridorDelta), 5),
      currentClosureFrac: currentBoundary?.corridorBand?.ownershipProxy?.closureFrac ?? null,
      historicalClosureFrac: historicalBoundary?.corridorBand?.ownershipProxy?.closureFrac ?? null
    });
  }
  const firstMaterialTargetBoundary = targetCell.find((entry) => (entry.absDeltaUpperCloudMassKgM2 || 0) >= thresholdKgM2) || null;
  const firstMaterialCorridorBoundary = corridorBand.find((entry) => (entry.absDeltaUpperCloudMassKgM2 || 0) >= thresholdKgM2) || null;
  return {
    thresholdKgM2: round(thresholdKgM2, 5),
    targetCell,
    corridorBand,
    firstMaterialTargetBoundary,
    firstMaterialCorridorBoundary
  };
};

const classifyU1Decision = ({ boundaryComparisons }) => {
  const candidates = [
    boundaryComparisons.firstMaterialTargetBoundary?.boundary,
    boundaryComparisons.firstMaterialCorridorBoundary?.boundary
  ].filter(Boolean);
  const firstBoundary = candidates.sort((a, b) => BOUNDARY_ORDER.indexOf(a) - BOUNDARY_ORDER.indexOf(b))[0] || null;
  if (!firstBoundary) {
    return {
      firstMaterialBoundary: null,
      verdict: 'ambiguous',
      explanation: 'No materially divergent boundary crossed the U1 threshold.'
    };
  }
  if (['endPreviousStepMicrophysics5', 'endPreviousFullStep', 'startCurrentStep'].includes(firstBoundary)) {
    return {
      firstMaterialBoundary: firstBoundary,
      verdict: 'excess_exists_before_advection',
      explanation: 'The excess upper cloud is already present before the current-step advection handoff.'
    };
  }
  if (['afterStepAdvection5', 'preStepVertical5'].includes(firstBoundary)) {
    return {
      firstMaterialBoundary: firstBoundary,
      verdict: 'excess_appears_during_advection',
      explanation: 'The first material divergence appears at the advection boundary rather than before it.'
    };
  }
  return {
    firstMaterialBoundary: firstBoundary,
    verdict: 'support_path_ambiguous',
    explanation: 'A support boundary before advection diverges first, so advection ownership is not yet isolated.'
  };
};

const buildParityCheck = ({ contract, currentTrace }) => {
  const preverticalMass = currentTrace.boundaries.preStepVertical5?.targetCell?.upperCloudMassKgM2 || 0;
  const expectedPreverticalMass = contract.frozenFacts?.currentVerticalTargetCell?.inputMassKgM2 || 0;
  const deltaKgM2 = round(preverticalMass - expectedPreverticalMass, 5);
  const absDeltaKgM2 = round(Math.abs(deltaKgM2), 5);
  const thresholdKgM2 = Number(contract.parityRequirements?.maxAllowedTargetCellPreverticalDriftKgM2) || 0.0001;
  return {
    expectedPreverticalMassKgM2: expectedPreverticalMass,
    observedPreverticalMassKgM2: preverticalMass,
    deltaKgM2,
    absDeltaKgM2,
    thresholdKgM2: round(thresholdKgM2, 5),
    pass: absDeltaKgM2 <= thresholdKgM2
  };
};

const buildRootCauseAssessment = ({ decision, currentTrace, historicalTrace }) => {
  const ruledIn = [];
  const ruledOut = [];
  const ambiguous = [];
  if (decision.verdict === 'excess_exists_before_advection') {
    ruledIn.push('The first material divergence is already present before the current-step advection boundary.');
  } else if (decision.verdict === 'excess_appears_during_advection') {
    ruledIn.push('The first material divergence appears at the current-step advection boundary.');
  } else {
    ambiguous.push('U1 does not yet isolate whether the excess upper cloud exists before advection or appears during support-path updates.');
  }

  const currentStart = currentTrace.boundaries.startCurrentStep?.targetCell?.upperCloudMassKgM2 || 0;
  const historicalStart = historicalTrace.boundaries.startCurrentStep?.targetCell?.upperCloudMassKgM2 || 0;
  if (Math.abs(currentStart - historicalStart) >= materialThreshold) {
    ruledIn.push('The checkpoint start state itself is already divergent, which keeps carryover retention on the table.');
  } else {
    ruledOut.push('A large carryover-only divergence at startCurrentStep is not supported by this replay.');
  }

  const currentAdvection = currentTrace.boundaries.afterStepAdvection5?.targetCell?.ownershipProxy?.currentStepAdvectedUpperCloudImportKgM2 || 0;
  if (currentAdvection > 0.01) {
    ruledIn.push('Current-step advection materially changes the target-cell upper-cloud ledger.');
  } else {
    ambiguous.push('Current-step advection does not dominate the target-cell mass delta in U1 by itself.');
  }

  return { ruledIn, ruledOut, ambiguous };
};

const renderMarkdown = ({ contract, currentTrace, historicalTrace, boundaryComparisons, decision, parityCheck }) => {
  const lines = [];
  lines.push('# U1 Pre-Vertical Boundary Ledger');
  lines.push('');
  lines.push(`- Corridor: ${contract.corridor.sectorKey} ${contract.corridor.latBandDeg[0]}-${contract.corridor.latBandDeg[1]} deg`);
  lines.push(`- Target cell: ${contract.corridor.targetCell.cellIndex} (lat ${contract.corridor.targetCell.latDeg}, lon ${contract.corridor.targetCell.lonDeg})`);
  lines.push(`- Historical baseline: ${historicalTrace.commit}`);
  lines.push(`- Current baseline: ${currentTrace.commit}`);
  lines.push('');
  lines.push('## U1 verdict');
  lines.push('');
  lines.push(`- First material boundary: ${decision.firstMaterialBoundary || 'none'}`);
  lines.push(`- Verdict: ${decision.verdict}`);
  lines.push(`- Explanation: ${decision.explanation}`);
  lines.push('');
  lines.push('## Trace-disabled parity');
  lines.push('');
  lines.push(`- Pass: ${parityCheck.pass}`);
  lines.push(`- Expected pre-vertical target mass: ${parityCheck.expectedPreverticalMassKgM2}`);
  lines.push(`- Observed pre-vertical target mass: ${parityCheck.observedPreverticalMassKgM2}`);
  lines.push(`- Absolute drift: ${parityCheck.absDeltaKgM2}`);
  lines.push(`- Threshold: ${parityCheck.thresholdKgM2}`);
  lines.push('');
  lines.push('## Boundary deltas (target cell)');
  lines.push('');
  for (const entry of boundaryComparisons.targetCell) {
    lines.push(`- ${entry.boundary}: current ${entry.currentUpperCloudMassKgM2}, historical ${entry.historicalUpperCloudMassKgM2}, delta ${entry.deltaUpperCloudMassKgM2}`);
  }
  lines.push('');
  lines.push('## Boundary deltas (corridor)');
  lines.push('');
  for (const entry of boundaryComparisons.corridorBand) {
    lines.push(`- ${entry.boundary}: current ${entry.currentUpperCloudMassKgM2}, historical ${entry.historicalUpperCloudMassKgM2}, delta ${entry.deltaUpperCloudMassKgM2}`);
  }
  lines.push('');
  lines.push('## Current-step ownership proxy at pre-vertical boundary');
  lines.push('');
  const preTarget = currentTrace.boundaries.preStepVertical5?.targetCell?.ownershipProxy;
  const preCorridor = currentTrace.boundaries.preStepVertical5?.corridorBand?.ownershipProxy;
  lines.push(`- Target previous-step residual: ${preTarget?.previousStepResidualUpperCloudKgM2}`);
  lines.push(`- Target advected import: ${preTarget?.currentStepAdvectedUpperCloudImportKgM2}`);
  lines.push(`- Target advected export: ${preTarget?.currentStepAdvectedUpperCloudExportKgM2}`);
  lines.push(`- Target local pre-vertical birth: ${preTarget?.currentStepLocalPreverticalBirthKgM2}`);
  lines.push(`- Target closure residual: ${preTarget?.closureResidualKgM2}`);
  lines.push(`- Corridor previous-step residual: ${preCorridor?.previousStepResidualUpperCloudKgM2}`);
  lines.push(`- Corridor advected import: ${preCorridor?.currentStepAdvectedUpperCloudImportKgM2}`);
  lines.push(`- Corridor advected export: ${preCorridor?.currentStepAdvectedUpperCloudExportKgM2}`);
  lines.push(`- Corridor local pre-vertical birth: ${preCorridor?.currentStepLocalPreverticalBirthKgM2}`);
  lines.push(`- Corridor closure residual: ${preCorridor?.closureResidualKgM2}`);
  lines.push('');
  return lines.join('\n');
};

const runExperiment = async () => {
  const contract = readJson(contractPath);
  const historicalRoot = contract.baselineRoots?.historical?.root;
  const currentRoot = repoRoot;
  if (!historicalRoot || !fs.existsSync(path.join(historicalRoot, '.git'))) {
    throw new Error(`Missing historical worktree at ${historicalRoot}.`);
  }

  const historicalTrace = await buildBaselineTrace({ label: 'historical', root: historicalRoot, contract });
  const currentTrace = await buildBaselineTrace({ label: 'current', root: currentRoot, contract });
  const boundaryComparisons = buildBoundaryComparisons({
    currentTrace,
    historicalTrace,
    thresholdKgM2: materialThreshold
  });
  const decision = classifyU1Decision({ boundaryComparisons });
  const parityCheck = buildParityCheck({ contract, currentTrace });
  const rootCauseAssessment = buildRootCauseAssessment({ decision, currentTrace, historicalTrace });
  return {
    schema: 'satellite-wars.prevertical-boundary-ledger.v1',
    generatedAt: new Date().toISOString(),
    contractPath,
    configuration: {
      corridor: contract.corridor,
      materialThresholdKgM2: round(materialThreshold, 5)
    },
    baselines: {
      historical: {
        commit: historicalTrace.commit,
        root: historicalTrace.root
      },
      current: {
        commit: currentTrace.commit,
        root: currentTrace.root
      }
    },
    parityCheck,
    boundaryComparisons,
    decision,
    rootCauseAssessment,
    traces: {
      historical: historicalTrace.boundaries,
      current: currentTrace.boundaries
    }
  };
};

const main = async () => {
  const result = await runExperiment();
  const markdown = renderMarkdown({
    contract: readJson(contractPath),
    currentTrace: { boundaries: result.traces.current, commit: result.baselines.current.commit },
    historicalTrace: { boundaries: result.traces.historical, commit: result.baselines.historical.commit },
    boundaryComparisons: result.boundaryComparisons,
    decision: result.decision,
    parityCheck: result.parityCheck
  });
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    decision: result.decision,
    parityCheck: result.parityCheck,
    boundaryComparisons: {
      firstMaterialTargetBoundary: result.boundaryComparisons.firstMaterialTargetBoundary,
      firstMaterialCorridorBoundary: result.boundaryComparisons.firstMaterialCorridorBoundary
    }
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  buildBoundaryComparisons,
  classifyU1Decision,
  computeMassClosureFrac,
  updateOwnershipForBoundary
};
