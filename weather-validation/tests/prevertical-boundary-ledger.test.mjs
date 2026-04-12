import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as u1Test } from '../../scripts/agent/prevertical-boundary-ledger.mjs';

test('buildBoundaryComparisons finds the first material divergence in order', () => {
  const currentTrace = {
    boundaries: {
      endPreviousStepMicrophysics5: { targetCell: { upperCloudMassKgM2: 0 }, corridorBand: { upperCloudMassKgM2: 0 } },
      endPreviousFullStep: { targetCell: { upperCloudMassKgM2: 0.01 }, corridorBand: { upperCloudMassKgM2: 0.01 } },
      startCurrentStep: { targetCell: { upperCloudMassKgM2: 0.02 }, corridorBand: { upperCloudMassKgM2: 0.02 } },
      afterStepSurface2D5: { targetCell: { upperCloudMassKgM2: 0.02 }, corridorBand: { upperCloudMassKgM2: 0.02 } },
      afterStepRadiation2D5: { targetCell: { upperCloudMassKgM2: 0.02 }, corridorBand: { upperCloudMassKgM2: 0.02 } },
      afterWindUpdates: { targetCell: { upperCloudMassKgM2: 0.03 }, corridorBand: { upperCloudMassKgM2: 0.03 } },
      afterStepSurfacePressure5: { targetCell: { upperCloudMassKgM2: 0.03 }, corridorBand: { upperCloudMassKgM2: 0.03 } },
      afterStepAdvection5: { targetCell: { upperCloudMassKgM2: 1.2 }, corridorBand: { upperCloudMassKgM2: 1.5 } },
      preStepVertical5: { targetCell: { upperCloudMassKgM2: 1.2 }, corridorBand: { upperCloudMassKgM2: 1.5 } }
    }
  };
  const historicalTrace = {
    boundaries: {
      endPreviousStepMicrophysics5: { targetCell: { upperCloudMassKgM2: 0 }, corridorBand: { upperCloudMassKgM2: 0 } },
      endPreviousFullStep: { targetCell: { upperCloudMassKgM2: 0.01 }, corridorBand: { upperCloudMassKgM2: 0.01 } },
      startCurrentStep: { targetCell: { upperCloudMassKgM2: 0.02 }, corridorBand: { upperCloudMassKgM2: 0.02 } },
      afterStepSurface2D5: { targetCell: { upperCloudMassKgM2: 0.02 }, corridorBand: { upperCloudMassKgM2: 0.02 } },
      afterStepRadiation2D5: { targetCell: { upperCloudMassKgM2: 0.02 }, corridorBand: { upperCloudMassKgM2: 0.02 } },
      afterWindUpdates: { targetCell: { upperCloudMassKgM2: 0.03 }, corridorBand: { upperCloudMassKgM2: 0.03 } },
      afterStepSurfacePressure5: { targetCell: { upperCloudMassKgM2: 0.03 }, corridorBand: { upperCloudMassKgM2: 0.03 } },
      afterStepAdvection5: { targetCell: { upperCloudMassKgM2: 0.1 }, corridorBand: { upperCloudMassKgM2: 0.1 } },
      preStepVertical5: { targetCell: { upperCloudMassKgM2: 0.1 }, corridorBand: { upperCloudMassKgM2: 0.1 } }
    }
  };

  const summary = u1Test.buildBoundaryComparisons({
    currentTrace,
    historicalTrace,
    thresholdKgM2: 0.05
  });

  assert.equal(summary.firstMaterialTargetBoundary.boundary, 'afterStepAdvection5');
  assert.equal(summary.firstMaterialCorridorBoundary.boundary, 'afterStepAdvection5');
});

test('classifyU1Decision distinguishes pre-advection and advection divergence', () => {
  const preAdvection = u1Test.classifyU1Decision({
    boundaryComparisons: {
      firstMaterialTargetBoundary: { boundary: 'startCurrentStep' },
      firstMaterialCorridorBoundary: null
    }
  });
  const advection = u1Test.classifyU1Decision({
    boundaryComparisons: {
      firstMaterialTargetBoundary: { boundary: 'afterStepAdvection5' },
      firstMaterialCorridorBoundary: null
    }
  });

  assert.equal(preAdvection.verdict, 'excess_exists_before_advection');
  assert.equal(advection.verdict, 'excess_appears_during_advection');
});

test('updateOwnershipForBoundary tracks advection imports and exports', () => {
  const seed = {
    previousStepResidualUpperCloudKgM2: 1,
    currentStepAdvectedUpperCloudImportKgM2: 0,
    currentStepAdvectedUpperCloudExportKgM2: 0,
    currentStepLocalPreverticalBirthKgM2: 0
  };
  const imported = u1Test.updateOwnershipForBoundary({
    previousSnapshot: { upperCloudMassKgM2: 1 },
    currentSnapshot: { upperCloudMassKgM2: 1.4 },
    ownership: seed,
    mode: 'advection'
  });
  const exported = u1Test.updateOwnershipForBoundary({
    previousSnapshot: { upperCloudMassKgM2: 1.4 },
    currentSnapshot: { upperCloudMassKgM2: 1.1 },
    ownership: imported,
    mode: 'advection'
  });

  assert.equal(imported.currentStepAdvectedUpperCloudImportKgM2, 0.4);
  assert.equal(exported.currentStepAdvectedUpperCloudExportKgM2, 0.3);
});
