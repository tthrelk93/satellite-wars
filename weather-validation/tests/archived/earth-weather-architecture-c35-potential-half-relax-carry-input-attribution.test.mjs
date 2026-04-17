import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC35Decision,
  renderArchitectureC35Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c35-potential-half-relax-carry-input-attribution.mjs';

test('classifyC35Decision recognizes inert potential half-relax results', () => {
  const decision = classifyC35Decision({
    c32CrossEq: -356.96839,
    c34CrossEq: -356.96839,
    c32ItczWidth: 23.374,
    c34ItczWidth: 23.374,
    c32DryNorth: 1.122,
    c34DryNorth: 1.122,
    c32DrySouth: 0.493,
    c34DrySouth: 0.493,
    c32Westerlies: 1.219,
    c34Westerlies: 1.219,
    c32OceanCond: 0.10807,
    c34OceanCond: 0.10807,
    c32EqLower: -18.3439,
    c34EqLower: -18.3439,
    c32EqMid: -16.74764,
    c34EqMid: -16.74764,
    c32EqUpper: -12.82647,
    c34EqUpper: -12.82647,
    c32EqLowerZonal: -14.37359,
    c34EqLowerZonal: -14.37359,
    c32EqMidZonal: -13.06211,
    c34EqMidZonal: -13.06211,
    c32EqUpperZonal: -7.78225,
    c34EqUpperZonal: -7.78225,
    c32EqLowerEddy: -3.97031,
    c34EqLowerEddy: -3.97031,
    c32EqMidEddy: -3.68553,
    c34EqMidEddy: -3.68553,
    c32EqUpperEddy: -5.04422,
    c34EqUpperEddy: -5.04422,
    c32DryLower35: -23.19317,
    c34DryLower35: -23.19317,
    c32DryMid35: -17.28133,
    c34DryMid35: -17.28133,
    c32DryUpper35: -6.28724,
    c34DryUpper35: -6.28724,
    c32Carryover: 0.17351,
    c34Carryover: 0.17351,
    c32Persistence: 0.17183,
    c34Persistence: 0.17183,
    c32WeakErosion: 0.16844,
    c34WeakErosion: 0.16844,
    c32UpperCloudPath: 0.19258,
    c34UpperCloudPath: 0.19258,
    c32DominantVaporImport: -23.37997,
    c34DominantVaporImport: -23.37997,
    c32CloudRecirc: 0.44108,
    c34CloudRecirc: 0.44108,
    c32NorthReturn: 3554.21558,
    c34NorthReturn: 3554.21558,
    c32PrimaryRegime: 'dynamicsSupported',
    c34PrimaryRegime: 'dynamicsSupported',
    c32DynamicsSupport: 0.69295,
    c34DynamicsSupport: 0.69295,
    c32MoistureSupport: 0.58914,
    c34MoistureSupport: 0.58914
  });

  assert.equal(decision.verdict, 'potential_half_relax_inert_potential_cap_not_primary_binder');
  assert.equal(decision.nextMove, 'Architecture C36: organized-support half-relax carry-input experiment');
});

test('renderArchitectureC35Markdown includes the organized-support half-relax contract', () => {
  const markdown = renderArchitectureC35Markdown({
    decision: {
      verdict: 'potential_half_relax_inert_potential_cap_not_primary_binder',
      nextMove: 'Architecture C36: organized-support half-relax carry-input experiment'
    },
    quickComparison: {
      c32CrossEq: -356.96839,
      c34CrossEq: -356.96839,
      c32ItczWidth: 23.374,
      c34ItczWidth: 23.374,
      c32DryNorth: 1.122,
      c34DryNorth: 1.122,
      c32DrySouth: 0.493,
      c34DrySouth: 0.493,
      c32Westerlies: 1.219,
      c34Westerlies: 1.219,
      c32OceanCond: 0.10807,
      c34OceanCond: 0.10807
    },
    transportComparison: {
      c32EqLower: -18.3439,
      c34EqLower: -18.3439,
      c32EqMid: -16.74764,
      c34EqMid: -16.74764,
      c32EqUpper: -12.82647,
      c34EqUpper: -12.82647,
      c32EqLowerZonal: -14.37359,
      c34EqLowerZonal: -14.37359,
      c32EqLowerEddy: -3.97031,
      c34EqLowerEddy: -3.97031,
      c32EqMidZonal: -13.06211,
      c34EqMidZonal: -13.06211,
      c32EqMidEddy: -3.68553,
      c34EqMidEddy: -3.68553,
      c32EqUpperZonal: -7.78225,
      c34EqUpperZonal: -7.78225,
      c32EqUpperEddy: -5.04422,
      c34EqUpperEddy: -5.04422,
      c32DryLower35: -23.19317,
      c34DryLower35: -23.19317,
      c32DryMid35: -17.28133,
      c34DryMid35: -17.28133,
      c32DryUpper35: -6.28724,
      c34DryUpper35: -6.28724
    },
    dryBeltComparison: {
      c32OceanCond: 0.10807,
      c34OceanCond: 0.10807,
      c32Carryover: 0.17351,
      c34Carryover: 0.17351,
      c32Persistence: 0.17183,
      c34Persistence: 0.17183,
      c32WeakErosion: 0.16844,
      c34WeakErosion: 0.16844,
      c32UpperCloudPath: 0.19258,
      c34UpperCloudPath: 0.19258,
      c32CloudRecirc: 0.44108,
      c34CloudRecirc: 0.44108,
      c32NorthReturn: 3554.21558,
      c34NorthReturn: 3554.21558,
      c32DominantVaporImport: -23.37997,
      c34DominantVaporImport: -23.37997
    },
    thermodynamicComparison: {
      c32PrimaryRegime: 'dynamicsSupported',
      c34PrimaryRegime: 'dynamicsSupported',
      c32DynamicsSupport: 0.69295,
      c34DynamicsSupport: 0.69295,
      c32MoistureSupport: 0.58914,
      c34MoistureSupport: 0.58914
    },
    nextContract: {
      focusTargets: [
        'partially relax only the organized-support cap'
      ]
    }
  });

  assert.match(markdown, /Architecture C35 Potential-Half-Relax Carry-Input Attribution/);
  assert.match(markdown, /unchanged to reporting precision/);
  assert.match(markdown, /organized-support cap/);
});
