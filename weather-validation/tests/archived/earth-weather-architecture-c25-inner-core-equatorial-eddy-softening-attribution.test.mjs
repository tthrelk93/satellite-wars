import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC25Decision,
  renderArchitectureC25Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.mjs';

test('classifyC25Decision recognizes lower-mid relief with upper carryover rebound', () => {
  const decision = classifyC25Decision({
    c22CrossEq: -355.11907,
    c24CrossEq: -358.07208,
    c22ItczWidth: 23.499,
    c24ItczWidth: 23.275,
    c22DryNorth: 1.137,
    c24DryNorth: 1.091,
    c22DrySouth: 0.51,
    c24DrySouth: 0.506,
    c22EqBoundary: -5.01709,
    c24EqBoundary: -4.84216,
    c22EqLower: -17.83744,
    c24EqLower: -17.49403,
    c22EqMid: -16.77592,
    c24EqMid: -16.75772,
    c22EqUpper: -13.3117,
    c24EqUpper: -13.59209,
    c22EqLowerZonal: -14.07888,
    c24EqLowerZonal: -13.80457,
    c22EqLowerEddy: -3.75856,
    c24EqLowerEddy: -3.68946,
    c22EqMidZonal: -13.11577,
    c24EqMidZonal: -12.99397,
    c22EqMidEddy: -3.66015,
    c24EqMidEddy: -3.76374,
    c22Carryover: 0.22097,
    c24Carryover: 0.23253,
    c22Persistence: 0.21933,
    c24Persistence: 0.23079,
    c22WeakErosion: 0.21143,
    c24WeakErosion: 0.22243,
    c22CloudRecirc: 0.39849,
    c24CloudRecirc: 0.49385,
    c22NorthReturn: 3348.50751,
    c24NorthReturn: 3447.36194
  });

  assert.equal(decision.verdict, 'inner_core_narrowing_relieves_lower_mid_core_but_reopens_upper_carryover_shoulder');
  assert.equal(decision.nextMove, 'Architecture C26: partial equatorial shoulder restore experiment');
});

test('renderArchitectureC25Markdown includes the shoulder-restore follow-up contract', () => {
  const markdown = renderArchitectureC25Markdown({
    decision: {
      verdict: 'inner_core_narrowing_relieves_lower_mid_core_but_reopens_upper_carryover_shoulder',
      nextMove: 'Architecture C26: partial equatorial shoulder restore experiment'
    },
    quickComparison: {
      c22CrossEq: -355.11907,
      c24CrossEq: -358.07208,
      c22ItczWidth: 23.499,
      c24ItczWidth: 23.275,
      c22DryNorth: 1.137,
      c24DryNorth: 1.091,
      c22DrySouth: 0.51,
      c24DrySouth: 0.506,
      c22Westerlies: 1.216,
      c24Westerlies: 1.214,
      c22OceanCond: 0.11658,
      c24OceanCond: 0.12705
    },
    transportComparison: {
      c22EqBoundary: -5.01709,
      c24EqBoundary: -4.84216,
      c22EqLower: -17.83744,
      c24EqLower: -17.49403,
      c22EqMid: -16.77592,
      c24EqMid: -16.75772,
      c22EqUpper: -13.3117,
      c24EqUpper: -13.59209,
      c22EqLowerZonal: -14.07888,
      c24EqLowerZonal: -13.80457,
      c22EqLowerEddy: -3.75856,
      c24EqLowerEddy: -3.68946,
      c22EqMidZonal: -13.11577,
      c24EqMidZonal: -12.99397,
      c22EqMidEddy: -3.66015,
      c24EqMidEddy: -3.76374,
      c22North35Lower: -22.70728,
      c24North35Lower: -22.69662,
      c22North35Mid: -17.24626,
      c24North35Mid: -17.16362
    },
    dryBeltComparison: {
      c22Carryover: 0.22097,
      c24Carryover: 0.23253,
      c22Persistence: 0.21933,
      c24Persistence: 0.23079,
      c22WeakErosion: 0.21143,
      c24WeakErosion: 0.22243,
      c22UpperCloudPath: 0.23374,
      c24UpperCloudPath: 0.24474,
      c22CloudRecirc: 0.39849,
      c24CloudRecirc: 0.49385,
      c22NorthReturn: 3348.50751,
      c24NorthReturn: 3447.36194,
      c22TransitionFlux: -207.00073,
      c24TransitionFlux: -190.46264,
      c22DryBeltFlux: -411.49156,
      c24DryBeltFlux: -414.35421
    },
    thermodynamicComparison: {
      c22PrimaryRegime: 'dynamicsSupported',
      c24PrimaryRegime: 'dynamicsSupported',
      c22DynamicsSupport: 0.70377,
      c24DynamicsSupport: 0.6811,
      c22MoistureSupport: 0.57803,
      c24MoistureSupport: 0.57993
    },
    nextContract: {
      focusTargets: [
        'restore only a modest outer shoulder between roughly 10–12° or 10–14°'
      ]
    }
  });

  assert.match(markdown, /Architecture C25 Inner-Core Equatorial Eddy Softening Attribution/);
  assert.match(markdown, /partial shoulder restore/);
  assert.match(markdown, /upper-troposphere total-water flux north/);
});
