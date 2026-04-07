import {
  clampMaxSubstepsForWeatherWorker,
  getDisplayedSimTimeSeconds,
  getMaxSimSubsteps,
  getRenderSimTimeSeconds
} from './simStepPlanner';

describe('simStepPlanner', () => {
  test('paused burst uses a bounded multi-hour chunk size', () => {
    expect(getMaxSimSubsteps({
      paused: true,
      burstActive: true,
      fixedSimStepSeconds: 120,
      maxSubsteps: 4,
      maxSubstepsBurst: 20,
      pausedBurstHorizonSeconds: 7200
    })).toBe(60);
  });

  test('running burst keeps the smaller interactive cap', () => {
    expect(getMaxSimSubsteps({
      paused: false,
      burstActive: true,
      fixedSimStepSeconds: 120,
      maxSubsteps: 4,
      maxSubstepsBurst: 20,
      pausedBurstHorizonSeconds: 86400
    })).toBe(20);
  });

  test('paused render time does not run ahead of simulated core time', () => {
    expect(getRenderSimTimeSeconds({
      simTimeSeconds: 2400,
      simAccumSeconds: 84000,
      paused: true
    })).toBe(2400);
  });

  test('paused weather-worker backlog prevents the sim clock from running ahead', () => {
    expect(clampMaxSubstepsForWeatherWorker({
      maxSteps: 60,
      paused: true,
      useWeatherWorker: true,
      weatherWorkerBusy: true
    })).toBe(0);

    expect(clampMaxSubstepsForWeatherWorker({
      maxSteps: 60,
      paused: true,
      useWeatherWorker: true,
      weatherWorkerBusy: false
    })).toBe(60);
  });

  test('paused worker-backed UI time does not outrun the weather core', () => {
    expect(getDisplayedSimTimeSeconds({
      simTimeSeconds: 21720,
      paused: true,
      useWeatherWorker: true,
      weatherCoreTimeSeconds: 14520
    })).toBe(14520);

    expect(getDisplayedSimTimeSeconds({
      simTimeSeconds: 21720,
      paused: false,
      useWeatherWorker: true,
      weatherCoreTimeSeconds: 14520
    })).toBe(21720);
  });

  test('running render time still includes fractional sim accumulation', () => {
    expect(getRenderSimTimeSeconds({
      simTimeSeconds: 2400,
      simAccumSeconds: 60,
      paused: false
    })).toBe(2460);
  });
});
