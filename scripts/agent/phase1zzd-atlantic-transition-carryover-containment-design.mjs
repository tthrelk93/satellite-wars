#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const defaultOffPath = '/tmp/phase1zzb-off.json';
const defaultOnPath = '/tmp/phase1zzb-on.json';
const defaultOffSectorPath = '/tmp/phase1zzb-off-nh-dry-belt-source-sector-summary.json';
const defaultOnSectorPath = '/tmp/phase1zzb-on-nh-dry-belt-source-sector-summary.json';
const defaultOffBirthPath = '/tmp/phase1zzb-off-vertical-cloud-birth-attribution.json';
const defaultOnBirthPath = '/tmp/phase1zzb-on-vertical-cloud-birth-attribution.json';
const defaultReportPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzd-atlantic-transition-carryover-containment-design.md'
);
const defaultJsonPath = path.join(
  repoRoot,
  'weather-validation',
  'reports',
  'phase1zzd-atlantic-transition-carryover-containment-design.json'
);

const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));
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

function zonalValue(sample, targetLat, key) {
  const latitudesDeg = sample?.profiles?.latitudesDeg || [];
  if (!latitudesDeg.length) return null;
  const index = nearestIndex(latitudesDeg, targetLat);
  return round(Number(sample?.profiles?.series?.[key]?.[index]) || 0);
}

function zonalDelta(offSample, onSample, targetLat, key) {
  const offValue = zonalValue(offSample, targetLat, key);
  const onValue = zonalValue(onSample, targetLat, key);
  return round((onValue || 0) - (offValue || 0));
}

function nestedDelta(offRoot, onRoot, pathParts) {
  const get = (root) => pathParts.reduce((acc, key) => (acc && key in acc ? acc[key] : null), root);
  return round((Number(get(onRoot)) || 0) - (Number(get(offRoot)) || 0));
}

function buildCandidateRanking(signals) {
  const carryoverContainmentScore = clamp01(
    0.28 * Math.min(1, Math.max(0, signals.spilloverCarryEnteringDelta) / 5)
    + 0.24 * Math.min(1, Math.max(0, signals.spilloverCarrySurvivingDelta) / 5)
    + 0.2 * Math.min(1, Math.max(0, signals.spilloverImportedPersistenceDelta) / 0.04)
    + 0.16 * Math.min(1, Math.max(0, signals.spilloverWeakErosionDelta) / 0.04)
    + 0.12 * Math.min(1, Math.max(0, signals.spilloverUpperCloudPathDelta) / 0.04)
  );
  const saturationAdjustmentCapScore = clamp01(
    0.55 * Math.min(1, Math.max(0, signals.atlanticSaturationAdjustmentDelta) / 2)
    + 0.25 * Math.min(1, Math.max(0, signals.spilloverCondensationDelta) / 0.015)
    - 0.2 * Math.min(1, Math.max(0, signals.spilloverResolvedBirthDelta) / 0.01)
  );
  const sourceSinkScore = round(clamp01(
    0.35 * Math.min(1, Math.max(0, -signals.spilloverNorthDryBeltSourceDelta) / 0.01)
    + 0.25 * Math.min(1, Math.max(0, -signals.spilloverTropicalNorthSourceDelta) / 0.002)
    + 0.2 * Math.min(1, Math.max(0, -signals.spilloverSurfaceEvapDelta) / 0.01)
    - 0.2 * Math.min(1, Math.max(0, signals.spilloverCarrySurvivingDelta) / 5)
  ), 5);
  const resolvedAscentCapScore = round(clamp01(
    0.5 * Math.min(1, Math.max(0, signals.spilloverResolvedBirthDelta) / 0.02)
    - 0.5 * Math.min(1, Math.max(0, signals.spilloverCarrySurvivingDelta) / 5)
  ), 5);

  const ranking = [
    {
      key: 'atlantic_transition_carryover_containment',
      label: 'Atlantic transition carryover containment',
      score: round(carryoverContainmentScore),
      rationale: 'The spillover lane rises with imported persistence, carry-survival, weak-erosion survival, and upper-cloud path while fresh source and resolved-ascent terms stay near-flat.'
    },
    {
      key: 'atlantic_transition_saturation_adjustment_cap',
      label: 'Atlantic transition saturation-adjustment cap',
      score: round(saturationAdjustmentCapScore),
      rationale: 'Atlantic saturation-adjustment birth does rise, but it is secondary to the larger carry-entering and carry-surviving increases.'
    },
    {
      key: 'atlantic_transition_low_level_source_sink',
      label: 'Atlantic transition low-level source sink',
      score: sourceSinkScore,
      rationale: 'The spillover lane does not show fresh source recharge; source tracers and surface evaporation are flat-to-down.'
    },
    {
      key: 'atlantic_transition_resolved_ascent_cap',
      label: 'Atlantic transition resolved-ascent cap',
      score: resolvedAscentCapScore,
      rationale: 'Resolved-ascent birth barely moves in the spillover lane, so a resolved-ascent cap would chase the wrong carrier.'
    }
  ].sort((a, b) => b.score - a.score);

  return ranking.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

export function buildPhase1ZZDAtlanticTransitionCarryoverContainmentDesign({
  offAudit,
  onAudit,
  offSectorSummary,
  onSectorSummary,
  offBirth,
  onBirth,
  paths
}) {
  const offSample = latestSample(offAudit);
  const onSample = latestSample(onAudit);
  const off = offSample?.metrics || {};
  const on = onSample?.metrics || {};

  const metrics = {
    itczWidthDeg: round((Number(on.itczWidthDeg) || 0) - (Number(off.itczWidthDeg) || 0)),
    subtropicalDryNorthRatio: round((Number(on.subtropicalDryNorthRatio) || 0) - (Number(off.subtropicalDryNorthRatio) || 0)),
    subtropicalDrySouthRatio: round((Number(on.subtropicalDrySouthRatio) || 0) - (Number(off.subtropicalDrySouthRatio) || 0)),
    northDryBeltOceanLargeScaleCondensationMeanKgM2: round(
      (Number(on.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
      - (Number(off.northDryBeltOceanLargeScaleCondensationMeanKgM2) || 0)
    )
  };

  const signals = {
    spilloverCondensationDelta: zonalDelta(offSample, onSample, 18.75, 'largeScaleCondensationSourceKgM2'),
    spilloverTcwDelta: zonalDelta(offSample, onSample, 18.75, 'totalColumnWaterKgM2'),
    spilloverLowerOmegaDelta: zonalDelta(offSample, onSample, 18.75, 'lowerTroposphericOmegaPaS'),
    spilloverMidRhDelta: zonalDelta(offSample, onSample, 18.75, 'midTroposphericRhFrac'),
    spilloverSurfaceEvapDelta: zonalDelta(offSample, onSample, 18.75, 'surfaceEvapRateMmHr'),
    spilloverNorthDryBeltSourceDelta: zonalDelta(offSample, onSample, 18.75, 'sourceNorthDryBeltOceanKgM2'),
    spilloverTropicalNorthSourceDelta: zonalDelta(offSample, onSample, 18.75, 'sourceTropicalOceanNorthKgM2'),
    spilloverResolvedBirthDelta: zonalDelta(offSample, onSample, 18.75, 'resolvedAscentCloudBirthPotentialKgM2'),
    spilloverImportedPersistenceDelta: zonalDelta(offSample, onSample, 18.75, 'importedAnvilPersistenceMassKgM2'),
    spilloverCarryoverDelta: zonalDelta(offSample, onSample, 18.75, 'carriedOverUpperCloudMassKgM2'),
    spilloverWeakErosionDelta: zonalDelta(offSample, onSample, 18.75, 'weakErosionCloudSurvivalMassKgM2'),
    spilloverUpperCloudPathDelta: zonalDelta(offSample, onSample, 18.75, 'upperCloudPathKgM2'),
    receiverCondensationDelta: zonalDelta(offSample, onSample, 26.25, 'largeScaleCondensationSourceKgM2'),
    receiverTaperDiagFrac: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperDiagFrac'),
    receiverTaperApplied: zonalValue(onSample, 26.25, 'atlanticDryCoreReceiverTaperAppliedDiag'),
    atlanticCondensationDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'atlantic', 'largeScaleCondensationMeanKgM2']
    ),
    atlanticLowLevelSourceDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'atlantic', 'totalLowLevelSourceMeanKgM2']
    ),
    eastPacificCondensationDelta: nestedDelta(
      offSectorSummary,
      onSectorSummary,
      ['nhDryBeltSectorSummary', 'eastPacific', 'largeScaleCondensationMeanKgM2']
    ),
    atlanticResolvedBirthDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'resolvedAscentCloudBirth']
    ),
    atlanticSaturationAdjustmentDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'saturationAdjustmentCloudBirth']
    ),
    spilloverCarryEnteringDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'carryOverUpperCloudEntering']
    ),
    spilloverCarrySurvivingDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltSectorChannelMeansKgM2', 'atlantic', 'carryOverUpperCloudSurviving']
    ),
    atlanticCarrySurvivalFracDelta: nestedDelta(
      offBirth,
      onBirth,
      ['attribution', 'northDryBeltCarryOverSurvivalFrac']
    )
  };

  const ranking = buildCandidateRanking(signals);

  return {
    schema: 'satellite-wars.phase1zzd-atlantic-transition-carryover-containment-design.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'atlantic_transition_overlap_survival_taper_preferred',
    nextPhase: 'Phase 1ZZE: Implement Atlantic Transition Carryover Containment Patch',
    recommendation:
      'The next patch should live in vertical5.js/core5.js and taper Atlantic transition carryover survival around 18–22.5°N. The primary target is overlap-survival / persistence support, not fresh source recharge, resolved-ascent birth, or Atlantic receiver geometry.',
    metrics,
    signals,
    ranking,
    preferredPatchContract: {
      files: [
        'src/weather/v2/vertical5.js',
        'src/weather/v2/core5.js'
      ],
      geometry: 'Atlantic ocean transition lane, centered on 18–22.5°N',
      activation: 'Reuse the live Atlantic receiver-taper / northside leak carrier rather than creating a fresh source gate.',
      target: 'Contain carryover overlap survival and persistence support in the Atlantic transition lane while preserving 26.25°N receiver relief.',
      antiPatterns: [
        'Do not retune Atlantic receiver geometry again.',
        'Do not add a fresh low-level humidity or evaporation sink.',
        'Do not cap resolved-ascent birth as the primary lever.',
        'Do not globally ablate Atlantic carryover or cloud birth.'
      ]
    }
  };
}

export function renderPhase1ZZDReport(summary) {
  const rankingLines = summary.ranking
    .map((entry) => `- ${entry.rank}. \`${entry.key}\` score \`${entry.score}\` — ${entry.rationale}`)
    .join('\n');

  return `# Phase 1ZZD Atlantic Transition Carryover Containment Design

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Main Guardrails

- itcz width delta: \`${summary.metrics.itczWidthDeg}\`
- dry north delta: \`${summary.metrics.subtropicalDryNorthRatio}\`
- dry south delta: \`${summary.metrics.subtropicalDrySouthRatio}\`
- north dry-belt ocean condensation delta: \`${summary.metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2}\`

## Live Signals

- \`18.75°N\` condensation delta: \`${summary.signals.spilloverCondensationDelta}\`
- \`18.75°N\` total-column-water delta: \`${summary.signals.spilloverTcwDelta}\`
- \`18.75°N\` lower-omega delta: \`${summary.signals.spilloverLowerOmegaDelta}\`
- \`18.75°N\` mid-RH delta: \`${summary.signals.spilloverMidRhDelta}\`
- \`18.75°N\` surface-evap delta: \`${summary.signals.spilloverSurfaceEvapDelta}\`
- \`18.75°N\` north-dry-belt-ocean source delta: \`${summary.signals.spilloverNorthDryBeltSourceDelta}\`
- \`18.75°N\` tropical-ocean-north source delta: \`${summary.signals.spilloverTropicalNorthSourceDelta}\`
- \`18.75°N\` resolved-ascent birth delta: \`${summary.signals.spilloverResolvedBirthDelta}\`
- \`18.75°N\` imported persistence delta: \`${summary.signals.spilloverImportedPersistenceDelta}\`
- \`18.75°N\` carryover delta: \`${summary.signals.spilloverCarryoverDelta}\`
- \`18.75°N\` weak-erosion survival delta: \`${summary.signals.spilloverWeakErosionDelta}\`
- \`18.75°N\` upper-cloud path delta: \`${summary.signals.spilloverUpperCloudPathDelta}\`
- \`26.25°N\` receiver condensation delta: \`${summary.signals.receiverCondensationDelta}\`
- \`26.25°N\` receiver taper frac: \`${summary.signals.receiverTaperDiagFrac}\`
- \`26.25°N\` receiver taper applied: \`${summary.signals.receiverTaperApplied}\`
- Atlantic sector condensation delta: \`${summary.signals.atlanticCondensationDelta}\`
- Atlantic low-level-source delta: \`${summary.signals.atlanticLowLevelSourceDelta}\`
- east Pacific condensation delta: \`${summary.signals.eastPacificCondensationDelta}\`
- Atlantic saturation-adjustment birth delta: \`${summary.signals.atlanticSaturationAdjustmentDelta}\`
- Atlantic carry-entering delta: \`${summary.signals.spilloverCarryEnteringDelta}\`
- Atlantic carry-surviving delta: \`${summary.signals.spilloverCarrySurvivingDelta}\`
- Atlantic carry-survival-frac delta: \`${summary.signals.atlanticCarrySurvivalFracDelta}\`

## Candidate Ranking

${rankingLines}

## Patch Contract

- files: ${summary.preferredPatchContract.files.map((file) => `\`${file}\``).join(', ')}
- geometry: ${summary.preferredPatchContract.geometry}
- activation: ${summary.preferredPatchContract.activation}
- target: ${summary.preferredPatchContract.target}
- anti-patterns:
${summary.preferredPatchContract.antiPatterns.map((line) => `  - ${line}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    offPath: defaultOffPath,
    onPath: defaultOnPath,
    offSectorPath: defaultOffSectorPath,
    onSectorPath: defaultOnSectorPath,
    offBirthPath: defaultOffBirthPath,
    onBirthPath: defaultOnBirthPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--off' && argv[i + 1]) options.offPath = argv[++i];
    else if (arg.startsWith('--off=')) options.offPath = arg.slice('--off='.length);
    else if (arg === '--on' && argv[i + 1]) options.onPath = argv[++i];
    else if (arg.startsWith('--on=')) options.onPath = arg.slice('--on='.length);
    else if (arg === '--off-sector' && argv[i + 1]) options.offSectorPath = argv[++i];
    else if (arg.startsWith('--off-sector=')) options.offSectorPath = arg.slice('--off-sector='.length);
    else if (arg === '--on-sector' && argv[i + 1]) options.onSectorPath = argv[++i];
    else if (arg.startsWith('--on-sector=')) options.onSectorPath = arg.slice('--on-sector='.length);
    else if (arg === '--off-birth' && argv[i + 1]) options.offBirthPath = argv[++i];
    else if (arg.startsWith('--off-birth=')) options.offBirthPath = arg.slice('--off-birth='.length);
    else if (arg === '--on-birth' && argv[i + 1]) options.onBirthPath = argv[++i];
    else if (arg.startsWith('--on-birth=')) options.onBirthPath = arg.slice('--on-birth='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZZDAtlanticTransitionCarryoverContainmentDesign({
    offAudit: readJson(options.offPath),
    onAudit: readJson(options.onPath),
    offSectorSummary: readJson(options.offSectorPath),
    onSectorSummary: readJson(options.onSectorPath),
    offBirth: readJson(options.offBirthPath),
    onBirth: readJson(options.onBirthPath),
    paths: options
  });
  const report = renderPhase1ZZDReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
