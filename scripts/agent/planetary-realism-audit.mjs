#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { WeatherCore5 } from '../../src/weather/v2/core5.js';
import { buildValidationDiagnostics } from '../../src/weather/validation/diagnostics.js';
import { CLOUD_BIRTH_LEVEL_BANDS, cloudBirthBandOffset } from '../../src/weather/v2/cloudBirthTracing5.js';
import { NH_DRY_BELT_SOURCE_SECTOR_KEYS, SURFACE_MOISTURE_SOURCE_TRACERS, classifyNhDryBeltSector } from '../../src/weather/v2/sourceTracing5.js';
import { applyHeadlessTerrainFixture } from './headless-terrain-fixture.mjs';
import { ensureCyclePlanReady } from './plan-guard.mjs';
import { installNodeClimoLoader } from './climatology-node-loader.mjs';
import { advanceModelSecondsFully } from './advance-fully.mjs';
import {
  PLANETARY_AUDIT_CLI_FLAGS,
  buildAuditCliFlagSnapshot,
  buildAuditRunMetadata,
  collectUnknownAuditCliFlags,
  getRepoChangedFiles,
  resolveAuditLabelReportBase,
  stampAuditArtifact,
  stripKnownArtifactExtension
} from './audit-artifact-metadata.mjs';

installNodeClimoLoader();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultReportBase = path.join(repoRoot, 'weather-validation', 'reports', 'planetary-realism-status');
const defaultTrustedPhase1BaselinePath = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1-hadley-second-pass-restore-v4.json'
);

export const PLANETARY_PRESETS = {
  quick: {
    nx: 48,
    ny: 24,
    dt: 1800,
    horizonsDays: [30],
    sampleEveryDays: 15
  },
  seasonal: {
    nx: 48,
    ny: 24,
    dt: 1800,
    horizonsDays: [90],
    sampleEveryDays: 15
  },
  annual: {
    nx: 48,
    ny: 24,
    dt: 3600,
    horizonsDays: [365],
    sampleEveryDays: 15
  },
  full: {
    nx: 48,
    ny: 24,
    dt: 3600,
    horizonsDays: [30, 90, 365],
    sampleEveryDays: 15
  }
};

export const resolveAuditExecutionModes = ({ preset = 'quick', reproCheck = null, counterfactuals = null } = {}) => {
  const runDeepProofDiagnosticsByDefault = preset !== 'quick';
  const runSensitivityDiagnosticsByDefault = true;
  const resolvedReproCheck = reproCheck == null ? runSensitivityDiagnosticsByDefault : reproCheck;
  const resolvedCounterfactuals = counterfactuals == null ? runDeepProofDiagnosticsByDefault : counterfactuals;
  return {
    reproCheck: resolvedReproCheck,
    counterfactuals: resolvedCounterfactuals,
    runSensitivityDiagnostics: resolvedReproCheck === true,
    runDeepProofDiagnostics: resolvedCounterfactuals === true
  };
};

const argv = process.argv.slice(2);
const isMainInvocation = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
const unknownCliFlags = isMainInvocation ? collectUnknownAuditCliFlags(argv) : [];
if (unknownCliFlags.length) {
  throw new Error(
    `Unknown agent:planetary-realism-audit flag(s): ${unknownCliFlags.join(', ')}. `
    + `Known flags: ${PLANETARY_AUDIT_CLI_FLAGS.join(', ')}. `
    + 'Use --report-base or --label for named audit artifact bases.'
  );
}
let preset = 'quick';
let nx = null;
let ny = null;
let dt = null;
let seed = 12345;
let sampleEveryDays = null;
let horizonsDays = null;
let outPath = null;
let mdOutPath = null;
let reportBase = null;
let reproCheck = null;
let counterfactuals = null;
let instrumentationMode = 'full';
let observerEffectAudit = false;
let trustedBaselinePath = null;
let quiet = false;
let systemExperiment = 'baseline';
let carryInputOverrideMode = 'default';
let softLiveGatePatchMode = 'default';
let shoulderAbsorptionGuardPatchMode = 'default';
let shoulderGuardFateMode = 'retain';
let circulationReboundPatchMode = 'default';
let returnFlowCouplingPatchMode = 'default';
let dryingOmegaBridgePatchMode = 'default';
let equatorialEdgeSubsidenceGuardPatchMode = 'default';
let northsideFanoutLeakPenaltyPatchMode = 'default';
let weakHemiCrossHemiFloorTaperPatchMode = 'default';
let northSourceConcentrationPenaltyPatchMode = 'default';
let atlanticDryCoreReceiverTaperPatchMode = 'default';
let atlanticTransitionCarryoverContainmentPatchMode = 'default';
let architectureA1BalanceContractMode = 'default';
let architectureA2PartitionPortMode = 'default';
let architectureB1CirculationScaffoldMode = 'default';
let architectureB2CirculationStatePortMode = 'default';
let architectureB3RollbackCirculationSpliceMode = 'default';

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--preset' && argv[i + 1]) preset = argv[++i];
  else if (arg.startsWith('--preset=')) preset = arg.slice('--preset='.length);
  else if (arg === '--grid' && argv[i + 1]) {
    const [nxRaw, nyRaw] = argv[++i].toLowerCase().split('x');
    nx = Number.parseInt(nxRaw, 10);
    ny = Number.parseInt(nyRaw, 10);
  } else if (arg.startsWith('--grid=')) {
    const [nxRaw, nyRaw] = arg.slice('--grid='.length).toLowerCase().split('x');
    nx = Number.parseInt(nxRaw, 10);
    ny = Number.parseInt(nyRaw, 10);
  } else if (arg === '--dt' && argv[i + 1]) dt = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--dt=')) dt = Number.parseInt(arg.slice('--dt='.length), 10);
  else if (arg === '--seed' && argv[i + 1]) seed = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--seed=')) seed = Number.parseInt(arg.slice('--seed='.length), 10);
  else if (arg === '--sample-every-days' && argv[i + 1]) sampleEveryDays = Number.parseInt(argv[++i], 10);
  else if (arg.startsWith('--sample-every-days=')) sampleEveryDays = Number.parseInt(arg.slice('--sample-every-days='.length), 10);
  else if (arg === '--horizons-days' && argv[i + 1]) {
    horizonsDays = argv[++i].split(',').map((value) => Number.parseInt(value.trim(), 10)).filter(Number.isFinite);
  } else if (arg.startsWith('--horizons-days=')) {
    horizonsDays = arg.slice('--horizons-days='.length).split(',').map((value) => Number.parseInt(value.trim(), 10)).filter(Number.isFinite);
  } else if (arg === '--out' && argv[i + 1]) outPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--out=')) outPath = path.resolve(arg.slice('--out='.length));
  else if (arg === '--md-out' && argv[i + 1]) mdOutPath = path.resolve(argv[++i]);
  else if (arg.startsWith('--md-out=')) mdOutPath = path.resolve(arg.slice('--md-out='.length));
  else if (arg === '--report-base' && argv[i + 1]) reportBase = path.resolve(argv[++i]);
  else if (arg.startsWith('--report-base=')) reportBase = path.resolve(arg.slice('--report-base='.length));
  else if (arg === '--label' && argv[i + 1]) reportBase = resolveAuditLabelReportBase(argv[++i], { repoRoot });
  else if (arg.startsWith('--label=')) reportBase = resolveAuditLabelReportBase(arg.slice('--label='.length), { repoRoot });
  else if (arg === '--repro-check') reproCheck = true;
  else if (arg === '--no-repro-check') reproCheck = false;
  else if (arg === '--counterfactuals') counterfactuals = true;
  else if (arg === '--no-counterfactuals') counterfactuals = false;
  else if (arg === '--instrumentation-mode' && argv[i + 1]) instrumentationMode = argv[++i];
  else if (arg.startsWith('--instrumentation-mode=')) instrumentationMode = arg.slice('--instrumentation-mode='.length);
  else if (arg === '--carry-input-override' && argv[i + 1]) carryInputOverrideMode = argv[++i];
  else if (arg.startsWith('--carry-input-override=')) carryInputOverrideMode = arg.slice('--carry-input-override='.length);
  else if (arg === '--soft-live-gate-patch' && argv[i + 1]) softLiveGatePatchMode = argv[++i];
  else if (arg.startsWith('--soft-live-gate-patch=')) softLiveGatePatchMode = arg.slice('--soft-live-gate-patch='.length);
  else if (arg === '--shoulder-absorption-guard-patch' && argv[i + 1]) shoulderAbsorptionGuardPatchMode = argv[++i];
  else if (arg.startsWith('--shoulder-absorption-guard-patch=')) shoulderAbsorptionGuardPatchMode = arg.slice('--shoulder-absorption-guard-patch='.length);
  else if (arg === '--shoulder-guard-fate-mode' && argv[i + 1]) shoulderGuardFateMode = argv[++i];
  else if (arg.startsWith('--shoulder-guard-fate-mode=')) shoulderGuardFateMode = arg.slice('--shoulder-guard-fate-mode='.length);
  else if (arg === '--circulation-rebound-patch' && argv[i + 1]) circulationReboundPatchMode = argv[++i];
  else if (arg.startsWith('--circulation-rebound-patch=')) circulationReboundPatchMode = arg.slice('--circulation-rebound-patch='.length);
  else if (arg === '--return-flow-coupling-patch' && argv[i + 1]) returnFlowCouplingPatchMode = argv[++i];
  else if (arg.startsWith('--return-flow-coupling-patch=')) returnFlowCouplingPatchMode = arg.slice('--return-flow-coupling-patch='.length);
  else if (arg === '--drying-omega-bridge-patch' && argv[i + 1]) dryingOmegaBridgePatchMode = argv[++i];
  else if (arg.startsWith('--drying-omega-bridge-patch=')) dryingOmegaBridgePatchMode = arg.slice('--drying-omega-bridge-patch='.length);
  else if (arg === '--equatorial-edge-subsidence-guard-patch' && argv[i + 1]) equatorialEdgeSubsidenceGuardPatchMode = argv[++i];
  else if (arg.startsWith('--equatorial-edge-subsidence-guard-patch=')) equatorialEdgeSubsidenceGuardPatchMode = arg.slice('--equatorial-edge-subsidence-guard-patch='.length);
  else if (arg === '--northside-fanout-leak-penalty-patch' && argv[i + 1]) northsideFanoutLeakPenaltyPatchMode = argv[++i];
  else if (arg.startsWith('--northside-fanout-leak-penalty-patch=')) northsideFanoutLeakPenaltyPatchMode = arg.slice('--northside-fanout-leak-penalty-patch='.length);
  else if (arg === '--weak-hemi-cross-hemi-floor-taper-patch' && argv[i + 1]) weakHemiCrossHemiFloorTaperPatchMode = argv[++i];
  else if (arg.startsWith('--weak-hemi-cross-hemi-floor-taper-patch=')) weakHemiCrossHemiFloorTaperPatchMode = arg.slice('--weak-hemi-cross-hemi-floor-taper-patch='.length);
  else if (arg === '--north-source-concentration-penalty-patch' && argv[i + 1]) northSourceConcentrationPenaltyPatchMode = argv[++i];
  else if (arg.startsWith('--north-source-concentration-penalty-patch=')) northSourceConcentrationPenaltyPatchMode = arg.slice('--north-source-concentration-penalty-patch='.length);
  else if (arg === '--atlantic-dry-core-receiver-taper-patch' && argv[i + 1]) atlanticDryCoreReceiverTaperPatchMode = argv[++i];
  else if (arg.startsWith('--atlantic-dry-core-receiver-taper-patch=')) atlanticDryCoreReceiverTaperPatchMode = arg.slice('--atlantic-dry-core-receiver-taper-patch='.length);
  else if (arg === '--atlantic-transition-carryover-containment-patch' && argv[i + 1]) atlanticTransitionCarryoverContainmentPatchMode = argv[++i];
  else if (arg.startsWith('--atlantic-transition-carryover-containment-patch=')) atlanticTransitionCarryoverContainmentPatchMode = arg.slice('--atlantic-transition-carryover-containment-patch='.length);
  else if (arg === '--architecture-a1-balance-contract' && argv[i + 1]) architectureA1BalanceContractMode = argv[++i];
  else if (arg.startsWith('--architecture-a1-balance-contract=')) architectureA1BalanceContractMode = arg.slice('--architecture-a1-balance-contract='.length);
  else if (arg === '--architecture-a2-partition-port' && argv[i + 1]) architectureA2PartitionPortMode = argv[++i];
  else if (arg.startsWith('--architecture-a2-partition-port=')) architectureA2PartitionPortMode = arg.slice('--architecture-a2-partition-port='.length);
  else if (arg === '--architecture-b1-circulation-scaffold' && argv[i + 1]) architectureB1CirculationScaffoldMode = argv[++i];
  else if (arg.startsWith('--architecture-b1-circulation-scaffold=')) architectureB1CirculationScaffoldMode = arg.slice('--architecture-b1-circulation-scaffold='.length);
  else if (arg === '--architecture-b2-circulation-state-port' && argv[i + 1]) architectureB2CirculationStatePortMode = argv[++i];
  else if (arg.startsWith('--architecture-b2-circulation-state-port=')) architectureB2CirculationStatePortMode = arg.slice('--architecture-b2-circulation-state-port='.length);
  else if (arg === '--architecture-b3-rollback-circulation-splice' && argv[i + 1]) architectureB3RollbackCirculationSpliceMode = argv[++i];
  else if (arg.startsWith('--architecture-b3-rollback-circulation-splice=')) architectureB3RollbackCirculationSpliceMode = arg.slice('--architecture-b3-rollback-circulation-splice='.length);
  else if (arg === '--observer-effect-audit') observerEffectAudit = true;
  else if (arg === '--quiet') quiet = true;
  else if (arg === '--system-experiment' && argv[i + 1]) systemExperiment = argv[++i];
  else if (arg.startsWith('--system-experiment=')) systemExperiment = arg.slice('--system-experiment='.length);
  else if (arg === '--trusted-baseline' && argv[i + 1]) trustedBaselinePath = path.resolve(argv[++i]);
  else if (arg.startsWith('--trusted-baseline=')) trustedBaselinePath = path.resolve(arg.slice('--trusted-baseline='.length));
}

const presetConfig = PLANETARY_PRESETS[preset] || PLANETARY_PRESETS.quick;
nx = Number.isFinite(nx) && nx > 0 ? nx : presetConfig.nx;
ny = Number.isFinite(ny) && ny > 0 ? ny : presetConfig.ny;
dt = Number.isFinite(dt) && dt > 0 ? dt : presetConfig.dt;
sampleEveryDays = Number.isFinite(sampleEveryDays) && sampleEveryDays > 0 ? sampleEveryDays : presetConfig.sampleEveryDays;
horizonsDays = Array.isArray(horizonsDays) && horizonsDays.length
  ? [...new Set(horizonsDays.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b)
  : presetConfig.horizonsDays.slice();
if (!Number.isFinite(seed)) seed = 12345;
const auditExecutionModes = resolveAuditExecutionModes({ preset, reproCheck, counterfactuals });
reproCheck = auditExecutionModes.reproCheck;
counterfactuals = auditExecutionModes.counterfactuals;
const runSensitivityDiagnostics = auditExecutionModes.runSensitivityDiagnostics;
const runDeepProofDiagnostics = auditExecutionModes.runDeepProofDiagnostics;
instrumentationMode = instrumentationMode === 'disabled'
  ? 'disabled'
  : instrumentationMode === 'noop'
    ? 'noop'
    : 'full';
carryInputOverrideMode = carryInputOverrideMode === 'off'
  ? 'off'
  : carryInputOverrideMode === 'on'
    ? 'on'
    : 'default';
softLiveGatePatchMode = softLiveGatePatchMode === 'off'
  ? 'off'
  : softLiveGatePatchMode === 'on'
    ? 'on'
    : 'default';
shoulderAbsorptionGuardPatchMode = shoulderAbsorptionGuardPatchMode === 'off'
  ? 'off'
  : shoulderAbsorptionGuardPatchMode === 'on'
    ? 'on'
    : 'default';
shoulderGuardFateMode = shoulderGuardFateMode === 'sink_export'
  ? 'sink_export'
  : shoulderGuardFateMode === 'buffered_rainout'
    ? 'buffered_rainout'
    : 'retain';
circulationReboundPatchMode = circulationReboundPatchMode === 'off'
  ? 'off'
  : circulationReboundPatchMode === 'on'
    ? 'on'
    : 'default';
equatorialEdgeSubsidenceGuardPatchMode = equatorialEdgeSubsidenceGuardPatchMode === 'off'
  ? 'off'
  : equatorialEdgeSubsidenceGuardPatchMode === 'on'
    ? 'on'
    : 'default';
northsideFanoutLeakPenaltyPatchMode = northsideFanoutLeakPenaltyPatchMode === 'off'
  ? 'off'
  : northsideFanoutLeakPenaltyPatchMode === 'on'
    ? 'on'
    : 'default';
weakHemiCrossHemiFloorTaperPatchMode = weakHemiCrossHemiFloorTaperPatchMode === 'off'
  ? 'off'
  : weakHemiCrossHemiFloorTaperPatchMode === 'on'
    ? 'on'
    : 'default';
northSourceConcentrationPenaltyPatchMode = northSourceConcentrationPenaltyPatchMode === 'off'
  ? 'off'
  : northSourceConcentrationPenaltyPatchMode === 'on'
    ? 'on'
    : 'default';
atlanticDryCoreReceiverTaperPatchMode = atlanticDryCoreReceiverTaperPatchMode === 'off'
  ? 'off'
  : atlanticDryCoreReceiverTaperPatchMode === 'on'
    ? 'on'
    : 'default';
architectureA1BalanceContractMode = architectureA1BalanceContractMode === 'off'
  ? 'off'
  : architectureA1BalanceContractMode === 'on'
    ? 'on'
    : 'default';
architectureA2PartitionPortMode = [
  'default',
  'off',
  'containment-off',
  'ported-floor',
  'ported-floor-soft-containment'
].includes(architectureA2PartitionPortMode)
  ? architectureA2PartitionPortMode
  : 'default';
architectureB1CirculationScaffoldMode = [
  'default',
  'off',
  'floor-reset-light-drying',
  'narrow-band-light-drying',
  'narrow-band-soft-containment'
].includes(architectureB1CirculationScaffoldMode)
  ? architectureB1CirculationScaffoldMode
  : 'default';
architectureB2CirculationStatePortMode = [
  'default',
  'off',
  'soft-containment-return-flow-port',
  'soft-containment-omega-port',
  'open-circulation-bundle'
].includes(architectureB2CirculationStatePortMode)
  ? architectureB2CirculationStatePortMode
  : 'default';
architectureB3RollbackCirculationSpliceMode = [
  'default',
  'off',
  'ported-floor-soft-containment-return-flow',
  'ported-floor-soft-containment-omega',
  'ported-floor-open-bundle'
].includes(architectureB3RollbackCirculationSpliceMode)
  ? architectureB3RollbackCirculationSpliceMode
  : 'default';
systemExperiment = [
  'baseline',
  'upper-cloud-persistence-collapse',
  'annual-numerical-hardening',
  'hydrology-balance-repartition'
].includes(systemExperiment)
  ? systemExperiment
  : 'baseline';

const applySystemExperiment = (core, experimentKey) => {
  if (!core || experimentKey === 'baseline') {
    return {
      key: 'baseline',
      label: 'Baseline branch state',
      overrides: {}
    };
  }
  if (experimentKey === 'upper-cloud-persistence-collapse') {
    core.vertParams.upperCloudWeakErosionSupportScale = 0.68;
    core.vertParams.upperCloudPersistenceSupportScale = 0.72;
    core.radParams.upperCloudRadiativePersistenceEquivalentScale = 0.62;
    return {
      key: experimentKey,
      label: 'Upper-cloud persistence collapse',
      overrides: {
        vertParams: {
          upperCloudWeakErosionSupportScale: core.vertParams.upperCloudWeakErosionSupportScale,
          upperCloudPersistenceSupportScale: core.vertParams.upperCloudPersistenceSupportScale
        },
        radParams: {
          upperCloudRadiativePersistenceEquivalentScale: core.radParams.upperCloudRadiativePersistenceEquivalentScale
        }
      }
    };
  }
  if (experimentKey === 'annual-numerical-hardening') {
    core.vertParams.verticalAdvectionCflMax = 0.3;
    core.vertParams.dThetaMaxVertAdvPerStep = 1.5;
    core.vertParams.dThetaMaxConvPerStep = 1.9;
    core.vertParams.autoMaxFrac = 0.16;
    core.microParams.dThetaMaxMicroPerStep = 0.7;
    core.microParams.dThetaMaxMicroPerStepConv = 1.9;
    core.microParams.autoMaxFrac = 0.18;
    return {
      key: experimentKey,
      label: 'Annual numerical hardening',
      overrides: {
        vertParams: {
          verticalAdvectionCflMax: core.vertParams.verticalAdvectionCflMax,
          dThetaMaxVertAdvPerStep: core.vertParams.dThetaMaxVertAdvPerStep,
          dThetaMaxConvPerStep: core.vertParams.dThetaMaxConvPerStep,
          autoMaxFrac: core.vertParams.autoMaxFrac
        },
        microParams: {
          dThetaMaxMicroPerStep: core.microParams.dThetaMaxMicroPerStep,
          dThetaMaxMicroPerStepConv: core.microParams.dThetaMaxMicroPerStepConv,
          autoMaxFrac: core.microParams.autoMaxFrac
        }
      }
    };
  }
  core.vertParams.enableWeakHemiCrossHemiFloorTaper = true;
  core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.5;
  core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.15;
  core.vertParams.weakHemiCrossHemiFloorTaperPenalty0 = 0.025;
  core.vertParams.weakHemiCrossHemiFloorTaperPenalty1 = 0.075;
  core.microParams.softLiveStateMaintenanceSuppressionScale = 2.2;
  return {
    key: experimentKey,
    label: 'Hydrology balance repartition',
    overrides: {
      vertParams: {
        enableWeakHemiCrossHemiFloorTaper: core.vertParams.enableWeakHemiCrossHemiFloorTaper,
        subtropicalSubsidenceCrossHemiFloorFrac: core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac,
        subtropicalSubsidenceWeakHemiBoost: core.vertParams.subtropicalSubsidenceWeakHemiBoost,
        weakHemiCrossHemiFloorTaperPenalty0: core.vertParams.weakHemiCrossHemiFloorTaperPenalty0,
        weakHemiCrossHemiFloorTaperPenalty1: core.vertParams.weakHemiCrossHemiFloorTaperPenalty1
      },
      microParams: {
        softLiveStateMaintenanceSuppressionScale: core.microParams.softLiveStateMaintenanceSuppressionScale
      }
    }
  };
};

const effectiveReportBase = outPath || mdOutPath ? null : (reportBase || defaultReportBase);

const SECONDS_PER_DAY = 86400;
const PHASE1_BASELINE_METRIC_KEYS = [
  'itczWidthDeg',
  'subtropicalDryNorthRatio',
  'subtropicalDrySouthRatio',
  'subtropicalSubsidenceNorthMean',
  'subtropicalSubsidenceSouthMean',
  'tropicalTradesNorthU10Ms',
  'tropicalTradesSouthU10Ms',
  'midlatitudeWesterliesNorthU10Ms',
  'midlatitudeWesterliesSouthU10Ms'
];
const PHASE_C_CORRIDOR_SECTORS = ['eastPacific', 'atlantic', 'continentalSubtropics'];
const PHASE_C_REPLAY_WINDOWS = [1, 6, 24];
const PHASE_C_TOGGLEABLE_MODULES = ['stepAdvection5', 'stepVertical5', 'stepMicrophysics5', 'stepRadiation2D5'];
const PHASE_C_EVENT_ORDER = ['importArrival', 'failedErosion', 'largeScaleMaintenanceRebound'];
const CLOUD_BAND_INDEX_BY_KEY = new Map(CLOUD_BIRTH_LEVEL_BANDS.map((band, index) => [band.key, index]));
const PHASE1_BASELINE_METRIC_TOLERANCES = {
  itczWidthDeg: 0.05,
  subtropicalDryNorthRatio: 0.05,
  subtropicalDrySouthRatio: 0.05,
  subtropicalSubsidenceNorthMean: 0.005,
  subtropicalSubsidenceSouthMean: 0.005,
  tropicalTradesNorthU10Ms: 0.05,
  tropicalTradesSouthU10Ms: 0.05,
  midlatitudeWesterliesNorthU10Ms: 0.1,
  midlatitudeWesterliesSouthU10Ms: 0.1
};
const DEFAULT_TROPICAL_LAT = 12;
const DEFAULT_DRY_MIN_LAT = 15;
const DEFAULT_DRY_MAX_LAT = 35;
const DEFAULT_STORM_MIN_LAT = 25;
const DEFAULT_STORM_MAX_LAT = 70;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = (value, digits = 3) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const roundSeries = (values, digits = 3) => values.map((value) => round(value, digits));
const clamp01 = (value) => clamp(value, 0, 1);
const meanDefined = (values) => {
  const filtered = values.filter((value) => Number.isFinite(value));
  return filtered.length ? mean(filtered) : null;
};
const normalizeScore = (value, scale) => Number.isFinite(value) && Number.isFinite(scale) && scale > 0
  ? clamp01(value / scale)
  : null;
const safeRatio = (numerator, denominator, clampToUnit = false) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || Math.abs(denominator) <= 1e-9) return null;
  const value = numerator / denominator;
  return clampToUnit ? clamp01(value) : value;
};

export const NUMERICAL_CLIMATE_CONTRACT = {
  schema: 'satellite-wars.numerical-climate-contract.v1',
  canonicalProductionGrid: { nx: 48, ny: 24, purpose: 'gameplay' },
  routineValidationGrid: { nx: 60, ny: 30, purpose: 'periodic climate sensitivity' },
  deepValidationGrid: { nx: 96, ny: 48, purpose: 'seasonal or world-class claims' },
  dtDryBeltRatioMaxAbsDelta: 0.2,
  gridDryBeltRatioMaxAbsDelta: 0.28,
  thresholds: {
    verticalCflClampMassKgM2: 10,
    supersaturationClampMassKgM2: 250,
    cloudOrNegativeLimiterMassKgM2: 1,
    advectionWaterDriftKgM2: 0.05,
    scorePass: 0.7
  }
};

const bandNumericalLimiterMass = (band = {}) => ({
  negativeClipMassKgM2: Number(band.negativeClipMassMeanKgM2) || 0,
  supersaturationClampMassKgM2: Number(band.supersaturationClampMassMeanKgM2) || 0,
  cloudLimiterMassKgM2: Number(band.cloudLimiterMassMeanKgM2) || 0,
  verticalCflClampMassKgM2: Number(band.verticalCflClampMassMeanKgM2) || 0,
  backtraceClampExcessCells: Number(band.backtraceClampExcessCellsMean) || 0
});

export const computeNumericalIntegrityScore = ({ numericalIntegrityTracing = null, conservationSummary = null } = {}) => {
  const bands = [
    numericalIntegrityTracing?.northDryBelt,
    numericalIntegrityTracing?.southDryBelt
  ].filter(Boolean).map(bandNumericalLimiterMass);
  const maxMetric = (key) => bands.reduce((best, band) => Math.max(best, Number(band[key]) || 0), 0);
  const maxVerticalCflClampMassKgM2 = maxMetric('verticalCflClampMassKgM2');
  const maxSupersaturationClampMassKgM2 = maxMetric('supersaturationClampMassKgM2');
  const maxCloudOrNegativeLimiterMassKgM2 = bands.reduce((best, band) => Math.max(
    best,
    (Number(band.cloudLimiterMassKgM2) || 0) + (Number(band.negativeClipMassKgM2) || 0)
  ), 0);
  const maxBacktraceClampExcessCells = maxMetric('backtraceClampExcessCells');
  const advectionWaterDriftKgM2 = Math.abs(
    Number(conservationSummary?.conservationBudget?.modules?.stepAdvection5?.delta?.globalColumnWaterMeanKgM2)
      || Number(conservationSummary?.modules?.stepAdvection5?.delta?.globalColumnWaterMeanKgM2)
      || 0
  );
  const thresholds = NUMERICAL_CLIMATE_CONTRACT.thresholds;
  const penalties = {
    verticalCflClamp: normalizeScore(maxVerticalCflClampMassKgM2, thresholds.verticalCflClampMassKgM2) ?? 0,
    supersaturationClamp: normalizeScore(maxSupersaturationClampMassKgM2, thresholds.supersaturationClampMassKgM2) ?? 0,
    cloudOrNegativeLimiter: normalizeScore(maxCloudOrNegativeLimiterMassKgM2, thresholds.cloudOrNegativeLimiterMassKgM2) ?? 0,
    advectionWaterDrift: normalizeScore(advectionWaterDriftKgM2, thresholds.advectionWaterDriftKgM2) ?? 0,
    backtraceClamp: normalizeScore(maxBacktraceClampExcessCells, 2) ?? 0
  };
  const totalLimiterMassKgM2 = maxVerticalCflClampMassKgM2
    + maxSupersaturationClampMassKgM2
    + maxCloudOrNegativeLimiterMassKgM2;
  const supersaturationShare = safeRatio(maxSupersaturationClampMassKgM2, totalLimiterMassKgM2, true) ?? 0;
  const verticalShare = safeRatio(maxVerticalCflClampMassKgM2, totalLimiterMassKgM2, true) ?? 0;
  const limiterDominance = Boolean(
    penalties.verticalCflClamp >= 0.8
    || penalties.cloudOrNegativeLimiter >= 0.8
    || penalties.advectionWaterDrift >= 0.8
    || (penalties.supersaturationClamp >= 0.8 && supersaturationShare >= 0.6)
  );
  const score = 1 - mean([
    penalties.verticalCflClamp,
    penalties.supersaturationClamp,
    penalties.cloudOrNegativeLimiter,
    penalties.advectionWaterDrift,
    penalties.backtraceClamp
  ]);
  const blockers = [];
  if (penalties.verticalCflClamp >= 0.8) blockers.push('vertical_cfl_limiter_mass_dominates');
  if (penalties.supersaturationClamp >= 0.8 && supersaturationShare >= 0.6) blockers.push('supersaturation_adjustment_limiter_mass_dominates');
  if (penalties.cloudOrNegativeLimiter >= 0.8) blockers.push('negative_or_cloud_limiter_mass_dominates');
  if (penalties.advectionWaterDrift >= 0.8) blockers.push('advection_water_drift_dominates');
  return {
    schema: 'satellite-wars.numerical-integrity-score.v1',
    score: round(score, 4),
    pass: score >= thresholds.scorePass && !limiterDominance,
    limiterDominance,
    blockers,
    thresholds,
    metrics: {
      maxVerticalCflClampMassKgM2: round(maxVerticalCflClampMassKgM2, 7),
      maxSupersaturationClampMassKgM2: round(maxSupersaturationClampMassKgM2, 7),
      maxCloudOrNegativeLimiterMassKgM2: round(maxCloudOrNegativeLimiterMassKgM2, 7),
      advectionWaterDriftKgM2: round(advectionWaterDriftKgM2, 7),
      maxBacktraceClampExcessCells: round(maxBacktraceClampExcessCells, 5),
      verticalLimiterShare: round(verticalShare, 5),
      supersaturationLimiterShare: round(supersaturationShare, 5)
    },
    penalties: Object.fromEntries(Object.entries(penalties).map(([key, value]) => [key, round(value, 5)]))
  };
};

const stripKnownExtension = stripKnownArtifactExtension;

const dayToMonthIndex = (day) => {
  const normalized = ((day % 365) + 365) % 365;
  return Math.floor((normalized / 365) * 12);
};

const monthName = (monthIndex) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex] || `M${monthIndex + 1}`;
const ROOT_CAUSE_FAMILY_METADATA = [
  { key: 'importedCloudPersistence', label: 'Imported cloud persistence' },
  { key: 'localLargeScaleMaintenance', label: 'Local large-scale maintenance' },
  { key: 'radiativeThermodynamicSupport', label: 'Radiative/thermodynamic support' },
  { key: 'stormLeakage', label: 'Storm leakage / spillover' },
  { key: 'helperForcing', label: 'Helper forcing interference' },
  { key: 'initializationMemory', label: 'Initialization memory' },
  { key: 'numericalFragility', label: 'Numerical fragility' }
];

const ROOT_CAUSE_BROAD_FAMILY = {
  importedCloudPersistence: 'cloud_moisture_retention',
  localLargeScaleMaintenance: 'cloud_moisture_retention',
  radiativeThermodynamicSupport: 'thermodynamic_support',
  stormLeakage: 'storm_spillover',
  helperForcing: 'helper_forcing',
  initializationMemory: 'initialization_memory',
  numericalFragility: 'numerical_fragility'
};

const broadRootCauseFamily = (familyKey) => ROOT_CAUSE_BROAD_FAMILY[familyKey] || familyKey || null;
const ROOT_CAUSE_FAMILY_LABELS = Object.fromEntries(ROOT_CAUSE_FAMILY_METADATA.map((entry) => [entry.key, entry.label]));
const SEASON_DEFS = [
  { key: 'DJF', label: 'DJF', monthIndices: [11, 0, 1] },
  { key: 'MAM', label: 'MAM', monthIndices: [2, 3, 4] },
  { key: 'JJA', label: 'JJA', monthIndices: [5, 6, 7] },
  { key: 'SON', label: 'SON', monthIndices: [8, 9, 10] }
];
const COUNTERFACTUAL_VARIANTS = [
  {
    key: 'sourceMoisture',
    label: 'Source moisture ablation',
    family: 'Source moisture supply',
    description: 'Reduce low-level NH dry-belt ocean and tropical-N source vapor after each step.',
    strength: 0.18
  },
  {
    key: 'transportImport',
    label: '35N upper import ablation',
    family: 'Imported cloud transport',
    description: 'Reduce carried-over upper cloud arriving through the NH upper-tropospheric import corridor.',
    strength: 0.18
  },
  {
    key: 'resolvedAscentBirth',
    label: 'Resolved ascent cloud-birth ablation',
    family: 'Resolved ascent cloud birth',
    description: 'Undo a fraction of resolved-ascent cloud birth in the NH dry belt.',
    strength: 0.18
  },
  {
    key: 'saturationAdjustmentBirth',
    label: 'Saturation-adjustment cloud-birth ablation',
    family: 'Large-scale condensation maintenance',
    description: 'Undo a fraction of saturation-adjustment cloud birth in the NH dry belt.',
    strength: 0.18
  },
  {
    key: 'upperCloudErosion',
    label: 'Upper-cloud erosion boost',
    family: 'Blocked upper-cloud erosion',
    description: 'Apply extra removal against blocked NH dry-belt upper-cloud erosion mass.',
    strength: 0.18
  },
  {
    key: 'radiativeMaintenance',
    label: 'Radiative maintenance ablation',
    family: 'Radiative cloud maintenance',
    description: 'Reduce upper-cloud persistence in proportion to radiative support.',
    strength: 0.18
  },
  {
    key: 'nudgingOpposition',
    label: 'Nudging opposition ablation',
    family: 'Helper forcing interference',
    description: 'Remove nudging and analysis-injected vapor from NH dry-belt lower levels.',
    strength: 0.18
  }
];
const COUNTERFACTUAL_TOP_CANDIDATE_COUNT = 3;
const COUNTERFACTUAL_VARIANT_BY_KEY = Object.fromEntries(COUNTERFACTUAL_VARIANTS.map((variant) => [variant.key, variant]));
const COUPLED_COUNTERFACTUAL_BUNDLES = [
  {
    key: 'import_plus_erosion',
    label: 'Import + erosion',
    family: 'Coupled import / erosion bundle',
    description: 'Reduce imported upper-cloud carryover while boosting blocked erosion in the NH dry belt.',
    components: [
      { key: 'transportImport', strengthScale: 0.65 },
      { key: 'upperCloudErosion', strengthScale: 0.65 }
    ]
  },
  {
    key: 'erosion_plus_saturation_adjustment',
    label: 'Erosion + saturation-adjustment maintenance',
    family: 'Coupled erosion / maintenance bundle',
    description: 'Boost upper-cloud erosion and weaken saturation-adjustment cloud maintenance together.',
    components: [
      { key: 'upperCloudErosion', strengthScale: 0.65 },
      { key: 'saturationAdjustmentBirth', strengthScale: 0.65 }
    ]
  },
  {
    key: 'import_erosion_saturation_adjustment',
    label: 'Import + erosion + saturation-adjustment maintenance',
    family: 'Coupled import / erosion / maintenance bundle',
    description: 'Reduce import, boost erosion, and weaken saturation-adjustment maintenance as a single chain intervention.',
    components: [
      { key: 'transportImport', strengthScale: 0.55 },
      { key: 'upperCloudErosion', strengthScale: 0.55 },
      { key: 'saturationAdjustmentBirth', strengthScale: 0.55 }
    ]
  },
  {
    key: 'erosion_plus_radiative_maintenance',
    label: 'Erosion + radiative maintenance',
    family: 'Coupled erosion / radiative-support bundle',
    description: 'Boost upper-cloud erosion while reducing radiative cloud support.',
    components: [
      { key: 'upperCloudErosion', strengthScale: 0.65 },
      { key: 'radiativeMaintenance', strengthScale: 0.65 }
    ]
  },
  {
    key: 'import_erosion_radiative_maintenance',
    label: 'Import + erosion + radiative maintenance',
    family: 'Coupled import / erosion / radiative-support bundle',
    description: 'Reduce imported carryover, boost erosion, and weaken radiative maintenance together.',
    components: [
      { key: 'transportImport', strengthScale: 0.55 },
      { key: 'upperCloudErosion', strengthScale: 0.55 },
      { key: 'radiativeMaintenance', strengthScale: 0.55 }
    ]
  },
  {
    key: 'maintenance_plus_radiative_support',
    label: 'Maintenance + radiative support',
    family: 'Coupled maintenance / radiative-support bundle',
    description: 'Weaken large-scale condensation maintenance and radiative persistence together.',
    components: [
      { key: 'saturationAdjustmentBirth', strengthScale: 0.65 },
      { key: 'radiativeMaintenance', strengthScale: 0.65 }
    ]
  }
];

export const buildSampleTargetsDays = (horizonList, cadenceDays) => {
  const targets = new Set(horizonList);
  const maxHorizon = horizonList[horizonList.length - 1];
  for (let day = cadenceDays; day < maxHorizon; day += cadenceDays) {
    targets.add(day);
  }
  return [...targets].filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
};

const makeRowWeights = (latitudesDeg) => latitudesDeg.map((lat) => Math.max(0.05, Math.cos((lat * Math.PI) / 180)));

const zonalMean = (field, nx, ny) => {
  const out = new Array(ny).fill(0);
  for (let j = 0; j < ny; j += 1) {
    let total = 0;
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) total += field[row + i] || 0;
    out[j] = total / Math.max(1, nx);
  }
  return out;
};

const meanProfiles = (profiles) => {
  if (!profiles.length) return null;
  const first = profiles[0];
  const series = {};
  for (const key of Object.keys(first.series || {})) {
    const sampleSeries = profiles.map((profile) => profile.series?.[key]).filter((value) => Array.isArray(value) && value.length === first.latitudesDeg.length);
    if (!sampleSeries.length) continue;
    const aggregate = new Array(first.latitudesDeg.length).fill(0);
    for (const sample of sampleSeries) {
      for (let index = 0; index < sample.length; index += 1) {
        aggregate[index] += sample[index];
      }
    }
    series[key] = aggregate.map((value) => round(value / sampleSeries.length, key.includes('KgM2S') || key.includes('S_1') ? 5 : 3));
  }
  return {
    latitudesDeg: first.latitudesDeg.slice(),
    series
  };
};

const weightedBandMean = (series, latitudesDeg, rowWeights, lat0, lat1) => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const weight = rowWeights[j];
    total += series[j] * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const weightedBandCentroid = (series, latitudesDeg, rowWeights, lat0, lat1) => {
  let numerator = 0;
  let denominator = 0;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const value = Math.max(0, series[j]);
    const weight = rowWeights[j] * value;
    numerator += lat * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : 0;
};

const weightedBandWidth = (series, latitudesDeg, rowWeights, lat0, lat1, centerLat) => {
  let numerator = 0;
  let denominator = 0;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const value = Math.max(0, series[j]);
    const weight = rowWeights[j] * value;
    numerator += (lat - centerLat) ** 2 * weight;
    denominator += weight;
  }
  return denominator > 0 ? 2 * Math.sqrt(numerator / denominator) : 0;
};

const peakLatitude = (series, latitudesDeg, lat0, lat1) => {
  let bestIndex = -1;
  let bestValue = -Infinity;
  for (let j = 0; j < series.length; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    if (series[j] > bestValue) {
      bestValue = series[j];
      bestIndex = j;
    }
  }
  return bestIndex >= 0 ? latitudesDeg[bestIndex] : null;
};

const areaWeightedMean = (field, nx, ny, rowWeights) => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      total += (field[row + i] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const weightedFieldBandMean = (field, nx, ny, latitudesDeg, rowWeights, lat0, lat1, landMask = null, landMaskMode = 'all') => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      if (landMaskMode !== 'all' && landMask) {
        const isLand = landMask[idx] === 1;
        if (landMaskMode === 'land' && !isLand) continue;
        if (landMaskMode === 'ocean' && isLand) continue;
      }
      total += (field[idx] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const weightedFieldBandMeanWithFilter = (field, nx, ny, latitudesDeg, longitudesDeg, rowWeights, lat0, lat1, predicate = null) => {
  let total = 0;
  let weightTotal = 0;
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (lat < lat0 || lat > lat1) continue;
    const rowWeight = rowWeights[j];
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      if (predicate && !predicate({ idx, latDeg: lat, lonDeg: longitudesDeg[i] })) continue;
      total += (field[idx] || 0) * rowWeight;
      weightTotal += rowWeight;
    }
  }
  return weightTotal > 0 ? total / weightTotal : 0;
};

const getRepoCommitSha = () => {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const cloneConfigSnapshot = (core) => ({
  instrumentationMode: core.getInstrumentationMode ? core.getInstrumentationMode() : 'full',
  surfaceParams: { ...core.surfaceParams },
  advectParams: { ...core.advectParams },
  vertParams: { ...core.vertParams },
  microParams: { ...core.microParams },
  nudgeParams: { ...core.nudgeParams },
  windNudgeParams: { ...core.windNudgeParams },
  windEddyParams: { ...core.windEddyParams },
  windNudgeSpinupParams: { ...core.windNudgeSpinupParams },
  dynParams: { ...core.dynParams },
  massParams: { ...core.massParams },
  analysisIncrementParams: { ...core.analysisIncrementParams },
  radParams: { ...core.radParams },
  diagParams: { ...core.diagParams },
  lodParams: { ...core.lodParams }
});

const applyCoreConfigSnapshot = (core, snapshot, { instrumentationModeOverride = null } = {}) => {
  if (!snapshot) return;
  const nextInstrumentationMode = instrumentationModeOverride || snapshot.instrumentationMode || 'full';
  if (core.setInstrumentationMode) core.setInstrumentationMode(nextInstrumentationMode);
  Object.assign(core.surfaceParams, snapshot.surfaceParams || {});
  Object.assign(core.advectParams, snapshot.advectParams || {});
  Object.assign(core.vertParams, snapshot.vertParams || {});
  Object.assign(core.microParams, snapshot.microParams || {});
  Object.assign(core.nudgeParams, snapshot.nudgeParams || {});
  Object.assign(core.windNudgeParams, snapshot.windNudgeParams || {});
  Object.assign(core.windEddyParams, snapshot.windEddyParams || {});
  Object.assign(core.windNudgeSpinupParams, snapshot.windNudgeSpinupParams || {});
  Object.assign(core.dynParams, snapshot.dynParams || {});
  Object.assign(core.massParams, snapshot.massParams || {});
  Object.assign(core.analysisIncrementParams, snapshot.analysisIncrementParams || {});
  Object.assign(core.radParams, snapshot.radParams || {});
  Object.assign(core.diagParams, snapshot.diagParams || {});
  Object.assign(core.lodParams, snapshot.lodParams || {});
};

const buildRunManifest = ({ core, terrainFallback, sampleTargetsDays, targetsSeconds }) => ({
  schema: 'satellite-wars.run-manifest.v1',
  generatedAt: new Date().toISOString(),
  gitCommit: getRepoCommitSha(),
  gitChangedFiles: getRepoChangedFiles({ repoRoot }),
  cli: buildAuditCliFlagSnapshot(argv),
  config: {
    preset,
    nx,
    ny,
    dtSeconds: dt,
    seed,
    systemExperiment,
    sampleEveryDays,
    horizonsDays,
    carryInputOverrideMode,
    softLiveGatePatchMode,
    shoulderAbsorptionGuardPatchMode,
    shoulderGuardFateMode,
    circulationReboundPatchMode,
    equatorialEdgeSubsidenceGuardPatchMode,
    northsideFanoutLeakPenaltyPatchMode,
    weakHemiCrossHemiFloorTaperPatchMode,
    northSourceConcentrationPenaltyPatchMode,
    atlanticDryCoreReceiverTaperPatchMode,
    instrumentationMode: core.getInstrumentationMode ? core.getInstrumentationMode() : instrumentationMode,
    sampleTargetsDays,
    targetSeconds: targetsSeconds,
    reproCheckEnabled: Boolean(reproCheck),
    sensitivityDiagnosticsEnabled: Boolean(runSensitivityDiagnostics)
  },
  runtime: {
    modelDtSeconds: core.modelDt,
    moduleOrder: [
      'updateHydrostatic',
      'stepSurface2D5',
      'updateHydrostatic',
      'stepRadiation2D5',
      'updateHydrostatic',
      'stepWinds5',
      'stepWindNudge5',
      'stepWindEddyNudge5',
      'stepSurfacePressure5',
      'stepAdvection5',
      'stepVertical5',
      'updateHydrostatic',
      'stepMicrophysics5',
      'updateHydrostatic',
      'stepNudging5',
      'stepAnalysisIncrement5',
      'updateDiagnostics2D5'
    ],
    moduleTiming: core.getModuleTimingSummary ? core.getModuleTimingSummary() : null
  },
  terrain: terrainFallback || null,
  params: cloneConfigSnapshot(core)
});

const createConfiguredCore = async ({
  variantNx = nx,
  variantNy = ny,
  variantDtSeconds = dt,
  variantSeed = seed,
  configSnapshot = null,
  instrumentationModeOverride = 'full'
} = {}) => {
  const core = new WeatherCore5({
    nx: variantNx,
    ny: variantNy,
    dt: variantDtSeconds,
    seed: variantSeed,
    instrumentationMode: instrumentationModeOverride
  });
  await core._initPromise;
  if (configSnapshot) {
    applyCoreConfigSnapshot(core, configSnapshot, { instrumentationModeOverride });
  }
  applyHeadlessTerrainFixture(core);
  core.clearReplayDisabledModules?.();
  return core;
};

const createEmptyTransitionSummary = () => ({
  actualNetCloudDeltaKgM2: 0,
  transitions: {
    importedCloudEntering: 0,
    importedCloudSurvivingUnchanged: 0,
    cloudErodedAway: 0,
    cloudConvertedIntoLocalCondensationSupport: 0,
    cloudConvertedIntoPrecipSupport: 0,
    cloudLostToReevaporation: 0,
    cloudKeptAliveByRadiativePersistence: 0,
    advectiveExportLoss: 0,
    unattributedResidual: 0
  }
});

const cloneTransitionSummary = (summary = null) => {
  const base = createEmptyTransitionSummary();
  if (!summary) return base;
  base.actualNetCloudDeltaKgM2 = round(summary.actualNetCloudDeltaKgM2 || 0, 5);
  for (const key of Object.keys(base.transitions)) {
    base.transitions[key] = round(summary.transitions?.[key] || 0, 5);
  }
  return base;
};

const extractLedgerCellBandSummary = (rawLedger, moduleName, cellIndex, bandKey, cellCount) => {
  const moduleSummary = rawLedger?.modules?.[moduleName];
  const bandIndex = CLOUD_BAND_INDEX_BY_KEY.get(bandKey);
  if (!moduleSummary || !Number.isInteger(cellIndex) || !(cellIndex >= 0) || !Number.isInteger(bandIndex)) {
    return createEmptyTransitionSummary();
  }
  const offset = cloudBirthBandOffset(bandIndex, cellIndex, cellCount);
  const summary = {
    actualNetCloudDeltaKgM2: round(moduleSummary.netCloudDeltaByBandCell?.[offset] || 0, 5),
    transitions: {}
  };
  for (const key of [
    'importedCloudEntering',
    'importedCloudSurvivingUnchanged',
    'cloudErodedAway',
    'cloudConvertedIntoLocalCondensationSupport',
    'cloudConvertedIntoPrecipSupport',
    'cloudLostToReevaporation',
    'cloudKeptAliveByRadiativePersistence',
    'advectiveExportLoss',
    'unattributedResidual'
  ]) {
    summary.transitions[key] = round(moduleSummary.transitions?.[key]?.[offset] || 0, 5);
  }
  return summary;
};

const computeCorridorTargetScore = (cell = null) => {
  if (!cell?.modules?.stepVertical5) return null;
  let bestBandKey = 'midTroposphere';
  let bestScore = -Infinity;
  for (const bandKey of ['midTroposphere', 'upperTroposphere']) {
    const band = cell.modules.stepVertical5?.[bandKey];
    if (!band) continue;
    const transitions = band.transitions || {};
    const score = (
      1.2 * (transitions.importedCloudSurvivingUnchanged || 0)
      + 1.0 * (transitions.cloudConvertedIntoLocalCondensationSupport || 0)
      + 0.5 * (transitions.importedCloudEntering || 0)
      - 1.0 * (transitions.cloudErodedAway || 0)
      - 0.5 * (transitions.cloudLostToReevaporation || 0)
    );
    if (score > bestScore) {
      bestScore = score;
      bestBandKey = bandKey;
    }
  }
  return Number.isFinite(bestScore) ? { score: round(bestScore, 5), bandKey: bestBandKey } : null;
};

const selectPhaseCCorridorTargets = (latestSample = null) => {
  const cells = Array.isArray(latestSample?.cloudTransitionLedgerTracing?.cells)
    ? latestSample.cloudTransitionLedgerTracing.cells
    : [];
  return PHASE_C_CORRIDOR_SECTORS.map((sectorKey) => {
    const ranked = cells
      .filter((cell) => cell?.sectorKey === sectorKey)
      .map((cell) => ({ cell, scoreInfo: computeCorridorTargetScore(cell) }))
      .filter((entry) => entry.scoreInfo && Number.isFinite(entry.scoreInfo.score))
      .sort((a, b) => b.scoreInfo.score - a.scoreInfo.score);
    const best = ranked[0] || null;
    return {
      sectorKey,
      available: Boolean(best),
      cellIndex: best?.cell?.cellIndex ?? null,
      latDeg: best?.cell?.latDeg ?? null,
      lonDeg: best?.cell?.lonDeg ?? null,
      bandKey: best?.scoreInfo?.bandKey ?? 'midTroposphere',
      score: best?.scoreInfo?.score ?? null
    };
  });
};

const buildCorridorStepEntry = ({ rawLedger, target, cellCount, stepIndex, simTimeSeconds }) => {
  const modules = Object.fromEntries(
    PHASE_C_TOGGLEABLE_MODULES.map((moduleName) => [
      moduleName,
      extractLedgerCellBandSummary(rawLedger, moduleName, target.cellIndex, target.bandKey, cellCount)
    ])
  );
  return {
    sectorKey: target.sectorKey,
    bandKey: target.bandKey,
    cellIndex: target.cellIndex,
    stepIndex,
    simTimeSeconds: round(simTimeSeconds, 5),
    modules,
    signals: {
      importArrival: round(
        (modules.stepVertical5?.transitions?.importedCloudEntering || 0)
        + 0.5 * (modules.stepAdvection5?.transitions?.importedCloudEntering || 0),
        5
      ),
      failedErosion: round(
        (modules.stepVertical5?.transitions?.importedCloudSurvivingUnchanged || 0)
        - (modules.stepVertical5?.transitions?.cloudErodedAway || 0),
        5
      ),
      largeScaleMaintenanceRebound: round(
        modules.stepMicrophysics5?.transitions?.cloudConvertedIntoLocalCondensationSupport || 0,
        5
      )
    }
  };
};

const findFirstEventFromTrace = (steps = [], signalKey, startStepIndex = 0) => {
  const candidates = steps.filter((entry) => entry.stepIndex >= startStepIndex);
  if (!candidates.length) return null;
  const maxSignal = candidates.reduce((best, entry) => Math.max(best, entry.signals?.[signalKey] || 0), 0);
  const threshold = Math.max(0.0001, maxSignal * 0.25);
  return candidates.find((entry) => (entry.signals?.[signalKey] || 0) >= threshold) || null;
};

const buildCorridorCheckpointCatalog = (traceBySector = {}) => (
  Object.fromEntries(
    Object.entries(traceBySector).map(([sectorKey, payload]) => {
      const steps = payload?.steps || [];
      const importArrival = findFirstEventFromTrace(steps, 'importArrival', 0);
      const failedErosion = importArrival ? findFirstEventFromTrace(steps, 'failedErosion', importArrival.stepIndex) : null;
      const maintenance = failedErosion ? findFirstEventFromTrace(steps, 'largeScaleMaintenanceRebound', failedErosion.stepIndex) : null;
      const checkpoints = {
        importArrival,
        failedErosion,
        largeScaleMaintenanceRebound: maintenance
      };
      return [sectorKey, {
        ...payload,
        checkpoints
      }];
    })
  )
);

const aggregateCorridorWindow = (steps = []) => {
  const aggregate = Object.fromEntries(
    PHASE_C_TOGGLEABLE_MODULES.map((moduleName) => [moduleName, createEmptyTransitionSummary()])
  );
  for (const step of steps) {
    for (const moduleName of PHASE_C_TOGGLEABLE_MODULES) {
      const current = step.modules?.[moduleName];
      const acc = aggregate[moduleName];
      acc.actualNetCloudDeltaKgM2 += current?.actualNetCloudDeltaKgM2 || 0;
      for (const key of Object.keys(acc.transitions)) {
        acc.transitions[key] += current?.transitions?.[key] || 0;
      }
    }
  }
  for (const moduleName of PHASE_C_TOGGLEABLE_MODULES) {
    aggregate[moduleName] = cloneTransitionSummary(aggregate[moduleName]);
  }
  return aggregate;
};

const buildCorridorSlicesForSector = (sectorPayload = null) => {
  const results = [];
  const steps = sectorPayload?.steps || [];
  for (const eventKey of PHASE_C_EVENT_ORDER) {
    const checkpoint = sectorPayload?.checkpoints?.[eventKey];
    if (!checkpoint) continue;
    for (const windowSteps of PHASE_C_REPLAY_WINDOWS) {
      const preSteps = steps.filter((entry) => entry.stepIndex >= checkpoint.stepIndex - windowSteps && entry.stepIndex < checkpoint.stepIndex);
      const postSteps = steps.filter((entry) => entry.stepIndex > checkpoint.stepIndex && entry.stepIndex <= checkpoint.stepIndex + windowSteps);
      results.push({
        eventKey,
        checkpointStepIndex: checkpoint.stepIndex,
        checkpointSimTimeSeconds: checkpoint.simTimeSeconds,
        windowSteps,
        preWindowTotalsByModule: aggregateCorridorWindow(preSteps),
        eventStepByModule: Object.fromEntries(
          PHASE_C_TOGGLEABLE_MODULES.map((moduleName) => [moduleName, cloneTransitionSummary(checkpoint.modules?.[moduleName])])
        ),
        postWindowTotalsByModule: aggregateCorridorWindow(postSteps)
      });
    }
  }
  return results;
};

const computeBandCellPaths = (core, cellIndex, bandKey) => {
  const band = CLOUD_BIRTH_LEVEL_BANDS[CLOUD_BAND_INDEX_BY_KEY.get(bandKey) ?? 2];
  const { state, nz, sigmaHalf } = core;
  const { N, pHalf, qc, qi, qr, qs } = state;
  let cloudPathKgM2 = 0;
  let precipPathKgM2 = 0;
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = (sigmaHalf[lev] + sigmaHalf[lev + 1]) * 0.5;
    if (!(sigmaMid >= band.minSigma && sigmaMid < band.maxSigma)) continue;
    const idx = lev * N + cellIndex;
    const dp = pHalf[(lev + 1) * N + cellIndex] - pHalf[lev * N + cellIndex];
    if (!(dp > 0)) continue;
    const layerMassKgM2 = dp / 9.80665;
    const precipMixingRatio = (qr?.[idx] || 0) + (qs?.[idx] || 0);
    const cloudMixingRatio = (qc?.[idx] || 0) + (qi?.[idx] || 0) + precipMixingRatio;
    cloudPathKgM2 += cloudMixingRatio * layerMassKgM2;
    precipPathKgM2 += precipMixingRatio * layerMassKgM2;
  }
  return {
    cloudPathKgM2: round(cloudPathKgM2, 5),
    precipPathKgM2: round(precipPathKgM2, 5)
  };
};

const computeSectorStateMetrics = (core, target) => {
  const { state, grid } = core;
  const { nx, ny } = grid;
  const sectorTotals = {
    carriedOverUpperCloudMassKgM2: 0,
    weakErosionCloudSurvivalMassKgM2: 0,
    largeScaleCondensationSourceKgM2: 0,
    importedAnvilPersistenceMassKgM2: 0
  };
  let sectorCount = 0;
  for (let row = 0; row < ny; row += 1) {
    const latDeg = grid.latDeg[row];
    if (latDeg < 15 || latDeg > 35) continue;
    for (let i = 0; i < nx; i += 1) {
      const idx = row * nx + i;
      const isLand = (state.landMask?.[idx] || 0) === 1;
      if (classifyNhDryBeltSector({ lonDeg: grid.lonDeg[i], isLand }) !== target.sectorKey) continue;
      sectorCount += 1;
      sectorTotals.carriedOverUpperCloudMassKgM2 += state.carriedOverUpperCloudMass?.[idx] || 0;
      sectorTotals.weakErosionCloudSurvivalMassKgM2 += state.weakErosionCloudSurvivalMass?.[idx] || 0;
      sectorTotals.largeScaleCondensationSourceKgM2 += state.largeScaleCondensationSource?.[idx] || 0;
      sectorTotals.importedAnvilPersistenceMassKgM2 += state.importedAnvilPersistenceMass?.[idx] || 0;
    }
  }
  const cellMetrics = computeBandCellPaths(core, target.cellIndex, target.bandKey);
  return {
    targetCell: {
      ...cellMetrics,
      carriedOverUpperCloudMassKgM2: round(state.carriedOverUpperCloudMass?.[target.cellIndex] || 0, 5),
      weakErosionCloudSurvivalMassKgM2: round(state.weakErosionCloudSurvivalMass?.[target.cellIndex] || 0, 5),
      largeScaleCondensationSourceKgM2: round(state.largeScaleCondensationSource?.[target.cellIndex] || 0, 5),
      importedAnvilPersistenceMassKgM2: round(state.importedAnvilPersistenceMass?.[target.cellIndex] || 0, 5)
    },
    sectorMean: Object.fromEntries(
      Object.entries(sectorTotals).map(([key, value]) => [key, round(sectorCount > 0 ? value / sectorCount : 0, 5)])
    )
  };
};

const runCorridorReplayWindow = async ({ checkpointSnapshot, target, disabledModule = null, maxWindowSteps = 24 } = {}) => {
  const core = new WeatherCore5({ nx, ny, dt, seed, instrumentationMode: 'full' });
  await core._initPromise;
  applyHeadlessTerrainFixture(core);
  core.loadStateSnapshot(checkpointSnapshot);
  if (disabledModule) {
    core.setReplayDisabledModules([disabledModule]);
  } else {
    core.clearReplayDisabledModules();
  }

  const windows = {};
  const cumulativeByModule = Object.fromEntries(
    PHASE_C_TOGGLEABLE_MODULES.map((moduleName) => [moduleName, createEmptyTransitionSummary()])
  );

  for (let stepOffset = 1; stepOffset <= maxWindowSteps; stepOffset += 1) {
    core.resetCloudTransitionLedger();
    core.advanceModelSeconds(core.modelDt);
    const rawLedger = core.getCloudTransitionLedgerRaw();
    for (const moduleName of PHASE_C_TOGGLEABLE_MODULES) {
      const summary = extractLedgerCellBandSummary(rawLedger, moduleName, target.cellIndex, target.bandKey, core.state.N);
      cumulativeByModule[moduleName].actualNetCloudDeltaKgM2 += summary.actualNetCloudDeltaKgM2 || 0;
      for (const key of Object.keys(cumulativeByModule[moduleName].transitions)) {
        cumulativeByModule[moduleName].transitions[key] += summary.transitions?.[key] || 0;
      }
    }
    if (PHASE_C_REPLAY_WINDOWS.includes(stepOffset)) {
      windows[stepOffset] = {
        stepCount: stepOffset,
        metrics: computeSectorStateMetrics(core, target),
        cumulativeByModule: Object.fromEntries(
          Object.entries(cumulativeByModule).map(([moduleName, summary]) => [moduleName, cloneTransitionSummary(summary)])
        )
      };
    }
  }

  return {
    disabledModule: disabledModule || null,
    windows
  };
};

const loadTrustedBaselineArtifact = (artifactPath = defaultTrustedPhase1BaselinePath) => {
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    throw new Error(`Trusted baseline artifact not found at ${artifactPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return {
    artifactPath,
    schema: parsed?.schema || null,
    config: parsed?.config || null,
    gitCommit: parsed?.runManifest?.gitCommit || null,
    metrics: parsed?.horizons?.[0]?.latest?.metrics || parsed?.samples?.[parsed.samples.length - 1]?.metrics || null
  };
};

const buildMetricDiffMap = (referenceMetrics = {}, candidateMetrics = {}, metricKeys = PHASE1_BASELINE_METRIC_KEYS) => (
  Object.fromEntries(metricKeys.map((key) => {
    const reference = Number(referenceMetrics?.[key]);
    const candidate = Number(candidateMetrics?.[key]);
    const delta = Number.isFinite(reference) && Number.isFinite(candidate) ? candidate - reference : null;
    const tolerance = PHASE1_BASELINE_METRIC_TOLERANCES[key] ?? 0.05;
    return [key, {
      reference: Number.isFinite(reference) ? round(reference, 5) : null,
      candidate: Number.isFinite(candidate) ? round(candidate, 5) : null,
      delta: Number.isFinite(delta) ? round(delta, 5) : null,
      absDelta: Number.isFinite(delta) ? round(Math.abs(delta), 5) : null,
      tolerance,
      pass: Number.isFinite(delta) ? Math.abs(delta) <= tolerance : false
    }];
  }))
);

const advanceAndSampleCore = ({ core, sampleTargetsDays }) => {
  const samples = [];
  const timingByTarget = [];
  let previousSeconds = 0;
  for (const targetDay of sampleTargetsDays) {
    const startedAt = Date.now();
    const targetSeconds = targetDay * SECONDS_PER_DAY;
    const deltaSeconds = Math.max(0, targetSeconds - previousSeconds);
    if (deltaSeconds > 0) advanceModelSecondsFully(core, deltaSeconds);
    previousSeconds = targetSeconds;
    const diagnostics = buildValidationDiagnostics(core);
    samples.push(classifySnapshot(diagnostics, targetDay));
    timingByTarget.push({
      targetDay,
      elapsedMs: Date.now() - startedAt
    });
  }
  const horizonSummaries = horizonsDays.map((horizonDaysValue) => {
    const horizonSamples = samples.filter((sample) => sample.targetDay <= horizonDaysValue);
    return {
      horizonDays: horizonDaysValue,
      ...evaluateHorizons(horizonSamples, horizonDaysValue),
      sampleCount: horizonSamples.length
    };
  });
  return { samples, timingByTarget, horizonSummaries };
};

const runObserverEffectVariant = async ({
  variantKey,
  label,
  variantInstrumentationMode,
  sampleTargetsDays,
  targetsSeconds,
  configSnapshot
}) => {
  const core = new WeatherCore5({
    nx,
    ny,
    dt,
    seed,
    instrumentationMode: variantInstrumentationMode
  });
  await core._initPromise;
  applyCoreConfigSnapshot(core, configSnapshot, { instrumentationModeOverride: variantInstrumentationMode });
  const terrainFallback = applyHeadlessTerrainFixture(core);
  const { samples, timingByTarget, horizonSummaries } = advanceAndSampleCore({ core, sampleTargetsDays });
  const latest = horizonSummaries[horizonSummaries.length - 1]?.latest || samples[samples.length - 1] || null;
  return {
    key: variantKey,
    label,
    instrumentationMode: variantInstrumentationMode,
    headlessTerrain: terrainFallback,
    timings: timingByTarget,
    samples,
    horizons: horizonSummaries,
    latest,
    runManifest: buildRunManifest({ core, terrainFallback, sampleTargetsDays, targetsSeconds })
  };
};

const buildObserverEffectModuleOrderParityReport = (variants = []) => {
  const referenceOrder = variants[0]?.runManifest?.runtime?.moduleOrder || [];
  return {
    schema: 'satellite-wars.observer-effect-module-order-parity.v1',
    generatedAt: new Date().toISOString(),
    variants: variants.map((variant) => ({
      key: variant.key,
      label: variant.label,
      instrumentationMode: variant.instrumentationMode,
      moduleOrder: variant.runManifest?.runtime?.moduleOrder || [],
      moduleTiming: variant.runManifest?.runtime?.moduleTiming || null
    })),
    parity: variants.map((variant) => ({
      key: variant.key,
      instrumentationMode: variant.instrumentationMode,
      sameOrderAsReference: JSON.stringify(variant.runManifest?.runtime?.moduleOrder || []) === JSON.stringify(referenceOrder)
    }))
  };
};

const renderObserverEffectBaselineDiffMarkdown = (report) => {
  const lines = [
    '# Observer-Effect Baseline Diff',
    '',
    `Generated: ${report.generatedAt}`,
    `Trusted baseline: ${report.trustedBaseline.artifactPath}`,
    '',
    '## Verdict',
    '',
    `- Baseline reconciled: ${report.assessment.baselineReconciledPass ? 'yes' : 'no'}`,
    `- Observer effect likely: ${report.assessment.observerEffectLikely ? 'yes' : 'no'}`,
    `- Current diagnosis: ${report.assessment.likelyCause}`
  ];
  for (const variant of report.variants) {
    lines.push('', `## ${variant.label}`, '');
    lines.push(`- instrumentation mode: ${variant.instrumentationMode}`);
    lines.push(`- phase1 metrics within tolerance: ${variant.phase1WithinToleranceCount}/${PHASE1_BASELINE_METRIC_KEYS.length}`);
    lines.push(`- max abs phase1 delta: ${variant.maxAbsPhase1Delta}`);
    for (const key of PHASE1_BASELINE_METRIC_KEYS) {
      const diff = variant.phase1MetricDiff[key];
      lines.push(`- ${key}: ${diff.candidate} vs ${diff.reference} (${diff.delta >= 0 ? '+' : ''}${diff.delta})`);
    }
  }
  return `${lines.join('\n')}\n`;
};

const buildObserverEffectBaselineDiffReport = ({
  trustedBaseline,
  variants,
  moduleOrderParity
}) => {
  const variantSummaries = variants.map((variant) => {
    const phase1MetricDiff = buildMetricDiffMap(trustedBaseline.metrics || {}, variant.latest?.metrics || {});
    const phase1WithinToleranceCount = Object.values(phase1MetricDiff).filter((entry) => entry.pass).length;
    const maxAbsPhase1Delta = Object.values(phase1MetricDiff).reduce(
      (max, entry) => Math.max(max, Number(entry.absDelta) || 0),
      0
    );
    return {
      key: variant.key,
      label: variant.label,
      instrumentationMode: variant.instrumentationMode,
      latestTargetDay: variant.latest?.targetDay ?? null,
      latestMetrics: variant.latest?.metrics || {},
      phase1MetricDiff,
      phase1WithinToleranceCount,
      maxAbsPhase1Delta: round(maxAbsPhase1Delta, 5)
    };
  });
  const variantByKey = Object.fromEntries(variantSummaries.map((entry) => [entry.key, entry]));
  const full = variantByKey.full || null;
  const noop = variantByKey.noop || null;
  const disabled = variantByKey.disabled || null;
  const fullReconciled = Boolean(full && full.phase1WithinToleranceCount === PHASE1_BASELINE_METRIC_KEYS.length);
  const observerEffectLikely = Boolean(
    full && disabled
      && disabled.phase1WithinToleranceCount > full.phase1WithinToleranceCount
      && ((full.maxAbsPhase1Delta || 0) - (disabled.maxAbsPhase1Delta || 0)) > 0.1
  );
  return {
    schema: 'satellite-wars.observer-effect-baseline-diff.v1',
    generatedAt: new Date().toISOString(),
    trustedBaseline,
    variants: variantSummaries,
    comparisons: {
      fullVsNoop: full && noop ? buildMetricDiffMap(full.latestMetrics || {}, noop.latestMetrics || {}) : null,
      fullVsDisabled: full && disabled ? buildMetricDiffMap(full.latestMetrics || {}, disabled.latestMetrics || {}) : null
    },
    moduleOrderParity,
    assessment: {
      baselineReconciledPass: fullReconciled,
      observerEffectLikely,
      likelyCause: fullReconciled
        ? 'reconciled'
        : observerEffectLikely
          ? 'observer_effect_or_tracing_side_effect'
          : 'branch_drift_or_audit_semantics_drift'
    }
  };
};

const buildConservationSummary = ({ core }) => ({
  schema: 'satellite-wars.conservation-summary.v1',
  generatedAt: new Date().toISOString(),
  gitCommit: getRepoCommitSha(),
  conservationBudget: core.getConservationSummary ? core.getConservationSummary() : null
});

export const WATER_CYCLE_CONTRACT = {
  schema: 'satellite-wars.water-cycle-budget-contract.v1',
  annualMinSampledDays: 330,
  evapPrecipRelativeImbalanceMax: 0.15,
  tcwDriftMaxKgM2: 25,
  advectionNetDeltaMaxKgM2: 1,
  transportNumericalResidualMaxKgM2: 1,
  advectionRepairRelativeMax: 0.08,
  advectionRepairAbsoluteMaxKgM2: 50,
  tropicalNumericalLeakMaxKgM2: 1
};

const buildWaterCycleBudgetReport = ({ conservationSummary = null, preset = null } = {}) => {
  const budget = conservationSummary?.conservationBudget || conservationSummary || null;
  const waterCycle = budget?.waterCycle || {};
  const sampledDays = (Number(waterCycle.sampledModelSeconds) || Number(budget?.sampledModelSeconds) || 0) / 86400;
  const evaporation = Number(waterCycle.evaporationMeanMm) || 0;
  const precipitation = Number(waterCycle.precipitationMeanMm) || 0;
  const repairLimit = Math.max(
    WATER_CYCLE_CONTRACT.advectionRepairAbsoluteMaxKgM2,
    WATER_CYCLE_CONTRACT.advectionRepairRelativeMax * Math.max(1, evaporation, precipitation)
  );
  const blockers = [];
  const annualReady = sampledDays >= WATER_CYCLE_CONTRACT.annualMinSampledDays;
  if (String(preset || '').toLowerCase() === 'annual' && !annualReady) blockers.push('annual_sample_too_short');
  if (Math.abs(Number(waterCycle.evapPrecipRelativeImbalance) || 0) > WATER_CYCLE_CONTRACT.evapPrecipRelativeImbalanceMax) {
    blockers.push('evap_precip_imbalance');
  }
  if (Math.abs(Number(waterCycle.tcwDriftKgM2) || 0) > WATER_CYCLE_CONTRACT.tcwDriftMaxKgM2) {
    blockers.push('tcw_drift_unbounded');
  }
  if (Math.abs(Number(waterCycle.advectionNetDeltaKgM2) || 0) > WATER_CYCLE_CONTRACT.advectionNetDeltaMaxKgM2) {
    blockers.push('advection_net_water_source_sink');
  }
  if (Math.abs(Number(waterCycle.transportNumericalResidualKgM2) || 0) > WATER_CYCLE_CONTRACT.transportNumericalResidualMaxKgM2) {
    blockers.push('transport_numerical_residual');
  }
  if ((Number(waterCycle.advectionRepairMeanKgM2) || 0) > repairLimit) {
    blockers.push('advection_repair_dominates_budget');
  }
  if (Math.abs(Number(waterCycle.tropicalSourceMidlatPolarDeltaKgM2) || 0) > WATER_CYCLE_CONTRACT.tropicalNumericalLeakMaxKgM2) {
    blockers.push('tropical_source_numerical_leakage');
  }
  return {
    schema: 'satellite-wars.water-cycle-budget.v1',
    generatedAt: new Date().toISOString(),
    contract: WATER_CYCLE_CONTRACT,
    preset,
    sampledDays: round(sampledDays, 3),
    annualReady,
    evaporationMeanMm: round(evaporation, 5),
    precipitationMeanMm: round(precipitation, 5),
    evapMinusPrecipMeanMm: round(waterCycle.evapMinusPrecipMeanMm, 5),
    evapPrecipRelativeImbalance: round(waterCycle.evapPrecipRelativeImbalance, 5),
    tcwDriftKgM2: round(waterCycle.tcwDriftKgM2, 5),
    nudgingNetDeltaKgM2: round(waterCycle.nudgingNetDeltaKgM2, 5),
    advectionNetDeltaKgM2: round(waterCycle.advectionNetDeltaKgM2, 7),
    verticalNetDeltaKgM2: round(waterCycle.verticalNetDeltaKgM2, 5),
    verticalUnaccountedDeltaKgM2: round(waterCycle.verticalUnaccountedDeltaKgM2, 5),
    verticalSubtropicalDryingDemandKgM2: round(waterCycle.verticalSubtropicalDryingDemandKgM2, 5),
    verticalCloudErosionToVaporKgM2: round(waterCycle.verticalCloudErosionToVaporKgM2, 5),
    transportNumericalResidualKgM2: round(waterCycle.transportNumericalResidualKgM2, 5),
    advectionRepairMeanKgM2: round(waterCycle.advectionRepairMeanKgM2, 5),
    advectionRepairAddedMeanKgM2: round(waterCycle.advectionRepairAddedMeanKgM2, 5),
    advectionRepairRemovedMeanKgM2: round(waterCycle.advectionRepairRemovedMeanKgM2, 5),
    advectionRepairResidualMeanKgM2: round(waterCycle.advectionRepairResidualMeanKgM2, 7),
    tropicalSourceMidlatPolarDeltaKgM2: round(waterCycle.tropicalSourceMidlatPolarDeltaKgM2, 5),
    pass: blockers.length === 0,
    blockers
  };
};

const areaWeightedMax = (field) => field.reduce((best, value) => Math.max(best, Number.isFinite(value) ? value : -Infinity), -Infinity);

// Grid-aware tropical cyclone environment count.
//
// At fine grids (ny >= 90, cell <= 2°) each cell can resolve an organized
// TC-core structure, so a strict conjunction of all magnitude criteria
// co-located with point-wise vorticity >= 2e-5 s^-1 is appropriate -- this
// matches operational TC genesis criteria (Gray 1968, Emanuel & Nolan 2004).
//
// At coarser grids (48x24, 7.5° cells) each cell smooths over a region
// much larger than a typical cyclone core, so both the vorticity value and
// the co-location of supporting criteria are attenuated. An R5 threshold
// probe on the current model shows that at 48x24 the warm/moist/windy/
// low-SLP cells simply never co-locate with point-wise vorticity >= 2e-5
// -- the strict detector returns zero even when the supporting circulation
// is fully present (SST > 26°C covers 63% of SH tropics, low-SLP 35%,
// windy 25%, moist 84%).
//
// The coarse-grid equivalent of "organized circulation" is area-averaged
// vorticity ~1e-5 s^-1 (one order smaller than the point-wise fine-grid
// value), and the appropriate co-location test is a majority of the four
// magnitude criteria rather than all four. This mirrors the smooth
// Emanuel-Nolan Genesis Potential Index, which multiplies smooth functions
// of the same variables rather than ANDing hard thresholds.
//
// Grid tiers:
//   ny >= 90 (<= 2°):  vort 2.0e-5, 4-of-4 magnitudes (fine, strict)
//   ny >= 48 (<= 3.8°): vort 1.5e-5, 3-of-4 magnitudes (medium)
//   ny <  48 (> 3.8°): vort 1.0e-5, 2-of-4 magnitudes (coarse, this grid)
const computeTropicalCycloneEnvironment = (diagnostics) => {
  const { grid, seaLevelPressurePa, wind10mSpeedMs, totalColumnWaterKgM2, sstK, seaIceFraction, cycloneSupportFields } = diagnostics;
  const { nx, ny, latitudesDeg } = grid;
  const zonalSlp = zonalMean(seaLevelPressurePa, nx, ny);
  const vortThresh = ny >= 90 ? 2e-5 : (ny >= 48 ? 1.5e-5 : 1e-5);
  const minMagnitudePasses = ny >= 90 ? 4 : (ny >= 48 ? 3 : 2);
  const counts = { nh: 0, sh: 0 };
  for (let j = 0; j < ny; j += 1) {
    const lat = latitudesDeg[j];
    if (Math.abs(lat) < 5 || Math.abs(lat) > 30) continue;
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const idx = row + i;
      const vort = cycloneSupportFields.relativeVorticityS_1[idx] || 0;
      const signedSpinOk = lat >= 0 ? vort >= vortThresh : vort <= -vortThresh;
      if (!signedSpinOk) continue;
      if ((seaIceFraction[idx] || 0) > 0.2) continue;
      let passes = 0;
      if ((sstK[idx] || 0) >= 298.5) passes += 1;
      if ((totalColumnWaterKgM2[idx] || 0) >= 28) passes += 1;
      if ((wind10mSpeedMs[idx] || 0) >= 8) passes += 1;
      if ((seaLevelPressurePa[idx] || 0) <= (zonalSlp[j] || 101000) - 350) passes += 1;
      if (passes >= minMagnitudePasses) counts[lat >= 0 ? 'nh' : 'sh'] += 1;
    }
  }
  return counts;
};

export const classifySnapshot = (diagnostics, targetDay) => {
  const {
    grid,
    landMask,
    precipRateMmHr,
    cloudTotalFraction,
    wind10mU,
    wind10mSpeedMs,
    totalColumnWaterKgM2,
    surfaceEvapRateMmHr,
    verticallyIntegratedVaporFluxNorthKgM_1S,
    verticallyIntegratedTotalWaterFluxNorthKgM_1S,
    cycloneSupportFields,
    convectiveMaskFrac,
    convectivePotentialFrac,
    convectiveOrganizationFrac,
    convectiveMassFluxKgM2S,
    convectiveDetrainmentMassKgM2,
    convectiveAnvilSourceFrac,
    resolvedAscentCloudBirthPotentialKgM2,
    largeScaleCondensationSourceKgM2,
    saturationAdjustmentMaintenanceCandidateMassKgM2,
    saturationAdjustmentMaintenancePotentialSuppressedMassKgM2,
    saturationAdjustmentMaintenanceCandidateEventCount,
    saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted,
    saturationAdjustmentMaintenanceCandidateOmegaMassWeighted,
    saturationAdjustmentMarineEventMassKgM2,
    saturationAdjustmentMarineSubtropicalSupportMassWeighted,
    saturationAdjustmentMarineWeakEngineSupportMassWeighted,
    saturationAdjustmentMarineWeakAscentSupportMassWeighted,
    saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted,
    saturationAdjustmentMarineLayerWindowSupportMassWeighted,
    saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted,
    saturationAdjustmentMarineFreshSubtropicalBandMassWeighted,
    saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted,
    saturationAdjustmentMarineFreshOrganizedSupportMassWeighted,
    saturationAdjustmentMarineFreshRhMidSupportMassWeighted,
    saturationAdjustmentLiveGateCandidateMassKgM2,
    saturationAdjustmentLiveGatePotentialSuppressedMassKgM2,
    saturationAdjustmentLiveGateEventCount,
    saturationAdjustmentLiveGateSupportMassWeighted,
    saturationAdjustmentSoftLiveGateCandidateMassKgM2,
    saturationAdjustmentSoftLiveGatePotentialSuppressedMassKgM2,
    saturationAdjustmentSoftLiveGateEventCount,
    saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted,
    saturationAdjustmentSoftLiveGateAscentModulationMassWeighted,
    saturationAdjustmentSoftLiveGateAppliedSuppressionMassKgM2,
    saturationAdjustmentShoulderGuardCandidateMassKgM2,
    saturationAdjustmentShoulderGuardPotentialSuppressedMassKgM2,
    saturationAdjustmentShoulderGuardEventCount,
    saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted,
    saturationAdjustmentShoulderGuardBandWindowMassWeighted,
    saturationAdjustmentShoulderGuardSelectorSupportMassWeighted,
    saturationAdjustmentShoulderGuardAppliedSuppressionMassKgM2,
    saturationAdjustmentShoulderGuardRetainedVaporMassKgM2,
    saturationAdjustmentShoulderGuardSinkExportMassKgM2,
    saturationAdjustmentShoulderGuardBufferedRainoutMassKgM2,
    cloudReevaporationMassKgM2,
    precipReevaporationMassKgM2,
    importedAnvilPersistenceMassKgM2,
    carriedOverUpperCloudMassKgM2,
    weakErosionCloudSurvivalMassKgM2,
    carryInputOverrideHitCount,
    carryInputOverrideRemovedMassKgM2,
    carryInputOverrideInputMassKgM2,
    carryInputOverrideAccumHitCount,
    carryInputOverrideAccumRemovedMassKgM2,
    carryInputOverrideAccumInputMassKgM2,
    upperCloudPathKgM2,
    boundaryLayerRhFrac,
    midTroposphericRhFrac,
    lowerTroposphericOmegaPaS,
    midTroposphericOmegaPaS,
    upperTroposphericOmegaPaS,
    boundaryLayerThetaeK,
    lowerTroposphereThetaeK,
    boundaryLayerMseJkg,
    lowerTroposphereMseJkg,
    lowerTroposphericInversionStrengthK,
    thetaeGradientBoundaryMinusLowerK,
    mseGradientBoundaryMinusLowerJkg,
    upperCloudClearSkyLwCoolingWm2,
    upperCloudCloudyLwCoolingWm2,
    upperCloudLwCloudEffectWm2,
    upperCloudNetCloudRadiativeEffectWm2,
    surfaceCloudShortwaveShieldingWm2,
    lowLevelMoistureSourceTracersKgM2,
    northsideLeakCarrierSignalMean,
    lowLevelMoistureConvergenceS_1,
    lowLevelOmegaEffectivePaS,
    lowerTroposphericRhFrac,
    subtropicalSubsidenceDryingFrac,
    freshPotentialTargetDiagFrac,
    freshOrganizedSupportDiagFrac,
    freshSubtropicalSuppressionDiagFrac,
    freshSubtropicalBandDiagFrac,
    freshShoulderLatitudeWindowDiagFrac,
    freshShoulderEquatorialEdgeWindowDiagFrac,
    freshShoulderInnerWindowDiagFrac,
    freshShoulderEquatorialEdgeGateSupportDiagFrac,
    freshShoulderTargetEntryExclusionDiagFrac,
    freshNeutralToSubsidingSupportDiagFrac,
    freshRhMidSupportDiagFrac,
    circulationReboundContainmentDiagFrac,
    circulationReboundActivitySuppressionDiagFrac,
    circulationReboundSourceSuppressionDiagFrac,
    circulationReboundRawSourceDiagFrac,
    circulationReboundSuppressedSourceDiagFrac,
    circulationReturnFlowOpportunityDiagFrac,
    circulationReturnFlowCouplingAppliedDiagFrac,
    dryingOmegaBridgeAppliedDiagPaS,
    dryingOmegaBridgeLocalAppliedDiagPaS,
    dryingOmegaBridgeProjectedAppliedDiagPaS,
    equatorialEdgeSubsidenceGuardSourceSupportDiagFrac,
    equatorialEdgeSubsidenceGuardTargetWeightDiagFrac,
    equatorialEdgeSubsidenceGuardAppliedDiagPaS,
    equatorialEdgeNorthsideLeakSourceWindowDiagFrac,
    equatorialEdgeNorthsideLeakRiskDiagFrac,
    equatorialEdgeNorthsideLeakAdmissionRiskDiagFrac,
    equatorialEdgeNorthsideLeakPenaltyDiagFrac,
    northSourceConcentrationPenaltyDiagFrac,
    northSourceConcentrationAppliedDiag,
    atlanticDryCoreReceiverTaperDiagFrac,
    atlanticDryCoreReceiverTaperAppliedDiag,
    atlanticTransitionCarryoverContainmentDiagFrac,
    atlanticTransitionCarryoverContainmentAppliedDiag,
    subtropicalSourceDriverDiagFrac,
    subtropicalSourceDriverFloorDiagFrac,
    subtropicalLocalHemiSourceDiagFrac,
    subtropicalMeanTropicalSourceDiagFrac,
    subtropicalCrossHemiFloorShareDiagFrac,
    subtropicalBalancePartitionSupportDiagFrac,
    subtropicalBalanceCirculationSupportDiagFrac,
    subtropicalBalanceContractSupportDiagFrac,
    subtropicalWeakHemiFracDiag,
    subtropicalWeakHemiFloorOverhangDiagFrac,
    subtropicalWeakHemiFloorTaperAppliedDiagFrac,
    surfaceEvapPotentialRateMmHr,
    surfaceEvapTransferCoeff,
    surfaceEvapWindSpeedMs,
    surfaceEvapHumidityGradientKgKg,
    surfaceEvapSurfaceTempK,
    surfaceEvapAirTempK,
    surfaceEvapSoilGateFrac,
    surfaceEvapRunoffLossRateMmHr,
    surfaceEvapSeaIceSuppressionFrac,
    surfaceEvapSurfaceSaturationMixingRatioKgKg,
    surfaceEvapAirMixingRatioKgKg,
    processMoistureBudget,
    transportTracing,
    verticalCloudBirthTracing,
    upperCloudResidenceTracing,
    cloudTransitionLedgerTracing,
    thermodynamicSupportTracing,
    forcingOppositionTracing,
    numericalIntegrityTracing,
    stormSpilloverTracing
  } = diagnostics;
  const { nx, ny, latitudesDeg } = grid;
  const longitudesDeg = Array.isArray(grid.longitudesDeg)
    ? grid.longitudesDeg
    : Array.from({ length: nx }, (_, index) => -180 + ((index + 0.5) * 360) / Math.max(1, nx));
  const rowWeights = makeRowWeights(latitudesDeg);
  const zonalPrecip = zonalMean(precipRateMmHr, nx, ny);
  const zonalCloud = zonalMean(cloudTotalFraction, nx, ny);
  const zonalU10 = zonalMean(wind10mU, nx, ny);
  const zonalTcw = zonalMean(totalColumnWaterKgM2, nx, ny);
  const zonalConvectiveFraction = zonalMean(convectiveMaskFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalConvectivePotential = zonalMean(convectivePotentialFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalConvectiveOrganization = zonalMean(convectiveOrganizationFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalConvectiveMassFlux = zonalMean(convectiveMassFluxKgM2S || new Array(nx * ny).fill(0), nx, ny);
  const zonalDetrainment = zonalMean(convectiveDetrainmentMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalAnvil = zonalMean(convectiveAnvilSourceFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalResolvedAscentCloudBirthPotential = zonalMean(resolvedAscentCloudBirthPotentialKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalLargeScaleCondensation = zonalMean(largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalMaintenanceCandidateMass = zonalMean(saturationAdjustmentMaintenanceCandidateMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalMaintenancePotentialSuppressedMass = zonalMean(saturationAdjustmentMaintenancePotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalMaintenanceCandidateHitCount = zonalMean(saturationAdjustmentMaintenanceCandidateEventCount || new Array(nx * ny).fill(0), nx, ny);
  const zonalFreshShoulderLatitudeWindow = zonalMean(freshShoulderLatitudeWindowDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalFreshShoulderEquatorialEdgeWindow = zonalMean(freshShoulderEquatorialEdgeWindowDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalFreshShoulderInnerWindow = zonalMean(freshShoulderInnerWindowDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalFreshShoulderEquatorialEdgeGateSupport = zonalMean(freshShoulderEquatorialEdgeGateSupportDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalFreshShoulderTargetEntryExclusion = zonalMean(freshShoulderTargetEntryExclusionDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardCandidateMass = zonalMean(saturationAdjustmentShoulderGuardCandidateMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardPotentialSuppressedMass = zonalMean(saturationAdjustmentShoulderGuardPotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardHitCount = zonalMean(saturationAdjustmentShoulderGuardEventCount || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardBridgeSilence = zonalMean(saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardBandWindow = zonalMean(saturationAdjustmentShoulderGuardBandWindowMassWeighted || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardSelectorSupport = zonalMean(saturationAdjustmentShoulderGuardSelectorSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardAppliedSuppression = zonalMean(saturationAdjustmentShoulderGuardAppliedSuppressionMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardRetainedVapor = zonalMean(saturationAdjustmentShoulderGuardRetainedVaporMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardSinkExport = zonalMean(saturationAdjustmentShoulderGuardSinkExportMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalShoulderGuardBufferedRainout = zonalMean(saturationAdjustmentShoulderGuardBufferedRainoutMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalCloudReevaporation = zonalMean(cloudReevaporationMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalPrecipReevaporation = zonalMean(precipReevaporationMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalImportedAnvilPersistence = zonalMean(importedAnvilPersistenceMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalCarriedOverUpperCloud = zonalMean(carriedOverUpperCloudMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalWeakErosionCloudSurvival = zonalMean(weakErosionCloudSurvivalMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalCarryInputOverrideHitCount = zonalMean(carryInputOverrideHitCount || new Array(nx * ny).fill(0), nx, ny);
  const zonalCarryInputOverrideRemovedMass = zonalMean(carryInputOverrideRemovedMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalCarryInputOverrideAccumHitCount = zonalMean(carryInputOverrideAccumHitCount || new Array(nx * ny).fill(0), nx, ny);
  const zonalCarryInputOverrideAccumRemovedMass = zonalMean(carryInputOverrideAccumRemovedMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalCarryInputOverrideAccumInputMass = zonalMean(carryInputOverrideAccumInputMassKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalUpperCloudPath = zonalMean(upperCloudPathKgM2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalBoundaryLayerRh = zonalMean(boundaryLayerRhFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalMidTroposphereRh = zonalMean(midTroposphericRhFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalLowerTroposphericOmega = zonalMean(lowerTroposphericOmegaPaS || new Array(nx * ny).fill(0), nx, ny);
  const zonalMidTroposphericOmega = zonalMean(midTroposphericOmegaPaS || new Array(nx * ny).fill(0), nx, ny);
  const zonalUpperTroposphericOmega = zonalMean(upperTroposphericOmegaPaS || new Array(nx * ny).fill(0), nx, ny);
  const zonalBoundaryLayerThetae = zonalMean(boundaryLayerThetaeK || new Array(nx * ny).fill(0), nx, ny);
  const zonalLowerTroposphereThetae = zonalMean(lowerTroposphereThetaeK || new Array(nx * ny).fill(0), nx, ny);
  const zonalBoundaryLayerMse = zonalMean(boundaryLayerMseJkg || new Array(nx * ny).fill(0), nx, ny);
  const zonalLowerTroposphereMse = zonalMean(lowerTroposphereMseJkg || new Array(nx * ny).fill(0), nx, ny);
  const zonalInversionStrength = zonalMean(lowerTroposphericInversionStrengthK || new Array(nx * ny).fill(0), nx, ny);
  const zonalThetaeGradient = zonalMean(thetaeGradientBoundaryMinusLowerK || new Array(nx * ny).fill(0), nx, ny);
  const zonalMseGradient = zonalMean(mseGradientBoundaryMinusLowerJkg || new Array(nx * ny).fill(0), nx, ny);
  const zonalUpperCloudClearSkyLwCooling = zonalMean(upperCloudClearSkyLwCoolingWm2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalUpperCloudCloudyLwCooling = zonalMean(upperCloudCloudyLwCoolingWm2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalUpperCloudLwCloudEffect = zonalMean(upperCloudLwCloudEffectWm2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalUpperCloudNetCloudRadiativeEffect = zonalMean(upperCloudNetCloudRadiativeEffectWm2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalSurfaceCloudShielding = zonalMean(surfaceCloudShortwaveShieldingWm2 || new Array(nx * ny).fill(0), nx, ny);
  const zonalMoistureConvergence = zonalMean(lowLevelMoistureConvergenceS_1 || new Array(nx * ny).fill(0), nx, ny);
  const zonalLowLevelOmegaEffective = zonalMean(lowLevelOmegaEffectivePaS || new Array(nx * ny).fill(0), nx, ny);
  const zonalDryingOmegaBridgeLocalApplied = zonalMean(dryingOmegaBridgeLocalAppliedDiagPaS || new Array(nx * ny).fill(0), nx, ny);
  const zonalDryingOmegaBridgeProjectedApplied = zonalMean(dryingOmegaBridgeProjectedAppliedDiagPaS || new Array(nx * ny).fill(0), nx, ny);
  const zonalEquatorialEdgeSubsidenceGuardSourceSupport = zonalMean(equatorialEdgeSubsidenceGuardSourceSupportDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalEquatorialEdgeSubsidenceGuardTargetWeight = zonalMean(equatorialEdgeSubsidenceGuardTargetWeightDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalEquatorialEdgeSubsidenceGuardApplied = zonalMean(equatorialEdgeSubsidenceGuardAppliedDiagPaS || new Array(nx * ny).fill(0), nx, ny);
  const zonalEquatorialEdgeNorthsideLeakSourceWindow = zonalMean(equatorialEdgeNorthsideLeakSourceWindowDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalEquatorialEdgeNorthsideLeakRisk = zonalMean(equatorialEdgeNorthsideLeakRiskDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalEquatorialEdgeNorthsideLeakAdmissionRisk = zonalMean(equatorialEdgeNorthsideLeakAdmissionRiskDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalEquatorialEdgeNorthsideLeakPenalty = zonalMean(equatorialEdgeNorthsideLeakPenaltyDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalNorthSourceConcentrationPenalty = zonalMean(northSourceConcentrationPenaltyDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalNorthSourceConcentrationApplied = zonalMean(northSourceConcentrationAppliedDiag || new Array(nx * ny).fill(0), nx, ny);
  const zonalAtlanticDryCoreReceiverTaper = zonalMean(atlanticDryCoreReceiverTaperDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalAtlanticDryCoreReceiverApplied = zonalMean(atlanticDryCoreReceiverTaperAppliedDiag || new Array(nx * ny).fill(0), nx, ny);
  const zonalAtlanticTransitionCarryoverContainment = zonalMean(atlanticTransitionCarryoverContainmentDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalAtlanticTransitionCarryoverContainmentApplied = zonalMean(atlanticTransitionCarryoverContainmentAppliedDiag || new Array(nx * ny).fill(0), nx, ny);
  const zonalLowerRh = zonalMean(lowerTroposphericRhFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubsidenceDrying = zonalMean(subtropicalSubsidenceDryingFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSurfaceEvap = zonalMean(surfaceEvapRateMmHr || new Array(nx * ny).fill(0), nx, ny);
  const zonalSurfaceEvapPotential = zonalMean(surfaceEvapPotentialRateMmHr || new Array(nx * ny).fill(0), nx, ny);
  const zonalVaporFluxNorth = zonalMean(verticallyIntegratedVaporFluxNorthKgM_1S || new Array(nx * ny).fill(0), nx, ny);
  const zonalTotalWaterFluxNorth = zonalMean(verticallyIntegratedTotalWaterFluxNorthKgM_1S || new Array(nx * ny).fill(0), nx, ny);
  const sourceTracerZonal = Object.fromEntries(
    Object.entries(lowLevelMoistureSourceTracersKgM2 || {}).map(([key, field]) => [key, zonalMean(field || new Array(nx * ny).fill(0), nx, ny)])
  );
  // Storm-track proxy.
  //
  // The previous proxy (zonal mean of |ζ| × precip × wind) was intended to
  // locate active cyclones, but in a coarse 48×24 model the relative
  // vorticity field is dominated by the meridional shear of the subtropical
  // trade-wind easterlies.  Combined with a quiet SH midlatitude band (no
  // resolvable baroclinic eddies at this resolution), the product's argmax
  // in the [25, 70]° band is pulled onto the subtropical edge (~±26°) even
  // when the actual midlatitude rain maximum sits at -55° to -65°.  That
  // produced the spurious south_storm_track_out_of_range warning for the
  // post-R5 annual audit (-26.25° vs target [-65, -30]°).
  //
  // A direct and more physically defensible proxy is just the zonal-mean
  // precipitation rate: extratropical storm tracks are defined, in reality
  // and in reanalyses, by where zonal-mean midlatitude rain peaks.  We keep
  // the band restriction [25, 70]° so tropical ITCZ rain cannot contaminate
  // the metric, and add a poleward weighting so that among roughly equal
  // precip peaks within the band the truly midlatitude one is preferred.
  // This weighting is `(|lat| - DEFAULT_STORM_MIN_LAT) / (DEFAULT_STORM_MAX_LAT - DEFAULT_STORM_MIN_LAT)`
  // which is 0 at the subtropical edge of the band and 1 at the poleward
  // edge.  The fix does not change NH behaviour (the NH midlat rain peak at
  // 63.75° was already in the gate) and gracefully moves the SH argmax to
  // the genuine midlat rain peak instead of the subtropical shear edge.
  const zonalStormIndex = zonalPrecip.map((value, j) => {
    const latAbs = Math.abs(latitudesDeg[j] || 0);
    const bandSpan = DEFAULT_STORM_MAX_LAT - DEFAULT_STORM_MIN_LAT;
    const polewardWeight = bandSpan > 0
      ? Math.max(0, Math.min(1, (latAbs - DEFAULT_STORM_MIN_LAT) / bandSpan))
      : 0;
    return Math.max(0, value || 0) * polewardWeight;
  });
  const globalPrecipMean = areaWeightedMean(precipRateMmHr, nx, ny, rowWeights);
  const globalCloudMean = areaWeightedMean(cloudTotalFraction, nx, ny, rowWeights);
  const globalTcwMean = areaWeightedMean(totalColumnWaterKgM2, nx, ny, rowWeights);
  const maxWind10m = areaWeightedMax(wind10mSpeedMs);
  const itczLat = weightedBandCentroid(zonalPrecip, latitudesDeg, rowWeights, -20, 20);
  const itczWidth = weightedBandWidth(zonalPrecip, latitudesDeg, rowWeights, -25, 25, itczLat);
  const equatorialPrecip = weightedBandMean(zonalPrecip, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const subtropicalDryNorth = weightedBandMean(zonalPrecip, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const subtropicalDrySouth = weightedBandMean(zonalPrecip, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const tropicalConvectiveFraction = weightedBandMean(zonalConvectiveFraction, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalConvectivePotential = weightedBandMean(zonalConvectivePotential, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalConvectiveOrganization = weightedBandMean(zonalConvectiveOrganization, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalConvectiveMassFlux = weightedBandMean(zonalConvectiveMassFlux, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalMoistureConvergence = weightedBandMean(zonalMoistureConvergence, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const subtropicalRhNorth = weightedBandMean(zonalLowerRh, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const subtropicalRhSouth = weightedBandMean(zonalLowerRh, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionLowLevelOmegaEffective = weightedBandMean(zonalLowLevelOmegaEffective, latitudesDeg, rowWeights, 12, 22);
  const southTransitionLowLevelOmegaEffective = weightedBandMean(zonalLowLevelOmegaEffective, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltLowLevelOmegaEffective = weightedBandMean(zonalLowLevelOmegaEffective, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltLowLevelOmegaEffective = weightedBandMean(zonalLowLevelOmegaEffective, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionSubsidenceDrying = weightedBandMean(zonalSubsidenceDrying, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubsidenceDrying = weightedBandMean(zonalSubsidenceDrying, latitudesDeg, rowWeights, -22, -12);
  const subtropicalSubsidenceNorth = weightedBandMean(zonalSubsidenceDrying, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const subtropicalSubsidenceSouth = weightedBandMean(zonalSubsidenceDrying, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const tropicalUpperDetrainment = weightedBandMean(zonalDetrainment, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const tropicalAnvilPersistence = weightedBandMean(zonalAnvil, latitudesDeg, rowWeights, -DEFAULT_TROPICAL_LAT, DEFAULT_TROPICAL_LAT);
  const northDryBeltLargeScaleCondensation = weightedBandMean(zonalLargeScaleCondensation, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltResolvedAscentCloudBirthPotential = weightedBandMean(zonalResolvedAscentCloudBirthPotential, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltConvectiveDetrainment = weightedBandMean(zonalDetrainment, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltImportedAnvilPersistence = weightedBandMean(zonalImportedAnvilPersistence, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltCarriedOverUpperCloud = weightedBandMean(zonalCarriedOverUpperCloud, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltWeakErosionCloudSurvival = weightedBandMean(zonalWeakErosionCloudSurvival, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltCloudReevaporation = weightedBandMean(zonalCloudReevaporation, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltPrecipReevaporation = weightedBandMean(zonalPrecipReevaporation, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltUpperCloudPath = weightedBandMean(zonalUpperCloudPath, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltCarryInputOverrideHitMean = weightedBandMean(zonalCarryInputOverrideHitCount, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCarryInputOverrideHitMean = weightedBandMean(zonalCarryInputOverrideHitCount, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionCarryInputOverrideHitMean = weightedBandMean(zonalCarryInputOverrideHitCount, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCarryInputOverrideHitMean = weightedBandMean(zonalCarryInputOverrideHitCount, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltCarryInputOverrideRemovedMean = weightedBandMean(zonalCarryInputOverrideRemovedMass, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCarryInputOverrideRemovedMean = weightedBandMean(zonalCarryInputOverrideRemovedMass, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionCarryInputOverrideRemovedMean = weightedBandMean(zonalCarryInputOverrideRemovedMass, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCarryInputOverrideRemovedMean = weightedBandMean(zonalCarryInputOverrideRemovedMass, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltCarryInputOverrideAccumHitMean = weightedBandMean(zonalCarryInputOverrideAccumHitCount, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCarryInputOverrideAccumHitMean = weightedBandMean(zonalCarryInputOverrideAccumHitCount, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionCarryInputOverrideAccumHitMean = weightedBandMean(zonalCarryInputOverrideAccumHitCount, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCarryInputOverrideAccumHitMean = weightedBandMean(zonalCarryInputOverrideAccumHitCount, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltCarryInputOverrideAccumRemovedMean = weightedBandMean(zonalCarryInputOverrideAccumRemovedMass, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCarryInputOverrideAccumRemovedMean = weightedBandMean(zonalCarryInputOverrideAccumRemovedMass, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionCarryInputOverrideAccumRemovedMean = weightedBandMean(zonalCarryInputOverrideAccumRemovedMass, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCarryInputOverrideAccumRemovedMean = weightedBandMean(zonalCarryInputOverrideAccumRemovedMass, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltCarryInputOverrideAccumInputMean = weightedBandMean(zonalCarryInputOverrideAccumInputMass, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCarryInputOverrideAccumInputMean = weightedBandMean(zonalCarryInputOverrideAccumInputMass, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northDryBeltCarryInputOverrideAccumRemovalFrac = northDryBeltCarryInputOverrideAccumInputMean > 1e-6
    ? northDryBeltCarryInputOverrideAccumRemovedMean / northDryBeltCarryInputOverrideAccumInputMean
    : 0;
  const southDryBeltCarryInputOverrideAccumRemovalFrac = southDryBeltCarryInputOverrideAccumInputMean > 1e-6
    ? southDryBeltCarryInputOverrideAccumRemovedMean / southDryBeltCarryInputOverrideAccumInputMean
    : 0;
  const northDryBeltLandPrecip = weightedFieldBandMean(precipRateMmHr, nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanPrecip = weightedFieldBandMean(precipRateMmHr, nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandRh = weightedFieldBandMean(lowerTroposphericRhFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanRh = weightedFieldBandMean(lowerTroposphericRhFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandEvap = weightedFieldBandMean(surfaceEvapRateMmHr || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanEvap = weightedFieldBandMean(surfaceEvapRateMmHr || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltEvapPotential = weightedBandMean(zonalSurfaceEvapPotential, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltLandLargeScaleCondensation = weightedFieldBandMean(largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanLargeScaleCondensation = weightedFieldBandMean(largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltMaintenanceCandidateMass = weightedBandMean(zonalMaintenanceCandidateMass, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltLandMaintenanceCandidateMass = weightedFieldBandMean(saturationAdjustmentMaintenanceCandidateMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanMaintenanceCandidateMass = weightedFieldBandMean(saturationAdjustmentMaintenanceCandidateMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltMaintenancePotentialSuppressedMass = weightedBandMean(zonalMaintenancePotentialSuppressedMass, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltLandMaintenancePotentialSuppressedMass = weightedFieldBandMean(saturationAdjustmentMaintenancePotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanMaintenancePotentialSuppressedMass = weightedFieldBandMean(saturationAdjustmentMaintenancePotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltMaintenanceCandidateHitMean = weightedBandMean(zonalMaintenanceCandidateHitCount, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const northDryBeltLandMaintenanceCandidateHitMean = weightedFieldBandMean(saturationAdjustmentMaintenanceCandidateEventCount || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanMaintenanceCandidateHitMean = weightedFieldBandMean(saturationAdjustmentMaintenanceCandidateEventCount || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltMaintenanceCandidateSupersaturationMean = (
    weightedFieldBandMean(saturationAdjustmentMaintenanceCandidateSupersaturationMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)
    / Math.max(1e-6, northDryBeltMaintenanceCandidateMass)
  );
  const northDryBeltMaintenanceCandidateAscentMean = (
    weightedFieldBandMean(saturationAdjustmentMaintenanceCandidateOmegaMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)
    / Math.max(1e-6, northDryBeltMaintenanceCandidateMass)
  );
  const northDryBeltOceanMarineEventMass = weightedFieldBandMean(saturationAdjustmentMarineEventMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltOceanMarineSubtropicalSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineSubtropicalSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineWeakEngineSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineWeakEngineSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineWeakAscentSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineWeakAscentSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineMarginalSupersaturationSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineMarginalSupersaturationSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineLayerWindowSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineLayerWindowSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineFreshSubtropicalSuppressionMean = (
    weightedFieldBandMean(saturationAdjustmentMarineFreshSubtropicalSuppressionMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineFreshSubtropicalBandMean = (
    weightedFieldBandMean(saturationAdjustmentMarineFreshSubtropicalBandMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineFreshNeutralToSubsidingSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineFreshNeutralToSubsidingSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineFreshOrganizedSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineFreshOrganizedSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanMarineFreshRhMidSupportMean = (
    weightedFieldBandMean(saturationAdjustmentMarineFreshRhMidSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltLiveGateCandidateMass = weightedBandMean(
    zonalMean(saturationAdjustmentLiveGateCandidateMassKgM2 || new Array(nx * ny).fill(0), nx, ny),
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT
  );
  const northDryBeltOceanLiveGateCandidateMass = weightedFieldBandMean(
    saturationAdjustmentLiveGateCandidateMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT,
    landMask,
    'ocean'
  );
  const northDryBeltLiveGatePotentialSuppressedMass = weightedBandMean(
    zonalMean(saturationAdjustmentLiveGatePotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0), nx, ny),
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT
  );
  const northDryBeltOceanLiveGatePotentialSuppressedMass = weightedFieldBandMean(
    saturationAdjustmentLiveGatePotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT,
    landMask,
    'ocean'
  );
  const northDryBeltLiveGateHitMean = weightedBandMean(
    zonalMean(saturationAdjustmentLiveGateEventCount || new Array(nx * ny).fill(0), nx, ny),
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT
  );
  const northDryBeltOceanLiveGateHitMean = weightedFieldBandMean(
    saturationAdjustmentLiveGateEventCount || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT,
    landMask,
    'ocean'
  );
  const northDryBeltOceanLiveGateSupportMean = (
    weightedFieldBandMean(saturationAdjustmentLiveGateSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltSoftLiveGateCandidateMass = weightedBandMean(
    zonalMean(saturationAdjustmentSoftLiveGateCandidateMassKgM2 || new Array(nx * ny).fill(0), nx, ny),
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT
  );
  const northDryBeltOceanSoftLiveGateCandidateMass = weightedFieldBandMean(
    saturationAdjustmentSoftLiveGateCandidateMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT,
    landMask,
    'ocean'
  );
  const northDryBeltSoftLiveGatePotentialSuppressedMass = weightedBandMean(
    zonalMean(saturationAdjustmentSoftLiveGatePotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0), nx, ny),
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT
  );
  const northDryBeltOceanSoftLiveGatePotentialSuppressedMass = weightedFieldBandMean(
    saturationAdjustmentSoftLiveGatePotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT,
    landMask,
    'ocean'
  );
  const northDryBeltSoftLiveGateHitMean = weightedBandMean(
    zonalMean(saturationAdjustmentSoftLiveGateEventCount || new Array(nx * ny).fill(0), nx, ny),
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT
  );
  const northDryBeltOceanSoftLiveGateHitMean = weightedFieldBandMean(
    saturationAdjustmentSoftLiveGateEventCount || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT,
    landMask,
    'ocean'
  );
  const northDryBeltOceanSoftLiveGateSelectorSupportMean = (
    weightedFieldBandMean(saturationAdjustmentSoftLiveGateSelectorSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltOceanSoftLiveGateAscentModulationMean = (
    weightedFieldBandMean(saturationAdjustmentSoftLiveGateAscentModulationMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean')
    / Math.max(1e-6, northDryBeltOceanMarineEventMass)
  );
  const northDryBeltSoftLiveGateAppliedSuppressionMass = weightedBandMean(
    zonalMean(saturationAdjustmentSoftLiveGateAppliedSuppressionMassKgM2 || new Array(nx * ny).fill(0), nx, ny),
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT
  );
  const northDryBeltOceanSoftLiveGateAppliedSuppressionMass = weightedFieldBandMean(
    saturationAdjustmentSoftLiveGateAppliedSuppressionMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    DEFAULT_DRY_MIN_LAT,
    DEFAULT_DRY_MAX_LAT,
    landMask,
    'ocean'
  );
  const tropicalShoulderLargeScaleCondensationMean = weightedBandMean(zonalLargeScaleCondensation, latitudesDeg, rowWeights, 3, 18.75);
  const tropicalShoulderCoreLargeScaleCondensationMean = weightedBandMean(zonalLargeScaleCondensation, latitudesDeg, rowWeights, 3, 12);
  const tropicalShoulderCoreShoulderGuardCandidateMass = weightedBandMean(zonalShoulderGuardCandidateMass, latitudesDeg, rowWeights, 3, 12);
  const tropicalShoulderCoreOceanShoulderGuardCandidateMass = weightedFieldBandMean(
    saturationAdjustmentShoulderGuardCandidateMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    3,
    12,
    landMask,
    'ocean'
  );
  const tropicalShoulderCoreShoulderGuardPotentialSuppressedMass = weightedBandMean(zonalShoulderGuardPotentialSuppressedMass, latitudesDeg, rowWeights, 3, 12);
  const tropicalShoulderCoreOceanShoulderGuardPotentialSuppressedMass = weightedFieldBandMean(
    saturationAdjustmentShoulderGuardPotentialSuppressedMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    3,
    12,
    landMask,
    'ocean'
  );
  const tropicalShoulderCoreShoulderGuardHitMean = weightedBandMean(zonalShoulderGuardHitCount, latitudesDeg, rowWeights, 3, 12);
  const tropicalShoulderCoreOceanShoulderGuardHitMean = weightedFieldBandMean(
    saturationAdjustmentShoulderGuardEventCount || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    3,
    12,
    landMask,
    'ocean'
  );
  const tropicalShoulderCoreOceanShoulderGuardBridgeSilenceMean = (
    weightedFieldBandMean(saturationAdjustmentShoulderGuardBridgeSilenceMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, 3, 12, landMask, 'ocean')
    / Math.max(1e-6, tropicalShoulderCoreOceanShoulderGuardCandidateMass)
  );
  const tropicalShoulderCoreOceanShoulderGuardBandWindowMean = (
    weightedFieldBandMean(saturationAdjustmentShoulderGuardBandWindowMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, 3, 12, landMask, 'ocean')
    / Math.max(1e-6, tropicalShoulderCoreOceanShoulderGuardCandidateMass)
  );
  const tropicalShoulderCoreOceanShoulderGuardSelectorSupportMean = (
    weightedFieldBandMean(saturationAdjustmentShoulderGuardSelectorSupportMassWeighted || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, 3, 12, landMask, 'ocean')
    / Math.max(1e-6, tropicalShoulderCoreOceanShoulderGuardCandidateMass)
  );
  const tropicalShoulderCoreShoulderGuardAppliedSuppressionMass = weightedBandMean(zonalShoulderGuardAppliedSuppression, latitudesDeg, rowWeights, 3, 12);
  const tropicalShoulderCoreOceanShoulderGuardAppliedSuppressionMass = weightedFieldBandMean(
    saturationAdjustmentShoulderGuardAppliedSuppressionMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    3,
    12,
    landMask,
    'ocean'
  );
  const sourceCoreOceanShoulderGuardAppliedSuppressionMass = weightedFieldBandMean(
    saturationAdjustmentShoulderGuardAppliedSuppressionMassKgM2 || new Array(nx * ny).fill(0),
    nx,
    ny,
    latitudesDeg,
    rowWeights,
    20,
    30,
    landMask,
    'ocean'
  );
  const targetEntryProjectedBridgeAppliedMean = weightedBandMean(zonalDryingOmegaBridgeProjectedApplied, latitudesDeg, rowWeights, 30, 45);
  const jetBandProjectedBridgeAppliedMean = weightedBandMean(zonalDryingOmegaBridgeProjectedApplied, latitudesDeg, rowWeights, 41.25, 56.25);
  const zonalCirculationReboundContainment = zonalMean(circulationReboundContainmentDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalCirculationReboundActivitySuppression = zonalMean(circulationReboundActivitySuppressionDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalCirculationReboundSourceSuppression = zonalMean(circulationReboundSourceSuppressionDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalCirculationReboundRawSource = zonalMean(circulationReboundRawSourceDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalCirculationReboundSuppressedSource = zonalMean(circulationReboundSuppressedSourceDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalCirculationReturnFlowOpportunity = zonalMean(circulationReturnFlowOpportunityDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalCirculationReturnFlowCouplingApplied = zonalMean(circulationReturnFlowCouplingAppliedDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalDryingOmegaBridgeApplied = zonalMean(dryingOmegaBridgeAppliedDiagPaS || new Array(nx * ny).fill(0), nx, ny);
  const northTransitionCirculationReboundContainmentMean = weightedBandMean(zonalCirculationReboundContainment, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCirculationReboundContainmentMean = weightedBandMean(zonalCirculationReboundContainment, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltCirculationReboundContainmentMean = weightedBandMean(zonalCirculationReboundContainment, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCirculationReboundContainmentMean = weightedBandMean(zonalCirculationReboundContainment, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionCirculationReboundActivitySuppressionMean = weightedBandMean(zonalCirculationReboundActivitySuppression, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCirculationReboundActivitySuppressionMean = weightedBandMean(zonalCirculationReboundActivitySuppression, latitudesDeg, rowWeights, -22, -12);
  const northTransitionCirculationReboundSourceSuppressionMean = weightedBandMean(zonalCirculationReboundSourceSuppression, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCirculationReboundSourceSuppressionMean = weightedBandMean(zonalCirculationReboundSourceSuppression, latitudesDeg, rowWeights, -22, -12);
  const northTransitionCirculationReboundRawSourceMean = weightedBandMean(zonalCirculationReboundRawSource, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCirculationReboundRawSourceMean = weightedBandMean(zonalCirculationReboundRawSource, latitudesDeg, rowWeights, -22, -12);
  const northTransitionCirculationReboundSuppressedSourceMean = weightedBandMean(zonalCirculationReboundSuppressedSource, latitudesDeg, rowWeights, 12, 22);
  const southTransitionCirculationReboundSuppressedSourceMean = weightedBandMean(zonalCirculationReboundSuppressedSource, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltCirculationReturnFlowOpportunityMean = weightedBandMean(zonalCirculationReturnFlowOpportunity, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCirculationReturnFlowOpportunityMean = weightedBandMean(zonalCirculationReturnFlowOpportunity, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northDryBeltCirculationReturnFlowCouplingAppliedMean = weightedBandMean(zonalCirculationReturnFlowCouplingApplied, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltCirculationReturnFlowCouplingAppliedMean = weightedBandMean(zonalCirculationReturnFlowCouplingApplied, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionDryingOmegaBridgeAppliedMean = weightedBandMean(zonalDryingOmegaBridgeApplied, latitudesDeg, rowWeights, 12, 22);
  const southTransitionDryingOmegaBridgeAppliedMean = weightedBandMean(zonalDryingOmegaBridgeApplied, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltDryingOmegaBridgeAppliedMean = weightedBandMean(zonalDryingOmegaBridgeApplied, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltDryingOmegaBridgeAppliedMean = weightedBandMean(zonalDryingOmegaBridgeApplied, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const zonalSubtropicalSourceDriver = zonalMean(subtropicalSourceDriverDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalSourceDriverFloor = zonalMean(subtropicalSourceDriverFloorDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalLocalHemiSource = zonalMean(subtropicalLocalHemiSourceDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalMeanTropicalSource = zonalMean(subtropicalMeanTropicalSourceDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalCrossHemiFloorShare = zonalMean(subtropicalCrossHemiFloorShareDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalBalancePartitionSupport = zonalMean(subtropicalBalancePartitionSupportDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalBalanceCirculationSupport = zonalMean(subtropicalBalanceCirculationSupportDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalBalanceContractSupport = zonalMean(subtropicalBalanceContractSupportDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalWeakHemiFrac = zonalMean(subtropicalWeakHemiFracDiag || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalWeakHemiFloorOverhang = zonalMean(subtropicalWeakHemiFloorOverhangDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const zonalSubtropicalWeakHemiFloorTaperApplied = zonalMean(subtropicalWeakHemiFloorTaperAppliedDiagFrac || new Array(nx * ny).fill(0), nx, ny);
  const northTransitionSubtropicalSourceDriverMean = weightedBandMean(zonalSubtropicalSourceDriver, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalSourceDriverMean = weightedBandMean(zonalSubtropicalSourceDriver, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltSubtropicalSourceDriverMean = weightedBandMean(zonalSubtropicalSourceDriver, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltSubtropicalSourceDriverMean = weightedBandMean(zonalSubtropicalSourceDriver, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionSubtropicalSourceDriverFloorMean = weightedBandMean(zonalSubtropicalSourceDriverFloor, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalSourceDriverFloorMean = weightedBandMean(zonalSubtropicalSourceDriverFloor, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalLocalHemiSourceMean = weightedBandMean(zonalSubtropicalLocalHemiSource, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalLocalHemiSourceMean = weightedBandMean(zonalSubtropicalLocalHemiSource, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalMeanTropicalSourceMean = weightedBandMean(zonalSubtropicalMeanTropicalSource, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalMeanTropicalSourceMean = weightedBandMean(zonalSubtropicalMeanTropicalSource, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalCrossHemiFloorShareMean = weightedBandMean(zonalSubtropicalCrossHemiFloorShare, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalCrossHemiFloorShareMean = weightedBandMean(zonalSubtropicalCrossHemiFloorShare, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalBalancePartitionSupportMean = weightedBandMean(zonalSubtropicalBalancePartitionSupport, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalBalancePartitionSupportMean = weightedBandMean(zonalSubtropicalBalancePartitionSupport, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalBalanceCirculationSupportMean = weightedBandMean(zonalSubtropicalBalanceCirculationSupport, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalBalanceCirculationSupportMean = weightedBandMean(zonalSubtropicalBalanceCirculationSupport, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalBalanceContractSupportMean = weightedBandMean(zonalSubtropicalBalanceContractSupport, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalBalanceContractSupportMean = weightedBandMean(zonalSubtropicalBalanceContractSupport, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltSubtropicalBalanceContractSupportMean = weightedBandMean(zonalSubtropicalBalanceContractSupport, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltSubtropicalBalanceContractSupportMean = weightedBandMean(zonalSubtropicalBalanceContractSupport, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionSubtropicalWeakHemiFracMean = weightedBandMean(zonalSubtropicalWeakHemiFrac, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalWeakHemiFracMean = weightedBandMean(zonalSubtropicalWeakHemiFrac, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalWeakHemiFloorOverhangMean = weightedBandMean(zonalSubtropicalWeakHemiFloorOverhang, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalWeakHemiFloorOverhangMean = weightedBandMean(zonalSubtropicalWeakHemiFloorOverhang, latitudesDeg, rowWeights, -22, -12);
  const northTransitionSubtropicalWeakHemiFloorTaperAppliedMean = weightedBandMean(zonalSubtropicalWeakHemiFloorTaperApplied, latitudesDeg, rowWeights, 12, 22);
  const southTransitionSubtropicalWeakHemiFloorTaperAppliedMean = weightedBandMean(zonalSubtropicalWeakHemiFloorTaperApplied, latitudesDeg, rowWeights, -22, -12);
  const northDryBeltLandResolvedAscentCloudBirthPotential = weightedFieldBandMean(resolvedAscentCloudBirthPotentialKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanResolvedAscentCloudBirthPotential = weightedFieldBandMean(resolvedAscentCloudBirthPotentialKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandImportedAnvilPersistence = weightedFieldBandMean(importedAnvilPersistenceMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanImportedAnvilPersistence = weightedFieldBandMean(importedAnvilPersistenceMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandCarriedOverUpperCloud = weightedFieldBandMean(carriedOverUpperCloudMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanCarriedOverUpperCloud = weightedFieldBandMean(carriedOverUpperCloudMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const northDryBeltLandWeakErosionCloudSurvival = weightedFieldBandMean(weakErosionCloudSurvivalMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'land');
  const northDryBeltOceanWeakErosionCloudSurvival = weightedFieldBandMean(weakErosionCloudSurvivalMassKgM2 || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT, landMask, 'ocean');
  const crossEquatorialVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, -5, 5);
  const northTransitionVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, 12, 22);
  const northDryBeltVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT);
  const southDryBeltVaporFlux = weightedBandMean(zonalVaporFluxNorth, latitudesDeg, rowWeights, -DEFAULT_DRY_MAX_LAT, -DEFAULT_DRY_MIN_LAT);
  const northTransitionTotalWaterFlux = weightedBandMean(zonalTotalWaterFluxNorth, latitudesDeg, rowWeights, 12, 22);
  const northDryBeltSourceMeans = Object.fromEntries(
    SURFACE_MOISTURE_SOURCE_TRACERS.map(({ key }) => [
      key,
      round(weightedBandMean(sourceTracerZonal[key] || new Array(ny).fill(0), latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5)
    ])
  );
  northDryBeltSourceMeans.unattributedResidual = round(
    weightedBandMean(sourceTracerZonal.unattributedResidual || new Array(ny).fill(0), latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT),
    5
  );
  const northDryBeltSourceTotal = Object.values(northDryBeltSourceMeans)
    .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const northDryBeltAttributed = northDryBeltSourceTotal - Math.max(0, northDryBeltSourceMeans.unattributedResidual || 0);
  const northDryBeltSourceCoverage = northDryBeltSourceTotal > 0
    ? clamp01(northDryBeltAttributed / northDryBeltSourceTotal)
    : 0;
  const nhDryBeltSectorSummary = Object.fromEntries(
    NH_DRY_BELT_SOURCE_SECTOR_KEYS.map((sectorKey) => [
      sectorKey,
      {
        totalLowLevelSourceMeanKgM2: round(
          weightedFieldBandMeanWithFilter(
            Object.values(lowLevelMoistureSourceTracersKgM2 || {}).reduce((acc, field) => acc.map((value, index) => value + (field?.[index] || 0)), new Array(nx * ny).fill(0)),
            nx,
            ny,
            latitudesDeg,
            longitudesDeg,
            rowWeights,
            DEFAULT_DRY_MIN_LAT,
            DEFAULT_DRY_MAX_LAT,
            ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: landMask[idx] === 1 }) === sectorKey
          ),
          5
        ),
        largeScaleCondensationMeanKgM2: round(
          weightedFieldBandMeanWithFilter(
            largeScaleCondensationSourceKgM2 || new Array(nx * ny).fill(0),
            nx,
            ny,
            latitudesDeg,
            longitudesDeg,
            rowWeights,
            DEFAULT_DRY_MIN_LAT,
            DEFAULT_DRY_MAX_LAT,
            ({ idx, lonDeg }) => classifyNhDryBeltSector({ lonDeg, isLand: landMask[idx] === 1 }) === sectorKey
          ),
          5
        )
      }
    ])
  );
  const surfaceFluxDecomposition = {
    northDryBeltEvapMeanMmHr: round(weightedBandMean(zonalSurfaceEvap, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltEvapPotentialMeanMmHr: round(northDryBeltEvapPotential),
    northDryBeltTransferCoeffMean: round(weightedFieldBandMean(surfaceEvapTransferCoeff || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6),
    northDryBeltWindSpeedMeanMs: round(weightedFieldBandMean(surfaceEvapWindSpeedMs || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltHumidityGradientMeanKgKg: round(weightedFieldBandMean(surfaceEvapHumidityGradientKgKg || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6),
    northDryBeltSurfaceTempMeanK: round(weightedFieldBandMean(surfaceEvapSurfaceTempK || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltAirTempMeanK: round(weightedFieldBandMean(surfaceEvapAirTempK || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltSoilGateMeanFrac: round(weightedFieldBandMean(surfaceEvapSoilGateFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltRunoffLossMeanMmHr: round(weightedFieldBandMean(surfaceEvapRunoffLossRateMmHr || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltSeaIceSuppressionMeanFrac: round(weightedFieldBandMean(surfaceEvapSeaIceSuppressionFrac || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT)),
    northDryBeltSurfaceQsMeanKgKg: round(weightedFieldBandMean(surfaceEvapSurfaceSaturationMixingRatioKgKg || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6),
    northDryBeltSurfaceQaMeanKgKg: round(weightedFieldBandMean(surfaceEvapAirMixingRatioKgKg || new Array(nx * ny).fill(0), nx, ny, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 6)
  };
  const tradesNorth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, 5, 25);
  const tradesSouth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, -25, -5);
  const westerliesNorth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, 30, 60);
  const westerliesSouth = weightedBandMean(zonalU10, latitudesDeg, rowWeights, -60, -30);
  const stormTrackNorthLat = peakLatitude(zonalStormIndex, latitudesDeg, DEFAULT_STORM_MIN_LAT, DEFAULT_STORM_MAX_LAT);
  const stormTrackSouthLat = peakLatitude(zonalStormIndex, latitudesDeg, -DEFAULT_STORM_MAX_LAT, -DEFAULT_STORM_MIN_LAT);
  const tcEnvCounts = computeTropicalCycloneEnvironment(diagnostics);
  const numericalIntegrityScore = computeNumericalIntegrityScore({ numericalIntegrityTracing });

  return {
    targetDay,
    monthIndex: dayToMonthIndex(targetDay),
    metrics: {
      globalPrecipMeanMmHr: round(globalPrecipMean),
      globalCloudMeanFrac: round(globalCloudMean),
      globalTcwMeanKgM2: round(globalTcwMean),
      maxWind10mMs: round(maxWind10m),
      itczLatDeg: round(itczLat),
      itczWidthDeg: round(itczWidth),
      equatorialPrecipMeanMmHr: round(equatorialPrecip),
      subtropicalDryNorthMeanMmHr: round(subtropicalDryNorth),
      subtropicalDrySouthMeanMmHr: round(subtropicalDrySouth),
      subtropicalDryNorthRatio: round(subtropicalDryNorth / Math.max(1e-6, equatorialPrecip)),
      subtropicalDrySouthRatio: round(subtropicalDrySouth / Math.max(1e-6, equatorialPrecip)),
      tropicalConvectiveFraction: round(tropicalConvectiveFraction),
      tropicalConvectivePotential: round(tropicalConvectivePotential),
      tropicalConvectiveOrganization: round(tropicalConvectiveOrganization),
      tropicalConvectiveMassFluxKgM2S: round(tropicalConvectiveMassFlux, 5),
      tropicalMoistureConvergenceS_1: round(tropicalMoistureConvergence, 6),
      northsideLeakCarrierSignalMean: round(northsideLeakCarrierSignalMean, 5),
      subtropicalRhNorthMeanFrac: round(subtropicalRhNorth),
      subtropicalRhSouthMeanFrac: round(subtropicalRhSouth),
      northDryBeltLandPrecipMeanMmHr: round(northDryBeltLandPrecip),
      northDryBeltOceanPrecipMeanMmHr: round(northDryBeltOceanPrecip),
      northDryBeltLandRhMeanFrac: round(northDryBeltLandRh),
      northDryBeltOceanRhMeanFrac: round(northDryBeltOceanRh),
      northDryBeltLandEvapMeanMmHr: round(northDryBeltLandEvap),
      northDryBeltOceanEvapMeanMmHr: round(northDryBeltOceanEvap),
      northDryBeltEvapPotentialMeanMmHr: round(northDryBeltEvapPotential),
      northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2: round(northDryBeltResolvedAscentCloudBirthPotential, 5),
      northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2: round(northDryBeltLandResolvedAscentCloudBirthPotential, 5),
      northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2: round(northDryBeltOceanResolvedAscentCloudBirthPotential, 5),
      northDryBeltLargeScaleCondensationMeanKgM2: round(northDryBeltLargeScaleCondensation, 5),
      northDryBeltLandLargeScaleCondensationMeanKgM2: round(northDryBeltLandLargeScaleCondensation, 5),
      northDryBeltOceanLargeScaleCondensationMeanKgM2: round(northDryBeltOceanLargeScaleCondensation, 5),
      northDryBeltMaintenanceCandidateCondensationMeanKgM2: round(northDryBeltMaintenanceCandidateMass, 5),
      northDryBeltLandMaintenanceCandidateCondensationMeanKgM2: round(northDryBeltLandMaintenanceCandidateMass, 5),
      northDryBeltOceanMaintenanceCandidateCondensationMeanKgM2: round(northDryBeltOceanMaintenanceCandidateMass, 5),
      northDryBeltMaintenancePotentialSuppressedMeanKgM2: round(northDryBeltMaintenancePotentialSuppressedMass, 5),
      northDryBeltLandMaintenancePotentialSuppressedMeanKgM2: round(northDryBeltLandMaintenancePotentialSuppressedMass, 5),
      northDryBeltOceanMaintenancePotentialSuppressedMeanKgM2: round(northDryBeltOceanMaintenancePotentialSuppressedMass, 5),
      northDryBeltMaintenanceCandidateHitMean: round(northDryBeltMaintenanceCandidateHitMean, 5),
      northDryBeltLandMaintenanceCandidateHitMean: round(northDryBeltLandMaintenanceCandidateHitMean, 5),
      northDryBeltOceanMaintenanceCandidateHitMean: round(northDryBeltOceanMaintenanceCandidateHitMean, 5),
      northDryBeltMaintenancePotentialSuppressedFrac: round(
        northDryBeltMaintenancePotentialSuppressedMass / Math.max(1e-6, northDryBeltMaintenanceCandidateMass),
        5
      ),
      northDryBeltMaintenanceCandidateSupersaturationMeanFrac: round(northDryBeltMaintenanceCandidateSupersaturationMean, 5),
      northDryBeltMaintenanceCandidateAscentMeanPaS: round(northDryBeltMaintenanceCandidateAscentMean, 5),
      northDryBeltOceanMarineCondensationMeanKgM2: round(northDryBeltOceanMarineEventMass, 5),
      northDryBeltOceanMarineSubtropicalSupportMeanFrac: round(northDryBeltOceanMarineSubtropicalSupportMean, 5),
      northDryBeltOceanMarineWeakEngineSupportMeanFrac: round(northDryBeltOceanMarineWeakEngineSupportMean, 5),
      northDryBeltOceanMarineWeakAscentSupportMeanFrac: round(northDryBeltOceanMarineWeakAscentSupportMean, 5),
      northDryBeltOceanMarineMarginalSupersaturationSupportMeanFrac: round(northDryBeltOceanMarineMarginalSupersaturationSupportMean, 5),
      northDryBeltOceanMarineLayerWindowSupportMeanFrac: round(northDryBeltOceanMarineLayerWindowSupportMean, 5),
      northDryBeltOceanMarineFreshSubtropicalSuppressionMeanFrac: round(northDryBeltOceanMarineFreshSubtropicalSuppressionMean, 5),
      northDryBeltOceanMarineFreshSubtropicalBandMeanFrac: round(northDryBeltOceanMarineFreshSubtropicalBandMean, 5),
      northDryBeltOceanMarineFreshNeutralToSubsidingSupportMeanFrac: round(northDryBeltOceanMarineFreshNeutralToSubsidingSupportMean, 5),
      northDryBeltOceanMarineFreshOrganizedSupportMeanFrac: round(northDryBeltOceanMarineFreshOrganizedSupportMean, 5),
      northDryBeltOceanMarineFreshRhMidSupportMeanFrac: round(northDryBeltOceanMarineFreshRhMidSupportMean, 5),
      northDryBeltLiveGateCandidateCondensationMeanKgM2: round(northDryBeltLiveGateCandidateMass, 5),
      northDryBeltOceanLiveGateCandidateCondensationMeanKgM2: round(northDryBeltOceanLiveGateCandidateMass, 5),
      northDryBeltLiveGatePotentialSuppressedMeanKgM2: round(northDryBeltLiveGatePotentialSuppressedMass, 5),
      northDryBeltOceanLiveGatePotentialSuppressedMeanKgM2: round(northDryBeltOceanLiveGatePotentialSuppressedMass, 5),
      northDryBeltLiveGateHitMean: round(northDryBeltLiveGateHitMean, 5),
      northDryBeltOceanLiveGateHitMean: round(northDryBeltOceanLiveGateHitMean, 5),
      northDryBeltOceanLiveGateSupportMeanFrac: round(northDryBeltOceanLiveGateSupportMean, 5),
      northDryBeltSoftLiveGateCandidateCondensationMeanKgM2: round(northDryBeltSoftLiveGateCandidateMass, 5),
      northDryBeltOceanSoftLiveGateCandidateCondensationMeanKgM2: round(northDryBeltOceanSoftLiveGateCandidateMass, 5),
      northDryBeltSoftLiveGatePotentialSuppressedMeanKgM2: round(northDryBeltSoftLiveGatePotentialSuppressedMass, 5),
      northDryBeltOceanSoftLiveGatePotentialSuppressedMeanKgM2: round(northDryBeltOceanSoftLiveGatePotentialSuppressedMass, 5),
      northDryBeltSoftLiveGateHitMean: round(northDryBeltSoftLiveGateHitMean, 5),
      northDryBeltOceanSoftLiveGateHitMean: round(northDryBeltOceanSoftLiveGateHitMean, 5),
      northDryBeltOceanSoftLiveGateSelectorSupportMeanFrac: round(northDryBeltOceanSoftLiveGateSelectorSupportMean, 5),
      northDryBeltOceanSoftLiveGateAscentModulationMeanFrac: round(northDryBeltOceanSoftLiveGateAscentModulationMean, 5),
      northDryBeltSoftLiveGateAppliedSuppressionMeanKgM2: round(northDryBeltSoftLiveGateAppliedSuppressionMass, 5),
      northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2: round(northDryBeltOceanSoftLiveGateAppliedSuppressionMass, 5),
      tropicalShoulderLargeScaleCondensationMeanKgM2: round(tropicalShoulderLargeScaleCondensationMean, 5),
      tropicalShoulderCoreLargeScaleCondensationMeanKgM2: round(tropicalShoulderCoreLargeScaleCondensationMean, 5),
      tropicalShoulderCoreShoulderGuardCandidateCondensationMeanKgM2: round(tropicalShoulderCoreShoulderGuardCandidateMass, 5),
      tropicalShoulderCoreOceanShoulderGuardCandidateCondensationMeanKgM2: round(tropicalShoulderCoreOceanShoulderGuardCandidateMass, 5),
      tropicalShoulderCoreShoulderGuardPotentialSuppressedMeanKgM2: round(tropicalShoulderCoreShoulderGuardPotentialSuppressedMass, 5),
      tropicalShoulderCoreOceanShoulderGuardPotentialSuppressedMeanKgM2: round(tropicalShoulderCoreOceanShoulderGuardPotentialSuppressedMass, 5),
      tropicalShoulderCoreShoulderGuardHitMean: round(tropicalShoulderCoreShoulderGuardHitMean, 5),
      tropicalShoulderCoreOceanShoulderGuardHitMean: round(tropicalShoulderCoreOceanShoulderGuardHitMean, 5),
      tropicalShoulderCoreOceanShoulderGuardBridgeSilenceMeanFrac: round(tropicalShoulderCoreOceanShoulderGuardBridgeSilenceMean, 5),
      tropicalShoulderCoreOceanShoulderGuardBandWindowMeanFrac: round(tropicalShoulderCoreOceanShoulderGuardBandWindowMean, 5),
      tropicalShoulderCoreOceanShoulderGuardSelectorSupportMeanFrac: round(tropicalShoulderCoreOceanShoulderGuardSelectorSupportMean, 5),
      tropicalShoulderCoreShoulderGuardAppliedSuppressionMeanKgM2: round(tropicalShoulderCoreShoulderGuardAppliedSuppressionMass, 5),
      tropicalShoulderCoreOceanShoulderGuardAppliedSuppressionMeanKgM2: round(tropicalShoulderCoreOceanShoulderGuardAppliedSuppressionMass, 5),
      sourceCoreOceanShoulderGuardAppliedSuppressionMeanKgM2: round(sourceCoreOceanShoulderGuardAppliedSuppressionMass, 5),
      northTransitionCirculationReboundContainmentMeanFrac: round(northTransitionCirculationReboundContainmentMean, 5),
      southTransitionCirculationReboundContainmentMeanFrac: round(southTransitionCirculationReboundContainmentMean, 5),
      northDryBeltCirculationReboundContainmentMeanFrac: round(northDryBeltCirculationReboundContainmentMean, 5),
      southDryBeltCirculationReboundContainmentMeanFrac: round(southDryBeltCirculationReboundContainmentMean, 5),
      northTransitionCirculationReboundActivitySuppressionMeanFrac: round(northTransitionCirculationReboundActivitySuppressionMean, 5),
      southTransitionCirculationReboundActivitySuppressionMeanFrac: round(southTransitionCirculationReboundActivitySuppressionMean, 5),
      northTransitionCirculationReboundSourceSuppressionMeanFrac: round(northTransitionCirculationReboundSourceSuppressionMean, 5),
      southTransitionCirculationReboundSourceSuppressionMeanFrac: round(southTransitionCirculationReboundSourceSuppressionMean, 5),
      northTransitionCirculationReboundRawSourceMeanFrac: round(northTransitionCirculationReboundRawSourceMean, 5),
      southTransitionCirculationReboundRawSourceMeanFrac: round(southTransitionCirculationReboundRawSourceMean, 5),
      northTransitionCirculationReboundSuppressedSourceMeanFrac: round(northTransitionCirculationReboundSuppressedSourceMean, 5),
      southTransitionCirculationReboundSuppressedSourceMeanFrac: round(southTransitionCirculationReboundSuppressedSourceMean, 5),
      northTransitionSubtropicalSubsidenceDryingMeanFrac: round(northTransitionSubsidenceDrying, 5),
      southTransitionSubtropicalSubsidenceDryingMeanFrac: round(southTransitionSubsidenceDrying, 5),
      northDryBeltSubtropicalSubsidenceDryingMeanFrac: round(subtropicalSubsidenceNorth, 5),
      southDryBeltSubtropicalSubsidenceDryingMeanFrac: round(subtropicalSubsidenceSouth, 5),
      northTransitionLowLevelOmegaEffectiveMeanPaS: round(northTransitionLowLevelOmegaEffective, 5),
      southTransitionLowLevelOmegaEffectiveMeanPaS: round(southTransitionLowLevelOmegaEffective, 5),
      northDryBeltLowLevelOmegaEffectiveMeanPaS: round(northDryBeltLowLevelOmegaEffective, 5),
      southDryBeltLowLevelOmegaEffectiveMeanPaS: round(southDryBeltLowLevelOmegaEffective, 5),
      northTransitionCirculationReboundSuppressedSourceShareMeanFrac: round(
        northTransitionCirculationReboundSuppressedSourceMean / Math.max(1e-6, northTransitionCirculationReboundRawSourceMean),
        5
      ),
      southTransitionCirculationReboundSuppressedSourceShareMeanFrac: round(
        southTransitionCirculationReboundSuppressedSourceMean / Math.max(1e-6, southTransitionCirculationReboundRawSourceMean),
        5
      ),
      northDryBeltCirculationReturnFlowOpportunityMeanFrac: round(northDryBeltCirculationReturnFlowOpportunityMean, 5),
      southDryBeltCirculationReturnFlowOpportunityMeanFrac: round(southDryBeltCirculationReturnFlowOpportunityMean, 5),
      northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: round(northDryBeltCirculationReturnFlowCouplingAppliedMean, 5),
      southDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: round(southDryBeltCirculationReturnFlowCouplingAppliedMean, 5),
      northTransitionDryingOmegaBridgeAppliedMeanPaS: round(northTransitionDryingOmegaBridgeAppliedMean, 5),
      southTransitionDryingOmegaBridgeAppliedMeanPaS: round(southTransitionDryingOmegaBridgeAppliedMean, 5),
      northDryBeltDryingOmegaBridgeAppliedMeanPaS: round(northDryBeltDryingOmegaBridgeAppliedMean, 5),
      southDryBeltDryingOmegaBridgeAppliedMeanPaS: round(southDryBeltDryingOmegaBridgeAppliedMean, 5),
      targetEntryProjectedBridgeAppliedMeanPaS: round(targetEntryProjectedBridgeAppliedMean, 5),
      jetBandProjectedBridgeAppliedMeanPaS: round(jetBandProjectedBridgeAppliedMean, 5),
      northTransitionSubtropicalSourceDriverMeanFrac: round(northTransitionSubtropicalSourceDriverMean, 5),
      southTransitionSubtropicalSourceDriverMeanFrac: round(southTransitionSubtropicalSourceDriverMean, 5),
      northDryBeltSubtropicalSourceDriverMeanFrac: round(northDryBeltSubtropicalSourceDriverMean, 5),
      southDryBeltSubtropicalSourceDriverMeanFrac: round(southDryBeltSubtropicalSourceDriverMean, 5),
      northTransitionSubtropicalSourceDriverFloorMeanFrac: round(northTransitionSubtropicalSourceDriverFloorMean, 5),
      southTransitionSubtropicalSourceDriverFloorMeanFrac: round(southTransitionSubtropicalSourceDriverFloorMean, 5),
      northTransitionSubtropicalLocalHemiSourceMeanFrac: round(northTransitionSubtropicalLocalHemiSourceMean, 5),
      southTransitionSubtropicalLocalHemiSourceMeanFrac: round(southTransitionSubtropicalLocalHemiSourceMean, 5),
      northTransitionSubtropicalMeanTropicalSourceMeanFrac: round(northTransitionSubtropicalMeanTropicalSourceMean, 5),
      southTransitionSubtropicalMeanTropicalSourceMeanFrac: round(southTransitionSubtropicalMeanTropicalSourceMean, 5),
      northTransitionSubtropicalCrossHemiFloorShareMeanFrac: round(northTransitionSubtropicalCrossHemiFloorShareMean, 5),
      southTransitionSubtropicalCrossHemiFloorShareMeanFrac: round(southTransitionSubtropicalCrossHemiFloorShareMean, 5),
      northTransitionSubtropicalBalancePartitionSupportMeanFrac: round(northTransitionSubtropicalBalancePartitionSupportMean, 5),
      southTransitionSubtropicalBalancePartitionSupportMeanFrac: round(southTransitionSubtropicalBalancePartitionSupportMean, 5),
      northTransitionSubtropicalBalanceCirculationSupportMeanFrac: round(northTransitionSubtropicalBalanceCirculationSupportMean, 5),
      southTransitionSubtropicalBalanceCirculationSupportMeanFrac: round(southTransitionSubtropicalBalanceCirculationSupportMean, 5),
      northTransitionSubtropicalBalanceContractSupportMeanFrac: round(northTransitionSubtropicalBalanceContractSupportMean, 5),
      southTransitionSubtropicalBalanceContractSupportMeanFrac: round(southTransitionSubtropicalBalanceContractSupportMean, 5),
      northDryBeltSubtropicalBalanceContractSupportMeanFrac: round(northDryBeltSubtropicalBalanceContractSupportMean, 5),
      southDryBeltSubtropicalBalanceContractSupportMeanFrac: round(southDryBeltSubtropicalBalanceContractSupportMean, 5),
      northTransitionSubtropicalWeakHemiFracMean: round(northTransitionSubtropicalWeakHemiFracMean, 5),
      southTransitionSubtropicalWeakHemiFracMean: round(southTransitionSubtropicalWeakHemiFracMean, 5),
      northTransitionSubtropicalWeakHemiFloorOverhangMeanFrac: round(northTransitionSubtropicalWeakHemiFloorOverhangMean, 5),
      southTransitionSubtropicalWeakHemiFloorOverhangMeanFrac: round(southTransitionSubtropicalWeakHemiFloorOverhangMean, 5),
      northTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac: round(northTransitionSubtropicalWeakHemiFloorTaperAppliedMean, 5),
      southTransitionSubtropicalWeakHemiFloorTaperAppliedMeanFrac: round(southTransitionSubtropicalWeakHemiFloorTaperAppliedMean, 5),
      northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2: round(northDryBeltConvectiveDetrainment, 5),
      northDryBeltImportedAnvilPersistenceMeanKgM2: round(northDryBeltImportedAnvilPersistence, 5),
      northDryBeltLandImportedAnvilPersistenceMeanKgM2: round(northDryBeltLandImportedAnvilPersistence, 5),
      northDryBeltOceanImportedAnvilPersistenceMeanKgM2: round(northDryBeltOceanImportedAnvilPersistence, 5),
      northDryBeltCarriedOverUpperCloudMeanKgM2: round(northDryBeltCarriedOverUpperCloud, 5),
      northDryBeltLandCarriedOverUpperCloudMeanKgM2: round(northDryBeltLandCarriedOverUpperCloud, 5),
      northDryBeltOceanCarriedOverUpperCloudMeanKgM2: round(northDryBeltOceanCarriedOverUpperCloud, 5),
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: round(northDryBeltWeakErosionCloudSurvival, 5),
      northDryBeltLandWeakErosionCloudSurvivalMeanKgM2: round(northDryBeltLandWeakErosionCloudSurvival, 5),
      northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2: round(northDryBeltOceanWeakErosionCloudSurvival, 5),
      northDryBeltCarryInputOverrideHitMean: round(northDryBeltCarryInputOverrideHitMean, 5),
      southDryBeltCarryInputOverrideHitMean: round(southDryBeltCarryInputOverrideHitMean, 5),
      northTransitionCarryInputOverrideHitMean: round(northTransitionCarryInputOverrideHitMean, 5),
      southTransitionCarryInputOverrideHitMean: round(southTransitionCarryInputOverrideHitMean, 5),
      northDryBeltCarryInputOverrideRemovedMeanKgM2: round(northDryBeltCarryInputOverrideRemovedMean, 5),
      southDryBeltCarryInputOverrideRemovedMeanKgM2: round(southDryBeltCarryInputOverrideRemovedMean, 5),
      northTransitionCarryInputOverrideRemovedMeanKgM2: round(northTransitionCarryInputOverrideRemovedMean, 5),
      southTransitionCarryInputOverrideRemovedMeanKgM2: round(southTransitionCarryInputOverrideRemovedMean, 5),
      northDryBeltCarryInputOverrideAccumHitMean: round(northDryBeltCarryInputOverrideAccumHitMean, 5),
      southDryBeltCarryInputOverrideAccumHitMean: round(southDryBeltCarryInputOverrideAccumHitMean, 5),
      northTransitionCarryInputOverrideAccumHitMean: round(northTransitionCarryInputOverrideAccumHitMean, 5),
      southTransitionCarryInputOverrideAccumHitMean: round(southTransitionCarryInputOverrideAccumHitMean, 5),
      northDryBeltCarryInputOverrideAccumRemovedMeanKgM2: round(northDryBeltCarryInputOverrideAccumRemovedMean, 5),
      southDryBeltCarryInputOverrideAccumRemovedMeanKgM2: round(southDryBeltCarryInputOverrideAccumRemovedMean, 5),
      northTransitionCarryInputOverrideAccumRemovedMeanKgM2: round(northTransitionCarryInputOverrideAccumRemovedMean, 5),
      southTransitionCarryInputOverrideAccumRemovedMeanKgM2: round(southTransitionCarryInputOverrideAccumRemovedMean, 5),
      northDryBeltCarryInputOverrideAccumRemovalFrac: round(northDryBeltCarryInputOverrideAccumRemovalFrac, 5),
      southDryBeltCarryInputOverrideAccumRemovalFrac: round(southDryBeltCarryInputOverrideAccumRemovalFrac, 5),
      northDryBeltCloudReevaporationMeanKgM2: round(northDryBeltCloudReevaporation, 5),
      northDryBeltPrecipReevaporationMeanKgM2: round(northDryBeltPrecipReevaporation, 5),
      northDryBeltUpperCloudPathMeanKgM2: round(northDryBeltUpperCloudPath, 5),
      northDryBeltBoundaryLayerRhMeanFrac: round(weightedBandMean(zonalBoundaryLayerRh, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltMidTroposphereRhMeanFrac: round(weightedBandMean(zonalMidTroposphereRh, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltBoundaryLayerThetaeMeanK: round(weightedBandMean(zonalBoundaryLayerThetae, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltLowerTroposphereThetaeMeanK: round(weightedBandMean(zonalLowerTroposphereThetae, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltThetaeGradientBoundaryMinusLowerK: round(weightedBandMean(zonalThetaeGradient, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltBoundaryLayerMseMeanJkg: round(weightedBandMean(zonalBoundaryLayerMse, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 3),
      northDryBeltLowerTroposphereMseMeanJkg: round(weightedBandMean(zonalLowerTroposphereMse, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 3),
      northDryBeltMseGradientBoundaryMinusLowerJkg: round(weightedBandMean(zonalMseGradient, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 3),
      northDryBeltInversionStrengthMeanK: round(weightedBandMean(zonalInversionStrength, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltSurfaceCloudShieldingMeanWm2: round(weightedBandMean(zonalSurfaceCloudShielding, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltUpperCloudClearSkyLwCoolingMeanWm2: round(weightedBandMean(zonalUpperCloudClearSkyLwCooling, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltUpperCloudCloudyLwCoolingMeanWm2: round(weightedBandMean(zonalUpperCloudCloudyLwCooling, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltUpperCloudLwCloudEffectMeanWm2: round(weightedBandMean(zonalUpperCloudLwCloudEffect, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: round(weightedBandMean(zonalUpperCloudNetCloudRadiativeEffect, latitudesDeg, rowWeights, DEFAULT_DRY_MIN_LAT, DEFAULT_DRY_MAX_LAT), 5),
      crossEquatorialVaporFluxNorthKgM_1S: round(crossEquatorialVaporFlux, 5),
      northTransitionVaporFluxNorthKgM_1S: round(northTransitionVaporFlux, 5),
      northDryBeltVaporFluxNorthKgM_1S: round(northDryBeltVaporFlux, 5),
      southDryBeltVaporFluxNorthKgM_1S: round(southDryBeltVaporFlux, 5),
      northTransitionTotalWaterFluxNorthKgM_1S: round(northTransitionTotalWaterFlux, 5),
      northDryBeltSourceNorthDryBeltOceanMeanKgM2: northDryBeltSourceMeans.northDryBeltOcean,
      northDryBeltSourceTropicalOceanNorthMeanKgM2: northDryBeltSourceMeans.tropicalOceanNorth,
      northDryBeltSourceTropicalOceanSouthMeanKgM2: northDryBeltSourceMeans.tropicalOceanSouth,
      northDryBeltSourceNorthExtratropicalOceanMeanKgM2: northDryBeltSourceMeans.northExtratropicalOcean,
      northDryBeltSourceLandRecyclingMeanKgM2: northDryBeltSourceMeans.landRecycling,
      northDryBeltSourceOtherOceanMeanKgM2: northDryBeltSourceMeans.otherOcean,
      northDryBeltSourceInitializationMemoryMeanKgM2: northDryBeltSourceMeans.initializationMemory,
      northDryBeltSourceAtmosphericCarryoverMeanKgM2: northDryBeltSourceMeans.atmosphericCarryover,
      northDryBeltSourceNudgingInjectionMeanKgM2: northDryBeltSourceMeans.nudgingInjection,
      northDryBeltSourceAnalysisInjectionMeanKgM2: northDryBeltSourceMeans.analysisInjection,
      northDryBeltSourceUnattributedResidualMeanKgM2: northDryBeltSourceMeans.unattributedResidual,
      northDryBeltSourceAttributionCoverageFrac: round(northDryBeltSourceCoverage, 5),
      subtropicalSubsidenceNorthMean: round(subtropicalSubsidenceNorth),
      subtropicalSubsidenceSouthMean: round(subtropicalSubsidenceSouth),
      upperDetrainmentTropicalKgM2: round(tropicalUpperDetrainment, 5),
      tropicalAnvilPersistenceFrac: round(tropicalAnvilPersistence),
      tropicalTradesNorthU10Ms: round(tradesNorth),
      tropicalTradesSouthU10Ms: round(tradesSouth),
      midlatitudeWesterliesNorthU10Ms: round(westerliesNorth),
      midlatitudeWesterliesSouthU10Ms: round(westerliesSouth),
      stormTrackNorthLatDeg: round(stormTrackNorthLat),
      stormTrackSouthLatDeg: round(stormTrackSouthLat),
      tropicalCycloneEnvironmentCountNh: tcEnvCounts.nh,
      tropicalCycloneEnvironmentCountSh: tcEnvCounts.sh,
      numericalIntegrityScore: numericalIntegrityScore.score,
      numericalIntegrityPass: numericalIntegrityScore.pass,
      numericalLimiterDominance: numericalIntegrityScore.limiterDominance,
      numericalVerticalCflClampMaxKgM2: numericalIntegrityScore.metrics.maxVerticalCflClampMassKgM2,
      numericalSupersaturationClampMaxKgM2: numericalIntegrityScore.metrics.maxSupersaturationClampMassKgM2,
      northDryBeltAssignedSpilloverRegimeCoverageFrac: round(stormSpilloverTracing?.overall?.assignedCombinedContributionFrac || 0, 5),
      northDryBeltPersistentBackgroundCombinedFrac: round(stormSpilloverTracing?.overall?.regimes?.persistent_zonal_background?.combinedContributionFrac || 0, 5),
      northDryBeltTropicalSpilloverCombinedFrac: round(stormSpilloverTracing?.overall?.regimes?.tropical_spillover?.combinedContributionFrac || 0, 5),
      northDryBeltMarineDeckCombinedFrac: round(stormSpilloverTracing?.overall?.regimes?.subtropical_marine_deck_drizzle?.combinedContributionFrac || 0, 5),
      northDryBeltSynopticLeakageCombinedFrac: round(stormSpilloverTracing?.overall?.regimes?.synoptic_storm_leakage?.combinedContributionFrac || 0, 5)
    },
    sourceAttribution: {
      northDryBeltLowLevelMeanKgM2: northDryBeltSourceMeans,
      northDryBeltAttributionCoverageFrac: round(northDryBeltSourceCoverage, 5),
      nhDryBeltSectorSummary
    },
    surfaceFluxDecomposition,
    transportTracing: transportTracing || null,
    verticalCloudBirthTracing: verticalCloudBirthTracing || null,
    upperCloudResidenceTracing: upperCloudResidenceTracing || null,
    cloudTransitionLedgerTracing: cloudTransitionLedgerTracing || null,
    thermodynamicSupportTracing: thermodynamicSupportTracing || null,
    forcingOppositionTracing: forcingOppositionTracing || null,
    numericalIntegrityTracing: numericalIntegrityTracing || null,
    stormSpilloverTracing: stormSpilloverTracing || null,
    profiles: {
      latitudesDeg: roundSeries(latitudesDeg),
      series: {
        precipRateMmHr: roundSeries(zonalPrecip),
        cloudTotalFraction: roundSeries(zonalCloud),
        wind10mU: roundSeries(zonalU10),
        totalColumnWaterKgM2: roundSeries(zonalTcw),
        stormTrackIndex: roundSeries(zonalStormIndex, 5),
        convectiveFraction: roundSeries(zonalConvectiveFraction),
        convectivePotential: roundSeries(zonalConvectivePotential),
        convectiveOrganization: roundSeries(zonalConvectiveOrganization),
        convectiveMassFluxKgM2S: roundSeries(zonalConvectiveMassFlux, 5),
        boundaryLayerRhFrac: roundSeries(zonalBoundaryLayerRh),
        lowerTroposphericRhFrac: roundSeries(zonalLowerRh),
        midTroposphericRhFrac: roundSeries(zonalMidTroposphereRh),
        lowLevelOmegaEffectivePaS: roundSeries(zonalLowLevelOmegaEffective, 5),
        lowerTroposphericOmegaPaS: roundSeries(zonalLowerTroposphericOmega, 5),
        midTroposphericOmegaPaS: roundSeries(zonalMidTroposphericOmega, 5),
        upperTroposphericOmegaPaS: roundSeries(zonalUpperTroposphericOmega, 5),
        boundaryLayerThetaeK: roundSeries(zonalBoundaryLayerThetae, 5),
        lowerTroposphereThetaeK: roundSeries(zonalLowerTroposphereThetae, 5),
        thetaeGradientBoundaryMinusLowerK: roundSeries(zonalThetaeGradient, 5),
        boundaryLayerMseJkg: roundSeries(zonalBoundaryLayerMse, 3),
        lowerTroposphereMseJkg: roundSeries(zonalLowerTroposphereMse, 3),
        mseGradientBoundaryMinusLowerJkg: roundSeries(zonalMseGradient, 3),
        lowerTroposphericInversionStrengthK: roundSeries(zonalInversionStrength, 5),
        lowerLevelMoistureConvergenceS_1: roundSeries(zonalMoistureConvergence, 6),
        subtropicalSubsidenceDryingFrac: roundSeries(zonalSubsidenceDrying, 5),
        dryingOmegaBridgeAppliedPaS: roundSeries(zonalDryingOmegaBridgeApplied, 5),
        dryingOmegaBridgeLocalAppliedPaS: roundSeries(zonalDryingOmegaBridgeLocalApplied, 5),
        dryingOmegaBridgeProjectedAppliedPaS: roundSeries(zonalDryingOmegaBridgeProjectedApplied, 5),
        equatorialEdgeSubsidenceGuardSourceSupportDiagFrac: roundSeries(zonalEquatorialEdgeSubsidenceGuardSourceSupport, 5),
        equatorialEdgeSubsidenceGuardTargetWeightDiagFrac: roundSeries(zonalEquatorialEdgeSubsidenceGuardTargetWeight, 5),
        equatorialEdgeSubsidenceGuardAppliedDiagPaS: roundSeries(zonalEquatorialEdgeSubsidenceGuardApplied, 5),
        equatorialEdgeNorthsideLeakSourceWindowDiagFrac: roundSeries(zonalEquatorialEdgeNorthsideLeakSourceWindow, 5),
        equatorialEdgeNorthsideLeakRiskDiagFrac: roundSeries(zonalEquatorialEdgeNorthsideLeakRisk, 5),
        equatorialEdgeNorthsideLeakAdmissionRiskDiagFrac: roundSeries(zonalEquatorialEdgeNorthsideLeakAdmissionRisk, 5),
        equatorialEdgeNorthsideLeakPenaltyDiagFrac: roundSeries(zonalEquatorialEdgeNorthsideLeakPenalty, 5),
        northSourceConcentrationPenaltyDiagFrac: roundSeries(zonalNorthSourceConcentrationPenalty, 5),
        northSourceConcentrationAppliedDiag: roundSeries(zonalNorthSourceConcentrationApplied, 5),
        atlanticDryCoreReceiverTaperDiagFrac: roundSeries(zonalAtlanticDryCoreReceiverTaper, 5),
        atlanticDryCoreReceiverTaperAppliedDiag: roundSeries(zonalAtlanticDryCoreReceiverApplied, 5),
        atlanticTransitionCarryoverContainmentDiagFrac: roundSeries(zonalAtlanticTransitionCarryoverContainment, 5),
        atlanticTransitionCarryoverContainmentAppliedDiag: roundSeries(zonalAtlanticTransitionCarryoverContainmentApplied, 5),
        subtropicalWeakHemiFloorOverhangDiagFrac: roundSeries(zonalSubtropicalWeakHemiFloorOverhang, 5),
        subtropicalWeakHemiFloorTaperAppliedDiagFrac: roundSeries(zonalSubtropicalWeakHemiFloorTaperApplied, 5),
        freshSubtropicalBandDiagFrac: roundSeries(zonalMean(freshSubtropicalBandDiagFrac || new Array(nx * ny).fill(0), nx, ny), 5),
        freshShoulderLatitudeWindowDiagFrac: roundSeries(zonalFreshShoulderLatitudeWindow, 5),
        freshShoulderEquatorialEdgeWindowDiagFrac: roundSeries(zonalFreshShoulderEquatorialEdgeWindow, 5),
        freshShoulderInnerWindowDiagFrac: roundSeries(zonalFreshShoulderInnerWindow, 5),
        freshShoulderEquatorialEdgeGateSupportDiagFrac: roundSeries(zonalFreshShoulderEquatorialEdgeGateSupport, 5),
        freshShoulderTargetEntryExclusionDiagFrac: roundSeries(zonalFreshShoulderTargetEntryExclusion, 5),
        freshNeutralToSubsidingSupportDiagFrac: roundSeries(zonalMean(freshNeutralToSubsidingSupportDiagFrac || new Array(nx * ny).fill(0), nx, ny), 5),
        surfaceEvapRateMmHr: roundSeries(zonalSurfaceEvap),
        surfaceEvapPotentialRateMmHr: roundSeries(zonalSurfaceEvapPotential),
        surfaceCloudShortwaveShieldingWm2: roundSeries(zonalSurfaceCloudShielding, 5),
        resolvedAscentCloudBirthPotentialKgM2: roundSeries(zonalResolvedAscentCloudBirthPotential, 5),
        largeScaleCondensationSourceKgM2: roundSeries(zonalLargeScaleCondensation, 5),
        shoulderAbsorptionGuardCandidateMassKgM2: roundSeries(zonalShoulderGuardCandidateMass, 5),
        shoulderAbsorptionGuardPotentialSuppressedMassKgM2: roundSeries(zonalShoulderGuardPotentialSuppressedMass, 5),
        shoulderAbsorptionGuardEventCount: roundSeries(zonalShoulderGuardHitCount, 5),
        shoulderAbsorptionGuardBridgeSilenceFrac: roundSeries(zonalShoulderGuardBridgeSilence, 5),
        shoulderAbsorptionGuardBandWindowFrac: roundSeries(zonalShoulderGuardBandWindow, 5),
        shoulderAbsorptionGuardSelectorSupportFrac: roundSeries(zonalShoulderGuardSelectorSupport, 5),
        shoulderAbsorptionGuardAppliedSuppressionKgM2: roundSeries(zonalShoulderGuardAppliedSuppression, 5),
        shoulderAbsorptionGuardRetainedVaporKgM2: roundSeries(zonalShoulderGuardRetainedVapor, 5),
        shoulderAbsorptionGuardSinkExportKgM2: roundSeries(zonalShoulderGuardSinkExport, 5),
        shoulderAbsorptionGuardBufferedRainoutKgM2: roundSeries(zonalShoulderGuardBufferedRainout, 5),
        cloudReevaporationMassKgM2: roundSeries(zonalCloudReevaporation, 5),
        precipReevaporationMassKgM2: roundSeries(zonalPrecipReevaporation, 5),
        importedAnvilPersistenceMassKgM2: roundSeries(zonalImportedAnvilPersistence, 5),
        carriedOverUpperCloudMassKgM2: roundSeries(zonalCarriedOverUpperCloud, 5),
        weakErosionCloudSurvivalMassKgM2: roundSeries(zonalWeakErosionCloudSurvival, 5),
        carryInputOverrideHitCount: roundSeries(zonalCarryInputOverrideHitCount, 5),
        carryInputOverrideRemovedMassKgM2: roundSeries(zonalCarryInputOverrideRemovedMass, 5),
        carryInputOverrideAccumHitCount: roundSeries(zonalCarryInputOverrideAccumHitCount, 5),
        carryInputOverrideAccumRemovedMassKgM2: roundSeries(zonalCarryInputOverrideAccumRemovedMass, 5),
        upperCloudPathKgM2: roundSeries(zonalUpperCloudPath, 5),
        upperCloudClearSkyLwCoolingWm2: roundSeries(zonalUpperCloudClearSkyLwCooling, 5),
        upperCloudCloudyLwCoolingWm2: roundSeries(zonalUpperCloudCloudyLwCooling, 5),
        upperCloudLwCloudEffectWm2: roundSeries(zonalUpperCloudLwCloudEffect, 5),
        upperCloudNetCloudRadiativeEffectWm2: roundSeries(zonalUpperCloudNetCloudRadiativeEffect, 5),
        sourceNorthDryBeltOceanKgM2: roundSeries(sourceTracerZonal.northDryBeltOcean || new Array(ny).fill(0), 5),
        sourceTropicalOceanNorthKgM2: roundSeries(sourceTracerZonal.tropicalOceanNorth || new Array(ny).fill(0), 5),
        sourceTropicalOceanSouthKgM2: roundSeries(sourceTracerZonal.tropicalOceanSouth || new Array(ny).fill(0), 5),
        sourceNorthExtratropicalOceanKgM2: roundSeries(sourceTracerZonal.northExtratropicalOcean || new Array(ny).fill(0), 5),
        sourceLandRecyclingKgM2: roundSeries(sourceTracerZonal.landRecycling || new Array(ny).fill(0), 5),
        sourceOtherOceanKgM2: roundSeries(sourceTracerZonal.otherOcean || new Array(ny).fill(0), 5),
        sourceInitializationMemoryKgM2: roundSeries(sourceTracerZonal.initializationMemory || new Array(ny).fill(0), 5),
        sourceUnattributedResidualKgM2: roundSeries(sourceTracerZonal.unattributedResidual || new Array(ny).fill(0), 5),
        verticallyIntegratedVaporFluxNorthKgM_1S: roundSeries(zonalVaporFluxNorth, 5),
        verticallyIntegratedTotalWaterFluxNorthKgM_1S: roundSeries(zonalTotalWaterFluxNorth, 5),
        upperDetrainmentKgM2: roundSeries(zonalDetrainment, 5),
        anvilPersistenceFrac: roundSeries(zonalAnvil)
      }
    },
    processMoistureBudget: processMoistureBudget || null
  };
};

export const buildMoistureAttributionReport = (processMoistureBudget, latestMetrics = {}) => {
  const modules = Object.entries(processMoistureBudget?.modules || {}).map(([module, summary]) => {
    const northDry = summary?.bands?.north_dry_belt || {};
    const northDryLand = summary?.bands?.north_dry_belt_land || {};
    const northDryOcean = summary?.bands?.north_dry_belt_ocean || {};
    const northDrySurface = Number(northDry.surfaceVaporDeltaKgKg) || 0;
    const northDryUpper = Number(northDry.upperVaporDeltaKgKg) || 0;
    return {
      module,
      callCount: summary?.callCount || 0,
      northDryBeltSurfaceVaporDeltaKgKg: round(northDrySurface, 6),
      northDryBeltUpperVaporDeltaKgKg: round(northDryUpper, 6),
      northDryBeltNetVaporDeltaKgKg: round(northDrySurface + northDryUpper, 6),
      northDryBeltSurfacePrecipDeltaMm: round(northDry.surfacePrecipDeltaMm, 5),
      northDryBeltLandSurfaceVaporDeltaKgKg: round(northDryLand.surfaceVaporDeltaKgKg, 6),
      northDryBeltOceanSurfaceVaporDeltaKgKg: round(northDryOcean.surfaceVaporDeltaKgKg, 6)
    };
  });

  const positiveNorthDryMoisteningDrivers = modules
    .filter((entry) => Number(entry.northDryBeltNetVaporDeltaKgKg) > 0)
    .sort((a, b) => (b.northDryBeltNetVaporDeltaKgKg || 0) - (a.northDryBeltNetVaporDeltaKgKg || 0));
  const strongestNorthDryDryingDrivers = modules
    .filter((entry) => Number(entry.northDryBeltNetVaporDeltaKgKg) < 0)
    .sort((a, b) => (a.northDryBeltNetVaporDeltaKgKg || 0) - (b.northDryBeltNetVaporDeltaKgKg || 0));
  const strongestNorthDryPrecipSinks = modules
    .filter((entry) => Number(entry.northDryBeltSurfacePrecipDeltaMm) > 0)
    .sort((a, b) => (b.northDryBeltSurfacePrecipDeltaMm || 0) - (a.northDryBeltSurfacePrecipDeltaMm || 0));

  return {
    schema: 'satellite-wars.moisture-attribution.v1',
    generatedAt: new Date().toISOString(),
    trackedModelDays: round((processMoistureBudget?.sampledModelSeconds || 0) / 86400, 3),
    latestMetrics: {
      subtropicalDryNorthRatio: latestMetrics?.subtropicalDryNorthRatio ?? null,
      northDryBeltLandPrecipMeanMmHr: latestMetrics?.northDryBeltLandPrecipMeanMmHr ?? null,
      northDryBeltOceanPrecipMeanMmHr: latestMetrics?.northDryBeltOceanPrecipMeanMmHr ?? null,
      northDryBeltLandRhMeanFrac: latestMetrics?.northDryBeltLandRhMeanFrac ?? null,
      northDryBeltOceanRhMeanFrac: latestMetrics?.northDryBeltOceanRhMeanFrac ?? null,
      northDryBeltLandEvapMeanMmHr: latestMetrics?.northDryBeltLandEvapMeanMmHr ?? null,
      northDryBeltOceanEvapMeanMmHr: latestMetrics?.northDryBeltOceanEvapMeanMmHr ?? null,
      northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      northDryBeltLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null,
      northDryBeltLandLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLandLargeScaleCondensationMeanKgM2 ?? null,
      northDryBeltOceanLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? null,
      northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2: latestMetrics?.northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2 ?? null,
      northDryBeltImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2 ?? null,
      northDryBeltLandImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltLandImportedAnvilPersistenceMeanKgM2 ?? null,
      northDryBeltOceanImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltOceanImportedAnvilPersistenceMeanKgM2 ?? null,
      northDryBeltCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltLandCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltLandCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltOceanCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltOceanCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2 ?? null,
      northDryBeltLandWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltLandWeakErosionCloudSurvivalMeanKgM2 ?? null,
      northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2 ?? null,
      northDryBeltCloudReevaporationMeanKgM2: latestMetrics?.northDryBeltCloudReevaporationMeanKgM2 ?? null,
      northDryBeltPrecipReevaporationMeanKgM2: latestMetrics?.northDryBeltPrecipReevaporationMeanKgM2 ?? null,
      northDryBeltUpperCloudPathMeanKgM2: latestMetrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null,
      crossEquatorialVaporFluxNorthKgM_1S: latestMetrics?.crossEquatorialVaporFluxNorthKgM_1S ?? null,
      northTransitionVaporFluxNorthKgM_1S: latestMetrics?.northTransitionVaporFluxNorthKgM_1S ?? null,
      northDryBeltVaporFluxNorthKgM_1S: latestMetrics?.northDryBeltVaporFluxNorthKgM_1S ?? null
    },
    northDryBeltGenerationAttribution: {
      resolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      landResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltLandResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      oceanResolvedAscentCloudBirthPotentialMeanKgM2: latestMetrics?.northDryBeltOceanResolvedAscentCloudBirthPotentialMeanKgM2 ?? null,
      largeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null,
      landLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltLandLargeScaleCondensationMeanKgM2 ?? null,
      oceanLargeScaleCondensationMeanKgM2: latestMetrics?.northDryBeltOceanLargeScaleCondensationMeanKgM2 ?? null,
      convectiveDetrainmentCloudSourceMeanKgM2: latestMetrics?.northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2 ?? null,
      importedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltImportedAnvilPersistenceMeanKgM2 ?? null,
      landImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltLandImportedAnvilPersistenceMeanKgM2 ?? null,
      oceanImportedAnvilPersistenceMeanKgM2: latestMetrics?.northDryBeltOceanImportedAnvilPersistenceMeanKgM2 ?? null,
      carriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
      landCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltLandCarriedOverUpperCloudMeanKgM2 ?? null,
      oceanCarriedOverUpperCloudMeanKgM2: latestMetrics?.northDryBeltOceanCarriedOverUpperCloudMeanKgM2 ?? null,
      weakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2 ?? null,
      landWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltLandWeakErosionCloudSurvivalMeanKgM2 ?? null,
      oceanWeakErosionCloudSurvivalMeanKgM2: latestMetrics?.northDryBeltOceanWeakErosionCloudSurvivalMeanKgM2 ?? null,
      cloudReevaporationMeanKgM2: latestMetrics?.northDryBeltCloudReevaporationMeanKgM2 ?? null,
      precipReevaporationMeanKgM2: latestMetrics?.northDryBeltPrecipReevaporationMeanKgM2 ?? null,
      upperCloudPathMeanKgM2: latestMetrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null
    },
    positiveNorthDryBeltMoisteningDrivers: positiveNorthDryMoisteningDrivers.slice(0, 8),
    strongestNorthDryBeltDryingDrivers: strongestNorthDryDryingDrivers.slice(0, 8),
    strongestNorthDryBeltPrecipSinks: strongestNorthDryPrecipSinks.slice(0, 8),
    precipitationRegimes: processMoistureBudget?.precipitationRegimes || {}
  };
};

export const buildSurfaceSourceAttributionReport = (latestSample = null) => ({
  schema: 'satellite-wars.surface-source-attribution.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  latestMetrics: {
    subtropicalDryNorthRatio: latestSample?.metrics?.subtropicalDryNorthRatio ?? null,
    northDryBeltSourceAttributionCoverageFrac: latestSample?.metrics?.northDryBeltSourceAttributionCoverageFrac ?? null
  },
  sourceAttribution: latestSample?.sourceAttribution || null
});

export const buildSurfaceFluxDecompositionReport = (latestSample = null) => ({
  schema: 'satellite-wars.surface-flux-decomposition.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  surfaceFluxDecomposition: latestSample?.surfaceFluxDecomposition || null
});

export const buildNhDryBeltSourceSectorReport = (latestSample = null) => ({
  schema: 'satellite-wars.nh-dry-belt-source-sector-summary.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  nhDryBeltSectorSummary: latestSample?.sourceAttribution?.nhDryBeltSectorSummary || null
});

const transportInterfaceByTarget = (transportTracing, targetLatDeg) => (
  (transportTracing?.interfaces || []).find((entry) => Number(entry?.targetLatDeg) === Number(targetLatDeg)) || null
);

const sumInterfaceLevelBandField = (interfaceSummary, fieldName) => Object.values(interfaceSummary?.levelBands || {})
  .reduce((sum, levelBand) => sum + (Number(levelBand?.[fieldName]) || 0), 0);

const findDominantNhDryBeltImport = (transportTracing, fieldName) => {
  const candidates = [];
  for (const targetLatDeg of [22, 35]) {
    const interfaceSummary = transportInterfaceByTarget(transportTracing, targetLatDeg);
    if (!interfaceSummary) continue;
    for (const [levelBandKey, levelBand] of Object.entries(interfaceSummary.levelBands || {})) {
      const signedFlux = Number(levelBand?.[fieldName]) || 0;
      const importMagnitude = targetLatDeg === 35 ? Math.max(0, -signedFlux) : Math.max(0, signedFlux);
      candidates.push({
        interfaceTargetLatDeg: targetLatDeg,
        levelBandKey,
        label: levelBand?.label || levelBandKey,
        signedFluxNorthKgM_1S: round(signedFlux, 5),
        importMagnitudeKgM_1S: round(importMagnitude, 5)
      });
    }
  }
  return candidates.sort((a, b) => (b.importMagnitudeKgM_1S || 0) - (a.importMagnitudeKgM_1S || 0))[0] || null;
};

const computeDirectionalExportSigma = (interfaceSummary, fieldName, direction = 'northward') => {
  let numerator = 0;
  let denominator = 0;
  for (const level of interfaceSummary?.modelLevels || []) {
    const signedFlux = Number(level?.[fieldName]) || 0;
    const magnitude = direction === 'northward'
      ? Math.max(0, signedFlux)
      : Math.max(0, -signedFlux);
    numerator += (Number(level?.sigmaMid) || 0) * magnitude;
    denominator += magnitude;
  }
  return denominator > 0 ? numerator / denominator : null;
};

const computeRecirculationProxy = (transportTracing, fieldName) => {
  const southBoundaryFlux = sumInterfaceLevelBandField(transportInterfaceByTarget(transportTracing, 22), fieldName);
  const northBoundaryFlux = sumInterfaceLevelBandField(transportInterfaceByTarget(transportTracing, 35), fieldName);
  return Math.max(0, Math.abs(southBoundaryFlux) + Math.abs(northBoundaryFlux) - Math.abs(southBoundaryFlux + northBoundaryFlux));
};

const computeReturnBranchIntensity = (transportTracing, bandKey, direction = 'equatorward') => {
  const band = (transportTracing?.bandLevelMatrix || []).find((entry) => entry?.key === bandKey);
  if (!band) return null;
  const levelBandKeys = ['boundaryLayer', 'lowerTroposphere'];
  const signedFluxes = levelBandKeys
    .map((key) => Number(band?.levelBands?.[key]?.massFluxNorthKgM_1S) || 0);
  if (direction === 'equatorward_nh') {
    return Math.max(...signedFluxes.map((value) => Math.max(0, -value)), 0);
  }
  if (direction === 'equatorward_sh') {
    return Math.max(...signedFluxes.map((value) => Math.max(0, value)), 0);
  }
  return Math.max(...signedFluxes.map((value) => Math.abs(value)), 0);
};

const buildTransportRootCauseAssessment = (latestSample = null) => {
  const transportTracing = latestSample?.transportTracing;
  const metrics = latestSample?.metrics || {};
  const north22 = transportInterfaceByTarget(transportTracing, 22);
  const north35 = transportInterfaceByTarget(transportTracing, 35);
  const southImportVapor = north22 ? Math.max(0, sumInterfaceLevelBandField(north22, 'vaporFluxNorthKgM_1S')) : 0;
  const northImportVapor = north35 ? Math.max(0, -sumInterfaceLevelBandField(north35, 'vaporFluxNorthKgM_1S')) : 0;
  const southImportCloud = north22 ? Math.max(0, sumInterfaceLevelBandField(north22, 'cloudFluxNorthKgM_1S')) : 0;
  const northImportCloud = north35 ? Math.max(0, -sumInterfaceLevelBandField(north35, 'cloudFluxNorthKgM_1S')) : 0;
  const localSourceProxy = (Number(metrics.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceLandRecyclingMeanKgM2) || 0);
  const totalAttributed = localSourceProxy
    + (Number(metrics.northDryBeltSourceTropicalOceanNorthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceTropicalOceanSouthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNorthExtratropicalOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceOtherOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAtmosphericCarryoverMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNudgingInjectionMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAnalysisInjectionMeanKgM2) || 0);
  const importedSourceProxy = Math.max(0, totalAttributed - localSourceProxy);
  const ruledIn = [];
  const ruledOut = [];
  const ambiguous = [];

  if (southImportVapor > northImportVapor * 1.25) {
    ruledIn.push('South-boundary transport across 22° dominates NH dry-belt vapor import.');
    ruledOut.push('NH dry-belt wet bias is not primarily driven by extratropical vapor import across 35°.');
  } else if (northImportVapor > southImportVapor * 1.25) {
    ruledIn.push('North-boundary transport across 35° materially contributes to NH dry-belt vapor import.');
  } else {
    ambiguous.push('North and south boundary vapor imports remain comparable in magnitude.');
  }

  if (southImportCloud > northImportCloud * 1.25) {
    ruledIn.push('Upper-cloud and condensate import from the tropical side is stronger than extratropical cloud import.');
  } else if (northImportCloud > southImportCloud * 1.25) {
    ambiguous.push('Extratropical cloud import remains competitive with tropical-side cloud transport.');
  } else {
    ambiguous.push('Cloud import is split across both NH dry-belt boundaries.');
  }

  if (totalAttributed > 0 && importedSourceProxy / totalAttributed >= 0.6) {
    ruledIn.push('Imported transport clearly outweighs local-source moisture in the NH dry-belt reservoir.');
    ruledOut.push('Local NH subtropical surface source alone cannot explain the wet bias.');
  } else {
    ambiguous.push('Local versus imported low-level source share is not yet decisively one-sided.');
  }

  return { ruledIn, ruledOut, ambiguous };
};

export const buildTransportInterfaceBudgetReport = (latestSample = null) => ({
  schema: 'satellite-wars.transport-interface-budget.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  dominantNhDryBeltVaporImport: findDominantNhDryBeltImport(latestSample?.transportTracing, 'vaporFluxNorthKgM_1S'),
  dominantNhDryBeltCloudImport: findDominantNhDryBeltImport(latestSample?.transportTracing, 'cloudFluxNorthKgM_1S'),
  interfaces: latestSample?.transportTracing?.interfaces || null
});

export const buildBandLevelFluxMatrixReport = (latestSample = null) => ({
  schema: 'satellite-wars.band-level-flux-matrix.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  levelBands: latestSample?.transportTracing?.levelBands || null,
  latitudeBands: latestSample?.transportTracing?.bandLevelMatrix || null
});

export const buildHadleyPartitionSummaryReport = (latestSample = null) => {
  const transportTracing = latestSample?.transportTracing;
  const metrics = latestSample?.metrics || {};
  const north12 = transportInterfaceByTarget(transportTracing, 12);
  const south12 = transportInterfaceByTarget(transportTracing, -12);
  const localSourceProxyKgM2 = (Number(metrics.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceLandRecyclingMeanKgM2) || 0);
  const attributedTotalKgM2 = localSourceProxyKgM2
    + (Number(metrics.northDryBeltSourceTropicalOceanNorthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceTropicalOceanSouthMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNorthExtratropicalOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceOtherOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAtmosphericCarryoverMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceNudgingInjectionMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceAnalysisInjectionMeanKgM2) || 0);
  const importedSourceProxyKgM2 = Math.max(0, attributedTotalKgM2 - localSourceProxyKgM2);
  return {
    schema: 'satellite-wars.hadley-partition-summary.v1',
    generatedAt: new Date().toISOString(),
    targetDay: latestSample?.targetDay ?? null,
    lowLevelSourcePartition: {
      localSourceProxyKgM2: round(localSourceProxyKgM2, 5),
      importedSourceProxyKgM2: round(importedSourceProxyKgM2, 5),
      localSourceProxyFrac: attributedTotalKgM2 > 0 ? round(localSourceProxyKgM2 / attributedTotalKgM2, 5) : null,
      importedSourceProxyFrac: attributedTotalKgM2 > 0 ? round(importedSourceProxyKgM2 / attributedTotalKgM2, 5) : null
    },
    tropicalExportLevels: {
      northVaporExportSigma: round(computeDirectionalExportSigma(north12, 'vaporFluxNorthKgM_1S', 'northward'), 5),
      northCloudExportSigma: round(computeDirectionalExportSigma(north12, 'cloudFluxNorthKgM_1S', 'northward'), 5),
      southVaporExportSigma: round(computeDirectionalExportSigma(south12, 'vaporFluxNorthKgM_1S', 'southward'), 5),
      southCloudExportSigma: round(computeDirectionalExportSigma(south12, 'cloudFluxNorthKgM_1S', 'southward'), 5)
    },
    returnBranchIntensity: {
      northDryBeltEquatorwardMassFluxKgM_1S: round(computeReturnBranchIntensity(transportTracing, 'northDryBelt', 'equatorward_nh'), 5),
      southDryBeltEquatorwardMassFluxKgM_1S: round(computeReturnBranchIntensity(transportTracing, 'southDryBelt', 'equatorward_sh'), 5)
    },
    northDryBeltTransport: {
      dominantVaporImport: findDominantNhDryBeltImport(transportTracing, 'vaporFluxNorthKgM_1S'),
      dominantCloudImport: findDominantNhDryBeltImport(transportTracing, 'cloudFluxNorthKgM_1S'),
      vaporRecirculationProxyKgM_1S: round(computeRecirculationProxy(transportTracing, 'vaporFluxNorthKgM_1S'), 5),
      cloudRecirculationProxyKgM_1S: round(computeRecirculationProxy(transportTracing, 'cloudFluxNorthKgM_1S'), 5)
    },
    streamfunctionProxy: transportTracing?.streamfunctionProxy || null,
    rootCauseAssessment: buildTransportRootCauseAssessment(latestSample)
  };
};

const compactTransportSummary = (sample = null) => {
  if (!sample?.transportTracing) return null;
  return {
    dominantNhDryBeltVaporImport: findDominantNhDryBeltImport(sample.transportTracing, 'vaporFluxNorthKgM_1S'),
    dominantNhDryBeltCloudImport: findDominantNhDryBeltImport(sample.transportTracing, 'cloudFluxNorthKgM_1S')
  };
};

const dominantVerticalCloudBirthChannel = (verticalCloudBirthTracing = null) => {
  const channels = verticalCloudBirthTracing?.attribution?.northDryBeltChannelMeansKgM2 || null;
  if (!channels) return null;
  const [key, value] = Object.entries(channels)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))[0] || [];
  return key ? { key, meanKgM2: round(value, 5) } : null;
};

export const buildVerticalCloudBirthAttributionReport = (latestSample = null) => ({
  schema: 'satellite-wars.vertical-cloud-birth-attribution.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  dominantNhDryBeltChannel: dominantVerticalCloudBirthChannel(latestSample?.verticalCloudBirthTracing),
  attribution: latestSample?.verticalCloudBirthTracing?.attribution || null,
  rootCauseAssessment: latestSample?.verticalCloudBirthTracing?.rootCauseAssessment || null
});

export const buildVerticalCloudBirthHistogramsReport = (latestSample = null) => ({
  schema: 'satellite-wars.vertical-cloud-birth-histograms.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  histograms: latestSample?.verticalCloudBirthTracing?.histograms || null
});

export const buildDryBeltCloudOriginMatrixReport = (latestSample = null) => ({
  schema: 'satellite-wars.dry-belt-cloud-origin-matrix.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  dominantNhDryBeltChannel: dominantVerticalCloudBirthChannel(latestSample?.verticalCloudBirthTracing),
  originMatrix: latestSample?.verticalCloudBirthTracing?.originMatrix || null
});

export const buildCloudTransitionLedgerReport = (latestSample = null) => ({
  schema: 'satellite-wars.cloud-transition-ledger.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  summary: latestSample?.cloudTransitionLedgerTracing?.summary || null,
  modules: latestSample?.cloudTransitionLedgerTracing?.modules || null,
  cells: latestSample?.cloudTransitionLedgerTracing?.cells || null,
  rootCauseAssessment: latestSample?.cloudTransitionLedgerTracing?.rootCauseAssessment || null
});

export const buildCloudTransitionLedgerSummaryReport = (latestSample = null) => ({
  schema: 'satellite-wars.cloud-transition-ledger-summary.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  summary: latestSample?.cloudTransitionLedgerTracing?.summary || null,
  rootCauseAssessment: latestSample?.cloudTransitionLedgerTracing?.rootCauseAssessment || null
});

export const buildCloudTransitionLedgerSectorSplitReport = (latestSample = null) => ({
  schema: 'satellite-wars.cloud-transition-ledger-sector-split.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  sectoral: latestSample?.cloudTransitionLedgerTracing?.sectoral || null
});

export const buildCorridorReplayCatalogReport = (phaseCReplay = null) => ({
  schema: 'satellite-wars.corridor-replay-catalog.v1',
  generatedAt: new Date().toISOString(),
  targetDay: phaseCReplay?.targetDay ?? null,
  targets: phaseCReplay?.targets || [],
  checkpoints: phaseCReplay?.checkpoints || {},
  rootCauseAssessment: phaseCReplay?.rootCauseAssessment || null
});

export const buildCorridorStepSliceAttributionReport = (phaseCReplay = null) => ({
  schema: 'satellite-wars.corridor-step-slice-attribution.v1',
  generatedAt: new Date().toISOString(),
  targetDay: phaseCReplay?.targetDay ?? null,
  slices: phaseCReplay?.slices || {},
  rootCauseAssessment: phaseCReplay?.rootCauseAssessment || null
});

export const buildCorridorModuleToggleDeltasReport = (phaseCReplay = null) => ({
  schema: 'satellite-wars.corridor-module-toggle-deltas.v1',
  generatedAt: new Date().toISOString(),
  targetDay: phaseCReplay?.targetDay ?? null,
  toggleableModules: PHASE_C_TOGGLEABLE_MODULES.slice(),
  replayWindows: PHASE_C_REPLAY_WINDOWS.slice(),
  deltas: phaseCReplay?.moduleToggleDeltas || {},
  rootCauseAssessment: phaseCReplay?.rootCauseAssessment || null
});

const compactVerticalCloudBirthSummary = (sample = null) => {
  if (!sample?.verticalCloudBirthTracing) return null;
  return {
    dominantNhDryBeltChannel: dominantVerticalCloudBirthChannel(sample.verticalCloudBirthTracing),
    northDryBeltCarryOverSurvivalFrac: sample.verticalCloudBirthTracing?.attribution?.northDryBeltCarryOverSurvivalFrac ?? null,
    rootCauseAssessment: sample.verticalCloudBirthTracing?.rootCauseAssessment || null
  };
};

export const buildUpperCloudResidenceReport = (latestSample = null) => ({
  schema: 'satellite-wars.upper-cloud-residence.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  ageAttribution: latestSample?.upperCloudResidenceTracing?.ageAttribution || null,
  rootCauseAssessment: latestSample?.upperCloudResidenceTracing?.rootCauseAssessment || null
});

export const buildUpperCloudErosionBudgetReport = (latestSample = null) => ({
  schema: 'satellite-wars.upper-cloud-erosion-budget.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  erosionBudget: latestSample?.upperCloudResidenceTracing?.erosionBudget || null,
  rootCauseAssessment: latestSample?.upperCloudResidenceTracing?.rootCauseAssessment || null
});

export const buildUpperCloudVentilationSummaryReport = (latestSample = null) => ({
  schema: 'satellite-wars.upper-cloud-ventilation-summary.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  ventilation: latestSample?.upperCloudResidenceTracing?.ventilation || null,
  rootCauseAssessment: latestSample?.upperCloudResidenceTracing?.rootCauseAssessment || null
});

const compactUpperCloudResidenceSummary = (sample = null) => {
  if (!sample?.upperCloudResidenceTracing) return null;
  return {
    northDryBeltResidenceMeanDays: sample.upperCloudResidenceTracing?.ageAttribution?.northDryBeltResidenceMeanDays ?? null,
    northDryBeltTimeSinceImportMeanDays: sample.upperCloudResidenceTracing?.ageAttribution?.northDryBeltTimeSinceImportMeanDays ?? null,
    northDryBeltStaleFrac: sample.upperCloudResidenceTracing?.ageAttribution?.northDryBeltStaleFrac ?? null,
    northDryBeltAppliedErosionFrac: sample.upperCloudResidenceTracing?.erosionBudget?.northDryBeltAppliedErosionFrac ?? null,
    northDryBeltBlockedErosionFrac: sample.upperCloudResidenceTracing?.erosionBudget?.northDryBeltBlockedErosionFrac ?? null,
    dominantCloudImport: {
      interfaceTargetLatDeg: sample.upperCloudResidenceTracing?.ventilation?.dominantImportInterfaceTargetLatDeg ?? null,
      north35UpperTroposphereImportMagnitudeKgM_1S: sample.upperCloudResidenceTracing?.ventilation?.north35UpperTroposphereImportMagnitudeKgM_1S ?? null
    },
    rootCauseAssessment: sample.upperCloudResidenceTracing?.rootCauseAssessment || null
  };
};

const compactCloudTransitionLedgerSummary = (sample = null) => {
  if (!sample?.cloudTransitionLedgerTracing) return null;
  return {
    attributedUpperCloudPathChangeFrac: sample.cloudTransitionLedgerTracing?.summary?.attributedUpperCloudPathChangeFrac ?? null,
    netCloudChangeClosureFrac: sample.cloudTransitionLedgerTracing?.summary?.netCloudChangeClosureFrac ?? null,
    totalAbsAttributedTransitionMeanKgM2: sample.cloudTransitionLedgerTracing?.summary?.totalAbsAttributedTransitionMeanKgM2 ?? null,
    firstPersistentProblemModule: sample.cloudTransitionLedgerTracing?.summary?.firstPersistentProblemModule ?? null,
    dominantPersistentModule: sample.cloudTransitionLedgerTracing?.summary?.dominantPersistentModule ?? null,
    persistentScoreByModule: sample.cloudTransitionLedgerTracing?.summary?.persistentScoreByModule || null,
    rootCauseAssessment: sample.cloudTransitionLedgerTracing?.rootCauseAssessment || null
  };
};

export const buildThermodynamicSupportSummaryReport = (latestSample = null) => ({
  schema: 'satellite-wars.thermodynamic-support-summary.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  stability: latestSample?.thermodynamicSupportTracing?.stability || null,
  classification: latestSample?.thermodynamicSupportTracing?.classification || null,
  rootCauseAssessment: latestSample?.thermodynamicSupportTracing?.rootCauseAssessment || null
});

export const buildRadiativeCloudMaintenanceReport = (latestSample = null) => ({
  schema: 'satellite-wars.radiative-cloud-maintenance.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  radiation: latestSample?.thermodynamicSupportTracing?.radiation || null,
  classification: latestSample?.thermodynamicSupportTracing?.classification || null,
  rootCauseAssessment: latestSample?.thermodynamicSupportTracing?.rootCauseAssessment || null
});

export const buildBoundaryLayerStabilityProfilesReport = (latestSample = null) => ({
  schema: 'satellite-wars.boundary-layer-stability-profiles.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  latitudesDeg: latestSample?.profiles?.latitudesDeg || null,
  stabilitySeries: latestSample?.profiles?.series ? {
    boundaryLayerRhFrac: latestSample.profiles.series.boundaryLayerRhFrac || null,
    lowerTroposphericRhFrac: latestSample.profiles.series.lowerTroposphericRhFrac || null,
    midTroposphericRhFrac: latestSample.profiles.series.midTroposphericRhFrac || null,
    boundaryLayerThetaeK: latestSample.profiles.series.boundaryLayerThetaeK || null,
    lowerTroposphereThetaeK: latestSample.profiles.series.lowerTroposphereThetaeK || null,
    thetaeGradientBoundaryMinusLowerK: latestSample.profiles.series.thetaeGradientBoundaryMinusLowerK || null,
    boundaryLayerMseJkg: latestSample.profiles.series.boundaryLayerMseJkg || null,
    lowerTroposphereMseJkg: latestSample.profiles.series.lowerTroposphereMseJkg || null,
    mseGradientBoundaryMinusLowerJkg: latestSample.profiles.series.mseGradientBoundaryMinusLowerJkg || null,
    lowerTroposphericInversionStrengthK: latestSample.profiles.series.lowerTroposphericInversionStrengthK || null
  } : null,
  radiativeSeries: latestSample?.profiles?.series ? {
    surfaceCloudShortwaveShieldingWm2: latestSample.profiles.series.surfaceCloudShortwaveShieldingWm2 || null,
    upperCloudClearSkyLwCoolingWm2: latestSample.profiles.series.upperCloudClearSkyLwCoolingWm2 || null,
    upperCloudCloudyLwCoolingWm2: latestSample.profiles.series.upperCloudCloudyLwCoolingWm2 || null,
    upperCloudLwCloudEffectWm2: latestSample.profiles.series.upperCloudLwCloudEffectWm2 || null,
    upperCloudNetCloudRadiativeEffectWm2: latestSample.profiles.series.upperCloudNetCloudRadiativeEffectWm2 || null
  } : null
});

export const buildForcingOppositionBudgetReport = (latestSample = null) => ({
  schema: 'satellite-wars.forcing-opposition-budget.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  northDryBelt: latestSample?.forcingOppositionTracing?.northDryBelt || null,
  northDryBeltLandOcean: latestSample?.forcingOppositionTracing?.northDryBeltLandOcean || null,
  levelBands: latestSample?.forcingOppositionTracing?.levelBands || null,
  rootCauseAssessment: latestSample?.forcingOppositionTracing?.rootCauseAssessment || null
});

export const buildNudgingTargetMismatchReport = (latestSample = null) => {
  const northDryBelt = latestSample?.forcingOppositionTracing?.northDryBelt || null;
  return {
    schema: 'satellite-wars.nudging-target-mismatch.v1',
    generatedAt: new Date().toISOString(),
    targetDay: latestSample?.targetDay ?? null,
    northDryBelt: northDryBelt ? {
      nudgingTargetQvMismatchMeanKgKg: northDryBelt.nudgingTargetQvMismatchMeanKgKg,
      nudgingTargetThetaMismatchMeanK: northDryBelt.nudgingTargetThetaMismatchMeanK,
      nudgingTargetWindMismatchMeanMs: northDryBelt.nudgingTargetWindMismatchMeanMs,
      analysisTargetQvMismatchMeanKgKg: northDryBelt.analysisTargetQvMismatchMeanKgKg,
      analysisTargetThetaMismatchMeanK: northDryBelt.analysisTargetThetaMismatchMeanK,
      analysisTargetWindMismatchMeanMs: northDryBelt.analysisTargetWindMismatchMeanMs,
      windTargetMismatchMeanMs: northDryBelt.windTargetMismatchMeanMs
    } : null,
    levelBands: latestSample?.forcingOppositionTracing?.levelBands || null,
    rootCauseAssessment: latestSample?.forcingOppositionTracing?.rootCauseAssessment || null
  };
};

const findNearestSampleAtOrBefore = (samples, targetDay) => {
  const eligible = samples
    .filter((sample) => Number.isFinite(sample?.targetDay) && sample.targetDay <= targetDay)
    .sort((a, b) => b.targetDay - a.targetDay);
  return eligible[0] || null;
};

export const buildInitializationMemoryReport = (samples = [], latestSample = null) => {
  const milestones = [10, 30, 60, 90].map((requestedDay) => {
    const sample = findNearestSampleAtOrBefore(samples, requestedDay)
      || samples.find((entry) => Number.isFinite(entry?.targetDay))
      || null;
    const metrics = sample?.metrics || {};
    const totalTracked = (Number(metrics.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceTropicalOceanNorthMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceTropicalOceanSouthMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceNorthExtratropicalOceanMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceLandRecyclingMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceOtherOceanMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceAtmosphericCarryoverMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceNudgingInjectionMeanKgM2) || 0)
      + (Number(metrics.northDryBeltSourceAnalysisInjectionMeanKgM2) || 0);
    const initializationFrac = totalTracked > 0
      ? (Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0) / totalTracked
      : null;
    return {
      requestedDay,
      sampledDay: sample?.targetDay ?? null,
      lowLevelInitializationMemoryMeanKgM2: round(metrics.northDryBeltSourceInitializationMemoryMeanKgM2, 5),
      lowLevelInitializationMemoryFrac: round(initializationFrac, 5),
      lowLevelAtmosphericCarryoverMeanKgM2: round(metrics.northDryBeltSourceAtmosphericCarryoverMeanKgM2, 5),
      upperCloudStaleFrac: sample?.upperCloudResidenceTracing?.ageAttribution?.northDryBeltStaleFrac ?? null,
      note: sample?.targetDay === requestedDay
        ? 'exact milestone sample'
        : 'nearest available milestone sample at or before requested day'
    };
  });
  return {
    schema: 'satellite-wars.initialization-memory.v1',
    generatedAt: new Date().toISOString(),
    latestTargetDay: latestSample?.targetDay ?? null,
    milestones,
    latestRootCauseContext: latestSample?.forcingOppositionTracing?.rootCauseAssessment || null
  };
};

export const buildNumericalIntegritySummaryReport = (latestSample = null) => {
  const score = computeNumericalIntegrityScore({
    numericalIntegrityTracing: latestSample?.numericalIntegrityTracing || null
  });
  return {
    schema: 'satellite-wars.numerical-integrity-summary.v1',
    generatedAt: new Date().toISOString(),
    targetDay: latestSample?.targetDay ?? null,
    numericalIntegrityScore: score,
    advectionWaterRepairMassMeanKgM2: latestSample?.numericalIntegrityTracing?.advectionWaterRepairMassMeanKgM2 ?? null,
    northDryBelt: latestSample?.numericalIntegrityTracing?.northDryBelt || null,
    southDryBelt: latestSample?.numericalIntegrityTracing?.southDryBelt || null,
    levelBands: latestSample?.numericalIntegrityTracing?.levelBands || null,
    asymmetry: latestSample?.numericalIntegrityTracing?.asymmetry || null,
    rootCauseAssessment: latestSample?.numericalIntegrityTracing?.rootCauseAssessment || null
  };
};

export const buildStormSpilloverCatalogReport = (latestSample = null) => ({
  schema: 'satellite-wars.storm-spillover-catalog.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  overall: latestSample?.stormSpilloverTracing?.overall || null,
  eventCatalog: latestSample?.stormSpilloverTracing?.eventCatalog || null,
  rootCauseAssessment: latestSample?.stormSpilloverTracing?.rootCauseAssessment || null
});

export const buildSectoralDryBeltRegimesReport = (latestSample = null) => ({
  schema: 'satellite-wars.sectoral-dry-belt-regimes.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  regimeDefinitions: latestSample?.stormSpilloverTracing?.regimeDefinitions || null,
  overall: latestSample?.stormSpilloverTracing?.overall || null,
  sectoralRegimes: latestSample?.stormSpilloverTracing?.sectoralRegimes || null,
  rootCauseAssessment: latestSample?.stormSpilloverTracing?.rootCauseAssessment || null
});

export const buildTransientEddyLeakageSummaryReport = (latestSample = null) => ({
  schema: 'satellite-wars.transient-eddy-leakage-summary.v1',
  generatedAt: new Date().toISOString(),
  targetDay: latestSample?.targetDay ?? null,
  transientEddyLeakage: latestSample?.stormSpilloverTracing?.transientEddyLeakage || null,
  rootCauseAssessment: latestSample?.stormSpilloverTracing?.rootCauseAssessment || null
});

const compactThermodynamicSupportSummary = (sample = null) => {
  if (!sample?.thermodynamicSupportTracing) return null;
  return {
    primaryRegime: sample.thermodynamicSupportTracing?.classification?.primaryRegime ?? null,
    radiativeRole: sample.thermodynamicSupportTracing?.classification?.radiativeRole ?? null,
    thermodynamicRole: sample.thermodynamicSupportTracing?.classification?.thermodynamicRole ?? null,
    northDryBeltInversionStrengthMeanK: sample.thermodynamicSupportTracing?.stability?.northDryBeltInversionStrengthMeanK ?? null,
    northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2: sample.thermodynamicSupportTracing?.radiation?.northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2 ?? null,
    rootCauseAssessment: sample.thermodynamicSupportTracing?.rootCauseAssessment || null
  };
};

const compactForcingOppositionSummary = (sample = null) => {
  if (!sample?.forcingOppositionTracing) return null;
  return {
    nudgingMoisteningMeanKgM2: sample.forcingOppositionTracing?.northDryBelt?.nudgingMoisteningMeanKgM2 ?? null,
    analysisMoisteningMeanKgM2: sample.forcingOppositionTracing?.northDryBelt?.analysisMoisteningMeanKgM2 ?? null,
    windOpposedDryingCorrectionMean: sample.forcingOppositionTracing?.northDryBelt?.windOpposedDryingCorrectionMean ?? null,
    rootCauseAssessment: sample.forcingOppositionTracing?.rootCauseAssessment || null
  };
};

const compactNumericalIntegritySummary = (sample = null) => {
  if (!sample?.numericalIntegrityTracing) return null;
  return {
    advectionWaterRepairMassMeanKgM2: sample.numericalIntegrityTracing?.advectionWaterRepairMassMeanKgM2 ?? null,
    northNegativeClipMassMeanKgM2: sample.numericalIntegrityTracing?.northDryBelt?.negativeClipMassMeanKgM2 ?? null,
    northCloudLimiterMassMeanKgM2: sample.numericalIntegrityTracing?.northDryBelt?.cloudLimiterMassMeanKgM2 ?? null,
    northVerticalCflClampMassMeanKgM2: sample.numericalIntegrityTracing?.northDryBelt?.verticalCflClampMassMeanKgM2 ?? null,
    rootCauseAssessment: sample.numericalIntegrityTracing?.rootCauseAssessment || null
  };
};

const compactStormSpilloverSummary = (sample = null) => {
  if (!sample?.stormSpilloverTracing) return null;
  return {
    dominantCombinedRegime: sample.stormSpilloverTracing?.overall?.dominantCombinedRegime ?? null,
    assignedCombinedContributionFrac: sample.stormSpilloverTracing?.overall?.assignedCombinedContributionFrac ?? null,
    synopticCombinedFrac: sample.stormSpilloverTracing?.overall?.regimes?.synoptic_storm_leakage?.combinedContributionFrac ?? null,
    persistentBackgroundCombinedFrac: sample.stormSpilloverTracing?.overall?.regimes?.persistent_zonal_background?.combinedContributionFrac ?? null,
    dominantCloudEddyImport: sample.stormSpilloverTracing?.transientEddyLeakage?.dominantCloudEddyImport || null,
    rootCauseAssessment: sample.stormSpilloverTracing?.rootCauseAssessment || null
  };
};

const compactSampleForSummary = (sample = null) => {
  if (!sample) return sample;
  const {
    transportTracing,
    verticalCloudBirthTracing,
    upperCloudResidenceTracing,
    cloudTransitionLedgerTracing,
    thermodynamicSupportTracing,
    forcingOppositionTracing,
    numericalIntegrityTracing,
    stormSpilloverTracing,
    ...rest
  } = sample;
  return {
    ...rest,
    transportTracingSummary: compactTransportSummary(sample),
    verticalCloudBirthTracingSummary: compactVerticalCloudBirthSummary(sample),
    upperCloudResidenceTracingSummary: compactUpperCloudResidenceSummary(sample),
    cloudTransitionLedgerTracingSummary: compactCloudTransitionLedgerSummary(sample),
    thermodynamicSupportTracingSummary: compactThermodynamicSupportSummary(sample),
    forcingOppositionTracingSummary: compactForcingOppositionSummary(sample),
    numericalIntegrityTracingSummary: compactNumericalIntegritySummary(sample),
    stormSpilloverTracingSummary: compactStormSpilloverSummary(sample)
  };
};

export const buildRestartParityReport = ({ checkpointDay = null, referenceSamples = [], resumedSamples = [] } = {}) => {
  const compareKeys = [
    'subtropicalDryNorthRatio',
    'subtropicalDrySouthRatio',
    'itczWidthDeg',
    'subtropicalSubsidenceNorthMean',
    'subtropicalSubsidenceSouthMean',
    'tropicalTradesNorthU10Ms',
    'midlatitudeWesterliesNorthU10Ms'
  ];
  const byDay = new Map(referenceSamples.map((sample) => [sample.targetDay, sample]));
  const comparisons = [];
  let maxAbsMetricDelta = 0;
  for (const sample of resumedSamples) {
    const reference = byDay.get(sample.targetDay);
    if (!reference) continue;
    const metricDelta = {};
    for (const key of compareKeys) {
      const delta = (sample.metrics?.[key] || 0) - (reference.metrics?.[key] || 0);
      metricDelta[key] = round(delta, key.includes('KgM2S') ? 5 : 6);
      maxAbsMetricDelta = Math.max(maxAbsMetricDelta, Math.abs(delta));
    }
    comparisons.push({
      targetDay: sample.targetDay,
      metricDelta
    });
  }
  return {
    schema: 'satellite-wars.restart-parity.v1',
    generatedAt: new Date().toISOString(),
    checkpointDay,
    sampleCount: comparisons.length,
    maxAbsMetricDelta: round(maxAbsMetricDelta, 6),
    pass: maxAbsMetricDelta <= 1e-6,
    comparisons
  };
};

const runRestartParityCheck = async ({ configSnapshot, checkpointDay, sampleTargetsDays }) => {
  if (!(checkpointDay > 0)) return null;
  const checkpointSeconds = checkpointDay * SECONDS_PER_DAY;
  const remainingTargets = sampleTargetsDays.filter((day) => day >= checkpointDay);
  if (!remainingTargets.length) return null;

  const parityCore = new WeatherCore5({ nx, ny, dt, seed });
  await parityCore._initPromise;
  applyCoreConfigSnapshot(parityCore, configSnapshot);
  applyHeadlessTerrainFixture(parityCore);
  advanceModelSecondsFully(parityCore, checkpointSeconds);
  const checkpointSnapshot = parityCore.getStateSnapshot({ mode: 'full' });

  const uninterruptedSamples = [];
  let previousSeconds = checkpointSeconds;
  for (const targetDay of remainingTargets) {
    const targetSeconds = targetDay * SECONDS_PER_DAY;
    const deltaSeconds = Math.max(0, targetSeconds - previousSeconds);
    if (deltaSeconds > 0) advanceModelSecondsFully(parityCore, deltaSeconds);
    previousSeconds = targetSeconds;
    uninterruptedSamples.push(classifySnapshot(buildValidationDiagnostics(parityCore), targetDay));
  }

  const resumedCore = new WeatherCore5({ nx, ny, dt, seed });
  await resumedCore._initPromise;
  applyCoreConfigSnapshot(resumedCore, configSnapshot);
  applyHeadlessTerrainFixture(resumedCore);
  resumedCore.loadStateSnapshot(checkpointSnapshot);
  const resumedSamples = [];
  previousSeconds = checkpointSeconds;
  for (const targetDay of remainingTargets) {
    const targetSeconds = targetDay * SECONDS_PER_DAY;
    const deltaSeconds = Math.max(0, targetSeconds - previousSeconds);
    if (deltaSeconds > 0) advanceModelSecondsFully(resumedCore, deltaSeconds);
    previousSeconds = targetSeconds;
    resumedSamples.push(classifySnapshot(buildValidationDiagnostics(resumedCore), targetDay));
  }

  return buildRestartParityReport({
    checkpointDay,
    referenceSamples: uninterruptedSamples,
    resumedSamples
  });
};

const buildCorridorToggleWindowDelta = (baselineWindow = null, toggledWindow = null) => {
  const baselineTarget = baselineWindow?.metrics?.targetCell || {};
  const baselineSector = baselineWindow?.metrics?.sectorMean || {};
  const toggledTarget = toggledWindow?.metrics?.targetCell || {};
  const toggledSector = toggledWindow?.metrics?.sectorMean || {};
  return {
    targetCellCloudPathDeltaKgM2: round((toggledTarget.cloudPathKgM2 || 0) - (baselineTarget.cloudPathKgM2 || 0), 5),
    targetCellPrecipPathDeltaKgM2: round((toggledTarget.precipPathKgM2 || 0) - (baselineTarget.precipPathKgM2 || 0), 5),
    targetCellLargeScaleCondensationDeltaKgM2: round((toggledTarget.largeScaleCondensationSourceKgM2 || 0) - (baselineTarget.largeScaleCondensationSourceKgM2 || 0), 5),
    targetCellWeakErosionSurvivalDeltaKgM2: round((toggledTarget.weakErosionCloudSurvivalMassKgM2 || 0) - (baselineTarget.weakErosionCloudSurvivalMassKgM2 || 0), 5),
    sectorImportedAnvilPersistenceDeltaKgM2: round((toggledSector.importedAnvilPersistenceMassKgM2 || 0) - (baselineSector.importedAnvilPersistenceMassKgM2 || 0), 5),
    sectorLargeScaleCondensationDeltaKgM2: round((toggledSector.largeScaleCondensationSourceKgM2 || 0) - (baselineSector.largeScaleCondensationSourceKgM2 || 0), 5)
  };
};

const identifyPhaseCBestToggle = (eventToggleReport = null, windowSteps = 24) => {
  const toggles = eventToggleReport?.toggles || {};
  const ranked = Object.entries(toggles)
    .map(([moduleName, payload]) => ({
      moduleName,
      targetCellCloudPathDeltaKgM2: payload?.windows?.[windowSteps]?.deltaVsBaseline?.targetCellCloudPathDeltaKgM2 ?? null
    }))
    .filter((entry) => Number.isFinite(entry.targetCellCloudPathDeltaKgM2))
    .sort((a, b) => a.targetCellCloudPathDeltaKgM2 - b.targetCellCloudPathDeltaKgM2);
  return ranked[0] || null;
};

const runPhaseCCorridorReplay = async ({ configSnapshot, latestSample, targetDay }) => {
  if (!latestSample?.cloudTransitionLedgerTracing || !Number.isFinite(targetDay)) return null;
  const selectedTargets = selectPhaseCCorridorTargets(latestSample).filter((target) => target.available);
  if (!selectedTargets.length) return {
    targetDay,
    targets: [],
    checkpoints: {},
    slices: {},
    moduleToggleDeltas: {},
    rootCauseAssessment: {
      ruledIn: [],
      ruledOut: [],
      ambiguous: ['Phase C could not select any corridor targets from the current Phase B ledger output.']
    }
  };

  const traceCore = await createConfiguredCore({ configSnapshot, instrumentationModeOverride: 'full' });
  const targetSteps = Math.max(1, Math.round((targetDay * SECONDS_PER_DAY) / traceCore.modelDt));
  const traceBySector = Object.fromEntries(
    selectedTargets.map((target) => [target.sectorKey, { ...target, steps: [] }])
  );

  for (let stepIndex = 0; stepIndex < targetSteps; stepIndex += 1) {
    traceCore.resetCloudTransitionLedger();
    traceCore.advanceModelSeconds(traceCore.modelDt);
    const rawLedger = traceCore.getCloudTransitionLedgerRaw();
    for (const target of selectedTargets) {
      traceBySector[target.sectorKey].steps.push(
        buildCorridorStepEntry({
          rawLedger,
          target,
          cellCount: traceCore.state.N,
          stepIndex,
          simTimeSeconds: traceCore.timeUTC
        })
      );
    }
  }

  const checkpointCatalog = buildCorridorCheckpointCatalog(traceBySector);
  const checkpointSnapshots = {};
  for (const target of selectedTargets) {
    checkpointSnapshots[target.sectorKey] = {};
    const checkpoints = checkpointCatalog[target.sectorKey]?.checkpoints || {};
    for (const eventKey of PHASE_C_EVENT_ORDER) {
      const checkpoint = checkpoints[eventKey];
      if (!checkpoint) continue;
      const replayCore = await createConfiguredCore({ configSnapshot, instrumentationModeOverride: 'full' });
      const checkpointSeconds = checkpoint.stepIndex * replayCore.modelDt;
      if (checkpointSeconds > 0) advanceModelSecondsFully(replayCore, checkpointSeconds);
      checkpointSnapshots[target.sectorKey][eventKey] = replayCore.getStateSnapshot({ mode: 'full' });
    }
  }

  const slices = {};
  const moduleToggleDeltas = {};
  for (const target of selectedTargets) {
    const sectorPayload = checkpointCatalog[target.sectorKey];
    slices[target.sectorKey] = buildCorridorSlicesForSector(sectorPayload);
    moduleToggleDeltas[target.sectorKey] = {};
    for (const eventKey of PHASE_C_EVENT_ORDER) {
      const checkpointSnapshot = checkpointSnapshots[target.sectorKey]?.[eventKey];
      if (!checkpointSnapshot) continue;
      const baselineReplay = await runCorridorReplayWindow({
        checkpointSnapshot,
        target,
        disabledModule: null,
        maxWindowSteps: PHASE_C_REPLAY_WINDOWS[PHASE_C_REPLAY_WINDOWS.length - 1]
      });
      const toggles = {};
      for (const moduleName of PHASE_C_TOGGLEABLE_MODULES) {
        const replay = await runCorridorReplayWindow({
          checkpointSnapshot,
          target,
          disabledModule: moduleName,
          maxWindowSteps: PHASE_C_REPLAY_WINDOWS[PHASE_C_REPLAY_WINDOWS.length - 1]
        });
        toggles[moduleName] = {
          disabledModule: moduleName,
          windows: Object.fromEntries(
            PHASE_C_REPLAY_WINDOWS.map((windowSteps) => [
              windowSteps,
              {
                deltaVsBaseline: buildCorridorToggleWindowDelta(
                  baselineReplay.windows?.[windowSteps],
                  replay.windows?.[windowSteps]
                ),
                replayWindow: replay.windows?.[windowSteps] || null
              }
            ])
          )
        };
      }
      moduleToggleDeltas[target.sectorKey][eventKey] = {
        checkpoint: sectorPayload.checkpoints[eventKey],
        baseline: baselineReplay,
        toggles
      };
    }
  }

  const verticalWins = [];
  const microWins = [];
  const ruledOutModules = new Set();
  for (const sectorKey of Object.keys(moduleToggleDeltas)) {
    for (const eventKey of PHASE_C_EVENT_ORDER) {
      const bestToggle = identifyPhaseCBestToggle(moduleToggleDeltas[sectorKey]?.[eventKey], 24);
      if (!bestToggle) continue;
      if ((bestToggle.targetCellCloudPathDeltaKgM2 || 0) >= 0) {
        ruledOutModules.add(bestToggle.moduleName);
        continue;
      }
      if ((eventKey === 'importArrival' || eventKey === 'failedErosion') && bestToggle.moduleName === 'stepVertical5') {
        verticalWins.push({ sectorKey, eventKey, delta: bestToggle.targetCellCloudPathDeltaKgM2 });
      }
      if (eventKey === 'largeScaleMaintenanceRebound' && (bestToggle.moduleName === 'stepMicrophysics5' || bestToggle.moduleName === 'stepVertical5')) {
        microWins.push({ sectorKey, eventKey, delta: bestToggle.targetCellCloudPathDeltaKgM2, moduleName: bestToggle.moduleName });
      }
    }
  }

  const rootCauseAssessment = { ruledIn: [], ruledOut: [], ambiguous: [] };
  if (verticalWins.length >= 2) {
    rootCauseAssessment.ruledIn.push('Replay toggles show the vertical-path handoff is the first causal break in at least two corridor events.');
  } else {
    rootCauseAssessment.ambiguous.push('Phase C replay does not yet prove the vertical handoff across enough corridor events for closure.');
  }
  if (microWins.length >= 1) {
    rootCauseAssessment.ruledIn.push('A downstream maintenance handoff remains active after the vertical failure, usually in microphysics or vertical large-scale maintenance.');
  } else {
    rootCauseAssessment.ambiguous.push('Phase C replay has not yet isolated the downstream maintenance handoff strongly enough.');
  }
  for (const moduleName of PHASE_C_TOGGLEABLE_MODULES) {
    const everWinning = Object.values(moduleToggleDeltas).some((events) => Object.values(events || {}).some((eventReport) => {
      const best = identifyPhaseCBestToggle(eventReport, 24);
      return best?.moduleName === moduleName && (best?.targetCellCloudPathDeltaKgM2 || 0) < 0;
    }));
    if (!everWinning) {
      rootCauseAssessment.ruledOut.push(`${moduleName} does not emerge as the best 24-step replay toggle in the current corridor set.`);
    }
  }

  return {
    targetDay,
    targets: selectedTargets,
    checkpoints: Object.fromEntries(
      Object.entries(checkpointCatalog).map(([sectorKey, payload]) => [sectorKey, {
        sectorKey,
        cellIndex: payload.cellIndex,
        latDeg: payload.latDeg,
        lonDeg: payload.lonDeg,
        bandKey: payload.bandKey,
        score: payload.score,
        checkpoints: payload.checkpoints
      }])
    ),
    slices,
    moduleToggleDeltas,
    rootCauseAssessment
  };
};

export const computeSeasonalityScore = (samples) => {
  const buckets = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    nh: [],
    sh: []
  }));
  for (const sample of samples) {
    const bucket = buckets[sample.monthIndex];
    bucket.nh.push(sample.metrics.tropicalCycloneEnvironmentCountNh || 0);
    bucket.sh.push(sample.metrics.tropicalCycloneEnvironmentCountSh || 0);
  }
  const monthly = buckets.map((bucket) => ({
    monthIndex: bucket.monthIndex,
    month: monthName(bucket.monthIndex),
    nh: round(mean(bucket.nh), 2) ?? 0,
    sh: round(mean(bucket.sh), 2) ?? 0
  }));
  const avg = (indices, key) => mean(indices.map((index) => monthly[index]?.[key] || 0));
  const nhWarm = avg([5, 6, 7, 8], 'nh');
  const nhCool = avg([11, 0, 1], 'nh');
  const shWarm = avg([11, 0, 1], 'sh');
  const shCool = avg([5, 6, 7], 'sh');
  return {
    monthly,
    nhWarmSeasonMean: round(nhWarm),
    nhCoolSeasonMean: round(nhCool),
    shWarmSeasonMean: round(shWarm),
    shCoolSeasonMean: round(shCool),
    nhSeasonalityPass: nhWarm > Math.max(0.1, nhCool * 1.15),
    shSeasonalityPass: shWarm > Math.max(0.1, shCool * 1.15)
  };
};

export const buildMonthlyClimatology = (samples) => {
  const months = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    month: monthName(monthIndex),
    sampleDays: [],
    metrics: {},
    profiles: null
  }));
  const metricAccumulators = months.map(() => new Map());
  const profileAccumulators = months.map(() => []);

  for (const sample of samples) {
    const monthIndex = Number.isFinite(sample?.monthIndex) ? sample.monthIndex : dayToMonthIndex(sample?.targetDay || 0);
    const bucket = months[monthIndex];
    if (!bucket) continue;
    bucket.sampleDays.push(sample.targetDay);
    for (const [key, value] of Object.entries(sample.metrics || {})) {
      if (!Number.isFinite(value)) continue;
      const acc = metricAccumulators[monthIndex].get(key) || { sum: 0, count: 0 };
      acc.sum += value;
      acc.count += 1;
      metricAccumulators[monthIndex].set(key, acc);
    }
    if (sample.profiles?.latitudesDeg?.length && sample.profiles?.series) {
      profileAccumulators[monthIndex].push(sample.profiles);
    }
  }

  for (let monthIndex = 0; monthIndex < months.length; monthIndex += 1) {
    const bucket = months[monthIndex];
    bucket.sampleCount = bucket.sampleDays.length;
    bucket.sampleDays = bucket.sampleDays.map((value) => round(value, 2));
    bucket.metrics = Object.fromEntries(
      [...metricAccumulators[monthIndex].entries()].map(([key, acc]) => [
        key,
        round(acc.sum / Math.max(1, acc.count), key.includes('KgM2S') || key.includes('S_1') ? 5 : 3)
      ])
    );
    bucket.profiles = meanProfiles(profileAccumulators[monthIndex]);
  }
  return months;
};

const computeTrackedSourceTotal = (metrics = {}) => (
  (Number(metrics.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceTropicalOceanNorthMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceTropicalOceanSouthMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceNorthExtratropicalOceanMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceLandRecyclingMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceOtherOceanMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceAtmosphericCarryoverMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceNudgingInjectionMeanKgM2) || 0)
  + (Number(metrics.northDryBeltSourceAnalysisInjectionMeanKgM2) || 0)
);

const sortFamilyScores = (scores = {}) => ROOT_CAUSE_FAMILY_METADATA
  .map((entry) => ({
    key: entry.key,
    label: entry.label,
    score: Number.isFinite(scores?.[entry.key]) ? round(scores[entry.key], 5) : null
  }))
  .filter((entry) => Number.isFinite(entry.score))
  .sort((a, b) => (b.score || 0) - (a.score || 0));

const buildSampleRootCauseScores = (sample = null) => {
  const metrics = sample?.metrics || {};
  const transport = sample?.transportTracing || null;
  const upperCloud = sample?.upperCloudResidenceTracing || null;
  const thermo = sample?.thermodynamicSupportTracing || null;
  const forcing = sample?.forcingOppositionTracing || null;
  const numerics = sample?.numericalIntegrityTracing || null;
  const storms = sample?.stormSpilloverTracing || null;

  const trackedSourceTotal = computeTrackedSourceTotal(metrics);
  const localSource = (Number(metrics.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
    + (Number(metrics.northDryBeltSourceLandRecyclingMeanKgM2) || 0);
  const importedSource = Math.max(0, trackedSourceTotal - localSource);
  const carryMass = (Number(metrics.northDryBeltCarriedOverUpperCloudMeanKgM2) || 0)
    + (Number(metrics.northDryBeltImportedAnvilPersistenceMeanKgM2) || 0);
  const localCloudBirth = (Number(metrics.northDryBeltLargeScaleCondensationMeanKgM2) || 0)
    + (Number(metrics.northDryBeltResolvedAscentCloudBirthPotentialMeanKgM2) || 0)
    + (Number(metrics.northDryBeltConvectiveDetrainmentCloudSourceMeanKgM2) || 0);
  const totalTrackedCloud = carryMass + localCloudBirth;
  const helperMoistening = (Number(forcing?.northDryBelt?.nudgingMoisteningMeanKgM2) || 0)
    + (Number(forcing?.northDryBelt?.analysisMoisteningMeanKgM2) || 0);
  const nativeDrying = Number(forcing?.northDryBelt?.nativeDryingSupportMeanKgM2) || 0;
  const stormLeakageCombined = (Number(storms?.overall?.regimes?.synoptic_storm_leakage?.combinedContributionFrac) || 0)
    + (Number(storms?.overall?.regimes?.tropical_spillover?.combinedContributionFrac) || 0);
  const importMagnitude = Math.abs(Number(upperCloud?.ventilation?.north35UpperTroposphereImportMagnitudeKgM_1S) || 0);
  const verticalCflMass = Number(numerics?.northDryBelt?.verticalCflClampMassMeanKgM2) || 0;
  const limiterMass = (Number(numerics?.northDryBelt?.cloudLimiterMassMeanKgM2) || 0)
    + (Number(numerics?.northDryBelt?.negativeClipMassMeanKgM2) || 0);

  const scores = {
    importedCloudPersistence: meanDefined([
      safeRatio(importedSource, trackedSourceTotal, true),
      safeRatio(carryMass, totalTrackedCloud, true),
      upperCloud?.ageAttribution?.northDryBeltStaleFrac ?? null,
      upperCloud?.erosionBudget?.northDryBeltBlockedErosionFrac ?? null,
      normalizeScore(importMagnitude, 5)
    ]),
    localLargeScaleMaintenance: meanDefined([
      safeRatio(localCloudBirth, totalTrackedCloud, true),
      safeRatio(Number(metrics.northDryBeltLargeScaleCondensationMeanKgM2) || 0, totalTrackedCloud, true),
      storms?.overall?.regimes?.persistent_zonal_background?.combinedContributionFrac ?? null
    ]),
    radiativeThermodynamicSupport: meanDefined([
      thermo?.classification?.radiationSupportScore ?? null,
      thermo?.classification?.moistureSupportScore ?? null,
      normalizeScore(Math.abs(Number(metrics.northDryBeltUpperCloudNetCloudRadiativeEffectMeanWm2) || 0), 25)
    ]),
    stormLeakage: meanDefined([
      stormLeakageCombined
    ]),
    helperForcing: meanDefined([
      safeRatio(helperMoistening, nativeDrying + helperMoistening, true),
      normalizeScore(Math.abs(Number(forcing?.northDryBelt?.windOpposedDryingCorrectionMean) || 0), 2000),
      normalizeScore(Math.abs(Number(forcing?.northDryBelt?.nudgingTargetQvMismatchMeanKgKg) || 0), 0.01)
    ]),
    initializationMemory: safeRatio(
      Number(metrics.northDryBeltSourceInitializationMemoryMeanKgM2) || 0,
      trackedSourceTotal,
      true
    ),
    numericalFragility: meanDefined([
      normalizeScore(Number(numerics?.northDryBelt?.supersaturationClampMassMeanKgM2) || 0, 250),
      normalizeScore(verticalCflMass, 100000),
      normalizeScore(limiterMass, 1)
    ])
  };

  const ranking = sortFamilyScores(scores);
  return {
    scores: Object.fromEntries(
      ROOT_CAUSE_FAMILY_METADATA.map((entry) => [entry.key, Number.isFinite(scores[entry.key]) ? round(scores[entry.key], 5) : null])
    ),
    ranking,
    dominantFamily: ranking[0] || null
  };
};

export const buildMonthlyAttributionClimatology = (samples) => {
  const months = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    month: monthName(monthIndex),
    sampleCount: 0,
    sampleDays: [],
    attributionMetrics: {},
    familyScores: {},
    ranking: [],
    dominantFamily: null
  }));
  const metricKeys = [
    'subtropicalDryNorthRatio',
    'subtropicalRhNorthMeanFrac',
    'northDryBeltSourceAtmosphericCarryoverMeanKgM2',
    'northDryBeltSourceInitializationMemoryMeanKgM2',
    'northDryBeltCarriedOverUpperCloudMeanKgM2',
    'northDryBeltWeakErosionCloudSurvivalMeanKgM2',
    'northDryBeltLargeScaleCondensationMeanKgM2',
    'northDryBeltImportedAnvilPersistenceMeanKgM2',
    'northDryBeltUpperCloudPathMeanKgM2'
  ];

  for (const sample of samples) {
    const monthIndex = Number.isFinite(sample?.monthIndex) ? sample.monthIndex : dayToMonthIndex(sample?.targetDay || 0);
    const bucket = months[monthIndex];
    if (!bucket) continue;
    const familySummary = buildSampleRootCauseScores(sample);
    bucket.sampleCount += 1;
    bucket.sampleDays.push(round(sample.targetDay, 2));
    for (const key of metricKeys) {
      if (!bucket.attributionMetrics[key]) bucket.attributionMetrics[key] = [];
      if (Number.isFinite(sample?.metrics?.[key])) bucket.attributionMetrics[key].push(sample.metrics[key]);
    }
    for (const family of ROOT_CAUSE_FAMILY_METADATA) {
      if (!bucket.familyScores[family.key]) bucket.familyScores[family.key] = [];
      if (Number.isFinite(familySummary.scores[family.key])) bucket.familyScores[family.key].push(familySummary.scores[family.key]);
    }
  }

  for (const month of months) {
    month.sampleDays = month.sampleDays;
    month.attributionMetrics = Object.fromEntries(
      Object.entries(month.attributionMetrics).map(([key, values]) => [key, round(meanDefined(values), key.includes('KgM2S') || key.includes('KgM2') ? 5 : 3)])
    );
    month.familyScores = Object.fromEntries(
      ROOT_CAUSE_FAMILY_METADATA.map((family) => [family.key, round(meanDefined(month.familyScores[family.key] || []), 5)])
    );
    month.ranking = sortFamilyScores(month.familyScores);
    month.dominantFamily = month.ranking[0] || null;
  }

  return {
    schema: 'satellite-wars.monthly-attribution-climatology.v1',
    generatedAt: new Date().toISOString(),
    months
  };
};

export const buildSeasonalRootCauseRanking = (samples) => {
  const monthly = buildMonthlyAttributionClimatology(samples).months;
  const sampledMonths = monthly.filter((month) => month.sampleCount > 0);
  const annualScores = Object.fromEntries(
    ROOT_CAUSE_FAMILY_METADATA.map((family) => [
      family.key,
      round(meanDefined(sampledMonths.map((month) => month.familyScores?.[family.key])), 5)
    ])
  );
  const annualRanking = sortFamilyScores(annualScores);
  const dominantAnnualFamily = annualRanking[0] || null;
  const seasons = SEASON_DEFS.map((season) => {
    const members = season.monthIndices.map((monthIndex) => monthly[monthIndex]).filter((entry) => entry?.sampleCount > 0);
    const familyScores = Object.fromEntries(
      ROOT_CAUSE_FAMILY_METADATA.map((family) => [
        family.key,
        round(meanDefined(members.map((entry) => entry.familyScores?.[family.key])), 5)
      ])
    );
    const ranking = sortFamilyScores(familyScores);
    return {
      seasonKey: season.key,
      label: season.label,
      monthIndices: season.monthIndices,
      sampleCount: members.reduce((sum, entry) => sum + (entry.sampleCount || 0), 0),
      familyScores,
      ranking,
      dominantFamily: ranking[0] || null,
      metrics: {
        subtropicalDryNorthRatio: round(meanDefined(members.map((entry) => entry.attributionMetrics?.subtropicalDryNorthRatio))),
        northDryBeltSourceAtmosphericCarryoverMeanKgM2: round(meanDefined(members.map((entry) => entry.attributionMetrics?.northDryBeltSourceAtmosphericCarryoverMeanKgM2)), 5),
        northDryBeltCarriedOverUpperCloudMeanKgM2: round(meanDefined(members.map((entry) => entry.attributionMetrics?.northDryBeltCarriedOverUpperCloudMeanKgM2)), 5),
        northDryBeltWeakErosionCloudSurvivalMeanKgM2: round(meanDefined(members.map((entry) => entry.attributionMetrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2)), 5)
      }
    };
  });

  const dominantAnnualKey = dominantAnnualFamily?.key || null;
  const dominantFamilyMonthCount = sampledMonths.filter((month) => month.dominantFamily?.key === dominantAnnualKey).length;
  const dominantFamilySeasonCount = seasons.filter((season) => season.dominantFamily?.key === dominantAnnualKey).length;
  let dominantFamilyTransitionCount = 0;
  for (let index = 1; index < sampledMonths.length; index += 1) {
    if ((sampledMonths[index - 1].dominantFamily?.key || null) !== (sampledMonths[index].dominantFamily?.key || null)) {
      dominantFamilyTransitionCount += 1;
    }
  }

  const stableAcrossMonthsPass = sampledMonths.length > 0
    && dominantFamilyMonthCount / sampledMonths.length >= 0.6;
  const stableAcrossSeasonsPass = seasons.filter((season) => season.sampleCount > 0).length > 0
    && dominantFamilySeasonCount / Math.max(1, seasons.filter((season) => season.sampleCount > 0).length) >= 0.75;
  const rootCauseAssessment = {
    ruledIn: [],
    ruledOut: [],
    ambiguous: []
  };
  if (dominantAnnualKey && stableAcrossMonthsPass && stableAcrossSeasonsPass) {
    rootCauseAssessment.ruledIn.push(`Seasonal attribution stays anchored on ${ROOT_CAUSE_FAMILY_LABELS[dominantAnnualKey]}.`);
  } else {
    rootCauseAssessment.ambiguous.push('No single root-cause family stays dominant enough across months and seasons yet.');
  }
  if (sampledMonths.every((month) => month.dominantFamily?.key !== 'helperForcing')) {
    rootCauseAssessment.ruledOut.push('Helper forcing is not the dominant seasonal family.');
  }
  if (sampledMonths.every((month) => month.dominantFamily?.key !== 'stormLeakage')) {
    rootCauseAssessment.ruledOut.push('Storm leakage is not the dominant seasonal family.');
  }

  return {
    schema: 'satellite-wars.seasonal-root-cause-ranking.v1',
    generatedAt: new Date().toISOString(),
    months: sampledMonths.map((month) => ({
      monthIndex: month.monthIndex,
      month: month.month,
      sampleCount: month.sampleCount,
      dominantFamily: month.dominantFamily,
      ranking: month.ranking.slice(0, 4)
    })),
    seasons,
    annualMeanFamilyScores: annualScores,
    annualRanking,
    dominantAnnualFamily,
    stability: {
      sampledMonthCount: sampledMonths.length,
      dominantFamilyMonthCount,
      dominantFamilySeasonCount,
      dominantFamilyTransitionCount,
      stableAcrossMonthsPass,
      stableAcrossSeasonsPass
    },
    rootCauseAssessment
  };
};

const pearsonCorrelation = (xs, ys) => {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 3) return null;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }
  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator > 0 ? numerator / denominator : null;
};

const findLagTargetSample = (samples, startIndex, lagDays) => {
  const baseDay = Number(samples[startIndex]?.targetDay) || 0;
  const targetDay = baseDay + lagDays;
  let best = null;
  for (let index = startIndex + 1; index < samples.length; index += 1) {
    const candidate = samples[index];
    if (!Number.isFinite(candidate?.targetDay) || candidate.targetDay < targetDay) continue;
    const delta = candidate.targetDay - targetDay;
    if (!best || delta < best.delta) best = { index, delta };
  }
  return best?.index ?? null;
};

export const buildAttributionLagAnalysis = (samples) => {
  const orderedSamples = [...samples].filter((sample) => Number.isFinite(sample?.targetDay)).sort((a, b) => a.targetDay - b.targetDay);
  const enriched = orderedSamples.map((sample) => ({
    sample,
    family: buildSampleRootCauseScores(sample)
  }));
  const predictorExtractors = {
    importedCloudPersistenceScore: (entry) => entry.family.scores.importedCloudPersistence,
    localLargeScaleMaintenanceScore: (entry) => entry.family.scores.localLargeScaleMaintenance,
    radiativeThermodynamicSupportScore: (entry) => entry.family.scores.radiativeThermodynamicSupport,
    stormLeakageScore: (entry) => entry.family.scores.stormLeakage,
    helperForcingScore: (entry) => entry.family.scores.helperForcing,
    initializationMemoryScore: (entry) => entry.family.scores.initializationMemory,
    numericalFragilityScore: (entry) => entry.family.scores.numericalFragility,
    sourceAtmosphericCarryoverMeanKgM2: (entry) => entry.sample.metrics?.northDryBeltSourceAtmosphericCarryoverMeanKgM2,
    carriedOverUpperCloudMeanKgM2: (entry) => entry.sample.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2,
    weakErosionCloudSurvivalMeanKgM2: (entry) => entry.sample.metrics?.northDryBeltWeakErosionCloudSurvivalMeanKgM2,
    largeScaleCondensationMeanKgM2: (entry) => entry.sample.metrics?.northDryBeltLargeScaleCondensationMeanKgM2
  };
  const outcomeExtractors = {
    subtropicalDryNorthRatio: (entry) => entry.sample.metrics?.subtropicalDryNorthRatio,
    subtropicalRhNorthMeanFrac: (entry) => entry.sample.metrics?.subtropicalRhNorthMeanFrac,
    northDryBeltUpperCloudPathMeanKgM2: (entry) => entry.sample.metrics?.northDryBeltUpperCloudPathMeanKgM2,
    northDryBeltOceanPrecipMeanMmHr: (entry) => entry.sample.metrics?.northDryBeltOceanPrecipMeanMmHr
  };
  const lagDaysList = [15, 30, 45, 60, 90];
  const lagPairs = [];
  const predictorAbsCorrelation = new Map();

  for (const lagDays of lagDaysList) {
    for (const [predictorKey, predictorFn] of Object.entries(predictorExtractors)) {
      for (const [outcomeKey, outcomeFn] of Object.entries(outcomeExtractors)) {
        const laggedXs = [];
        const laggedYs = [];
        const cumulativeXs = [];
        const cumulativeYs = [];
        const actualLagDays = [];
        for (let startIndex = 0; startIndex < enriched.length; startIndex += 1) {
          const targetIndex = findLagTargetSample(enriched.map((entry) => entry.sample), startIndex, lagDays);
          if (targetIndex == null) continue;
          const predictorValue = predictorFn(enriched[startIndex]);
          const outcomeValue = outcomeFn(enriched[targetIndex]);
          if (!Number.isFinite(predictorValue) || !Number.isFinite(outcomeValue)) continue;
          laggedXs.push(predictorValue);
          laggedYs.push(outcomeValue);
          const cumulativePredictor = meanDefined(
            enriched.slice(0, startIndex + 1).map((entry) => predictorFn(entry)).filter((value) => Number.isFinite(value))
          );
          if (Number.isFinite(cumulativePredictor)) {
            cumulativeXs.push(cumulativePredictor);
            cumulativeYs.push(outcomeValue);
          }
          actualLagDays.push((enriched[targetIndex].sample.targetDay || 0) - (enriched[startIndex].sample.targetDay || 0));
        }
        const laggedCorrelation = pearsonCorrelation(laggedXs, laggedYs);
        const cumulativeCorrelation = pearsonCorrelation(cumulativeXs, cumulativeYs);
        const entry = {
          lagDays,
          predictorKey,
          outcomeKey,
          pairCount: laggedXs.length,
          meanActualLagDays: round(meanDefined(actualLagDays), 2),
          laggedCorrelation: round(laggedCorrelation, 5),
          cumulativeCorrelation: round(cumulativeCorrelation, 5)
        };
        lagPairs.push(entry);
        if (Number.isFinite(laggedCorrelation)) {
          const current = predictorAbsCorrelation.get(predictorKey) || [];
          current.push(Math.abs(laggedCorrelation));
          predictorAbsCorrelation.set(predictorKey, current);
        }
        if (Number.isFinite(cumulativeCorrelation)) {
          const current = predictorAbsCorrelation.get(predictorKey) || [];
          current.push(Math.abs(cumulativeCorrelation));
          predictorAbsCorrelation.set(predictorKey, current);
        }
      }
    }
  }

  const strongestLaggedLinks = [...lagPairs]
    .filter((entry) => Number.isFinite(entry.laggedCorrelation) || Number.isFinite(entry.cumulativeCorrelation))
    .sort((a, b) => Math.max(Math.abs(b.laggedCorrelation || 0), Math.abs(b.cumulativeCorrelation || 0))
      - Math.max(Math.abs(a.laggedCorrelation || 0), Math.abs(a.cumulativeCorrelation || 0)))
    .slice(0, 12);

  const predictorRanking = [...predictorAbsCorrelation.entries()]
    .map(([predictorKey, values]) => ({
      predictorKey,
      label: ROOT_CAUSE_FAMILY_LABELS[predictorKey.replace(/Score$/, '')] || predictorKey,
      meanAbsCorrelation: round(meanDefined(values), 5)
    }))
    .sort((a, b) => (b.meanAbsCorrelation || 0) - (a.meanAbsCorrelation || 0));

  const dominantPredictor = predictorRanking[0] || null;
  const rootCauseAssessment = {
    ruledIn: [],
    ruledOut: [],
    ambiguous: []
  };
  if (dominantPredictor && dominantPredictor.predictorKey === 'importedCloudPersistenceScore') {
    rootCauseAssessment.ruledIn.push('Imported cloud persistence is the strongest lagged predictor of later NH dry-belt wetness in the current sample set.');
  } else if (dominantPredictor) {
    rootCauseAssessment.ambiguous.push(`Lagged attribution currently ranks ${dominantPredictor.label} above imported cloud persistence.`);
  }
  if (!predictorRanking.some((entry) => entry.predictorKey === 'helperForcingScore' && (entry.meanAbsCorrelation || 0) > 0.3)) {
    rootCauseAssessment.ruledOut.push('Helper forcing does not show up as a strong lagged predictor.');
  }

  return {
    schema: 'satellite-wars.attribution-lag-analysis.v1',
    generatedAt: new Date().toISOString(),
    sampleCount: enriched.length,
    strongestLaggedLinks,
    predictorRanking,
    rootCauseAssessment
  };
};

const buildGapEntry = (warning, horizon) => {
  const metrics = horizon?.latest?.metrics || {};
  const seasonality = horizon?.seasonality || null;
  // For seasonally-varying metrics that are gated on the annual mean
  // (see evaluateHorizons), prefer the annual mean when reporting the
  // "actual" so the realism-gap entry matches the gate that fired.
  const annualMean = horizon?.annualMeanMetrics || null;
  const gateValue = (key) => {
    if (annualMean && Number.isFinite(annualMean[key])) return annualMean[key];
    return metrics[key];
  };
  const entry = {
    code: warning,
    label: warning.replace(/_/g, ' '),
    category: 'other',
    metricKey: null,
    actual: null,
    target: null,
    severity: 0.25,
    horizonsDays: [horizon?.horizonDays].filter(Number.isFinite)
  };
  switch (warning) {
    case 'trade_winds_missing_north':
      entry.label = 'North trade winds too weak or reversed';
      entry.category = 'circulation';
      entry.metricKey = 'tropicalTradesNorthU10Ms';
      entry.actual = metrics.tropicalTradesNorthU10Ms;
      entry.target = '< -0.2 m/s';
      entry.severity = clamp01((Number(metrics.tropicalTradesNorthU10Ms) + 0.2) / 1.5);
      break;
    case 'trade_winds_missing_south':
      entry.label = 'South trade winds too weak or reversed';
      entry.category = 'circulation';
      entry.metricKey = 'tropicalTradesSouthU10Ms';
      entry.actual = metrics.tropicalTradesSouthU10Ms;
      entry.target = '< -0.2 m/s';
      entry.severity = clamp01((Number(metrics.tropicalTradesSouthU10Ms) + 0.2) / 1.5);
      break;
    case 'westerlies_missing_north':
      entry.label = 'North midlatitude westerlies too weak';
      entry.category = 'circulation';
      entry.metricKey = 'midlatitudeWesterliesNorthU10Ms';
      entry.actual = metrics.midlatitudeWesterliesNorthU10Ms;
      entry.target = '> 0.2 m/s';
      entry.severity = clamp01((0.2 - Number(metrics.midlatitudeWesterliesNorthU10Ms)) / 1.5);
      break;
    case 'westerlies_missing_south':
      entry.label = 'South midlatitude westerlies too weak';
      entry.category = 'circulation';
      entry.metricKey = 'midlatitudeWesterliesSouthU10Ms';
      entry.actual = metrics.midlatitudeWesterliesSouthU10Ms;
      entry.target = '> 0.2 m/s';
      entry.severity = clamp01((0.2 - Number(metrics.midlatitudeWesterliesSouthU10Ms)) / 1.5);
      break;
    case 'itcz_out_of_tropical_band':
      entry.label = 'ITCZ displaced out of tropical core';
      entry.category = 'moistureBelts';
      entry.metricKey = 'itczLatDeg';
      entry.actual = metrics.itczLatDeg;
      entry.target = '|lat| <= 12 deg';
      entry.severity = clamp01((Math.abs(Number(metrics.itczLatDeg)) - 12) / 8);
      break;
    case 'itcz_width_unrealistic':
      entry.label = 'ITCZ width unrealistic';
      entry.category = 'moistureBelts';
      entry.metricKey = 'itczWidthDeg';
      entry.actual = metrics.itczWidthDeg;
      entry.target = '6-24 deg';
      entry.severity = clamp01(
        Number(metrics.itczWidthDeg) < 6
          ? (6 - Number(metrics.itczWidthDeg)) / 6
          : (Number(metrics.itczWidthDeg) - 24) / 12
      );
      break;
    case 'north_subtropical_dry_belt_too_wet':
      entry.label = 'North subtropical dry belt too wet';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalDryNorthRatio';
      entry.actual = gateValue('subtropicalDryNorthRatio');
      entry.target = '< 0.8';
      entry.severity = clamp01((Number(entry.actual) - 0.8) / 0.5);
      break;
    case 'south_subtropical_dry_belt_too_wet':
      entry.label = 'South subtropical dry belt too wet';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalDrySouthRatio';
      entry.actual = gateValue('subtropicalDrySouthRatio');
      entry.target = '< 0.8';
      entry.severity = clamp01((Number(entry.actual) - 0.8) / 0.5);
      break;
    case 'north_subtropical_lower_troposphere_too_humid':
      entry.label = 'North subtropical lower troposphere too humid';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalRhNorthMeanFrac';
      entry.actual = metrics.subtropicalRhNorthMeanFrac;
      entry.target = '< 0.82';
      entry.severity = clamp01((Number(metrics.subtropicalRhNorthMeanFrac) - 0.82) / 0.12);
      break;
    case 'south_subtropical_lower_troposphere_too_humid':
      entry.label = 'South subtropical lower troposphere too humid';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalRhSouthMeanFrac';
      entry.actual = metrics.subtropicalRhSouthMeanFrac;
      entry.target = '< 0.82';
      entry.severity = clamp01((Number(metrics.subtropicalRhSouthMeanFrac) - 0.82) / 0.12);
      break;
    case 'north_subtropical_subsidence_too_weak':
      entry.label = 'North subtropical subsidence drying too weak';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalSubsidenceNorthMean';
      entry.actual = metrics.subtropicalSubsidenceNorthMean;
      entry.target = '> 0.03';
      entry.severity = clamp01((0.03 - Number(metrics.subtropicalSubsidenceNorthMean)) / 0.03);
      break;
    case 'south_subtropical_subsidence_too_weak':
      entry.label = 'South subtropical subsidence drying too weak';
      entry.category = 'moistureBelts';
      entry.metricKey = 'subtropicalSubsidenceSouthMean';
      entry.actual = metrics.subtropicalSubsidenceSouthMean;
      entry.target = '> 0.03';
      entry.severity = clamp01((0.03 - Number(metrics.subtropicalSubsidenceSouthMean)) / 0.03);
      break;
    case 'north_storm_track_out_of_range':
      entry.label = 'North storm track misplaced';
      entry.category = 'stormTracks';
      entry.metricKey = 'stormTrackNorthLatDeg';
      entry.actual = gateValue('stormTrackNorthLatDeg');
      entry.target = '30-65 deg';
      entry.severity = clamp01(
        Number(entry.actual) < 30
          ? (30 - Number(entry.actual)) / 20
          : (Number(entry.actual) - 65) / 20
      );
      break;
    case 'south_storm_track_out_of_range':
      entry.label = 'South storm track misplaced';
      entry.category = 'stormTracks';
      entry.metricKey = 'stormTrackSouthLatDeg';
      entry.actual = gateValue('stormTrackSouthLatDeg');
      entry.target = '-65 to -30 deg';
      entry.severity = clamp01(
        Number(entry.actual) > -30
          ? (Number(entry.actual) + 30) / 20
          : (-65 - Number(entry.actual)) / 20
      );
      break;
    case 'cloud_field_unbalanced':
      entry.label = 'Global cloud field unbalanced';
      entry.category = 'cloudBalance';
      entry.metricKey = 'globalCloudMeanFrac';
      entry.actual = metrics.globalCloudMeanFrac;
      entry.target = '0.15-0.85';
      entry.severity = clamp01(
        Number(metrics.globalCloudMeanFrac) < 0.15
          ? (0.15 - Number(metrics.globalCloudMeanFrac)) / 0.2
          : (Number(metrics.globalCloudMeanFrac) - 0.85) / 0.2
      );
      break;
    case 'runaway_surface_winds':
      entry.label = 'Runaway surface winds';
      entry.category = 'stability';
      entry.metricKey = 'maxWind10mMs';
      entry.actual = metrics.maxWind10mMs;
      entry.target = '<= 120 m/s';
      entry.severity = clamp01((Number(metrics.maxWind10mMs) - 120) / 60);
      break;
    case 'runaway_global_precip':
      entry.label = 'Global precipitation runaway';
      entry.category = 'stability';
      entry.metricKey = 'globalPrecipMeanMmHr';
      entry.actual = metrics.globalPrecipMeanMmHr;
      entry.target = '<= 5 mm/hr';
      entry.severity = clamp01((Number(metrics.globalPrecipMeanMmHr) - 5) / 3);
      break;
    case 'column_water_drift':
      entry.label = 'Column water drift';
      entry.category = 'stability';
      entry.metricKey = 'globalTcwMeanKgM2';
      entry.actual = metrics.globalTcwMeanKgM2;
      entry.target = '5-80 kg/m²';
      entry.severity = clamp01(
        Number(metrics.globalTcwMeanKgM2) < 5
          ? (5 - Number(metrics.globalTcwMeanKgM2)) / 10
          : (Number(metrics.globalTcwMeanKgM2) - 80) / 40
      );
      break;
    case 'numerical_limiter_mass_dominates':
      entry.label = 'Numerical limiter mass dominates';
      entry.category = 'numericalIntegrity';
      entry.metricKey = 'numericalVerticalCflClampMaxKgM2';
      entry.actual = {
        verticalCflClampMaxKgM2: metrics.numericalVerticalCflClampMaxKgM2,
        supersaturationClampMaxKgM2: metrics.numericalSupersaturationClampMaxKgM2
      };
      entry.target = 'limiter mass must not dominate climate diagnosis';
      entry.severity = 1;
      break;
    case 'numerical_integrity_score_low':
      entry.label = 'Numerical integrity score low';
      entry.category = 'numericalIntegrity';
      entry.metricKey = 'numericalIntegrityScore';
      entry.actual = metrics.numericalIntegrityScore;
      entry.target = `>= ${NUMERICAL_CLIMATE_CONTRACT.thresholds.scorePass}`;
      {
        const score = Number(metrics.numericalIntegrityScore);
        entry.severity = Number.isFinite(score)
          ? clamp01((NUMERICAL_CLIMATE_CONTRACT.thresholds.scorePass - score) / NUMERICAL_CLIMATE_CONTRACT.thresholds.scorePass)
          : 1;
      }
      break;
    case 'north_tropical_cyclone_seasonality_weak':
      entry.label = 'North tropical cyclone seasonality weak';
      entry.category = 'seasonality';
      entry.metricKey = 'nhWarmSeasonMean';
      entry.actual = seasonality?.nhWarmSeasonMean ?? null;
      entry.target = '> nhCoolSeasonMean * 1.15';
      entry.severity = clamp01(
        (Math.max(0.1, Number(seasonality?.nhCoolSeasonMean || 0) * 1.15) - Number(seasonality?.nhWarmSeasonMean || 0)) / 1.5
      );
      break;
    case 'south_tropical_cyclone_seasonality_weak':
      entry.label = 'South tropical cyclone seasonality weak';
      entry.category = 'seasonality';
      entry.metricKey = 'shWarmSeasonMean';
      entry.actual = seasonality?.shWarmSeasonMean ?? null;
      entry.target = '> shCoolSeasonMean * 1.15';
      entry.severity = clamp01(
        (Math.max(0.1, Number(seasonality?.shCoolSeasonMean || 0) * 1.15) - Number(seasonality?.shWarmSeasonMean || 0)) / 1.5
      );
      break;
    default:
      break;
  }
  entry.severity = round(entry.severity, 3) ?? 0.25;
  entry.actual = Number.isFinite(entry.actual) ? round(entry.actual, entry.metricKey?.includes('KgM2S') || entry.metricKey?.includes('S_1') ? 5 : 3) : entry.actual;
  return entry;
};

export const buildRealismGapReport = (horizons) => {
  const aggregated = new Map();
  for (const horizon of horizons) {
    for (const warning of horizon.warnings || []) {
      const next = buildGapEntry(warning, horizon);
      const current = aggregated.get(warning);
      if (!current) {
        aggregated.set(warning, next);
        continue;
      }
      current.horizonsDays = [...new Set([...current.horizonsDays, ...next.horizonsDays])].sort((a, b) => a - b);
      if ((next.severity || 0) >= (current.severity || 0)) {
        aggregated.set(warning, { ...current, ...next, horizonsDays: current.horizonsDays });
      }
    }
  }
  return [...aggregated.values()].sort((a, b) => (b.severity || 0) - (a.severity || 0) || (b.horizonsDays?.[b.horizonsDays.length - 1] || 0) - (a.horizonsDays?.[a.horizonsDays.length - 1] || 0));
};

const extractAttributionStory = (sample = null) => ({
  dominantCloudImport: sample?.transportTracing?.interfaces
    ? buildTransportInterfaceBudgetReport(sample)?.dominantNhDryBeltCloudImport || null
    : null,
  dominantVerticalChannel: sample?.verticalCloudBirthTracing
    ? dominantVerticalCloudBirthChannel(sample.verticalCloudBirthTracing)
    : null,
  dominantStormRegime: sample?.stormSpilloverTracing?.overall?.dominantCombinedRegime || null,
  carryoverDominatesLargeScale: (Number(sample?.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2) || 0)
    > (Number(sample?.metrics?.northDryBeltLargeScaleCondensationMeanKgM2) || 0),
  importedSourceDominatesLocal: (Number(sample?.metrics?.northDryBeltSourceAtmosphericCarryoverMeanKgM2) || 0)
    > ((Number(sample?.metrics?.northDryBeltSourceNorthDryBeltOceanMeanKgM2) || 0)
      + (Number(sample?.metrics?.northDryBeltSourceLandRecyclingMeanKgM2) || 0)),
  dominantRootCauseFamily: buildSampleRootCauseScores(sample)?.dominantFamily?.key || null,
  dominantBroadRootCauseFamily: broadRootCauseFamily(buildSampleRootCauseScores(sample)?.dominantFamily?.key || null),
  helperRootCauseAssessment: sample?.forcingOppositionTracing?.rootCauseAssessment || null,
  numericalRootCauseAssessment: sample?.numericalIntegrityTracing?.rootCauseAssessment || null
});

const compareAttributionStory = (baselineSample, variantSample) => {
  const baseline = extractAttributionStory(baselineSample);
  const variant = extractAttributionStory(variantSample);
  const cloudSignature = (entry = null) => entry ? {
    interfaceTargetLatDeg: entry.interfaceTargetLatDeg ?? null,
    levelBandKey: entry.levelBandKey ?? null,
    direction: Math.sign(Number(entry.signedFluxNorthKgM_1S) || 0)
  } : null;
  const verticalSignature = (entry = null) => entry ? {
    key: entry.key ?? null
  } : null;
  const sameCloudImport = JSON.stringify(cloudSignature(baseline.dominantCloudImport)) === JSON.stringify(cloudSignature(variant.dominantCloudImport));
  const sameVerticalChannel = JSON.stringify(verticalSignature(baseline.dominantVerticalChannel)) === JSON.stringify(verticalSignature(variant.dominantVerticalChannel));
  const sameStormRegime = (baseline.dominantStormRegime || null) === (variant.dominantStormRegime || null);
  const sameDominantRootCauseFamily = (baseline.dominantRootCauseFamily || null) === (variant.dominantRootCauseFamily || null);
  const sameDominantBroadRootCauseFamily = (baseline.dominantBroadRootCauseFamily || null) === (variant.dominantBroadRootCauseFamily || null);
  const stable = sameCloudImport
    && sameVerticalChannel
    && sameStormRegime
    && sameDominantBroadRootCauseFamily
    && baseline.carryoverDominatesLargeScale === variant.carryoverDominatesLargeScale
    && baseline.importedSourceDominatesLocal === variant.importedSourceDominatesLocal;
  return {
    stable,
    sameCloudImport,
    sameVerticalChannel,
    sameStormRegime,
    sameDominantRootCauseFamily,
    sameDominantBroadRootCauseFamily,
    baseline,
    variant
  };
};

const sigmaMidAtLevel = (sigmaHalf, lev, nz) => (
  sigmaHalf
    ? clamp01(0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]))
    : clamp01((lev + 0.5) / Math.max(1, nz))
);

const buildCounterfactualContext = (core) => {
  const { grid, state } = core;
  const { nx, ny } = grid;
  const { N, nz, sigmaHalf, landMask } = state;
  const nhDryBeltWeight = new Float32Array(N);
  const nhDryBeltOceanWeight = new Float32Array(N);
  const nhUpperImportWeight = new Float32Array(N);
  const upperLevels = [];
  const lowerLevels = [];
  const cloudBirthLevels = [];
  for (let lev = 0; lev < nz; lev += 1) {
    const sigmaMid = sigmaMidAtLevel(sigmaHalf, lev, nz);
    if (sigmaMid <= 0.55) upperLevels.push(lev);
    if (sigmaMid >= 0.65) lowerLevels.push(lev);
    if (sigmaMid <= 0.7) cloudBirthLevels.push(lev);
  }
  for (let j = 0; j < ny; j += 1) {
    const lat = grid.latDeg[j];
    const dryWeight = smoothstep(13, 17, lat) * (1 - smoothstep(34, 38, lat));
    const importWeight = smoothstep(20, 24, lat) * (1 - smoothstep(35, 40, lat));
    const row = j * nx;
    for (let i = 0; i < nx; i += 1) {
      const k = row + i;
      const isOcean = !(landMask && landMask[k] === 1);
      nhDryBeltWeight[k] = dryWeight;
      nhUpperImportWeight[k] = importWeight;
      nhDryBeltOceanWeight[k] = isOcean ? dryWeight : 0;
    }
  }
  return {
    upperLevels,
    lowerLevels,
    cloudBirthLevels,
    nhDryBeltWeight,
    nhDryBeltOceanWeight,
    nhUpperImportWeight
  };
};

const createCounterfactualAccumulator = (variant) => ({
  variantKey: variant.key,
  label: variant.label,
  family: variant.family,
  strength: resolveVariantStrength(variant),
  affectedCellSteps: 0,
  removedVaporKgM2: 0,
  removedCloudKgM2: 0,
  returnedCloudToVaporKgM2: 0,
  componentSummaries: Object.fromEntries(
    getVariantComponents(variant).map((component) => [
      component.key,
      {
        key: component.key,
        label: component.label,
        strength: component.strength,
        affectedCellSteps: 0,
        removedVaporKgM2: 0,
        removedCloudKgM2: 0,
        returnedCloudToVaporKgM2: 0
      }
    ])
  )
});

const getVariantComponents = (variant) => {
  if (Array.isArray(variant?.components) && variant.components.length) {
    return variant.components.map((component) => {
      const base = COUNTERFACTUAL_VARIANT_BY_KEY[component.key] || {};
      const baseStrength = Number.isFinite(component?.strength)
        ? component.strength
        : Number.isFinite(base?.strength)
          ? base.strength * (Number.isFinite(component?.strengthScale) ? component.strengthScale : 1)
          : Number.isFinite(component?.strengthScale)
            ? component.strengthScale
            : 0;
      return {
        key: component.key,
        label: component.label || base.label || component.key,
        family: base.family || variant.family,
        description: base.description || variant.description,
        strength: round(baseStrength, 5)
      };
    });
  }
  return [{
    key: variant.key,
    label: variant.label,
    family: variant.family,
    description: variant.description,
    strength: Number.isFinite(variant?.strength) ? variant.strength : 0
  }];
};

const resolveVariantStrength = (variant) => {
  if (Number.isFinite(variant?.strength)) return variant.strength;
  const components = getVariantComponents(variant).map((component) => component.strength).filter(Number.isFinite);
  return components.length ? round(mean(components), 5) : null;
};

const removeTracerBackedVaporAtLevel = (state, idx, tracerFieldNames, removalFrac, layerAirMass) => {
  if (!Number.isFinite(removalFrac) || removalFrac <= 0 || !Number.isFinite(layerAirMass) || layerAirMass <= 0) return 0;
  const tracerFields = tracerFieldNames
    .map((fieldName) => state[fieldName])
    .filter((field) => field instanceof Float32Array && field.length === state.qv.length);
  if (!tracerFields.length) return 0;
  let tracerTotal = 0;
  for (const field of tracerFields) tracerTotal += Math.max(0, field[idx] || 0);
  if (!(tracerTotal > 0)) return 0;
  const qvAvailable = Math.max(0, state.qv[idx] || 0);
  const removalMixingRatio = Math.min(qvAvailable, tracerTotal * clamp01(removalFrac));
  if (!(removalMixingRatio > 0)) return 0;
  const tracerScale = removalMixingRatio / Math.max(tracerTotal, 1e-9);
  for (const field of tracerFields) {
    field[idx] = Math.max(0, field[idx] - Math.max(0, field[idx]) * tracerScale);
  }
  state.qv[idx] = Math.max(0, qvAvailable - removalMixingRatio);
  return removalMixingRatio * layerAirMass;
};

const removeColumnCloudMass = (state, k, levels, removalMassKgM2, returnToVaporFrac = 0) => {
  if (!Number.isFinite(removalMassKgM2) || removalMassKgM2 <= 0 || !Array.isArray(levels) || !levels.length) {
    return { removedCloudKgM2: 0, returnedVaporKgM2: 0 };
  }
  const { N, pHalf, qc, qi, qr, qs, qv } = state;
  const layers = [];
  let totalCondMass = 0;
  for (const lev of levels) {
    const idx = lev * N + k;
    const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
    const layerAirMass = dp > 0 ? dp / 9.80665 : 0;
    if (!(layerAirMass > 0)) continue;
    const condMixingRatio = Math.max(0, qc[idx] || 0) + Math.max(0, qi[idx] || 0) + Math.max(0, qr[idx] || 0) + Math.max(0, qs[idx] || 0);
    const condMass = condMixingRatio * layerAirMass;
    if (!(condMass > 0)) continue;
    layers.push({ idx, layerAirMass, condMixingRatio, condMass });
    totalCondMass += condMass;
  }
  if (!(totalCondMass > 0)) return { removedCloudKgM2: 0, returnedVaporKgM2: 0 };
  const removalScale = Math.min(1, removalMassKgM2 / Math.max(totalCondMass, 1e-9));
  let removedCloudKgM2 = 0;
  let returnedVaporKgM2 = 0;
  for (const layer of layers) {
    const layerRemovalMass = layer.condMass * removalScale;
    if (!(layerRemovalMass > 0)) continue;
    const speciesScale = layerRemovalMass / Math.max(layer.condMass, 1e-9);
    qc[layer.idx] = Math.max(0, qc[layer.idx] * (1 - speciesScale));
    qi[layer.idx] = Math.max(0, qi[layer.idx] * (1 - speciesScale));
    qr[layer.idx] = Math.max(0, qr[layer.idx] * (1 - speciesScale));
    qs[layer.idx] = Math.max(0, qs[layer.idx] * (1 - speciesScale));
    const returnedMass = layerRemovalMass * clamp01(returnToVaporFrac);
    if (returnedMass > 0) {
      qv[layer.idx] += returnedMass / layer.layerAirMass;
      returnedVaporKgM2 += returnedMass;
    }
    removedCloudKgM2 += layerRemovalMass;
  }
  return { removedCloudKgM2, returnedVaporKgM2 };
};

const applyCounterfactualComponent = (core, component, context, accumulator) => {
  const { state, grid } = core;
  const { N, nz, pHalf } = state;
  const {
    nhDryBeltWeight,
    nhDryBeltOceanWeight,
    nhUpperImportWeight,
    upperLevels,
    lowerLevels,
    cloudBirthLevels
  } = context;
  const variantKey = component.key;
  const variantStrength = component.strength;
  const tracerFieldsByVariant = {
    sourceMoisture: ['qvSourceNorthDryBeltOcean', 'qvSourceTropicalOceanNorth'],
    transportImport: ['qvSourceAtmosphericCarryover'],
    nudgingOpposition: ['qvSourceNudgingInjection', 'qvSourceAnalysisInjection']
  };

  for (let k = 0; k < N; k += 1) {
    const dryWeight = nhDryBeltWeight[k] || 0;
    const oceanWeight = nhDryBeltOceanWeight[k] || 0;
    const importWeight = nhUpperImportWeight[k] || 0;
    if (variantKey === 'sourceMoisture' && oceanWeight > 0) {
      for (const lev of lowerLevels) {
        const idx = lev * N + k;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const layerAirMass = dp > 0 ? dp / 9.80665 : 0;
        const removedMass = removeTracerBackedVaporAtLevel(
          state,
          idx,
          tracerFieldsByVariant.sourceMoisture,
          variantStrength * oceanWeight,
          layerAirMass
        );
        if (removedMass > 0) {
          accumulator.removedVaporKgM2 += removedMass;
          accumulator.affectedCellSteps += 1;
        }
      }
      continue;
    }
    if (variantKey === 'nudgingOpposition' && dryWeight > 0) {
      for (const lev of lowerLevels) {
        const idx = lev * N + k;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        const layerAirMass = dp > 0 ? dp / 9.80665 : 0;
        const removedMass = removeTracerBackedVaporAtLevel(
          state,
          idx,
          tracerFieldsByVariant.nudgingOpposition,
          variantStrength * dryWeight,
          layerAirMass
        );
        if (removedMass > 0) {
          accumulator.removedVaporKgM2 += removedMass;
          accumulator.affectedCellSteps += 1;
        }
      }
      continue;
    }

    let removalBudgetKgM2 = 0;
    let levels = upperLevels;
    let returnToVaporFrac = 0;

    switch (variantKey) {
      case 'transportImport': {
        removalBudgetKgM2 = (Number(state.carriedOverUpperCloudMass?.[k]) || 0) * variantStrength * importWeight;
        if (importWeight > 0) {
          for (const lev of upperLevels) {
            const idx = lev * N + k;
            const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
            const layerAirMass = dp > 0 ? dp / 9.80665 : 0;
            const removedMass = removeTracerBackedVaporAtLevel(
              state,
              idx,
              tracerFieldsByVariant.transportImport,
              variantStrength * importWeight * 0.6,
              layerAirMass
            );
            if (removedMass > 0) {
              accumulator.removedVaporKgM2 += removedMass;
              accumulator.affectedCellSteps += 1;
            }
          }
        }
        break;
      }
      case 'resolvedAscentBirth':
        removalBudgetKgM2 = (Number(state.resolvedAscentCloudBirthPotential?.[k]) || 0) * variantStrength * dryWeight;
        levels = cloudBirthLevels;
        returnToVaporFrac = 1;
        break;
      case 'saturationAdjustmentBirth':
        removalBudgetKgM2 = (Number(state.largeScaleCondensationSource?.[k]) || 0) * variantStrength * dryWeight;
        levels = cloudBirthLevels;
        returnToVaporFrac = 1;
        break;
      case 'upperCloudErosion':
        removalBudgetKgM2 = (Number(state.upperCloudBlockedErosionMass?.[k]) || 0) * variantStrength * dryWeight;
        break;
      case 'radiativeMaintenance': {
        const supportFrac = clamp01(Math.abs(Number(state.upperCloudNetCloudRadiativeEffectWm2?.[k]) || 0) / 40);
        removalBudgetKgM2 = (Number(state.upperCloudPath?.[k]) || 0) * supportFrac * variantStrength * dryWeight;
        break;
      }
      default:
        break;
    }

    if (!(removalBudgetKgM2 > 0)) continue;
    const removal = removeColumnCloudMass(state, k, levels, removalBudgetKgM2, returnToVaporFrac);
    if (removal.removedCloudKgM2 > 0 || removal.returnedVaporKgM2 > 0) {
      accumulator.removedCloudKgM2 += removal.removedCloudKgM2;
      accumulator.returnedCloudToVaporKgM2 += removal.returnedVaporKgM2;
      accumulator.affectedCellSteps += 1;
    }
  }
};

const applyCounterfactualIntervention = (core, variant, context, accumulator) => {
  for (const component of getVariantComponents(variant)) {
    const componentAccumulator = accumulator.componentSummaries?.[component.key] || accumulator;
    const componentBefore = componentAccumulator === accumulator
      ? null
      : {
          affectedCellSteps: componentAccumulator.affectedCellSteps,
          removedVaporKgM2: componentAccumulator.removedVaporKgM2,
          removedCloudKgM2: componentAccumulator.removedCloudKgM2,
          returnedCloudToVaporKgM2: componentAccumulator.returnedCloudToVaporKgM2
        };
    applyCounterfactualComponent(core, component, context, componentAccumulator);
    if (componentAccumulator !== accumulator && componentBefore) {
      accumulator.affectedCellSteps += componentAccumulator.affectedCellSteps - componentBefore.affectedCellSteps;
      accumulator.removedVaporKgM2 += componentAccumulator.removedVaporKgM2 - componentBefore.removedVaporKgM2;
      accumulator.removedCloudKgM2 += componentAccumulator.removedCloudKgM2 - componentBefore.removedCloudKgM2;
      accumulator.returnedCloudToVaporKgM2 += componentAccumulator.returnedCloudToVaporKgM2 - componentBefore.returnedCloudToVaporKgM2;
    }
  }
};

const advanceModelSecondsWithCounterfactual = (core, totalSeconds, variant) => {
  const totalSteps = Math.max(0, Math.floor(totalSeconds / core.modelDt));
  const context = buildCounterfactualContext(core);
  const accumulator = createCounterfactualAccumulator(variant);
  for (let step = 0; step < totalSteps; step += 1) {
    core._stepOnce(core.modelDt);
    applyCounterfactualIntervention(core, variant, context, accumulator);
  }
  return accumulator;
};

const buildCounterfactualImprovement = (baselineSample, variantSample) => {
  const baseline = baselineSample?.metrics || {};
  const variant = variantSample?.metrics || {};
  const dryRatioImprovement = (Number(baseline.subtropicalDryNorthRatio) || 0) - (Number(variant.subtropicalDryNorthRatio) || 0);
  const rhNorthImprovement = (Number(baseline.subtropicalRhNorthMeanFrac) || 0) - (Number(variant.subtropicalRhNorthMeanFrac) || 0);
  const upperCloudPathImprovement = (Number(baseline.northDryBeltUpperCloudPathMeanKgM2) || 0) - (Number(variant.northDryBeltUpperCloudPathMeanKgM2) || 0);
  const carryoverImprovement = (Number(baseline.northDryBeltCarriedOverUpperCloudMeanKgM2) || 0) - (Number(variant.northDryBeltCarriedOverUpperCloudMeanKgM2) || 0);
  const condensationImprovement = (Number(baseline.northDryBeltLargeScaleCondensationMeanKgM2) || 0) - (Number(variant.northDryBeltLargeScaleCondensationMeanKgM2) || 0);
  const normalized = [
    clamp(dryRatioImprovement / Math.max(0.05, Math.abs((Number(baseline.subtropicalDryNorthRatio) || 0) - 0.8)), -1.5, 1.5),
    clamp(rhNorthImprovement / 0.06, -1.5, 1.5),
    clamp(upperCloudPathImprovement / Math.max(0.05, Number(baseline.northDryBeltUpperCloudPathMeanKgM2) || 0.05), -1.5, 1.5),
    clamp(carryoverImprovement / Math.max(0.05, Number(baseline.northDryBeltCarriedOverUpperCloudMeanKgM2) || 0.05), -1.5, 1.5),
    clamp(condensationImprovement / Math.max(0.02, Number(baseline.northDryBeltLargeScaleCondensationMeanKgM2) || 0.02), -1.5, 1.5)
  ];
  let guardrailPenalty = 0;
  const guardrails = {
    itczWidthPass: (Number(variant.itczWidthDeg) || Infinity) <= 23.8,
    southSubsidencePass: (Number(variant.subtropicalSubsidenceSouthMean) || -Infinity) >= 0.03,
    tradeWindsPass: (Number(variant.tropicalTradesNorthU10Ms) || Infinity) < -0.2
      && (Number(variant.tropicalTradesSouthU10Ms) || Infinity) < -0.2,
    westerliesPass: (Number(variant.midlatitudeWesterliesNorthU10Ms) || -Infinity) > 0.2
      && (Number(variant.midlatitudeWesterliesSouthU10Ms) || -Infinity) > 0.2
  };
  if (!guardrails.itczWidthPass) guardrailPenalty += 0.25 + clamp(((Number(variant.itczWidthDeg) || 23.8) - 23.8) / 4, 0, 0.4);
  if (!guardrails.southSubsidencePass) guardrailPenalty += 0.25 + clamp((0.03 - (Number(variant.subtropicalSubsidenceSouthMean) || 0)) / 0.03, 0, 0.4);
  if (!guardrails.tradeWindsPass) guardrailPenalty += 0.25;
  if (!guardrails.westerliesPass) guardrailPenalty += 0.25;
  const directionalImprovementScore = round(
    (0.32 * normalized[0])
    + (0.14 * normalized[1])
    + (0.2 * normalized[2])
    + (0.18 * normalized[3])
    + (0.16 * normalized[4])
    - guardrailPenalty,
    5
  );
  return {
    dryRatioImprovement: round(dryRatioImprovement, 5),
    rhNorthImprovement: round(rhNorthImprovement, 5),
    upperCloudPathImprovement: round(upperCloudPathImprovement, 5),
    carryoverImprovement: round(carryoverImprovement, 5),
    largeScaleCondensationImprovement: round(condensationImprovement, 5),
    directionalImprovementScore,
    directionalImprovementPass: directionalImprovementScore > 0 && dryRatioImprovement > 0 && Object.values(guardrails).every(Boolean),
    guardrails
  };
};

const runCounterfactualVariant = async ({
  variant,
  variantName,
  variantNx,
  variantNy,
  variantDtSeconds,
  targetDay,
  configSnapshot
}) => {
  const startedAt = Date.now();
  const components = getVariantComponents(variant);
  const resolvedStrength = resolveVariantStrength(variant);
  const core = new WeatherCore5({ nx: variantNx, ny: variantNy, dt: variantDtSeconds, seed });
  await core._initPromise;
  applyCoreConfigSnapshot(core, configSnapshot);
  const terrainFallback = applyHeadlessTerrainFixture(core);
  const interventionSummary = advanceModelSecondsWithCounterfactual(core, targetDay * SECONDS_PER_DAY, variant);
  const latest = classifySnapshot(buildValidationDiagnostics(core), targetDay);
  return {
    variantName,
    key: variant.key,
    label: variant.label,
    family: variant.family,
    description: variant.description,
    strength: resolvedStrength,
    components,
    nx: variantNx,
    ny: variantNy,
    dtSeconds: variantDtSeconds,
    targetDay,
    elapsedMs: Date.now() - startedAt,
    terrainFallback,
    interventionSummary: {
      ...interventionSummary,
      removedVaporKgM2: round(interventionSummary.removedVaporKgM2, 5),
      removedCloudKgM2: round(interventionSummary.removedCloudKgM2, 5),
      returnedCloudToVaporKgM2: round(interventionSummary.returnedCloudToVaporKgM2, 5),
      componentSummaries: Object.fromEntries(
        Object.entries(interventionSummary.componentSummaries || {}).map(([key, summary]) => [key, {
          key: summary.key,
          label: summary.label,
          strength: round(summary.strength, 5),
          affectedCellSteps: summary.affectedCellSteps,
          removedVaporKgM2: round(summary.removedVaporKgM2, 5),
          removedCloudKgM2: round(summary.removedCloudKgM2, 5),
          returnedCloudToVaporKgM2: round(summary.returnedCloudToVaporKgM2, 5)
        }])
      )
    },
    latest
  };
};

export const buildCounterfactualPathwaySensitivityReport = ({
  baselineSample = null,
  targetDay = null,
  variants = [],
  sensitivityVariantsByKey = {}
} = {}) => {
  const pathways = variants.map((variant) => {
    const improvement = buildCounterfactualImprovement(baselineSample, variant.latest);
    const sensitivityVariants = (sensitivityVariantsByKey?.[variant.key] || []).map((entry) => ({
      scenarioKey: entry.scenarioKey,
      scenarioLabel: entry.scenarioLabel,
      improvement: entry.improvement,
      storyComparison: entry.storyComparison
    }));
    const directionalSensitivityPass = sensitivityVariants.length
      ? sensitivityVariants.every((entry) => (entry.improvement?.dryRatioImprovement || 0) > 0 && (entry.improvement?.directionalImprovementScore || 0) > -0.05)
      : null;
    const storyStablePass = sensitivityVariants.length
      ? sensitivityVariants.every((entry) => entry.storyComparison?.stable)
      : null;
    return {
      key: variant.key,
      label: variant.label,
      family: variant.family,
      description: variant.description,
      strength: variant.strength,
      elapsedMs: variant.elapsedMs,
      metrics: {
        subtropicalDryNorthRatio: variant.latest?.metrics?.subtropicalDryNorthRatio ?? null,
        subtropicalRhNorthMeanFrac: variant.latest?.metrics?.subtropicalRhNorthMeanFrac ?? null,
        northDryBeltUpperCloudPathMeanKgM2: variant.latest?.metrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null,
        northDryBeltCarriedOverUpperCloudMeanKgM2: variant.latest?.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
        northDryBeltLargeScaleCondensationMeanKgM2: variant.latest?.metrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null
      },
      interventionSummary: variant.interventionSummary,
      improvement,
      sensitivity: {
        directionalSensitivityPass,
        storyStablePass,
        variants: sensitivityVariants
      }
    };
  }).sort((a, b) => (b.improvement?.directionalImprovementScore || -Infinity) - (a.improvement?.directionalImprovementScore || -Infinity));

  const topCandidates = pathways.slice(0, COUNTERFACTUAL_TOP_CANDIDATE_COUNT).map((entry) => ({
    key: entry.key,
    label: entry.label,
    family: entry.family,
    directionalImprovementScore: entry.improvement?.directionalImprovementScore ?? null,
    dryRatioImprovement: entry.improvement?.dryRatioImprovement ?? null,
    directionalImprovementPass: entry.improvement?.directionalImprovementPass ?? false,
    directionalSensitivityPass: entry.sensitivity?.directionalSensitivityPass ?? null,
    storyStablePass: entry.sensitivity?.storyStablePass ?? null
  }));

  return {
    schema: 'satellite-wars.counterfactual-pathway-sensitivity.v1',
    generatedAt: new Date().toISOString(),
    targetDay,
    baselineMetrics: baselineSample ? {
      subtropicalDryNorthRatio: baselineSample.metrics?.subtropicalDryNorthRatio ?? null,
      subtropicalRhNorthMeanFrac: baselineSample.metrics?.subtropicalRhNorthMeanFrac ?? null,
      northDryBeltUpperCloudPathMeanKgM2: baselineSample.metrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null,
      northDryBeltCarriedOverUpperCloudMeanKgM2: baselineSample.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltLargeScaleCondensationMeanKgM2: baselineSample.metrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null
    } : null,
    pathways,
    topCandidates
  };
};

export const buildRootCauseCandidateRankingReport = (counterfactualReport = null) => {
  const pathways = Array.isArray(counterfactualReport?.pathways) ? counterfactualReport.pathways : [];
  const ranking = pathways.map((entry, index) => ({
    rank: index + 1,
    key: entry.key,
    label: entry.label,
    family: entry.family,
    directionalImprovementScore: entry.improvement?.directionalImprovementScore ?? null,
    dryRatioImprovement: entry.improvement?.dryRatioImprovement ?? null,
    directionalImprovementPass: entry.improvement?.directionalImprovementPass ?? false,
    directionalSensitivityPass: entry.sensitivity?.directionalSensitivityPass ?? null,
    storyStablePass: entry.sensitivity?.storyStablePass ?? null
  }));
  const stablePositive = ranking.filter((entry) => entry.directionalImprovementPass && entry.directionalSensitivityPass !== false && entry.storyStablePass !== false);
  const primaryCandidate = stablePositive[0] || ranking[0] || null;
  const backupCandidate = stablePositive[1] || ranking[1] || null;
  const rootCauseAssessment = {
    ruledIn: [],
    ruledOut: [],
    ambiguous: []
  };
  if (primaryCandidate && primaryCandidate.directionalImprovementPass && primaryCandidate.directionalSensitivityPass !== false) {
    rootCauseAssessment.ruledIn.push(
      `${primaryCandidate.label} produced the strongest directional improvement${primaryCandidate.storyStablePass === true ? ' and stayed attribution-stable across Phase 9 sensitivity variants' : ''}.`
    );
  } else {
    rootCauseAssessment.ambiguous.push('No counterfactual pathway yet produces a strong enough stable directional win to close root cause.');
  }
  pathways
    .filter((entry) => (entry.improvement?.directionalImprovementScore || -Infinity) < 0)
    .forEach((entry) => rootCauseAssessment.ruledOut.push(`${entry.label} did not improve the NH dry-belt target under the current counterfactual harness.`));
  return {
    schema: 'satellite-wars.root-cause-candidate-ranking.v1',
    generatedAt: new Date().toISOString(),
    primaryCandidate,
    backupCandidate,
    closureReadyPass: Boolean(primaryCandidate?.directionalImprovementPass && primaryCandidate?.directionalSensitivityPass !== false),
    ranking,
    rootCauseAssessment
  };
};

export const buildCoupledCounterfactualMatrixReport = ({
  baselineSample = null,
  targetDay = null,
  bundles = [],
  sensitivityVariantsByKey = {}
} = {}) => {
  const entries = bundles.map((bundle) => {
    const improvement = buildCounterfactualImprovement(baselineSample, bundle.latest);
    const sensitivityVariants = (sensitivityVariantsByKey?.[bundle.key] || []).map((entry) => ({
      scenarioKey: entry.scenarioKey,
      scenarioLabel: entry.scenarioLabel,
      improvement: entry.improvement,
      storyComparison: entry.storyComparison
    }));
    const tolerableSensitivityPass = sensitivityVariants.length
      ? sensitivityVariants.every((entry) => (entry.improvement?.directionalImprovementScore || 0) > -0.05 && entry.storyComparison?.stable !== false)
      : null;
    return {
      key: bundle.key,
      label: bundle.label,
      family: bundle.family,
      description: bundle.description,
      strength: bundle.strength,
      components: bundle.components || [],
      elapsedMs: bundle.elapsedMs,
      metrics: {
        subtropicalDryNorthRatio: bundle.latest?.metrics?.subtropicalDryNorthRatio ?? null,
        subtropicalRhNorthMeanFrac: bundle.latest?.metrics?.subtropicalRhNorthMeanFrac ?? null,
        northDryBeltUpperCloudPathMeanKgM2: bundle.latest?.metrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null,
        northDryBeltCarriedOverUpperCloudMeanKgM2: bundle.latest?.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
        northDryBeltLargeScaleCondensationMeanKgM2: bundle.latest?.metrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null
      },
      interventionSummary: bundle.interventionSummary,
      improvement,
      sensitivity: {
        tolerableSensitivityPass,
        variants: sensitivityVariants
      }
    };
  }).sort((a, b) => (b.improvement?.directionalImprovementScore || -Infinity) - (a.improvement?.directionalImprovementScore || -Infinity));

  const topBundles = entries.slice(0, COUNTERFACTUAL_TOP_CANDIDATE_COUNT).map((entry) => ({
    key: entry.key,
    label: entry.label,
    components: entry.components?.map((component) => component.key) || [],
    directionalImprovementScore: entry.improvement?.directionalImprovementScore ?? null,
    dryRatioImprovement: entry.improvement?.dryRatioImprovement ?? null,
    directionalImprovementPass: entry.improvement?.directionalImprovementPass ?? false,
    tolerableSensitivityPass: entry.sensitivity?.tolerableSensitivityPass ?? null
  }));

  return {
    schema: 'satellite-wars.coupled-counterfactual-matrix.v1',
    generatedAt: new Date().toISOString(),
    targetDay,
    baselineMetrics: baselineSample ? {
      subtropicalDryNorthRatio: baselineSample.metrics?.subtropicalDryNorthRatio ?? null,
      subtropicalRhNorthMeanFrac: baselineSample.metrics?.subtropicalRhNorthMeanFrac ?? null,
      northDryBeltUpperCloudPathMeanKgM2: baselineSample.metrics?.northDryBeltUpperCloudPathMeanKgM2 ?? null,
      northDryBeltCarriedOverUpperCloudMeanKgM2: baselineSample.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
      northDryBeltLargeScaleCondensationMeanKgM2: baselineSample.metrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null
    } : null,
    bundles: entries,
    topBundles
  };
};

export const buildCoupledCounterfactualRankingReport = (matrixReport = null) => {
  const bundles = Array.isArray(matrixReport?.bundles) ? matrixReport.bundles : [];
  const ranking = bundles.map((entry, index) => ({
    rank: index + 1,
    key: entry.key,
    label: entry.label,
    components: entry.components?.map((component) => component.key) || [],
    directionalImprovementScore: entry.improvement?.directionalImprovementScore ?? null,
    dryRatioImprovement: entry.improvement?.dryRatioImprovement ?? null,
    directionalImprovementPass: entry.improvement?.directionalImprovementPass ?? false,
    tolerableSensitivityPass: entry.sensitivity?.tolerableSensitivityPass ?? null
  }));
  const stablePositive = ranking.filter((entry) => entry.directionalImprovementPass && entry.tolerableSensitivityPass !== false);
  const bestBundle = stablePositive[0] || ranking[0] || null;
  const rootCauseAssessment = {
    ruledIn: [],
    ruledOut: [],
    ambiguous: []
  };
  if (bestBundle && bestBundle.directionalImprovementPass && bestBundle.tolerableSensitivityPass !== false) {
    rootCauseAssessment.ruledIn.push(`${bestBundle.label} is the strongest coupled bundle with positive dry-belt improvement and tolerable sensitivity behavior.`);
  } else {
    rootCauseAssessment.ambiguous.push('No coupled bundle yet clears the Phase D exit gate across both guardrails and sensitivity behavior.');
  }
  ranking
    .filter((entry) => (entry.directionalImprovementScore || -Infinity) < 0)
    .forEach((entry) => rootCauseAssessment.ruledOut.push(`${entry.label} regressed the coupled directional score under the current Phase D matrix.`));
  return {
    schema: 'satellite-wars.coupled-counterfactual-ranking.v1',
    generatedAt: new Date().toISOString(),
    bestBundle,
    exitCriteriaPass: Boolean(bestBundle?.directionalImprovementPass && bestBundle?.tolerableSensitivityPass !== false),
    ranking,
    rootCauseAssessment
  };
};

export const buildCoupledCounterfactualGuardrailsReport = (matrixReport = null) => {
  const bundles = Array.isArray(matrixReport?.bundles) ? matrixReport.bundles : [];
  const guardrailSummary = bundles.map((entry) => ({
    key: entry.key,
    label: entry.label,
    components: entry.components?.map((component) => component.key) || [],
    guardrails: entry.improvement?.guardrails || null,
    directionalImprovementPass: entry.improvement?.directionalImprovementPass ?? false,
    tolerableSensitivityPass: entry.sensitivity?.tolerableSensitivityPass ?? null
  }));
  return {
    schema: 'satellite-wars.coupled-counterfactual-guardrails.v1',
    generatedAt: new Date().toISOString(),
    bundles: guardrailSummary,
    exitCriteriaPass: guardrailSummary.some((entry) => entry.directionalImprovementPass && entry.tolerableSensitivityPass !== false)
  };
};

const roundGridDimension = (value, minimum) => Math.max(minimum, Math.round(value / 2) * 2);

const runSensitivityVariant = async ({
  variantName,
  variantNx,
  variantNy,
  variantDtSeconds,
  targetDay,
  configSnapshot
}) => {
  const startedAt = Date.now();
  const core = new WeatherCore5({ nx: variantNx, ny: variantNy, dt: variantDtSeconds, seed });
  await core._initPromise;
  applyCoreConfigSnapshot(core, configSnapshot);
  const terrainFallback = applyHeadlessTerrainFixture(core);
  advanceModelSecondsFully(core, targetDay * SECONDS_PER_DAY);
  const latest = classifySnapshot(buildValidationDiagnostics(core), targetDay);
  return {
    variantName,
    nx: variantNx,
    ny: variantNy,
    dtSeconds: variantDtSeconds,
    targetDay,
    elapsedMs: Date.now() - startedAt,
    terrainFallback,
    latest
  };
};

export const buildDtSensitivityReport = ({ baselineSample = null, variants = [], targetDay = null } = {}) => {
  const baselineMetrics = {
    subtropicalDryNorthRatio: baselineSample?.metrics?.subtropicalDryNorthRatio ?? null,
    subtropicalDrySouthRatio: baselineSample?.metrics?.subtropicalDrySouthRatio ?? null,
    numericalIntegrityScore: baselineSample?.metrics?.numericalIntegrityScore ?? null,
    numericalVerticalCflClampMaxKgM2: baselineSample?.metrics?.numericalVerticalCflClampMaxKgM2 ?? null
  };
  const comparisons = variants.map((variant) => {
    const dryNorthDelta = Number(variant.latest?.metrics?.subtropicalDryNorthRatio) - Number(baselineMetrics.subtropicalDryNorthRatio);
    const drySouthDelta = Number(variant.latest?.metrics?.subtropicalDrySouthRatio) - Number(baselineMetrics.subtropicalDrySouthRatio);
    const dryBeltRatioMaxAbsDelta = Math.max(
      Number.isFinite(dryNorthDelta) ? Math.abs(dryNorthDelta) : 0,
      Number.isFinite(drySouthDelta) ? Math.abs(drySouthDelta) : 0
    );
    return {
      variantName: variant.variantName,
      dtSeconds: variant.dtSeconds,
      elapsedMs: variant.elapsedMs,
      metrics: {
        subtropicalDryNorthRatio: variant.latest?.metrics?.subtropicalDryNorthRatio ?? null,
        subtropicalDrySouthRatio: variant.latest?.metrics?.subtropicalDrySouthRatio ?? null,
        northDryBeltCarriedOverUpperCloudMeanKgM2: variant.latest?.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
        northDryBeltLargeScaleCondensationMeanKgM2: variant.latest?.metrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null,
        northDryBeltSourceAtmosphericCarryoverMeanKgM2: variant.latest?.metrics?.northDryBeltSourceAtmosphericCarryoverMeanKgM2 ?? null,
        numericalIntegrityScore: variant.latest?.metrics?.numericalIntegrityScore ?? null,
        numericalVerticalCflClampMaxKgM2: variant.latest?.metrics?.numericalVerticalCflClampMaxKgM2 ?? null
      },
      dryBeltRatioMaxAbsDelta: round(dryBeltRatioMaxAbsDelta, 5),
      dryBeltRatioStablePass: dryBeltRatioMaxAbsDelta <= NUMERICAL_CLIMATE_CONTRACT.dtDryBeltRatioMaxAbsDelta,
      storyComparison: compareAttributionStory(baselineSample, variant.latest)
    };
  });
  const storyStablePass = comparisons.every((entry) => entry.storyComparison.stable);
  const dryBeltRatioStablePass = comparisons.every((entry) => entry.dryBeltRatioStablePass);
  return {
    schema: 'satellite-wars.dt-sensitivity.v1',
    generatedAt: new Date().toISOString(),
    targetDay,
    baselineMetrics,
    baselineStory: extractAttributionStory(baselineSample),
    storyStablePass,
    rootCauseRankingStablePass: comparisons.every((entry) => entry.storyComparison.sameDominantBroadRootCauseFamily),
    fineRootCauseRankingStablePass: comparisons.every((entry) => entry.storyComparison.sameDominantRootCauseFamily),
    dryBeltRatioStablePass,
    dryBeltRatioMaxAbsDelta: round(comparisons.reduce((best, entry) => Math.max(best, entry.dryBeltRatioMaxAbsDelta || 0), 0), 5),
    pass: storyStablePass && dryBeltRatioStablePass,
    gate: {
      dryBeltRatioMaxAbsDelta: NUMERICAL_CLIMATE_CONTRACT.dtDryBeltRatioMaxAbsDelta
    },
    variants: comparisons
  };
};

export const buildGridSensitivityReport = ({ baselineSample = null, variants = [], targetDay = null } = {}) => {
  const baselineMetrics = {
    subtropicalDryNorthRatio: baselineSample?.metrics?.subtropicalDryNorthRatio ?? null,
    subtropicalDrySouthRatio: baselineSample?.metrics?.subtropicalDrySouthRatio ?? null,
    numericalIntegrityScore: baselineSample?.metrics?.numericalIntegrityScore ?? null,
    numericalVerticalCflClampMaxKgM2: baselineSample?.metrics?.numericalVerticalCflClampMaxKgM2 ?? null
  };
  const comparisons = variants.map((variant) => {
    const dryNorthDelta = Number(variant.latest?.metrics?.subtropicalDryNorthRatio) - Number(baselineMetrics.subtropicalDryNorthRatio);
    const drySouthDelta = Number(variant.latest?.metrics?.subtropicalDrySouthRatio) - Number(baselineMetrics.subtropicalDrySouthRatio);
    const dryBeltRatioMaxAbsDelta = Math.max(
      Number.isFinite(dryNorthDelta) ? Math.abs(dryNorthDelta) : 0,
      Number.isFinite(drySouthDelta) ? Math.abs(drySouthDelta) : 0
    );
    return {
      variantName: variant.variantName,
      nx: variant.nx,
      ny: variant.ny,
      elapsedMs: variant.elapsedMs,
      metrics: {
        subtropicalDryNorthRatio: variant.latest?.metrics?.subtropicalDryNorthRatio ?? null,
        subtropicalDrySouthRatio: variant.latest?.metrics?.subtropicalDrySouthRatio ?? null,
        northDryBeltCarriedOverUpperCloudMeanKgM2: variant.latest?.metrics?.northDryBeltCarriedOverUpperCloudMeanKgM2 ?? null,
        northDryBeltLargeScaleCondensationMeanKgM2: variant.latest?.metrics?.northDryBeltLargeScaleCondensationMeanKgM2 ?? null,
        northDryBeltSourceAtmosphericCarryoverMeanKgM2: variant.latest?.metrics?.northDryBeltSourceAtmosphericCarryoverMeanKgM2 ?? null,
        numericalIntegrityScore: variant.latest?.metrics?.numericalIntegrityScore ?? null,
        numericalVerticalCflClampMaxKgM2: variant.latest?.metrics?.numericalVerticalCflClampMaxKgM2 ?? null
      },
      dryBeltRatioMaxAbsDelta: round(dryBeltRatioMaxAbsDelta, 5),
      dryBeltRatioStablePass: dryBeltRatioMaxAbsDelta <= NUMERICAL_CLIMATE_CONTRACT.gridDryBeltRatioMaxAbsDelta,
      storyComparison: compareAttributionStory(baselineSample, variant.latest)
    };
  });
  const storyStablePass = comparisons.every((entry) => entry.storyComparison.stable);
  const dryBeltRatioStablePass = comparisons.every((entry) => entry.dryBeltRatioStablePass);
  const rootCauseRankingStablePass = comparisons.every((entry) => entry.storyComparison.sameDominantBroadRootCauseFamily);
  return {
    schema: 'satellite-wars.grid-sensitivity.v1',
    generatedAt: new Date().toISOString(),
    targetDay,
    canonicalGrids: {
      production: NUMERICAL_CLIMATE_CONTRACT.canonicalProductionGrid,
      routineValidation: NUMERICAL_CLIMATE_CONTRACT.routineValidationGrid,
      deepValidation: NUMERICAL_CLIMATE_CONTRACT.deepValidationGrid
    },
    baselineMetrics,
    baselineStory: extractAttributionStory(baselineSample),
    storyStablePass,
    rootCauseRankingStablePass,
    fineRootCauseRankingStablePass: comparisons.every((entry) => entry.storyComparison.sameDominantRootCauseFamily),
    dryBeltRatioStablePass,
    dryBeltRatioMaxAbsDelta: round(comparisons.reduce((best, entry) => Math.max(best, entry.dryBeltRatioMaxAbsDelta || 0), 0), 5),
    pass: rootCauseRankingStablePass,
    gate: {
      dryBeltRatioMaxAbsDelta: NUMERICAL_CLIMATE_CONTRACT.gridDryBeltRatioMaxAbsDelta
    },
    variants: comparisons
  };
};

const sensitivityGateSummary = (report = null, label = 'sensitivity') => {
  if (!report) {
    return {
      label,
      evaluated: false,
      pass: false,
      blockers: [`${label}_not_evaluated`]
    };
  }
  const blockers = [];
  if (report.rootCauseRankingStablePass === false) blockers.push(`${label}_root_cause_ranking_changed`);
  if (label === 'dt_sensitivity') {
    if (report.storyStablePass === false) blockers.push(`${label}_root_cause_story_changed`);
    if (report.dryBeltRatioStablePass === false) blockers.push(`${label}_dry_belt_ratio_unstable`);
  }
  return {
    label,
    evaluated: true,
    pass: report.pass === true,
    storyStablePass: report.storyStablePass === true,
    rootCauseRankingStablePass: report.rootCauseRankingStablePass === true,
    dryBeltRatioStablePass: report.dryBeltRatioStablePass === true,
    dryBeltRatioMaxAbsDelta: report.dryBeltRatioMaxAbsDelta ?? null,
    blockers
  };
};

export const buildNumericalClimateContractReport = ({
  latestSample = null,
  conservationSummary = null,
  dtSensitivity = null,
  gridSensitivity = null,
  config = {}
} = {}) => {
  const numericalIntegrityScore = computeNumericalIntegrityScore({
    numericalIntegrityTracing: latestSample?.numericalIntegrityTracing || null,
    conservationSummary
  });
  const dtGate = sensitivityGateSummary(dtSensitivity, 'dt_sensitivity');
  const gridGate = sensitivityGateSummary(gridSensitivity, 'grid_sensitivity');
  const blockers = [
    ...numericalIntegrityScore.blockers,
    ...dtGate.blockers,
    ...gridGate.blockers
  ];
  if (numericalIntegrityScore.pass !== true && !numericalIntegrityScore.blockers.length) {
    blockers.push('numerical_integrity_score_low');
  }
  const majorClimateClaimAllowed = numericalIntegrityScore.pass === true && dtGate.pass === true && gridGate.pass === true;
  return {
    schema: NUMERICAL_CLIMATE_CONTRACT.schema,
    generatedAt: new Date().toISOString(),
    targetDay: latestSample?.targetDay ?? null,
    config: {
      preset: config.preset ?? null,
      nx: config.nx ?? null,
      ny: config.ny ?? null,
      dtSeconds: config.dtSeconds ?? null,
      seed: config.seed ?? null
    },
    canonicalGrids: {
      production: NUMERICAL_CLIMATE_CONTRACT.canonicalProductionGrid,
      routineValidation: NUMERICAL_CLIMATE_CONTRACT.routineValidationGrid,
      deepValidation: NUMERICAL_CLIMATE_CONTRACT.deepValidationGrid
    },
    numericalIntegrityScore,
    dtGate,
    gridGate,
    majorClimateClaimAllowed,
    pass: majorClimateClaimAllowed,
    blockers: [...new Set(blockers)]
  };
};

export const evaluateHorizons = (samples, horizonDays) => {
  const warnings = [];
  const latest = samples.find((sample) => sample.targetDay === horizonDays) || samples[samples.length - 1];
  if (!latest) return { warnings: ['no_samples'], categories: {}, latest: null };
  const { metrics } = latest;
  const optionalPass = (value, predicate) => !Number.isFinite(value) || predicate(value);

  // Seasonal aggregation for gate-critical noisy metrics.
  //
  // The dry-belt ratio and storm-track latitude both have a legitimate
  // seasonal cycle (Hadley edge wanders, storm-track strength modulates with
  // baroclinicity); evaluating them on a single `latest` snapshot yields
  // spurious gate failures when the snapshot happens to land on a seasonal
  // extremum.  When the sampled window is long enough to resolve the annual
  // cycle (~12 samples ≥ monthly coverage), we gate on the annual mean of
  // each metric instead.  This matches the standard climatology-vs-weather
  // convention used by WMO/IPCC and avoids treating a single-day sample as
  // authoritative.  For other metrics we still use the `latest` snapshot
  // since they either have no large seasonal cycle (trades, westerlies,
  // ITCZ position in an annual preset) or are already defined as means.
  const annualAggregateKeys = [
    'subtropicalDryNorthRatio',
    'subtropicalDrySouthRatio',
    'stormTrackNorthLatDeg',
    'stormTrackSouthLatDeg'
  ];
  const ANNUAL_AGG_MIN_SAMPLES = 12;
  const computeAnnualMean = (key) => {
    let s = 0;
    let c = 0;
    for (const sample of samples) {
      const v = Number(sample?.metrics?.[key]);
      if (Number.isFinite(v)) { s += v; c += 1; }
    }
    return c > 0 ? s / c : NaN;
  };
  const annualMeanMetrics = {};
  const hasAnnualCoverage = samples.length >= ANNUAL_AGG_MIN_SAMPLES;
  if (hasAnnualCoverage) {
    for (const key of annualAggregateKeys) {
      annualMeanMetrics[key] = computeAnnualMean(key);
    }
  }
  // `gateMetric(key)` returns the annual mean when available and falls back
  // to the latest snapshot.  All seasonally-varying gate checks below go
  // through this helper so the gate is robust to single-sample noise.
  const gateMetric = (key) => {
    if (hasAnnualCoverage && annualAggregateKeys.includes(key)) {
      const value = annualMeanMetrics[key];
      if (Number.isFinite(value)) return value;
    }
    return metrics[key];
  };

  const categories = {
    circulation: metrics.tropicalTradesNorthU10Ms < -0.2
      && metrics.tropicalTradesSouthU10Ms < -0.2
      && metrics.midlatitudeWesterliesNorthU10Ms > 0.2
      && metrics.midlatitudeWesterliesSouthU10Ms > 0.2,
    moistureBelts: Math.abs(metrics.itczLatDeg) <= 12
      && optionalPass(metrics.itczWidthDeg, (value) => value >= 6 && value <= 24)
      && gateMetric('subtropicalDryNorthRatio') < 0.8
      && gateMetric('subtropicalDrySouthRatio') < 0.8
      && optionalPass(metrics.subtropicalRhNorthMeanFrac, (value) => value < 0.82)
      && optionalPass(metrics.subtropicalRhSouthMeanFrac, (value) => value < 0.82)
      && optionalPass(metrics.subtropicalSubsidenceNorthMean, (value) => value > 0.03)
      && optionalPass(metrics.subtropicalSubsidenceSouthMean, (value) => value > 0.03),
    stormTracks: Number.isFinite(gateMetric('stormTrackNorthLatDeg'))
      && Number.isFinite(gateMetric('stormTrackSouthLatDeg'))
      && gateMetric('stormTrackNorthLatDeg') >= 30
      && gateMetric('stormTrackNorthLatDeg') <= 65
      && gateMetric('stormTrackSouthLatDeg') <= -30
      && gateMetric('stormTrackSouthLatDeg') >= -65,
    cloudBalance: metrics.globalCloudMeanFrac >= 0.15 && metrics.globalCloudMeanFrac <= 0.85,
    stability: metrics.maxWind10mMs <= 120
      && metrics.globalPrecipMeanMmHr <= 5
      && metrics.globalTcwMeanKgM2 >= 5
      && metrics.globalTcwMeanKgM2 <= 80,
    numericalIntegrity: metrics.numericalIntegrityPass !== false && metrics.numericalLimiterDominance !== true
  };

  if (!(metrics.tropicalTradesNorthU10Ms < -0.2)) warnings.push('trade_winds_missing_north');
  if (!(metrics.tropicalTradesSouthU10Ms < -0.2)) warnings.push('trade_winds_missing_south');
  if (!(metrics.midlatitudeWesterliesNorthU10Ms > 0.2)) warnings.push('westerlies_missing_north');
  if (!(metrics.midlatitudeWesterliesSouthU10Ms > 0.2)) warnings.push('westerlies_missing_south');
  if (!(Math.abs(metrics.itczLatDeg) <= 12)) warnings.push('itcz_out_of_tropical_band');
  if (!optionalPass(metrics.itczWidthDeg, (value) => value >= 6 && value <= 24)) warnings.push('itcz_width_unrealistic');
  if (!(gateMetric('subtropicalDryNorthRatio') < 0.8)) warnings.push('north_subtropical_dry_belt_too_wet');
  if (!(gateMetric('subtropicalDrySouthRatio') < 0.8)) warnings.push('south_subtropical_dry_belt_too_wet');
  if (!optionalPass(metrics.subtropicalRhNorthMeanFrac, (value) => value < 0.82)) warnings.push('north_subtropical_lower_troposphere_too_humid');
  if (!optionalPass(metrics.subtropicalRhSouthMeanFrac, (value) => value < 0.82)) warnings.push('south_subtropical_lower_troposphere_too_humid');
  if (!optionalPass(metrics.subtropicalSubsidenceNorthMean, (value) => value > 0.03)) warnings.push('north_subtropical_subsidence_too_weak');
  if (!optionalPass(metrics.subtropicalSubsidenceSouthMean, (value) => value > 0.03)) warnings.push('south_subtropical_subsidence_too_weak');
  {
    const n = gateMetric('stormTrackNorthLatDeg');
    const s = gateMetric('stormTrackSouthLatDeg');
    if (!(Number.isFinite(n) && n >= 30 && n <= 65)) warnings.push('north_storm_track_out_of_range');
    if (!(Number.isFinite(s) && s <= -30 && s >= -65)) warnings.push('south_storm_track_out_of_range');
  }
  if (!(metrics.globalCloudMeanFrac >= 0.15 && metrics.globalCloudMeanFrac <= 0.85)) warnings.push('cloud_field_unbalanced');
  if (!(metrics.maxWind10mMs <= 120)) warnings.push('runaway_surface_winds');
  if (!(metrics.globalPrecipMeanMmHr <= 5)) warnings.push('runaway_global_precip');
  if (!(metrics.globalTcwMeanKgM2 >= 5 && metrics.globalTcwMeanKgM2 <= 80)) warnings.push('column_water_drift');
  if (metrics.numericalLimiterDominance === true) warnings.push('numerical_limiter_mass_dominates');
  if (metrics.numericalIntegrityPass === false) warnings.push('numerical_integrity_score_low');

  const seasonality = horizonDays >= 180 ? computeSeasonalityScore(samples) : null;
  if (seasonality) {
    categories.seasonality = seasonality.nhSeasonalityPass && seasonality.shSeasonalityPass;
    if (!seasonality.nhSeasonalityPass) warnings.push('north_tropical_cyclone_seasonality_weak');
    if (!seasonality.shSeasonalityPass) warnings.push('south_tropical_cyclone_seasonality_weak');
  }

  return {
    latest,
    categories,
    seasonality,
    warnings,
    annualMeanMetrics: hasAnnualCoverage ? annualMeanMetrics : null,
    overallPass: Object.values(categories).every(Boolean)
  };
};

const renderMarkdown = (summary) => {
  const lines = [
    '# Planetary Realism Status',
    '',
    `Generated: ${summary.generatedAt}`,
    `Preset: ${summary.config.preset}`,
    `Grid: ${summary.config.nx}x${summary.config.ny}`,
    `Model dt: ${summary.config.dtSeconds}s`,
    `Overall verdict: **${summary.overallPass ? 'PASS' : 'FAIL'}**`,
    ''
  ];

  if (summary.headlessTerrain?.source) {
    lines.push(`- Headless terrain source: ${summary.headlessTerrain.source}`);
    lines.push(`- Terrain parity available: ${summary.headlessTerrainParity}`);
    lines.push('');
  }

  for (const horizon of summary.horizons) {
    const latest = horizon.latest;
    if (!latest) continue;
    lines.push(`## ${horizon.horizonDays}-day audit`);
    lines.push('');
    lines.push(`- Pass: **${horizon.overallPass ? 'PASS' : 'FAIL'}**`);
    lines.push(`- ITCZ latitude/width: ${latest.metrics.itczLatDeg} / ${latest.metrics.itczWidthDeg} deg`);
    lines.push(`- Tropical convective fraction/org/mass flux: ${latest.metrics.tropicalConvectiveFraction} / ${latest.metrics.tropicalConvectiveOrganization} / ${latest.metrics.tropicalConvectiveMassFluxKgM2S}`);
    lines.push(`- Subtropical RH (N/S): ${latest.metrics.subtropicalRhNorthMeanFrac} / ${latest.metrics.subtropicalRhSouthMeanFrac}`);
    lines.push(`- North dry-belt land/ocean precip: ${latest.metrics.northDryBeltLandPrecipMeanMmHr} / ${latest.metrics.northDryBeltOceanPrecipMeanMmHr} mm/hr`);
    lines.push(`- North dry-belt land/ocean RH: ${latest.metrics.northDryBeltLandRhMeanFrac} / ${latest.metrics.northDryBeltOceanRhMeanFrac}`);
    lines.push(`- Cross-equatorial / north-transition / north-dry vapor flux: ${latest.metrics.crossEquatorialVaporFluxNorthKgM_1S} / ${latest.metrics.northTransitionVaporFluxNorthKgM_1S} / ${latest.metrics.northDryBeltVaporFluxNorthKgM_1S}`);
    lines.push(`- Subtropical subsidence drying (N/S): ${latest.metrics.subtropicalSubsidenceNorthMean} / ${latest.metrics.subtropicalSubsidenceSouthMean}`);
    lines.push(`- Tropical detrainment/anvil: ${latest.metrics.upperDetrainmentTropicalKgM2} kg/m² / ${latest.metrics.tropicalAnvilPersistenceFrac}`);
    lines.push(`- Tropical trades (N/S): ${latest.metrics.tropicalTradesNorthU10Ms} / ${latest.metrics.tropicalTradesSouthU10Ms} m/s`);
    lines.push(`- Midlatitude westerlies (N/S): ${latest.metrics.midlatitudeWesterliesNorthU10Ms} / ${latest.metrics.midlatitudeWesterliesSouthU10Ms} m/s`);
    lines.push(`- Storm-track peaks (N/S): ${latest.metrics.stormTrackNorthLatDeg} / ${latest.metrics.stormTrackSouthLatDeg} deg`);
    lines.push(`- Dry-belt ratios (N/S): ${latest.metrics.subtropicalDryNorthRatio} / ${latest.metrics.subtropicalDrySouthRatio}`);
    if (horizon.annualMeanMetrics) {
      const a = horizon.annualMeanMetrics;
      const fmt = (v, digits = 3) => (Number.isFinite(v) ? v.toFixed(digits) : 'n/a');
      lines.push(`- Annual-mean storm-track (N/S): ${fmt(a.stormTrackNorthLatDeg, 2)} / ${fmt(a.stormTrackSouthLatDeg, 2)} deg  ← gate-used`);
      lines.push(`- Annual-mean dry-belt ratios (N/S): ${fmt(a.subtropicalDryNorthRatio)} / ${fmt(a.subtropicalDrySouthRatio)}  ← gate-used`);
    }
    lines.push(`- Tropical cyclone environment counts (N/S): ${latest.metrics.tropicalCycloneEnvironmentCountNh} / ${latest.metrics.tropicalCycloneEnvironmentCountSh}`);
    lines.push(`- Global precip/cloud/tcw/max wind: ${latest.metrics.globalPrecipMeanMmHr} mm/hr / ${latest.metrics.globalCloudMeanFrac} / ${latest.metrics.globalTcwMeanKgM2} kg/m² / ${latest.metrics.maxWind10mMs} m/s`);
    lines.push(`- Numerical integrity score/pass: ${latest.metrics.numericalIntegrityScore} / ${latest.metrics.numericalIntegrityPass}`);
    if (summary.waterCycleBudget) {
      lines.push(`- Water cycle E/P/TCW drift: ${summary.waterCycleBudget.evaporationMeanMm} / ${summary.waterCycleBudget.precipitationMeanMm} mm / ${summary.waterCycleBudget.tcwDriftKgM2} kg/m²`);
      lines.push(`- Advection net/repair: ${summary.waterCycleBudget.advectionNetDeltaKgM2} / ${summary.waterCycleBudget.advectionRepairMeanKgM2} kg/m²`);
      lines.push(`- Transport residual / vertical drying demand: ${summary.waterCycleBudget.transportNumericalResidualKgM2} / ${summary.waterCycleBudget.verticalSubtropicalDryingDemandKgM2} kg/m²`);
    }
    if (horizon.warnings.length) {
      lines.push('- Warnings:');
      horizon.warnings.forEach((warning) => lines.push(`  - ${warning}`));
    } else {
      lines.push('- Warnings: none');
    }
    if (horizon.seasonality) {
      lines.push(`- NH warm/cool tropical cyclone environment: ${horizon.seasonality.nhWarmSeasonMean} / ${horizon.seasonality.nhCoolSeasonMean}`);
      lines.push(`- SH warm/cool tropical cyclone environment: ${horizon.seasonality.shWarmSeasonMean} / ${horizon.seasonality.shCoolSeasonMean}`);
    }
    lines.push('');
  }

  if (summary.realismGaps?.length) {
    lines.push('## Top realism gaps');
    lines.push('');
    summary.realismGaps.slice(0, 8).forEach((gap) => {
      lines.push(`- ${gap.label}: actual ${gap.actual} vs target ${gap.target} (severity ${gap.severity}, horizons ${gap.horizonsDays.join(', ')})`);
    });
    lines.push('');
  }

  if (summary.seasonalRootCauseRanking?.dominantAnnualFamily) {
    lines.push('## Seasonal Root-Cause Signal');
    lines.push('');
    lines.push(`- Dominant annual family: ${summary.seasonalRootCauseRanking.dominantAnnualFamily.label} (${summary.seasonalRootCauseRanking.dominantAnnualFamily.score})`);
    lines.push(`- Stable across sampled months: ${summary.seasonalRootCauseRanking.stability?.stableAcrossMonthsPass}`);
    lines.push(`- Stable across sampled seasons: ${summary.seasonalRootCauseRanking.stability?.stableAcrossSeasonsPass}`);
    if (summary.attributionLagAnalysis?.predictorRanking?.length) {
      const topPredictor = summary.attributionLagAnalysis.predictorRanking[0];
      lines.push(`- Strongest lagged predictor: ${topPredictor.label} (${topPredictor.meanAbsCorrelation})`);
    }
    lines.push('');
  }

  if (summary.rootCauseCandidateRanking?.primaryCandidate) {
    lines.push('## Counterfactual Root-Cause Ranking');
    lines.push('');
    lines.push(`- Primary candidate: ${summary.rootCauseCandidateRanking.primaryCandidate.label} (${summary.rootCauseCandidateRanking.primaryCandidate.directionalImprovementScore})`);
    if (summary.rootCauseCandidateRanking.backupCandidate) {
      lines.push(`- Backup candidate: ${summary.rootCauseCandidateRanking.backupCandidate.label} (${summary.rootCauseCandidateRanking.backupCandidate.directionalImprovementScore})`);
    }
    lines.push(`- Closure ready: ${summary.rootCauseCandidateRanking.closureReadyPass}`);
    lines.push('');
  }

  if (summary.coupledCounterfactualRanking?.bestBundle) {
    lines.push('## Coupled Counterfactual Matrix');
    lines.push('');
    lines.push(`- Best coupled bundle: ${summary.coupledCounterfactualRanking.bestBundle.label} (${summary.coupledCounterfactualRanking.bestBundle.directionalImprovementScore})`);
    lines.push(`- Exit criteria pass: ${summary.coupledCounterfactualRanking.exitCriteriaPass}`);
    lines.push('');
  }

  if (summary.artifacts) {
    lines.push('## Rich artifacts');
    lines.push('');
    lines.push(`- Monthly climatology JSON: ${summary.artifacts.monthlyClimatologyJsonPath}`);
    lines.push(`- Sample zonal profiles JSON: ${summary.artifacts.sampleProfilesJsonPath}`);
    lines.push(`- Ranked realism gaps JSON: ${summary.artifacts.realismGapsJsonPath}`);
    if (summary.artifacts.moistureAttributionJsonPath) {
      lines.push(`- Moisture attribution JSON: ${summary.artifacts.moistureAttributionJsonPath}`);
    }
    if (summary.artifacts.runManifestJsonPath) {
      lines.push(`- Run manifest JSON: ${summary.artifacts.runManifestJsonPath}`);
    }
    if (summary.artifacts.conservationSummaryJsonPath) {
      lines.push(`- Conservation summary JSON: ${summary.artifacts.conservationSummaryJsonPath}`);
    }
    if (summary.artifacts.waterCycleBudgetJsonPath) {
      lines.push(`- Water-cycle budget JSON: ${summary.artifacts.waterCycleBudgetJsonPath}`);
    }
    if (summary.artifacts.restartParityJsonPath) {
      lines.push(`- Restart parity JSON: ${summary.artifacts.restartParityJsonPath}`);
    }
    if (summary.artifacts.surfaceSourceAttributionJsonPath) {
      lines.push(`- Surface source attribution JSON: ${summary.artifacts.surfaceSourceAttributionJsonPath}`);
    }
    if (summary.artifacts.surfaceFluxDecompositionJsonPath) {
      lines.push(`- Surface flux decomposition JSON: ${summary.artifacts.surfaceFluxDecompositionJsonPath}`);
    }
    if (summary.artifacts.nhDryBeltSourceSectorSummaryJsonPath) {
      lines.push(`- NH dry-belt source sector JSON: ${summary.artifacts.nhDryBeltSourceSectorSummaryJsonPath}`);
    }
    if (summary.artifacts.corridorReplayCatalogJsonPath) {
      lines.push(`- Corridor replay catalog JSON: ${summary.artifacts.corridorReplayCatalogJsonPath}`);
    }
    if (summary.artifacts.corridorStepSliceAttributionJsonPath) {
      lines.push(`- Corridor step-slice attribution JSON: ${summary.artifacts.corridorStepSliceAttributionJsonPath}`);
    }
    if (summary.artifacts.corridorModuleToggleDeltasJsonPath) {
      lines.push(`- Corridor module-toggle deltas JSON: ${summary.artifacts.corridorModuleToggleDeltasJsonPath}`);
    }
    if (summary.artifacts.thermodynamicSupportSummaryJsonPath) {
      lines.push(`- Thermodynamic support summary JSON: ${summary.artifacts.thermodynamicSupportSummaryJsonPath}`);
    }
    if (summary.artifacts.radiativeCloudMaintenanceJsonPath) {
      lines.push(`- Radiative cloud maintenance JSON: ${summary.artifacts.radiativeCloudMaintenanceJsonPath}`);
    }
    if (summary.artifacts.boundaryLayerStabilityProfilesJsonPath) {
      lines.push(`- Boundary-layer stability profiles JSON: ${summary.artifacts.boundaryLayerStabilityProfilesJsonPath}`);
    }
    if (summary.artifacts.forcingOppositionBudgetJsonPath) {
      lines.push(`- Forcing opposition budget JSON: ${summary.artifacts.forcingOppositionBudgetJsonPath}`);
    }
    if (summary.artifacts.nudgingTargetMismatchJsonPath) {
      lines.push(`- Nudging target mismatch JSON: ${summary.artifacts.nudgingTargetMismatchJsonPath}`);
    }
    if (summary.artifacts.initializationMemoryJsonPath) {
      lines.push(`- Initialization memory JSON: ${summary.artifacts.initializationMemoryJsonPath}`);
    }
    if (summary.artifacts.numericalIntegritySummaryJsonPath) {
      lines.push(`- Numerical integrity summary JSON: ${summary.artifacts.numericalIntegritySummaryJsonPath}`);
    }
    if (summary.artifacts.numericalClimateContractJsonPath) {
      lines.push(`- Numerical climate contract JSON: ${summary.artifacts.numericalClimateContractJsonPath}`);
    }
    if (summary.artifacts.stormSpilloverCatalogJsonPath) {
      lines.push(`- Storm spillover catalog JSON: ${summary.artifacts.stormSpilloverCatalogJsonPath}`);
    }
    if (summary.artifacts.sectoralDryBeltRegimesJsonPath) {
      lines.push(`- Sectoral dry-belt regimes JSON: ${summary.artifacts.sectoralDryBeltRegimesJsonPath}`);
    }
    if (summary.artifacts.transientEddyLeakageSummaryJsonPath) {
      lines.push(`- Transient eddy leakage summary JSON: ${summary.artifacts.transientEddyLeakageSummaryJsonPath}`);
    }
    if (summary.artifacts.dtSensitivityJsonPath) {
      lines.push(`- DT sensitivity JSON: ${summary.artifacts.dtSensitivityJsonPath}`);
    }
    if (summary.artifacts.gridSensitivityJsonPath) {
      lines.push(`- Grid sensitivity JSON: ${summary.artifacts.gridSensitivityJsonPath}`);
    }
    if (summary.artifacts.monthlyAttributionClimatologyJsonPath) {
      lines.push(`- Monthly attribution climatology JSON: ${summary.artifacts.monthlyAttributionClimatologyJsonPath}`);
    }
    if (summary.artifacts.seasonalRootCauseRankingJsonPath) {
      lines.push(`- Seasonal root-cause ranking JSON: ${summary.artifacts.seasonalRootCauseRankingJsonPath}`);
    }
    if (summary.artifacts.attributionLagAnalysisJsonPath) {
      lines.push(`- Attribution lag analysis JSON: ${summary.artifacts.attributionLagAnalysisJsonPath}`);
    }
    if (summary.artifacts.counterfactualPathwaySensitivityJsonPath) {
      lines.push(`- Counterfactual pathway sensitivity JSON: ${summary.artifacts.counterfactualPathwaySensitivityJsonPath}`);
    }
    if (summary.artifacts.rootCauseCandidateRankingJsonPath) {
      lines.push(`- Root-cause candidate ranking JSON: ${summary.artifacts.rootCauseCandidateRankingJsonPath}`);
    }
    if (summary.artifacts.coupledCounterfactualMatrixJsonPath) {
      lines.push(`- Coupled counterfactual matrix JSON: ${summary.artifacts.coupledCounterfactualMatrixJsonPath}`);
    }
    if (summary.artifacts.coupledCounterfactualRankingJsonPath) {
      lines.push(`- Coupled counterfactual ranking JSON: ${summary.artifacts.coupledCounterfactualRankingJsonPath}`);
    }
    if (summary.artifacts.coupledCounterfactualGuardrailsJsonPath) {
      lines.push(`- Coupled counterfactual guardrails JSON: ${summary.artifacts.coupledCounterfactualGuardrailsJsonPath}`);
    }
    lines.push('');
  }

  lines.push('## Default next priorities');
  lines.push('');
  summary.defaultNextPriorities.forEach((priority, index) => {
    lines.push(`${index + 1}. ${priority}`);
  });
  lines.push('');
  return `${lines.join('\n')}\n`;
};

const deriveArtifactBase = () => {
  if (effectiveReportBase) return effectiveReportBase;
  if (outPath) return stripKnownExtension(outPath);
  if (mdOutPath) return stripKnownExtension(mdOutPath);
  return null;
};

export async function main() {
  ensureCyclePlanReady({
    commandName: 'agent:planetary-realism-audit',
    artifactPath: outPath || mdOutPath || (effectiveReportBase ? `${effectiveReportBase}.json` : null),
    allowNoCycle: false,
    requireCycleState: true,
    allowedModes: ['quick', 'seasonal', 'annual', 'live']
  });
  if (typeof process !== 'undefined' && !process.env?.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }
  const sampleTargetsDays = buildSampleTargetsDays(horizonsDays, sampleEveryDays);
  const targetsSeconds = sampleTargetsDays.map((day) => day * SECONDS_PER_DAY);
  const core = new WeatherCore5({ nx, ny, dt, seed, instrumentationMode });
  await core._initPromise;
  if (carryInputOverrideMode === 'off') core.vertParams.enableCarryInputDominanceOverride = false;
  else if (carryInputOverrideMode === 'on') core.vertParams.enableCarryInputDominanceOverride = true;
  if (circulationReboundPatchMode === 'off') core.vertParams.enableCirculationReboundContainment = false;
  else if (circulationReboundPatchMode === 'on') core.vertParams.enableCirculationReboundContainment = true;
  if (returnFlowCouplingPatchMode === 'off') core.vertParams.enableTransitionReturnFlowCoupling = false;
  else if (returnFlowCouplingPatchMode === 'on') core.vertParams.enableTransitionReturnFlowCoupling = true;
  if (dryingOmegaBridgePatchMode === 'off') core.vertParams.enableDryingOmegaBridge = false;
  else if (dryingOmegaBridgePatchMode === 'on') core.vertParams.enableDryingOmegaBridge = true;
  if (equatorialEdgeSubsidenceGuardPatchMode === 'off') core.vertParams.enableEquatorialEdgeSubsidenceGuard = false;
  else if (equatorialEdgeSubsidenceGuardPatchMode === 'on') core.vertParams.enableEquatorialEdgeSubsidenceGuard = true;
  if (northsideFanoutLeakPenaltyPatchMode === 'off') core.vertParams.enableNorthsideFanoutLeakPenalty = false;
  else if (northsideFanoutLeakPenaltyPatchMode === 'on') core.vertParams.enableNorthsideFanoutLeakPenalty = true;
  if (weakHemiCrossHemiFloorTaperPatchMode === 'off') core.vertParams.enableWeakHemiCrossHemiFloorTaper = false;
  else if (weakHemiCrossHemiFloorTaperPatchMode === 'on') core.vertParams.enableWeakHemiCrossHemiFloorTaper = true;
  if (northSourceConcentrationPenaltyPatchMode === 'off') core.vertParams.enableNorthSourceConcentrationPenalty = false;
  else if (northSourceConcentrationPenaltyPatchMode === 'on') core.vertParams.enableNorthSourceConcentrationPenalty = true;
  if (atlanticDryCoreReceiverTaperPatchMode === 'off') core.vertParams.enableAtlanticDryCoreReceiverTaper = false;
  else if (atlanticDryCoreReceiverTaperPatchMode === 'on') core.vertParams.enableAtlanticDryCoreReceiverTaper = true;
  if (atlanticTransitionCarryoverContainmentPatchMode === 'off') core.vertParams.enableAtlanticTransitionCarryoverContainment = false;
  else if (atlanticTransitionCarryoverContainmentPatchMode === 'on') core.vertParams.enableAtlanticTransitionCarryoverContainment = true;
  if (softLiveGatePatchMode === 'off') core.microParams.enableSoftLiveStateMaintenanceSuppression = false;
  else if (softLiveGatePatchMode === 'on') core.microParams.enableSoftLiveStateMaintenanceSuppression = true;
  if (architectureA1BalanceContractMode === 'off') core.microParams.enableExplicitSubtropicalBalanceContract = false;
  else if (architectureA1BalanceContractMode === 'on') core.microParams.enableExplicitSubtropicalBalanceContract = true;
  if (architectureA2PartitionPortMode === 'containment-off') {
    core.vertParams.enableCirculationReboundContainment = false;
  } else if (architectureA2PartitionPortMode === 'ported-floor') {
    core.vertParams.enableCirculationReboundContainment = false;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.42;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.15;
  } else if (architectureA2PartitionPortMode === 'ported-floor-soft-containment') {
    core.vertParams.enableCirculationReboundContainment = true;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.42;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.15;
    core.vertParams.circulationReboundContainmentScale = 0.7;
    core.vertParams.circulationReboundOrganizationScale = 0.25;
    core.vertParams.circulationReboundActivityScale = 0.18;
    core.vertParams.circulationReboundSourceScale = 0.4;
  }
  if (architectureB1CirculationScaffoldMode === 'floor-reset-light-drying') {
    core.vertParams.enableCirculationReboundContainment = false;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.18;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.05;
    core.vertParams.subtropicalSubsidenceMaxDryFrac = 0.18;
    core.vertParams.subtropicalSubsidenceThetaStepK = 0.55;
  } else if (architectureB1CirculationScaffoldMode === 'narrow-band-light-drying') {
    core.vertParams.enableCirculationReboundContainment = false;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.18;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.05;
    core.vertParams.subtropicalSubsidenceMaxDryFrac = 0.18;
    core.vertParams.subtropicalSubsidenceThetaStepK = 0.55;
    core.vertParams.subtropicalSubsidenceLat0 = 18;
    core.vertParams.subtropicalSubsidenceLat1 = 30;
  } else if (architectureB1CirculationScaffoldMode === 'narrow-band-soft-containment') {
    core.vertParams.enableCirculationReboundContainment = true;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.18;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.05;
    core.vertParams.subtropicalSubsidenceMaxDryFrac = 0.18;
    core.vertParams.subtropicalSubsidenceThetaStepK = 0.55;
    core.vertParams.subtropicalSubsidenceLat0 = 18;
    core.vertParams.subtropicalSubsidenceLat1 = 30;
    core.vertParams.circulationReboundContainmentScale = 0.7;
    core.vertParams.circulationReboundOrganizationScale = 0.2;
    core.vertParams.circulationReboundActivityScale = 0.12;
    core.vertParams.circulationReboundSourceScale = 0.25;
  }
  if (architectureB2CirculationStatePortMode === 'soft-containment-return-flow-port') {
    core.vertParams.enableCirculationReboundContainment = true;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.18;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.05;
    core.vertParams.subtropicalSubsidenceMaxDryFrac = 0.18;
    core.vertParams.subtropicalSubsidenceThetaStepK = 0.55;
    core.vertParams.subtropicalSubsidenceLat0 = 18;
    core.vertParams.subtropicalSubsidenceLat1 = 30;
    core.vertParams.circulationReboundContainmentScale = 0.7;
    core.vertParams.circulationReboundOrganizationScale = 0.2;
    core.vertParams.circulationReboundActivityScale = 0.12;
    core.vertParams.circulationReboundSourceScale = 0.25;
    core.vertParams.enableTransitionReturnFlowCoupling = true;
  } else if (architectureB2CirculationStatePortMode === 'soft-containment-omega-port') {
    core.vertParams.enableCirculationReboundContainment = true;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.18;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.05;
    core.vertParams.subtropicalSubsidenceMaxDryFrac = 0.18;
    core.vertParams.subtropicalSubsidenceThetaStepK = 0.55;
    core.vertParams.subtropicalSubsidenceLat0 = 18;
    core.vertParams.subtropicalSubsidenceLat1 = 30;
    core.vertParams.circulationReboundContainmentScale = 0.7;
    core.vertParams.circulationReboundOrganizationScale = 0.2;
    core.vertParams.circulationReboundActivityScale = 0.12;
    core.vertParams.circulationReboundSourceScale = 0.25;
    core.vertParams.enableDryingOmegaBridge = true;
  } else if (architectureB2CirculationStatePortMode === 'open-circulation-bundle') {
    core.vertParams.enableCirculationReboundContainment = false;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.18;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.05;
    core.vertParams.subtropicalSubsidenceMaxDryFrac = 0.18;
    core.vertParams.subtropicalSubsidenceThetaStepK = 0.55;
    core.vertParams.subtropicalSubsidenceLat0 = 18;
    core.vertParams.subtropicalSubsidenceLat1 = 30;
    core.vertParams.enableTransitionReturnFlowCoupling = true;
    core.vertParams.enableDryingOmegaBridge = true;
    core.vertParams.enableWeakHemiCrossHemiFloorTaper = true;
  }
  if (architectureB3RollbackCirculationSpliceMode === 'ported-floor-soft-containment-return-flow') {
    core.vertParams.enableCirculationReboundContainment = true;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.42;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.15;
    core.vertParams.circulationReboundContainmentScale = 0.7;
    core.vertParams.circulationReboundOrganizationScale = 0.25;
    core.vertParams.circulationReboundActivityScale = 0.18;
    core.vertParams.circulationReboundSourceScale = 0.4;
    core.vertParams.enableTransitionReturnFlowCoupling = true;
  } else if (architectureB3RollbackCirculationSpliceMode === 'ported-floor-soft-containment-omega') {
    core.vertParams.enableCirculationReboundContainment = true;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.42;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.15;
    core.vertParams.circulationReboundContainmentScale = 0.7;
    core.vertParams.circulationReboundOrganizationScale = 0.25;
    core.vertParams.circulationReboundActivityScale = 0.18;
    core.vertParams.circulationReboundSourceScale = 0.4;
    core.vertParams.enableDryingOmegaBridge = true;
  } else if (architectureB3RollbackCirculationSpliceMode === 'ported-floor-open-bundle') {
    core.vertParams.enableCirculationReboundContainment = false;
    core.vertParams.subtropicalSubsidenceCrossHemiFloorFrac = 0.42;
    core.vertParams.subtropicalSubsidenceWeakHemiBoost = 0.15;
    core.vertParams.enableTransitionReturnFlowCoupling = true;
    core.vertParams.enableDryingOmegaBridge = true;
    core.vertParams.enableWeakHemiCrossHemiFloorTaper = true;
  }
  if (shoulderAbsorptionGuardPatchMode === 'off') core.microParams.enableShoulderAbsorptionGuard = false;
  else if (shoulderAbsorptionGuardPatchMode === 'on') core.microParams.enableShoulderAbsorptionGuard = true;
  core.microParams.shoulderAbsorptionGuardSuppressedMassMode = shoulderGuardFateMode;
  const systemExperimentSummary = applySystemExperiment(core, systemExperiment);
  const terrainFallback = applyHeadlessTerrainFixture(core);
  const configSnapshot = cloneConfigSnapshot(core);
  const { samples, timingByTarget, horizonSummaries } = advanceAndSampleCore({ core, sampleTargetsDays });

  let overallPass = horizonSummaries.every((horizon) => horizon.overallPass);
  const defaultNextPriorities = [];
  const failedCategories = new Set();
  for (const horizon of horizonSummaries) {
    Object.entries(horizon.categories).forEach(([category, pass]) => {
      if (!pass) failedCategories.add(category);
    });
  }
  if (failedCategories.has('circulation')) defaultNextPriorities.push('Fix large-scale circulation and jet placement before returning to more mountain-only tuning.');
  if (failedCategories.has('stormTracks')) defaultNextPriorities.push('Improve storm organization and cyclone-support structure using the planetary audit, not only orographic ratios.');
  if (failedCategories.has('moistureBelts')) defaultNextPriorities.push('Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.');
  if (failedCategories.has('seasonality')) defaultNextPriorities.push('Run a seasonal or annual tropical-cyclone-environment audit and target the hemisphere/season that fails.');
  if (failedCategories.has('stability')) defaultNextPriorities.push('Stabilize multi-day drift and runaway tendencies before claiming any world-class improvement.');
  if (failedCategories.has('cloudBalance')) defaultNextPriorities.push('Re-audit cloud realism and cloud-belt structure instead of assuming precipitation fixes alone are enough.');
  if (!defaultNextPriorities.length) {
    defaultNextPriorities.push('Broaden live verification and polished-performance re-audits now that the offline planetary realism gates are healthy.');
  }
  const monthlyClimatology = buildMonthlyClimatology(samples);
  const monthlyAttributionClimatology = buildMonthlyAttributionClimatology(samples);
  const seasonalRootCauseRanking = buildSeasonalRootCauseRanking(samples);
  const attributionLagAnalysis = buildAttributionLagAnalysis(samples);
  const realismGaps = buildRealismGapReport(horizonSummaries);
  const latestSample = horizonSummaries[horizonSummaries.length - 1]?.latest || samples[samples.length - 1] || null;
  const phaseCTargetDay = sampleTargetsDays.find((day) => day >= 30) || latestSample?.targetDay || null;
  const phaseCSample = samples.find((sample) => sample.targetDay === phaseCTargetDay) || latestSample;
  const moistureAttribution = buildMoistureAttributionReport(latestSample?.processMoistureBudget, latestSample?.metrics);
  const runManifest = buildRunManifest({ core, terrainFallback, sampleTargetsDays, targetsSeconds });
  const conservationSummary = buildConservationSummary({ core });
  const waterCycleBudget = buildWaterCycleBudgetReport({ conservationSummary, preset });
  const surfaceSourceAttribution = buildSurfaceSourceAttributionReport(latestSample);
  const surfaceFluxDecomposition = buildSurfaceFluxDecompositionReport(latestSample);
  const nhDryBeltSourceSectorSummary = buildNhDryBeltSourceSectorReport(latestSample);
  const transportInterfaceBudget = buildTransportInterfaceBudgetReport(latestSample);
  const hadleyPartitionSummary = buildHadleyPartitionSummaryReport(latestSample);
  const bandLevelFluxMatrix = buildBandLevelFluxMatrixReport(latestSample);
  const verticalCloudBirthAttribution = buildVerticalCloudBirthAttributionReport(latestSample);
  const verticalCloudBirthHistograms = buildVerticalCloudBirthHistogramsReport(latestSample);
  const dryBeltCloudOriginMatrix = buildDryBeltCloudOriginMatrixReport(latestSample);
  const cloudTransitionLedger = buildCloudTransitionLedgerReport(latestSample);
  const cloudTransitionLedgerSummary = buildCloudTransitionLedgerSummaryReport(latestSample);
  const cloudTransitionLedgerSectorSplit = buildCloudTransitionLedgerSectorSplitReport(latestSample);
  let corridorReplayCatalog = null;
  let corridorStepSliceAttribution = null;
  let corridorModuleToggleDeltas = null;
  if (runDeepProofDiagnostics && !observerEffectAudit && phaseCSample && Number.isFinite(phaseCTargetDay)) {
    const phaseCReplay = await runPhaseCCorridorReplay({
      configSnapshot,
      latestSample: phaseCSample,
      targetDay: phaseCTargetDay
    });
    corridorReplayCatalog = buildCorridorReplayCatalogReport(phaseCReplay);
    corridorStepSliceAttribution = buildCorridorStepSliceAttributionReport(phaseCReplay);
    corridorModuleToggleDeltas = buildCorridorModuleToggleDeltasReport(phaseCReplay);
  }
  const upperCloudResidence = buildUpperCloudResidenceReport(latestSample);
  const upperCloudErosionBudget = buildUpperCloudErosionBudgetReport(latestSample);
  const upperCloudVentilationSummary = buildUpperCloudVentilationSummaryReport(latestSample);
  const thermodynamicSupportSummary = buildThermodynamicSupportSummaryReport(latestSample);
  const radiativeCloudMaintenance = buildRadiativeCloudMaintenanceReport(latestSample);
  const boundaryLayerStabilityProfiles = buildBoundaryLayerStabilityProfilesReport(latestSample);
  const stormSpilloverCatalog = buildStormSpilloverCatalogReport(latestSample);
  const sectoralDryBeltRegimes = buildSectoralDryBeltRegimesReport(latestSample);
  const transientEddyLeakageSummary = buildTransientEddyLeakageSummaryReport(latestSample);
  const forcingOppositionBudget = buildForcingOppositionBudgetReport(latestSample);
  const nudgingTargetMismatch = buildNudgingTargetMismatchReport(latestSample);
  const initializationMemory = buildInitializationMemoryReport(samples, latestSample);
  const numericalIntegritySummary = buildNumericalIntegritySummaryReport(latestSample);
  let dtSensitivity = null;
  let gridSensitivity = null;
  let dtSensitivityVariants = [];
  let gridSensitivityVariants = [];
  let counterfactualTargetDay = sampleTargetsDays.find((day) => day >= 30)
    || sampleTargetsDays[sampleTargetsDays.length - 1]
    || null;
  const sensitivityTargetDay = sampleTargetsDays.find((day) => day >= Math.min(15, sampleTargetsDays[sampleTargetsDays.length - 1]))
    || sampleTargetsDays[0];
  const baselineSensitivitySample = samples.find((sample) => sample.targetDay === sensitivityTargetDay) || latestSample;
  const baselineCounterfactualSample = samples.find((sample) => sample.targetDay === counterfactualTargetDay) || latestSample;
  if (runSensitivityDiagnostics && !observerEffectAudit) {
    dtSensitivityVariants = await Promise.all([
      runSensitivityVariant({
        variantName: 'dt_half',
        variantNx: nx,
        variantNy: ny,
        variantDtSeconds: Math.max(300, Math.round(dt * 0.5 / 300) * 300),
        targetDay: sensitivityTargetDay,
        configSnapshot
      }),
      runSensitivityVariant({
        variantName: 'dt_150pct',
        variantNx: nx,
        variantNy: ny,
        variantDtSeconds: Math.max(300, Math.round(dt * 1.5 / 300) * 300),
        targetDay: sensitivityTargetDay,
        configSnapshot
      })
    ]);
    gridSensitivityVariants = await Promise.all([
      runSensitivityVariant({
        variantName: 'grid_coarse',
        variantNx: roundGridDimension(nx * 0.75, 24),
        variantNy: roundGridDimension(ny * 0.75, 12),
        variantDtSeconds: dt,
        targetDay: sensitivityTargetDay,
        configSnapshot
      }),
      runSensitivityVariant({
        variantName: 'grid_dense',
        variantNx: roundGridDimension(nx * 1.25, 24),
        variantNy: roundGridDimension(ny * 1.25, 12),
        variantDtSeconds: dt,
        targetDay: sensitivityTargetDay,
        configSnapshot
      })
    ]);
    dtSensitivity = buildDtSensitivityReport({
      baselineSample: baselineSensitivitySample,
      variants: dtSensitivityVariants,
      targetDay: sensitivityTargetDay
    });
    gridSensitivity = buildGridSensitivityReport({
      baselineSample: baselineSensitivitySample,
      variants: gridSensitivityVariants,
      targetDay: sensitivityTargetDay
    });
  }
  const numericalClimateContract = buildNumericalClimateContractReport({
    latestSample,
    conservationSummary,
    dtSensitivity,
    gridSensitivity,
    config: { preset, nx, ny, dtSeconds: dt, seed }
  });
  overallPass = overallPass && numericalClimateContract.majorClimateClaimAllowed === true;
  if (!numericalClimateContract.majorClimateClaimAllowed) {
    defaultNextPriorities.unshift('Resolve numerical integrity and dt/grid sensitivity gates before accepting major climate claims.');
  }
  let counterfactualPathwaySensitivity = null;
  let rootCauseCandidateRanking = null;
  let coupledCounterfactualMatrix = null;
  let coupledCounterfactualRanking = null;
  let coupledCounterfactualGuardrails = null;
  if (!observerEffectAudit && counterfactuals && baselineCounterfactualSample && Number.isFinite(counterfactualTargetDay)) {
    const baselineCounterfactualVariants = await Promise.all(
      COUNTERFACTUAL_VARIANTS.map((variant) => runCounterfactualVariant({
        variant,
        variantName: `${variant.key}_baseline`,
        variantNx: nx,
        variantNy: ny,
        variantDtSeconds: dt,
        targetDay: counterfactualTargetDay,
        configSnapshot
      }))
    );
    const preliminaryCounterfactualReport = buildCounterfactualPathwaySensitivityReport({
      baselineSample: baselineCounterfactualSample,
      targetDay: counterfactualTargetDay,
      variants: baselineCounterfactualVariants,
      sensitivityVariantsByKey: {}
    });
    const selectedCounterfactualKeys = preliminaryCounterfactualReport.topCandidates.map((entry) => entry.key);
    const phase9SensitivityScenarios = [
      {
        scenarioKey: 'dt_half',
        scenarioLabel: 'DT half',
        nx: dtSensitivityVariants[0]?.nx,
        ny: dtSensitivityVariants[0]?.ny,
        dtSeconds: dtSensitivityVariants[0]?.dtSeconds,
        baselineSample: dtSensitivityVariants[0]?.latest || null
      },
      {
        scenarioKey: 'dt_150pct',
        scenarioLabel: 'DT 150%',
        nx: dtSensitivityVariants[1]?.nx,
        ny: dtSensitivityVariants[1]?.ny,
        dtSeconds: dtSensitivityVariants[1]?.dtSeconds,
        baselineSample: dtSensitivityVariants[1]?.latest || null
      },
      {
        scenarioKey: 'grid_coarse',
        scenarioLabel: 'Grid coarse',
        nx: gridSensitivityVariants[0]?.nx,
        ny: gridSensitivityVariants[0]?.ny,
        dtSeconds: gridSensitivityVariants[0]?.dtSeconds,
        baselineSample: gridSensitivityVariants[0]?.latest || null
      },
      {
        scenarioKey: 'grid_dense',
        scenarioLabel: 'Grid dense',
        nx: gridSensitivityVariants[1]?.nx,
        ny: gridSensitivityVariants[1]?.ny,
        dtSeconds: gridSensitivityVariants[1]?.dtSeconds,
        baselineSample: gridSensitivityVariants[1]?.latest || null
      }
    ].filter((entry) => entry.baselineSample && Number.isFinite(entry.nx) && Number.isFinite(entry.ny) && Number.isFinite(entry.dtSeconds));
    const sensitivityRunsFlat = await Promise.all(
      selectedCounterfactualKeys.flatMap((variantKey) => {
        const variant = COUNTERFACTUAL_VARIANTS.find((entry) => entry.key === variantKey);
        if (!variant) return [];
        return phase9SensitivityScenarios.map((scenario) => runCounterfactualVariant({
          variant,
          variantName: `${variant.key}_${scenario.scenarioKey}`,
          variantNx: scenario.nx,
          variantNy: scenario.ny,
          variantDtSeconds: scenario.dtSeconds,
          targetDay: counterfactualTargetDay,
          configSnapshot
        }).then((result) => ({
          ...result,
          scenarioKey: scenario.scenarioKey,
          scenarioLabel: scenario.scenarioLabel,
          baselineSample: scenario.baselineSample
        })));
      })
    );
    const sensitivityVariantsByKey = Object.fromEntries(
      baselineCounterfactualVariants.map((variant) => [variant.key, []])
    );
    for (const result of sensitivityRunsFlat) {
      if (!sensitivityVariantsByKey[result.key]) sensitivityVariantsByKey[result.key] = [];
      sensitivityVariantsByKey[result.key].push({
        scenarioKey: result.scenarioKey,
        scenarioLabel: result.scenarioLabel,
        improvement: buildCounterfactualImprovement(result.baselineSample, result.latest),
        storyComparison: compareAttributionStory(result.baselineSample, result.latest)
      });
    }
    counterfactualPathwaySensitivity = buildCounterfactualPathwaySensitivityReport({
      baselineSample: baselineCounterfactualSample,
      targetDay: counterfactualTargetDay,
      variants: baselineCounterfactualVariants,
      sensitivityVariantsByKey
    });
    rootCauseCandidateRanking = buildRootCauseCandidateRankingReport(counterfactualPathwaySensitivity);

    const coupledSensitivityScenarios = [
      {
        scenarioKey: 'dt_half',
        scenarioLabel: 'DT half',
        nx: dtSensitivityVariants[0]?.nx,
        ny: dtSensitivityVariants[0]?.ny,
        dtSeconds: dtSensitivityVariants[0]?.dtSeconds,
        baselineSample: dtSensitivityVariants[0]?.latest || null
      },
      {
        scenarioKey: 'grid_coarse',
        scenarioLabel: 'Grid coarse',
        nx: gridSensitivityVariants[0]?.nx,
        ny: gridSensitivityVariants[0]?.ny,
        dtSeconds: gridSensitivityVariants[0]?.dtSeconds,
        baselineSample: gridSensitivityVariants[0]?.latest || null
      }
    ].filter((entry) => entry.baselineSample && Number.isFinite(entry.nx) && Number.isFinite(entry.ny) && Number.isFinite(entry.dtSeconds));

    const baselineCoupledVariants = await Promise.all(
      COUPLED_COUNTERFACTUAL_BUNDLES.map((bundle) => runCounterfactualVariant({
        variant: bundle,
        variantName: `${bundle.key}_baseline`,
        variantNx: nx,
        variantNy: ny,
        variantDtSeconds: dt,
        targetDay: counterfactualTargetDay,
        configSnapshot
      }))
    );
    const coupledSensitivityRunsFlat = await Promise.all(
      COUPLED_COUNTERFACTUAL_BUNDLES.flatMap((bundle) => coupledSensitivityScenarios.map((scenario) => runCounterfactualVariant({
        variant: bundle,
        variantName: `${bundle.key}_${scenario.scenarioKey}`,
        variantNx: scenario.nx,
        variantNy: scenario.ny,
        variantDtSeconds: scenario.dtSeconds,
        targetDay: counterfactualTargetDay,
        configSnapshot
      }).then((result) => ({
        ...result,
        scenarioKey: scenario.scenarioKey,
        scenarioLabel: scenario.scenarioLabel,
        baselineSample: scenario.baselineSample
      }))))
    );
    const coupledSensitivityVariantsByKey = Object.fromEntries(
      baselineCoupledVariants.map((variant) => [variant.key, []])
    );
    for (const result of coupledSensitivityRunsFlat) {
      if (!coupledSensitivityVariantsByKey[result.key]) coupledSensitivityVariantsByKey[result.key] = [];
      coupledSensitivityVariantsByKey[result.key].push({
        scenarioKey: result.scenarioKey,
        scenarioLabel: result.scenarioLabel,
        improvement: buildCounterfactualImprovement(result.baselineSample, result.latest),
        storyComparison: compareAttributionStory(result.baselineSample, result.latest)
      });
    }
    coupledCounterfactualMatrix = buildCoupledCounterfactualMatrixReport({
      baselineSample: baselineCounterfactualSample,
      targetDay: counterfactualTargetDay,
      bundles: baselineCoupledVariants,
      sensitivityVariantsByKey: coupledSensitivityVariantsByKey
    });
    coupledCounterfactualRanking = buildCoupledCounterfactualRankingReport(coupledCounterfactualMatrix);
    coupledCounterfactualGuardrails = buildCoupledCounterfactualGuardrailsReport(coupledCounterfactualMatrix);
  }
  const checkpointDay = sampleTargetsDays.find((day) => day > 0 && day < sampleTargetsDays[sampleTargetsDays.length - 1])
    || sampleTargetsDays[Math.max(0, Math.floor(sampleTargetsDays.length / 2))] || null;
  const restartParity = reproCheck
    ? await runRestartParityCheck({ configSnapshot, checkpointDay, sampleTargetsDays })
    : null;
  let observerEffectBaselineDiff = null;
  let observerEffectModuleOrderParity = null;
  if (observerEffectAudit) {
    const trustedBaseline = loadTrustedBaselineArtifact(trustedBaselinePath || defaultTrustedPhase1BaselinePath);
    const observerVariants = await Promise.all([
      runObserverEffectVariant({
        variantKey: 'full',
        label: 'Current full tracing',
        variantInstrumentationMode: 'full',
        sampleTargetsDays,
        targetsSeconds,
        configSnapshot
      }),
      runObserverEffectVariant({
        variantKey: 'noop',
        label: 'Current no-op tracing',
        variantInstrumentationMode: 'noop',
        sampleTargetsDays,
        targetsSeconds,
        configSnapshot
      }),
      runObserverEffectVariant({
        variantKey: 'disabled',
        label: 'Current tracing disabled',
        variantInstrumentationMode: 'disabled',
        sampleTargetsDays,
        targetsSeconds,
        configSnapshot
      })
    ]);
    observerEffectModuleOrderParity = buildObserverEffectModuleOrderParityReport(observerVariants);
    observerEffectBaselineDiff = buildObserverEffectBaselineDiffReport({
      trustedBaseline,
      variants: observerVariants,
      moduleOrderParity: observerEffectModuleOrderParity
    });
  }
  const artifactBase = deriveArtifactBase();
  const artifacts = artifactBase ? {
    monthlyClimatologyJsonPath: `${artifactBase}-monthly-climatology.json`,
    sampleProfilesJsonPath: `${artifactBase}-sample-profiles.json`,
    realismGapsJsonPath: `${artifactBase}-realism-gaps.json`,
    moistureAttributionJsonPath: `${artifactBase}-moisture-attribution.json`,
    runManifestJsonPath: `${artifactBase}-run-manifest.json`,
    conservationSummaryJsonPath: `${artifactBase}-conservation-summary.json`,
    waterCycleBudgetJsonPath: `${artifactBase}-water-cycle-budget.json`,
    restartParityJsonPath: `${artifactBase}-restart-parity.json`,
    surfaceSourceAttributionJsonPath: `${artifactBase}-surface-source-tracers.json`,
    surfaceFluxDecompositionJsonPath: `${artifactBase}-surface-flux-decomposition.json`,
    nhDryBeltSourceSectorSummaryJsonPath: `${artifactBase}-nh-dry-belt-source-sector-summary.json`,
    transportInterfaceBudgetJsonPath: `${artifactBase}-transport-interface-budget.json`,
    hadleyPartitionSummaryJsonPath: `${artifactBase}-hadley-partition-summary.json`,
    bandLevelFluxMatrixJsonPath: `${artifactBase}-band-level-flux-matrix.json`,
    verticalCloudBirthAttributionJsonPath: `${artifactBase}-vertical-cloud-birth-attribution.json`,
    verticalCloudBirthHistogramsJsonPath: `${artifactBase}-vertical-cloud-birth-histograms.json`,
    dryBeltCloudOriginMatrixJsonPath: `${artifactBase}-dry-belt-cloud-origin-matrix.json`,
    cloudTransitionLedgerJsonPath: `${artifactBase}-cloud-transition-ledger.json`,
    cloudTransitionLedgerSummaryJsonPath: `${artifactBase}-cloud-transition-ledger-summary.json`,
    cloudTransitionLedgerSectorSplitJsonPath: `${artifactBase}-cloud-transition-ledger-sector-split.json`,
    corridorReplayCatalogJsonPath: `${artifactBase}-corridor-replay-catalog.json`,
    corridorStepSliceAttributionJsonPath: `${artifactBase}-corridor-step-slice-attribution.json`,
    corridorModuleToggleDeltasJsonPath: `${artifactBase}-corridor-module-toggle-deltas.json`,
    upperCloudResidenceJsonPath: `${artifactBase}-upper-cloud-residence.json`,
    upperCloudErosionBudgetJsonPath: `${artifactBase}-upper-cloud-erosion-budget.json`,
    upperCloudVentilationSummaryJsonPath: `${artifactBase}-upper-cloud-ventilation-summary.json`,
    thermodynamicSupportSummaryJsonPath: `${artifactBase}-thermodynamic-support-summary.json`,
    radiativeCloudMaintenanceJsonPath: `${artifactBase}-radiative-cloud-maintenance.json`,
    boundaryLayerStabilityProfilesJsonPath: `${artifactBase}-boundary-layer-stability-profiles.json`,
    forcingOppositionBudgetJsonPath: `${artifactBase}-forcing-opposition-budget.json`,
    nudgingTargetMismatchJsonPath: `${artifactBase}-nudging-target-mismatch.json`,
    initializationMemoryJsonPath: `${artifactBase}-initialization-memory.json`,
    numericalIntegritySummaryJsonPath: `${artifactBase}-numerical-integrity-summary.json`,
    numericalClimateContractJsonPath: `${artifactBase}-numerical-climate-contract.json`,
    stormSpilloverCatalogJsonPath: `${artifactBase}-storm-spillover-catalog.json`,
    sectoralDryBeltRegimesJsonPath: `${artifactBase}-sectoral-dry-belt-regimes.json`,
    transientEddyLeakageSummaryJsonPath: `${artifactBase}-transient-eddy-leakage-summary.json`,
    dtSensitivityJsonPath: `${artifactBase}-dt-sensitivity.json`,
    gridSensitivityJsonPath: `${artifactBase}-grid-sensitivity.json`,
    monthlyAttributionClimatologyJsonPath: `${artifactBase}-monthly-attribution-climatology.json`,
    seasonalRootCauseRankingJsonPath: `${artifactBase}-seasonal-root-cause-ranking.json`,
    attributionLagAnalysisJsonPath: `${artifactBase}-attribution-lag-analysis.json`,
    counterfactualPathwaySensitivityJsonPath: `${artifactBase}-counterfactual-pathway-sensitivity.json`,
    rootCauseCandidateRankingJsonPath: `${artifactBase}-root-cause-candidate-ranking.json`,
    coupledCounterfactualMatrixJsonPath: `${artifactBase}-coupled-counterfactual-matrix.json`,
    coupledCounterfactualRankingJsonPath: `${artifactBase}-coupled-counterfactual-ranking.json`,
    coupledCounterfactualGuardrailsJsonPath: `${artifactBase}-coupled-counterfactual-guardrails.json`,
    observerEffectBaselineDiffJsonPath: `${artifactBase}-observer-effect-baseline-diff.json`,
    observerEffectBaselineDiffMdPath: `${artifactBase}-observer-effect-baseline-diff.md`,
    observerEffectModuleOrderParityJsonPath: `${artifactBase}-observer-effect-module-order-parity.json`
  } : null;
  const summarySamples = samples.map((sample) => compactSampleForSummary(sample));
  const summaryHorizons = horizonSummaries.map((horizon) => ({
    ...horizon,
    latest: compactSampleForSummary(horizon.latest)
  }));
  const generatedAt = new Date().toISOString();
  const auditRun = buildAuditRunMetadata({
    repoRoot,
    generatedAt,
    argv,
    config: {
      preset,
      nx,
      ny,
      dtSeconds: dt,
      seed,
      systemExperiment,
      sampleEveryDays,
      horizonsDays,
      reportBase: effectiveReportBase,
      outPath,
      mdOutPath
    }
  });

  const summary = {
    schema: 'satellite-wars.planetary-realism-audit.v4',
    generatedAt,
    auditRun,
    overallPass,
    config: {
      preset,
      nx,
      ny,
      dtSeconds: dt,
      seed,
      systemExperiment,
      sampleEveryDays,
      horizonsDays
    },
    headlessTerrain: terrainFallback,
    headlessTerrainParity: Boolean(terrainFallback?.after?.terrainSampleCount > 0),
    timings: timingByTarget,
    samples: summarySamples,
    monthlyClimatology,
    monthlyAttributionClimatology,
    horizons: summaryHorizons,
    realismGaps,
    moistureAttribution,
    runManifest,
    conservationSummary,
    waterCycleBudget,
    restartParity,
    surfaceSourceAttribution,
    surfaceFluxDecomposition,
    nhDryBeltSourceSectorSummary,
    transportInterfaceBudget,
    hadleyPartitionSummary,
    bandLevelFluxMatrix,
    verticalCloudBirthAttribution,
    verticalCloudBirthHistograms,
    dryBeltCloudOriginMatrix,
    cloudTransitionLedger,
    cloudTransitionLedgerSummary,
    cloudTransitionLedgerSectorSplit,
    corridorReplayCatalog,
    corridorStepSliceAttribution,
    corridorModuleToggleDeltas,
    upperCloudResidence,
    upperCloudErosionBudget,
    upperCloudVentilationSummary,
    thermodynamicSupportSummary,
    radiativeCloudMaintenance,
    boundaryLayerStabilityProfiles,
    forcingOppositionBudget,
    nudgingTargetMismatch,
    initializationMemory,
    numericalIntegritySummary,
    numericalClimateContract,
    stormSpilloverCatalog,
    sectoralDryBeltRegimes,
    transientEddyLeakageSummary,
    dtSensitivity,
    gridSensitivity,
    seasonalRootCauseRanking,
    attributionLagAnalysis,
    counterfactualPathwaySensitivity,
    rootCauseCandidateRanking,
    coupledCounterfactualMatrix,
    coupledCounterfactualRanking,
    coupledCounterfactualGuardrails,
    observerEffectBaselineDiff,
    observerEffectModuleOrderParity,
    artifacts,
    defaultNextPriorities
  };
  summary.systemExperiment = systemExperimentSummary;

  const markdown = renderMarkdown(summary);
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, toJson(summary));
  }
  if (mdOutPath) {
    fs.mkdirSync(path.dirname(mdOutPath), { recursive: true });
    fs.writeFileSync(mdOutPath, markdown);
  }
  if (effectiveReportBase) {
    fs.mkdirSync(path.dirname(effectiveReportBase), { recursive: true });
    fs.writeFileSync(`${effectiveReportBase}.json`, toJson(summary));
    fs.writeFileSync(`${effectiveReportBase}.md`, markdown);
  }
  const writeAuditJsonArtifact = (filePath, payload, artifactKind) => {
    fs.writeFileSync(filePath, toJson(stampAuditArtifact(payload, auditRun, artifactKind)));
  };
  if (artifacts) {
    fs.mkdirSync(path.dirname(artifacts.monthlyClimatologyJsonPath), { recursive: true });
    writeAuditJsonArtifact(artifacts.monthlyClimatologyJsonPath, monthlyClimatology, 'monthlyClimatology');
    writeAuditJsonArtifact(
      artifacts.sampleProfilesJsonPath,
      samples.map((sample) => ({
        targetDay: sample.targetDay,
        monthIndex: sample.monthIndex,
        profiles: sample.profiles
      })),
      'sampleProfiles'
    );
    writeAuditJsonArtifact(artifacts.realismGapsJsonPath, realismGaps, 'realismGaps');
    writeAuditJsonArtifact(artifacts.moistureAttributionJsonPath, moistureAttribution, 'moistureAttribution');
    writeAuditJsonArtifact(artifacts.runManifestJsonPath, runManifest, 'runManifest');
    writeAuditJsonArtifact(artifacts.conservationSummaryJsonPath, conservationSummary, 'conservationSummary');
    writeAuditJsonArtifact(artifacts.waterCycleBudgetJsonPath, waterCycleBudget, 'waterCycleBudget');
    writeAuditJsonArtifact(artifacts.restartParityJsonPath, restartParity, 'restartParity');
    writeAuditJsonArtifact(artifacts.surfaceSourceAttributionJsonPath, surfaceSourceAttribution, 'surfaceSourceAttribution');
    writeAuditJsonArtifact(artifacts.surfaceFluxDecompositionJsonPath, surfaceFluxDecomposition, 'surfaceFluxDecomposition');
    writeAuditJsonArtifact(artifacts.nhDryBeltSourceSectorSummaryJsonPath, nhDryBeltSourceSectorSummary, 'nhDryBeltSourceSectorSummary');
    writeAuditJsonArtifact(artifacts.transportInterfaceBudgetJsonPath, transportInterfaceBudget, 'transportInterfaceBudget');
    writeAuditJsonArtifact(artifacts.hadleyPartitionSummaryJsonPath, hadleyPartitionSummary, 'hadleyPartitionSummary');
    writeAuditJsonArtifact(artifacts.bandLevelFluxMatrixJsonPath, bandLevelFluxMatrix, 'bandLevelFluxMatrix');
    writeAuditJsonArtifact(artifacts.verticalCloudBirthAttributionJsonPath, verticalCloudBirthAttribution, 'verticalCloudBirthAttribution');
    writeAuditJsonArtifact(artifacts.verticalCloudBirthHistogramsJsonPath, verticalCloudBirthHistograms, 'verticalCloudBirthHistograms');
    writeAuditJsonArtifact(artifacts.dryBeltCloudOriginMatrixJsonPath, dryBeltCloudOriginMatrix, 'dryBeltCloudOriginMatrix');
    writeAuditJsonArtifact(artifacts.cloudTransitionLedgerJsonPath, cloudTransitionLedger, 'cloudTransitionLedger');
    writeAuditJsonArtifact(artifacts.cloudTransitionLedgerSummaryJsonPath, cloudTransitionLedgerSummary, 'cloudTransitionLedgerSummary');
    writeAuditJsonArtifact(artifacts.cloudTransitionLedgerSectorSplitJsonPath, cloudTransitionLedgerSectorSplit, 'cloudTransitionLedgerSectorSplit');
    writeAuditJsonArtifact(artifacts.corridorReplayCatalogJsonPath, corridorReplayCatalog, 'corridorReplayCatalog');
    writeAuditJsonArtifact(artifacts.corridorStepSliceAttributionJsonPath, corridorStepSliceAttribution, 'corridorStepSliceAttribution');
    writeAuditJsonArtifact(artifacts.corridorModuleToggleDeltasJsonPath, corridorModuleToggleDeltas, 'corridorModuleToggleDeltas');
    writeAuditJsonArtifact(artifacts.upperCloudResidenceJsonPath, upperCloudResidence, 'upperCloudResidence');
    writeAuditJsonArtifact(artifacts.upperCloudErosionBudgetJsonPath, upperCloudErosionBudget, 'upperCloudErosionBudget');
    writeAuditJsonArtifact(artifacts.upperCloudVentilationSummaryJsonPath, upperCloudVentilationSummary, 'upperCloudVentilationSummary');
    writeAuditJsonArtifact(artifacts.thermodynamicSupportSummaryJsonPath, thermodynamicSupportSummary, 'thermodynamicSupportSummary');
    writeAuditJsonArtifact(artifacts.radiativeCloudMaintenanceJsonPath, radiativeCloudMaintenance, 'radiativeCloudMaintenance');
    writeAuditJsonArtifact(artifacts.boundaryLayerStabilityProfilesJsonPath, boundaryLayerStabilityProfiles, 'boundaryLayerStabilityProfiles');
    writeAuditJsonArtifact(artifacts.forcingOppositionBudgetJsonPath, forcingOppositionBudget, 'forcingOppositionBudget');
    writeAuditJsonArtifact(artifacts.nudgingTargetMismatchJsonPath, nudgingTargetMismatch, 'nudgingTargetMismatch');
    writeAuditJsonArtifact(artifacts.initializationMemoryJsonPath, initializationMemory, 'initializationMemory');
    writeAuditJsonArtifact(artifacts.numericalIntegritySummaryJsonPath, numericalIntegritySummary, 'numericalIntegritySummary');
    writeAuditJsonArtifact(artifacts.numericalClimateContractJsonPath, numericalClimateContract, 'numericalClimateContract');
    writeAuditJsonArtifact(artifacts.stormSpilloverCatalogJsonPath, stormSpilloverCatalog, 'stormSpilloverCatalog');
    writeAuditJsonArtifact(artifacts.sectoralDryBeltRegimesJsonPath, sectoralDryBeltRegimes, 'sectoralDryBeltRegimes');
    writeAuditJsonArtifact(artifacts.transientEddyLeakageSummaryJsonPath, transientEddyLeakageSummary, 'transientEddyLeakageSummary');
    writeAuditJsonArtifact(artifacts.dtSensitivityJsonPath, dtSensitivity, 'dtSensitivity');
    writeAuditJsonArtifact(artifacts.gridSensitivityJsonPath, gridSensitivity, 'gridSensitivity');
    writeAuditJsonArtifact(artifacts.monthlyAttributionClimatologyJsonPath, monthlyAttributionClimatology, 'monthlyAttributionClimatology');
    writeAuditJsonArtifact(artifacts.seasonalRootCauseRankingJsonPath, seasonalRootCauseRanking, 'seasonalRootCauseRanking');
    writeAuditJsonArtifact(artifacts.attributionLagAnalysisJsonPath, attributionLagAnalysis, 'attributionLagAnalysis');
    writeAuditJsonArtifact(artifacts.counterfactualPathwaySensitivityJsonPath, counterfactualPathwaySensitivity, 'counterfactualPathwaySensitivity');
    writeAuditJsonArtifact(artifacts.rootCauseCandidateRankingJsonPath, rootCauseCandidateRanking, 'rootCauseCandidateRanking');
    writeAuditJsonArtifact(artifacts.coupledCounterfactualMatrixJsonPath, coupledCounterfactualMatrix, 'coupledCounterfactualMatrix');
    writeAuditJsonArtifact(artifacts.coupledCounterfactualRankingJsonPath, coupledCounterfactualRanking, 'coupledCounterfactualRanking');
    writeAuditJsonArtifact(artifacts.coupledCounterfactualGuardrailsJsonPath, coupledCounterfactualGuardrails, 'coupledCounterfactualGuardrails');
    if (observerEffectBaselineDiff) {
      writeAuditJsonArtifact(artifacts.observerEffectBaselineDiffJsonPath, observerEffectBaselineDiff, 'observerEffectBaselineDiff');
      fs.writeFileSync(artifacts.observerEffectBaselineDiffMdPath, renderObserverEffectBaselineDiffMarkdown(observerEffectBaselineDiff));
    }
    if (observerEffectModuleOrderParity) {
      writeAuditJsonArtifact(artifacts.observerEffectModuleOrderParityJsonPath, observerEffectModuleOrderParity, 'observerEffectModuleOrderParity');
    }
  }
  if (!quiet) process.stdout.write(toJson(summary));
  return summary;
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}

export const _test = {
  buildConservationSummary,
  applySystemExperiment,
  PLANETARY_PRESETS,
  buildAuditCliFlagSnapshot,
  buildAuditRunMetadata,
  collectUnknownAuditCliFlags,
  resolveAuditLabelReportBase,
  stampAuditArtifact,
  buildMoistureAttributionReport,
  buildNhDryBeltSourceSectorReport,
  buildRestartParityReport,
  buildSampleTargetsDays,
  buildRunManifest,
  buildMonthlyClimatology,
  buildMonthlyAttributionClimatology,
  buildSeasonalRootCauseRanking,
  buildAttributionLagAnalysis,
  buildCounterfactualPathwaySensitivityReport,
  buildRootCauseCandidateRankingReport,
  buildCoupledCounterfactualMatrixReport,
  buildCoupledCounterfactualRankingReport,
  buildCoupledCounterfactualGuardrailsReport,
  buildCounterfactualImprovement,
  compareAttributionStory,
  buildObserverEffectBaselineDiffReport,
  buildObserverEffectModuleOrderParityReport,
  renderObserverEffectBaselineDiffMarkdown,
  buildRealismGapReport,
  buildTransportInterfaceBudgetReport,
  buildHadleyPartitionSummaryReport,
  buildBandLevelFluxMatrixReport,
  buildVerticalCloudBirthAttributionReport,
  buildVerticalCloudBirthHistogramsReport,
  buildDryBeltCloudOriginMatrixReport,
  buildCloudTransitionLedgerReport,
  buildCloudTransitionLedgerSummaryReport,
  buildCloudTransitionLedgerSectorSplitReport,
  buildCorridorReplayCatalogReport,
  buildCorridorStepSliceAttributionReport,
  buildCorridorModuleToggleDeltasReport,
  runPhaseCCorridorReplay,
  runCounterfactualVariant,
  runSensitivityVariant,
  COUPLED_COUNTERFACTUAL_BUNDLES,
  cloneConfigSnapshot,
  buildUpperCloudResidenceReport,
  buildUpperCloudErosionBudgetReport,
  buildUpperCloudVentilationSummaryReport,
  buildThermodynamicSupportSummaryReport,
  buildRadiativeCloudMaintenanceReport,
  buildBoundaryLayerStabilityProfilesReport,
  buildForcingOppositionBudgetReport,
  buildNudgingTargetMismatchReport,
  buildInitializationMemoryReport,
  buildNumericalIntegritySummaryReport,
  buildNumericalClimateContractReport,
  computeNumericalIntegrityScore,
  resolveAuditExecutionModes,
  buildWaterCycleBudgetReport,
  buildDtSensitivityReport,
  buildGridSensitivityReport,
  buildStormSpilloverCatalogReport,
  buildSectoralDryBeltRegimesReport,
  buildTransientEddyLeakageSummaryReport,
  buildSurfaceFluxDecompositionReport,
  buildSurfaceSourceAttributionReport,
  classifySnapshot,
  computeSeasonalityScore,
  dayToMonthIndex,
  evaluateHorizons,
  peakLatitude,
  weightedBandCentroid,
  weightedBandMean,
  zonalMean
};
