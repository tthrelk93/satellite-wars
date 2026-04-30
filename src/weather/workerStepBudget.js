export function takeBoundedAccumulatedStep(accumSeconds, maxStepSeconds) {
  if (!Number.isFinite(accumSeconds) || accumSeconds <= 0) {
    return { stepSeconds: 0, remainingSeconds: 0 };
  }

  const cap = Number.isFinite(maxStepSeconds) && maxStepSeconds > 0
    ? maxStepSeconds
    : accumSeconds;
  const stepSeconds = Math.min(accumSeconds, cap);

  return {
    stepSeconds,
    remainingSeconds: Math.max(0, accumSeconds - stepSeconds)
  };
}
