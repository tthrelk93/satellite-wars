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
import { applyDonorCoreIntegrationBridge } from './earth-weather-architecture-c4-donor-core-integration-bridge.mjs';
import {
  buildCycleScopedOutputBase,
  runExplicitMainAudit,
  startCycleContract
} from './earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.mjs';
import { evaluateAnnualAbsoluteGate } from './earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.mjs';
import { applyInnerCoreEquatorialEddySofteningPatch } from './earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.mjs';

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
  'src/weather/v2/vertical5.js',
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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c28-weak-partial-shoulder-restore-experiment.json')
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

const replaceOnce = (text, needle, replacement) => {
  if (!text.includes(needle)) {
    throw new Error(`Expected to find patch needle: ${needle}`);
  }
  return text.replace(needle, replacement);
};

export function applyWeakPartialShoulderRestorePatch(worktreePath) {
  const basePatch = applyInnerCoreEquatorialEddySofteningPatch(worktreePath);

  const corePath = path.join(worktreePath, 'src', 'weather', 'v2', 'core5.js');
  let coreContent = fs.readFileSync(corePath, 'utf8');
  coreContent = replaceOnce(
    coreContent,
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 0,\n      equatorialSofteningLat1Deg: 10,\n      equatorialBlendToUnityFrac: 0.45\n',
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 0,\n      equatorialSofteningLat1Deg: 11,\n      equatorialBlendToUnityFrac: 0.47\n'
  );
  fs.writeFileSync(corePath, coreContent);

  const eddyPath = path.join(worktreePath, 'src', 'weather', 'v2', 'windEddyNudge5.js');
  let eddyContent = fs.readFileSync(eddyPath, 'utf8');
  eddyContent = replaceOnce(
    eddyContent,
    '    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 0,\n    equatorialSofteningLat1Deg = 10,\n    equatorialBlendToUnityFrac = 0.45\n',
    '    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 0,\n    equatorialSofteningLat1Deg = 11,\n    equatorialBlendToUnityFrac = 0.47\n'
  );
  fs.writeFileSync(eddyPath, eddyContent);

  return {
    patchedPaths: basePatch.patchedPaths,
    patchedParams: [
      ...basePatch.patchedParams,
      'windEddyParams.weakPartialShoulderRestoreLat1Deg',
      'windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac'
    ]
  };
}

export function classifyC28Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C29: weak partial shoulder restore attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the weak partial shoulder-restore hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C29: annual weak partial shoulder restore attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C29: annual weak partial shoulder restore gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC28Markdown({
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
    '# Earth Weather Architecture C28 Weak Partial Shoulder Restore Experiment',
    '',
    'This phase keeps the C24 inner-core narrowing, but restores only a weaker outer shoulder than C26. The goal is to preserve some of C26’s upper-branch and return-flow recovery without reloading the lower branch as strongly.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Implementation contract',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- patched paths: ${patchSummary.patchedPaths.map((value) => `\`${value}\``).join(', ')}`,
    `- patched params: ${patchSummary.patchedParams.join(', ')}`,
    '',
    '## Quick benchmark',
    '',
    `- current quick artifact: [${path.basename(currentQuickPath)}](${currentQuickPath})`,
    `- weak partial shoulder-restore quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c28-'));
  const worktreePath = path.join(tempParent, 'weak-partial-shoulder-restore-worktree');
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
    const patchSummary = applyWeakPartialShoulderRestorePatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c28-weak-partial-shoulder-restore',
      focusArea: 'weak partial equatorial shoulder restore experiment',
      blockerFamily: 'partial shoulder restore overcorrection',
      mode: 'quick',
      question: 'Can the donor/current hybrid preserve some of C26’s upper-branch relief while trimming the lower-branch reload?',
      hypothesis: 'If C26 was directionally right but slightly too strong, then a weaker 0–11° / 0.47 shoulder restore should keep part of the upper-branch and return-flow recovery while reducing the lower-branch and import rebound.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C27 showed that C26 slightly improved cross-equatorial flux, NH dry-belt ocean condensation, and upper-branch behavior relative to C24.',
        'Architecture C27 also showed that C26 reloaded the lower branch, 35° import burden, and cloud recirculation, which points to an over-strong shoulder restore rather than a wrong-sign direction.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north moves closer to the trusted positive range than C26 while preserving most of the C26 upper-branch / condensation gains.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'Weakening the shoulder simply falls back to the C24 state without fixing the sign defect.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c28-weak-partial-shoulder-restore-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`Weak partial shoulder-restore quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
    }

    copyArtifactIntoRepo(quickRun.jsonPath, options.hybridQuickPath);
    const quickSummary = readJson(quickRun.jsonPath);
    supportingArtifacts = copySupportingArtifacts(quickSummary, options.hybridQuickPath);

    const hybridQuickMetrics = extractMetrics(readJson(options.hybridQuickPath));
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
        slug: 'earth-weather-architecture-c28-weak-partial-shoulder-restore-annual',
        focusArea: 'weak partial shoulder restore annual gate',
        blockerFamily: 'weak shoulder restore annual verification',
        mode: 'annual',
        question: 'Does the weak partial shoulder-restore hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If C26 overshot the right restore amplitude, then a weaker shoulder restore should annualize better while preserving the useful direction of change.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C27 localized the tradeoff to upper-branch recovery versus lower/import reload under C26.'
        ],
        passCriteria: [
          'Annual absolute gate passes.'
        ],
        failCriteria: [
          'Annual absolute gate fails.'
        ]
      });
      const annualOutputBase = buildCycleScopedOutputBase(
        annualCycle.cycleDir,
        'earth-weather-architecture-c28-weak-partial-shoulder-restore-annual'
      );
      const annualRun = runExplicitMainAudit({
        scriptPath: worktreeAuditScript,
        repoPath: worktreePath,
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

    const decision = classifyC28Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c28-weak-partial-shoulder-restore-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC28Markdown({
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
      execFileSync('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: repoRoot,
        stdio: ['ignore', 'ignore', 'ignore']
      });
    } catch {}
    fs.rmSync(tempParent, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
