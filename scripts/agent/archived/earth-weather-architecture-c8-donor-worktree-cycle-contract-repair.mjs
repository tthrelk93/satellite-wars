#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  applyDonorCoreIntegrationBridge
} from './earth-weather-architecture-c4-donor-core-integration-bridge.mjs';
import {
  buildExplicitMainInvocationSource
} from './earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const defaults = {
  repairedQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c8-bridged-hybrid-cycle-quick.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.json')
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
  'scripts/agent/start-cycle.mjs',
  'scripts/agent/plan-guard.mjs'
];

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
  else if (arg === '--quick-output' && argv[i + 1]) options.repairedQuickPath = path.resolve(argv[++i]);
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

const copyArtifactIntoRepo = (fromPath, toPath) => {
  ensureDir(toPath);
  fs.copyFileSync(fromPath, toPath);
};

const runJsonScript = ({ cwd, scriptPath, args }) => {
  const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(stdout);
};

export function buildCycleScopedOutputBase(cycleDir, baseName) {
  return path.join(cycleDir, baseName);
}

export function startCycleContract({
  repoPath,
  slug,
  focusArea,
  blockerFamily,
  mode,
  question,
  hypothesis,
  expectedSrcPaths = [],
  evidence = [],
  passCriteria = [],
  failCriteria = []
}) {
  const startCycleScript = path.join(repoPath, 'scripts', 'agent', 'start-cycle.mjs');
  const args = [
    '--slug', slug,
    '--focus-area', focusArea,
    '--blocker-family', blockerFamily,
    '--mode', mode,
    '--question', question,
    '--hypothesis', hypothesis
  ];
  if (expectedSrcPaths.length) args.push('--expected-src', expectedSrcPaths.join(','));
  for (const item of evidence) args.push('--evidence', item);
  for (const item of passCriteria) args.push('--pass', item);
  for (const item of failCriteria) args.push('--fail', item);
  return runJsonScript({
    cwd: repoPath,
    scriptPath: startCycleScript,
    args
  });
}

export function runExplicitMainAudit({
  cwd,
  scriptPath,
  preset,
  outputBase,
  cycleDir
}) {
  const args = [
    '--preset',
    preset,
    '--no-repro-check',
    '--no-counterfactuals',
    '--quiet',
    '--report-base',
    outputBase
  ];
  const wrapper = buildExplicitMainInvocationSource({ scriptPath, args });
  const run = spawnSync(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      SATELLITE_WARS_CYCLE_DIR: cycleDir
    }
  });
  const summaryPath = `${outputBase}.json`;
  return {
    ok: run.status === 0 && fs.existsSync(summaryPath),
    status: Number.isInteger(run.status) ? run.status : null,
    signal: run.signal || null,
    stdout: run.stdout || '',
    stderr: run.stderr || '',
    jsonPath: fs.existsSync(summaryPath) ? summaryPath : null
  };
}

export function classifyC8Decision({ exitCode, summaryExists, stderr = '', stdout = '' }) {
  const combined = `${stdout}\n${stderr}`;
  if (summaryExists && exitCode === 0) {
    return {
      verdict: 'cycle_contract_restored',
      nextMove: 'Architecture C9: cycled hybrid benchmark rerun'
    };
  }
  if (combined.includes('[agent plan guard]')) {
    return {
      verdict: 'cycle_contract_repair_failed',
      nextMove: 'Architecture C9: donor-worktree cycle attribution'
    };
  }
  return {
    verdict: 'post_cycle_runtime_failure',
    nextMove: 'Architecture C9: cycled hybrid runtime attribution'
  };
}

export function renderArchitectureC8Markdown({
  decision,
  bridgeSummary,
  cycleContract,
  quickArtifactPath,
  runContext
}) {
  const lines = [
    '# Earth Weather Architecture C8 Donor-Worktree Cycle Contract Repair',
    '',
    'This phase repairs the donor-worktree cycle contract by creating a real guarded cycle inside the bridged donor worktree before invoking the audit.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Repair contract',
    '',
    `- cycle id: \`${cycleContract.cycleId}\``,
    `- cycle dir created: \`${Boolean(cycleContract.cycleDir)}\``,
    `- plan path created: \`${Boolean(cycleContract.planPath)}\``,
    `- cycle-state path created: \`${Boolean(cycleContract.cycleStatePath)}\``,
    `- cycle mode: \`${cycleContract.mode}\``,
    `- quick artifact copied to repo: ${quickArtifactPath ? `[${path.basename(quickArtifactPath)}](${quickArtifactPath})` : 'no'}`,
    '',
    '## Bridged run facts',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- quick exit code: ${runContext.exitCode}`,
    `- quick summary exists: ${runContext.summaryExists}`,
    `- stdout snippet: \`${runContext.stdoutSnippet || 'none'}\``,
    `- stderr snippet: \`${runContext.stderrSnippet || 'none'}\``,
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c8-'));
  const worktreePath = path.join(tempParent, 'cycle-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c8-bridged-hybrid',
      focusArea: 'bridged donor-base hybrid benchmark',
      blockerFamily: 'donor-worktree cycle contract',
      mode: 'quick',
      question: 'Can the bridged donor-base hybrid run planetary-realism-audit inside a valid donor-worktree cycle and emit the requested quick artifact?',
      hypothesis: 'Creating a real donor-worktree cycle contract and running the bridged audit inside that cycle will satisfy plan-guard and restore the requested quick artifact path.',
      expectedSrcPaths: [
        'scripts/agent/planetary-realism-audit.mjs',
        'scripts/agent/plan-guard.mjs'
      ],
      evidence: [
        'Architecture C7 surfaced a plan-guard failure before any climate benchmark artifact was emitted.',
        'Architecture C4 had already removed the donor-core ESM/core-API seam.'
      ],
      passCriteria: [
        'The bridged quick run exits 0 and writes the requested summary artifact.',
        'The run no longer fails on the donor-worktree plan guard.'
      ],
      failCriteria: [
        'The bridged quick run still fails on plan-guard.',
        'The bridged quick run exits without producing the requested quick artifact.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const outputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c8-bridged-hybrid-quick'
    );
    const quickRun = runExplicitMainAudit({
      cwd: worktreePath,
      scriptPath: worktreeAuditScript,
      preset: 'quick',
      outputBase,
      cycleDir: cycleContract.cycleDir
    });

    let quickArtifactPath = null;
    if (quickRun.jsonPath) {
      quickArtifactPath = options.repairedQuickPath;
      copyArtifactIntoRepo(quickRun.jsonPath, quickArtifactPath);
    }

    const runContext = {
      exitCode: quickRun.status,
      signal: quickRun.signal,
      summaryExists: Boolean(quickRun.jsonPath),
      stdoutSnippet: quickRun.stdout.trim().slice(0, 400),
      stderrSnippet: quickRun.stderr.trim().slice(0, 400)
    };

    const decision = classifyC8Decision({
      exitCode: runContext.exitCode,
      summaryExists: runContext.summaryExists,
      stdout: runContext.stdoutSnippet,
      stderr: runContext.stderrSnippet
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      decision,
      bridgeSummary,
      cycleContract,
      quickArtifactPath,
      runContext
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, renderArchitectureC8Markdown({
      decision,
      bridgeSummary,
      cycleContract,
      quickArtifactPath,
      runContext
    }));
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, quickArtifactPath, runContext })}\n`);
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

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
