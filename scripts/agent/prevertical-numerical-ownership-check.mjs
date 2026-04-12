#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import { _proof as corridorProof } from './minimal-failing-corridor.mjs';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { advanceToModelDayFully } from './advance-fully.mjs';

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
  'prevertical-numerical-ownership-check'
);
const MATERIAL_THRESHOLD_KGM2 = 0.05;
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;
const TRACE_KEYS = [
  'previousStepResidualUpperCloud',
  'currentStepAdvectedUpperCloud',
  'currentStepLocalUpperCloud',
  'reprocessedUpperCloud'
];
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
let skipCounterfactuals = false;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--skip-counterfactuals') skipCounterfactuals = true;
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const sum = corridorProof.sum || ((values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
const sigmaMidAtLevel = (sigmaHalf, lev) => 0.5 * ((sigmaHalf?.[lev] || 0) + (sigmaHalf?.[lev + 1] || 0));

const createConfiguredCore = async (modules, variant) => corridorProof.suppressProcessOutput(async () => {
  const core = new modules.WeatherCore5({
    nx: variant.nx,
    ny: variant.ny,
    dt: variant.dtSeconds,
    seed: 12345
  });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  return core;
});

const advanceToDay = async (core, day) => {
  await corridorProof.suppressProcessOutput(async () => {
    advanceToModelDayFully(core, day);
  });
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

const upperCloudMixingRatioAtIndex = (state, idx) => (
  (state.qc?.[idx] || 0)
  + (state.qi?.[idx] || 0)
  + (state.qr?.[idx] || 0)
  + (state.qs?.[idx] || 0)
);

const sumUpperCloudMassAtCell = (state, cellIndex) => {
  const { N, nz, pHalf, sigmaHalf } = state;
  let totalMass = 0;
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
    if (!(dp > 0)) continue;
    const idx = lev * N + cellIndex;
    totalMass += upperCloudMixingRatioAtIndex(state, idx) * (dp / G);
  }
  return totalMass;
};

const sumForIndices = (indices, getter) => indices.reduce((total, idx) => total + (Number(getter(idx)) || 0), 0);

const aggregatePhysicalMass = (state, indices) => round(
  sum(indices.map((idx) => sumUpperCloudMassAtCell(state, idx))),
  5
);

const makeOwnershipSeed = (mass) => ({
  previousStepResidualUpperCloudKgM2: round(mass, 5),
  currentStepAdvectedUpperCloudImportKgM2: 0,
  currentStepAdvectedUpperCloudExportKgM2: 0,
  currentStepLocalPreverticalBirthKgM2: 0
});

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
    Math.abs(actualMass || 0)
    + Math.abs(ownership.previousStepResidualUpperCloudKgM2 || 0)
    + Math.abs(ownership.currentStepAdvectedUpperCloudImportKgM2 || 0)
    + Math.abs(ownership.currentStepAdvectedUpperCloudExportKgM2 || 0)
    + Math.abs(ownership.currentStepLocalPreverticalBirthKgM2 || 0)
  );
  return {
    closureResidualKgM2: round(residual, 5),
    closureFrac: round(Math.max(0, 1 - Math.abs(residual) / scale), 5)
  };
};

const createBoundarySnapshot = ({
  boundary,
  state,
  targetCellIndex,
  corridorIndices,
  ownershipTarget,
  ownershipCorridor
}) => {
  const targetMass = aggregatePhysicalMass(state, [targetCellIndex]);
  const corridorMass = aggregatePhysicalMass(state, corridorIndices);
  return {
    boundary,
    targetCell: {
      upperCloudMassKgM2: targetMass,
      ownershipProxy: {
        ...ownershipTarget,
        ...computeMassClosureFrac(targetMass, ownershipTarget)
      }
    },
    corridorBand: {
      upperCloudMassKgM2: corridorMass,
      ownershipProxy: {
        ...ownershipCorridor,
        ...computeMassClosureFrac(corridorMass, ownershipCorridor)
      }
    }
  };
};

const updateOwnershipForBoundary = ({ previousMass, currentMass, ownership, mode }) => {
  const next = { ...ownership };
  const delta = (currentMass || 0) - (previousMass || 0);
  if (mode === 'advection') {
    if (delta > 0) next.currentStepAdvectedUpperCloudImportKgM2 = round((next.currentStepAdvectedUpperCloudImportKgM2 || 0) + delta, 5);
    if (delta < 0) next.currentStepAdvectedUpperCloudExportKgM2 = round((next.currentStepAdvectedUpperCloudExportKgM2 || 0) + Math.abs(delta), 5);
  } else if (delta > 0) {
    next.currentStepLocalPreverticalBirthKgM2 = round((next.currentStepLocalPreverticalBirthKgM2 || 0) + delta, 5);
  }
  return next;
};

const buildZeroTraceSet = (size) => ({
  previousStepResidualUpperCloud: new Float32Array(size),
  currentStepAdvectedUpperCloud: new Float32Array(size),
  currentStepLocalUpperCloud: new Float32Array(size),
  reprocessedUpperCloud: new Float32Array(size)
});

const seedProvenanceTracers = (state) => {
  const traces = buildZeroTraceSet(state.SZ);
  const { N, nz, sigmaHalf } = state;
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const base = lev * N;
    for (let k = 0; k < N; k += 1) {
      const idx = base + k;
      const cloudMix = upperCloudMixingRatioAtIndex(state, idx);
      if (!(cloudMix > 0)) continue;
      traces.previousStepResidualUpperCloud[idx] = cloudMix;
    }
  }
  return traces;
};

const classifyInterpolatedContribution = ({ sources, destinationCellIndex, totalAfter }) => {
  const next = {
    previousStepResidualUpperCloud: 0,
    currentStepAdvectedUpperCloud: 0,
    currentStepLocalUpperCloud: 0,
    reprocessedUpperCloud: 0
  };
  for (const source of sources) {
    const contributionTotal = (
      (source.previousStepResidualUpperCloud || 0)
      + (source.currentStepAdvectedUpperCloud || 0)
      + (source.currentStepLocalUpperCloud || 0)
      + (source.reprocessedUpperCloud || 0)
    ) * source.weight;
    if (!(contributionTotal > 0)) continue;
    if (source.sourceCellIndex === destinationCellIndex) {
      next.previousStepResidualUpperCloud += (source.previousStepResidualUpperCloud || 0) * source.weight;
      next.currentStepAdvectedUpperCloud += (source.currentStepAdvectedUpperCloud || 0) * source.weight;
      next.currentStepLocalUpperCloud += (source.currentStepLocalUpperCloud || 0) * source.weight;
      next.reprocessedUpperCloud += (source.reprocessedUpperCloud || 0) * source.weight;
    } else {
      next.currentStepAdvectedUpperCloud += contributionTotal;
    }
  }
  const tracked = sum(TRACE_KEYS.map((key) => next[key]));
  if (tracked > 0 && totalAfter > 0) {
    const scale = totalAfter / tracked;
    for (const key of TRACE_KEYS) next[key] *= scale;
  } else if (tracked <= 0 && totalAfter > 0) {
    next.currentStepAdvectedUpperCloud = totalAfter;
  }
  for (const key of TRACE_KEYS) next[key] = round(next[key], 8);
  return next;
};

const advectPreverticalProvenance = ({ state, grid, dt, params, traces }) => {
  const { nx, ny, invDx, invDy, latDeg, polarWeight } = grid;
  const { N, nz, u, v } = state;
  const maxBacktraceCells = Number.isFinite(params.maxBacktraceCells) ? params.maxBacktraceCells : 2;
  const filterMoisture = params.filterMoisture === true;
  const polarLatStartDeg = Number.isFinite(params.polarLatStartDeg) ? params.polarLatStartDeg : 60;
  const next = buildZeroTraceSet(state.SZ);
  const rowA = new Float32Array(nx);
  const rowB = new Float32Array(nx);

  const applyPolarFilter = (field, base, rowIndex, passes) => {
    if (passes <= 0) return;
    const rowStart = base + rowIndex * nx;
    for (let i = 0; i < nx; i += 1) rowA[i] = field[rowStart + i];
    let read = rowA;
    let write = rowB;
    for (let pass = 0; pass < passes; pass += 1) {
      for (let i = 0; i < nx; i += 1) {
        const iW = (i - 1 + nx) % nx;
        const iE = (i + 1) % nx;
        write[i] = 0.25 * read[iW] + 0.5 * read[i] + 0.25 * read[iE];
      }
      const tmp = read;
      read = write;
      write = tmp;
    }
    for (let i = 0; i < nx; i += 1) field[rowStart + i] = read[i];
  };

  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(state.sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const base = lev * N;
    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      for (let i = 0; i < nx; i += 1) {
        const cellIndex = row + i;
        const idx = base + cellIndex;
        const rawDi = (u[idx] || 0) * dt * invDxRow;
        const rawDj = (v[idx] || 0) * dt * invDyRow;
        const di = clamp(rawDi, -maxBacktraceCells, maxBacktraceCells);
        const dj = clamp(rawDj, -maxBacktraceCells, maxBacktraceCells);
        let iSrc = i - di;
        let jSrc = j - dj;
        if (jSrc < 0) jSrc = 0;
        if (jSrc > ny - 1.001) jSrc = ny - 1.001;
        let i0 = Math.floor(iSrc);
        let j0 = Math.floor(jSrc);
        const fx = iSrc - i0;
        const fy = jSrc - j0;
        if (i0 < 0) i0 += nx;
        if (i0 >= nx) i0 -= nx;
        let i1 = i0 + 1;
        if (i1 >= nx) i1 -= nx;
        let j1 = j0 + 1;
        if (j1 >= ny) j1 = ny - 1;
        const corners = [
          { sourceCellIndex: j0 * nx + i0, weight: (1 - fx) * (1 - fy) },
          { sourceCellIndex: j0 * nx + i1, weight: fx * (1 - fy) },
          { sourceCellIndex: j1 * nx + i0, weight: (1 - fx) * fy },
          { sourceCellIndex: j1 * nx + i1, weight: fx * fy }
        ].map((corner) => {
          const sourceIdx = base + corner.sourceCellIndex;
          return {
            sourceCellIndex: corner.sourceCellIndex,
            weight: corner.weight,
            previousStepResidualUpperCloud: traces.previousStepResidualUpperCloud[sourceIdx] || 0,
            currentStepAdvectedUpperCloud: traces.currentStepAdvectedUpperCloud[sourceIdx] || 0,
            currentStepLocalUpperCloud: traces.currentStepLocalUpperCloud[sourceIdx] || 0,
            reprocessedUpperCloud: traces.reprocessedUpperCloud[sourceIdx] || 0
          };
        });
        const classified = classifyInterpolatedContribution({
          sources: corners,
          destinationCellIndex: cellIndex,
          totalAfter: upperCloudMixingRatioAtIndex(state, idx)
        });
        next.previousStepResidualUpperCloud[idx] = classified.previousStepResidualUpperCloud;
        next.currentStepAdvectedUpperCloud[idx] = classified.currentStepAdvectedUpperCloud;
        next.currentStepLocalUpperCloud[idx] = classified.currentStepLocalUpperCloud;
        next.reprocessedUpperCloud[idx] = classified.reprocessedUpperCloud;
      }
    }
  }

  if (filterMoisture) {
    for (let lev = 0; lev < nz; lev += 1) {
      if (sigmaMidAtLevel(state.sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
      const base = lev * N;
      for (let j = 0; j < ny; j += 1) {
        const latAbs = Math.abs(latDeg[j]);
        if (latAbs < polarLatStartDeg) continue;
        const passes = 2 + Math.floor(2 * (polarWeight ? polarWeight[j] : 1));
        for (const key of TRACE_KEYS) applyPolarFilter(next[key], base, j, passes);
      }
    }
  }

  return next;
};

const aggregateTraceMass = (traceField, state, indices) => {
  const { N, nz, pHalf, sigmaHalf } = state;
  let total = 0;
  for (const cellIndex of indices) {
    for (let lev = 0; lev < nz; lev += 1) {
      if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
      const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
      if (!(dp > 0)) continue;
      const idx = lev * N + cellIndex;
      total += (traceField[idx] || 0) * (dp / G);
    }
  }
  return round(total, 5);
};

const rankPrimaryOwner = (values) => {
  let best = null;
  for (const key of TRACE_KEYS) {
    const value = Number(values?.[key]) || 0;
    if (!best || value > best.value) best = { key, value: round(value, 5) };
  }
  return best;
};

const pickNearestCorridorCell = (core, corridorIndices, targetLatDeg, targetLonDeg) => {
  let best = null;
  for (const idx of corridorIndices) {
    const rowIndex = Math.floor(idx / core.grid.nx);
    const colIndex = idx % core.grid.nx;
    const lat = core.grid.latDeg[rowIndex];
    const lon = core.grid.lonDeg[colIndex];
    const dLat = lat - targetLatDeg;
    const dLonWrapped = ((((lon - targetLonDeg) + 540) % 360) - 180);
    const score = dLat * dLat + dLonWrapped * dLonWrapped;
    if (!best || score < best.score) {
      best = {
        cellIndex: idx,
        rowIndex,
        colIndex,
        latDeg: round(lat, 5),
        lonDeg: round(lon, 5),
        score: round(score, 8)
      };
    }
  }
  return best;
};

const runCurrentStepUntilAdvection = ({ core, modules }) => {
  const { doRadiation } = computeStepCadence(core);
  const boundaries = {};
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  modules.stepSurface2D5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    climo: core.climo,
    geo: core.geo,
    params: core.surfaceParams
  });
  boundaries.afterStepSurface2D5 = core.state;
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  if (doRadiation) {
    modules.stepRadiation2D5({
      dt: core.modelDt,
      grid: core.grid,
      state: core.state,
      timeUTC: core.timeUTC,
      params: core.radParams
    });
  }
  boundaries.afterStepRadiation2D5 = core.state;
  if (typeof core._updateHydrostatic === 'function') core._updateHydrostatic();
  core.dynParams.stepIndex = core._dynStepIndex;
  modules.stepWinds5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    geo: core.geo,
    params: {
      ...core.dynParams,
      diagnosticsLevel: core.verticalLayout?.upperTroposphere ?? null,
      collectDiagnostics: false
    },
    scratch: core._dynScratch
  });
  const spinupParams = core.windNudgeSpinupParams;
  if (spinupParams?.enable) {
    const durationSeconds = Number.isFinite(spinupParams.durationSeconds) ? spinupParams.durationSeconds : 0;
    core._windNudgeSpinupSeconds = Math.min(
      core._windNudgeSpinupSeconds + core.modelDt,
      durationSeconds > 0 ? durationSeconds : core._windNudgeSpinupSeconds + core.modelDt
    );
  }
  const dur = Number.isFinite(spinupParams?.durationSeconds) ? spinupParams.durationSeconds : 0;
  const r01 = dur > 0 ? Math.min(1, core._windNudgeSpinupSeconds / dur) : 1;
  const r = r01 * r01 * (3 - 2 * r01);
  const lerp = (a, b, t) => a + (b - a) * t;
  const tauSurfaceEff = lerp(
    spinupParams?.tauSurfaceStartSeconds ?? core.windNudgeParams.tauSurfaceSeconds,
    core.windNudgeParams.tauSurfaceSeconds,
    r
  );
  const tauUpperEff = lerp(
    spinupParams?.tauUpperStartSeconds ?? core.windNudgeParams.tauUpperSeconds,
    core.windNudgeParams.tauUpperSeconds,
    r
  );
  const tauVEff = lerp(
    spinupParams?.tauVStartSeconds ?? core.windNudgeParams.tauVSeconds,
    core.windNudgeParams.tauVSeconds,
    r
  );
  modules.stepWindNudge5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    climo: core.climo,
    params: {
      ...core.windNudgeParams,
      tauSurfaceSeconds: tauSurfaceEff,
      tauUpperSeconds: tauUpperEff,
      tauVSeconds: tauVEff,
      maxUpperSpeed: core.dynParams?.maxWind ?? null
    }
  });
  if (core.windEddyParams?.enable) {
    modules.stepWindEddyNudge5({
      dt: core.modelDt,
      grid: core.grid,
      state: core.state,
      climo: core.climo,
      params: core.windEddyParams
    });
  }
  boundaries.afterWindUpdates = core.state;
  modules.stepSurfacePressure5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    params: core.massParams,
    scratch: core._dynScratch
  });
  boundaries.afterStepSurfacePressure5 = core.state;
  core.advectParams.stepIndex = core._dynStepIndex;
  modules.stepAdvection5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    params: core.advectParams,
    scratch: core._dynScratch
  });
  boundaries.afterStepAdvection5 = core.state;
  boundaries.preStepVertical5 = core.state;
  return boundaries;
};

const buildVariantBaselines = async ({ root, modules, variant, corridorMeta }) => {
  const checkpointCore = await createConfiguredCore(modules, variant);
  await advanceToDay(checkpointCore, variant.checkpointDay);
  const corridorIndices = corridorProof.buildCorridorMask(checkpointCore, {
    sector: corridorMeta.sectorKey,
    latMin: corridorMeta.latBandDeg[0],
    latMax: corridorMeta.latBandDeg[1]
  });
  const targetCell = pickNearestCorridorCell(
    checkpointCore,
    corridorIndices,
    corridorMeta.targetLatDeg,
    corridorMeta.targetLonDeg
  );
  if (!targetCell) throw new Error(`No target cell found for variant ${variant.name}.`);

  const dtDays = variant.dtSeconds / 86400;
  const prevStartCore = await createConfiguredCore(modules, variant);
  await advanceToDay(prevStartCore, variant.checkpointDay - dtDays);
  const prevClone = await corridorProof.cloneCoreFromSource(modules, prevStartCore);
  corridorProof.runPreVerticalSequence(prevClone, modules, prevClone.modelDt);
  modules.stepVertical5({
    dt: prevClone.modelDt,
    grid: prevClone.grid,
    state: prevClone.state,
    geo: prevClone.geo,
    params: prevClone.vertParams,
    scratch: prevClone._dynScratch
  });
  if (typeof prevClone._closeSurfaceSourceTracerBudget === 'function') {
    prevClone._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
  }
  if (typeof prevClone._updateHydrostatic === 'function') prevClone._updateHydrostatic();
  const { doMicrophysics } = computeStepCadence(prevClone);
  if (typeof prevClone.vertParams?.enableConvectiveOutcome === 'boolean') {
    prevClone.microParams.enableConvectiveOutcome = prevClone.vertParams.enableConvectiveOutcome;
  }
  if (doMicrophysics) {
    modules.stepMicrophysics5({ dt: prevClone.modelDt, state: prevClone.state, params: prevClone.microParams });
    if (typeof prevClone._closeSurfaceSourceTracerBudget === 'function') {
      prevClone._closeSurfaceSourceTracerBudget('qvSourceAtmosphericCarryover');
    }
  }
  const endPreviousStepMicrophysics5 = createBoundarySnapshot({
    boundary: 'endPreviousStepMicrophysics5',
    state: prevClone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: makeOwnershipSeed(aggregatePhysicalMass(prevClone.state, [targetCell.cellIndex])),
    ownershipCorridor: makeOwnershipSeed(aggregatePhysicalMass(prevClone.state, corridorIndices))
  });

  const startSeedTarget = makeOwnershipSeed(aggregatePhysicalMass(checkpointCore.state, [targetCell.cellIndex]));
  const startSeedCorridor = makeOwnershipSeed(aggregatePhysicalMass(checkpointCore.state, corridorIndices));
  const endPreviousFullStep = createBoundarySnapshot({
    boundary: 'endPreviousFullStep',
    state: checkpointCore.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: startSeedTarget,
    ownershipCorridor: startSeedCorridor
  });

  const stepClone = await corridorProof.cloneCoreFromSource(modules, checkpointCore);
  let targetOwnership = { ...startSeedTarget };
  let corridorOwnership = { ...startSeedCorridor };
  const boundaries = {
    endPreviousStepMicrophysics5,
    endPreviousFullStep,
    startCurrentStep: createBoundarySnapshot({
      boundary: 'startCurrentStep',
      state: stepClone.state,
      targetCellIndex: targetCell.cellIndex,
      corridorIndices,
      ownershipTarget: targetOwnership,
      ownershipCorridor: corridorOwnership
    })
  };

  const cadence = computeStepCadence(stepClone);
  if (typeof stepClone._updateHydrostatic === 'function') stepClone._updateHydrostatic();
  modules.stepSurface2D5({
    dt: stepClone.modelDt,
    grid: stepClone.grid,
    state: stepClone.state,
    climo: stepClone.climo,
    geo: stepClone.geo,
    params: stepClone.surfaceParams
  });
  boundaries.afterStepSurface2D5 = createBoundarySnapshot({
    boundary: 'afterStepSurface2D5',
    state: stepClone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: targetOwnership,
    ownershipCorridor: corridorOwnership
  });

  if (typeof stepClone._updateHydrostatic === 'function') stepClone._updateHydrostatic();
  if (cadence.doRadiation) {
    modules.stepRadiation2D5({
      dt: stepClone.modelDt,
      grid: stepClone.grid,
      state: stepClone.state,
      timeUTC: stepClone.timeUTC,
      params: stepClone.radParams
    });
  }
  boundaries.afterStepRadiation2D5 = createBoundarySnapshot({
    boundary: 'afterStepRadiation2D5',
    state: stepClone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: targetOwnership,
    ownershipCorridor: corridorOwnership
  });

  if (typeof stepClone._updateHydrostatic === 'function') stepClone._updateHydrostatic();
  stepClone.dynParams.stepIndex = stepClone._dynStepIndex;
  modules.stepWinds5({
    dt: stepClone.modelDt,
    grid: stepClone.grid,
    state: stepClone.state,
    geo: stepClone.geo,
    params: {
      ...stepClone.dynParams,
      diagnosticsLevel: stepClone.verticalLayout?.upperTroposphere ?? null,
      collectDiagnostics: false
    },
    scratch: stepClone._dynScratch
  });
  const spinupParams = stepClone.windNudgeSpinupParams;
  if (spinupParams?.enable) {
    const durationSeconds = Number.isFinite(spinupParams.durationSeconds) ? spinupParams.durationSeconds : 0;
    stepClone._windNudgeSpinupSeconds = Math.min(
      stepClone._windNudgeSpinupSeconds + stepClone.modelDt,
      durationSeconds > 0 ? durationSeconds : stepClone._windNudgeSpinupSeconds + stepClone.modelDt
    );
  }
  const dur = Number.isFinite(spinupParams?.durationSeconds) ? spinupParams.durationSeconds : 0;
  const r01 = dur > 0 ? Math.min(1, stepClone._windNudgeSpinupSeconds / dur) : 1;
  const r = r01 * r01 * (3 - 2 * r01);
  const lerp = (a, b, t) => a + (b - a) * t;
  const tauSurfaceEff = lerp(
    spinupParams?.tauSurfaceStartSeconds ?? stepClone.windNudgeParams.tauSurfaceSeconds,
    stepClone.windNudgeParams.tauSurfaceSeconds,
    r
  );
  const tauUpperEff = lerp(
    spinupParams?.tauUpperStartSeconds ?? stepClone.windNudgeParams.tauUpperSeconds,
    stepClone.windNudgeParams.tauUpperSeconds,
    r
  );
  const tauVEff = lerp(
    spinupParams?.tauVStartSeconds ?? stepClone.windNudgeParams.tauVSeconds,
    stepClone.windNudgeParams.tauVSeconds,
    r
  );
  modules.stepWindNudge5({
    dt: stepClone.modelDt,
    grid: stepClone.grid,
    state: stepClone.state,
    climo: stepClone.climo,
    params: {
      ...stepClone.windNudgeParams,
      tauSurfaceSeconds: tauSurfaceEff,
      tauUpperSeconds: tauUpperEff,
      tauVSeconds: tauVEff,
      maxUpperSpeed: stepClone.dynParams?.maxWind ?? null
    }
  });
  if (stepClone.windEddyParams?.enable) {
    modules.stepWindEddyNudge5({
      dt: stepClone.modelDt,
      grid: stepClone.grid,
      state: stepClone.state,
      climo: stepClone.climo,
      params: stepClone.windEddyParams
    });
  }
  boundaries.afterWindUpdates = createBoundarySnapshot({
    boundary: 'afterWindUpdates',
    state: stepClone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: targetOwnership,
    ownershipCorridor: corridorOwnership
  });

  modules.stepSurfacePressure5({
    dt: stepClone.modelDt,
    grid: stepClone.grid,
    state: stepClone.state,
    params: stepClone.massParams,
    scratch: stepClone._dynScratch
  });
  boundaries.afterStepSurfacePressure5 = createBoundarySnapshot({
    boundary: 'afterStepSurfacePressure5',
    state: stepClone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: targetOwnership,
    ownershipCorridor: corridorOwnership
  });

  const traces = seedProvenanceTracers(stepClone.state);
  stepClone.advectParams.stepIndex = stepClone._dynStepIndex;
  modules.stepAdvection5({
    dt: stepClone.modelDt,
    grid: stepClone.grid,
    state: stepClone.state,
    params: stepClone.advectParams,
    scratch: stepClone._dynScratch
  });
  const advectedTraces = advectPreverticalProvenance({
    state: stepClone.state,
    grid: stepClone.grid,
    dt: stepClone.modelDt,
    params: stepClone.advectParams,
    traces
  });

  const afterSurfacePressureTargetMass = boundaries.afterStepSurfacePressure5.targetCell.upperCloudMassKgM2;
  const afterSurfacePressureCorridorMass = boundaries.afterStepSurfacePressure5.corridorBand.upperCloudMassKgM2;
  const afterAdvectionTargetMass = aggregatePhysicalMass(stepClone.state, [targetCell.cellIndex]);
  const afterAdvectionCorridorMass = aggregatePhysicalMass(stepClone.state, corridorIndices);
  targetOwnership = updateOwnershipForBoundary({
    previousMass: afterSurfacePressureTargetMass,
    currentMass: afterAdvectionTargetMass,
    ownership: targetOwnership,
    mode: 'advection'
  });
  corridorOwnership = updateOwnershipForBoundary({
    previousMass: afterSurfacePressureCorridorMass,
    currentMass: afterAdvectionCorridorMass,
    ownership: corridorOwnership,
    mode: 'advection'
  });

  boundaries.afterStepAdvection5 = createBoundarySnapshot({
    boundary: 'afterStepAdvection5',
    state: stepClone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: targetOwnership,
    ownershipCorridor: corridorOwnership
  });
  boundaries.preStepVertical5 = createBoundarySnapshot({
    boundary: 'preStepVertical5',
    state: stepClone.state,
    targetCellIndex: targetCell.cellIndex,
    corridorIndices,
    ownershipTarget: targetOwnership,
    ownershipCorridor: corridorOwnership
  });

  const preStepVertical5Provenance = {
    targetCell: Object.fromEntries(
      TRACE_KEYS.map((key) => [key, aggregateTraceMass(advectedTraces[key], stepClone.state, [targetCell.cellIndex])])
    ),
    corridorBand: Object.fromEntries(
      TRACE_KEYS.map((key) => [key, aggregateTraceMass(advectedTraces[key], stepClone.state, corridorIndices)])
    )
  };

  return {
    commit: commitAtRoot(root),
    root,
    targetCell,
    corridorIndices,
    boundaries,
    preStepVertical5Provenance
  };
};

const buildBoundaryComparisons = ({ currentTrace, historicalTrace }) => {
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
    targetCell.push({ boundary, absDeltaUpperCloudMassKgM2: round(Math.abs(targetDelta), 5), deltaUpperCloudMassKgM2: targetDelta });
    corridorBand.push({ boundary, absDeltaUpperCloudMassKgM2: round(Math.abs(corridorDelta), 5), deltaUpperCloudMassKgM2: corridorDelta });
  }
  const firstMaterialTargetBoundary = targetCell.find((entry) => (entry.absDeltaUpperCloudMassKgM2 || 0) >= MATERIAL_THRESHOLD_KGM2) || null;
  const firstMaterialCorridorBoundary = corridorBand.find((entry) => (entry.absDeltaUpperCloudMassKgM2 || 0) >= MATERIAL_THRESHOLD_KGM2) || null;
  const candidates = [
    firstMaterialTargetBoundary?.boundary,
    firstMaterialCorridorBoundary?.boundary
  ].filter(Boolean);
  const firstMaterialBoundary = candidates.sort((a, b) => BOUNDARY_ORDER.indexOf(a) - BOUNDARY_ORDER.indexOf(b))[0] || null;
  return { targetCell, corridorBand, firstMaterialTargetBoundary, firstMaterialCorridorBoundary, firstMaterialBoundary };
};

const buildOwnershipExcess = ({ currentTrace, historicalTrace }) => {
  const buildDelta = (currentValues, historicalValues) => {
    const delta = {};
    for (const key of TRACE_KEYS) delta[key] = round((currentValues?.[key] || 0) - (historicalValues?.[key] || 0), 5);
    return delta;
  };
  return {
    targetCell: buildDelta(currentTrace.preStepVertical5Provenance.targetCell, historicalTrace.preStepVertical5Provenance.targetCell),
    corridorBand: buildDelta(currentTrace.preStepVertical5Provenance.corridorBand, historicalTrace.preStepVertical5Provenance.corridorBand)
  };
};

const copyUpperCloudReservoir = ({ sourceState, targetState, cellIndices = null }) => {
  const cellSet = cellIndices ? new Set(cellIndices) : null;
  const { N, nz, sigmaHalf } = targetState;
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const base = lev * N;
    const copyCell = (cellIndex) => {
      const idx = base + cellIndex;
      for (const key of ['qc', 'qi', 'qr', 'qs']) {
        if (targetState[key]) targetState[key][idx] = sourceState[key]?.[idx] || 0;
      }
    };
    if (cellSet) {
      for (const cellIndex of cellSet) copyCell(cellIndex);
    } else {
      for (let cellIndex = 0; cellIndex < N; cellIndex += 1) copyCell(cellIndex);
    }
  }
};

const saveUpperCloudReservoir = ({ state, cellIndices }) => {
  const { N, nz, sigmaHalf } = state;
  const saved = { qc: new Map(), qi: new Map(), qr: new Map(), qs: new Map() };
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const base = lev * N;
    for (const cellIndex of cellIndices) {
      const idx = base + cellIndex;
      for (const key of ['qc', 'qi', 'qr', 'qs']) {
        if (state[key]) saved[key].set(idx, state[key][idx] || 0);
      }
    }
  }
  return saved;
};

const restoreUpperCloudReservoir = ({ state, saved }) => {
  for (const key of ['qc', 'qi', 'qr', 'qs']) {
    if (!state[key]) continue;
    for (const [idx, value] of saved[key].entries()) state[key][idx] = value;
  }
};

const runAdvectionOnly = ({ core, modules }) => {
  core.advectParams.stepIndex = core._dynStepIndex;
  modules.stepAdvection5({
    dt: core.modelDt,
    grid: core.grid,
    state: core.state,
    params: core.advectParams,
    scratch: core._dynScratch
  });
};

const determineRetentionDecision = ({ retentionOff, advectionOff, carryoverOnly, advectionOnly }) => {
  if ((retentionOff.targetReductionFrac || 0) >= 0.7 && (advectionOff.targetReductionFrac || 0) < 0.35) {
    return 'retention-dominant';
  }
  if ((advectionOff.targetReductionFrac || 0) >= 0.7 && (retentionOff.targetReductionFrac || 0) < 0.35) {
    return 'advection-dominant';
  }
  if ((carryoverOnly.targetReproductionFrac || 0) >= 0.7 && (advectionOnly.targetReproductionFrac || 0) < 0.35) {
    return 'retention-dominant';
  }
  return 'coupled';
};

const summarizeVariant = async ({ contract, variant, historicalRoot, skipCounterfactuals: omitCounterfactuals = false }) => {
  const corridorMeta = {
    sectorKey: contract.corridor.sectorKey,
    latBandDeg: contract.corridor.latBandDeg,
    targetLatDeg: contract.corridor.targetCell.latDeg,
    targetLonDeg: contract.corridor.targetCell.lonDeg
  };
  const currentModules = await corridorProof.importBaselineModules(repoRoot);
  const historicalModules = await corridorProof.importBaselineModules(historicalRoot);

  const currentTrace = await buildVariantBaselines({ root: repoRoot, modules: currentModules, variant, corridorMeta });
  const historicalTrace = await buildVariantBaselines({ root: historicalRoot, modules: historicalModules, variant, corridorMeta });
  const boundaryComparisons = buildBoundaryComparisons({ currentTrace, historicalTrace });
  const ownershipExcess = buildOwnershipExcess({ currentTrace, historicalTrace });
  const primaryOwner = {
    targetCell: rankPrimaryOwner(ownershipExcess.targetCell),
    corridorBand: rankPrimaryOwner(ownershipExcess.corridorBand)
  };

  if (omitCounterfactuals) {
    return {
      variant: {
        name: variant.name,
        nx: variant.nx,
        ny: variant.ny,
        dtSeconds: variant.dtSeconds,
        checkpointDay: variant.checkpointDay
      },
      currentCommit: currentTrace.commit,
      historicalCommit: historicalTrace.commit,
      targetCell: currentTrace.targetCell,
      corridorCellCount: currentTrace.corridorIndices.length,
      firstMaterialBoundary: boundaryComparisons.firstMaterialBoundary,
      ownershipExcess,
      primaryOwner,
      retentionDecision: 'not-computed',
      counterfactuals: {
        retentionOff: null,
        advectionOff: null,
        carryoverOnly: null,
        advectionOnly: null
      }
    };
  }

  // Rebuild pre-advection clones for the U3-style decision.
  const currentCheckpointCore = await createConfiguredCore(currentModules, variant);
  const historicalCheckpointCore = await createConfiguredCore(historicalModules, variant);
  await advanceToDay(currentCheckpointCore, variant.checkpointDay);
  await advanceToDay(historicalCheckpointCore, variant.checkpointDay);
  const corridorIndices = currentTrace.corridorIndices;
  const targetCellIndex = currentTrace.targetCell.cellIndex;
  const currentPreAdvection = await corridorProof.cloneCoreFromSource(currentModules, currentCheckpointCore);
  const historicalPreAdvection = await corridorProof.cloneCoreFromSource(historicalModules, historicalCheckpointCore);
  runCurrentStepUntilAdvection({ core: currentPreAdvection, modules: currentModules });
  runCurrentStepUntilAdvection({ core: historicalPreAdvection, modules: historicalModules });

  const currentBaseline = {
    target: aggregatePhysicalMass(currentPreAdvection.state, [targetCellIndex]),
    corridor: aggregatePhysicalMass(currentPreAdvection.state, corridorIndices)
  };
  const historicalBaseline = {
    target: aggregatePhysicalMass(historicalPreAdvection.state, [targetCellIndex]),
    corridor: aggregatePhysicalMass(historicalPreAdvection.state, corridorIndices)
  };
  const baselineTargetExcess = currentBaseline.target - historicalBaseline.target;
  const baselineCorridorExcess = currentBaseline.corridor - historicalBaseline.corridor;
  const summarizeCounterfactual = (snapshot) => ({
    targetReductionFrac: baselineTargetExcess > 0 ? round(1 - ((snapshot.target - historicalBaseline.target) / baselineTargetExcess), 5) : null,
    corridorReductionFrac: baselineCorridorExcess > 0 ? round(1 - ((snapshot.corridor - historicalBaseline.corridor) / baselineCorridorExcess), 5) : null,
    targetReproductionFrac: baselineTargetExcess > 0 ? round((snapshot.target - historicalBaseline.target) / baselineTargetExcess, 5) : null,
    corridorReproductionFrac: baselineCorridorExcess > 0 ? round((snapshot.corridor - historicalBaseline.corridor) / baselineCorridorExcess, 5) : null
  });

  const retentionOffCore = await corridorProof.cloneCoreFromSource(currentModules, currentPreAdvection);
  copyUpperCloudReservoir({ sourceState: historicalPreAdvection.state, targetState: retentionOffCore.state, cellIndices: corridorIndices });
  runAdvectionOnly({ core: retentionOffCore, modules: currentModules });
  const retentionOff = summarizeCounterfactual({
    target: aggregatePhysicalMass(retentionOffCore.state, [targetCellIndex]),
    corridor: aggregatePhysicalMass(retentionOffCore.state, corridorIndices)
  });

  const advectionOffCore = await corridorProof.cloneCoreFromSource(currentModules, currentPreAdvection);
  const savedCorridor = saveUpperCloudReservoir({ state: advectionOffCore.state, cellIndices: corridorIndices });
  runAdvectionOnly({ core: advectionOffCore, modules: currentModules });
  restoreUpperCloudReservoir({ state: advectionOffCore.state, saved: savedCorridor });
  const advectionOff = summarizeCounterfactual({
    target: aggregatePhysicalMass(advectionOffCore.state, [targetCellIndex]),
    corridor: aggregatePhysicalMass(advectionOffCore.state, corridorIndices)
  });

  const carryoverOnlyCore = await corridorProof.cloneCoreFromSource(historicalModules, historicalPreAdvection);
  copyUpperCloudReservoir({ sourceState: currentPreAdvection.state, targetState: carryoverOnlyCore.state });
  runAdvectionOnly({ core: carryoverOnlyCore, modules: historicalModules });
  const carryoverOnly = summarizeCounterfactual({
    target: aggregatePhysicalMass(carryoverOnlyCore.state, [targetCellIndex]),
    corridor: aggregatePhysicalMass(carryoverOnlyCore.state, corridorIndices)
  });

  const advectionOnlyCore = await corridorProof.cloneCoreFromSource(currentModules, currentPreAdvection);
  copyUpperCloudReservoir({ sourceState: historicalPreAdvection.state, targetState: advectionOnlyCore.state });
  runAdvectionOnly({ core: advectionOnlyCore, modules: currentModules });
  const advectionOnly = summarizeCounterfactual({
    target: aggregatePhysicalMass(advectionOnlyCore.state, [targetCellIndex]),
    corridor: aggregatePhysicalMass(advectionOnlyCore.state, corridorIndices)
  });

  const retentionDecision = determineRetentionDecision({ retentionOff, advectionOff, carryoverOnly, advectionOnly });

  return {
    variant: {
      name: variant.name,
      nx: variant.nx,
      ny: variant.ny,
      dtSeconds: variant.dtSeconds,
      checkpointDay: variant.checkpointDay
    },
    currentCommit: currentTrace.commit,
    historicalCommit: historicalTrace.commit,
    targetCell: currentTrace.targetCell,
    corridorCellCount: corridorIndices.length,
    firstMaterialBoundary: boundaryComparisons.firstMaterialBoundary,
    ownershipExcess,
    primaryOwner,
    retentionDecision,
    counterfactuals: { retentionOff, advectionOff, carryoverOnly, advectionOnly }
  };
};

const buildCrossVariantAssessment = (variants) => {
  const targetOwnerKeys = variants.map((entry) => entry.primaryOwner?.targetCell?.key || null);
  const corridorOwnerKeys = variants.map((entry) => entry.primaryOwner?.corridorBand?.key || null);
  const firstBoundaries = variants.map((entry) => entry.firstMaterialBoundary || null);
  const decisions = variants.map((entry) => entry.retentionDecision || null);

  const sameTargetOwnerPass = targetOwnerKeys.every((key) => key === targetOwnerKeys[0]);
  const sameCorridorOwnerPass = corridorOwnerKeys.every((key) => key === corridorOwnerKeys[0]);
  const sameFirstBoundaryPass = firstBoundaries.every((key) => key === firstBoundaries[0]);
  const sameRetentionDecisionPass = decisions.every((key) => key === decisions[0]);
  const exitCriteriaPass = sameTargetOwnerPass && sameCorridorOwnerPass && sameFirstBoundaryPass && sameRetentionDecisionPass;

  return {
    sameTargetOwnerPass,
    sameCorridorOwnerPass,
    sameFirstBoundaryPass,
    sameRetentionDecisionPass,
    exitCriteriaPass,
    stablePrimaryTargetOwner: targetOwnerKeys[0] || null,
    stablePrimaryCorridorOwner: corridorOwnerKeys[0] || null,
    stableFirstBoundary: firstBoundaries[0] || null,
    stableRetentionDecision: decisions[0] || null
  };
};

const renderMarkdown = ({ variants, assessment }) => {
  const lines = [];
  lines.push('# U5 Pre-Vertical Numerical Ownership Check');
  lines.push('');
  lines.push(`- exitCriteriaPass: ${assessment.exitCriteriaPass}`);
  lines.push(`- stable target owner: ${assessment.stablePrimaryTargetOwner}`);
  lines.push(`- stable corridor owner: ${assessment.stablePrimaryCorridorOwner}`);
  lines.push(`- stable first boundary: ${assessment.stableFirstBoundary}`);
  lines.push(`- stable retention decision: ${assessment.stableRetentionDecision}`);
  lines.push('');
  for (const entry of variants) {
    lines.push(`## ${entry.variant.name}`);
    lines.push('');
    lines.push(`- grid: ${entry.variant.nx}x${entry.variant.ny}`);
    lines.push(`- dtSeconds: ${entry.variant.dtSeconds}`);
    lines.push(`- target cell: ${entry.targetCell.cellIndex} (lat ${entry.targetCell.latDeg}, lon ${entry.targetCell.lonDeg})`);
    lines.push(`- first material boundary: ${entry.firstMaterialBoundary}`);
    lines.push(`- target owner: ${entry.primaryOwner.targetCell.key} (${entry.primaryOwner.targetCell.value})`);
    lines.push(`- corridor owner: ${entry.primaryOwner.corridorBand.key} (${entry.primaryOwner.corridorBand.value})`);
    lines.push(`- retention decision: ${entry.retentionDecision}`);
    lines.push('');
  }
  return lines.join('\n');
};

const runExperiment = async () => {
  const contract = readJson(contractPath);
  const historicalRoot = contract.baselineRoots?.historical?.root;
  if (!historicalRoot || !fs.existsSync(path.join(historicalRoot, '.git'))) {
    throw new Error(`Missing historical worktree at ${historicalRoot}.`);
  }

  const baseNx = contract.corridor.grid.nx;
  const baseNy = contract.corridor.grid.ny;
  const baseDt = contract.corridor.grid.dtSeconds;
  const checkpointDay = Number(contract.corridor.checkpointDay);

  const variants = [
    { name: 'baseline', nx: baseNx, ny: baseNy, dtSeconds: baseDt, checkpointDay },
    { name: 'dt_half', nx: baseNx, ny: baseNy, dtSeconds: Math.max(300, Math.round(baseDt * 0.5 / 300) * 300), checkpointDay },
    { name: 'grid_coarse', nx: Math.max(24, Math.round(baseNx * 0.75 / 12) * 12), ny: Math.max(12, Math.round(baseNy * 0.75 / 6) * 6), dtSeconds: baseDt, checkpointDay },
    { name: 'grid_dense', nx: Math.max(24, Math.round(baseNx * 1.25 / 12) * 12), ny: Math.max(12, Math.round(baseNy * 1.25 / 6) * 6), dtSeconds: baseDt, checkpointDay }
  ];

  const variantResults = [];
  for (const variant of variants) {
    variantResults.push(await corridorProof.suppressProcessOutput(() => summarizeVariant({
      contract,
      variant,
      historicalRoot,
      skipCounterfactuals
    })));
  }

  const assessment = buildCrossVariantAssessment(variantResults);
  return {
    schema: 'satellite-wars.prevertical-numerical-ownership-check.v1',
    generatedAt: new Date().toISOString(),
    contractPath,
    variants: variantResults,
    assessment
  };
};

const main = async () => {
  const result = await runExperiment();
  const markdown = renderMarkdown(result);
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    assessment: result.assessment,
    variants: result.variants.map((entry) => ({
      name: entry.variant.name,
      firstMaterialBoundary: entry.firstMaterialBoundary,
      targetOwner: entry.primaryOwner.targetCell.key,
      retentionDecision: entry.retentionDecision
    }))
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  buildCrossVariantAssessment,
  determineRetentionDecision
};
