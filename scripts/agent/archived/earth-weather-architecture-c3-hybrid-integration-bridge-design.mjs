#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';

const defaults = {
  c2JsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c2-donor-base-hybrid-benchmark.json'),
  reportPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c3-hybrid-integration-bridge-design.md'),
  jsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c3-hybrid-integration-bridge-design.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--c2' && argv[i + 1]) options.c2JsonPath = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const readArchiveFile = (relativePath) => execFileSync('git', ['show', `${archiveBranch}:${relativePath}`], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

export function collectExtensionlessImports(content) {
  const matches = [];
  const regex = /from\s+['"](\.[^'"]+)['"]/g;
  for (const match of content.matchAll(regex)) {
    const specifier = match[1];
    if (!specifier.endsWith('.js') && !specifier.endsWith('.json') && !specifier.endsWith('.mjs')) {
      matches.push(specifier);
    }
  }
  return [...new Set(matches)];
}

export function buildArchitectureC3Decision({ c2Result, extensionlessImports }) {
  const missingCoreMethods = c2Result.missingCoreMethods || [];
  const missingDependency = c2Result.decision?.verdict === 'integration_blocked_missing_dependency';
  const missingCoreApi = missingCoreMethods.length > 0 || c2Result.decision?.verdict === 'integration_blocked_missing_core_api';
  return {
    verdict: missingDependency && missingCoreApi
      ? 'esm_and_core_api_bridge_required'
      : missingDependency
        ? 'esm_bridge_required'
        : missingCoreApi
          ? 'core_api_bridge_required'
          : 'hybrid_bridge_not_required',
    extensionlessImports,
    missingCoreMethods,
    nextMove: (missingDependency || missingCoreApi)
      ? 'Architecture C4: donor-core integration bridge implementation'
      : 'Architecture C4 is not required before the next hybrid benchmark.'
  };
}

export function renderArchitectureC3Markdown({ c2Result, decision }) {
  const lines = [
    '# Earth Weather Architecture C3 Hybrid Integration Bridge Design',
    '',
    'This report turns the failed donor-base hybrid benchmark into the minimal bridge contract required before the first runnable hybrid climate benchmark.',
    '',
    `- C2 verdict: \`${c2Result.decision?.verdict}\``,
    `- C3 verdict: \`${decision.verdict}\``,
    `- Next move: ${decision.nextMove}`,
    '',
    '## Immediate blockers',
    '',
    `- extensionless donor-core imports: ${decision.extensionlessImports.length ? decision.extensionlessImports.join(', ') : 'none'}`,
    `- missing donor-core compatibility methods: ${decision.missingCoreMethods.length ? decision.missingCoreMethods.join(', ') : 'none'}`,
    '',
    '## Bridge contract',
    '',
    '- patch the rollback donor [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) to use explicit ESM import specifiers before retrying the hybrid worktree',
    '- add compatibility methods on the donor core for the current audit stack rather than immediately replacing the donor scaffold with the current core',
    '- keep the donor-base-first contract from C1 intact: rollback core/vertical donor scaffold, current microphysics preserve layer, current adapter stack',
    '- rerun Architecture C2 immediately after the donor-core bridge is implemented, before any new climate tuning',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c2Result = readJson(options.c2JsonPath);
  const donorCore = readArchiveFile('src/weather/v2/core5.js');
  const extensionlessImports = collectExtensionlessImports(donorCore);
  const decision = buildArchitectureC3Decision({ c2Result, extensionlessImports });
  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c3-hybrid-integration-bridge-design.v1',
    generatedAt: new Date().toISOString(),
    c2JsonPath: options.c2JsonPath,
    archiveBranch,
    decision
  };

  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC3Markdown({ c2Result, decision }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision })}\n`);
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
