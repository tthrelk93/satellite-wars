import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1ZESuppressedMassFateCounterfactuals
} from '../../scripts/agent/phase1ze-suppressed-mass-fate-counterfactuals.mjs';

test('phase 1ZE prefers sink/export when it clears shoulder recharge and spillover without target-entry leakage', () => {
  const latitudesDeg = [3.75, 11.25, 18.75, 26.25, 33.75];
  const offAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.834,
        subtropicalDryNorthRatio: 1.515,
        subtropicalDrySouthRatio: 1.192,
        midlatitudeWesterliesNorthU10Ms: 0.531
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.09188, 0.14437, 0.10944, 0.10811, 0.17971],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardRetainedVaporKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardSinkExportKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0, 0, 0, 0, 0]
        }
      }
    }]
  };

  const retainAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.89,
        subtropicalDryNorthRatio: 1.527,
        subtropicalDrySouthRatio: 1.197,
        midlatitudeWesterliesNorthU10Ms: 0.531
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.103, 0.16531, 0.115, 0.10811, 0.17971],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.0122, 0.02496, 0, 0, 0],
          shoulderAbsorptionGuardRetainedVaporKgM2: [0.011, 0.0205, 0, 0, 0],
          shoulderAbsorptionGuardSinkExportKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0, 0, 0, 0, 0]
        }
      }
    }]
  };

  const sinkAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.81,
        subtropicalDryNorthRatio: 1.508,
        subtropicalDrySouthRatio: 1.191,
        midlatitudeWesterliesNorthU10Ms: 0.531
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.084, 0.139, 0.104, 0.10811, 0.17971],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.0104, 0.0214, 0, 0, 0],
          shoulderAbsorptionGuardRetainedVaporKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardSinkExportKgM2: [0.0104, 0.0214, 0, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0, 0, 0, 0, 0]
        }
      }
    }]
  };

  const bufferedAudit = {
    samples: [{
      metrics: {
        itczWidthDeg: 25.845,
        subtropicalDryNorthRatio: 1.516,
        subtropicalDrySouthRatio: 1.193,
        midlatitudeWesterliesNorthU10Ms: 0.531
      },
      profiles: {
        latitudesDeg,
        series: {
          largeScaleCondensationSourceKgM2: [0.0905, 0.1455, 0.111, 0.10811, 0.17971],
          shoulderAbsorptionGuardAppliedSuppressionKgM2: [0.0091, 0.0182, 0, 0, 0.0002],
          shoulderAbsorptionGuardRetainedVaporKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardSinkExportKgM2: [0, 0, 0, 0, 0],
          shoulderAbsorptionGuardBufferedRainoutKgM2: [0.0091, 0.0182, 0, 0, 0]
        }
      }
    }]
  };

  const summary = buildPhase1ZESuppressedMassFateCounterfactuals({
    offAudit,
    retainAudit,
    sinkAudit,
    bufferedAudit,
    paths: {
      offPath: '/tmp/off.json',
      retainPath: '/tmp/retain.json',
      sinkPath: '/tmp/sink.json',
      bufferedPath: '/tmp/buffered.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'winner_found');
  assert.equal(summary.nextPhase, 'Phase 1ZF: Implement sink_export shoulder fate patch');
  assert.equal(summary.winner.key, 'sink_export');
  assert.equal(summary.ranking[0].key, 'sink_export');
  assert.equal(summary.ranking[0].exitCriteriaPass, true);
  assert.ok((summary.ranking[0].fateDiagnostics.sinkExportKgM2 || 0) > 0);
  assert.ok((summary.ranking[1].deltas.shoulderSpilloverKgM2 || 0) >= 0);
});
