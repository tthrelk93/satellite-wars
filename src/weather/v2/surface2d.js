import { g, Cp, Lv, Rd } from '../constants.js';
import { classifySurfaceMoistureSource, SURFACE_MOISTURE_SOURCE_TRACERS } from './sourceTracing5.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const P0 = 100000;
const KAPPA = Rd / Cp;

const saturationMixingRatio = (T, p) => {
  const Tuse = clamp(T, 180, 330);
  const Tc = Tuse - 273.15;
  const es = 610.94 * Math.exp((17.625 * Tc) / (Tc + 243.04));
  const esClamped = Math.min(es, 0.95 * p);
  const eps = 0.622;
  const qs = (eps * esClamped) / Math.max(1, p - esClamped);
  return Math.min(qs, 0.2);
};

export function stepSurface2D5({ dt, grid, state, climo, geo, params = {} }) {
  if (!grid || !state || !Number.isFinite(dt) || dt <= 0) return;
  const {
    enable = true,
    rhoAir = 1.2,
    CpAir = Cp,
    Lv: LvAir = Lv,
    Ce = 1.2e-3,
    Ch = 1.0e-3,
    windFloor = 1.0,
    oceanTauTs = 10 * 86400,
    landTauTsDry = 2 * 86400,
    landTauTsWet = 6 * 86400,
    TsMin = 200,
    TsMax = 330,
    evapMax = 2e-4,
    soilEvapExponent = 1.0,
    runoffEnabled = true,
    enableLandClimoTs = false,
    landTsUseT2m = true,
    landTsUseLatBaseline = true,
    landRoughnessBoost = 1.6,
    mountainRoughnessCoeff = 6.0,
    terrainSlopeRef = 0.003,
    terrainEvapBoost = 0.2,
    lapseRateKPerM = 0.0065,
    mixedLayerDepthM = 30,
    rhoWater = 1025,
    CpWater = 3990,
    oceanRestoreTau = 120 * 86400,
    freezeTempK = 271.35,
    seaIceThicknessFullM = 1.5,
    seaIceSurfaceOffsetK = 6,
    seaIceRoughnessBoost = 0.4,
    seaIceEvapSuppression = 0.95,
    rhoIce = 917,
    latentFusion = 3.34e5,
    enableThetaClosure = true,
    maxSurfaceAirTempApproachFracPerStep = 0.5,
    maxSurfaceAirTempDeltaPerStepK = 25
  } = params;
  if (!enable) return;

  const { N, nz, theta, T, u, v, qv, Ts, soilW, soilCap, landMask, sstNow, seaIceFrac, seaIceThicknessM, surfaceRadiativeFlux, precipRate, pHalf, pMid, surfaceEvapRate, surfaceLatentFlux, surfaceSensibleFlux, surfaceEvapPotentialRate, surfaceEvapTransferCoeff, surfaceEvapWindSpeed, surfaceEvapHumidityGradient, surfaceEvapSurfaceTemp, surfaceEvapAirTemp, surfaceEvapSoilGate, surfaceEvapRunoffLossRate, surfaceEvapSeaIceSuppression, surfaceEvapSurfaceSaturationMixingRatio, surfaceEvapAirMixingRatio } = state;
  const { nx, ny, latDeg, invDx, invDy } = grid;
  const sourceTracerByKey = Object.fromEntries(
    SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key, field }) => [key, state[field]])
  );
  const traceEnabled = state.instrumentationEnabled !== false;
  const elevField = geo?.elev && geo.elev.length === N ? geo.elev : null;
  const levS = nz - 1;
  const t2mNow = enableLandClimoTs && landTsUseT2m && climo?.hasT2m && climo?.t2mNow?.length === N
    ? climo.t2mNow
    : null;
  const thetaBase = 285;
  const thetaEquatorBoost = 12;
  const thetaPoleDrop = 22;

  for (let k = 0; k < N; k++) {
    const land = landMask[k] === 1;
    if (land) {
      if (seaIceFrac) seaIceFrac[k] = 0;
      if (seaIceThicknessM) seaIceThicknessM[k] = 0;
    }
    let TsVal = Ts[k];
    const sstClimo = climo?.sstNow?.[k] ?? sstNow[k];
    let sst = sstNow[k];
    let iceFrac = seaIceFrac ? clamp01(seaIceFrac[k]) : 0;
    let iceThickness = seaIceThicknessM ? Math.max(0, seaIceThicknessM[k]) : 0;
    const idxS = levS * N + k;
    const qvAir = qv[idxS];
    const uS = u[idxS];
    const vS = v[idxS];
    const row = Math.floor(k / nx);
    const col = k - row * nx;
    const jN = Math.max(0, row - 1);
    const jS = Math.min(ny - 1, row + 1);
    const iE = (col + 1) % nx;
    const iW = (col - 1 + nx) % nx;
    const slopeX = elevField
      ? (elevField[row * nx + iE] - elevField[row * nx + iW]) * 0.5 * invDx[row]
      : 0;
    const slopeY = elevField
      ? (elevField[jN * nx + col] - elevField[jS * nx + col]) * 0.5 * invDy[row]
      : 0;
    const slopeMag = Math.hypot(slopeX, slopeY);
    const terrainFactor = clamp(slopeMag / Math.max(1e-6, terrainSlopeRef), 0, 2.5);
    const oceanIceRoughness = land ? 1 : (1 + seaIceRoughnessBoost * iceFrac);
    const roughness = (land ? landRoughnessBoost : oceanIceRoughness) * (1 + mountainRoughnessCoeff * terrainFactor);
    const CeLocal = Ce * roughness;
    const ChLocal = Ch * roughness;
    const U = Math.max(windFloor, Math.hypot(uS, vS));
    const pSurf = pMid[idxS];
    const PiS = Math.pow(Math.max(1e-6, pSurf) / P0, KAPPA);
    const airTempK = theta[idxS] * PiS;
    const qsTs = saturationMixingRatio(TsVal, pSurf);
    const dq = Math.max(0, qsTs - qvAir);
    const seaIceSuppressionFactor = land ? 1 : (1 - seaIceEvapSuppression * iceFrac);
    const potentialE = rhoAir * CeLocal * U * dq;
    let E = potentialE;
    if (!land) {
      E *= seaIceSuppressionFactor;
    }
    if (E > evapMax) E = evapMax;

    let soilGate = 1;
    if (land) {
      const cap = Math.max(1e-6, soilCap[k]);
      const avail = clamp01(soilW[k] / cap);
      soilGate = Math.pow(avail, soilEvapExponent) * (1 + terrainEvapBoost * terrainFactor);
      E *= soilGate;
    }

    const H = rhoAir * CpAir * ChLocal * U * (TsVal - airTempK);
    if (surfaceEvapRate) surfaceEvapRate[k] = E * 3600;
    if (surfaceLatentFlux) surfaceLatentFlux[k] = LvAir * E;
    if (surfaceSensibleFlux) surfaceSensibleFlux[k] = H;
    if (surfaceEvapPotentialRate) surfaceEvapPotentialRate[k] = potentialE * 3600;
    if (surfaceEvapTransferCoeff) surfaceEvapTransferCoeff[k] = CeLocal;
    if (surfaceEvapWindSpeed) surfaceEvapWindSpeed[k] = U;
    if (surfaceEvapHumidityGradient) surfaceEvapHumidityGradient[k] = dq;
    if (surfaceEvapSurfaceTemp) surfaceEvapSurfaceTemp[k] = TsVal;
    if (surfaceEvapAirTemp) surfaceEvapAirTemp[k] = airTempK;
    if (surfaceEvapSoilGate) surfaceEvapSoilGate[k] = soilGate;
    if (surfaceEvapSeaIceSuppression) surfaceEvapSeaIceSuppression[k] = seaIceSuppressionFactor;
    if (surfaceEvapSurfaceSaturationMixingRatio) surfaceEvapSurfaceSaturationMixingRatio[k] = qsTs;
    if (surfaceEvapAirMixingRatio) surfaceEvapAirMixingRatio[k] = qvAir;
    if (surfaceEvapRunoffLossRate) surfaceEvapRunoffLossRate[k] = 0;

    if (!land) {
      const skinTarget = iceFrac > 0
        ? freezeTempK - seaIceSurfaceOffsetK * iceFrac
        : sst;
      TsVal += (skinTarget - TsVal) * (dt / oceanTauTs);
    } else {
      let TsTargetLand = 288;
      // R9-γ-2 fix: track whether the target is already surface-standardized
      // (ERA5 t2m is measured at actual terrain elevation) or a sea-level
      // baseline that still needs lapse correction. Applying the lapse
      // correction to an already-surface-standardized t2m was a double
      // correction, leaving elevated land 1–7 K too cold (most visible in
      // the NH subtropical dry-belt bias).
      let targetIsSurfaceStandardized = false;
      if (enableLandClimoTs) {
        if (t2mNow && t2mNow.length === N) {
          TsTargetLand = t2mNow[k];
          targetIsSurfaceStandardized = true;
        } else if (landTsUseLatBaseline && latDeg) {
          const latAbs = Math.abs(latDeg[row]);
          const humidLat = smoothstep(60, 0, latAbs);
          const thetaLat = thetaBase + thetaEquatorBoost * humidLat - thetaPoleDrop * (1 - humidLat);
          TsTargetLand = thetaLat - 2;
        }
      }
      if (elevField && !targetIsSurfaceStandardized) {
        TsTargetLand -= lapseRateKPerM * elevField[k];
      }
      const cap = Math.max(1e-6, soilCap[k]);
      const avail = cap > 0 ? clamp01(soilW[k] / cap) : 0;
      const landTauTs = lerp(landTauTsDry, landTauTsWet, avail) * (1 + 0.3 * terrainFactor);
      TsTargetLand = clamp(TsTargetLand, TsMin, TsMax);
      TsVal += (TsTargetLand - TsVal) * (dt / landTauTs);
    }
    TsVal = clamp(TsVal, TsMin, TsMax);
    Ts[k] = TsVal;

    if (!land) {
      const netSurfaceFlux = (surfaceRadiativeFlux ? surfaceRadiativeFlux[k] : 0) - H - LvAir * E;
      const oceanHeatCapacity = Math.max(1e-6, rhoWater * CpWater * mixedLayerDepthM);
      sst += (netSurfaceFlux * dt) / oceanHeatCapacity;
      sst += (sstClimo - sst) * (dt / oceanRestoreTau);

      const freezeEnergyScale = Math.max(1e-6, rhoIce * latentFusion);
      if (iceThickness > 0 && netSurfaceFlux > 0) {
        iceThickness = Math.max(0, iceThickness - (netSurfaceFlux * dt) / freezeEnergyScale);
      }
      if (sst < freezeTempK) {
        const grow = (freezeTempK - sst) * 0.05 + Math.max(0, -netSurfaceFlux) * dt / freezeEnergyScale;
        iceThickness += grow;
        sst = freezeTempK;
      }
      if (iceThickness > 0 && sst > freezeTempK) {
        const melt = (sst - freezeTempK) * 0.1;
        iceThickness = Math.max(0, iceThickness - melt);
        sst = Math.max(freezeTempK, sst);
      }
      iceFrac = clamp01(iceThickness / Math.max(1e-6, seaIceThicknessFullM));
      sstNow[k] = clamp(sst, 260, 310);
      if (seaIceFrac) seaIceFrac[k] = iceFrac;
      if (seaIceThicknessM) seaIceThicknessM[k] = iceThickness;
    }

    const dp0 = pHalf[(levS + 1) * N + k] - pHalf[levS * N + k];
    const m0 = Math.max(1e-6, dp0 / g);
    const dqv = (E * dt) / m0;
    qv[idxS] += dqv;
    if (traceEnabled && dqv > 0) {
      const sourceKey = classifySurfaceMoistureSource({
        latDeg: latDeg[row],
        isLand: land
      });
      const tracer = sourceTracerByKey[sourceKey];
      if (tracer) tracer[idxS] += dqv;
    }
    if (enableThetaClosure) {
      // Close the latent and sensible flux loop at least approximately by applying
      // surface flux tendencies to the lowest-layer potential temperature.
      // In steep, windy terrain cells the bulk exchange closure can otherwise
      // cool or warm the shallow surface layer by hundreds of kelvin in a
      // single step, which is not physically credible and destabilizes audits.
      const sensibleAirTempDelta = (H * dt) / (CpAir * m0);
      const latentAirTempDelta = -(LvAir / CpAir) * dqv;
      const targetApproachDelta = (TsVal - airTempK) * maxSurfaceAirTempApproachFracPerStep;
      const limitedSensibleAirTempDelta = clamp(
        sensibleAirTempDelta,
        Math.min(0, targetApproachDelta),
        Math.max(0, targetApproachDelta)
      );
      const totalAirTempDelta = clamp(
        limitedSensibleAirTempDelta + latentAirTempDelta,
        -maxSurfaceAirTempDeltaPerStepK,
        maxSurfaceAirTempDeltaPerStepK
      );
      theta[idxS] += totalAirTempDelta / Math.max(1e-6, PiS);
    }

    if (land) {
      const P = precipRate ? (precipRate[k] / 3600) : 0;
      const beforeSoil = soilW[k];
      soilW[k] += (P - E) * dt;
      if (soilW[k] < 0) soilW[k] = 0;
      const cap = soilCap[k];
      if (cap > 0 && soilW[k] > cap) {
        const overflow = soilW[k] - cap;
        if (surfaceEvapRunoffLossRate) surfaceEvapRunoffLossRate[k] = Math.max(0, overflow) * 3600 / Math.max(dt, 1e-6);
        if (runoffEnabled) {
          soilW[k] = cap;
        } else {
          soilW[k] = cap;
        }
      }
      if (surfaceEvapRunoffLossRate && soilW[k] <= cap) surfaceEvapRunoffLossRate[k] = 0;
      if (surfaceEvapSoilGate && beforeSoil <= 0 && soilW[k] > 0 && soilEvapExponent !== 1) {
        surfaceEvapSoilGate[k] = soilGate;
      }
    }
  }
}
