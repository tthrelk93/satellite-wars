import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC14Decision,
  renderArchitectureC14Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c14-sign-contract-implementation-attribution.mjs';

test('classifyC14Decision recognizes a donor-controlled zonal-mean reversal', () => {
  const decision = classifyC14Decision({
    c10CrossEq: -371.98,
    c13CrossEq: -330.99,
    c10Zonal: -46.98,
    c13Zonal: -60.29,
    c10Eddy: -31.81,
    c13Eddy: -22.39,
    currentVerticalHasContract: true,
    archiveVerticalHasContract: false,
    dynamicsChanged: false
  });

  assert.equal(decision.verdict, 'zonal_mean_equatorial_reversal_still_vertical_scaffold_controlled');
  assert.equal(decision.nextMove, 'Architecture C15: equatorial vertical-state contract experiment');
});

test('renderArchitectureC14Markdown includes the next experiment contract', () => {
  const markdown = renderArchitectureC14Markdown({
    decision: {
      verdict: 'zonal_mean_equatorial_reversal_still_vertical_scaffold_controlled',
      nextMove: 'Architecture C15: equatorial vertical-state contract experiment'
    },
    comparison: {
      c10CrossEq: -371.98,
      c13CrossEq: -330.99,
      c10Velocity: -17.66,
      c13Velocity: -16.78,
      c10Zonal: -46.98,
      c13Zonal: -60.29,
      c10Eddy: -31.81,
      c13Eddy: -22.39
    },
    contract: {
      coreParamPorts: [
        'vertParams.rhTrig: 0.75 -> 0.72',
        'vertParams tropicalOrganizationBandDeg and subtropicalSubsidence contract from current vertical contract'
      ],
      evidenceLines: [
        'Current vertical scaffold includes the modern cross-hemi subtropical contract.'
      ]
    }
  });

  assert.match(markdown, /Architecture C14 Sign Contract Implementation Attribution/);
  assert.match(markdown, /vertical5\.js/);
  assert.match(markdown, /Architecture C15: equatorial vertical-state contract experiment/);
});
