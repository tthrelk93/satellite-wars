#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = '/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass';
const defaultCurrentQuick = path.join(repoRoot, 'weather-validation', 'output', 'phase1-reset-baseline-quick.json');
const defaultCurrentAnnual = path.join(repoRoot, 'weather-validation', 'output', 'phase1-reset-triage-annual.json');
const defaultCandidateQuick = path.join(repoRoot, 'weather-validation', 'output', 'earth-weather-phase0-archive-quick.json');
const defaultCandidateAnnual = path.join(repoRoot, 'weather-validation', 'output', 'earth-weather-phase0-archive-annual.json');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-phase0-branch-benchmark.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-phase0-branch-benchmark.json');
const defaultScorecardPath = path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-master-scorecard.md');

const argv = process.argv.slice(2);
const options = {
  currentQuick: defaultCurrentQuick,
  currentAnnual: defaultCurrentAnnual,
  candidateQuick: defaultCandidateQuick,
  candidateAnnual: defaultCandidateAnnual,
  baseline: defaultBaselinePath,
  report: defaultReportPath,
  json: defaultJsonPath,
  scorecard: defaultScorecardPath,
  candidateName: 'Rollback archive (2026-04-07)',
  candidateBranch: 'codex/world-class-weather-loop-archive-20260407-0745',
  currentName: 'Current branch',
  currentBranch: 'codex/world-class-weather-loop'
};

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--current-quick' && argv[i + 1]) options.currentQuick = path.resolve(argv[++i]);
  else if (arg === '--current-annual' && argv[i + 1]) options.currentAnnual = path.resolve(argv[++i]);
  else if (arg === '--candidate-quick' && argv[i + 1]) options.candidateQuick = path.resolve(argv[++i]);
  else if (arg === '--candidate-annual' && argv[i + 1]) options.candidateAnnual = path.resolve(argv[++i]);
  else if (arg === '--baseline' && argv[i + 1]) options.baseline = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.report = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.json = path.resolve(argv[++i]);
  else if (arg === '--scorecard' && argv[i + 1]) options.scorecard = path.resolve(argv[++i]);
  else if (arg === '--candidate-name' && argv[i + 1]) options.candidateName = argv[++i];
  else if (arg === '--candidate-branch' && argv[i + 1]) options.candidateBranch = argv[++i];
  else if (arg === '--current-name' && argv[i + 1]) options.currentName = argv[++i];
  else if (arg === '--current-branch' && argv[i + 1]) options.currentBranch = argv[++i];
}

const round = (value, digits = 3) => (
  Number.isFinite(value)
    ? Number.parseFloat(value.toFixed(digits))
    : null
);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const extractMetrics = (auditJson) => (
  auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {}
);

const toMetricMap = (metrics) => ({
  itczWidthDeg: metrics.itczWidthDeg,
  subtropicalDryNorthRatio: metrics.subtropicalDryNorthRatio,
  subtropicalDrySouthRatio: metrics.subtropicalDrySouthRatio,
  midlatitudeWesterliesNorthU10Ms: metrics.midlatitudeWesterliesNorthU10Ms,
  northDryBeltOceanLargeScaleCondensationMeanKgM2: metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2,
  crossEquatorialVaporFluxNorthKgM_1S: metrics.crossEquatorialVaporFluxNorthKgM_1S,
  stormTrackNorthLatDeg: metrics.stormTrackNorthLatDeg,
  stormTrackSouthLatDeg: metrics.stormTrackSouthLatDeg,
  tropicalCycloneEnvironmentCountNh: metrics.tropicalCycloneEnvironmentCountNh,
  tropicalCycloneEnvironmentCountSh: metrics.tropicalCycloneEnvironmentCountSh
});

const hasComparableDryBeltCondensationInstrumentation = (metrics) => (
  Number.isFinite(metrics?.northDryBeltOceanEvapMeanMmHr) &&
  metrics.northDryBeltOceanEvapMeanMmHr > 0
);

const metricDefs = [
  {
    key: 'itczWidthDeg',
    label: 'ITCZ width',
    direction: 'lower',
    target: 23.646
  },
  {
    key: 'subtropicalDryNorthRatio',
    label: 'NH dry-belt ratio',
    direction: 'lower',
    target: 1.1
  },
  {
    key: 'subtropicalDrySouthRatio',
    label: 'SH dry-belt ratio',
    direction: 'lower',
    target: 0.519
  },
  {
    key: 'midlatitudeWesterliesNorthU10Ms',
    label: 'NH midlatitude westerlies',
    direction: 'higher',
    target: 1.192
  },
  {
    key: 'northDryBeltOceanLargeScaleCondensationMeanKgM2',
    label: 'NH dry-belt ocean condensation',
    direction: 'lower',
    target: null
  },
  {
    key: 'crossEquatorialVaporFluxNorthKgM_1S',
    label: 'Cross-equatorial vapor flux north',
    direction: 'band',
    targetRange: [75, 250]
  }
];

const scoreBandDistance = (value, min, max) => {
  if (!Number.isFinite(value)) return null;
  if (value >= min && value <= max) return 0;
  if (value < min) return min - value;
  return value - max;
};

const compareMetric = (def, current, candidate, currentAllMetrics, candidateAllMetrics) => {
  if (def.key === 'northDryBeltOceanLargeScaleCondensationMeanKgM2') {
    const comparable = hasComparableDryBeltCondensationInstrumentation(currentAllMetrics)
      && hasComparableDryBeltCondensationInstrumentation(candidateAllMetrics);
    if (!comparable) {
      return {
        comparable: false,
        winner: null,
        severeRegression: false
      };
    }
  }
  if (!Number.isFinite(current) || !Number.isFinite(candidate)) {
    return {
      comparable: false,
      winner: null,
      severeRegression: false
    };
  }
  if (def.direction === 'lower') {
    const winner = candidate < current ? 'candidate' : candidate > current ? 'current' : 'tie';
    const severeRegression = candidate > current * 1.1;
    return { comparable: true, winner, severeRegression };
  }
  if (def.direction === 'higher') {
    const winner = candidate > current ? 'candidate' : candidate < current ? 'current' : 'tie';
    const severeRegression = candidate < current * 0.9;
    return { comparable: true, winner, severeRegression };
  }
  if (def.direction === 'band') {
    const currentDist = scoreBandDistance(current, def.targetRange[0], def.targetRange[1]);
    const candidateDist = scoreBandDistance(candidate, def.targetRange[0], def.targetRange[1]);
    const winner = candidateDist < currentDist ? 'candidate' : candidateDist > currentDist ? 'current' : 'tie';
    const severeRegression = candidateDist > currentDist * 1.1 && candidateDist - currentDist > 5;
    return { comparable: true, winner, severeRegression };
  }
  return { comparable: false, winner: null, severeRegression: false };
};

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });

const currentQuickJson = readJson(options.currentQuick);
const currentAnnualJson = readJson(options.currentAnnual);
const candidateQuickJson = readJson(options.candidateQuick);
const candidateAnnualJson = readJson(options.candidateAnnual);
const baselineJson = readJson(options.baseline);

const currentQuickAllMetrics = extractMetrics(currentQuickJson);
const currentAnnualAllMetrics = extractMetrics(currentAnnualJson);
const candidateQuickAllMetrics = extractMetrics(candidateQuickJson);
const candidateAnnualAllMetrics = extractMetrics(candidateAnnualJson);
const trustedBaselineAllMetrics = extractMetrics(baselineJson);

const currentQuick = toMetricMap(currentQuickAllMetrics);
const currentAnnual = toMetricMap(currentAnnualAllMetrics);
const candidateQuick = toMetricMap(candidateQuickAllMetrics);
const candidateAnnual = toMetricMap(candidateAnnualAllMetrics);
const trustedBaseline = toMetricMap(trustedBaselineAllMetrics);

const annualComparisons = metricDefs.map((def) => {
  const outcome = compareMetric(
    def,
    currentAnnual[def.key],
    candidateAnnual[def.key],
    currentAnnualAllMetrics,
    candidateAnnualAllMetrics
  );
  return {
    key: def.key,
    label: def.label,
    current: currentAnnual[def.key] ?? null,
    candidate: candidateAnnual[def.key] ?? null,
    trustedBaseline: trustedBaseline[def.key] ?? null,
    comparable: outcome.comparable,
    winner: outcome.winner,
    severeRegression: outcome.severeRegression
  };
});

const comparableAnnual = annualComparisons.filter((entry) => entry.comparable);
const candidateWins = comparableAnnual.filter((entry) => entry.winner === 'candidate').length;
const currentWins = comparableAnnual.filter((entry) => entry.winner === 'current').length;
const severeRegressions = comparableAnnual.filter((entry) => entry.severeRegression).map((entry) => entry.key);

let verdict = 'no_clear_winner';
let canonicalBase = null;
if (candidateWins >= 4 && severeRegressions.length === 0) {
  verdict = 'rollback_candidate_selected';
  canonicalBase = {
    name: options.candidateName,
    branch: options.candidateBranch
  };
} else if (currentWins >= 4) {
  verdict = 'current_branch_retained';
  canonicalBase = {
    name: options.currentName,
    branch: options.currentBranch
  };
}

const decision = {
  verdict,
  candidateWins,
  currentWins,
  comparableMetricCount: comparableAnnual.length,
  severeRegressions,
  canonicalBase,
  nextMove: verdict === 'rollback_candidate_selected'
    ? 'Make the rollback archive branch the canonical Phase 1 climate base and begin Climate Base Recovery from there.'
    : verdict === 'current_branch_retained'
      ? 'Keep the current branch as the canonical Phase 1 climate base and begin Climate Base Recovery there.'
      : 'No branch cleared the Phase 0 gate cleanly. Do not continue local patching; escalate to architecture change.'
};

const result = {
  schema: 'satellite-wars.earth-weather-phase0-branch-benchmark.v1',
  generatedAt: new Date().toISOString(),
  current: {
    name: options.currentName,
    branch: options.currentBranch,
    quickArtifactPath: options.currentQuick,
    annualArtifactPath: options.currentAnnual,
    quickMetrics: currentQuick,
    annualMetrics: currentAnnual
  },
  candidate: {
    name: options.candidateName,
    branch: options.candidateBranch,
    quickArtifactPath: options.candidateQuick,
    annualArtifactPath: options.candidateAnnual,
    quickMetrics: candidateQuick,
    annualMetrics: candidateAnnual
  },
  trustedBaseline,
  annualComparisons,
  decision
};

const formatMetric = (value) => (Number.isFinite(value) ? String(round(value, 3)) : 'n/a');

const report = `# Earth Weather Phase 0 Branch Benchmark

## Objective

Choose the canonical branch that will serve as the new base for Earth-like climate and emergent weather work.

## Branches Compared

- Current branch: \`${options.currentBranch}\`
- Rollback candidate: \`${options.candidateBranch}\`
- Trusted older climate anchor: [phase1-hadley-second-pass-restore-v4.json](${defaultBaselinePath})

## Important method note

The rollback candidate predates the modern annual audit harness. To keep the benchmark apples-to-apples, the current annual audit harness was overlaid into a temporary benchmark worktree and executed against the rollback branch code without modifying repo history.

## Quick screen

- Current quick: ITCZ ${formatMetric(currentQuick.itczWidthDeg)}, dry north ${formatMetric(currentQuick.subtropicalDryNorthRatio)}, dry south ${formatMetric(currentQuick.subtropicalDrySouthRatio)}, NH jet ${formatMetric(currentQuick.midlatitudeWesterliesNorthU10Ms)}
- Rollback quick: ITCZ ${formatMetric(candidateQuick.itczWidthDeg)}, dry north ${formatMetric(candidateQuick.subtropicalDryNorthRatio)}, dry south ${formatMetric(candidateQuick.subtropicalDrySouthRatio)}, NH jet ${formatMetric(candidateQuick.midlatitudeWesterliesNorthU10Ms)}

## Day-365 comparison

${annualComparisons.map((entry) => `- ${entry.label}: current ${formatMetric(entry.current)}, rollback ${formatMetric(entry.candidate)}, trusted ${formatMetric(entry.trustedBaseline)}, winner ${entry.winner || 'n/a'}`).join('\n')}

## Decision

- Verdict: \`${decision.verdict}\`
- Rollback metric wins: ${decision.candidateWins}
- Current metric wins: ${decision.currentWins}
- Comparable annual metrics: ${decision.comparableMetricCount}
- Severe rollback regressions: ${decision.severeRegressions.length ? decision.severeRegressions.join(', ') : 'none'}
- Next move: ${decision.nextMove}
`;

const scorecard = `# Earth Weather Master Scorecard

Updated: ${new Date().toISOString().slice(0, 10)}

## Top-level phase status

- Phase 0 Base-State Recovery Decision: ${decision.verdict === 'rollback_candidate_selected' || decision.verdict === 'current_branch_retained' ? 'COMPLETE' : 'FAILED'}
- Phase 1 Climate Base Recovery: BLOCKED
- Phase 2 Seasonal Earth Realism: BLOCKED
- Phase 3 Regional Weather-Regime Realism: BLOCKED
- Phase 4 Tropical Cyclone Environment Realism: BLOCKED
- Phase 5 Emergent Storm Realism: BLOCKED
- Phase 6 Multi-Year Stability And Drift: BLOCKED
- Phase 7 Scientific Review And Ship Readiness: BLOCKED

## Canonical base decision

- Current branch: \`${options.currentBranch}\`
- Rollback candidate: \`${options.candidateBranch}\`
- Verdict: \`${decision.verdict}\`
- Selected base: ${decision.canonicalBase ? `\`${decision.canonicalBase.branch}\`` : 'none'}

## Day-365 benchmark summary

${annualComparisons.map((entry) => `- ${entry.label}: current ${formatMetric(entry.current)}, rollback ${formatMetric(entry.candidate)}, winner ${entry.winner || 'n/a'}`).join('\n')}
`;

ensureDir(options.json);
ensureDir(options.report);
ensureDir(options.scorecard);
fs.writeFileSync(options.json, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(options.report, `${report}\n`);
fs.writeFileSync(options.scorecard, `${scorecard}\n`);

console.log(options.json);
console.log(options.report);
console.log(options.scorecard);
