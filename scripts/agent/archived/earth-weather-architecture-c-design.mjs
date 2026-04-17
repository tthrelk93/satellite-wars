#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const ARCHIVE_BRANCH = 'codex/world-class-weather-loop-archive-20260407-0745';

const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const defaults = {
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c-design.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c-design.json')
};

const SEAM_DEFS = [
  {
    file: 'src/weather/v2/core5.js',
    label: 'Core circulation defaults',
    targetRole: 'rollback_donor_candidate',
    tokens: [
      'subtropicalSubsidenceCrossHemiFloorFrac',
      'enableCirculationReboundContainment',
      'enableTransitionReturnFlowCoupling',
      'enableDryingOmegaBridge',
      'enableWeakHemiCrossHemiFloorTaper'
    ]
  },
  {
    file: 'src/weather/v2/vertical5.js',
    label: 'Vertical circulation scaffold',
    targetRole: 'rollback_donor_candidate',
    tokens: [
      'subtropicalSubsidenceCrossHemiFloorFrac',
      'enableCirculationReboundContainment',
      'enableTransitionReturnFlowCoupling',
      'enableDryingOmegaBridge',
      'enableWeakHemiCrossHemiFloorTaper'
    ]
  },
  {
    file: 'src/weather/v2/microphysics5.js',
    label: 'Partition-preserving microphysics',
    targetRole: 'current_preserve_candidate',
    tokens: [
      'enableSoftLiveStateMaintenanceSuppression',
      'enableExplicitSubtropicalBalanceContract',
      'enableShoulderAbsorptionGuard',
      'softLiveGateSupport',
      'shoulderGuardSupport'
    ]
  },
  {
    file: 'src/weather/v2/state5.js',
    label: 'State adapter surface',
    targetRole: 'current_adapter_candidate',
    tokens: [
      'SURFACE_MOISTURE_SOURCE_TRACERS',
      'CLOUD_BIRTH_LEVEL_BAND_COUNT'
    ]
  },
  {
    file: 'src/weather/validation/diagnostics.js',
    label: 'Diagnostics adapter surface',
    targetRole: 'current_adapter_candidate',
    tokens: [
      'cloudTransitionLedgerTracing',
      'sourceTracing5',
      'cloudBirthTracing5'
    ]
  },
  {
    file: 'scripts/agent/planetary-realism-audit.mjs',
    label: 'Audit harness adapter surface',
    targetRole: 'current_adapter_candidate',
    tokens: [
      'cloudTransitionLedger',
      'upper-cloud',
      'sourceTracing5',
      'earth-weather-architecture'
    ]
  },
  {
    file: 'src/weather/v2/radiation2d.js',
    label: 'Radiative support review lane',
    targetRole: 'secondary_review_candidate',
    tokens: [
      'upperCloud',
      'cloudyLwCooling',
      'enableFullColumnLW'
    ]
  }
];

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const readCurrentFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const readArchiveFile = (relativePath) => {
  try {
    return execFileSync('git', ['show', `${ARCHIVE_BRANCH}:${relativePath}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    if (typeof error?.stderr === 'string' && error.stderr.includes('exists on disk, but not in')) {
      return null;
    }
    throw error;
  }
};

const getNumstat = (relativePath) => {
  const raw = execFileSync('git', ['diff', '--numstat', `${ARCHIVE_BRANCH}..HEAD`, '--', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  if (!raw) return { added: 0, deleted: 0 };
  const [addedRaw, deletedRaw] = raw.split('\t');
  return {
    added: Number.parseInt(addedRaw, 10) || 0,
    deleted: Number.parseInt(deletedRaw, 10) || 0
  };
};

const countTokenHits = (content, tokens) => tokens.filter((token) => content.includes(token)).length;

export function classifySeam({ targetRole, currentTokenHits, archiveTokenHits }) {
  if (archiveTokenHits == null) {
    if (targetRole === 'current_preserve_candidate') return 'current_preserve_candidate';
    if (targetRole === 'current_adapter_candidate') return 'current_adapter_candidate';
    return 'rollback_donor_candidate';
  }
  if (targetRole === 'rollback_donor_candidate') {
    if (currentTokenHits > 0 && archiveTokenHits === 0) return 'rollback_donor_candidate';
    return 'mixed_review_required';
  }
  if (targetRole === 'current_preserve_candidate') {
    if (currentTokenHits > 0 && archiveTokenHits === 0) return 'current_preserve_candidate';
    return 'mixed_review_required';
  }
  if (targetRole === 'current_adapter_candidate') {
    if (currentTokenHits > 0 && archiveTokenHits === 0) return 'current_adapter_candidate';
    return 'mixed_review_required';
  }
  return 'secondary_review_candidate';
}

export function buildArchitectureCDecision(seams) {
  const donorFiles = seams.filter((seam) => seam.classification === 'rollback_donor_candidate').map((seam) => seam.file);
  const preserveFiles = seams.filter((seam) => seam.classification === 'current_preserve_candidate').map((seam) => seam.file);
  const adapterFiles = seams.filter((seam) => seam.classification === 'current_adapter_candidate').map((seam) => seam.file);
  return {
    verdict: donorFiles.length >= 2 && preserveFiles.length >= 1
      ? 'module_level_hybrid_required'
      : 'hybrid_boundary_unclear',
    donorFiles,
    preserveFiles,
    adapterFiles,
    nextMove: donorFiles.length >= 2 && preserveFiles.length >= 1
      ? 'Architecture C1: hybrid seam contract'
      : 'Architecture C needs more seam analysis before any donor-base benchmark.'
  };
}

export function renderArchitectureCMarkdown({ seams, decision }) {
  const lines = [
    '# Earth Weather Architecture C Design',
    '',
    'This report converts the failed parameter-only Architecture B family into a code-level hybridization plan between the rollback circulation branch and the current partition-preserving branch.',
    '',
    `- Archive donor branch: \`${ARCHIVE_BRANCH}\``,
    `- Verdict: \`${decision.verdict}\``,
    `- Next move: ${decision.nextMove}`,
    '',
    '## Seam findings',
    ''
  ];

  for (const seam of seams) {
    lines.push(`### ${seam.label}`);
    lines.push('');
    lines.push(`- file: [${seam.file}](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/${seam.file})`);
    lines.push(`- target role: \`${seam.targetRole}\``);
    lines.push(`- classification: \`${seam.classification}\``);
    lines.push(`- diff lines: \`+${seam.diff.added} / -${seam.diff.deleted}\``);
    lines.push(`- token hits: current \`${seam.currentTokenHits}/${seam.tokens.length}\`, archive \`${seam.archiveTokenHits}/${seam.tokens.length}\``);
    lines.push('');
  }

  lines.push('## Hybridization split');
  lines.push('');
  lines.push(`- rollback donor files: ${decision.donorFiles.join(', ') || 'none'}`);
  lines.push(`- current preserve files: ${decision.preserveFiles.join(', ') || 'none'}`);
  lines.push(`- current adapter files: ${decision.adapterFiles.join(', ') || 'none'}`);
  lines.push('');
  lines.push('## Design conclusion');
  lines.push('');
  lines.push('- Architecture B proved that parameter-only tuning cannot recover circulation on the current code path.');
  lines.push('- The rollback branch remains the only branch with materially stronger NH circulation and cross-equatorial transport.');
  lines.push('- The current branch remains the only branch with the partition-preserving suppressor/diagnostic stack we need to protect NH dry-belt realism work.');
  lines.push('- So the next responsible move is a module-level donor/preserve/adapter hybrid, not another scalar experiment family.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const seams = SEAM_DEFS.map((seam) => {
    const currentContent = readCurrentFile(seam.file);
    const archiveContent = readArchiveFile(seam.file);
    const currentTokenHits = countTokenHits(currentContent, seam.tokens);
    const archiveTokenHits = archiveContent == null ? null : countTokenHits(archiveContent, seam.tokens);
    const diff = getNumstat(seam.file);
    return {
      ...seam,
      diff,
      currentTokenHits,
      archiveTokenHits,
      classification: classifySeam({
        targetRole: seam.targetRole,
        currentTokenHits,
        archiveTokenHits
      })
    };
  });

  const decision = buildArchitectureCDecision(seams);
  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c-design.v1',
    generatedAt: new Date().toISOString(),
    archiveBranch: ARCHIVE_BRANCH,
    seams,
    decision
  };

  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureCMarkdown({ seams, decision }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
