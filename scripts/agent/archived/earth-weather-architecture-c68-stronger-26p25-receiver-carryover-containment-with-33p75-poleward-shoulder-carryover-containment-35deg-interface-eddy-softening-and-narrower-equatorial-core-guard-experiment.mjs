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
import { applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainment35degInterfaceEddySofteningAndEquatorialEddyGuardPatch } from './earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-experiment.mjs';

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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-experiment.json')
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

export function applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainment35degInterfaceEddySofteningAndNarrowerEquatorialCoreGuardPatch(worktreePath) {
  const basePatch = applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainment35degInterfaceEddySofteningAndEquatorialEddyGuardPatch(worktreePath);

  const corePath = path.join(worktreePath, 'src', 'weather', 'v2', 'core5.js');
  let coreContent = fs.readFileSync(corePath, 'utf8');
  coreContent = replaceOnce(
    coreContent,
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 0,\n      equatorialSofteningLat1Deg: 8,\n      equatorialBlendToUnityFrac: 0.3,\n      enable35degInterfaceEddySoftening: true,\n',
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 0,\n      equatorialSofteningLat1Deg: 6,\n      equatorialBlendToUnityFrac: 0.3,\n      enable35degInterfaceEddySoftening: true,\n'
  );
  fs.writeFileSync(corePath, coreContent);

  const eddyPath = path.join(worktreePath, 'src', 'weather', 'v2', 'windEddyNudge5.js');
  let eddyContent = fs.readFileSync(eddyPath, 'utf8');
  eddyContent = replaceOnce(
    eddyContent,
    "    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 0,\n    equatorialSofteningLat1Deg = 8,\n    equatorialBlendToUnityFrac = 0.3,\n    enable35degInterfaceEddySoftening = false,\n",
    "    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 0,\n    equatorialSofteningLat1Deg = 6,\n    equatorialBlendToUnityFrac = 0.3,\n    enable35degInterfaceEddySoftening = false,\n"
  );
  fs.writeFileSync(eddyPath, eddyContent);

  return {
    patchedPaths: basePatch.patchedPaths,
    patchedParams: [
      ...basePatch.patchedParams,
      'windEddyParams.narrowerEquatorialCoreGuardLat1Deg'
    ]
  };
}

export function classifyC68Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C69: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and narrower equatorial-core guard attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the narrower-equatorial-core-guard hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C69: annual stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and narrower equatorial-core guard attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C69: annual stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and narrower equatorial-core guard gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC68Markdown({
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
    '# Earth Weather Architecture C68 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment 35deg Interface Eddy Softening And Narrower Equatorial-Core Guard Experiment',
    '',
    'This phase keeps the active C66 `35°` interface eddy-softening and equatorial-guard structure fixed, but narrows the equatorial guard from `8°` to `6°`. The goal is to preserve the lower/mid equatorial relief while preventing the repayment from leaking into the `11.25°–33.75°` transition / shoulder rows.',
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
    `- narrower equatorial-core guard quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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
  lines.push('- Architecture C67 showed that C66 is beneficial but still paid for by the upper equatorial eddy branch and the outer transition / shoulder flux rows.');
  lines.push('- This experiment keeps the C66 family intact and changes only the latitude reach of the equatorial guard, which makes it a clean geometry test instead of a new mechanism family.');
  lines.push('- The bounded question is whether pulling the guard inward toward the equatorial core can keep the lower/mid relief while preventing the repayment from landing at `11.25°`, `18.75°`, `26.25°`, and `33.75°`.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c68-'));
  const worktreePath = path.join(tempParent, 'c68-narrower-equatorial-core-guard-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainment35degInterfaceEddySofteningAndNarrowerEquatorialCoreGuardPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c68-narrower-equatorial-core-guard',
      focusArea: '35deg interface eddy softening with narrower equatorial-core guard experiment',
      blockerFamily: 'testing whether the remaining C66 repayment lives in the outer equatorial shoulder rather than the inner core',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the active C66 relief if we pull the equatorial guard inward from 8° to 6°?',
      hypothesis: 'If C67 is right that the remaining repayment is living in the outer transition / shoulder rows, then narrowing the equatorial guard should preserve the lower/mid relief while relieving the outer-row reload.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windEddyNudge5.js'
      ],
      evidence: [
        'Architecture C67 showed C66 improves the lower/mid equatorial core and the NH maintenance family.',
        'Architecture C67 also showed the remaining blocker is the upper eddy plus transition / shoulder row repayment.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north improves relative to C66 without losing the preserved 35° relief.'
      ],
      failCriteria: [
        'The narrower equatorial-core guard is inert.',
        'The narrower guard worsens the sign defect or gives back the preserved C66 relief.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c68-narrower-equatorial-core-guard-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`narrower equatorial-core guard quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
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
        slug: 'earth-weather-architecture-c68-narrower-equatorial-core-guard-annual',
        focusArea: '35deg interface eddy softening with narrower equatorial-core guard annual gate',
        blockerFamily: '35deg interface eddy softening with narrower equatorial-core guard annual verification',
        mode: 'annual',
        question: 'Does the narrower equatorial-core guard hold up over an annual run?',
        hypothesis: 'If the remaining C66 repayment lives outside the inner equatorial core, then a narrower guard should annualize better than C66.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C67 showed the next bounded move is narrowing the equatorial guard toward the core.'
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
        'earth-weather-architecture-c68-narrower-equatorial-core-guard-annual'
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

    const decision = classifyC68Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC68Markdown({
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
