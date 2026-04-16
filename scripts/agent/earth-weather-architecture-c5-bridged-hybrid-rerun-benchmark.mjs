#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  evaluateMetricRows,
  evaluateGate,
  classifyHybridFailure
} from './earth-weather-architecture-c2-donor-base-hybrid-benchmark.mjs';
import {
  applyDonorCoreIntegrationBridge
} from './earth-weather-architecture-c4-donor-core-integration-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const auditScript = path.join(repoRoot, 'scripts', 'agent', 'planetary-realism-audit.mjs');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';
const trustedBaselinePath = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1-hadley-second-pass-restore-v4.json'
);

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const defaults = {
  trustedBaselinePath,
  currentOffQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c5-current-off-quick'),
  currentOffAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c5-current-off-annual'),
  hybridQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c5-bridged-hybrid-quick'),
  hybridAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c5-bridged-hybrid-annual'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.json')
};

const OVERLAY_FILES = [
  'src/weather/v2/microphysics5.js',
  'src/weather/v2/state5.js',
  'src/weather/v2/cloudBirthTracing5.js',
  'src/weather/v2/sourceTracing5.js',
  'src/weather/v2/instrumentationBands5.js',
  'src/weather/validation/diagnostics.js',
  'scripts/agent/planetary-realism-audit.mjs',
  'scripts/agent/headless-terrain-fixture.mjs',
  'scripts/agent/plan-guard.mjs'
];

const METRIC_LABELS = new Map([
  ['itczWidthDeg', 'ITCZ width'],
  ['subtropicalDryNorthRatio', 'NH dry-belt ratio'],
  ['subtropicalDrySouthRatio', 'SH dry-belt ratio'],
  ['midlatitudeWesterliesNorthU10Ms', 'NH midlatitude westerlies'],
  ['northDryBeltOceanLargeScaleCondensationMeanKgM2', 'NH dry-belt ocean condensation'],
  ['crossEquatorialVaporFluxNorthKgM_1S', 'Cross-equatorial vapor flux north']
]);

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--trusted-baseline' && argv[i + 1]) options.trustedBaselinePath = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
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

const runAudit = ({ cwd, scriptPath, preset, outputBase }) => {
  execFileSync(process.execPath, [
    scriptPath,
    '--preset',
    preset,
    '--no-repro-check',
    '--no-counterfactuals',
    '--quiet',
    '--report-base',
    outputBase
  ], {
    cwd,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  const summaryPath = `${outputBase}.json`;
  if (fs.existsSync(summaryPath)) {
    return summaryPath;
  }
  const outputDir = path.dirname(outputBase);
  const outputPrefix = path.basename(outputBase);
  const matchingFiles = fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir).filter((entry) => entry.startsWith(outputPrefix))
    : [];
  throw new Error(
    `Audit completed without expected summary artifact at ${summaryPath}. Matching files: ${matchingFiles.length ? matchingFiles.join(', ') : 'none'}`
  );
};

const tryRunAudit = ({ cwd, scriptPath, preset, outputBase }) => {
  try {
    return { ok: true, jsonPath: runAudit({ cwd, scriptPath, preset, outputBase }) };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error.message,
        stderr: typeof error.stderr === 'string' ? error.stderr.trim() : '',
        stdout: typeof error.stdout === 'string' ? error.stdout.trim() : ''
      }
    };
  }
};

const renderRows = (rows) => rows.map((row) => (
  `- ${METRIC_LABELS.get(row.key) || row.label || row.key}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC5Markdown({
  decision,
  bridgeSummary,
  quickRows,
  quickGate,
  currentQuickPath,
  hybridQuickPath,
  hybridAnnualPath,
  failure
}) {
  const lines = [
    '# Earth Weather Architecture C5 Bridged Hybrid Rerun Benchmark',
    '',
    'This phase reruns the donor-base hybrid benchmark after the Architecture C4 donor-core bridge has been applied.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Bridge summary',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- missing donor-core compatibility methods after bridge: ${bridgeSummary.missingCoreMethodsAfterBridge.length ? bridgeSummary.missingCoreMethodsAfterBridge.join(', ') : 'none'}`,
    '',
    '## Overlay bundle',
    ''
  ];

  for (const file of OVERLAY_FILES) {
    lines.push(`- [${file}](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/${file})`);
  }
  lines.push('');

  if (quickRows) {
    lines.push('## Benchmark');
    lines.push('');
    lines.push(`- current quick artifact: [${path.basename(currentQuickPath)}](${currentQuickPath})`);
    lines.push(`- bridged hybrid quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`);
    if (hybridAnnualPath) {
      lines.push(`- bridged hybrid annual artifact: [${path.basename(hybridAnnualPath)}](${hybridAnnualPath})`);
    }
    lines.push('');
    lines.push(renderRows(quickRows));
    lines.push('');
    lines.push(`- improved metrics: ${quickGate.improvedCount} / ${quickRows.length}`);
    lines.push(`- severe regressions: ${quickGate.severeRegressions.length ? quickGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- gate pass: ${quickGate.pass}`);
    lines.push('');
  } else if (failure) {
    lines.push('## Benchmark');
    lines.push('');
    lines.push('- bridged hybrid benchmark did not complete');
    lines.push(`- failure classification: \`${failure.classification}\``);
    lines.push(`- stderr: \`${failure.stderr || failure.message || 'none'}\``);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  const currentQuickPath = runAudit({
    cwd: repoRoot,
    scriptPath: auditScript,
    preset: 'quick',
    outputBase: options.currentOffQuickBase
  });
  const currentQuickMetrics = extractMetrics(readJson(currentQuickPath));

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c5-'));
  const worktreePath = path.join(tempParent, 'bridged-worktree');
  let quickRows = null;
  let quickGate = null;
  let hybridQuickRepoPath = null;
  let hybridAnnualRepoPath = null;
  let failure = null;

  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const worktreeQuickBase = path.join(worktreePath, 'weather-validation', 'output', 'earth-weather-architecture-c5-bridged-hybrid-quick');
    const quickRun = tryRunAudit({
      cwd: worktreePath,
      scriptPath: worktreeAuditScript,
      preset: 'quick',
      outputBase: worktreeQuickBase
    });

    let decision;
    if (!quickRun.ok) {
      const classification = classifyHybridFailure(quickRun.error.stderr, bridgeSummary.missingCoreMethodsAfterBridge, quickRun.error.message);
      failure = { ...quickRun.error, classification };
      decision = {
        verdict: classification,
        nextMove: 'Architecture C6: bridged hybrid attribution design'
      };
    } else {
      hybridQuickRepoPath = `${options.hybridQuickBase}.json`;
      copyArtifactIntoRepo(quickRun.jsonPath, hybridQuickRepoPath);
      const hybridQuickMetrics = extractMetrics(readJson(hybridQuickRepoPath));
      quickRows = evaluateMetricRows({
        offMetrics: currentQuickMetrics,
        onMetrics: hybridQuickMetrics,
        targetMetrics: trustedBaselineMetrics,
        severeTolerance: 0.05
      });
      quickGate = evaluateGate(quickRows, 4);

      if (quickGate.pass) {
        const currentAnnualPath = runAudit({
          cwd: repoRoot,
          scriptPath: auditScript,
          preset: 'annual',
          outputBase: options.currentOffAnnualBase
        });
        const currentAnnualMetrics = extractMetrics(readJson(currentAnnualPath));
        const worktreeAnnualBase = path.join(worktreePath, 'weather-validation', 'output', 'earth-weather-architecture-c5-bridged-hybrid-annual');
        const annualRun = tryRunAudit({
          cwd: worktreePath,
          scriptPath: worktreeAuditScript,
          preset: 'annual',
          outputBase: worktreeAnnualBase
        });

        if (!annualRun.ok) {
          const classification = classifyHybridFailure(annualRun.error.stderr, bridgeSummary.missingCoreMethodsAfterBridge, annualRun.error.message);
          failure = { ...annualRun.error, classification };
          decision = {
            verdict: classification,
            nextMove: 'Architecture C6: bridged hybrid attribution design'
          };
        } else {
          hybridAnnualRepoPath = `${options.hybridAnnualBase}.json`;
          copyArtifactIntoRepo(annualRun.jsonPath, hybridAnnualRepoPath);
          const hybridAnnualMetrics = extractMetrics(readJson(hybridAnnualRepoPath));
          const annualRows = evaluateMetricRows({
            offMetrics: currentAnnualMetrics,
            onMetrics: hybridAnnualMetrics,
            targetMetrics: trustedBaselineMetrics,
            severeTolerance: 0.1
          });
          const annualGate = evaluateGate(annualRows, 4);
          decision = annualGate.pass
            ? {
                verdict: 'keep_candidate',
                nextMove: 'Phase 1 Climate Base Recovery on bridged donor-base hybrid branch'
              }
            : {
                verdict: 'annual_reject',
                nextMove: 'Architecture C6: bridged hybrid attribution design'
              };
          quickRows = annualRows;
          quickGate = annualGate;
        }
      } else {
        decision = {
          verdict: 'quick_reject',
          nextMove: 'Architecture C6: bridged hybrid attribution design'
        };
      }
    }

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      overlayFiles: OVERLAY_FILES,
      trustedBaselinePath: options.trustedBaselinePath,
      currentQuickPath,
      hybridQuickPath: hybridQuickRepoPath,
      hybridAnnualPath: hybridAnnualRepoPath,
      bridgeSummary,
      quickRows,
      quickGate,
      failure,
      decision
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(
      options.reportPath,
      renderArchitectureC5Markdown({
        decision,
        bridgeSummary,
        quickRows,
        quickGate,
        currentQuickPath,
        hybridQuickPath: hybridQuickRepoPath,
        hybridAnnualPath: hybridAnnualRepoPath,
        failure
      })
    );
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, bridgeSummary })}\n`);
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

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
