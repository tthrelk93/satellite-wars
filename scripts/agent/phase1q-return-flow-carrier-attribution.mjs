#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1q-carrier-off.json';
const defaultOnPath = '/tmp/phase1q-carrier-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1q-return-flow-carrier-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1q-return-flow-carrier-attribution.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestMetrics = (audit) => audit?.samples?.[audit.samples.length - 1]?.metrics || {};
const mean = (...values) => values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / Math.max(1, values.length);
const delta = (onValue, offValue) => (Number(onValue) || 0) - (Number(offValue) || 0);
const absDelta = (onValue, offValue) => Math.abs(delta(onValue, offValue));
const normalize = (magnitude, scale) => clamp01(scale > 0 ? magnitude / scale : 0);

const phaseForVerdict = (verdict) => {
  switch (verdict) {
    case 'source_driver_to_drying_conversion_failure':
      return 'Phase 1R: Drying Conversion Patch Design';
    case 'drying_to_omega_response_failure':
      return 'Phase 1R: Omega Response Patch Design';
    default:
      return 'Phase 1R: Jet Recovery Patch Design';
  }
};

export function buildPhase1QReturnFlowCarrierAttribution({ baselineMetrics, offMetrics, onMetrics, paths }) {
  const couplingAppliedOn = onMetrics.northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac || 0;
  const sourceDriverDelta = mean(
    delta(onMetrics.northTransitionSubtropicalSourceDriverMeanFrac, offMetrics.northTransitionSubtropicalSourceDriverMeanFrac),
    delta(onMetrics.northDryBeltSubtropicalSourceDriverMeanFrac, offMetrics.northDryBeltSubtropicalSourceDriverMeanFrac)
  );
  const dryingDeltaMean = mean(
    delta(onMetrics.northTransitionSubtropicalSubsidenceDryingMeanFrac, offMetrics.northTransitionSubtropicalSubsidenceDryingMeanFrac),
    delta(onMetrics.northDryBeltSubtropicalSubsidenceDryingMeanFrac, offMetrics.northDryBeltSubtropicalSubsidenceDryingMeanFrac)
  );
  const omegaDeltaMean = mean(
    delta(onMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS, offMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS),
    delta(onMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS, offMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS)
  );
  const jetDelta = delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms);

  const sourceDriverResponseScore = normalize(Math.abs(sourceDriverDelta), 0.01);
  const dryingResponseScore = normalize(Math.abs(dryingDeltaMean), 0.01);
  const omegaResponseScore = normalize(Math.abs(omegaDeltaMean), 0.01);
  const jetResponseScore = normalize(Math.abs(jetDelta), 0.05);
  const couplingActivationScore = normalize(couplingAppliedOn, 0.01);

  const ranking = [
    {
      key: 'source_driver_to_drying_conversion_failure',
      label: 'Source driver moves too little into subtropical drying',
      score: round(couplingActivationScore * (1 - dryingResponseScore) * (1 - 0.5 * sourceDriverResponseScore), 5),
      evidence: {
        northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: round(couplingAppliedOn, 5),
        sourceDriverDeltaMeanFrac: round(sourceDriverDelta, 5),
        dryingDeltaMeanFrac: round(dryingDeltaMean, 5)
      }
    },
    {
      key: 'drying_to_omega_response_failure',
      label: 'Drying response does not translate into low-level omega change',
      score: round(dryingResponseScore * (1 - omegaResponseScore), 5),
      evidence: {
        dryingDeltaMeanFrac: round(dryingDeltaMean, 5),
        omegaDeltaMeanPaS: round(omegaDeltaMean, 5),
        northTransitionSubtropicalSubsidenceDryingMeanFrac: round(onMetrics.northTransitionSubtropicalSubsidenceDryingMeanFrac || 0, 5),
        northTransitionLowLevelOmegaEffectiveMeanPaS: round(onMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS || 0, 5)
      }
    },
    {
      key: 'omega_to_jet_recovery_failure',
      label: 'Omega response does not recover NH jet strength',
      score: round(omegaResponseScore * (1 - jetResponseScore), 5),
      evidence: {
        omegaDeltaMeanPaS: round(omegaDeltaMean, 5),
        midlatitudeWesterliesNorthDeltaMs: round(jetDelta, 5),
        northDryBeltLowLevelOmegaEffectiveMeanPaS: round(onMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS || 0, 5),
        midlatitudeWesterliesNorthU10Ms: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5)
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const verdict = ranking[0]?.key || 'source_driver_to_drying_conversion_failure';
  const nextPhase = phaseForVerdict(verdict);

  return {
    schema: 'satellite-wars.phase1q-return-flow-carrier-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    nextPhase,
    baselineGap: {
      itczWidthDeg: {
        baseline: round(baselineMetrics.itczWidthDeg || 0, 5),
        current: round(onMetrics.itczWidthDeg || 0, 5),
        delta: round(delta(onMetrics.itczWidthDeg, baselineMetrics.itczWidthDeg), 5)
      },
      subtropicalDryNorthRatio: {
        baseline: round(baselineMetrics.subtropicalDryNorthRatio || 0, 5),
        current: round(onMetrics.subtropicalDryNorthRatio || 0, 5),
        delta: round(delta(onMetrics.subtropicalDryNorthRatio, baselineMetrics.subtropicalDryNorthRatio), 5)
      },
      subtropicalDrySouthRatio: {
        baseline: round(baselineMetrics.subtropicalDrySouthRatio || 0, 5),
        current: round(onMetrics.subtropicalDrySouthRatio || 0, 5),
        delta: round(delta(onMetrics.subtropicalDrySouthRatio, baselineMetrics.subtropicalDrySouthRatio), 5)
      },
      midlatitudeWesterliesNorthU10Ms: {
        baseline: round(baselineMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5),
        current: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5),
        delta: round(delta(onMetrics.midlatitudeWesterliesNorthU10Ms, baselineMetrics.midlatitudeWesterliesNorthU10Ms), 5)
      }
    },
    offOnCompare: {
      itczWidthDeg: { off: round(offMetrics.itczWidthDeg || 0, 5), on: round(onMetrics.itczWidthDeg || 0, 5), delta: round(delta(onMetrics.itczWidthDeg, offMetrics.itczWidthDeg), 5) },
      subtropicalDryNorthRatio: { off: round(offMetrics.subtropicalDryNorthRatio || 0, 5), on: round(onMetrics.subtropicalDryNorthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDryNorthRatio, offMetrics.subtropicalDryNorthRatio), 5) },
      subtropicalDrySouthRatio: { off: round(offMetrics.subtropicalDrySouthRatio || 0, 5), on: round(onMetrics.subtropicalDrySouthRatio || 0, 5), delta: round(delta(onMetrics.subtropicalDrySouthRatio, offMetrics.subtropicalDrySouthRatio), 5) },
      midlatitudeWesterliesNorthU10Ms: { off: round(offMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), on: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), delta: round(jetDelta, 5) }
    },
    carrierChain: {
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: round(couplingAppliedOn, 5),
      sourceDriverDeltaMeanFrac: round(sourceDriverDelta, 5),
      dryingDeltaMeanFrac: round(dryingDeltaMean, 5),
      omegaDeltaMeanPaS: round(omegaDeltaMean, 5),
      midlatitudeWesterliesNorthDeltaMs: round(jetDelta, 5),
      sourceDriverResponseScore: round(sourceDriverResponseScore, 5),
      dryingResponseScore: round(dryingResponseScore, 5),
      omegaResponseScore: round(omegaResponseScore, 5),
      jetResponseScore: round(jetResponseScore, 5)
    },
    liveSignals: {
      northTransitionSubtropicalSourceDriverMeanFrac: round(onMetrics.northTransitionSubtropicalSourceDriverMeanFrac || 0, 5),
      northDryBeltSubtropicalSourceDriverMeanFrac: round(onMetrics.northDryBeltSubtropicalSourceDriverMeanFrac || 0, 5),
      northTransitionSubtropicalSubsidenceDryingMeanFrac: round(onMetrics.northTransitionSubtropicalSubsidenceDryingMeanFrac || 0, 5),
      northDryBeltSubtropicalSubsidenceDryingMeanFrac: round(onMetrics.northDryBeltSubtropicalSubsidenceDryingMeanFrac || 0, 5),
      northTransitionLowLevelOmegaEffectiveMeanPaS: round(onMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS || 0, 5),
      northDryBeltLowLevelOmegaEffectiveMeanPaS: round(onMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS || 0, 5),
      midlatitudeWesterliesNorthU10Ms: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5)
    },
    ranking,
    recommendation:
      verdict === 'source_driver_to_drying_conversion_failure'
        ? 'Move the next patch to the source-driver-to-drying conversion lane in vertical5.js/core5.js. The current return-flow coupling is active, but the drying response stays too flat to matter.'
        : verdict === 'drying_to_omega_response_failure'
          ? 'Move the next patch to the drying-to-omega response lane in vertical5.js/core5.js. Drying changes are present, but they are not turning into a stronger low-level circulation response.'
          : 'Move the next patch to the omega-to-jet recovery lane in core5.js. The low-level omega response changes, but the NH jet still does not recover.'
  };
}

export function renderPhase1QReport(summary) {
  const lines = [
    '# Phase 1Q Return-Flow Carrier Attribution',
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${summary.paths.baselinePath}\``,
    `- Phase 1P off compare: \`${summary.paths.offPath}\``,
    `- Phase 1P on compare: \`${summary.paths.onPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- ${summary.recommendation}`,
    '',
    '## Baseline Gap',
    '',
    `- \`itczWidthDeg\`: \`${summary.baselineGap.itczWidthDeg.baseline}\` -> \`${summary.baselineGap.itczWidthDeg.current}\` (delta \`${summary.baselineGap.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.baselineGap.subtropicalDryNorthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDryNorthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.baselineGap.subtropicalDrySouthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDrySouthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDrySouthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.baseline}\` -> \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.current}\` (delta \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Off Versus On',
    '',
    `- \`itczWidthDeg\`: \`${summary.offOnCompare.itczWidthDeg.off}\` -> \`${summary.offOnCompare.itczWidthDeg.on}\``,
    `- \`subtropicalDryNorthRatio\`: \`${summary.offOnCompare.subtropicalDryNorthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDryNorthRatio.on}\``,
    `- \`subtropicalDrySouthRatio\`: \`${summary.offOnCompare.subtropicalDrySouthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDrySouthRatio.on}\``,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\``,
    '',
    '## Carrier Chain',
    '',
    `- coupling applied: \`${summary.carrierChain.northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac}\``,
    `- source driver delta mean: \`${summary.carrierChain.sourceDriverDeltaMeanFrac}\``,
    `- drying delta mean: \`${summary.carrierChain.dryingDeltaMeanFrac}\``,
    `- omega delta mean: \`${summary.carrierChain.omegaDeltaMeanPaS}\``,
    `- NH westerly delta: \`${summary.carrierChain.midlatitudeWesterliesNorthDeltaMs}\``,
    '',
    '## Ranking',
    '',
    ...summary.ranking.map((entry, index) => (
      `${index + 1}. \`${entry.key}\` score \`${entry.score}\``
    )),
    '',
    '## Live Signals',
    '',
    `- \`northTransitionSubtropicalSourceDriverMeanFrac = ${summary.liveSignals.northTransitionSubtropicalSourceDriverMeanFrac}\``,
    `- \`northDryBeltSubtropicalSourceDriverMeanFrac = ${summary.liveSignals.northDryBeltSubtropicalSourceDriverMeanFrac}\``,
    `- \`northTransitionSubtropicalSubsidenceDryingMeanFrac = ${summary.liveSignals.northTransitionSubtropicalSubsidenceDryingMeanFrac}\``,
    `- \`northDryBeltSubtropicalSubsidenceDryingMeanFrac = ${summary.liveSignals.northDryBeltSubtropicalSubsidenceDryingMeanFrac}\``,
    `- \`northTransitionLowLevelOmegaEffectiveMeanPaS = ${summary.liveSignals.northTransitionLowLevelOmegaEffectiveMeanPaS}\``,
    `- \`northDryBeltLowLevelOmegaEffectiveMeanPaS = ${summary.liveSignals.northDryBeltLowLevelOmegaEffectiveMeanPaS}\``,
    `- \`midlatitudeWesterliesNorthU10Ms = ${summary.liveSignals.midlatitudeWesterliesNorthU10Ms}\``
  ];

  return `${lines.join('\n')}\n`;
}

export async function main(args = process.argv.slice(2)) {
  let baselinePath = defaultBaselinePath;
  let offPath = defaultOffPath;
  let onPath = defaultOnPath;
  let reportPath = defaultReportPath;
  let jsonPath = defaultJsonPath;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--baseline') baselinePath = args[++i];
    else if (arg === '--off') offPath = args[++i];
    else if (arg === '--on') onPath = args[++i];
    else if (arg === '--report') reportPath = args[++i];
    else if (arg === '--json') jsonPath = args[++i];
  }

  const baselineMetrics = latestMetrics(readJson(baselinePath));
  const offMetrics = latestMetrics(readJson(offPath));
  const onMetrics = latestMetrics(readJson(onPath));
  const summary = buildPhase1QReturnFlowCarrierAttribution({
    baselineMetrics,
    offMetrics,
    onMetrics,
    paths: { baselinePath, offPath, onPath, reportPath, jsonPath }
  });
  const rendered = renderPhase1QReport(summary);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(reportPath, rendered);
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(rendered);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
