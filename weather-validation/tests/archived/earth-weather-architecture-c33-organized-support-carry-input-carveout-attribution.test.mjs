import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC33Decision,
  renderArchitectureC33Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c33-organized-support-carry-input-carveout-attribution.mjs';

test('classifyC33Decision recognizes stronger receiver containment with lower-mid reload', () => {
  const decision = classifyC33Decision({
    c30CrossEq: -353.96486,
    c32CrossEq: -356.96839,
    c30EqLower: -17.99024,
    c32EqLower: -18.3439,
    c30EqMid: -16.67245,
    c32EqMid: -16.74764,
    c30EqUpper: -12.94654,
    c32EqUpper: -12.82647,
    c30EqLowerZonal: -14.10166,
    c32EqLowerZonal: -14.37359,
    c30EqMidZonal: -12.98794,
    c32EqMidZonal: -13.06211,
    c30EqUpperZonal: -7.84381,
    c32EqUpperZonal: -7.78225,
    c30EqLowerEddy: -3.88858,
    c32EqLowerEddy: -3.97031,
    c30EqMidEddy: -3.6845,
    c32EqMidEddy: -3.68553,
    c30EqUpperEddy: -5.10272,
    c32EqUpperEddy: -5.04422,
    c30OceanCond: 0.12693,
    c32OceanCond: 0.10807,
    c30Carryover: 0.2187,
    c32Carryover: 0.17351,
    c30Persistence: 0.21701,
    c32Persistence: 0.17183,
    c30WeakErosion: 0.21225,
    c32WeakErosion: 0.16844,
    c30UpperCloudPath: 0.24025,
    c32UpperCloudPath: 0.19258,
    c30DominantVaporImport: -22.82573,
    c32DominantVaporImport: -23.37997,
    c30CloudRecirc: 1.18525,
    c32CloudRecirc: 0.44108,
    c30NorthReturn: 3500.90278,
    c32NorthReturn: 3554.21558
  });

  assert.equal(decision.verdict, 'organized_support_carveout_restores_receiver_containment_and_upper_branch_but_deepens_lower_mid_core_import');
  assert.equal(decision.nextMove, 'Architecture C34: potential-half-relax carry-input experiment');
});

test('renderArchitectureC33Markdown includes the potential-half-relax contract', () => {
  const markdown = renderArchitectureC33Markdown({
    decision: {
      verdict: 'organized_support_carveout_restores_receiver_containment_and_upper_branch_but_deepens_lower_mid_core_import',
      nextMove: 'Architecture C34: potential-half-relax carry-input experiment'
    },
    quickComparison: {
      c30CrossEq: -353.96486,
      c32CrossEq: -356.96839,
      c30ItczWidth: 23.315,
      c32ItczWidth: 23.374,
      c30DryNorth: 1.093,
      c32DryNorth: 1.122,
      c30DrySouth: 0.502,
      c32DrySouth: 0.493,
      c30Westerlies: 1.232,
      c32Westerlies: 1.219,
      c30OceanCond: 0.12693,
      c32OceanCond: 0.10807
    },
    transportComparison: {
      c30EqLower: -17.99024,
      c32EqLower: -18.3439,
      c30EqMid: -16.67245,
      c32EqMid: -16.74764,
      c30EqUpper: -12.94654,
      c32EqUpper: -12.82647,
      c30EqLowerZonal: -14.10166,
      c32EqLowerZonal: -14.37359,
      c30EqLowerEddy: -3.88858,
      c32EqLowerEddy: -3.97031,
      c30EqMidZonal: -12.98794,
      c32EqMidZonal: -13.06211,
      c30EqMidEddy: -3.6845,
      c32EqMidEddy: -3.68553,
      c30EqUpperZonal: -7.84381,
      c32EqUpperZonal: -7.78225,
      c30EqUpperEddy: -5.10272,
      c32EqUpperEddy: -5.04422,
      c30DryLower35: -22.46949,
      c32DryLower35: -23.19317,
      c30DryMid35: -16.40141,
      c32DryMid35: -17.28133,
      c30DryUpper35: -5.79198,
      c32DryUpper35: -6.28724
    },
    dryBeltComparison: {
      c30OceanCond: 0.12693,
      c32OceanCond: 0.10807,
      c30Carryover: 0.2187,
      c32Carryover: 0.17351,
      c30Persistence: 0.21701,
      c32Persistence: 0.17183,
      c30WeakErosion: 0.21225,
      c32WeakErosion: 0.16844,
      c30UpperCloudPath: 0.24025,
      c32UpperCloudPath: 0.19258,
      c30CloudRecirc: 1.18525,
      c32CloudRecirc: 0.44108,
      c30NorthReturn: 3500.90278,
      c32NorthReturn: 3554.21558,
      c30DominantVaporImport: -22.82573,
      c32DominantVaporImport: -23.37997
    },
    thermodynamicComparison: {
      c30PrimaryRegime: 'mixed',
      c32PrimaryRegime: 'dynamicsSupported',
      c30DynamicsSupport: 0.63593,
      c32DynamicsSupport: 0.69295,
      c30MoistureSupport: 0.58968,
      c32MoistureSupport: 0.58914
    },
    nextContract: {
      focusTargets: [
        'partially relax only the convective-potential cap'
      ]
    }
  });

  assert.match(markdown, /Architecture C33 Organized-Support Carry-Input Carveout Attribution/);
  assert.match(markdown, /lower-mid core/);
  assert.match(markdown, /convective-potential cap/);
});
