import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC57Decision,
  renderArchitectureC57Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c57-26p25-carryover-containment-with-18p75-transition-support-preserve-attribution.mjs';

test('classifyC57Decision recognizes an exact inert preserve lane', () => {
  const decision = classifyC57Decision({
    exactQuickMatch: true,
    exactMoistureMatch: true,
    exactTransportMatch: true,
    exactRowMatch: true
  });

  assert.equal(decision.verdict, 'transition_support_preserve_inert_organized_support_only_not_live_binder');
  assert.equal(decision.nextMove, 'Architecture C58: 26p25 carryover containment with 18p75 transition carry-input preserve experiment');
});

test('renderArchitectureC57Markdown points to broader transition carry-input preserve', () => {
  const markdown = renderArchitectureC57Markdown({
    decision: {
      verdict: 'transition_support_preserve_inert_organized_support_only_not_live_binder',
      nextMove: 'Architecture C58: 26p25 carryover containment with 18p75 transition carry-input preserve experiment'
    },
    quickComparison: {
      c54CrossEq: -362.46654,
      c56CrossEq: -362.46654,
      c54ItczWidth: 23.333,
      c56ItczWidth: 23.333,
      c54DryNorth: 1.124,
      c56DryNorth: 1.124,
      c54DrySouth: 0.496,
      c56DrySouth: 0.496,
      c54Westerlies: 1.201,
      c56Westerlies: 1.201,
      c54OceanCond: 0.12942,
      c56OceanCond: 0.12942
    },
    moistureComparison: {
      c54OceanPersistence: 0.09285,
      c56OceanPersistence: 0.09285,
      c54OceanCarryover: 0.09301,
      c56OceanCarryover: 0.09301,
      c54OceanWeakErosion: 0.09135,
      c56OceanWeakErosion: 0.09135
    },
    transportComparison: {
      c54EqLower: -2.75501,
      c56EqLower: -2.75501,
      c54EqMid: -16.7861,
      c56EqMid: -16.7861,
      c54EqUpper: -20.60412,
      c56EqUpper: -20.60412,
      c54DominantImport: -23.26958,
      c56DominantImport: -23.26958
    },
    rowComparison: {
      c5418Flux: -237.978,
      c5618Flux: -237.978,
      c5418Carryover: 0.062,
      c5618Carryover: 0.062,
      c5426Flux: -565.124,
      c5626Flux: -565.124,
      c5426Carryover: 0.058,
      c5626Carryover: 0.058,
      c5433Carryover: 0.437,
      c5633Carryover: 0.437,
      c5433Persistence: 0.434,
      c5633Persistence: 0.434
    },
    exactnessSummary: {
      exactQuickMatch: true,
      exactMoistureMatch: true,
      exactTransportMatch: true,
      exactRowMatch: true
    }
  });

  assert.match(markdown, /Architecture C57 26p25 Carryover Containment With 18p75 Transition-Support Preserve Attribution/);
  assert.match(markdown, /fully inert/i);
  assert.match(markdown, /transition carry-input preserve/i);
});
