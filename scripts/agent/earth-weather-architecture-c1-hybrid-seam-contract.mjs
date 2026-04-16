#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaults = {
  designJsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c-design.json'),
  reportPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c1-hybrid-seam-contract.md'),
  jsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c1-hybrid-seam-contract.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--design' && argv[i + 1]) options.designJsonPath = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

export function buildHybridContract(design) {
  const donorFiles = design.decision.donorFiles;
  const preserveFiles = design.decision.preserveFiles;
  const adapterFiles = design.decision.adapterFiles;

  return {
    verdict: donorFiles.length >= 2 && preserveFiles.length >= 1
      ? 'rollback_vertical_core_current_partition_adapter_contract'
      : 'contract_not_ready',
    donorBaseBranch: design.archiveBranch,
    donorFiles,
    preserveFiles,
    adapterFiles,
    excludedCurrentFiles: donorFiles,
    implementationOrder: [
      'Create a donor worktree from the rollback archive branch.',
      'Keep rollback donor files as the initial circulation scaffold.',
      'Forward-port current partition-preserving files onto the donor base.',
      'Forward-port current adapter/audit files needed to run the modern scorecard.',
      'Run a bounded hybrid benchmark before any new parameter tuning.'
    ],
    nextMove: donorFiles.length >= 2 && preserveFiles.length >= 1
      ? 'Architecture C2: donor-base hybrid worktree benchmark'
      : 'Architecture C1 must be rerun after clarifying donor/preserve boundaries.'
  };
}

export function renderArchitectureC1Markdown({ design, contract }) {
  const lines = [
    '# Earth Weather Architecture C1 Hybrid Seam Contract',
    '',
    'This report turns the Architecture C donor/preserve/adapter decision into the concrete splice contract for the first donor-base hybrid benchmark.',
    '',
    `- archive donor branch: \`${design.archiveBranch}\``,
    `- verdict: \`${contract.verdict}\``,
    `- next move: ${contract.nextMove}`,
    '',
    '## Donor bundle',
    ''
  ];

  for (const file of contract.donorFiles) {
    lines.push(`- [${file}](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/${file})`);
  }

  lines.push('');
  lines.push('## Preserve bundle');
  lines.push('');
  for (const file of contract.preserveFiles) {
    lines.push(`- [${file}](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/${file})`);
  }

  lines.push('');
  lines.push('## Adapter bundle');
  lines.push('');
  for (const file of contract.adapterFiles) {
    lines.push(`- [${file}](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/${file})`);
  }

  lines.push('');
  lines.push('## Excluded current donor overrides');
  lines.push('');
  for (const file of contract.excludedCurrentFiles) {
    lines.push(`- do not start from current [${file}](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/${file}) for the first hybrid benchmark`);
  }

  lines.push('');
  lines.push('## Implementation order');
  lines.push('');
  for (const step of contract.implementationOrder) {
    lines.push(`- ${step}`);
  }

  lines.push('');
  lines.push('## Contract conclusion');
  lines.push('');
  lines.push('- The first Architecture C benchmark should be donor-base-first, not current-branch-first.');
  lines.push('- The circulation scaffold must come from rollback donor files.');
  lines.push('- The partition-protecting microphysics and the modern audit stack should be ported forward onto that donor base.');
  lines.push('- No parameter-only retuning should happen before the donor-base hybrid benchmark is measured.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const design = readJson(options.designJsonPath);
  const contract = buildHybridContract(design);
  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c1-hybrid-seam-contract.v1',
    generatedAt: new Date().toISOString(),
    designJsonPath: options.designJsonPath,
    contract
  };

  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC1Markdown({ design, contract }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, contract })}\n`);
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
