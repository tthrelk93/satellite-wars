#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1n-circulation-off.json';
const defaultOnPath = '/tmp/phase1n-circulation-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1n-return-flow-rebound-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1n-return-flow-rebound-attribution.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
};

const safeDiv = (num, den) => (Number.isFinite(num) && Number.isFinite(den) && Math.abs(den) > 1e-9 ? num / den : 0);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const latestMetrics = (audit) => audit?.samples?.[audit.samples.length - 1]?.metrics || {};

export function buildPhase1NReturnFlowAttribution({ baselineMetrics, offMetrics, onMetrics, paths }) {
  const westerlyDelta = (onMetrics.midlatitudeWesterliesNorthU10Ms || 0) - (offMetrics.midlatitudeWesterliesNorthU10Ms || 0);
  const widthDelta = (onMetrics.itczWidthDeg || 0) - (offMetrics.itczWidthDeg || 0);
  const northDryDelta = (onMetrics.subtropicalDryNorthRatio || 0) - (offMetrics.subtropicalDryNorthRatio || 0);
  const southDryDelta = (onMetrics.subtropicalDrySouthRatio || 0) - (offMetrics.subtropicalDrySouthRatio || 0);

  const transitionContainmentMean = (
    (onMetrics.northTransitionCirculationReboundContainmentMeanFrac || 0)
    + (onMetrics.southTransitionCirculationReboundContainmentMeanFrac || 0)
  ) / 2;
  const transitionSourceSuppressionMean = (
    (onMetrics.northTransitionCirculationReboundSourceSuppressionMeanFrac || 0)
    + (onMetrics.southTransitionCirculationReboundSourceSuppressionMeanFrac || 0)
  ) / 2;

  const northTransitionSourceDriverDelta = (onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0) - (offMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0);
  const southTransitionSourceDriverDelta = (onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0) - (offMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0);
  const northDrySourceDriverDelta = (onMetrics.northDryBeltSubtropicalSourceDriverMeanFrac || 0) - (offMetrics.northDryBeltSubtropicalSourceDriverMeanFrac || 0);
  const southDrySourceDriverDelta = (onMetrics.southDryBeltSubtropicalSourceDriverMeanFrac || 0) - (offMetrics.southDryBeltSubtropicalSourceDriverMeanFrac || 0);

  const northFloorShare = onMetrics.northTransitionSubtropicalCrossHemiFloorShareMeanFrac || 0;
  const southFloorShare = onMetrics.southTransitionSubtropicalCrossHemiFloorShareMeanFrac || 0;
  const northFloorDominance = safeDiv(
    onMetrics.northTransitionSubtropicalSourceDriverFloorMeanFrac || 0,
    onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0
  );
  const southFloorDominance = safeDiv(
    onMetrics.southTransitionSubtropicalSourceDriverFloorMeanFrac || 0,
    onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0
  );
  const northLocalVsMeanFrac = safeDiv(
    onMetrics.northTransitionSubtropicalLocalHemiSourceMeanFrac || 0,
    onMetrics.northTransitionSubtropicalMeanTropicalSourceMeanFrac || 0
  );
  const southLocalVsMeanFrac = safeDiv(
    onMetrics.southTransitionSubtropicalLocalHemiSourceMeanFrac || 0,
    onMetrics.southTransitionSubtropicalMeanTropicalSourceMeanFrac || 0
  );

  const northSouthDriverSimilarity = 1 - clamp01(
    safeDiv(
      Math.abs((onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0) - (onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0)),
      Math.max(
        1e-6,
        Math.abs(onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0),
        Math.abs(onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0)
      )
    )
  );
  const westerlyFlatness = 1 - clamp01(Math.abs(westerlyDelta) / 0.1);

  const ranking = [
    {
      key: 'transition_response_without_return_flow',
      label: 'Transition containment is active but return flow stays flat',
      score: round(clamp01(((transitionContainmentMean + transitionSourceSuppressionMean) / 2) * westerlyFlatness), 5),
      evidence: {
        transitionContainmentMeanFrac: round(transitionContainmentMean, 5),
        transitionSourceSuppressionMeanFrac: round(transitionSourceSuppressionMean, 5),
        nhWesterlyDeltaMs: round(westerlyDelta, 5)
      }
    },
    {
      key: 'cross_hemi_floor_dominance',
      label: 'Subtropical return-flow driver is still floor-dominated',
      score: round(clamp01(((northFloorShare + southFloorShare) / 2) * clamp01((northFloorDominance + southFloorDominance) / 2)), 5),
      evidence: {
        northCrossHemiFloorShareMeanFrac: round(northFloorShare, 5),
        southCrossHemiFloorShareMeanFrac: round(southFloorShare, 5),
        northFloorDominanceFrac: round(northFloorDominance, 5),
        southFloorDominanceFrac: round(southFloorDominance, 5)
      }
    },
    {
      key: 'hemispheric_source_symmetry',
      label: 'NH return-flow source remains too symmetric with SH',
      score: round(clamp01(northSouthDriverSimilarity * (1 - clamp01(Math.abs(northTransitionSourceDriverDelta - southTransitionSourceDriverDelta) / 0.05))), 5),
      evidence: {
        northTransitionSourceDriverMeanFrac: round(onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0, 5),
        southTransitionSourceDriverMeanFrac: round(onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0, 5),
        northSouthDriverSimilarityFrac: round(northSouthDriverSimilarity, 5),
        northTransitionSourceDriverDeltaFrac: round(northTransitionSourceDriverDelta, 5),
        southTransitionSourceDriverDeltaFrac: round(southTransitionSourceDriverDelta, 5)
      }
    },
    {
      key: 'local_hemi_source_underweights_mean_tropical_source',
      label: 'Local hemispheric source is still underweighted relative to the mean tropical source',
      score: round(clamp01(1 - ((northLocalVsMeanFrac + southLocalVsMeanFrac) / 2)), 5),
      evidence: {
        northLocalVsMeanTropicalSourceFrac: round(northLocalVsMeanFrac, 5),
        southLocalVsMeanTropicalSourceFrac: round(southLocalVsMeanFrac, 5)
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const verdict = ranking[0]?.key === 'cross_hemi_floor_dominance' || ranking[0]?.key === 'hemispheric_source_symmetry'
    ? 'return_flow_driver_partition_mismatch'
    : 'transition_lane_only_response';

  const summary = {
    schema: 'satellite-wars.phase1n-return-flow-rebound-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    baselineGap: {
      itczWidthDeg: {
        baseline: round(baselineMetrics.itczWidthDeg || 0, 5),
        current: round(onMetrics.itczWidthDeg || 0, 5),
        delta: round((onMetrics.itczWidthDeg || 0) - (baselineMetrics.itczWidthDeg || 0), 5)
      },
      subtropicalDryNorthRatio: {
        baseline: round(baselineMetrics.subtropicalDryNorthRatio || 0, 5),
        current: round(onMetrics.subtropicalDryNorthRatio || 0, 5),
        delta: round((onMetrics.subtropicalDryNorthRatio || 0) - (baselineMetrics.subtropicalDryNorthRatio || 0), 5)
      },
      subtropicalDrySouthRatio: {
        baseline: round(baselineMetrics.subtropicalDrySouthRatio || 0, 5),
        current: round(onMetrics.subtropicalDrySouthRatio || 0, 5),
        delta: round((onMetrics.subtropicalDrySouthRatio || 0) - (baselineMetrics.subtropicalDrySouthRatio || 0), 5)
      },
      midlatitudeWesterliesNorthU10Ms: {
        baseline: round(baselineMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5),
        current: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5),
        delta: round((onMetrics.midlatitudeWesterliesNorthU10Ms || 0) - (baselineMetrics.midlatitudeWesterliesNorthU10Ms || 0), 5)
      }
    },
    offOnCompare: {
      itczWidthDeg: { off: round(offMetrics.itczWidthDeg || 0, 5), on: round(onMetrics.itczWidthDeg || 0, 5), delta: round(widthDelta, 5) },
      subtropicalDryNorthRatio: { off: round(offMetrics.subtropicalDryNorthRatio || 0, 5), on: round(onMetrics.subtropicalDryNorthRatio || 0, 5), delta: round(northDryDelta, 5) },
      subtropicalDrySouthRatio: { off: round(offMetrics.subtropicalDrySouthRatio || 0, 5), on: round(onMetrics.subtropicalDrySouthRatio || 0, 5), delta: round(southDryDelta, 5) },
      midlatitudeWesterliesNorthU10Ms: { off: round(offMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), on: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), delta: round(westerlyDelta, 5) },
      northDryBeltOceanLargeScaleCondensationMeanKgM2: {
        off: round(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0, 5),
        on: round(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0, 5),
        delta: round((onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0) - (offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0), 5)
      }
    },
    returnFlowSignals: {
      northTransitionContainmentMeanFrac: round(onMetrics.northTransitionCirculationReboundContainmentMeanFrac || 0, 5),
      southTransitionContainmentMeanFrac: round(onMetrics.southTransitionCirculationReboundContainmentMeanFrac || 0, 5),
      northTransitionSourceSuppressionMeanFrac: round(onMetrics.northTransitionCirculationReboundSourceSuppressionMeanFrac || 0, 5),
      southTransitionSourceSuppressionMeanFrac: round(onMetrics.southTransitionCirculationReboundSourceSuppressionMeanFrac || 0, 5),
      northTransitionSubtropicalSourceDriverMeanFrac: round(onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0, 5),
      southTransitionSubtropicalSourceDriverMeanFrac: round(onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0, 5),
      northDryBeltSubtropicalSourceDriverMeanFrac: round(onMetrics.northDryBeltSubtropicalSourceDriverMeanFrac || 0, 5),
      southDryBeltSubtropicalSourceDriverMeanFrac: round(onMetrics.southDryBeltSubtropicalSourceDriverMeanFrac || 0, 5),
      northTransitionSubtropicalCrossHemiFloorShareMeanFrac: round(northFloorShare, 5),
      southTransitionSubtropicalCrossHemiFloorShareMeanFrac: round(southFloorShare, 5),
      northTransitionSubtropicalWeakHemiFracMean: round(onMetrics.northTransitionSubtropicalWeakHemiFracMean || 0, 5),
      southTransitionSubtropicalWeakHemiFracMean: round(onMetrics.southTransitionSubtropicalWeakHemiFracMean || 0, 5)
    },
    ranking,
    recommendation: verdict === 'return_flow_driver_partition_mismatch'
      ? 'The next patch lane should target subtropical return-flow partitioning in vertical5.js/core5.js, especially cross-hemisphere flooring and NH-specific source weighting, not more transition-occupancy suppression.'
      : 'The next patch lane should stay focused on transition suppression, but only if a stronger circulation response can be coupled to it.'
  };

  return summary;
}

export function renderPhase1NReport(summary) {
  const lines = [
    '# Phase 1N Return-Flow Rebound Attribution',
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${summary.paths.baselinePath}\``,
    `- Phase 1M off compare: \`${summary.paths.offPath}\``,
    `- Phase 1M on compare: \`${summary.paths.onPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- ${summary.recommendation}`,
    '',
    '## Baseline Gap',
    '',
    `- \`itczWidthDeg\`: \`${summary.baselineGap.itczWidthDeg.baseline}\` -> \`${summary.baselineGap.itczWidthDeg.current}\` (delta \`${summary.baselineGap.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.baselineGap.subtropicalDryNorthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDryNorthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.baselineGap.subtropicalDrySouthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDrySouthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDrySouthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.baseline}\` -> \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.current}\` (delta \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Phase 1M Off Versus On',
    '',
    `- \`itczWidthDeg\`: \`${summary.offOnCompare.itczWidthDeg.off}\` -> \`${summary.offOnCompare.itczWidthDeg.on}\``,
    `- \`subtropicalDryNorthRatio\`: \`${summary.offOnCompare.subtropicalDryNorthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDryNorthRatio.on}\``,
    `- \`subtropicalDrySouthRatio\`: \`${summary.offOnCompare.subtropicalDrySouthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDrySouthRatio.on}\``,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\``,
    `- \`northDryBeltOceanLargeScaleCondensationMeanKgM2\`: \`${summary.offOnCompare.northDryBeltOceanLargeScaleCondensationMeanKgM2.off}\` -> \`${summary.offOnCompare.northDryBeltOceanLargeScaleCondensationMeanKgM2.on}\``,
    '',
    '## Return-Flow Signals',
    '',
    `- North/South transition containment: \`${summary.returnFlowSignals.northTransitionContainmentMeanFrac}\` / \`${summary.returnFlowSignals.southTransitionContainmentMeanFrac}\``,
    `- North/South transition source suppression: \`${summary.returnFlowSignals.northTransitionSourceSuppressionMeanFrac}\` / \`${summary.returnFlowSignals.southTransitionSourceSuppressionMeanFrac}\``,
    `- North/South transition source driver: \`${summary.returnFlowSignals.northTransitionSubtropicalSourceDriverMeanFrac}\` / \`${summary.returnFlowSignals.southTransitionSubtropicalSourceDriverMeanFrac}\``,
    `- North/South transition cross-hemi floor share: \`${summary.returnFlowSignals.northTransitionSubtropicalCrossHemiFloorShareMeanFrac}\` / \`${summary.returnFlowSignals.southTransitionSubtropicalCrossHemiFloorShareMeanFrac}\``,
    `- North/South transition weak-hemi fraction: \`${summary.returnFlowSignals.northTransitionSubtropicalWeakHemiFracMean}\` / \`${summary.returnFlowSignals.southTransitionSubtropicalWeakHemiFracMean}\``,
    '',
    '## Ranking',
    ''
  ];
  summary.ranking.forEach((item) => {
    lines.push(`- \`${item.label}\` score \`${item.score}\``);
  });
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function main(argv = process.argv.slice(2)) {
  let baselinePath = defaultBaselinePath;
  let offPath = defaultOffPath;
  let onPath = defaultOnPath;
  let reportPath = defaultReportPath;
  let jsonPath = defaultJsonPath;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--baseline' && argv[i + 1]) baselinePath = path.resolve(argv[++i]);
    else if (arg.startsWith('--baseline=')) baselinePath = path.resolve(arg.slice('--baseline='.length));
    else if (arg === '--off' && argv[i + 1]) offPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--off=')) offPath = path.resolve(arg.slice('--off='.length));
    else if (arg === '--on' && argv[i + 1]) onPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--on=')) onPath = path.resolve(arg.slice('--on='.length));
    else if (arg === '--report' && argv[i + 1]) reportPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--report=')) reportPath = path.resolve(arg.slice('--report='.length));
    else if (arg === '--json' && argv[i + 1]) jsonPath = path.resolve(argv[++i]);
    else if (arg.startsWith('--json=')) jsonPath = path.resolve(arg.slice('--json='.length));
  }

  const baselineMetrics = latestMetrics(readJson(baselinePath));
  const offMetrics = latestMetrics(readJson(offPath));
  const onMetrics = latestMetrics(readJson(onPath));
  const summary = buildPhase1NReturnFlowAttribution({
    baselineMetrics,
    offMetrics,
    onMetrics,
    paths: { baselinePath, offPath, onPath }
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(reportPath, renderPhase1NReport(summary));
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
