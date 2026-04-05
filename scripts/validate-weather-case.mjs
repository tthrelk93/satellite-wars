#!/usr/bin/env node
import path from 'path';
import {
  DEFAULT_CASE_MANIFEST,
  loadCaseManifest,
  loadFieldDataset,
  loadStormTrackDataset,
  mapLeadsByHour,
  writeJson,
  writeText
} from '../weather-validation/lib/io.mjs';
import { computeAggregateMetrics, computeCycloneTrackError, computeLeadMetrics } from '../weather-validation/lib/metrics.mjs';
import { renderValidationMarkdown } from '../weather-validation/lib/markdown.mjs';
import { remapLeadToTargetGrid } from '../weather-validation/lib/remap.mjs';

const args = process.argv.slice(2);
let caseManifestPath = DEFAULT_CASE_MANIFEST;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--case' && args[i + 1]) {
    caseManifestPath = args[i + 1];
    i += 1;
  } else if (arg.startsWith('--case=')) {
    caseManifestPath = arg.slice('--case='.length);
  }
}

const fmt = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : 'n/a');

const { manifest } = await loadCaseManifest(caseManifestPath);
const modelDataset = await loadFieldDataset(manifest.model.fieldsPath);
const analysisDataset = await loadFieldDataset(manifest.analysis?.fieldsPath);
const referenceDataset = await loadFieldDataset(manifest.reference.fieldsPath);
const modelTrackDataset = await loadStormTrackDataset(manifest.model.stormTrackPath);
const analysisTrackDataset = await loadStormTrackDataset(manifest.analysis?.stormTrackPath);
const referenceTrackDataset = await loadStormTrackDataset(manifest.reference.stormTrackPath);

const modelLeads = mapLeadsByHour(modelDataset);
const analysisLeads = mapLeadsByHour(analysisDataset);
const referenceLeads = mapLeadsByHour(referenceDataset);
const targetGrid = manifest.simulatorGrid;
const pressureLevelsPa = Array.isArray(manifest.validationPressureLevelsPa) && manifest.validationPressureLevelsPa.length
  ? manifest.validationPressureLevelsPa
  : [50000];

const leadResults = manifest.leadHours.map((leadHours) => {
  const modelLead = modelLeads.get(leadHours);
  const referenceLead = referenceLeads.get(leadHours);
  if (!modelLead) {
    throw new Error(`Model dataset is missing lead ${leadHours}h.`);
  }
  if (!referenceLead) {
    throw new Error(`Reference dataset is missing lead ${leadHours}h.`);
  }

  const modelLeadOnTarget = remapLeadToTargetGrid(modelLead, modelDataset.grid, targetGrid, pressureLevelsPa);
  const referenceLeadOnTarget = remapLeadToTargetGrid(referenceLead, referenceDataset.grid, targetGrid, pressureLevelsPa);
  const metrics = computeLeadMetrics({
    modelLead: modelLeadOnTarget,
    truthLead: referenceLeadOnTarget,
    targetGrid,
    pressure500Pa: pressureLevelsPa[0]
  });

  const analysisLead = analysisLeads.get(leadHours);
  const analysisLeadOnTarget = analysisLead
    ? remapLeadToTargetGrid(analysisLead, analysisDataset.grid, targetGrid, pressureLevelsPa)
    : null;
  const analysisMetrics = analysisLeadOnTarget
    ? computeLeadMetrics({
      modelLead: analysisLeadOnTarget,
      truthLead: referenceLeadOnTarget,
      targetGrid,
      pressure500Pa: pressureLevelsPa[0]
    })
    : null;

  return {
    leadHours,
    modelLead: modelLeadOnTarget,
    analysisLead: analysisLeadOnTarget,
    referenceLead: referenceLeadOnTarget,
    metrics,
    analysisMetrics
  };
});

const aggregate = computeAggregateMetrics(leadResults);
const analysisAggregate = analysisDataset
  ? computeAggregateMetrics(leadResults.filter((lead) => lead.analysisMetrics).map((lead) => ({ leadHours: lead.leadHours, metrics: lead.analysisMetrics })))
  : null;
const cycloneTrack = modelTrackDataset && referenceTrackDataset
  ? computeCycloneTrackError(modelTrackDataset, referenceTrackDataset)
  : null;
const analysisCycloneTrack = analysisTrackDataset && referenceTrackDataset
  ? computeCycloneTrackError(analysisTrackDataset, referenceTrackDataset)
  : null;

const outputDir = path.resolve(process.cwd(), manifest.outputDir || `weather-validation/output/${manifest.caseId}`);
const outputJsonPath = path.join(outputDir, 'summary.json');
const outputMarkdownPath = path.join(outputDir, 'summary.md');
const outputJsonPathRel = path.relative(process.cwd(), outputJsonPath);
const outputMarkdownPathRel = path.relative(process.cwd(), outputMarkdownPath);

const summary = {
  schema: 'satellite-wars.weather-validation.summary.v1',
  caseId: manifest.caseId,
  initTime: manifest.initTime,
  leadHours: manifest.leadHours,
  pressureLevelsPa,
  outputJsonPath: outputJsonPathRel,
  outputMarkdownPath: outputMarkdownPathRel,
  aggregate,
  analysisAggregate,
  cycloneTrack,
  analysisCycloneTrack,
  leads: leadResults.map((lead) => ({
    leadHours: lead.leadHours,
    metrics: lead.metrics,
    analysisMetrics: lead.analysisMetrics
  })),
  inputs: {
    modelFieldsPath: manifest.model.fieldsPath,
    referenceFieldsPath: manifest.reference.fieldsPath,
    modelStormTrackPath: manifest.model.stormTrackPath || null,
    analysisFieldsPath: manifest.analysis?.fieldsPath || null,
    analysisStormTrackPath: manifest.analysis?.stormTrackPath || null,
    referenceStormTrackPath: manifest.reference.stormTrackPath || null
  }
};

await writeJson(outputJsonPath, summary);
const markdown = renderValidationMarkdown({ manifest, summary, leadResults, cycloneTrack, analysisCycloneTrack });
await writeText(outputMarkdownPath, markdown);

console.log(`Validated case: ${manifest.caseId}`);
console.log(`Output JSON: ${outputJsonPathRel}`);
console.log(`Output Markdown: ${outputMarkdownPathRel}`);
console.log(`SLP RMSE mean: ${fmt(aggregate.slpRmseHpaMean)} hPa`);
console.log(`500 hPa height RMSE mean: ${fmt(aggregate.z500RmseMMean)} m`);
console.log(`10 m wind RMSE mean: ${fmt(aggregate.wind10RmseMsMean)} m/s`);
console.log(`Total column water RMSE mean: ${fmt(aggregate.totalColumnWaterRmseKgM2Mean)} kg/m^2`);
if (cycloneTrack) {
  console.log(`Cyclone track mean error: ${fmt(cycloneTrack.meanErrorKm, 2)} km`);
}
