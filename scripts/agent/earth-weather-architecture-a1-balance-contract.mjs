#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const auditScript = path.join(__dirname, 'planetary-realism-audit.mjs');
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
  offQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-a1-off-quick'),
  onQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-a1-on-quick'),
  offAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-a1-off-annual'),
  onAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-a1-on-annual'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-a1-balance-contract.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-a1-balance-contract.json')
};

const METRIC_DEFS = [
  { key: 'itczWidthDeg', label: 'ITCZ width', direction: 'lower' },
  { key: 'subtropicalDryNorthRatio', label: 'NH dry-belt ratio', direction: 'lower' },
  { key: 'subtropicalDrySouthRatio', label: 'SH dry-belt ratio', direction: 'lower' },
  { key: 'midlatitudeWesterliesNorthU10Ms', label: 'NH midlatitude westerlies', direction: 'higher' },
  { key: 'northDryBeltOceanLargeScaleCondensationMeanKgM2', label: 'NH dry-belt ocean condensation', direction: 'lower' },
  { key: 'crossEquatorialVaporFluxNorthKgM_1S', label: 'Cross-equatorial vapor flux north', direction: 'band', targetRange: [75, 250] }
];

const CONTRACT_METRICS = [
  'northTransitionSubtropicalBalancePartitionSupportMeanFrac',
  'northTransitionSubtropicalBalanceCirculationSupportMeanFrac',
  'northTransitionSubtropicalBalanceContractSupportMeanFrac',
  'northDryBeltSubtropicalBalanceContractSupportMeanFrac',
  'southTransitionSubtropicalBalanceContractSupportMeanFrac',
  'southDryBeltSubtropicalBalanceContractSupportMeanFrac'
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

const runAudit = ({ preset, mode, outputBase }) => {
  const args = [
    auditScript,
    '--preset',
    preset,
    '--no-repro-check',
    '--no-counterfactuals',
    '--quiet',
    '--report-base',
    outputBase,
    '--architecture-a1-balance-contract',
    mode
  ];
  execFileSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  return `${outputBase}.json`;
};

const contractSummary = (metrics) => Object.fromEntries(
  CONTRACT_METRICS.map((key) => [key, round(metrics?.[key])])
);

export function renderArchitectureA1Markdown({ quickRows, quickGate, annualRows, annualGate, offQuick, onQuick, offAnnual, onAnnual, decision }) {
  const renderRows = (rows) => rows.map((row) => (
    `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
  )).join('\n');
  const renderContract = (label, metrics) => [
    `### ${label}`,
    `- north transition partition: \`${round(metrics.northTransitionSubtropicalBalancePartitionSupportMeanFrac)}\``,
    `- north transition circulation: \`${round(metrics.northTransitionSubtropicalBalanceCirculationSupportMeanFrac)}\``,
    `- north transition contract: \`${round(metrics.northTransitionSubtropicalBalanceContractSupportMeanFrac)}\``,
    `- north dry-belt contract: \`${round(metrics.northDryBeltSubtropicalBalanceContractSupportMeanFrac)}\``,
    `- south transition contract: \`${round(metrics.southTransitionSubtropicalBalanceContractSupportMeanFrac)}\``,
    `- south dry-belt contract: \`${round(metrics.southDryBeltSubtropicalBalanceContractSupportMeanFrac)}\``
  ].join('\n');

  const lines = [
    '# Earth Weather Architecture A1 Balance Contract Experiment',
    '',
    'This report benchmarks the explicit subtropical balance contract experiment against the current branch baseline using the bounded Architecture A workflow.',
    '',
    '## Quick screen',
    '',
    renderRows(quickRows),
    '',
    `- improved metrics: ${quickGate.improvedCount} / ${quickRows.length}`,
    `- severe regressions: ${quickGate.severeRegressions.length ? quickGate.severeRegressions.join(', ') : 'none'}`,
    `- quick pass: ${quickGate.pass}`,
    '',
    renderContract('Quick off', offQuick),
    '',
    renderContract('Quick on', onQuick),
    ''
  ];

  if (annualRows) {
    lines.push('## Annual gate');
    lines.push('');
    lines.push(renderRows(annualRows));
    lines.push('');
    lines.push(`- improved metrics: ${annualGate.improvedCount} / ${annualRows.length}`);
    lines.push(`- severe regressions: ${annualGate.severeRegressions.length ? annualGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- annual keep: ${annualGate.pass}`);
    lines.push('');
    lines.push(renderContract('Annual off', offAnnual));
    lines.push('');
    lines.push(renderContract('Annual on', onAnnual));
    lines.push('');
  } else {
    lines.push('## Annual gate');
    lines.push('');
    lines.push('- skipped because the quick screen failed the bounded entry gate');
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

  const offQuickPath = runAudit({ preset: 'quick', mode: 'off', outputBase: options.offQuickBase });
  const onQuickPath = runAudit({ preset: 'quick', mode: 'on', outputBase: options.onQuickBase });
  const offQuickMetrics = extractMetrics(readJson(offQuickPath));
  const onQuickMetrics = extractMetrics(readJson(onQuickPath));
  const quickRows = evaluateMetricRows({
    offMetrics: offQuickMetrics,
    onMetrics: onQuickMetrics,
    targetMetrics: trustedBaselineMetrics,
    severeTolerance: 0.05
  });
  const quickGate = evaluateGate(quickRows, 4);

  let annualRows = null;
  let annualGate = null;
  let offAnnualMetrics = null;
  let onAnnualMetrics = null;
  if (quickGate.pass) {
    const offAnnualPath = runAudit({ preset: 'annual', mode: 'off', outputBase: options.offAnnualBase });
    const onAnnualPath = runAudit({ preset: 'annual', mode: 'on', outputBase: options.onAnnualBase });
    offAnnualMetrics = extractMetrics(readJson(offAnnualPath));
    onAnnualMetrics = extractMetrics(readJson(onAnnualPath));
    annualRows = evaluateMetricRows({
      offMetrics: offAnnualMetrics,
      onMetrics: onAnnualMetrics,
      targetMetrics: trustedBaselineMetrics,
      severeTolerance: 0.1
    });
    annualGate = evaluateGate(annualRows, 4);
  }

  const decision = quickGate.pass
    ? annualGate?.pass
      ? {
          verdict: 'keep_candidate',
          nextMove: 'Architecture A1 cleared the bounded annual gate. Use it as the active Phase 1 Climate Base Recovery implementation lane.'
        }
      : {
          verdict: 'annual_reject',
          nextMove: 'Architecture A1 improved the short screen but did not clear the annual gate. Move to Architecture A2: circulation-preserving partition port.'
        }
    : {
        verdict: 'quick_reject',
        nextMove: 'Architecture A1 failed the bounded quick screen. Move to Architecture A2: circulation-preserving partition port.'
      };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-a1-balance-contract.v1',
    generatedAt: new Date().toISOString(),
    trustedBaselinePath: options.trustedBaselinePath,
    quick: {
      offPath: offQuickPath,
      onPath: onQuickPath,
      offMetrics: offQuickMetrics,
      onMetrics: onQuickMetrics,
      rows: quickRows,
      gate: quickGate,
      contractSummary: {
        off: contractSummary(offQuickMetrics),
        on: contractSummary(onQuickMetrics)
      }
    },
    annual: annualRows
      ? {
          offPath: `${options.offAnnualBase}.json`,
          onPath: `${options.onAnnualBase}.json`,
          offMetrics: offAnnualMetrics,
          onMetrics: onAnnualMetrics,
          rows: annualRows,
          gate: annualGate,
          contractSummary: {
            off: contractSummary(offAnnualMetrics),
            on: contractSummary(onAnnualMetrics)
          }
        }
      : {
          skipped: true
        },
    decision
  };

  const markdown = renderArchitectureA1Markdown({
    quickRows,
    quickGate,
    annualRows,
    annualGate,
    offQuick: offQuickMetrics,
    onQuick: onQuickMetrics,
    offAnnual: offAnnualMetrics,
    onAnnual: onAnnualMetrics,
    decision
  });

  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, markdown);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(options.reportPath);
  console.log(options.jsonPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
