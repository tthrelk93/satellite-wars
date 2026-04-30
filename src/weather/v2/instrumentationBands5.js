export const INSTRUMENTATION_LEVEL_BANDS = [
  { key: 'boundaryLayer', label: 'Boundary layer', minSigma: 0.85, maxSigma: 1.01 },
  { key: 'lowerTroposphere', label: 'Lower troposphere', minSigma: 0.65, maxSigma: 0.85 },
  { key: 'midTroposphere', label: 'Mid troposphere', minSigma: 0.35, maxSigma: 0.65 },
  { key: 'upperTroposphere', label: 'Upper troposphere', minSigma: 0.0, maxSigma: 0.35 }
];

export const INSTRUMENTATION_LEVEL_BAND_COUNT = INSTRUMENTATION_LEVEL_BANDS.length;

export const sigmaMidAtLevel = (sigmaHalf, lev, nz) => (
  sigmaHalf && sigmaHalf.length > lev + 1
    ? 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1])
    : (lev + 0.5) / Math.max(1, nz)
);

export const findInstrumentationLevelBandIndex = (sigmaMid) => {
  for (let index = 0; index < INSTRUMENTATION_LEVEL_BANDS.length; index += 1) {
    const band = INSTRUMENTATION_LEVEL_BANDS[index];
    if (sigmaMid >= band.minSigma && sigmaMid < band.maxSigma) return index;
  }
  return INSTRUMENTATION_LEVEL_BANDS.length - 1;
};

export const instrumentationBandOffset = (bandIndex, cell, cellCount) => (
  bandIndex * cellCount + cell
);
