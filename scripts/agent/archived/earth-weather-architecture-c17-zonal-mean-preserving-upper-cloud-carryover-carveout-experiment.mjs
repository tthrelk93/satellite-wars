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
import {
  applyEquatorialVerticalStateContractPatch
} from './earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.mjs';
import {
  evaluateAnnualAbsoluteGate
} from './earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.mjs';

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
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c17-carryover-carveout-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.json')
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

export function applyZonalMeanPreservingUpperCloudCarryoverCarveoutPatch(worktreePath) {
  const basePatch = applyEquatorialVerticalStateContractPatch(worktreePath);
  const verticalPath = path.join(worktreePath, 'src', 'weather', 'v2', 'vertical5.js');
  let content = fs.readFileSync(verticalPath, 'utf8');
  content = replaceOnce(
    content,
    '    carryInputSubtropicalSuppressionMin = 0.74243,\n',
    '    carryInputSubtropicalSuppressionMin = 0.58,\n'
  );
  content = replaceOnce(
    content,
    '    carryInputOrganizedSupportMax = 0.22504,\n',
    '    carryInputOrganizedSupportMax = 0.42,\n'
  );
  content = replaceOnce(
    content,
    '    carryInputPotentialMax = 0.24341,\n',
    '    carryInputPotentialMax = 0.42,\n'
  );
  content = replaceOnce(
    content,
    '    carryInputDominanceMin = 0.93785,\n',
    '    carryInputDominanceMin = 0.72,\n'
  );
  content = replaceOnce(
    content,
    '    carryInputMinResidualMassKgM2 = 3.40503,\n',
    '    carryInputMinResidualMassKgM2 = 1.2,\n'
  );
  fs.writeFileSync(verticalPath, content);
  return {
    patchedPaths: [
      basePatch.patchedCorePath,
      path.relative(worktreePath, verticalPath)
    ],
    patchedParams: [
      ...basePatch.patchedParams,
      'vertical5.carryInputSubtropicalSuppressionMin',
      'vertical5.carryInputOrganizedSupportMax',
      'vertical5.carryInputPotentialMax',
      'vertical5.carryInputDominanceMin',
      'vertical5.carryInputMinResidualMassKgM2'
    ]
  };
}

export function classifyC17Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C18: carryover carveout implementation attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the carryover-carveout hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C18: annual carryover carveout attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C18: annual carryover carveout gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC17Markdown({
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
    '# Earth Weather Architecture C17 Zonal-Mean-Preserving Upper-Cloud Carryover Carveout Experiment',
    '',
    'This phase keeps the donor/current hybrid plus the C15 vertical-state contract, but tightens only the upper-cloud carry-input dominance carveout so the dry-belt carryover/persistence lane is cleared earlier. The goal is to preserve the zonal-mean equatorial relief from C15 without paying for it through renewed upper-cloud recirculation.',
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
    `- carryover-carveout quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
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

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c17-'));
  const worktreePath = path.join(tempParent, 'carryover-worktree');
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
    const patchSummary = applyZonalMeanPreservingUpperCloudCarryoverCarveoutPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c17-carryover-carveout',
      focusArea: 'zonal-mean-preserving upper-cloud carryover carveout experiment',
      blockerFamily: 'upper-cloud carryover recirculation',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the C15 zonal-mean relief if we clear upper-cloud carryover earlier in the NH dry belt?',
      hypothesis: 'The remaining C15 failure is being paid through a too-restrictive carry-input dominance override, so relaxing that override should reduce dry-belt carryover recirculation and improve the eddy-side equatorial transport without giving back the zonal-mean relief.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      evidence: [
        'Architecture C16 showed that C15 improved zonal-mean overturning and north dry-belt import burden, but reactivated upper-cloud carryover, imported persistence, and weak-erosion cloud survival.',
        'The current vertical overlay already contains a mass-removal path keyed on carry-input dominance, but its admission thresholds are restrictive.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north moves materially toward the trusted positive range while preserving at least the C15 ITCZ-width improvement.'
      ],
      failCriteria: [
        'Cross-equatorial vapor flux north remains a severe regression.',
        'The carveout weakens the zonal-mean relief enough to give back the C15 hybrid gains.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c17-carryover-carveout-quick'
    );
    const quickRun = runExplicitMainAudit({
      cwd: worktreePath,
      scriptPath: worktreeAuditScript,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`Carryover-carveout quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
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
        slug: 'earth-weather-architecture-c17-carryover-carveout-annual',
        focusArea: 'zonal-mean-preserving upper-cloud carryover carveout annual gate',
        blockerFamily: 'upper-cloud carryover recirculation annual verification',
        mode: 'annual',
        question: 'Does the carryover-carveout hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the carryover lane was the main price of the C15 zonal-mean relief, then the relaxed carry-input override should keep the same dry-belt/circulation gains without flipping the annual equatorial transport budget.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windNudge5.js',
          'src/weather/v2/windEddyNudge5.js',
          'src/weather/v2/nudging5.js'
        ],
        evidence: [
          'Quick gate passed for the carryover-carveout experiment.'
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
        'earth-weather-architecture-c17-carryover-carveout-annual'
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

    const decision = classifyC17Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.v1',
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
    fs.writeFileSync(options.reportPath, renderArchitectureC17Markdown({
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
