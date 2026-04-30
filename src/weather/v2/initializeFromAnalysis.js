import {
  computeModelMidPressurePa,
  interpolatePressureFieldAtCell,
  potentialTemperatureFromTemperature,
  remapPressureFieldMap,
  remapStructuredGrid2D,
  specificHumidityFromRelativeHumidity,
  validateAnalysisDataset
} from './analysisData.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function initializeV2FromAnalysis({
  grid,
  state,
  geo,
  climo,
  analysis,
  params = {}
} = {}) {
  if (!grid || !state || !analysis) {
    throw new Error('initializeV2FromAnalysis requires grid, state, and analysis data.');
  }

  const {
    pTop = 20000,
    p0 = 100000,
    soilInitFrac = 0.6,
    qvMax = 0.03,
    thetaMin = 180,
    thetaMax = 380
  } = params;

  const dataset = validateAnalysisDataset(analysis);
  const targetGrid = {
    latitudesDeg: Array.from(grid.latDeg || []),
    longitudesDeg: Array.from(grid.lonDeg || [])
  };
  const sourceGrid = dataset.grid;
  const { fields } = dataset;

  const psRemapped = remapStructuredGrid2D(fields.surfacePressurePa, sourceGrid, targetGrid);
  const surfaceTempRemapped = Array.isArray(fields.surfaceTemperatureK)
    ? remapStructuredGrid2D(fields.surfaceTemperatureK, sourceGrid, targetGrid)
    : null;
  const surfaceGeopotentialRemapped = Array.isArray(fields.surfaceGeopotentialM2S2)
    ? remapStructuredGrid2D(fields.surfaceGeopotentialM2S2, sourceGrid, targetGrid)
    : null;

  const uMap = remapPressureFieldMap(fields.uByPressurePa, sourceGrid, targetGrid);
  const vMap = remapPressureFieldMap(fields.vByPressurePa, sourceGrid, targetGrid);
  const temperatureMap = fields.temperatureKByPressurePa
    ? remapPressureFieldMap(fields.temperatureKByPressurePa, sourceGrid, targetGrid)
    : null;
  const thetaMap = fields.thetaKByPressurePa
    ? remapPressureFieldMap(fields.thetaKByPressurePa, sourceGrid, targetGrid)
    : null;
  const specificHumidityMap = fields.specificHumidityKgKgByPressurePa
    ? remapPressureFieldMap(fields.specificHumidityKgKgByPressurePa, sourceGrid, targetGrid)
    : null;
  const relativeHumidityMap = fields.relativeHumidityByPressurePa
    ? remapPressureFieldMap(fields.relativeHumidityByPressurePa, sourceGrid, targetGrid)
    : null;

  const qvTargetMap = specificHumidityMap || new Map();
  if (!specificHumidityMap && relativeHumidityMap && temperatureMap) {
    relativeHumidityMap.forEach((rhField, pressurePa) => {
      const temperatureField = temperatureMap.get(pressurePa);
      if (!temperatureField) return;
      const qField = new Float32Array(rhField.length);
      for (let cell = 0; cell < rhField.length; cell += 1) {
        qField[cell] = specificHumidityFromRelativeHumidity(rhField[cell], temperatureField[cell], pressurePa);
      }
      qvTargetMap.set(pressurePa, qField);
    });
  }

  const { N, nz, sigmaHalf, ps, Ts, theta, qv, qc, qi, qr, u, v, soilW, soilCap } = state;
  if (!sigmaHalf || sigmaHalf.length !== nz + 1) {
    throw new Error('State sigmaHalf must match nz + 1.');
  }

  for (let i = 0; i < N; i += 1) {
    ps[i] = clamp(psRemapped[i], 50000, 110000);
  }
  const modelPmid = computeModelMidPressurePa({ surfacePressurePa: ps, sigmaHalf, pTop });

  for (let cell = 0; cell < N; cell += 1) {
    for (let lev = 0; lev < nz; lev += 1) {
      const idx = lev * N + cell;
      const pTarget = modelPmid[idx];
      const uVal = interpolatePressureFieldAtCell(uMap, pTarget, cell);
      const vVal = interpolatePressureFieldAtCell(vMap, pTarget, cell);
      const thetaVal = thetaMap
        ? interpolatePressureFieldAtCell(thetaMap, pTarget, cell)
        : null;
      const temperatureVal = temperatureMap
        ? interpolatePressureFieldAtCell(temperatureMap, pTarget, cell)
        : thetaVal != null
          ? thetaVal * Math.pow(pTarget / p0, 287.05 / 1004)
          : null;
      const qSpecific = qvTargetMap.size > 0
        ? interpolatePressureFieldAtCell(qvTargetMap, pTarget, cell)
        : null;
      const rhVal = relativeHumidityMap
        ? interpolatePressureFieldAtCell(relativeHumidityMap, pTarget, cell)
        : null;

      if (!Number.isFinite(uVal) || !Number.isFinite(vVal) || !Number.isFinite(temperatureVal) || (!Number.isFinite(qSpecific) && !Number.isFinite(rhVal))) {
        throw new Error(`Missing or invalid analysis data at cell=${cell} lev=${lev}.`);
      }

      u[idx] = uVal;
      v[idx] = vVal;
      theta[idx] = clamp(
        thetaVal != null ? thetaVal : potentialTemperatureFromTemperature(temperatureVal, pTarget, p0),
        thetaMin,
        thetaMax
      );
      qv[idx] = clamp(
        qSpecific != null ? qSpecific : specificHumidityFromRelativeHumidity(rhVal, temperatureVal, pTarget),
        0,
        qvMax
      );
    }
  }

  qc.fill(0);
  qi.fill(0);
  qr.fill(0);
  state.precipAccum?.fill(0);
  state.precipRate?.fill(0);
  state.surfaceEvapAccum?.fill(0);
  state.verticalSubtropicalDryingDemandMass?.fill(0);
  state.verticalCloudErosionToVaporMass?.fill(0);

  for (let cell = 0; cell < N; cell += 1) {
    const surfaceIdx = (nz - 1) * N + cell;
    Ts[cell] = surfaceTempRemapped
      ? surfaceTempRemapped[cell]
      : theta[surfaceIdx] * Math.pow(modelPmid[surfaceIdx] / p0, 287.05 / 1004);
    if (state.landMask?.[cell] === 1 && soilCap) {
      soilW[cell] = clamp(soilInitFrac * soilCap[cell], 0, soilCap[cell]);
    } else {
      soilW[cell] = 0;
    }
    if (surfaceGeopotentialRemapped && geo?.elev && geo.elev.length === N) {
      geo.elev[cell] = surfaceGeopotentialRemapped[cell] / 9.80665;
    }
  }

  state.analysisTargets = {
    source: 'analysis',
    surfacePressurePa: new Float32Array(psRemapped),
    uByPressurePa: uMap,
    vByPressurePa: vMap,
    temperatureKByPressurePa: temperatureMap,
    thetaKByPressurePa: thetaMap,
    specificHumidityKgKgByPressurePa: qvTargetMap,
    surfaceTemperatureK: surfaceTempRemapped ? new Float32Array(surfaceTempRemapped) : null
  };

  void climo;

  return {
    source: 'analysis',
    caseId: dataset.caseId || null,
    validTime: dataset.validTime || null,
    usedRelativeHumidity: !specificHumidityMap && Boolean(relativeHumidityMap),
    sourcePressureLevelsPa: Array.from(new Set([...uMap.keys(), ...vMap.keys()])).sort((a, b) => b - a)
  };
}
