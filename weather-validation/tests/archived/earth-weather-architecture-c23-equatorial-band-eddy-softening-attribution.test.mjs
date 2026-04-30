import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC23Decision,
  renderArchitectureC23Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.mjs';

test('classifyC23Decision recognizes preserved dry-belt relief with a deeper lower-mid zonal branch', () => {
  const decision = classifyC23Decision({
    c17CrossEq: -353.31687,
    c22CrossEq: -355.11907,
    c17Carryover: 0.22666,
    c22Carryover: 0.22097,
    c17Persistence: 0.22501,
    c22Persistence: 0.21933,
    c17WeakErosion: 0.21732,
    c22WeakErosion: 0.21143,
    c17CloudRecirc: 0.39988,
    c22CloudRecirc: 0.39849,
    c17NorthReturn: 3368.15697,
    c22NorthReturn: 3348.50751,
    c17EqUpper: -13.44686,
    c22EqUpper: -13.3117,
    c17EqLowerZonal: -13.99991,
    c22EqLowerZonal: -14.07888,
    c17EqMidZonal: -12.93476,
    c22EqMidZonal: -13.11577
  });

  assert.equal(decision.verdict, 'equatorial_band_softening_preserves_dry_belt_relief_but_deepens_lower_mid_zonal_branch');
  assert.equal(decision.nextMove, 'Architecture C24: inner-core equatorial eddy softening experiment');
});

test('renderArchitectureC23Markdown includes the inner-core follow-up contract', () => {
  const markdown = renderArchitectureC23Markdown({
    decision: {
      verdict: 'equatorial_band_softening_preserves_dry_belt_relief_but_deepens_lower_mid_zonal_branch',
      nextMove: 'Architecture C24: inner-core equatorial eddy softening experiment'
    },
    quickComparison: {
      c17CrossEq: -353.31687,
      c22CrossEq: -355.11907,
      c17ItczWidth: 23.454,
      c22ItczWidth: 23.499,
      c17DryNorth: 1.121,
      c22DryNorth: 1.137,
      c17DrySouth: 0.511,
      c22DrySouth: 0.51,
      c17Westerlies: 1.202,
      c22Westerlies: 1.216,
      c17OceanCond: 0.14144,
      c22OceanCond: 0.11658
    },
    transportComparison: {
      c17EqBoundary: -4.91319,
      c22EqBoundary: -5.01709,
      c17EqLower: -17.72549,
      c22EqLower: -17.83744,
      c17EqMid: -16.60787,
      c22EqMid: -16.77592,
      c17EqUpper: -13.44686,
      c22EqUpper: -13.3117,
      c17EqLowerZonal: -13.99991,
      c22EqLowerZonal: -14.07888,
      c17EqLowerEddy: -3.72558,
      c22EqLowerEddy: -3.75856,
      c17EqMidZonal: -12.93476,
      c22EqMidZonal: -13.11577,
      c17EqMidEddy: -3.6731,
      c22EqMidEddy: -3.66015,
      c17North35Lower: -22.95457,
      c22North35Lower: -22.70728,
      c17North35Mid: -17.4169,
      c22North35Mid: -17.24626
    },
    dryBeltComparison: {
      c17Carryover: 0.22666,
      c22Carryover: 0.22097,
      c17Persistence: 0.22501,
      c22Persistence: 0.21933,
      c17WeakErosion: 0.21732,
      c22WeakErosion: 0.21143,
      c17UpperCloudPath: 0.24206,
      c22UpperCloudPath: 0.23374,
      c17CloudRecirc: 0.39988,
      c22CloudRecirc: 0.39849,
      c17NorthReturn: 3368.15697,
      c22NorthReturn: 3348.50751,
      c17TransitionFlux: -198.12637,
      c22TransitionFlux: -207.00073,
      c17DryBeltFlux: -413.42196,
      c22DryBeltFlux: -411.49156
    },
    thermodynamicComparison: {
      c17PrimaryRegime: 'dynamicsSupported',
      c22PrimaryRegime: 'dynamicsSupported',
      c17DynamicsSupport: 0.68867,
      c22DynamicsSupport: 0.70377,
      c17MoistureSupport: 0.59061,
      c22MoistureSupport: 0.57803
    },
    nextContract: {
      focusTargets: [
        'narrow the softening footprint from the full 4–16° band into the inner equatorial core'
      ]
    }
  });

  assert.match(markdown, /Architecture C23 Equatorial-Band Eddy Softening Attribution/);
  assert.match(markdown, /inner equatorial core/);
  assert.match(markdown, /lower zonal-mean transport/);
});
