import test from 'node:test';
import assert from 'node:assert/strict';
import { _test as phase1bTest } from '../../scripts/agent/phase1b-exact-corridor-support-proof.mjs';

test('computeFreshSupport derives row geometry from grid.nx for the frozen corridor cell', () => {
  const nx = 48;
  const ny = 24;
  const nz = 2;
  const N = nx * ny;
  const cellIndex = 390;
  const pHalf = new Float32Array((nz + 1) * N).fill(90000);
  const pMid = new Float32Array(nz * N).fill(85000);
  const theta = new Float32Array(nz * N).fill(300);
  const qv = new Float32Array(nz * N).fill(0.014);
  const omega = new Float32Array(nz * N).fill(0);
  const sigmaHalf = new Float32Array(nz + 1);
  const latDeg = new Float32Array(ny);
  for (let j = 0; j < ny; j += 1) latDeg[j] = 90 - ((j + 0.5) / ny) * 180;
  const support = phase1bTest.computeFreshSupport({
    core: {
      grid: {
        nx,
        ny,
        latDeg,
        invDx: new Float32Array(ny).fill(1),
        invDy: new Float32Array(ny).fill(1),
        cosLat: new Float32Array(ny).fill(1)
      },
      state: {
        nx: 32,
        N,
        nz,
        pHalf,
        pMid,
        theta,
        qv,
        omega,
        sigmaHalf,
        u: new Float32Array(nz * N),
        v: new Float32Array(nz * N),
        vertMetrics: {}
      },
      geo: {},
      vertParams: {}
    },
    cellIndex
  });

  assert.equal(support.latDeg, 26.25);
});

test('assessMissingCondition identifies missing stale-carryover clearance when residual dominates', () => {
  const result = phase1bTest.assessMissingCondition({
    supportSnapshot: {
      targetCell: {
        stored: {
          upperCloudAppliedErosionMassKgM2: 0,
          upperCloudPotentialErosionMassKgM2: 3.5,
          lowLevelOmegaEffectiveDiagPaS: 0.01,
          lowLevelMoistureConvergenceDiagS_1: 0.00002
        },
        fresh: {
          freshPotentialTarget: 0.18,
          neutralToSubsidingSupport: 0.62,
          staleCarryoverDominance: 0.91,
          lowLevelOmegaRawPaS: 0.04,
          lowLevelMoistureConvergenceS_1: 0.00003
        }
      },
      corridorBand: {
        stored: {
          upperCloudBlockedByWeakDescentVentMassKgM2: 1.4,
          upperCloudBlockedByLocalSupportMassKgM2: 0.3
        },
        fresh: {}
      }
    },
    boundaryLedger: {
      parityCheck: {
        observedPreverticalMassKgM2: 4.5
      }
    },
    provenanceReport: {
      targetCellOwnership: {
        previousStepResidualUpperCloud: 4.1,
        currentStepAdvectedUpperCloud: 0.12
      }
    },
    contract: {
      frozenFacts: {
        currentVerticalTargetCell: {
          appliedErosionMassKgM2: 0
        }
      }
    }
  });

  assert.equal(result.key, 'missing_explicit_prevertical_stale_carryover_clearance');
});

test('assessMissingCondition identifies subtropical suppressed stale-reservoir override from the real corridor shape', () => {
  const result = phase1bTest.assessMissingCondition({
    supportSnapshot: {
      targetCell: {
        stored: {
          convectiveMassFluxKgM2S: 0,
          convectiveDetrainmentMassKgM2: 0,
          convectiveAnvilSource: 0,
          upperCloudAppliedErosionMassKgM2: 0.24847,
          upperCloudPotentialErosionMassKgM2: 4.88609,
          lowLevelOmegaEffectiveDiagPaS: -0.1278,
          lowLevelMoistureConvergenceDiagS_1: 0.0000021
        },
        fresh: {
          freshPotentialTarget: 0.21166,
          organizedSupport: 0.19569,
          subtropicalBand: 1,
          subtropicalSuppression: 0.78151,
          neutralToSubsidingSupport: 0,
          staleCarryoverDominance: 1,
          lowLevelOmegaRawPaS: -0.1278,
          lowLevelMoistureConvergenceS_1: 0.0000021
        }
      },
      corridorBand: {
        stored: {
          upperCloudBlockedByWeakDescentVentMassKgM2: 0.24439,
          upperCloudBlockedByLocalSupportMassKgM2: 0.36973
        },
        fresh: {}
      }
    },
    boundaryLedger: {
      parityCheck: {
        observedPreverticalMassKgM2: 3.51914
      }
    },
    provenanceReport: {
      targetCellOwnership: {
        previousStepResidualUpperCloud: 3.09801,
        currentStepAdvectedUpperCloud: 0
      }
    },
    contract: {
      frozenFacts: {
        currentVerticalTargetCell: {
          appliedErosionMassKgM2: 0.24847
        }
      }
    }
  });

  assert.equal(result.key, 'missing_subtropical_suppressed_stale_reservoir_override');
});

test('assessMissingCondition flags stale support recomputation when fresh and stored dynamics diverge', () => {
  const result = phase1bTest.assessMissingCondition({
    supportSnapshot: {
      targetCell: {
        stored: {
          upperCloudAppliedErosionMassKgM2: 0.02,
          upperCloudPotentialErosionMassKgM2: 0.5,
          lowLevelOmegaEffectiveDiagPaS: -0.08,
          lowLevelMoistureConvergenceDiagS_1: 0.0002
        },
        fresh: {
          freshPotentialTarget: 0.42,
          neutralToSubsidingSupport: 0.14,
          staleCarryoverDominance: 0.4,
          lowLevelOmegaRawPaS: 0.03,
          lowLevelMoistureConvergenceS_1: 0.00001
        }
      },
      corridorBand: {
        stored: {
          upperCloudBlockedByWeakDescentVentMassKgM2: 0.4,
          upperCloudBlockedByLocalSupportMassKgM2: 0.5
        },
        fresh: {}
      }
    },
    boundaryLedger: {
      parityCheck: {
        observedPreverticalMassKgM2: 1.2
      }
    },
    provenanceReport: {
      targetCellOwnership: {
        previousStepResidualUpperCloud: 0.4,
        currentStepAdvectedUpperCloud: 0.3
      }
    },
    contract: {
      frozenFacts: {
        currentVerticalTargetCell: {
          appliedErosionMassKgM2: 0.1
        }
      }
    }
  });

  assert.equal(result.key, 'missing_fresh_prevertical_support_recomputation');
});

test('buildSecondPatchDesign avoids stale persistent gates as primary inputs', () => {
  const design = phase1bTest.buildSecondPatchDesign({
    contract: {},
    supportSnapshot: {
      targetCell: {
        fresh: {
          latDeg: 26.25
        }
      }
    },
    missingCondition: {
      explanation: 'test explanation'
    }
  });

  assert.match(design.placement, /stepVertical5/);
  assert.ok(design.avoidUsingAsPrimaryGate.some((line) => line.includes('stored convectiveOrganization')));
  assert.match(design.predictedSignature.firstChange, /endPreviousStepMicrophysics5/);
});
