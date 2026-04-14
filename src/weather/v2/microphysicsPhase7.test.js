import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import { createSigmaHalfLevels } from './verticalGrid.js';
import { computeModelMidPressurePa } from './analysisData.js';
import { stepMicrophysics5 } from './microphysics5.js';

const setupState = (tempK) => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 1 }, nz: 4, sigmaHalf });
  state.ps[0] = 100000;
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  for (let lev = 0; lev <= state.nz; lev += 1) {
    state.pHalf[lev] = 20000 + (state.ps[0] - 20000) * sigmaHalf[lev];
  }
  state.theta.fill(tempK / Math.pow(state.pMid[0] / 100000, 287.05 / 1004));
  state.T.fill(tempK);
  state.qv.fill(0.002);
  return state;
};

test('mixed-phase microphysics can form and precipitate snow in a cold column', () => {
  const state = setupState(263);
  state.qi.fill(0.0012);
  state.qc.fill(0.0005);

  stepMicrophysics5({ dt: 3600, state, params: { enableConvectiveOutcome: false } });

  assert.ok(state.qs.some((v) => v > 0) || state.precipSnowRate[0] > 0);
  assert.ok(state.precipSnowRate[0] >= 0);
  assert.ok(state.precipRate[0] >= state.precipSnowRate[0]);
  for (const arr of [state.qv, state.qc, state.qi, state.qr, state.qs]) {
    for (const value of arr) assert.ok(value >= 0);
  }
});

test('mixed-phase microphysics can melt snow into rain in a warm column', () => {
  const state = setupState(276);
  state.qs.fill(0.0015);

  stepMicrophysics5({ dt: 3600, state, params: { enableConvectiveOutcome: false } });

  assert.ok(state.qr.some((v) => v > 0) || state.precipRainRate[0] > 0);
  assert.ok(state.precipRainRate[0] >= 0);
  for (const arr of [state.qv, state.qc, state.qi, state.qr, state.qs]) {
    for (const value of arr) assert.ok(value >= 0);
  }
});

test('terrain-coupled lee columns evaporate and convert warm rain less when delivery exposure is absent', () => {
  const makeWarmState = () => {
    const state = setupState(279);
    state.qv.fill(0.004);
    state.qc.fill(0);
    state.qr.fill(0);
    const lowBase = (state.nz - 1) * state.N;
    state.qc[lowBase] = 0.0022;
    state.qr[lowBase] = 0.0020;
    state.terrainOmegaSurface = new Float32Array([2.4]);
    state.orographicDeliveryExposureAccum = new Float32Array([0]);
    return state;
  };

  const leeNoDelivery = makeWarmState();
  stepMicrophysics5({ dt: 900, state: leeNoDelivery, params: { enableConvectiveOutcome: false } });

  const leeWithDelivery = makeWarmState();
  leeWithDelivery.orographicDeliveryExposureAccum[0] = 12;
  stepMicrophysics5({ dt: 900, state: leeWithDelivery, params: { enableConvectiveOutcome: false } });

  const lowIdx = (leeNoDelivery.nz - 1) * leeNoDelivery.N;
  const noDeliveryHydrometeors = leeNoDelivery.qc[lowIdx] + leeNoDelivery.qr[lowIdx];
  const protectedHydrometeors = leeWithDelivery.qc[lowIdx] + leeWithDelivery.qr[lowIdx];

  assert.ok(noDeliveryHydrometeors < protectedHydrometeors);
  assert.ok(leeNoDelivery.precipRainRate[0] <= leeWithDelivery.precipRainRate[0]);
  assert.ok(leeNoDelivery.qv[lowIdx] >= leeWithDelivery.qv[lowIdx]);
});

test('microphysics scales convective autoconversion continuously with organized mass flux', () => {
  const weak = setupState(281);
  const strong = setupState(281);
  const lowIdx = (weak.nz - 1) * weak.N;

  for (const state of [weak, strong]) {
    state.qv.fill(0.010);
    state.qc.fill(0);
    state.qr.fill(0);
    state.qc[lowIdx] = 0.0020;
    state.convMask[0] = 0;
    state.convectiveOrganization[0] = 0;
    state.convectiveMassFlux[0] = 0;
  }

  strong.convectiveOrganization[0] = 0.85;
  strong.convectiveMassFlux[0] = 0.02;

  stepMicrophysics5({ dt: 900, state: weak, params: { enableConvectiveOutcome: true } });
  stepMicrophysics5({ dt: 900, state: strong, params: { enableConvectiveOutcome: true } });

  assert.ok(strong.precipRainRate[0] > weak.precipRainRate[0]);
  assert.ok(strong.precipRate[0] >= weak.precipRate[0]);
  assert.ok(strong.qr[lowIdx] >= weak.qr[lowIdx]);
});

test('microphysics records large-scale condensation and re-evaporation diagnostics', () => {
  const state = setupState(279);
  const lowIdx = (state.nz - 1) * state.N;
  state.qv.fill(0.015);
  state.qc.fill(0);
  state.qr.fill(0.0012);
  state.qc[lowIdx] = 0.0016;
  state.omega.fill(-0.2);

  stepMicrophysics5({ dt: 900, state, params: { enableConvectiveOutcome: false } });

  assert.ok(state.largeScaleCondensationSource[0] > 0);
  assert.ok(state.cloudReevaporationMass[0] >= 0);
  assert.ok(state.precipReevaporationMass[0] >= 0);
  assert.ok(state.saturationAdjustmentCloudBirthAccumMass[0] > 0);
  assert.ok(state.saturationAdjustmentEventCount[0] > 0);
  assert.ok(state.saturationAdjustmentSupersaturationMassWeighted[0] > 0);
  assert.ok(state.saturationAdjustmentOmegaMassWeighted[0] > 0);
  assert.ok(Array.from(state.saturationAdjustmentCloudBirthByBandMass).some((value) => value > 0));
});

test('microphysics records weak-engine subtropical maintenance occupancy for marginal marine saturation adjustment', () => {
  const state = setupState(279);
  state.qv.fill(0.002);
  state.qc.fill(0);
  state.qi.fill(0);
  state.qr.fill(0);
  state.qs.fill(0);
  state.landMask[0] = 0;
  state.convectiveOrganization[0] = 0.04;
  state.convectiveMassFlux[0] = 2e-4;
  state.convectiveAnvilSource[0] = 0.02;
  state.subtropicalSubsidenceDrying[0] = 0.09;
  state.omega.fill(-0.03);
  state.qv[1] = 0.011;

  stepMicrophysics5({ dt: 900, state, params: { enableConvectiveOutcome: true } });

  assert.ok(state.largeScaleCondensationSource[0] > 0);
  assert.ok(state.saturationAdjustmentMaintenanceCandidateMass[0] > 0);
  assert.ok(state.saturationAdjustmentMaintenancePotentialSuppressedMass[0] > 0);
  assert.ok(state.saturationAdjustmentMaintenanceCandidateEventCount[0] > 0);
});

test('microphysics does not mark strong organized ascent as maintenance occupancy', () => {
  const state = setupState(279);
  state.qv.fill(0.002);
  state.qc.fill(0);
  state.qi.fill(0);
  state.qr.fill(0);
  state.qs.fill(0);
  state.landMask[0] = 0;
  state.convectiveOrganization[0] = 0.92;
  state.convectiveMassFlux[0] = 0.03;
  state.convectiveAnvilSource[0] = 0.8;
  state.subtropicalSubsidenceDrying[0] = 0.01;
  state.omega.fill(-0.28);
  state.qv[1] = 0.015;

  stepMicrophysics5({ dt: 900, state, params: { enableConvectiveOutcome: true } });

  assert.equal(state.saturationAdjustmentMaintenanceCandidateMass[0], 0);
  assert.equal(state.saturationAdjustmentMaintenancePotentialSuppressedMass[0], 0);
  assert.equal(state.saturationAdjustmentMaintenanceCandidateEventCount[0], 0);
});

test('microphysics redesign surfaces live-state subtropical support when legacy maintenance support stays weak', () => {
  const state = setupState(279);
  state.qv.fill(0.002);
  state.qc.fill(0);
  state.qi.fill(0);
  state.qr.fill(0);
  state.qs.fill(0);
  state.landMask[0] = 0;
  state.convectiveOrganization[0] = 0.04;
  state.convectiveMassFlux[0] = 2e-4;
  state.convectiveAnvilSource[0] = 0.02;
  state.subtropicalSubsidenceDrying[0] = 0.0;
  state.freshSubtropicalSuppressionDiag[0] = 0.46;
  state.freshSubtropicalBandDiag[0] = 0.88;
  state.freshNeutralToSubsidingSupportDiag[0] = 0.24;
  state.freshOrganizedSupportDiag[0] = 0.14;
  state.freshRhMidSupportDiag[0] = 0.58;
  state.omega.fill(-0.03);
  state.qv[1] = 0.011;

  stepMicrophysics5({ dt: 900, state, params: { enableConvectiveOutcome: true } });

  assert.equal(state.saturationAdjustmentMaintenanceCandidateMass[0], 0);
  assert.equal(state.saturationAdjustmentMaintenancePotentialSuppressedMass[0], 0);
  assert.ok(state.saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted[0] > 0);
  assert.ok(state.saturationAdjustmentLiveGateCandidateMass[0] > 0);
  assert.ok(state.saturationAdjustmentLiveGatePotentialSuppressedMass[0] > 0);
  assert.ok(state.saturationAdjustmentLiveGateEventCount[0] > 0);
});

test('microphysics soft live-state gate admits weak-ascent marine events without relying on the strict live gate', () => {
  const state = setupState(279);
  state.qv.fill(0.002);
  state.qc.fill(0);
  state.qi.fill(0);
  state.qr.fill(0);
  state.qs.fill(0);
  state.landMask[0] = 0;
  state.convectiveOrganization[0] = 0.04;
  state.convectiveMassFlux[0] = 2e-4;
  state.convectiveAnvilSource[0] = 0.02;
  state.subtropicalSubsidenceDrying[0] = 0.0;
  state.freshSubtropicalSuppressionDiag[0] = 0.68;
  state.freshSubtropicalBandDiag[0] = 0.86;
  state.freshNeutralToSubsidingSupportDiag[0] = 0.03;
  state.freshOrganizedSupportDiag[0] = 0.2;
  state.freshRhMidSupportDiag[0] = 0.97;
  state.omega.fill(-0.03);
  state.qv[1] = 0.011;

  stepMicrophysics5({ dt: 900, state, params: { enableConvectiveOutcome: true } });

  assert.ok(state.saturationAdjustmentSoftLiveGateCandidateMass[0] > 0);
  assert.ok(state.saturationAdjustmentSoftLiveGatePotentialSuppressedMass[0] > 0);
  assert.ok(state.saturationAdjustmentSoftLiveGateEventCount[0] > 0);
  assert.ok(state.saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted[0] > 0);
  assert.ok(state.saturationAdjustmentSoftLiveGateAscentModulationMassWeighted[0] > 0);
});

test('microphysics soft live-state maintenance patch suppresses selected marine condensation when enabled', () => {
  const makeState = () => {
    const state = setupState(279);
    state.qv.fill(0.002);
    state.qc.fill(0);
    state.qi.fill(0);
    state.qr.fill(0);
    state.qs.fill(0);
    state.landMask[0] = 0;
    state.convectiveOrganization[0] = 0.04;
    state.convectiveMassFlux[0] = 2e-4;
    state.convectiveAnvilSource[0] = 0.02;
    state.subtropicalSubsidenceDrying[0] = 0.0;
    state.freshSubtropicalSuppressionDiag[0] = 0.68;
    state.freshSubtropicalBandDiag[0] = 0.86;
    state.freshNeutralToSubsidingSupportDiag[0] = 0.03;
    state.freshOrganizedSupportDiag[0] = 0.2;
    state.freshRhMidSupportDiag[0] = 0.97;
    state.omega.fill(-0.03);
    state.qv[1] = 0.011;
    return state;
  };

  const patchOff = makeState();
  const patchOn = makeState();

  stepMicrophysics5({
    dt: 900,
    state: patchOff,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: patchOn,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: true
    }
  });

  assert.ok(patchOn.largeScaleCondensationSource[0] < patchOff.largeScaleCondensationSource[0]);
  assert.ok(patchOn.saturationAdjustmentSoftLiveGateAppliedSuppressionMass[0] > 0);
  assert.ok(
    patchOn.saturationAdjustmentSoftLiveGateCandidateMass[0]
      >= patchOn.saturationAdjustmentSoftLiveGateAppliedSuppressionMass[0]
  );
});

test('microphysics populates the upper-cloud handoff ledger and closes the upper-cloud budget', () => {
  const state = setupState(248);
  state.qv.fill(0.006);
  state.qc.fill(0);
  state.qi.fill(0);
  state.qr.fill(0);
  state.qs.fill(0);
  state.qc[0] = 0.0012;
  state.qv[0] = 0.02;
  state.omega.fill(-0.2);

  stepMicrophysics5({ dt: 900, state, params: { enableConvectiveOutcome: false } });

  assert.ok(state.microphysicsUpperCloudInputMass[0] > 0);
  assert.ok(state.microphysicsUpperCloudSaturationBirthMass[0] > 0);
  assert.ok(state.microphysicsUpperCloudOutputMass[0] > 0);
  assert.ok(Math.abs(state.microphysicsUpperCloudResidualMass[0]) < 1e-6);
});
