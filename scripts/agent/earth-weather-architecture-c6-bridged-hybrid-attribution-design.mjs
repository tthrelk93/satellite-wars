#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  applyDonorCoreIntegrationBridge
} from './earth-weather-architecture-c4-donor-core-integration-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';

const defaults = {
  reportPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c6-bridged-hybrid-attribution-design.md'),
  jsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c6-bridged-hybrid-attribution-design.json')
};

const OVERLAY_FILES = [
  'src/weather/v2/microphysics5.js',
  'src/weather/v2/state5.js',
  'src/weather/v2/cloudBirthTracing5.js',
  'src/weather/v2/sourceTracing5.js',
  'src/weather/v2/instrumentationBands5.js',
  'src/weather/validation/diagnostics.js',
  'scripts/agent/planetary-realism-audit.mjs',
  'scripts/agent/headless-terrain-fixture.mjs',
  'scripts/agent/plan-guard.mjs'
];

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });

const readFileAtRef = (ref, relativePath) => execFileSync('git', ['show', `${ref}:${relativePath}`], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

const copyRepoFileAtHead = (relativePath, destinationRoot) => {
  const content = readFileAtRef('HEAD', relativePath);
  const destPath = path.join(destinationRoot, relativePath);
  ensureDir(destPath);
  fs.writeFileSync(destPath, content);
};

const listJsonMdFiles = (rootDir) => {
  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (current.endsWith('.json') || current.endsWith('.md')) {
      results.push(current);
    }
  }
  return results.sort();
};

const relativeSetDiff = (afterFiles, beforeFiles, rootDir) => {
  const beforeSet = new Set(beforeFiles.map((file) => path.relative(rootDir, file)));
  return afterFiles
    .map((file) => path.relative(rootDir, file))
    .filter((relativePath) => !beforeSet.has(relativePath));
};

export function classifyC6Decision({
  exitCode,
  expectedSummaryExists,
  fallbackReportExists,
  stdoutLooksLikeSummary,
  cycleViolationExists,
  newArtifacts
}) {
  if (expectedSummaryExists) {
    return {
      verdict: 'artifact_contract_restored',
      nextMove: 'Architecture C7: rerun bridged hybrid benchmark on restored artifact contract'
    };
  }
  if (fallbackReportExists) {
    return {
      verdict: 'report_base_redirect_detected',
      nextMove: 'Architecture C7: bridged hybrid artifact contract repair'
    };
  }
  if (stdoutLooksLikeSummary) {
    return {
      verdict: 'stdout_only_summary_without_artifact',
      nextMove: 'Architecture C7: bridged hybrid artifact contract repair'
    };
  }
  if (cycleViolationExists) {
    return {
      verdict: 'cycle_guard_exit_without_requested_artifact',
      nextMove: 'Architecture C7: bridged hybrid artifact contract repair'
    };
  }
  if (exitCode === 0 && newArtifacts.length === 0) {
    return {
      verdict: 'silent_no_artifact_exit',
      nextMove: 'Architecture C7: bridged hybrid artifact contract repair'
    };
  }
  return {
    verdict: 'bridged_runtime_boot_failure',
    nextMove: 'Architecture C7: bridged hybrid runtime repair'
  };
}

export function renderArchitectureC6Markdown({ decision, attribution }) {
  const lines = [
    '# Earth Weather Architecture C6 Bridged Hybrid Attribution Design',
    '',
    'This phase attributes why the bridged donor/current hybrid still failed to yield a benchmark artifact after Architecture C4 and C5.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- C6 verdict: \`${decision.verdict}\``,
    `- Next move: ${decision.nextMove}`,
    '',
    '## Bridged run facts',
    '',
    `- exit code: ${attribution.exitCode}`,
    `- expected summary exists: ${attribution.expectedSummaryExists}`,
    `- fallback default report exists: ${attribution.fallbackReportExists}`,
    `- stdout looks like summary JSON: ${attribution.stdoutLooksLikeSummary}`,
    `- cycle violation exists: ${attribution.cycleViolationExists}`,
    `- new worktree artifacts: ${attribution.newArtifacts.length ? attribution.newArtifacts.join(', ') : 'none'}`,
    '',
    '## Bridge status',
    '',
    `- bridged file count: ${attribution.bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${attribution.bridgeSummary.rewrittenImportCount}`,
    `- missing donor-core compatibility methods after bridge: ${attribution.bridgeSummary.missingCoreMethodsAfterBridge.length ? attribution.bridgeSummary.missingCoreMethodsAfterBridge.join(', ') : 'none'}`,
    '',
    '## Captured process output',
    '',
    `- stdout snippet: \`${attribution.stdoutSnippet || 'none'}\``,
    `- stderr snippet: \`${attribution.stderrSnippet || 'none'}\``,
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c6-'));
  const worktreePath = path.join(tempParent, 'bridged-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const outputBase = path.join(worktreePath, 'weather-validation', 'output', 'earth-weather-architecture-c6-bridged-hybrid-attribution');
    const expectedSummaryPath = `${outputBase}.json`;
    const fallbackReportPath = path.join(worktreePath, 'weather-validation', 'reports', 'planetary-realism-status.json');
    const cycleViolationPath = path.join(worktreePath, 'weather-validation', 'output', 'workflow-violation.json');
    const outputDir = path.join(worktreePath, 'weather-validation', 'output');
    const reportsDir = path.join(worktreePath, 'weather-validation', 'reports');

    const beforeOutputFiles = listJsonMdFiles(outputDir);
    const beforeReportFiles = listJsonMdFiles(reportsDir);

    const run = spawnSync(process.execPath, [
      worktreeAuditScript,
      '--preset',
      'quick',
      '--no-repro-check',
      '--no-counterfactuals',
      '--quiet',
      '--report-base',
      outputBase
    ], {
      cwd: worktreePath,
      encoding: 'utf8'
    });

    const afterOutputFiles = listJsonMdFiles(outputDir);
    const afterReportFiles = listJsonMdFiles(reportsDir);
    const newArtifacts = [
      ...relativeSetDiff(afterOutputFiles, beforeOutputFiles, worktreePath),
      ...relativeSetDiff(afterReportFiles, beforeReportFiles, worktreePath)
    ].sort();

    const stdoutSnippet = (run.stdout || '').trim().slice(0, 400);
    const stderrSnippet = (run.stderr || '').trim().slice(0, 400);
    const stdoutLooksLikeSummary = Boolean(stdoutSnippet.startsWith('{') && stdoutSnippet.includes('"schema"'));

    const attribution = {
      exitCode: Number.isInteger(run.status) ? run.status : null,
      signal: run.signal || null,
      expectedSummaryExists: fs.existsSync(expectedSummaryPath),
      fallbackReportExists: fs.existsSync(fallbackReportPath),
      cycleViolationExists: fs.existsSync(cycleViolationPath),
      stdoutLooksLikeSummary,
      stdoutSnippet,
      stderrSnippet,
      newArtifacts,
      expectedSummaryPath,
      fallbackReportPath,
      cycleViolationPath,
      bridgeSummary
    };

    const decision = classifyC6Decision({
      exitCode: attribution.exitCode,
      expectedSummaryExists: attribution.expectedSummaryExists,
      fallbackReportExists: attribution.fallbackReportExists,
      stdoutLooksLikeSummary: attribution.stdoutLooksLikeSummary,
      cycleViolationExists: attribution.cycleViolationExists,
      newArtifacts
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c6-bridged-hybrid-attribution-design.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      decision,
      attribution
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, renderArchitectureC6Markdown({ decision, attribution }));
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, attribution })}\n`);
  } finally {
    try {
      if (fs.existsSync(worktreePath)) {
        execFileSync('git', ['worktree', 'remove', '--force', worktreePath], {
          cwd: repoRoot,
          stdio: ['ignore', 'ignore', 'pipe']
        });
      }
    } catch {}
    try {
      if (fs.existsSync(tempParent)) {
        fs.rmSync(tempParent, { recursive: true, force: true });
      }
    } catch {}
  }
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
