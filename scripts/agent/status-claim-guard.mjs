#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, '..', '..');

const readTextIfExists = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
};

const readJsonIfExists = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
};

const normalizeToken = (value) => String(value || '').toLowerCase().replace(/[_\s]+/g, '-');

const extractLatestVerifiedCycleId = ({ markdown = null, statusJson = null } = {}) => {
  const mdCycle = markdown?.match(/Latest verified cycle:\s*`([^`]+)`/i)?.[1] || null;
  const jsonCycle = statusJson?.latestCycle?.id || null;
  return {
    markdown: mdCycle,
    json: jsonCycle,
    effective: mdCycle || jsonCycle || null
  };
};

const evidenceIsVerified = (evidence = {}) => {
  const tokens = [
    evidence.status,
    evidence.outcome,
    evidence.result,
    evidence.verdict,
    evidence.verifiedImprovement,
    evidence.verified
  ].map(normalizeToken);
  if (tokens.some((token) => /no-?verified|no-new-verified|not-verified|failed|failure/.test(token))) {
    return false;
  }
  return evidence.verified === true
    || evidence.verifiedImprovement === true
    || tokens.some((token) => token.includes('verified'));
};

const collectStrings = (value, strings = []) => {
  if (typeof value === 'string') {
    strings.push(value);
    return strings;
  }
  if (!value || typeof value !== 'object') return strings;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, strings));
    return strings;
  }
  Object.entries(value).forEach(([key, entry]) => {
    if (key === 'cycleInputs' || key === 'changedFiles') return;
    collectStrings(entry, strings);
  });
  return strings;
};

const extractJsonPathsFromMarkdown = (markdown) => {
  if (!markdown) return [];
  return [...markdown.matchAll(/(?:`|\b)([^`\s)]+\.json)(?:`|\b)/g)].map((match) => match[1]);
};

const resolveRepoPath = (repoRoot, filePath) => (
  path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath)
);

const unique = (values) => [...new Set(values.filter(Boolean))];

export function validateWorldClassStatusClaims({
  repoRoot = defaultRepoRoot,
  reportsDir = path.join(repoRoot, 'weather-validation', 'reports'),
  statusMdPath = path.join(reportsDir, 'world-class-weather-status.md'),
  statusJsonPath = path.join(reportsDir, 'world-class-weather-status.json')
} = {}) {
  const failures = [];
  const markdown = readTextIfExists(statusMdPath);
  const statusJson = readJsonIfExists(statusJsonPath);
  const hasVerifiedLanguage = /Latest verified cycle|verified improvement|verified baseline/i.test(markdown || '')
    || Boolean(statusJson?.latestCycle?.id)
    || /verified/i.test(JSON.stringify(statusJson || {}));

  if (!hasVerifiedLanguage) {
    return { ok: true, failures, latestCycleId: null, checkedJsonArtifacts: [] };
  }

  const cycleIds = extractLatestVerifiedCycleId({ markdown, statusJson });
  const latestCycleId = cycleIds.effective;
  if (!latestCycleId) {
    failures.push('Status uses verified language but does not name a latest verified cycle.');
    return { ok: false, failures, latestCycleId: null, checkedJsonArtifacts: [] };
  }
  if (cycleIds.markdown && cycleIds.json && cycleIds.markdown !== cycleIds.json) {
    failures.push(`Markdown latest verified cycle ${cycleIds.markdown} does not match JSON latest cycle ${cycleIds.json}.`);
  }
  if (!/^cycle-\d{4}-\d{2}-\d{2}T/.test(latestCycleId)) {
    failures.push(`Latest verified cycle ${latestCycleId} is not a cycle artifact id.`);
  }

  const cycleDir = path.join(repoRoot, 'weather-validation', 'output', latestCycleId);
  const evidencePath = path.join(cycleDir, 'evidence-summary.json');
  const checkpointPath = path.join(cycleDir, 'checkpoint.md');
  const evidence = readJsonIfExists(evidencePath);
  const checkpoint = readTextIfExists(checkpointPath);
  if (!fs.existsSync(cycleDir)) failures.push(`Latest verified cycle directory is missing: ${path.relative(repoRoot, cycleDir)}.`);
  if (!evidence) failures.push(`Latest verified cycle is missing evidence-summary.json: ${path.relative(repoRoot, evidencePath)}.`);
  if (!checkpoint) failures.push(`Latest verified cycle is missing checkpoint.md: ${path.relative(repoRoot, checkpointPath)}.`);
  if (evidence && evidence.cycleId && evidence.cycleId !== latestCycleId) {
    failures.push(`evidence-summary.json cycleId ${evidence.cycleId} does not match status cycle ${latestCycleId}.`);
  }
  if (evidence && !evidenceIsVerified(evidence)) {
    failures.push('evidence-summary.json does not record a verified improvement.');
  }
  if (checkpoint && (
    /NO NEW VERIFIED PROGRESS/i.test(checkpoint)
    || /## Outcome[\s\S]{0,240}\b(no verified|not verified|failed experiment)\b/i.test(checkpoint)
    || /^Not verified\./im.test(checkpoint)
  )) {
    failures.push('checkpoint.md for the latest verified cycle records no verified progress.');
  }

  const candidatePaths = unique([
    ...extractJsonPathsFromMarkdown(markdown),
    ...collectStrings(statusJson).filter((value) => /\.json$/i.test(value)),
    ...collectStrings(evidence).filter((value) => /\.json$/i.test(value))
  ]);
  const matchingJsonArtifacts = unique(candidatePaths.filter((value) => value.includes(latestCycleId)));
  if (!matchingJsonArtifacts.length) {
    failures.push(`No JSON artifacts from ${latestCycleId} are referenced by the status/evidence claim.`);
  }
  for (const artifactPath of matchingJsonArtifacts) {
    const resolved = resolveRepoPath(repoRoot, artifactPath);
    if (!fs.existsSync(resolved)) {
      failures.push(`Referenced JSON artifact is missing: ${artifactPath}.`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    latestCycleId,
    evidencePath: path.relative(repoRoot, evidencePath),
    checkedJsonArtifacts: matchingJsonArtifacts
  };
}

export function assertWorldClassStatusClaims(options = {}) {
  const result = validateWorldClassStatusClaims(options);
  if (!result.ok) {
    throw new Error(`[status claim guard] ${result.failures.join(' ')}`);
  }
  return result;
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const result = assertWorldClassStatusClaims();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
