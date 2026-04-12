import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as verticalHandoffProofTest } from '../../scripts/agent/vertical-handoff-proof.mjs';

test('aggregateLedger computes target and corridor closure fractions', () => {
  const state = {
    verticalUpperCloudInputMass: new Float32Array([2, 1]),
    verticalUpperCloudResolvedBirthMass: new Float32Array([0.5, 0.2]),
    verticalUpperCloudConvectiveBirthMass: new Float32Array([0.1, 0.1]),
    verticalUpperCloudCarrySurvivingMass: new Float32Array([2, 1]),
    verticalUpperCloudAppliedErosionMass: new Float32Array([0, 0]),
    verticalUpperCloudHandedToMicrophysicsMass: new Float32Array([2.6, 1.3]),
    verticalUpperCloudResidualMass: new Float32Array([0, 0]),
    microphysicsUpperCloudInputMass: new Float32Array([2.6, 1.3]),
    microphysicsUpperCloudSaturationBirthMass: new Float32Array([0.2, 0.1]),
    microphysicsUpperCloudCloudReevaporationMass: new Float32Array([0.1, 0.05]),
    microphysicsUpperCloudPrecipReevaporationMass: new Float32Array([0.05, 0.02]),
    microphysicsUpperCloudSedimentationExportMass: new Float32Array([0.15, 0.03]),
    microphysicsUpperCloudCloudToPrecipMass: new Float32Array([0.4, 0.2]),
    microphysicsUpperCloudOutputMass: new Float32Array([2.5, 1.3]),
    microphysicsUpperCloudResidualMass: new Float32Array([0, 0])
  };

  const ledger = verticalHandoffProofTest.aggregateLedger(state, 0, [0, 1]);

  assert.equal(ledger.vertical.targetCell.totalBirthMassKgM2, 0.6);
  assert.equal(ledger.vertical.targetCell.closureFrac, 1);
  assert.equal(ledger.microphysics.targetCell.outputMassKgM2, 2.5);
  assert.equal(ledger.microphysics.targetCell.closureFrac, 1);
  assert.equal(ledger.combined.targetCellClosureFrac, 1);
  assert.equal(ledger.vertical.corridorBand.handedToMicrophysicsMassKgM2, 3.9);
});

test('summarizeBaselinePair surfaces the strongest vertical and microphysics deltas', () => {
  const summary = verticalHandoffProofTest.summarizeBaselinePair({
    currentTrace: [
      {
        simTimeSeconds: 100,
        combined: { targetCellClosureFrac: 0.99, targetCellResidualMassKgM2: 0.01 },
        vertical: {
          targetCell: {
            inputMassKgM2: 2,
            resolvedBirthMassKgM2: 1.5,
            convectiveBirthMassKgM2: 0.1,
            carrySurvivingMassKgM2: 2,
            appliedErosionMassKgM2: 0,
            handedToMicrophysicsMassKgM2: 3.6,
            residualMassKgM2: 0
          }
        },
        microphysics: {
          targetCell: {
            inputMassKgM2: 3.6,
            saturationBirthMassKgM2: 0.8,
            cloudReevaporationMassKgM2: 0.1,
            precipReevaporationMassKgM2: 0.1,
            sedimentationExportMassKgM2: 0.2,
            cloudToPrecipMassKgM2: 0.5,
            outputMassKgM2: 4,
            residualMassKgM2: 0
          }
        }
      }
    ],
    historicalTrace: [
      {
        simTimeSeconds: 100,
        combined: { targetCellClosureFrac: 0.99, targetCellResidualMassKgM2: 0.01 },
        vertical: {
          targetCell: {
            inputMassKgM2: 1,
            resolvedBirthMassKgM2: 0.2,
            convectiveBirthMassKgM2: 0,
            carrySurvivingMassKgM2: 1,
            appliedErosionMassKgM2: 0,
            handedToMicrophysicsMassKgM2: 1.2,
            residualMassKgM2: 0
          }
        },
        microphysics: {
          targetCell: {
            inputMassKgM2: 1.2,
            saturationBirthMassKgM2: 0.1,
            cloudReevaporationMassKgM2: 0.05,
            precipReevaporationMassKgM2: 0.02,
            sedimentationExportMassKgM2: 0.05,
            cloudToPrecipMassKgM2: 0.1,
            outputMassKgM2: 1.18,
            residualMassKgM2: 0
          }
        }
      }
    ]
  });

  assert.equal(summary.firstDominantStep.stepOffset, 0);
  assert.equal(summary.firstDominantStep.verticalTopDelta.field, 'handedToMicrophysicsMassKgM2');
  assert.equal(summary.firstDominantStep.microphysicsTopDelta.field, 'outputMassKgM2');
});
