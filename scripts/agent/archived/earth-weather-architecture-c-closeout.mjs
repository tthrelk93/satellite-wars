#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');

const BASELINE_METRICS = {
  itczWidthDeg: 25.91,
  subtropicalDryNorthRatio: 1.534,
  subtropicalDrySouthRatio: 1.199,
  midlatitudeWesterliesNorthU10Ms: 0.531,
  northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413,
  crossEquatorialVaporFluxNorthKgM_1S: 143.95306
};

const D_REPORT_PATH = path.join(REPORT_DIR, 'earth-weather-architecture-d-core-transport-sign-rebuild.md');

const CANDIDATE_CONFIGS = [
  {
    id: 'C62',
    label: 'Architecture C62',
    quickVerdict: 'quick_reject',
    quickPath: path.join(
      OUTPUT_DIR,
      'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-quick.json'
    ),
    reportPath: path.join(
      REPORT_DIR,
      'earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.md'
    ),
    signal:
      'Best retained late-C reference candidate. It keeps the least-bad cross-equatorial transport-sign defect while still preserving the strongest dry-belt ratios in this final comparison set.'
  },
  {
    id: 'C66',
    label: 'Architecture C66',
    quickVerdict: 'quick_reject',
    quickPath: path.join(
      OUTPUT_DIR,
      'earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-quick.json'
    ),
    reportPath: path.join(
      REPORT_DIR,
      'earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-experiment.md'
    ),
    signal:
      'Real equatorial-guard activity, but it does not beat C62 on the primary blocker. The sign defect stays materially worse even though the shape metrics remain strong.'
  },
  {
    id: 'C68',
    label: 'Architecture C68',
    quickVerdict: 'quick_reject',
    quickPath: path.join(
      OUTPUT_DIR,
      'earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-quick.json'
    ),
    reportPath: path.join(
      REPORT_DIR,
      'earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-experiment.md'
    ),
    signal:
      'Best NH dry-belt ocean-condensation containment and strongest NH westerlies of the four, but it pushes the transport-sign defect farther from recovery again.'
  },
  {
    id: 'C70',
    label: 'Architecture C70',
    quickVerdict: 'quick_reject',
    quickPath: path.join(
      OUTPUT_DIR,
      'earth-weather-architecture-c70-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-narrower-equatorial-core-guard-and-stronger-inner-core-blend-quick.json'
    ),
    reportPath: path.join(
      REPORT_DIR,
      'earth-weather-architecture-c70-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-narrower-equatorial-core-guard-and-stronger-inner-core-blend-experiment.md'
    ),
    signal:
      'Best post-C68 recovery on the transport-sign defect, but it still fails badly versus C62 and gives back part of the NH ocean-condensation relief.'
  }
];

const defaults = {
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c-closeout.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c-closeout.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const extractMetrics = (auditJson) => auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {};

const metricKeys = [
  'itczWidthDeg',
  'subtropicalDryNorthRatio',
  'subtropicalDrySouthRatio',
  'midlatitudeWesterliesNorthU10Ms',
  'northDryBeltOceanLargeScaleCondensationMeanKgM2',
  'crossEquatorialVaporFluxNorthKgM_1S'
];

const metricLabels = {
  itczWidthDeg: 'ITCZ width',
  subtropicalDryNorthRatio: 'NH dry-belt ratio',
  subtropicalDrySouthRatio: 'SH dry-belt ratio',
  midlatitudeWesterliesNorthU10Ms: 'NH midlatitude westerlies',
  northDryBeltOceanLargeScaleCondensationMeanKgM2: 'NH dry-belt ocean condensation',
  crossEquatorialVaporFluxNorthKgM_1S: 'Cross-equatorial vapor flux north'
};

export function classifyArchitectureCCloseout({ candidates }) {
  const sortedByCrossEq = [...candidates].sort(
    (a, b) => b.metrics.crossEquatorialVaporFluxNorthKgM_1S - a.metrics.crossEquatorialVaporFluxNorthKgM_1S
  );
  const reference = sortedByCrossEq[0];
  const allQuickReject = candidates.every((candidate) => candidate.quickVerdict === 'quick_reject');
  const laterCandidates = candidates.filter((candidate) => candidate.id !== reference.id);
  const laterBeatsReferenceOnPrimaryBlocker = laterCandidates.some(
    (candidate) =>
      candidate.metrics.crossEquatorialVaporFluxNorthKgM_1S
      > reference.metrics.crossEquatorialVaporFluxNorthKgM_1S
  );

  if (
    allQuickReject
    && reference.id === 'C62'
    && !laterBeatsReferenceOnPrimaryBlocker
    && reference.metrics.crossEquatorialVaporFluxNorthKgM_1S < 0
  ) {
    return {
      verdict: 'architecture_c_exhausted_best_reference_c62',
      architectureExhausted: true,
      bestReferenceCandidate: 'C62',
      doNotContinue: 'C71+',
      nextArchitecture: 'Architecture D: core transport-sign rebuild',
      nextMove: 'Architecture D1: signed transport-budget decomposition design',
      reasons: [
        'All four meaningful late Architecture C candidates remain quick rejects.',
        'C62 still has the least-bad cross-equatorial transport-sign defect in the final comparison set.',
        'C66, C68, and C70 map tradeoffs inside the same family instead of producing a better keep candidate.',
        'Architecture C generated real discovery value, but it no longer justifies continued latitude-lane micro-tuning.'
      ]
    };
  }

  return {
    verdict: 'architecture_c_closeout_inconclusive',
    architectureExhausted: false,
    bestReferenceCandidate: reference.id,
    doNotContinue: null,
    nextArchitecture: 'Architecture C',
    nextMove: 'Architecture C71: unresolved',
    reasons: [
      'The late-C candidate set does not yet support a clean closeout decision.'
    ]
  };
}

export function renderArchitectureCCloseoutMarkdown({ baseline, candidates, decision }) {
  const header = [
    '# Earth Weather Architecture C Closeout',
    '',
    'This report closes out Architecture C by comparing the best meaningful late-family candidates: `C62`, `C66`, `C68`, and `C70`. The goal is to decide whether Architecture C still deserves more micro-phases or whether we should stop the ladder and move to a new top-level transport-sign architecture.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- architecture exhausted: \`${decision.architectureExhausted ? 'yes' : 'no'}\``,
    `- best retained reference candidate: \`${decision.bestReferenceCandidate}\``,
    `- do not continue: \`${decision.doNotContinue ?? 'n/a'}\``,
    `- next architecture: \`${decision.nextArchitecture}\``,
    `- next active phase: \`${decision.nextMove}\``,
    '',
    '## Quick comparison',
    '',
    '| Candidate | ITCZ width | NH dry ratio | SH dry ratio | NH westerlies | NH ocean condensation | Cross-equatorial vapor flux north |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| Baseline | ${baseline.itczWidthDeg} | ${baseline.subtropicalDryNorthRatio} | ${baseline.subtropicalDrySouthRatio} | ${baseline.midlatitudeWesterliesNorthU10Ms} | ${baseline.northDryBeltOceanLargeScaleCondensationMeanKgM2} | ${baseline.crossEquatorialVaporFluxNorthKgM_1S} |`
  ];

  const rows = candidates.map((candidate) => {
    const m = candidate.metrics;
    return `| ${candidate.id} | ${m.itczWidthDeg} | ${m.subtropicalDryNorthRatio} | ${m.subtropicalDrySouthRatio} | ${m.midlatitudeWesterliesNorthU10Ms} | ${m.northDryBeltOceanLargeScaleCondensationMeanKgM2} | ${m.crossEquatorialVaporFluxNorthKgM_1S} |`;
  });

  const comparison = [
    '',
    '## Candidate readout',
    ''
  ];

  for (const candidate of candidates) {
    comparison.push(`### ${candidate.id}`);
    comparison.push(`- report: [${path.basename(candidate.reportPath)}](${candidate.reportPath})`);
    comparison.push(`- verdict: \`${candidate.quickVerdict}\``);
    comparison.push(`- read: ${candidate.signal}`);
    comparison.push('');
  }

  const decisionSection = [
    '## Closeout decision',
    '',
    `- Architecture C is ${decision.architectureExhausted ? 'exhausted' : 'not yet exhausted'} as a micro-phase family.`,
    `- The retained reference candidate is \`${decision.bestReferenceCandidate}\`, because it remains the least-bad candidate on the primary blocker: \`${metricLabels.crossEquatorialVaporFluxNorthKgM_1S}\`.`,
    '- The later candidates are informative, but they only redistribute the same failure across NH ocean maintenance, transition/receiver rows, and equatorial core support.',
    '- No candidate in this closeout set clears the quick gate or justifies annual promotion.',
    '',
    '## Why the ladder stops here',
    ''
  ];

  for (const reason of decision.reasons) {
    decisionSection.push(`- ${reason}`);
  }

  decisionSection.push('');
  decisionSection.push('## Next architecture');
  decisionSection.push('');
  decisionSection.push(`- Start [${path.basename(D_REPORT_PATH)}](${D_REPORT_PATH}).`);
  decisionSection.push('- The new architecture targets the core transport-sign problem directly: zonal-mean overturning polarity, equatorial eddy export, and NH dry-belt closure.');
  decisionSection.push('- It is explicitly bounded and is not another latitude-lane micro-tuning ladder.');
  decisionSection.push('');

  return `${[...header, ...rows, ...comparison, ...decisionSection].join('\n')}\n`;
}

function main() {
  const candidates = CANDIDATE_CONFIGS.map((config) => {
    const metrics = extractMetrics(readJson(config.quickPath));
    return {
      ...config,
      metrics: Object.fromEntries(
        metricKeys.map((key) => [key, round(metrics[key])])
      )
    };
  });

  const decision = classifyArchitectureCCloseout({ candidates });
  const markdown = renderArchitectureCCloseoutMarkdown({
    baseline: BASELINE_METRICS,
    candidates,
    decision
  });

  const json = {
    decision,
    baselineMetrics: BASELINE_METRICS,
    candidates,
    generatedAt: new Date().toISOString()
  };

  ensureDir(options.reportPath);
  ensureDir(options.jsonPath);
  fs.writeFileSync(options.reportPath, markdown);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(json, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
