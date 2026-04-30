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
import { apply26p25ReceiverCarryoverContainmentTransitionBandPatch } from './earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-experiment.mjs';

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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-experiment.json')
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

export function apply26p25CarryoverContainmentWith18p75TransitionCarryInputPreservePatch(worktreePath) {
  const basePatch = apply26p25ReceiverCarryoverContainmentTransitionBandPatch(worktreePath);

  const verticalPath = path.join(worktreePath, 'src', 'weather', 'v2', 'vertical5.js');
  let content = fs.readFileSync(verticalPath, 'utf8');
  content = replaceOnce(
    content,
    [
      '      const actualInputMass = verticalUpperCloudInputMass[k] || 0;',
      '      if (!(actualInputMass >= carryInputMinResidualMassKgM2)) continue;',
      '      if ((freshPotentialTargetDiag[k] || 0) > carryInputPotentialMax) continue;',
      '      const rowIndex = Math.floor(k / nx);',
      '      const latAbs = Math.abs(grid.latDeg?.[rowIndex] ?? 0);',
      '      const transitionBandOrganizedSupportRestoreFrac = grid.latDeg',
      '        ? smoothstep(12, 18, latAbs) * (1 - smoothstep(30, 36, latAbs))',
      '        : 0;',
      '      const effectiveCarryInputOrganizedSupportMax = carryInputOrganizedSupportMax',
      '        + transitionBandOrganizedSupportRestoreFrac * Math.max(0, 0.47 - carryInputOrganizedSupportMax);',
      '      if ((freshOrganizedSupportDiag[k] || 0) > effectiveCarryInputOrganizedSupportMax) continue;',
      '      if ((freshSubtropicalSuppressionDiag[k] || 0) < carryInputSubtropicalSuppressionMin) continue;'
    ].join('\n'),
    [
      '      const actualInputMass = verticalUpperCloudInputMass[k] || 0;',
      '      const rowIndex = Math.floor(k / nx);',
      '      const latAbs = Math.abs(grid.latDeg?.[rowIndex] ?? 0);',
      '      const transitionBandOrganizedSupportRestoreFrac = grid.latDeg',
      '        ? smoothstep(12, 18, latAbs) * (1 - smoothstep(30, 36, latAbs))',
      '        : 0;',
      '      const transitionCarryInputPreserve18p75Frac = grid.latDeg',
      '        ? smoothstep(16, 18, latAbs) * (1 - smoothstep(22, 24, latAbs))',
      '        : 0;',
      '      const effectiveCarryInputMinResidualMassKgM2 = Math.max(',
      '        0.9,',
      '        carryInputMinResidualMassKgM2',
      '          - transitionCarryInputPreserve18p75Frac * Math.max(0, carryInputMinResidualMassKgM2 - 0.9)',
      '      );',
      '      const effectiveCarryInputPotentialMax = carryInputPotentialMax',
      '        + transitionCarryInputPreserve18p75Frac * Math.max(0, 0.48 - carryInputPotentialMax);',
      '      const transitionBandCarryInputOrganizedSupportMax = carryInputOrganizedSupportMax',
      '        + transitionBandOrganizedSupportRestoreFrac * Math.max(0, 0.47 - carryInputOrganizedSupportMax);',
      '      const effectiveCarryInputOrganizedSupportMax = transitionBandCarryInputOrganizedSupportMax',
      '        + transitionCarryInputPreserve18p75Frac * Math.max(0, 0.48 - transitionBandCarryInputOrganizedSupportMax);',
      '      const effectiveCarryInputSubtropicalSuppressionMin = carryInputSubtropicalSuppressionMin',
      '        - transitionCarryInputPreserve18p75Frac * Math.max(0, carryInputSubtropicalSuppressionMin - 0.5);',
      '      const effectiveCarryInputDominanceMin = carryInputDominanceMin',
      '        - transitionCarryInputPreserve18p75Frac * Math.max(0, carryInputDominanceMin - 0.64);',
      '      if (!(actualInputMass >= effectiveCarryInputMinResidualMassKgM2)) continue;',
      '      if ((freshPotentialTargetDiag[k] || 0) > effectiveCarryInputPotentialMax) continue;',
      '      if ((freshOrganizedSupportDiag[k] || 0) > effectiveCarryInputOrganizedSupportMax) continue;',
      '      if ((freshSubtropicalSuppressionDiag[k] || 0) < effectiveCarryInputSubtropicalSuppressionMin) continue;'
    ].join('\n')
  );
  content = replaceOnce(
    content,
    '      if (carryInputDominance < carryInputDominanceMin) continue;\n',
    '      if (carryInputDominance < effectiveCarryInputDominanceMin) continue;\n'
  );
  fs.writeFileSync(verticalPath, content);

  return {
    patchedPaths: [...basePatch.patchedPaths, path.relative(worktreePath, verticalPath)],
    patchedParams: [
      ...basePatch.patchedParams,
      'vertical5.transitionCarryInputPreserve18p75Lat0Deg',
      'vertical5.transitionCarryInputPreserve18p75Lat1Deg',
      'vertical5.transitionCarryInputPreserve18p75Lat2Deg',
      'vertical5.transitionCarryInputPreserve18p75Lat3Deg',
      'vertical5.transitionCarryInputPreserve18p75MinResidualMassFloor',
      'vertical5.transitionCarryInputPreserve18p75PotentialMax',
      'vertical5.transitionCarryInputPreserve18p75OrganizedSupportMax',
      'vertical5.transitionCarryInputPreserve18p75SuppressionMin',
      'vertical5.transitionCarryInputPreserve18p75DominanceMin'
    ]
  };
}

export function classifyC58Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C59: 26p25 carryover containment with 18p75 transition carry-input preserve attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the 26p25 carryover containment with 18p75 transition carry-input preserve track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C59: annual 26p25 carryover containment with 18p75 transition carry-input preserve attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C59: annual 26p25 carryover containment with 18p75 transition carry-input preserve gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC58Markdown({
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
    '# Earth Weather Architecture C58 26p25 Carryover Containment With 18p75 Transition Carry-Input Preserve Experiment',
    '',
    'This phase keeps the active C54 `26.25°` receiver carryover-containment lane, but broadens the `18.75°` preserve from a single organized-support cap into a local transition carry-input contract. The goal is to recover the `18.75°` transition-export lane without giving back the receiver relief.',
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
    `- 26p25 carryover containment with 18p75 transition carry-input preserve quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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
  lines.push('- Architecture C57 showed the narrow `18.75°` organized-support-only preserve was completely inert relative to C54.');
  lines.push('- This experiment therefore preserves the broader local transition carry-input contract around `18.75°`: organized-support max, potential max, subtropical-suppression floor, dominance floor, and minimum residual-mass gate.');
  lines.push('- The bounded question is whether that broader local carry-input preserve can improve the export side while keeping the active `26.25°` receiver containment intact.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c58-'));
  const worktreePath = path.join(tempParent, '26p25-carryover-containment-with-18p75-transition-carry-input-preserve-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = apply26p25CarryoverContainmentWith18p75TransitionCarryInputPreservePatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve',
      focusArea: '26p25 carryover containment with 18p75 transition carry-input preserve experiment',
      blockerFamily: 'testing whether the active receiver carryover containment can be kept while restoring the broader equatorward transition carry-input lane',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the active 26.25° receiver carryover containment while preserving the 18.75° transition carry-input contract enough to reduce the export-side regression?',
      hypothesis: 'If the inert C56 lane missed the live binder because it only changed fresh organized-support admission, then relaxing the broader carry-input contract around 18.75° should create a new middle state with better export-side behavior.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C55 showed C54 relieved the 26.25° receiver row but worsened the 18.75° transition-export lane.',
        'Architecture C57 showed the narrow 18.75° organized-support-only preserve was fully inert relative to C54.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north improves relative to C54 while the 26.25° receiver lane stays relieved relative to C40.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'The experiment stays inert relative to C54 or worsens the receiver / shoulder tradeoff without a climate gain.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`26p25 carryover containment with 18p75 transition carry-input preserve quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
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
        slug: 'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-annual',
        focusArea: '26p25 carryover containment with 18p75 transition carry-input preserve annual gate',
        blockerFamily: '26p25 carryover containment with 18p75 transition carry-input preserve annual verification',
        mode: 'annual',
        question: 'Does the 26.25° carryover containment with 18.75° transition carry-input preserve hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the live binder was broader than the organized-support cap alone, then the transition carry-input preserve should annualize better than the inert C56 state.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C57 showed the next bounded move is broader transition carry-input preserve around 18.75° on top of the active C54 receiver-containment lane.'
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
        'earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-annual'
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

    const decision = classifyC58Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC58Markdown({
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

    process.stdout.write(`${JSON.stringify({
      reportPath: options.reportPath,
      jsonPath: options.jsonPath,
      decision,
      quickGate,
      hybridQuickPath: options.hybridQuickPath,
      hybridAnnualPath
    }, null, 2)}\n`);
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

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  main();
}
