import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZBLatitudeAwareShoulderGuardRedesign } from '../../scripts/agent/phase1zb-latitude-aware-shoulder-guard-redesign.mjs';

test('phase 1ZB passes when the selector admits 3.75N and excludes 33.75N without worsening guardrails', () => {
  const latitudesDeg = [3.75, 11.25, 26.25, 33.75];
  const offAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.792,
        subtropicalDryNorthRatio: 1.508,
        subtropicalDrySouthRatio: 1.193
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.10207, 0.14696, 0.11529, 0.13135],
          shoulderAbsorptionGuardCandidateMassKgM2: [0, 0.09505, 0, 0.07203],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0.0053, 0, 0.0141],
          shoulderAbsorptionGuardBandWindowFrac: [0, 0.01442, 0, 0.07201],
          shoulderAbsorptionGuardSelectorSupportFrac: [0, 0.00602, 0, 0.0288],
          freshShoulderLatitudeWindowDiagFrac: [0, 0, 0, 0],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 0],
          dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0]
        }
      }
    }]
  };
  const onAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.74,
        subtropicalDryNorthRatio: 1.49,
        subtropicalDrySouthRatio: 1.188
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.083, 0.128, 0.115, 0.133],
          shoulderAbsorptionGuardCandidateMassKgM2: [0.034, 0.081, 0, 0],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.011, 0.016, 0, 0],
          shoulderAbsorptionGuardBandWindowFrac: [0.94, 0.88, 0, 0],
          shoulderAbsorptionGuardSelectorSupportFrac: [0.028, 0.041, 0, 0],
          freshShoulderLatitudeWindowDiagFrac: [1, 1, 0, 0],
          freshShoulderTargetEntryExclusionDiagFrac: [0, 0, 0, 1],
          dryingOmegaBridgeProjectedAppliedPaS: [0, 0, 0, 0]
        }
      }
    }]
  };

  const summary = buildPhase1ZBLatitudeAwareShoulderGuardRedesign({
    offAudit,
    onAudit,
    paths: {
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'selector_redesigned');
  assert.equal(summary.exitCriteria.strongestShoulderAdmittedPass, true);
  assert.equal(summary.exitCriteria.targetEntryExcludedPass, true);
  assert.equal(summary.exitCriteria.guardrailPass, true);
  assert.equal(summary.nextPhase, 'Phase 2A: Finish Hadley Moisture Partitioning');
});
