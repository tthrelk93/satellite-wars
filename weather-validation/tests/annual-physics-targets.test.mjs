import test from 'node:test';
import assert from 'node:assert/strict';
import {
  _test as targetsTest
} from '../../scripts/agent/annual-physics-targets.mjs';

test('buildAnnualPhysicsTargets ranks moisture partitioning first when dry belts are the main blocker', () => {
  const summary = {
    horizons: [
      {
        latest: {
          metrics: {
            subtropicalDryNorthRatio: 1.31,
            subtropicalDrySouthRatio: 0.78,
            itczWidthDeg: 24.8,
            subtropicalSubsidenceNorthMean: 0.012,
            subtropicalSubsidenceSouthMean: 0.008,
            tropicalConvectiveOrganization: 0.27,
            tropicalConvectivePotential: 0.38,
            tropicalConvectiveMassFluxKgM2S: 0.00052,
            upperDetrainmentTropicalKgM2: 0.0014,
            tropicalAnvilPersistenceFrac: 0.014,
            tropicalTradesNorthU10Ms: -0.8,
            tropicalTradesSouthU10Ms: -0.4,
            midlatitudeWesterliesNorthU10Ms: 1.2,
            midlatitudeWesterliesSouthU10Ms: 0.9,
            stormTrackNorthLatDeg: 60,
            stormTrackSouthLatDeg: -58,
            globalCloudMeanFrac: 0.72,
            globalPrecipMeanMmHr: 0.16,
            globalTcwMeanKgM2: 29.8
          }
        }
      }
    ]
  };
  const monthlyClimatology = [
    {
      monthIndex: 0,
      month: 'Jan',
      metrics: {
        subtropicalDryNorthRatio: 1.31,
        itczWidthDeg: 24.8,
        tropicalConvectiveOrganization: 0.27,
        tropicalConvectivePotential: 0.38,
        tropicalConvectiveMassFluxKgM2S: 0.00052,
        upperDetrainmentTropicalKgM2: 0.0014,
        tropicalAnvilPersistenceFrac: 0.014
      }
    }
  ];
  const realismGaps = [
    { code: 'north_subtropical_dry_belt_too_wet', severity: 1 },
    { code: 'north_subtropical_subsidence_too_weak', severity: 0.6 },
    { code: 'south_subtropical_subsidence_too_weak', severity: 0.7 },
    { code: 'itcz_width_unrealistic', severity: 0.05 }
  ];

  const targets = targetsTest.buildAnnualPhysicsTargets({ summary, monthlyClimatology, realismGaps, top: 5 });

  assert.equal(targets[0].code, 'hadley_moisture_partitioning');
  assert.ok(targets.some((target) => target.code === 'organized_tropical_convection'));
  assert.ok(targets[0].score >= targets[1].score);
});
