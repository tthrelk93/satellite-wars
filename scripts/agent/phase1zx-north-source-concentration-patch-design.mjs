#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zv-off.json';
const defaultOnPath = '/tmp/phase1zv-on.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zx-north-source-concentration-patch-design.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zx-north-source-concentration-patch-design.json'
);

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

function seriesValue(sample, lat, key) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  const index = nearestIndex(latitudesDeg, lat);
  return Number(sample?.profiles?.series?.[key]?.[index]) || 0;
}

function seriesDelta(offSample, onSample, lat, key) {
  return round(seriesValue(onSample, lat, key) - seriesValue(offSample, lat, key));
}

export function buildPhase1ZXNorthSourceConcentrationPatchDesign({ offAudit, onAudit, paths }) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const northSource = {
    condensationDeltaKgM2: seriesDelta(offSample, onSample, 11.25, 'largeScaleCondensationSourceKgM2'),
    totalColumnWaterDeltaKgM2: seriesDelta(offSample, onSample, 11.25, 'totalColumnWaterKgM2'),
    boundaryLayerRhDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'boundaryLayerRhFrac'),
    lowerTroposphericRhDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'lowerTroposphericRhFrac'),
    midTroposphericRhDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'midTroposphericRhFrac'),
    lowerTroposphericOmegaDeltaPaS: seriesDelta(offSample, onSample, 11.25, 'lowerTroposphericOmegaPaS'),
    midTroposphericOmegaDeltaPaS: seriesDelta(offSample, onSample, 11.25, 'midTroposphericOmegaPaS'),
    sourceSupportDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'equatorialEdgeSubsidenceGuardSourceSupportDiagFrac'),
    leakPenaltyDeltaFrac: seriesDelta(offSample, onSample, 11.25, 'equatorialEdgeNorthsideLeakPenaltyDiagFrac'),
    leakPenaltyOnFrac: round(seriesValue(onSample, 11.25, 'equatorialEdgeNorthsideLeakPenaltyDiagFrac')),
    precipReevaporationDeltaKgM2: seriesDelta(offSample, onSample, 11.25, 'precipReevaporationMassKgM2'),
    vaporFluxNorthDeltaKgM_1S: seriesDelta(offSample, onSample, 11.25, 'verticallyIntegratedVaporFluxNorthKgM_1S'),
    totalWaterFluxNorthDeltaKgM_1S: seriesDelta(offSample, onSample, 11.25, 'verticallyIntegratedTotalWaterFluxNorthKgM_1S')
  };

  const lanes = {
    edge3NCondensationDeltaKgM2: seriesDelta(offSample, onSample, 3.75, 'largeScaleCondensationSourceKgM2'),
    spillover18NCondensationDeltaKgM2: seriesDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    dryCore26NCondensationDeltaKgM2: seriesDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    southSource11SCondensationDeltaKgM2: seriesDelta(offSample, onSample, -11.25, 'largeScaleCondensationSourceKgM2')
  };

  const localRechargeSignal = round(
    Math.max(0, northSource.totalColumnWaterDeltaKgM2 || 0)
      + Math.max(0, northSource.boundaryLayerRhDeltaFrac || 0)
      + Math.max(0, northSource.lowerTroposphericRhDeltaFrac || 0)
      + Math.max(0, northSource.midTroposphericRhDeltaFrac || 0)
      + Math.max(0, northSource.lowerTroposphericOmegaDeltaPaS || 0)
      + Math.max(0, northSource.midTroposphericOmegaDeltaPaS || 0)
  );

  const dryNeighborRelief = round(
    Math.max(0, -(lanes.edge3NCondensationDeltaKgM2 || 0))
      + Math.max(0, -(lanes.spillover18NCondensationDeltaKgM2 || 0))
      + Math.max(0, -(lanes.dryCore26NCondensationDeltaKgM2 || 0))
  );
  const exportWeakeningSignal = round(
    Math.max(0, -(northSource.totalWaterFluxNorthDeltaKgM_1S || 0)) * 0.01
      + Math.max(0, -(northSource.vaporFluxNorthDeltaKgM_1S || 0)) * 0.005
      + Math.max(0, -(northSource.precipReevaporationDeltaKgM2 || 0))
  );
  const concentrationSignal = round(
    Math.max(0, northSource.condensationDeltaKgM2 || 0)
      + (dryNeighborRelief || 0)
      + (exportWeakeningSignal || 0)
  );

  const candidateScores = {
    northSourceConcentrationPenalty: round((concentrationSignal || 0) + Math.max(0, northSource.leakPenaltyOnFrac || 0)),
    polewardExportPreservingBridge: round(Math.max(0, northSource.condensationDeltaKgM2 || 0) + Math.max(0, -(northSource.totalWaterFluxNorthDeltaKgM_1S || 0)) * 0.01),
    localHumidityOmegaBoost: round((localRechargeSignal || 0) - Math.max(0, northSource.condensationDeltaKgM2 || 0)),
    globalSourceAmplitudeReduction: round(-Math.max(0, dryNeighborRelief || 0))
  };

  const ranking = Object.entries(candidateScores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score], index) => ({ name, rank: index + 1, score }));

  return {
    schema: 'satellite-wars.phase1zx-north-source-concentration-patch-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'live_leak_signal_driven_source_cap_preferred',
    nextPhase: 'Phase 1ZY: Implement Capped North Source Concentration Penalty Patch',
    recommendation: 'Keep the weak-hemi floor taper from Phase 1ZV. Do not add a local humidity or omega boost at 11.25N. The next patch should reuse the already-live northside leak signal as a direct capped source-row concentration penalty in vertical5.js/core5.js, applied only in the 9-13N source window.',
    keepWeakHemiFloorTaper: true,
    localRechargeSignal,
    dryNeighborRelief,
    exportWeakeningSignal,
    concentrationSignal,
    northSource,
    lanes,
    candidateScores,
    ranking,
    guardrails: {
      itczWidthDeltaDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
      subtropicalDryNorthRatioDelta: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
      subtropicalDrySouthRatioDelta: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
      northDryBeltOceanLargeScaleCondensationDeltaKgM2: round(
        (Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
          - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
      )
    },
    patchContract: [
      'keep the Phase 1ZV weak-hemi cross-hemi floor taper active',
      'patch the north 9-13N source loop in vertical5.js rather than the target lane or shoulder selector lane',
      'drive the new cap directly from the already-live northside leak penalty signal and source support, not from another admission gate',
      'apply the cap only in the NH source window and keep the south mirror untouched',
      'cap the penalty below broad amplitude-retune territory so the 18.75N and 26.25N dry-lane wins are preserved',
      'do not add a local humidity sink or omega boost at 11.25N'
    ]
  };
}

export function renderPhase1ZXReport(summary) {
  return `# Phase 1ZX North Source Concentration Patch Design

## Verdict

- ${summary.verdict}
- keep weak-hemi taper: \`${summary.keepWeakHemiFloorTaper}\`
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why Concentration Is The Right Patch Lane

- 11.25°N condensation delta: \`${summary.northSource.condensationDeltaKgM2}\`
- 11.25°N total-column-water delta: \`${summary.northSource.totalColumnWaterDeltaKgM2}\`
- 11.25°N BL RH delta: \`${summary.northSource.boundaryLayerRhDeltaFrac}\`
- 11.25°N lower/mid omega deltas: \`${summary.northSource.lowerTroposphericOmegaDeltaPaS}\` / \`${summary.northSource.midTroposphericOmegaDeltaPaS}\`
- 11.25°N live leak penalty on: \`${summary.northSource.leakPenaltyOnFrac}\`
- 11.25°N total-water-flux-north delta: \`${summary.northSource.totalWaterFluxNorthDeltaKgM_1S}\`
- 11.25°N precip-reevap delta: \`${summary.northSource.precipReevaporationDeltaKgM2}\`

## Supporting Lane Evidence

- 3.75°N condensation delta: \`${summary.lanes.edge3NCondensationDeltaKgM2}\`
- 18.75°N condensation delta: \`${summary.lanes.spillover18NCondensationDeltaKgM2}\`
- 26.25°N condensation delta: \`${summary.lanes.dryCore26NCondensationDeltaKgM2}\`
- -11.25° condensation delta: \`${summary.lanes.southSource11SCondensationDeltaKgM2}\`
- local recharge signal: \`${summary.localRechargeSignal}\`
- dry-neighbor relief: \`${summary.dryNeighborRelief}\`
- export-weakening signal: \`${summary.exportWeakeningSignal}\`
- concentration signal: \`${summary.concentrationSignal}\`

## Candidate Ranking

- north_source_concentration_penalty: \`${summary.candidateScores.northSourceConcentrationPenalty}\`
- poleward_export_preserving_bridge: \`${summary.candidateScores.polewardExportPreservingBridge}\`
- local_humidity_omega_boost: \`${summary.candidateScores.localHumidityOmegaBoost}\`
- global_source_amplitude_reduction: \`${summary.candidateScores.globalSourceAmplitudeReduction}\`

## Patch Contract

- ${summary.patchContract.join('\n- ')}

## Guardrail Context

- itcz width delta: \`${summary.guardrails.itczWidthDeltaDeg}\`
- dry north delta: \`${summary.guardrails.subtropicalDryNorthRatioDelta}\`
- dry south delta: \`${summary.guardrails.subtropicalDrySouthRatioDelta}\`
- north dry-belt ocean condensation delta: \`${summary.guardrails.northDryBeltOceanLargeScaleCondensationDeltaKgM2}\`
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZXNorthSourceConcentrationPatchDesign({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    paths: options
  });
  const report = renderPhase1ZXReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
