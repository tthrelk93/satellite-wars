import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC59Decision,
  renderArchitectureC59Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c59-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-attribution.mjs';

test('classifyC59Decision recognizes equatorial relief paid for by transition/receiver reload', () => {
  const decision = classifyC59Decision({
    equatorialFluxRelieved: true,
    equatorialTransportImproved: true,
    transitionRowReloaded: true,
    receiverRowReloaded: true,
    polewardImportWorsened: true,
    polewardShoulderUnloaded: true
  });

  assert.equal(decision.verdict, 'transition_carry_input_preserve_relieves_equatorial_export_but_reloads_18p75_26p25_and_worsens_35deg_import');
  assert.equal(decision.nextMove, 'Architecture C60: stronger 26p25 receiver carryover containment on top of 18p75 transition carry-input preserve experiment');
});

test('renderArchitectureC59Markdown points to stronger receiver recapture on top of C58', () => {
  const markdown = renderArchitectureC59Markdown({
    decision: {
      verdict: 'transition_carry_input_preserve_relieves_equatorial_export_but_reloads_18p75_26p25_and_worsens_35deg_import',
      nextMove: 'Architecture C60: stronger 26p25 receiver carryover containment on top of 18p75 transition carry-input preserve experiment'
    },
    quickComparison: {
      c54CrossEq: -362.46654,
      c58CrossEq: -351.9993,
      c54ItczWidth: 23.333,
      c58ItczWidth: 23.634,
      c54DryNorth: 1.124,
      c58DryNorth: 1.231,
      c54DrySouth: 0.496,
      c58DrySouth: 0.497,
      c54Westerlies: 1.201,
      c58Westerlies: 1.194,
      c54OceanCond: 0.12942,
      c58OceanCond: 0.13447
    },
    moistureComparison: {
      c54OceanPersistence: 0.09285,
      c58OceanPersistence: 0.09331,
      c54OceanCarryover: 0.09301,
      c58OceanCarryover: 0.09341,
      c54OceanWeakErosion: 0.09135,
      c58OceanWeakErosion: 0.09132
    },
    transportComparison: {
      c54EqLower: -2.75501,
      c58EqLower: -2.31122,
      c54EqMid: -16.7861,
      c58EqMid: -15.09901,
      c54EqUpper: -20.60412,
      c58EqUpper: -18.89097,
      c54DominantImport: -23.26958,
      c58DominantImport: -23.57346
    },
    rowComparison: {
      c5418Flux: -237.978,
      c5818Flux: -245.932,
      c5418Carryover: 0.062,
      c5818Carryover: 0.094,
      c5426Flux: -565.124,
      c5826Flux: -567.334,
      c5426Carryover: 0.058,
      c5826Carryover: 0.078,
      c5433Flux: -514.496,
      c5833Flux: -561.887,
      c5433Carryover: 0.437,
      c5833Carryover: 0.372
    }
  });

  assert.match(markdown, /Architecture C59 26p25 Carryover Containment With 18p75 Transition Carry-Input Preserve Attribution/);
  assert.match(markdown, /stronger 26p25 receiver carryover containment/i);
  assert.match(markdown, /18\.75°/);
});
