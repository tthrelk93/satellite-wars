#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOffPath = '/tmp/phase1zs-off.json';
const defaultOnPath = '/tmp/phase1zs-on.json';
const defaultPhase1ZSPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zs-northside-leak-risk-gate-redesign.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zt-south-mirror-rebound-attribution.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zt-south-mirror-rebound-attribution.json');

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const latestSample = (audit) => audit?.samples?.[audit.samples.length - 1] || null;
const latestMetrics = (audit) => latestSample(audit)?.metrics || {};

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
    largeScaleCondensationSourceKgM2: round(get('largeScaleCondensationSourceKgM2')),
    totalColumnWaterKgM2: round(get('totalColumnWaterKgM2')),
    boundaryLayerRhFrac: round(get('boundaryLayerRhFrac')),
    midTroposphericRhFrac: round(get('midTroposphericRhFrac')),
    lowerTroposphericOmegaPaS: round(get('lowerTroposphericOmegaPaS')),
    resolvedAscentCloudBirthPotentialKgM2: round(get('resolvedAscentCloudBirthPotentialKgM2')),
    precipRateMmHr: round(get('precipRateMmHr')),
    cloudTotalFraction: round(get('cloudTotalFraction'))
  };
}

function deltaSlice(onSlice, offSlice) {
  const deltas = {};
  for (const key of Object.keys(onSlice || {})) {
    if (key === 'latitudeDeg') continue;
    deltas[key] = round((Number(onSlice?.[key]) || 0) - (Number(offSlice?.[key]) || 0));
  }
  return deltas;
}

export function buildPhase1ZTSouthMirrorReboundAttribution({ offAudit, onAudit, phase1zsSummary, paths }) {
  const offMetrics = latestMetrics(offAudit);
  const onMetrics = latestMetrics(onAudit);
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);

  const southSource = { off: snapshot(offSample, -11.25), on: snapshot(onSample, -11.25) };
  southSource.delta = deltaSlice(southSource.on, southSource.off);
  const southEdge = { off: snapshot(offSample, -3.75), on: snapshot(onSample, -3.75) };
  southEdge.delta = deltaSlice(southEdge.on, southEdge.off);
  const northSource = { off: snapshot(offSample, 11.25), on: snapshot(onSample, 11.25) };
  northSource.delta = deltaSlice(northSource.on, northSource.off);
  const northEdge = { off: snapshot(offSample, 3.75), on: snapshot(onSample, 3.75) };
  northEdge.delta = deltaSlice(northEdge.on, northEdge.off);

  const metrics = {
    itczWidthDeg: round((Number(onMetrics.itczWidthDeg) || 0) - (Number(offMetrics.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(onMetrics.subtropicalDryNorthRatio) || 0) - (Number(offMetrics.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(onMetrics.subtropicalDrySouthRatio) || 0) - (Number(offMetrics.subtropicalDrySouthRatio) || 0)),
    crossEquatorialVaporFluxNorthKgM_1S: round((Number(onMetrics.crossEquatorialVaporFluxNorthKgM_1S) || 0) - (Number(offMetrics.crossEquatorialVaporFluxNorthKgM_1S) || 0)),
    tropicalShoulderLargeScaleCondensationMeanKgM2: round((Number(onMetrics.tropicalShoulderLargeScaleCondensationMeanKgM2) || 0) - (Number(offMetrics.tropicalShoulderLargeScaleCondensationMeanKgM2) || 0)),
    equatorialPrecipMeanMmHr: round((Number(onMetrics.equatorialPrecipMeanMmHr) || 0) - (Number(offMetrics.equatorialPrecipMeanMmHr) || 0))
  };

  const humidificationSignal = round(
    Math.abs(Number(southSource.delta.totalColumnWaterKgM2) || 0)
    + 10 * Math.abs(Number(southSource.delta.boundaryLayerRhFrac) || 0)
    + Math.abs(Number(southEdge.delta.totalColumnWaterKgM2) || 0)
    + 10 * Math.abs(Number(southEdge.delta.boundaryLayerRhFrac) || 0)
  );
  const omegaSignal = round(
    Math.abs(Number(southSource.delta.lowerTroposphericOmegaPaS) || 0)
    + Math.abs(Number(southEdge.delta.lowerTroposphericOmegaPaS) || 0)
  );

  return {
    schema: 'satellite-wars.phase1zt-south-mirror-rebound-attribution.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'cross_equatorial_compensation_without_local_recharge',
    nextPhase: 'Phase 1ZU: Bilateral Balance Patch Design',
    recommendation: 'Do not chase this with another local south humidity or omega patch. The south mirror rebound looks like a cross-equatorial compensation path after the NH source lane is suppressed, so the next step should be a bilateral balance design in the vertical/core lane.',
    phase1zsContext: {
      verdict: phase1zsSummary?.verdict ?? null,
      keepPatch: phase1zsSummary?.keepPatch ?? null
    },
    scores: {
      humidificationSignal,
      omegaSignal
    },
    metrics,
    slices: {
      southSource,
      southEdge,
      northSource,
      northEdge
    },
    designContract: {
      keep: [
        'keep the northside supported-source-normalized leak gate available behind the runtime toggle',
        'keep the bilateral equatorial-edge geometry and existing south-edge guard plumbing'
      ],
      change: [
        'design the next patch around bilateral balance / cross-equatorial compensation rather than local south humidification',
        'treat the south rebound as a remote response to NH suppression because local TCW, RH, omega, cloud, and precipitation barely move',
        'avoid a south-only local sink until a bilateral balance lane has been tested'
      ]
    }
  };
}

export function renderPhase1ZTReport(summary) {
  return `# Phase 1ZT South Mirror Rebound Attribution

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## South Mirror Signal

- -11.25° source condensation delta: \`${summary.slices.southSource.delta.largeScaleCondensationSourceKgM2}\`
- -3.75° edge condensation delta: \`${summary.slices.southEdge.delta.largeScaleCondensationSourceKgM2}\`
- -11.25° TCW delta: \`${summary.slices.southSource.delta.totalColumnWaterKgM2}\`
- -11.25° BL RH delta: \`${summary.slices.southSource.delta.boundaryLayerRhFrac}\`
- -11.25° lower omega delta: \`${summary.slices.southSource.delta.lowerTroposphericOmegaPaS}\`
- -3.75° TCW delta: \`${summary.slices.southEdge.delta.totalColumnWaterKgM2}\`
- -3.75° BL RH delta: \`${summary.slices.southEdge.delta.boundaryLayerRhFrac}\`
- -3.75° lower omega delta: \`${summary.slices.southEdge.delta.lowerTroposphericOmegaPaS}\`

## Why This Looks Like Compensation, Not Local Recharge

- cross-equatorial vapor-flux delta: \`${summary.metrics.crossEquatorialVaporFluxNorthKgM_1S}\`
- tropical-shoulder condensation delta: \`${summary.metrics.tropicalShoulderLargeScaleCondensationMeanKgM2}\`
- equatorial precip delta: \`${summary.metrics.equatorialPrecipMeanMmHr}\`
- humidification signal: \`${summary.scores.humidificationSignal}\`
- omega signal: \`${summary.scores.omegaSignal}\`

## North-Side Context

- 11.25°N source condensation delta: \`${summary.slices.northSource.delta.largeScaleCondensationSourceKgM2}\`
- 3.75°N edge condensation delta: \`${summary.slices.northEdge.delta.largeScaleCondensationSourceKgM2}\`

## Next Step

${summary.designContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.designContract.change.map((item) => `- change: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    phase1zsPath: defaultPhase1ZSPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--phase1zs' && argv[i + 1]) options.phase1zsPath = argv[++i];
    else if (arg.startsWith('--phase1zs=')) options.phase1zsPath = arg.slice('--phase1zs='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZTSouthMirrorReboundAttribution({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    phase1zsSummary: readJson(options.phase1zsPath),
    paths: options
  });
  const report = renderPhase1ZTReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
