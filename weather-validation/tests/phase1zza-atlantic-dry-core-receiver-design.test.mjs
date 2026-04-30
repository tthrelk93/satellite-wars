import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhase1ZZAAtlanticDryCoreReceiverDesign } from '../../scripts/agent/phase1zza-atlantic-dry-core-receiver-design.mjs';

test('phase 1ZZA identifies an Atlantic dry-core receiver lane rather than an upstream birth-growth lane', () => {
  const makeAudit = (overrides = {}) => ({
    samples: [
      {
        metrics: {
          itczWidthDeg: 25.84 + (overrides.itczWidthDeg || 0),
          subtropicalDryNorthRatio: 1.511 + (overrides.dryNorth || 0),
          subtropicalDrySouthRatio: 1.195 + (overrides.drySouth || 0),
          northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.13408 + (overrides.nhOceanCond || 0)
        },
        profiles: {
          latitudesDeg: [26.25, 11.25, 3.75, -11.25],
          series: {
            largeScaleCondensationSourceKgM2: [
              0.10737 + (overrides.n26Cond || 0),
              0.1365 + (overrides.n11Cond || 0),
              0.0991 + (overrides.n3Cond || 0),
              0.11213 + (overrides.s11Cond || 0)
            ],
            totalColumnWaterKgM2: [
              37.25 + (overrides.n26Tcw || 0),
              43.127 + (overrides.n11Tcw || 0),
              43.87,
              36.606 + (overrides.s11Tcw || 0)
            ],
            lowerTroposphericOmegaPaS: [
              0.27532 + (overrides.n26Omega || 0),
              0.17338 + (overrides.n11Omega || 0),
              0.12483,
              -0.09376 + (overrides.s11Omega || 0)
            ],
            midTroposphericRhFrac: [
              0.404 + (overrides.n26MidRh || 0),
              0.401,
              0.44,
              0.555
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
      totalLowLevelSourceMeanKgM2: 33.65554 + (overrides.epSource || 0),
      largeScaleCondensationMeanKgM2: 0.09889 + (overrides.epCond || 0)
    },
    atlantic: {
      totalLowLevelSourceMeanKgM2: 18.65919 + (overrides.atlSource || 0),
      largeScaleCondensationMeanKgM2: 0.11869 + (overrides.atlCond || 0)
    },
    indoPacific: {
      totalLowLevelSourceMeanKgM2: 26.02912 + (overrides.ipSource || 0),
      largeScaleCondensationMeanKgM2: 0.15685 + (overrides.ipCond || 0)
    }
  });

  const makeBirth = (overrides = {}) => ({
    northDryBeltSectorChannelMeansKgM2: {
      atlantic: {
        carryOverUpperCloudEntering: 181.33924 + (overrides.carryEnter || 0),
        carryOverUpperCloudSurviving: 177.10053 + (overrides.carrySurvive || 0),
        saturationAdjustmentCloudBirth: 149.87628 + (overrides.satBirth || 0),
        resolvedAscentCloudBirth: 60.24948 + (overrides.resolvedBirth || 0),
        convectiveDetrainmentCloudBirth: 0.0907 + (overrides.convBirth || 0)
      }
    }
  });

  const summary = buildPhase1ZZAAtlanticDryCoreReceiverDesign({
    offAudit: makeAudit(),
    onAudit: makeAudit({
      itczWidthDeg: -0.028,
      dryNorth: -0.004,
      n26Cond: 0.0084,
      n11Cond: -0.0306,
      n3Cond: 0.00749,
      s11Cond: 0.02652,
      n26Tcw: -0.122,
      n11Tcw: -0.03,
      s11Tcw: 0.017,
      n26Omega: 0.00233,
      n11Omega: -0.00006,
      s11Omega: -0.00049,
      n26MidRh: -0.006
    }),
    offSectorSummary: makeSectorSummary(),
    onSectorSummary: makeSectorSummary({
      contSource: -0.01898,
      contCond: -0.00004,
      epSource: 0.02047,
      epCond: 0.00034,
      atlSource: -0.11393,
      atlCond: 0.00966,
      ipSource: 0.00226,
      ipCond: -0.00337
    }),
    offBirthAttribution: makeBirth(),
    onBirthAttribution: makeBirth({
      carryEnter: -1.56613,
      carrySurvive: -1.535,
      satBirth: -0.61447,
      resolvedBirth: -0.03308,
      convBirth: -0.00014
    }),
    paths: {
      offPath: '/tmp/phase1zy-off.json',
      onPath: '/tmp/phase1zy-on.json',
      offSectorPath: '/tmp/phase1zy-off-nh-dry-belt-source-sector-summary.json',
      onSectorPath: '/tmp/phase1zy-on-nh-dry-belt-source-sector-summary.json',
      offBirthPath: '/tmp/phase1zy-off-vertical-cloud-birth-attribution.json',
      onBirthPath: '/tmp/phase1zy-on-vertical-cloud-birth-attribution.json',
      reportPath: '/tmp/phase1zza.md',
      jsonPath: '/tmp/phase1zza.json'
    }
  });

  assert.equal(summary.keepPatch, false);
  assert.equal(summary.verdict, 'atlantic_receiver_efficiency_without_birth_or_import_growth');
  assert.equal(summary.nextPhase, 'Phase 1ZZB: Implement Atlantic Receiver Efficiency Taper Patch');
  assert.equal(summary.sectorSignature.atlanticCondensation, 0.00966);
  assert.equal(summary.sectorSignature.atlanticLowLevelSource, -0.11393);
  assert.equal(summary.birthSignature.atlanticCarryEntering, -1.56613);
  assert.equal(summary.birthSignature.atlanticSaturationAdjustmentBirth, -0.61447);
  assert.equal(summary.zonalReceiverSignature.atlanticDryCore26NCondensation, 0.0084);
});
