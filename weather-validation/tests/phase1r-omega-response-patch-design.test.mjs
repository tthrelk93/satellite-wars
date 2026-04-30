import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1ROmegaResponseDesign,
  renderPhase1RReport
} from '../../scripts/agent/phase1r-omega-response-patch-design.mjs';

test('phase 1R design identifies the missing same-step drying-to-omega bridge', () => {
  const summary = buildPhase1ROmegaResponseDesign({
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
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14647,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.16716,
      northDryBeltSubtropicalSourceDriverMeanFrac: 0.16716,
      northTransitionSubtropicalSubsidenceDryingMeanFrac: 0.12523,
      northDryBeltSubtropicalSubsidenceDryingMeanFrac: 0.08518,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06637,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01565
    },
    onMetrics: {
      itczWidthDeg: 26.055,
      subtropicalDryNorthRatio: 1.572,
      subtropicalDrySouthRatio: 1.203,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14768,
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0.00975,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.16827,
      northDryBeltSubtropicalSourceDriverMeanFrac: 0.16827,
      northTransitionSubtropicalSubsidenceDryingMeanFrac: 0.1432,
      northDryBeltSubtropicalSubsidenceDryingMeanFrac: 0.09595,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06679,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01463
    },
    paths: {
      baselinePath: '/baseline.json',
      offPath: '/off.json',
      onPath: '/on.json'
    }
  });

  assert.equal(summary.verdict, 'same_step_drying_to_omega_bridge_missing');
  assert.equal(summary.nextPhase, 'Phase 1S: Implement capped drying-to-omega bridge patch');
  assert.equal(summary.ranking[0].key, 'same_step_drying_to_omega_bridge_missing');
  assert.match(summary.patchDesign.mechanism, /same-step omega-response bridge/i);
  const rendered = renderPhase1RReport(summary);
  assert.match(rendered, /Phase 1R Omega Response Patch Design/);
  assert.match(rendered, /Phase 1S: Implement capped drying-to-omega bridge patch/);
});
