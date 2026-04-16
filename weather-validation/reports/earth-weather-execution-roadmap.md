# Earth Weather Execution Roadmap

## North Star

Build a free-running Earth-like weather system where:
- large-scale circulation is realistic
- seasonal migration is realistic
- dry belts, storm tracks, and monsoons sit in the right places
- hurricanes, cyclones, fronts, and convective systems emerge naturally
- the system stays stable over multi-year runs

This roadmap is for **emergent Earth realism**, not historical replay.

## Program Rules

- No more alphabetized residual micro-phases as the default workflow.
- Every candidate fix must map to a top-level climate or storm-climatology objective.
- `30`-day runs are only screening filters.
- Any candidate that might be kept must clear a `365`-day gate.
- Storm-focused work does not start until the climate base passes Phase 1.
- After two annual failures inside a top-level family, we stop and choose rollback or architecture change instead of inventing narrower patches.

## Canonical Anchors

### Current frozen branch reference

- [phase1-reset-triage-annual.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-reset-triage-annual.json)
- Day-365:
  - `itczWidthDeg = 24.875`
  - `subtropicalDryNorthRatio = 1.343`
  - `subtropicalDrySouthRatio = 1.145`
  - `midlatitudeWesterliesNorthU10Ms = 0.524`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.2774`
  - `crossEquatorialVaporFluxNorthKgM_1S = 326.33822`

### Trusted older climate anchor

- [phase1-hadley-second-pass-restore-v4.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json)
- Trusted anchor metrics:
  - `itczWidthDeg = 23.646`
  - `subtropicalDryNorthRatio = 1.100`
  - `subtropicalDrySouthRatio = 0.519`
  - `midlatitudeWesterliesNorthU10Ms = 1.192`
  - `stormTrackNorthLatDeg = 63.75`
  - `stormTrackSouthLatDeg = -63.75`
  - `tropicalCycloneEnvironmentCountNh = 1`

### Reset decision anchor

- [phase1-reset-system-experiments.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1-reset-system-experiments.md)
- Current conclusion:
  - `R2A` flat
  - `R2B` fails annual climate despite short-run improvement
  - `R2C` fails annual climate
  - no clear winner

## Standard Evidence Pack

These are the canonical repo lanes for every major phase:

- Climate audit engine:
  - [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- Current bounded experiment runner:
  - [phase1-reset-system-experiments.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/phase1-reset-system-experiments.mjs)
- Core physics lanes:
  - [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
  - [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
  - [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
  - [radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js)
  - [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
  - [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- Existing validation status:
  - [planetary-realism-status.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status.md)
  - [world-class-weather-status.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/world-class-weather-status.md)

Future phases should add these phase-specific drivers rather than hide logic inside ad hoc scripts:
- `scripts/agent/earth-weather-branch-benchmark.mjs`
- `scripts/agent/earth-weather-monthly-scorecard.mjs`
- `scripts/agent/earth-weather-regime-atlas.mjs`
- `scripts/agent/earth-weather-tc-environment.mjs`
- `scripts/agent/earth-weather-storm-climatology.mjs`
- `scripts/agent/earth-weather-multiyear-drift.mjs`

## Phase 0: Base-State Recovery Decision

### Objective

Choose the canonical branch that we will use as the new foundation.

### Primary files and outputs

- Existing:
  - [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
  - [phase1-reset-triage.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1-reset-triage.md)
  - [phase1-reset-system-experiments.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1-reset-system-experiments.md)
- New deliverables:
  - `scripts/agent/earth-weather-branch-benchmark.mjs`
  - `weather-validation/reports/earth-weather-phase0-branch-benchmark.md`
  - `weather-validation/reports/earth-weather-master-scorecard.md`

### Required checklist

- [x] Select the current branch plus the best trusted rollback candidate(s).
- [x] Run the `30`-day audit on each branch.
- [x] Run the `365`-day audit on each branch.
- [x] Compare only full-objective climate metrics.
- [ ] Choose exactly one canonical base branch.

### Metrics

- `itczWidthDeg`
- `subtropicalDryNorthRatio`
- `subtropicalDrySouthRatio`
- `midlatitudeWesterliesNorthU10Ms`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`
- `crossEquatorialVaporFluxNorthKgM_1S`

### Pass / fail gate

Pass if one branch wins at least `4 / 6` day-365 metrics and does not regress the other two by more than `10%`.

Fail if:
- no branch wins clearly
- or every branch still fails the annual climate objective badly

If Phase 0 fails, do not continue patching. Move directly to a broader architecture reset.

### Result

- Status: completed
- Decision report: [earth-weather-phase0-branch-benchmark.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-phase0-branch-benchmark.md)
- Verdict: `no_clear_winner`
- Consequence: neither branch is acceptable as-is, so the program moves into the Architecture A redesign lane before Phase 1 resumes

## Architecture A: Circulation-Preserving Dry-Belt Partition Redesign

### Objective

Preserve the current branch's NH dry-belt partition gains while recovering the rollback archive's stronger circulation.

### Primary files and outputs

- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [earth-weather-architecture-a-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a-design.md)
- [earth-weather-architecture-a-design.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a-design.json)

### Design contract

- Preserve from current:
  - `itczWidthDeg`
  - `subtropicalDryNorthRatio`
- Recover from rollback archive:
  - `subtropicalDrySouthRatio`
  - `midlatitudeWesterliesNorthU10Ms`
  - `crossEquatorialVaporFluxNorthKgM_1S`
- Replace stacked local suppressor logic with one explicit subtropical partition/circulation contract shared between vertical and microphysics.
- Promote only annualized integrated experiments.

### Preferred bounded experiment families

- `A1-explicit-subtropical-balance-contract`
- `A2-circulation-preserving-partition-port`

### Result

- Status: completed
- Verdict: `integrated_partition_circulation_split_required`
- Active next move: `Architecture A1: implement explicit subtropical balance contract experiment`

## Architecture A1: Explicit Subtropical Balance Contract Experiment

### Objective

Use one vertical-state subtropical partition/circulation contract as the shared microphysics admission carrier instead of re-deriving the same decision from many local proxies.

### Primary files and outputs

- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [earth-weather-architecture-a1-balance-contract.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/earth-weather-architecture-a1-balance-contract.mjs)
- [earth-weather-architecture-a1-balance-contract.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a1-balance-contract.md)

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick screen outcome:
  - only `1 / 6` core metrics improved
  - severe regressions in `itczWidthDeg`, `subtropicalDryNorthRatio`, and `subtropicalDrySouthRatio`
- Consequence: do not continue with A1 tuning; move directly to `Architecture A2: circulation-preserving partition port`

## Architecture A2: Circulation-Preserving Partition Port

### Objective

Keep the current branch partition microphysics, but test rollback-leaning circulation support variants instead of carrying the full current-branch circulation damper stack forward.

### Primary files and outputs

- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [earth-weather-architecture-a2-partition-port.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/earth-weather-architecture-a2-partition-port.mjs)
- [earth-weather-architecture-a2-partition-port.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a2-partition-port.md)

### Candidate family

- `containment-off`
- `ported-floor`
- `ported-floor-soft-containment`

### Result

- Status: completed
- Verdict: `quick_reject`
- Best quick candidate: `ported-floor-soft-containment`
- Quick screen outcome:
  - improved metrics: `2 / 6`
  - no severe regressions
  - preserved only partial current-branch partition gains:
    - `itczWidthDeg: 25.91 -> 25.826`
    - `subtropicalDryNorthRatio: 1.534 -> 1.507`
  - but failed the circulation-recovery side of the contract:
    - `subtropicalDrySouthRatio: 1.199 -> 1.2`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14845`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 144.63218`
- Consequence: Architecture A is now exhausted as a bounded family. Move to `Architecture B: circulation-first partition rebuild`.

## Architecture B: Circulation-First Partition Rebuild

### Objective

Rebuild the circulation scaffold first, then only re-port partition behavior that survives under that rebuilt scaffold.

### Primary files and outputs

- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [earth-weather-architecture-b-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b-design.md)
- [earth-weather-architecture-b-design.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b-design.json)

### Design contract

- Rebuild the subtropical circulation scaffold before attempting another partition-port.
- Treat the vertical subtropical drying scaffold as the primary Architecture B lever, not the microphysics suppressor families.
- Keep the current branch partition microphysics available as a protected layer, but do not let it dictate the circulation scaffold.
- Promote only bounded scaffold experiments that are judged by the full six-metric climate objective.

### Preferred bounded experiment families

- `B1-circulation-scaffold-rebuild`
- `B2-explicit-circulation-state-port`
- `B3-direct-rollback-circulation-splice`

### Result

- Status: completed
- Verdict: `circulation_scaffold_rebuild_required`
- Active next move: `Architecture B1: implement circulation scaffold rebuild experiment`

## Architecture B1: Circulation Scaffold Rebuild

### Objective

Test whether the circulation split can be improved by resetting floor/boost inheritance and attenuating or narrowing the subtropical drying scaffold before any new partition re-port.

### Primary files and outputs

- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [earth-weather-architecture-b1-circulation-scaffold.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/earth-weather-architecture-b1-circulation-scaffold.mjs)
- [earth-weather-architecture-b1-circulation-scaffold.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b1-circulation-scaffold.md)

### Candidate family

- `floor-reset-light-drying`
- `narrow-band-light-drying`
- `narrow-band-soft-containment`

### Result

- Status: completed
- Verdict: `quick_reject`
- Best quick candidate: `narrow-band-soft-containment`
- Quick screen outcome:
  - improved metrics: `1 / 6`
  - severe regressions: `itczWidthDeg`
  - partial movement:
    - `subtropicalDryNorthRatio: 1.534 -> 1.504`
  - but the circulation scaffold still did not recover:
    - `itczWidthDeg: 25.91 -> 26.218`
    - `subtropicalDrySouthRatio: 1.199 -> 1.201`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.16433`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 147.25094`
- Consequence: broad scaffold lightening is not enough. Move to `Architecture B2: explicit circulation-state port`.

## Architecture B2: Explicit Circulation-State Port

### Objective

Test whether explicit circulation-state carriers can recover circulation on top of the best B1 scaffold without reopening the broad current-branch dampers.

### Primary files and outputs

- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [earth-weather-architecture-b2-circulation-state-port.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/earth-weather-architecture-b2-circulation-state-port.mjs)
- [earth-weather-architecture-b2-circulation-state-port.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b2-circulation-state-port.md)

### Candidate family

- `soft-containment-return-flow-port`
- `soft-containment-omega-port`
- `open-circulation-bundle`

### Result

- Status: completed
- Verdict: `quick_reject`
- Best quick candidate: `soft-containment-omega-port`
- Quick screen outcome:
  - improved metrics: `1 / 6`
  - severe regressions: `itczWidthDeg`
  - partial movement:
    - `subtropicalDryNorthRatio: 1.534 -> 1.504`
  - but explicit circulation-state ports on the B1 scaffold still did not recover circulation:
    - `itczWidthDeg: 25.91 -> 26.219`
    - `subtropicalDrySouthRatio: 1.199 -> 1.201`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.16605`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 147.22336`
- Consequence: explicit circulation ports alone are not enough on the weakened B1 scaffold. Move to `Architecture B3: direct rollback circulation splice`.

## Architecture B3: Direct Rollback Circulation Splice

### Objective

Test whether a stronger A2-style rollback floor/containment base can preserve current NH partition gains while directly splicing in rollback-leaning circulation carriers.

### Primary files and outputs

- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [earth-weather-architecture-b3-rollback-circulation-splice.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/earth-weather-architecture-b3-rollback-circulation-splice.mjs)
- [earth-weather-architecture-b3-rollback-circulation-splice.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b3-rollback-circulation-splice.md)

### Candidate family

- `ported-floor-soft-containment-return-flow`
- `ported-floor-soft-containment-omega`
- `ported-floor-open-bundle`

### Result

- Status: completed
- Verdict: `quick_reject`
- Best quick candidate: `ported-floor-soft-containment-omega`
- Quick screen outcome:
  - improved metrics: `2 / 6`
  - severe regressions: none
  - preserved some current-branch NH partition behavior:
    - `itczWidthDeg: 25.91 -> 25.837`
    - `subtropicalDryNorthRatio: 1.534 -> 1.512`
  - but the circulation recovery contract still failed:
    - `subtropicalDrySouthRatio: 1.199 -> 1.202`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14213`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 144.56866`
- Consequence: Architecture B is now exhausted as a parameter-only family. Move to `Architecture C: code-level rollback/current hybridization design`.

## Architecture C: Code-Level Rollback/Current Hybridization Design

### Objective

Define the first code-level hybrid between the rollback circulation donor and the current partition-preserving branch now that all parameter-only Architecture B families are exhausted.

### Primary files and outputs

- [earth-weather-architecture-c-design.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/earth-weather-architecture-c-design.mjs)
- [earth-weather-architecture-c-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c-design.md)
- [earth-weather-architecture-c-design.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c-design.json)

### Result

- Status: completed
- Verdict: `module_level_hybrid_required`
- Hybrid split:
  - rollback donor files:
    - [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
    - [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
  - current preserve file:
    - [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
  - current adapter files:
    - [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
    - [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
    - [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- Consequence: Architecture C is not another tuning family. It is a donor/preserve/adapter splice decision. Move to `Architecture C1: hybrid seam contract`.

## Architecture C1: Hybrid Seam Contract

### Objective

Turn the Architecture C donor/preserve/adapter split into the explicit implementation contract for the first donor-base hybrid benchmark.

### Primary files and outputs

- [earth-weather-architecture-c1-hybrid-seam-contract.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/earth-weather-architecture-c1-hybrid-seam-contract.mjs)
- [earth-weather-architecture-c1-hybrid-seam-contract.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c1-hybrid-seam-contract.md)
- [earth-weather-architecture-c1-hybrid-seam-contract.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c1-hybrid-seam-contract.json)

### Contract

- donor base branch:
  - `codex/world-class-weather-loop-archive-20260407-0745`
- donor scaffold files:
  - [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
  - [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- preserve layer:
  - [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- adapter stack:
  - [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
  - [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
  - [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- excluded starting point:
  - do not start from current [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
  - do not start from current [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

### Result

- Status: completed
- Verdict: `rollback_vertical_core_current_partition_adapter_contract`
- Consequence: the next active move is now `Architecture C2: donor-base hybrid worktree benchmark`.

## Architecture C2: Donor-Base Hybrid Worktree Benchmark

### Objective

Run the first donor-base hybrid benchmark from the rollback circulation scaffold plus the current partition-preserve and adapter bundles.

### Bundle

- donor archive branch:
  - `codex/world-class-weather-loop-archive-20260407-0745`
- donor scaffold files:
  - [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
  - [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- overlaid current preserve and adapter files:
  - [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
  - [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
  - [cloudBirthTracing5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/cloudBirthTracing5.js)
  - [sourceTracing5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/sourceTracing5.js)
  - [instrumentationBands5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/instrumentationBands5.js)
  - [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
  - [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

### Result

- Status: completed
- Verdict: `integration_blocked_missing_dependency`
- Immediate blocker:
  - donor [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) still uses extensionless ESM imports, so the hybrid worktree fails before the first quick climate benchmark
- Additional donor-core compatibility gaps:
  - `getCloudTransitionLedgerRaw`
  - `resetCloudTransitionLedger`
  - `getModuleTimingSummary`
  - `getConservationSummary`
  - `loadStateSnapshot`
  - `setReplayDisabledModules`
  - `clearReplayDisabledModules`
- Consequence: the next active move is now `Architecture C3: hybrid integration bridge design`.

## Architecture C3: Hybrid Integration Bridge Design

### Objective

Convert the C2 bootstrap failure into the smallest bridge contract required before retrying the donor-base hybrid benchmark.

### Result

- Status: completed
- Verdict: `esm_and_core_api_bridge_required`
- Immediate blockers:
  - donor-core extensionless ESM imports: `./grid`, `./state5`, `./hydrostatic`, `./dynamics5`, `./windEddyNudge5`, `./windNudge5`, `./mass5`, `./advect5`, `./vertical5`, `./microphysics5`, `./surface2d`, `./climo2d`, `./radiation2d`, `./diagnostics2d`, `./initializeFromClimo`, `./nudging5`, `./verticalGrid`, `../WeatherLogger`
  - missing donor-core compatibility methods:
    - `getCloudTransitionLedgerRaw`
    - `resetCloudTransitionLedger`
    - `getModuleTimingSummary`
    - `getConservationSummary`
    - `loadStateSnapshot`
    - `setReplayDisabledModules`
    - `clearReplayDisabledModules`
- Bridge contract:
  - patch rollback donor [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) to explicit `.js` ESM imports
  - add compatibility methods on donor core for the current audit stack
- keep the donor-base-first contract from C1 intact
- rerun Architecture C2 immediately after the bridge implementation
- Consequence: the next active move is now `Architecture C4: donor-core integration bridge implementation`.

## Architecture C4: Donor-Core Integration Bridge Implementation

### Objective

Implement the donor-side runtime bridge required to make the rollback/current hybrid runnable under the current Node and audit environment.

### Result

- Status: completed
- Verdict: `bridge_implemented_ready_for_rerun`
- Bridge implementation:
  - rewrite donor relative imports to explicit `.js` ESM specifiers across the donor weather bundle
  - inject donor-core compatibility methods for the current audit stack
  - preserve the donor-base-first splice contract from C1
- Bridge summary:
  - rewritten relative import count: `29`
  - missing donor-core compatibility methods after bridge: `none`
- Consequence: the next active move is now `Architecture C5: bridged donor-base hybrid rerun benchmark`.

## Architecture C5: Bridged Donor-Base Hybrid Rerun Benchmark

### Objective

Rerun the donor-base hybrid benchmark after the Architecture C4 bridge lands and determine whether the hybrid is now a real climate candidate.

### Result

- Status: completed
- Verdict: `hybrid_boot_failure`
- What improved:
  - the hybrid is no longer blocked by the original donor-core ESM import mismatch
  - donor-core compatibility methods are no longer missing after the bridge
- Residual failure:
  - the bridged hybrid still did not produce a quick benchmark summary artifact
  - failure message: `Audit completed without expected summary artifact ... Matching files: none`
- Consequence: the next active move is now `Architecture C6: bridged hybrid attribution design`.

## Architecture C6: Bridged Hybrid Attribution Design

### Objective

Prove why the bridged donor/current hybrid exits successfully yet still fails to yield the requested quick benchmark artifact.

### Result

- Status: completed
- Verdict: `silent_no_artifact_exit`
- Key findings:
  - exit code: `0`
  - expected summary artifact: missing
  - fallback default report artifact: missing
  - cycle violation artifact: missing
  - stdout summary JSON: absent
  - new worktree artifacts: none
  - only emitted process output was a `MODULE_TYPELESS_PACKAGE_JSON` warning while loading bridged donor modules
- Consequence: the next active move is now `Architecture C7: bridged hybrid artifact contract repair`.

## Architecture C7: Bridged Hybrid Artifact Contract Repair

### Objective

Repair the bridged-hybrid artifact contract by invoking the bridged audit through its exported `main()` path and determine whether the hybrid now yields a real benchmark artifact.

### Result

- Status: completed
- Verdict: `cycle_guard_contract_block`
- What C7 proved:
  - the earlier silent exit in C5/C6 was not a climate result
  - forcing the bridged audit through explicit `main()` execution surfaced the real blocker
  - the bridged donor worktree is being stopped by [plan-guard.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/plan-guard.mjs), not by the donor/core hybrid physics seam
- Failure message:
  - `[agent plan guard] agent:planetary-realism-audit requires an active cycle directory with plan.md before it can run.`
- Consequence: the next active move is now `Architecture C8: donor-worktree cycle contract repair`.

## Architecture C8: Donor-Worktree Cycle Contract Repair

### Objective

Repair the donor-worktree heavy-command contract by creating a real guarded cycle before invoking the bridged audit.

### Result

- Status: completed
- Verdict: `post_cycle_runtime_failure`
- What C8 proved:
  - the donor-worktree cycle contract is now real enough to clear the earlier plan-guard block
  - the bridged audit got past cycle admission and entered runtime execution
  - the next blocker is a missing runtime asset, not the cycle contract anymore
- First post-cycle failure:
  - `ENOENT: no such file or directory, open '.../scripts/agent/fixtures/headless-terrain-180x90.json'`
- Consequence: the next active move is now `Architecture C9: donor-worktree runtime fixture repair`.

## Architecture C9: Donor-Worktree Runtime Fixture Repair

### Objective

Restore the donor-worktree runtime fixture contract by forward-porting the headless terrain fixture bundle and rerun the bridged quick audit under the repaired cycle flow.

### Result

- Status: completed
- Verdict: `runtime_fixture_contract_restored`
- What C9 proved:
  - the donor-worktree no longer fails on the missing terrain fixture asset
  - the bridged quick audit now exits `0`
  - the requested quick summary artifact is emitted again
- Quick artifact:
  - [earth-weather-architecture-c9-bridged-hybrid-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c9-bridged-hybrid-quick.json)
- Residual note:
  - the bridged rerun still emits the existing `MODULE_TYPELESS_PACKAGE_JSON` warning, but it is no longer blocking execution
- Consequence: the next active move is now `Architecture C10: cycled hybrid benchmark rerun`.

## Architecture C10: Cycled Hybrid Benchmark Rerun

### Objective

Run the first full donor/current hybrid climate benchmark after donor-worktree cycle and runtime contracts were restored, and decide whether the repaired hybrid can now pass the quick climate gate.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- What C10 proved:
  - the repaired donor/current hybrid is now a real climate candidate, not an integration ghost
  - it materially improves `itczWidthDeg`, both dry-belt ratios, and `midlatitudeWesterliesNorthU10Ms`
  - it still fails the quick gate because cross-equatorial vapor flux flips from healthy northward transport to strong southward transport
- Supporting artifacts copied into the repo:
  - [earth-weather-architecture-c10-bridged-hybrid-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick.json)
  - [earth-weather-architecture-c10-bridged-hybrid-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-transport-interface-budget.json)
  - [earth-weather-architecture-c10-bridged-hybrid-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-hadley-partition-summary.json)
  - [earth-weather-architecture-c10-bridged-hybrid-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-moisture-attribution.json)
- Consequence: the next active move is now `Architecture C11: cycled hybrid flux inversion attribution`.

## Architecture C11: Cycled Hybrid Flux Inversion Attribution

### Objective

Prove whether the remaining quick-gate failure is a generic climate weakness or a narrower transport-polarity defect in the repaired donor/current hybrid.

### Result

- Status: completed
- Verdict: `equatorial_overturning_polarity_inversion`
- What C11 proved:
  - the hybrid does not fail because the entire climate scaffold is weak
  - four of the six core quick metrics improve materially
  - the remaining blocker is a polarity reversal in equatorial overturning:
    - cross-equatorial vapor flux north: `143.95306 -> -371.9765`
    - equatorial low-level velocity mean: `11.78514 -> -20.46744`
    - equatorial zonal-mean vapor flux north: `160.44983 -> -274.70821`
    - equatorial eddy vapor flux north: `-12.37515 -> -105.45284`
- Secondary clue:
  - the low-level source partition proxy collapses to `null / null` in the hybrid Hadley summary, so the next contract should restore equatorial overturning sign without throwing away the dry-belt and NH-westerly gains already earned
- Consequence: the next active move is now `Architecture C12: equatorial overturning sign contract design`.

## Architecture C12: Equatorial Overturning Sign Contract Design

### Objective

Convert the C11 polarity inversion into one explicit donor/current hybrid contract instead of continuing local climate patching.

### Result

- Status: completed
- Verdict: `current_low_level_momentum_preserve_layer_required`
- What C12 proved:
  - the hybrid keeps the stronger donor/current circulation scaffold outside the equator
  - the cleanest remaining mismatch is the low-level momentum/nudging sign-control lane
  - the first preserve layer should be forward-ported from current:
    - [windNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windNudge5.js)
    - [windEddyNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windEddyNudge5.js)
    - [nudging5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/nudging5.js)
  - the donor-core patch lane should stay narrowly scoped to:
    - `windNudgeParams.tauSurfaceSeconds: 7 * 86400 -> 8 * 3600`
    - `nudgeParams.tauQvS: 30 * 86400 -> 45 * 86400`
    - `nudgeParams.tauQvColumn: 12 * 86400 -> 18 * 86400`
    - the organized/subsidence relief quartet now consumed by current nudging modules
- Consequence: the next active move is now `Architecture C13: equatorial overturning sign contract experiment`.

## Architecture C13: Equatorial Overturning Sign Contract Experiment

### Objective

Test whether preserving the current low-level momentum/nudging layer on top of the donor scaffold restores northward equatorial overturning without giving back the repaired dry-belt and NH-westerly gains.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Strong retained wins:
  - `itczWidthDeg: 25.91 -> 23.884`
  - `subtropicalDryNorthRatio: 1.534 -> 1.152`
  - `subtropicalDrySouthRatio: 1.199 -> 0.585`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
- Remaining blocker:
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -330.9854`
- Interpretation:
  - the donor/current hybrid remains a genuinely strong climate candidate on five of the six core quick metrics
  - the preserve-layer contract did not fix the equatorial overturning sign defect
  - the next work should attribute the implementation lane that still flips transport polarity instead of broadening the hybrid family again
- Consequence: the next active move is now `Architecture C14: sign-contract implementation attribution`.

## Architecture C14: Sign-Contract Implementation Attribution

### Objective

Determine whether the remaining C13 polarity defect is still coming from the preserved current low-level nudging layer or from the donor-controlled vertical overturning scaffold.

### Result

- Status: completed
- Verdict: `zonal_mean_equatorial_reversal_still_vertical_scaffold_controlled`
- What C14 proved:
  - C13 improved the eddy side of the equatorial failure relative to C10:
    - eddy vapor flux north: `-105.45284 -> -34.29106`
  - but it did not fix the zonal-mean branch:
    - zonal-mean vapor flux north: `-274.70821 -> -301.63909`
  - the total cross-equatorial flux stayed strongly southward:
    - `-371.9765 -> -330.9854`
  - `dynamics5.js` is not the divergence lane between current and archive, while current [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) consumes modern cross-hemi/subsidence contract terms that the archive donor vertical scaffold does not
- Consequence: the next active move is now `Architecture C15: equatorial vertical-state contract experiment`.

## Architecture C15: Equatorial Vertical-State Contract Experiment

### Objective

Test the bounded current-vertical overlay on top of the donor/current hybrid by combining current [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) with the current low-level preserve layer and an explicit donor-core vertical-state contract patch.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 24.094`
  - `subtropicalDryNorthRatio: 1.534 -> 1.404`
  - `subtropicalDrySouthRatio: 1.199 -> 0.589`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.209`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.15331`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -364.55266`
- Interpretation:
  - the current vertical-state overlay did not restore northward equatorial overturning
  - it also gave back some of the stronger C13 wins in NH dry-belt ratio, NH westerlies, and dry-belt ocean condensation
  - so the next phase should attribute which part of the vertical implementation is driving the regression instead of broadening the overlay family further
- Consequence: the next active move is now `Architecture C16: vertical-contract implementation attribution`.

## Architecture C16: Vertical-Contract Implementation Attribution

### Objective

Determine whether the C15 regression means the current vertical overlay is fundamentally wrong for this hybrid family, or whether a narrower carveout can keep the helpful zonal-mean relief while removing the new upper-cloud maintenance pathway it reintroduced.

### Result

- Status: completed
- Verdict: `zonal_mean_relief_offset_by_upper_cloud_carryover_recirculation`
- What C16 proved:
  - C15 did improve the equatorial zonal-mean branch relative to C13:
    - equator zonal-mean vapor flux north: `-301.63909 -> -274.13377`
  - C15 also relieved the 35° dry-belt import burden:
    - 35° interface vapor flux north: `-467.08734 -> -360.61691`
  - but the total equatorial result got worse because the overlay reintroduced a much stronger eddy / mid-upper transport failure:
    - equator eddy vapor flux north: `-34.29106 -> -96.97265`
    - equator mid/upper vapor flux north: `-203.65605 -> -239.13535`
    - cross-equatorial vapor flux north: `-330.9854 -> -364.55266`
  - the new regression aligns with a reactivated upper-cloud persistence family in the NH dry belt:
    - carried-over upper cloud: `0 -> 0.39867`
    - imported anvil persistence: `0 -> 0.39786`
    - weak-erosion cloud survival: `0 -> 0.38477`
    - cloud recirculation proxy: `0 -> 2.22467`
- Interpretation:
  - the full current vertical overlay is not the right keep candidate
  - but it revealed a useful split:
    - some vertical-state terms help the zonal-mean branch
    - the upper-cloud carryover / persistence lane is what pays for that help with a larger eddy-side regression
- Consequence: the next active move is now `Architecture C17: zonal-mean-preserving upper-cloud carryover carveout experiment`.

## Architecture C17: Zonal-Mean-Preserving Upper-Cloud Carryover Carveout Experiment

### Objective

Keep the C15 vertical-state contract pieces that improved the zonal-mean equatorial branch, but relax only the carry-input dominance override so NH dry-belt upper-cloud carryover gets cleared earlier instead of recirculating.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.454`
  - `subtropicalDryNorthRatio: 1.534 -> 1.121`
  - `subtropicalDrySouthRatio: 1.199 -> 0.511`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.202`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14144`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.31687`
- Interpretation:
  - the carveout was not inert
  - it materially improved the C15 dry-belt and ITCZ metrics while keeping NH westerlies strong
  - but the equatorial vapor-flux sign defect remained severe enough to block annual promotion
- Consequence: the next active move is now `Architecture C18: carryover carveout implementation attribution`.

## Architecture C18: Carryover Carveout Implementation Attribution

### Objective

Determine whether C17 failed because the carryover carveout still was not binding enough, or because it succeeded and exposed a different remaining transport blocker.

### Result

- Status: completed
- Verdict: `carryover_carveout_relief_preserves_zonal_mean_but_eddy_export_remains_primary_blocker`
- What C18 proved:
  - C17 materially relieved the carryover-maintenance family:
    - carried-over upper cloud: `0.39867 -> 0.22666`
    - imported anvil persistence: `0.39786 -> 0.22501`
    - weak-erosion survival: `0.38477 -> 0.21732`
    - cloud recirculation proxy: `2.22467 -> 0.39988`
  - C17 also improved the zonal-mean and mid/upper equatorial transport branches relative to C15:
    - equator zonal-mean vapor flux north: `-274.13377 -> -249.95949`
    - equator mid/upper vapor flux north: `-239.13535 -> -226.72426`
    - cross-equatorial vapor flux north: `-364.55266 -> -353.31687`
  - but the remaining blocker moved into the eddy/export lane:
    - equator eddy vapor flux north: `-96.97265 -> -109.90385`
    - equator low-level velocity mean: `-20.23835 -> -20.79729`
    - 35° interface vapor flux north: `-360.61691 -> -373.49016`
- Interpretation:
  - the upper-cloud carryover carveout is now a real improvement worth keeping in the comparison base
  - it is no longer the dominant blocker
  - the next bounded family must explain the unresolved equatorial eddy export / low-level velocity sign defect
- Consequence: the next active move is now `Architecture C19: zonal-mean-preserving eddy export attribution`.

## Architecture C19: Zonal-Mean-Preserving Eddy Export Attribution

### Objective

Determine whether the remaining post-C17 sign defect belongs to the preserved low-level momentum layer itself or to the newer vertical-overlay interaction sitting on top of that shared preserve layer.

### Result

- Status: completed
- Verdict: `shared_preserve_layer_not_primary_blocker_vertical_overlay_eddy_export_coupling`
- What C19 proved:
  - C13 and C17 still share the same preserved low-level contract:
    - `nudgeParams.tauQvS`
    - `nudgeParams.tauQvColumn`
    - `nudgeParams organized/subsidence relief quartet`
    - `windNudgeParams.tauSurfaceSeconds`
  - relative to C13, C17 improves the zonal-mean branch and 35° interface burden:
    - equator zonal-mean vapor flux north: `-301.63909 -> -249.95949`
    - 35° interface vapor flux north: `-467.08734 -> -373.49016`
  - but C17 still worsens the remaining eddy/export side:
    - equator eddy vapor flux north: `-34.29106 -> -109.90385`
    - equator low-level velocity mean: `-19.4512 -> -20.79729`
    - cross-equatorial vapor flux north: `-330.9854 -> -353.31687`
- Interpretation:
  - the preserved low-level contract alone is not the primary blocker
  - the remaining defect is now best explained by the vertical-overlay family coupling into the eddy/export branch
- Consequence: the next active move is now `Architecture C20: zonal-mean-preserving eddy nudge softening experiment`.

## Architecture C20: Zonal-Mean-Preserving Eddy Nudge Softening Experiment

### Objective

Keep the C17 carryover carveout fixed and soften only the surface eddy-energy rescaling lane to see if the unresolved eddy/export sign defect can be relieved without losing the zonal-mean and dry-belt gains.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.26`
  - `subtropicalDryNorthRatio: 1.534 -> 1.152`
  - `subtropicalDrySouthRatio: 1.199 -> 0.504`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.209`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.13877`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -361.48916`
- Transport comparison vs C17:
  - equator zonal-mean vapor flux north: `-249.95949 -> -254.59421`
  - equator eddy vapor flux north: `-109.90385 -> -114.18489`
  - equator low-level velocity mean: `-20.79729 -> -21.02244`
  - 35° interface vapor flux north: `-373.49016 -> -350.09613`
- Interpretation:
  - softening eddy rescaling preserved the broad quick-shape wins
  - but it did not relieve the equatorial sign defect and slightly worsened the core equatorial transport branches
  - so the next step should attribute the failed eddy-softening implementation rather than tune this family blindly
- Consequence: the next active move is now `Architecture C21: eddy-softening implementation attribution`.

## Architecture C21: Eddy-Softening Implementation Attribution

### Objective

Determine whether C20 global eddy softening was inert or whether it traded the wrong transport defect for a rebound in the NH dry-belt return/carryover family.

### Result

- Status: completed
- Verdict: `global_eddy_softening_reactivates_return_branch_carryover_without_fixing_equatorial_export`
- What C21 proved:
  - relative to C17, C20 worsens the core equatorial transport branches:
    - equator zonal-mean vapor flux north: `-249.95949 -> -254.59421`
    - equator eddy vapor flux north: `-109.90385 -> -114.18489`
    - equator low-level velocity mean: `-20.79729 -> -21.02244`
  - while the NH dry-belt return/carryover family rebounds:
    - carried-over upper cloud: `0.22666 -> 0.27973`
    - imported anvil persistence: `0.22501 -> 0.27804`
    - weak-erosion survival: `0.21732 -> 0.26804`
    - cloud recirculation proxy: `0.39988 -> 1.34927`
    - return-branch mass flux: `3368.15697 -> 3490.3125`
- Interpretation:
  - global eddy softening was active, not inert
  - but it relaxed the wrong parts of the hybrid and reopened the dry-belt carryover family without fixing the equatorial export defect
- Consequence: the next active move is now `Architecture C22: equatorial-band eddy softening carveout experiment`.

## Architecture C22: Equatorial-Band Eddy Softening Carveout Experiment

### Objective

Keep the C17 carryover carveout fixed and soften eddy-energy rescaling only inside a narrow equatorial band so the remaining equatorial export defect can be tested without relaxing subtropical rows enough to revive the dry-belt return/carryover family.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.499`
  - `subtropicalDryNorthRatio: 1.534 -> 1.137`
  - `subtropicalDrySouthRatio: 1.199 -> 0.51`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.216`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11658`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.11907`
- Interpretation:
  - equatorial-only softening preserved the broader quick wins and improved NH dry-belt ocean condensation relative to C17/C20
  - but the cross-equatorial transport sign is still inverted, so this family is not yet a keep candidate
- Consequence: the next active move is now `Architecture C23: equatorial-band eddy softening attribution`.

## Architecture C23: Equatorial-Band Eddy Softening Attribution

### Objective

Explain exactly what the C22 equatorial-band carveout changed relative to C17 so we can tell whether the remaining defect lives in the lower/mid zonal branch, the upper branch, or the dry-belt containment side effects.

### Result

- Status: completed
- Verdict: `equatorial_band_softening_preserves_dry_belt_relief_but_deepens_lower_mid_zonal_branch`
- What C23 proved:
  - relative to C17, C22 preserved the dry-belt containment side:
    - carried-over upper cloud: `0.22666 -> 0.22097`
    - imported anvil persistence: `0.22501 -> 0.21933`
    - weak-erosion survival: `0.21732 -> 0.21143`
    - cloud recirculation proxy: `0.39988 -> 0.39849`
    - return-branch mass flux: `3368.15697 -> 3348.50751`
  - and it modestly relieved the upper branch:
    - equator upper total-water flux north: `-13.44686 -> -13.3117`
  - but it deepened the lower and mid equatorial branches, mostly through the zonal-mean side:
    - equator boundary-layer total-water flux north: `-4.91319 -> -5.01709`
    - equator lower total-water flux north: `-17.72549 -> -17.83744`
    - equator mid total-water flux north: `-16.60787 -> -16.77592`
    - equator lower zonal vapor flux north: `-13.99991 -> -14.07888`
    - equator mid zonal vapor flux north: `-12.93476 -> -13.11577`
- Interpretation:
  - the equatorial-band carveout was directionally useful because it preserved dry-belt relief and did not reopen the carryover family
  - but the remaining export defect is now concentrated in the inner equatorial core, especially the lower/mid zonal branch
- Consequence: the next active move is now `Architecture C24: inner-core equatorial eddy softening experiment`.

## Architecture C24: Inner-Core Equatorial Eddy Softening Experiment

### Objective

Keep the C17 carryover carveout and the C22 dry-belt containment contract fixed, then narrow the eddy softening footprint into the inner equatorial core so the lower/mid zonal branch is perturbed less aggressively.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.275`
  - `subtropicalDryNorthRatio: 1.534 -> 1.091`
  - `subtropicalDrySouthRatio: 1.199 -> 0.506`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.214`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12705`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -358.07208`
- Interpretation:
  - narrowing to the inner core improved ITCZ width and both dry-belt ratios relative to C22, and it modestly relieved parts of the lower/mid equatorial transport burden
  - but it gave back some of the upper-branch and dry-belt condensation relief, reintroduced carryover/return-branch rebound, and the cross-equatorial sign inversion stayed severe
- Consequence: the next active move is now `Architecture C25: inner-core equatorial eddy softening attribution`.

## Architecture C25: Inner-Core Equatorial Eddy Softening Attribution

### Objective

Attribute the C24 inner-core narrowing relative to C22 so we can tell whether the narrower footprint relieved the right branch or simply traded lower-mid burden for upper-branch and carryover rebound.

### Result

- Status: completed
- Verdict: `inner_core_narrowing_relieves_lower_mid_core_but_reopens_upper_carryover_shoulder`
- What C25 proved:
  - C24 improved the broad quick-shape metrics relative to C22:
    - `itczWidthDeg: 23.499 -> 23.275`
    - `subtropicalDryNorthRatio: 1.137 -> 1.091`
    - `subtropicalDrySouthRatio: 0.51 -> 0.506`
  - and it relieved the boundary/lower/mid equatorial burden:
    - equator boundary-layer total-water flux north: `-5.01709 -> -4.84216`
    - equator lower total-water flux north: `-17.83744 -> -17.49403`
    - equator mid total-water flux north: `-16.77592 -> -16.75772`
    - equator lower zonal vapor flux north: `-14.07888 -> -13.80457`
    - equator mid zonal vapor flux north: `-13.11577 -> -12.99397`
  - but it gave back upper-branch and carryover support:
    - equator upper total-water flux north: `-13.3117 -> -13.59209`
    - carried-over upper cloud: `0.22097 -> 0.23253`
    - imported anvil persistence: `0.21933 -> 0.23079`
    - weak-erosion survival: `0.21143 -> 0.22243`
    - cloud recirculation proxy: `0.39849 -> 0.49385`
    - return-branch mass flux: `3348.50751 -> 3447.36194`
- Interpretation:
  - the inner-core narrowing relieved the lower-mid equatorial core the way we wanted
  - but the 10–16° shoulder was still carrying useful upper-branch and dry-belt containment support
- Consequence: the next active move is now `Architecture C26: partial equatorial shoulder restore experiment`.

## Architecture C26: Partial Equatorial Shoulder Restore Experiment

### Objective

Keep the C24 inner-core narrowing as the base contract and restore only a modest amount of outer shoulder support so the hybrid can test whether some 10–12°/12–14° relief helps the upper branch without recreating the full C22 lower-mid drag.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.412`
  - `subtropicalDryNorthRatio: 1.534 -> 1.119`
  - `subtropicalDrySouthRatio: 1.199 -> 0.515`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.225`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11952`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.85346`
- Interpretation:
  - the partial shoulder restore did improve NH dry-belt ocean condensation and slightly reduced the magnitude of the cross-equatorial sign defect relative to C24
  - but it also gave back some of the C24 ITCZ and dry-belt-ratio gains, and the cross-equatorial transport sign is still severely inverted
- Consequence: the next active move is now `Architecture C27: partial equatorial shoulder restore attribution`.

## Architecture C27: Partial Equatorial Shoulder Restore Attribution

### Objective

Explain exactly what the C26 shoulder restore helped and hurt relative to the C24 inner-core baseline so the next experiment can weaken only the part of the restore that overcorrected.

### Result

- Status: completed
- Verdict: `partial_shoulder_restore_recovers_upper_branch_and_return_flow_but_reloads_lower_import_and_cloud_recirculation`
- What C27 proved:
  - C26 did recover useful circulation support relative to C24:
    - cross-equatorial vapor flux north: `-358.07208 -> -353.85346`
    - equator upper total-water flux north: `-13.59209 -> -13.23333`
    - return-branch mass flux: `3447.36194 -> 3383.23239`
    - NH dry-belt ocean condensation: `0.12705 -> 0.11952`
  - but it also reloaded the wrong branch:
    - equator lower total-water flux north: `-17.49403 -> -18.00423`
    - 35° lower vapor import: `-22.69662 -> -22.99819`
    - 35° mid vapor import: `-17.16362 -> -17.27508`
    - cloud recirculation proxy: `0.49385 -> 0.60796`
- Interpretation:
  - the shoulder-restore direction was useful
  - but C26 restored too much shoulder support, so the next move should be a weaker partial restore rather than another full-strength shoulder experiment
- Consequence: the next active move is now `Architecture C28: weak partial shoulder restore experiment`.

## Architecture C28: Weak Partial Shoulder Restore Experiment

### Objective

Keep the C24 inner-core narrowing fixed and test a weaker outer shoulder restore than C26 so the hybrid can retain some upper-branch relief while trimming the lower-branch reload.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.321`
  - `subtropicalDryNorthRatio: 1.534 -> 1.097`
  - `subtropicalDrySouthRatio: 1.199 -> 0.487`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.202`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.15539`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -323.23581`
- Interpretation:
  - weakening the shoulder restore did substantially improve the cross-equatorial sign defect relative to C26 and relieved the equatorial eddy branch, especially in the mid and upper layers
  - but it gave back the NH dry-belt ocean condensation win and still failed the quick gate, so the remaining tradeoff is now sharply concentrated between transport-sign recovery and dry-belt condensation control
- Consequence: the next active move is now `Architecture C29: weak partial shoulder restore attribution`.

## Architecture C29: Weak Partial Shoulder Restore Attribution

### Objective

Explain exactly what the weak partial shoulder restore in C28 fixed and what it broke, so the next experiment can target the reopened dry-belt receiver side without undoing the equatorial export relief.

### Result

- Status: completed
- Verdict: `weak_restore_relieves_equatorial_eddy_export_but_reopens_dry_belt_carryover_condensation`
- What C29 proved:
  - C28 materially relieved the equatorial export side relative to C26:
    - cross-equatorial vapor flux north: `-353.85346 -> -323.23581`
    - equator lower total-water flux north: `-18.00423 -> -16.93964`
    - equator mid total-water flux north: `-16.6919 -> -14.80431`
    - equator upper total-water flux north: `-13.23333 -> -11.22308`
  - but it reopened the dry-belt receiver/carryover side:
    - NH dry-belt ocean condensation: `0.11952 -> 0.15539`
    - carryover upper cloud: `0.2348 -> 0.24485`
    - imported anvil persistence: `0.23307 -> 0.24284`
    - weak-erosion cloud survival: `0.22509 -> 0.23434`
    - cloud recirculation proxy: `0.60796 -> 0.74157`
- Interpretation:
  - the weak restore geometry was directionally right for the equatorial eddy/export problem
  - the remaining rebound was no longer on the shoulder itself, but on the dry-belt carry-input / carryover receiver lane
- Consequence: the next active move is now `Architecture C30: weak restore carry-input recapture experiment`.

## Architecture C30: Weak Restore Carry-Input Recapture Experiment

### Objective

Keep the C28 weak shoulder geometry fixed and strengthen only the dry-belt carry-input recapture contract so the hybrid can regain NH dry-belt condensation control without re-strengthening the shoulder.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.315`
  - `subtropicalDryNorthRatio: 1.534 -> 1.093`
  - `subtropicalDrySouthRatio: 1.199 -> 0.502`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12693`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.96486`
- Interpretation:
  - the carry-input recapture tuning did recover NH dry-belt ocean condensation relative to C28 while preserving most of the broad quick-shape gains
  - but it did not solve the equatorial transport-sign inversion and slightly worsened the cross-equatorial flux relative to C28, so the next move needs attribution rather than more brute-force carry-input tuning
- Consequence: the next active move is now `Architecture C31: weak-restore carry-input recapture attribution`.

## Architecture C31: Weak-Restore Carry-Input Recapture Attribution

### Objective

Explain what the stronger C30 carry-input recapture actually fixed and what it damaged, so the next experiment can protect the helpful dry-belt/zonal-mean side without reopening the same eddy/export defect.

### Result

- Status: completed
- Verdict: `carry_input_recapture_recovers_dry_belt_and_zonal_mean_but_reloads_equatorial_eddy_export_recirculation`
- What C31 proved:
  - C30 materially improved the receiver side relative to C28:
    - NH dry-belt ocean condensation: `0.15539 -> 0.12693`
    - carried-over upper cloud: `0.24485 -> 0.2187`
    - imported anvil persistence: `0.24284 -> 0.21701`
    - dominant vapor import: `-25.51113 -> -22.82573`
  - C30 also improved the equatorial zonal-mean branch:
    - lower zonal-mean transport: `-14.49379 -> -14.10166`
    - mid zonal-mean transport: `-14.12323 -> -12.98794`
    - upper zonal-mean transport: `-8.8185 -> -7.84381`
  - but the remaining failure is concentrated in the eddy/export side:
    - cross-equatorial vapor flux north: `-323.23581 -> -353.96486`
    - lower eddy transport: `-2.44586 -> -3.88858`
    - mid eddy transport: `-0.68108 -> -3.6845`
    - upper eddy transport: `-2.40458 -> -5.10272`
    - cloud recirculation proxy: `0.74157 -> 1.18525`
- Interpretation:
  - the stronger recapture was not wrong globally; it was helpful on the receiver and zonal-mean branches
  - the defect now looks like over-admission of organized equatorial cells into that stronger recapture layer
- Consequence: the next active move is now `Architecture C32: organized-support carry-input carveout experiment`.

## Architecture C32: Organized-Support Carry-Input Carveout Experiment

### Objective

Keep the C30 recapture base fixed and restore stricter organized-support / potential caps so organized equatorial cells are carved out of the stronger recapture without giving back the receiver relief.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.374`
  - `subtropicalDryNorthRatio: 1.534 -> 1.122`
  - `subtropicalDrySouthRatio: 1.199 -> 0.493`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - restoring the stricter organized-support / potential caps kept the broad quick-shape gains and improved NH dry-belt ocean condensation even further
  - but it still did not fix the transport-sign inversion and slightly worsened the cross-equatorial defect relative to C30, so more cap retuning is not justified without another attribution pass
- Consequence: the next active move is now `Architecture C33: organized-support carry-input carveout attribution`.

## Architecture C33: Organized-Support Carry-Input Carveout Attribution

### Objective

Explain exactly what the stricter C32 organized-support / potential carveout fixed and what it re-broke, so the next experiment can keep the useful receiver relief without over-tightening the lower-mid equatorial core.

### Result

- Status: completed
- Verdict: `organized_support_carveout_restores_receiver_containment_and_upper_branch_but_deepens_lower_mid_core_import`
- What C33 proved:
  - C32 tightened the receiver side relative to C30:
    - NH dry-belt ocean condensation: `0.12693 -> 0.10807`
    - carryover upper cloud: `0.2187 -> 0.17351`
    - imported anvil persistence: `0.21701 -> 0.17183`
    - cloud recirculation proxy: `1.18525 -> 0.44108`
  - C32 also improved the upper equatorial branch:
    - upper total-water flux north: `-12.94654 -> -12.82647`
    - upper zonal-mean transport: `-7.84381 -> -7.78225`
    - upper eddy transport: `-5.10272 -> -5.04422`
  - but it deepened the lower-mid core and the dry-belt import burden:
    - lower total-water flux north: `-17.99024 -> -18.3439`
    - mid total-water flux north: `-16.67245 -> -16.74764`
    - 35° lower vapor import: `-22.46949 -> -23.19317`
    - 35° mid vapor import: `-16.40141 -> -17.28133`
- Interpretation:
  - the organized-support carveout itself was directionally right
  - but restoring both stricter caps over-tightened the lower-mid core, so the next bounded move should keep the strict organized-support cap and only partially relax the potential cap
- Consequence: the next active move is now `Architecture C34: potential-half-relax carry-input experiment`.

## Architecture C34: Potential-Half-Relax Carry-Input Experiment

### Objective

Keep the C32 strict organized-support cap fixed and only half-relax the convective-potential cap so the lower-mid equatorial core can recover without reopening the receiver side.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.374`
  - `subtropicalDryNorthRatio: 1.534 -> 1.122`
  - `subtropicalDrySouthRatio: 1.199 -> 0.493`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - the potential half-relax was effectively inert at the quick-score level relative to C32
  - that means the potential cap was not the main active binder in the admitted subset, so more potential-cap tuning is not justified without another attribution pass
- Consequence: the next active move is now `Architecture C35: potential-half-relax carry-input attribution`.

## Architecture C35: Potential-Half-Relax Carry-Input Attribution

### Objective

Prove whether the C34 potential half-relax changed any live climate or transport state at all, so the next experiment targets the real active binder instead of continuing to retune an inert cap.

### Result

- Status: completed
- Verdict: `potential_half_relax_inert_potential_cap_not_primary_binder`
- What C35 proved:
  - C34 is unchanged from C32 to reporting precision across the quick screen:
    - `itczWidthDeg: 23.374 -> 23.374`
    - `subtropicalDryNorthRatio: 1.122 -> 1.122`
    - `subtropicalDrySouthRatio: 0.493 -> 0.493`
    - `midlatitudeWesterliesNorthU10Ms: 1.219 -> 1.219`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.10807 -> 0.10807`
    - `crossEquatorialVaporFluxNorthKgM_1S: -356.96839 -> -356.96839`
  - the equatorial transport stack is also unchanged:
    - lower total-water flux north: `-18.3439 -> -18.3439`
    - mid total-water flux north: `-16.74764 -> -16.74764`
    - upper total-water flux north: `-12.82647 -> -12.82647`
  - dry-belt receiver containment is unchanged:
    - carryover upper cloud: `0.17351 -> 0.17351`
    - imported anvil persistence: `0.17183 -> 0.17183`
    - cloud recirculation proxy: `0.44108 -> 0.44108`
- Interpretation:
  - the half-relaxed potential cap is inert in this family
  - the strict organized-support cap is the remaining live binder, not the potential cap
- Consequence: the next active move is now `Architecture C36: organized-support half-relax carry-input experiment`.

## Architecture C36: Organized-Support Half-Relax Carry-Input Experiment

### Objective

Keep the strict potential cap fixed, partially relax only organized support, and test whether the lower-mid equatorial core can recover without fully reopening the dry-belt receiver side.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.315`
  - `subtropicalDryNorthRatio: 1.534 -> 1.093`
  - `subtropicalDrySouthRatio: 1.199 -> 0.502`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12693`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.96486`
- Interpretation:
  - organized-support half-relax is active, unlike C34
  - but it mostly returns the hybrid to the older C30 tradeoff:
    - some receiver-side containment is given back
    - the cross-equatorial sign defect remains severe
- Consequence: the next active move is now `Architecture C37: organized-support half-relax carry-input attribution`.

## Architecture C37: Organized-Support Half-Relax Carry-Input Attribution

### Objective

Determine whether the C36 organized-support half-relax is a meaningful intermediate state or just a threshold cliff back to the broader C30 carry-input regime.

### Result

- Status: completed
- Verdict: `organized_support_half_relax_inert_threshold_cliff_reverts_to_c30`
- What C37 proved:
  - C36 reproduces the full C30 quick score:
    - `itczWidthDeg: 23.315 -> 23.315`
    - `subtropicalDryNorthRatio: 1.093 -> 1.093`
    - `subtropicalDrySouthRatio: 0.502 -> 0.502`
    - `midlatitudeWesterliesNorthU10Ms: 1.232 -> 1.232`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.12693 -> 0.12693`
    - `crossEquatorialVaporFluxNorthKgM_1S: -353.96486 -> -353.96486`
  - C36 also reproduces the full C30 transport and receiver signatures:
    - equator lower total-water flux north: `-17.99024 -> -17.99024`
    - 35° lower vapor import: `-22.46949 -> -22.46949`
    - carryover upper cloud: `0.2187 -> 0.2187`
    - cloud recirculation proxy: `1.18525 -> 1.18525`
- Interpretation:
  - scalar organized-support half-relax is a threshold cliff, not a usable intermediate control
  - once the blocked subset is re-admitted, the hybrid snaps back to the broader C30 recapture regime
- Consequence: the next active move is now `Architecture C38: inner-core organized-support restore experiment`.

## Architecture C38: Inner-Core Organized-Support Restore Experiment

### Objective

Keep the strict C32 organized-support / potential carveout outside the equatorial core, but restore organized-support admission only inside the inner equatorial core so the blocked lower-mid transport can recover without reopening the whole receiver side.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.374`
  - `subtropicalDryNorthRatio: 1.534 -> 1.122`
  - `subtropicalDrySouthRatio: 1.199 -> 0.493`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - the simple inner-core restore is also inert at the quick-score level relative to C32
  - that means the blocked subset is not being reached by this basic inner-core latitude taper
- Consequence: the next active move is now `Architecture C39: inner-core organized-support restore attribution`.

## Architecture C39: Inner-Core Organized-Support Restore Attribution

### Objective

Prove why the C38 inner-core organized-support restore was inert.

### Contract

Compare the strict C32 carveout against C38 at the latitude-resolved carry-input override layer and confirm whether the restore geometry ever touched the live override targets.

### Result

- Status: completed
- Verdict: `inner_core_restore_inert_active_override_targets_outside_restore_band`
- Quick comparison:
  - `crossEquatorialVaporFluxNorthKgM_1S: -356.96839 -> -356.96839`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.10807 -> 0.10807`
- Active override rows:
  - accumulated hits stayed fixed at `33.75°`, `26.25°`, `18.75°`, `-18.75°`, `-26.25°`, `-33.75°`
  - accumulated removed mass stayed fixed at `33.75°`, `26.25°`, `18.75°`, `-18.75°`, `-26.25°`, `-33.75°`
- Interpretation:
  - the C38 inner-core restore never touched the live carry-input override rows
  - the blocked subset lives in the transition / receiver band, not the equatorial core
- Consequence: the next active move became `Architecture C40: transition-band organized-support restore experiment`.

## Architecture C40: Transition-Band Organized-Support Restore Experiment

### Objective

Restore organized-support admission only across the active transition-band rows where the carry-input override is actually accumulating.

### Contract

Keep the strict C32 organized-support / potential carveout in the equatorial core, but restore organized-support admission with a bounded latitude taper across the live transition-band override rows.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.386`
  - `subtropicalDryNorthRatio: 1.534 -> 1.128`
  - `subtropicalDrySouthRatio: 1.199 -> 0.49`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.225`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11898`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.94778`
- Interpretation:
  - the transition-band geometry is active, not inert
  - relative to strict C32 it only slightly relieves the sign defect (`-356.96839 -> -355.94778`)
  - but it also gives back some receiver containment (`northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.10807 -> 0.11898`, `cloudRecirculationProxyKgM_1S: 0.44108 -> 0.49162`)
- Consequence: the next active move is now `Architecture C41: transition-band organized-support restore attribution`.

## Architecture C41: Transition-Band Organized-Support Restore Attribution

### Objective

Pin down exactly what the active C40 transition-band geometry changed relative to the strict C32 carveout.

### Contract

Attribute the C40 tradeoff across equatorial transport, NH receiver metrics, and latitude-resolved override shifts to see whether the transition-band restore helped the right subset or simply moved the burden into a different receiver lane.

### Result

- Status: completed
- Verdict: `transition_band_restore_shifts_override_equatorward_and_slightly_relieves_sign_defect_but_reloads_26p25_receiver_lane`
- Key evidence:
  - `crossEquatorialVaporFluxNorthKgM_1S: -356.96839 -> -355.94778`
  - equator lower total-water flux north: `-18.3439 -> -18.50334`
  - equator mid total-water flux north: `-16.74764 -> -16.63613`
  - equator upper total-water flux north: `-12.82647 -> -12.71408`
  - `26.25°` accumulated override hits: `18.625 -> 18.667`
  - `33.75°` accumulated override hits: `5.698 -> 5.51`
  - `26.25°` carried-over upper cloud: `0.05 -> 0.06`
  - `33.75°` carried-over upper cloud: `0.429 -> 0.424`
- Interpretation:
  - the transition-band restore is genuinely active
  - it slightly relieves the sign defect and helps the mid-upper / 35° zonal-mean side
  - but it does that by shifting load equatorward into the `26.25°` receiver lane, which modestly reopens NH dry-belt containment
- Consequence: the next active move became `Architecture C42: equatorward-transition organized-support restore experiment`.

## Architecture C42: Equatorward-Transition Organized-Support Restore Experiment

### Objective

Keep the transition-band geometry live while backing away from the `26.25°` receiver lane.

### Contract

Narrow the organized-support restore equatorward so it still reaches the `18.75°`-class transition cells but fades out before the `26.25°` receiver lane can reopen.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.374`
  - `subtropicalDryNorthRatio: 1.534 -> 1.122`
  - `subtropicalDrySouthRatio: 1.199 -> 0.493`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - narrowing the restore equatorward backed away from the `26.25°` receiver lane successfully
  - but it also erased the small C40 sign-defect relief and snapped the quick climate back to the strict C32 state
  - that means the `26.25°` lane is not just collateral damage; some part of it is carrying the only live sign-relief signal in this subfamily
- Consequence: the next active move is now `Architecture C43: equatorward-transition organized-support restore attribution`.

## Architecture C43: Equatorward-Transition Organized-Support Restore Attribution

### Objective

Determine whether removing the `26.25°` lane from the restore geometry merely weakens the C40 signal or eliminates it completely.

### Contract

Compare C42 against both the strict C32 carveout and the broader C40 transition-band restore to test whether the `26.25°` lane is the only live signal carrier in this subfamily.

### Result

- Status: completed
- Verdict: `equatorward_narrowing_removes_26p25_restore_signal_and_exactly_reverts_to_c32`
- Key evidence:
  - C32 vs C42 quick metrics are identical to reporting precision
  - `26.25°` override hits: C40 `18.667`, C42 `18.625`
  - `26.25°` carried-over upper cloud: C40 `0.06`, C42 `0.05`
  - `33.75°` override hits: C40 `5.51`, C42 `5.698`
- Interpretation:
  - once the `26.25°` lane is removed, the entire live C40 signal disappears
  - C42 is a full reversion to the strict C32 state, not a weaker intermediate
- Consequence: the next active move became `Architecture C44: 26p25-centered organized-support restore experiment`.

## Architecture C44: 26p25-Centered Organized-Support Restore Experiment

### Objective

Test whether the `26.25°` lane alone is sufficient to reproduce the only live organized-support restore signal.

### Contract

Keep the strict C32 carveout fixed everywhere except a centered restore around the `26.25°` lane and its mirrored southern row.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.374`
  - `subtropicalDryNorthRatio: 1.534 -> 1.122`
  - `subtropicalDrySouthRatio: 1.199 -> 0.493`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - the isolated `26.25°` lane is not sufficient on its own
  - C44 also collapses straight back to the strict C32 state instead of reproducing the small C40 signal
  - so the live C40 relief requires broader transition-geometry coupling, not just the `26.25°` lane in isolation
- Consequence: the next active move is now `Architecture C45: 26p25-centered organized-support restore attribution`.

## Architecture C45: 26p25-Centered Organized-Support Restore Attribution

### Objective

Prove whether the isolated `26.25°` restore is merely too weak or whether it fundamentally cannot carry the live C40 signal by itself.

### Contract

Compare C44 against both the strict C32 carveout and the broader C40 transition-band restore. If C44 fully matches C32 while both the `26.25°` and `33.75°` lanes revert from C40, then the honest next move is a coupled poleward-shoulder restore instead of any more single-lane tuning.

### Result

- Status: completed
- Verdict: `isolated_26p25_restore_insufficient_c40_signal_requires_poleward_shoulder_coupling`
- Key evidence:
  - C32 vs C44 quick metrics are identical to reporting precision
  - `26.25°` override hits: C40 `18.667`, C44 `18.625`
  - `26.25°` carried-over upper cloud: C40 `0.06`, C44 `0.05`
  - `33.75°` override hits: C40 `5.51`, C44 `5.698`
  - `33.75°` carried-over upper cloud: C40 `0.424`, C44 `0.429`
- Interpretation:
  - the isolated `26.25°` lane is necessary but not sufficient
  - the live C40 signal depends on coupling between the `26.25°` lane and the poleward shoulder rather than on `26.25°` alone
- Consequence: the next active move became `Architecture C46: 26p25-33p75 coupled organized-support restore experiment`.

## Architecture C46: 26p25-33p75 Coupled Organized-Support Restore Experiment

### Objective

Test whether restoring organized-support only across the coupled `26.25°–33.75°` poleward shoulder is sufficient to reproduce the only live C40 sign-relief signal without reopening the full broad transition band.

### Contract

Keep the strict C32 organized-support / potential carveout fixed in the equatorial core and restore organized-support only across the coupled poleward shoulder. Leave `18.75°` and the equatorial core outside the active restore geometry.

### Result

- Status: completed
- Verdict: `quick_reject`
- Quick gate:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
- Quick outcome:
  - `itczWidthDeg: 25.91 -> 23.315`
  - `subtropicalDryNorthRatio: 1.534 -> 1.093`
  - `subtropicalDrySouthRatio: 1.199 -> 0.502`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12693`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.96486`
- Interpretation:
  - the coupled `26.25°–33.75°` shoulder is a real active lever, unlike the inert single-lane C44 restore
  - but it does not recreate the smaller C40 sign-relief state
  - instead it reproduces the broader C30 weak-restore carry-input recapture regime to reporting precision
- Consequence: the next active move is now `Architecture C47: 26p25-33p75 coupled organized-support restore attribution`.

## Phase 1: Climate Base Recovery

### Objective

Recover the large-scale climate scaffold that storms emerge from.

### Primary file lanes

- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

### Required outputs

- `weather-validation/reports/earth-weather-phase1-climate-base-recovery.md`
- `weather-validation/output/earth-weather-phase1-quick.json`
- `weather-validation/output/earth-weather-phase1-annual.json`

### Screening gate

A candidate may proceed from `30` days to `365` days only if it improves at least `4 / 6` core metrics and worsens none by more than `5%`.

### Day-365 pass gate

- `itczWidthDeg <= 24.2`
- `subtropicalDryNorthRatio <= 1.20`
- `subtropicalDrySouthRatio <= 0.80`
- `midlatitudeWesterliesNorthU10Ms >= 0.95`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2 <= 0.18`
- `75 <= crossEquatorialVaporFluxNorthKgM_1S <= 250`

These are the Phase 1 recovery gates, not the final perfection gates.

### Hard stop

If two top-level experiment families fail the annual gate here, do not continue local patching. Return to Phase 0 or escalate to architecture change.

## Phase 2: Seasonal Earth Realism

### Objective

Make the annual cycle Earth-like.

### Primary file lanes

- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- `scripts/agent/earth-weather-monthly-scorecard.mjs`
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- whichever physics lane is still failing the phase scorecard

### Required outputs

- `weather-validation/reports/earth-weather-phase2-seasonal-realism.md`
- `weather-validation/reports/earth-weather-phase2-monthly-scorecard.json`

### Metrics

- Monthly ITCZ latitude
- Monthly ITCZ width
- Monthly NH / SH dry-belt ratios
- Monthly jet latitude and strength
- Monthly precipitation climatology by major basin / monsoon region

### Pass / fail gate

- ITCZ migration amplitude over the annual cycle must be between `4` and `12` degrees
- No month may exceed `itczWidthDeg = 24.5`
- NH dry-belt ratio must be `<= 1.25` in at least `10 / 12` months and never exceed `1.35`
- SH dry-belt ratio must be `<= 0.90` in at least `10 / 12` months and never exceed `1.00`
- NH and SH storm-track peaks must stay within `45–65` degrees latitude in every sampled month

If Phase 2 fails, do not start storm work.

## Phase 3: Regional Weather-Regime Realism

### Objective

Make the geography of weather regimes look Earth-like.

### Primary file lanes

- `scripts/agent/earth-weather-regime-atlas.mjs`
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

### Required outputs

- `weather-validation/reports/earth-weather-phase3-regime-atlas.md`
- `weather-validation/reports/earth-weather-phase3-regime-atlas.json`

### Metrics

- Tropical deep-convection occupancy
- Subtropical dry-belt occupancy
- Marine deck occupancy
- Midlatitude storm-track occupancy
- Basin / continent regime maps

### Pass / fail gate

- In the `±15°` tropical belt, deep-convection occupancy must exceed dry-belt occupancy
- In the `15–35°` oceanic subtropics, dry-belt occupancy must be the dominant regime in both hemispheres
- In the `40–65°` oceanic midlatitudes, storm-track occupancy must be the dominant regime in both hemispheres
- Eastern-ocean subtropical marine-deck occupancy must exceed each basin’s open-ocean subtropical mean

If Phase 3 fails, storm climatology work is premature.

## Phase 4: Tropical Cyclone Environment Realism

### Objective

Get the hurricane / cyclone environment right before judging storm emergence.

### Primary file lanes

- `scripts/agent/earth-weather-tc-environment.mjs`
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

### Required outputs

- `weather-validation/reports/earth-weather-phase4-tc-environment.md`
- `weather-validation/reports/earth-weather-phase4-tc-environment.json`

### Metrics

- Basin-by-basin favorable environment counts by month
- Genesis-favorable latitude distribution
- Warm-season vs off-season favorability ratio
- Shear / humidity / thermodynamic favorability proxies

### Pass / fail gate

- North Atlantic, East Pacific, West Pacific, South Indian, and South Pacific must all show nonzero warm-season favorable environment
- Each basin’s warm-season favorable-environment count must be at least `3x` its off-season count
- No basin may peak in the wrong half of the year
- Genesis-favorable latitude mean must sit within `5–25°` in the tropical-cyclone basins

If Phase 4 fails, emergent hurricane counts are not meaningful yet.

## Phase 5: Emergent Storm Realism

### Objective

Validate that storms emerge naturally from the model.

### Primary file lanes

- `scripts/agent/earth-weather-storm-climatology.mjs`
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- the chosen canonical physics lanes from Phases 1–4

### Required outputs

- `weather-validation/reports/earth-weather-phase5-emergent-storm-realism.md`
- `weather-validation/reports/earth-weather-phase5-storm-climatology.json`

### Run horizon

- At least one free-running `5`-year experiment on the canonical branch

### Metrics

- Tropical cyclone counts by basin and season
- Track density maps
- Genesis latitude distribution
- Intensity distribution
- Extratropical cyclone density and seasonal peaks
- Extreme rain and wind distributions

### Pass / fail gate

- Tropical cyclone tracks must occur in at least `4` major basins across the `5`-year run
- Basin seasonal peaks must align with the correct warm half of the year
- At least `80%` of tropical cyclone genesis events must occur between `5–25°` latitude
- Extratropical cyclone density must peak in the `35–65°` oceanic storm-track belts in both hemispheres

If Phase 5 fails, the model is not yet producing Earth-like emergent weather.

## Phase 6: Multi-Year Stability And Drift

### Objective

Prove the model stays realistic instead of drifting into a false climate.

### Primary file lanes

- `scripts/agent/earth-weather-multiyear-drift.mjs`
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

### Required outputs

- `weather-validation/reports/earth-weather-phase6-multiyear-drift.md`
- `weather-validation/reports/earth-weather-phase6-multiyear-drift.json`

### Run horizon

- At least one free-running `5`-year benchmark
- preferred `10`-year confirming benchmark

### Pass / fail gate

- ITCZ width drift must stay within `0.5 deg / year`
- NH dry-belt ratio drift must stay within `0.10 / year`
- SH dry-belt ratio drift must stay within `0.10 / year`
- NH westerly drift must stay within `0.05 m/s / year`
- No annual conservation or restart-parity failure may appear

## Phase 7: Scientific Review And Ship Readiness

### Objective

Make the system defensible, reproducible, and shippable.

### Primary outputs

- `weather-validation/reports/earth-weather-final-scorecard.md`
- `weather-validation/reports/earth-weather-final-scorecard.json`
- `weather-validation/reports/earth-weather-limitations.md`

### Checklist

- [ ] Consolidate all phase scorecards into one dashboard
- [ ] Document known limitations honestly
- [ ] Produce before / after branch comparisons
- [ ] Lock the default runtime and validation presets
- [ ] Re-run final reproducibility and browser/runtime signoff

### Pass / fail gate

Pass only if:
- Phases `1–6` are green on the canonical branch
- the browser/runtime path is stable enough to ship
- the documentation and scorecards are reproducible from the repo

## Immediate Next Step

Phase 0 is now complete and failed to produce a clean canonical base:
- current branch wins on `ITCZ width` and `NH dry-belt ratio`
- rollback archive wins on `SH dry-belt ratio`, `NH westerlies`, and `cross-equatorial vapor flux`
- no branch clears the full Phase 0 gate cleanly

So the next active step is no longer branch selection.

It is:
- `Architecture A: circulation-preserving dry-belt partition redesign`

That architecture lane should be framed as:
- keep the current branch’s stronger NH dry-belt moisture-partitioning behavior in scope
- recover the rollback branch’s stronger NH jet / cross-equatorial circulation behavior
- test only broad integrated families, not local residual patches
