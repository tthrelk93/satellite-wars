import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC69Decision,
  renderArchitectureC69Markdown
} from '../../scripts/agent/earth-weather-architecture-c69-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-attribution.mjs';

test('classifyC69Decision recognizes the C68 tradeoff between outer-row relief and withdrawn core support', () => {
  const decision = classifyC69Decision({
    transitionRowsRelieved: true,
    maintenanceRelieved: true,
    north35EddyPreserved: true,
    receiverLaneStillLive: true,
    equatorialUpperWorsened: true,
    dominantImportWorsened: true,
    crossEqWorsened: true
  });

  assert.equal(decision.verdict, 'narrower_core_guard_relieves_transition_rows_and_nh_maintenance_but_overwithdraws_equatorial_upper_support_and_dominant_import');
  assert.equal(decision.nextMove, 'Architecture C70: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, narrower equatorial-core guard, and stronger inner-core blend experiment');
});

test('renderArchitectureC69Markdown points to the stronger inner-core blend follow-up', () => {
  const markdown = renderArchitectureC69Markdown({
    decision: {
      verdict: 'narrower_core_guard_relieves_transition_rows_and_nh_maintenance_but_overwithdraws_equatorial_upper_support_and_dominant_import',
      nextMove: 'Architecture C70: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, narrower equatorial-core guard, and stronger inner-core blend experiment'
    },
    quickComparison: {
      c66CrossEq: -356.31833,
      c68CrossEq: -357.91328,
      c66ItczWidth: 23.232,
      c68ItczWidth: 23.431,
      c66DryNorth: 1.112,
      c68DryNorth: 1.141,
      c66DrySouth: 0.492,
      c68DrySouth: 0.507,
      c66Westerlies: 1.218,
      c68Westerlies: 1.235,
      c66OceanCond: 0.12975,
      c68OceanCond: 0.12134
    },
    moistureComparison: {
      c66OceanPersistence: 0.10629,
      c68OceanPersistence: 0.10549,
      c66OceanCarryover: 0.10643,
      c68OceanCarryover: 0.10567,
      c66OceanWeakErosion: 0.10317,
      c68OceanWeakErosion: 0.10203,
      c66UpperCloudPath: 0.21627,
      c68UpperCloudPath: 0.21166,
      c66TransitionFlux: -205.17435,
      c68TransitionFlux: -201.58133
    },
    transportComparison: {
      c66DominantImport: -22.86561,
      c68DominantImport: -23.15788,
      c66North35LowerTotal: -22.66468,
      c68North35LowerTotal: -22.95063,
      c66North35LowerEddy: -4.3658,
      c68North35LowerEddy: -3.86136,
      c66North35MidTotal: -16.93467,
      c68North35MidTotal: -17.27524,
      c66North35MidEddy: -2.10239,
      c68North35MidEddy: -1.31734,
      c66North35UpperTotal: -6.38598,
      c68North35UpperTotal: -6.59374,
      c66North35UpperEddy: 0.13727,
      c68North35UpperEddy: 0.47808,
      c66EqLowerZonal: -14.17186,
      c68EqLowerZonal: -14.212,
      c66EqMidZonal: -12.97536,
      c68EqMidZonal: -13.10909,
      c66EqUpperZonal: -7.91638,
      c68EqUpperZonal: -8.17454,
      c66EqUpperEddy: -5.05672,
      c68EqUpperEddy: -5.27392
    },
    rowComparison: {
      c6611Flux: -256.478,
      c6811Flux: -248.373,
      c6618Flux: -240.158,
      c6818Flux: -231.366,
      c6626Flux: -568.979,
      c6826Flux: -541.587,
      c6633Flux: -560.42,
      c6833Flux: -549.382,
      c6611Carryover: 0.335,
      c6811Carryover: 0.317,
      c6618Carryover: 0.088,
      c6818Carryover: 0.068,
      c6626Carryover: 0.079,
      c6826Carryover: 0.081,
      c6633Carryover: 0.454,
      c6833Carryover: 0.443
    }
  });

  assert.match(markdown, /Architecture C69 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment 35deg Interface Eddy Softening And Narrower Equatorial-Core Guard Attribution/);
  assert.match(markdown, /stronger inner-core blend experiment/i);
  assert.match(markdown, /over-withdrawing broader equatorial support/i);
});
