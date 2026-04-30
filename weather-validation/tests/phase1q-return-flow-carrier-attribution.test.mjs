import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1QReturnFlowCarrierAttribution,
  renderPhase1QReport
} from '../../scripts/agent/phase1q-return-flow-carrier-attribution.mjs';

test('phase 1Q ranks source-driver-to-drying conversion failure when coupling is active but drying and jet stay flat', () => {
  const summary = buildPhase1QReturnFlowCarrierAttribution({
    baselineMetrics: {
      itczWidthDeg: 23.646,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.519,
      midlatitudeWesterliesNorthU10Ms: 1.192
    },
    offMetrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.16716,
      northDryBeltSubtropicalSourceDriverMeanFrac: 0.16716,
      northTransitionSubtropicalSubsidenceDryingMeanFrac: 0.121,
      northDryBeltSubtropicalSubsidenceDryingMeanFrac: 0.131,
      northTransitionLowLevelOmegaEffectiveMeanPaS: -0.052,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: -0.044
    },
    onMetrics: {
      itczWidthDeg: 26.055,
      subtropicalDryNorthRatio: 1.572,
      subtropicalDrySouthRatio: 1.203,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0.00975,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.16827,
      northDryBeltSubtropicalSourceDriverMeanFrac: 0.16827,
      northTransitionSubtropicalSubsidenceDryingMeanFrac: 0.1212,
      northDryBeltSubtropicalSubsidenceDryingMeanFrac: 0.1311,
      northTransitionLowLevelOmegaEffectiveMeanPaS: -0.0521,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: -0.0441
    },
    paths: {
      baselinePath: '/tmp/baseline.json',
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'source_driver_to_drying_conversion_failure');
  assert.equal(summary.nextPhase, 'Phase 1R: Drying Conversion Patch Design');
  assert.equal(summary.ranking[0].key, 'source_driver_to_drying_conversion_failure');
  assert.ok(summary.carrierChain.northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac > 0);
  const rendered = renderPhase1QReport(summary);
  assert.match(rendered, /Phase 1Q Return-Flow Carrier Attribution/);
  assert.match(rendered, /Drying Conversion Patch Design/);
});
