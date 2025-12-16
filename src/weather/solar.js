// solar.js: solar geometry and surface radiation estimates
import { S0, sigmaSB } from './constants';

export function solarDeclination(dayOfYear) {
  return (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
}

export function cosZenith(latRad, lonDeg, timeUTCSeconds, dayOfYear) {
  const decl = solarDeclination(dayOfYear);
  const hours = (timeUTCSeconds / 3600) % 24;
  const H = 2 * Math.PI * ((hours + lonDeg / 15) / 24 - 0.5);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinDec = Math.sin(decl);
  const cosDec = Math.cos(decl);
  const cosZ = sinLat * sinDec + cosLat * cosDec * Math.cos(H);
  return Math.max(0, cosZ);
}

export function surfaceRadiation({
  cosZ,
  cloudFrac,
  albedo,
  Ts,
  Tair,
  transmittance = 0.75,
  emissAtm = 0.82
}) {
  const SW_TOA = S0 * cosZ;
  const cloudReflect = Math.min(0.7, cloudFrac * 0.6);
  const SW_sfc = SW_TOA * transmittance * (1 - cloudReflect);
  const LW_up = sigmaSB * Math.pow(Ts, 4);
  const LW_down = emissAtm * sigmaSB * Math.pow(Tair, 4);
  const Rnet = SW_sfc * (1 - albedo) + LW_down - LW_up;
  return { SW_TOA, SW_sfc, LW_up, LW_down, Rnet };
}

