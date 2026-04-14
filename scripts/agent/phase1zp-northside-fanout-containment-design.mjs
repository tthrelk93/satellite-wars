#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultPhase1ZOPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zo-bilateral-edge-outcome-attribution.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zp-northside-fanout-containment-design.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zp-northside-fanout-containment-design.json');

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

export function buildPhase1ZPNorthsideFanoutContainmentDesign({ phase1zoSummary, paths }) {
  const northEdgeDelta = Number(phase1zoSummary?.slices?.northEdge?.delta?.largeScaleCondensationSourceKgM2) || 0;
  const northSpilloverDelta = Number(phase1zoSummary?.slices?.northSpillover?.delta?.largeScaleCondensationSourceKgM2) || 0;
  const northCoreDelta = Number(phase1zoSummary?.slices?.northDryBeltCore?.delta?.largeScaleCondensationSourceKgM2) || 0;
  const northSourceDelta = Number(phase1zoSummary?.slices?.northSource?.delta?.largeScaleCondensationSourceKgM2) || 0;
  const southEdgeDelta = Number(phase1zoSummary?.slices?.southEdge?.delta?.largeScaleCondensationSourceKgM2) || 0;
  const humidificationScore = Number(phase1zoSummary?.scores?.humidificationScore) || 0;
  const northFanoutScore = Number(phase1zoSummary?.scores?.northFanoutScore) || 0;

  const candidateRanking = [
    {
      key: 'northside_source_leak_penalty',
      score: round(
        0.45 * clamp01(northFanoutScore / 1.2)
          + 0.25 * clamp01(Math.max(0, -northSourceDelta) / 0.006)
          + 0.2 * clamp01(Math.max(0, northSpilloverDelta) / 0.01)
          + 0.1 * clamp01(Math.max(0, northCoreDelta) / 0.01)
      ),
      why: 'Best matches the live signature: the 11.25°N source improves while 3.75°N, 18.75°N, and 26.25°N all brighten on the same hemisphere.'
    },
    {
      key: 'north_target_only_cap',
      score: round(
        0.35 * clamp01(Math.max(0, northEdgeDelta) / 0.01)
          + 0.15 * clamp01(Math.max(0, southEdgeDelta * -1) / 0.001)
          - 0.3 * clamp01(Math.max(0, northSpilloverDelta) / 0.01)
          - 0.2 * clamp01(Math.max(0, northCoreDelta) / 0.01)
      ),
      why: 'Would only address 3.75°N directly and leaves the 18.75°N / 26.25°N fanout lane unexplained.'
    },
    {
      key: 'global_guard_amplitude_reduction',
      score: round(
        0.25 * clamp01(Math.max(0, northEdgeDelta) / 0.01)
          + 0.15 * clamp01(Math.max(0, northSpilloverDelta) / 0.01)
          - 0.35 * clamp01(Math.max(0, -southEdgeDelta) / 0.0005)
          - 0.25 * clamp01(northFanoutScore / 1.2)
      ),
      why: 'Would likely undo the south-edge stabilization and bilateral activation that Phase 1ZN finally achieved.'
    },
    {
      key: 'humidification_sink',
      score: round(
        0.2 * clamp01(humidificationScore / 0.25)
          - 0.4 * clamp01((0.2 - humidificationScore) / 0.2)
          + 0.1 * clamp01(Math.max(0, northEdgeDelta) / 0.01)
      ),
      why: 'Poor fit because TCW and RH stay nearly flat while condensation fans out northward.'
    }
  ].sort((a, b) => (b.score || 0) - (a.score || 0));

  const best = candidateRanking[0];

  return {
    schema: 'satellite-wars.phase1zp-northside-fanout-containment-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'northside_source_leak_penalty_preferred',
    nextPhase: 'Phase 1ZQ: Implement Capped Northside Fanout Leak Penalty Patch',
    recommendation: 'Keep the bilateral abs-lat geometry from Phase 1ZN, but add a capped northside source-leak penalty in the vertical lane so improved 11.25°N source drying does not fan out into 3.75°N, 18.75°N, and 26.25°N.',
    phase1zoContext: {
      verdict: phase1zoSummary?.verdict ?? null,
      northFanoutScore,
      humidificationScore
    },
    ranking: candidateRanking,
    designContract: {
      keep: [
        'keep the bilateral abs-lat equatorial-edge source and target geometry',
        'keep the south-edge stabilization at -3.75°',
        'keep the NH 30-45° target-entry exclusion untouched'
      ],
      change: [
        'add a capped northside source-leak penalty around the 11.25°N source lane',
        'gate that penalty against fanout risk into 18.75°N and 26.25°N rather than simply shrinking all guard amplitude',
        'keep the patch in vertical5.js / core5.js, not in the shoulder-selector microphysics lane'
      ],
      doNotDo: [
        'do not reduce global equatorial-edge guard amplitude first',
        'do not re-open the shoulder-selector geometry work',
        'do not treat this as a humidification recharge patch'
      ]
    }
  };
}

export function renderPhase1ZPReport(summary) {
  return `# Phase 1ZP Northside Fanout Containment Design

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Candidate Ranking

${summary.ranking.map((item) => `- ${item.key}: \`${item.score}\` — ${item.why}`).join('\n')}

## Why The Preferred Lane Fits Best

- north fanout score: \`${summary.phase1zoContext.northFanoutScore}\`
- humidification score: \`${summary.phase1zoContext.humidificationScore}\`
- prior verdict: \`${summary.phase1zoContext.verdict}\`

## Next Patch Contract

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
${summary.designContract.doNotDo.map((item) => `- do not: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    phase1zoPath: defaultPhase1ZOPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phase1zo' && argv[i + 1]) options.phase1zoPath = argv[++i];
    else if (arg.startsWith('--phase1zo=')) options.phase1zoPath = arg.slice('--phase1zo='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZPNorthsideFanoutContainmentDesign({
    phase1zoSummary: readJson(options.phase1zoPath),
    paths: options
  });
  const report = renderPhase1ZPReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
