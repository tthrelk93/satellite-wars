import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC21Decision,
  renderArchitectureC21Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c21-eddy-softening-implementation-attribution.mjs';

test('classifyC21Decision recognizes return-branch carryover rebound under global eddy softening', () => {
  const decision = classifyC21Decision({
    c17CrossEq: -353.32,
    c20CrossEq: -361.49,
    c17EquatorEddy: -109.9,
    c20EquatorEddy: -114.18,
    c17EquatorZonal: -249.96,
    c20EquatorZonal: -254.59,
    c17North35Vapor: -373.49,
    c20North35Vapor: -350.1,
    c17Carryover: 0.22666,
    c20Carryover: 0.27973,
    c17Persistence: 0.22501,
    c20Persistence: 0.27804,
    c17WeakErosion: 0.21732,
    c20WeakErosion: 0.26804,
    c17CloudRecirc: 0.39988,
    c20CloudRecirc: 1.34927,
    c17NorthReturn: 3368.16,
    c20NorthReturn: 3490.31
  });

  assert.equal(decision.verdict, 'global_eddy_softening_reactivates_return_branch_carryover_without_fixing_equatorial_export');
  assert.equal(decision.nextMove, 'Architecture C22: equatorial-band eddy softening carveout experiment');
});

test('renderArchitectureC21Markdown includes the equatorial-band follow-up contract', () => {
  const markdown = renderArchitectureC21Markdown({
    decision: {
      verdict: 'global_eddy_softening_reactivates_return_branch_carryover_without_fixing_equatorial_export',
      nextMove: 'Architecture C22: equatorial-band eddy softening carveout experiment'
    },
    quickComparison: {
      c17CrossEq: -353.32,
      c20CrossEq: -361.49,
      c17ItczWidth: 23.45,
      c20ItczWidth: 23.26,
      c17DryNorth: 1.121,
      c20DryNorth: 1.152,
      c17DrySouth: 0.511,
      c20DrySouth: 0.504,
      c17Westerlies: 1.202,
      c20Westerlies: 1.209,
      c17OceanCond: 0.14144,
      c20OceanCond: 0.13877
    },
    transportComparison: {
      c17EquatorZonal: -249.96,
      c20EquatorZonal: -254.59,
      c17EquatorEddy: -109.9,
      c20EquatorEddy: -114.18,
      c17EquatorMidUpper: -226.72,
      c20EquatorMidUpper: -234.62,
      c17EquatorVelocity: -20.8,
      c20EquatorVelocity: -21.02,
      c17North35Vapor: -373.49,
      c20North35Vapor: -350.1
    },
    carryoverComparison: {
      c17Carryover: 0.22666,
      c20Carryover: 0.27973,
      c17Persistence: 0.22501,
      c20Persistence: 0.27804,
      c17WeakErosion: 0.21732,
      c20WeakErosion: 0.26804,
      c17CloudRecirc: 0.39988,
      c20CloudRecirc: 1.34927,
      c17NorthReturn: 3368.16,
      c20NorthReturn: 3490.31
    },
    thermodynamicComparison: {
      c17PrimaryRegime: 'dynamicsSupported',
      c20PrimaryRegime: 'mixed',
      c17DynamicsSupport: 0.68867,
      c20DynamicsSupport: 0.64311,
      c17MoistureSupport: 0.59061,
      c20MoistureSupport: 0.57999
    },
    nextContract: {
      focusTargets: ['equatorial latitude-gated softening in windEddyNudge5.js']
    }
  });

  assert.match(markdown, /Architecture C21 Eddy-Softening Implementation Attribution/);
  assert.match(markdown, /equatorial-band eddy softening carveout experiment/);
});
