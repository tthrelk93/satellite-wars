#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const defaults = {
  c11Path: path.join(REPORT_DIR, 'earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--c11' && argv[i + 1]) options.c11Path = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const DIFF_TARGETS = [
  'src/weather/v2/core5.js',
  'src/weather/v2/windNudge5.js',
  'src/weather/v2/windEddyNudge5.js',
  'src/weather/v2/nudging5.js',
  'src/weather/v2/dynamics5.js'
];

const CURRENT_PRESERVE_LAYER = [
  'src/weather/v2/windNudge5.js',
  'src/weather/v2/windEddyNudge5.js',
  'src/weather/v2/nudging5.js'
];

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const getDiffExcerpt = (filePath, pattern) => {
  const diff = execFileSync(
    'git',
    ['diff', 'codex/world-class-weather-loop-archive-20260407-0745', '--', filePath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  return diff.split('\n').filter((line) => line.includes(pattern)).slice(0, 6);
};

export function classifyC12Decision({
  offFlux,
  onFlux,
  offEquatorVelocity,
  onEquatorVelocity,
  offWesterlies,
  onWesterlies
}) {
  const fluxPolarityFlipped = Number.isFinite(offFlux) && Number.isFinite(onFlux) && offFlux > 0 && onFlux < 0;
  const lowLevelVelocityFlipped = Number.isFinite(offEquatorVelocity) && Number.isFinite(onEquatorVelocity) && offEquatorVelocity > 0 && onEquatorVelocity < 0;
  const circulationScaffoldStillStrong = Number.isFinite(offWesterlies) && Number.isFinite(onWesterlies) && onWesterlies > offWesterlies;

  if (fluxPolarityFlipped && lowLevelVelocityFlipped && circulationScaffoldStillStrong) {
    return {
      verdict: 'current_low_level_momentum_preserve_layer_required',
      nextMove: 'Architecture C13: equatorial overturning sign contract experiment'
    };
  }
  return {
    verdict: 'equatorial_sign_contract_inconclusive',
    nextMove: 'Architecture C13: broadened hybrid circulation experiment'
  };
}

export function renderArchitectureC12Markdown({
  decision,
  attribution,
  contract
}) {
  const lines = [
    '# Earth Weather Architecture C12 Equatorial Overturning Sign Contract Design',
    '',
    'This phase converts the C11 flux-inversion result into an explicit implementation contract for the next donor/current hybrid experiment.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Attribution basis',
    '',
    `- cross-equatorial vapor flux north: off \`${attribution.offFlux}\`, on \`${attribution.onFlux}\``,
    `- equatorial low-level velocity mean: off \`${attribution.offEquatorVelocity}\`, on \`${attribution.onEquatorVelocity}\``,
    `- NH westerlies: off \`${attribution.offWesterlies}\`, on \`${attribution.onWesterlies}\``,
    `- interpretation: the donor/current hybrid keeps the stronger extratropical circulation scaffold but reverses equatorial overturning sign`,
    '',
    '## Contract',
    '',
    '- Keep donor `core5.js` / `vertical5.js` as the main scaffold.',
    '- Forward-port the current low-level momentum/nudging preserve layer first:',
    ...contract.preserveLayer.map((file) => `  - \`${file}\``),
    '- Patch donor-core default parameters only in the low-level sign-control lane:',
    ...contract.coreParamPorts.map((entry) => `  - \`${entry}\``),
    '- Do not port `dynamics5.js` in the first experiment.',
    '- Judge the experiment only by full-objective quick/annual climate gates, not by local equatorial metrics alone.',
    '',
    '## Evidence from current vs donor scaffold delta',
    '',
    ...contract.evidenceLines.map((line) => `- ${line}`),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const c11 = readJson(options.c11Path);
  const metricSummary = c11.metricSummary || {};
  const interfaceSummary = c11.interfaceSummary || {};

  const attribution = {
    offFlux: round(metricSummary.offCrossEquatorialFlux),
    onFlux: round(metricSummary.onCrossEquatorialFlux),
    offEquatorVelocity: round(interfaceSummary.offEquator?.lowLevelVelocityMeanMs),
    onEquatorVelocity: round(interfaceSummary.onEquator?.lowLevelVelocityMeanMs),
    offWesterlies: round(metricSummary.offWesterlies),
    onWesterlies: round(metricSummary.onWesterlies)
  };

  const decision = classifyC12Decision(attribution);

  const windNudgeDiff = getDiffExcerpt('src/weather/v2/core5.js', 'tauSurfaceSeconds');
  const qvSurfaceDiff = getDiffExcerpt('src/weather/v2/core5.js', 'tauQvS');
  const qvColumnDiff = getDiffExcerpt('src/weather/v2/core5.js', 'tauQvColumn');
  const nudgingReliefDiff = getDiffExcerpt('src/weather/v2/core5.js', 'organizedConvectionQvSurfaceRelief');

  const contract = {
    preserveLayer: CURRENT_PRESERVE_LAYER,
    coreParamPorts: [
      'windNudgeParams.tauSurfaceSeconds: 7 * 86400 -> 8 * 3600',
      'nudgeParams.tauQvS: 30 * 86400 -> 45 * 86400',
      'nudgeParams.tauQvColumn: 12 * 86400 -> 18 * 86400',
      'nudgeParams organized/subsidence relief quartet from current core'
    ],
    evidenceLines: [
      'The hybrid flips equatorial low-level velocity from northward to strongly southward while improving NH westerlies, which points to a low-level sign-control mismatch rather than a generic circulation collapse.',
      `Current-vs-donor core diff exposes the strongest sign-control change in low-level wind nudging: ${windNudgeDiff.join(' | ') || 'not found'}`,
      `Current-vs-donor core diff also changes surface/column moisture nudging timescales: ${qvSurfaceDiff.join(' | ') || 'not found'} | ${qvColumnDiff.join(' | ') || 'not found'}`,
      `Current core adds organized/subsidence relief terms consumed by current nudging modules: ${nudgingReliefDiff.join(' | ') || 'not found'}`
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.v1',
    generatedAt: new Date().toISOString(),
    decision,
    attribution,
    contract,
    diffTargets: DIFF_TARGETS
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC12Markdown({
    decision,
    attribution,
    contract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, contract })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
