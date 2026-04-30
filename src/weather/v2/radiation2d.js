import { cosZenith } from '../solar.js';
import { Cp, Rd, g } from '../constants.js';
import {
  CLOUD_BIRTH_LEVEL_BAND_COUNT,
  cloudBirthBandOffset,
  findCloudBirthLevelBandIndex,
  sigmaMidAtLevel
} from './cloudBirthTracing5.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);

const P0 = 100000;
const KAPPA = Rd / Cp;
const DEG2RAD = Math.PI / 180;

export function stepRadiation2D5({ dt, grid, state, timeUTC, params = {} }) {
  if (!grid || !state || !Number.isFinite(dt) || dt <= 0) return;
  const traceEnabled = state.instrumentationEnabled !== false;
  const {
    enable = true,
    S0 = 1361,
    kSw = 0.12,
    albedoOcean = 0.06,
    albedoLand = 0.2,
    albedoSeaIce = 0.55,
    eps0 = 0.75,
    kWv = 12.0,
    kCld = 0.1,
    tauRadLower = 30 * 86400,
    tauRadUpper = 15 * 86400,
    TeqLowerEqK = 288,
    TeqLowerPoleK = 253,
    TeqUpperEqK = 255,
    TeqUpperPoleK = 235,
    TeqLatShape = 'sin2',
    dThetaMaxPerStep = 1.0,
    radIceFactor = 0.7,
    pTop = 20000,
    enableFullColumnLW = true,
    enableSigmaLWProfile = true,
    upperCloudRadiativePersistenceEquivalentScale = 1.0
  } = params;
  if (!enable) return;

  const { nx, ny, latDeg, lonDeg } = grid;
  const {
    N,
    nz,
    theta,
    qv,
    qc,
    qi,
    pHalf,
    pMid,
    ps,
    T,
    Ts,
    landMask,
    seaIceFrac,
    albedo,
    surfaceRadiativeFlux,
    cloudFrac3D,
    cloudTau3D
  } = state;
  if (!state.upperCloudShortwaveAbsorptionWm2 || state.upperCloudShortwaveAbsorptionWm2.length !== N) {
    state.upperCloudShortwaveAbsorptionWm2 = new Float32Array(N);
  }
  if (!state.upperCloudLongwaveRelaxationBoost || state.upperCloudLongwaveRelaxationBoost.length !== N) {
    state.upperCloudLongwaveRelaxationBoost = new Float32Array(N);
  }
  if (!state.upperCloudRadiativePersistenceSupportWm2 || state.upperCloudRadiativePersistenceSupportWm2.length !== N) {
    state.upperCloudRadiativePersistenceSupportWm2 = new Float32Array(N);
  }
  if (!state.upperCloudClearSkyLwCoolingWm2 || state.upperCloudClearSkyLwCoolingWm2.length !== N) {
    state.upperCloudClearSkyLwCoolingWm2 = new Float32Array(N);
  }
  if (!state.upperCloudCloudyLwCoolingWm2 || state.upperCloudCloudyLwCoolingWm2.length !== N) {
    state.upperCloudCloudyLwCoolingWm2 = new Float32Array(N);
  }
  if (!state.upperCloudLwCloudEffectWm2 || state.upperCloudLwCloudEffectWm2.length !== N) {
    state.upperCloudLwCloudEffectWm2 = new Float32Array(N);
  }
  if (!state.upperCloudNetCloudRadiativeEffectWm2 || state.upperCloudNetCloudRadiativeEffectWm2.length !== N) {
    state.upperCloudNetCloudRadiativeEffectWm2 = new Float32Array(N);
  }
  if (!state.surfaceCloudShortwaveShieldingWm2 || state.surfaceCloudShortwaveShieldingWm2.length !== N) {
    state.surfaceCloudShortwaveShieldingWm2 = new Float32Array(N);
  }
  if (!state.radiativePersistenceEquivalentByBandMass || state.radiativePersistenceEquivalentByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.radiativePersistenceEquivalentByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  state.upperCloudShortwaveAbsorptionWm2.fill(0);
  state.upperCloudLongwaveRelaxationBoost.fill(0);
  state.upperCloudRadiativePersistenceSupportWm2.fill(0);
  state.upperCloudClearSkyLwCoolingWm2.fill(0);
  state.upperCloudCloudyLwCoolingWm2.fill(0);
  state.upperCloudLwCloudEffectWm2.fill(0);
  state.upperCloudNetCloudRadiativeEffectWm2.fill(0);
  state.surfaceCloudShortwaveShieldingWm2.fill(0);

  const dayOfYear = (timeUTC / 86400) % 365;
  const levLowB = nz - 1;
  const sigmaSb = 5.670374419e-8;
  const tauAbove = new Float32Array(nz);

  for (let j = 0; j < ny; j++) {
    const lat = latDeg[j];
    const latRad = lat * DEG2RAD;
    const latAbs = Math.abs(lat);
    const latNorm = clamp01(latAbs / 90);
    const sinLat = Math.sin(latRad);
    const latShape = TeqLatShape === 'linear' ? latNorm : sinLat * sinLat;
    const TeqLower = TeqLowerEqK - (TeqLowerEqK - TeqLowerPoleK) * latShape;
    const TeqUpper = TeqUpperEqK - (TeqUpperEqK - TeqUpperPoleK) * latShape;

    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const cosZ = cosZenith(latRad, lonDeg[i], timeUTC, dayOfYear);
      const SW_toa = S0 * cosZ;

      const iceFrac = seaIceFrac ? clamp01(seaIceFrac[k]) : 0;
      const baseAlbedo = albedo && albedo.length === N
        ? albedo[k]
        : (landMask && landMask[k] === 1 ? albedoLand : albedoOcean);
      const albedoVal = landMask && landMask[k] === 1
        ? baseAlbedo
        : baseAlbedo + (albedoSeaIce - baseAlbedo) * iceFrac;
      const swSource = SW_toa * (1 - albedoVal);

      let wvCol = 0;
      let tauCloudTotal = 0;
      let cloudCoverTotal = 0;
      let runningTauAbove = 0;
      let upperSwAbsLayerSum = 0;
      let upperLwBoostWeightedSum = 0;
      let upperLwBoostWeight = 0;
      let upperClearSkyLwCoolingSum = 0;
      let upperCloudyLwCoolingSum = 0;
      let upperLwCloudEffectSum = 0;
      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const mAir = dp / g;
        wvCol += qv[idx] * mAir;
      }
      for (let lev = 0; lev < nz; lev++) {
        tauAbove[lev] = runningTauAbove;
        const idx = lev * N + k;
        const cf = cloudFrac3D ? clamp01(cloudFrac3D[idx]) : 0;
        const tauLayerBase = cloudTau3D ? Math.max(0, cloudTau3D[idx]) : 0;
        const tauLayer = tauLayerBase * Math.max(0.2, cf);
        runningTauAbove += tauLayer;
        tauCloudTotal += tauLayer;
        cloudCoverTotal = 1 - (1 - cloudCoverTotal) * (1 - cf);
      }

      const eps = clamp01(eps0 + kWv * (wvCol / 50) + kCld * Math.min(1, tauCloudTotal / 10) + 0.1 * cloudCoverTotal);
      const SW_sfc = swSource * Math.exp(-kSw * tauCloudTotal);
      if (traceEnabled) state.surfaceCloudShortwaveShieldingWm2[k] = Math.max(0, swSource - SW_sfc);
      const surfaceTemp = Ts && Ts.length === N ? Ts[k] : T[levLowB * N + k];
      const lwSurfaceNet = -eps * sigmaSb * (Math.pow(Math.max(180, surfaceTemp), 4) - Math.pow(TeqLower, 4));
      if (surfaceRadiativeFlux && surfaceRadiativeFlux.length === N) {
        surfaceRadiativeFlux[k] = SW_sfc + lwSurfaceNet;
      }

      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const mAir = Math.max(1e-6, dp / g);
        const pLev = Math.max(pTop, pMid[idx]);
        const PiLev = Math.pow(pLev / P0, KAPPA);
        const TLev = Number.isFinite(T[idx]) ? T[idx] : (theta[idx] * PiLev);
        const sigma = clamp01((pLev - pTop) / Math.max(1e-6, ps[k] - pTop));
        const prof = enableSigmaLWProfile ? sigma : (nz > 1 ? lev / (nz - 1) : 1);
        const TeqLev = TeqUpper + (TeqLower - TeqUpper) * prof;
        const tauLev = tauRadUpper + (tauRadLower - tauRadUpper) * prof;

        const cf = cloudFrac3D ? clamp01(cloudFrac3D[idx]) : 0;
        const tauLayerBase = cloudTau3D ? Math.max(0, cloudTau3D[idx]) : 0;
        const tauLayer = tauLayerBase * Math.max(0.2, cf);
        const swAbsLayer = swSource * (Math.exp(-kSw * tauAbove[lev]) - Math.exp(-kSw * (tauAbove[lev] + tauLayer)));
        const lwCloudBoost = enableFullColumnLW
          ? 1 + 0.35 * clamp01((tauAbove[lev] + tauLayer) / 8) + 0.15 * cf
          : 1 + 0.15 * cloudCoverTotal;
        const sigmaMid = nz > 0 ? (lev + 0.5) / nz : 1;
        const lwTendencyClearSky = -((TLev - TeqLev) / tauLev);
        const lwTendencyCloudy = lwTendencyClearSky * lwCloudBoost;
        const lwPowerClearSky = lwTendencyClearSky * Cp * mAir;
        const lwPowerCloudy = lwTendencyCloudy * Cp * mAir;
        if (sigmaMid <= 0.55) {
          upperSwAbsLayerSum += swAbsLayer;
          upperLwBoostWeightedSum += lwCloudBoost * Math.max(tauLayer, 0.05 * cf);
          upperLwBoostWeight += Math.max(tauLayer, 0.05 * cf);
          upperClearSkyLwCoolingSum += Math.max(0, -lwPowerClearSky);
          upperCloudyLwCoolingSum += Math.max(0, -lwPowerCloudy);
          upperLwCloudEffectSum += lwPowerCloudy - lwPowerClearSky;
        }

        let dT = 0;
        if (swAbsLayer > 0) {
          dT += swAbsLayer / (Cp * mAir);
        }
        dT += -((TLev - TeqLev) / tauLev) * lwCloudBoost;

        let dTheta = (dT * dt) / PiLev;
        dTheta = clamp(dTheta, -dThetaMaxPerStep, dThetaMaxPerStep);
        theta[idx] += dTheta;
      }
      const upperLwBoostMean = upperLwBoostWeight > 0 ? upperLwBoostWeightedSum / upperLwBoostWeight : 1;
      if (traceEnabled) {
        state.upperCloudShortwaveAbsorptionWm2[k] = upperSwAbsLayerSum;
        state.upperCloudLongwaveRelaxationBoost[k] = upperLwBoostMean;
        state.upperCloudRadiativePersistenceSupportWm2[k] = upperSwAbsLayerSum / Math.max(1, upperLwBoostMean);
        state.upperCloudClearSkyLwCoolingWm2[k] = upperClearSkyLwCoolingSum;
        state.upperCloudCloudyLwCoolingWm2[k] = upperCloudyLwCoolingSum;
        state.upperCloudLwCloudEffectWm2[k] = upperLwCloudEffectSum;
        state.upperCloudNetCloudRadiativeEffectWm2[k] = upperSwAbsLayerSum + upperLwCloudEffectSum;
        const supportFrac = clamp01(
          (Math.max(0, state.upperCloudRadiativePersistenceSupportWm2[k]) / 80)
          * Math.max(0, upperCloudRadiativePersistenceEquivalentScale)
        );
        if (supportFrac > 0) {
          for (let lev = 0; lev < nz; lev += 1) {
            const idx = lev * N + k;
            const sigmaMid = sigmaMidAtLevel(state.sigmaHalf, lev, nz);
            const bandIndex = findCloudBirthLevelBandIndex(sigmaMid);
            const bandWeight = sigmaMid <= 0.35 ? 1 : sigmaMid <= 0.65 ? 0.35 : 0.1;
            if (bandWeight <= 0) continue;
            const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
            if (!(dp > 0)) continue;
            const cloudMass = ((qc[idx] || 0) + (qi[idx] || 0) + (state.qr?.[idx] || 0) + (state.qs?.[idx] || 0)) * (dp / g);
            if (cloudMass <= 0) continue;
            state.radiativePersistenceEquivalentByBandMass[cloudBirthBandOffset(bandIndex, k, N)] += cloudMass * supportFrac * bandWeight * (dt / 86400);
          }
        }
      }
    }
  }
}
