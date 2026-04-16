#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

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
  currentOffQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c2-current-off-quick'),
  currentOffAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c2-current-off-annual'),
  hybridQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c2-hybrid-quick'),
  hybridAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-c2-hybrid-annual'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c2-donor-base-hybrid-benchmark.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c2-donor-base-hybrid-benchmark.json')
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

const REQUIRED_CORE_METHODS = [
  'getCloudTransitionLedgerRaw',
  'resetCloudTransitionLedger',
  'getModuleTimingSummary',
  'getConservationSummary',
  'loadStateSnapshot',
  'setReplayDisabledModules',
  'clearReplayDisabledModules'
];

const METRIC_DEFS = [
  { key: 'itczWidthDeg', label: 'ITCZ width', direction: 'lower' },
  { key: 'subtropicalDryNorthRatio', label: 'NH dry-belt ratio', direction: 'lower' },
  { key: 'subtropicalDrySouthRatio', label: 'SH dry-belt ratio', direction: 'lower' },
  { key: 'midlatitudeWesterliesNorthU10Ms', label: 'NH midlatitude westerlies', direction: 'higher' },
  { key: 'northDryBeltOceanLargeScaleCondensationMeanKgM2', label: 'NH dry-belt ocean condensation', direction: 'lower' },
  { key: 'crossEquatorialVaporFluxNorthKgM_1S', label: 'Cross-equatorial vapor flux north', direction: 'band', targetRange: [75, 250] }
];

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--trusted-baseline' && argv[i + 1]) options.trustedBaselinePath = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const extractMetrics = (auditJson) => auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {};

const readFileAtRef = (ref, relativePath) => execFileSync('git', ['show', `${ref}:${relativePath}`], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

const distanceToTarget = (def, value, targetMetrics) => {
  if (!Number.isFinite(value)) return null;
  if (def.direction === 'band') {
    const [min, max] = def.targetRange;
    if (value >= min && value <= max) return 0;
    if (value < min) return min - value;
    return value - max;
  }
  const target = targetMetrics?.[def.key];
  if (!Number.isFinite(target)) return null;
  return Math.abs(value - target);
};

export function evaluateMetricRows({ offMetrics, onMetrics, targetMetrics, severeTolerance = 0.05 }) {
  return METRIC_DEFS.map((def) => {
    const off = offMetrics?.[def.key];
    const on = onMetrics?.[def.key];
    const offDistance = distanceToTarget(def, off, targetMetrics);
    const onDistance = distanceToTarget(def, on, targetMetrics);
    const improved = Number.isFinite(offDistance) && Number.isFinite(onDistance) && onDistance < offDistance;
    const severeRegression = Number.isFinite(offDistance) && Number.isFinite(onDistance)
      ? onDistance > offDistance * (1 + severeTolerance) && (onDistance - offDistance) > 0.01
      : false;
    return {
      key: def.key,
      label: def.label,
      off: round(off),
      on: round(on),
      offDistance: round(offDistance),
      onDistance: round(onDistance),
      improved,
      severeRegression
    };
  });
}

export function evaluateGate(rows, minImproved) {
  const improvedCount = rows.filter((row) => row.improved).length;
  const severeRegressions = rows.filter((row) => row.severeRegression).map((row) => row.key);
  return {
    improvedCount,
    severeRegressions,
    pass: improvedCount >= minImproved && severeRegressions.length === 0
  };
}

export function classifyHybridFailure(stderr = '', missingCoreMethods = [], message = '') {
  const combined = `${stderr}\n${message}`;
  if (combined.includes('ERR_MODULE_NOT_FOUND') || combined.includes('Cannot find module')) {
    return 'integration_blocked_missing_dependency';
  }
  if (combined.includes('is not a function')) {
    return 'integration_blocked_missing_core_api';
  }
  if (missingCoreMethods.length > 0) {
    return 'integration_blocked_missing_core_api';
  }
  return 'hybrid_boot_failure';
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });

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
  return `${outputBase}.json`;
};

const tryRunAudit = ({ cwd, scriptPath, preset, outputBase }) => {
  try {
    const jsonPath = runAudit({ cwd, scriptPath, preset, outputBase });
    return { ok: true, jsonPath };
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

const getMissingCoreMethods = (worktreePath) => {
  const coreText = fs.readFileSync(path.join(worktreePath, 'src/weather/v2/core5.js'), 'utf8');
  return REQUIRED_CORE_METHODS.filter((name) => !coreText.includes(`${name}(`));
};

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC2Markdown({ decision, quickRows, quickGate, currentQuickPath, hybridQuickPath, missingCoreMethods, overlayFiles, failure }) {
  const lines = [
    '# Earth Weather Architecture C2 Donor-Base Hybrid Worktree Benchmark',
    '',
    'This report benchmarks the first donor-base hybrid worktree built from the rollback circulation scaffold plus the current partition-preserving and adapter bundles.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    ''
  ];

  lines.push('## Overlay bundle');
  lines.push('');
  for (const file of overlayFiles) {
    lines.push(`- [${file}](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/${file})`);
  }
  lines.push('');

  lines.push('## Hybrid bootstrap checks');
  lines.push('');
  lines.push(`- missing donor-core methods relative to the current audit stack: ${missingCoreMethods.length ? missingCoreMethods.join(', ') : 'none detected'}`);
  lines.push('');

  if (quickRows) {
    lines.push('## Quick benchmark');
    lines.push('');
    lines.push(`- current quick artifact: [${path.basename(currentQuickPath)}](${currentQuickPath})`);
    lines.push(`- hybrid quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`);
    lines.push('');
    lines.push(renderRows(quickRows));
    lines.push('');
    lines.push(`- improved metrics: ${quickGate.improvedCount} / ${quickRows.length}`);
    lines.push(`- severe regressions: ${quickGate.severeRegressions.length ? quickGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- quick pass: ${quickGate.pass}`);
    lines.push('');
  } else if (failure) {
    lines.push('## Quick benchmark');
    lines.push('');
    lines.push('- hybrid benchmark did not complete');
    lines.push(`- failure classification: \`${failure.classification}\``);
    lines.push(`- stderr: \`${failure.stderr || failure.message || 'none'}\``);
    lines.push('');
  }

  lines.push('## Decision');
  lines.push('');
  lines.push(`- verdict: \`${decision.verdict}\``);
  lines.push(`- next move: ${decision.nextMove}`);
  lines.push('');
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

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c2-'));
  const worktreePath = path.join(tempParent, 'hybrid-worktree');
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

    const missingCoreMethods = getMissingCoreMethods(worktreePath);
    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const worktreeQuickBase = path.join(worktreePath, 'weather-validation', 'output', 'earth-weather-architecture-c2-hybrid-quick');
    const quickRun = tryRunAudit({
      cwd: worktreePath,
      scriptPath: worktreeAuditScript,
      preset: 'quick',
      outputBase: worktreeQuickBase
    });

    let decision;
    if (!quickRun.ok) {
      const classification = classifyHybridFailure(quickRun.error.stderr, missingCoreMethods, quickRun.error.message);
      failure = { ...quickRun.error, classification };
      decision = {
        verdict: classification,
        nextMove: 'Architecture C3: hybrid integration bridge design'
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
        const worktreeAnnualBase = path.join(worktreePath, 'weather-validation', 'output', 'earth-weather-architecture-c2-hybrid-annual');
        const annualRun = tryRunAudit({
          cwd: worktreePath,
          scriptPath: worktreeAuditScript,
          preset: 'annual',
          outputBase: worktreeAnnualBase
        });

        if (!annualRun.ok) {
          const classification = classifyHybridFailure(annualRun.error.stderr, missingCoreMethods, annualRun.error.message);
          failure = { ...annualRun.error, classification };
          decision = {
            verdict: classification,
            nextMove: 'Architecture C3: hybrid integration bridge design'
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
                nextMove: 'Phase 1 Climate Base Recovery on donor-base hybrid branch'
              }
            : {
                verdict: 'annual_reject',
                nextMove: 'Architecture C3: hybrid benchmark attribution design'
              };
          quickRows = annualRows;
          quickGate = annualGate;
        }
      } else {
        decision = {
          verdict: 'quick_reject',
          nextMove: 'Architecture C3: hybrid benchmark attribution design'
        };
      }
    }

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c2-donor-base-hybrid-benchmark.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      overlayFiles: OVERLAY_FILES,
      trustedBaselinePath: options.trustedBaselinePath,
      currentQuickPath,
      hybridQuickPath: hybridQuickRepoPath,
      hybridAnnualPath: hybridAnnualRepoPath,
      missingCoreMethods,
      quickRows,
      quickGate,
      failure,
      decision
    };

    const markdown = renderArchitectureC2Markdown({
      decision,
      quickRows,
      quickGate,
      currentQuickPath,
      hybridQuickPath: hybridQuickRepoPath,
      missingCoreMethods,
      overlayFiles: OVERLAY_FILES,
      failure
    });

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, markdown);
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
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
