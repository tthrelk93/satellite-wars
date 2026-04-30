import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as minimalFailingCorridorTest } from '../../scripts/agent/minimal-failing-corridor.mjs';

test('buildBaselineFreezeReport preserves frozen baseline metadata', () => {
  const report = minimalFailingCorridorTest.buildBaselineFreezeReport({
    currentBaseline: {
      commit: 'current',
      root: '/repo/current',
      metrics: { subtropicalDryNorthRatio: 1.77, itczWidthDeg: 27.36 }
    },
    historicalBaseline: {
      commit: 'historical',
      root: '/repo/historical',
      metrics: { subtropicalDryNorthRatio: 1.1, itczWidthDeg: 23.646 }
    },
    corridorTarget: {
      cellIndex: 390,
      latDeg: 28.5,
      lonDeg: -135
    },
    corridorDefinition: {
      sectorKey: 'eastPacific',
      latBandDeg: [22, 35],
      grid: { nx: 48, ny: 24, dtSeconds: 1800 }
    },
    checkpointDay: 29.75,
    targetDayValue: 30,
    windowStepsValue: 12
  });

  assert.equal(report.schema, 'satellite-wars.phase-e0-baseline-freeze.v1');
  assert.equal(report.targetDay, 30);
  assert.equal(report.windowSteps, 12);
  assert.equal(report.baselines.current.metrics.subtropicalDryNorthRatio, 1.77);
  assert.equal(report.baselines.historical.metrics.itczWidthDeg, 23.646);
  assert.equal(report.corridorDefinition.sectorKey, 'eastPacific');
});

test('buildMinimalFailingCorridorSummary identifies first and peak divergence steps', () => {
  const historicalTrace = [
    {
      postVertical: {
        simTimeSeconds: 100,
        targetCell: {
          upperCloudPathKgM2: 1,
          carriedOverUpperCloudMassKgM2: 0.8,
          weakErosionCloudSurvivalMassKgM2: 0.7,
          largeScaleCondensationSourceKgM2: 0.2,
          resolvedAscentCloudBirthPotentialKgM2: 0.05,
          precipRateMmHr: 0.1
        }
      }
    },
    {
      postVertical: {
        simTimeSeconds: 200,
        targetCell: {
          upperCloudPathKgM2: 1.1,
          carriedOverUpperCloudMassKgM2: 0.85,
          weakErosionCloudSurvivalMassKgM2: 0.75,
          largeScaleCondensationSourceKgM2: 0.22,
          resolvedAscentCloudBirthPotentialKgM2: 0.05,
          precipRateMmHr: 0.1
        }
      }
    }
  ];
  const currentTrace = [
    {
      postVertical: {
        simTimeSeconds: 100,
        targetCell: {
          upperCloudPathKgM2: 1.01,
          carriedOverUpperCloudMassKgM2: 0.81,
          weakErosionCloudSurvivalMassKgM2: 0.71,
          largeScaleCondensationSourceKgM2: 0.2,
          resolvedAscentCloudBirthPotentialKgM2: 0.05,
          precipRateMmHr: 0.1
        }
      }
    },
    {
      postVertical: {
        simTimeSeconds: 200,
        targetCell: {
          upperCloudPathKgM2: 1.4,
          carriedOverUpperCloudMassKgM2: 1.1,
          weakErosionCloudSurvivalMassKgM2: 0.98,
          largeScaleCondensationSourceKgM2: 0.31,
          resolvedAscentCloudBirthPotentialKgM2: 0.07,
          precipRateMmHr: 0.14
        }
      }
    }
  ];

  const summary = minimalFailingCorridorTest.buildMinimalFailingCorridorSummary({
    currentTrace,
    historicalTrace,
    corridorTarget: { cellIndex: 390 },
    corridorDefinition: { sectorKey: 'eastPacific', latBandDeg: [22, 35] }
  });

  assert.equal(summary.schema, 'satellite-wars.phase-e0-minimal-corridor-summary.v1');
  assert.equal(summary.firstMaterialStep.stepOffset, 1);
  assert.equal(summary.peakStep.stepOffset, 1);
  assert.equal(summary.peakStep.topDeltas[0].field, 'upperCloudPathKgM2');
  assert.match(summary.rootCauseAssessment.ruledIn[0], /step offset 1/);
});
