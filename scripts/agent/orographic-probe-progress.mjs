export function deriveProbeProgressPath(outPath) {
  if (!outPath) return null;
  return outPath.endsWith('.json')
    ? `${outPath.slice(0, -5)}.partial.json`
    : `${outPath}.partial.json`;
}

export function createProbeProgress({ targetSeconds, resetMode, pageTargetId, outPath, screenshotPath }) {
  const now = new Date().toISOString();
  return {
    schema: 'satellite-wars.orographic-probe-progress.v1',
    status: 'running',
    phase: 'startup',
    requestedTargetSeconds: targetSeconds,
    resetMode,
    pageTargetId: pageTargetId ?? null,
    outPath: outPath ?? null,
    screenshotPath: screenshotPath ?? null,
    startedAt: now,
    updatedAt: now,
    lastProbeState: null,
    timeline: []
  };
}

export function updateProbeProgress(progress, {
  status,
  phase,
  probeState = null,
  note = null,
  error = null,
  extra = {}
} = {}) {
  const updatedAt = new Date().toISOString();
  const nextPhase = phase ?? progress.phase ?? null;
  const entry = {
    at: updatedAt,
    phase: nextPhase,
    note,
    probeState,
    ...extra
  };
  return {
    ...progress,
    status: status ?? progress.status,
    phase: nextPhase,
    updatedAt,
    lastProbeState: probeState ?? progress.lastProbeState ?? null,
    timeline: [...(progress.timeline ?? []), entry].slice(-25),
    error: error
      ? {
          message: error.message ?? String(error)
        }
      : progress.error
  };
}
