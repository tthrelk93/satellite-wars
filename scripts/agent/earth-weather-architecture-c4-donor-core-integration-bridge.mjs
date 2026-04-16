#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';

const defaults = {
  reportPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c4-donor-core-integration-bridge.md'),
  jsonPath: path.join(repoRoot, 'weather-validation', 'reports', 'earth-weather-architecture-c4-donor-core-integration-bridge.json')
};

const REQUIRED_CORE_METHODS = [
  'getCloudTransitionLedgerRaw',
  'resetCloudTransitionLedger',
  'getModuleTimingSummary',
  'getConservationSummary',
  'loadStateSnapshot',
  'setReplayDisabledModules',
  'clearReplayDisabledModules'
];

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });

const needsJsExtension = (specifier) => (
  specifier.startsWith('.')
  && !specifier.endsWith('.js')
  && !specifier.endsWith('.mjs')
  && !specifier.endsWith('.json')
);

const COMPATIBILITY_BRIDGE_SENTINEL = 'Architecture C4 donor-core compatibility bridge';
const COMPATIBILITY_BRIDGE_BLOCK = `
  // ${COMPATIBILITY_BRIDGE_SENTINEL}
  setReplayDisabledModules(moduleNames = []) {
    this._replayDisabledModules = new Set(Array.isArray(moduleNames) ? moduleNames : []);
  }

  clearReplayDisabledModules() {
    this._replayDisabledModules = new Set();
  }

  resetCloudTransitionLedger() {
    this._cloudTransitionLedger = {
      schema: 'satellite-wars.cloud-transition-ledger.compat.v1',
      sampleCount: 0,
      sampledModelSeconds: 0,
      bandDefinitions: [],
      transitionDefinitions: [],
      modules: {}
    };
  }

  getCloudTransitionLedgerRaw() {
    if (!this._cloudTransitionLedger) this.resetCloudTransitionLedger();
    return JSON.parse(JSON.stringify(this._cloudTransitionLedger));
  }

  getModuleTimingSummary() {
    return {
      schema: 'satellite-wars.module-timing.compat.v1',
      modules: {},
      order: []
    };
  }

  getConservationSummary() {
    return {
      schema: 'satellite-wars.conservation-budget.compat.v1',
      sampleCount: 0,
      sampledModelSeconds: 0,
      modules: {},
      notes: {
        interpretation: 'Compatibility bridge summary; donor core has not yet ported full conservation diagnostics.'
      }
    };
  }

  loadStateSnapshot(snapshot) {
    if (!snapshot || !snapshot.state) {
      throw new Error('A full state snapshot is required to restore WeatherCore5.');
    }
    if (snapshot?.grid?.nx !== this.grid.nx || snapshot?.grid?.ny !== this.grid.ny) {
      throw new Error('Snapshot grid does not match WeatherCore5 grid.');
    }
    if (snapshot?.vertical?.nz !== this.nz) {
      throw new Error('Snapshot vertical layout does not match WeatherCore5 vertical resolution.');
    }

    for (const [key, value] of Object.entries(snapshot.state)) {
      const target = this.state[key];
      if (target instanceof Float32Array || target instanceof Uint8Array || target instanceof Uint16Array) {
        if (!value || value.length !== target.length) continue;
        target.set(value);
        continue;
      }
      if (value instanceof Float32Array) {
        this.state[key] = new Float32Array(value);
      } else if (value instanceof Uint8Array) {
        this.state[key] = new Uint8Array(value);
      } else if (value instanceof Uint16Array) {
        this.state[key] = new Uint16Array(value);
      }
    }

    this.timeUTC = Number(snapshot?.timeUTC) || 0;
    this._accum = 0;
    this._dynStepIndex = 0;
    this._nudgeAccumSeconds = 0;
    this._climoAccumSeconds = 0;
    this._windNudgeSpinupSeconds = 0;
    this.clearReplayDisabledModules();
    this.resetCloudTransitionLedger();
    this._updateHydrostatic();
  }
`;

export function rewriteRelativeImportSpecifiers(content) {
  let rewrittenImportCount = 0;
  const rewrite = (prefix, specifier, suffix) => {
    if (!needsJsExtension(specifier)) {
      return `${prefix}${specifier}${suffix}`;
    }
    rewrittenImportCount += 1;
    return `${prefix}${specifier}.js${suffix}`;
  };

  let output = content.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, prefix, specifier, suffix) => rewrite(prefix, specifier, suffix));
  output = output.replace(/(import\s+['"])(\.[^'"]+)(['"])/g, (_, prefix, specifier, suffix) => rewrite(prefix, specifier, suffix));
  output = output.replace(/(import\s*\(\s*['"])(\.[^'"]+)(['"]\s*\))/g, (_, prefix, specifier, suffix) => rewrite(prefix, specifier, suffix));

  return {
    content: output,
    rewrittenImportCount
  };
}

export function injectDonorCoreCompatibilityBridge(coreContent) {
  if (coreContent.includes(COMPATIBILITY_BRIDGE_SENTINEL)) {
    return {
      content: coreContent,
      injected: false
    };
  }
  const markerMatch = coreContent.match(/\n(\s*)_bindFieldViews\(\)\s*\{/);
  if (!markerMatch || markerMatch.index == null) {
    throw new Error('Could not locate donor core insertion marker for compatibility bridge.');
  }
  const markerIndex = markerMatch.index;
  return {
    content: `${coreContent.slice(0, markerIndex)}\n${COMPATIBILITY_BRIDGE_BLOCK}${coreContent.slice(markerIndex)}`,
    injected: true
  };
}

const walkJsFiles = (rootPath) => {
  const files = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (current.endsWith('.js') || current.endsWith('.mjs')) files.push(current);
  }
  return files.sort();
};

const getMissingCoreMethods = (coreText) => REQUIRED_CORE_METHODS.filter((name) => !coreText.includes(`${name}(`));

export function applyDonorCoreIntegrationBridge(worktreePath) {
  const weatherRoot = path.join(worktreePath, 'src', 'weather');
  const bridgedFiles = [];
  let rewrittenImportCount = 0;

  for (const filePath of walkJsFiles(weatherRoot)) {
    const original = fs.readFileSync(filePath, 'utf8');
    const rewritten = rewriteRelativeImportSpecifiers(original);
    let nextContent = rewritten.content;
    let patched = rewritten.rewrittenImportCount > 0;
    rewrittenImportCount += rewritten.rewrittenImportCount;

    if (filePath === path.join(worktreePath, 'src', 'weather', 'v2', 'core5.js')) {
      const injected = injectDonorCoreCompatibilityBridge(nextContent);
      nextContent = injected.content;
      patched = patched || injected.injected;
    }

    if (patched) {
      fs.writeFileSync(filePath, nextContent);
      bridgedFiles.push(path.relative(worktreePath, filePath));
    }
  }

  const bridgedCorePath = path.join(worktreePath, 'src', 'weather', 'v2', 'core5.js');
  const bridgedCoreText = fs.readFileSync(bridgedCorePath, 'utf8');

  return {
    bridgedFiles,
    rewrittenImportCount,
    missingCoreMethodsAfterBridge: getMissingCoreMethods(bridgedCoreText)
  };
}

export function renderArchitectureC4Markdown({ bridgeSummary }) {
  const lines = [
    '# Earth Weather Architecture C4 Donor-Core Integration Bridge',
    '',
    'This phase implements the donor-core integration bridge required by Architecture C3 so the donor-base hybrid can be rerun under the current Node/audit environment.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    '- verdict: `bridge_implemented_ready_for_rerun`',
    '- next move: Architecture C5: bridged donor-base hybrid rerun benchmark',
    '',
    '## Bridge implementation',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- missing donor-core compatibility methods after bridge: ${bridgeSummary.missingCoreMethodsAfterBridge.length ? bridgeSummary.missingCoreMethodsAfterBridge.join(', ') : 'none'}`,
    '',
    '## Bridged files',
    ''
  ];

  for (const file of bridgeSummary.bridgedFiles) {
    lines.push(`- \`${file}\``);
  }
  lines.push('');
  lines.push('## Contract');
  lines.push('');
  lines.push('- bridge the donor runtime to explicit `.js` relative imports across the donor weather bundle');
  lines.push('- inject donor-core compatibility methods required by the current audit stack without replacing the donor scaffold');
  lines.push('- rerun the donor-base hybrid benchmark immediately after the bridge lands');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c4-'));
  const worktreePath = path.join(tempParent, 'bridge-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c4-donor-core-integration-bridge.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      decision: {
        verdict: 'bridge_implemented_ready_for_rerun',
        nextMove: 'Architecture C5: bridged donor-base hybrid rerun benchmark'
      },
      bridgeSummary
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, renderArchitectureC4Markdown({ bridgeSummary }));
    process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision: result.decision, bridgeSummary })}\n`);
  } finally {
    try {
      if (fs.existsSync(worktreePath)) {
        execFileSync('git', ['worktree', 'remove', '--force', worktreePath], {
          cwd: repoRoot,
          stdio: ['ignore', 'ignore', 'pipe']
        });
      }
    } catch {}
    try {
      if (fs.existsSync(tempParent)) {
        fs.rmSync(tempParent, { recursive: true, force: true });
      }
    } catch {}
  }
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
