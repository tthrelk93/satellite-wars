import { buildAreaWeights } from './grid.mjs';
import { greatCircleDistanceKm } from './remap.mjs';

const isFiniteNumber = (value) => Number.isFinite(value);

export function weightedMean(values, weights) {
  let sum = 0;
  let sumW = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    const weight = weights?.[i] ?? 1;
    if (!isFiniteNumber(value) || !isFiniteNumber(weight) || weight <= 0) continue;
    sum += value * weight;
    sumW += weight;
  }
  return sumW > 0 ? sum / sumW : null;
}

export function weightedBias(model, truth, weights) {
  const diffs = model.map((value, index) => value - truth[index]);
  return weightedMean(diffs, weights);
}

export function weightedRmse(model, truth, weights) {
  let sumSq = 0;
  let sumW = 0;
  for (let i = 0; i < model.length; i += 1) {
    const a = model[i];
    const b = truth[i];
    const weight = weights?.[i] ?? 1;
    if (!isFiniteNumber(a) || !isFiniteNumber(b) || !isFiniteNumber(weight) || weight <= 0) continue;
    const diff = a - b;
    sumSq += diff * diff * weight;
    sumW += weight;
  }
  return sumW > 0 ? Math.sqrt(sumSq / sumW) : null;
}

export function vectorRmse(modelU, modelV, truthU, truthV, weights) {
  let sumSq = 0;
  let sumW = 0;
  for (let i = 0; i < modelU.length; i += 1) {
    const du = modelU[i] - truthU[i];
    const dv = modelV[i] - truthV[i];
    const weight = weights?.[i] ?? 1;
    if (!isFiniteNumber(du) || !isFiniteNumber(dv) || !isFiniteNumber(weight) || weight <= 0) continue;
    sumSq += (du * du + dv * dv) * weight;
    sumW += weight;
  }
  return sumW > 0 ? Math.sqrt(sumSq / sumW) : null;
}

export function computePrecipSkill(modelRate, truthRate, thresholdsMmHr = [0.1, 1, 5]) {
  const thresholds = Array.isArray(thresholdsMmHr) ? thresholdsMmHr.slice() : [0.1, 1, 5];
  const bias = weightedBias(modelRate, truthRate, null);

  const categorical = thresholds.map((thresholdMmHr) => {
    let hits = 0;
    let misses = 0;
    let falseAlarms = 0;
    let correctNegatives = 0;

    for (let i = 0; i < modelRate.length; i += 1) {
      const modelHit = isFiniteNumber(modelRate[i]) && modelRate[i] >= thresholdMmHr;
      const truthHit = isFiniteNumber(truthRate[i]) && truthRate[i] >= thresholdMmHr;
      if (modelHit && truthHit) hits += 1;
      else if (!modelHit && truthHit) misses += 1;
      else if (modelHit && !truthHit) falseAlarms += 1;
      else correctNegatives += 1;
    }

    const observed = hits + misses;
    const forecast = hits + falseAlarms;
    const hitDenom = hits + misses + falseAlarms;
    return {
      thresholdMmHr,
      hits,
      misses,
      falseAlarms,
      correctNegatives,
      frequencyBias: observed > 0 ? forecast / observed : null,
      pod: observed > 0 ? hits / observed : null,
      far: forecast > 0 ? falseAlarms / forecast : null,
      csi: hitDenom > 0 ? hits / hitDenom : null
    };
  });

  return { biasMmHr: bias, categorical };
}

function trackPointsByStorm(trackDataset) {
  const storms = new Map();
  const tracks = Array.isArray(trackDataset?.tracks) ? trackDataset.tracks : [];
  tracks.forEach((track) => {
    if (!track?.stormId || !Array.isArray(track.points)) return;
    const pointMap = new Map();
    track.points.forEach((point) => {
      if (!Number.isFinite(point?.leadHours)) return;
      pointMap.set(point.leadHours, point);
    });
    storms.set(track.stormId, pointMap);
  });
  return storms;
}

export function computeCycloneTrackError(modelTrackDataset, truthTrackDataset) {
  const modelStorms = trackPointsByStorm(modelTrackDataset);
  const truthStorms = trackPointsByStorm(truthTrackDataset);
  const storms = [];

  for (const [stormId, truthPoints] of truthStorms.entries()) {
    const modelPoints = modelStorms.get(stormId);
    if (!modelPoints) continue;

    const pointErrorsKm = [];
    for (const [leadHours, truthPoint] of truthPoints.entries()) {
      const modelPoint = modelPoints.get(leadHours);
      if (!modelPoint) continue;
      pointErrorsKm.push({
        leadHours,
        errorKm: greatCircleDistanceKm(
          modelPoint.latDeg,
          modelPoint.lonDeg,
          truthPoint.latDeg,
          truthPoint.lonDeg
        )
      });
    }

    if (!pointErrorsKm.length) continue;
    const meanErrorKm = pointErrorsKm.reduce((sum, point) => sum + point.errorKm, 0) / pointErrorsKm.length;
    const maxErrorKm = Math.max(...pointErrorsKm.map((point) => point.errorKm));
    storms.push({ stormId, meanErrorKm, maxErrorKm, pointErrorsKm });
  }

  if (!storms.length) return null;

  return {
    storms,
    meanErrorKm: storms.reduce((sum, storm) => sum + storm.meanErrorKm, 0) / storms.length,
    maxErrorKm: Math.max(...storms.map((storm) => storm.maxErrorKm))
  };
}

export function computeLeadMetrics({ modelLead, truthLead, targetGrid, pressure500Pa = 50000 }) {
  const weights = buildAreaWeights(targetGrid);
  const z500Key = String(pressure500Pa);

  return {
    slpRmsePa: weightedRmse(modelLead.seaLevelPressurePa, truthLead.seaLevelPressurePa, weights),
    slpRmseHpa: weightedRmse(modelLead.seaLevelPressurePa, truthLead.seaLevelPressurePa, weights) / 100,
    z500RmseM: weightedRmse(
      modelLead.geopotentialHeightMByPressurePa?.[z500Key] || [],
      truthLead.geopotentialHeightMByPressurePa?.[z500Key] || [],
      weights
    ),
    wind10RmseMs: vectorRmse(modelLead.wind10mU, modelLead.wind10mV, truthLead.wind10mU, truthLead.wind10mV, weights),
    totalColumnWaterRmseKgM2: weightedRmse(modelLead.totalColumnWaterKgM2, truthLead.totalColumnWaterKgM2, weights),
    precip: computePrecipSkill(modelLead.precipRateMmHr, truthLead.precipRateMmHr),
    cloudFractionBias: {
      low: weightedBias(modelLead.cloudLowFraction, truthLead.cloudLowFraction, weights),
      high: weightedBias(modelLead.cloudHighFraction, truthLead.cloudHighFraction, weights),
      total: weightedBias(modelLead.cloudTotalFraction, truthLead.cloudTotalFraction, weights)
    }
  };
}

export function computeAggregateMetrics(leadMetrics) {
  const numericMean = (selector) => {
    const values = leadMetrics.map(selector).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  return {
    slpRmsePaMean: numericMean((lead) => lead.metrics.slpRmsePa),
    slpRmseHpaMean: numericMean((lead) => lead.metrics.slpRmseHpa),
    z500RmseMMean: numericMean((lead) => lead.metrics.z500RmseM),
    wind10RmseMsMean: numericMean((lead) => lead.metrics.wind10RmseMs),
    totalColumnWaterRmseKgM2Mean: numericMean((lead) => lead.metrics.totalColumnWaterRmseKgM2),
    precipBiasMmHrMean: numericMean((lead) => lead.metrics.precip.biasMmHr),
    cloudTotalBiasMean: numericMean((lead) => lead.metrics.cloudFractionBias.total)
  };
}
