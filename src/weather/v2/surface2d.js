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
    landTauTsDry = 30 * 86400,
    landTauTsWet = 70 * 86400,
    TsMin = 200,
    TsMax = 330,
    evapMax = 2e-4,
    soilEvapExponent = 1.0,
    soilFieldCapacityFrac = 0.78,
    soilDrainageTau = 45 * 86400,
    runoffEnabled = true,
    enableLandClimoTs = false,
    landTsUseT2m = true,
    landTsUseLatBaseline = true,
    enableLandEnergyBudget = true,
    landHeatCapacityDryJm2K = 1.8e6,
    landHeatCapacityWetJm2K = 3.8e6,
    landHeatCapacityVegetationJm2K = 1.2e6,
    landEnergyMaxTempDeltaPerStepK = 1.2,
    landClimoMaxTempDeltaPerStepK = 0.35,
    vegetationTranspirationBoost = 0.22,
    vegetationSoilMoisture0 = 0.18,
    vegetationSoilMoisture1 = 0.72,
    rainforestCanopyLatCoreDeg = 10,
    rainforestCanopyLatFadeDeg = 22,
    rainforestCanopyAlbedo0 = 0.12,
    rainforestCanopyAlbedo1 = 0.32,
    rainforestCanopyElevation0M = 800,
    rainforestCanopyElevation1M = 2600,
    rainforestHeatCapacityJm2K = 4.2e6,
    rainforestEnergyDampingFrac = 0.45,
    rainforestSoilFieldCapacityFrac = 0.92,
    rainforestDrainageTauMultiplier = 5,
    rainforestRootZoneMoistureFloorFrac = 0.85,
    rainforestRootZoneRechargeTau = 18 * 3600,
    rainforestEvapSoilFloorFrac = 0.72,
    rainforestTranspirationBoost = 0.75,
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
    tropicalOceanEvapBoost = 0,
    tropicalOceanEvapLat0Deg = 8,
    tropicalOceanEvapLat1Deg = 18,
    tropicalOceanEvapSst0K = 296,
    tropicalOceanEvapSst1K = 301,
    rhoIce = 917,
    latentFusion = 3.34e5,
    enableThetaClosure = true,
    maxSurfaceAirTempApproachFracPerStep = 0.5,
    maxSurfaceAirTempDeltaPerStepK = 25,
    surfaceEvapLatentAirCoolingFrac = 1.0
  } = params;
  if (!enable) return;

  const { N, nz, theta, T, u, v, qv, Ts, soilW, soilCap, landMask, sstNow, seaIceFrac, seaIceThicknessM, surfaceRadiativeFlux, precipRate, pHalf, pMid, surfaceEvapAccum, surfaceEvapRate, surfaceLatentFlux, surfaceSensibleFlux, surfaceNetFlux, landEnergyTempTendency, landClimoTempTendency, landHeatCapacity, soilMoistureFraction, vegetationProxy, rainforestCanopySupport, rainforestRootZoneRechargeRate, oceanMixedLayerTempTendency, oceanClimoTempTendency, seaIceThermoTendency, surfaceEvapPotentialRate, surfaceEvapTransferCoeff, surfaceEvapWindSpeed, surfaceEvapHumidityGradient, surfaceEvapSurfaceTemp, surfaceEvapAirTemp, surfaceEvapSoilGate, surfaceEvapRunoffLossRate, surfaceEvapSeaIceSuppression, surfaceEvapSurfaceSaturationMixingRatio, surfaceEvapAirMixingRatio } = state;
  const { nx, ny, latDeg, invDx, invDy } = grid;
  const sourceTracerByKey = Object.fromEntries(
    SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key, field }) => [key, state[field]])
  );
  const traceEnabled = state.instrumentationEnabled !== false;
  const elevField = geo?.elev && geo.elev.length === N ? geo.elev : null;
  const albedoField = geo?.albedo && geo.albedo.length === N ? geo.albedo : null;
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
    const latAbs = latDeg ? Math.abs(latDeg[row]) : 0;
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
    const albedoVal = albedoField ? clamp(albedoField[k], 0.02, 0.85) : (land ? 0.2 : 0.06);
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
      const tropicalWarmWaterSupport = (
        (1 - smoothstep(tropicalOceanEvapLat0Deg, tropicalOceanEvapLat1Deg, latAbs))
        * smoothstep(tropicalOceanEvapSst0K, tropicalOceanEvapSst1K, TsVal)
        * (1 - iceFrac)
      );
      if (tropicalOceanEvapBoost > 0 && tropicalWarmWaterSupport > 0) {
        E *= 1 + Math.max(0, tropicalOceanEvapBoost) * tropicalWarmWaterSupport;
      }
    }
    if (E > evapMax) E = evapMax;

    let soilGate = 1;
    let soilAvail = 0;
    let vegProxy = 0;
    let rainforestSupport = 0;
    if (land) {
      const cap = Math.max(1e-6, soilCap[k]);
      soilAvail = clamp01(soilW[k] / cap);
      const albedoVegetationSupport = 1 - smoothstep(0.24, 0.43, albedoVal);
      const elevationVegetationSupport = 1 - smoothstep(1800, 4300, elevField ? elevField[k] : 0);
      const rainforestLatSupport = 1 - smoothstep(rainforestCanopyLatCoreDeg, rainforestCanopyLatFadeDeg, latAbs);
      const rainforestAlbedoSupport = 1 - smoothstep(rainforestCanopyAlbedo0, rainforestCanopyAlbedo1, albedoVal);
      const rainforestLowlandSupport = 1 - smoothstep(rainforestCanopyElevation0M, rainforestCanopyElevation1M, elevField ? elevField[k] : 0);
      const rainforestHumiditySupport = smoothstep(0.009, 0.017, qvAir);
      const rainforestRainMemorySupport = smoothstep(0.015, 0.08, precipRate ? precipRate[k] : 0);
      const rainforestSoilMemorySupport = smoothstep(0.25, 0.55, soilAvail);
      rainforestSupport = clamp01(
        rainforestLatSupport
          * rainforestAlbedoSupport
          * rainforestLowlandSupport
          * (0.55 + 0.25 * rainforestHumiditySupport + 0.2 * Math.max(rainforestRainMemorySupport, rainforestSoilMemorySupport))
      );
      const evapSoilAvail = Math.max(soilAvail, clamp01(rainforestEvapSoilFloorFrac) * rainforestSupport);
      vegProxy = smoothstep(vegetationSoilMoisture0, vegetationSoilMoisture1, soilAvail)
        * albedoVegetationSupport
        * elevationVegetationSupport;
      vegProxy = Math.max(
        vegProxy,
        rainforestSupport * smoothstep(0.12, 0.45, evapSoilAvail)
      );
      soilGate = Math.pow(evapSoilAvail, soilEvapExponent) * (1 + terrainEvapBoost * terrainFactor);
      E *= soilGate;
      if (vegetationTranspirationBoost > 0 && vegProxy > 0) {
        E *= 1 + Math.max(0, vegetationTranspirationBoost) * vegProxy;
      }
      if (rainforestTranspirationBoost > 0 && rainforestSupport > 0) {
        E *= 1 + Math.max(0, rainforestTranspirationBoost) * rainforestSupport;
      }
    }

    const H = rhoAir * CpAir * ChLocal * U * (TsVal - airTempK);
    const netFlux = (surfaceRadiativeFlux ? surfaceRadiativeFlux[k] : 0) - H - LvAir * E;
    if (surfaceEvapRate) surfaceEvapRate[k] = E * 3600;
    if (surfaceLatentFlux) surfaceLatentFlux[k] = LvAir * E;
    if (surfaceSensibleFlux) surfaceSensibleFlux[k] = H;
    if (surfaceNetFlux) surfaceNetFlux[k] = netFlux;
    if (landEnergyTempTendency) landEnergyTempTendency[k] = 0;
    if (landClimoTempTendency) landClimoTempTendency[k] = 0;
    if (landHeatCapacity) landHeatCapacity[k] = 0;
    if (soilMoistureFraction) soilMoistureFraction[k] = land ? soilAvail : 0;
    if (vegetationProxy) vegetationProxy[k] = land ? vegProxy : 0;
    if (rainforestCanopySupport) rainforestCanopySupport[k] = land ? rainforestSupport : 0;
    if (rainforestRootZoneRechargeRate) rainforestRootZoneRechargeRate[k] = 0;
    if (oceanMixedLayerTempTendency) oceanMixedLayerTempTendency[k] = 0;
    if (oceanClimoTempTendency) oceanClimoTempTendency[k] = 0;
    if (seaIceThermoTendency) seaIceThermoTendency[k] = 0;
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
      const landTauTs = lerp(landTauTsDry, landTauTsWet, soilAvail) * (1 + 0.3 * terrainFactor);
      TsTargetLand = clamp(TsTargetLand, TsMin, TsMax);
      const heatCapacity = Math.max(
        1e5,
        landHeatCapacityDryJm2K
          + landHeatCapacityWetJm2K * soilAvail
          + landHeatCapacityVegetationJm2K * vegProxy
          + rainforestHeatCapacityJm2K * rainforestSupport
      );
      const energyLimit = Math.max(
        0,
        landEnergyMaxTempDeltaPerStepK * (1 - clamp01(rainforestEnergyDampingFrac) * rainforestSupport)
      );
      const energyDelta = enableLandEnergyBudget
        ? clamp(
          (netFlux * dt) / heatCapacity,
          -energyLimit,
          energyLimit
        )
        : 0;
      const climoDelta = enableLandClimoTs
        ? clamp(
          (TsTargetLand - TsVal) * (dt / landTauTs),
          -Math.max(0, landClimoMaxTempDeltaPerStepK),
          Math.max(0, landClimoMaxTempDeltaPerStepK)
        )
        : 0;
      TsVal += energyDelta + climoDelta;
      if (landEnergyTempTendency) landEnergyTempTendency[k] = energyDelta;
      if (landClimoTempTendency) landClimoTempTendency[k] = climoDelta;
      if (landHeatCapacity) landHeatCapacity[k] = heatCapacity;
    }
    TsVal = clamp(TsVal, TsMin, TsMax);
    Ts[k] = TsVal;

    if (!land) {
      const oceanHeatCapacity = Math.max(1e-6, rhoWater * CpWater * mixedLayerDepthM);
      const mixedLayerDelta = (netFlux * dt) / oceanHeatCapacity;
      sst += mixedLayerDelta;
      const oceanRestoreDelta = (sstClimo - sst) * (dt / oceanRestoreTau);
      sst += oceanRestoreDelta;
      if (oceanMixedLayerTempTendency) oceanMixedLayerTempTendency[k] = mixedLayerDelta;
      if (oceanClimoTempTendency) oceanClimoTempTendency[k] = oceanRestoreDelta;

      const freezeEnergyScale = Math.max(1e-6, rhoIce * latentFusion);
      if (iceThickness > 0 && netFlux > 0) {
        const melt = (netFlux * dt) / freezeEnergyScale;
        iceThickness = Math.max(0, iceThickness - melt);
        if (seaIceThermoTendency) seaIceThermoTendency[k] -= melt;
      }
      if (sst < freezeTempK) {
        const grow = (freezeTempK - sst) * 0.05 + Math.max(0, -netFlux) * dt / freezeEnergyScale;
        iceThickness += grow;
        if (seaIceThermoTendency) seaIceThermoTendency[k] += grow;
        sst = freezeTempK;
      }
      if (iceThickness > 0 && sst > freezeTempK) {
        const melt = (sst - freezeTempK) * 0.1;
        iceThickness = Math.max(0, iceThickness - melt);
        if (seaIceThermoTendency) seaIceThermoTendency[k] -= melt;
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
    if (surfaceEvapAccum) surfaceEvapAccum[k] += E * dt;
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
      const latentAirTempDelta = -clamp01(surfaceEvapLatentAirCoolingFrac) * (LvAir / CpAir) * dqv;
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
      if (cap > 0 && soilDrainageTau > 0) {
        const fieldCapacityFrac = lerp(
          clamp01(soilFieldCapacityFrac),
          clamp01(rainforestSoilFieldCapacityFrac),
          rainforestSupport
        );
        const fieldCapacity = fieldCapacityFrac * cap;
        if (soilW[k] > fieldCapacity) {
          const drainageTau = soilDrainageTau * (
            1 + Math.max(0, rainforestDrainageTauMultiplier - 1) * rainforestSupport
          );
          const drainage = (soilW[k] - fieldCapacity) * clamp01(dt / drainageTau);
          soilW[k] = Math.max(fieldCapacity, soilW[k] - drainage);
        }
      }
      if (cap > 0 && rainforestSupport > 0 && rainforestRootZoneRechargeTau > 0) {
        const rootZoneFloor = cap * clamp01(rainforestRootZoneMoistureFloorFrac) * rainforestSupport;
        if (soilW[k] < rootZoneFloor) {
          const recharge = (rootZoneFloor - soilW[k]) * clamp01(dt / rainforestRootZoneRechargeTau);
          soilW[k] += recharge;
          if (rainforestRootZoneRechargeRate) {
            rainforestRootZoneRechargeRate[k] = Math.max(0, recharge) * 3600 / Math.max(dt, 1e-6);
          }
        }
      }
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
      if (soilMoistureFraction) soilMoistureFraction[k] = cap > 0 ? clamp01(soilW[k] / cap) : 0;
      if (vegetationProxy) {
        vegetationProxy[k] = Math.max(
          vegetationProxy[k],
          rainforestSupport * smoothstep(0.18, 0.48, cap > 0 ? soilW[k] / cap : 0)
        );
      }
      if (surfaceEvapSoilGate && beforeSoil <= 0 && soilW[k] > 0 && soilEvapExponent !== 1) {
        surfaceEvapSoilGate[k] = soilGate;
      }
    }
  }
}
