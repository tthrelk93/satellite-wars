import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC55Decision,
  renderArchitectureC55Markdown
} from '../../scripts/agent/earth-weather-architecture-c55-26p25-receiver-carryover-containment-transition-band-attribution.mjs';

test('classifyC55Decision recognizes the receiver-relief vs transition-export tradeoff', () => {
  const decision = classifyC55Decision({
    receiverReliefActive: true,
    transitionExportWorsened: true,
    polewardShoulderReloaded: true,
    equatorialFluxWorsened: true
  });

  assert.equal(decision.verdict, 'receiver_carryover_containment_relieves_26p25_but_forces_18p75_transition_export_and_33p75_reload');
  assert.equal(decision.nextMove, 'Architecture C56: 26p25 carryover containment with 18p75 transition-support preserve experiment');
});

test('renderArchitectureC55Markdown includes the 18.75 preserve follow-up contract', () => {
  const markdown = renderArchitectureC55Markdown({
    decision: {
      verdict: 'receiver_carryover_containment_relieves_26p25_but_forces_18p75_transition_export_and_33p75_reload',
      nextMove: 'Architecture C56: 26p25 carryover containment with 18p75 transition-support preserve experiment'
    },
    quickComparison: {
      c40CrossEq: -355.94778,
      c54CrossEq: -362.46654,
      c40ItczWidth: 23.386,
      c54ItczWidth: 23.333,
      c40DryNorth: 1.128,
      c54DryNorth: 1.124,
      c40DrySouth: 0.49,
      c54DrySouth: 0.496,
      c40Westerlies: 1.225,
      c54Westerlies: 1.201,
      c40OceanCond: 0.11898,
      c54OceanCond: 0.12942
    },
    moistureComparison: {
      c40OceanPersistence: 0.08962,
      c54OceanPersistence: 0.09285,
      c40OceanCarryover: 0.08979,
      c54OceanCarryover: 0.09301,
      c40OceanWeakErosion: 0.0881,
      c54OceanWeakErosion: 0.09135
    },
    transportComparison: {
      c40EqLower: -2.27135,
      c54EqLower: -2.75501,
      c40EqMid: -15.52117,
      c54EqMid: -16.7861,
      c40EqUpper: -19.35472,
      c54EqUpper: -20.60412,
      c40DominantImport: -22.94616,
      c54DominantImport: -23.95276
    },
    rowComparison: {
      c4018Flux: -229.214,
      c5418Flux: -237.978,
      c4018Carryover: 0.064,
      c5418Carryover: 0.062,
      c4026Flux: -579.114,
      c5426Flux: -565.124,
      c3226Hits: 18.625,
      c3226Carryover: 0.05,
      c4026Carryover: 0.06,
      c5426Carryover: 0.058,
      c4033Carryover: 0.424,
      c5433Carryover: 0.437,
      c4033Persistence: 0.42,
      c5433Persistence: 0.434
    },
    nextContract: {
      focusTargets: [
        '18.75° transition-band organized-support preserve'
      ]
    }
  });

  assert.match(markdown, /Architecture C55 26p25 Receiver Carryover Containment Transition-Band Attribution/);
  assert.match(markdown, /18\.75°/);
  assert.match(markdown, /transition-support/i);
});
