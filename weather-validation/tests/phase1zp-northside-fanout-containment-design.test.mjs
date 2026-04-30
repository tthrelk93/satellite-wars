import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZPNorthsideFanoutContainmentDesign } from '../../scripts/agent/phase1zp-northside-fanout-containment-design.mjs';

test('phase 1ZP prefers a northside source-leak penalty over target-only or humidification fixes', () => {
  const summary = buildPhase1ZPNorthsideFanoutContainmentDesign({
    phase1zoSummary: {
      verdict: 'northside_condensation_fanout_without_humidification',
      scores: {
        northFanoutScore: 1.05025,
        humidificationScore: 0.0775
      },
      slices: {
        northEdge: { delta: { largeScaleCondensationSourceKgM2: 0.01256 } },
        northSpillover: { delta: { largeScaleCondensationSourceKgM2: 0.01227 } },
        northDryBeltCore: { delta: { largeScaleCondensationSourceKgM2: 0.01088 } },
        northSource: { delta: { largeScaleCondensationSourceKgM2: -0.0066 } },
        southEdge: { delta: { largeScaleCondensationSourceKgM2: -0.00001 } }
      }
    },
    paths: {
      phase1zoPath: '/tmp/phase1zo.json',
      reportPath: '/tmp/phase1zp.md',
      jsonPath: '/tmp/phase1zp.json'
    }
  });

  assert.equal(summary.verdict, 'northside_source_leak_penalty_preferred');
  assert.equal(summary.nextPhase, 'Phase 1ZQ: Implement Capped Northside Fanout Leak Penalty Patch');
  assert.equal(summary.ranking[0].key, 'northside_source_leak_penalty');
  assert.equal(summary.ranking.at(-1).key, 'north_target_only_cap');
});
