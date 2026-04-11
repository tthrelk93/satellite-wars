import { g, Rd, Cp, Lv, Lf } from '../constants.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

const applyThetaLatent = (thetaVal, dq, latentHeat, Pi) => thetaVal + (latentHeat / Cp * dq) / Pi;

export function stepMicrophysics5({ dt, state, params = {} }) {
  if (!state || !Number.isFinite(dt) || dt <= 0) return;
  const {
    p0 = 100000,
    pTop = 20000,
    qc0 = 8e-4,
    qi0 = 4e-4,
    qs0 = 6e-4,
    kAutoRain = 3e-4,
    kAutoSnow = 3e-4,
    kAccreteRain = 2e-4,
    kAccreteSnow = 2e-4,
    autoMaxFrac = 0.25,
    precipEffMicro = 0.85,
    tauFreeze = 5400,
    tauMelt = 5400,
    tauFreezeRain = 3600,
    tauMeltSnow = 3600,
    Tfreeze = 273.15,
    TiceFull = 253.15,
    kFallRain = 1 / 3600,
    kFallSnow = 1 / (3 * 3600),
    tauEvapCloudMin = 900,
    tauEvapCloudMax = 7200,
    tauEvapRainMin = 900,
    tauEvapRainMax = 28800,
    tauSubSnowMin = 1200,
    tauSubSnowMax = 36000,
    dThetaMaxMicroPerStep = 1.0,
    dThetaMaxMicroPerStepConv = 2.5,
    rhEvap0 = 0.9,
    rhEvap1 = 0.3,
    tauIceAgg = 12 * 3600,
    iceAggMaxFrac = 0.08,
    precipRateMax = 200,
    enableConvectiveOutcome = false,
    convTauEvapCloudScale = 0.35,
    convKAutoScale = 2.0,
    convPrecipEffBoost = 0.15,
    terrainLeeOmega0 = 0.15,
    terrainLeeOmega1 = 1.2,
    terrainLeeEvapBoost = 1.0,
    terrainLeeWarmRainSuppress = 0.9,
    terrainDeliveryProtectExposure0 = 0.5,
    terrainDeliveryProtectExposure1 = 8.0,
    enable = true
  } = params;
  if (!enable) return;

  const { N, nz, theta, qv, qc, qi, qr, qs, precipRate, precipRainRate, precipSnowRate, precipAccum, pHalf, pMid, T: Tstate } = state;
  if (precipRate) precipRate.fill(0);
  if (precipRainRate) precipRainRate.fill(0);
  if (precipSnowRate) precipSnowRate.fill(0);

  const kappa = Rd / Cp;
  const iceDenom = Math.max(1e-6, Tfreeze - TiceFull);
  const evapDenom = Math.max(1e-6, rhEvap0 - rhEvap1);
  const basePrecipEff = clamp(precipEffMicro, 0, 1);
  const autoMax = Math.max(0, autoMaxFrac);
  const iceAggMax = clamp(iceAggMaxFrac, 0, 1);
  const tauIceAggSafe = Math.max(1e-6, tauIceAgg);
  const Ls = Lv + Lf;
  const lowLevelStart = Math.max(0, nz - 4);

  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    for (let k = 0; k < N; k++) {
      const idx = base + k;
      const p = Math.max(pTop, pMid[idx]);
      const Pi = Math.pow(p / p0, kappa);
      const Tcell = Number.isFinite(Tstate?.[idx]) ? Tstate[idx] : theta[idx] * Pi;
      const qsat = saturationMixingRatio(Tcell, p);
      const iceFrac = clamp((Tfreeze - Tcell) / iceDenom, 0, 1);
      const warmFrac = 1 - iceFrac;

      const convOrganization = enableConvectiveOutcome && state.convectiveOrganization
        ? state.convectiveOrganization[k]
        : 0;
      const convMassFlux = enableConvectiveOutcome && state.convectiveMassFlux
        ? state.convectiveMassFlux[k]
        : 0;
      const subtropicalDrying = enableConvectiveOutcome && state.subtropicalSubsidenceDrying
        ? state.subtropicalSubsidenceDrying[k]
        : 0;
      const subtropicalDryingStrength = smoothstep(0.01, 0.08, subtropicalDrying);
      const anvilSource = enableConvectiveOutcome && state.convectiveAnvilSource
        ? state.convectiveAnvilSource[k]
        : 0;
      const convMaskBoost = enableConvectiveOutcome && state.convMask && state.convMask[k] === 1 ? 0.15 : 0;
      const convMassFluxStrength = smoothstep(0.002, 0.03, convMassFlux);
      const convStrength = enableConvectiveOutcome
        ? clamp(0.65 * convOrganization + 0.2 * convMassFluxStrength + convMaskBoost, 0, 1)
        : 0;
      const organizedOutflow = enableConvectiveOutcome
        ? clamp(0.55 * convOrganization + 0.2 * convMassFluxStrength + 0.25 * anvilSource, 0, 1)
        : 0;
      const marginalSubsiding = enableConvectiveOutcome
        ? clamp(0.75 * subtropicalDryingStrength + 0.15 * (1 - convOrganization) + 0.1 * (1 - convMassFluxStrength), 0, 1)
        : 0;
      const terrainOmegaSurface = Number.isFinite(state.terrainOmegaSurface?.[k]) ? state.terrainOmegaSurface[k] : 0;
      const deliveryExposure = Number.isFinite(state.orographicDeliveryExposureAccum?.[k])
        ? state.orographicDeliveryExposureAccum[k]
        : 0;
      const leeBase = lev >= lowLevelStart
        ? smoothstep(terrainLeeOmega0, terrainLeeOmega1, terrainOmegaSurface)
        : 0;
      const deliveryProtect = lev >= lowLevelStart
        ? smoothstep(terrainDeliveryProtectExposure0, terrainDeliveryProtectExposure1, deliveryExposure)
        : 0;
      const leeNoDelivery = clamp(leeBase * (1 - deliveryProtect), 0, 1);
      const evapScale = 1 + leeNoDelivery * Math.max(0, terrainLeeEvapBoost);
      const tauEvapCloudScaleEff = enableConvectiveOutcome
        ? clamp(
            1
              + organizedOutflow * Math.max(0, 1 / Math.max(convTauEvapCloudScale, 1e-3) - 1)
              - 0.7 * marginalSubsiding,
            0.35,
            2.5
          )
        : 1;
      const tauEvapCloudMinEffBase = Math.max(1, tauEvapCloudMin * tauEvapCloudScaleEff);
      const tauEvapCloudMaxEffBase = Math.max(1, tauEvapCloudMax * tauEvapCloudScaleEff);
      const tauEvapCloudMinEff = Math.max(1, tauEvapCloudMinEffBase / evapScale);
      const tauEvapCloudMaxEff = Math.max(1, tauEvapCloudMaxEffBase / evapScale);
      const tauEvapRainMinEff = Math.max(1, tauEvapRainMin / evapScale);
      const tauEvapRainMaxEff = Math.max(1, tauEvapRainMax / evapScale);
      const tauSubSnowMinEff = tauSubSnowMin;
      const tauSubSnowMaxEff = tauSubSnowMax;
      const leeWarmRainSuppress = 1 - leeNoDelivery * clamp(terrainLeeWarmRainSuppress, 0, 1);
      const organizedWarmRainSuppress = 1 - 0.2 * organizedOutflow;
      const subtropicalDrizzleSuppress = 1 - 0.68 * marginalSubsiding;
      const warmRainSuppress = clamp(
        leeWarmRainSuppress * organizedWarmRainSuppress * subtropicalDrizzleSuppress,
        0.1,
        1
      );
      const kAutoRainEff = kAutoRain * warmRainSuppress * (1 + 0.25 * convMassFluxStrength);
      const kAutoSnowEff = kAutoSnow * (1 + 0.15 * convMassFluxStrength + 0.15 * organizedOutflow);
      const precipEff = clamp(
        (
          basePrecipEff
          + 0.45 * convPrecipEffBoost * convMassFluxStrength
          + 0.35 * convPrecipEffBoost * organizedOutflow
          - 1.15 * convPrecipEffBoost * marginalSubsiding
          - 0.1 * subtropicalDryingStrength
        ) * warmRainSuppress,
        0.05,
        1
      );
      const dThetaCapEff = Math.max(
        0,
        dThetaMaxMicroPerStep + convStrength * Math.max(0, dThetaMaxMicroPerStepConv - dThetaMaxMicroPerStep)
      );

      let qvVal = qv[idx];
      let qcVal = qc[idx];
      let qiVal = qi[idx];
      let qrVal = qr[idx];
      let qsVal = qs[idx];
      let thetaVal = theta[idx];

      const applyLatentCap = (dq, latentHeat) => {
        if (dThetaCapEff <= 0) return dq;
        const dqThetaCap = (dThetaCapEff * Pi * Cp) / latentHeat;
        return Math.min(dq, dqThetaCap);
      };

      if (qvVal > qsat) {
        let dq = applyLatentCap(qvVal - qsat, iceFrac > 0.5 ? Ls : Lv);
        if (dq > 0) {
          qvVal -= dq;
          if (iceFrac > 0.5) {
            qiVal += dq;
            thetaVal = applyThetaLatent(thetaVal, dq, Ls, Pi);
          } else {
            qcVal += dq;
            thetaVal = applyThetaLatent(thetaVal, dq, Lv, Pi);
          }
        }
      } else if (qvVal < qsat) {
        const RH = clamp(qvVal / Math.max(1e-8, qsat), 0, 2);
        const tauEvapCloud = tauEvapCloudMinEff + (tauEvapCloudMaxEff - tauEvapCloudMinEff) * RH;
        const tauEvapRain = tauEvapRainMinEff + (tauEvapRainMaxEff - tauEvapRainMinEff) * RH;
        const tauSubSnow = tauSubSnowMinEff + (tauSubSnowMaxEff - tauSubSnowMinEff) * RH;
        let deficit = qsat - qvVal;

        const evaporate = (storeVal, tau, latentHeat) => {
          if (storeVal <= 0 || deficit <= 0) return [storeVal, 0];
          let dq = Math.min(storeVal, deficit * dt / Math.max(1e-6, tau));
          dq = applyLatentCap(dq, latentHeat);
          if (dq <= 0) return [storeVal, 0];
          deficit -= dq;
          qvVal += dq;
          thetaVal = applyThetaLatent(thetaVal, -dq, latentHeat, Pi);
          return [storeVal - dq, dq];
        };

        [qcVal] = evaporate(qcVal, tauEvapCloud, Lv);
        [qiVal] = evaporate(qiVal, tauEvapCloud, Ls);
        [qrVal] = evaporate(qrVal, tauEvapRain, Lv);
        [qsVal] = evaporate(qsVal, tauSubSnow, Ls);
      }

      const qCond = qcVal + qiVal;
      if (qCond > 0) {
        const qiTarget = qCond * iceFrac;
        const qcTarget = qCond - qiTarget;
        const tauPhase = iceFrac >= 0.5 ? tauFreeze : tauMelt;
        const frac = clamp(dt / Math.max(1e-6, tauPhase), 0, 1);
        const dQc = frac * (qcTarget - qcVal);
        qcVal += dQc;
        qiVal -= dQc;
        if (dQc < 0) {
          thetaVal = applyThetaLatent(thetaVal, -dQc, Lf, Pi);
        } else if (dQc > 0) {
          thetaVal = applyThetaLatent(thetaVal, -dQc, Lf, Pi);
        }
      }

      if (qrVal > 0 && iceFrac > 0) {
        const freezeFrac = clamp((dt / Math.max(1e-6, tauFreezeRain)) * iceFrac, 0, 0.5);
        const dqFreeze = qrVal * freezeFrac;
        qrVal -= dqFreeze;
        qsVal += dqFreeze;
        thetaVal = applyThetaLatent(thetaVal, dqFreeze, Lf, Pi);
      }
      if (qsVal > 0 && warmFrac > 0) {
        const meltFrac = clamp((dt / Math.max(1e-6, tauMeltSnow)) * warmFrac, 0, 0.5);
        const dqMelt = qsVal * meltFrac;
        qsVal -= dqMelt;
        qrVal += dqMelt;
        thetaVal = applyThetaLatent(thetaVal, -dqMelt, Lf, Pi);
      }

      if (qcVal > 0) {
        const excess = Math.max(0, qcVal - qc0);
        const fracAuto = clamp(kAutoRainEff * dt, 0, autoMax);
        const dqAuto = Math.min(qcVal, fracAuto * excess);
        const dqAccrete = Math.min(qcVal - dqAuto, qcVal * qrVal * kAccreteRain * dt * precipEff);
        qcVal -= dqAuto + dqAccrete;
        qrVal += dqAuto + dqAccrete;
      }

      if (qiVal > 0) {
        const excess = Math.max(0, qiVal - qi0);
        const fracAuto = clamp(kAutoSnowEff * dt, 0, autoMax);
        const dqAuto = Math.min(qiVal, fracAuto * excess);
        const fracAgg = clamp((dt / tauIceAggSafe) * precipEff, 0, iceAggMax);
        const dqAgg = Math.min(qiVal - dqAuto, qiVal * fracAgg);
        qiVal -= dqAuto + dqAgg;
        qsVal += dqAuto + dqAgg;
      }

      if (qcVal > 0 && qsVal > 0 && iceFrac > 0.25) {
        const dqRime = Math.min(qcVal, qcVal * qsVal * kAccreteSnow * dt * precipEff);
        qcVal -= dqRime;
        qsVal += dqRime;
        thetaVal = applyThetaLatent(thetaVal, dqRime, Lf, Pi);
      }

      qv[idx] = Math.max(0, qvVal);
      qc[idx] = Math.max(0, qcVal);
      qi[idx] = Math.max(0, qiVal);
      qr[idx] = Math.max(0, qrVal);
      qs[idx] = Math.max(0, qsVal);
      theta[idx] = thetaVal;
    }
  }

  const sediment = (store, fallRate, rateOut, latentMelt = false) => {
    const fallFrac = clamp(fallRate * dt, 0, 1);
    if (fallFrac <= 0) return;
    for (let lev = nz - 1; lev >= 0; lev--) {
      const base = lev * N;
      const baseHalf = lev * N;
      const baseHalfNext = (lev + 1) * N;
      const baseHalfBelow = (lev + 2) * N;
      for (let k = 0; k < N; k++) {
        const idx = base + k;
        let qVal = store[idx];
        if (qVal <= 0) continue;
        const dpLev = pHalf[baseHalfNext + k] - pHalf[baseHalf + k];
        if (dpLev <= 0) continue;
        const mLev = dpLev / g;
        const massOut = qVal * mLev * fallFrac;
        if (massOut <= 0) continue;
        store[idx] = qVal - massOut / mLev;
        if (lev === nz - 1) {
          if (precipAccum) precipAccum[k] += massOut;
          if (rateOut) rateOut[k] += massOut * (3600 / dt);
          if (precipRate) precipRate[k] += massOut * (3600 / dt);
        } else {
          const dpBelow = pHalf[baseHalfBelow + k] - pHalf[baseHalfNext + k];
          if (dpBelow > 0) {
            const mBelow = dpBelow / g;
            store[base + N + k] += massOut / mBelow;
          } else {
            store[idx] += massOut / mLev;
          }
        }
      }
    }
  };

  sediment(qs, kFallSnow, precipSnowRate);
  sediment(qr, kFallRain, precipRainRate);

  for (let m = 0; m < qv.length; m++) {
    if (qv[m] < 0) qv[m] = 0;
    if (qc[m] < 0) qc[m] = 0;
    if (qi[m] < 0) qi[m] = 0;
    if (qr[m] < 0) qr[m] = 0;
    if (qs[m] < 0) qs[m] = 0;
  }

  if (precipRate) {
    for (let k = 0; k < N; k++) {
      if (precipRate[k] > precipRateMax) precipRate[k] = precipRateMax;
      if (precipRate[k] < 0) precipRate[k] = 0;
      if (precipRainRate && precipRainRate[k] < 0) precipRainRate[k] = 0;
      if (precipSnowRate && precipSnowRate[k] < 0) precipSnowRate[k] = 0;
    }
  }
}
