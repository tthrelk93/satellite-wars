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
  'src/weather/v2/windNudge5.js',
  'src/weather/v2/windEddyNudge5.js',
  'src/weather/v2/nudging5.js',
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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.json')
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
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

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

const replaceOnce = (text, needle, replacement) => {
  if (!text.includes(needle)) {
    throw new Error(`Expected to find patch needle: ${needle}`);
  }
  return text.replace(needle, replacement);
};

export function applyEquatorialOverturningSignContractPatch(worktreePath) {
  const corePath = path.join(worktreePath, 'src', 'weather', 'v2', 'core5.js');
  let content = fs.readFileSync(corePath, 'utf8');
  content = replaceOnce(
    content,
    '      tauQvS: 30 * 86400,\n',
    '      tauQvS: 45 * 86400,\n'
  );
  content = replaceOnce(
    content,
    '      landQvNudgeScale: 0.5,\n      oceanQvNudgeScale: 1.0,\n',
    '      landQvNudgeScale: 0.5,\n      oceanQvNudgeScale: 1.0,\n      organizedConvectionQvSurfaceRelief: 0.85,\n      organizedConvectionQvColumnRelief: 1.05,\n      organizedConvectionThetaColumnRelief: 0.55,\n      subtropicalSubsidenceQvRelief: 1.65,\n'
  );
  content = replaceOnce(
    content,
    '      tauQvColumn: 12 * 86400,\n',
    '      tauQvColumn: 18 * 86400,\n'
  );
  content = replaceOnce(
    content,
    '      tauSurfaceSeconds: 7 * 86400,\n',
    '      tauSurfaceSeconds: 8 * 3600,\n'
  );
  fs.writeFileSync(corePath, content);
  return {
    patchedCorePath: path.relative(worktreePath, corePath),
    patchedParams: [
      'nudgeParams.tauQvS',
      'nudgeParams.tauQvColumn',
      'nudgeParams organized/subsidence relief quartet',
      'windNudgeParams.tauSurfaceSeconds'
    ]
  };
}

export function classifyC13Decision({ quickGatePass, severeRegressions = [], annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C14: sign-contract implementation attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the equatorial-sign hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C14: annual sign-contract attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C14: annual sign-contract gate completion'
  };
}

export function evaluateAnnualAbsoluteGate(metrics = {}) {
  const checks = {
    itczWidthDeg: Number.isFinite(metrics.itczWidthDeg) && metrics.itczWidthDeg <= 24.2,
    subtropicalDryNorthRatio: Number.isFinite(metrics.subtropicalDryNorthRatio) && metrics.subtropicalDryNorthRatio <= 1.2,
    subtropicalDrySouthRatio: Number.isFinite(metrics.subtropicalDrySouthRatio) && metrics.subtropicalDrySouthRatio <= 0.8,
    midlatitudeWesterliesNorthU10Ms: Number.isFinite(metrics.midlatitudeWesterliesNorthU10Ms) && metrics.midlatitudeWesterliesNorthU10Ms >= 0.95,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: Number.isFinite(metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2) && metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 <= 0.18,
    crossEquatorialVaporFluxNorthKgM_1S: Number.isFinite(metrics.crossEquatorialVaporFluxNorthKgM_1S) && metrics.crossEquatorialVaporFluxNorthKgM_1S >= 75 && metrics.crossEquatorialVaporFluxNorthKgM_1S <= 250
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    checks,
    passedCount: passed,
    pass: passed === Object.keys(checks).length
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC13Markdown({
  decision,
  quickRows,
  quickGate,
  annualGate,
  currentQuickPath,
  hybridQuickPath,
  hybridAnnualPath,
  supportingArtifacts,
  bridgeSummary,
  patchSummary
}) {
  const lines = [
    '# Earth Weather Architecture C13 Equatorial Overturning Sign Contract Experiment',
    '',
    'This phase implements the Architecture C12 preserve-layer contract: keep the donor circulation scaffold, forward-port the current low-level momentum/nudging preserve layer, and patch only the donor-core low-level sign-control defaults.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Implementation contract',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- patched core path: \`${patchSummary.patchedCorePath}\``,
    `- patched params: ${patchSummary.patchedParams.join(', ')}`,
    '',
    '## Quick benchmark',
    '',
    `- current quick artifact: [${path.basename(currentQuickPath)}](${currentQuickPath})`,
    `- sign-contract quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
    ''
  ];

  if (quickRows) {
    lines.push(renderRows(quickRows));
    lines.push('');
    lines.push(`- improved metrics: ${quickGate.improvedCount} / ${quickRows.length}`);
    lines.push(`- severe regressions: ${quickGate.severeRegressions.length ? quickGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- quick gate pass: ${quickGate.pass}`);
    lines.push('');
  }

  if (hybridAnnualPath) {
    lines.push('## Annual gate');
    lines.push('');
    lines.push(`- annual artifact: [${path.basename(hybridAnnualPath)}](${hybridAnnualPath})`);
    lines.push(`- annual gate pass: ${annualGate.pass}`);
    lines.push(`- annual checks passed: ${annualGate.passedCount} / ${Object.keys(annualGate.checks).length}`);
    lines.push('');
  }

  if (Object.keys(supportingArtifacts).length) {
    lines.push('## Copied supporting artifacts');
    lines.push('');
    for (const [key, filePath] of Object.entries(supportingArtifacts)) {
      lines.push(`- ${key}: [${path.basename(filePath)}](${filePath})`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c13-'));
  const worktreePath = path.join(tempParent, 'sign-worktree');
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = applyEquatorialOverturningSignContractPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c13-sign-contract',
      focusArea: 'equatorial overturning sign contract experiment',
      blockerFamily: 'equatorial overturning polarity',
      mode: 'quick',
      question: 'Can a current low-level momentum/nudging preserve layer restore equatorial overturning sign while keeping the donor-hybrid dry-belt and NH-westerly gains?',
      hypothesis: 'Overlaying current wind/nudging modules and porting only the donor-core low-level sign-control params will restore northward equatorial overturning without losing the repaired hybrid circulation wins.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C11 isolated the remaining blocker to equatorial overturning polarity inversion.',
        'Current-vs-donor core diff shows the sharpest low-level sign-control changes in wind/nudging defaults.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north stays positive and within climate gate range.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'The quick gate still fails despite preserving the donor dry-belt improvements.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c13-sign-contract-quick'
    );
    const quickRun = runExplicitMainAudit({
      cwd: worktreePath,
      scriptPath: worktreeAuditScript,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`Sign-contract quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
    }

    copyArtifactIntoRepo(quickRun.jsonPath, options.hybridQuickPath);
    const hybridQuickSummary = readJson(options.hybridQuickPath);
    supportingArtifacts = copySupportingArtifacts(hybridQuickSummary, options.hybridQuickPath);
    const hybridQuickMetrics = extractMetrics(hybridQuickSummary);
    const quickRows = evaluateMetricRows({
      offMetrics: currentQuickMetrics,
      onMetrics: hybridQuickMetrics,
      targetMetrics: trustedBaselineMetrics,
      severeTolerance: 0.05
    });
    const quickGate = evaluateGate(quickRows, 4);

    if (quickGate.pass) {
      const annualCycle = startCycleContract({
        repoPath: worktreePath,
        slug: 'earth-weather-architecture-c13-sign-contract-annual',
        focusArea: 'equatorial overturning sign annual gate',
        blockerFamily: 'equatorial overturning polarity annual verification',
        mode: 'annual',
        question: 'Does the quick-passing sign-contract hybrid keep a realistic circulation over an annual run?',
        hypothesis: 'If the sign contract is physically right, the restored equatorial overturning should survive annual gating rather than collapsing outside the 30-day horizon.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/windNudge5.js',
          'src/weather/v2/windEddyNudge5.js',
          'src/weather/v2/nudging5.js'
        ],
        evidence: [
          'Quick gate passed for the sign-contract hybrid experiment.'
        ],
        passCriteria: [
          'Annual absolute gate passes all six checks.'
        ],
        failCriteria: [
          'Annual absolute gate fails any circulation-critical check.'
        ]
      });

      const annualOutputBase = buildCycleScopedOutputBase(
        annualCycle.cycleDir,
        'earth-weather-architecture-c13-sign-contract-annual'
      );
      const annualRun = runExplicitMainAudit({
        cwd: worktreePath,
        scriptPath: worktreeAuditScript,
        preset: 'annual',
        outputBase: annualOutputBase,
        cycleDir: annualCycle.cycleDir
      });
      if (annualRun.ok) {
        hybridAnnualPath = options.hybridAnnualPath;
        copyArtifactIntoRepo(annualRun.jsonPath, hybridAnnualPath);
        annualGate = evaluateAnnualAbsoluteGate(extractMetrics(readJson(hybridAnnualPath)));
      }
    }

    const decision = classifyC13Decision({
      quickGatePass: quickGate.pass,
      severeRegressions: quickGate.severeRegressions,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      currentQuickPath: options.currentQuickPath,
      hybridQuickPath: options.hybridQuickPath,
      hybridAnnualPath,
      bridgeSummary,
      patchSummary,
      supportingArtifacts,
      quickRows,
      quickGate,
      annualGate,
      decision
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, renderArchitectureC13Markdown({
      decision,
      quickRows,
      quickGate,
      annualGate,
      currentQuickPath: options.currentQuickPath,
      hybridQuickPath: options.hybridQuickPath,
      hybridAnnualPath,
      supportingArtifacts,
      bridgeSummary,
      patchSummary
    }));
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, quickGate, annualGate })}\n`);
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
