import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import {
  computeDryingOmegaBridgePaS,
  computeProjectedOmegaBridgeCellPaS,
  computeDryingOmegaBridgeSourceSupport,
  computeDryingOmegaBridgeTargetWeight,
  computeEquatorialEdgeSubsidenceGuardSourceSupport,
  computeEquatorialEdgeSubsidenceGuardTargetWeight,
  computeTransitionReturnFlowCouplingFrac,
  stepVertical5
} from './vertical5.js';

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
  assert.ok(state.resolvedAscentCloudBirthAccumMass[0] > 0);
  assert.ok(Array.from(state.resolvedAscentCloudBirthByBandMass).some((value) => value > 0));
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
      enableLargeScaleVerticalAdvection: true
    }
  });

  assert.ok(state.convectivePotential[0] > 0.1);
  assert.ok(state.convectiveOrganization[0] > 0.01);
  assert.ok(state.convectiveMassFlux[0] > 0);
  assert.ok(state.convectiveRainoutFraction[0] > 0);
  assert.ok(state.convMask[0] === 0 || state.convMask[0] === 1);
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
      innerShoulderWindow: 1,
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
    innerShoulderWindow: 1,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });
  const noInnerLane = computeEquatorialEdgeSubsidenceGuardSourceSupport({
    enabled: true,
    latAbs: 11.25,
    sourceLat0: 8,
    sourceLat1: 14,
    innerShoulderWindow: 0,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });
  const outsideSource = computeEquatorialEdgeSubsidenceGuardSourceSupport({
    enabled: true,
    latAbs: 18.75,
    sourceLat0: 8,
    sourceLat1: 14,
    innerShoulderWindow: 1,
    subtropicalBand: 0.7,
    neutralToSubsidingSupport: 0.8,
    existingOmegaPaS: 0.16
  });

  assert.ok(sourceCore > 0.5);
  assert.equal(noInnerLane, 0);
  assert.ok(outsideSource < 0.1);
});

test('computeEquatorialEdgeSubsidenceGuardTargetWeight focuses on weakly supported 3-6 degree edge lanes', () => {
  assert.equal(
    computeEquatorialEdgeSubsidenceGuardTargetWeight({
      enabled: false,
      latAbs: 3.75,
      targetLat0: 2,
      targetLat1: 6,
      edgeWindow: 1,
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
    edgeWindow: 1,
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
    edgeWindow: 1,
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
    edgeWindow: 0,
    edgeGateSupport: 0,
    organizedSupport: 0.25,
    convectivePotential: 0.3,
    existingOmegaPaS: 0.1
  });

  assert.ok(targetEdge > 0.4);
  assert.ok(supportedEdge < targetEdge);
  assert.equal(outsideTarget, 0);
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
