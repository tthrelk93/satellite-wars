import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC47Decision,
  renderArchitectureC47Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c47-26p25-33p75-coupled-organized-support-restore-attribution.mjs';

test('classifyC47Decision recognizes that the coupled shoulder reopens the older C30 regime', () => {
  const decision = classifyC47Decision({
    quickEquivalentToC30: true,
    moistureEquivalentToC30: true,
    transportEquivalentToC30: true,
    c4033Hits: 5.51,
    c4633Hits: 6.479,
    c4033Carryover: 0.424,
    c4633Carryover: 0.485
  });

  assert.equal(decision.verdict, 'coupled_shoulder_reopens_c30_recapture_regime_full_33p75_restore_too_strong');
  assert.equal(decision.nextMove, 'Architecture C48: tapered poleward-shoulder organized-support restore experiment');
});

test('renderArchitectureC47Markdown includes the tapered-shoulder follow-up contract', () => {
  const markdown = renderArchitectureC47Markdown({
    decision: {
      verdict: 'coupled_shoulder_reopens_c30_recapture_regime_full_33p75_restore_too_strong',
      nextMove: 'Architecture C48: tapered poleward-shoulder organized-support restore experiment'
    },
    quickComparison: {
      c30CrossEq: -353.96486,
      c46CrossEq: -353.96486,
      c30ItczWidth: 23.315,
      c46ItczWidth: 23.315,
      c30DryNorth: 1.093,
      c46DryNorth: 1.093,
      c30DrySouth: 0.502,
      c46DrySouth: 0.502,
      c30Westerlies: 1.232,
      c46Westerlies: 1.232,
      c30OceanCond: 0.12693,
      c46OceanCond: 0.12693
    },
    moistureComparison: {
      c30Persistence: 0.21701,
      c46Persistence: 0.21701,
      c30Carryover: 0.2187,
      c46Carryover: 0.2187,
      c30WeakErosion: 0.21225,
      c46WeakErosion: 0.21225
    },
    transportComparison: {
      c30EqLower: -2.25443,
      c46EqLower: -2.25443,
      c30EqMid: -15.807,
      c46EqMid: -15.807,
      c30EqUpper: -19.73414,
      c46EqUpper: -19.73414,
      c30DominantImport: -22.82573,
      c46DominantImport: -22.82573
    },
    shoulderContrast: {
      c4018Hits: 12.333,
      c4618Hits: 12.375,
      c4026Hits: 18.667,
      c4626Hits: 18.625,
      c4033Hits: 5.51,
      c4633Hits: 6.479,
      c4018Carryover: 0.064,
      c4618Carryover: 0.069,
      c4026Carryover: 0.06,
      c4626Carryover: 0.06,
      c4033Carryover: 0.424,
      c4633Carryover: 0.485
    },
    nextContract: {
      focusTargets: [
        'keep the 26.25° lane fully restored while tapering the 33.75° poleward shoulder'
      ]
    }
  });

  assert.match(markdown, /Architecture C47 26p25-33p75 Coupled Organized-Support Restore Attribution/);
  assert.match(markdown, /C30/);
  assert.match(markdown, /33.75°/);
  assert.match(markdown, /taper/i);
});
