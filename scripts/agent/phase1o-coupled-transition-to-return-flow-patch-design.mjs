#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1o-circulation-off.json';
const defaultOnPath = '/tmp/phase1o-circulation-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1o-coupled-transition-to-return-flow-patch-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1o-coupled-transition-to-return-flow-patch-design.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestMetrics = (audit) => audit?.samples?.[audit.samples.length - 1]?.metrics || {};

export function buildPhase1ODesign({ baselineMetrics, offMetrics, onMetrics, paths }) {
  const nhWesterlyDelta = (onMetrics.midlatitudeWesterliesNorthU10Ms || 0) - (offMetrics.midlatitudeWesterliesNorthU10Ms || 0);
  const widthDelta = (onMetrics.itczWidthDeg || 0) - (offMetrics.itczWidthDeg || 0);
  const northDryDelta = (onMetrics.subtropicalDryNorthRatio || 0) - (offMetrics.subtropicalDryNorthRatio || 0);
  const southDryDelta = (onMetrics.subtropicalDrySouthRatio || 0) - (offMetrics.subtropicalDrySouthRatio || 0);
  const northCondDelta = (onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0) - (offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0);

  const transitionContainmentMean = (
    (onMetrics.northTransitionCirculationReboundContainmentMeanFrac || 0)
    + (onMetrics.southTransitionCirculationReboundContainmentMeanFrac || 0)
  ) / 2;
  const transitionSuppressedSourceMean = (
    (onMetrics.northTransitionCirculationReboundSuppressedSourceMeanFrac || 0)
    + (onMetrics.southTransitionCirculationReboundSuppressedSourceMeanFrac || 0)
  ) / 2;
  const returnFlowOpportunityMean = (
    (onMetrics.northDryBeltCirculationReturnFlowOpportunityMeanFrac || 0)
    + (onMetrics.southDryBeltCirculationReturnFlowOpportunityMeanFrac || 0)
  ) / 2;
  const northSourceDriverDelta = (onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0) - (offMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0);
  const southSourceDriverDelta = (onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0) - (offMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0);
  const sourceDriverResponseMean = (Math.abs(northSourceDriverDelta) + Math.abs(southSourceDriverDelta)) / 2;
  const westerlyFlatness = 1 - clamp01(Math.abs(nhWesterlyDelta) / 0.1);

  const missingCouplingScore = round(
    clamp01(
      (
        0.45 * transitionContainmentMean
        + 1.6 * transitionSuppressedSourceMean
        + 1.8 * returnFlowOpportunityMean
      )
      * (1 - clamp01(sourceDriverResponseMean / 0.08))
      * (0.75 + 0.25 * westerlyFlatness)
    ),
    5
  );
  const overLocalTransitionTuningScore = round(
    clamp01(
      transitionContainmentMean
      * clamp01(Math.abs(widthDelta) / 0.08 + Math.abs(northDryDelta) / 0.02 + Math.abs(southDryDelta) / 0.01)
      * westerlyFlatness
      * 0.55
    ),
    5
  );
  const condensationGuardrailScore = round(
    clamp01(
      (northCondDelta <= 0 ? 1 : 0.2)
      * (1 - clamp01(Math.abs(nhWesterlyDelta) / 0.1))
      * transitionSuppressedSourceMean
    ),
    5
  );

  const ranking = [
    {
      key: 'missing_transition_to_return_flow_coupling',
      label: 'Transition suppression is live, but the removed source is not being converted into return-flow recovery',
      score: missingCouplingScore,
      evidence: {
        northTransitionContainmentMeanFrac: round(onMetrics.northTransitionCirculationReboundContainmentMeanFrac || 0, 5),
        southTransitionContainmentMeanFrac: round(onMetrics.southTransitionCirculationReboundContainmentMeanFrac || 0, 5),
        northTransitionSuppressedSourceMeanFrac: round(onMetrics.northTransitionCirculationReboundSuppressedSourceMeanFrac || 0, 5),
        southTransitionSuppressedSourceMeanFrac: round(onMetrics.southTransitionCirculationReboundSuppressedSourceMeanFrac || 0, 5),
        northDryBeltReturnFlowOpportunityMeanFrac: round(onMetrics.northDryBeltCirculationReturnFlowOpportunityMeanFrac || 0, 5),
        southDryBeltReturnFlowOpportunityMeanFrac: round(onMetrics.southDryBeltCirculationReturnFlowOpportunityMeanFrac || 0, 5),
        nhWesterlyDeltaMs: round(nhWesterlyDelta, 5),
        northTransitionSourceDriverDeltaFrac: round(northSourceDriverDelta, 5),
        southTransitionSourceDriverDeltaFrac: round(southSourceDriverDelta, 5)
      }
    },
    {
      key: 'transition_only_lane_is_real_but_incomplete',
      label: 'The current lane still behaves like width/dry-belt trimming without jet recovery',
      score: overLocalTransitionTuningScore,
      evidence: {
        itczWidthDeltaDeg: round(widthDelta, 5),
        northDryRatioDelta: round(northDryDelta, 5),
        southDryRatioDelta: round(southDryDelta, 5),
        nhWesterlyDeltaMs: round(nhWesterlyDelta, 5)
      }
    },
    {
      key: 'maintenance_lane_is_preserved_during_circulation_design',
      label: 'The next circulation patch should preserve the kept marine-maintenance improvement',
      score: condensationGuardrailScore,
      evidence: {
        northDryBeltOceanLargeScaleCondensationDeltaKgM2: round(northCondDelta, 5),
        northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2: round(onMetrics.northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2 || 0, 5)
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    schema: 'satellite-wars.phase1o-coupled-transition-to-return-flow-patch-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'missing_transition_to_return_flow_coupling',
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
      midlatitudeWesterliesNorthU10Ms: { off: round(offMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), on: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), delta: round(nhWesterlyDelta, 5) },
      northDryBeltOceanLargeScaleCondensationMeanKgM2: {
        off: round(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0, 5),
        on: round(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0, 5),
        delta: round(northCondDelta, 5)
      }
    },
    transitionToReturnFlowSignals: {
      northTransitionContainmentMeanFrac: round(onMetrics.northTransitionCirculationReboundContainmentMeanFrac || 0, 5),
      southTransitionContainmentMeanFrac: round(onMetrics.southTransitionCirculationReboundContainmentMeanFrac || 0, 5),
      northTransitionSuppressedSourceMeanFrac: round(onMetrics.northTransitionCirculationReboundSuppressedSourceMeanFrac || 0, 5),
      southTransitionSuppressedSourceMeanFrac: round(onMetrics.southTransitionCirculationReboundSuppressedSourceMeanFrac || 0, 5),
      northTransitionSuppressedSourceShareMeanFrac: round(onMetrics.northTransitionCirculationReboundSuppressedSourceShareMeanFrac || 0, 5),
      southTransitionSuppressedSourceShareMeanFrac: round(onMetrics.southTransitionCirculationReboundSuppressedSourceShareMeanFrac || 0, 5),
      northDryBeltReturnFlowOpportunityMeanFrac: round(onMetrics.northDryBeltCirculationReturnFlowOpportunityMeanFrac || 0, 5),
      southDryBeltReturnFlowOpportunityMeanFrac: round(onMetrics.southDryBeltCirculationReturnFlowOpportunityMeanFrac || 0, 5),
      northTransitionSourceDriverMeanFrac: round(onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0, 5),
      southTransitionSourceDriverMeanFrac: round(onMetrics.southTransitionSubtropicalSourceDriverMeanFrac || 0, 5)
    },
    ranking,
    patchDesign: {
      primaryFiles: [
        path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'),
        path.join(repoRoot, 'src', 'weather', 'v2', 'core5.js')
      ],
      mechanism: 'Convert a capped share of same-hemisphere transition-suppressed convective source into a subtropical return-flow reinforcement term instead of treating containment as a pure sink.',
      targetSignature: {
        moveNorthWesterliesUpwardMs: 0.08,
        preserveOrImproveItczWidthDeltaDeg: -0.02,
        preserveOrImproveNorthDryRatioDelta: -0.005,
        preserveOrImproveNorthDryBeltOceanCondensationDeltaKgM2: -0.002
      },
      designRules: [
        'Use the existing transition containment lane as the selector, not a new occupancy family.',
        'Reinforce same-hemisphere subtropical source driver or descent support with capped transition-suppressed source, not cross-hemisphere floor borrowing.',
        'Keep the marine-maintenance suppression lane intact and treat it as a guardrail, not the primary circulation lever.',
        'Gate any new return-flow boost so it helps 15-35 degree subtropical descent without broadening the tropical core.'
      ]
    }
  };
}

export function renderPhase1OReport(summary) {
  const lines = [
    '# Phase 1O Coupled Transition-To-Return-Flow Patch Design',
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${summary.paths.baselinePath}\``,
    `- Phase 1O off compare: \`${summary.paths.offPath}\``,
    `- Phase 1O on compare: \`${summary.paths.onPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Primary mechanism: ${summary.patchDesign.mechanism}`,
    '',
    '## Baseline Gap',
    '',
    `- \`itczWidthDeg\`: \`${summary.baselineGap.itczWidthDeg.baseline}\` -> \`${summary.baselineGap.itczWidthDeg.current}\` (delta \`${summary.baselineGap.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.baselineGap.subtropicalDryNorthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDryNorthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.baselineGap.subtropicalDrySouthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDrySouthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDrySouthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.baseline}\` -> \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.current}\` (delta \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Phase 1M Lane Off Versus On',
    '',
    `- \`itczWidthDeg\`: \`${summary.offOnCompare.itczWidthDeg.off}\` -> \`${summary.offOnCompare.itczWidthDeg.on}\``,
    `- \`subtropicalDryNorthRatio\`: \`${summary.offOnCompare.subtropicalDryNorthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDryNorthRatio.on}\``,
    `- \`subtropicalDrySouthRatio\`: \`${summary.offOnCompare.subtropicalDrySouthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDrySouthRatio.on}\``,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\``,
    `- \`northDryBeltOceanLargeScaleCondensationMeanKgM2\`: \`${summary.offOnCompare.northDryBeltOceanLargeScaleCondensationMeanKgM2.off}\` -> \`${summary.offOnCompare.northDryBeltOceanLargeScaleCondensationMeanKgM2.on}\``,
    '',
    '## Transition-To-Return-Flow Signals',
    '',
    `- North/South transition containment: \`${summary.transitionToReturnFlowSignals.northTransitionContainmentMeanFrac}\` / \`${summary.transitionToReturnFlowSignals.southTransitionContainmentMeanFrac}\``,
    `- North/South transition suppressed source: \`${summary.transitionToReturnFlowSignals.northTransitionSuppressedSourceMeanFrac}\` / \`${summary.transitionToReturnFlowSignals.southTransitionSuppressedSourceMeanFrac}\``,
    `- North/South suppressed source share: \`${summary.transitionToReturnFlowSignals.northTransitionSuppressedSourceShareMeanFrac}\` / \`${summary.transitionToReturnFlowSignals.southTransitionSuppressedSourceShareMeanFrac}\``,
    `- North/South dry-belt return-flow opportunity: \`${summary.transitionToReturnFlowSignals.northDryBeltReturnFlowOpportunityMeanFrac}\` / \`${summary.transitionToReturnFlowSignals.southDryBeltReturnFlowOpportunityMeanFrac}\``,
    `- North/South transition source driver: \`${summary.transitionToReturnFlowSignals.northTransitionSourceDriverMeanFrac}\` / \`${summary.transitionToReturnFlowSignals.southTransitionSourceDriverMeanFrac}\``,
    '',
    '## Ranking',
    '',
    ...summary.ranking.map((entry) => `- \`${entry.label}\` score \`${entry.score}\``),
    '',
    '## Patch Design',
    '',
    `- Primary files: \`${summary.patchDesign.primaryFiles.join('`, `')}\``,
    `- Target NH westerly improvement: \`${summary.patchDesign.targetSignature.moveNorthWesterliesUpwardMs}\` m/s`,
    `- Width guardrail target: \`${summary.patchDesign.targetSignature.preserveOrImproveItczWidthDeltaDeg}\` deg or better`,
    `- North dry-ratio guardrail target: \`${summary.patchDesign.targetSignature.preserveOrImproveNorthDryRatioDelta}\` or better`,
    `- Ocean condensation guardrail target: \`${summary.patchDesign.targetSignature.preserveOrImproveNorthDryBeltOceanCondensationDeltaKgM2}\` kg/m² or better`,
    '',
    ...summary.patchDesign.designRules.map((rule) => `- ${rule}`)
  ];
  return `${lines.join('\n')}\n`;
}

export function main(argv = process.argv.slice(2)) {
  const args = { baseline: defaultBaselinePath, off: defaultOffPath, on: defaultOnPath, report: defaultReportPath, json: defaultJsonPath };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--baseline' && next) args.baseline = next;
    if (arg === '--off' && next) args.off = next;
    if (arg === '--on' && next) args.on = next;
    if (arg === '--report' && next) args.report = next;
    if (arg === '--json' && next) args.json = next;
  }

  const baselineMetrics = latestMetrics(readJson(args.baseline));
  const offMetrics = latestMetrics(readJson(args.off));
  const onMetrics = latestMetrics(readJson(args.on));
  const summary = buildPhase1ODesign({
    baselineMetrics,
    offMetrics,
    onMetrics,
    paths: {
      baselinePath: args.baseline,
      offPath: args.off,
      onPath: args.on
    }
  });

  fs.mkdirSync(path.dirname(args.report), { recursive: true });
  fs.mkdirSync(path.dirname(args.json), { recursive: true });
  fs.writeFileSync(args.report, renderPhase1OReport(summary));
  fs.writeFileSync(args.json, `${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
