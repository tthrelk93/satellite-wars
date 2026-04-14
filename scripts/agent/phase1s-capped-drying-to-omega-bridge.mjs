#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repoRoot, 'weather-validation', 'output', 'phase1-hadley-second-pass-restore-v4.json');
const defaultOffPath = '/tmp/phase1s-omega-bridge-off.json';
const defaultOnPath = '/tmp/phase1s-omega-bridge-on.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1s-capped-drying-to-omega-bridge.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1s-capped-drying-to-omega-bridge.json');

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
const delta = (onValue, offValue) => (Number(onValue) || 0) - (Number(offValue) || 0);
const mean = (...values) => values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / Math.max(1, values.length);

function pickVerdict({ northTransitionOmegaDelta, northDryBeltOmegaDelta, jetDelta, bridgeActivation, guardrailCost }) {
  const omegaResponseScore = mean(
    clamp01(northTransitionOmegaDelta / 0.01),
    clamp01(northDryBeltOmegaDelta / 0.005)
  );
  const jetResponseScore = clamp01(jetDelta / 0.05);
  if (omegaResponseScore >= 0.95 && jetResponseScore >= 0.15 && guardrailCost <= 0.15) {
    return 'keepable_bridge_patch';
  }
  if (bridgeActivation <= 0.0002) {
    return 'bridge_inert_in_live_climate';
  }
  if (omegaResponseScore > 0 && jetResponseScore < 0.05) {
    return 'omega_to_jet_recovery_failure';
  }
  if (guardrailCost > 0.15) {
    return 'guardrail_cost_exceeds_omega_gain';
  }
  return 'omega_response_too_weak';
}

const nextPhaseForVerdict = (verdict) => {
  switch (verdict) {
    case 'keepable_bridge_patch':
      return 'Phase 2A: Finish Hadley Moisture Partitioning';
    case 'bridge_inert_in_live_climate':
      return 'Phase 1T: Bridge Occupancy Recheck';
    case 'guardrail_cost_exceeds_omega_gain':
    case 'omega_response_too_weak':
    case 'omega_to_jet_recovery_failure':
    default:
      return 'Phase 1T: Omega-To-Jet Recovery Attribution';
  }
};

const recommendationForVerdict = (verdict) => {
  switch (verdict) {
    case 'keepable_bridge_patch':
      return 'The bridge patch is climate-useful. Keep it enabled and return to the residual branch-vs-baseline climate roadmap.';
    case 'bridge_inert_in_live_climate':
      return 'The bridge did not engage enough in the live 30-day climate. Recheck occupancy and trigger coverage before changing bridge strength.';
    case 'guardrail_cost_exceeds_omega_gain':
      return 'The bridge moves omega, but the climate guardrails deteriorate faster than the circulation recovers. Keep diagnostics, leave the patch disabled by default, and attribute the downstream recovery lane before tuning the bridge again.';
    case 'omega_response_too_weak':
      return 'The bridge is live, but the omega response is too small to matter climatically. Keep diagnostics, leave the patch disabled by default, and attribute whether the missing gain is bridge strength, vertical placement, or jet recovery.';
    case 'omega_to_jet_recovery_failure':
    default:
      return 'The bridge is live and does move low-level omega, but NH westerlies stay flat. Keep diagnostics, leave the patch disabled by default, and move to omega-to-jet recovery attribution instead of blindly strengthening the bridge.';
  }
};

export function buildPhase1SCappedDryingToOmegaBridge({ baselineMetrics, offMetrics, onMetrics, paths }) {
  const northTransitionOmegaDelta = delta(
    onMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS,
    offMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS
  );
  const northDryBeltOmegaDelta = delta(
    onMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS,
    offMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS
  );
  const jetDelta = delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms);
  const itczDelta = delta(onMetrics.itczWidthDeg, offMetrics.itczWidthDeg);
  const northDryDelta = delta(onMetrics.subtropicalDryNorthRatio, offMetrics.subtropicalDryNorthRatio);
  const southDryDelta = delta(onMetrics.subtropicalDrySouthRatio, offMetrics.subtropicalDrySouthRatio);
  const bridgeActivation = mean(
    onMetrics.northTransitionDryingOmegaBridgeAppliedMeanPaS || 0,
    onMetrics.northDryBeltDryingOmegaBridgeAppliedMeanPaS || 0
  );
  const guardrailCost = mean(
    clamp01(Math.max(0, itczDelta) / 0.03),
    clamp01(Math.max(0, northDryDelta) / 0.03),
    clamp01(Math.max(0, southDryDelta) / 0.03)
  );
  const verdict = pickVerdict({
    northTransitionOmegaDelta,
    northDryBeltOmegaDelta,
    jetDelta,
    bridgeActivation,
    guardrailCost
  });
  const nextPhase = nextPhaseForVerdict(verdict);

  return {
    schema: 'satellite-wars.phase1s-capped-drying-to-omega-bridge.v1',
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
      itczWidthDeg: { off: round(offMetrics.itczWidthDeg || 0, 5), on: round(onMetrics.itczWidthDeg || 0, 5), delta: round(itczDelta, 5) },
      subtropicalDryNorthRatio: { off: round(offMetrics.subtropicalDryNorthRatio || 0, 5), on: round(onMetrics.subtropicalDryNorthRatio || 0, 5), delta: round(northDryDelta, 5) },
      subtropicalDrySouthRatio: { off: round(offMetrics.subtropicalDrySouthRatio || 0, 5), on: round(onMetrics.subtropicalDrySouthRatio || 0, 5), delta: round(southDryDelta, 5) },
      midlatitudeWesterliesNorthU10Ms: { off: round(offMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), on: round(onMetrics.midlatitudeWesterliesNorthU10Ms || 0, 5), delta: round(jetDelta, 5) }
    },
    bridgeResponse: {
      northTransitionDryingOmegaBridgeAppliedMeanPaS: round(onMetrics.northTransitionDryingOmegaBridgeAppliedMeanPaS || 0, 5),
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: round(onMetrics.northDryBeltDryingOmegaBridgeAppliedMeanPaS || 0, 5),
      northTransitionLowLevelOmegaEffectiveMeanPaS: {
        off: round(offMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS || 0, 5),
        on: round(onMetrics.northTransitionLowLevelOmegaEffectiveMeanPaS || 0, 5),
        delta: round(northTransitionOmegaDelta, 5)
      },
      northDryBeltLowLevelOmegaEffectiveMeanPaS: {
        off: round(offMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS || 0, 5),
        on: round(onMetrics.northDryBeltLowLevelOmegaEffectiveMeanPaS || 0, 5),
        delta: round(northDryBeltOmegaDelta, 5)
      },
      northDryBeltOceanLargeScaleCondensationMeanKgM2: {
        off: round(offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0, 5),
        on: round(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0, 5),
        delta: round(delta(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2, offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2), 5)
      }
    },
    phaseTargets: {
      northTransitionOmegaTargetPaS: 0.01,
      northDryBeltOmegaTargetPaS: 0.005,
      northTransitionOmegaTargetHitFrac: round(clamp01(northTransitionOmegaDelta / 0.01), 5),
      northDryBeltOmegaTargetHitFrac: round(clamp01(northDryBeltOmegaDelta / 0.005), 5),
      nhJetRecoveryDeltaMs: round(jetDelta, 5)
    },
    guardrailAssessment: {
      itczWidthDegDelta: round(itczDelta, 5),
      subtropicalDryNorthRatioDelta: round(northDryDelta, 5),
      subtropicalDrySouthRatioDelta: round(southDryDelta, 5),
      guardrailCostScore: round(guardrailCost, 5)
    },
    recommendation: recommendationForVerdict(verdict)
  };
}

export function renderPhase1SReport(summary) {
  const lines = [
    '# Phase 1S Capped Drying-To-Omega Bridge Patch',
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${summary.paths.baselinePath}\``,
    `- Same-branch off audit: \`${summary.paths.offPath}\``,
    `- Same-branch on audit: \`${summary.paths.onPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- ${summary.recommendation}`,
    '',
    '## Off Versus On',
    '',
    `- \`itczWidthDeg\`: \`${summary.offOnCompare.itczWidthDeg.off}\` -> \`${summary.offOnCompare.itczWidthDeg.on}\` (delta \`${summary.offOnCompare.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.offOnCompare.subtropicalDryNorthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDryNorthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.offOnCompare.subtropicalDrySouthRatio.off}\` -> \`${summary.offOnCompare.subtropicalDrySouthRatio.on}\` (delta \`${summary.offOnCompare.subtropicalDrySouthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.off}\` -> \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.on}\` (delta \`${summary.offOnCompare.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Bridge Response',
    '',
    `- \`northTransitionDryingOmegaBridgeAppliedMeanPaS = ${summary.bridgeResponse.northTransitionDryingOmegaBridgeAppliedMeanPaS}\``,
    `- \`northDryBeltDryingOmegaBridgeAppliedMeanPaS = ${summary.bridgeResponse.northDryBeltDryingOmegaBridgeAppliedMeanPaS}\``,
    `- \`northTransitionLowLevelOmegaEffectiveMeanPaS\`: \`${summary.bridgeResponse.northTransitionLowLevelOmegaEffectiveMeanPaS.off}\` -> \`${summary.bridgeResponse.northTransitionLowLevelOmegaEffectiveMeanPaS.on}\` (delta \`${summary.bridgeResponse.northTransitionLowLevelOmegaEffectiveMeanPaS.delta}\`)`,
    `- \`northDryBeltLowLevelOmegaEffectiveMeanPaS\`: \`${summary.bridgeResponse.northDryBeltLowLevelOmegaEffectiveMeanPaS.off}\` -> \`${summary.bridgeResponse.northDryBeltLowLevelOmegaEffectiveMeanPaS.on}\` (delta \`${summary.bridgeResponse.northDryBeltLowLevelOmegaEffectiveMeanPaS.delta}\`)`,
    `- \`northDryBeltOceanLargeScaleCondensationMeanKgM2\`: \`${summary.bridgeResponse.northDryBeltOceanLargeScaleCondensationMeanKgM2.off}\` -> \`${summary.bridgeResponse.northDryBeltOceanLargeScaleCondensationMeanKgM2.on}\` (delta \`${summary.bridgeResponse.northDryBeltOceanLargeScaleCondensationMeanKgM2.delta}\`)`,
    '',
    '## Phase Targets',
    '',
    `- north transition omega target hit fraction: \`${summary.phaseTargets.northTransitionOmegaTargetHitFrac}\``,
    `- north dry-belt omega target hit fraction: \`${summary.phaseTargets.northDryBeltOmegaTargetHitFrac}\``,
    `- NH jet delta: \`${summary.phaseTargets.nhJetRecoveryDeltaMs}\``,
    '',
    '## Baseline Gap',
    '',
    `- \`itczWidthDeg\`: \`${summary.baselineGap.itczWidthDeg.baseline}\` -> \`${summary.baselineGap.itczWidthDeg.current}\` (delta \`${summary.baselineGap.itczWidthDeg.delta}\`)`,
    `- \`subtropicalDryNorthRatio\`: \`${summary.baselineGap.subtropicalDryNorthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDryNorthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDryNorthRatio.delta}\`)`,
    `- \`subtropicalDrySouthRatio\`: \`${summary.baselineGap.subtropicalDrySouthRatio.baseline}\` -> \`${summary.baselineGap.subtropicalDrySouthRatio.current}\` (delta \`${summary.baselineGap.subtropicalDrySouthRatio.delta}\`)`,
    `- \`midlatitudeWesterliesNorthU10Ms\`: \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.baseline}\` -> \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.current}\` (delta \`${summary.baselineGap.midlatitudeWesterliesNorthU10Ms.delta}\`)`,
    '',
    '## Guardrail Assessment',
    '',
    `- \`itczWidthDegDelta = ${summary.guardrailAssessment.itczWidthDegDelta}\``,
    `- \`subtropicalDryNorthRatioDelta = ${summary.guardrailAssessment.subtropicalDryNorthRatioDelta}\``,
    `- \`subtropicalDrySouthRatioDelta = ${summary.guardrailAssessment.subtropicalDrySouthRatioDelta}\``,
    `- \`guardrailCostScore = ${summary.guardrailAssessment.guardrailCostScore}\``
  ];
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = { baselinePath: defaultBaselinePath, offPath: defaultOffPath, onPath: defaultOnPath, reportPath: defaultReportPath, jsonPath: defaultJsonPath };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--baseline' && argv[i + 1]) args.baselinePath = argv[++i];
    else if (arg.startsWith('--baseline=')) args.baselinePath = arg.slice('--baseline='.length);
    else if (arg === '--off' && argv[i + 1]) args.offPath = argv[++i];
    else if (arg.startsWith('--off=')) args.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) args.onPath = argv[++i];
    else if (arg.startsWith('--on=')) args.onPath = arg.slice('--on='.length);
    else if (arg === '--report' && argv[i + 1]) args.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) args.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) args.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) args.jsonPath = arg.slice('--json='.length);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const baselineMetrics = latestMetrics(readJson(args.baselinePath));
  const offMetrics = latestMetrics(readJson(args.offPath));
  const onMetrics = latestMetrics(readJson(args.onPath));
  const summary = buildPhase1SCappedDryingToOmegaBridge({
    baselineMetrics,
    offMetrics,
    onMetrics,
    paths: {
      baselinePath: args.baselinePath,
      offPath: args.offPath,
      onPath: args.onPath,
      reportPath: args.reportPath,
      jsonPath: args.jsonPath
    }
  });
  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(args.jsonPath), { recursive: true });
  fs.writeFileSync(args.reportPath, renderPhase1SReport(summary));
  fs.writeFileSync(args.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
