import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as phase1fTest } from '../../scripts/agent/phase1f-maintenance-loop-patch-design.mjs';

test('sumCloudBirthMass totals only requested bins', () => {
  const total = phase1fTest.sumCloudBirthMass(
    [
      { key: 'weak', cloudBirthMassKgM2: 1 },
      { key: 'modest', cloudBirthMassKgM2: 2 },
      { key: 'strong', cloudBirthMassKgM2: 4 }
    ],
    ['weak', 'modest']
  );
  assert.equal(total, 3);
});

test('buildPhase1FMaintenanceLoopPatchDesign selects microphysics maintenance target when condensation rises but import support falls', () => {
  const report = phase1fTest.buildPhase1FMaintenanceLoopPatchDesign({
    phase1eReport: {
      config: { reportBasePath: '/tmp/phase1e' },
      baseline: { summaryPath: '/tmp/base.json' },
      patched: { summaryPath: '/tmp/patched.json' },
      climateGuardrailDeltas: { itczWidthDeg: { baseline: 27.3, patched: 26.4, delta: -0.9 } }
    },
    baselineMoisture: {
      latestMetrics: {
        northDryBeltLargeScaleCondensationMeanKgM2: 0.16,
        northDryBeltImportedAnvilPersistenceMeanKgM2: 0.24,
        northDryBeltCarriedOverUpperCloudMeanKgM2: 0.24,
        northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.24,
        northDryBeltOceanEvapMeanMmHr: 0.24,
        northDryBeltLandEvapMeanMmHr: 0.01,
        northDryBeltBoundaryLayerRhMeanFrac: 0.61,
        northDryBeltMidTroposphereRhMeanFrac: 0.45
      },
      northDryBeltGenerationAttribution: {
        oceanLargeScaleCondensationMeanKgM2: 0.18,
        landLargeScaleCondensationMeanKgM2: 0.10
      }
    },
    patchedMoisture: {
      latestMetrics: {
        northDryBeltLargeScaleCondensationMeanKgM2: 0.17,
        northDryBeltImportedAnvilPersistenceMeanKgM2: 0.21,
        northDryBeltCarriedOverUpperCloudMeanKgM2: 0.21,
        northDryBeltWeakErosionCloudSurvivalMeanKgM2: 0.21,
        northDryBeltOceanEvapMeanMmHr: 0.239,
        northDryBeltLandEvapMeanMmHr: 0.01,
        northDryBeltBoundaryLayerRhMeanFrac: 0.60,
        northDryBeltMidTroposphereRhMeanFrac: 0.44
      },
      northDryBeltGenerationAttribution: {
        oceanLargeScaleCondensationMeanKgM2: 0.197,
        landLargeScaleCondensationMeanKgM2: 0.101
      }
    },
    baselineBirth: { attribution: { northDryBeltChannelMeansKgM2: {} } },
    patchedBirth: { attribution: { northDryBeltChannelMeansKgM2: {} } },
    baselineBirthHist: { histograms: { ascentMagnitudePaS: [{ key: 'weak', cloudBirthMassKgM2: 2 }, { key: 'modest', cloudBirthMassKgM2: 1 }, { key: 'strong', cloudBirthMassKgM2: 8 }] } },
    patchedBirthHist: { histograms: { ascentMagnitudePaS: [{ key: 'weak', cloudBirthMassKgM2: 2 }, { key: 'modest', cloudBirthMassKgM2: 1 }, { key: 'strong', cloudBirthMassKgM2: 7 }] } },
    baselineRadiation: { radiation: { northDryBeltUpperCloudRadiativePersistenceSupportMeanWm2: 46 } },
    patchedRadiation: { radiation: { northDryBeltUpperCloudRadiativePersistenceSupportMeanWm2: 44 } },
    baselineTransport: { dominantNhDryBeltVaporImport: { importMagnitudeKgM_1S: 6.3 } },
    patchedTransport: { dominantNhDryBeltVaporImport: { importMagnitudeKgM_1S: 6.1 } }
  });

  assert.equal(report.patchTarget.primaryModule, 'stepMicrophysics5');
  assert.match(report.patchMechanism.label, /saturation-adjustment/i);
  assert.equal(report.decision.exitCriteriaPass, true);
});
