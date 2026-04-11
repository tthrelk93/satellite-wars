import { g, Rd, Cp } from '../constants.js';
import { interpolatePressureFieldAtCell } from './analysisData.js';
import {
  INSTRUMENTATION_LEVEL_BAND_COUNT,
  findInstrumentationLevelBandIndex,
  instrumentationBandOffset,
  sigmaMidAtLevel
} from './instrumentationBands5.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const smoothstep = (edge0, edge1, x) => {
  const span = Math.max(1e-6, edge1 - edge0);
  const t = clamp01((x - edge0) / span);
  return t * t * (3 - 2 * t);
};
const P0 = 100000;
const KAPPA = Rd / Cp;

const zeroField = (field) => {
  if (field?.fill) field.fill(0);
};

const computeDryingSupport = ({ latAbsDeg = 0, lowLevelOmegaEffectivePaS = 0, subtropicalSubsidenceDryingFrac = 0 }) => {
  const dryBeltRelief = smoothstep(14, 34, latAbsDeg) * smoothstep(-0.02, 0.25, lowLevelOmegaEffectivePaS);
  const subtropicalDryingStrength = smoothstep(0.01, 0.08, subtropicalSubsidenceDryingFrac);
  return clamp01(0.55 * dryBeltRelief + 0.95 * subtropicalDryingStrength);
};

const accumulateBandValue = (field, bandIndex, cell, cellCount, value) => {
  if (
    !(field instanceof Float32Array)
    || field.length !== cellCount * INSTRUMENTATION_LEVEL_BAND_COUNT
    || !Number.isFinite(value)
    || value === 0
  ) return;
  field[instrumentationBandOffset(bandIndex, cell, cellCount)] += value;
};

export function clearAnalysisIncrement5(state) {
  if (!state) return;
  zeroField(state.analysisIauPs);
  zeroField(state.analysisIauTs);
  zeroField(state.analysisIauU);
  zeroField(state.analysisIauV);
  zeroField(state.analysisIauTheta);
  zeroField(state.analysisIauQv);
  state.analysisIauRemainingSeconds = 0;
  state.analysisIauWindowSeconds = 0;
}

export function armAnalysisIncrement5(state, intervalSeconds) {
  if (!state) return;
  const windowSeconds = Number.isFinite(intervalSeconds) ? Math.max(0, intervalSeconds) : 0;
  state.analysisIauWindowSeconds = windowSeconds;
  state.analysisIauRemainingSeconds = windowSeconds;
}

export function stepAnalysisIncrement5({ dt, state, grid = null, params = {} } = {}) {
  if (!state || !Number.isFinite(dt) || dt <= 0 || params.enable === false) {
    return { didApply: false, updatedCount: 0, meanAbsDelta: 0, maxAbsDelta: 0, remainingSeconds: state?.analysisIauRemainingSeconds ?? 0 };
  }

  const remainingSeconds = Number.isFinite(state.analysisIauRemainingSeconds)
    ? state.analysisIauRemainingSeconds
    : 0;
  if (!(remainingSeconds > 0)) {
    return { didApply: false, updatedCount: 0, meanAbsDelta: 0, maxAbsDelta: 0, remainingSeconds };
  }

  const N = state.N;
  const SZ = state.SZ;
  const psMin = Number.isFinite(params.psMin) ? params.psMin : 50000;
  const psMax = Number.isFinite(params.psMax) ? params.psMax : 110000;
  const TsMin = Number.isFinite(params.TsMin) ? params.TsMin : 180;
  const TsMax = Number.isFinite(params.TsMax) ? params.TsMax : 330;
  const thetaMin = Number.isFinite(params.thetaMin) ? params.thetaMin : 180;
  const thetaMax = Number.isFinite(params.thetaMax) ? params.thetaMax : 380;
  const qvMax = Number.isFinite(params.qvMax) ? params.qvMax : 0.04;
  const windMin = Number.isFinite(params.windMin) ? params.windMin : -150;
  const windMax = Number.isFinite(params.windMax) ? params.windMax : 150;
  const sigmaHalf = state.sigmaHalf;
  const pHalf = state.pHalf;
  const pMid = state.pMid;
  const analysisTargets = state.analysisTargets || null;
  const latDeg = grid?.latDeg || null;
  const nx = grid?.nx || null;

  let updatedCount = 0;
  let sumAbsDelta = 0;
  let maxAbsDelta = 0;

  if (state.analysisIauPs?.length === N) {
    for (let i = 0; i < N; i += 1) {
      const delta = state.analysisIauPs[i] * dt;
      if (!Number.isFinite(delta) || delta === 0) continue;
      const before = state.ps[i];
      const after = clamp(before + delta, psMin, psMax);
      const applied = after - before;
      if (applied === 0) continue;
      state.ps[i] = after;
      const absDelta = Math.abs(applied);
      sumAbsDelta += absDelta;
      if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
      updatedCount += 1;
    }
  }
  if (state.analysisIauTs?.length === N) {
    for (let i = 0; i < N; i += 1) {
      const delta = state.analysisIauTs[i] * dt;
      if (!Number.isFinite(delta) || delta === 0) continue;
      const before = state.Ts[i];
      const after = clamp(before + delta, TsMin, TsMax);
      const applied = after - before;
      if (applied === 0) continue;
      state.Ts[i] = after;
      const absDelta = Math.abs(applied);
      sumAbsDelta += absDelta;
      if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
      updatedCount += 1;
    }
  }
  if (state.analysisIauU?.length === SZ) {
    for (let i = 0; i < SZ; i += 1) {
      const delta = state.analysisIauU[i] * dt;
      if (!Number.isFinite(delta) || delta === 0) continue;
      const before = state.u[i];
      const after = clamp(before + delta, windMin, windMax);
      const applied = after - before;
      if (applied === 0) continue;
      state.u[i] = after;
      const absDelta = Math.abs(applied);
      sumAbsDelta += absDelta;
      if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
      updatedCount += 1;
    }
  }
  if (state.analysisIauV?.length === SZ) {
    for (let i = 0; i < SZ; i += 1) {
      const delta = state.analysisIauV[i] * dt;
      if (!Number.isFinite(delta) || delta === 0) continue;
      const before = state.v[i];
      const after = clamp(before + delta, windMin, windMax);
      const applied = after - before;
      if (applied === 0) continue;
      state.v[i] = after;
      if (analysisTargets && pMid?.length === SZ && Number.isFinite(pMid[i]) && nx && latDeg) {
        const cell = i % N;
        const row = Math.floor(cell / nx);
        const lat = latDeg[row] || 0;
        const latAbs = Math.abs(lat);
        const lev = Math.floor(i / N);
        const bandIndex = findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, state.nz));
        const targetU = analysisTargets?.uByPressurePa
          ? interpolatePressureFieldAtCell(analysisTargets.uByPressurePa, pMid[i], cell)
          : null;
        const targetV = analysisTargets?.vByPressurePa
          ? interpolatePressureFieldAtCell(analysisTargets.vByPressurePa, pMid[i], cell)
          : null;
        if (Number.isFinite(targetU) && Number.isFinite(targetV)) {
          const mismatch = Math.hypot(targetU - state.u[i], targetV - before);
          state.analysisTargetWindMismatchAccum[cell] += mismatch;
          state.analysisTargetWindSampleCount[cell] += 1;
          accumulateBandValue(state.analysisWindTargetMismatchByBand, bandIndex, cell, N, mismatch);
        }
        const dryingSupport = computeDryingSupport({
          latAbsDeg: latAbs,
          lowLevelOmegaEffectivePaS: state.lowLevelOmegaEffective?.[cell] || 0,
          subtropicalSubsidenceDryingFrac: state.subtropicalSubsidenceDrying?.[cell] || 0
        });
        if (latAbs >= 15 && latAbs <= 35 && sigmaMidAtLevel(sigmaHalf, lev, state.nz) <= 0.55) {
          const polewardSign = lat >= 0 ? 1 : -1;
          if (applied * polewardSign > 0 && dryingSupport > 0) {
            const oppositionMagnitude = Math.abs(applied) * dryingSupport;
            state.windOpposedDryingCorrection[cell] += oppositionMagnitude;
            accumulateBandValue(state.windOpposedDryingByBandCorrection, bandIndex, cell, N, oppositionMagnitude);
          }
        }
      }
      const absDelta = Math.abs(applied);
      sumAbsDelta += absDelta;
      if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
      updatedCount += 1;
    }
  }
  if (state.analysisIauTheta?.length === SZ) {
    for (let i = 0; i < SZ; i += 1) {
      const delta = state.analysisIauTheta[i] * dt;
      if (!Number.isFinite(delta) || delta === 0) continue;
      const cell = i % N;
      const lev = Math.floor(i / N);
      const before = state.theta[i];
      const after = clamp(before + delta, thetaMin, thetaMax);
      const applied = after - before;
      if (applied === 0) continue;
      if (analysisTargets && pMid?.length === SZ && Number.isFinite(pMid[i])) {
        const targetValue = analysisTargets.thetaKByPressurePa
          ? interpolatePressureFieldAtCell(analysisTargets.thetaKByPressurePa, pMid[i], cell)
          : analysisTargets.temperatureKByPressurePa
            ? (() => {
              const temperatureTarget = interpolatePressureFieldAtCell(analysisTargets.temperatureKByPressurePa, pMid[i], cell);
              return Number.isFinite(temperatureTarget) ? temperatureTarget / Math.pow(pMid[i] / P0, KAPPA) : null;
            })()
            : null;
        if (Number.isFinite(targetValue)) {
          const mismatch = Math.abs(targetValue - before);
          state.analysisTargetThetaMismatchAccum[cell] += mismatch;
          state.analysisTargetThetaSampleCount[cell] += 1;
          accumulateBandValue(
            state.analysisThetaTargetMismatchByBand,
            findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, state.nz)),
            cell,
            N,
            mismatch
          );
        }
      }
      state.theta[i] = after;
      const absDelta = Math.abs(applied);
      sumAbsDelta += absDelta;
      if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
      updatedCount += 1;
    }
  }
  if (state.analysisIauQv?.length === SZ) {
    for (let i = 0; i < SZ; i += 1) {
      const delta = state.analysisIauQv[i] * dt;
      if (!Number.isFinite(delta) || delta === 0) continue;
      const cell = i % N;
      const lev = Math.floor(i / N);
      const before = state.qv[i];
      const after = clamp(before + delta, 0, qvMax);
      const applied = after - before;
      if (applied === 0) continue;
      if (pHalf?.length === (state.nz + 1) * N && nx && latDeg) {
        const row = Math.floor(cell / nx);
        const latAbs = Math.abs(latDeg[row] || 0);
        const dp = pHalf[(lev + 1) * N + cell] - pHalf[lev * N + cell];
        const massCell = dp > 0 ? dp / g : 0;
        const dryingSupport = computeDryingSupport({
          latAbsDeg: latAbs,
          lowLevelOmegaEffectivePaS: state.lowLevelOmegaEffective?.[cell] || 0,
          subtropicalSubsidenceDryingFrac: state.subtropicalSubsidenceDrying?.[cell] || 0
        });
        const bandIndex = findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, state.nz));
        if (massCell > 0) {
          const nativeDryingSupportMass = Math.max(0, before) * massCell * dryingSupport;
          state.helperNativeDryingSupportMass[cell] += nativeDryingSupportMass;
          accumulateBandValue(state.helperNativeDryingSupportByBandMass, bandIndex, cell, N, nativeDryingSupportMass);
          if (applied > 0) {
            const moisteningMass = applied * massCell;
            state.analysisMoisteningMass[cell] += moisteningMass;
            state.analysisOpposedDryingMass[cell] += moisteningMass * dryingSupport;
            accumulateBandValue(state.analysisMoisteningByBandMass, bandIndex, cell, N, moisteningMass);
            accumulateBandValue(state.analysisOpposedDryingByBandMass, bandIndex, cell, N, moisteningMass * dryingSupport);
          }
        }
      }
      if (analysisTargets?.specificHumidityKgKgByPressurePa && pMid?.length === SZ && Number.isFinite(pMid[i])) {
        const qvTarget = interpolatePressureFieldAtCell(analysisTargets.specificHumidityKgKgByPressurePa, pMid[i], cell);
        if (Number.isFinite(qvTarget)) {
          const mismatch = Math.abs(qvTarget - before);
          state.analysisTargetQvMismatchAccum[cell] += mismatch;
          state.analysisTargetQvSampleCount[cell] += 1;
          accumulateBandValue(
            state.analysisQvTargetMismatchByBand,
            findInstrumentationLevelBandIndex(sigmaMidAtLevel(sigmaHalf, lev, state.nz)),
            cell,
            N,
            mismatch
          );
        }
      }
      state.qv[i] = after;
      const absDelta = Math.abs(applied);
      sumAbsDelta += absDelta;
      if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
      updatedCount += 1;
    }
  }

  state.analysisIauRemainingSeconds = Math.max(0, remainingSeconds - dt);
  if (!(state.analysisIauRemainingSeconds > 0)) {
    clearAnalysisIncrement5(state);
  }

  return {
    didApply: updatedCount > 0,
    updatedCount,
    meanAbsDelta: updatedCount > 0 ? sumAbsDelta / updatedCount : 0,
    maxAbsDelta,
    remainingSeconds: state.analysisIauRemainingSeconds
  };
}
