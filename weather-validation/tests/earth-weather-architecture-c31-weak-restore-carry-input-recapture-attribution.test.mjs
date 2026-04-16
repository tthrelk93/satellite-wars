import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC31Decision,
  renderArchitectureC31Markdown
} from '../../scripts/agent/earth-weather-architecture-c31-weak-restore-carry-input-recapture-attribution.mjs';

test('classifyC31Decision recognizes dry-belt/zonal-mean recovery with eddy reload', () => {
  const decision = classifyC31Decision({
    c28CrossEq: -323.23581,
    c30CrossEq: -353.96486,
    c28EqLowerZonal: -14.49379,
    c30EqLowerZonal: -14.10166,
    c28EqMidZonal: -14.12323,
    c30EqMidZonal: -12.98794,
    c28EqUpperZonal: -8.8185,
    c30EqUpperZonal: -7.84381,
    c28EqLowerEddy: -2.44586,
    c30EqLowerEddy: -3.88858,
    c28EqMidEddy: -0.68108,
    c30EqMidEddy: -3.6845,
    c28EqUpperEddy: -2.40458,
    c30EqUpperEddy: -5.10272,
    c28OceanCond: 0.15539,
    c30OceanCond: 0.12693,
    c28Carryover: 0.24485,
    c30Carryover: 0.2187,
    c28Persistence: 0.24284,
    c30Persistence: 0.21701,
    c28WeakErosion: 0.23434,
    c30WeakErosion: 0.21225,
    c28DominantVaporImport: -25.51113,
    c30DominantVaporImport: -22.82573,
    c28CloudRecirc: 0.74157,
    c30CloudRecirc: 1.18525,
    c28NorthReturn: 3444.87796,
    c30NorthReturn: 3500.90278
  });

  assert.equal(decision.verdict, 'carry_input_recapture_recovers_dry_belt_and_zonal_mean_but_reloads_equatorial_eddy_export_recirculation');
  assert.equal(decision.nextMove, 'Architecture C32: organized-support carry-input carveout experiment');
});

test('renderArchitectureC31Markdown includes the organized-support carveout contract', () => {
  const markdown = renderArchitectureC31Markdown({
    decision: {
      verdict: 'carry_input_recapture_recovers_dry_belt_and_zonal_mean_but_reloads_equatorial_eddy_export_recirculation',
      nextMove: 'Architecture C32: organized-support carry-input carveout experiment'
    },
    quickComparison: {
      c28CrossEq: -323.23581,
      c30CrossEq: -353.96486,
      c28ItczWidth: 23.321,
      c30ItczWidth: 23.315,
      c28DryNorth: 1.097,
      c30DryNorth: 1.093,
      c28DrySouth: 0.487,
      c30DrySouth: 0.502,
      c28Westerlies: 1.202,
      c30Westerlies: 1.232,
      c28OceanCond: 0.15539,
      c30OceanCond: 0.12693
    },
    transportComparison: {
      c28EqLower: -16.93964,
      c30EqLower: -17.99024,
      c28EqMid: -14.80431,
      c30EqMid: -16.67245,
      c28EqUpper: -11.22308,
      c30EqUpper: -12.94654,
      c28EqLowerZonal: -14.49379,
      c30EqLowerZonal: -14.10166,
      c28EqLowerEddy: -2.44586,
      c30EqLowerEddy: -3.88858,
      c28EqMidZonal: -14.12323,
      c30EqMidZonal: -12.98794,
      c28EqMidEddy: -0.68108,
      c30EqMidEddy: -3.6845,
      c28EqUpperZonal: -8.8185,
      c30EqUpperZonal: -7.84381,
      c28EqUpperEddy: -2.40458,
      c30EqUpperEddy: -5.10272,
      c28DryLower35: -25.26785,
      c30DryLower35: -22.46949,
      c28DryMid35: -20.28483,
      c30DryMid35: -16.40141,
      c28DryUpper35: -8.40779,
      c30DryUpper35: -5.79198
    },
    dryBeltComparison: {
      c28OceanCond: 0.15539,
      c30OceanCond: 0.12693,
      c28Carryover: 0.24485,
      c30Carryover: 0.2187,
      c28Persistence: 0.24284,
      c30Persistence: 0.21701,
      c28WeakErosion: 0.23434,
      c30WeakErosion: 0.21225,
      c28UpperCloudPath: 0.26708,
      c30UpperCloudPath: 0.24025,
      c28CloudRecirc: 0.74157,
      c30CloudRecirc: 1.18525,
      c28NorthReturn: 3444.87796,
      c30NorthReturn: 3500.90278,
      c28DominantVaporImport: -25.51113,
      c30DominantVaporImport: -22.82573
    },
    thermodynamicComparison: {
      c28PrimaryRegime: 'dynamicsSupported',
      c30PrimaryRegime: 'mixed',
      c28DynamicsSupport: 0.67121,
      c30DynamicsSupport: 0.63593,
      c28MoistureSupport: 0.58473,
      c30MoistureSupport: 0.58968
    },
    nextContract: {
      focusTargets: [
        'restore stricter organized-support and convective-potential caps'
      ]
    }
  });

  assert.match(markdown, /Architecture C31 Weak Restore Carry-Input Recapture Attribution/);
  assert.match(markdown, /organized equatorial cells/);
  assert.match(markdown, /dry-belt receiver/);
});
