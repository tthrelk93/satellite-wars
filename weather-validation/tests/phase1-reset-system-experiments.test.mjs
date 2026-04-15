import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as auditTest } from '../../scripts/agent/planetary-realism-audit.mjs';

test('applySystemExperiment leaves baseline unchanged', () => {
  const core = {
    vertParams: {},
    microParams: {},
    radParams: {}
  };
  const result = auditTest.applySystemExperiment(core, 'baseline');
  assert.equal(result.key, 'baseline');
  assert.deepEqual(core.vertParams, {});
  assert.deepEqual(core.microParams, {});
  assert.deepEqual(core.radParams, {});
});

test('applySystemExperiment configures upper-cloud persistence collapse bundle', () => {
  const core = {
    vertParams: {},
    microParams: {},
    radParams: {}
  };
  const result = auditTest.applySystemExperiment(core, 'upper-cloud-persistence-collapse');
  assert.equal(result.key, 'upper-cloud-persistence-collapse');
  assert.equal(core.vertParams.upperCloudWeakErosionSupportScale, 0.68);
  assert.equal(core.vertParams.upperCloudPersistenceSupportScale, 0.72);
  assert.equal(core.radParams.upperCloudRadiativePersistenceEquivalentScale, 0.62);
});

test('applySystemExperiment configures annual numerical hardening bundle', () => {
  const core = {
    vertParams: {},
    microParams: {},
    radParams: {}
  };
  const result = auditTest.applySystemExperiment(core, 'annual-numerical-hardening');
  assert.equal(result.key, 'annual-numerical-hardening');
  assert.equal(core.vertParams.verticalAdvectionCflMax, 0.3);
  assert.equal(core.vertParams.dThetaMaxVertAdvPerStep, 1.5);
  assert.equal(core.microParams.dThetaMaxMicroPerStep, 0.7);
  assert.equal(core.microParams.autoMaxFrac, 0.18);
});

test('applySystemExperiment configures hydrology balance repartition bundle', () => {
  const core = {
    vertParams: {},
    microParams: {},
    radParams: {}
  };
  const result = auditTest.applySystemExperiment(core, 'hydrology-balance-repartition');
  assert.equal(result.key, 'hydrology-balance-repartition');
  assert.equal(core.vertParams.enableWeakHemiCrossHemiFloorTaper, true);
  assert.equal(core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac, 0.5);
  assert.equal(core.vertParams.subtropicalSubsidenceWeakHemiBoost, 0.15);
  assert.equal(core.microParams.softLiveStateMaintenanceSuppressionScale, 2.2);
});
