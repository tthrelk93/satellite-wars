import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as advanceTest } from '../../scripts/agent/advance-fully.mjs';

test('advanceModelSecondsFully reaches the requested physical time despite per-call caps', () => {
  const core = {
    modelDt: 900,
    timeUTC: 0,
    _accum: 0,
    advanceModelSeconds(requestedSeconds) {
      this._accum += requestedSeconds;
      const steps = Math.floor(this._accum / this.modelDt);
      const maxSteps = Math.max(1000, Math.ceil(86400 / this.modelDt) + 10);
      const stepsToRun = Math.min(steps, maxSteps);
      this.timeUTC += stepsToRun * this.modelDt;
      this._accum -= stepsToRun * this.modelDt;
    }
  };

  advanceTest.advanceModelSecondsFully(core, 29.75 * 86400);

  assert.equal(core.timeUTC, 29.75 * 86400);
});

test('advanceToModelDayFully advances from the current model day to the target day', () => {
  const core = {
    modelDt: 1800,
    timeUTC: 10 * 86400,
    _accum: 0,
    advanceModelSeconds(requestedSeconds) {
      this._accum += requestedSeconds;
      const steps = Math.floor(this._accum / this.modelDt);
      const maxSteps = Math.max(1000, Math.ceil(86400 / this.modelDt) + 10);
      const stepsToRun = Math.min(steps, maxSteps);
      this.timeUTC += stepsToRun * this.modelDt;
      this._accum -= stepsToRun * this.modelDt;
    }
  };

  advanceTest.advanceToModelDayFully(core, 29.75);

  assert.equal(core.timeUTC, 29.75 * 86400);
});
