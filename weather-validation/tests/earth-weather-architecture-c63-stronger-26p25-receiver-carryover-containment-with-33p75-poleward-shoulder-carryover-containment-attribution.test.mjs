import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC63Decision,
  renderArchitectureC63Markdown
} from '../../scripts/agent/earth-weather-architecture-c63-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-attribution.mjs';

test('classifyC63Decision recognizes the 35deg eddy import branch as the remaining blocker', () => {
  const decision = classifyC63Decision({
    receiverReboundRecovered: true,
    polewardShoulderRecaptured: true,
    crossEqImproved: true,
    dominantImportWorsened: true,
    north35ZonalMeanImproved: true,
    north35EddyWorsened: true,
    transitionLaneReloaded: true
  });

  assert.equal(decision.verdict, 'poleward_shoulder_containment_recaptures_receiver_and_nh_ocean_rebound_but_35deg_eddy_import_remains_primary_blocker');
  assert.equal(decision.nextMove, 'Architecture C64: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening experiment');
});

test('renderArchitectureC63Markdown points to the 35deg interface eddy-softening follow-up', () => {
  const markdown = renderArchitectureC63Markdown({
    decision: {
      verdict: 'poleward_shoulder_containment_recaptures_receiver_and_nh_ocean_rebound_but_35deg_eddy_import_remains_primary_blocker',
      nextMove: 'Architecture C64: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening experiment'
    },
    quickComparison: {
      c60CrossEq: -318.81218,
      c62CrossEq: -318.32449,
      c60ItczWidth: 23.287,
      c62ItczWidth: 23.386,
      c60DryNorth: 1.07,
      c62DryNorth: 1.057,
      c60DrySouth: 0.48,
      c62DrySouth: 0.487,
      c60Westerlies: 1.194,
      c62Westerlies: 1.214,
      c60OceanCond: 0.15491,
      c62OceanCond: 0.13629
    },
    moistureComparison: {
      c60OceanPersistence: 0.16602,
      c62OceanPersistence: 0.10603,
      c60OceanCarryover: 0.16611,
      c62OceanCarryover: 0.10614,
      c60OceanWeakErosion: 0.16078,
      c62OceanWeakErosion: 0.10274
    },
    transportComparison: {
      c60DominantImport: -22.79697,
      c62DominantImport: -24.15339,
      c60North35LowerZonal: -19.86124,
      c62North35LowerZonal: -17.71568,
      c60North35LowerEddy: -2.23325,
      c62North35LowerEddy: -6.31372,
      c60North35MidZonal: -16.79342,
      c62North35MidZonal: -14.98167,
      c60North35MidEddy: -0.42171,
      c62North35MidEddy: -3.60499,
      c60North35UpperZonal: -7.70866,
      c62North35UpperZonal: -7.33442,
      c60North35UpperEddy: 0.48228,
      c62North35UpperEddy: -0.7501
    },
    rowComparison: {
      c6018Flux: -232.358,
      c6218Flux: -233.953,
      c6018Carryover: 0.089,
      c6218Carryover: 0.094,
      c6026Flux: -594.845,
      c6226Flux: -564.64,
      c6026Carryover: 0.066,
      c6226Carryover: 0.062,
      c6033Carryover: 0.513,
      c6233Carryover: 0.418,
      c6033UpperPath: 0.513,
      c6233UpperPath: 0.418
    }
  });

  assert.match(markdown, /Architecture C63 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment Attribution/);
  assert.match(markdown, /35(?:°|deg).*interface.*eddy/i);
  assert.match(markdown, /35°.*eddy branch/i);
});
