export const SURFACE_MOISTURE_SOURCE_TRACERS = [
  {
    key: 'northDryBeltOcean',
    field: 'qvSourceNorthDryBeltOcean',
    label: 'North dry-belt ocean evaporation'
  },
  {
    key: 'tropicalOceanNorth',
    field: 'qvSourceTropicalOceanNorth',
    label: 'Tropical ocean evaporation north of the equator'
  },
  {
    key: 'tropicalOceanSouth',
    field: 'qvSourceTropicalOceanSouth',
    label: 'Tropical ocean evaporation south of the equator'
  },
  {
    key: 'northExtratropicalOcean',
    field: 'qvSourceNorthExtratropicalOcean',
    label: 'North extratropical ocean evaporation'
  },
  {
    key: 'landRecycling',
    field: 'qvSourceLandRecycling',
    label: 'Land recycling and evapotranspiration'
  },
  {
    key: 'otherOcean',
    field: 'qvSourceOtherOcean',
    label: 'Other ocean evaporation'
  },
  {
    key: 'initializationMemory',
    field: 'qvSourceInitializationMemory',
    label: 'Initialization-memory vapor'
  },
  {
    key: 'atmosphericCarryover',
    field: 'qvSourceAtmosphericCarryover',
    label: 'Atmospheric carryover / internal redistribution'
  },
  {
    key: 'nudgingInjection',
    field: 'qvSourceNudgingInjection',
    label: 'Nudging-added vapor'
  },
  {
    key: 'analysisInjection',
    field: 'qvSourceAnalysisInjection',
    label: 'Analysis-increment-added vapor'
  }
];

export const SURFACE_MOISTURE_SOURCE_FIELDS = SURFACE_MOISTURE_SOURCE_TRACERS.map((entry) => entry.field);

export const NH_DRY_BELT_SOURCE_SECTORS = [
  { key: 'continentalSubtropics', label: 'Continental subtropics' },
  { key: 'eastPacific', label: 'East Pacific' },
  { key: 'atlantic', label: 'Atlantic' },
  { key: 'indoPacific', label: 'West Pacific / Indo-Pacific' }
];

export const NH_DRY_BELT_SOURCE_SECTOR_KEYS = NH_DRY_BELT_SOURCE_SECTORS.map((entry) => entry.key);

export const classifySurfaceMoistureSource = ({ latDeg = 0, isLand = false } = {}) => {
  if (isLand) return 'landRecycling';
  if (latDeg >= 15 && latDeg <= 35) return 'northDryBeltOcean';
  if (latDeg >= 0 && latDeg < 15) return 'tropicalOceanNorth';
  if (latDeg < 0 && latDeg >= -15) return 'tropicalOceanSouth';
  if (latDeg > 35) return 'northExtratropicalOcean';
  return 'otherOcean';
};

export const classifyNhDryBeltSector = ({ lonDeg = 0, isLand = false } = {}) => {
  if (isLand) return 'continentalSubtropics';
  if (lonDeg >= -150 && lonDeg < -90) return 'eastPacific';
  if (lonDeg >= -90 && lonDeg < 20) return 'atlantic';
  return 'indoPacific';
};
