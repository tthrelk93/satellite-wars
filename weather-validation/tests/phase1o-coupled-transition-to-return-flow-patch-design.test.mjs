import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1ODesign,
  renderPhase1OReport
} from '../../scripts/agent/phase1o-coupled-transition-to-return-flow-patch-design.mjs';

test('phase 1O design identifies missing transition-to-return-flow coupling when containment is active but westerlies stay flat', () => {
  const summary = buildPhase1ODesign({
    baselineMetrics: {
      itczWidthDeg: 23.646,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.519,
      midlatitudeWesterliesNorthU10Ms: 1.192
    },
    offMetrics: {
      itczWidthDeg: 25.874,
      subtropicalDryNorthRatio: 1.524,
      subtropicalDrySouthRatio: 1.194,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1526,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.17036,
      southTransitionSubtropicalSourceDriverMeanFrac: 0.07748
    },
    onMetrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14647,
      northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2: 0.03934,
      northTransitionCirculationReboundContainmentMeanFrac: 0.81272,
      southTransitionCirculationReboundContainmentMeanFrac: 0.70617,
      northTransitionCirculationReboundSuppressedSourceMeanFrac: 0.118,
      southTransitionCirculationReboundSuppressedSourceMeanFrac: 0.084,
      northTransitionCirculationReboundSuppressedSourceShareMeanFrac: 0.61,
      southTransitionCirculationReboundSuppressedSourceShareMeanFrac: 0.52,
      northDryBeltCirculationReturnFlowOpportunityMeanFrac: 0.131,
      southDryBeltCirculationReturnFlowOpportunityMeanFrac: 0.094,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.16716,
      southTransitionSubtropicalSourceDriverMeanFrac: 0.07608
    },
    paths: {
      baselinePath: '/baseline.json',
      offPath: '/off.json',
      onPath: '/on.json'
    }
  });

  assert.equal(summary.verdict, 'missing_transition_to_return_flow_coupling');
  assert.equal(summary.ranking[0].key, 'missing_transition_to_return_flow_coupling');
  assert.match(summary.patchDesign.mechanism, /same-hemisphere transition-suppressed convective source/i);
  const rendered = renderPhase1OReport(summary);
  assert.match(rendered, /Phase 1O Coupled Transition-To-Return-Flow Patch Design/);
  assert.match(rendered, /North\/South transition suppressed source/);
});
