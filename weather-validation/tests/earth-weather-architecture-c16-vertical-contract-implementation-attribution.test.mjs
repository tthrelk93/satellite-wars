import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC16Decision,
  renderArchitectureC16Markdown
} from '../../scripts/agent/earth-weather-architecture-c16-vertical-contract-implementation-attribution.mjs';

test('classifyC16Decision recognizes zonal relief offset by carryover recirculation', () => {
  const decision = classifyC16Decision({
    c13CrossEq: -330.99,
    c15CrossEq: -364.55,
    c13EquatorZonal: -301.64,
    c15EquatorZonal: -274.13,
    c13EquatorEddy: -34.29,
    c15EquatorEddy: -96.97,
    c13North35Vapor: -467.09,
    c15North35Vapor: -360.62,
    c13Carryover: 0,
    c15Carryover: 0.39,
    c13Persistence: 0,
    c15Persistence: 0.39,
    c13WeakErosion: 0,
    c15WeakErosion: 0.38,
    c13CloudRecirc: 0,
    c15CloudRecirc: 2.22
  });

  assert.equal(decision.verdict, 'zonal_mean_relief_offset_by_upper_cloud_carryover_recirculation');
  assert.equal(decision.nextMove, 'Architecture C17: zonal-mean-preserving upper-cloud carryover carveout experiment');
});

test('renderArchitectureC16Markdown includes the carveout contract', () => {
  const markdown = renderArchitectureC16Markdown({
    decision: {
      verdict: 'zonal_mean_relief_offset_by_upper_cloud_carryover_recirculation',
      nextMove: 'Architecture C17: zonal-mean-preserving upper-cloud carryover carveout experiment'
    },
    quickComparison: {
      c13CrossEq: -330.99,
      c15CrossEq: -364.55,
      c13ItczWidth: 23.88,
      c15ItczWidth: 24.09,
      c13DryNorth: 1.152,
      c15DryNorth: 1.404,
      c13OceanCond: 0.126,
      c15OceanCond: 0.153
    },
    transportComparison: {
      c13EquatorZonal: -301.64,
      c15EquatorZonal: -274.13,
      c13EquatorEddy: -34.29,
      c15EquatorEddy: -96.97,
      c13EquatorMidUpper: -203.66,
      c15EquatorMidUpper: -239.14,
      c13North35Vapor: -467.09,
      c15North35Vapor: -360.62
    },
    carryoverComparison: {
      c13Carryover: 0,
      c15Carryover: 0.39,
      c13Persistence: 0,
      c15Persistence: 0.39,
      c13WeakErosion: 0,
      c15WeakErosion: 0.38,
      c13CloudRecirc: 0,
      c15CloudRecirc: 2.22
    },
    thermodynamicComparison: {
      c13PrimaryRegime: 'moistureSupported',
      c15PrimaryRegime: 'dynamicsSupported',
      c13DynamicsSupport: 0.2,
      c15DynamicsSupport: 0.72656
    },
    nextContract: {
      carveoutTargets: [
        'carriedOverUpperCloudMass / importedAnvilPersistenceMass accumulation path'
      ]
    }
  });

  assert.match(markdown, /Architecture C16 Vertical-Contract Implementation Attribution/);
  assert.match(markdown, /upper-cloud carryover/i);
  assert.match(markdown, /Architecture C17: zonal-mean-preserving upper-cloud carryover carveout experiment/);
});
