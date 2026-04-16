#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  evaluateMetricRows,
  evaluateGate
} from './earth-weather-architecture-c2-donor-base-hybrid-benchmark.mjs';
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
const trustedBaselinePath = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1-hadley-second-pass-restore-v4.json'
);

const SUPPORT_ARTIFACT_KEYS = [
  'monthlyClimatologyJsonPath',
  'moistureAttributionJsonPath',
  'transportInterfaceBudgetJsonPath',
  'hadleyPartitionSummaryJsonPath',
  'thermodynamicSupportSummaryJsonPath',
  'nhDryBeltSourceSectorSummaryJsonPath'
];

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

const defaults = {
  trustedBaselinePath,
  currentQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-quick.json'),
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c10-bridged-hybrid-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c10-bridged-hybrid-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--trusted-baseline' && argv[i + 1]) options.trustedBaselinePath = path.resolve(argv[++i]);
  else if (arg === '--current-quick' && argv[i + 1]) options.currentQuickPath = path.resolve(argv[++i]);
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

const buildRepoSupportArtifactPath = (repoOutputPath, sourceArtifactPath) => {
  const repoDir = path.dirname(repoOutputPath);
  return path.join(repoDir, path.basename(sourceArtifactPath));
};

const copySupportingArtifacts = (summaryJson, repoOutputPath) => {
  const copied = {};
  for (const key of SUPPORT_ARTIFACT_KEYS) {
    const sourcePath = summaryJson?.artifacts?.[key];
    if (!sourcePath || !fs.existsSync(sourcePath)) continue;
    const targetPath = buildRepoSupportArtifactPath(repoOutputPath, sourcePath);
    copyArtifactIntoRepo(sourcePath, targetPath);
    copied[key] = targetPath;
  }
  return copied;
};

export function classifyC10Decision({ quickGatePass, improvedCount, severeRegressions = [], annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C11: cycled hybrid flux inversion attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the donor/current hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C11: cycled hybrid annual attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C11: annual baseline completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC10Markdown({
  decision,
  quickRows,
  quickGate,
  currentQuickPath,
  hybridQuickPath,
  hybridAnnualPath,
  supportingArtifacts,
  bridgeSummary,
  failure
}) {
  const lines = [
    '# Earth Weather Architecture C10 Cycled Hybrid Benchmark Rerun',
    '',
    'This phase reruns the bridged donor/current hybrid benchmark after restoring both the donor-worktree cycle contract and the missing terrain fixture runtime contract.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Hybrid runtime status',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
    `- annual artifact: ${hybridAnnualPath ? `[${path.basename(hybridAnnualPath)}](${hybridAnnualPath})` : 'not run'}`,
    ''
  ];

  if (Object.keys(supportingArtifacts).length) {
    lines.push('## Copied supporting artifacts');
    lines.push('');
    for (const [key, filePath] of Object.entries(supportingArtifacts)) {
      lines.push(`- ${key}: [${path.basename(filePath)}](${filePath})`);
    }
    lines.push('');
  }

  if (quickRows) {
    lines.push('## Quick benchmark');
    lines.push('');
    lines.push(`- current quick artifact: [${path.basename(currentQuickPath)}](${currentQuickPath})`);
    lines.push(`- hybrid quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`);
    lines.push('');
    lines.push(renderRows(quickRows));
    lines.push('');
    lines.push(`- improved metrics: ${quickGate.improvedCount} / ${quickRows.length}`);
    lines.push(`- severe regressions: ${quickGate.severeRegressions.length ? quickGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- quick gate pass: ${quickGate.pass}`);
    lines.push('');
  }

  if (failure) {
    lines.push('## Failure');
    lines.push('');
    lines.push(`- ${failure}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c10-'));
  const worktreePath = path.join(tempParent, 'benchmark-worktree');
  let hybridAnnualPath = null;
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

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c10-bridged-hybrid',
      focusArea: 'cycled donor/current hybrid benchmark rerun',
      blockerFamily: 'donor/current hybrid climate benchmark',
      mode: 'quick',
      question: 'After restoring donor-worktree cycle and runtime contracts, does the bridged donor/current hybrid beat the current quick climate baseline strongly enough to justify annual gating?',
      hypothesis: 'With donor-worktree integration contracts repaired, the bridged donor/current hybrid should now produce a real quick benchmark that can be judged against the current branch on full climate metrics.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/microphysics5.js',
        'scripts/agent/planetary-realism-audit.mjs'
      ],
      evidence: [
        'Architecture C9 restored the bridged hybrid quick artifact path.'
      ],
      passCriteria: [
        'The hybrid quick rerun improves at least 4 / 6 core metrics with no severe regressions.'
      ],
      failCriteria: [
        'The hybrid quick rerun still fails the 4 / 6 quick gate.',
        'Any quick rerun severe regression appears on a core metric.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c10-bridged-hybrid-quick'
    );
    const quickRun = runExplicitMainAudit({
      cwd: worktreePath,
      scriptPath: worktreeAuditScript,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });

    if (!quickRun.ok) {
      throw new Error(`Hybrid quick rerun failed before artifact creation. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
    }

    copyArtifactIntoRepo(quickRun.jsonPath, options.hybridQuickPath);
    const hybridQuickSummary = readJson(options.hybridQuickPath);
    const supportingArtifacts = copySupportingArtifacts(hybridQuickSummary, options.hybridQuickPath);
    const hybridQuickMetrics = extractMetrics(hybridQuickSummary);
    const quickRows = evaluateMetricRows({
      offMetrics: currentQuickMetrics,
      onMetrics: hybridQuickMetrics,
      targetMetrics: trustedBaselineMetrics,
      severeTolerance: 0.05
    });
    const quickGate = evaluateGate(quickRows, 4);

    let annualGate = null;
    if (quickGate.pass) {
      const annualCycle = startCycleContract({
        repoPath: worktreePath,
        slug: 'earth-weather-architecture-c10-bridged-hybrid-annual',
        focusArea: 'cycled donor/current hybrid annual benchmark',
        blockerFamily: 'donor/current hybrid annual benchmark',
        mode: 'annual',
        question: 'Does the quick-passing donor/current hybrid keep its gains over an annual run?',
        hypothesis: 'If the hybrid quick gate passes cleanly, the same hybrid should remain competitive over the annual climate gate.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/microphysics5.js',
          'scripts/agent/planetary-realism-audit.mjs'
        ],
        evidence: [
          'Quick gate passed for the repaired donor/current hybrid benchmark.'
        ],
        passCriteria: [
          'Annual gate passes without severe climate regressions.'
        ],
        failCriteria: [
          'Annual gate fails or severe regressions appear.'
        ]
      });
      const annualOutputBase = buildCycleScopedOutputBase(
        annualCycle.cycleDir,
        'earth-weather-architecture-c10-bridged-hybrid-annual'
      );
      const annualRun = runExplicitMainAudit({
        cwd: worktreePath,
        scriptPath: worktreeAuditScript,
        preset: 'annual',
        outputBase: annualOutputBase,
        cycleDir: annualCycle.cycleDir
      });
      if (!annualRun.ok) {
        failure = `Annual rerun failed before artifact creation. stderr=${(annualRun.stderr || '').trim().slice(0, 400)}`;
      } else {
        hybridAnnualPath = options.hybridAnnualPath;
        copyArtifactIntoRepo(annualRun.jsonPath, hybridAnnualPath);
        const hybridAnnualMetrics = extractMetrics(readJson(hybridAnnualPath));
        const annualRows = evaluateMetricRows({
          offMetrics: currentQuickMetrics,
          onMetrics: hybridAnnualMetrics,
          targetMetrics: trustedBaselineMetrics,
          severeTolerance: 0.1
        });
        annualGate = evaluateGate(annualRows, 4);
      }
    }

    const decision = classifyC10Decision({
      quickGatePass: quickGate.pass,
      improvedCount: quickGate.improvedCount,
      severeRegressions: quickGate.severeRegressions,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      currentQuickPath: options.currentQuickPath,
      hybridQuickPath: options.hybridQuickPath,
      hybridAnnualPath,
      bridgeSummary,
      supportingArtifacts,
      quickRows,
      quickGate,
      annualGate,
      failure,
      decision
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, renderArchitectureC10Markdown({
      decision,
      quickRows,
      quickGate,
      currentQuickPath: options.currentQuickPath,
      hybridQuickPath: options.hybridQuickPath,
      hybridAnnualPath,
      supportingArtifacts,
      bridgeSummary,
      failure
    }));
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, quickGate, annualGate, supportingArtifacts })}\n`);
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
