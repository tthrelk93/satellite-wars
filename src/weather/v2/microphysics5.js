import { g, Rd, Cp, Lv } from '../constants';

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

export function stepMicrophysics5({ dt, state, params = {} }) {
  if (!state || !Number.isFinite(dt) || dt <= 0) return;
  const {
    p0 = 100000,
    pTop = 20000,
    qc0 = 1e-3,
    qi0 = 6e-4,
    kAuto = 3e-4,
    kAutoIce = 8e-4,
    kAutoColdBoost = 3.0,
    qc0ColdReduce = 0.5,
    autoMaxFrac = 0.25,
    precipEffMicro = 0.8,
    tauFreeze = 5400,
    tauMelt = 5400,
    Tfreeze = 273.15,
    TiceFull = 253.15,
    kFall = 1 / 3600,
    enableFluxSedimentation = true,
    enableIceSedimentation = true,
    kFallIce = 1 / (6 * 3600),
    enableIceMeltToRain = true,
    tauMeltIceToRain = 3600,
    tauEvapCloudMin = 900,
    tauEvapCloudMax = 7200,
    tauEvapRainMin = 900,
    tauEvapRainMax = 28800,
    dThetaMaxMicroPerStep = 1.0,
    dThetaMaxMicroPerStepConv = 2.5,
    rhEvap0 = 0.9,
    rhEvap1 = 0.3,
    tauIceAgg = 12 * 3600,
    iceAggMaxFrac = 0.05,
    precipRateMax = 200,
    // Convective overrides
    enableConvectiveOutcome = false,
    convTauEvapCloudScale = 0.35,
    convKAutoScale = 2.0,
    convPrecipEffBoost = 0.15,
    enable = true
  } = params;
  if (!enable) return;

  const { N, nz, theta, qv, qc, qi, qr, precipRate, precipAccum, pHalf, pMid, T: Tstate } = state;
  if (precipRate) precipRate.fill(0);

  const kappa = Rd / Cp;
  const iceDenom = Math.max(1e-6, Tfreeze - TiceFull);
  const evapDenom = Math.max(1e-6, rhEvap0 - rhEvap1);
  const basePrecipEff = clamp(precipEffMicro, 0, 1);
  const autoMax = Math.max(0, autoMaxFrac);
  const iceAggMax = clamp(iceAggMaxFrac, 0, 1);
  const tauIceAggSafe = Math.max(1e-6, tauIceAgg);

  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    for (let k = 0; k < N; k++) {
      const idx = base + k;
      const p = Math.max(pTop, pMid[idx]);
      const Pi = Math.pow(p / p0, kappa);
      const Tcell = Number.isFinite(Tstate?.[idx]) ? Tstate[idx] : theta[idx] * Pi;
      const qs = saturationMixingRatio(Tcell, p);
      const iceFrac = clamp((Tfreeze - Tcell) / iceDenom, 0, 1);

      const convCol = enableConvectiveOutcome && state.convMask && state.convMask[k] === 1;
      const tauEvapCloudMinEff = convCol ? Math.max(1, tauEvapCloudMin * convTauEvapCloudScale) : tauEvapCloudMin;
      const tauEvapCloudMaxEff = convCol ? Math.max(1, tauEvapCloudMax * convTauEvapCloudScale) : tauEvapCloudMax;
      const kAutoEff = convCol ? kAuto * convKAutoScale : kAuto;
      const precipEff = clamp(basePrecipEff + (convCol ? convPrecipEffBoost : 0), 0, 1);
      const dThetaCapEff = Math.max(0, convCol ? dThetaMaxMicroPerStepConv : dThetaMaxMicroPerStep);

      let qvVal = qv[idx];
      let qcVal = qc[idx];
      let qiVal = qi[idx];
      let qrVal = qr[idx];
      let thetaVal = theta[idx];

      if (qvVal > qs) {
        let dq = qvVal - qs;
        if (dThetaCapEff > 0) {
          const dqThetaCap = (dThetaCapEff * Pi * Cp) / Lv;
          dq = Math.min(dq, dqThetaCap);
        }
        if (dq > 0) {
          qvVal -= dq;
          qcVal += dq;
          thetaVal += (Lv / Cp * dq) / Pi;
        }
      } else if (qvVal < qs && (qcVal > 0 || qiVal > 0)) {
        const RH = clamp(qvVal / Math.max(1e-8, qs), 0, 2);
        const tauEvapCloud = tauEvapCloudMinEff + (tauEvapCloudMaxEff - tauEvapCloudMinEff) * RH;
        const qCond = qcVal + qiVal;
        if (qCond > 0) {
          let dq = Math.min(qCond, (qs - qvVal) * dt / tauEvapCloud);
          if (dThetaCapEff > 0) {
            const dqThetaCap = (dThetaCapEff * Pi * Cp) / Lv;
            dq = Math.min(dq, dqThetaCap);
          }
          if (dq > 0) {
            const frac = dq / qCond;
            qcVal -= qcVal * frac;
            qiVal -= qiVal * frac;
            qvVal += dq;
            thetaVal -= (Lv / Cp * dq) / Pi;
          }
        }
      }

      const qCond = qcVal + qiVal;
      if (qCond > 0) {
        const qiTarget = qCond * iceFrac;
        const qcTarget = qCond - qiTarget;
        const tauPhase = iceFrac >= 0.5 ? tauFreeze : tauMelt;
        const frac = clamp(dt / Math.max(1e-6, tauPhase), 0, 1);
        qcVal += frac * (qcTarget - qcVal);
        qiVal += frac * (qiTarget - qiVal);
      }

      qcVal = Math.max(0, qcVal);
      qiVal = Math.max(0, qiVal);

      if (qcVal > 0) {
        const qc0Eff = qc0 * (1 - qc0ColdReduce * iceFrac);
        const kAutoQcEff = kAutoEff * (1 + kAutoColdBoost * iceFrac) * precipEff;
        const excess = Math.max(0, qcVal - qc0Eff);
        const fracAuto = clamp(kAutoQcEff * dt, 0, autoMax);
        const dq = Math.min(qcVal, fracAuto * excess);
        qcVal -= dq;
        qrVal += dq;
      }

      if (qiVal > 0) {
        const excess = Math.max(0, qiVal - qi0);
        const fracAuto = clamp(kAutoIce * precipEff * dt, 0, autoMax);
        const dq = Math.min(qiVal, fracAuto * excess);
        qiVal -= dq;
        qrVal += dq;
      }

      if (qiVal > 0 && iceAggMax > 0) {
        const fracAgg = clamp((dt / tauIceAggSafe) * precipEff, 0, iceAggMax);
        const dq = qiVal * fracAgg * iceFrac;
        qiVal -= dq;
        qrVal += dq;
      }

      if (qvVal < qs && qrVal > 0) {
        const RH = clamp(qvVal / Math.max(1e-8, qs), 0, 2);
        if (RH < rhEvap0) {
          const dryness = clamp((rhEvap0 - RH) / evapDenom, 0, 1);
          const tauEvapRain = tauEvapRainMin + (tauEvapRainMax - tauEvapRainMin) * RH;
          let dq = Math.min(qrVal, (qs - qvVal) * dt / tauEvapRain);
          dq *= dryness;
          if (dThetaCapEff > 0) {
            const dqThetaCap = (dThetaCapEff * Pi * Cp) / Lv;
            dq = Math.min(dq, dqThetaCap);
          }
          if (dq > 0) {
            qrVal -= dq;
            qvVal += dq;
            thetaVal -= (Lv / Cp * dq) / Pi;
          }
        }
      }

      qv[idx] = qvVal;
      qc[idx] = qcVal;
      qi[idx] = qiVal;
      qr[idx] = qrVal;
      theta[idx] = thetaVal;
    }
  }

  if (enableFluxSedimentation) {
    if (enableIceSedimentation) {
      const fallFracIce = clamp(kFallIce * dt, 0, 1);
      const tauMeltIceSafe = Math.max(1e-6, tauMeltIceToRain);
      for (let lev = nz - 1; lev >= 0; lev--) {
        const base = lev * N;
        const baseHalf = lev * N;
        const baseHalfNext = (lev + 1) * N;
        const baseHalfBelow = (lev + 2) * N;
        for (let k = 0; k < N; k++) {
          const idx = base + k;
          let qiVal = qi[idx];
          if (qiVal <= 0) continue;

          if (enableIceMeltToRain) {
            const p = Math.max(pTop, pMid[idx]);
            const Pi = Math.pow(p / p0, kappa);
            const Tcell = Number.isFinite(Tstate?.[idx]) ? Tstate[idx] : theta[idx] * Pi;
            if (Tcell > Tfreeze) {
              const meltFrac = clamp(dt / tauMeltIceSafe, 0, 1);
              const warmFactor = smoothstep(Tfreeze, Tfreeze + 2, Tcell);
              const dqMelt = qiVal * meltFrac * warmFactor;
              if (dqMelt > 0) {
                qiVal -= dqMelt;
                qr[idx] += dqMelt;
              }
            }
          }

          if (qiVal <= 0 || fallFracIce <= 0) {
            qi[idx] = Math.max(0, qiVal);
            continue;
          }

          const dpLev = pHalf[baseHalfNext + k] - pHalf[baseHalf + k];
          if (dpLev <= 0) {
            qi[idx] = Math.max(0, qiVal);
            continue;
          }
          const mLev = dpLev / g;
          const massOut = qiVal * mLev * fallFracIce;
          qiVal -= massOut / mLev;
          qi[idx] = Math.max(0, qiVal);
          if (massOut <= 0) continue;

          if (lev === nz - 1) {
            if (precipAccum) precipAccum[k] += massOut;
            if (precipRate) precipRate[k] += massOut * (3600 / dt);
          } else {
            const dpBelow = pHalf[baseHalfBelow + k] - pHalf[baseHalfNext + k];
            if (dpBelow > 0) {
              const mBelow = dpBelow / g;
              qi[base + N + k] += massOut / mBelow;
            } else {
              qi[idx] += massOut / mLev;
            }
          }
        }
      }
    }

    const fallFracRain = clamp(kFall * dt, 0, 1);
    if (fallFracRain > 0) {
      for (let lev = nz - 1; lev >= 0; lev--) {
        const base = lev * N;
        const baseHalf = lev * N;
        const baseHalfNext = (lev + 1) * N;
        const baseHalfBelow = (lev + 2) * N;
        for (let k = 0; k < N; k++) {
          const idx = base + k;
          const qrVal = qr[idx];
          if (qrVal <= 0) continue;
          const dpLev = pHalf[baseHalfNext + k] - pHalf[baseHalf + k];
          if (dpLev <= 0) continue;
          const mLev = dpLev / g;
          const massOut = qrVal * mLev * fallFracRain;
          if (massOut <= 0) continue;
          qr[idx] = qrVal - massOut / mLev;
          if (lev === nz - 1) {
            if (precipAccum) precipAccum[k] += massOut;
            if (precipRate) precipRate[k] += massOut * (3600 / dt);
          } else {
            const dpBelow = pHalf[baseHalfBelow + k] - pHalf[baseHalfNext + k];
            if (dpBelow > 0) {
              const mBelow = dpBelow / g;
              qr[base + N + k] += massOut / mBelow;
            } else {
              qr[idx] += massOut / mLev;
            }
          }
        }
      }
    }
  } else if (kFall > 0) {
    const fallFracLegacy = clamp(kFall * dt, 0, 1);
    for (let lev = 0; lev < nz; lev++) {
      const base = lev * N;
      const baseHalf = lev * N;
      const baseHalfNext = (lev + 1) * N;
      for (let k = 0; k < N; k++) {
        const idx = base + k;
        const qrVal = qr[idx];
        if (qrVal <= 0) continue;
        const dp = pHalf[baseHalfNext + k] - pHalf[baseHalf + k];
        if (dp <= 0) continue;
        const mAir = dp / g;
        const dqFall = Math.min(qrVal, qrVal * fallFracLegacy);
        qr[idx] = qrVal - dqFall;
        const massFall = dqFall * mAir;
        if (precipAccum) precipAccum[k] += massFall;
        if (precipRate) precipRate[k] += massFall * (3600 / dt);
      }
    }
  }

  for (let m = 0; m < qv.length; m++) {
    if (qv[m] < 0) qv[m] = 0;
    if (qc[m] < 0) qc[m] = 0;
    if (qi[m] < 0) qi[m] = 0;
    if (qr[m] < 0) qr[m] = 0;
  }

  if (precipRate) {
    for (let k = 0; k < N; k++) {
      if (precipRate[k] > precipRateMax) precipRate[k] = precipRateMax;
      if (precipRate[k] < 0) precipRate[k] = 0;
    }
  }
}
