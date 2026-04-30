import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as repairAuditTest } from '../../scripts/agent/prevertical-numerical-repair-audit.mjs';

test('summarizeDirectAdvanceCap shows dt_half under-advances much more than baseline under the capped path', () => {
  const baseline = repairAuditTest.summarizeDirectAdvanceCap({
    name: 'baseline',
    nx: 48,
    ny: 24,
    dtSeconds: 1800,
    checkpointDay: 29.75
  });
  const dtHalf = repairAuditTest.summarizeDirectAdvanceCap({
    name: 'dt_half',
    nx: 48,
    ny: 24,
    dtSeconds: 900,
    checkpointDay: 29.75
  });

  assert.equal(baseline.directArrivalDays, 20.83333);
  assert.equal(dtHalf.directArrivalDays, 10.41667);
  assert.ok((dtHalf.underadvanceDays || 0) > (baseline.underadvanceDays || 0));
});

test('buildRootCauseAssessment identifies dt_half as the worst-hit variant when it under-advances the most', () => {
  const assessment = repairAuditTest.buildRootCauseAssessment([
    {
      variant: { name: 'baseline' },
      underadvanceDays: 8.91667
    },
    {
      variant: { name: 'dt_half' },
      underadvanceDays: 19.33333
    }
  ]);

  assert.equal(assessment.worstVariant, 'dt_half');
  assert.match(assessment.rootCause, /advanceModelSeconds/);
});
