export const CLOUD_BIRTH_LEVEL_BANDS = [
  { key: 'boundaryLayer', label: 'Boundary layer', minSigma: 0.85, maxSigma: 1.01 },
  { key: 'lowerTroposphere', label: 'Lower troposphere', minSigma: 0.65, maxSigma: 0.85 },
  { key: 'midTroposphere', label: 'Mid troposphere', minSigma: 0.35, maxSigma: 0.65 },
  { key: 'upperTroposphere', label: 'Upper troposphere', minSigma: 0.0, maxSigma: 0.35 }
];

export const CLOUD_BIRTH_LEVEL_BAND_COUNT = CLOUD_BIRTH_LEVEL_BANDS.length;

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const sigmaMidAtLevel = (sigmaHalf, lev, nz) => (
  sigmaHalf && sigmaHalf.length > lev + 1
    ? 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1])
    : (lev + 0.5) / Math.max(1, nz)
);

export const findCloudBirthLevelBandIndex = (sigmaMid) => {
  const sigma = clamp01(sigmaMid);
  for (let index = 0; index < CLOUD_BIRTH_LEVEL_BANDS.length; index += 1) {
    const band = CLOUD_BIRTH_LEVEL_BANDS[index];
    if (sigma >= band.minSigma && sigma < band.maxSigma) return index;
  }
  return CLOUD_BIRTH_LEVEL_BANDS.length - 1;
};

export const cloudBirthBandOffset = (bandIndex, cellIndex, cellCount) => bandIndex * cellCount + cellIndex;
