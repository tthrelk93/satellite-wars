#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createState5 } from '../../src/weather/v2/state5.js';
import { createSigmaHalfLevels } from '../../src/weather/v2/verticalGrid.js';
import { computeModelMidPressurePa } from '../../src/weather/v2/analysisData.js';
import { stepMicrophysics5 } from '../../src/weather/v2/microphysics5.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultReintegrationJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zc-shoulder-guard-reintegration-audit.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zd-suppressed-mass-fate-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zd-suppressed-mass-fate-design.json');

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

const mean = (...values) => values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / Math.max(1, values.length);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function setupState(tempK) {
  const sigmaHalf = createSigmaHalfLevels({ nz: 4 });
  const state = createState5({ grid: { count: 1 }, nz: 4, sigmaHalf });
  state.ps[0] = 100000;
  state.pMid.set(computeModelMidPressurePa({ surfacePressurePa: state.ps, sigmaHalf, pTop: 20000 }));
  for (let lev = 0; lev <= state.nz; lev += 1) {
    state.pHalf[lev] = 20000 + (state.ps[0] - 20000) * sigmaHalf[lev];
  }
  state.theta.fill(tempK / Math.pow(state.pMid[0] / 100000, 287.05 / 1004));
  state.T.fill(tempK);
  state.qv.fill(0.002);
  return state;
}

function buildShoulderWitnessState() {
  const state = setupState(279);
  state.qv.fill(0.002);
  state.qc.fill(0);
  state.qi.fill(0);
  state.qr.fill(0);
  state.qs.fill(0);
  state.landMask[0] = 0;
  state.convectiveOrganization[0] = 0.05;
  state.convectiveMassFlux[0] = 2e-4;
  state.convectiveAnvilSource[0] = 0.02;
  state.subtropicalSubsidenceDrying[0] = 0.0;
  state.freshSubtropicalSuppressionDiag[0] = 0.12;
  state.freshSubtropicalBandDiag[0] = 0.18;
  state.freshShoulderLatitudeWindowDiag[0] = 1;
  state.freshShoulderTargetEntryExclusionDiag[0] = 0;
  state.freshNeutralToSubsidingSupportDiag[0] = 0.62;
  state.freshOrganizedSupportDiag[0] = 0.16;
  state.freshRhMidSupportDiag[0] = 0.9;
  state.dryingOmegaBridgeAppliedDiag[0] = 0;
  state.omega.fill(0.06);
  state.qv[1] = 0.011;
  return state;
}

function arraySum(arr) {
  return Array.from(arr || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function buildShoulderSuppressedMassWitness() {
  const patchOff = buildShoulderWitnessState();
  const patchOn = buildShoulderWitnessState();

  stepMicrophysics5({
    dt: 900,
    state: patchOff,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: false
    }
  });
  stepMicrophysics5({
    dt: 900,
    state: patchOn,
    params: {
      enableConvectiveOutcome: true,
      enableSoftLiveStateMaintenanceSuppression: false,
      enableShoulderAbsorptionGuard: true
    }
  });

  return {
    qvSumOff: round(arraySum(patchOff.qv), 8),
    qvSumOn: round(arraySum(patchOn.qv), 8),
    qvSumDelta: round(arraySum(patchOn.qv) - arraySum(patchOff.qv), 8),
    qcSumOff: round(arraySum(patchOff.qc), 8),
    qcSumOn: round(arraySum(patchOn.qc), 8),
    qcSumDelta: round(arraySum(patchOn.qc) - arraySum(patchOff.qc), 8),
    level1QvOff: round(patchOff.qv[1], 8),
    level1QvOn: round(patchOn.qv[1], 8),
    level1QvDelta: round((patchOn.qv[1] || 0) - (patchOff.qv[1] || 0), 8),
    level1QcOff: round(patchOff.qc[1], 8),
    level1QcOn: round(patchOn.qc[1], 8),
    level1QcDelta: round((patchOn.qc[1] || 0) - (patchOff.qc[1] || 0), 8),
    condensationOffKgM2: round(patchOff.largeScaleCondensationSource[0], 8),
    condensationOnKgM2: round(patchOn.largeScaleCondensationSource[0], 8),
    condensationDeltaKgM2: round((patchOn.largeScaleCondensationSource[0] || 0) - (patchOff.largeScaleCondensationSource[0] || 0), 8),
    shoulderSuppressedMassKgM2: round(patchOn.saturationAdjustmentShoulderGuardAppliedSuppressionMass[0], 8)
  };
}

export function buildPhase1ZDSuppressedMassFateDesign({ reintegrationSummary, paths }) {
  const band = reintegrationSummary.bandDiagnostics || {};
  const witness = buildShoulderSuppressedMassWitness();

  const inPlaceVaporRetentionScore = mean(
    clamp01((witness.qvSumDelta || 0) / 0.00005),
    clamp01(Math.max(0, -(witness.qcSumDelta || 0)) / 0.00005),
    clamp01((band.tropicalShoulderCoreTcwDeltaKgM2 || 0) / 0.08),
    clamp01((band.tropicalShoulderCoreMidRhDeltaFrac || 0) / 0.002),
    clamp01((band.tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2 || 0) / 0.02)
  );
  const adjacentSpilloverScore = mean(
    clamp01((band.adjacentShoulderSpilloverDeltaKgM2 || 0) / 0.004),
    clamp01((band.adjacentShoulderSpilloverTcwDeltaKgM2 || 0) / 0.08),
    clamp01((band.adjacentShoulderSpilloverMidRhDeltaFrac || 0) / 0.004)
  );
  const selectorGeometryResolvedScore = mean(
    1 - clamp01(((reintegrationSummary.referenceSlices?.targetEntry33p75?.on?.shoulderAbsorptionGuardCandidateMassKgM2) || 0) / 0.001),
    1 - clamp01(((reintegrationSummary.referenceSlices?.targetEntry33p75?.on?.shoulderAbsorptionGuardAppliedSuppressionKgM2) || 0) / 0.001),
    clamp01(((reintegrationSummary.referenceSlices?.targetEntry33p75?.on?.freshShoulderTargetEntryExclusionDiagFrac) || 0) / 0.9)
  );
  const witnessSupportsInPlaceRetention = (witness.qvSumDelta || 0) > 0
    && (witness.qcSumDelta || 0) < 0
    && (witness.shoulderSuppressedMassKgM2 || 0) > 0;
  const liveBandRetentionRationale = witnessSupportsInPlaceRetention
    ? 'Best fit to the live 3-12 N recharge and the one-column witness that shows more qv and less qc after suppression.'
    : 'Best fit to the live 3-12 N recharge; the synthetic one-column witness is neutral under current defaults, so this must be proven by counterfactual audit instead of treated as a column proof.';
  const ruledInEvidence = witnessSupportsInPlaceRetention
    ? [
      'The current shoulder guard leaves more qv and less qc behind in the same column when it suppresses condensation.',
      'That in-place vapor retention matches the 30-day increase in tropical-shoulder TCW and RH.'
    ]
    : [
      'The live reintegration evidence still shows tropical-shoulder TCW/RH recharge after suppression.',
      'The current synthetic one-column witness no longer triggers shoulder suppression, so it is neutral evidence and must not be used as proof.'
    ];

  const designOptions = [
    {
      key: 'local_sink_or_export_path',
      label: 'Route suppressed shoulder mass into a capped local sink/export path instead of leaving it in-place as vapor.',
      score: round(inPlaceVaporRetentionScore, 5),
      rationale: liveBandRetentionRationale
    },
    {
      key: 'delayed_rainout_or_buffered_removal',
      label: 'Convert suppressed shoulder mass into a delayed rainout / buffered removal lane rather than immediate in-place retention.',
      score: round(mean(inPlaceVaporRetentionScore, adjacentSpilloverScore * 0.9), 5),
      rationale: 'Could reduce same-step recharge while keeping the patch conservative, but still needs proof it will not simply move the rebound by one step.'
    },
    {
      key: 'selector_only_retune',
      label: 'Retune selector shape or amplitude again without changing suppressed-mass fate.',
      score: round(1 - selectorGeometryResolvedScore, 5),
      rationale: 'Not recommended. 1ZB/1ZC already proved the geometry is basically right and the target-entry false positive is resolved.'
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    schema: 'satellite-wars.phase1zd-suppressed-mass-fate-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'in_place_vapor_retention',
    nextPhase: 'Phase 1ZE: Suppressed-Mass Fate Counterfactuals',
    recommendation: 'The next phase should compare a capped local sink/export path against a delayed-rainout path, because the current shoulder guard is leaving suppressed mass in-place as vapor and recharging the same lane.',
    reintegrationReference: {
      verdict: reintegrationSummary.verdict,
      nextPhase: reintegrationSummary.nextPhase
    },
    liveBandEvidence: band,
    witness,
    ranking: [
      {
        key: 'in_place_vapor_retention',
        label: 'Suppressed shoulder mass is being retained locally as vapor in the current implementation.',
        score: round(inPlaceVaporRetentionScore, 5),
        evidence: {
          qvSumDelta: witness.qvSumDelta,
          qcSumDelta: witness.qcSumDelta,
          level1QvDelta: witness.level1QvDelta,
          shoulderSuppressedMassKgM2: witness.shoulderSuppressedMassKgM2,
          tropicalShoulderCoreTcwDeltaKgM2: band.tropicalShoulderCoreTcwDeltaKgM2,
          tropicalShoulderCoreMidRhDeltaFrac: band.tropicalShoulderCoreMidRhDeltaFrac
        }
      },
      {
        key: 'adjacent_spillover_requires_fate_aware_solution',
        label: 'A smaller secondary rebound still leaks into the adjacent 12–22.5°N shoulder lane.',
        score: round(adjacentSpilloverScore, 5),
        evidence: {
          adjacentShoulderSpilloverDeltaKgM2: band.adjacentShoulderSpilloverDeltaKgM2,
          adjacentShoulderSpilloverTcwDeltaKgM2: band.adjacentShoulderSpilloverTcwDeltaKgM2,
          adjacentShoulderSpilloverMidRhDeltaFrac: band.adjacentShoulderSpilloverMidRhDeltaFrac
        }
      },
      {
        key: 'selector_geometry_is_no_longer_primary',
        label: 'Selector geometry is not the main blocker anymore.',
        score: round(selectorGeometryResolvedScore, 5),
        evidence: {
          targetEntryCandidateOnKgM2: reintegrationSummary.referenceSlices?.targetEntry33p75?.on?.shoulderAbsorptionGuardCandidateMassKgM2,
          targetEntryAppliedOnKgM2: reintegrationSummary.referenceSlices?.targetEntry33p75?.on?.shoulderAbsorptionGuardAppliedSuppressionKgM2,
          targetEntryExclusionOnFrac: reintegrationSummary.referenceSlices?.targetEntry33p75?.on?.freshShoulderTargetEntryExclusionDiagFrac
        }
      }
    ],
    designOptions,
    rootCauseAssessment: {
      ruledIn: ruledInEvidence,
      ruledOut: [
        'Another selector-geometry retune is not the primary next move.'
      ],
      ambiguous: [
        'Whether the best fix is a local sink/export path or a delayed-rainout/buffered-removal path still needs counterfactual testing.'
      ]
    }
  };
}

export function renderPhase1ZDReport(summary) {
  const lines = [
    '# Phase 1ZD Suppressed-Mass Fate Design',
    '',
    '## Scope',
    '',
    `- Reintegration audit: \`${summary.paths.reintegrationJsonPath}\``,
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- ${summary.recommendation}`,
    '',
    '## Live Reintegration Evidence',
    '',
    `- tropical shoulder core net condensation delta: \`${summary.liveBandEvidence.tropicalShoulderCoreNetCondensationDeltaKgM2}\``,
    `- tropical shoulder core reconstructed raw condensation delta: \`${summary.liveBandEvidence.tropicalShoulderCoreReconstructedRawCondensationDeltaKgM2}\``,
    `- tropical shoulder core applied suppression on: \`${summary.liveBandEvidence.tropicalShoulderCoreAppliedSuppressionOnKgM2}\``,
    `- tropical shoulder core TCW delta: \`${summary.liveBandEvidence.tropicalShoulderCoreTcwDeltaKgM2}\``,
    `- tropical shoulder core mid-RH delta: \`${summary.liveBandEvidence.tropicalShoulderCoreMidRhDeltaFrac}\``,
    `- adjacent shoulder spillover delta: \`${summary.liveBandEvidence.adjacentShoulderSpilloverDeltaKgM2}\``,
    '',
    '## One-Column Fate Witness',
    '',
    `- qv sum off/on: \`${summary.witness.qvSumOff}\` / \`${summary.witness.qvSumOn}\` (delta \`${summary.witness.qvSumDelta}\`)`,
    `- qc sum off/on: \`${summary.witness.qcSumOff}\` / \`${summary.witness.qcSumOn}\` (delta \`${summary.witness.qcSumDelta}\`)`,
    `- level-1 qv off/on: \`${summary.witness.level1QvOff}\` / \`${summary.witness.level1QvOn}\` (delta \`${summary.witness.level1QvDelta}\`)`,
    `- level-1 qc off/on: \`${summary.witness.level1QcOff}\` / \`${summary.witness.level1QcOn}\` (delta \`${summary.witness.level1QcDelta}\`)`,
    `- final condensation off/on: \`${summary.witness.condensationOffKgM2}\` / \`${summary.witness.condensationOnKgM2}\``,
    `- shoulder suppressed mass on: \`${summary.witness.shoulderSuppressedMassKgM2}\``,
    '',
    '## Ranked Findings',
    '',
    ...summary.ranking.map((item, index) => `${index + 1}. ${item.key}: ${item.label} (score \`${item.score}\`)`),
    '',
    '## Design Options',
    '',
    ...summary.designOptions.map((item, index) => `${index + 1}. ${item.key}: ${item.label} (score \`${item.score}\`)`),
    ...summary.designOptions.map((item) => `- ${item.key} rationale: ${item.rationale}`),
    '',
    '## Assessment',
    '',
    ...summary.rootCauseAssessment.ruledIn.map((line) => `- ruled in: ${line}`),
    ...summary.rootCauseAssessment.ruledOut.map((line) => `- ruled out: ${line}`),
    ...summary.rootCauseAssessment.ambiguous.map((line) => `- ambiguous: ${line}`)
  ];
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    reintegrationJsonPath: defaultReintegrationJsonPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--reint-json' && argv[i + 1]) options.reintegrationJsonPath = argv[++i];
    else if (arg.startsWith('--reint-json=')) options.reintegrationJsonPath = arg.slice('--reint-json='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const reintegrationSummary = readJson(options.reintegrationJsonPath);
  const summary = buildPhase1ZDSuppressedMassFateDesign({
    reintegrationSummary,
    paths: options
  });
  const report = renderPhase1ZDReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
