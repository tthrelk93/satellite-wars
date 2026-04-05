const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const zeroField = (field) => {
  if (field?.fill) field.fill(0);
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

export function stepAnalysisIncrement5({ dt, state, params = {} } = {}) {
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
      const before = state.theta[i];
      const after = clamp(before + delta, thetaMin, thetaMax);
      const applied = after - before;
      if (applied === 0) continue;
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
      const before = state.qv[i];
      const after = clamp(before + delta, 0, qvMax);
      const applied = after - before;
      if (applied === 0) continue;
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
