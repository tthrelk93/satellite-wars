import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import {
  computeDryingOmegaBridgePaS,
  computeProjectedOmegaBridgeCellPaS,
  computeDryingOmegaBridgeSourceSupport,
  computeDryingOmegaBridgeTargetWeight,
  computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac,
  computeEquatorialEdgeNorthsideLeakPenaltyFrac,
  computeEquatorialEdgeNorthsideLeakRiskFrac,
  computeEquatorialEdgeNorthsideLeakSourceWindowFrac,
  computeNorthSourceConcentrationPenaltyFrac,
  computeAtlanticDryCoreReceiverTaperFrac,
  computeAtlanticTransitionCarryoverContainmentFrac,
  computeSubtropicalBalanceContract,
  computeSubtropicalDescentVentilationPaS,
  computeEquatorialEdgeSubsidenceGuardSourceSupport,
  computeEquatorialEdgeSubsidenceGuardTargetWeight,
  computeWeakHemiCrossHemiFloorTaperFrac,
  computeTransitionReturnFlowCouplingFrac,
  computeHadleyReturnFlowWindTendencyMs,
  computeTropicalCycloneGenesisPotential,
  computeTornadoRiskPotential,
  tropicalCycloneBasinSeasonSupport,
  stepVertical5
} from './vertical5.js';

const columnVaporMass = (state) => {
  let total = 0;
  for (let lev = 0; lev < state.nz; lev += 1) {
    const dp = state.pHalf[(lev + 1) * state.N] - state.pHalf[lev * state.N];
    total += Math.max(0, state.qv[lev * state.N] || 0) * (dp / 9.80665);
  }
  return total;
};

test('stepVertical5 accepts live upper-cloud containment controls without unknown-param warnings', () => {
  const sigmaHalf = new Float32Array([0, 0.5, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 2,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([20]),
    lonDeg: new Float32Array([-40]),
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 50000;
  state.pHalf[2] = 100000;
  state.pMid[0] = 35000;
  state.pMid[1] = 75000;
  state.theta[0] = 275;
  state.theta[1] = 300;
  state.T[0] = 245;
  state.T[1] = 294;
  state.qv[0] = 0.002;
  state.qv[1] = 0.014;

  const warned = [];
  const originalWarn = console.warn;
  console.warn = (message, ...rest) => {
    warned.push(String(message));
    if (rest.length) warned.push(rest.map(String).join(' '));
  };
  try {
    stepVertical5({
      dt: 60,
      grid,
      state,
      params: {
        enableMixing: false,
        enableConvection: false,
        enableLargeScaleVerticalAdvection: false,
        enableOmegaMassFix: false,
        enableSevereWeatherEnvironments: false,
        enableAtlanticTransitionCarryoverContainment: true,
        atlanticTransitionCarryoverContainmentSignal0: 0.04,
        atlanticTransitionCarryoverContainmentSignal1: 0.075,
        atlanticTransitionCarryoverContainmentLat0: 18,
        atlanticTransitionCarryoverContainmentLat1: 22.5,
        atlanticTransitionCarryoverContainmentOverlap0: 0.08,
        atlanticTransitionCarryoverContainmentOverlap1: 0.18,
        atlanticTransitionCarryoverContainmentDry0: 0.12,
        atlanticTransitionCarryoverContainmentDry1: 0.24,
        atlanticTransitionCarryoverContainmentOmega0: 0.12,
        atlanticTransitionCarryoverContainmentOmega1: 0.26,
        atlanticTransitionCarryoverContainmentMaxFrac: 0.18,
        upperCloudWeakErosionSupportScale: 0.68,
        upperCloudPersistenceSupportScale: 0.72
      }
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warned.filter((line) => line.includes('[V2 vertical] Unknown params')), []);
});

test('tropical cyclone genesis potential requires warm moist low-shear ocean and cyclonic spin', () => {
  const favorable = computeTropicalCycloneGenesisPotential({
    latDeg: 16,
    isLand: false,
    seaIceFrac: 0,
    sstK: 301.5,
    boundaryQv: 0.019,
    midQv: 0.010,
    shearMs: 6,
    signedVorticityS_1: 1.2e-5,
    convectionSupport: 0.75,
    lowLevelConvergenceS_1: 8e-6,
    seasonSupport: 1
  });
  const coldWater = computeTropicalCycloneGenesisPotential({
    latDeg: 16,
    sstK: 294,
    boundaryQv: 0.019,
    midQv: 0.010,
    shearMs: 6,
    signedVorticityS_1: 1.2e-5,
    convectionSupport: 0.75,
    seasonSupport: 1
  });
  const land = computeTropicalCycloneGenesisPotential({
    latDeg: 16,
    isLand: true,
    sstK: 301.5,
    boundaryQv: 0.019,
    midQv: 0.010,
    shearMs: 6,
    signedVorticityS_1: 1.2e-5,
    convectionSupport: 0.75,
    seasonSupport: 1
  });
  const sheared = computeTropicalCycloneGenesisPotential({
    latDeg: 16,
    sstK: 301.5,
    boundaryQv: 0.019,
    midQv: 0.010,
    shearMs: 35,
    signedVorticityS_1: 1.2e-5,
    convectionSupport: 0.75,
    seasonSupport: 1
  });

  assert.ok(favorable > 0.35);
  assert.equal(land, 0);
  assert.ok(coldWater < favorable * 0.1);
  assert.ok(sheared < favorable);
});

test('tropical cyclone basin season support follows Atlantic and Southern Hemisphere seasons', () => {
  const atlanticPeak = tropicalCycloneBasinSeasonSupport({ latDeg: 18, lonDeg: -55, dayOfYear: 255 });
  const atlanticWinter = tropicalCycloneBasinSeasonSupport({ latDeg: 18, lonDeg: -55, dayOfYear: 20 });
  const southernPeak = tropicalCycloneBasinSeasonSupport({ latDeg: -18, lonDeg: 80, dayOfYear: 45 });
  const southernWinter = tropicalCycloneBasinSeasonSupport({ latDeg: -18, lonDeg: 80, dayOfYear: 200 });

  assert.ok(atlanticPeak > atlanticWinter * 2);
  assert.ok(southernPeak > southernWinter * 2);
});

test('tornado risk potential requires continental warm-season instability, moisture, shear, lift, and storm mode', () => {
  const favorable = computeTornadoRiskPotential({
    latDeg: 36,
    isLand: true,
    surfaceTempK: 303,
    boundaryQv: 0.018,
    instabilityK: 16,
    shearMs: 30,
    liftSupport: 0.8,
    stormModeSupport: 0.7,
    seasonSupport: 1
  });
  const ocean = computeTornadoRiskPotential({
    latDeg: 36,
    isLand: false,
    surfaceTempK: 303,
    boundaryQv: 0.018,
    instabilityK: 16,
    shearMs: 30,
    liftSupport: 0.8,
    stormModeSupport: 0.7,
    seasonSupport: 1
  });
  const coolStable = computeTornadoRiskPotential({
    latDeg: 36,
    isLand: true,
    surfaceTempK: 281,
    boundaryQv: 0.006,
    instabilityK: 0,
    shearMs: 30,
    liftSupport: 0.8,
    stormModeSupport: 0.7,
    seasonSupport: 1
  });

  assert.ok(favorable > 0.35);
  assert.equal(ocean, 0);
  assert.ok(coolStable < favorable * 0.1);
});

test('stepVertical5 keeps thin upper layers bounded during strong ascent-driven transport', () => {
  const sigmaHalf = new Float32Array([0, 0.5, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 2,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 30000;
  state.pHalf[2] = 100000;
  state.pMid[0] = 25000;
  state.pMid[1] = 65000;
  state.theta[0] = 260;
  state.theta[1] = 320;
  state.qv[0] = 0.002;
  state.qv[1] = 0.02;
  state.T[0] = 220;
  state.T[1] = 290;
  state.dpsDtApplied[0] = -1000;
  const vaporBefore = columnVaporMass(state);

  stepVertical5({
    dt: 60,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvection: false,
      enableOmegaMassFix: true,
      enableLargeScaleVerticalAdvection: true,
      verticalAdvectionCflMax: 0.4,
      verticalAdvectionSigmaTaperExp: 2,
      dThetaMaxVertAdvPerStep: 0
    }
  });

  assert.ok(state.theta[0] > 260);
  assert.ok(state.theta[0] <= 320);
  assert.ok(state.qv[0] > 0.002);
  assert.ok(state.qv[0] <= 0.02);
  assert.ok(state.theta[1] >= 260);
  assert.ok(state.theta[1] <= 320);
  assert.ok(Math.abs(columnVaporMass(state) - vaporBefore) < 1e-5);
  assert.ok(state.resolvedAscentCloudBirthAccumMass[0] > 0);
  assert.ok(Array.from(state.resolvedAscentCloudBirthByBandMass).some((value) => value > 0));
});

test('stepVertical5 substeps over-CFL vertical advection instead of dropping most transport', () => {
  const runCase = (verticalAdvectionMaxSubsteps) => {
    const sigmaHalf = new Float32Array([0, 0.5, 1]);
    const state = createState5({
      grid: { count: 1 },
      nz: 2,
      sigmaHalf
    });
    const grid = {
      nx: 1,
      ny: 1,
      invDx: new Float32Array([1]),
      invDy: new Float32Array([1]),
      cosLat: new Float32Array([1])
    };

    state.ps[0] = 100000;
    state.pHalf[0] = 20000;
    state.pHalf[1] = 45000;
    state.pHalf[2] = 100000;
    state.pMid[0] = 32500;
    state.pMid[1] = 72500;
    state.theta[0] = 265;
    state.theta[1] = 305;
    state.qv[0] = 0.001;
    state.qv[1] = 0.018;
    state.T[0] = 230;
    state.T[1] = 290;
    state.dpsDtApplied[0] = -1000;

    stepVertical5({
      dt: 900,
      grid,
      state,
      params: {
        enableMixing: false,
        enableConvection: false,
        enableOmegaMassFix: true,
        enableLargeScaleVerticalAdvection: true,
        verticalAdvectionCflMax: 0.4,
        verticalAdvectionMaxSubsteps,
        verticalAdvectionSigmaTaperExp: 0,
        dThetaMaxVertAdvPerStep: 0
      }
    });
    return state;
  };

  const singleStep = runCase(1);
  const splitStep = runCase(8);

  assert.ok(splitStep.numericalVerticalCflClampMass[0] < singleStep.numericalVerticalCflClampMass[0]);
  assert.ok(splitStep.qv[0] > singleStep.qv[0]);
});

test('stepVertical5 concentrates frontal ascent while preserving row-mean omega', () => {
  const nx = 8;
  const ny = 5;
  const N = nx * ny;
  const sigmaHalf = new Float32Array([0, 0.35, 0.65, 0.9, 1]);
  const state = createState5({
    grid: { count: N },
    nz: 4,
    sigmaHalf
  });
  const grid = {
    nx,
    ny,
    invDx: new Float32Array(ny).fill(1 / 1_000_000),
    invDy: new Float32Array(ny).fill(1 / 1_000_000),
    cosLat: new Float32Array([0.5, 0.707, 1, 0.707, 0.5]),
    latDeg: new Float32Array([-60, -45, 0, 45, 60]),
    lonDeg: new Float32Array(Array.from({ length: nx }, (_, i) => -180 + ((i + 0.5) * 360) / nx))
  };
  for (let k = 0; k < N; k += 1) {
    state.ps[k] = 100000;
    for (let lev = 0; lev <= state.nz; lev += 1) {
      state.pHalf[lev * N + k] = 10000 + sigmaHalf[lev] * 90000;
    }
  }
  for (let lev = 0; lev < state.nz; lev += 1) {
    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      for (let i = 0; i < nx; i += 1) {
        const idx = lev * N + row + i;
        const waveTemp = 6 * Math.sin((2 * Math.PI * i) / nx);
        state.T[idx] = 276 + 0.5 * grid.latDeg[j] + waveTemp;
        state.theta[idx] = state.T[idx];
        state.qv[idx] = lev === state.nz - 1 ? 0.007 : 0.003;
        state.u[idx] = lev <= 1 ? 22 : 3;
        state.v[idx] = 0;
      }
    }
  }

  stepVertical5({
    dt: 300,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvection: false,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false,
      enableFrontalAscentConcentration: true,
      frontalAscentMaxPaS: 0.08,
      frontalAscentMaxStepPaS: 0.05,
      frontalAscentPeakLatDeg: 45,
      frontalAscentSeasonalShiftDeg: 0,
      frontalAscentMinSupport: 0.01,
      frontalAscentDiffuseDampingFrac: 0.5,
      frontalAscentDiffuseDampingMaxStepPaS: 0.05,
      frontalAscentCoreGatherSupport: 0.05
    }
  });

  const targetRow = 3 * nx;
  const lev = 2;
  let rowSum = 0;
  let rowMin = Infinity;
  let rowMax = -Infinity;
  for (let i = 0; i < nx; i += 1) {
    const omega = state.omega[lev * N + targetRow + i];
    rowSum += omega;
    rowMin = Math.min(rowMin, omega);
    rowMax = Math.max(rowMax, omega);
  }
  assert.ok(Math.abs(rowSum) < 1e-6);
  assert.ok(rowMin < -0.005);
  assert.ok(rowMax > 0.001);
  assert.ok(Array.from(state.frontalAscentSupportDiag).some((value) => value > 0.01));
  assert.ok(Array.from(state.stormGenesisPotentialDiag).some((value) => value > 0.001));
});

test('stepVertical5 builds a persistent continuous convective state from moist ascent', () => {
  const sigmaHalf = new Float32Array([0, 0.35, 0.7, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 3,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([5]),
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 35000;
  state.pHalf[2] = 65000;
  state.pHalf[3] = 100000;
  state.pMid[0] = 27500;
  state.pMid[1] = 50000;
  state.pMid[2] = 82500;
  state.theta[0] = 303;
  state.theta[1] = 295;
  state.theta[2] = 304;
  state.qv[0] = 0.001;
  state.qv[1] = 0.008;
  state.qv[2] = 0.02;
  state.T[0] = 250;
  state.T[1] = 275;
  state.T[2] = 299;
  state.u.fill(0);
  state.v.fill(0);
  state.dpsDtApplied[0] = -1800;

  stepVertical5({
    dt: 1800,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvectiveMixing: false,
      enableConvection: true,
      enableOmegaMassFix: true,
      enableLargeScaleVerticalAdvection: false
    }
  });

  assert.ok(state.convectivePotential[0] > 0.1);
  assert.ok(state.convectiveOrganization[0] > 0.01);
  assert.ok(state.convectiveMassFlux[0] > 0);
  assert.ok(state.convectiveRainoutFraction[0] > 0);
  assert.ok(state.convMask[0] === 0 || state.convMask[0] === 1);
});

test('stepVertical5 can confine extra plume strength and rainout to tropical-core columns', () => {
  const runCase = ({ latDeg, boosted }) => {
    const sigmaHalf = new Float32Array([0, 0.35, 0.7, 1]);
    const state = createState5({
      grid: { count: 1 },
      nz: 3,
      sigmaHalf
    });
    const grid = {
      nx: 1,
      ny: 1,
      latDeg: new Float32Array([latDeg]),
      invDx: new Float32Array([1]),
      invDy: new Float32Array([1]),
      cosLat: new Float32Array([1])
    };

    state.ps[0] = 100000;
    state.pHalf[0] = 20000;
    state.pHalf[1] = 35000;
    state.pHalf[2] = 65000;
    state.pHalf[3] = 100000;
    state.pMid[0] = 27500;
    state.pMid[1] = 50000;
    state.pMid[2] = 82500;
    state.theta[0] = 303;
    state.theta[1] = 295;
    state.theta[2] = 304;
    state.qv[0] = 0.001;
    state.qv[1] = 0.008;
    state.qv[2] = 0.02;
    state.T[0] = 250;
    state.T[1] = 275;
    state.T[2] = 299;
    state.u.fill(0);
    state.v.fill(0);
    state.dpsDtApplied[0] = -1800;

    stepVertical5({
      dt: 1800,
      grid,
      state,
      params: {
        enableMixing: false,
        enableConvectiveMixing: false,
        enableConvection: true,
        enableOmegaMassFix: true,
        enableLargeScaleVerticalAdvection: false,
        tropicalCoreConvectiveMuBoost: boosted ? 0.7 : 0,
        tropicalCoreRainoutBoost: boosted ? 0.35 : 0
      }
    });
    return state;
  };

  const tropicalBase = runCase({ latDeg: 3.75, boosted: false });
  const tropicalBoosted = runCase({ latDeg: 3.75, boosted: true });
  const subtropicalBase = runCase({ latDeg: 24, boosted: false });
  const subtropicalBoosted = runCase({ latDeg: 24, boosted: true });

  assert.ok(tropicalBoosted.convectiveMassFlux[0] > tropicalBase.convectiveMassFlux[0]);
  assert.ok(tropicalBoosted.convectiveRainoutFraction[0] > tropicalBase.convectiveRainoutFraction[0]);
  assert.equal(subtropicalBoosted.convectiveMassFlux[0], subtropicalBase.convectiveMassFlux[0]);
  assert.equal(subtropicalBoosted.convectiveRainoutFraction[0], subtropicalBase.convectiveRainoutFraction[0]);
});

test('stepVertical5 can boost the equatorial core without energizing the tropical shoulder', () => {
  const runCase = ({ latDeg, boosted }) => {
    const sigmaHalf = new Float32Array([0, 0.35, 0.7, 1]);
    const state = createState5({
      grid: { count: 1 },
      nz: 3,
      sigmaHalf
    });
    const grid = {
      nx: 1,
      ny: 1,
      latDeg: new Float32Array([latDeg]),
      invDx: new Float32Array([1]),
      invDy: new Float32Array([1]),
      cosLat: new Float32Array([1])
    };

    state.ps[0] = 100000;
    state.pHalf[0] = 20000;
    state.pHalf[1] = 35000;
    state.pHalf[2] = 65000;
    state.pHalf[3] = 100000;
    state.pMid[0] = 27500;
    state.pMid[1] = 50000;
    state.pMid[2] = 82500;
    state.theta[0] = 303;
    state.theta[1] = 295;
    state.theta[2] = 304;
    state.qv[0] = 0.001;
    state.qv[1] = 0.008;
    state.qv[2] = 0.02;
    state.T[0] = 250;
    state.T[1] = 275;
    state.T[2] = 299;
    state.u.fill(0);
    state.v.fill(0);
    state.dpsDtApplied[0] = -1800;

    stepVertical5({
      dt: 1800,
      grid,
      state,
      params: {
        enableMixing: false,
        enableConvectiveMixing: false,
        enableConvection: true,
        enableOmegaMassFix: true,
        enableLargeScaleVerticalAdvection: false,
        equatorialCoreConvectiveMuBoost: boosted ? 0.7 : 0,
        equatorialCoreRainoutBoost: boosted ? 0.35 : 0,
        equatorialCoreWidthDeg: 5
      }
    });
    return state;
  };

  const equatorialBase = runCase({ latDeg: 3.75, boosted: false });
  const equatorialBoosted = runCase({ latDeg: 3.75, boosted: true });
  const shoulderBase = runCase({ latDeg: 11.25, boosted: false });
  const shoulderBoosted = runCase({ latDeg: 11.25, boosted: true });

  assert.ok(equatorialBoosted.convectiveMassFlux[0] > equatorialBase.convectiveMassFlux[0]);
  assert.ok(equatorialBoosted.convectiveRainoutFraction[0] > equatorialBase.convectiveRainoutFraction[0]);
  assert.equal(shoulderBoosted.convectiveMassFlux[0], shoulderBase.convectiveMassFlux[0]);
  assert.equal(shoulderBoosted.convectiveRainoutFraction[0], shoulderBase.convectiveRainoutFraction[0]);
});

test('stepVertical5 tracks imported upper-cloud persistence when cloud lingers without local convection', () => {
  const sigmaHalf = new Float32Array([0, 0.3, 0.7, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 3,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([22]),
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 35000;
  state.pHalf[2] = 65000;
  state.pHalf[3] = 100000;
  state.pMid[0] = 27500;
  state.pMid[1] = 50000;
  state.pMid[2] = 82500;
  state.theta.fill(290);
  state.T.fill(270);
  state.qv.fill(0.002);
  state.qc[0] = 0.0015;
  state.qi[0] = 0.0005;
  state.u.fill(0);
  state.v.fill(0);

  stepVertical5({
    dt: 1800,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvection: false,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false
    }
  });

  stepVertical5({
    dt: 1800,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvection: false,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false
    }
  });

  assert.ok(state.upperCloudPath[0] > 0);
  assert.ok(state.importedAnvilPersistenceMass[0] > 0);
  assert.ok(state.carriedOverUpperCloudMass[0] > 0);
  assert.ok(state.weakErosionCloudSurvivalMass[0] > 0);
  assert.ok(state.carryOverUpperCloudEnteringAccumMass[0] > 0);
  assert.ok(state.carryOverUpperCloudSurvivingAccumMass[0] > 0);
  assert.ok(state.upperCloudResidenceTimeSeconds[0] > 0);
  assert.ok(state.upperCloudTimeSinceImportSeconds[0] > 0);
  assert.ok(state.upperCloudPotentialErosionAccumMass[0] >= state.upperCloudAppliedErosionAccumMass[0]);
  assert.ok(state.upperCloudBlockedErosionAccumMass[0] >= 0);
  assert.ok(Array.from(state.carryOverUpperCloudEnteringByBandMass).some((value) => value > 0));
  assert.ok(Array.from(state.carryOverUpperCloudSurvivingByBandMass).some((value) => value > 0));
});

test('computeAtlanticDryCoreReceiverTaperFrac only activates in the Atlantic ocean dry-core receiver lane', () => {
  const active = computeAtlanticDryCoreReceiverTaperFrac({
    enabled: true,
    latDeg: 26.25,
    lonDeg: -45,
    isLand: false,
    northsideLeakPenaltySignal: 0.064,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 22,
    lat1: 30,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.16
  });
  assert.ok(active > 0);
  assert.ok(active <= 0.16);

  assert.equal(computeAtlanticDryCoreReceiverTaperFrac({
    enabled: false,
    latDeg: 26.25,
    lonDeg: -45,
    isLand: false,
    northsideLeakPenaltySignal: 0.064,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 22,
    lat1: 30,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.16
  }), 0);
  assert.equal(computeAtlanticDryCoreReceiverTaperFrac({
    enabled: true,
    latDeg: 26.25,
    lonDeg: -45,
    isLand: true,
    northsideLeakPenaltySignal: 0.064,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 22,
    lat1: 30,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.16
  }), 0);
  assert.equal(computeAtlanticDryCoreReceiverTaperFrac({
    enabled: true,
    latDeg: 26.25,
    lonDeg: -120,
    isLand: false,
    northsideLeakPenaltySignal: 0.064,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 22,
    lat1: 30,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.16
  }), 0);
  assert.equal(computeAtlanticDryCoreReceiverTaperFrac({
    enabled: true,
    latDeg: -26.25,
    lonDeg: -45,
    isLand: false,
    northsideLeakPenaltySignal: 0.064,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 22,
    lat1: 30,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.16
  }), 0);
});

test('computeAtlanticTransitionCarryoverContainmentFrac only activates in the Atlantic ocean transition lane when the receiver bundle is active', () => {
  const active = computeAtlanticTransitionCarryoverContainmentFrac({
    enabled: true,
    receiverPatchEnabled: true,
    latDeg: 18.75,
    lonDeg: -45,
    isLand: false,
    carrierSignal: 0.064,
    overlapMass: 0.16,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 18,
    lat1: 22.5,
    overlap0: 0.08,
    overlap1: 0.18,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.18
  });
  assert.ok(active > 0);
  assert.ok(active <= 0.18);

  assert.equal(computeAtlanticTransitionCarryoverContainmentFrac({
    enabled: false,
    receiverPatchEnabled: true,
    latDeg: 18.75,
    lonDeg: -45,
    isLand: false,
    carrierSignal: 0.064,
    overlapMass: 0.16,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 18,
    lat1: 22.5,
    overlap0: 0.08,
    overlap1: 0.18,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.18
  }), 0);
  assert.equal(computeAtlanticTransitionCarryoverContainmentFrac({
    enabled: true,
    receiverPatchEnabled: false,
    latDeg: 18.75,
    lonDeg: -45,
    isLand: false,
    carrierSignal: 0.064,
    overlapMass: 0.16,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 18,
    lat1: 22.5,
    overlap0: 0.08,
    overlap1: 0.18,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.18
  }), 0);
  assert.equal(computeAtlanticTransitionCarryoverContainmentFrac({
    enabled: true,
    receiverPatchEnabled: true,
    latDeg: 18.75,
    lonDeg: -120,
    isLand: false,
    carrierSignal: 0.064,
    overlapMass: 0.16,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 18,
    lat1: 22.5,
    overlap0: 0.08,
    overlap1: 0.18,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.18
  }), 0);
  assert.equal(computeAtlanticTransitionCarryoverContainmentFrac({
    enabled: true,
    receiverPatchEnabled: true,
    latDeg: 26.25,
    lonDeg: -45,
    isLand: false,
    carrierSignal: 0.064,
    overlapMass: 0.16,
    dryDriver: 0.21,
    existingOmegaPaS: 0.22,
    signal0: 0.04,
    signal1: 0.075,
    lat0: 18,
    lat1: 22.5,
    overlap0: 0.08,
    overlap1: 0.18,
    dry0: 0.12,
    dry1: 0.24,
    omega0: 0.12,
    omega1: 0.26,
    maxFrac: 0.18
  }), 0);
});

test('computeSubtropicalBalanceContract favors columns with both partition and circulation support', () => {
  const active = computeSubtropicalBalanceContract({
    dryDriver: 0.18,
    sourceDriver: 0.22,
    latShape: 0.8,
    descentSupport: 0.72,
    existingOmegaPaS: 0.14,
    crossHemiFloorShare: 0.18,
    weakHemiFloorTaperFrac: 0.08,
    organizedSupport: 0.16,
    convectivePotential: 0.12
  });
  assert.ok(active.partitionSupport > 0);
  assert.ok(active.circulationSupport > 0);
  assert.ok(active.contractSupport > 0);

  const weakCirculation = computeSubtropicalBalanceContract({
    dryDriver: 0.18,
    sourceDriver: 0.22,
    latShape: 0.8,
    descentSupport: 0.05,
    existingOmegaPaS: 0.01,
    crossHemiFloorShare: 0.82,
    weakHemiFloorTaperFrac: 0,
    organizedSupport: 0.72,
    convectivePotential: 0.68
  });
  assert.ok(weakCirculation.partitionSupport > 0);
  assert.ok(weakCirculation.contractSupport < active.contractSupport);
});

test('stepVertical5 populates the upper-cloud handoff ledger for a simple carried-cloud case', () => {
  const sigmaHalf = new Float32Array([0, 0.3, 0.7, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 3,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([26]),
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 35000;
  state.pHalf[2] = 65000;
  state.pHalf[3] = 100000;
  state.pMid[0] = 27500;
  state.pMid[1] = 50000;
  state.pMid[2] = 82500;
  state.theta.fill(290);
  state.T.fill(270);
  state.qv.fill(0.002);
  state.qc[0] = 0.001;

  stepVertical5({
    dt: 1800,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvection: false,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false
    }
  });

  assert.ok(state.verticalUpperCloudInputMass[0] > 0);
  assert.equal(state.verticalUpperCloudResolvedBirthMass[0], 0);
  assert.equal(state.verticalUpperCloudConvectiveBirthMass[0], 0);
  assert.ok(state.verticalUpperCloudHandedToMicrophysicsMass[0] > 0);
  assert.ok(Math.abs(state.verticalUpperCloudResidualMass[0]) < 1e-6);
});

test('stepVertical5 clears a stale subtropical carry-dominant upper-cloud reservoir from the live handoff', () => {
  const sigmaHalf = new Float32Array([0, 0.3, 0.7, 1]);
  const state = createState5({
    grid: { count: 1 },
    nz: 3,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 1,
    latDeg: new Float32Array([26.25]),
    invDx: new Float32Array([1]),
    invDy: new Float32Array([1]),
    cosLat: new Float32Array([1])
  };

  state.ps[0] = 100000;
  state.pHalf[0] = 20000;
  state.pHalf[1] = 35000;
  state.pHalf[2] = 65000;
  state.pHalf[3] = 100000;
  state.pMid[0] = 27500;
  state.pMid[1] = 50000;
  state.pMid[2] = 82500;
  state.theta.fill(290);
  state.T.fill(270);
  state.qv.fill(0.0005);
  state.qc[0] = 0.001;
  state.qc[1] = 0.001;
  state.u.fill(0);
  state.v.fill(0);
  state.omega.fill(0);

  stepVertical5({
    dt: 1800,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvection: true,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false
    }
  });

  assert.ok(state._freshSubtropicalSuppression[0] >= 0.74243);
  assert.ok(state._freshOrganizedSupport[0] <= 0.22504);
  assert.ok(state._freshPotentialTarget[0] <= 0.24341);
  assert.ok(state.verticalUpperCloudInputMass[0] >= 4.40574);
  assert.ok(state.verticalUpperCloudCarrySurvivingMass[0] < 0.1);
  assert.ok(state.verticalUpperCloudHandedToMicrophysicsMass[0] < 0.1);
  assert.ok(state.verticalUpperCloudAppliedErosionMass[0] > 4.4);
});

test('stepVertical5 precomputes a latitude-aware shoulder window and target-entry exclusion', () => {
  const sigmaHalf = new Float32Array([0, 0.35, 0.7, 1]);
  const state = createState5({
    grid: { count: 4 },
    nz: 3,
    sigmaHalf
  });
  const grid = {
    nx: 1,
    ny: 4,
    latDeg: new Float32Array([3.75, 11.25, 26.25, 33.75]),
    invDx: new Float32Array([1, 1, 1, 1]),
    invDy: new Float32Array([1, 1, 1, 1]),
    cosLat: new Float32Array([1, 1, 1, 1])
  };

  for (let cell = 0; cell < 4; cell += 1) {
    state.ps[cell] = 100000;
    state.pHalf[cell] = 20000;
    state.pHalf[4 + cell] = 35000;
    state.pHalf[8 + cell] = 65000;
    state.pHalf[12 + cell] = 100000;
    state.pMid[cell] = 27500;
    state.pMid[4 + cell] = 50000;
    state.pMid[8 + cell] = 82500;
    state.theta[cell] = 286;
    state.theta[4 + cell] = 295;
    state.theta[8 + cell] = 302;
    state.qv[cell] = 0.0012;
    state.qv[4 + cell] = 0.006;
    state.qv[8 + cell] = 0.014;
    state.T[cell] = 246;
    state.T[4 + cell] = 276;
    state.T[8 + cell] = 299;
  }
  state.u.fill(0);
  state.v.fill(0);
  state.omega.fill(0.04);

  stepVertical5({
    dt: 1800,
    grid,
    state,
    params: {
      enableMixing: false,
      enableConvectiveMixing: false,
      enableConvection: true,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false
    }
  });

  assert.ok(state.freshShoulderLatitudeWindowDiag[0] > 0.9);
  assert.ok(state.freshShoulderEquatorialEdgeWindowDiag[0] > 0.9);
  assert.equal(state.freshShoulderInnerWindowDiag[0], 0);
  assert.ok(state.freshShoulderEquatorialEdgeGateSupportDiag[0] >= 0);

  assert.ok(state.freshShoulderLatitudeWindowDiag[1] > 0.9);
  assert.equal(state.freshShoulderEquatorialEdgeWindowDiag[1], 0);
  assert.ok(state.freshShoulderInnerWindowDiag[1] > 0.9);
  assert.ok(state.freshShoulderEquatorialEdgeGateSupportDiag[1] >= 0);

  assert.equal(state.freshShoulderLatitudeWindowDiag[2], 0);
  assert.equal(state.freshShoulderEquatorialEdgeWindowDiag[2], 0);
  assert.equal(state.freshShoulderInnerWindowDiag[2], 0);

  assert.equal(state.freshShoulderLatitudeWindowDiag[3], 0);
  assert.equal(state.freshShoulderEquatorialEdgeWindowDiag[3], 0);
  assert.equal(state.freshShoulderInnerWindowDiag[3], 0);
  assert.equal(state.freshShoulderTargetEntryExclusionDiag[0], 0);
  assert.equal(state.freshShoulderTargetEntryExclusionDiag[1], 0);
  assert.equal(state.freshShoulderTargetEntryExclusionDiag[2], 0);
  assert.ok(state.freshShoulderTargetEntryExclusionDiag[3] > 0.9);
});

test('stepVertical5 circulation rebound containment suppresses a weak off-equatorial transition lane', () => {
  const sigmaHalf = new Float32Array([0, 0.35, 0.7, 1]);
  const buildCase = () => {
    const state = createState5({
      grid: { count: 3 },
      nz: 3,
      sigmaHalf
    });
    const grid = {
      nx: 3,
      ny: 1,
      latDeg: new Float32Array([24]),
      invDx: new Float32Array([1]),
      invDy: new Float32Array([1]),
      cosLat: new Float32Array([1])
    };
    for (let i = 0; i < 3; i += 1) {
      state.ps[i] = 100000;
      state.pHalf[i] = 20000;
      state.pHalf[3 + i] = 35000;
      state.pHalf[6 + i] = 65000;
      state.pHalf[9 + i] = 100000;
      state.pMid[i] = 27500;
      state.pMid[3 + i] = 50000;
      state.pMid[6 + i] = 82500;
      state.theta[i] = 288;
      state.theta[3 + i] = 296;
      state.theta[6 + i] = 304;
      state.qv[i] = 0.0015;
      state.qv[3 + i] = 0.0075;
      state.qv[6 + i] = 0.018;
      state.T[i] = 242;
      state.T[3 + i] = 276;
      state.T[6 + i] = 300;
    }
    state.u.fill(0);
    state.v.fill(0);
    state.u[6] = 1;
    state.u[7] = 0;
    state.u[8] = -1;
    state.convectivePotential[1] = 0.22;
    state.convectiveOrganization[1] = 0.18;
    return { state, grid };
  };

  const offCase = buildCase();
  stepVertical5({
    dt: 1800,
    grid: offCase.grid,
    state: offCase.state,
    params: {
      enableMixing: false,
      enableConvectiveMixing: false,
      enableConvection: true,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false,
      enableCirculationReboundContainment: false
    }
  });

  const onCase = buildCase();
  stepVertical5({
    dt: 1800,
    grid: onCase.grid,
    state: onCase.state,
    params: {
      enableMixing: false,
      enableConvectiveMixing: false,
      enableConvection: true,
      enableOmegaMassFix: false,
      enableLargeScaleVerticalAdvection: false,
      enableCirculationReboundContainment: true
    }
  });

  assert.ok(onCase.state.circulationReboundContainmentDiag[1] > 0.05);
  assert.ok(onCase.state.circulationReboundActivitySuppressionDiag[1] > 0);
  assert.ok(onCase.state.circulationReboundSourceSuppressionDiag[1] > 0);
  assert.ok(onCase.state.circulationReboundRawSourceDiag[1] > 0);
  assert.ok(onCase.state.circulationReboundSuppressedSourceDiag[1] > 0);
  assert.ok(onCase.state.convectiveOrganization[1] < offCase.state.convectiveOrganization[1]);
  assert.ok(onCase.state.convectiveMassFlux[1] <= offCase.state.convectiveMassFlux[1]);
});

test('computeTransitionReturnFlowCouplingFrac is capped and only active when enabled', () => {
  assert.equal(
    computeTransitionReturnFlowCouplingFrac({
      enabled: false,
      returnFlowOpportunity: 0.001,
      opportunity0: 0.0002,
      opportunity1: 0.0012,
      maxFrac: 0.14
    }),
    0
  );
  const active = computeTransitionReturnFlowCouplingFrac({
    enabled: true,
    returnFlowOpportunity: 0.00084,
    opportunity0: 0.0002,
    opportunity1: 0.0012,
    maxFrac: 0.14
  });
  assert.ok(active > 0);
  assert.ok(active <= 0.14);
});

test('computeSubtropicalDescentVentilationPaS fills weak coarse-grid descent only for weak subtropical engines', () => {
  const common = {
    enabled: true,
    sourceDriver: 0.19,
    latShape: 0.95,
    walkerSubsidenceSupport: 0.55,
    convectiveOrganization: 0.02,
    convectivePotential: 0.18,
    existingOmegaPaS: 0.006,
    source0: 0.12,
    source1: 0.22,
    maxPaS: 0.045,
    maxStepPaS: 0.018,
    organizationMax: 0.14,
    potentialMax: 0.38
  };

  const active = computeSubtropicalDescentVentilationPaS(common);
  assert.ok(active > 0);
  assert.ok(active <= common.maxStepPaS);
  assert.equal(computeSubtropicalDescentVentilationPaS({ ...common, enabled: false }), 0);
  assert.equal(computeSubtropicalDescentVentilationPaS({ ...common, existingOmegaPaS: 0.08 }), 0);
  assert.equal(computeSubtropicalDescentVentilationPaS({ ...common, convectiveOrganization: 0.3 }), 0);
});

test('computeHadleyReturnFlowWindTendencyMs only accelerates low-level flow equatorward', () => {
  const common = {
    enabled: true,
    dryDriver: 0.2,
    sourceDriver: 0.2,
    latShape: 0.9,
    descentSupport: 0.8,
    circulationSupport: 0.7,
    returnFlowCouplingFrac: 0.05,
    walkerSubsidenceSupport: 0.6,
    dt: 1800,
    tauSeconds: 6 * 3600,
    maxMs: 3.2,
    maxStepMs: 0.65,
    source0: 0.07,
    source1: 0.22,
    dry0: 0.08,
    dry1: 0.22
  };

  const nh = computeHadleyReturnFlowWindTendencyMs({
    ...common,
    latDeg: 25,
    currentV: 0.8
  });
  const sh = computeHadleyReturnFlowWindTendencyMs({
    ...common,
    latDeg: -25,
    currentV: -0.8
  });

  assert.ok(nh < 0);
  assert.ok(sh > 0);
  assert.ok(Math.abs(nh) <= common.maxStepMs);
  assert.ok(Math.abs(sh) <= common.maxStepMs);
  assert.equal(
    computeHadleyReturnFlowWindTendencyMs({
      ...common,
      latDeg: -25,
      currentV: 4
    }),
    0
  );
});

test('computeDryingOmegaBridgePaS is capped and only active for weak-engine dry-driver cases', () => {
  assert.equal(
    computeDryingOmegaBridgePaS({
      enabled: false,
      dryDriver: 0.14,
      suppressedSource: 0.0012,
      latShape: 0.8,
      organizedSupport: 0.18,
      convectivePotential: 0.22,
      neutralToSubsidingSupport: 0.8,
      existingOmegaPaS: 0.03,
      dry0: 0.08,
      dry1: 0.16,
      suppressedSource0: 0.0007,
      suppressedSource1: 0.0016,
      maxPaS: 0.018
    }),
    0
  );

  const active = computeDryingOmegaBridgePaS({
    enabled: true,
    dryDriver: 0.14,
    suppressedSource: 0.0012,
    latShape: 0.8,
    organizedSupport: 0.18,
    convectivePotential: 0.22,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.03,
    dry0: 0.08,
    dry1: 0.16,
    suppressedSource0: 0.0007,
    suppressedSource1: 0.0016,
    maxPaS: 0.018
  });
  assert.ok(active > 0);
  assert.ok(active <= 0.018);

  const tapered = computeDryingOmegaBridgePaS({
    enabled: true,
    dryDriver: 0.14,
    suppressedSource: 0.0012,
    latShape: 0.8,
    organizedSupport: 0.18,
    convectivePotential: 0.22,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.24,
    dry0: 0.08,
    dry1: 0.16,
    suppressedSource0: 0.0007,
    suppressedSource1: 0.0016,
    maxPaS: 0.018
  });
  assert.ok(tapered < active);
});

test('computeDryingOmegaBridgeSourceSupport favors 20-30N sources and penalizes equatorward leakage', () => {
  assert.equal(
    computeDryingOmegaBridgeSourceSupport({
      enabled: false,
      latAbs: 26.25,
      sourceLat0: 20,
      sourceLat1: 30,
      leakLat0: 18,
      leakLat1: 22
    }),
    0
  );

  const tropicalShoulder = computeDryingOmegaBridgeSourceSupport({
    enabled: true,
    latAbs: 11.25,
    sourceLat0: 20,
    sourceLat1: 30,
    leakLat0: 18,
    leakLat1: 22
  });
  const equatorwardEdge = computeDryingOmegaBridgeSourceSupport({
    enabled: true,
    latAbs: 18.75,
    sourceLat0: 20,
    sourceLat1: 30,
    leakLat0: 18,
    leakLat1: 22
  });
  const sourceCore = computeDryingOmegaBridgeSourceSupport({
    enabled: true,
    latAbs: 26.25,
    sourceLat0: 20,
    sourceLat1: 30,
    leakLat0: 18,
    leakLat1: 22
  });
  const polewardOutside = computeDryingOmegaBridgeSourceSupport({
    enabled: true,
    latAbs: 33.75,
    sourceLat0: 20,
    sourceLat1: 30,
    leakLat0: 18,
    leakLat1: 22
  });

  assert.equal(tropicalShoulder, 0);
  assert.ok(equatorwardEdge < sourceCore);
  assert.ok(sourceCore > 0.5);
  assert.ok(polewardOutside < 0.1);
});

test('computeDryingOmegaBridgeTargetWeight focuses on weak-engine 30-45N targets', () => {
  assert.equal(
    computeDryingOmegaBridgeTargetWeight({
      enabled: false,
      latAbs: 33.75,
      targetLat0: 30,
      targetLat1: 45,
      organizedSupport: 0.18,
      convectivePotential: 0.22,
      neutralToSubsidingSupport: 0.85,
      existingOmegaPaS: 0.04
    }),
    0
  );

  const targetCore = computeDryingOmegaBridgeTargetWeight({
    enabled: true,
    latAbs: 33.75,
    targetLat0: 30,
    targetLat1: 45,
    organizedSupport: 0.18,
    convectivePotential: 0.22,
    neutralToSubsidingSupport: 0.85,
    existingOmegaPaS: 0.04
  });
  const strongEngine = computeDryingOmegaBridgeTargetWeight({
    enabled: true,
    latAbs: 33.75,
    targetLat0: 30,
    targetLat1: 45,
    organizedSupport: 0.82,
    convectivePotential: 0.78,
    neutralToSubsidingSupport: 0.85,
    existingOmegaPaS: 0.04
  });
  const outsideTarget = computeDryingOmegaBridgeTargetWeight({
    enabled: true,
    latAbs: 18.75,
    targetLat0: 30,
    targetLat1: 45,
    organizedSupport: 0.18,
    convectivePotential: 0.22,
    neutralToSubsidingSupport: 0.85,
    existingOmegaPaS: 0.04
  });

  assert.ok(targetCore > 0.3);
  assert.ok(strongEngine < targetCore);
  assert.equal(outsideTarget, 0);
});

test('computeEquatorialEdgeSubsidenceGuardSourceSupport favors inner-shoulder source rows with descent', () => {
  assert.equal(
    computeEquatorialEdgeSubsidenceGuardSourceSupport({
      enabled: false,
      latAbs: 11.25,
      sourceLat0: 8,
      sourceLat1: 14,
      sourceWindow: 1,
      subtropicalBand: 0.7,
      neutralToSubsidingSupport: 0.8,
      existingOmegaPaS: 0.16
    }),
    0
  );

  const sourceCore = computeEquatorialEdgeSubsidenceGuardSourceSupport({
    enabled: true,
    latAbs: 11.25,
    sourceLat0: 8,
    sourceLat1: 14,
    sourceWindow: 1,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });
  const noSourceWindow = computeEquatorialEdgeSubsidenceGuardSourceSupport({
    enabled: true,
    latAbs: 11.25,
    sourceLat0: 8,
    sourceLat1: 14,
    sourceWindow: 0,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });
  const outsideSource = computeEquatorialEdgeSubsidenceGuardSourceSupport({
    enabled: true,
    latAbs: 18.75,
    sourceLat0: 8,
    sourceLat1: 14,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });

  assert.ok(sourceCore > 0.5);
  assert.equal(noSourceWindow, 0);
  assert.ok(outsideSource < 0.1);
});

test('computeEquatorialEdgeSubsidenceGuardTargetWeight focuses on weakly supported 3-6 degree edge lanes', () => {
  assert.equal(
    computeEquatorialEdgeSubsidenceGuardTargetWeight({
      enabled: false,
      latAbs: 3.75,
      targetLat0: 2,
      targetLat1: 6,
      targetWindow: 1,
      edgeGateSupport: 0,
      organizedSupport: 0.25,
      convectivePotential: 0.3,
      existingOmegaPaS: 0.1
    }),
    0
  );

  const targetEdge = computeEquatorialEdgeSubsidenceGuardTargetWeight({
    enabled: true,
    latAbs: 3.75,
    targetLat0: 2,
    targetLat1: 6,
    targetWindow: 1,
    edgeGateSupport: 0,
    organizedSupport: 0.25,
    convectivePotential: 0.3,
    existingOmegaPaS: 0.1
  });
  const supportedEdge = computeEquatorialEdgeSubsidenceGuardTargetWeight({
    enabled: true,
    latAbs: 3.75,
    targetLat0: 2,
    targetLat1: 6,
    targetWindow: 1,
    edgeGateSupport: 0.9,
    organizedSupport: 0.25,
    convectivePotential: 0.3,
    existingOmegaPaS: 0.1
  });
  const outsideTarget = computeEquatorialEdgeSubsidenceGuardTargetWeight({
    enabled: true,
    latAbs: 11.25,
    targetLat0: 2,
    targetLat1: 6,
    targetWindow: 0,
    edgeGateSupport: 0,
    organizedSupport: 0.25,
    convectivePotential: 0.3,
    existingOmegaPaS: 0.1
  });

  assert.ok(targetEdge > 0.4);
  assert.ok(supportedEdge < targetEdge);
  assert.equal(outsideTarget, 0);
});

test('computeEquatorialEdgeNorthsideLeakPenaltyFrac only trims NH source rows with live fanout risk', () => {
  assert.equal(
    computeEquatorialEdgeNorthsideLeakPenaltyFrac({
      enabled: false,
      sourceWindow: 0.45833,
      admissionRisk: 0.3689,
      risk0: 0.32,
      risk1: 0.5,
      maxFrac: 0.28
    }),
    0
  );

  const sourceCore = computeEquatorialEdgeNorthsideLeakPenaltyFrac({
    enabled: true,
    sourceWindow: 0.45833,
    admissionRisk: 0.3689,
    risk0: 0.32,
    risk1: 0.5,
    maxFrac: 0.28
  });
  const southMirror = computeEquatorialEdgeNorthsideLeakPenaltyFrac({
    enabled: true,
    sourceWindow: 0,
    admissionRisk: 0.3689,
    risk0: 0.32,
    risk1: 0.5,
    maxFrac: 0.28
  });
  const outsideLane = computeEquatorialEdgeNorthsideLeakPenaltyFrac({
    enabled: true,
    sourceWindow: 0,
    admissionRisk: 0.2,
    risk0: 0.32,
    risk1: 0.5,
    maxFrac: 0.28
  });

  assert.ok(sourceCore > 0.015);
  assert.equal(southMirror, 0);
  assert.equal(outsideLane, 0);
});

test('computeEquatorialEdgeNorthsideLeakSourceWindowFrac only admits the NH source lane geometry', () => {
  const northCore = computeEquatorialEdgeNorthsideLeakSourceWindowFrac({
    enabled: true,
    latDeg: 11.25,
    lat0: 9,
    lat1: 13
  });
  const southMirror = computeEquatorialEdgeNorthsideLeakSourceWindowFrac({
    enabled: true,
    latDeg: -11.25,
    lat0: 9,
    lat1: 13
  });
  const outsideLane = computeEquatorialEdgeNorthsideLeakSourceWindowFrac({
    enabled: true,
    latDeg: 18.75,
    lat0: 9,
    lat1: 13
  });

  assert.equal(northCore, 1);
  assert.equal(southMirror, 0);
  assert.equal(outsideLane, 0);
});

test('computeEquatorialEdgeNorthsideLeakRiskFrac stays below threshold when live subtropical support is weak', () => {
  const weakRisk = computeEquatorialEdgeNorthsideLeakRiskFrac({
    enabled: true,
    subtropicalBand: 0.18,
    neutralToSubsidingSupport: 0.12,
    existingOmegaPaS: 0.17
  });
  const strongRisk = computeEquatorialEdgeNorthsideLeakRiskFrac({
    enabled: true,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.17
  });

  assert.ok(weakRisk < 0.55);
  assert.ok(strongRisk > weakRisk);
});

test('computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac normalizes leak risk by the active source subset', () => {
  const normalized = computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac({
    enabled: true,
    sourceWindow: 0.45833,
    fanoutRisk: 0.16908
  });
  const noWindow = computeEquatorialEdgeNorthsideLeakAdmissionRiskFrac({
    enabled: true,
    sourceWindow: 0,
    fanoutRisk: 0.16908
  });

  assert.ok(Math.abs(normalized - 0.3689) < 1e-4);
  assert.equal(noWindow, 0);
});

test('computeWeakHemiCrossHemiFloorTaperFrac only trims weak-hemi cross-hemi overhang when the north leak gate is live', () => {
  assert.equal(
    computeWeakHemiCrossHemiFloorTaperFrac({
      enabled: false,
      meanTropicalSource: 0.10765,
      hemiSource: 0.04689,
      sourceDriverFloor: 0.06244,
      weakHemiFrac: 0.56444,
      crossHemiFloorShare: 0.24904,
      northsideLeakPenaltySignal: 0.06225,
      penalty0: 0.02,
      penalty1: 0.06,
      overhang0: 0.06,
      overhang1: 0.12,
      maxFrac: 0.145
    }),
    0
  );

  const active = computeWeakHemiCrossHemiFloorTaperFrac({
    enabled: true,
    meanTropicalSource: 0.10765,
    hemiSource: 0.04689,
    sourceDriverFloor: 0.06244,
    weakHemiFrac: 0.56444,
    crossHemiFloorShare: 0.24904,
    northsideLeakPenaltySignal: 0.06225,
    penalty0: 0.02,
    penalty1: 0.06,
    overhang0: 0.06,
    overhang1: 0.12,
    maxFrac: 0.145
  });
  const strongHemi = computeWeakHemiCrossHemiFloorTaperFrac({
    enabled: true,
    meanTropicalSource: 0.10765,
    hemiSource: 0.16841,
    sourceDriverFloor: 0.16841,
    weakHemiFrac: 0,
    crossHemiFloorShare: 0,
    northsideLeakPenaltySignal: 0.06225,
    penalty0: 0.02,
    penalty1: 0.06,
    overhang0: 0.06,
    overhang1: 0.12,
    maxFrac: 0.145
  });
  const deadLeakGate = computeWeakHemiCrossHemiFloorTaperFrac({
    enabled: true,
    meanTropicalSource: 0.10765,
    hemiSource: 0.04689,
    sourceDriverFloor: 0.06244,
    weakHemiFrac: 0.56444,
    crossHemiFloorShare: 0.24904,
    northsideLeakPenaltySignal: 0,
    penalty0: 0.02,
    penalty1: 0.06,
    overhang0: 0.06,
    overhang1: 0.12,
    maxFrac: 0.145
  });

  assert.ok(active > 0.14);
  assert.equal(strongHemi, 0);
  assert.equal(deadLeakGate, 0);
});

test('computeNorthSourceConcentrationPenaltyFrac only activates for a live NH source signal', () => {
  assert.equal(
    computeNorthSourceConcentrationPenaltyFrac({
      enabled: false,
      latDeg: 11.25,
      leakPenaltyFrac: 0.06339,
      sourceSupport: 0.13789,
      signal0: 0.035,
      signal1: 0.065,
      support0: 0.08,
      support1: 0.16,
      maxFrac: 0.14
    }),
    0
  );

  const active = computeNorthSourceConcentrationPenaltyFrac({
    enabled: true,
    latDeg: 11.25,
    leakPenaltyFrac: 0.06339,
    sourceSupport: 0.13789,
    signal0: 0.035,
    signal1: 0.065,
    support0: 0.08,
    support1: 0.16,
    maxFrac: 0.14
  });
  const southMirror = computeNorthSourceConcentrationPenaltyFrac({
    enabled: true,
    latDeg: -11.25,
    leakPenaltyFrac: 0.06339,
    sourceSupport: 0.13789,
    signal0: 0.035,
    signal1: 0.065,
    support0: 0.08,
    support1: 0.16,
    maxFrac: 0.14
  });
  const deadSignal = computeNorthSourceConcentrationPenaltyFrac({
    enabled: true,
    latDeg: 11.25,
    leakPenaltyFrac: 0,
    sourceSupport: 0.13789,
    signal0: 0.035,
    signal1: 0.065,
    support0: 0.08,
    support1: 0.16,
    maxFrac: 0.14
  });

  assert.ok(active > 0.08);
  assert.equal(southMirror, 0);
  assert.equal(deadSignal, 0);
});

test('equatorial-edge guard windows are mirrored by absolute latitude rather than NH-only shoulder geometry', () => {
  const sourceNorth = computeEquatorialEdgeSubsidenceGuardSourceSupport({
    enabled: true,
    latAbs: 11.25,
    sourceLat0: 8,
    sourceLat1: 14,
    sourceWindow: 1,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });
  const sourceSouth = computeEquatorialEdgeSubsidenceGuardSourceSupport({
    enabled: true,
    latAbs: 11.25,
    sourceLat0: 8,
    sourceLat1: 14,
    sourceWindow: 1,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });
  const targetNorth = computeEquatorialEdgeSubsidenceGuardTargetWeight({
    enabled: true,
    latAbs: 3.75,
    targetLat0: 2,
    targetLat1: 6,
    targetWindow: 1,
    edgeGateSupport: 0,
    organizedSupport: 0.25,
    convectivePotential: 0.3,
    existingOmegaPaS: 0.1
  });
  const targetSouth = computeEquatorialEdgeSubsidenceGuardTargetWeight({
    enabled: true,
    latAbs: 3.75,
    targetLat0: 2,
    targetLat1: 6,
    targetWindow: 1,
    edgeGateSupport: 0,
    organizedSupport: 0.25,
    convectivePotential: 0.3,
    existingOmegaPaS: 0.1
  });

  assert.equal(sourceNorth, sourceSouth);
  assert.equal(targetNorth, targetSouth);
});

test('computeProjectedOmegaBridgeCellPaS redistributes a capped projected share into live target rows', () => {
  assert.equal(
    computeProjectedOmegaBridgeCellPaS({
      enabled: false,
      budgetPaS: 0.004,
      targetWeight: 0.5,
      totalTargetWeight: 1,
      projectedMaxPaS: 0.006
    }),
    0
  );

  const active = computeProjectedOmegaBridgeCellPaS({
    enabled: true,
    budgetPaS: 0.004,
    targetWeight: 0.5,
    totalTargetWeight: 1,
    projectedMaxPaS: 0.006
  });
  const capped = computeProjectedOmegaBridgeCellPaS({
    enabled: true,
    budgetPaS: 0.02,
    targetWeight: 0.8,
    totalTargetWeight: 1,
    projectedMaxPaS: 0.006
  });

  assert.ok(active > 0);
  assert.equal(active, 0.002);
  assert.equal(capped, 0.006);
});
