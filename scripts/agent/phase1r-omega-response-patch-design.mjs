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
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1r-omega-response-patch-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1r-omega-response-patch-design.json');

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
const safeDiv = (num, den) => (Number.isFinite(num) && Number.isFinite(den) && Math.abs(den) > 1e-9 ? num / den : 0);

export function buildPhase1ROmegaResponseDesign({ baselineMetrics, offMetrics, onMetrics, paths }) {
  const widthDelta = delta(onMetrics.itczWidthDeg, offMetrics.itczWidthDeg);
  const northDryDelta = delta(onMetrics.subtropicalDryNorthRatio, offMetrics.subtropicalDryNorthRatio);
  const southDryDelta = delta(onMetrics.subtropicalDrySouthRatio, offMetrics.subtropicalDrySouthRatio);
  const nhWesterlyDelta = delta(onMetrics.midlatitudeWesterliesNorthU10Ms, offMetrics.midlatitudeWesterliesNorthU10Ms);
  const northCondDelta = delta(onMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2, offMetrics.northDryBeltOceanLargeScaleCondensationMeanKgM2);

  const sourceDriverDeltaMean = mean(
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

  const dryingResponseActive = clamp01(Math.abs(dryingDeltaMean) / 0.012);
  const omegaResponseMissing = 1 - clamp01(Math.abs(omegaDeltaMean) / 0.006);
  const jetResponseMissing = 1 - clamp01(Math.abs(nhWesterlyDelta) / 0.05);
  const guardrailPenalty = clamp01(
    Math.abs(widthDelta) / 0.15
      + Math.abs(northDryDelta) / 0.03
      + Math.abs(southDryDelta) / 0.02
  );
  const sameStepDisconnectScore = clamp01(dryingResponseActive * omegaResponseMissing);
  const omegaToJetNotYetTestableScore = clamp01((1 - omegaResponseMissing) * jetResponseMissing);
  const pureCoreRetuneRiskScore = clamp01(sameStepDisconnectScore * (0.6 + 0.4 * clamp01(guardrailPenalty)));

  const ranking = [
    {
      key: 'same_step_drying_to_omega_bridge_missing',
      label: 'Drying is moving, but omega is effectively frozen inside the current bridge',
      score: round(sameStepDisconnectScore, 5),
      evidence: {
        sourceDriverDeltaMeanFrac: round(sourceDriverDeltaMean, 5),
        dryingDeltaMeanFrac: round(dryingDeltaMean, 5),
        omegaDeltaMeanPaS: round(omegaDeltaMean, 5),
        nhWesterlyDeltaMs: round(nhWesterlyDelta, 5)
      }
    },
    {
      key: 'omega_to_jet_recovery_is_secondary_until_omega_moves',
      label: 'Jet recovery still matters, but it is downstream of the unresolved omega bridge',
      score: round(omegaToJetNotYetTestableScore, 5),
      evidence: {
        omegaDeltaMeanPaS: round(omegaDeltaMean, 5),
        nhWesterlyDeltaMs: round(nhWesterlyDelta, 5)
      }
    },
    {
      key: 'broad_core_retune_is_wrong_lane',
      label: 'A broader core circulation retune would add risk before the local omega bridge is fixed',
      score: round(pureCoreRetuneRiskScore, 5),
      evidence: {
        itczWidthDeltaDeg: round(widthDelta, 5),
        northDryRatioDelta: round(northDryDelta, 5),
        southDryRatioDelta: round(southDryDelta, 5),
        northDryBeltOceanLargeScaleCondensationDeltaKgM2: round(northCondDelta, 5)
      }
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    schema: 'satellite-wars.phase1r-omega-response-patch-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'same_step_drying_to_omega_bridge_missing',
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
    carrierBridgeSignals: {
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: round(onMetrics.northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac || 0, 5),
      sourceDriverDeltaMeanFrac: round(sourceDriverDeltaMean, 5),
      dryingDeltaMeanFrac: round(dryingDeltaMean, 5),
      omegaDeltaMeanPaS: round(omegaDeltaMean, 5),
      nhWesterlyDeltaMs: round(nhWesterlyDelta, 5),
      dryingToOmegaTransferFrac: round(safeDiv(Math.abs(omegaDeltaMean), Math.abs(dryingDeltaMean)), 5),
      omegaToJetTransferFrac: round(safeDiv(Math.abs(nhWesterlyDelta), Math.abs(omegaDeltaMean)), 5)
    },
    ranking,
    codeEvidence: {
      omegaDiagnosticStage: 'vertical5.js computes omega and lowLevelOmegaEffective before the subtropical dryDriver loop.',
      dryDriverStage: 'vertical5.js computes dryDriver later, then applies qv/theta drying and warming tendencies without feeding those tendencies back into omega for the same step.',
      implication: 'The current bridge can improve drying diagnostics while leaving lowLevelOmegaEffective almost unchanged, which is exactly what the Phase 1Q off/on compare shows.'
    },
    patchDesign: {
      primaryFiles: [
        path.join(repoRoot, 'src', 'weather', 'v2', 'vertical5.js'),
        path.join(repoRoot, 'src', 'weather', 'v2', 'core5.js')
      ],
      mechanism: 'Add a capped same-step omega-response bridge driven by the proven dryDriver lane, then expose its parameters through core5.js so the drying response can seed a small subtropical descent increase without broad circulation retuning.',
      insertionPoints: [
        'vertical5.js: after dryDriver is computed and before the subtropical drying loop exits, derive a capped omega bridge term from dryDriver, latShape, weak-engine structure, and same-hemisphere transition suppression.',
        'vertical5.js: apply the bridge to lowLevelOmegaEffective and the low-level omega interface for the same subtropical column so the response is visible to later same-step consumers.',
        'core5.js: add guardrail-first parameters for enable/disable, dryDriver thresholds, and max omega bridge amplitude.'
      ],
      targetSignature: {
        northTransitionLowLevelOmegaEffectiveDeltaPaS: 0.01,
        northDryBeltLowLevelOmegaEffectiveDeltaPaS: 0.005,
        midlatitudeWesterliesNorthDeltaMs: 0.03,
        maxAllowedItczWidthDeltaDeg: 0.05,
        maxAllowedNorthDryRatioDelta: 0.02,
        maxAllowedNorthOceanCondensationDeltaKgM2: 0.002
      },
      designRules: [
        'Use the already-kept Phase 1K and Phase 1M selectors as the envelope; do not reintroduce broad source reinjection.',
        'Make the bridge same-hemisphere and subtropical-band limited so it acts as a local descent seed, not a global omega retune.',
        'Cap the bridge in Pa/s, not only in fractional terms, so it cannot silently escalate under a stronger dryDriver.',
        'Treat midlatitude westerly recovery as a downstream guardrail target; the first proof of success is a real omega response.'
      ]
    },
    nextPhase: 'Phase 1S: Implement capped drying-to-omega bridge patch'
  };
}

export function renderPhase1RReport(summary) {
  const lines = [
    '# Phase 1R Omega Response Patch Design',
    '',
    '## Scope',
    '',
    `- Trusted baseline: \`${summary.paths.baselinePath}\``,
    `- Phase 1Q off compare: \`${summary.paths.offPath}\``,
    `- Phase 1Q on compare: \`${summary.paths.onPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- Primary mechanism: ${summary.patchDesign.mechanism}`,
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
    `- \`northDryBeltOceanLargeScaleCondensationMeanKgM2\`: \`${summary.offOnCompare.northDryBeltOceanLargeScaleCondensationMeanKgM2.off}\` -> \`${summary.offOnCompare.northDryBeltOceanLargeScaleCondensationMeanKgM2.on}\``,
    '',
    '## Carrier Bridge Signals',
    '',
    `- coupling applied: \`${summary.carrierBridgeSignals.northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac}\``,
    `- source driver delta mean: \`${summary.carrierBridgeSignals.sourceDriverDeltaMeanFrac}\``,
    `- drying delta mean: \`${summary.carrierBridgeSignals.dryingDeltaMeanFrac}\``,
    `- omega delta mean: \`${summary.carrierBridgeSignals.omegaDeltaMeanPaS}\``,
    `- NH westerly delta: \`${summary.carrierBridgeSignals.nhWesterlyDeltaMs}\``,
    `- drying-to-omega transfer frac: \`${summary.carrierBridgeSignals.dryingToOmegaTransferFrac}\``,
    `- omega-to-jet transfer frac: \`${summary.carrierBridgeSignals.omegaToJetTransferFrac}\``,
    '',
    '## Ranking',
    '',
    ...summary.ranking.map((entry, index) => `${index + 1}. \`${entry.key}\` score \`${entry.score}\``),
    '',
    '## Code Evidence',
    '',
    `- ${summary.codeEvidence.omegaDiagnosticStage}`,
    `- ${summary.codeEvidence.dryDriverStage}`,
    `- ${summary.codeEvidence.implication}`,
    '',
    '## Patch Design',
    '',
    `- Primary files: \`${summary.patchDesign.primaryFiles.join('`, `')}\``,
    ...summary.patchDesign.insertionPoints.map((point) => `- ${point}`),
    '',
    '## Target Signature',
    '',
    `- \`northTransitionLowLevelOmegaEffectiveDeltaPaS >= ${summary.patchDesign.targetSignature.northTransitionLowLevelOmegaEffectiveDeltaPaS}\``,
    `- \`northDryBeltLowLevelOmegaEffectiveDeltaPaS >= ${summary.patchDesign.targetSignature.northDryBeltLowLevelOmegaEffectiveDeltaPaS}\``,
    `- \`midlatitudeWesterliesNorthDeltaMs >= ${summary.patchDesign.targetSignature.midlatitudeWesterliesNorthDeltaMs}\``,
    `- \`itczWidthDeg delta <= ${summary.patchDesign.targetSignature.maxAllowedItczWidthDeltaDeg}\``,
    `- \`subtropicalDryNorthRatio delta <= ${summary.patchDesign.targetSignature.maxAllowedNorthDryRatioDelta}\``,
    `- \`northDryBeltOceanLargeScaleCondensation delta <= ${summary.patchDesign.targetSignature.maxAllowedNorthOceanCondensationDeltaKgM2}\``,
    '',
    '## Design Rules',
    '',
    ...summary.patchDesign.designRules.map((rule) => `- ${rule}`)
  ];
  return `${lines.join('\n')}\n`;
}

export function main(argv = process.argv.slice(2)) {
  const args = {
    baseline: defaultBaselinePath,
    off: defaultOffPath,
    on: defaultOnPath,
    report: defaultReportPath,
    json: defaultJsonPath
  };

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
  const summary = buildPhase1ROmegaResponseDesign({
    baselineMetrics,
    offMetrics,
    onMetrics,
    paths: {
      baselinePath: args.baseline,
      offPath: args.off,
      onPath: args.on
    }
  });
  const rendered = renderPhase1RReport(summary);

  fs.mkdirSync(path.dirname(args.report), { recursive: true });
  fs.mkdirSync(path.dirname(args.json), { recursive: true });
  fs.writeFileSync(args.report, rendered);
  fs.writeFileSync(args.json, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(rendered);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
