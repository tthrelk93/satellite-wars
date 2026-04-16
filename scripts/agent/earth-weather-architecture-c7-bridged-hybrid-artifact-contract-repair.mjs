#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  evaluateMetricRows,
  evaluateGate,
  classifyHybridFailure
} from './earth-weather-architecture-c2-donor-base-hybrid-benchmark.mjs';
import {
  applyDonorCoreIntegrationBridge
} from './earth-weather-architecture-c4-donor-core-integration-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';
const trustedBaselinePath = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1-hadley-second-pass-restore-v4.json'
);

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const defaults = {
  trustedBaselinePath,
  currentOffQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-quick'),
  currentOffAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-annual'),
  hybridQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-bridged-hybrid-quick'),
  hybridAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-bridged-hybrid-annual'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.json')
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

const METRIC_LABELS = new Map([
  ['itczWidthDeg', 'ITCZ width'],
  ['subtropicalDryNorthRatio', 'NH dry-belt ratio'],
  ['subtropicalDrySouthRatio', 'SH dry-belt ratio'],
  ['midlatitudeWesterliesNorthU10Ms', 'NH midlatitude westerlies'],
  ['northDryBeltOceanLargeScaleCondensationMeanKgM2', 'NH dry-belt ocean condensation'],
  ['crossEquatorialVaporFluxNorthKgM_1S', 'Cross-equatorial vapor flux north']
]);

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--trusted-baseline' && argv[i + 1]) options.trustedBaselinePath = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const extractMetrics = (auditJson) => auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {};

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

export function buildExplicitMainInvocationSource({ scriptPath, args }) {
  return `
process.argv = ${JSON.stringify([process.execPath, 'codex-architecture-c7-wrapper', ...args])};
const mod = await import(${JSON.stringify(pathToFileURL(scriptPath).href)});
if (typeof mod.main !== 'function') {
  throw new Error('planetary-realism-audit main export missing');
}
await mod.main();
`;
}

export function classifyC7Failure(stdout = '', stderr = '') {
  const combined = `${stdout}\n${stderr}`;
  if (combined.includes('[agent plan guard]') || combined.includes('requires an active cycle directory with plan.md')) {
    return {
      verdict: 'cycle_guard_contract_block',
      nextMove: 'Architecture C8: donor-worktree cycle contract repair'
    };
  }
  return {
    verdict: classifyHybridFailure(stderr, [], stdout),
    nextMove: 'Architecture C8: bridged hybrid runtime attribution design'
  };
}

const runAuditViaExplicitMain = ({ cwd, scriptPath, preset, outputBase }) => {
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
    encoding: 'utf8'
  });
  const summaryPath = `${outputBase}.json`;
  return {
    ok: run.status === 0 && fs.existsSync(summaryPath),
    status: run.status,
    signal: run.signal || null,
    stdout: run.stdout || '',
    stderr: run.stderr || '',
    jsonPath: fs.existsSync(summaryPath) ? summaryPath : null
  };
};

const renderRows = (rows) => rows.map((row) => (
  `- ${METRIC_LABELS.get(row.key) || row.label || row.key}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC7Markdown({
  decision,
  bridgeSummary,
  quickRows,
  quickGate,
  currentQuickPath,
  hybridQuickPath,
  hybridAnnualPath,
  runContext,
  failure
}) {
  const lines = [
    '# Earth Weather Architecture C7 Bridged Hybrid Artifact Contract Repair',
    '',
    'This phase repairs the bridged-hybrid artifact contract by invoking the bridged audit through its exported main path instead of relying on the worktree script-entry heuristic.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Repair summary',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- explicit-main run exit code: ${runContext.exitCode}`,
    `- explicit-main stdout snippet: \`${runContext.stdoutSnippet || 'none'}\``,
    `- explicit-main stderr snippet: \`${runContext.stderrSnippet || 'none'}\``,
    ''
  ];

  if (quickRows) {
    lines.push('## Benchmark');
    lines.push('');
    lines.push(`- current quick artifact: [${path.basename(currentQuickPath)}](${currentQuickPath})`);
    lines.push(`- repaired bridged hybrid quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`);
    if (hybridAnnualPath) {
      lines.push(`- repaired bridged hybrid annual artifact: [${path.basename(hybridAnnualPath)}](${hybridAnnualPath})`);
    }
    lines.push('');
    lines.push(renderRows(quickRows));
    lines.push('');
    lines.push(`- improved metrics: ${quickGate.improvedCount} / ${quickRows.length}`);
    lines.push(`- severe regressions: ${quickGate.severeRegressions.length ? quickGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- gate pass: ${quickGate.pass}`);
    lines.push('');
  } else if (failure) {
    lines.push('## Benchmark');
    lines.push('');
    lines.push('- repaired bridged hybrid benchmark did not complete');
    lines.push(`- failure classification: \`${failure.classification}\``);
    lines.push(`- stderr: \`${failure.stderr || failure.message || 'none'}\``);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  const currentQuickPath = `${options.currentOffQuickBase}.json`;
  if (!fs.existsSync(currentQuickPath)) {
    execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'agent', 'planetary-realism-audit.mjs'),
      '--preset',
      'quick',
      '--no-repro-check',
      '--no-counterfactuals',
      '--quiet',
      '--report-base',
      options.currentOffQuickBase
    ], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });
  }
  const currentQuickMetrics = extractMetrics(readJson(currentQuickPath));

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c7-'));
  const worktreePath = path.join(tempParent, 'bridged-worktree');
  let quickRows = null;
  let quickGate = null;
  let hybridQuickRepoPath = null;
  let hybridAnnualRepoPath = null;
  let failure = null;

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
    const worktreeQuickBase = path.join(worktreePath, 'weather-validation', 'output', 'earth-weather-architecture-c7-bridged-hybrid-quick');
    const quickRun = runAuditViaExplicitMain({
      cwd: worktreePath,
      scriptPath: worktreeAuditScript,
      preset: 'quick',
      outputBase: worktreeQuickBase
    });

    const runContext = {
      exitCode: quickRun.status,
      signal: quickRun.signal,
      stdoutSnippet: quickRun.stdout.trim().slice(0, 400),
      stderrSnippet: quickRun.stderr.trim().slice(0, 400)
    };

    let decision;
    if (!quickRun.ok) {
      const classification = classifyC7Failure(quickRun.stdout, quickRun.stderr);
      failure = {
        message: quickRun.stdout || quickRun.stderr || 'Explicit-main bridged hybrid run did not create the expected summary artifact.',
        stderr: quickRun.stderr.trim(),
        stdout: quickRun.stdout.trim(),
        classification: classification.verdict
      };
      decision = classification;

      const result = {
        schema: 'satellite-wars.earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.v1',
        generatedAt: new Date().toISOString(),
        archiveBranch,
        overlayFiles: OVERLAY_FILES,
        trustedBaselinePath: options.trustedBaselinePath,
        currentQuickPath,
        hybridQuickPath: null,
        hybridAnnualPath: null,
        bridgeSummary,
        quickRows: null,
        quickGate: null,
        runContext,
        failure,
        decision
      };

      ensureDir(options.jsonPath);
      ensureDir(options.reportPath);
      fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
      fs.writeFileSync(options.reportPath, renderArchitectureC7Markdown({
        decision,
        bridgeSummary,
        quickRows: null,
        quickGate: null,
        currentQuickPath,
        hybridQuickPath: null,
        hybridAnnualPath: null,
        runContext,
        failure
      }));
      process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, runContext, failure })}\n`);
      return;
    }

    hybridQuickRepoPath = `${options.hybridQuickBase}.json`;
    copyArtifactIntoRepo(quickRun.jsonPath, hybridQuickRepoPath);
    const hybridQuickMetrics = extractMetrics(readJson(hybridQuickRepoPath));
    quickRows = evaluateMetricRows({
      offMetrics: currentQuickMetrics,
      onMetrics: hybridQuickMetrics,
      targetMetrics: trustedBaselineMetrics,
      severeTolerance: 0.05
    });
    quickGate = evaluateGate(quickRows, 4);

    if (quickGate.pass) {
      const currentAnnualPath = `${options.currentOffAnnualBase}.json`;
      if (!fs.existsSync(currentAnnualPath)) {
        execFileSync(process.execPath, [
          path.join(repoRoot, 'scripts', 'agent', 'planetary-realism-audit.mjs'),
          '--preset',
          'annual',
          '--no-repro-check',
          '--no-counterfactuals',
          '--quiet',
          '--report-base',
          options.currentOffAnnualBase
        ], {
          cwd: repoRoot,
          stdio: ['ignore', 'ignore', 'pipe']
        });
      }

      const currentAnnualMetrics = extractMetrics(readJson(currentAnnualPath));
      const worktreeAnnualBase = path.join(worktreePath, 'weather-validation', 'output', 'earth-weather-architecture-c7-bridged-hybrid-annual');
      const annualRun = runAuditViaExplicitMain({
        cwd: worktreePath,
        scriptPath: worktreeAuditScript,
        preset: 'annual',
        outputBase: worktreeAnnualBase
      });

      if (!annualRun.ok) {
        const classification = classifyC7Failure(annualRun.stdout, annualRun.stderr);
        failure = {
          message: annualRun.stdout || annualRun.stderr || 'Explicit-main annual bridged hybrid run did not create the expected summary artifact.',
          stderr: annualRun.stderr.trim(),
          stdout: annualRun.stdout.trim(),
          classification: classification.verdict
        };
        decision = classification;
        runContext.stdoutSnippet = annualRun.stdout.trim().slice(0, 400);
        runContext.stderrSnippet = annualRun.stderr.trim().slice(0, 400);
        runContext.exitCode = annualRun.status;
      } else {
        hybridAnnualRepoPath = `${options.hybridAnnualBase}.json`;
        copyArtifactIntoRepo(annualRun.jsonPath, hybridAnnualRepoPath);
        const hybridAnnualMetrics = extractMetrics(readJson(hybridAnnualRepoPath));
        const annualRows = evaluateMetricRows({
          offMetrics: currentAnnualMetrics,
          onMetrics: hybridAnnualMetrics,
          targetMetrics: trustedBaselineMetrics,
          severeTolerance: 0.1
        });
        const annualGate = evaluateGate(annualRows, 4);
        decision = annualGate.pass
          ? {
              verdict: 'keep_candidate',
              nextMove: 'Phase 1 Climate Base Recovery on repaired bridged donor-base hybrid branch'
            }
          : {
              verdict: 'annual_reject',
              nextMove: 'Architecture C8: bridged hybrid climate attribution design'
            };
        quickRows = annualRows;
        quickGate = annualGate;
      }
    } else {
      decision = {
        verdict: 'quick_reject',
        nextMove: 'Architecture C8: bridged hybrid climate attribution design'
      };
    }

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      overlayFiles: OVERLAY_FILES,
      trustedBaselinePath: options.trustedBaselinePath,
      currentQuickPath,
      hybridQuickPath: hybridQuickRepoPath,
      hybridAnnualPath: hybridAnnualRepoPath,
      bridgeSummary,
      quickRows,
      quickGate,
      runContext,
      failure,
      decision
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, renderArchitectureC7Markdown({
      decision,
      bridgeSummary,
      quickRows,
      quickGate,
      currentQuickPath,
      hybridQuickPath: hybridQuickRepoPath,
      hybridAnnualPath: hybridAnnualRepoPath,
      runContext,
      failure
    }));
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, runContext })}\n`);
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
