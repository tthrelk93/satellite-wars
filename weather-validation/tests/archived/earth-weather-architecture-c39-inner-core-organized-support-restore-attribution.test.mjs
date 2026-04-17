import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC39Decision,
  renderArchitectureC39Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c39-inner-core-organized-support-restore-attribution.mjs';

test('classifyC39Decision recognizes that the inner-core restore missed the live override rows', () => {
  const decision = classifyC39Decision({
    c32CrossEq: -356.96839,
    c38CrossEq: -356.96839,
    c32OceanCond: 0.10807,
    c38OceanCond: 0.10807,
    c32ItczWidth: 23.374,
    c38ItczWidth: 23.374,
    c32DryNorth: 1.122,
    c38DryNorth: 1.122,
    c32DrySouth: 0.493,
    c38DrySouth: 0.493,
    c32Westerlies: 1.219,
    c38Westerlies: 1.219,
    c32AccumHitRows: [
      { latDeg: 33.75, value: 5.698 },
      { latDeg: 26.25, value: 18.625 },
      { latDeg: 18.75, value: 12.354 },
      { latDeg: -18.75, value: 7.313 },
      { latDeg: -26.25, value: 9.729 },
      { latDeg: -33.75, value: 0.104 }
    ],
    c38AccumHitRows: [
      { latDeg: 33.75, value: 5.698 },
      { latDeg: 26.25, value: 18.625 },
      { latDeg: 18.75, value: 12.354 },
      { latDeg: -18.75, value: 7.313 },
      { latDeg: -26.25, value: 9.729 },
      { latDeg: -33.75, value: 0.104 }
    ],
    c32AccumRemovedRows: [
      { latDeg: 33.75, value: 4.531 },
      { latDeg: 26.25, value: 14.891 }
    ],
    c38AccumRemovedRows: [
      { latDeg: 33.75, value: 4.531 },
      { latDeg: 26.25, value: 14.891 }
    ],
    innerCoreMaxAbsLatDeg: 10.5
  });

  assert.equal(decision.verdict, 'inner_core_restore_inert_active_override_targets_outside_restore_band');
  assert.equal(decision.nextMove, 'Architecture C40: transition-band organized-support restore experiment');
});

test('renderArchitectureC39Markdown includes the transition-band follow-up contract', () => {
  const markdown = renderArchitectureC39Markdown({
    decision: {
      verdict: 'inner_core_restore_inert_active_override_targets_outside_restore_band',
      nextMove: 'Architecture C40: transition-band organized-support restore experiment'
    },
    quickComparison: {
      c32CrossEq: -356.96839,
      c38CrossEq: -356.96839,
      c32ItczWidth: 23.374,
      c38ItczWidth: 23.374,
      c32DryNorth: 1.122,
      c38DryNorth: 1.122,
      c32DrySouth: 0.493,
      c38DrySouth: 0.493,
      c32Westerlies: 1.219,
      c38Westerlies: 1.219,
      c32OceanCond: 0.10807,
      c38OceanCond: 0.10807
    },
    overrideComparison: {
      c32AccumHitRows: [{ latDeg: 26.25, value: 18.625 }],
      c38AccumHitRows: [{ latDeg: 26.25, value: 18.625 }],
      c32AccumRemovedRows: [{ latDeg: 26.25, value: 14.891 }],
      c38AccumRemovedRows: [{ latDeg: 26.25, value: 14.891 }],
      c32InBandRows: [],
      c38InBandRows: [],
      c32OutOfBandRows: [{ latDeg: 26.25, value: 18.625 }],
      c38OutOfBandRows: [{ latDeg: 26.25, value: 18.625 }]
    },
    nextContract: {
      focusTargets: [
        'restore organized-support admission across the active transition band'
      ]
    },
    innerCoreMaxAbsLatDeg: 10.5
  });

  assert.match(markdown, /Architecture C39 Inner-Core Organized-Support Restore Attribution/);
  assert.match(markdown, /26.25°: 18.625/);
  assert.match(markdown, /transition band/);
});
