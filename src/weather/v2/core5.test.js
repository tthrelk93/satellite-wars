import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherCore5 } from './core5.js';
import { applyHeadlessTerrainFixture } from '../../../scripts/agent/headless-terrain-fixture.mjs';

test('WeatherCore5 defaults keep the stronger broad-circulation surface wind restore enabled', async () => {
  const core = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await core._initPromise;

  assert.equal(core.windNudgeParams.tauSurfaceSeconds, 8 * 3600);
  assert.equal(core.windNudgeSpinupParams.tauSurfaceStartSeconds, 6 * 3600);
  assert.equal(core.vertParams.rhTrig, 0.72);
  assert.equal(core.vertParams.rhMidMin, 0.22);
  assert.equal(core.vertParams.omegaTrig, 0.2);
  assert.equal(core.vertParams.instabTrig, 2.5);
  assert.equal(core.vertParams.qvTrig, 0.0018);
  assert.equal(core.vertParams.thetaeCoeff, 10.5);
  assert.equal(core.vertParams.convOrganizationGrowTau, 90 * 60);
  assert.equal(core.vertParams.subtropicalSubsidenceTau, 8 * 3600);
  assert.equal(core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac, 0.58);
  assert.equal(core.vertParams.subtropicalSubsidenceWeakHemiBoost, 0.35);
  assert.equal(core.vertParams.enableTransitionReturnFlowCoupling, true);
  assert.equal(core.vertParams.circulationReturnFlowCouplingMaxFrac, 0.32);
  assert.equal(core.vertParams.enableHadleyReturnFlowWindCoupling, true);
  assert.equal(core.vertParams.hadleyReturnFlowWindTau, 3 * 3600);
  assert.equal(core.vertParams.enableWalkerLongitudinalCoupling, true);
  assert.equal(core.microParams.qc0, 2e-4);
  assert.equal(core.microParams.qi0, 1.5e-4);
  assert.equal(core.microParams.kAutoRain, 2.4e-3);
  assert.equal(core.microParams.kAutoSnow, 3.0e-3);
  assert.equal(core.microParams.kFallRain, 1 / 900);
  assert.equal(core.microParams.kFallSnow, 1 / 3600);
  assert.equal(core.microParams.precipEffMicro, 1.0);
  assert.equal(core.microParams.convectiveSaturationRainoutMaxFrac, 0.65);
  assert.equal(core.nudgeParams.organizedConvectionQvColumnRelief, 1.05);
  assert.equal(core.nudgeParams.subtropicalSubsidenceQvRelief, 1.65);
});

test('WeatherCore5 refreshes runtime nudge params from current nudgeParams before nudging', async () => {
  const core = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await core._initPromise;

  assert.equal(core._nudgeParamsRuntime.enableQvColumn, false);

  core.nudgeParams.enableQvColumn = true;
  core.nudgeParams.tauQvColumn = 20 * 86400;
  core._nudgeAccumSeconds = core.nudgeParams.cadenceSeconds;
  core._stepOnce(core.modelDt);

  assert.equal(core._nudgeParamsRuntime.enableQvColumn, true);
  assert.equal(core._nudgeParamsRuntime.tauQvColumn, 20 * 86400);
});

test('WeatherCore5 accumulates causal climate process budgets for later audits', async () => {
  const core = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await core._initPromise;

  core.resetClimateProcessDiagnostics();
  core._stepOnce(core.modelDt);

  const summary = core.getClimateProcessBudgetSummary();
  assert.ok(summary.sampleCount >= 1);
  assert.ok(summary.modules.stepSurface2D5);
  assert.ok(summary.modules.stepAdvection5);
  assert.ok(summary.modules.stepVertical5);
  assert.ok(summary.modules.stepMicrophysics5);
  assert.ok(summary.modules.stepSurface2D5.bands.north_dry_belt);
  assert.ok('deep_core_tropical' in summary.precipitationRegimes);
});

test('WeatherCore5 seeds initialization vapor tracers and restores full snapshots with parity-critical runtime state', async () => {
  const core = new WeatherCore5({ nx: 12, ny: 6, seed: 12345 });
  await core._initPromise;
  core.simSpeed = 12;
  core.lodParams.microphysicsEvery = 4;
  core.radParams.kSw = 0.18;
  core.state.analysisTargets = {
    source: 'analysis',
    surfacePressurePa: new Float32Array(core.state.N).fill(101000),
    surfaceTemperatureK: new Float32Array(core.state.N).fill(288),
    uByPressurePa: new Map([[100000, new Float32Array(core.state.N).fill(3)]]),
    vByPressurePa: new Map([[100000, new Float32Array(core.state.N).fill(-1)]]),
    temperatureKByPressurePa: new Map([[70000, new Float32Array(core.state.N).fill(270)]]),
    thetaKByPressurePa: new Map([[70000, new Float32Array(core.state.N).fill(295)]]),
    specificHumidityKgKgByPressurePa: new Map([[70000, new Float32Array(core.state.N).fill(0.004)]])
  };
  core.state.vertMetrics = {
    omegaPosP90: 0.42,
    convectiveFraction: 0.25
  };
  core.state.vertMetricsContinuous = {
    convectivePotentialMean: 0.33,
    subtropicalSubsidenceDryingMean: 0.07
  };
  core.advanceModelSeconds(core.modelDt * 3);
  const snapshot = core.getStateSnapshot({ mode: 'full' });

  const restored = new WeatherCore5({ nx: 12, ny: 6, seed: 12345 });
  await restored._initPromise;
  restored.loadStateSnapshot(snapshot);

  assert.equal(restored.timeUTC, core.timeUTC);
  assert.equal(restored._dynStepIndex, core._dynStepIndex);
  assert.equal(restored.simSpeed, core.simSpeed);
  assert.equal(restored.lodParams.microphysicsEvery, core.lodParams.microphysicsEvery);
  assert.equal(restored.radParams.kSw, core.radParams.kSw);
  assert.equal(restored.state.ps[0], core.state.ps[0]);
  assert.equal(restored.state.qv[0], core.state.qv[0]);
  assert.equal(restored.state.sstNow[0], core.state.sstNow[0]);
  assert.equal(restored.state.qvSourceInitializationMemory[0], core.state.qvSourceInitializationMemory[0]);
  assert.equal(restored.state.analysisTargets?.source, 'analysis');
  assert.equal(restored.state.analysisTargets?.surfacePressurePa?.[0], 101000);
  assert.equal(restored.state.analysisTargets?.uByPressurePa?.get(100000)?.[0], 3);
  assert.ok(Math.abs(restored.state.analysisTargets?.specificHumidityKgKgByPressurePa?.get(70000)?.[0] - 0.004) < 1e-6);
  assert.equal(restored.state.vertMetrics?.omegaPosP90, core.state.vertMetrics?.omegaPosP90);
  assert.equal(restored.state.vertMetricsContinuous?.convectivePotentialMean, core.state.vertMetricsContinuous?.convectivePotentialMean);
});

test('WeatherCore5 records module timings and conservation summaries during stepping', async () => {
  const core = new WeatherCore5({ nx: 12, ny: 6, seed: 12345 });
  await core._initPromise;
  core.advanceModelSeconds(core.modelDt * 2);

  const timing = core.getModuleTimingSummary();
  const conservation = core.getConservationSummary();
  assert.ok(timing.modules.stepSurface2D5.callCount >= 1);
  assert.ok(timing.modules.stepVertical5.totalWallMs >= 0);
  assert.ok(conservation.modules.stepSurface2D5.callCount >= 1);
  assert.ok(Number.isFinite(conservation.modules.stepSurface2D5.delta.globalColumnWaterMeanKgM2));
  assert.ok(Number.isFinite(conservation.modules.stepSurface2D5.delta.globalEvapAccumMeanMm));
  assert.ok(Number.isFinite(conservation.waterCycle.evapMinusPrecipMeanMm));
  assert.ok(Number.isFinite(conservation.waterCycle.tcwDriftKgM2));
  assert.ok(Number.isFinite(conservation.waterCycle.verticalUnaccountedDeltaKgM2));
  assert.ok(Number.isFinite(conservation.waterCycle.verticalSubtropicalDryingDemandKgM2));
  assert.ok(Number.isFinite(conservation.waterCycle.verticalCloudErosionToVaporKgM2));
});

test('WeatherCore5 keeps terrain-fixture surface theta bounded during early stepping', async () => {
  const core = new WeatherCore5({ nx: 48, ny: 24, seed: 12345 });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  core.advanceModelSeconds(core.modelDt * 8);

  const { N, nz, theta } = core.state;
  let minTheta = Infinity;
  let maxTheta = -Infinity;
  for (let k = 0; k < N; k += 1) {
    const value = theta[(nz - 1) * N + k];
    minTheta = Math.min(minTheta, value);
    maxTheta = Math.max(maxTheta, value);
  }

  assert.ok(minTheta >= 150, `expected bounded terrain-fixture surface theta, got ${minTheta}`);
  assert.ok(maxTheta <= 400, `expected bounded terrain-fixture surface theta, got ${maxTheta}`);
});

test('WeatherCore5 replay module disabling can skip a targeted module without affecting the control path API', async () => {
  const baseline = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await baseline._initPromise;
  applyHeadlessTerrainFixture(baseline);
  baseline.advanceModelSeconds(baseline.modelDt);
  const baselineLedger = baseline.getCloudTransitionLedgerRaw();

  const replay = new WeatherCore5({ nx: 16, ny: 8, seed: 12345 });
  await replay._initPromise;
  applyHeadlessTerrainFixture(replay);
  replay.setReplayDisabledModules(['stepVertical5']);
  assert.deepEqual(replay.getReplayDisabledModules(), ['stepVertical5']);
  replay.advanceModelSeconds(replay.modelDt);
  const replayLedger = replay.getCloudTransitionLedgerRaw();

  const baselineVerticalCalls = baselineLedger.modules.stepVertical5.callCount;
  const replayVerticalCalls = replayLedger.modules.stepVertical5.callCount;
  let replayVerticalSignal = 0;
  for (const field of Object.values(replayLedger.modules.stepVertical5.transitions)) {
    for (const value of field) replayVerticalSignal += Math.abs(value || 0);
  }

  assert.ok(baselineVerticalCalls >= 1);
  assert.ok(replayVerticalCalls >= 1);
  assert.equal(replayVerticalSignal, 0);
  replay.clearReplayDisabledModules();
  assert.deepEqual(replay.getReplayDisabledModules(), []);
});
