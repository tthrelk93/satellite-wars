export function getRenderSimTimeSeconds({ simTimeSeconds = 0, simAccumSeconds = 0, paused = false } = {}) {
  return paused ? simTimeSeconds : simTimeSeconds + simAccumSeconds;
}

export function getDisplayedSimTimeSeconds({
  simTimeSeconds = 0,
  paused = false,
  useWeatherWorker = false,
  weatherCoreTimeSeconds = null
} = {}) {
  if (paused && useWeatherWorker && Number.isFinite(weatherCoreTimeSeconds)) {
    return Math.min(simTimeSeconds, weatherCoreTimeSeconds);
  }
  return simTimeSeconds;
}

export function getMaxSimSubsteps({
  paused = false,
  burstActive = false,
  fixedSimStepSeconds = 120,
  maxSubsteps = 4,
  maxSubstepsBurst = 20,
  pausedBurstHorizonSeconds = 86400
} = {}) {
  if (!burstActive) return maxSubsteps;
  const pausedBurstSteps = Math.max(
    maxSubstepsBurst,
    Math.ceil(pausedBurstHorizonSeconds / Math.max(1, fixedSimStepSeconds))
  );
  return paused ? pausedBurstSteps : maxSubstepsBurst;
}

export function clampMaxSubstepsForWeatherWorker({
  maxSteps = 0,
  paused = false,
  useWeatherWorker = false,
  weatherWorkerBusy = false
} = {}) {
  if (!paused || !useWeatherWorker) return maxSteps;
  if (weatherWorkerBusy) return 0;
  return maxSteps;
}
