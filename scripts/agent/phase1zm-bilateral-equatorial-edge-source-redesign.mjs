#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultPhase1ZLPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zl-equatorial-edge-subsidence-guard-patch.json');
const defaultReportPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zm-bilateral-equatorial-edge-source-redesign.md');
const defaultJsonPath = path.join(repoRoot, 'weather-validation', 'reports', 'phase1zm-bilateral-equatorial-edge-source-redesign.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const round = (value, digits = 5) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function buildPhase1ZMBilateralEquatorialEdgeSourceRedesign({ phase1zlSummary, paths }) {
  const southSourceOn = phase1zlSummary?.slices?.southSource?.on || {};
  const northSourceOn = phase1zlSummary?.slices?.northSource?.on || {};
  const southEdgeOn = phase1zlSummary?.slices?.southEdge?.on || {};
  const northEdgeOn = phase1zlSummary?.slices?.northEdge?.on || {};
  const southEdgeDelta = phase1zlSummary?.slices?.southEdge?.delta || {};
  const northEdgeDelta = phase1zlSummary?.slices?.northEdge?.delta || {};
  const targetEntryOn = phase1zlSummary?.slices?.targetEntry?.on || {};

  const sourceMirrorGap = round(
    (Number(northSourceOn.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac) || 0)
      - (Number(southSourceOn.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac) || 0)
  );
  const targetMirrorGap = round(
    (Number(northEdgeOn.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac) || 0)
      - (Number(southEdgeOn.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac) || 0)
  );
  const appliedMirrorGap = round(
    (Number(northEdgeOn.equatorialEdgeSubsidenceGuardAppliedDiagPaS) || 0)
      - (Number(southEdgeOn.equatorialEdgeSubsidenceGuardAppliedDiagPaS) || 0)
  );

  const signedLatitudeInheritanceScore = round(
    (
      (sourceMirrorGap > 0 ? 0.4 : 0) +
      (targetMirrorGap > 0 ? 0.3 : 0) +
      ((Number(northSourceOn.freshShoulderInnerWindowDiagFrac) || 0) > 0 && (Number(southSourceOn.freshShoulderInnerWindowDiagFrac) || 0) === 0 ? 0.2 : 0) +
      ((Number(northEdgeOn.freshShoulderEquatorialEdgeWindowDiagFrac) || 0) > 0 && (Number(southEdgeOn.freshShoulderEquatorialEdgeWindowDiagFrac) || 0) === 0 ? 0.1 : 0)
    ),
    5
  );

  return {
    schema: 'satellite-wars.phase1zm-bilateral-equatorial-edge-source-redesign.v1',
    generatedAt: new Date().toISOString(),
    paths,
    verdict: 'signed_latitude_window_inheritance',
    nextPhase: 'Phase 1ZN: Implement Mirrored Bilateral Edge-Source Window Patch',
    recommendation: 'Do not retune amplitude. Replace the guard’s inherited NH-only shoulder source/target admission with bilateral abs-lat source and target windows, while preserving the NH target-entry exclusion as a separate lane.',
    inheritedFailure: {
      sourceMirrorGap,
      targetMirrorGap,
      appliedMirrorGap,
      signedLatitudeInheritanceScore
    },
    evidence: {
      southSource: southSourceOn,
      northSource: northSourceOn,
      southEdge: southEdgeOn,
      northEdge: northEdgeOn,
      southEdgeDelta,
      northEdgeDelta,
      targetEntry: targetEntryOn
    },
    redesignContract: {
      keep: [
        'keep Phase 1ZJ split-lane shoulder gating',
        'keep Phase 1ZL diagnostics and runtime toggle',
        'keep the NH 30-45° target-entry exclusion as a separate non-mirrored lane'
      ],
      change: [
        'stop sourcing the equatorial-edge guard from freshShoulderInnerWindowDiagFrac',
        'stop targeting the equatorial-edge guard from freshShoulderEquatorialEdgeWindowDiagFrac',
        'build dedicated bilateral source windows from abs(lat) for 8-14° edge-source rows',
        'build dedicated bilateral target windows from abs(lat) for 2-6° edge lanes',
        'preserve hemisphere-local application instead of coupling through NH-only window geometry'
      ],
      doNotDo: [
        'do not increase equatorial-edge guard amplitude first',
        'do not mirror the NH 30-45° target-entry exclusion into the south',
        'do not push this back into the shoulder-selector lane in microphysics'
      ]
    }
  };
}

export function renderPhase1ZMReport(summary) {
  return `# Phase 1ZM Bilateral Equatorial-Edge Source Redesign

## Verdict

- ${summary.verdict}
- Next phase: ${summary.nextPhase}
- ${summary.recommendation}

## Why Phase 1ZL Could Not Become Bilateral

- north source support on: \`${summary.evidence.northSource.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- south source support on: \`${summary.evidence.southSource.equatorialEdgeSubsidenceGuardSourceSupportDiagFrac}\`
- north target weight on: \`${summary.evidence.northEdge.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac}\`
- south target weight on: \`${summary.evidence.southEdge.equatorialEdgeSubsidenceGuardTargetWeightDiagFrac}\`
- north applied guard on: \`${summary.evidence.northEdge.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`
- south applied guard on: \`${summary.evidence.southEdge.equatorialEdgeSubsidenceGuardAppliedDiagPaS}\`

## Signed-Latitude Inheritance Evidence

- north inner-shoulder window on: \`${summary.evidence.northSource.freshShoulderInnerWindowDiagFrac}\`
- south inner-shoulder window on: \`${summary.evidence.southSource.freshShoulderInnerWindowDiagFrac}\`
- north edge window on: \`${summary.evidence.northEdge.freshShoulderEquatorialEdgeWindowDiagFrac}\`
- south edge window on: \`${summary.evidence.southEdge.freshShoulderEquatorialEdgeWindowDiagFrac}\`
- target-entry exclusion on: \`${summary.evidence.targetEntry.freshShoulderTargetEntryExclusionDiagFrac}\`
- signed-latitude inheritance score: \`${summary.inheritedFailure.signedLatitudeInheritanceScore}\`

## Residual Edge Response

- 3.75° condensation delta: \`${summary.evidence.northEdgeDelta.largeScaleCondensationSourceKgM2}\`
- -3.75° condensation delta: \`${summary.evidence.southEdgeDelta.largeScaleCondensationSourceKgM2}\`

## Next Patch Contract

${summary.redesignContract.keep.map((item) => `- keep: ${item}`).join('\n')}
${summary.redesignContract.change.map((item) => `- change: ${item}`).join('\n')}
${summary.redesignContract.doNotDo.map((item) => `- do not: ${item}`).join('\n')}
`;
}

function parseArgs(argv) {
  const options = {
    phase1zlPath: defaultPhase1ZLPath,
    reportPath: defaultReportPath,
    jsonPath: defaultJsonPath
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phase1zl' && argv[i + 1]) options.phase1zlPath = argv[++i];
    else if (arg.startsWith('--phase1zl=')) options.phase1zlPath = arg.slice('--phase1zl='.length);
    else if (arg === '--report' && argv[i + 1]) options.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else if (arg === '--json' && argv[i + 1]) options.jsonPath = argv[++i];
    else if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const summary = buildPhase1ZMBilateralEquatorialEdgeSourceRedesign({
    phase1zlSummary: readJson(options.phase1zlPath),
    paths: options
  });
  const report = renderPhase1ZMReport(summary);
  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.reportPath, report);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${report}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
