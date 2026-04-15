import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZZSourceCapRedistributionAttribution } from '../../scripts/agent/phase1zz-source-cap-redistribution-attribution.mjs';

test('phase 1ZZ identifies Atlantic dry-core redistribution as the main failed receiver lane', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.84 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.511 + (overrides.subtropicalDryNorthRatio || 0),
          subtropicalDrySouthRatio: 1.195 + (overrides.subtropicalDrySouthRatio || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13408 + (overrides.nhOceanCond || 0),
          crossEquatorialVaporFluxNorthKgM_1S: 145.20987 + (overrides.crossEq || 0)
        },
        profiles: {
          latitudesDeg: [26.25, 18.75, 11.25, 3.75, -11.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.10737 + (overrides.n26 || 0),
              0.0994 + (overrides.n18 || 0),
              0.1365 + (overrides.n11 || 0),
              0.0991 + (overrides.n3 || 0),
              0.11213 + (overrides.s11 || 0)
            ],
            totalColumnWaterKgM2: [
              37.25 + (overrides.tcw26 || 0),
              38.129,
              43.127 + (overrides.tcw11 || 0),
              43.87,
              36.606 + (overrides.tcwS11 || 0)
            ],
            lowerTroposphericOmegaPaS: [
              0.27532 + (overrides.omega26 || 0),
              0.43815,
              0.17338 + (overrides.omega11 || 0),
              0.12483,
              -0.09376 + (overrides.omegaS11 || 0)
            ]
          }
        }
      }
    ]
  });

  const makeSectorSummary = (overrides = {}) => ({
    continentalSubtropics: {
      totalLowLevelSourceMeanKgM2: 6.10531 + (overrides.contSource || 0),
      largeScaleCondensationMeanKgM2: 0.11156 + (overrides.contCond || 0)
    },
    eastPacific: {
      totalLowLevelSourceMeanKgM2: 33.65554 + (overrides.eastSource || 0),
      largeScaleCondensationMeanKgM2: 0.09889 + (overrides.eastCond || 0)
    },
    atlantic: {
      totalLowLevelSourceMeanKgM2: 18.65919 + (overrides.atlSource || 0),
      largeScaleCondensationMeanKgM2: 0.11869 + (overrides.atlCond || 0)
    },
    indoPacific: {
      totalLowLevelSourceMeanKgM2: 26.02912 + (overrides.indoSource || 0),
      largeScaleCondensationMeanKgM2: 0.15685 + (overrides.indoCond || 0)
    }
  });

  const summary = buildPhase1ZZSourceCapRedistributionAttribution({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: -0.028,
      subtropicalDryNorthRatio: -0.004,
      nhOceanCond: 0.00199,
      crossEq: 0.33263,
      n26: 0.0084,
      n18: -0.00425,
      n11: -0.0306,
      n3: 0.00749,
      s11: 0.02652,
      tcw26: -0.122,
      tcw11: -0.03,
      tcwS11: 0.017,
      omega26: 0.00233,
      omega11: -0.00006,
      omegaS11: -0.00049
    }),
    offSectorSummary: makeSectorSummary(),
    onSectorSummary: makeSectorSummary({
      contSource: -0.01898,
      contCond: -0.00004,
      eastSource: 0.02047,
      eastCond: 0.00034,
      atlSource: -0.11393,
      atlCond: 0.00966,
      indoSource: 0.00226,
      indoCond: -0.00337
    }),
    paths: {
      offPath: '/tmp/phase1zy-off.json',
      onPath: '/tmp/phase1zy-on.json',
      offSectorPath: '/tmp/phase1zy-off-nh-dry-belt-source-sector-summary.json',
      onSectorPath: '/tmp/phase1zy-on-nh-dry-belt-source-sector-summary.json',
      reportPath: '/tmp/phase1zz.md',
      jsonPath: '/tmp/phase1zz.json'
    }
  });

  assert.equal(summary.keepPatch, false);
  assert.equal(summary.verdict, 'atlantic_dry_core_redistribution_with_secondary_south_mirror');
  assert.equal(summary.nextPhase, 'Phase 1ZZA: Atlantic Dry-Core Receiver Design');
  assert.equal(summary.dominantNorthReceiver.key, 'atlantic');
  assert.equal(summary.zonalDeltas.source11NCondensation, -0.0306);
  assert.equal(summary.zonalDeltas.dryCore26NCondensation, 0.0084);
  assert.equal(summary.sectorDeltas.atlantic.largeScaleCondensationMeanKgM2, 0.00966);
});
