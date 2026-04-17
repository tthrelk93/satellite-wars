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
import { applyStronger26p25ReceiverCarryoverContainmentOnTopOf18p75TransitionCarryInputPreservePatch } from './earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-experiment.mjs';

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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.json')
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

export function applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentPatch(worktreePath) {
  const basePatch = applyStronger26p25ReceiverCarryoverContainmentOnTopOf18p75TransitionCarryInputPreservePatch(worktreePath);

  const verticalPath = path.join(worktreePath, 'src', 'weather', 'v2', 'vertical5.js');
  let content = fs.readFileSync(verticalPath, 'utf8');
  content = replaceOnce(
    content,
    '    const containedOverlap = Math.min(previousUpperCloudMass, upperCloudMass);\n    carriedOverUpperCloudMass[k] = containedOverlap;\n',
    [
      '    const containedOverlap = Math.min(previousUpperCloudMass, upperCloudMass);',
      '    const polewardShoulderCarryoverContainment33p75Frac = clamp01(',
      '      smoothstep(31, 33, latAbs)',
      '      * (1 - smoothstep(35, 37, latAbs))',
      '      * smoothstep(0.18, 0.32, containedOverlap)',
      '      * smoothstep(0.02, 0.06, subtropicalSubsidenceDrying[k] || 0)',
      '      * smoothstep(0.0, 0.03, Math.max(0, lowLevelOmegaEffective[k]))',
      '    );',
      '    if (polewardShoulderCarryoverContainment33p75Frac > 0 && upperCloudMass > eps && containedOverlap > 0) {',
      '      const polewardShoulderCarryoverContainment33p75MaxFrac = 0.18;',
      '      const polewardRemovalMass = Math.min(',
      '        containedOverlap * polewardShoulderCarryoverContainment33p75MaxFrac * polewardShoulderCarryoverContainment33p75Frac,',
      '        upperCloudMass',
      '      );',
      '      const polewardKeepFrac = Math.max(0, (upperCloudMass - polewardRemovalMass) / Math.max(upperCloudMass, eps));',
      '      scaleUpperCloudMassAtCell(state, sigmaHalf, nz, k, polewardKeepFrac);',
      '      upperCloudMass *= polewardKeepFrac;',
      '      for (let bandIndex = 0; bandIndex < CLOUD_BIRTH_LEVEL_BAND_COUNT; bandIndex += 1) {',
      '        upperCloudBandMass[bandIndex] *= polewardKeepFrac;',
      '      }',
      '    }',
      '    const polewardShoulderContainedOverlap = Math.min(previousUpperCloudMass, upperCloudMass);',
      '    carriedOverUpperCloudMass[k] = polewardShoulderContainedOverlap;\n'
    ].join('\n')
  );
  content = replaceOnce(
    content,
    '    weakErosionCloudSurvivalMass[k] = containedOverlap * weakErosionSupport;\n',
    '    weakErosionCloudSurvivalMass[k] = polewardShoulderContainedOverlap * weakErosionSupport;\n'
  );
  content = replaceOnce(
    content,
    '    importedAnvilPersistenceMass[k] = containedOverlap * persistenceSupport;\n',
    '    importedAnvilPersistenceMass[k] = polewardShoulderContainedOverlap * persistenceSupport;\n'
  );
  content = replaceOnce(
    content,
    '      ? (containedOverlap * (previousResidenceSeconds + dt) + localBirthMass * 0) / upperCloudMass\n',
    '      ? (polewardShoulderContainedOverlap * (previousResidenceSeconds + dt) + localBirthMass * 0) / upperCloudMass\n'
  );
  content = replaceOnce(
    content,
    '      ? (containedOverlap * (previousLocalBirthSeconds + dt) + localBirthMass * 0) / upperCloudMass\n',
    '      ? (polewardShoulderContainedOverlap * (previousLocalBirthSeconds + dt) + localBirthMass * 0) / upperCloudMass\n'
  );
  content = replaceOnce(
    content,
    '    const nextImportSeconds = containedOverlap > 0 ? previousImportSeconds + dt : 0;\n',
    '    const nextImportSeconds = polewardShoulderContainedOverlap > 0 ? previousImportSeconds + dt : 0;\n'
  );
  content = replaceOnce(
    content,
    '    upperCloudTimeSinceImportMassWeightedSeconds[k] += containedOverlap * nextImportSeconds;\n',
    '    upperCloudTimeSinceImportMassWeightedSeconds[k] += polewardShoulderContainedOverlap * nextImportSeconds;\n'
  );
  content = replaceOnce(
    content,
    '    const recentlyImportedMass = containedOverlap > 0 && nextImportSeconds <= recentlyImportedThresholdSeconds ? containedOverlap : 0;\n',
    '    const recentlyImportedMass = polewardShoulderContainedOverlap > 0 && nextImportSeconds <= recentlyImportedThresholdSeconds ? polewardShoulderContainedOverlap : 0;\n'
  );
  content = replaceOnce(
    content,
    '    const passiveSurvivalMass = containedOverlap > 0 && localBirthMass <= upperCloudMass * 0.1 ? containedOverlap : 0;\n',
    '    const passiveSurvivalMass = polewardShoulderContainedOverlap > 0 && localBirthMass <= upperCloudMass * 0.1 ? polewardShoulderContainedOverlap : 0;\n'
  );
  content = replaceOnce(
    content,
    '    const regenerationMass = containedOverlap > 0 && localBirthMass > upperCloudMass * 0.1 ? localBirthMass : 0;\n',
    '    const regenerationMass = polewardShoulderContainedOverlap > 0 && localBirthMass > upperCloudMass * 0.1 ? localBirthMass : 0;\n'
  );
  content = replaceOnce(
    content,
    '    const oscillatoryMass = containedOverlap > 0 && localBirthMass > upperCloudMass * 0.05 && appliedErosionMass > potentialErosionMass * 0.05\n      ? Math.min(containedOverlap, localBirthMass)\n',
    '    const oscillatoryMass = polewardShoulderContainedOverlap > 0 && localBirthMass > upperCloudMass * 0.05 && appliedErosionMass > potentialErosionMass * 0.05\n      ? Math.min(polewardShoulderContainedOverlap, localBirthMass)\n'
  );
  fs.writeFileSync(verticalPath, content);

  return {
    patchedPaths: [...basePatch.patchedPaths, path.relative(worktreePath, verticalPath)],
    patchedParams: [
      ...basePatch.patchedParams,
      'vertical5.polewardShoulderCarryoverContainment33p75Lat0Deg',
      'vertical5.polewardShoulderCarryoverContainment33p75Lat1Deg',
      'vertical5.polewardShoulderCarryoverContainment33p75Lat2Deg',
      'vertical5.polewardShoulderCarryoverContainment33p75Lat3Deg',
      'vertical5.polewardShoulderCarryoverContainment33p75Overlap0',
      'vertical5.polewardShoulderCarryoverContainment33p75Overlap1',
      'vertical5.polewardShoulderCarryoverContainment33p75Dry0',
      'vertical5.polewardShoulderCarryoverContainment33p75Dry1',
      'vertical5.polewardShoulderCarryoverContainment33p75Omega0',
      'vertical5.polewardShoulderCarryoverContainment33p75Omega1',
      'vertical5.polewardShoulderCarryoverContainment33p75MaxFrac'
    ]
  };
}

export function classifyC62Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C63: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C63: annual stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C63: annual stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC62Markdown({
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
    '# Earth Weather Architecture C62 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment Experiment',
    '',
    'This phase keeps the active C60 `18.75°` transition carry-input preserve and stronger `26.25°` receiver containment fixed, then adds a narrow `33.75°` poleward-shoulder carryover containment carveout. The goal is to recapture the NH dry-belt ocean rebound without giving back the export-side relief from C60.',
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
    `- stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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
  lines.push('- Architecture C61 showed the stronger `26.25°` receiver containment is a real middle state: it improves the sign defect and broad quick-shape metrics, but it pushes burden poleward into the `33.75°` shoulder and NH ocean upper-cloud maintenance.');
  lines.push('- This experiment holds the active C60 `18.75°` transition preserve and `26.25°` receiver containment fixed and only adds a local `33.75°` poleward-shoulder carryover containment carveout.');
  lines.push('- The bounded question is whether a narrow shoulder carveout can recapture the NH ocean rebound while preserving the export-side relief from C60.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c62-'));
  const worktreePath = path.join(tempParent, 'stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment',
      focusArea: 'stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment experiment',
      blockerFamily: 'testing whether the C60 export-side improvement can be kept while recapturing the poleward-shoulder and NH ocean rebound',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the active C60 transition and receiver gains while containing the reloaded 33.75° poleward shoulder strongly enough to recover NH dry-belt ocean realism?',
      hypothesis: 'If C60 pays for its stronger export relief by reloading the 33.75° shoulder, then a narrow poleward-shoulder carryover containment carveout should recover NH ocean metrics without giving back the equatorial improvement.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C61 showed C60 improves the sign defect and broad quick-shape metrics relative to C58.',
        'Architecture C61 also showed the cost of C60 lands poleward: the 33.75° shoulder reloads and NH ocean upper-cloud maintenance rebounds.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north stays materially better than C58 while NH dry-belt ocean condensation recovers versus C60.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north collapses back toward the older C58/C54 regressions.',
        'The shoulder carveout is inert or fails to recover NH dry-belt ocean condensation.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
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
        slug: 'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-annual',
        focusArea: 'stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment annual gate',
        blockerFamily: 'stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment annual verification',
        mode: 'annual',
        question: 'Does the stronger 26.25° receiver containment with 33.75° poleward-shoulder carryover containment hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the poleward shoulder is the main C60 repayment lane, then containing it should annualize better than C60 itself.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C61 showed the next bounded move is narrow 33.75° poleward-shoulder carryover containment on top of the active C60 base.'
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
        'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-annual'
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

    const decision = classifyC62Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC62Markdown({
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

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
