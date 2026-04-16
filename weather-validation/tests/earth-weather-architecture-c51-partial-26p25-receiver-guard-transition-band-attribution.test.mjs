import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC51Decision,
  renderArchitectureC51Markdown
} from '../../scripts/agent/earth-weather-architecture-c51-partial-26p25-receiver-guard-transition-band-attribution.mjs';

test('classifyC51Decision recognizes when the partial 26.25 guard is fully inert', () => {
  const decision = classifyC51Decision({
    quickEquivalentToC40: true,
    moistureEquivalentToC40: true,
    transportEquivalentToC40: true,
    rowsEquivalent: true
  });

  assert.equal(decision.verdict, 'partial_26p25_receiver_guard_inert_threshold_below_live_binder');
  assert.equal(decision.nextMove, 'Architecture C52: strong 26p25 receiver-guard transition-band experiment');
});

test('renderArchitectureC51Markdown includes the strong 26.25 guard follow-up contract', () => {
  const markdown = renderArchitectureC51Markdown({
    decision: {
      verdict: 'partial_26p25_receiver_guard_inert_threshold_below_live_binder',
      nextMove: 'Architecture C52: strong 26p25 receiver-guard transition-band experiment'
    },
    quickComparison: {
      c40CrossEq: -355.94778,
      c50CrossEq: -355.94778,
      c40ItczWidth: 23.386,
      c50ItczWidth: 23.386,
      c40DryNorth: 1.128,
      c50DryNorth: 1.128,
      c40DrySouth: 0.49,
      c50DrySouth: 0.49,
      c40Westerlies: 1.225,
      c50Westerlies: 1.225,
      c40OceanCond: 0.11898,
      c50OceanCond: 0.11898
    },
    moistureComparison: {
      c40Persistence: 0.17511,
      c50Persistence: 0.17511,
      c40Carryover: 0.17677,
      c50Carryover: 0.17677,
      c40WeakErosion: 0.17145,
      c50WeakErosion: 0.17145
    },
    transportComparison: {
      c40EqLower: -2.27135,
      c50EqLower: -2.27135,
      c40EqMid: -15.52117,
      c50EqMid: -15.52117,
      c40EqUpper: -19.35472,
      c50EqUpper: -19.35472,
      c40DominantImport: -22.94616,
      c50DominantImport: -22.94616
    },
    rowComparison: {
      c4018Hits: 12.333,
      c5018Hits: 12.333,
      c4026Hits: 18.667,
      c5026Hits: 18.667,
      c4033Hits: 5.51,
      c5033Hits: 5.51,
      c4018Carryover: 0.064,
      c5018Carryover: 0.064,
      c4026Carryover: 0.06,
      c5026Carryover: 0.06,
      c4033Carryover: 0.424,
      c5033Carryover: 0.424
    },
    nextContract: {
      focusTargets: [
        'strengthen the 26.25° receiver guard enough to pull the center row toward the strict C32 cap'
      ]
    }
  });

  assert.match(markdown, /Architecture C51 Partial 26p25 Receiver-Guard Transition-Band Attribution/);
  assert.match(markdown, /26\.25°/);
  assert.match(markdown, /strong/i);
});
