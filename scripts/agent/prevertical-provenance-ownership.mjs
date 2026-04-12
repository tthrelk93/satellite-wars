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
  'prevertical-provenance-ownership'
);
const G = 9.80665;
const UPPER_SIGMA_MAX = 0.55;
const TRACE_KEYS = [
  'previousStepResidualUpperCloud',
  'currentStepAdvectedUpperCloud',
  'currentStepLocalUpperCloud',
  'reprocessedUpperCloud'
];

let contractPath = DEFAULT_CONTRACT_PATH;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
}

const round = corridorProof.round || ((value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const sum = corridorProof.sum || ((values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const commitAtRoot = (root) => execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
const sigmaMidAtLevel = (sigmaHalf, lev) => 0.5 * ((sigmaHalf?.[lev] || 0) + (sigmaHalf?.[lev + 1] || 0));

const createConfiguredCore = async (modules, contract) => corridorProof.suppressProcessOutput(async () => {
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

const advanceToDay = async (core, day) => {
  await corridorProof.suppressProcessOutput(async () => {
    core.advanceModelSeconds(day * 86400);
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
      const path = Math.max(0, state.upperCloudPath?.[k] || 0);
      const reprocessedMass = Math.max(
        0,
        (state.upperCloudRegenerationMass?.[k] || 0) + (state.upperCloudOscillatoryMass?.[k] || 0)
      );
      const reprocessedFrac = path > 0 ? clamp01(reprocessedMass / path) : 0;
      traces.reprocessedUpperCloud[idx] = cloudMix * reprocessedFrac;
      traces.previousStepResidualUpperCloud[idx] = cloudMix - traces.reprocessedUpperCloud[idx];
    }
  }
  return traces;
};

const applyPolarFilter = (field, nx, base, rowIndex, passes, rowA, rowB) => {
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

const advectPreverticalProvenance = ({ dt, grid, state, params = {}, traces }) => {
  const { nx, ny, invDx, invDy, latDeg, polarWeight, cellLonDeg } = grid;
  const { N, nz, u, v } = state;
  const maxBacktraceCells = Number.isFinite(params.maxBacktraceCells) ? params.maxBacktraceCells : 2;
  const filterMoisture = params.filterMoisture === true;
  const polarLatStartDeg = Number.isFinite(params.polarLatStartDeg) ? params.polarLatStartDeg : 60;
  const lonCellRad = cellLonDeg * (Math.PI / 180);
  const next = buildZeroTraceSet(state.SZ);
  const rowA = new Float32Array(nx);
  const rowB = new Float32Array(nx);

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
        for (const key of TRACE_KEYS) {
          applyPolarFilter(next[key], nx, base, j, passes, rowA, rowB);
        }
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

const aggregatePhysicalMass = (state, indices) => round(sum(indices.map((cellIndex) => {
  let mass = 0;
  const { N, nz, pHalf, sigmaHalf } = state;
  for (let lev = 0; lev < nz; lev += 1) {
    if (sigmaMidAtLevel(sigmaHalf, lev) > UPPER_SIGMA_MAX) continue;
    const dp = (pHalf[(lev + 1) * N + cellIndex] || 0) - (pHalf[lev * N + cellIndex] || 0);
    if (!(dp > 0)) continue;
    const idx = lev * N + cellIndex;
    mass += upperCloudMixingRatioAtIndex(state, idx) * (dp / G);
  }
  return mass;
})), 5);

const snapshotOwnership = ({ state, traces, targetCellIndex, corridorIndices, boundary }) => {
  const targetIndices = [targetCellIndex];
  const targetCell = Object.fromEntries(TRACE_KEYS.map((key) => [key, aggregateTraceMass(traces[key], state, targetIndices)]));
  const corridorBand = Object.fromEntries(TRACE_KEYS.map((key) => [key, aggregateTraceMass(traces[key], state, corridorIndices)]));
  const targetPhysical = aggregatePhysicalMass(state, targetIndices);
  const corridorPhysical = aggregatePhysicalMass(state, corridorIndices);
  const targetTracked = round(sum(Object.values(targetCell)), 5);
  const corridorTracked = round(sum(Object.values(corridorBand)), 5);
  const targetResidual = round(targetPhysical - targetTracked, 5);
  const corridorResidual = round(corridorPhysical - corridorTracked, 5);
  const targetClosure = round(Math.max(0, 1 - Math.abs(targetResidual) / Math.max(1e-6, Math.abs(targetPhysical) + Math.abs(targetTracked))), 5);
  const corridorClosure = round(Math.max(0, 1 - Math.abs(corridorResidual) / Math.max(1e-6, Math.abs(corridorPhysical) + Math.abs(corridorTracked))), 5);
  return {
    boundary,
    targetCell: {
      physicalUpperCloudMassKgM2: targetPhysical,
      trackedUpperCloudMassKgM2: targetTracked,
      closureResidualKgM2: targetResidual,
      closureFrac: targetClosure,
      provenanceKgM2: targetCell
    },
    corridorBand: {
      physicalUpperCloudMassKgM2: corridorPhysical,
      trackedUpperCloudMassKgM2: corridorTracked,
      closureResidualKgM2: corridorResidual,
      closureFrac: corridorClosure,
      provenanceKgM2: corridorBand
    }
  };
};

const buildOwnershipExcess = ({ currentSnapshot, historicalSnapshot }) => {
  const buildDelta = (currentValues, historicalValues) => {
    const delta = {};
    for (const key of TRACE_KEYS) {
      delta[key] = round((currentValues?.[key] || 0) - (historicalValues?.[key] || 0), 5);
    }
    return delta;
  };
  return {
    targetCell: buildDelta(currentSnapshot.targetCell.provenanceKgM2, historicalSnapshot.targetCell.provenanceKgM2),
    corridorBand: buildDelta(currentSnapshot.corridorBand.provenanceKgM2, historicalSnapshot.corridorBand.provenanceKgM2)
  };
};

const rankPrimaryOwner = (values) => {
  let best = null;
  for (const key of TRACE_KEYS) {
    const value = Number(values?.[key]) || 0;
    if (!best || value > best.value) best = { key, value: round(value, 5) };
  }
  return best;
};

const runProvenanceReplay = async ({ root, contract }) => {
  const modules = await corridorProof.importBaselineModules(root);
  const core = await createConfiguredCore(modules, contract);
  await advanceToDay(core, contract.corridor.checkpointDay);
  const corridorIndices = corridorProof.buildCorridorMask(core, {
    sector: contract.corridor.sectorKey,
    latMin: contract.corridor.latBandDeg[0],
    latMax: contract.corridor.latBandDeg[1]
  });
  const targetCellIndex = contract.corridor.targetCell.cellIndex;
  if (!corridorIndices.includes(targetCellIndex)) {
    throw new Error(`Target cell ${targetCellIndex} is not inside the frozen corridor for ${root}.`);
  }

  const clone = await corridorProof.cloneCoreFromSource(modules, core);
  let traces = seedProvenanceTracers(clone.state);
  const startCurrentStep = snapshotOwnership({
    state: clone.state,
    traces,
    targetCellIndex,
    corridorIndices,
    boundary: 'startCurrentStep'
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
  modules.stepSurfacePressure5({
    dt: clone.modelDt,
    grid: clone.grid,
    state: clone.state,
    params: clone.massParams,
    scratch: clone._dynScratch
  });
  clone.advectParams.stepIndex = clone._dynStepIndex;
  modules.stepAdvection5({
    dt: clone.modelDt,
    grid: clone.grid,
    state: clone.state,
    params: clone.advectParams,
    scratch: clone._dynScratch
  });
  traces = advectPreverticalProvenance({
    dt: clone.modelDt,
    grid: clone.grid,
    state: clone.state,
    params: clone.advectParams,
    traces
  });
  const preStepVertical5 = snapshotOwnership({
    state: clone.state,
    traces,
    targetCellIndex,
    corridorIndices,
    boundary: 'preStepVertical5'
  });
  return {
    commit: commitAtRoot(root),
    root,
    corridorIndices,
    targetCellIndex,
    startCurrentStep,
    preStepVertical5
  };
};

const renderMarkdown = ({ contract, currentTrace, historicalTrace, excess, ranking }) => {
  const lines = [];
  lines.push('# U2 Pre-Vertical Provenance Ownership');
  lines.push('');
  lines.push(`- Corridor: ${contract.corridor.sectorKey} ${contract.corridor.latBandDeg[0]}-${contract.corridor.latBandDeg[1]} deg`);
  lines.push(`- Target cell: ${contract.corridor.targetCell.cellIndex} (lat ${contract.corridor.targetCell.latDeg}, lon ${contract.corridor.targetCell.lonDeg})`);
  lines.push(`- Historical baseline: ${historicalTrace.commit}`);
  lines.push(`- Current baseline: ${currentTrace.commit}`);
  lines.push('');
  lines.push('## Pre-vertical ownership excess');
  lines.push('');
  lines.push(`- Target primary owner: ${ranking.targetCell.key} (${ranking.targetCell.value})`);
  lines.push(`- Corridor primary owner: ${ranking.corridorBand.key} (${ranking.corridorBand.value})`);
  lines.push('');
  lines.push('### Target cell excess by provenance');
  lines.push('');
  for (const key of TRACE_KEYS) {
    lines.push(`- ${key}: ${excess.targetCell[key]}`);
  }
  lines.push('');
  lines.push('### Corridor excess by provenance');
  lines.push('');
  for (const key of TRACE_KEYS) {
    lines.push(`- ${key}: ${excess.corridorBand[key]}`);
  }
  lines.push('');
  lines.push('## Closure');
  lines.push('');
  lines.push(`- Current target closure: ${currentTrace.preStepVertical5.targetCell.closureFrac}`);
  lines.push(`- Current corridor closure: ${currentTrace.preStepVertical5.corridorBand.closureFrac}`);
  lines.push(`- Historical target closure: ${historicalTrace.preStepVertical5.targetCell.closureFrac}`);
  lines.push(`- Historical corridor closure: ${historicalTrace.preStepVertical5.corridorBand.closureFrac}`);
  lines.push('');
  return lines.join('\n');
};

const runExperiment = async () => {
  const contract = readJson(contractPath);
  const historicalRoot = contract.baselineRoots?.historical?.root;
  if (!historicalRoot || !fs.existsSync(path.join(historicalRoot, '.git'))) {
    throw new Error(`Missing historical worktree at ${historicalRoot}.`);
  }
  const historicalTrace = await runProvenanceReplay({ root: historicalRoot, contract });
  const currentTrace = await runProvenanceReplay({ root: repoRoot, contract });
  const excess = buildOwnershipExcess({
    currentSnapshot: currentTrace.preStepVertical5,
    historicalSnapshot: historicalTrace.preStepVertical5
  });
  const ranking = {
    targetCell: rankPrimaryOwner(excess.targetCell),
    corridorBand: rankPrimaryOwner(excess.corridorBand)
  };
  const rootCauseAssessment = {
    ruledIn: [],
    ruledOut: [],
    ambiguous: []
  };
  if (ranking.targetCell?.key === 'previousStepResidualUpperCloud') {
    rootCauseAssessment.ruledIn.push('The target-cell excess pre-vertical cloud is primarily inherited from the previous step.');
  } else {
    rootCauseAssessment.ambiguous.push('The target-cell excess is not dominated by previous-step residual ownership.');
  }
  if ((excess.corridorBand.currentStepAdvectedUpperCloud || 0) > 0.01) {
    rootCauseAssessment.ruledIn.push('Current-step advection still contributes a measurable corridor-scale amplification.');
  } else {
    rootCauseAssessment.ruledOut.push('Current-step advection is not a meaningful provenance family in the frozen corridor replay.');
  }
  if ((excess.targetCell.currentStepLocalUpperCloud || 0) <= 1e-4 && (excess.corridorBand.currentStepLocalUpperCloud || 0) <= 1e-4) {
    rootCauseAssessment.ruledOut.push('Local pre-vertical cloud creation is not a meaningful contributor in the frozen replay.');
  }

  return {
    schema: 'satellite-wars.prevertical-provenance-ownership.v1',
    generatedAt: new Date().toISOString(),
    contractPath,
    baselines: {
      historical: { commit: historicalTrace.commit, root: historicalTrace.root },
      current: { commit: currentTrace.commit, root: currentTrace.root }
    },
    traces: {
      historical: historicalTrace,
      current: currentTrace
    },
    excessPreStepVertical5: excess,
    primaryOwnerRanking: ranking,
    rootCauseAssessment
  };
};

const main = async () => {
  const result = await runExperiment();
  const contract = readJson(contractPath);
  const markdown = renderMarkdown({
    contract,
    currentTrace: result.traces.current,
    historicalTrace: result.traces.historical,
    excess: result.excessPreStepVertical5,
    ranking: result.primaryOwnerRanking
  });
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    primaryOwnerRanking: result.primaryOwnerRanking,
    targetClosure: result.traces.current.preStepVertical5.targetCell.closureFrac,
    corridorClosure: result.traces.current.preStepVertical5.corridorBand.closureFrac
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  classifyInterpolatedContribution,
  rankPrimaryOwner,
  buildOwnershipExcess
};
