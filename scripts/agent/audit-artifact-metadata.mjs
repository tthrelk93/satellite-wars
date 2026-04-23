#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export const PLANETARY_AUDIT_CLI_FLAGS = [
  '--preset',
  '--grid',
  '--dt',
  '--seed',
  '--sample-every-days',
  '--horizons-days',
  '--out',
  '--md-out',
  '--report-base',
  '--label',
  '--repro-check',
  '--no-repro-check',
  '--counterfactuals',
  '--no-counterfactuals',
  '--instrumentation-mode',
  '--carry-input-override',
  '--soft-live-gate-patch',
  '--shoulder-absorption-guard-patch',
  '--shoulder-guard-fate-mode',
  '--circulation-rebound-patch',
  '--return-flow-coupling-patch',
  '--drying-omega-bridge-patch',
  '--equatorial-edge-subsidence-guard-patch',
  '--northside-fanout-leak-penalty-patch',
  '--weak-hemi-cross-hemi-floor-taper-patch',
  '--north-source-concentration-penalty-patch',
  '--atlantic-dry-core-receiver-taper-patch',
  '--atlantic-transition-carryover-containment-patch',
  '--architecture-a1-balance-contract',
  '--architecture-a2-partition-port',
  '--architecture-b1-circulation-scaffold',
  '--architecture-b2-circulation-state-port',
  '--architecture-b3-rollback-circulation-splice',
  '--observer-effect-audit',
  '--quiet',
  '--system-experiment',
  '--trusted-baseline'
];

export const stripKnownArtifactExtension = (filePath) => String(filePath || '').replace(/\.(json|md)$/i, '');

export const collectUnknownAuditCliFlags = (args = [], knownFlags = PLANETARY_AUDIT_CLI_FLAGS) => {
  const known = new Set(knownFlags);
  return args
    .filter((arg) => typeof arg === 'string' && arg.startsWith('--'))
    .map((arg) => (arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg))
    .filter((flag, index, flags) => !known.has(flag) && flags.indexOf(flag) === index);
};

export const resolveAuditLabelReportBase = (label, { repoRoot = process.cwd() } = {}) => {
  const raw = String(label || '').trim();
  if (!raw) return null;
  const withoutExtension = stripKnownArtifactExtension(raw);
  const looksLikePath = withoutExtension.includes('/')
    || withoutExtension.includes('\\')
    || withoutExtension.startsWith('.')
    || path.isAbsolute(withoutExtension);
  return looksLikePath
    ? path.resolve(repoRoot, withoutExtension)
    : path.join(repoRoot, 'weather-validation', 'output', withoutExtension);
};

export const buildAuditCliFlagSnapshot = (args = []) => {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (typeof arg !== 'string' || !arg.startsWith('--')) continue;
    if (arg.includes('=')) {
      const flag = arg.slice(0, arg.indexOf('='));
      flags[flag] = arg.slice(arg.indexOf('=') + 1);
      continue;
    }
    const next = args[index + 1];
    if (typeof next === 'string' && !next.startsWith('--')) {
      flags[arg] = next;
      index += 1;
    } else {
      flags[arg] = true;
    }
  }
  return {
    rawArgs: args.slice(),
    flags
  };
};

export const getRepoCommitSha = ({ repoRoot = process.cwd() } = {}) => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (_) {
    return null;
  }
};

export const getRepoChangedFiles = ({ repoRoot = process.cwd() } = {}) => {
  try {
    return execFileSync('git', ['status', '--porcelain=v1'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => ({
        status: line.slice(0, 2).trim(),
        path: line.slice(3).trim()
      }));
  } catch (_) {
    return [];
  }
};

export const buildAuditRunMetadata = ({
  repoRoot = process.cwd(),
  generatedAt = new Date().toISOString(),
  argv = [],
  config = {}
} = {}) => {
  const nx = Number.isFinite(config.nx) ? config.nx : null;
  const ny = Number.isFinite(config.ny) ? config.ny : null;
  const dtSeconds = Number.isFinite(config.dtSeconds) ? config.dtSeconds : null;
  const seed = Number.isFinite(config.seed) ? config.seed : null;
  const changedFiles = getRepoChangedFiles({ repoRoot });
  return {
    schema: 'satellite-wars.audit-run-metadata.v1',
    generatedAt,
    gitHash: getRepoCommitSha({ repoRoot }),
    preset: config.preset || null,
    grid: Number.isFinite(nx) && Number.isFinite(ny) ? `${nx}x${ny}` : null,
    nx,
    ny,
    dtSeconds,
    seed,
    flags: buildAuditCliFlagSnapshot(argv),
    changedFiles,
    changedFilePaths: changedFiles.map((entry) => entry.path),
    config: {
      ...config,
      grid: Number.isFinite(nx) && Number.isFinite(ny) ? `${nx}x${ny}` : config.grid || null
    }
  };
};

export const stampAuditArtifact = (payload, auditRun, artifactKind = 'unknown') => {
  const artifactAuditRun = {
    ...auditRun,
    artifactKind
  };
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      ...payload,
      auditRun: artifactAuditRun
    };
  }
  return {
    schema: 'satellite-wars.audit-artifact-wrapper.v1',
    auditRun: artifactAuditRun,
    data: payload
  };
};

export const unwrapAuditArtifactPayload = (payload) => (
  payload
    && typeof payload === 'object'
    && payload.schema === 'satellite-wars.audit-artifact-wrapper.v1'
    && Object.prototype.hasOwnProperty.call(payload, 'data')
    ? payload.data
    : payload
);

export const readAuditJsonArtifact = (filePath) => (
  unwrapAuditArtifactPayload(JSON.parse(fs.readFileSync(filePath, 'utf8')))
);
