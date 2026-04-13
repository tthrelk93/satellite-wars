import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as phase1bPropagationTest } from '../../scripts/agent/phase1b-propagation-proof.mjs';

test('buildNeighborSet keeps a wrapped 3x3 neighborhood inside the corridor', () => {
  const indices = phase1bPropagationTest.buildNeighborSet({
    core: {
      grid: { nx: 4, ny: 3 }
    },
    targetCell: {
      rowIndex: 1,
      colIndex: 0
    },
    corridorIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8]
  });

  assert.deepEqual(indices.sort((a, b) => a - b), [0, 1, 3, 4, 5, 7, 8]);
});

test('classifyScenario identifies microphysics-dominant rebound', () => {
  const verdict = phase1bPropagationTest.classifyScenario({
    targetSurvivalFrac: 0.24,
    targetRebuildKgM2: 0.8,
    targetSaturationBirthRebuildKgM2: 0.55,
    corridorSurvivalFrac: 0.3
  });

  assert.equal(verdict.key, 'microphysics_local_maintenance_dominant');
});

test('computeReductionSummary reports survival and rebuild fractions', () => {
  const summary = phase1bPropagationTest.computeReductionSummary({
    control: {
      postVertical: {
        targetCell: { upperCloudMassKgM2: 3.5 },
        corridorBand: { upperCloudMassKgM2: 10 }
      },
      nextReplayBoundary: {
        targetCell: {
          upperCloudMassKgM2: 2.8,
          microphysicsUpperCloudSaturationBirthMassKgM2: 0.2
        },
        corridorBand: {
          upperCloudMassKgM2: 8.5,
          microphysicsUpperCloudSaturationBirthMassKgM2: 0.9
        }
      }
    },
    scenario: {
      postIntervention: {
        targetCell: { upperCloudMassKgM2: 1.5 },
        corridorBand: { upperCloudMassKgM2: 7 }
      },
      nextReplayBoundary: {
        targetCell: {
          upperCloudMassKgM2: 2.2,
          microphysicsUpperCloudSaturationBirthMassKgM2: 0.9
        },
        corridorBand: {
          upperCloudMassKgM2: 7.9,
          microphysicsUpperCloudSaturationBirthMassKgM2: 1.6
        }
      },
      intervention: {}
    }
  });

  assert.equal(summary.targetCell.postVerticalReductionKgM2, 2);
  assert.equal(summary.targetCell.nextReplayBoundaryReductionKgM2, 0.6);
  assert.equal(summary.targetCell.reductionSurvivalFrac, 0.3);
  assert.equal(summary.targetCell.saturationBirthRebuildKgM2, 0.7);
});
