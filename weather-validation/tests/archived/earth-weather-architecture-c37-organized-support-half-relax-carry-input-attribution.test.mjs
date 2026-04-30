import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC37Decision,
  renderArchitectureC37Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c37-organized-support-half-relax-carry-input-attribution.mjs';

test('classifyC37Decision recognizes threshold-cliff reversion to C30', () => {
  const decision = classifyC37Decision({
    c30CrossEq: -353.96486,
    c36CrossEq: -353.96486,
    c30ItczWidth: 23.315,
    c36ItczWidth: 23.315,
    c30DryNorth: 1.093,
    c36DryNorth: 1.093,
    c30DrySouth: 0.502,
    c36DrySouth: 0.502,
    c30Westerlies: 1.232,
    c36Westerlies: 1.232,
    c30OceanCond: 0.12693,
    c36OceanCond: 0.12693,
    c30EqLower: -17.99024,
    c36EqLower: -17.99024,
    c30EqMid: -16.67245,
    c36EqMid: -16.67245,
    c30EqUpper: -12.94654,
    c36EqUpper: -12.94654,
    c30EqLowerZonal: -14.10166,
    c36EqLowerZonal: -14.10166,
    c30EqMidZonal: -12.98794,
    c36EqMidZonal: -12.98794,
    c30EqUpperZonal: -7.84381,
    c36EqUpperZonal: -7.84381,
    c30EqLowerEddy: -3.88858,
    c36EqLowerEddy: -3.88858,
    c30EqMidEddy: -3.6845,
    c36EqMidEddy: -3.6845,
    c30EqUpperEddy: -5.10272,
    c36EqUpperEddy: -5.10272,
    c30DryLower35: -22.46949,
    c36DryLower35: -22.46949,
    c30DryMid35: -16.40141,
    c36DryMid35: -16.40141,
    c30DryUpper35: -5.79198,
    c36DryUpper35: -5.79198,
    c30Carryover: 0.2187,
    c36Carryover: 0.2187,
    c30Persistence: 0.21701,
    c36Persistence: 0.21701,
    c30WeakErosion: 0.21225,
    c36WeakErosion: 0.21225,
    c30UpperCloudPath: 0.24025,
    c36UpperCloudPath: 0.24025,
    c30DominantVaporImport: -22.82573,
    c36DominantVaporImport: -22.82573,
    c30CloudRecirc: 1.18525,
    c36CloudRecirc: 1.18525,
    c30NorthReturn: 3500.90278,
    c36NorthReturn: 3500.90278,
    c30PrimaryRegime: 'mixed',
    c36PrimaryRegime: 'mixed',
    c30DynamicsSupport: 0.63593,
    c36DynamicsSupport: 0.63593,
    c30MoistureSupport: 0.58968,
    c36MoistureSupport: 0.58968
  });

  assert.equal(decision.verdict, 'organized_support_half_relax_inert_threshold_cliff_reverts_to_c30');
  assert.equal(decision.nextMove, 'Architecture C38: inner-core organized-support restore experiment');
});

test('renderArchitectureC37Markdown includes the threshold-cliff contract', () => {
  const markdown = renderArchitectureC37Markdown({
    decision: {
      verdict: 'organized_support_half_relax_inert_threshold_cliff_reverts_to_c30',
      nextMove: 'Architecture C38: inner-core organized-support restore experiment'
    },
    quickComparison: {
      c30CrossEq: -353.96486,
      c36CrossEq: -353.96486,
      c30ItczWidth: 23.315,
      c36ItczWidth: 23.315,
      c30DryNorth: 1.093,
      c36DryNorth: 1.093,
      c30DrySouth: 0.502,
      c36DrySouth: 0.502,
      c30Westerlies: 1.232,
      c36Westerlies: 1.232,
      c30OceanCond: 0.12693,
      c36OceanCond: 0.12693
    },
    transportComparison: {
      c30EqLower: -17.99024,
      c36EqLower: -17.99024,
      c30EqMid: -16.67245,
      c36EqMid: -16.67245,
      c30EqUpper: -12.94654,
      c36EqUpper: -12.94654,
      c30EqLowerZonal: -14.10166,
      c36EqLowerZonal: -14.10166,
      c30EqLowerEddy: -3.88858,
      c36EqLowerEddy: -3.88858,
      c30EqMidZonal: -12.98794,
      c36EqMidZonal: -12.98794,
      c30EqMidEddy: -3.6845,
      c36EqMidEddy: -3.6845,
      c30EqUpperZonal: -7.84381,
      c36EqUpperZonal: -7.84381,
      c30EqUpperEddy: -5.10272,
      c36EqUpperEddy: -5.10272,
      c30DryLower35: -22.46949,
      c36DryLower35: -22.46949,
      c30DryMid35: -16.40141,
      c36DryMid35: -16.40141,
      c30DryUpper35: -5.79198,
      c36DryUpper35: -5.79198
    },
    dryBeltComparison: {
      c30OceanCond: 0.12693,
      c36OceanCond: 0.12693,
      c30Carryover: 0.2187,
      c36Carryover: 0.2187,
      c30Persistence: 0.21701,
      c36Persistence: 0.21701,
      c30WeakErosion: 0.21225,
      c36WeakErosion: 0.21225,
      c30UpperCloudPath: 0.24025,
      c36UpperCloudPath: 0.24025,
      c30CloudRecirc: 1.18525,
      c36CloudRecirc: 1.18525,
      c30NorthReturn: 3500.90278,
      c36NorthReturn: 3500.90278,
      c30DominantVaporImport: -22.82573,
      c36DominantVaporImport: -22.82573
    },
    thermodynamicComparison: {
      c30PrimaryRegime: 'mixed',
      c36PrimaryRegime: 'mixed',
      c30DynamicsSupport: 0.63593,
      c36DynamicsSupport: 0.63593,
      c30MoistureSupport: 0.58968,
      c36MoistureSupport: 0.58968
    },
    nextContract: {
      focusTargets: [
        'restore organized-support admission only inside the inner equatorial core'
      ]
    }
  });

  assert.match(markdown, /Architecture C37 Organized-Support Half-Relax Carry-Input Attribution/);
  assert.match(markdown, /threshold cliff/);
  assert.match(markdown, /inner equatorial core/);
});
