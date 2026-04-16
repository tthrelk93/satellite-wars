import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyC19Decision,
  renderArchitectureC19Markdown
} from '../../scripts/agent/earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.mjs';

test('classifyC19Decision recognizes vertical-overlay eddy export coupling over a shared preserve layer', () => {
  const decision = classifyC19Decision({
    sharedLowLevelPreserveLayer: true,
    c13CrossEq: -330.99,
    c17CrossEq: -353.32,
    c13EquatorZonal: -301.64,
    c17EquatorZonal: -249.96,
    c13EquatorEddy: -34.29,
    c17EquatorEddy: -109.9,
    c13EquatorVelocity: -19.45,
    c17EquatorVelocity: -20.8,
    c13North35Vapor: -467.09,
    c17North35Vapor: -373.49
  });

  assert.equal(decision.verdict, 'shared_preserve_layer_not_primary_blocker_vertical_overlay_eddy_export_coupling');
  assert.equal(decision.nextMove, 'Architecture C20: zonal-mean-preserving eddy nudge softening experiment');
});

test('renderArchitectureC19Markdown includes the shared preserve contract and next move', () => {
  const markdown = renderArchitectureC19Markdown({
    decision: {
      verdict: 'shared_preserve_layer_not_primary_blocker_vertical_overlay_eddy_export_coupling',
      nextMove: 'Architecture C20: zonal-mean-preserving eddy nudge softening experiment'
    },
    quickComparison: {
      c13CrossEq: -330.99,
      c17CrossEq: -353.32,
      c13ItczWidth: 23.88,
      c17ItczWidth: 23.45,
      c13DryNorth: 1.152,
      c17DryNorth: 1.121,
      c13DrySouth: 0.585,
      c17DrySouth: 0.511,
      c13Westerlies: 1.232,
      c17Westerlies: 1.202,
      c13OceanCond: 0.12628,
      c17OceanCond: 0.14144
    },
    transportComparison: {
      c13EquatorZonal: -301.64,
      c17EquatorZonal: -249.96,
      c13EquatorEddy: -34.29,
      c17EquatorEddy: -109.9,
      c13EquatorMidUpper: -203.66,
      c17EquatorMidUpper: -226.72,
      c13EquatorLower: -132.27,
      c17EquatorLower: -133.14,
      c13EquatorVelocity: -19.45,
      c17EquatorVelocity: -20.8,
      c13North35Vapor: -467.09,
      c17North35Vapor: -373.49
    },
    contractComparison: {
      sharedLowLevelPreserveParams: ['windNudgeParams.tauSurfaceSeconds'],
      sharedLowLevelPreserveLayer: true
    },
    nextContract: {
      focusTargets: ['windEddyParams.tauSeconds']
    }
  });

  assert.match(markdown, /Architecture C19 Zonal-Mean-Preserving Eddy Export Attribution/);
  assert.match(markdown, /shared preserve-layer params/i);
  assert.match(markdown, /Architecture C20: zonal-mean-preserving eddy nudge softening experiment/);
});
