import { g, Cp, Lv, Rd } from '../constants.js';

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
    enableThetaClosure = true
  } = params;
  if (!enable) return;

  const { N, nz, theta, T, u, v, qv, Ts, soilW, soilCap, landMask, sstNow, seaIceFrac, seaIceThicknessM, surfaceRadiativeFlux, precipRate, pHalf, pMid } = state;
  const { nx, ny, latDeg, invDx, invDy } = grid;
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
    const Tair = T[idxS];
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
    const qsTs = saturationMixingRatio(TsVal, pSurf);
    const dq = Math.max(0, qsTs - qvAir);
    let E = rhoAir * CeLocal * U * dq;
    if (!land) {
      E *= (1 - seaIceEvapSuppression * iceFrac);
    }
    if (E > evapMax) E = evapMax;

    if (land) {
      const cap = Math.max(1e-6, soilCap[k]);
      const avail = clamp01(soilW[k] / cap);
      const limit = Math.pow(avail, soilEvapExponent) * (1 + terrainEvapBoost * terrainFactor);
      E *= limit;
    }

    const H = rhoAir * CpAir * ChLocal * U * (TsVal - Tair);

    if (!land) {
      const skinTarget = iceFrac > 0
        ? freezeTempK - seaIceSurfaceOffsetK * iceFrac
        : sst;
      TsVal += (skinTarget - TsVal) * (dt / oceanTauTs);
    } else {
      let TsTargetLand = 288;
      if (enableLandClimoTs) {
        if (t2mNow && t2mNow.length === N) {
          TsTargetLand = t2mNow[k];
        } else if (landTsUseLatBaseline && latDeg) {
          const latAbs = Math.abs(latDeg[row]);
          const humidLat = smoothstep(60, 0, latAbs);
          const thetaLat = thetaBase + thetaEquatorBoost * humidLat - thetaPoleDrop * (1 - humidLat);
          TsTargetLand = thetaLat - 2;
        }
      }
      if (elevField) {
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
    if (enableThetaClosure) {
      // Close the latent and sensible flux loop at least approximately by applying
      // surface flux tendencies to the lowest-layer potential temperature.
      theta[idxS] += (H * dt) / (CpAir * m0 * Math.max(1e-6, PiS));
      theta[idxS] -= (LvAir / CpAir) * (dqv / Math.max(1e-6, PiS));
    }

    if (land) {
      const P = precipRate ? (precipRate[k] / 3600) : 0;
      soilW[k] += (P - E) * dt;
      if (soilW[k] < 0) soilW[k] = 0;
      const cap = soilCap[k];
      if (cap > 0 && soilW[k] > cap) {
        if (runoffEnabled) {
          soilW[k] = cap;
        } else {
          soilW[k] = cap;
        }
      }
    }
  }
}
