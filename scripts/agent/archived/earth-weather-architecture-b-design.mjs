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
  architectureA2Path: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-a2-partition-port.json'),
  currentBranch: 'codex/world-class-weather-loop',
  archiveBranch: 'codex/world-class-weather-loop-archive-20260407-0745',
  reportPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-b-design.md'),
  jsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-b-design.json')
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
  else if (arg === '--architecture-a2' && args[i + 1]) options.architectureA2Path = path.resolve(args[++i]);
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

export function buildArchitectureBDesign({ benchmark, architectureA2, diffEntries }) {
  const currentStrengths = (benchmark.annualComparisons || [])
    .filter((row) => row.comparable && row.winner === 'current')
    .map((row) => ({ key: row.key, label: row.label }));
  const archiveStrengths = (benchmark.annualComparisons || [])
    .filter((row) => row.comparable && row.winner === 'candidate')
    .map((row) => ({ key: row.key, label: row.label }));

  const selectedMode = architectureA2.selectedMode;
  const selectedCandidate = (architectureA2.quick?.candidates || []).find((candidate) => candidate.mode === selectedMode) || null;
  const circulationMisses = (selectedCandidate?.rows || [])
    .filter((row) => ['subtropicalDrySouthRatio', 'midlatitudeWesterliesNorthU10Ms', 'crossEquatorialVaporFluxNorthKgM_1S'].includes(row.key))
    .map((row) => ({
      key: row.key,
      label: row.label,
      off: row.off,
      on: row.on,
      improved: row.improved
    }));

  return {
    verdict: 'circulation_scaffold_rebuild_required',
    summary: 'Architecture A proved that selective relaxation of current-branch dampers can preserve some partition gains, but it cannot recover the circulation scaffold. The next architecture must rebuild circulation first and only then re-port partition behavior.',
    preserveFromCurrent: currentStrengths,
    recoverFromArchive: archiveStrengths,
    failedArchitectureA2Mode: selectedMode,
    failedCirculationRecoveries: circulationMisses,
    codeOwnershipRank: diffEntries
      .filter((entry) => entry.file.startsWith('src/weather/v2/') || entry.file.startsWith('src/weather/validation/'))
      .slice(0, 5),
    primaryImplementationFiles: [
      'src/weather/v2/vertical5.js',
      'src/weather/v2/core5.js',
      'src/weather/v2/microphysics5.js',
      'src/weather/v2/state5.js',
      'src/weather/validation/diagnostics.js',
      'scripts/agent/planetary-realism-audit.mjs'
    ],
    designContract: [
      'Rebuild the subtropical circulation scaffold before attempting another partition-port.',
      'Treat the vertical subtropical drying scaffold as the primary Architecture B lever, not the microphysics suppressor families.',
      'Keep the current branch partition microphysics available as a protected layer, but do not let it dictate the circulation scaffold.',
      'Promote only bounded scaffold experiments that are judged by the full six-metric climate objective.'
    ],
    boundedExperimentFamilies: [
      {
        key: 'B1-circulation-scaffold-rebuild',
        label: 'Circulation scaffold rebuild',
        description: 'Rebuild the subtropical vertical scaffold by resetting the floor/boost dependence and attenuating the drying/theta application before re-porting partition behavior.'
      },
      {
        key: 'B2-partition-report-on-rebuilt-scaffold',
        label: 'Partition re-port on rebuilt scaffold',
        description: 'Once a circulation-first scaffold clears the quick gate, re-port only the current branch partition layers that still preserve the recovered circulation metrics.'
      }
    ],
    nextImplementationPhase: 'Architecture B1: implement circulation scaffold rebuild experiment'
  };
}

export function renderArchitectureBMarkdown({ benchmark, architectureA2, diffEntries, design }) {
  const renderMetricRows = (rows) => rows.map((row) => `- ${row.label}: current \`${row.current}\`, rollback \`${row.candidate}\`, winner \`${row.winner || 'n/a'}\``).join('\n');
  const renderStrengths = (rows) => rows.length ? rows.map((row) => `- ${row.label}`).join('\n') : '- none';
  const renderDiffs = (rows) => rows.map((row) => `- \`${row.file}\`: churn ${row.churn} (${row.added} added / ${row.deleted} deleted)`).join('\n');
  const renderMisses = (rows) => rows.length
    ? rows.map((row) => `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\``).join('\n')
    : '- none';

  return `# Earth Weather Architecture B Design

## Objective

Turn the failed Architecture A partition-port family into a circulation-first rebuild family.

## Inputs

- [earth-weather-phase0-branch-benchmark.json](${options.benchmarkPath})
- [earth-weather-architecture-a2-partition-port.json](${options.architectureA2Path})

## Phase 0 split we still must resolve

${renderMetricRows((benchmark.annualComparisons || []).filter((row) => row.comparable))}

### Preserve from current branch

${renderStrengths(design.preserveFromCurrent)}

### Recover from rollback archive

${renderStrengths(design.recoverFromArchive)}

## Why Architecture A was not enough

Architecture A2 selected \`${design.failedArchitectureA2Mode}\` as its best bounded candidate, but it still failed to recover the circulation side:

${renderMisses(design.failedCirculationRecoveries)}

That means the next family cannot just relax current dampers. It has to rebuild the circulation scaffold itself.

## Code ownership evidence

${renderDiffs(diffEntries.slice(0, 7))}

The physics-heavy files that still own this failure are:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

## Architecture B verdict

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
  const architectureA2 = readJson(options.architectureA2Path);
  const rawDiff = execSync(
    `git diff --numstat ${options.archiveBranch}..${options.currentBranch} -- ${trackedFiles.join(' ')}`,
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const diffEntries = parseNumstat(rawDiff);
  const design = buildArchitectureBDesign({ benchmark, architectureA2, diffEntries });
  const markdown = renderArchitectureBMarkdown({ benchmark, architectureA2, diffEntries, design });
  const json = {
    schema: 'satellite-wars.earth-weather-architecture-b-design.v1',
    generatedAt: new Date().toISOString(),
    benchmarkPath: options.benchmarkPath,
    architectureA2Path: options.architectureA2Path,
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
