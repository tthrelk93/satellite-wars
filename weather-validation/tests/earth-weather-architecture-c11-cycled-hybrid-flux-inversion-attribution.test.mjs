import test from 'node:test';
import assert from 'node:assert/strict';

import {
  summarizeInterface,
  classifyC11Decision,
  renderArchitectureC11Markdown
} from '../../scripts/agent/earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.mjs';

test('summarizeInterface aggregates transport components for one interface', () => {
  const summary = summarizeInterface({
    interfaces: [
      {
        targetLatDeg: 0,
        modelLevels: [
          {
            sigmaMid: 0.2,
            totalWaterFluxNorthKgM_1S: 2,
            vaporFluxNorthKgM_1S: 1.5,
            vaporFluxZonalMeanComponentKgM_1S: 1,
            vaporFluxEddyComponentKgM_1S: 0.5,
            velocityMeanMs: 3
          },
          {
            sigmaMid: 0.6,
            totalWaterFluxNorthKgM_1S: 4,
            vaporFluxNorthKgM_1S: 3,
            vaporFluxZonalMeanComponentKgM_1S: 2.5,
            vaporFluxEddyComponentKgM_1S: 0.5,
            velocityMeanMs: 4
          }
        ]
      }
    ]
  }, 0);

  assert.equal(summary.totalWaterFluxNorthKgM_1S, 6);
  assert.equal(summary.vaporFluxNorthKgM_1S, 4.5);
  assert.equal(summary.lowerTroposphereVaporFluxNorthKgM_1S, 1.5);
  assert.equal(summary.midUpperTroposphereVaporFluxNorthKgM_1S, 3);
  assert.equal(summary.lowLevelVelocityMeanMs, 3);
});

test('classifyC11Decision recognizes equatorial overturning polarity inversion', () => {
  const decision = classifyC11Decision({
    offFlux: 140,
    onFlux: -300,
    offEquatorVelocity: 10,
    onEquatorVelocity: -20,
    offItczLat: 0.4,
    onItczLat: 5,
    offWesterlies: 0.53,
    onWesterlies: 1.08
  });

  assert.equal(decision.verdict, 'equatorial_overturning_polarity_inversion');
  assert.equal(decision.nextMove, 'Architecture C12: equatorial overturning sign contract design');
});

test('renderArchitectureC11Markdown includes the inversion evidence', () => {
  const markdown = renderArchitectureC11Markdown({
    decision: {
      verdict: 'equatorial_overturning_polarity_inversion',
      nextMove: 'Architecture C12: equatorial overturning sign contract design'
    },
    metricSummary: {
      offItczLatDeg: 0.3,
      onItczLatDeg: 5,
      offItczWidthDeg: 25.9,
      onItczWidthDeg: 24.2,
      offDryNorthRatio: 1.53,
      onDryNorthRatio: 1.31,
      offDrySouthRatio: 1.19,
      onDrySouthRatio: 0.59,
      offWesterlies: 0.53,
      onWesterlies: 1.06,
      offCrossEquatorialFlux: 144,
      onCrossEquatorialFlux: -372
    },
    interfaceSummary: {
      offEquator: {
        totalWaterFluxNorthKgM_1S: 149,
        vaporFluxZonalMeanComponentKgM_1S: 160,
        vaporFluxEddyComponentKgM_1S: -12,
        lowLevelVelocityMeanMs: 11.8
      },
      onEquator: {
        totalWaterFluxNorthKgM_1S: -382,
        vaporFluxZonalMeanComponentKgM_1S: -275,
        vaporFluxEddyComponentKgM_1S: -105,
        lowLevelVelocityMeanMs: -20.4
      },
      offNorth35: { vaporFluxNorthKgM_1S: -102 },
      onNorth35: { vaporFluxNorthKgM_1S: -387 }
    },
    hadleySummary: {
      offNorthReturnKgM_1S: 2528,
      onNorthReturnKgM_1S: 3362,
      offLocalImportedProxy: '0.11 / 0.89',
      onLocalImportedProxy: 'null / null'
    },
    moistureSummary: {
      offUpperCloudPathKgM2: 0.213,
      onUpperCloudPathKgM2: 0.401,
      offOceanCondKgM2: 0.1413,
      onOceanCondKgM2: 0.14095
    }
  });

  assert.match(markdown, /Architecture C11 Cycled Hybrid Flux Inversion Attribution/);
  assert.match(markdown, /equatorial overturning/i);
  assert.match(markdown, /Architecture C12: equatorial overturning sign contract design/);
});
