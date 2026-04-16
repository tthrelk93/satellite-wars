#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaults = {
  benchmarkPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-phase0-branch-benchmark.json'),
  resetPath: path.join(repoRoot, 'weather-validation', 'reports', 'phase1-reset-system-experiments.json'),
  currentBranch: 'codex/world-class-weather-loop',
  archiveBranch: 'codex/world-class-weather-loop-archive-20260407-0745',
  reportPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-a-design.md'),
  jsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-a-design.json')
};

const trackedFiles = [
  'src/weather/v2/core5.js',
  'src/weather/v2/vertical5.js',
  'src/weather/v2/microphysics5.js',
  'src/weather/v2/radiation2d.js',
  'src/weather/v2/state5.js',
  'src/weather/validation/diagnostics.js',
  'scripts/agent/planetary-realism-audit.mjs'
];

const args = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--benchmark' && args[i + 1]) options.benchmarkPath = path.resolve(args[++i]);
  else if (arg === '--reset' && args[i + 1]) options.resetPath = path.resolve(args[++i]);
  else if (arg === '--current-branch' && args[i + 1]) options.currentBranch = args[++i];
  else if (arg === '--archive-branch' && args[i + 1]) options.archiveBranch = args[++i];
  else if (arg === '--report' && args[i + 1]) options.reportPath = path.resolve(args[++i]);
  else if (arg === '--json' && args[i + 1]) options.jsonPath = path.resolve(args[++i]);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

export function parseNumstat(raw) {
  return raw
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [addedRaw, deletedRaw, file] = line.split('\t');
      const added = Number.parseInt(addedRaw, 10);
      const deleted = Number.parseInt(deletedRaw, 10);
      return {
        file,
        added: Number.isFinite(added) ? added : 0,
        deleted: Number.isFinite(deleted) ? deleted : 0,
        churn: (Number.isFinite(added) ? added : 0) + (Number.isFinite(deleted) ? deleted : 0)
      };
    })
    .sort((a, b) => b.churn - a.churn);
}

export function buildArchitectureADesign({ benchmark, reset, diffEntries }) {
  const currentBetter = [];
  const archiveBetter = [];
  for (const row of benchmark.annualComparisons || []) {
    if (!row.comparable) continue;
    if (row.winner === 'current') currentBetter.push(row.key);
    if (row.winner === 'candidate') archiveBetter.push(row.key);
  }

  const currentStrengths = currentBetter.map((key) => ({
    key,
    label: (benchmark.annualComparisons || []).find((row) => row.key === key)?.label || key
  }));
  const archiveStrengths = archiveBetter.map((key) => ({
    key,
    label: (benchmark.annualComparisons || []).find((row) => row.key === key)?.label || key
  }));

  const primaryPhysicsFiles = diffEntries
    .filter((entry) => entry.file.startsWith('src/weather/v2/') || entry.file.startsWith('src/weather/validation/'))
    .slice(0, 5);

  const preferredLane = {
    verdict: 'integrated_partition_circulation_split_required',
    summary: 'The current branch is stronger on NH dry-belt partitioning while the rollback archive is stronger on circulation. The next architecture must preserve partition gains without continuing to damp circulation.',
    preserveFromCurrent: currentStrengths,
    recoverFromArchive: archiveStrengths,
    ruledOutByReset: (reset.experiments || [])
      .filter((entry) => entry.combinedScore <= 0)
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        combinedScore: entry.combinedScore
      })),
    codeOwnershipRank: primaryPhysicsFiles,
    primaryImplementationFiles: [
      'src/weather/v2/vertical5.js',
      'src/weather/v2/core5.js',
      'src/weather/v2/microphysics5.js',
      'src/weather/v2/state5.js',
      'src/weather/validation/diagnostics.js',
      'scripts/agent/planetary-realism-audit.mjs'
    ],
    designContract: [
      'Keep the current branch dry-belt partition gains as the protected side of the redesign.',
      'Recover rollback-like NH jet and cross-equatorial circulation behavior without restoring the rollback NH dry-belt wet bias.',
      'Replace stacked local suppressor families with one explicit subtropical partition/circulation contract shared between vertical and microphysics.',
      'Promote only annualized integrated experiments; do not resume local residual patching.'
    ],
    boundedExperimentFamilies: [
      {
        key: 'A1-explicit-subtropical-balance-contract',
        label: 'Explicit subtropical balance contract',
        description: 'Create a single vertical-state circulation/partition contract in vertical5, then let microphysics consume it instead of re-deriving many local gates.'
      },
      {
        key: 'A2-circulation-preserving-partition-port',
        label: 'Circulation-preserving partition port',
        description: 'Port only the current branch partition improvements that still make sense under rollback-like circulation support, instead of carrying all current-branch circulation dampers forward.'
      }
    ],
    nextImplementationPhase: 'Architecture A1: implement explicit subtropical balance contract experiment'
  };

  return preferredLane;
}

export function renderArchitectureAMarkdown({ benchmark, reset, diffEntries, design }) {
  const renderMetricRows = (rows) => rows.map((row) => `- ${row.label}: current \`${row.current}\`, rollback \`${row.candidate}\`, winner \`${row.winner || 'n/a'}\``).join('\n');
  const renderStrengths = (rows) => rows.length
    ? rows.map((row) => `- ${row.label}`).join('\n')
    : '- none';
  const renderDiffs = (rows) => rows.map((row) => `- \`${row.file}\`: churn ${row.churn} (${row.added} added / ${row.deleted} deleted)`).join('\n');

  return `# Earth Weather Architecture A Design

## Objective

Turn the failed Phase 0 branch split into one integrated redesign family instead of more local patch phases.

## Inputs

- [earth-weather-phase0-branch-benchmark.json](${options.benchmarkPath})
- [phase1-reset-system-experiments.json](${options.resetPath})

## Phase 0 split we must resolve

The branch benchmark says:

${renderMetricRows((benchmark.annualComparisons || []).filter((row) => row.comparable))}

So the live split is:

### Preserve from current branch

${renderStrengths(design.preserveFromCurrent)}

### Recover from rollback archive

${renderStrengths(design.recoverFromArchive)}

## Why a broader architecture change is justified

The reset R2 experiment family had no annual winner:
- decision: \`${reset.decision?.verdict || 'unknown'}\`
- next move: ${reset.decision?.nextMove || 'unknown'}

That means the problem is no longer "find the next better local patch." It is "separate the partition gains from the circulation losses."

## Code ownership evidence

The dominant code churn between the rollback archive and the current branch is concentrated in the shared physics/diagnostics stack:

${renderDiffs(diffEntries.slice(0, 7))}

The physics-heavy files at the center of this split are:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

## Architecture A verdict

- verdict: \`${design.verdict}\`
- summary: ${design.summary}

## Design contract

${design.designContract.map((line) => `- ${line}`).join('\n')}

## Preferred bounded experiment families

${design.boundedExperimentFamilies.map((family) => `### ${family.label}\n- key: \`${family.key}\`\n- ${family.description}`).join('\n\n')}

## Next active phase

- ${design.nextImplementationPhase}
`;
}

function main() {
  const benchmark = readJson(options.benchmarkPath);
  const reset = readJson(options.resetPath);
  const rawDiff = execSync(
    `git diff --numstat ${options.archiveBranch}..${options.currentBranch} -- ${trackedFiles.join(' ')}`,
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const diffEntries = parseNumstat(rawDiff);
  const design = buildArchitectureADesign({ benchmark, reset, diffEntries });
  const markdown = renderArchitectureAMarkdown({ benchmark, reset, diffEntries, design });
  const json = {
    schema: 'satellite-wars.earth-weather-architecture-a-design.v1',
    generatedAt: new Date().toISOString(),
    benchmarkPath: options.benchmarkPath,
    resetPath: options.resetPath,
    archiveBranch: options.archiveBranch,
    currentBranch: options.currentBranch,
    diffEntries,
    design
  };

  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, `${markdown}\n`);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(options.reportPath);
  console.log(options.jsonPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
