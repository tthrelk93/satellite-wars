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
import { applyTransitionBandOrganizedSupportRestorePatch } from './earth-weather-architecture-c40-transition-band-organized-support-restore-experiment.mjs';

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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-experiment.json')
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

export function apply26p25ReceiverCarryoverContainmentTransitionBandPatch(worktreePath) {
  const basePatch = applyTransitionBandOrganizedSupportRestorePatch(worktreePath);

  const verticalPath = path.join(worktreePath, 'src', 'weather', 'v2', 'vertical5.js');
  let content = fs.readFileSync(verticalPath, 'utf8');
  content = replaceOnce(
    content,
    '    const overlap = Math.min(previousUpperCloudMass, upperCloudMass);\n' +
      '    carriedOverUpperCloudMass[k] = overlap;\n',
    [
      '    const overlap = Math.min(previousUpperCloudMass, upperCloudMass);',
      '    const latAbs = Math.abs(lat);',
      '    const receiverCarryoverContainment26p25Frac = clamp01(',
      '      smoothstep(24, 26, latAbs)',
      '      * (1 - smoothstep(28, 30, latAbs))',
      '      * smoothstep(0.03, 0.07, overlap)',
      '      * smoothstep(0.02, 0.06, subtropicalSubsidenceDrying[k] || 0)',
      '      * smoothstep(0.01, 0.05, Math.max(0, lowLevelOmegaEffective[k]))',
      '    );',
      '    if (receiverCarryoverContainment26p25Frac > 0 && upperCloudMass > eps && overlap > 0) {',
      '      const removalMass = Math.min(overlap * 0.35 * receiverCarryoverContainment26p25Frac, upperCloudMass);',
      '      const keepFrac = Math.max(0, (upperCloudMass - removalMass) / Math.max(upperCloudMass, eps));',
      '      scaleUpperCloudMassAtCell(state, sigmaHalf, nz, k, keepFrac);',
      '      upperCloudMass *= keepFrac;',
      '      for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BAND_COUNT; bandIndex += 1) {',
      '        upperCloudBandMass[bandIndex] *= keepFrac;',
      '      }',
      '    }',
      '    const containedOverlap = Math.min(previousUpperCloudMass, upperCloudMass);',
      '    carriedOverUpperCloudMass[k] = containedOverlap;\n'
    ].join('\n')
  );
  content = replaceOnce(
    content,
    '    weakErosionCloudSurvivalMass[k] = overlap * weakErosionSupport;\n',
    '    weakErosionCloudSurvivalMass[k] = containedOverlap * weakErosionSupport;\n'
  );
  content = replaceOnce(
    content,
    '    importedAnvilPersistenceMass[k] = overlap * persistenceSupport;\n',
    '    importedAnvilPersistenceMass[k] = containedOverlap * persistenceSupport;\n'
  );
  content = replaceOnce(
    content,
    '      ? (overlap * (previousResidenceSeconds + dt) + localBirthMass * 0) / upperCloudMass\n',
    '      ? (containedOverlap * (previousResidenceSeconds + dt) + localBirthMass * 0) / upperCloudMass\n'
  );
  content = replaceOnce(
    content,
    '      ? (overlap * (previousLocalBirthSeconds + dt) + localBirthMass * 0) / upperCloudMass\n',
    '      ? (containedOverlap * (previousLocalBirthSeconds + dt) + localBirthMass * 0) / upperCloudMass\n'
  );
  content = replaceOnce(
    content,
    '    const nextImportSeconds = overlap > 0 ? previousImportSeconds + dt : 0;\n',
    '    const nextImportSeconds = containedOverlap > 0 ? previousImportSeconds + dt : 0;\n'
  );
  content = replaceOnce(
    content,
    '    upperCloudTimeSinceImportMassWeightedSeconds[k] += overlap * nextImportSeconds;\n',
    '    upperCloudTimeSinceImportMassWeightedSeconds[k] += containedOverlap * nextImportSeconds;\n'
  );
  content = replaceOnce(
    content,
    '    const recentlyImportedMass = overlap > 0 && nextImportSeconds <= recentlyImportedThresholdSeconds ? overlap : 0;\n',
    '    const recentlyImportedMass = containedOverlap > 0 && nextImportSeconds <= recentlyImportedThresholdSeconds ? containedOverlap : 0;\n'
  );
  content = replaceOnce(
    content,
    '    const passiveSurvivalMass = overlap > 0 && localBirthMass <= upperCloudMass * 0.1 ? overlap : 0;\n',
    '    const passiveSurvivalMass = containedOverlap > 0 && localBirthMass <= upperCloudMass * 0.1 ? containedOverlap : 0;\n'
  );
  content = replaceOnce(
    content,
    '    const regenerationMass = overlap > 0 && localBirthMass > upperCloudMass * 0.1 ? localBirthMass : 0;\n',
    '    const regenerationMass = containedOverlap > 0 && localBirthMass > upperCloudMass * 0.1 ? localBirthMass : 0;\n'
  );
  content = replaceOnce(
    content,
    '    const oscillatoryMass = overlap > 0 && localBirthMass > upperCloudMass * 0.05 && appliedErosionMass > potentialErosionMass * 0.05\n' +
      '      ? Math.min(overlap, localBirthMass)\n',
    '    const oscillatoryMass = containedOverlap > 0 && localBirthMass > upperCloudMass * 0.05 && appliedErosionMass > potentialErosionMass * 0.05\n' +
      '      ? Math.min(containedOverlap, localBirthMass)\n'
  );
  content = replaceOnce(
    content,
    '    const blockedErosionMass = Math.max(0, potentialErosionMass - appliedErosionMass);\n',
    '    const blockedErosionMass = Math.max(0, potentialErosionMass - appliedErosionMass);\n' +
      '    state.receiverCarryoverContainment26p25Diag = state.receiverCarryoverContainment26p25Diag || new Float32Array(N);\n' +
      '    state.receiverCarryoverContainment26p25Diag[k] = receiverCarryoverContainment26p25Frac;\n'
  );
  fs.writeFileSync(verticalPath, content);

  return {
    patchedPaths: [...basePatch.patchedPaths, path.relative(worktreePath, verticalPath)],
    patchedParams: [
      ...basePatch.patchedParams,
      'vertical5.receiverCarryoverContainment26p25Lat0Deg',
      'vertical5.receiverCarryoverContainment26p25Lat1Deg',
      'vertical5.receiverCarryoverContainment26p25Lat2Deg',
      'vertical5.receiverCarryoverContainment26p25Lat3Deg',
      'vertical5.receiverCarryoverContainment26p25Overlap0',
      'vertical5.receiverCarryoverContainment26p25Overlap1',
      'vertical5.receiverCarryoverContainment26p25Dry0',
      'vertical5.receiverCarryoverContainment26p25Dry1',
      'vertical5.receiverCarryoverContainment26p25Omega0',
      'vertical5.receiverCarryoverContainment26p25Omega1',
      'vertical5.receiverCarryoverContainment26p25MaxFrac'
    ]
  };
}

export function classifyC54Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C55: 26p25 receiver carryover containment transition-band attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the 26p25 receiver carryover containment transition-band track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C55: annual 26p25 receiver carryover containment transition-band attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C55: annual 26p25 receiver carryover containment transition-band gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC54Markdown({
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
    '# Earth Weather Architecture C54 26p25 Receiver Carryover Containment Transition-Band Experiment',
    '',
    'This phase keeps the strict C32 core carveout fixed and keeps the live C40 transition-band organized-support restore active, but it adds narrow `26.25°` receiver-lane carryover containment. The goal is to preserve the transition-band sign-relief family while reducing the downstream upper-cloud persistence that the organized-support guard failed to touch.',
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
    `- 26p25 receiver carryover containment quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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
  lines.push('- Architecture C53 showed the strong `26.25°` organized-support guard was still inert and left the receiver row unchanged.');
  lines.push('- This experiment keeps the same live transition-band geometry but moves one step downstream and contains upper-cloud carryover / persistence only inside the `26.25°` receiver lane.');
  lines.push('- The bounded question is whether the receiver reload can be reduced without collapsing the broader transition-band sign-relief family.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c54-'));
  const worktreePath = path.join(tempParent, '26p25-receiver-carryover-containment-transition-band-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = apply26p25ReceiverCarryoverContainmentTransitionBandPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band',
      focusArea: '26p25 receiver carryover containment transition-band experiment',
      blockerFamily: 'testing whether the 26.25 receiver reload is maintained by downstream carryover rather than fresh organized-support admission',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the live C40 transition-band sign-relief signal while containing upper-cloud carryover only inside the 26.25° receiver lane?',
      hypothesis: 'If the strong organized-support guard was inert because the receiver reload is maintained downstream, then targeted 26.25° carryover containment should reduce the receiver lane without snapping the whole transition-band family back to C32.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C53 showed the strong 26.25° organized-support guard was inert.',
        'C40 and C52 matched exactly while the 26.25° carried-over upper-cloud signal stayed elevated relative to strict C32.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north improves relative to C40/C52 while the 26.25° receiver lane changes materially.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'The experiment either reproduces C40/C52 again or collapses back to C32 without a meaningful climate gain.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`26p25 receiver carryover containment transition-band quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
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
        slug: 'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-annual',
        focusArea: '26p25 receiver carryover containment transition-band annual gate',
        blockerFamily: '26p25 receiver carryover containment transition-band annual verification',
        mode: 'annual',
        question: 'Does the 26.25° receiver carryover containment transition-band hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the remaining receiver reload is maintained by downstream carryover, then containing that carryover locally should annualize better than the uncontained C40/C52 regime.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C53 showed the strong organized-support guard was inert, so the next bounded step is downstream carryover containment at 26.25°.'
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
        'earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-annual'
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

    const decision = classifyC54Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC54Markdown({
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
