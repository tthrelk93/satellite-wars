#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

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
  offQuickBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-b1-off-quick'),
  offAnnualBase: path.join(OUTPUT_DIR, 'earth-weather-architecture-b1-off-annual'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-b1-circulation-scaffold.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-b1-circulation-scaffold.json')
};

const METRIC_DEFS = [
  { key: 'itczWidthDeg', label: 'ITCZ width', direction: 'lower' },
  { key: 'subtropicalDryNorthRatio', label: 'NH dry-belt ratio', direction: 'lower' },
  { key: 'subtropicalDrySouthRatio', label: 'SH dry-belt ratio', direction: 'lower' },
  { key: 'midlatitudeWesterliesNorthU10Ms', label: 'NH midlatitude westerlies', direction: 'higher' },
  { key: 'northDryBeltOceanLargeScaleCondensationMeanKgM2', label: 'NH dry-belt ocean condensation', direction: 'lower' },
  { key: 'crossEquatorialVaporFluxNorthKgM_1S', label: 'Cross-equatorial vapor flux north', direction: 'band', targetRange: [75, 250] }
];

const CANDIDATES = [
  {
    mode: 'floor-reset-light-drying',
    label: 'Floor Reset + Light Drying',
    description: 'Reset the cross-hemi floor and weak-hemi boost, disable containment, and lighten the subtropical drying/theta scaffold.'
  },
  {
    mode: 'narrow-band-light-drying',
    label: 'Narrow Band + Light Drying',
    description: 'Lighten the scaffold and pull the active subtropical drying band poleward into a narrower 18-30 degree lane.'
  },
  {
    mode: 'narrow-band-soft-containment',
    label: 'Narrow Band + Soft Containment',
    description: 'Use the narrower lighter scaffold but restore only a small containment share to protect partition gains.'
  }
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

const computeDistanceGain = (rows) => rows.reduce((sum, row) => {
  if (!Number.isFinite(row.offDistance) || !Number.isFinite(row.onDistance)) return sum;
  return sum + (row.offDistance - row.onDistance);
}, 0);

export function rankCandidateResults(results) {
  return [...results].sort((a, b) => {
    if (Number(a.gate.pass) !== Number(b.gate.pass)) return Number(b.gate.pass) - Number(a.gate.pass);
    if (a.gate.severeRegressions.length !== b.gate.severeRegressions.length) {
      return a.gate.severeRegressions.length - b.gate.severeRegressions.length;
    }
    if (a.gate.improvedCount !== b.gate.improvedCount) return b.gate.improvedCount - a.gate.improvedCount;
    return b.distanceGain - a.distanceGain;
  });
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
    '--architecture-b1-circulation-scaffold',
    mode
  ];
  execFileSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  return `${outputBase}.json`;
};

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureB1Markdown({ quickCandidates, selectedCandidate, annualRows, annualGate, decision }) {
  const lines = [
    '# Earth Weather Architecture B1 Circulation Scaffold',
    '',
    'This report benchmarks circulation-first scaffold rebuild variants before any new partition re-porting is attempted.',
    '',
    '## Quick candidates',
    ''
  ];

  for (const candidate of quickCandidates) {
    lines.push(`### ${candidate.label}`);
    lines.push('');
    lines.push(`- mode: \`${candidate.mode}\``);
    lines.push(`- description: ${candidate.description}`);
    lines.push(`- improved metrics: ${candidate.gate.improvedCount} / ${candidate.rows.length}`);
    lines.push(`- severe regressions: ${candidate.gate.severeRegressions.length ? candidate.gate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- quick pass: ${candidate.gate.pass}`);
    lines.push(`- distance gain: \`${round(candidate.distanceGain)}\``);
    lines.push('');
    lines.push(renderRows(candidate.rows));
    lines.push('');
  }

  lines.push('## Selected candidate');
  lines.push('');
  lines.push(`- mode: \`${selectedCandidate.mode}\``);
  lines.push(`- label: ${selectedCandidate.label}`);
  lines.push(`- quick pass: ${selectedCandidate.gate.pass}`);
  lines.push('');

  if (annualRows) {
    lines.push('## Annual gate');
    lines.push('');
    lines.push(renderRows(annualRows));
    lines.push('');
    lines.push(`- improved metrics: ${annualGate.improvedCount} / ${annualRows.length}`);
    lines.push(`- severe regressions: ${annualGate.severeRegressions.length ? annualGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- annual keep: ${annualGate.pass}`);
    lines.push('');
  } else {
    lines.push('## Annual gate');
    lines.push('');
    lines.push('- skipped because the best quick candidate did not clear the bounded entry gate');
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
  const offQuickMetrics = extractMetrics(readJson(offQuickPath));

  const quickCandidates = CANDIDATES.map((candidate) => {
    const outputBase = path.join(OUTPUT_DIR, `earth-weather-architecture-b1-${candidate.mode}-quick`);
    const outputPath = runAudit({ preset: 'quick', mode: candidate.mode, outputBase });
    const onMetrics = extractMetrics(readJson(outputPath));
    const rows = evaluateMetricRows({
      offMetrics: offQuickMetrics,
      onMetrics,
      targetMetrics: trustedBaselineMetrics,
      severeTolerance: 0.05
    });
    const gate = evaluateGate(rows, 4);
    return {
      ...candidate,
      outputPath,
      onMetrics,
      rows,
      gate,
      distanceGain: round(computeDistanceGain(rows))
    };
  });

  const rankedQuickCandidates = rankCandidateResults(quickCandidates);
  const selectedCandidate = rankedQuickCandidates[0];

  let annualRows = null;
  let annualGate = null;
  let offAnnualMetrics = null;
  let onAnnualMetrics = null;
  let offAnnualPath = null;
  let onAnnualPath = null;
  if (selectedCandidate.gate.pass) {
    offAnnualPath = runAudit({ preset: 'annual', mode: 'off', outputBase: options.offAnnualBase });
    onAnnualPath = runAudit({
      preset: 'annual',
      mode: selectedCandidate.mode,
      outputBase: path.join(OUTPUT_DIR, `earth-weather-architecture-b1-${selectedCandidate.mode}-annual`)
    });
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

  const decision = selectedCandidate.gate.pass
    ? annualGate?.pass
      ? {
          verdict: 'keep_candidate',
          nextMove: `Architecture B1 selected \`${selectedCandidate.mode}\` and cleared the annual gate. Move to Architecture B2: partition re-port on rebuilt scaffold.`
        }
      : {
          verdict: 'annual_reject',
          nextMove: 'Architecture B1 found the best circulation-first scaffold, but it still failed the annual gate. Move to Architecture B2: explicit circulation-state port.'
        }
    : {
        verdict: 'quick_reject',
        nextMove: 'Architecture B1 failed the bounded quick screen across every scaffold candidate. Move to Architecture B2: explicit circulation-state port.'
      };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-b1-circulation-scaffold.v1',
    generatedAt: new Date().toISOString(),
    trustedBaselinePath: options.trustedBaselinePath,
    quick: {
      offPath: offQuickPath,
      offMetrics: offQuickMetrics,
      candidates: quickCandidates,
      rankedModes: rankedQuickCandidates.map((candidate) => candidate.mode)
    },
    annual: annualRows
      ? {
          offPath: offAnnualPath,
          onPath: onAnnualPath,
          offMetrics: offAnnualMetrics,
          onMetrics: onAnnualMetrics,
          rows: annualRows,
          gate: annualGate
        }
      : null,
    selectedMode: selectedCandidate.mode,
    decision
  };

  const markdown = renderArchitectureB1Markdown({
    quickCandidates: rankedQuickCandidates,
    selectedCandidate,
    annualRows,
    annualGate,
    decision
  });

  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, markdown);
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
