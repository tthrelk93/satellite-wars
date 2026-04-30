import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1NReturnFlowAttribution, renderPhase1NReport } from '../../scripts/agent/phase1n-return-flow-rebound-attribution.mjs';

test('phase 1N attribution ranks return-flow driver partition mismatch when containment is active but NH westerlies stay flat', () => {
  const summary = buildPhase1NReturnFlowAttribution({
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
      northTransitionCirculationReboundContainmentMeanFrac: 0,
      southTransitionCirculationReboundContainmentMeanFrac: 0,
      northTransitionCirculationReboundSourceSuppressionMeanFrac: 0,
      southTransitionCirculationReboundSourceSuppressionMeanFrac: 0,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.71,
      southTransitionSubtropicalSourceDriverMeanFrac: 0.7,
      northDryBeltSubtropicalSourceDriverMeanFrac: 0.61,
      southDryBeltSubtropicalSourceDriverMeanFrac: 0.6
    },
    onMetrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14647,
      northTransitionCirculationReboundContainmentMeanFrac: 0.81272,
      southTransitionCirculationReboundContainmentMeanFrac: 0.70617,
      northTransitionCirculationReboundSourceSuppressionMeanFrac: 0.612,
      southTransitionCirculationReboundSourceSuppressionMeanFrac: 0.51949,
      northTransitionSubtropicalSourceDriverMeanFrac: 0.706,
      southTransitionSubtropicalSourceDriverMeanFrac: 0.699,
      northDryBeltSubtropicalSourceDriverMeanFrac: 0.614,
      southDryBeltSubtropicalSourceDriverMeanFrac: 0.608,
      northTransitionSubtropicalSourceDriverFloorMeanFrac: 0.676,
      southTransitionSubtropicalSourceDriverFloorMeanFrac: 0.671,
      northTransitionSubtropicalLocalHemiSourceMeanFrac: 0.41,
      southTransitionSubtropicalLocalHemiSourceMeanFrac: 0.42,
      northTransitionSubtropicalMeanTropicalSourceMeanFrac: 0.72,
      southTransitionSubtropicalMeanTropicalSourceMeanFrac: 0.72,
      northTransitionSubtropicalCrossHemiFloorShareMeanFrac: 0.39,
      southTransitionSubtropicalCrossHemiFloorShareMeanFrac: 0.37,
      northTransitionSubtropicalWeakHemiFracMean: 0.18,
      southTransitionSubtropicalWeakHemiFracMean: 0.16
    },
    paths: {
      baselinePath: '/tmp/baseline.json',
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json'
    }
  });

  assert.equal(summary.verdict, 'return_flow_driver_partition_mismatch');
  assert.ok(
    ['transition_response_without_return_flow', 'hemispheric_source_symmetry', 'cross_hemi_floor_dominance']
      .includes(summary.ranking[0].key)
  );
  assert.ok(summary.ranking.some((item) => item.key === 'cross_hemi_floor_dominance'));
  const rendered = renderPhase1NReport(summary);
  assert.match(rendered, /Phase 1N Return-Flow Rebound Attribution/);
  assert.match(rendered, /cross-hemi floor share/i);
});
