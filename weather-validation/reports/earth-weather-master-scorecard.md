# Earth Weather Master Scorecard

Updated: 2026-04-16

## Top-level phase status

- Phase 0 Base-State Recovery Decision: COMPLETED (`no_clear_winner`)
- Architecture A Circulation-Preserving Dry-Belt Partition Redesign: COMPLETED
- Architecture A1 Explicit Subtropical Balance Contract Experiment: FAILED (`quick_reject`)
- Architecture A2 Circulation-Preserving Partition Port: FAILED (`quick_reject`)
- Architecture B Circulation-First Partition Rebuild: COMPLETED
- Architecture B1 Circulation Scaffold Rebuild: FAILED (`quick_reject`)
- Architecture B2 Explicit Circulation-State Port: FAILED (`quick_reject`)
- Architecture B3 Direct Rollback Circulation Splice: FAILED (`quick_reject`)
- Architecture C Code-Level Hybridization Design: COMPLETED
- Architecture C1 Hybrid Seam Contract: COMPLETED
- Architecture C2 Donor-Base Hybrid Worktree Benchmark: FAILED (`integration_blocked_missing_dependency`)
- Architecture C3 Hybrid Integration Bridge Design: COMPLETED
- Architecture C4 Donor-Core Integration Bridge Implementation: COMPLETED
- Architecture C5 Bridged Donor-Base Hybrid Rerun Benchmark: FAILED (`hybrid_boot_failure`)
- Architecture C6 Bridged Hybrid Attribution Design: COMPLETED
- Architecture C7 Bridged Hybrid Artifact Contract Repair: FAILED (`cycle_guard_contract_block`)
- Architecture C8 Donor-Worktree Cycle Contract Repair: COMPLETED
- Architecture C9 Donor-Worktree Runtime Fixture Repair: COMPLETED
- Architecture C10 Cycled Hybrid Benchmark Rerun: FAILED (`quick_reject`)
- Architecture C11 Cycled Hybrid Flux Inversion Attribution: COMPLETED
- Architecture C12 Equatorial Overturning Sign Contract Design: COMPLETED
- Architecture C13 Equatorial Overturning Sign Contract Experiment: FAILED (`quick_reject`)
- Architecture C14 Sign Contract Implementation Attribution: COMPLETED
- Architecture C15 Equatorial Vertical-State Contract Experiment: FAILED (`quick_reject`)
- Architecture C16 Vertical-Contract Implementation Attribution: COMPLETED
- Architecture C17 Zonal-Mean-Preserving Upper-Cloud Carryover Carveout Experiment: FAILED (`quick_reject`)
- Architecture C18 Carryover Carveout Implementation Attribution: COMPLETED
- Architecture C19 Zonal-Mean-Preserving Eddy Export Attribution: COMPLETED
- Architecture C20 Zonal-Mean-Preserving Eddy Nudge Softening Experiment: FAILED (`quick_reject`)
- Architecture C21 Eddy-Softening Implementation Attribution: COMPLETED
- Architecture C22 Equatorial-Band Eddy Softening Carveout Experiment: FAILED (`quick_reject`)
- Architecture C23 Equatorial-Band Eddy Softening Attribution: COMPLETED
- Architecture C24 Inner-Core Equatorial Eddy Softening Experiment: FAILED (`quick_reject`)
- Architecture C25 Inner-Core Equatorial Eddy Softening Attribution: COMPLETED
- Architecture C26 Partial Equatorial Shoulder Restore Experiment: FAILED (`quick_reject`)
- Architecture C27 Partial Equatorial Shoulder Restore Attribution: COMPLETED
- Architecture C28 Weak Partial Shoulder Restore Experiment: FAILED (`quick_reject`)
- Architecture C29 Weak Partial Shoulder Restore Attribution: COMPLETED
- Architecture C30 Weak Restore Carry-Input Recapture Experiment: FAILED (`quick_reject`)
- Architecture C31 Weak Restore Carry-Input Recapture Attribution: COMPLETED
- Architecture C32 Organized-Support Carry-Input Carveout Experiment: FAILED (`quick_reject`)
- Architecture C33 Organized-Support Carry-Input Carveout Attribution: COMPLETED
- Architecture C34 Potential-Half-Relax Carry-Input Experiment: FAILED (`quick_reject`)
- Architecture C35 Potential-Half-Relax Carry-Input Attribution: COMPLETED
- Architecture C36 Organized-Support Half-Relax Carry-Input Experiment: FAILED (`quick_reject`)
- Architecture C37 Organized-Support Half-Relax Carry-Input Attribution: COMPLETED
- Architecture C38 Inner-Core Organized-Support Restore Experiment: FAILED (`quick_reject`)
- Architecture C39 Inner-Core Organized-Support Restore Attribution: COMPLETED
- Architecture C40 Transition-Band Organized-Support Restore Experiment: FAILED (`quick_reject`)
- Architecture C41 Transition-Band Organized-Support Restore Attribution: COMPLETED
- Architecture C42 Equatorward-Transition Organized-Support Restore Experiment: FAILED (`quick_reject`)
- Architecture C43 Equatorward-Transition Organized-Support Restore Attribution: COMPLETED
- Architecture C44 26p25-Centered Organized-Support Restore Experiment: FAILED (`quick_reject`)
- Architecture C45 26p25-Centered Organized-Support Restore Attribution: COMPLETED
- Architecture C46 26p25-33p75 Coupled Organized-Support Restore Experiment: FAILED (`quick_reject`)
- Architecture C47 26p25-33p75 Coupled Organized-Support Restore Attribution: COMPLETED
- Architecture C48 Tapered Poleward-Shoulder Organized-Support Restore Experiment: FAILED (`quick_reject`)
- Architecture C49 Tapered Poleward-Shoulder Organized-Support Restore Attribution: COMPLETED
- Architecture C50 Partial 26p25 Receiver-Guard Transition-Band Experiment: FAILED (`quick_reject`)
- Phase 1 Climate Base Recovery: BLOCKED
- Phase 2 Seasonal Earth Realism: BLOCKED
- Phase 3 Regional Weather-Regime Realism: BLOCKED
- Phase 4 Tropical Cyclone Environment Realism: BLOCKED
- Phase 5 Emergent Storm Realism: BLOCKED
- Phase 6 Multi-Year Stability And Drift: BLOCKED
- Phase 7 Scientific Review And Ship Readiness: BLOCKED

## Canonical base decision

- Current branch: `codex/world-class-weather-loop`
- Rollback candidate: `codex/world-class-weather-loop-archive-20260407-0745`
- Verdict: `no_clear_winner`
- Selected base: none

## Architecture A decision

- Verdict: `integrated_partition_circulation_split_required`
- Preserve from current:
  - `itczWidthDeg`
  - `subtropicalDryNorthRatio`
- Recover from rollback archive:
  - `subtropicalDrySouthRatio`
  - `midlatitudeWesterliesNorthU10Ms`
  - `crossEquatorialVaporFluxNorthKgM_1S`

## Architecture A1 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-a1-balance-contract.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a1-balance-contract.md)
- Quick result:
  - improved metrics: `1 / 6`
  - severe regressions: `itczWidthDeg`, `subtropicalDryNorthRatio`, `subtropicalDrySouthRatio`
- Next active phase: `Architecture A2: circulation-preserving partition port`

## Architecture A2 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-a2-partition-port.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a2-partition-port.md)
- Best quick candidate: `ported-floor-soft-containment`
- Quick result:
  - improved metrics: `2 / 6`
  - severe regressions: none
  - preserved only partial current-branch partition gains:
    - `itczWidthDeg: 25.91 -> 25.826`
    - `subtropicalDryNorthRatio: 1.534 -> 1.507`
  - failed the circulation-recovery half of the contract:
    - `subtropicalDrySouthRatio: 1.199 -> 1.2`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14845`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 144.63218`
- Next active phase: `Architecture B: circulation-first partition rebuild`

## Architecture B decision

- Verdict: `circulation_scaffold_rebuild_required`
- Decision report: [earth-weather-architecture-b-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b-design.md)
- Summary:
  - Architecture A could preserve some partition gains
  - Architecture A could not recover SH dry-belt ratio, NH westerlies, or cross-equatorial vapor flux
  - the next family must rebuild circulation first, then re-port partition behavior
- Next active phase: `Architecture B1: circulation scaffold rebuild`

## Architecture B1 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-b1-circulation-scaffold.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b1-circulation-scaffold.md)
- Best quick candidate: `narrow-band-soft-containment`
- Quick result:
  - improved metrics: `1 / 6`
  - severe regressions: `itczWidthDeg`
  - partial movement:
    - `subtropicalDryNorthRatio: 1.534 -> 1.504`
  - failed circulation recovery:
    - `itczWidthDeg: 25.91 -> 26.218`
    - `subtropicalDrySouthRatio: 1.199 -> 1.201`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.16433`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 147.25094`
- Next active phase: `Architecture B2: explicit circulation-state port`

## Architecture B2 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-b2-circulation-state-port.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b2-circulation-state-port.md)
- Best quick candidate: `soft-containment-omega-port`
- Quick result:
  - improved metrics: `1 / 6`
  - severe regressions: `itczWidthDeg`
  - partial movement:
    - `subtropicalDryNorthRatio: 1.534 -> 1.504`
  - but explicit circulation-state ports on the weakened B1 scaffold still failed:
    - `itczWidthDeg: 25.91 -> 26.219`
    - `subtropicalDrySouthRatio: 1.199 -> 1.201`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.16605`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 147.22336`
- Next active phase: `Architecture B3: direct rollback circulation splice`

## Architecture B3 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-b3-rollback-circulation-splice.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b3-rollback-circulation-splice.md)
- Best quick candidate: `ported-floor-soft-containment-omega`
- Quick result:
  - improved metrics: `2 / 6`
  - severe regressions: none
  - preserved some current-branch NH partition gains:
    - `itczWidthDeg: 25.91 -> 25.837`
    - `subtropicalDryNorthRatio: 1.534 -> 1.512`
  - but the direct rollback splice still could not recover the circulation half of the contract:
    - `subtropicalDrySouthRatio: 1.199 -> 1.202`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14213`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 144.56866`
- Next active phase: `Architecture C: code-level rollback/current hybridization design`

## Architecture C decision

- Verdict: `module_level_hybrid_required`
- Decision report: [earth-weather-architecture-c-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c-design.md)
- Donor bundle:
  - `src/weather/v2/core5.js`
  - `src/weather/v2/vertical5.js`
- Preserve bundle:
  - `src/weather/v2/microphysics5.js`
- Adapter bundle:
  - `src/weather/v2/state5.js`
  - `src/weather/validation/diagnostics.js`
  - `scripts/agent/planetary-realism-audit.mjs`
- Next active phase: `Architecture C1: hybrid seam contract`

## Architecture C1 decision

- Verdict: `rollback_vertical_core_current_partition_adapter_contract`
- Decision report: [earth-weather-architecture-c1-hybrid-seam-contract.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c1-hybrid-seam-contract.md)
- Contract:
  - start from archive donor branch `codex/world-class-weather-loop-archive-20260407-0745`
  - keep rollback donor scaffold files:
    - `src/weather/v2/core5.js`
    - `src/weather/v2/vertical5.js`
  - forward-port current preserve layer:
    - `src/weather/v2/microphysics5.js`
  - forward-port current adapter stack:
    - `src/weather/v2/state5.js`
    - `src/weather/validation/diagnostics.js`
    - `scripts/agent/planetary-realism-audit.mjs`
- exclude current `core5.js` and `vertical5.js` as the starting point for the first hybrid benchmark
- Next active phase: `Architecture C2: donor-base hybrid worktree benchmark`

## Architecture C2 decision

- Verdict: `integration_blocked_missing_dependency`
- Decision report: [earth-weather-architecture-c2-donor-base-hybrid-benchmark.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c2-donor-base-hybrid-benchmark.md)
- Overlay bundle:
  - `src/weather/v2/microphysics5.js`
  - `src/weather/v2/state5.js`
  - `src/weather/v2/cloudBirthTracing5.js`
  - `src/weather/v2/sourceTracing5.js`
  - `src/weather/v2/instrumentationBands5.js`
  - `src/weather/validation/diagnostics.js`
  - `scripts/agent/planetary-realism-audit.mjs`
- Benchmark outcome:
  - hybrid quick run did not start because donor `core5.js` still uses extensionless ESM imports under the current Node runtime
  - first live blocker: missing module resolution for `./grid`
  - donor-core compatibility gaps also remain:
    - `getCloudTransitionLedgerRaw`
    - `resetCloudTransitionLedger`
    - `getModuleTimingSummary`
    - `getConservationSummary`
    - `loadStateSnapshot`
    - `setReplayDisabledModules`
    - `clearReplayDisabledModules`
- Next active phase: `Architecture C3: hybrid integration bridge design`

## Architecture C3 decision

- Verdict: `esm_and_core_api_bridge_required`
- Decision report: [earth-weather-architecture-c3-hybrid-integration-bridge-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c3-hybrid-integration-bridge-design.md)
- Required bridge work:
  - convert donor-core extensionless imports to explicit `.js` ESM specifiers
  - add donor-core compatibility methods required by the current audit stack:
    - `getCloudTransitionLedgerRaw`
    - `resetCloudTransitionLedger`
    - `getModuleTimingSummary`
    - `getConservationSummary`
    - `loadStateSnapshot`
    - `setReplayDisabledModules`
    - `clearReplayDisabledModules`
- preserve the C1 donor-base-first splice contract
- rerun C2 immediately after bridge implementation
- Next active phase: `Architecture C4: donor-core integration bridge implementation`

## Architecture C4 decision

- Verdict: `bridge_implemented_ready_for_rerun`
- Decision report: [earth-weather-architecture-c4-donor-core-integration-bridge.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c4-donor-core-integration-bridge.md)
- Bridge implementation:
  - donor runtime rewritten to explicit `.js` relative imports where required
  - donor-core compatibility methods added for the current audit stack
  - donor-base-first splice contract preserved
- Bridge summary:
  - rewritten relative import count: `29`
  - missing donor-core compatibility methods after bridge: `none`
- Next active phase: `Architecture C5: bridged donor-base hybrid rerun benchmark`

## Architecture C5 decision

- Verdict: `hybrid_boot_failure`
- Decision report: [earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.md)
- Benchmark outcome:
  - the bridged hybrid cleared the original donor-core ESM and missing-method bootstrap blockers
  - the bridged hybrid still did not produce the expected quick benchmark summary artifact
  - failure message:
    - `Audit completed without expected summary artifact ... Matching files: none`
- Interpretation:
  - Architecture C is no longer blocked by the original donor-core import/API seam
  - the next boundary is now why the bridged hybrid exits without yielding a benchmark artifact
- Next active phase: `Architecture C6: bridged hybrid attribution design`

## Architecture C6 decision

- Verdict: `silent_no_artifact_exit`
- Decision report: [earth-weather-architecture-c6-bridged-hybrid-attribution-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c6-bridged-hybrid-attribution-design.md)
- Attribution result:
  - exit code: `0`
  - expected summary artifact: missing
  - fallback default report artifact: missing
  - cycle violation artifact: missing
  - stdout summary JSON: absent
  - new worktree artifacts: none
  - only emitted process output was a `MODULE_TYPELESS_PACKAGE_JSON` warning
- Interpretation:
  - the bridged donor/current hybrid was no longer failing on the original ESM/core-API seam
  - the next question was artifact-contract execution, not climate behavior yet
- Next active phase: `Architecture C7: bridged hybrid artifact contract repair`

## Architecture C7 decision

- Verdict: `cycle_guard_contract_block`
- Decision report: [earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.md)
- Repair result:
  - explicit `main()` invocation removed the earlier silent-exit ambiguity
  - the bridged donor worktree is now blocked by [plan-guard.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/plan-guard.mjs)
  - failure message:
    - `[agent plan guard] agent:planetary-realism-audit requires an active cycle directory with plan.md before it can run.`
- Interpretation:
  - Architecture C is no longer blocked by donor-core import/API compatibility
  - the next blocker is the heavy-command cycle contract in donor worktrees
- Next active phase: `Architecture C8: donor-worktree cycle contract repair`

## Architecture C8 decision

- Verdict: `post_cycle_runtime_failure`
- Decision report: [earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.md)
- Repair result:
  - the donor-worktree cycle contract was created successfully
  - the bridged audit moved past plan-guard and into runtime execution
  - the first post-cycle runtime blocker was:
    - `ENOENT` for `scripts/agent/fixtures/headless-terrain-180x90.json`
- Interpretation:
  - the cycle contract is no longer the active blocker
  - the next missing boundary is the donor-worktree terrain fixture bundle
- Next active phase: `Architecture C9: donor-worktree runtime fixture repair`

## Architecture C9 decision

- Verdict: `runtime_fixture_contract_restored`
- Decision report: [earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.md)
- Repair result:
  - the terrain fixture bundle was restored into the donor worktree
  - the bridged quick audit exited `0`
  - the requested quick artifact was emitted:
    - [earth-weather-architecture-c9-bridged-hybrid-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c9-bridged-hybrid-quick.json)
- Interpretation:
  - donor hybrid runtime contracts are now restored far enough to resume actual benchmark work
  - the next bounded move is now climate benchmarking, not more integration surgery
- Next active phase: `Architecture C10: cycled hybrid benchmark rerun`

## Architecture C10 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - strong improvements:
    - `itczWidthDeg: 25.91 -> 24.221`
    - `subtropicalDryNorthRatio: 1.534 -> 1.317`
    - `subtropicalDrySouthRatio: 1.199 -> 0.593`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.061`
  - blocking regression:
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -371.9765`
- Interpretation:
  - the repaired donor/current hybrid is now a real benchmarked climate candidate
  - the next blocker is not integration anymore; it is a single severe circulation transport failure
- Next active phase: `Architecture C11: cycled hybrid flux inversion attribution`

## Architecture C11 decision

- Verdict: `equatorial_overturning_polarity_inversion`
- Decision report: [earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.md)
- Attribution result:
  - equatorial total-water flux north: `148.97786 -> -381.81173`
  - equatorial zonal-mean vapor flux north: `160.44983 -> -274.70821`
  - equatorial eddy vapor flux north: `-12.37515 -> -105.45284`
  - equatorial low-level velocity mean: `11.78514 -> -20.46744`
  - ITCZ latitude still moves north and NH westerlies still improve
- Interpretation:
  - the repaired hybrid’s remaining blocker is an equatorial overturning polarity flip, not generic climate weakness
  - the next bounded move should target equatorial overturning sign while preserving the dry-belt and NH-westerly gains
- Next active phase: `Architecture C12: equatorial overturning sign contract design`

## Architecture C12 decision

- Verdict: `current_low_level_momentum_preserve_layer_required`
- Decision report: [earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.md)
- Contract result:
  - preserve layer:
    - [windNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windNudge5.js)
    - [windEddyNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windEddyNudge5.js)
    - [nudging5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/nudging5.js)
  - donor-core param ports:
    - `windNudgeParams.tauSurfaceSeconds: 7 * 86400 -> 8 * 3600`
    - `nudgeParams.tauQvS: 30 * 86400 -> 45 * 86400`
    - `nudgeParams.tauQvColumn: 12 * 86400 -> 18 * 86400`
    - `nudgeParams organized/subsidence relief quartet from current core`
- Interpretation:
  - C11 narrowed the defect to a low-level sign-control mismatch rather than a broad scaffold failure
  - the next bounded move is the actual sign-contract experiment on the donor scaffold
- Next active phase: `Architecture C13: equatorial overturning sign contract experiment`

## Architecture C13 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - retained hybrid wins:
    - `itczWidthDeg: 25.91 -> 23.884`
    - `subtropicalDryNorthRatio: 1.534 -> 1.152`
    - `subtropicalDrySouthRatio: 1.199 -> 0.585`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
  - blocking regression:
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -330.9854`
- Interpretation:
  - the donor/current hybrid is still strong almost everywhere we care about
  - the remaining blocker is now specific to sign-contract implementation rather than generic hybrid viability
- Next active phase: `Architecture C14: sign-contract implementation attribution`

## Architecture C14 decision

- Verdict: `zonal_mean_equatorial_reversal_still_vertical_scaffold_controlled`
- Decision report: [earth-weather-architecture-c14-sign-contract-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c14-sign-contract-implementation-attribution.md)
- Attribution result:
  - total cross-equatorial vapor flux north: `-371.9765 -> -330.9854`
  - equatorial low-level velocity mean: `-20.46744 -> -19.4512`
  - equatorial zonal-mean vapor flux north: `-274.70821 -> -301.63909`
  - equatorial eddy vapor flux north: `-105.45284 -> -34.29106`
- Interpretation:
  - C13 improved the eddy-side failure but not the zonal-mean overturning branch
  - the remaining blocker is now best explained by donor-controlled vertical-scaffold behavior, not the preserved low-level nudging layer
- Next active phase: `Architecture C15: equatorial vertical-state contract experiment`

## Architecture C15 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 24.094`
    - `subtropicalDryNorthRatio: 1.534 -> 1.404`
    - `subtropicalDrySouthRatio: 1.199 -> 0.589`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.209`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.15331`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -364.55266`
- Interpretation:
  - the current vertical-state overlay did not restore northward equatorial overturning
  - it also weakened some of the stronger C13 improvements, so the vertical lane now needs narrower implementation attribution rather than a broader overlay
- Next active phase: `Architecture C16: vertical-contract implementation attribution`

## Architecture C16 decision

- Verdict: `zonal_mean_relief_offset_by_upper_cloud_carryover_recirculation`
- Decision report: [earth-weather-architecture-c16-vertical-contract-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c16-vertical-contract-implementation-attribution.md)
- Attribution result:
  - equator zonal-mean vapor flux north: `-301.63909 -> -274.13377`
  - equator eddy vapor flux north: `-34.29106 -> -96.97265`
  - equator mid/upper vapor flux north: `-203.65605 -> -239.13535`
  - 35° interface vapor flux north: `-467.08734 -> -360.61691`
  - NH dry-belt carried-over upper cloud: `0 -> 0.39867`
  - NH dry-belt imported anvil persistence: `0 -> 0.39786`
  - NH dry-belt weak-erosion survival: `0 -> 0.38477`
  - NH dry-belt cloud recirculation proxy: `0 -> 2.22467`
- Interpretation:
  - C15 helped the zonal-mean equatorial branch and relieved north dry-belt import burden
  - but it reintroduced a strong upper-cloud carryover / persistence pathway that worsened the eddy-side and mid-upper transport enough to make the total cross-equatorial flux more negative
- Next active phase: `Architecture C17: zonal-mean-preserving upper-cloud carryover carveout experiment`

## Architecture C17 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.454`
    - `subtropicalDryNorthRatio: 1.534 -> 1.121`
    - `subtropicalDrySouthRatio: 1.199 -> 0.511`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.202`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14144`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.31687`
- Interpretation:
  - the carryover carveout is live and materially better than C15 on the surface quick metrics
  - but the transport-sign blocker still survives, so the carveout needs attribution rather than annual promotion
- Next active phase: `Architecture C18: carryover carveout implementation attribution`

## Architecture C18 decision

- Verdict: `carryover_carveout_relief_preserves_zonal_mean_but_eddy_export_remains_primary_blocker`
- Decision report: [earth-weather-architecture-c18-carryover-carveout-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c18-carryover-carveout-implementation-attribution.md)
- Attribution result:
  - NH dry-belt carried-over upper cloud: `0.39867 -> 0.22666`
  - NH dry-belt imported anvil persistence: `0.39786 -> 0.22501`
  - NH dry-belt weak-erosion survival: `0.38477 -> 0.21732`
  - NH dry-belt cloud recirculation proxy: `2.22467 -> 0.39988`
  - equator zonal-mean vapor flux north: `-274.13377 -> -249.95949`
  - equator mid/upper vapor flux north: `-239.13535 -> -226.72426`
  - equator eddy vapor flux north: `-96.97265 -> -109.90385`
  - 35° interface vapor flux north: `-360.61691 -> -373.49016`
- Interpretation:
  - C17 really did relieve the upper-cloud carryover lane and preserve the zonal-mean relief
  - the remaining dominant blocker is now the equatorial eddy export / low-level velocity branch, not upper-cloud carryover
- Next active phase: `Architecture C19: zonal-mean-preserving eddy export attribution`

## Architecture C19 decision

- Verdict: `shared_preserve_layer_not_primary_blocker_vertical_overlay_eddy_export_coupling`
- Decision report: [earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.md)
- Attribution result:
  - shared low-level preserve layer between C13 and C17:
    - `nudgeParams.tauQvS`
    - `nudgeParams.tauQvColumn`
    - `nudgeParams organized/subsidence relief quartet`
    - `windNudgeParams.tauSurfaceSeconds`
  - equator zonal-mean vapor flux north: `-301.63909 -> -249.95949`
  - equator eddy vapor flux north: `-34.29106 -> -109.90385`
  - equator low-level velocity mean: `-19.4512 -> -20.79729`
  - 35° interface vapor flux north: `-467.08734 -> -373.49016`
- Interpretation:
  - the preserve layer itself is not the main blocker
  - the remaining defect sits in the vertical-overlay / eddy-export coupling on top of that shared preserve layer
- Next active phase: `Architecture C20: zonal-mean-preserving eddy nudge softening experiment`

## Architecture C20 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c20-zonal-mean-preserving-eddy-nudge-softening-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c20-zonal-mean-preserving-eddy-nudge-softening-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.26`
    - `subtropicalDryNorthRatio: 1.534 -> 1.152`
    - `subtropicalDrySouthRatio: 1.199 -> 0.504`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.209`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.13877`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -361.48916`
- Interpretation:
  - softening only the surface eddy-energy rescaling lane preserved the hybrid’s broad climate wins
  - but it did not solve the equatorial sign defect and slightly worsened the core equatorial transport branches
- Next active phase: `Architecture C21: eddy-softening implementation attribution`

## Architecture C21 decision

- Verdict: `global_eddy_softening_reactivates_return_branch_carryover_without_fixing_equatorial_export`
- Decision report: [earth-weather-architecture-c21-eddy-softening-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c21-eddy-softening-implementation-attribution.md)
- Attribution result:
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
  - global eddy softening was not inert
  - it relieved the wrong side of the hybrid and reopened the dry-belt carryover family without fixing the equatorial export defect
- Next active phase: `Architecture C22: equatorial-band eddy softening carveout experiment`

## Architecture C22 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c22-equatorial-band-eddy-softening-carveout-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c22-equatorial-band-eddy-softening-carveout-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.499`
    - `subtropicalDryNorthRatio: 1.534 -> 1.137`
    - `subtropicalDrySouthRatio: 1.199 -> 0.51`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.216`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11658`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.11907`
- Interpretation:
  - narrowing the softening to the equatorial band preserved the broad quick-shape wins and improved NH dry-belt ocean condensation
  - but it still failed the quick gate because the cross-equatorial transport sign stayed inverted
- Next active phase: `Architecture C23: equatorial-band eddy softening attribution`

## Architecture C23 decision

- Verdict: `equatorial_band_softening_preserves_dry_belt_relief_but_deepens_lower_mid_zonal_branch`
- Decision report: [earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.md)
- What changed relative to C17:
  - dry-belt containment stayed relieved:
    - carried-over upper cloud: `0.22666 -> 0.22097`
    - imported anvil persistence: `0.22501 -> 0.21933`
    - weak-erosion survival: `0.21732 -> 0.21143`
    - cloud recirculation proxy: `0.39988 -> 0.39849`
    - return-branch mass flux: `3368.15697 -> 3348.50751`
  - upper transport relieved slightly:
    - equator upper total-water flux north: `-13.44686 -> -13.3117`
  - lower/mid zonal branches worsened:
    - equator lower zonal vapor flux north: `-13.99991 -> -14.07888`
    - equator mid zonal vapor flux north: `-12.93476 -> -13.11577`
- Interpretation:
  - the C22 carveout preserved the dry-belt relief we wanted
  - but the remaining export defect is now concentrated in the inner equatorial core, especially the lower/mid zonal branch
- Next active phase: `Architecture C24: inner-core equatorial eddy softening experiment`

## Architecture C24 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.275`
    - `subtropicalDryNorthRatio: 1.534 -> 1.091`
    - `subtropicalDrySouthRatio: 1.199 -> 0.506`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.214`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12705`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -358.07208`
- Interpretation:
  - the inner-core narrowing improved ITCZ width and both dry-belt ratios relative to C22 and eased parts of the lower/mid equatorial branch
  - but it gave back some upper-branch relief, reintroduced carryover/return-branch rebound, and the transport-sign defect remained severe
- Next active phase: `Architecture C25: inner-core equatorial eddy softening attribution`

## Architecture C25 decision

- Verdict: `inner_core_narrowing_relieves_lower_mid_core_but_reopens_upper_carryover_shoulder`
- Decision report: [earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.md)
- What changed relative to C22:
  - broad quick-shape metrics improved:
    - `itczWidthDeg: 23.499 -> 23.275`
    - `subtropicalDryNorthRatio: 1.137 -> 1.091`
    - `subtropicalDrySouthRatio: 0.51 -> 0.506`
  - boundary/lower/mid equatorial burden eased:
    - equator boundary-layer total-water flux north: `-5.01709 -> -4.84216`
    - equator lower total-water flux north: `-17.83744 -> -17.49403`
    - equator mid total-water flux north: `-16.77592 -> -16.75772`
  - but upper-branch and carryover support rebounded:
    - equator upper total-water flux north: `-13.3117 -> -13.59209`
    - carried-over upper cloud: `0.22097 -> 0.23253`
    - cloud recirculation proxy: `0.39849 -> 0.49385`
    - return-branch mass flux: `3348.50751 -> 3447.36194`
- Interpretation:
  - the inner-core narrowing helped the lower-mid core
  - but it removed too much useful shoulder support from the upper branch and dry-belt containment side
- Next active phase: `Architecture C26: partial equatorial shoulder restore experiment`

## Architecture C26 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.412`
    - `subtropicalDryNorthRatio: 1.534 -> 1.119`
    - `subtropicalDrySouthRatio: 1.199 -> 0.515`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.225`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11952`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.85346`
- Interpretation:
  - restoring a modest shoulder improved NH dry-belt ocean condensation and slightly reduced the cross-equatorial defect relative to C24
  - but it still failed the quick gate because the transport-sign inversion remained severe and some C24 dry-belt/ITCZ gains were given back
- Next active phase: `Architecture C27: partial equatorial shoulder restore attribution`

## Architecture C27 decision

- Verdict: `partial_shoulder_restore_recovers_upper_branch_and_return_flow_but_reloads_lower_import_and_cloud_recirculation`
- Decision report: [earth-weather-architecture-c27-partial-equatorial-shoulder-restore-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c27-partial-equatorial-shoulder-restore-attribution.md)
- What changed relative to C24:
  - recovered:
    - cross-equatorial vapor flux north: `-358.07208 -> -353.85346`
    - equator upper total-water flux north: `-13.59209 -> -13.23333`
    - return-branch mass flux: `3447.36194 -> 3383.23239`
    - NH dry-belt ocean condensation: `0.12705 -> 0.11952`
  - reloaded:
    - equator lower total-water flux north: `-17.49403 -> -18.00423`
    - 35° lower vapor import: `-22.69662 -> -22.99819`
    - 35° mid vapor import: `-17.16362 -> -17.27508`
    - cloud recirculation proxy: `0.49385 -> 0.60796`
- Interpretation:
  - C26 moved in the right direction on the upper/return-flow side
  - but it over-restored the shoulder and reloaded the lower/import side, so the next move should weaken that restore instead of discarding it
- Next active phase: `Architecture C28: weak partial shoulder restore experiment`

## Architecture C28 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c28-weak-partial-shoulder-restore-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c28-weak-partial-shoulder-restore-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.321`
    - `subtropicalDryNorthRatio: 1.534 -> 1.097`
    - `subtropicalDrySouthRatio: 1.199 -> 0.487`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.202`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.15539`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -323.23581`
- Interpretation:
  - weakening the shoulder restore materially improved the sign defect and relieved the equatorial eddy branch relative to C26
  - but it gave back the NH dry-belt ocean-condensation improvement and still failed the quick gate, so the remaining blocker is now a sharper transport-vs-condensation tradeoff
- Next active phase: `Architecture C29: weak partial shoulder restore attribution`

## Architecture C29 decision

- Verdict: `weak_restore_relieves_equatorial_eddy_export_but_reopens_dry_belt_carryover_condensation`
- Decision report: [earth-weather-architecture-c29-weak-partial-shoulder-restore-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c29-weak-partial-shoulder-restore-attribution.md)
- What changed relative to C26:
  - relieved:
    - cross-equatorial vapor flux north: `-353.85346 -> -323.23581`
    - equator lower total-water flux north: `-18.00423 -> -16.93964`
    - equator mid total-water flux north: `-16.6919 -> -14.80431`
    - equator upper total-water flux north: `-13.23333 -> -11.22308`
  - reopened:
    - NH dry-belt ocean condensation: `0.11952 -> 0.15539`
    - carryover upper cloud: `0.2348 -> 0.24485`
    - imported anvil persistence: `0.23307 -> 0.24284`
    - cloud recirculation proxy: `0.60796 -> 0.74157`
- Interpretation:
  - weakening the shoulder restore really did relieve the equatorial eddy/export side
  - but it paid for that by reopening dry-belt carryover and ocean condensation, so the next move had to target carry-input recapture rather than the shoulder geometry itself
- Next active phase: `Architecture C30: weak restore carry-input recapture experiment`

## Architecture C30 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c30-weak-restore-carry-input-recapture-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.315`
    - `subtropicalDryNorthRatio: 1.534 -> 1.093`
    - `subtropicalDrySouthRatio: 1.199 -> 0.502`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12693`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.96486`
- Interpretation:
  - strengthening the carry-input recapture recovered the NH dry-belt receiver side relative to C28 while preserving most of the broad quick-shape wins
  - but it did not repair the transport-sign inversion and actually made the cross-equatorial defect slightly worse than C28, so the next step is attribution rather than more blind recapture tuning
- Next active phase: `Architecture C31: weak-restore carry-input recapture attribution`

## Architecture C31 decision

- Verdict: `carry_input_recapture_recovers_dry_belt_and_zonal_mean_but_reloads_equatorial_eddy_export_recirculation`
- Decision report: [earth-weather-architecture-c31-weak-restore-carry-input-recapture-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c31-weak-restore-carry-input-recapture-attribution.md)
- What changed relative to C28:
  - recovered:
    - NH dry-belt ocean condensation: `0.15539 -> 0.12693`
    - carried-over upper cloud: `0.24485 -> 0.2187`
    - imported anvil persistence: `0.24284 -> 0.21701`
    - equator lower zonal-mean transport: `-14.49379 -> -14.10166`
    - equator mid zonal-mean transport: `-14.12323 -> -12.98794`
    - equator upper zonal-mean transport: `-8.8185 -> -7.84381`
  - worsened:
    - cross-equatorial vapor flux north: `-323.23581 -> -353.96486`
    - equator lower eddy transport: `-2.44586 -> -3.88858`
    - equator mid eddy transport: `-0.68108 -> -3.6845`
    - equator upper eddy transport: `-2.40458 -> -5.10272`
    - cloud recirculation proxy: `0.74157 -> 1.18525`
    - return-branch mass flux: `3444.87796 -> 3500.90278`
- Interpretation:
  - the stronger recapture fixed the receiver side and improved the zonal-mean branch
  - but it overpaid through the equatorial eddy/export side, so the next move had to protect organized equatorial cells rather than undoing the whole recapture layer
- Next active phase: `Architecture C32: organized-support carry-input carveout experiment`

## Architecture C32 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c32-organized-support-carry-input-carveout-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c32-organized-support-carry-input-carveout-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.374`
    - `subtropicalDryNorthRatio: 1.534 -> 1.122`
    - `subtropicalDrySouthRatio: 1.199 -> 0.493`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - restoring stricter organized-support and potential caps preserved the broad quick-shape gains and improved NH dry-belt ocean condensation even further
  - but it still failed on the same cross-equatorial sign defect, and the defect was marginally worse than C30, so the next step is another attribution pass rather than more cap tuning
- Next active phase: `Architecture C33: organized-support carry-input carveout attribution`

## Architecture C33 decision

- Verdict: `organized_support_carveout_restores_receiver_containment_and_upper_branch_but_deepens_lower_mid_core_import`
- Decision report: [earth-weather-architecture-c33-organized-support-carry-input-carveout-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c33-organized-support-carry-input-carveout-attribution.md)
- What changed relative to C30:
  - improved:
    - NH dry-belt ocean condensation: `0.12693 -> 0.10807`
    - carryover upper cloud: `0.2187 -> 0.17351`
    - imported anvil persistence: `0.21701 -> 0.17183`
    - cloud recirculation proxy: `1.18525 -> 0.44108`
    - equator upper total-water flux north: `-12.94654 -> -12.82647`
  - worsened:
    - cross-equatorial vapor flux north: `-353.96486 -> -356.96839`
    - equator lower total-water flux north: `-17.99024 -> -18.3439`
    - equator mid total-water flux north: `-16.67245 -> -16.74764`
    - 35° lower vapor import: `-22.46949 -> -23.19317`
    - 35° mid vapor import: `-16.40141 -> -17.28133`
- Interpretation:
  - the organized-support carveout direction was genuinely useful for receiver containment and the upper branch
  - but it over-tightened the lower-mid core, so the next move should keep the strict organized-support cap and only partially relax the potential cap
- Next active phase: `Architecture C34: potential-half-relax carry-input experiment`

## Architecture C34 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c34-potential-half-relax-carry-input-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c34-potential-half-relax-carry-input-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.374`
    - `subtropicalDryNorthRatio: 1.534 -> 1.122`
    - `subtropicalDrySouthRatio: 1.199 -> 0.493`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - the potential half-relax was effectively inert at the quick-score level relative to C32
  - that means the strict organized-support cap or some other upstream admission condition is likely still the active binder, so the next step is attribution rather than more potential-cap nudging
- Next active phase: `Architecture C35: potential-half-relax carry-input attribution`

## Architecture C35 decision

- Verdict: `potential_half_relax_inert_potential_cap_not_primary_binder`
- Decision report: [earth-weather-architecture-c35-potential-half-relax-carry-input-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c35-potential-half-relax-carry-input-attribution.md)
- Attribution result:
  - C34 is unchanged from C32 to reporting precision across:
    - quick score
    - equatorial transport
    - dry-belt receiver containment
    - thermodynamic regime classification
  - the strict potential cap is therefore not the live binder in this family
- Interpretation:
  - the remaining lower-mid equatorial core defect is being set by the strict organized-support admission side, not the potential cap
- Next active phase: `Architecture C36: organized-support half-relax carry-input experiment`

## Architecture C36 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c36-organized-support-half-relax-carry-input-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c36-organized-support-half-relax-carry-input-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.315`
    - `subtropicalDryNorthRatio: 1.534 -> 1.093`
    - `subtropicalDrySouthRatio: 1.199 -> 0.502`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12693`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.96486`
- Interpretation:
  - half-relaxing organized support is active, unlike C34
  - but it mostly collapses back toward the earlier C30 tradeoff:
    - some receiver-side relief is given back
    - the cross-equatorial sign defect remains severe
- Next active phase: `Architecture C37: organized-support half-relax carry-input attribution`

## Architecture C37 decision

- Verdict: `organized_support_half_relax_inert_threshold_cliff_reverts_to_c30`
- Decision report: [earth-weather-architecture-c37-organized-support-half-relax-carry-input-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c37-organized-support-half-relax-carry-input-attribution.md)
- Attribution result:
  - C36 reproduces the full C30 climate, transport, receiver, and thermodynamic signature to reporting precision
  - the organized-support half-relax is therefore a threshold cliff, not a usable intermediate scalar control
- Interpretation:
  - once the organized-support cap is loosened enough to re-admit the blocked subset, the hybrid snaps back to the whole C30 regime
  - the next bounded move has to change the geometry of the restore, not just the scalar threshold
- Next active phase: `Architecture C38: inner-core organized-support restore experiment`

## Architecture C38 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-c38-inner-core-organized-support-restore-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c38-inner-core-organized-support-restore-experiment.md)
- Quick result:
  - improved metrics: `4 / 6`
  - severe regressions:
    - `crossEquatorialVaporFluxNorthKgM_1S`
  - bounded outcome:
    - `itczWidthDeg: 25.91 -> 23.374`
    - `subtropicalDryNorthRatio: 1.534 -> 1.122`
    - `subtropicalDrySouthRatio: 1.199 -> 0.493`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
- Interpretation:
  - the inner-core restore was also inert at the quick-score level relative to the strict C32 carveout
  - so the blocked subset is not being reached by the simple inner-core geometry
- Next active phase: `Architecture C39: inner-core organized-support restore attribution`
- C39 result:
  - verdict: `inner_core_restore_inert_active_override_targets_outside_restore_band`
  - the live carry-input override rows stayed fixed at `18.75°`, `26.25°`, `33.75°` and mirrored southern rows, outside the C38 inner-core taper
- C40 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.386`
  - `subtropicalDryNorthRatio: 1.534 -> 1.128`
  - `subtropicalDrySouthRatio: 1.199 -> 0.49`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.225`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11898`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.94778`
  - interpretation: active transition-band geometry slightly relieved the sign defect versus C32 but reopened part of the strict receiver-containment win
- C41 result:
  - verdict: `transition_band_restore_shifts_override_equatorward_and_slightly_relieves_sign_defect_but_reloads_26p25_receiver_lane`
  - the active geometry shifted override load from `33.75°` toward `26.25°`
  - that gave a small sign-defect improvement while reopening the `26.25°` receiver lane
- C42 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.374`
  - `subtropicalDryNorthRatio: 1.534 -> 1.122`
  - `subtropicalDrySouthRatio: 1.199 -> 0.493`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
  - interpretation: backing away from `26.25°` restored the strict C32 containment win but also erased the only live sign-relief signal from C40
- C43 result:
  - verdict: `equatorward_narrowing_removes_26p25_restore_signal_and_exactly_reverts_to_c32`
  - once the `26.25°` lane is removed, the experiment fully reverts to C32
- C44 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.374`
  - `subtropicalDryNorthRatio: 1.534 -> 1.122`
  - `subtropicalDrySouthRatio: 1.199 -> 0.493`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.219`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.10807`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -356.96839`
  - interpretation: the isolated `26.25°` lane is necessary but not sufficient; by itself it also snaps back to C32
- C45 result:
  - verdict: `isolated_26p25_restore_insufficient_c40_signal_requires_poleward_shoulder_coupling`
  - C44 matches the strict C32 quick climate exactly
  - the live C40 signal depends on coupling between the `26.25°` lane and the poleward shoulder
- C46 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.315`
  - `subtropicalDryNorthRatio: 1.534 -> 1.093`
  - `subtropicalDrySouthRatio: 1.199 -> 0.502`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12693`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.96486`
  - interpretation: the coupled `26.25°–33.75°` shoulder is active, but it reproduces the older C30 weak-restore recapture regime rather than the smaller C40 sign-relief signal
- C47 result:
  - verdict: `coupled_shoulder_reopens_c30_recapture_regime_full_33p75_restore_too_strong`
  - C46 matches the earlier C30 weak-restore carry-input recapture regime across quick metrics, moisture attribution, transport interfaces, and shoulder-row diagnostics
  - interpretation: the full `33.75°` poleward shoulder restore is too strong
- C48 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.386`
  - `subtropicalDryNorthRatio: 1.534 -> 1.128`
  - `subtropicalDrySouthRatio: 1.199 -> 0.49`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.225`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11898`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.94778`
  - interpretation: tapering the `33.75°` shoulder reproduces the earlier C40 transition-band regime exactly rather than creating a new intermediate state
- C49 result:
  - verdict: `tapered_poleward_shoulder_exactly_reproduces_c40_transition_regime`
  - C48 matches the earlier C40 transition-band restore regime across quick metrics, moisture attribution, transport interfaces, and shoulder-row diagnostics
  - interpretation: the remaining live question is the modest `26.25°` receiver reload inside that regime, not the poleward-shoulder taper itself
- C50 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.386`
  - `subtropicalDryNorthRatio: 1.534 -> 1.128`
  - `subtropicalDrySouthRatio: 1.199 -> 0.49`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.225`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11898`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.94778`
  - interpretation: the modest `26.25°` receiver guard is inert; C50 reproduces the earlier C40/C48 transition-band regime exactly
- C51 result:
  - verdict: `partial_26p25_receiver_guard_inert_threshold_below_live_binder`
  - C40 vs C50 are identical across the quick score, moisture attribution, transport interfaces, and the `18.75°`, `26.25°`, and `33.75°` shoulder rows
  - interpretation: the first `26.25°` receiver guard sits below the live binder and does not create a real intermediate regime
- C52 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.386`
  - `subtropicalDryNorthRatio: 1.534 -> 1.128`
  - `subtropicalDrySouthRatio: 1.199 -> 0.49`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.225`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11898`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.94778`
  - interpretation: even a strong `26.25°` receiver guard reproduces the same C40/C50 transition-band regime exactly, so the remaining binder is not simple scalar guard amplitude
- C53 result:
  - verdict: `strong_26p25_receiver_guard_inert_receiver_reload_maintained_by_downstream_carryover`
  - C40 and C52 are identical across the quick score, moisture attribution, and transport interfaces while the `26.25°` receiver row stays elevated relative to strict C32
  - interpretation: the strong organized-support guard is inert, and the remaining receiver reload is maintained downstream by carryover / persistence rather than fresh organized-support admission
- C54 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.333`
  - `subtropicalDryNorthRatio: 1.534 -> 1.124`
  - `subtropicalDrySouthRatio: 1.199 -> 0.496`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.201`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12942`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -362.46654`
  - interpretation: the 26.25° carryover-containment lane is active but still worsens the core sign defect and gives back part of the receiver-side relief
- C55 result:
  - verdict: `receiver_carryover_containment_relieves_26p25_but_forces_18p75_transition_export_and_33p75_reload`
  - `26.25°` vapor flux north becomes less negative: `-579.114 -> -565.124`
  - `18.75°` vapor flux north becomes more southward: `-229.214 -> -237.978`
  - `33.75°` carried-over upper cloud rises: `0.424 -> 0.437`
  - interpretation: the C54 receiver relief is real, but it is paid for by a worse `18.75°` transition-export lane and a reloaded `33.75°` shoulder
- C56 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.333`
  - `subtropicalDryNorthRatio: 1.534 -> 1.124`
  - `subtropicalDrySouthRatio: 1.199 -> 0.496`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.201`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12942`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -362.46654`
  - interpretation: the narrow `18.75°` transition-support preserve is effectively inert at the climate-result level and reproduces the same C54 state to reporting precision
- C57 result:
  - verdict: `transition_support_preserve_inert_organized_support_only_not_live_binder`
  - C54 and C56 match exactly across the quick score, NH ocean moisture attribution, equatorial transport interfaces, and the `18.75°` / `26.25°` / `33.75°` shoulder rows
  - interpretation: the narrow `18.75°` organized-support-only preserve never touched the live binder, so the next move had to target the broader local transition carry-input contract
- C58 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.634`
  - `subtropicalDryNorthRatio: 1.534 -> 1.231`
  - `subtropicalDrySouthRatio: 1.199 -> 0.497`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.194`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.13447`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -351.9993`
  - interpretation: the broader `18.75°` transition carry-input preserve is active and slightly relieves the sign defect relative to C54, but it gives back part of the receiver-side win and still fails the quick gate
- C59 result:
  - verdict: `transition_carry_input_preserve_relieves_equatorial_export_but_reloads_18p75_26p25_and_worsens_35deg_import`
  - equator lower/mid/upper transport all improve versus C54, but `18.75°` and `26.25°` both reload carryover and become more southward while `35°` import worsens
  - interpretation: C58 buys modest export relief by shifting burden into the transition/receiver rows and the `35°` import interface
- C60 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.287`
  - `subtropicalDryNorthRatio: 1.534 -> 1.07`
  - `subtropicalDrySouthRatio: 1.199 -> 0.48`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.194`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.15491`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -318.81218`
  - interpretation: stronger `26.25°` receiver carryover containment materially improves the sign defect and broad quick-shape metrics relative to C58, but it worsens NH dry-belt ocean condensation sharply
- C61 result:
  - verdict: `stronger_receiver_containment_relieves_equatorial_export_and_recaptures_26p25_carryover_but_reloads_33p75_poleward_shoulder_and_nh_ocean_maintenance`
  - equator lower/mid/upper transport all improve versus C58
  - `18.75°` transition row improves and `26.25°` carryover is recaptured
  - but `33.75°` carryover/path reloads and NH ocean maintenance rebounds sharply
  - interpretation: C60 is a real middle state, and its main repayment lane is now localized to the poleward shoulder / NH ocean upper-cloud maintenance family
- C62 result:
  - verdict: `quick_reject`
  - `itczWidthDeg: 25.91 -> 23.386`
  - `subtropicalDryNorthRatio: 1.534 -> 1.057`
  - `subtropicalDrySouthRatio: 1.199 -> 0.487`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.214`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.13629`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -318.32449`
  - relative to C60, NH ocean condensation improves `0.15491 -> 0.13629` and cross-equatorial flux improves slightly `-318.81218 -> -318.32449`
  - interpretation: the narrow `33.75°` poleward-shoulder carveout is active and meaningfully recaptures the NH ocean rebound, but the cross-equatorial sign defect is still severe so the full quick gate remains red
- Next active phase: `Architecture C63: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment attribution`

## Day-365 benchmark summary

- ITCZ width: current 24.875, rollback 25.613, winner current
- NH dry-belt ratio: current 1.343, rollback 1.561, winner current
- SH dry-belt ratio: current 1.145, rollback 1.014, winner candidate
- NH midlatitude westerlies: current 0.524, rollback 1.139, winner candidate
- NH dry-belt ocean condensation: current 0.277, rollback 0, winner n/a
- Cross-equatorial vapor flux north: current 326.338, rollback 176.877, winner candidate
