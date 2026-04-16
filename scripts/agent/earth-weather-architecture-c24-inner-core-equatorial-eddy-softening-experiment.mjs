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
import { applyEquatorialBandEddySofteningCarveoutPatch } from './earth-weather-architecture-c22-equatorial-band-eddy-softening-carveout-experiment.mjs';

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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.json')
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

export function applyInnerCoreEquatorialEddySofteningPatch(worktreePath) {
  const basePatch = applyEquatorialBandEddySofteningCarveoutPatch(worktreePath);

  const corePath = path.join(worktreePath, 'src', 'weather', 'v2', 'core5.js');
  let coreContent = fs.readFileSync(corePath, 'utf8');
  coreContent = replaceOnce(
    coreContent,
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 4,\n      equatorialSofteningLat1Deg: 16,\n      equatorialBlendToUnityFrac: 0.7\n',
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 0,\n      equatorialSofteningLat1Deg: 10,\n      equatorialBlendToUnityFrac: 0.45\n'
  );
  fs.writeFileSync(corePath, coreContent);

  const eddyPath = path.join(worktreePath, 'src', 'weather', 'v2', 'windEddyNudge5.js');
  let eddyContent = fs.readFileSync(eddyPath, 'utf8');
  eddyContent = replaceOnce(
    eddyContent,
    '    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 4,\n    equatorialSofteningLat1Deg = 16,\n    equatorialBlendToUnityFrac = 0.7\n',
    '    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 0,\n    equatorialSofteningLat1Deg = 10,\n    equatorialBlendToUnityFrac = 0.45\n'
  );
  fs.writeFileSync(eddyPath, eddyContent);

  return {
    patchedPaths: basePatch.patchedPaths,
    patchedParams: [
      ...basePatch.patchedParams,
      'windEddyParams.innerCoreEquatorialSofteningLat0Deg',
      'windEddyParams.innerCoreEquatorialSofteningLat1Deg',
      'windEddyParams.innerCoreEquatorialBlendToUnityFrac'
    ]
  };
}

export function classifyC24Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C25: inner-core equatorial eddy softening attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the inner-core equatorial eddy-softening hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C25: annual inner-core equatorial eddy softening attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C25: annual inner-core equatorial eddy softening gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC24Markdown({
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
    '# Earth Weather Architecture C24 Inner-Core Equatorial Eddy Softening Experiment',
    '',
    'This phase keeps the C17 carryover carveout fixed and narrows the C22 equatorial-band eddy softening into the inner equatorial core. The goal is to preserve the dry-belt containment and upper-branch relief from C22 while reducing the lower-to-mid zonal drag that kept the cross-equatorial transport sign inverted.',
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
    `- inner-core equatorial eddy-softening quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c24-'));
  const worktreePath = path.join(tempParent, 'inner-core-eddy-softening-worktree');
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
    const patchSummary = applyInnerCoreEquatorialEddySofteningPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening',
      focusArea: 'inner-core equatorial eddy softening experiment',
      blockerFamily: 'equatorial lower-mid zonal branch sign defect',
      mode: 'quick',
      question: 'Can the donor/current hybrid preserve the C22 dry-belt relief while narrowing eddy softening into the inner equatorial core?',
      hypothesis: 'If the harmful part of C22 sits in the outer lower-mid rows of the 4–16° band, then a weaker 0–10° inner-core softening should keep the dry-belt gains while reducing the remaining lower-mid zonal drag.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C23 showed that C22 preserved carryover containment and upper-branch relief but deepened the equatorial lower-mid zonal branch.',
        'Architecture C22 already improved NH dry-belt ocean condensation, so the next move should be footprint tightening rather than abandoning the family.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north moves materially toward the trusted positive range while preserving most of the C22 dry-belt and westerly gains.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'The narrower inner-core softening gives back the C22 dry-belt condensation improvement or broad quick-shape wins.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`Inner-core equatorial eddy-softening quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
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
        slug: 'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-annual',
        focusArea: 'inner-core equatorial eddy softening annual gate',
        blockerFamily: 'equatorial lower-mid zonal branch annual verification',
        mode: 'annual',
        question: 'Does the inner-core equatorial eddy-softening hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the remaining blocker is concentrated in the outer part of the softened band, then narrowing to the inner core should preserve the quick wins and become a better annual candidate than C22.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C23 localized the remaining defect to the lower-mid zonal branch while showing the dry-belt carryover family stayed contained under C22.'
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
        'earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-annual'
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

    const decision = classifyC24Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC24Markdown({
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
