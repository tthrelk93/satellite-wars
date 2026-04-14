#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultPhase1ZBPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zb-latitude-aware-shoulder-guard-redesign.md');
const defaultPhase1ZGPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zg-equatorial-edge-buffered-shoulder-patch.json');
const defaultPhase1ZHPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zh-equatorial-edge-candidate-rebound-attribution.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zi-equatorial-edge-candidate-gate-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zi-equatorial-edge-candidate-gate-design.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function extractFirstNumberAfter(text, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}[^\\d-]*(-?\\d+(?:\\.\\d+)?)`));
  return match ? Number(match[1]) : null;
}

export function buildPhase1ZIEquatorialEdgeCandidateGateDesign({ phase1zbReportText, phase1zgSummary, phase1zhSummary, paths }) {
  const edgeOldWindow = extractFirstNumberAfter(phase1zbReportText, 'shoulder `3.75°N`:');
  const innerOldWindow = extractFirstNumberAfter(phase1zbReportText, 'shoulder `11.25°N`:');

  const edge = phase1zgSummary?.slices?.equatorialEdge || null;
  const inner = phase1zgSummary?.slices?.innerShoulder || null;
  const spillover = phase1zgSummary?.slices?.spillover || null;
  const targetEntry = phase1zgSummary?.slices?.targetEntry || null;

  const designChoice = {
    key: 'split_lane_subtropical_support_gate',
    label: 'Split-lane equatorial-edge candidate gate',
    rationale: 'The current single shoulder window admits both 3.75°N and 11.25°N as one lane, but only the equatorial edge rebounds. The next gate must split those lanes and apply a stricter edge-only admission rule tied to fresh subtropical support.'
  };

  return {
    schema: 'satellite-wars.phase1zi-equatorial-edge-candidate-gate-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'single_lane_geometry_overadmits_equatorial_edge',
    nextPhase: 'Phase 1ZJ: Implement Split-Lane Equatorial-Edge Candidate Gate Patch',
    designChoice,
    evidence: {
      phase1zb: {
        note: 'Phase 1ZB showed the latitude-aware guard still treated 3.75°N and 11.25°N as fully admitted shoulder cells.',
        edgeWindowAdmission: edgeOldWindow,
        innerWindowAdmission: innerOldWindow
      },
      phase1zg: {
        edgeCondensationDeltaKgM2: edge?.deltas?.largeScaleCondensationSourceKgM2 ?? null,
        edgeCandidateDeltaKgM2: edge?.deltas?.shoulderAbsorptionGuardCandidateMassKgM2 ?? null,
        edgeEventCountDelta: edge?.deltas?.shoulderAbsorptionGuardEventCount ?? null,
        edgeAppliedSuppressionDeltaKgM2: edge?.deltas?.shoulderAbsorptionGuardAppliedSuppressionKgM2 ?? null,
        innerCondensationDeltaKgM2: inner?.deltas?.largeScaleCondensationSourceKgM2 ?? null,
        spilloverCondensationDeltaKgM2: spillover?.deltas?.largeScaleCondensationSourceKgM2 ?? null,
        targetEntryAppliedSuppressionKgM2: targetEntry?.on?.shoulderAbsorptionGuardAppliedSuppressionKgM2 ?? null
      },
      phase1zh: {
        verdict: phase1zhSummary?.verdict ?? null,
        conclusion: phase1zhSummary?.conclusion ?? null
      }
    },
    designContract: {
      keep: [
        'keep buffered_rainout as the suppressed-mass fate',
        'keep the 30–45°N target-entry exclusion intact',
        'keep the 11.25°N inner-shoulder improvement',
        'keep the 18.75°N spillover improvement'
      ],
      change: [
        'split the current shoulder latitude window into an equatorial-edge lane and an inner-shoulder lane in vertical5.js',
        'publish new fresh-state diagnostics for the equatorial-edge and inner-shoulder windows through state5.js and diagnostics.js',
        'replace the single shoulder band-window support in microphysics5.js with split-lane support',
        'apply an edge-only candidate-entry penalty or higher support threshold that scales with weak fresh subtropical suppression / weak fresh subtropical band support',
        'avoid increasing total buffered removal first; reduce raw candidate/event generation at 3–6°N instead'
      ]
    },
    recommendation: 'Do not tune amplitude first. Implement a split-lane candidate gate so the equatorial edge must earn admission with stronger fresh subtropical support than the inner shoulder.'
  };
}

export function renderPhase1ZIReport(summary) {
  const keepLines = (summary.designContract?.keep || []).map((item) => `- ${item}`).join('\n');
  const changeLines = (summary.designContract?.change || []).map((item) => `- ${item}`).join('\n');

  return `# Phase 1ZI Equatorial-Edge Candidate Gate Design

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why The Current Gate Is Wrong

- Phase 1ZB still admitted both the 3.75°N edge and 11.25°N inner shoulder through the same shoulder lane.
- Phase 1ZG improved the climate guardrails overall, but 3.75°N still rebounded:
  - candidate delta: \`${round(summary.evidence.phase1zg.edgeCandidateDeltaKgM2)}\`
  - event-count delta: \`${round(summary.evidence.phase1zg.edgeEventCountDelta)}\`
  - applied suppression delta: \`${round(summary.evidence.phase1zg.edgeAppliedSuppressionDeltaKgM2)}\`
  - condensation delta: \`${round(summary.evidence.phase1zg.edgeCondensationDeltaKgM2)}\`
- The inner shoulder and spillover are already moving the right way:
  - 11.25°N condensation delta: \`${round(summary.evidence.phase1zg.innerCondensationDeltaKgM2)}\`
  - 18.75°N spillover delta: \`${round(summary.evidence.phase1zg.spilloverCondensationDeltaKgM2)}\`
  - 33.75°N target-entry applied suppression: \`${round(summary.evidence.phase1zg.targetEntryAppliedSuppressionKgM2)}\`

## Design Choice

- ${summary.designChoice.label}
- ${summary.designChoice.rationale}

## Preserve

${keepLines}

## Change

${changeLines}
`;
}

function parseArgs(argv) {
  const options = {
    phase1zbPath: defaultPhase1ZBPath,
    phase1zgPath: defaultPhase1ZGPath,
    phase1zhPath: defaultPhase1ZHPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phase1zb' && argv[i + 1]) options.phase1zbPath = argv[++i];
    else if (arg.startsWith('--phase1zb=')) options.phase1zbPath = arg.slice('--phase1zb='.length);
    else if (arg === '--phase1zg' && argv[i + 1]) options.phase1zgPath = argv[++i];
    else if (arg.startsWith('--phase1zg=')) options.phase1zgPath = arg.slice('--phase1zg='.length);
    else if (arg === '--phase1zh' && argv[i + 1]) options.phase1zhPath = argv[++i];
    else if (arg.startsWith('--phase1zh=')) options.phase1zhPath = arg.slice('--phase1zh='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZIEquatorialEdgeCandidateGateDesign({
    phase1zbReportText: readText(options.phase1zbPath),
    phase1zgSummary: readJson(options.phase1zgPath),
    phase1zhSummary: readJson(options.phase1zhPath),
    paths: options
  });
  const report = renderPhase1ZIReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
