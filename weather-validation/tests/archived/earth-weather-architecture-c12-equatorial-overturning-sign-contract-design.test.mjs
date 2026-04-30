import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC12Decision,
  renderArchitectureC12Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.mjs';

test('classifyC12Decision recognizes the need for a current low-level momentum preserve layer', () => {
  const decision = classifyC12Decision({
    offFlux: 144,
    onFlux: -372,
    offEquatorVelocity: 11.8,
    onEquatorVelocity: -20.4,
    offWesterlies: 0.53,
    onWesterlies: 1.06
  });

  assert.equal(decision.verdict, 'current_low_level_momentum_preserve_layer_required');
  assert.equal(decision.nextMove, 'Architecture C13: equatorial overturning sign contract experiment');
});

test('renderArchitectureC12Markdown includes the contract preserve layer', () => {
  const markdown = renderArchitectureC12Markdown({
    decision: {
      verdict: 'current_low_level_momentum_preserve_layer_required',
      nextMove: 'Architecture C13: equatorial overturning sign contract experiment'
    },
    attribution: {
      offFlux: 144,
      onFlux: -372,
      offEquatorVelocity: 11.8,
      onEquatorVelocity: -20.4,
      offWesterlies: 0.53,
      onWesterlies: 1.06
    },
    contract: {
      preserveLayer: [
        'src/weather/v2/windNudge5.js',
        'src/weather/v2/windEddyNudge5.js',
        'src/weather/v2/nudging5.js'
      ],
      coreParamPorts: [
        'windNudgeParams.tauSurfaceSeconds: 7 * 86400 -> 8 * 3600'
      ],
      evidenceLines: [
        'The hybrid flips equatorial low-level velocity while improving NH westerlies.'
      ]
    }
  });

  assert.match(markdown, /Architecture C12 Equatorial Overturning Sign Contract Design/);
  assert.match(markdown, /windNudge5\.js/);
  assert.match(markdown, /Architecture C13: equatorial overturning sign contract experiment/);
});
