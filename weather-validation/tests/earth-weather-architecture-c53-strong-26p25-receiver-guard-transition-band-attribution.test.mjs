import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC53Decision,
  renderArchitectureC53Markdown
} from '../../scripts/agent/earth-weather-architecture-c53-strong-26p25-receiver-guard-transition-band-attribution.mjs';

test('classifyC53Decision recognizes when the strong 26.25 guard is still inert and carryover-maintained', () => {
  const decision = classifyC53Decision({
    quickEquivalentToC40: true,
    moistureEquivalentToC40: true,
    transportEquivalentToC40: true,
    rowsEquivalent: true,
    receiverRowReloadStillElevated: true
  });

  assert.equal(decision.verdict, 'strong_26p25_receiver_guard_inert_receiver_reload_maintained_by_downstream_carryover');
  assert.equal(decision.nextMove, 'Architecture C54: 26p25 receiver carryover containment transition-band experiment');
});

test('renderArchitectureC53Markdown includes the carryover-containment follow-up contract', () => {
  const markdown = renderArchitectureC53Markdown({
    decision: {
      verdict: 'strong_26p25_receiver_guard_inert_receiver_reload_maintained_by_downstream_carryover',
      nextMove: 'Architecture C54: 26p25 receiver carryover containment transition-band experiment'
    },
    quickComparison: {
      c40CrossEq: -355.94778,
      c52CrossEq: -355.94778,
      c40ItczWidth: 23.386,
      c52ItczWidth: 23.386,
      c40DryNorth: 1.128,
      c52DryNorth: 1.128,
      c40DrySouth: 0.49,
      c52DrySouth: 0.49,
      c40Westerlies: 1.225,
      c52Westerlies: 1.225,
      c40OceanCond: 0.11898,
      c52OceanCond: 0.11898
    },
    moistureComparison: {
      c40Persistence: 0.17511,
      c52Persistence: 0.17511,
      c40Carryover: 0.17677,
      c52Carryover: 0.17677,
      c40WeakErosion: 0.17145,
      c52WeakErosion: 0.17145
    },
    transportComparison: {
      c40EqLower: -2.27135,
      c52EqLower: -2.27135,
      c40EqMid: -15.52117,
      c52EqMid: -15.52117,
      c40EqUpper: -19.35472,
      c52EqUpper: -19.35472,
      c40DominantImport: -22.94616,
      c52DominantImport: -22.94616
    },
    rowComparison: {
      c3226Hits: 18.625,
      c4026Hits: 18.667,
      c5226Hits: 18.667,
      c3226Carryover: 0.05,
      c4026Carryover: 0.06,
      c5226Carryover: 0.06,
      c3226Persistence: 0.05,
      c4026Persistence: 0.06,
      c5226Persistence: 0.06,
      c4018Hits: 12.333,
      c5218Hits: 12.333,
      c4033Hits: 5.51,
      c5233Hits: 5.51
    },
    nextContract: {
      focusTargets: [
        '26.25° carried-over upper-cloud overlap mass'
      ]
    }
  });

  assert.match(markdown, /Architecture C53 Strong 26p25 Receiver-Guard Transition-Band Attribution/);
  assert.match(markdown, /carryover/i);
  assert.match(markdown, /26\.25°/);
});
