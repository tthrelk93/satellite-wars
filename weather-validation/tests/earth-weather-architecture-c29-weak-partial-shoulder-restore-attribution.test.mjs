import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC29Decision,
  renderArchitectureC29Markdown
} from '../../scripts/agent/earth-weather-architecture-c29-weak-partial-shoulder-restore-attribution.mjs';

test('classifyC29Decision recognizes improved equatorial export with worse dry-belt carryover', () => {
  const decision = classifyC29Decision({
    c26CrossEq: -353.85346,
    c28CrossEq: -323.23581,
    c26EqLower: -18.00423,
    c28EqLower: -16.93964,
    c26EqMid: -16.6919,
    c28EqMid: -14.80431,
    c26EqUpper: -13.23333,
    c28EqUpper: -11.22308,
    c26EqLowerEddy: -3.85782,
    c28EqLowerEddy: -2.44586,
    c26EqMidEddy: -3.72808,
    c28EqMidEddy: -0.68108,
    c26EqUpperEddy: -5.17743,
    c28EqUpperEddy: -2.40458,
    c26OceanCond: 0.11952,
    c28OceanCond: 0.15539,
    c26Carryover: 0.2348,
    c28Carryover: 0.24485,
    c26CloudRecirc: 0.60796,
    c28CloudRecirc: 0.74157,
    c26NorthReturn: 3383.23239,
    c28NorthReturn: 3444.87796
  });

  assert.equal(decision.verdict, 'weak_restore_relieves_equatorial_eddy_export_but_reopens_dry_belt_carryover_condensation');
  assert.equal(decision.nextMove, 'Architecture C30: weak restore carry-input recapture experiment');
});

test('renderArchitectureC29Markdown includes the carry-input recapture contract', () => {
  const markdown = renderArchitectureC29Markdown({
    decision: {
      verdict: 'weak_restore_relieves_equatorial_eddy_export_but_reopens_dry_belt_carryover_condensation',
      nextMove: 'Architecture C30: weak restore carry-input recapture experiment'
    },
    quickComparison: {
      c26CrossEq: -353.85346,
      c28CrossEq: -323.23581,
      c26ItczWidth: 23.412,
      c28ItczWidth: 23.321,
      c26DryNorth: 1.119,
      c28DryNorth: 1.097,
      c26DrySouth: 0.515,
      c28DrySouth: 0.487,
      c26Westerlies: 1.225,
      c28Westerlies: 1.202,
      c26OceanCond: 0.11952,
      c28OceanCond: 0.15539
    },
    transportComparison: {
      c26EqLower: -18.00423,
      c28EqLower: -16.93964,
      c26EqMid: -16.6919,
      c28EqMid: -14.80431,
      c26EqUpper: -13.23333,
      c28EqUpper: -11.22308,
      c26EqLowerZonal: -14.14641,
      c28EqLowerZonal: -14.49379,
      c26EqLowerEddy: -3.85782,
      c28EqLowerEddy: -2.44586,
      c26EqMidZonal: -12.96382,
      c28EqMidZonal: -14.12323,
      c26EqMidEddy: -3.72808,
      c28EqMidEddy: -0.68108,
      c26EqUpperZonal: -8.0559,
      c28EqUpperZonal: -8.8185,
      c26EqUpperEddy: -5.17743,
      c28EqUpperEddy: -2.40458
    },
    dryBeltComparison: {
      c26OceanCond: 0.11952,
      c28OceanCond: 0.15539,
      c26Carryover: 0.2348,
      c28Carryover: 0.24485,
      c26Persistence: 0.23307,
      c28Persistence: 0.24284,
      c26WeakErosion: 0.22509,
      c28WeakErosion: 0.23434,
      c26CloudRecirc: 0.60796,
      c28CloudRecirc: 0.74157,
      c26NorthReturn: 3383.23239,
      c28NorthReturn: 3444.87796,
      c26DominantVaporImport: -23.20045,
      c28DominantVaporImport: -25.51113
    },
    thermodynamicComparison: {
      c26PrimaryRegime: 'mixed',
      c28PrimaryRegime: 'dynamicsSupported',
      c26DynamicsSupport: 0.63475,
      c28DynamicsSupport: 0.67121,
      c26MoistureSupport: 0.57525,
      c28MoistureSupport: 0.58473
    },
    nextContract: {
      focusTargets: [
        'strengthen the dry-belt carry-input override'
      ]
    }
  });

  assert.match(markdown, /Architecture C29 Weak Partial Shoulder Restore Attribution/);
  assert.match(markdown, /carry-input override/);
  assert.match(markdown, /NH dry-belt ocean condensation/);
});
