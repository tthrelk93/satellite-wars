import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZWNorthSourceReboundAttribution } from '../../scripts/agent/phase1zw-north-source-rebound-attribution.mjs';

test('phase 1ZW attributes the residual 11.25N rebound to source concentration rather than local recharge', () => {
  const lats = [-11.25, -3.75, 3.75, 11.25, 18.75, 26.25];
  const makeAudit = ({ metrics = {}, series = {} } = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.912 + (metrics.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.535 + (metrics.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.199 + (metrics.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14926 + (metrics.northDryBeltOceanLargeScaleCondensationMeanKgM2 || 0),
          crossEquatorialVaporFluxNorthKgM_1S: 143.99575 + (metrics.crossEquatorialVaporFluxNorthKgM_1S || 0)
        },
        profiles: {
          latitudesDeg: lats,
          series: {
            largeScaleCondensationSourceKgM2: [
              0.13363 + (series.s11 || 0),
              0.0616 + (series.s3 || 0),
              0.10148 + (series.n3 || 0),
              0.11169 + (series.n11 || 0),
              0.10948 + (series.n18 || 0),
              0.12633 + (series.n26 || 0)
            ],
            totalColumnWaterKgM2: [
              36.557 + (series.s11Tcw || 0),
              38.431 + (series.s3Tcw || 0),
              43.865 + (series.n3Tcw || 0),
              43.212 + (series.n11Tcw || 0),
              38.432 + (series.n18Tcw || 0),
              37.474 + (series.n26Tcw || 0)
            ],
            boundaryLayerRhFrac: [
              0.547 + (series.s11BlRh || 0),
              0.544 + (series.s3BlRh || 0),
              0.544 + (series.n3BlRh || 0),
              0.547 + (series.n11BlRh || 0),
              0.48 + (series.n18BlRh || 0),
              0.563 + (series.n26BlRh || 0)
            ],
            lowerTroposphericRhFrac: [
              0.417 + (series.s11LoRh || 0),
              0.47 + (series.s3LoRh || 0),
              0.47 + (series.n3LoRh || 0),
              0.417 + (series.n11LoRh || 0),
              0.358 + (series.n18LoRh || 0),
              0.408 + (series.n26LoRh || 0)
            ],
            midTroposphericRhFrac: [
              0.406 + (series.s11MidRh || 0),
              0.442 + (series.s3MidRh || 0),
              0.442 + (series.n3MidRh || 0),
              0.406 + (series.n11MidRh || 0),
              0.386 + (series.n18MidRh || 0),
              0.414 + (series.n26MidRh || 0)
            ],
            lowerTroposphericOmegaPaS: [
              0.27261 + (series.s11LoOmega || 0),
              0.12464 + (series.s3LoOmega || 0),
              0.12464 + (series.n3LoOmega || 0),
              0.17392 + (series.n11LoOmega || 0),
              0.43983 + (series.n18LoOmega || 0),
              0.26969 + (series.n26LoOmega || 0)
            ],
            midTroposphericOmegaPaS: [
              0.27 + (series.s11MidOmega || 0),
              0.14929 + (series.s3MidOmega || 0),
              0.14929 + (series.n3MidOmega || 0),
              0.17534 + (series.n11MidOmega || 0),
              0.45027 + (series.n18MidOmega || 0),
              0.30942 + (series.n26MidOmega || 0)
            ],
            equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: [
              0 + (series.s11Support || 0),
              0 + (series.s3Support || 0),
              0 + (series.n3Support || 0),
              0.13662 + (series.n11Support || 0),
              0 + (series.n18Support || 0),
              0 + (series.n26Support || 0)
            ],
            equatorialEdgeNorthsideLeakPenaltyDiagFrac: [
              0 + (series.s11Penalty || 0),
              0 + (series.s3Penalty || 0),
              0 + (series.n3Penalty || 0),
              0.06225 + (series.n11Penalty || 0),
              0 + (series.n18Penalty || 0),
              0 + (series.n26Penalty || 0)
            ],
            precipReevaporationMassKgM2: [
              0.01408 + (series.s11Reevap || 0),
              0.01304 + (series.s3Reevap || 0),
              0.01304 + (series.n3Reevap || 0),
              0.01408 + (series.n11Reevap || 0),
              0.01773 + (series.n18Reevap || 0),
              0.02913 + (series.n26Reevap || 0)
            ],
            verticallyIntegratedVaporFluxNorthKgM_1S: [
              0 + (series.s11Flux || 0),
              37.19719 + (series.s3Flux || 0),
              37.19719 + (series.n3Flux || 0),
              -3.04872 + (series.n11Flux || 0),
              -113.17528 + (series.n18Flux || 0),
              -394.23448 + (series.n26Flux || 0)
            ],
            verticallyIntegratedTotalWaterFluxNorthKgM_1S: [
              0 + (series.s11TotalFlux || 0),
              41.33885 + (series.s3TotalFlux || 0),
              41.33885 + (series.n3TotalFlux || 0),
              6.02177 + (series.n11TotalFlux || 0),
              -107.30247 + (series.n18TotalFlux || 0),
              -400.20821 + (series.n26TotalFlux || 0)
            ]
          }
        }
      }
    ]
  });

  const summary = buildPhase1ZWNorthSourceReboundAttribution({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      metrics: {
        itczWidthDeg: -0.072,
        subtropicalDryNorthRatio: -0.024,
        subtropicalDrySouthRatio: -0.004,
        northDryBeltOceanLargeScaleCondensationMeanKgM2: -0.01518,
        crossEquatorialVaporFluxNorthKgM_1S: 1.21412
      },
      series: {
        s11: -0.0215,
        s3: 0.01019,
        n3: -0.00238,
        n11: 0.02481,
        n18: -0.01008,
        n26: -0.01896,
        n11Tcw: -0.085,
        n11BlRh: -0.002,
        n11LoRh: -0.003,
        n11MidRh: -0.005,
        n11LoOmega: -0.00054,
        n11MidOmega: -0.00103,
        n11Support: 0.00127,
        n11Penalty: 0.00114,
        n11Reevap: -0.00272,
        n11Flux: -0.64855,
        n11TotalFlux: -1.00552
      }
    }),
    paths: {
      offPath: '/tmp/phase1zv-off.json',
      onPath: '/tmp/phase1zv-on.json',
      reportPath: '/tmp/phase1zw.md',
      jsonPath: '/tmp/phase1zw.json'
    }
  });

  assert.equal(summary.verdict, 'north_source_condensation_concentration_without_local_recharge');
  assert.equal(summary.keepWeakHemiFloorTaper, true);
  assert.equal(summary.nextPhase, 'Phase 1ZX: North Source Concentration Patch Design');
  assert.equal(summary.northSource.condensationDeltaKgM2, 0.02481);
  assert.equal(summary.northSource.totalColumnWaterDeltaKgM2, -0.085);
  assert.ok(summary.concentrationSignal > summary.localRechargeSignal);
});
