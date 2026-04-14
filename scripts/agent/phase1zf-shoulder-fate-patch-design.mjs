#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultSummaryPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1ze-suppressed-mass-fate-counterfactuals.json');
const defaultOffPath = '/tmp/phase1ze-off.json';
const defaultCandidatePath = '/tmp/phase1ze-buffered.json';
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zf-shoulder-fate-patch-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zf-shoulder-fate-patch-design.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;

function sliceAt(sample, latitudeDeg) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  const index = latitudesDeg.findIndex((value) => Math.abs(value - latitudeDeg) < 1e-6);
  const series = sample?.profiles?.series || {};
  const read = (key) => (index >= 0 ? (series[key]?.[index] ?? null) : null);
  return {
    latitudeDeg,
    largeScaleCondensationSourceKgM2: read('largeScaleCondensationSourceKgM2'),
    shoulderAbsorptionGuardAppliedSuppressionKgM2: read('shoulderAbsorptionGuardAppliedSuppressionKgM2'),
    shoulderAbsorptionGuardBufferedRainoutKgM2: read('shoulderAbsorptionGuardBufferedRainoutKgM2'),
    totalColumnWaterKgM2: read('totalColumnWaterKgM2'),
    lowerTroposphericRhFrac: read('lowerTroposphericRhFrac'),
    midTroposphericRhFrac: read('midTroposphericRhFrac')
  };
}

function pairedSlice(offSample, onSample, latitudeDeg) {
  const off = sliceAt(offSample, latitudeDeg);
  const on = sliceAt(onSample, latitudeDeg);
  return {
    latitudeDeg,
    off,
    on,
    deltas: {
      largeScaleCondensationSourceKgM2: round((Number(on.largeScaleCondensationSourceKgM2) || 0) - (Number(off.largeScaleCondensationSourceKgM2) || 0), 5),
      shoulderAbsorptionGuardAppliedSuppressionKgM2: round((Number(on.shoulderAbsorptionGuardAppliedSuppressionKgM2) || 0) - (Number(off.shoulderAbsorptionGuardAppliedSuppressionKgM2) || 0), 5),
      shoulderAbsorptionGuardBufferedRainoutKgM2: round((Number(on.shoulderAbsorptionGuardBufferedRainoutKgM2) || 0) - (Number(off.shoulderAbsorptionGuardBufferedRainoutKgM2) || 0), 5),
      totalColumnWaterKgM2: round((Number(on.totalColumnWaterKgM2) || 0) - (Number(off.totalColumnWaterKgM2) || 0), 5),
      lowerTroposphericRhFrac: round((Number(on.lowerTroposphericRhFrac) || 0) - (Number(off.lowerTroposphericRhFrac) || 0), 5),
      midTroposphericRhFrac: round((Number(on.midTroposphericRhFrac) || 0) - (Number(off.midTroposphericRhFrac) || 0), 5)
    }
  };
}

export function buildPhase1ZFShoulderFatePatchDesign({ summary, offAudit, candidateAudit, paths }) {
  const ranking = summary?.ranking || [];
  const winner = summary?.winner || ranking[0] || null;
  const sink = ranking.find((item) => item.key === 'sink_export') || null;
  const buffered = ranking.find((item) => item.key === 'buffered_rainout') || winner;
  const retain = ranking.find((item) => item.key === 'retain') || null;

  const offSample = latestSample(offAudit);
  const candidateSample = latestSample(candidateAudit);
  const equatorialEdge = pairedSlice(offSample, candidateSample, 3.75);
  const innerShoulder = pairedSlice(offSample, candidateSample, 11.25);
  const spillover = pairedSlice(offSample, candidateSample, 18.75);
  const targetEntry = pairedSlice(offSample, candidateSample, 33.75);

  const verdict = 'equatorial_edge_buffered_underreach';
  const nextPhase = 'Phase 1ZG: Implement Equatorial-Edge Buffered Shoulder Fate Patch';

  return {
    schema: 'satellite-wars.phase1zf-shoulder-fate-patch-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict,
    nextPhase,
    winner,
    ranking,
    designChoice: {
      baseFate: 'buffered_rainout',
      rejectedAlternatives: [
        {
          key: 'sink_export',
          reason: 'It fixes the shoulder-core condensation and spillover strongly, but it breaks the south dry-belt guardrail.'
        },
        {
          key: 'retain',
          reason: 'It preserves the current in-place vapor recharge failure and therefore is no longer a serious candidate.'
        }
      ],
      requiredPatchTraits: [
        'keep buffered rainout as the suppressed-mass fate',
        'increase effective buffered application specifically in the 3–6°N equatorial-edge shoulder lane',
        'do not reopen the 30–45°N target-entry lane',
        'do not expand application into the 18.75°N spillover lane',
        'reallocate shoulder suppression toward 3.75°N before increasing total amplitude'
      ]
    },
    evidence: {
      buffered,
      sink,
      retain,
      equatorialEdge,
      innerShoulder,
      spillover,
      targetEntry
    },
    recommendation: 'Buffered rainout is the right fate family, but the live patch needs an equatorial-edge allocation redesign so 3.75°N is suppressed harder without borrowing climate stability from sink/export.'
  };
}

export function renderPhase1ZFReport(summary) {
  const lines = [
    '# Phase 1ZF Shoulder Fate Patch Design',
    '',
    '## Verdict',
    '',
    `- ${summary.verdict}`,
    `- Next phase: ${summary.nextPhase}`,
    `- ${summary.recommendation}`,
    '',
    '## Why Buffered Rainout Wins',
    '',
    `- buffered_rainout score: \`${summary.evidence.buffered?.score}\``,
    `- sink_export score: \`${summary.evidence.sink?.score}\``,
    `- retain score: \`${summary.evidence.retain?.score}\``,
    `- buffered shoulder-core delta: \`${summary.evidence.buffered?.deltas?.tropicalShoulderCoreCondensationKgM2}\``,
    `- buffered spillover delta: \`${summary.evidence.buffered?.deltas?.shoulderSpilloverKgM2}\``,
    `- sink_export south dry-ratio delta: \`${summary.evidence.sink?.deltas?.subtropicalDrySouthRatio}\``,
    '',
    '## Key Residual Slices',
    '',
    `- 3.75°N edge condensation delta: \`${summary.evidence.equatorialEdge?.deltas?.largeScaleCondensationSourceKgM2}\` with buffered application \`${summary.evidence.equatorialEdge?.on?.shoulderAbsorptionGuardBufferedRainoutKgM2}\``,
    `- 11.25°N inner shoulder condensation delta: \`${summary.evidence.innerShoulder?.deltas?.largeScaleCondensationSourceKgM2}\` with buffered application \`${summary.evidence.innerShoulder?.on?.shoulderAbsorptionGuardBufferedRainoutKgM2}\``,
    `- 18.75°N spillover condensation delta: \`${summary.evidence.spillover?.deltas?.largeScaleCondensationSourceKgM2}\``,
    `- 33.75°N target-entry applied suppression: \`${summary.evidence.targetEntry?.on?.shoulderAbsorptionGuardAppliedSuppressionKgM2}\``,
    '',
    '## Design Contract',
    ''
  ];

  for (const item of summary.designChoice.requiredPatchTraits || []) {
    lines.push(`- ${item}`);
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    summaryPath: defaultSummaryPath,
    offPath: defaultOffPath,
    candidatePath: defaultCandidatePath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--summary' && argv[i + 1]) options.summaryPath = argv[++i];
    else if (arg.startsWith('--summary=')) options.summaryPath = arg.slice('--summary='.length);
    else if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--candidate' && argv[i + 1]) options.candidatePath = argv[++i];
    else if (arg.startsWith('--candidate=')) options.candidatePath = arg.slice('--candidate='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZFShoulderFatePatchDesign({
    summary: readJson(options.summaryPath),
    offAudit: readJson(options.offPath),
    candidateAudit: readJson(options.candidatePath),
    paths: options
  });
  const report = renderPhase1ZFReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
