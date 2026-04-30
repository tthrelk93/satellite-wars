import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC18Decision,
  renderArchitectureC18Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c18-carryover-carveout-implementation-attribution.mjs';

test('classifyC18Decision recognizes carryover relief with an unresolved eddy blocker', () => {
  const decision = classifyC18Decision({
    c15CrossEq: -364.55,
    c17CrossEq: -353.32,
    c15EquatorZonal: -274.13,
    c17EquatorZonal: -249.96,
    c15EquatorEddy: -96.97,
    c17EquatorEddy: -109.9,
    c15EquatorMidUpper: -239.14,
    c17EquatorMidUpper: -226.72,
    c15North35Vapor: -360.62,
    c17North35Vapor: -373.49,
    c15Carryover: 0.39867,
    c17Carryover: 0.22666,
    c15Persistence: 0.39786,
    c17Persistence: 0.22501,
    c15WeakErosion: 0.38477,
    c17WeakErosion: 0.21732,
    c15CloudRecirc: 2.22467,
    c17CloudRecirc: 0.39988
  });

  assert.equal(decision.verdict, 'carryover_carveout_relief_preserves_zonal_mean_but_eddy_export_remains_primary_blocker');
  assert.equal(decision.nextMove, 'Architecture C19: zonal-mean-preserving eddy export attribution');
});

test('renderArchitectureC18Markdown includes the eddy-export next contract', () => {
  const markdown = renderArchitectureC18Markdown({
    decision: {
      verdict: 'carryover_carveout_relief_preserves_zonal_mean_but_eddy_export_remains_primary_blocker',
      nextMove: 'Architecture C19: zonal-mean-preserving eddy export attribution'
    },
    quickComparison: {
      c15CrossEq: -364.55,
      c17CrossEq: -353.32,
      c15ItczWidth: 24.09,
      c17ItczWidth: 23.45,
      c15DryNorth: 1.404,
      c17DryNorth: 1.121,
      c15DrySouth: 0.589,
      c17DrySouth: 0.511,
      c15Westerlies: 1.209,
      c17Westerlies: 1.202,
      c15OceanCond: 0.15331,
      c17OceanCond: 0.14144
    },
    transportComparison: {
      c15EquatorZonal: -274.13,
      c17EquatorZonal: -249.96,
      c15EquatorEddy: -96.97,
      c17EquatorEddy: -109.9,
      c15EquatorMidUpper: -239.14,
      c17EquatorMidUpper: -226.72,
      c15EquatorVelocity: -20.24,
      c17EquatorVelocity: -20.8,
      c15North35Vapor: -360.62,
      c17North35Vapor: -373.49
    },
    carryoverComparison: {
      c15Carryover: 0.39867,
      c17Carryover: 0.22666,
      c15Persistence: 0.39786,
      c17Persistence: 0.22501,
      c15WeakErosion: 0.38477,
      c17WeakErosion: 0.21732,
      c15CloudRecirc: 2.22467,
      c17CloudRecirc: 0.39988
    },
    thermodynamicComparison: {
      c15PrimaryRegime: 'dynamicsSupported',
      c17PrimaryRegime: 'dynamicsSupported',
      c15DynamicsSupport: 0.72656,
      c17DynamicsSupport: 0.68867,
      c15MoistureSupport: 0.55332,
      c17MoistureSupport: 0.59061
    },
    nextContract: {
      focusTargets: [
        'equatorial eddy vapor-flux branch in the transport-interface budget'
      ]
    }
  });

  assert.match(markdown, /Architecture C18 Carryover Carveout Implementation Attribution/);
  assert.match(markdown, /equator eddy vapor flux north/i);
  assert.match(markdown, /Architecture C19: zonal-mean-preserving eddy export attribution/);
});
