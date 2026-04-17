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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-experiment.json')
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

export function applyPartial26p25ReceiverGuardTransitionBandPatch(worktreePath) {
  const basePatch = applyOrganizedSupportCarryInputCarveoutPatch(worktreePath);

  const verticalPath = path.join(worktreePath, 'src', 'weather', 'v2', 'vertical5.js');
  let content = fs.readFileSync(verticalPath, 'utf8');
  content = replaceOnce(
    content,
    '      if ((freshOrganizedSupportDiag[k] || 0) > carryInputOrganizedSupportMax) continue;\n',
    [
      '      const rowIndex = Math.floor(k / nx);',
      '      const latAbs = Math.abs(grid.latDeg?.[rowIndex] ?? 0);',
      '      const transitionBandOrganizedSupportRestoreFrac = grid.latDeg',
      '        ? smoothstep(12, 18, latAbs) * (1 - smoothstep(30, 36, latAbs))',
      '        : 0;',
      '      const receiverGuard26p25Frac = grid.latDeg',
      '        ? smoothstep(24, 26, latAbs) * (1 - smoothstep(28, 30, latAbs))',
      '        : 0;',
      '      const guardedTransitionBandOrganizedSupportRestoreMax = 0.47',
      '        - receiverGuard26p25Frac * 0.025;',
      '      const effectiveCarryInputOrganizedSupportMax = carryInputOrganizedSupportMax',
      '        + transitionBandOrganizedSupportRestoreFrac * Math.max(0, guardedTransitionBandOrganizedSupportRestoreMax - carryInputOrganizedSupportMax);',
      '      if ((freshOrganizedSupportDiag[k] || 0) > effectiveCarryInputOrganizedSupportMax) continue;'
    ].join('\n') + '\n'
  );
  fs.writeFileSync(verticalPath, content);

  return {
    patchedPaths: [...basePatch.patchedPaths, path.relative(worktreePath, verticalPath)],
    patchedParams: [
      ...basePatch.patchedParams,
      'vertical5.transitionBandOrganizedSupportRestoreLat0Deg',
      'vertical5.transitionBandOrganizedSupportRestoreLat1Deg',
      'vertical5.transitionBandOrganizedSupportRestoreLat2Deg',
      'vertical5.transitionBandOrganizedSupportRestoreLat3Deg',
      'vertical5.transitionBand26p25ReceiverGuardLat0Deg',
      'vertical5.transitionBand26p25ReceiverGuardLat1Deg',
      'vertical5.transitionBand26p25ReceiverGuardLat2Deg',
      'vertical5.transitionBand26p25ReceiverGuardLat3Deg',
      'vertical5.transitionBand26p25ReceiverGuardPenalty'
    ]
  };
}

export function classifyC50Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C51: partial 26p25 receiver-guard transition-band attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the partial 26p25 receiver-guard transition-band track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C51: annual partial 26p25 receiver-guard transition-band attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C51: annual partial 26p25 receiver-guard transition-band gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC50Markdown({
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
    '# Earth Weather Architecture C50 Partial 26p25 Receiver-Guard Transition-Band Experiment',
    '',
    'This phase keeps the strict C32 organized-support / potential carveout fixed in the equatorial core and keeps the proven C40 transition-band restore active, but it partially guards the `26.25°` receiver lane. The goal is to preserve the small C40 sign-relief signal while reducing the modest inner dry-belt reload that comes with that regime.',
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
    `- partial 26p25 receiver-guard transition-band quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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
  lines.push('- Architecture C49 showed the tapered shoulder is not a new family state; it reproduces the earlier C40 transition-band regime exactly.');
  lines.push('- This experiment keeps that live transition-band geometry but partially guards the `26.25°` receiver lane instead of reworking the shoulder again.');
  lines.push('- The bounded question is whether a smaller `26.25°` reload can preserve the small sign-relief signal without collapsing back to C32 or reopening the broader C30 tradeoff.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c50-'));
  const worktreePath = path.join(tempParent, 'partial-26p25-receiver-guard-transition-band-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = applyPartial26p25ReceiverGuardTransitionBandPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band',
      focusArea: 'partial 26p25 receiver-guard transition-band experiment',
      blockerFamily: 'testing whether a smaller 26.25 receiver reload can preserve the live C40 sign-relief signal',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the live C40 transition-band restore active while partially guarding the 26.25° receiver lane enough to reduce reload without losing the sign-relief signal?',
      hypothesis: 'If the remaining C40/C48 defect is primarily the modest 26.25° receiver reload, then partially guarding that row should create a better intermediate state than either strict C32 or the unguarded C40 regime.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C49 showed C48 reproduces C40 exactly.',
        'Architecture C41 showed the remaining C40 sign-relief comes with a small but live 26.25° receiver reload.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north improves relative to C40/C48 while avoiding a worse NH dry-belt receiver reload.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'The experiment collapses back to C32 or otherwise loses the small live C40 signal without reducing receiver reload materially.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`partial 26p25 receiver-guard transition-band quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
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
        slug: 'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-annual',
        focusArea: 'partial 26p25 receiver-guard transition-band annual gate',
        blockerFamily: 'partial 26p25 receiver-guard transition-band annual verification',
        mode: 'annual',
        question: 'Does the partial 26.25° receiver-guard transition-band hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the 26.25° receiver reload is the real remaining binder inside the C40 regime, then partially guarding that row should annualize better than the unguarded C40/C48 state.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C49 showed the live C40 state survives tapering exactly, so the next bounded lever is a guarded 26.25° receiver lane.'
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
        'earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-annual'
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

    const decision = classifyC50Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC50Markdown({
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
