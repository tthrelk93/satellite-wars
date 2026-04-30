#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_INPUT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-numerical-ownership-check.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-variant-normalized-ownership'
);
const MATERIAL_SIGNAL_THRESHOLD_KGM2 = 0.05;

let inputPath = DEFAULT_INPUT_PATH;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--input' && argv[i + 1]) inputPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--input=')) inputPath = path.resolve(arg.slice('--input='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
}

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const absolute = (value) => Math.abs(Number(value) || 0);

const rankOwnerByAbsoluteSignal = (values = {}) => {
  const entries = Object.entries(values).map(([key, value]) => ({
    key,
    signedValue: round(Number(value) || 0, 5),
    absoluteValue: round(absolute(value), 5)
  }));
  entries.sort((a, b) => {
    if (b.absoluteValue !== a.absoluteValue) return b.absoluteValue - a.absoluteValue;
    return a.key.localeCompare(b.key);
  });
  return entries[0] || { key: null, signedValue: 0, absoluteValue: 0 };
};

const isInformativeSignal = (signalKgM2, thresholdKgM2 = MATERIAL_SIGNAL_THRESHOLD_KGM2) => (
  Number(signalKgM2) >= thresholdKgM2
);

const summarizeVariant = (entry) => {
  const targetRanking = rankOwnerByAbsoluteSignal(entry.ownershipExcess?.targetCell);
  const corridorRanking = rankOwnerByAbsoluteSignal(entry.ownershipExcess?.corridorBand);
  const targetInformative = isInformativeSignal(targetRanking.absoluteValue);
  const corridorInformative = isInformativeSignal(corridorRanking.absoluteValue);
  const normalizedScope = corridorInformative ? 'corridorBand' : (targetInformative ? 'targetCell' : 'signalCollapsed');
  const normalizedOwner = normalizedScope === 'corridorBand'
    ? corridorRanking
    : (normalizedScope === 'targetCell' ? targetRanking : { key: null, signedValue: 0, absoluteValue: 0 });
  const normalizedBoundary = normalizedScope === 'signalCollapsed'
    ? null
    : (entry.firstMaterialBoundary || null);
  const boundaryStableCandidate = normalizedBoundary !== null;
  const counterfactualFinite = Object.values(entry.counterfactuals || {}).some((family) => (
    Object.values(family || {}).some(Number.isFinite)
  ));

  return {
    variant: entry.variant,
    rawTargetOwner: targetRanking,
    rawCorridorOwner: corridorRanking,
    targetInformative,
    corridorInformative,
    normalizedScope,
    normalizedOwner,
    normalizedBoundary,
    boundaryStableCandidate,
    counterfactualFinite,
    rawRetentionDecision: entry.retentionDecision || null
  };
};

const allSame = (values) => values.length > 0 && values.every((value) => value === values[0]);

const buildAssessment = (variants) => {
  const informative = variants.filter((entry) => entry.normalizedScope !== 'signalCollapsed');
  const collapsed = variants.filter((entry) => entry.normalizedScope === 'signalCollapsed').map((entry) => entry.variant.name);
  const boundaryReady = informative.filter((entry) => entry.boundaryStableCandidate);
  const ownerKeys = informative.map((entry) => entry.normalizedOwner.key);
  const boundaryKeys = boundaryReady.map((entry) => entry.normalizedBoundary);

  const stableOwnerWhenInformativePass = allSame(ownerKeys);
  const stableBoundaryWhenInformativePass = allSame(boundaryKeys);
  const exitCriteriaPass = informative.length >= 2 && stableOwnerWhenInformativePass && stableBoundaryWhenInformativePass;

  let recommendation = 'numerical-repair-before-upstream-fix-proof';
  if (exitCriteriaPass && collapsed.length > 0) recommendation = 'ownership-family-stable-repair-numerical-signal-collapse';
  else if (exitCriteriaPass) recommendation = 'ownership-family-stable';

  return {
    materialSignalThresholdKgM2: MATERIAL_SIGNAL_THRESHOLD_KGM2,
    informativeVariantCount: informative.length,
    collapsedSignalVariants: collapsed,
    stableOwnerWhenInformativePass,
    stableBoundaryWhenInformativePass,
    exitCriteriaPass,
    normalizedStableOwner: stableOwnerWhenInformativePass ? ownerKeys[0] : null,
    normalizedStableBoundary: stableBoundaryWhenInformativePass ? boundaryKeys[0] : null,
    recommendation
  };
};

const renderMarkdown = ({ inputPath: sourcePath, variants, assessment }) => {
  const lines = [];
  lines.push('# Variant-Normalized Ownership Targeting');
  lines.push('');
  lines.push(`- source artifact: ${sourcePath}`);
  lines.push(`- material signal threshold: ${assessment.materialSignalThresholdKgM2} kg/m²`);
  lines.push(`- informative variants: ${assessment.informativeVariantCount}`);
  lines.push(`- collapsed-signal variants: ${assessment.collapsedSignalVariants.join(', ') || 'none'}`);
  lines.push(`- stable owner when informative: ${assessment.stableOwnerWhenInformativePass}`);
  lines.push(`- stable boundary when informative: ${assessment.stableBoundaryWhenInformativePass}`);
  lines.push(`- exitCriteriaPass: ${assessment.exitCriteriaPass}`);
  lines.push(`- recommendation: ${assessment.recommendation}`);
  lines.push('');
  for (const entry of variants) {
    lines.push(`## ${entry.variant.name}`);
    lines.push('');
    lines.push(`- normalized scope: ${entry.normalizedScope}`);
    lines.push(`- normalized owner: ${entry.normalizedOwner.key ?? 'none'} (${entry.normalizedOwner.signedValue})`);
    lines.push(`- normalized owner |abs|: ${entry.normalizedOwner.absoluteValue}`);
    lines.push(`- normalized boundary: ${entry.normalizedBoundary ?? 'signal-collapsed'}`);
    lines.push(`- raw target owner: ${entry.rawTargetOwner.key} (${entry.rawTargetOwner.signedValue})`);
    lines.push(`- raw corridor owner: ${entry.rawCorridorOwner.key} (${entry.rawCorridorOwner.signedValue})`);
    lines.push(`- target informative: ${entry.targetInformative}`);
    lines.push(`- corridor informative: ${entry.corridorInformative}`);
    lines.push(`- counterfactualFinite: ${entry.counterfactualFinite}`);
    lines.push('');
  }
  return lines.join('\n');
};

const runExperiment = () => {
  const source = readJson(inputPath);
  const variants = (source.variants || []).map(summarizeVariant);
  const assessment = buildAssessment(variants);
  return {
    schema: 'satellite-wars.prevertical-variant-normalized-ownership.v1',
    generatedAt: new Date().toISOString(),
    inputPath,
    variants,
    assessment
  };
};

const main = async () => {
  const result = runExperiment();
  const markdown = renderMarkdown(result);
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    assessment: result.assessment,
    variants: result.variants.map((entry) => ({
      name: entry.variant.name,
      normalizedScope: entry.normalizedScope,
      normalizedOwner: entry.normalizedOwner.key,
      normalizedBoundary: entry.normalizedBoundary
    }))
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  rankOwnerByAbsoluteSignal,
  summarizeVariant,
  buildAssessment,
  isInformativeSignal
};
