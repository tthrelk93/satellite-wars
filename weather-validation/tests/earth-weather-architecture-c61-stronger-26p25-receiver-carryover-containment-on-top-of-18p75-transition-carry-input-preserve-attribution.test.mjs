import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC61Decision,
  renderArchitectureC61Markdown
} from '../../scripts/agent/earth-weather-architecture-c61-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-attribution.mjs';

test('classifyC61Decision recognizes export relief paid for by poleward-shoulder and NH ocean reload', () => {
  const decision = classifyC61Decision({
    equatorialFluxRelieved: true,
    equatorialTransportImproved: true,
    transitionRowRelieved: true,
    receiverCarryoverRecaptured: true,
    receiverFluxWorsened: true,
    polewardImportRelieved: true,
    polewardShoulderReloaded: true,
    dryBeltOceanMaintenanceReloaded: true
  });

  assert.equal(decision.verdict, 'stronger_receiver_containment_relieves_equatorial_export_and_recaptures_26p25_carryover_but_reloads_33p75_poleward_shoulder_and_nh_ocean_maintenance');
  assert.equal(decision.nextMove, 'Architecture C62: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment experiment');
});

test('renderArchitectureC61Markdown points to the 33.75 poleward-shoulder carveout', () => {
  const markdown = renderArchitectureC61Markdown({
    decision: {
      verdict: 'stronger_receiver_containment_relieves_equatorial_export_and_recaptures_26p25_carryover_but_reloads_33p75_poleward_shoulder_and_nh_ocean_maintenance',
      nextMove: 'Architecture C62: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment experiment'
    },
    quickComparison: {
      c58CrossEq: -351.9993,
      c60CrossEq: -318.81218,
      c58ItczWidth: 23.634,
      c60ItczWidth: 23.287,
      c58DryNorth: 1.231,
      c60DryNorth: 1.07,
      c58DrySouth: 0.497,
      c60DrySouth: 0.48,
      c58Westerlies: 1.194,
      c60Westerlies: 1.194,
      c58OceanCond: 0.13447,
      c60OceanCond: 0.15491
    },
    moistureComparison: {
      c58OceanPersistence: 0.09331,
      c60OceanPersistence: 0.16602,
      c58OceanCarryover: 0.09341,
      c60OceanCarryover: 0.16611,
      c58OceanWeakErosion: 0.09132,
      c60OceanWeakErosion: 0.16078,
      c58UpperCloudPath: 0.20784,
      c60UpperCloudPath: 0.24333
    },
    transportComparison: {
      c58EqLower: -18.54113,
      c60EqLower: -16.7679,
      c58EqMid: -16.87238,
      c60EqMid: -14.54819,
      c58EqUpper: -12.41278,
      c60EqUpper: -11.0565,
      c58DominantImport: -23.57346,
      c60DominantImport: -22.79697
    },
    rowComparison: {
      c5818Flux: -245.932,
      c6018Flux: -232.358,
      c5818Carryover: 0.094,
      c6018Carryover: 0.089,
      c5826Flux: -567.334,
      c6026Flux: -594.845,
      c5826Carryover: 0.078,
      c6026Carryover: 0.066,
      c5833Carryover: 0.372,
      c6033Carryover: 0.513,
      c5833UpperPath: 0.363,
      c6033UpperPath: 0.513
    }
  });

  assert.match(markdown, /Architecture C61 Stronger 26p25 Receiver Carryover Containment On Top Of 18p75 Transition Carry-Input Preserve Attribution/);
  assert.match(markdown, /33\.75°.*poleward-shoulder carryover containment/i);
  assert.match(markdown, /NH dry-belt ocean rebound/i);
});
