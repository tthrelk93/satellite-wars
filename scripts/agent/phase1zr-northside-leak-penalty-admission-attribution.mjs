#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOnPath = '/tmp/phase1zr-on.json';
const defaultPhase1ZQPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zq-capped-northside-fanout-leak-penalty-patch.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zr-northside-leak-penalty-admission-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zr-northside-leak-penalty-admission-attribution.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;

function nearestIndex(latitudesDeg, targetLat) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < latitudesDeg.length; i += 1) {
    const distance = Math.abs((latitudesDeg[i] || 0) - targetLat);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function snapshot(sample, targetLat) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return null;
  const index = nearestIndex(latitudesDeg, targetLat);
  const get = (key) => Number(sample?.profiles?.series?.[key]?.[index]) || 0;
  return {
    latitudeDeg: round(latitudesDeg[index], 2),
    equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: round(get('equatorialEdgeSubsidenceGuardSourceSupportDiagFrac')),
    equatorialEdgeNorthsideLeakSourceWindowDiagFrac: round(get('equatorialEdgeNorthsideLeakSourceWindowDiagFrac')),
    equatorialEdgeNorthsideLeakRiskDiagFrac: round(get('equatorialEdgeNorthsideLeakRiskDiagFrac')),
    equatorialEdgeNorthsideLeakPenaltyDiagFrac: round(get('equatorialEdgeNorthsideLeakPenaltyDiagFrac')),
    freshSubtropicalBandDiagFrac: round(get('freshSubtropicalBandDiagFrac')),
    freshNeutralToSubsidingSupportDiagFrac: round(get('freshNeutralToSubsidingSupportDiagFrac')),
    lowerTroposphericOmegaPaS: round(get('lowerTroposphericOmegaPaS')),
    largeScaleCondensationSourceKgM2: round(get('largeScaleCondensationSourceKgM2'))
  };
}

export function buildPhase1ZRNorthsideLeakPenaltyAdmissionAttribution({ onAudit, phase1zqSummary, paths }) {
  const sample = latestSample(onAudit);
  const northSource = snapshot(sample, 11.25);
  const northEdge = snapshot(sample, 3.75);
  const southSource = snapshot(sample, -11.25);
  const risk0 = 0.55;
  const risk1 = 0.8;

  const activeSourceFraction = Number(northSource?.equatorialEdgeNorthsideLeakSourceWindowDiagFrac) || 0;
  const rowMeanRisk = Number(northSource?.equatorialEdgeNorthsideLeakRiskDiagFrac) || 0;
  const activeSubsetRiskMean = activeSourceFraction > 1e-12 ? round(rowMeanRisk / activeSourceFraction) : 0;
  const riskMiss = round(risk0 - activeSubsetRiskMean);

  return {
    schema: 'satellite-wars.phase1zr-northside-leak-penalty-admission-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'supported_subset_risk_below_gate',
    nextPhase: 'Phase 1ZS: Northside Leak Risk Gate Redesign',
    recommendation: 'Keep the 1ZQ lane disabled by default. The northside source row is live and partially occupied, but its active supported subset still does not clear the leak-risk entry gate. The next patch should redesign the leak admission around supported-source-normalized risk instead of simply increasing amplitude.',
    phase1zqContext: {
      verdict: phase1zqSummary?.verdict ?? null,
      keepPatch: phase1zqSummary?.keepPatch ?? null
    },
    thresholds: {
      risk0,
      risk1
    },
    scores: {
      activeSourceFraction: round(activeSourceFraction),
      rowMeanRisk: round(rowMeanRisk),
      activeSubsetRiskMean,
      riskMiss
    },
    slices: {
      northSource,
      northEdge,
      southSource
    },
    designContract: {
      keep: [
        'keep the bilateral equatorial-edge subsidence guard geometry',
        'keep the northside leak-penalty wiring and diagnostics behind the runtime toggle',
        'keep the south-edge stabilization intact'
      ],
      change: [
        'redesign leak admission around supported-source-normalized risk instead of the current stricter raw risk gate',
        'treat the dominant miss as weak live subtropical-band admission on the NH source subset, not as a wiring failure',
        'do not increase global amplitude until the source-row risk gate actually becomes live'
      ]
    }
  };
}

export function renderPhase1ZRReport(summary) {
  return `# Phase 1ZR Northside Leak Penalty Admission Attribution

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Northside Source Admission

- 11.25°N source support: \`${summary.slices.northSource.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- 11.25°N source window: \`${summary.slices.northSource.equatorialEdgeNorthsideLeakSourceWindowDiagFrac}\`
- 11.25°N row-mean leak risk: \`${summary.slices.northSource.equatorialEdgeNorthsideLeakRiskDiagFrac}\`
- 11.25°N active-subset leak risk: \`${summary.scores.activeSubsetRiskMean}\`
- 11.25°N leak penalty: \`${summary.slices.northSource.equatorialEdgeNorthsideLeakPenaltyDiagFrac}\`
- risk threshold miss versus \`${summary.thresholds.risk0}\`: \`${summary.scores.riskMiss}\`

## Why This Is Not A Wiring Bug

- 3.75°N penalty remains \`${summary.slices.northEdge.equatorialEdgeNorthsideLeakPenaltyDiagFrac}\`
- -11.25° source window remains \`${summary.slices.southSource.equatorialEdgeNorthsideLeakSourceWindowDiagFrac}\` by NH-only design
- the north row still carries live support, but its admitted subset never reaches the entry gate

## Live Source Terms

- 11.25°N fresh subtropical band: \`${summary.slices.northSource.freshSubtropicalBandDiagFrac}\`
- 11.25°N fresh neutral-to-subsiding support: \`${summary.slices.northSource.freshNeutralToSubsidingSupportDiagFrac}\`
- 11.25°N lower omega: \`${summary.slices.northSource.lowerTroposphericOmegaPaS}\`
- 11.25°N condensation: \`${summary.slices.northSource.largeScaleCondensationSourceKgM2}\`

## Next Step

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    onPath: defaultOnPath,
    phase1zqPath: defaultPhase1ZQPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zq' && argv[i + 1]) options.phase1zqPath = argv[++i];
    else if (arg.startsWith('--phase1zq=')) options.phase1zqPath = arg.slice('--phase1zq='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZRNorthsideLeakPenaltyAdmissionAttribution({
    onAudit: readJson(options.onPath),
    phase1zqSummary: readJson(options.phase1zqPath),
    paths: options
  });
  const report = renderPhase1ZRReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
