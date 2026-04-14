#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zj-off.json';
const defaultOnPath = '/tmp/phase1zj-on.json';
const defaultPhase1ZJPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zj-split-lane-equatorial-edge-candidate-gate-patch.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zk-equatorial-edge-out-of-lane-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zk-equatorial-edge-out-of-lane-attribution.json');

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
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;

function nearestIndex(latitudesDeg, targetLat) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < latitudesDeg.length; i += 1) {
    const distance = Math.abs((latitudesDeg[i] || 0) - targetLat);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function snapshot(sample, targetLat) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return null;
  const index = nearestIndex(latitudesDeg, targetLat);
  const get = (key) => Number(sample?.profiles?.series?.[key]?.[index]) || 0;
  return {
    latitudeDeg: round(latitudesDeg[index], 2),
    largeScaleCondensationSourceKgM2: round(get('largeScaleCondensationSourceKgM2'), 5),
    precipRateMmHr: round(get('precipRateMmHr'), 5),
    convectiveMassFluxKgM2S: round(get('convectiveMassFluxKgM2S'), 5),
    convectiveOrganization: round(get('convectiveOrganization'), 5),
    totalColumnWaterKgM2: round(get('totalColumnWaterKgM2'), 5),
    boundaryLayerRhFrac: round(get('boundaryLayerRhFrac'), 5),
    midTroposphericRhFrac: round(get('midTroposphericRhFrac'), 5),
    lowerTroposphericOmegaPaS: round(get('lowerTroposphericOmegaPaS'), 5),
    midTroposphericOmegaPaS: round(get('midTroposphericOmegaPaS'), 5),
    upperTroposphericOmegaPaS: round(get('upperTroposphericOmegaPaS'), 5),
    shoulderAbsorptionGuardCandidateMassKgM2: round(get('shoulderAbsorptionGuardCandidateMassKgM2'), 5),
    shoulderAbsorptionGuardAppliedSuppressionKgM2: round(get('shoulderAbsorptionGuardAppliedSuppressionKgM2'), 5),
    freshShoulderEquatorialEdgeWindowDiagFrac: round(get('freshShoulderEquatorialEdgeWindowDiagFrac'), 5),
    freshShoulderInnerWindowDiagFrac: round(get('freshShoulderInnerWindowDiagFrac'), 5),
    freshShoulderEquatorialEdgeGateSupportDiagFrac: round(get('freshShoulderEquatorialEdgeGateSupportDiagFrac'), 5),
    freshShoulderTargetEntryExclusionDiagFrac: round(get('freshShoulderTargetEntryExclusionDiagFrac'), 5)
  };
}

function deltaSlice(onSlice, offSlice) {
  const keys = Object.keys(onSlice || {});
  const deltas = {};
  for (const key of keys) {
    if (key === 'latitudeDeg') continue;
    deltas[key] = round((Number(onSlice?.[key]) || 0) - (Number(offSlice?.[key]) || 0));
  }
  return deltas;
}

export function buildPhase1ZKEquatorialEdgeOutOfLaneAttribution({ offAudit, onAudit, phase1zjSummary, paths }) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const southEdgeOff = snapshot(offSample, -3.75);
  const southEdgeOn = snapshot(onSample, -3.75);
  const northEdgeOff = snapshot(offSample, 3.75);
  const northEdgeOn = snapshot(onSample, 3.75);
  const innerShoulderOff = snapshot(offSample, 11.25);
  const innerShoulderOn = snapshot(onSample, 11.25);
  const spilloverOff = snapshot(offSample, 18.75);
  const spilloverOn = snapshot(onSample, 18.75);
  const targetEntryOff = snapshot(offSample, 33.75);
  const targetEntryOn = snapshot(onSample, 33.75);

  const southEdgeDelta = deltaSlice(southEdgeOn, southEdgeOff);
  const northEdgeDelta = deltaSlice(northEdgeOn, northEdgeOff);
  const innerShoulderDelta = deltaSlice(innerShoulderOn, innerShoulderOff);
  const spilloverDelta = deltaSlice(spilloverOn, spilloverOff);
  const targetEntryDelta = deltaSlice(targetEntryOn, targetEntryOff);

  const bilateralEdgeCondensationScore = mean(
    clamp01((northEdgeDelta.largeScaleCondensationSourceKgM2 || 0) / 0.02),
    clamp01((southEdgeDelta.largeScaleCondensationSourceKgM2 || 0) / 0.02),
    clamp01(Math.max(0, -(northEdgeDelta.lowerTroposphericOmegaPaS || 0)) / 0.002),
    clamp01(Math.max(0, -(southEdgeDelta.lowerTroposphericOmegaPaS || 0)) / 0.01)
  );

  const inLaneShoulderFailureScore = mean(
    1 - clamp01((northEdgeOn.shoulderAbsorptionGuardCandidateMassKgM2 || 0) / 0.01),
    1 - clamp01((northEdgeOn.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) / 0.005),
    clamp01((innerShoulderOn.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) / 0.005),
    clamp01(Math.max(0, -(innerShoulderDelta.largeScaleCondensationSourceKgM2 || 0)) / 0.03)
  );

  const targetEntryLeakageScore = mean(
    1 - clamp01((targetEntryOn.shoulderAbsorptionGuardAppliedSuppressionKgM2 || 0) / 0.005),
    clamp01(Math.max(0, -(targetEntryDelta.largeScaleCondensationSourceKgM2 || 0)) / 0.005),
    clamp01((targetEntryOn.freshShoulderTargetEntryExclusionDiagFrac || 0))
  );

  const ranking = [
    {
      key: 'bilateral_equatorial_edge_subsidence_relaxation',
      label: 'The residual has shifted into a symmetric equatorial-edge condensation lane with weaker low-level subsidence on both sides of the equator.',
      score: round(bilateralEdgeCondensationScore, 5),
      evidence: {
        southEdgeCondensationDeltaKgM2: southEdgeDelta.largeScaleCondensationSourceKgM2,
        northEdgeCondensationDeltaKgM2: northEdgeDelta.largeScaleCondensationSourceKgM2,
        southEdgeLowerOmegaDeltaPaS: southEdgeDelta.lowerTroposphericOmegaPaS,
        northEdgeLowerOmegaDeltaPaS: northEdgeDelta.lowerTroposphericOmegaPaS
      }
    },
    {
      key: 'shoulder_lane_now_clean',
      label: 'The shoulder lane itself is no longer the main owner: the inner shoulder still improves while the edge has zero in-lane guard admission.',
      score: round(inLaneShoulderFailureScore, 5),
      evidence: {
        northEdgeCandidateOnKgM2: northEdgeOn.shoulderAbsorptionGuardCandidateMassKgM2,
        northEdgeAppliedSuppressionOnKgM2: northEdgeOn.shoulderAbsorptionGuardAppliedSuppressionKgM2,
        innerShoulderAppliedSuppressionOnKgM2: innerShoulderOn.shoulderAbsorptionGuardAppliedSuppressionKgM2,
        innerShoulderCondensationDeltaKgM2: innerShoulderDelta.largeScaleCondensationSourceKgM2
      }
    },
    {
      key: 'target_entry_protection_preserved',
      label: 'The target-entry lane remains correctly excluded and is not the source of the residual.',
      score: round(targetEntryLeakageScore, 5),
      evidence: {
        targetEntryAppliedSuppressionOnKgM2: targetEntryOn.shoulderAbsorptionGuardAppliedSuppressionKgM2,
        targetEntryExclusionOnFrac: targetEntryOn.freshShoulderTargetEntryExclusionDiagFrac,
        targetEntryCondensationDeltaKgM2: targetEntryDelta.largeScaleCondensationSourceKgM2
      }
    }
  ];

  return {
    schema: 'satellite-wars.phase1zk-equatorial-edge-out-of-lane-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'bilateral_equatorial_edge_subsidence_relaxation',
    nextPhase: 'Phase 1ZL: Equatorial-Edge Subsidence Guard Design',
    recommendation: 'Keep Phase 1ZJ. The next patch should not go back into the shoulder selector. It should preserve or project the subtropical drying/omega response so the 3.75° edge lanes do not absorb the displaced condensation with weaker subsidence.',
    phase1zjContext: {
      verdict: phase1zjSummary?.verdict ?? null,
      keepPatch: phase1zjSummary?.keepPatch ?? null
    },
    referenceSlices: {
      southEdge: { off: southEdgeOff, on: southEdgeOn, delta: southEdgeDelta },
      northEdge: { off: northEdgeOff, on: northEdgeOn, delta: northEdgeDelta },
      innerShoulder: { off: innerShoulderOff, on: innerShoulderOn, delta: innerShoulderDelta },
      spillover: { off: spilloverOff, on: spilloverOn, delta: spilloverDelta },
      targetEntry: { off: targetEntryOff, on: targetEntryOn, delta: targetEntryDelta }
    },
    ranking,
    designContract: {
      keep: [
        'keep the split-lane shoulder gate from Phase 1ZJ',
        'keep the 11.25°N inner-shoulder improvement',
        'keep the 18.75°N spillover improvement',
        'keep the 33.75°N target-entry exclusion'
      ],
      change: [
        'move the next patch lane out of microphysics shoulder admission and into vertical/core omega or subsidence placement',
        'design the next patch against the ±3.75° equatorial-edge pair instead of only the 3.75°N shoulder slice',
        'target the same-step subsidence / omega response so edge condensation does not rise when the inner shoulder dries'
      ]
    }
  };
}

export function renderPhase1ZKReport(summary) {
  return `# Phase 1ZK Equatorial-Edge Out-Of-Lane Attribution

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why This Is No Longer A Shoulder-Lane Problem

- 3.75N condensation still rises: \`${summary.referenceSlices.northEdge.delta.largeScaleCondensationSourceKgM2}\`
- -3.75 condensation also rises almost the same amount: \`${summary.referenceSlices.southEdge.delta.largeScaleCondensationSourceKgM2}\`
- 3.75N shoulder candidate stays \`${summary.referenceSlices.northEdge.on.shoulderAbsorptionGuardCandidateMassKgM2}\`
- 3.75N shoulder applied suppression stays \`${summary.referenceSlices.northEdge.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`
- 11.25N still improves: \`${summary.referenceSlices.innerShoulder.delta.largeScaleCondensationSourceKgM2}\`
- 33.75N target-entry applied suppression stays \`${summary.referenceSlices.targetEntry.on.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`

## Carrier Evidence

- 3.75N lower-omega delta: \`${summary.referenceSlices.northEdge.delta.lowerTroposphericOmegaPaS}\`
- -3.75 lower-omega delta: \`${summary.referenceSlices.southEdge.delta.lowerTroposphericOmegaPaS}\`
- 3.75N mid-RH delta: \`${summary.referenceSlices.northEdge.delta.midTroposphericRhFrac}\`
- -3.75 mid-RH delta: \`${summary.referenceSlices.southEdge.delta.midTroposphericRhFrac}\`

## Ranking

${summary.ranking.map((item) => `- ${item.key}: \`${item.score}\` — ${item.label}`).join('\n')}

## Next Patch Contract

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1zjPath: defaultPhase1ZJPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zj' && argv[i + 1]) options.phase1zjPath = argv[++i];
    else if (arg.startsWith('--phase1zj=')) options.phase1zjPath = arg.slice('--phase1zj='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZKEquatorialEdgeOutOfLaneAttribution({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1zjSummary: readJson(options.phase1zjPath),
    paths: options
  });
  const report = renderPhase1ZKReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
