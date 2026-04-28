export function clampSimAdvanceByTruthBudget(requestedSeconds, currentLeadSeconds, maxLeadSeconds) {
  if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) return 0;
  if (!Number.isFinite(currentLeadSeconds) || currentLeadSeconds < 0) return requestedSeconds;
  if (!Number.isFinite(maxLeadSeconds) || maxLeadSeconds <= 0) return requestedSeconds;
  return Math.max(0, Math.min(requestedSeconds, maxLeadSeconds - currentLeadSeconds));
}

export function computeFixedStepBudget(
  accumulatedSeconds,
  fixedStepSeconds,
  maxSteps,
  epsilonSeconds = 1e-6
) {
  const safeAccum = Number.isFinite(accumulatedSeconds) ? Math.max(0, accumulatedSeconds) : 0;
  const safeStep = Number.isFinite(fixedStepSeconds) && fixedStepSeconds > 0 ? fixedStepSeconds : 0;
  const safeMaxSteps = Number.isFinite(maxSteps) && maxSteps > 0 ? Math.floor(maxSteps) : 0;
  if (safeStep <= 0 || safeMaxSteps <= 0) {
    return {
      stepsAvailable: 0,
      stepsToRun: 0,
      stepsSkipped: 0,
      deltaSimSeconds: 0,
      remainingSeconds: safeAccum
    };
  }

  const quotient = safeAccum / safeStep;
  const nearest = Math.round(quotient);
  const snappedAccum = Math.abs(safeAccum - nearest * safeStep) <= Math.max(0, epsilonSeconds)
    ? nearest * safeStep
    : safeAccum;
  const stepsAvailable = Math.floor((snappedAccum + Math.max(0, epsilonSeconds)) / safeStep);
  const stepsToRun = Math.min(stepsAvailable, safeMaxSteps);
  const deltaSimSeconds = stepsToRun * safeStep;
  const remainingSeconds = Math.max(0, snappedAccum - deltaSimSeconds);

  return {
    stepsAvailable,
    stepsToRun,
    stepsSkipped: Math.max(0, stepsAvailable - stepsToRun),
    deltaSimSeconds,
    remainingSeconds
  };
}
