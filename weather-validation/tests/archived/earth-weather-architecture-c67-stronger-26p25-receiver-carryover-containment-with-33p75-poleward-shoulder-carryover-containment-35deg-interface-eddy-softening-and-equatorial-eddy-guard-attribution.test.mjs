import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC67Decision,
  renderArchitectureC67Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c67-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-attribution.mjs';

test('classifyC67Decision recognizes the upper-eddy and transition-row blocker after C66', () => {
  const decision = classifyC67Decision({
    lowerMidEquatorialRelieved: true,
    north35ReliefPreserved: true,
    maintenanceRelieved: true,
    upperEddyStillBinding: true,
    transitionShoulderFluxReloaded: true,
    receiverLaneReloaded: true,
    crossEqStillSevere: true
  });

  assert.equal(decision.verdict, 'equatorial_guard_relieves_lower_mid_core_and_nh_maintenance_but_upper_eddy_and_transition_receiver_flux_remain_primary_blockers');
  assert.equal(decision.nextMove, 'Architecture C68: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and narrower equatorial-core eddy guard experiment');
});

test('renderArchitectureC67Markdown points to the narrower equatorial-core guard follow-up', () => {
  const markdown = renderArchitectureC67Markdown({
    decision: {
      verdict: 'equatorial_guard_relieves_lower_mid_core_and_nh_maintenance_but_upper_eddy_and_transition_receiver_flux_remain_primary_blockers',
      nextMove: 'Architecture C68: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and narrower equatorial-core eddy guard experiment'
    },
    quickComparison: {
      c64CrossEq: -361.01,
      c66CrossEq: -356.31833,
      c64ItczWidth: 23.237,
      c66ItczWidth: 23.232,
      c64DryNorth: 1.14,
      c66DryNorth: 1.112,
      c64DrySouth: 0.518,
      c66DrySouth: 0.492,
      c64Westerlies: 1.216,
      c66Westerlies: 1.218,
      c64OceanCond: 0.13472,
      c66OceanCond: 0.12975
    },
    moistureComparison: {
      c64OceanPersistence: 0.11553,
      c66OceanPersistence: 0.10629,
      c64OceanCarryover: 0.11565,
      c66OceanCarryover: 0.10643,
      c64OceanWeakErosion: 0.11239,
      c66OceanWeakErosion: 0.10317,
      c64UpperCloudPath: 0.22208,
      c66UpperCloudPath: 0.21627,
      c64TransitionFlux: -209.7579,
      c66TransitionFlux: -205.17435
    },
    transportComparison: {
      c64DominantImport: -22.91649,
      c66DominantImport: -22.86561,
      c64North35LowerEddy: -5.1482,
      c66North35LowerEddy: -4.3658,
      c64North35MidEddy: -2.91285,
      c66North35MidEddy: -2.10239,
      c64North35UpperEddy: -0.26832,
      c66North35UpperEddy: 0.13727,
      c64EqLowerZonal: -14.52385,
      c66EqLowerZonal: -14.17186,
      c64EqLowerEddy: -4.03894,
      c66EqLowerEddy: -3.89968,
      c64EqMidZonal: -13.27803,
      c66EqMidZonal: -12.97536,
      c64EqMidEddy: -3.78764,
      c66EqMidEddy: -3.56215,
      c64EqUpperZonal: -7.9437,
      c66EqUpperZonal: -7.91638,
      c64EqUpperEddy: -5.01791,
      c66EqUpperEddy: -5.05672
    },
    rowComparison: {
      c6411Flux: -251.14,
      c6611Flux: -256.478,
      c6418Flux: -237.499,
      c6618Flux: -240.158,
      c6426Flux: -559.502,
      c6626Flux: -568.979,
      c6433Flux: -541.738,
      c6633Flux: -560.42,
      c6418Carryover: 0.094,
      c6618Carryover: 0.088,
      c6426Carryover: 0.073,
      c6626Carryover: 0.079,
      c6433Carryover: 0.468,
      c6633Carryover: 0.454
    }
  });

  assert.match(markdown, /Architecture C67 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment 35deg Interface Eddy Softening And Equatorial Eddy Guard Attribution/);
  assert.match(markdown, /narrower equatorial-core eddy guard/i);
  assert.match(markdown, /upper eddy/i);
});
