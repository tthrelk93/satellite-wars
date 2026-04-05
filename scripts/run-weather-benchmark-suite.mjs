#!/usr/bin/env node
import path from 'path';
import {
  readJson,
  loadCaseManifest,
  loadFieldDataset,
  mapLeadsByHour,
  resolveRelativePath,
  writeJson,
  writeText
} from '../weather-validation/lib/io.mjs';
import { computeAggregateMetrics, computeCycloneTrackError, computeLeadMetrics } from '../weather-validation/lib/metrics.mjs';
import { remapLeadToTargetGrid } from '../weather-validation/lib/remap.mjs';

const DEFAULT_SUITE_PATH = path.resolve(process.cwd(), 'weather-validation/suites/earth-accuracy-suite.json');
const args = process.argv.slice(2);
const suitePath = (() => {
  const idx = args.indexOf('--suite');
  if (idx >= 0 && args[idx + 1]) return path.resolve(args[idx + 1]);
  const inline = args.find((arg) => arg.startsWith('--suite='));
  return inline ? path.resolve(inline.slice('--suite='.length)) : DEFAULT_SUITE_PATH;
})();

const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const aggregatePrecipCsi = (leadResults, thresholdMmHr = 1) => {
  const values = leadResults
    .map((lead) => lead.metrics?.precip?.categorical?.find((entry) => entry.thresholdMmHr === thresholdMmHr)?.csi)
    .filter(Number.isFinite);
  return mean(values);
};

const aggregateCase = (leadResults, cycloneTrack) => ({
  ...computeAggregateMetrics(leadResults),
  precipCsi1Mean: aggregatePrecipCsi(leadResults, 1),
  cycloneTrackMeanErrorKm: cycloneTrack?.meanErrorKm ?? null
});

const evaluateDatasetAgainstReference = ({ dataset, referenceDataset, targetGrid, leadHours, pressureLevelsPa, trackDataset, referenceTrackDataset }) => {
  if (!dataset) return null;
  const dataLeads = mapLeadsByHour(dataset);
  const referenceLeads = mapLeadsByHour(referenceDataset);
  const leadResults = leadHours.map((leadHour) => {
    const modelLead = dataLeads.get(leadHour);
    const referenceLead = referenceLeads.get(leadHour);
    if (!modelLead || !referenceLead) {
      throw new Error(`Missing lead ${leadHour}h for dataset/reference comparison.`);
    }
    const modelOnTarget = remapLeadToTargetGrid(modelLead, dataset.grid, targetGrid, pressureLevelsPa);
    const truthOnTarget = remapLeadToTargetGrid(referenceLead, referenceDataset.grid, targetGrid, pressureLevelsPa);
    return {
      leadHours: leadHour,
      metrics: computeLeadMetrics({
        modelLead: modelOnTarget,
        truthLead: truthOnTarget,
        targetGrid,
        pressure500Pa: pressureLevelsPa[0]
      })
    };
  });
  const cycloneTrack = trackDataset && referenceTrackDataset
    ? computeCycloneTrackError(trackDataset, referenceTrackDataset)
    : null;
  return {
    leads: leadResults,
    aggregate: aggregateCase(leadResults, cycloneTrack),
    cycloneTrack
  };
};

const gatePass = (metricValue, floorValue, threshold) => {
  if (!Number.isFinite(metricValue)) return false;
  if (!threshold) return true;
  const absolute = Number.isFinite(threshold.absolute) ? threshold.absolute : Infinity;
  const floorMultiplier = Number.isFinite(threshold.floorMultiplier) ? threshold.floorMultiplier : Infinity;
  const floorBound = Number.isFinite(floorValue) ? floorValue * floorMultiplier : 0;
  const allowed = Math.max(absolute, floorBound);
  return metricValue <= allowed;
};

const suite = await readJson(suitePath);
const cases = Array.isArray(suite?.cases) ? suite.cases : [];
const thresholds = suite?.thresholds || {};
const reportBase = path.resolve(process.cwd(), suite?.reportBasePath || 'weather-validation/reports/earth-accuracy-status');

const caseResults = [];
for (const entry of cases) {
  const manifestPath = resolveRelativePath(suitePath, entry.manifestPath);
  const { manifest } = await loadCaseManifest(manifestPath);
  const targetGrid = manifest.simulatorGrid;
  const pressureLevelsPa = manifest.validationPressureLevelsPa || [50000];
  const referenceDataset = await loadFieldDataset(manifest.reference.fieldsPath);
  const modelDataset = await loadFieldDataset(manifest.model.fieldsPath);
  const analysisDataset = manifest.analysis?.fieldsPath ? await loadFieldDataset(manifest.analysis.fieldsPath) : null;
  const referenceTrack = manifest.reference?.stormTrackPath ? await readJson(manifest.reference.stormTrackPath) : null;
  const modelTrack = manifest.model?.stormTrackPath ? await readJson(manifest.model.stormTrackPath) : null;
  const analysisTrack = manifest.analysis?.stormTrackPath ? await readJson(manifest.analysis.stormTrackPath) : null;

  const baselineDatasets = {};
  const baselineTracks = {};
  for (const [name, baseline] of Object.entries(entry.baselines || {})) {
    if (!baseline?.fieldsPath) continue;
    baselineDatasets[name] = await loadFieldDataset(resolveRelativePath(suitePath, baseline.fieldsPath));
    if (baseline.stormTrackPath) {
      baselineTracks[name] = await readJson(resolveRelativePath(suitePath, baseline.stormTrackPath));
    }
  }

  const modelEval = evaluateDatasetAgainstReference({
    dataset: modelDataset,
    referenceDataset,
    targetGrid,
    leadHours: manifest.leadHours,
    pressureLevelsPa,
    trackDataset: modelTrack,
    referenceTrackDataset: referenceTrack
  });
  const analysisEval = evaluateDatasetAgainstReference({
    dataset: analysisDataset,
    referenceDataset,
    targetGrid,
    leadHours: manifest.leadHours,
    pressureLevelsPa,
    trackDataset: analysisTrack,
    referenceTrackDataset: referenceTrack
  });

  const baselineEvals = {};
  for (const [name, dataset] of Object.entries(baselineDatasets)) {
    baselineEvals[name] = evaluateDatasetAgainstReference({
      dataset,
      referenceDataset,
      targetGrid,
      leadHours: manifest.leadHours,
      pressureLevelsPa,
      trackDataset: baselineTracks[name],
      referenceTrackDataset: referenceTrack
    });
  }

  const floor = baselineEvals.remapFloor?.aggregate || {};
  const aggregate = modelEval.aggregate;
  const gates = {
    slp: gatePass(aggregate.slpRmseHpaMean, floor.slpRmseHpaMean, thresholds.slpRmseHpa),
    z500: gatePass(aggregate.z500RmseMMean, floor.z500RmseMMean, thresholds.z500RmseM),
    wind10: gatePass(aggregate.wind10RmseMsMean, floor.wind10RmseMsMean, thresholds.wind10RmseMs),
    tcw: gatePass(aggregate.totalColumnWaterRmseKgM2Mean, floor.totalColumnWaterRmseKgM2Mean, thresholds.totalColumnWaterRmseKgM2),
    precipBias: gatePass(Math.abs(aggregate.precipBiasMmHrMean), Math.abs(floor.precipBiasMmHrMean), thresholds.precipBiasMmHrAbs),
    cloudBias: gatePass(Math.abs(aggregate.cloudTotalBiasMean), Math.abs(floor.cloudTotalBiasMean), thresholds.cloudTotalBiasAbs),
    cycloneTrack: Number.isFinite(aggregate.cycloneTrackMeanErrorKm)
      ? gatePass(aggregate.cycloneTrackMeanErrorKm, floor.cycloneTrackMeanErrorKm, thresholds.cycloneTrackMeanErrorKm)
      : true
  };

  const beatBaselines = {
    climatology: baselineEvals.climatology
      ? aggregate.slpRmseHpaMean < baselineEvals.climatology.aggregate.slpRmseHpaMean &&
        aggregate.z500RmseMMean < baselineEvals.climatology.aggregate.z500RmseMMean &&
        aggregate.wind10RmseMsMean < baselineEvals.climatology.aggregate.wind10RmseMsMean &&
        aggregate.totalColumnWaterRmseKgM2Mean < baselineEvals.climatology.aggregate.totalColumnWaterRmseKgM2Mean
      : null,
    persistence: baselineEvals.persistence
      ? aggregate.slpRmseHpaMean < baselineEvals.persistence.aggregate.slpRmseHpaMean &&
        aggregate.z500RmseMMean < baselineEvals.persistence.aggregate.z500RmseMMean &&
        aggregate.wind10RmseMsMean < baselineEvals.persistence.aggregate.wind10RmseMsMean &&
        aggregate.totalColumnWaterRmseKgM2Mean < baselineEvals.persistence.aggregate.totalColumnWaterRmseKgM2Mean
      : null
  };

  const overallPass = Object.values(gates).every((value) => value !== false)
    && Object.values(beatBaselines).every((value) => value !== false);

  caseResults.push({
    caseId: entry.caseId || manifest.caseId,
    label: entry.label || manifest.caseId,
    category: entry.category || null,
    aggregate,
    analysisAggregate: analysisEval?.aggregate || null,
    baselines: Object.fromEntries(Object.entries(baselineEvals).map(([name, value]) => [name, value.aggregate])),
    gates,
    beatBaselines,
    overallPass
  });
}

const overallPass = caseResults.every((result) => result.overallPass);
const summary = {
  suiteId: suite.suiteId || 'earth-accuracy-suite',
  generatedAt: new Date().toISOString(),
  overallPass,
  caseResults,
  thresholds
};

const mdLines = [
  `# ${summary.suiteId}`,
  '',
  `Overall pass: **${overallPass ? 'PASS' : 'FAIL'}**`,
  ''
];
for (const result of caseResults) {
  mdLines.push(`## ${result.label}`);
  mdLines.push('');
  mdLines.push(`- Category: ${result.category || 'n/a'}`);
  mdLines.push(`- Pass: **${result.overallPass ? 'PASS' : 'FAIL'}**`);
  mdLines.push(`- SLP RMSE mean: ${result.aggregate.slpRmseHpaMean?.toFixed(3)} hPa`);
  mdLines.push(`- 500 hPa RMSE mean: ${result.aggregate.z500RmseMMean?.toFixed(3)} m`);
  mdLines.push(`- 10 m wind RMSE mean: ${result.aggregate.wind10RmseMsMean?.toFixed(3)} m/s`);
  mdLines.push(`- TCW RMSE mean: ${result.aggregate.totalColumnWaterRmseKgM2Mean?.toFixed(3)} kg/m²`);
  mdLines.push(`- Precip CSI@1 mean: ${result.aggregate.precipCsi1Mean?.toFixed(3)}`);
  if (result.analysisAggregate) {
    mdLines.push(`- Analysis SLP RMSE mean: ${result.analysisAggregate.slpRmseHpaMean?.toFixed(3)} hPa`);
  }
  mdLines.push(`- Beats climatology: ${result.beatBaselines.climatology}`);
  mdLines.push(`- Beats persistence: ${result.beatBaselines.persistence}`);
  mdLines.push('');
}

await writeJson(`${reportBase}.json`, summary);
await writeText(`${reportBase}.md`, `${mdLines.join('\n')}\n`);
console.log(`Benchmark suite written to ${reportBase}.json and ${reportBase}.md`);
console.log(`Overall pass: ${overallPass ? 'PASS' : 'FAIL'}`);
