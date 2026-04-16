#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { summarizeInterface } from './earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');

const defaults = {
  c10Path: path.join(REPORT_DIR, 'earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.json'),
  c13Path: path.join(REPORT_DIR, 'earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.json'),
  c10TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c10-bridged-hybrid-quick-transport-interface-budget.json'),
  c13TransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c13-sign-contract-quick-transport-interface-budget.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c14-sign-contract-implementation-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c14-sign-contract-implementation-attribution.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--c10' && argv[i + 1]) options.c10Path = path.resolve(argv[++i]);
  else if (arg === '--c13' && argv[i + 1]) options.c13Path = path.resolve(argv[++i]);
  else if (arg === '--c10-transport' && argv[i + 1]) options.c10TransportPath = path.resolve(argv[++i]);
  else if (arg === '--c13-transport' && argv[i + 1]) options.c13TransportPath = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const readArchiveFile = (relativePath) => execFileSync('git', ['show', `${archiveBranch}:${relativePath}`], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

const fileContainsAtRef = (relativePath, needle) => readArchiveFile(relativePath).includes(needle);
const fileContainsHead = (relativePath, needle) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8').includes(needle);

const runDiffQuiet = (relativePath) => {
  try {
    execFileSync('git', ['diff', '--quiet', archiveBranch, '--', relativePath], {
      cwd: repoRoot,
      stdio: 'ignore'
    });
    return false;
  } catch (error) {
    return error?.status === 1;
  }
};

export function classifyC14Decision({
  c10CrossEq,
  c13CrossEq,
  c10Zonal,
  c13Zonal,
  c10Eddy,
  c13Eddy,
  currentVerticalHasContract,
  archiveVerticalHasContract,
  dynamicsChanged
}) {
  const totalImproved = Number.isFinite(c10CrossEq) && Number.isFinite(c13CrossEq) && c13CrossEq > c10CrossEq;
  const eddyImproved = Number.isFinite(c10Eddy) && Number.isFinite(c13Eddy) && c13Eddy > c10Eddy;
  const zonalWorsened = Number.isFinite(c10Zonal) && Number.isFinite(c13Zonal) && c13Zonal < c10Zonal;

  if (totalImproved && eddyImproved && zonalWorsened && currentVerticalHasContract && !archiveVerticalHasContract && !dynamicsChanged) {
    return {
      verdict: 'zonal_mean_equatorial_reversal_still_vertical_scaffold_controlled',
      nextMove: 'Architecture C15: equatorial vertical-state contract experiment'
    };
  }
  return {
    verdict: 'sign_contract_implementation_attribution_inconclusive',
    nextMove: 'Architecture C15: broadened vertical implementation experiment'
  };
}

export function renderArchitectureC14Markdown({
  decision,
  comparison,
  contract
}) {
  const lines = [
    '# Earth Weather Architecture C14 Sign Contract Implementation Attribution',
    '',
    'This phase attributes what is still wrong after the C13 sign-contract experiment. The goal is to distinguish whether the remaining equatorial polarity defect lives in the preserved current low-level nudging layer or in the donor-controlled vertical overturning scaffold.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## C10 vs C13 equatorial comparison',
    '',
    `- total cross-equatorial vapor flux north: C10 \`${comparison.c10CrossEq}\`, C13 \`${comparison.c13CrossEq}\``,
    `- equatorial low-level velocity mean: C10 \`${comparison.c10Velocity}\`, C13 \`${comparison.c13Velocity}\``,
    `- equatorial low-level zonal-mean vapor flux north: C10 \`${comparison.c10Zonal}\`, C13 \`${comparison.c13Zonal}\``,
    `- equatorial low-level eddy vapor flux north: C10 \`${comparison.c10Eddy}\`, C13 \`${comparison.c13Eddy}\``,
    '',
    '## Attribution',
    '',
    '- C13 improved the eddy-side failure relative to C10, but the zonal-mean equatorial branch stayed strongly southward and became more negative.',
    '- That pattern means the current low-level nudging preserve layer is not the dominant remaining blocker.',
    '- The stronger evidence now points at the donor-controlled vertical overturning scaffold: the part that sets the zonal-mean equatorial branch before eddy corrections can rescue it.',
    '',
    '## Contract for the next experiment',
    '',
    '- Keep the donor-base hybrid and the current low-level preserve layer from C13.',
    '- Add [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) from current as the bounded implementation lane.',
    '- Patch donor `core5.js` only where current vertical-state defaults must be made explicit:',
    ...contract.coreParamPorts.map((entry) => `  - \`${entry}\``),
    '',
    '## Evidence',
    '',
    ...contract.evidenceLines.map((line) => `- ${line}`),
    ''
  ];
  return `${lines.join('\n')}\n`;
}

function main() {
  const c10 = readJson(options.c10Path);
  const c13 = readJson(options.c13Path);
  const c10Transport = readJson(options.c10TransportPath);
  const c13Transport = readJson(options.c13TransportPath);

  const c10Equator = summarizeInterface(c10Transport, 0);
  const c13Equator = summarizeInterface(c13Transport, 0);

  const currentVerticalHasContract = fileContainsHead('src/weather/v2/vertical5.js', 'subtropicalSubsidenceCrossHemiFloorFrac');
  const archiveVerticalHasContract = fileContainsAtRef('src/weather/v2/vertical5.js', 'subtropicalSubsidenceCrossHemiFloorFrac');
  const dynamicsChanged = runDiffQuiet('src/weather/v2/dynamics5.js');

  const comparison = {
    c10CrossEq: round(c10.quickRows?.find((row) => row.key === 'crossEquatorialVaporFluxNorthKgM_1S')?.on),
    c13CrossEq: round(c13.quickRows?.find((row) => row.key === 'crossEquatorialVaporFluxNorthKgM_1S')?.on),
    c10Velocity: round(c10Equator?.lowLevelVelocityMeanMs),
    c13Velocity: round(c13Equator?.lowLevelVelocityMeanMs),
    c10Zonal: round(c10Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c13Zonal: round(c13Equator?.vaporFluxZonalMeanComponentKgM_1S),
    c10Eddy: round(c10Equator?.vaporFluxEddyComponentKgM_1S),
    c13Eddy: round(c13Equator?.vaporFluxEddyComponentKgM_1S)
  };

  const decision = classifyC14Decision({
    ...comparison,
    currentVerticalHasContract,
    archiveVerticalHasContract,
    dynamicsChanged
  });

  const contract = {
    overlayFiles: [
      'src/weather/v2/vertical5.js',
      'src/weather/v2/windNudge5.js',
      'src/weather/v2/windEddyNudge5.js',
      'src/weather/v2/nudging5.js'
    ],
    coreParamPorts: [
      'vertParams.rhTrig: 0.75 -> 0.72',
      'vertParams.rhMidMin: 0.25 -> 0.22',
      'vertParams.omegaTrig: 0.3 -> 0.2',
      'vertParams.instabTrig: 3 -> 2.5',
      'vertParams.qvTrig: 0.002 -> 0.0018',
      'vertParams.thetaeCoeff: 10 -> 10.5',
      'vertParams convective potential/organization timing block from current vertical contract',
      'vertParams tropicalOrganizationBandDeg and subtropicalSubsidence contract from current vertical contract'
    ],
    evidenceLines: [
      `C13 softened the eddy reversal relative to C10: \`${comparison.c10Eddy}\` -> \`${comparison.c13Eddy}\`, but the zonal-mean branch worsened: \`${comparison.c10Zonal}\` -> \`${comparison.c13Zonal}\`.`,
      `Current vertical scaffold includes the modern cross-hemi subtropical contract: \`${currentVerticalHasContract}\`; archive donor vertical scaffold includes it: \`${archiveVerticalHasContract}\`.`,
      `Current vs archive dynamics diff exists: \`${dynamicsChanged}\`; this keeps the next experiment out of the dynamics lane and inside the vertical-scaffold lane.`
    ]
  };

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c14-sign-contract-implementation-attribution.v1',
    generatedAt: new Date().toISOString(),
    archiveBranch,
    decision,
    comparison,
    contract,
    verticalContractPresence: {
      currentVerticalHasContract,
      archiveVerticalHasContract
    },
    dynamicsChanged
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC14Markdown({
    decision,
    comparison,
    contract
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, comparison })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
