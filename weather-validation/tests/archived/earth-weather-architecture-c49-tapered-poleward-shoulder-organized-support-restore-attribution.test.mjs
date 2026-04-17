import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC49Decision,
  renderArchitectureC49Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c49-tapered-poleward-shoulder-organized-support-restore-attribution.mjs';

test('classifyC49Decision recognizes exact reproduction of the C40 transition regime', () => {
  const decision = classifyC49Decision({
    quickEquivalentToC40: true,
    moistureEquivalentToC40: true,
    transportEquivalentToC40: true,
    rowsEquivalent: true
  });

  assert.equal(decision.verdict, 'tapered_poleward_shoulder_exactly_reproduces_c40_transition_regime');
  assert.equal(decision.nextMove, 'Architecture C50: partial 26p25 receiver-guard transition-band experiment');
});

test('renderArchitectureC49Markdown includes the 26.25 receiver-guard follow-up contract', () => {
  const markdown = renderArchitectureC49Markdown({
    decision: {
      verdict: 'tapered_poleward_shoulder_exactly_reproduces_c40_transition_regime',
      nextMove: 'Architecture C50: partial 26p25 receiver-guard transition-band experiment'
    },
    quickComparison: {
      c40CrossEq: -355.94778,
      c48CrossEq: -355.94778,
      c40ItczWidth: 23.386,
      c48ItczWidth: 23.386,
      c40DryNorth: 1.128,
      c48DryNorth: 1.128,
      c40DrySouth: 0.49,
      c48DrySouth: 0.49,
      c40Westerlies: 1.225,
      c48Westerlies: 1.225,
      c40OceanCond: 0.11898,
      c48OceanCond: 0.11898
    },
    moistureComparison: {
      c40Persistence: 0.17511,
      c48Persistence: 0.17511,
      c40Carryover: 0.17677,
      c48Carryover: 0.17677,
      c40WeakErosion: 0.17145,
      c48WeakErosion: 0.17145
    },
    transportComparison: {
      c40EqLower: -2.27135,
      c48EqLower: -2.27135,
      c40EqMid: -15.52117,
      c48EqMid: -15.52117,
      c40EqUpper: -19.35472,
      c48EqUpper: -19.35472,
      c40DominantImport: -22.94616,
      c48DominantImport: -22.94616
    },
    rowComparison: {
      c4018Hits: 12.333,
      c4818Hits: 12.333,
      c4026Hits: 18.667,
      c4826Hits: 18.667,
      c4033Hits: 5.51,
      c4833Hits: 5.51,
      c4018Carryover: 0.064,
      c4818Carryover: 0.064,
      c4026Carryover: 0.06,
      c4826Carryover: 0.06,
      c4033Carryover: 0.424,
      c4833Carryover: 0.424
    },
    nextContract: {
      focusTargets: [
        'partially guard the 26.25° receiver lane'
      ]
    }
  });

  assert.match(markdown, /Architecture C49 Tapered Poleward-Shoulder Organized-Support Restore Attribution/);
  assert.match(markdown, /C40/);
  assert.match(markdown, /26\.25°/);
  assert.match(markdown, /receiver/i);
});
