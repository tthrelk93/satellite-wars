#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zs-off.json';
const defaultOnPath = '/tmp/phase1zs-on.json';
const defaultPhase1ZTPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zt-south-mirror-rebound-attribution.json'
);
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zu-bilateral-balance-patch-design.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zu-bilateral-balance-patch-design.json'
);

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;
const latestMetrics = (audit) => latestSample(audit)?.metrics || {};

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

function profileValue(sample, key, targetLat) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return 0;
  const index = nearestIndex(latitudesDeg, targetLat);
  return Number(sample?.profiles?.series?.[key]?.[index]) || 0;
}

export function buildPhase1ZUBilateralBalancePatchDesign({ offAudit, onAudit, phase1ztSummary, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const onSample = latestSample(onAudit);

  const southLocal = Number(onMetrics.southTransitionSubtropicalLocalHemiSourceMeanFrac) || 0;
  const southMean = Number(onMetrics.southTransitionSubtropicalMeanTropicalSourceMeanFrac) || 0;
  const southFloor = Number(onMetrics.southTransitionSubtropicalSourceDriverFloorMeanFrac) || 0;
  const northLocal = Number(onMetrics.northTransitionSubtropicalLocalHemiSourceMeanFrac) || 0;
  const northMean = Number(onMetrics.northTransitionSubtropicalMeanTropicalSourceMeanFrac) || 0;
  const southEffectiveFloorFrac = southMean > 1e-12 ? southFloor / southMean : 0;
  const southNeutralFloorFrac = southMean > 1e-12 ? southLocal / southMean : 0;
  const weakHemiFloorOverhangFrac = Math.max(0, southEffectiveFloorFrac - southNeutralFloorFrac);

  const northLeakPenalty11N = profileValue(
    onSample,
    'equatorialEdgeNorthsideLeakPenaltyDiagFrac',
    11.25
  );
  const southLeakPenalty11S = profileValue(
    onSample,
    'equatorialEdgeNorthsideLeakPenaltyDiagFrac',
    -11.25
  );

  const northSuppressionNetCondDelta = round(
    (Number(phase1ztSummary?.slices?.northSource?.delta?.largeScaleCondensationSourceKgM2) || 0)
      + (Number(phase1ztSummary?.slices?.northEdge?.delta?.largeScaleCondensationSourceKgM2) || 0)
  );
  const southMirrorNetCondDelta = round(
    (Number(phase1ztSummary?.slices?.southSource?.delta?.largeScaleCondensationSourceKgM2) || 0)
      + (Number(phase1ztSummary?.slices?.southEdge?.delta?.largeScaleCondensationSourceKgM2) || 0)
  );

  return {
    schema: 'satellite-wars.phase1zu-bilateral-balance-patch-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'weak_hemi_crosshemi_floor_overhang',
    nextPhase: 'Phase 1ZV: Implement Weak-Hemisphere Cross-Hemi Floor Taper Patch',
    recommendation: 'Do not add a south-local humidity or omega patch. The smallest evidence-backed balance fix is to taper the weak-hemisphere cross-hemi floor in the subtropical source-driver path when the northside leak gate is live, rather than letting the south transition inherit an over-high floor.',
    phase1ztContext: {
      verdict: phase1ztSummary?.verdict ?? null,
      nextPhase: phase1ztSummary?.nextPhase ?? null
    },
    metrics: {
      itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
      subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
      subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
      crossEquatorialVaporFluxNorthKgM_1S: round((Number(onMetrics.crossEquatorialVaporFluxNorthKgM_1S) || 0) - (Number(offMetrics.crossEquatorialVaporFluxNorthKgM_1S) || 0)),
      equatorialPrecipMeanMmHr: round((Number(onMetrics.equatorialPrecipMeanMmHr) || 0) - (Number(offMetrics.equatorialPrecipMeanMmHr) || 0))
    },
    liveBalanceState: {
      northsideLeakPenalty11N: round(northLeakPenalty11N),
      southsideLeakPenalty11S: round(southLeakPenalty11S),
      northLocalHemiSource: round(northLocal),
      northMeanTropicalSource: round(northMean),
      northCrossHemiFloorShare: round(Number(onMetrics.northTransitionSubtropicalCrossHemiFloorShareMeanFrac) || 0),
      southLocalHemiSource: round(southLocal),
      southMeanTropicalSource: round(southMean),
      southSourceDriverFloor: round(southFloor),
      southCrossHemiFloorShare: round(Number(onMetrics.southTransitionSubtropicalCrossHemiFloorShareMeanFrac) || 0),
      southWeakHemiFrac: round(Number(onMetrics.southTransitionSubtropicalWeakHemiFracMean) || 0)
    },
    overhangAnalysis: {
      southEffectiveCrossHemiFloorFrac: round(southEffectiveFloorFrac),
      southNeutralCrossHemiFloorFrac: round(southNeutralFloorFrac),
      weakHemiFloorOverhangFrac: round(weakHemiFloorOverhangFrac),
      northSuppressionNetCondDelta,
      southMirrorNetCondDelta
    },
    designContract: {
      keep: [
        'keep the northside leak-risk gate and bilateral equatorial-edge geometry available behind their runtime toggles',
        'keep the south-edge stabilization lane and target-entry exclusion unchanged for the next implementation'
      ],
      change: [
        'patch the subtropical source-driver floor in vertical5.js rather than adding a south-local humidity or omega sink',
        'compute a weak-hemisphere-only taper from max(0, effectiveCrossHemiFloorFrac - localHemiSource / meanTropicalSource)',
        'apply that taper only where the hemisphere is weak, the cross-hemi floor share is positive, and the northside leak gate is live',
        'cap the live taper near the current overhang magnitude (~0.144) before considering any stronger amplitude'
      ],
      avoid: [
        'do not globally reduce subtropicalSubsidenceCrossHemiFloorFrac because the north transition already has zero floor share',
        'do not add a south-local TCW/RH/omega patch because Phase 1ZT showed no meaningful local recharge signal'
      ]
    }
  };
}

export function renderPhase1ZUReport(summary) {
  return `# Phase 1ZU Bilateral Balance Patch Design

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why Bilateral Balance Is The Right Lane

- northside leak penalty at \`11.25°N\`: \`${summary.liveBalanceState.northsideLeakPenalty11N}\`
- southside leak penalty at \`-11.25°\`: \`${summary.liveBalanceState.southsideLeakPenalty11S}\`
- north local / mean tropical source: \`${summary.liveBalanceState.northLocalHemiSource}\` / \`${summary.liveBalanceState.northMeanTropicalSource}\`
- south local / mean tropical source: \`${summary.liveBalanceState.southLocalHemiSource}\` / \`${summary.liveBalanceState.southMeanTropicalSource}\`
- south source-driver floor: \`${summary.liveBalanceState.southSourceDriverFloor}\`
- south cross-hemi floor share: \`${summary.liveBalanceState.southCrossHemiFloorShare}\`
- north cross-hemi floor share: \`${summary.liveBalanceState.northCrossHemiFloorShare}\`
- south weak-hemi fraction: \`${summary.liveBalanceState.southWeakHemiFrac}\`

## Overhang Analysis

- south effective floor fraction: \`${summary.overhangAnalysis.southEffectiveCrossHemiFloorFrac}\`
- south neutral floor fraction: \`${summary.overhangAnalysis.southNeutralCrossHemiFloorFrac}\`
- weak-hemi floor overhang: \`${summary.overhangAnalysis.weakHemiFloorOverhangFrac}\`
- north suppression net condensation delta: \`${summary.overhangAnalysis.northSuppressionNetCondDelta}\`
- south mirror net condensation delta: \`${summary.overhangAnalysis.southMirrorNetCondDelta}\`
- cross-equatorial vapor-flux delta: \`${summary.metrics.crossEquatorialVaporFluxNorthKgM_1S}\`

## Patch Contract

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
${summary.designContract.avoid.map((item) => `- avoid: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1ztPath: defaultPhase1ZTPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zt' && argv[i + 1]) options.phase1ztPath = argv[++i];
    else if (arg.startsWith('--phase1zt=')) options.phase1ztPath = arg.slice('--phase1zt='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZUBilateralBalancePatchDesign({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1ztSummary: readJson(options.phase1ztPath),
    paths: options
  });
  const report = renderPhase1ZUReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
