const DEFAULT_MAX_IDLE_LOOPS = 4;
const DEFAULT_SAFE_CHUNK_SECONDS = 12 * 3600;

export const computeSafeAdvanceChunkSeconds = (core) => {
  const dt = Math.max(1, Number(core?.modelDt) || 0);
  const maxSteps = Math.max(1000, Math.ceil(86400 / dt) + 10);
  return Math.max(dt, Math.min(DEFAULT_SAFE_CHUNK_SECONDS, (maxSteps - 2) * dt));
};

export const advanceModelSecondsFully = (core, modelSeconds, options = {}) => {
  if (!core || !Number.isFinite(modelSeconds) || modelSeconds <= 0) return 0;
  const chunkSeconds = Math.max(
    Number(core?.modelDt) || 1,
    Number.isFinite(options.chunkSeconds) && options.chunkSeconds > 0
      ? options.chunkSeconds
      : computeSafeAdvanceChunkSeconds(core)
  );
  const maxIdleLoops = Number.isFinite(options.maxIdleLoops) && options.maxIdleLoops > 0
    ? Math.floor(options.maxIdleLoops)
    : DEFAULT_MAX_IDLE_LOOPS;
  const startTime = Number(core.timeUTC) || 0;
  const targetTime = startTime + modelSeconds;
  let idleLoops = 0;
  while ((Number(core.timeUTC) || 0) + 1e-9 < targetTime) {
    const before = Number(core.timeUTC) || 0;
    const remaining = targetTime - before;
    core.advanceModelSeconds(Math.min(chunkSeconds, remaining));
    const after = Number(core.timeUTC) || 0;
    if (after <= before + 1e-9) {
      idleLoops += 1;
      if (idleLoops >= maxIdleLoops) {
        throw new Error(`advanceModelSecondsFully stalled before reaching target time (remaining=${remaining}).`);
      }
    } else {
      idleLoops = 0;
    }
  }
  return (Number(core.timeUTC) || 0) - startTime;
};

export const advanceToModelDayFully = (core, targetDay, options = {}) => {
  if (!core || !Number.isFinite(targetDay)) return 0;
  const currentDay = (Number(core.timeUTC) || 0) / 86400;
  const deltaDays = targetDay - currentDay;
  if (!(deltaDays > 0)) return 0;
  return advanceModelSecondsFully(core, deltaDays * 86400, options);
};

export const _test = {
  computeSafeAdvanceChunkSeconds,
  advanceModelSecondsFully,
  advanceToModelDayFully
};
