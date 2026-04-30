#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_CONTRACT_PATH = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'prevertical-ownership-contract.json'
);
const DEFAULT_REPORT_BASE = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'prevertical-numerical-repair-audit'
);

let contractPath = DEFAULT_CONTRACT_PATH;
let reportBase = DEFAULT_REPORT_BASE;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--contract' && argv[i + 1]) contractPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--contract=')) contractPath = path.resolve(arg.slice('--contract='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
}

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const buildVariant = (name, nx, ny, dtSeconds, checkpointDay) => ({ name, nx, ny, dtSeconds, checkpointDay });

const summarizeDirectAdvanceCap = (variant) => {
  const requestedSeconds = variant.checkpointDay * 86400;
  const requestedSteps = Math.floor(requestedSeconds / variant.dtSeconds);
  const maxSteps = Math.max(1000, Math.ceil(86400 / variant.dtSeconds) + 10);
  const executedSteps = Math.min(requestedSteps, maxSteps);
  const directArrivalSeconds = executedSteps * variant.dtSeconds;
  const directArrivalDays = directArrivalSeconds / 86400;
  const underadvanceDays = Math.max(0, variant.checkpointDay - directArrivalDays);
  return {
    variant,
    requestedSteps,
    maxStepsPerCall: maxSteps,
    executedSteps,
    directArrivalDays: round(directArrivalDays),
    repairedArrivalDays: round(variant.checkpointDay),
    underadvanceDays: round(underadvanceDays),
    underadvanceFrac: round(variant.checkpointDay > 0 ? underadvanceDays / variant.checkpointDay : 0)
  };
};

const buildRootCauseAssessment = (summaries) => {
  const worst = [...summaries].sort((a, b) => (b.underadvanceDays || 0) - (a.underadvanceDays || 0))[0] || null;
  return {
    rootCause: 'single-call advanceModelSeconds checkpoints were capped before reaching the requested physical time',
    whyDtHalfCollapsedHardest: worst?.variant?.name === 'dt_half'
      ? 'dt_half hit the same per-call step cap with half-sized steps, so it reached far less physical time before the cap stopped the run'
      : 'the highest-underadvance variant was not dt_half in this configuration',
    worstVariant: worst?.variant?.name || null
  };
};

const renderMarkdown = ({ contract, summaries, rootCauseAssessment }) => {
  const lines = [];
  lines.push('# Pre-Vertical Numerical Repair Audit');
  lines.push('');
  lines.push(`- frozen corridor checkpoint day: ${contract.corridor.checkpointDay}`);
  lines.push(`- root cause: ${rootCauseAssessment.rootCause}`);
  lines.push(`- worst variant: ${rootCauseAssessment.worstVariant}`);
  lines.push(`- why dt_half collapsed hardest: ${rootCauseAssessment.whyDtHalfCollapsedHardest}`);
  lines.push('');
  for (const summary of summaries) {
    lines.push(`## ${summary.variant.name}`);
    lines.push('');
    lines.push(`- grid: ${summary.variant.nx}x${summary.variant.ny}`);
    lines.push(`- dtSeconds: ${summary.variant.dtSeconds}`);
    lines.push(`- requested checkpoint day: ${summary.variant.checkpointDay}`);
    lines.push(`- requested steps: ${summary.requestedSteps}`);
    lines.push(`- max steps per direct call: ${summary.maxStepsPerCall}`);
    lines.push(`- direct-arrival day before repair: ${summary.directArrivalDays}`);
    lines.push(`- repaired arrival day: ${summary.repairedArrivalDays}`);
    lines.push(`- underadvance days before repair: ${summary.underadvanceDays}`);
    lines.push(`- underadvance fraction before repair: ${summary.underadvanceFrac}`);
    lines.push('');
  }
  return lines.join('\n');
};

const runExperiment = () => {
  const contract = readJson(contractPath);
  const baseNx = Number(contract.corridor?.grid?.nx) || 48;
  const baseNy = Number(contract.corridor?.grid?.ny) || 24;
  const baseDt = Number(contract.corridor?.grid?.dtSeconds) || 1800;
  const checkpointDay = Number(contract.corridor?.checkpointDay) || 29.75;
  const variants = [
    buildVariant('baseline', baseNx, baseNy, baseDt, checkpointDay),
    buildVariant('dt_half', baseNx, baseNy, Math.max(300, Math.round(baseDt * 0.5 / 300) * 300), checkpointDay),
    buildVariant('grid_coarse', Math.max(24, Math.round(baseNx * 0.75 / 12) * 12), Math.max(12, Math.round(baseNy * 0.75 / 6) * 6), baseDt, checkpointDay),
    buildVariant('grid_dense', Math.max(24, Math.round(baseNx * 1.25 / 12) * 12), Math.max(12, Math.round(baseNy * 1.25 / 6) * 6), baseDt, checkpointDay)
  ];
  const summaries = variants.map(summarizeDirectAdvanceCap);
  const rootCauseAssessment = buildRootCauseAssessment(summaries);
  return {
    schema: 'satellite-wars.prevertical-numerical-repair-audit.v1',
    generatedAt: new Date().toISOString(),
    contractPath,
    contract,
    summaries,
    rootCauseAssessment
  };
};

const main = async () => {
  const result = runExperiment();
  const markdown = renderMarkdown(result);
  fs.mkdirSync(path.dirname(reportBase), { recursive: true });
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${reportBase}.md`, markdown);
  process.stdout.write(JSON.stringify({
    rootCauseAssessment: result.rootCauseAssessment,
    summaries: result.summaries.map((summary) => ({
      name: summary.variant.name,
      directArrivalDays: summary.directArrivalDays,
      repairedArrivalDays: summary.repairedArrivalDays,
      underadvanceDays: summary.underadvanceDays
    }))
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  summarizeDirectAdvanceCap,
  buildRootCauseAssessment
};
