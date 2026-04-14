import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhase1SCappedDryingToOmegaBridge,
  renderPhase1SReport
} from '../../scripts/agent/phase1s-capped-drying-to-omega-bridge.mjs';

test('phase 1S resolves to omega-to-jet recovery failure when bridge moves omega but NH jet stays flat', () => {
  const summary = buildPhase1SCappedDryingToOmegaBridge({
    baselineMetrics: {
      itczWidthDeg: 23.646,
      subtropicalDryNorthRatio: 1.1,
      subtropicalDrySouthRatio: 0.519,
      midlatitudeWesterliesNorthU10Ms: 1.192
    },
    offMetrics: {
      itczWidthDeg: 25.834,
      subtropicalDryNorthRatio: 1.515,
      subtropicalDrySouthRatio: 1.192,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06637,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01565,
      northTransitionDryingOmegaBridgeAppliedMeanPaS: 0,
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: 0,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14647
    },
    onMetrics: {
      itczWidthDeg: 25.837,
      subtropicalDryNorthRatio: 1.517,
      subtropicalDrySouthRatio: 1.193,
      midlatitudeWesterliesNorthU10Ms: 0.531,
      northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06845,
      northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01705,
      northTransitionDryingOmegaBridgeAppliedMeanPaS: 0.00206,
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: 0.00145,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14242
    },
    paths: {
      baselinePath: '/tmp/baseline.json',
      offPath: '/tmp/off.json',
      onPath: '/tmp/on.json',
      reportPath: '/tmp/report.md',
      jsonPath: '/tmp/report.json'
    }
  });

  assert.equal(summary.verdict, 'omega_to_jet_recovery_failure');
  assert.equal(summary.nextPhase, 'Phase 1T: Omega-To-Jet Recovery Attribution');
  assert.ok(summary.bridgeResponse.northTransitionLowLevelOmegaEffectiveMeanPaS.delta > 0);
  assert.ok(summary.bridgeResponse.northTransitionDryingOmegaBridgeAppliedMeanPaS > 0);
  const rendered = renderPhase1SReport(summary);
  assert.match(rendered, /Phase 1S Capped Drying-To-Omega Bridge Patch/);
  assert.match(rendered, /Omega-To-Jet Recovery Attribution/);
});
