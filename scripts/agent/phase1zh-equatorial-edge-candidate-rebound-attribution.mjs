#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultSummaryPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zg-equatorial-edge-buffered-shoulder-patch.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zh-equatorial-edge-candidate-rebound-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zh-equatorial-edge-candidate-rebound-attribution.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

export function buildPhase1ZHEquatorialEdgeCandidateReboundAttribution({ summary, paths }) {
  const edge = summary?.slices?.equatorialEdge;
  const inner = summary?.slices?.innerShoulder;
  const spillover = summary?.slices?.spillover;
  const targetEntry = summary?.slices?.targetEntry;

  return {
    schema: 'satellite-wars.phase1zh-equatorial-edge-candidate-rebound-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'raw_equatorial_edge_candidate_rebound',
    nextPhase: 'Phase 1ZI: Equatorial-Edge Candidate Gate Design',
    conclusion: 'The remaining shoulder failure is no longer suppressed-mass fate or selector leakage. It is a raw candidate and event-count rebound concentrated at 3.75°N that outruns the stronger buffered application.',
    evidence: {
      equatorialEdge: edge,
      innerShoulder: inner,
      spillover,
      targetEntry
    },
    implications: [
      'The buffered-rainout fate should stay in place.',
      'The target-entry exclusion should stay in place.',
      'The next patch should reduce 3–6°N candidate/event generation rather than simply increasing buffered removal again.',
      'The 11.25°N and 18.75°N improvements should be treated as protected wins.'
    ]
  };
}

export function renderPhase1ZHReport(summary) {
  return `# Phase 1ZH Equatorial-Edge Candidate Rebound Attribution

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.conclusion}

## Evidence

- 3.75°N candidate delta: \`${summary.evidence.equatorialEdge?.deltas?.shoulderAbsorptionGuardCandidateMassKgM2}\`
- 3.75°N applied suppression delta: \`${summary.evidence.equatorialEdge?.deltas?.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`
- 3.75°N event-count delta: \`${summary.evidence.equatorialEdge?.deltas?.shoulderAbsorptionGuardEventCount}\`
- 3.75°N condensation delta: \`${summary.evidence.equatorialEdge?.deltas?.largeScaleCondensationSourceKgM2}\`
- 11.25°N condensation delta: \`${summary.evidence.innerShoulder?.deltas?.largeScaleCondensationSourceKgM2}\`
- 18.75°N spillover delta: \`${summary.evidence.spillover?.deltas?.largeScaleCondensationSourceKgM2}\`
- 33.75°N target-entry applied suppression: \`${summary.evidence.targetEntry?.on?.shoulderAbsorptionGuardAppliedSuppressionKgM2}\`

## Implications

${summary.implications.map((line) => `- ${line}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    summaryPath: defaultSummaryPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--summary' && argv[i + 1]) options.summaryPath = argv[++i];
    else if (arg.startsWith('--summary=')) options.summaryPath = arg.slice('--summary='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZHEquatorialEdgeCandidateReboundAttribution({
    summary: readJson(options.summaryPath),
    paths: options
  });
  const report = renderPhase1ZHReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
