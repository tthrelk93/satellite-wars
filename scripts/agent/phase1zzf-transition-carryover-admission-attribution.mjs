#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zzf-off.json';
const defaultOnPath = '/tmp/phase1zzf-on.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzf-transition-carryover-admission-attribution.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzf-transition-carryover-admission-attribution.json'
);

const CONTAINMENT = {
  signal0: 0.04,
  signal1: 0.075,
  lat0: 18,
  lat1: 22.5,
  overlap0: 0.08,
  overlap1: 0.18,
  dry0: 0.12,
  dry1: 0.24,
  omega0: 0.12,
  omega1: 0.26
};

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (edge0, edge1, value) => {
  if (!Number.isFinite(value)) return 0;
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

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

function zonalValue(sample, targetLat, key) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return null;
  const index = nearestIndex(latitudesDeg, targetLat);
  return round(Number(sample?.profiles?.series?.[key]?.[index]) || 0);
}

function zonalDelta(offSample, onSample, targetLat, key) {
  const offValue = zonalValue(offSample, targetLat, key);
  const onValue = zonalValue(onSample, targetLat, key);
  return round((onValue || 0) - (offValue || 0));
}

function rankSupports(supports) {
  return Object.entries(supports)
    .map(([key, value]) => ({ key, value: round(value) }))
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
}

function classifyWeakestSupport(weakestKey) {
  switch (weakestKey) {
    case 'carrierSignalSupport':
      return {
        verdict: 'carrier_signal_below_transition_admission',
        nextPhase: 'Phase 1ZZG: Transition Carrier Signal Design',
        recommendation: 'The next step should redesign the containment carrier admission around the live northside leak signal, not raise containment amplitude.'
      };
    case 'overlapSupport':
      return {
        verdict: 'overlap_mass_below_transition_admission',
        nextPhase: 'Phase 1ZZG: Transition Overlap Admission Design',
        recommendation: 'The next step should redesign how overlap mass is admitted in the Atlantic transition lane, not retune dry-driver thresholds first.'
      };
    case 'drySupport':
      return {
        verdict: 'dry_driver_below_transition_admission',
        nextPhase: 'Phase 1ZZG: Transition Dry-Driver Admission Design',
        recommendation: 'The next step should redesign the transition dry-driver admission lane, not increase containment amplitude.'
      };
    case 'omegaSupport':
      return {
        verdict: 'omega_support_below_transition_admission',
        nextPhase: 'Phase 1ZZG: Transition Omega Admission Design',
        recommendation: 'The next step should redesign the transition omega admission lane, not increase containment amplitude.'
      };
    default:
      return {
        verdict: 'latitude_window_below_transition_admission',
        nextPhase: 'Phase 1ZZG: Transition Window Admission Design',
        recommendation: 'The next step should rework the transition admission window geometry before changing containment strength.'
      };
  }
}

export function buildPhase1ZZFTransitionCarryoverAdmissionAttribution({ offAudit, onAudit, paths }) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const laneDeltas = {
    receiver26N: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    spillover18N: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    source11N: zonalDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    edge3N: zonalDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    southMirror11S: zonalDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2')
  };

  const targetLat = 18.75;
  const carrierSignal = round(Number(on.northsideLeakCarrierSignalMean) || 0);
  const overlapMass = zonalValue(onSample, targetLat, 'carriedOverUpperCloudMassKgM2');
  const dryDriver = zonalValue(onSample, targetLat, 'subtropicalSubsidenceDryingFrac');
  const existingOmegaPaS = zonalValue(onSample, targetLat, 'lowLevelOmegaEffectivePaS');
  const subtropicalBand = zonalValue(onSample, targetLat, 'freshSubtropicalBandDiagFrac');
  const neutralSupport = zonalValue(onSample, targetLat, 'freshNeutralToSubsidingSupportDiagFrac');
  const containmentFrac = zonalValue(onSample, targetLat, 'atlanticTransitionCarryoverContainmentDiagFrac');
  const containmentApplied = zonalValue(onSample, targetLat, 'atlanticTransitionCarryoverContainmentAppliedDiag');

  const latSupport = round(
    smoothstep(CONTAINMENT.lat0 - 1.5, CONTAINMENT.lat0 + 1.5, Math.abs(targetLat))
      * (1 - smoothstep(CONTAINMENT.lat1 - 1.5, CONTAINMENT.lat1 + 1.5, Math.abs(targetLat)))
  );
  const supports = {
    latSupport,
    carrierSignalSupport: round(smoothstep(CONTAINMENT.signal0, CONTAINMENT.signal1, carrierSignal)),
    overlapSupport: round(smoothstep(CONTAINMENT.overlap0, CONTAINMENT.overlap1, overlapMass || 0)),
    drySupport: round(smoothstep(CONTAINMENT.dry0, CONTAINMENT.dry1, dryDriver || 0)),
    omegaSupport: round(smoothstep(CONTAINMENT.omega0, CONTAINMENT.omega1, existingOmegaPaS || 0))
  };

  const supportRanking = rankSupports(supports);
  const weakestSupport = supportRanking[0]?.key || 'latSupport';
  const classified = classifyWeakestSupport(weakestSupport);

  return {
    schema: 'satellite-wars.phase1zzf-transition-carryover-admission-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: (containmentFrac || 0) > 0 || (containmentApplied || 0) > 0
      ? 'transition_carryover_admission_live'
      : classified.verdict,
    keepPatch: false,
    nextPhase: (containmentFrac || 0) > 0 || (containmentApplied || 0) > 0
      ? 'Phase 1ZZG: Residual Post-Admission Attribution'
      : classified.nextPhase,
    recommendation: (containmentFrac || 0) > 0 || (containmentApplied || 0) > 0
      ? 'The Atlantic transition containment lane is now live, so the next step should move to residual post-admission attribution.'
      : classified.recommendation,
    metrics: {
      itczWidthDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
      subtropicalDryNorthRatio: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
      subtropicalDrySouthRatio: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
      northDryBeltOceanLargeScaleCondensationMeanKgM2: round(
        (Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
        - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
      ),
      midlatitudeWesterliesNorthU10Ms: round(
        (Number(on.midlatitudeWesterliesNorthU10Ms) || 0)
        - (Number(off.midlatitudeWesterliesNorthU10Ms) || 0)
      ),
      northsideLeakCarrierSignalMean: carrierSignal
    },
    laneDeltas,
    gateInputs: {
      targetLat,
      carrierSignal,
      overlapMass,
      dryDriver,
      existingOmegaPaS,
      subtropicalBand,
      neutralSupport,
      containmentFrac,
      containmentApplied,
      receiverTaper26N: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperDiagFrac'),
      receiverApplied26N: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperAppliedDiag')
    },
    supports,
    supportRanking
  };
}

export function renderPhase1ZZFReport(summary) {
  return `# Phase 1ZZF Transition Carryover Admission Attribution

## Verdict

- ${summary.verdict}
- keep patch: \`${summary.keepPatch}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Main Guardrails

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- NH westerlies delta: \`${summary.metrics.midlatitudeWesterliesNorthU10Ms}\`
- north dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`

## Transition Lane Outcome

- receiver \`26.25°N\` condensation delta: \`${summary.laneDeltas.receiver26N}\`
- spillover \`18.75°N\` condensation delta: \`${summary.laneDeltas.spillover18N}\`
- north source \`11.25°N\` condensation delta: \`${summary.laneDeltas.source11N}\`
- edge \`3.75°N\` condensation delta: \`${summary.laneDeltas.edge3N}\`
- south mirror \`-11.25°\` condensation delta: \`${summary.laneDeltas.southMirror11S}\`

## Admission Inputs At \`18.75°N\`

- northside leak carrier signal mean: \`${summary.gateInputs.carrierSignal}\`
- carryover overlap mass: \`${summary.gateInputs.overlapMass}\`
- subtropical drying: \`${summary.gateInputs.dryDriver}\`
- low-level omega effective: \`${summary.gateInputs.existingOmegaPaS}\`
- subtropical band support: \`${summary.gateInputs.subtropicalBand}\`
- neutral-to-subsiding support: \`${summary.gateInputs.neutralSupport}\`
- containment frac: \`${summary.gateInputs.containmentFrac}\`
- containment applied: \`${summary.gateInputs.containmentApplied}\`

## Admission Support Ranking

- ${summary.supportRanking.map((entry) => `\`${entry.key}\` = \`${entry.value}\``).join('\n- ')}

## Receiver Context

- \`26.25°N\` receiver taper frac on: \`${summary.gateInputs.receiverTaper26N}\`
- \`26.25°N\` receiver taper applied on: \`${summary.gateInputs.receiverApplied26N}\`
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZZFTransitionCarryoverAdmissionAttribution({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZZFReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
