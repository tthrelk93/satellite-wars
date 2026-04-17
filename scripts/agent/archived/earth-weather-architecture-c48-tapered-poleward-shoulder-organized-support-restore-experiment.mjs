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
import { applyOrganizedSupportCarryInputCarveoutPatch } from './earth-weather-architecture-c32-organized-support-carry-input-carveout-experiment.mjs';

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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-experiment.json')
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

export function applyTaperedPolewardShoulderOrganizedSupportRestorePatch(worktreePath) {
  const basePatch = applyOrganizedSupportCarryInputCarveoutPatch(worktreePath);

  const verticalPath = path.join(worktreePath, 'src', 'weather', 'v2', 'vertical5.js');
  let content = fs.readFileSync(verticalPath, 'utf8');
  content = replaceOnce(
    content,
    '      if ((freshOrganizedSupportDiag[k] || 0) > carryInputOrganizedSupportMax) continue;\n',
    [
      '      const rowIndex = Math.floor(k / nx);',
      '      const latAbs = Math.abs(grid.latDeg?.[rowIndex] ?? 0);',
      '      const taperedPolewardShoulderOrganizedSupportRestoreFrac = grid.latDeg',
      '        ? smoothstep(24, 26, latAbs) * (1 - smoothstep(30, 36, latAbs))',
      '        : 0;',
      '      const effectiveCarryInputOrganizedSupportMax = carryInputOrganizedSupportMax',
      '        + taperedPolewardShoulderOrganizedSupportRestoreFrac * Math.max(0, 0.47 - carryInputOrganizedSupportMax);',
      '      if ((freshOrganizedSupportDiag[k] || 0) > effectiveCarryInputOrganizedSupportMax) continue;'
    ].join('\n') + '\n'
  );
  fs.writeFileSync(verticalPath, content);

  return {
    patchedPaths: [...basePatch.patchedPaths, path.relative(worktreePath, verticalPath)],
    patchedParams: [
      ...basePatch.patchedParams,
      'vertical5.taperedPolewardShoulderOrganizedSupportRestoreLat0Deg',
      'vertical5.taperedPolewardShoulderOrganizedSupportRestoreLat1Deg',
      'vertical5.taperedPolewardShoulderOrganizedSupportRestoreLat2Deg',
      'vertical5.taperedPolewardShoulderOrganizedSupportRestoreLat3Deg',
      'vertical5.taperedPolewardShoulderOrganizedSupportRestoreMax'
    ]
  };
}

export function classifyC48Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C49: tapered poleward-shoulder organized-support restore attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the tapered poleward-shoulder organized-support restore hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C49: annual tapered poleward-shoulder organized-support restore attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C49: annual tapered poleward-shoulder organized-support restore gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC48Markdown({
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
    '# Earth Weather Architecture C48 Tapered Poleward-Shoulder Organized-Support Restore Experiment',
    '',
    'This phase keeps the strict C32 organized-support / potential carveout fixed in the equatorial core, keeps the `26.25°` lane fully restored, and tapers the `33.75°` poleward shoulder down toward the smaller C40-level restore. The goal is to avoid snapping back to the full C30 recapture regime while keeping the only live coupled-shoulder signal active.',
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
    `- tapered poleward-shoulder organized-support restore quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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

  const supportEntries = Object.entries(supportingArtifacts || {});
  if (supportEntries.length) {
    lines.push('## Supporting artifacts');
    lines.push('');
    for (const [key, value] of supportEntries) {
      lines.push(`- ${key}: [${path.basename(value)}](${value})`);
    }
    lines.push('');
  }

  lines.push('## Interpretation');
  lines.push('');
  lines.push('- Architecture C47 showed the full-strength `26.25°–33.75°` coupled shoulder simply reopens the older C30 weak-restore recapture regime.');
  lines.push('- This experiment keeps the live `26.25°` shoulder signal but tapers the `33.75°` side toward the smaller C40-level restore instead of reopening the full C30-strength poleward shoulder.');
  lines.push('- The bounded question is whether shoulder amplitude, rather than shoulder presence itself, is the real control on this subfamily.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c48-'));
  const worktreePath = path.join(tempParent, 'tapered-poleward-shoulder-restore-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = applyTaperedPolewardShoulderOrganizedSupportRestorePatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore',
      focusArea: 'tapered poleward-shoulder organized-support restore experiment',
      blockerFamily: 'testing whether shoulder amplitude rather than shoulder presence controls the coupled C30 snapback',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the live 26.25° shoulder signal while tapering the 33.75° poleward shoulder enough to avoid snapping back to the full C30 recapture regime?',
      hypothesis: 'If C46 failed because the poleward shoulder was restored too strongly, then keeping 26.25° fully active while tapering 33.75° toward the smaller C40-level restore should create a more useful intermediate state.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C47 showed the full coupled 26.25°–33.75° shoulder reproduces C30 exactly.',
        'Architecture C40 showed a smaller poleward-shoulder signal exists when 33.75° is only partially restored.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north improves relative to C32 without reopening the full C30 receiver tradeoff.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'The experiment either snaps back to C30 again or collapses back to the strict C32 carveout.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`tapered poleward-shoulder organized-support restore quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
    }

    copyArtifactIntoRepo(quickRun.jsonPath, options.hybridQuickPath);
    const quickSummary = readJson(quickRun.jsonPath);
    supportingArtifacts = copySupportingArtifacts(quickSummary, options.hybridQuickPath);

    const quickMetrics = extractMetrics(readJson(options.hybridQuickPath));
    const quickRows = evaluateMetricRows({
      offMetrics: currentQuickMetrics,
      onMetrics: quickMetrics,
      targetMetrics: trustedBaselineMetrics,
      severeTolerance: 0.05
    });
    const quickGate = evaluateGate(quickRows, 4);

    if (quickGate.pass) {
      const annualCycle = startCycleContract({
        repoPath: worktreePath,
        slug: 'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-annual',
        focusArea: 'tapered poleward-shoulder organized-support restore annual gate',
        blockerFamily: 'tapered poleward-shoulder annual verification',
        mode: 'annual',
        question: 'Does the tapered poleward-shoulder organized-support restore hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the poleward-shoulder amplitude is the real binder, then tapering 33.75° while keeping 26.25° active should annualize better than the full C46 shoulder restore.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C47 showed the full coupled shoulder reproduces C30 exactly, so the next bounded lever is shoulder amplitude rather than shoulder presence.'
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
        'earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-annual'
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

    const decision = classifyC48Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c48-tapered-poleward-shoulder-organized-support-restore-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC48Markdown({
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
    } catch {
      // ignore cleanup failures
    }
    fs.rmSync(tempParent, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
