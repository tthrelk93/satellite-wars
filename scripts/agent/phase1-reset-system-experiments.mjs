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

const CURRENT_RESET_BASE = path.join(repoRoot, 'weather-validation', 'output', 'phase1-reset-triage-annual');
const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const JSON_OUT = path.join(REPORT_DIR, 'phase1-reset-system-experiments.json');
const MD_OUT = path.join(REPORT_DIR, 'phase1-reset-system-experiments.md');

const EXPERIMENTS = [
  {
    key: 'baseline',
    label: 'Baseline branch state'
  },
  {
    key: 'upper-cloud-persistence-collapse',
    label: 'R2A Upper-cloud persistence collapse'
  },
  {
    key: 'annual-numerical-hardening',
    label: 'R2B Annual numerical hardening'
  },
  {
    key: 'hydrology-balance-repartition',
    label: 'R2C Hydrology balance repartition'
  }
];

const OBJECTIVE_WEIGHTS = {
  itczWidthDeg: 0.25,
  subtropicalDryNorthRatio: 0.2,
  subtropicalDrySouthRatio: 0.2,
  midlatitudeWesterliesNorthU10Ms: 0.25,
  northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1
};

const argv = process.argv.slice(2);
const reuseExisting = !argv.includes('--rerun');
const annualTopCount = 2;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const getMetricSample = (artifact, day = null) => {
  if (!artifact?.samples?.length) return null;
  if (day == null) return artifact.samples[artifact.samples.length - 1]?.metrics || null;
  const found = artifact.samples.find((sample) => sample.targetDay === day || sample.day === day);
  return found?.metrics || null;
};

const getVariantOutputBase = (experimentKey, preset) => (
  path.join(OUTPUT_DIR, `phase1-reset-${experimentKey}-${preset}`)
);

const ensureAudit = ({ experimentKey, preset, outputBase }) => {
  const jsonPath = `${outputBase}.json`;
  if (reuseExisting && fs.existsSync(jsonPath)) return jsonPath;
  const args = [
    auditScript,
    '--preset',
    preset,
    '--no-repro-check',
    '--no-counterfactuals',
    '--quiet',
    '--report-base',
    outputBase
  ];
  if (experimentKey !== 'baseline') {
    args.push('--system-experiment', experimentKey);
  }
  execFileSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  return jsonPath;
};

const computeObjectiveScore = ({ current, variant, target }) => {
  let total = 0;
  const breakdown = {};
  const lowerIsBetter = new Set([
    'itczWidthDeg',
    'subtropicalDryNorthRatio',
    'subtropicalDrySouthRatio',
    'northDryBeltOceanLargeScaleCondensationMeanKgM2'
  ]);
  const higherIsBetter = new Set([
    'midlatitudeWesterliesNorthU10Ms'
  ]);
  for (const [metric, weight] of Object.entries(OBJECTIVE_WEIGHTS)) {
    const currentValue = current?.[metric];
    const variantValue = variant?.[metric];
    let improvement = 0;
    if (lowerIsBetter.has(metric)) {
      if (metric === 'northDryBeltOceanLargeScaleCondensationMeanKgM2') {
        const denom = Math.max(1e-6, Math.abs(currentValue || 0));
        improvement = ((currentValue || 0) - (variantValue || 0)) / denom;
      } else {
        const currentDistance = Math.abs((currentValue || 0) - (target?.[metric] || 0));
        const variantDistance = Math.abs((variantValue || 0) - (target?.[metric] || 0));
        improvement = (currentDistance - variantDistance) / Math.max(0.05, currentDistance);
      }
    } else if (higherIsBetter.has(metric)) {
      const currentDistance = Math.abs((target?.[metric] || 0) - (currentValue || 0));
      const variantDistance = Math.abs((target?.[metric] || 0) - (variantValue || 0));
      improvement = (currentDistance - variantDistance) / Math.max(0.05, currentDistance);
    }
    const weighted = improvement * weight;
    total += weighted;
    breakdown[metric] = {
      current: round(currentValue, 5),
      variant: round(variantValue, 5),
      target: metric === 'northDryBeltOceanLargeScaleCondensationMeanKgM2' ? null : round(target?.[metric], 5),
      improvement: round(improvement, 5),
      weighted: round(weighted, 5)
    };
  }
  return {
    total: round(total, 5),
    breakdown
  };
};

const renderMarkdown = ({ baselineQuickMetrics, baselineAnnualMetrics, trustedBaselineMetrics, experiments, decision }) => {
  const lines = [
    '# Phase 1 Reset System Experiments',
    '',
    'This report compares the three bounded reset experiments against the frozen branch state using only full-objective climate outcomes.',
    '',
    '## Baseline',
    '',
    `- Frozen branch state quick: ITCZ ${baselineQuickMetrics.itczWidthDeg}, dry north ${baselineQuickMetrics.subtropicalDryNorthRatio}, dry south ${baselineQuickMetrics.subtropicalDrySouthRatio}, NH jet ${baselineQuickMetrics.midlatitudeWesterliesNorthU10Ms}, NH dry-belt ocean condensation ${baselineQuickMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}`,
    `- Frozen branch state annual day-365: ITCZ ${baselineAnnualMetrics.itczWidthDeg}, dry north ${baselineAnnualMetrics.subtropicalDryNorthRatio}, dry south ${baselineAnnualMetrics.subtropicalDrySouthRatio}, NH jet ${baselineAnnualMetrics.midlatitudeWesterliesNorthU10Ms}, NH dry-belt ocean condensation ${baselineAnnualMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}`,
    `- Trusted old Phase 1 baseline target: ITCZ ${trustedBaselineMetrics.itczWidthDeg}, dry north ${trustedBaselineMetrics.subtropicalDryNorthRatio}, dry south ${trustedBaselineMetrics.subtropicalDrySouthRatio}, NH jet ${trustedBaselineMetrics.midlatitudeWesterliesNorthU10Ms}`,
    '',
    '## Experiment Results',
    ''
  ];

  for (const experiment of experiments) {
    lines.push(`### ${experiment.label}`);
    lines.push('');
    lines.push(`- Quick score: ${experiment.quick.score.total}`);
    lines.push(`- Annual score: ${experiment.annual?.skipped ? 'skipped after quick ranking' : experiment.annual.score.total}`);
    lines.push(`- Combined score: ${experiment.combinedScore}`);
    lines.push(`- Quick guardrails: ITCZ ${experiment.quick.metrics.itczWidthDeg}, dry north ${experiment.quick.metrics.subtropicalDryNorthRatio}, dry south ${experiment.quick.metrics.subtropicalDrySouthRatio}, NH jet ${experiment.quick.metrics.midlatitudeWesterliesNorthU10Ms}, NH ocean condensation ${experiment.quick.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}`);
    if (experiment.annual?.skipped) {
      lines.push('- Annual day-365 guardrails: skipped after the quick screen ranked this bundle below the top annual candidates');
    } else {
      lines.push(`- Annual day-365 guardrails: ITCZ ${experiment.annual.metrics.itczWidthDeg}, dry north ${experiment.annual.metrics.subtropicalDryNorthRatio}, dry south ${experiment.annual.metrics.subtropicalDrySouthRatio}, NH jet ${experiment.annual.metrics.midlatitudeWesterliesNorthU10Ms}, NH ocean condensation ${experiment.annual.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}`);
    }
    lines.push('');
  }

  lines.push('## Decision');
  lines.push('');
  lines.push(`- Winner: ${decision.winnerLabel || 'none'}`);
  lines.push(`- Verdict: ${decision.verdict}`);
  lines.push(`- Next move: ${decision.nextMove}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
};

const trustedBaselineArtifact = readJson(trustedBaselinePath);
const trustedBaselineMetrics = getMetricSample(trustedBaselineArtifact);
const baselineQuickPath = ensureAudit({
  experimentKey: 'baseline',
  preset: 'quick',
  outputBase: getVariantOutputBase('baseline', 'quick')
});
const baselineAnnualPath = fs.existsSync(`${CURRENT_RESET_BASE}.json`)
  ? `${CURRENT_RESET_BASE}.json`
  : ensureAudit({
      experimentKey: 'baseline',
      preset: 'annual',
      outputBase: CURRENT_RESET_BASE
    });
const baselineQuickArtifact = readJson(baselineQuickPath);
const baselineAnnualArtifact = readJson(baselineAnnualPath);
const baselineQuickMetrics = getMetricSample(baselineQuickArtifact, 30);
const baselineAnnualMetrics = getMetricSample(baselineAnnualArtifact, 365);

const experiments = [];
for (const experiment of EXPERIMENTS.slice(1)) {
  const quickPath = ensureAudit({
    experimentKey: experiment.key,
    preset: 'quick',
    outputBase: getVariantOutputBase(experiment.key, 'quick')
  });
  const quickArtifact = readJson(quickPath);
  const quickMetrics = getMetricSample(quickArtifact, 30);
  const quickScore = computeObjectiveScore({
    current: baselineQuickMetrics,
    variant: quickMetrics,
    target: trustedBaselineMetrics
  });
  experiments.push({
    key: experiment.key,
    label: experiment.label,
    quick: {
      artifactPath: quickPath,
      metrics: quickMetrics,
      score: quickScore
    },
    annual: null,
    combinedScore: null
  });
}

const annualCandidates = [...experiments]
  .sort((a, b) => b.quick.score.total - a.quick.score.total)
  .slice(0, annualTopCount);

for (const experiment of experiments) {
  if (!annualCandidates.find((candidate) => candidate.key === experiment.key)) {
    experiment.annual = {
      skipped: true,
      artifactPath: null,
      metrics: null,
      score: null
    };
    experiment.combinedScore = round(experiment.quick.score.total * 0.35, 5);
    continue;
  }
  const annualPath = ensureAudit({
    experimentKey: experiment.key,
    preset: 'annual',
    outputBase: getVariantOutputBase(experiment.key, 'annual')
  });
  const annualArtifact = readJson(annualPath);
  const annualMetrics = getMetricSample(annualArtifact, 365);
  const annualScore = computeObjectiveScore({
    current: baselineAnnualMetrics,
    variant: annualMetrics,
    target: trustedBaselineMetrics
  });
  experiment.annual = {
    skipped: false,
    artifactPath: annualPath,
    metrics: annualMetrics,
    score: annualScore
  };
  experiment.combinedScore = round(0.35 * experiment.quick.score.total + 0.65 * annualScore.total, 5);
}

experiments.sort((a, b) => b.combinedScore - a.combinedScore);
const annualizedExperiments = experiments.filter((experiment) => experiment.annual && !experiment.annual.skipped);
const winner = annualizedExperiments[0] || null;
const decision = winner && winner.quick.score.total > 0 && winner.annual.score.total > 0
  ? {
      winnerKey: winner.key,
      winnerLabel: winner.label,
      verdict: 'promote_winner',
      nextMove: `Promote ${winner.label} as the new active branch direction and stop the old micro-phase chain.`
    }
  : {
      winnerKey: winner?.key || null,
      winnerLabel: winner?.label || null,
      verdict: 'no_clear_winner',
      nextMove: 'No annualized experiment improved both 30-day and 365-day climate objectives strongly enough. Stop the patch spiral and either roll back to the best trusted climate state or escalate to a broader architecture change.'
    };

const summary = {
  schema: 'satellite-wars.phase1-reset-system-experiments.v1',
  generatedAt: new Date().toISOString(),
  baseline: {
    quickArtifactPath: baselineQuickPath,
    annualArtifactPath: baselineAnnualPath,
    quickMetrics: baselineQuickMetrics,
    annualMetrics: baselineAnnualMetrics,
    trustedBaselineMetrics
  },
  experiments,
  decision
};

fs.writeFileSync(JSON_OUT, JSON.stringify(summary, null, 2));
fs.writeFileSync(MD_OUT, renderMarkdown({
  baselineQuickMetrics,
  baselineAnnualMetrics,
  trustedBaselineMetrics,
  experiments,
  decision
}));
process.stdout.write(`${JSON_OUT}\n${MD_OUT}\n`);
