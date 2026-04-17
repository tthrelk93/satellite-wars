#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  applyDonorCoreIntegrationBridge
} from './earth-weather-architecture-c4-donor-core-integration-bridge.mjs';
import {
  buildCycleScopedOutputBase,
  runExplicitMainAudit,
  startCycleContract
} from './earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const defaults = {
  quickArtifactPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c9-bridged-hybrid-quick.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.json')
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
  'scripts/agent/plan-guard.mjs',
  'scripts/agent/fixtures/headless-terrain-180x90.json'
];

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
  else if (arg === '--quick-output' && argv[i + 1]) options.quickArtifactPath = path.resolve(argv[++i]);
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

export function classifyC9Decision({ exitCode, summaryExists, stderr = '', stdout = '' }) {
  const combined = `${stdout}\n${stderr}`;
  if (summaryExists && exitCode === 0) {
    return {
      verdict: 'runtime_fixture_contract_restored',
      nextMove: 'Architecture C10: cycled hybrid benchmark rerun'
    };
  }
  if (combined.includes('ENOENT') && combined.includes('fixtures/')) {
    return {
      verdict: 'runtime_fixture_contract_incomplete',
      nextMove: 'Architecture C10: donor-worktree runtime dependency attribution'
    };
  }
  return {
    verdict: 'post_fixture_runtime_failure',
    nextMove: 'Architecture C10: donor-worktree runtime attribution'
  };
}

export function renderArchitectureC9Markdown({
  decision,
  bridgeSummary,
  cycleContract,
  quickArtifactPath,
  runContext
}) {
  const lines = [
    '# Earth Weather Architecture C9 Donor-Worktree Runtime Fixture Repair',
    '',
    'This phase repairs the donor-worktree runtime fixture contract uncovered by Architecture C8 and reruns the bridged quick audit under the repaired cycle flow.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Repair scope',
    '',
    `- cycle id: \`${cycleContract.cycleId}\``,
    `- fixture overlay restored: \`scripts/agent/fixtures/headless-terrain-180x90.json\``,
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- quick artifact copied to repo: ${quickArtifactPath ? `[${path.basename(quickArtifactPath)}](${quickArtifactPath})` : 'no'}`,
    '',
    '## Rerun facts',
    '',
    `- exit code: ${runContext.exitCode}`,
    `- summary exists: ${runContext.summaryExists}`,
    `- stdout snippet: \`${runContext.stdoutSnippet || 'none'}\``,
    `- stderr snippet: \`${runContext.stderrSnippet || 'none'}\``,
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c9-'));
  const worktreePath = path.join(tempParent, 'runtime-worktree');
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
      slug: 'earth-weather-architecture-c9-bridged-hybrid',
      focusArea: 'bridged donor-base hybrid runtime fixture repair',
      blockerFamily: 'donor-worktree runtime fixture contract',
      mode: 'quick',
      question: 'Does restoring the donor-worktree terrain fixture contract allow the bridged hybrid quick audit to emit its requested summary artifact?',
      hypothesis: 'Forward-porting the headless terrain fixture into the donor worktree should remove the first post-cycle runtime ENOENT and let the bridged hybrid emit the quick artifact.',
      expectedSrcPaths: [
        'scripts/agent/headless-terrain-fixture.mjs',
        'scripts/agent/fixtures/headless-terrain-180x90.json',
        'scripts/agent/planetary-realism-audit.mjs'
      ],
      evidence: [
        'Architecture C8 cleared the plan guard but then failed with ENOENT for scripts/agent/fixtures/headless-terrain-180x90.json.'
      ],
      passCriteria: [
        'The bridged quick run exits 0 and writes the requested quick summary artifact.'
      ],
      failCriteria: [
        'The bridged quick run still fails before producing the requested quick artifact.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const outputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c9-bridged-hybrid-quick'
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
      quickArtifactPath = options.quickArtifactPath;
      copyArtifactIntoRepo(quickRun.jsonPath, quickArtifactPath);
    }

    const runContext = {
      exitCode: quickRun.status,
      signal: quickRun.signal,
      summaryExists: Boolean(quickRun.jsonPath),
      stdoutSnippet: quickRun.stdout.trim().slice(0, 400),
      stderrSnippet: quickRun.stderr.trim().slice(0, 400)
    };

    const decision = classifyC9Decision({
      exitCode: runContext.exitCode,
      summaryExists: runContext.summaryExists,
      stdout: runContext.stdoutSnippet,
      stderr: runContext.stderrSnippet
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC9Markdown({
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
