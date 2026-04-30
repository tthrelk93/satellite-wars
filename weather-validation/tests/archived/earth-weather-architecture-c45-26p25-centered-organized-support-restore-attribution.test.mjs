import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC45Decision,
  renderArchitectureC45Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c45-26p25-centered-organized-support-restore-attribution.mjs';

test('classifyC45Decision recognizes that 26.25 alone is insufficient and needs poleward shoulder coupling', () => {
  const decision = classifyC45Decision({
    c32CrossEq: -356.96839,
    c44CrossEq: -356.96839,
    c32ItczWidth: 23.374,
    c44ItczWidth: 23.374,
    c32DryNorth: 1.122,
    c44DryNorth: 1.122,
    c32DrySouth: 0.493,
    c44DrySouth: 0.493,
    c32Westerlies: 1.219,
    c44Westerlies: 1.219,
    c32OceanCond: 0.10807,
    c44OceanCond: 0.10807,
    c4026Hits: 18.667,
    c4426Hits: 18.625,
    c4033Hits: 5.51,
    c4433Hits: 5.698,
    c4026Carryover: 0.06,
    c4426Carryover: 0.05,
    c4033Carryover: 0.424,
    c4433Carryover: 0.429
  });

  assert.equal(decision.verdict, 'isolated_26p25_restore_insufficient_c40_signal_requires_poleward_shoulder_coupling');
  assert.equal(decision.nextMove, 'Architecture C46: 26p25-33p75 coupled organized-support restore experiment');
});

test('renderArchitectureC45Markdown includes the coupled-shoulder follow-up contract', () => {
  const markdown = renderArchitectureC45Markdown({
    decision: {
      verdict: 'isolated_26p25_restore_insufficient_c40_signal_requires_poleward_shoulder_coupling',
      nextMove: 'Architecture C46: 26p25-33p75 coupled organized-support restore experiment'
    },
    quickComparison: {
      c32CrossEq: -356.96839,
      c44CrossEq: -356.96839,
      c32ItczWidth: 23.374,
      c44ItczWidth: 23.374,
      c32DryNorth: 1.122,
      c44DryNorth: 1.122,
      c32DrySouth: 0.493,
      c44DrySouth: 0.493,
      c32Westerlies: 1.219,
      c44Westerlies: 1.219,
      c32OceanCond: 0.10807,
      c44OceanCond: 0.10807
    },
    latitudeShiftComparison: {
      c4026Hits: 18.667,
      c4426Hits: 18.625,
      c4026Carryover: 0.06,
      c4426Carryover: 0.05,
      c4033Hits: 5.51,
      c4433Hits: 5.698,
      c4033Carryover: 0.424,
      c4433Carryover: 0.429
    },
    nextContract: {
      focusTargets: [
        'restore organized-support across the 26.25°–33.75° poleward shoulder'
      ]
    }
  });

  assert.match(markdown, /Architecture C45 26p25-Centered Organized-Support Restore Attribution/);
  assert.match(markdown, /26.25°.*33.75°/);
  assert.match(markdown, /poleward shoulder/);
});
