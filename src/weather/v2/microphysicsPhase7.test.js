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

test('subtropical virga boost evaporates weak-engine dry-belt precipitation', () => {
  const makeDryBeltState = () => {
    const state = setupState(286);
    const lowIdx = (state.nz - 1) * state.N;
    state.qv.fill(0.0025);
    state.qc.fill(0);
    state.qr.fill(0);
    state.qr[lowIdx] = 0.01;
    state.landMask[0] = 0;
    state.subtropicalSubsidenceDrying[0] = 0.09;
    state.convectiveOrganization[0] = 0.02;
    state.convectiveMassFlux[0] = 0.0;
    return state;
  };

  const base = makeDryBeltState();
  const boosted = makeDryBeltState();
  const lowIdx = (base.nz - 1) * base.N;

  stepMicrophysics5({ dt: 300, state: base, params: { enableConvectiveOutcome: true } });
  stepMicrophysics5({
    dt: 300,
    state: boosted,
    params: {
      enableConvectiveOutcome: true,
      subtropicalVirgaEvapBoost: 4.0
    }
  });
  assert.ok(boosted.precipReevaporationMass[0] > base.precipReevaporationMass[0]);
  assert.ok(boosted.qr[lowIdx] < base.qr[lowIdx]);
  assert.ok(boosted.qv[lowIdx] > base.qv[lowIdx]);
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

test('microphysics applies configured convective autoconversion scale in organized rain columns', () => {
  const makeState = () => {
    const state = setupState(281);
    const lowIdx = (state.nz - 1) * state.N;
    state.qv.fill(0.010);
    state.qc.fill(0);
    state.qr.fill(0);
    state.qc[lowIdx] = 0.0020;
    state.convectiveOrganization[0] = 0.85;
    state.convectiveMassFlux[0] = 0.03;
    return state;
  };

  const lowScale = makeState();
  const highScale = makeState();

  stepMicrophysics5({
    dt: 900,
    state: lowScale,
    params: {
      enableConvectiveOutcome: true,
      convKAutoScale: 1.0
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: highScale,
    params: {
      enableConvectiveOutcome: true,
      convKAutoScale: 3.0
    }
  });

  assert.ok(highScale.precipRainRate[0] > lowScale.precipRainRate[0]);
  assert.ok(highScale.qr[(highScale.nz - 1) * highScale.N] > lowScale.qr[(lowScale.nz - 1) * lowScale.N]);
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

test('organized supersaturation can rain out directly instead of storing all excess as cloud', () => {
  const makeState = (organized) => {
    const state = setupState(281);
    state.qv.fill(0.002);
    state.qc.fill(0);
    state.qi.fill(0);
    state.qr.fill(0);
    state.qs.fill(0);
    state.landMask[0] = 0;
    state.convectiveOrganization[0] = organized ? 0.9 : 0.0;
    state.convectiveMassFlux[0] = organized ? 0.03 : 0.0;
    state.convectiveAnvilSource[0] = organized ? 0.8 : 0.0;
    state.omega.fill(organized ? -0.24 : -0.02);
    state.qv[1] = 0.018;
    return state;
  };

  const weak = makeState(false);
  const organized = makeState(true);
  const params = {
    enableConvectiveOutcome: true,
    convectiveSaturationRainoutMaxFrac: 0.7,
    kFallRain: 1 / 900,
    tauEvapRainMin: 3600,
    tauEvapRainMax: 86400
  };

  stepMicrophysics5({ dt: 900, state: weak, params });
  stepMicrophysics5({ dt: 900, state: organized, params });

  const weakPrecipSupport = Array.from(weak.microphysicsCloudToPrecipByBandMass).reduce((sum, value) => sum + value, 0);
  const organizedPrecipSupport = Array.from(organized.microphysicsCloudToPrecipByBandMass).reduce((sum, value) => sum + value, 0);

  assert.ok(organized.saturationAdjustmentRainoutMass[0] > weak.saturationAdjustmentRainoutMass[0]);
  assert.ok(organizedPrecipSupport > weakPrecipSupport);
  assert.ok(Array.from(organized.qr).some((value) => value > 0));
});

test('microphysics splits surface precipitation into convective and stratiform rates', () => {
  const makeState = (organized) => {
    const state = setupState(280);
    const surface = (state.nz - 1) * state.N;
    state.qv.fill(0.004);
    state.qr.fill(0);
    state.qr[surface] = 0.002;
    state.convectiveOrganization[0] = organized ? 0.8 : 0;
    state.convectiveMassFlux[0] = organized ? 0.006 : 0;
    state.convectiveAnvilSource[0] = organized ? 0.5 : 0;
    state.convectiveRainoutFraction[0] = organized ? 0.45 : 0;
    return state;
  };

  const stratiform = makeState(false);
  const convective = makeState(true);

  stepMicrophysics5({ dt: 900, state: stratiform, params: { enableConvectiveOutcome: true, kFallRain: 1 / 900 } });
  stepMicrophysics5({ dt: 900, state: convective, params: { enableConvectiveOutcome: true, kFallRain: 1 / 900 } });

  assert.equal(stratiform.precipConvectiveRate[0], 0);
  assert.ok(stratiform.precipStratiformRate[0] > 0);
  assert.ok(convective.precipConvectiveRate[0] > 0);
  assert.ok(convective.precipConvectiveRate[0] > convective.precipStratiformRate[0]);
  assert.ok(Math.abs(
    convective.precipRate[0] - convective.precipConvectiveRate[0] - convective.precipStratiformRate[0]
  ) < 1e-6);
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

test('microphysics explicit subtropical balance contract can admit a shared-contract marine event without fresh suppression', () => {
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
    state.freshSubtropicalSuppressionDiag[0] = 0.0;
    state.freshSubtropicalBandDiag[0] = 0.0;
    state.freshNeutralToSubsidingSupportDiag[0] = 0.24;
    state.freshOrganizedSupportDiag[0] = 0.14;
    state.freshRhMidSupportDiag[0] = 0.58;
    state.subtropicalBalancePartitionSupportDiag[0] = 0.72;
    state.subtropicalBalanceCirculationSupportDiag[0] = 0.64;
    state.subtropicalBalanceContractSupportDiag[0] = 0.46;
    state.omega.fill(-0.03);
    state.qv[1] = 0.011;
    return state;
  };

  const contractOff = makeState();
  const contractOn = makeState();

  stepMicrophysics5({
    dt: 900,
    state: contractOff,
    params: {
      enableConvectiveOutcome: true,
      enableExplicitSubtropicalBalanceContract: false
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: contractOn,
    params: {
      enableConvectiveOutcome: true,
      enableExplicitSubtropicalBalanceContract: true
    }
  });

  assert.equal(contractOff.saturationAdjustmentLiveGateCandidateMass[0], 0);
  assert.ok(contractOn.saturationAdjustmentLiveGateCandidateMass[0] > 0);
  assert.ok(contractOn.saturationAdjustmentLiveGatePotentialSuppressedMass[0] > 0);
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

test('microphysics soft live-state fate modes either retain, export, or buffer suppressed marine-deck mass', () => {
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

  const retain = makeState();
  const exported = makeState();
  const buffered = makeState();

  stepMicrophysics5({
    dt: 900,
    state: retain,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: true,
      softLiveStateMaintenanceSuppressedMassMode: 'retain'
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: exported,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: true,
      softLiveStateMaintenanceSuppressedMassMode: 'sink_export'
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: buffered,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: true,
      softLiveStateMaintenanceSuppressedMassMode: 'buffered_rainout'
    }
  });

  assert.ok(retain.saturationAdjustmentSoftLiveGateRetainedVaporMass[0] > 0);
  assert.ok(exported.saturationAdjustmentSoftLiveGateSinkExportMass[0] > 0);
  assert.ok(buffered.saturationAdjustmentSoftLiveGateBufferedRainoutMass[0] > 0);
  assert.ok(exported.qv[1] < retain.qv[1]);
  assert.ok(buffered.qv[1] < retain.qv[1]);
  assert.ok(buffered.qr[1] > retain.qr[1] || buffered.qs[1] > retain.qs[1]);
});

test('microphysics can conservatively export soft live-state marine-deck excess toward the tropical rain lane', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const grid = {
    nx: 1,
    ny: 3,
    count: 3,
    latDeg: new Float32Array([3.75, -3.75, -18.75])
  };
  const state = createState5({ grid, nz: 4, sigmaHalf });
  state.ps.fill(100000);
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  for (let lev = 0; lev <= state.nz; lev += 1) {
    for (let k = 0; k < state.N; k += 1) {
      state.pHalf[lev * state.N + k] = 20000 + (state.ps[k] - 20000) * sigmaHalf[lev];
    }
  }
  state.theta.fill(279 / Math.pow(state.pMid[0] / 100000, 287.05 / 1004));
  state.T.fill(279);
  state.qv.fill(0.002);
  state.qc.fill(0);
  state.qi.fill(0);
  state.qr.fill(0);
  state.qs.fill(0);
  state.landMask.fill(0);
  const sourceCell = 2;
  const targetCell = 1;
  const sourceIdx = 1 * state.N + sourceCell;
  const targetIdx = 1 * state.N + targetCell;
  state.qv[sourceIdx] = 0.011;
  state.convectiveOrganization[sourceCell] = 0.04;
  state.convectiveMassFlux[sourceCell] = 2e-4;
  state.convectiveAnvilSource[sourceCell] = 0.02;
  state.freshSubtropicalSuppressionDiag[sourceCell] = 0.68;
  state.freshSubtropicalBandDiag[sourceCell] = 0.86;
  state.freshNeutralToSubsidingSupportDiag[sourceCell] = 0.03;
  state.freshOrganizedSupportDiag[sourceCell] = 0.2;
  state.freshRhMidSupportDiag[sourceCell] = 0.97;
  state.omega.fill(-0.03);

  const layerMassAt = (lev, cell) => (state.pHalf[(lev + 1) * state.N + cell] - state.pHalf[lev * state.N + cell]) / 9.80665;
  const columnWaterMass = (cell) => {
    let mass = state.precipAccum[cell] || 0;
    for (let lev = 0; lev < state.nz; lev += 1) {
      const idx = lev * state.N + cell;
      const mixingRatio = state.qv[idx] + state.qc[idx] + state.qi[idx] + state.qr[idx] + state.qs[idx];
      mass += mixingRatio * layerMassAt(lev, cell);
    }
    return mass;
  };
  const beforeMass = columnWaterMass(sourceCell) + columnWaterMass(targetCell);

  stepMicrophysics5({
    dt: 900,
    grid,
    state,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: true,
      softLiveStateMaintenanceSuppressedMassMode: 'equatorward_export',
      softLiveStateMaintenanceExportTargetAbsLatDeg: 4
    }
  });

  const afterMass = columnWaterMass(sourceCell) + columnWaterMass(targetCell);
  assert.ok(state.saturationAdjustmentSoftLiveGateEquatorwardExportMass[sourceCell] > 0);
  assert.ok(state.qv[sourceIdx] < 0.011);
  assert.ok(state.qv[targetIdx] > 0.002);
  assert.ok(Math.abs(afterMass - beforeMass) < 1e-3);
});

test('microphysics shoulder absorption guard suppresses bridge-silent tropical shoulder condensation when enabled', () => {
  const makeState = () => {
    const state = setupState(279);
    state.qv.fill(0.002);
    state.qc.fill(0);
    state.qi.fill(0);
    state.qr.fill(0);
    state.qs.fill(0);
    state.landMask[0] = 0;
    state.convectiveOrganization[0] = 0.05;
    state.convectiveMassFlux[0] = 2e-4;
    state.convectiveAnvilSource[0] = 0.02;
    state.subtropicalSubsidenceDrying[0] = 0.0;
    state.freshSubtropicalSuppressionDiag[0] = 0.12;
    state.freshSubtropicalBandDiag[0] = 0.18;
    state.freshShoulderLatitudeWindowDiag[0] = 1;
    state.freshShoulderEquatorialEdgeWindowDiag[0] = 1;
    state.freshShoulderInnerWindowDiag[0] = 0;
    state.freshShoulderEquatorialEdgeGateSupportDiag[0] = 0.62;
    state.freshShoulderTargetEntryExclusionDiag[0] = 0;
    state.freshNeutralToSubsidingSupportDiag[0] = 0.62;
    state.freshOrganizedSupportDiag[0] = 0.16;
    state.freshRhMidSupportDiag[0] = 0.9;
    state.dryingOmegaBridgeAppliedDiag[0] = 0;
    state.omega.fill(0.06);
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
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: false
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: patchOn,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true
    }
  });

  assert.ok(patchOn.largeScaleCondensationSource[0] < patchOff.largeScaleCondensationSource[0]);
  assert.ok(patchOn.saturationAdjustmentShoulderGuardAppliedSuppressionMass[0] > 0);
  assert.ok(patchOn.saturationAdjustmentShoulderGuardCandidateMass[0] > 0);
  assert.ok(patchOn.saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted[0] > 0);
  assert.ok(patchOn.saturationAdjustmentShoulderGuardBandWindowMassWeighted[0] > 0);
});

test('microphysics shoulder absorption guard excludes target-entry columns when the latitude-aware exclusion is active', () => {
  const makeState = (targetEntryExclusion) => {
    const state = setupState(279);
    state.qv.fill(0.002);
    state.qc.fill(0);
    state.qi.fill(0);
    state.qr.fill(0);
    state.qs.fill(0);
    state.landMask[0] = 0;
    state.convectiveOrganization[0] = 0.05;
    state.convectiveMassFlux[0] = 2e-4;
    state.convectiveAnvilSource[0] = 0.02;
    state.subtropicalSubsidenceDrying[0] = 0.0;
    state.freshSubtropicalSuppressionDiag[0] = 0.12;
    state.freshSubtropicalBandDiag[0] = 0.18;
    state.freshShoulderLatitudeWindowDiag[0] = 1;
    state.freshShoulderEquatorialEdgeWindowDiag[0] = 1;
    state.freshShoulderInnerWindowDiag[0] = 0;
    state.freshShoulderEquatorialEdgeGateSupportDiag[0] = 0.62;
    state.freshShoulderTargetEntryExclusionDiag[0] = targetEntryExclusion;
    state.freshNeutralToSubsidingSupportDiag[0] = 0.62;
    state.freshOrganizedSupportDiag[0] = 0.16;
    state.freshRhMidSupportDiag[0] = 0.9;
    state.dryingOmegaBridgeAppliedDiag[0] = 0;
    state.omega.fill(0.06);
    state.qv[1] = 0.011;
    return state;
  };

  const shoulderLane = makeState(0);
  const targetEntryLane = makeState(1);

  stepMicrophysics5({
    dt: 900,
    state: shoulderLane,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: targetEntryLane,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true
    }
  });

  assert.ok(shoulderLane.saturationAdjustmentShoulderGuardCandidateMass[0] > 0);
  assert.ok(shoulderLane.saturationAdjustmentShoulderGuardAppliedSuppressionMass[0] > 0);
  assert.equal(targetEntryLane.saturationAdjustmentShoulderGuardCandidateMass[0], 0);
  assert.equal(targetEntryLane.saturationAdjustmentShoulderGuardAppliedSuppressionMass[0], 0);
});

test('microphysics shoulder fate modes either retain, sink, or buffer suppressed mass', () => {
  const makeState = () => {
    const state = setupState(279);
    state.qv.fill(0.002);
    state.qc.fill(0);
    state.qi.fill(0);
    state.qr.fill(0);
    state.qs.fill(0);
    state.landMask[0] = 0;
    state.convectiveOrganization[0] = 0.05;
    state.convectiveMassFlux[0] = 2e-4;
    state.convectiveAnvilSource[0] = 0.02;
    state.subtropicalSubsidenceDrying[0] = 0.0;
    state.freshSubtropicalSuppressionDiag[0] = 0.12;
    state.freshSubtropicalBandDiag[0] = 0.18;
    state.freshShoulderLatitudeWindowDiag[0] = 1;
    state.freshShoulderEquatorialEdgeWindowDiag[0] = 1;
    state.freshShoulderInnerWindowDiag[0] = 0;
    state.freshShoulderEquatorialEdgeGateSupportDiag[0] = 0.62;
    state.freshShoulderTargetEntryExclusionDiag[0] = 0;
    state.freshNeutralToSubsidingSupportDiag[0] = 0.62;
    state.freshOrganizedSupportDiag[0] = 0.16;
    state.freshRhMidSupportDiag[0] = 0.9;
    state.dryingOmegaBridgeAppliedDiag[0] = 0;
    state.omega.fill(0.06);
    state.qv[1] = 0.011;
    return state;
  };

  const retain = makeState();
  const sink = makeState();
  const buffered = makeState();

  stepMicrophysics5({
    dt: 900,
    state: retain,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true,
      shoulderAbsorptionGuardSuppressedMassMode: 'retain'
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: sink,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true,
      shoulderAbsorptionGuardSuppressedMassMode: 'sink_export'
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: buffered,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true,
      shoulderAbsorptionGuardSuppressedMassMode: 'buffered_rainout'
    }
  });

  assert.ok(retain.saturationAdjustmentShoulderGuardRetainedVaporMass[0] > 0);
  assert.ok(sink.saturationAdjustmentShoulderGuardSinkExportMass[0] > 0);
  assert.ok(buffered.saturationAdjustmentShoulderGuardBufferedRainoutMass[0] > 0);
  assert.ok(sink.qv[1] < retain.qv[1]);
  assert.ok(buffered.qv[1] < retain.qv[1]);
  assert.ok(buffered.qr[1] > retain.qr[1] || buffered.qs[1] > retain.qs[1]);
});

test('microphysics split-lane shoulder gate penalizes weak equatorial-edge admission while preserving the inner shoulder', () => {
  const makeState = ({
    freshSubtropicalSuppression,
    freshSubtropicalBand,
    equatorialEdgeWindow,
    innerWindow,
    edgeGateSupport
  }) => {
    const state = setupState(279);
    state.qv.fill(0.002);
    state.qc.fill(0);
    state.qi.fill(0);
    state.qr.fill(0);
    state.qs.fill(0);
    state.landMask[0] = 0;
    state.convectiveOrganization[0] = 0.05;
    state.convectiveMassFlux[0] = 2e-4;
    state.convectiveAnvilSource[0] = 0.02;
    state.subtropicalSubsidenceDrying[0] = 0.0;
    state.freshSubtropicalSuppressionDiag[0] = freshSubtropicalSuppression;
    state.freshSubtropicalBandDiag[0] = freshSubtropicalBand;
    state.freshShoulderLatitudeWindowDiag[0] = Math.max(equatorialEdgeWindow, innerWindow);
    state.freshShoulderEquatorialEdgeWindowDiag[0] = equatorialEdgeWindow;
    state.freshShoulderInnerWindowDiag[0] = innerWindow;
    state.freshShoulderEquatorialEdgeGateSupportDiag[0] = edgeGateSupport;
    state.freshShoulderTargetEntryExclusionDiag[0] = 0;
    state.freshNeutralToSubsidingSupportDiag[0] = 0.62;
    state.freshOrganizedSupportDiag[0] = 0.16;
    state.freshRhMidSupportDiag[0] = 0.9;
    state.dryingOmegaBridgeAppliedDiag[0] = 0;
    state.omega.fill(0.06);
    state.qv[1] = 0.011;
    return state;
  };

  const weakEquatorialEdge = makeState({
    freshSubtropicalSuppression: 0.08,
    freshSubtropicalBand: 0.12,
    equatorialEdgeWindow: 1,
    innerWindow: 0,
    edgeGateSupport: 0
  });
  const innerShoulder = makeState({
    freshSubtropicalSuppression: 0.62,
    freshSubtropicalBand: 0.7,
    equatorialEdgeWindow: 0,
    innerWindow: 1,
    edgeGateSupport: 0
  });

  stepMicrophysics5({
    dt: 900,
    state: weakEquatorialEdge,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true,
      shoulderAbsorptionGuardSuppressedMassMode: 'buffered_rainout'
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: innerShoulder,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true,
      shoulderAbsorptionGuardSuppressedMassMode: 'buffered_rainout'
    }
  });

  assert.equal(weakEquatorialEdge.saturationAdjustmentShoulderGuardCandidateMass[0], 0);
  assert.equal(weakEquatorialEdge.saturationAdjustmentShoulderGuardAppliedSuppressionMass[0], 0);
  assert.equal(weakEquatorialEdge.saturationAdjustmentShoulderGuardBufferedRainoutMass[0], 0);
  assert.ok(innerShoulder.saturationAdjustmentShoulderGuardCandidateMass[0] > 0);
  assert.ok(innerShoulder.saturationAdjustmentShoulderGuardAppliedSuppressionMass[0] > 0);
  assert.ok(innerShoulder.saturationAdjustmentShoulderGuardBufferedRainoutMass[0] > 0);
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
