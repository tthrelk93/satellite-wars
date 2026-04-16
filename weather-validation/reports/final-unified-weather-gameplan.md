# Final Unified Weather Gameplan

## Current Status

The narrow alphabetized patch spiral is over.

The active top-level bug is still the same:
- NH dry-belt moisture-partitioning bias
- too much oceanic large-scale condensation and cloud maintenance in the NH subtropical dry belt / adjacent transition
- resulting climate failures:
  - widened ITCZ
  - weak NH midlatitude westerlies
  - excessive NH dry-belt ocean condensation
  - unstable cross-equatorial vapor transport on long runs

The reset reports that define the current state are:
- [phase1-reset-triage.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1-reset-triage.md)
- [phase1-reset-system-experiments.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1-reset-system-experiments.md)

## What The Annual Data Proved

The 365-day baseline audit at [phase1-reset-triage-annual.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-reset-triage-annual.json) confirms that the headless climate runs are diagnosing a real climate-core failure, not just a local short-run artifact.

Day-365 live branch state:
- `itczWidthDeg = 24.875`
- `subtropicalDryNorthRatio = 1.343`
- `subtropicalDrySouthRatio = 1.145`
- `midlatitudeWesterliesNorthU10Ms = 0.524`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.2774`
- `crossEquatorialVaporFluxNorthKgM_1S = 326.33822`

Compared with the trusted older Phase 1 baseline:
- ITCZ is still too wide
- NH westerlies are still far too weak
- NH dry-belt ocean condensation is still too high

So the bug is real, long-lived, and still unresolved.

## Reset R2 Results

The bounded system-level experiments are summarized in [phase1-reset-system-experiments.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1-reset-system-experiments.json).

### R2A Upper-cloud persistence collapse

- 30-day result: flat
- annual result: skipped after quick ranking
- conclusion: not a meaningful live lever on the current branch

### R2B Annual numerical hardening

- 30-day result: strongest short-screen improvement
- annual result: fails badly on the full climate objective
- day-365 state:
  - `itczWidthDeg = 25.468`
  - `subtropicalDryNorthRatio = 1.793`
  - `subtropicalDrySouthRatio = 1.321`
  - `midlatitudeWesterliesNorthU10Ms = 0.525`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.16856`
  - `crossEquatorialVaporFluxNorthKgM_1S = 23.05125`
- conclusion: improves one part of the NH dry-belt symptom, but wrecks the larger annual circulation balance

### R2C Hydrology balance repartition

- 30-day result: weak positive short-screen signal
- annual result: fails the full objective
- day-365 state:
  - `itczWidthDeg = 26.097`
  - `subtropicalDryNorthRatio = 1.744`
  - `subtropicalDrySouthRatio = 1.291`
  - `midlatitudeWesterliesNorthU10Ms = 0.523`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.25077`
  - `crossEquatorialVaporFluxNorthKgM_1S = 229.23788`
- conclusion: not a keepable climate direction

## Decision

The bounded reset decision is:
- winner by short-screen rank: `R2B Annual numerical hardening`
- overall verdict: `no_clear_winner`

That means:
- no annualized system-level experiment improved both 30-day and 365-day climate objectives strongly enough
- we should stop the incremental patch spiral here
- we should not resume tiny local patch phases until the next top-level decision is made

## Families Ruled Out As Primary Fixes

These are not the winning top-level answer on the live branch:
- upper-cloud persistence collapse alone
- annual numerical hardening alone
- hydrology balance repartition alone
- further alphabetized local residual chasing without annual decision gates

## Active Next Step

The next active step is no longer another micro-phase.

It is:
- `Reset R3: choose rollback or architecture change`

The execution version of that reset is now captured in:
- [earth-weather-execution-roadmap.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-execution-roadmap.md)

That roadmap replaces the old lettered micro-phase ladder with the real top-level phases needed to reach emergent Earth-realistic weather:
- `Phase 0: Base-State Recovery Decision`
- `Phase 1: Climate Base Recovery`
- `Phase 2: Seasonal Earth Realism`
- `Phase 3: Regional Weather-Regime Realism`
- `Phase 4: Tropical Cyclone Environment Realism`
- `Phase 5: Emergent Storm Realism`
- `Phase 6: Multi-Year Stability And Drift`
- `Phase 7: Scientific Review And Ship Readiness`

Phase 0 has now been executed in:
- [earth-weather-phase0-branch-benchmark.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-phase0-branch-benchmark.md)

Result:
- current branch wins on `ITCZ width` and `NH dry-belt ratio`
- rollback archive wins on `SH dry-belt ratio`, `NH westerlies`, and `cross-equatorial vapor flux`
- no clean canonical base was found

Architecture A is now completed in:
- [earth-weather-architecture-a-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a-design.md)

Its verdict is:
- `integrated_partition_circulation_split_required`
- preserve from current:
  - `itczWidthDeg`
  - `subtropicalDryNorthRatio`
- recover from rollback archive:
  - `subtropicalDrySouthRatio`
  - `midlatitudeWesterliesNorthU10Ms`
  - `crossEquatorialVaporFluxNorthKgM_1S`

Architecture A1 is now completed in:
- [earth-weather-architecture-a1-balance-contract.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a1-balance-contract.md)

Its result is a clean bounded reject:
- verdict: `quick_reject`
- the shared contract is live, but the quick screen regressed:
  - `itczWidthDeg: 25.91 -> 26.404`
  - `subtropicalDryNorthRatio: 1.534 -> 1.743`
  - `subtropicalDrySouthRatio: 1.199 -> 1.306`
- only `midlatitudeWesterliesNorthU10Ms` improved, and only trivially: `0.531 -> 0.532`

So the active next move is now:
- `Architecture A2: circulation-preserving partition port`

That means:
- stop local residual patching
- stop trying to promote either branch as-is
- implement one broader integrated architecture lane that preserves the current branch's NH dry-belt gains while recovering the rollback branch's circulation strength

Architecture A has now narrowed the approved implementation path to one remaining bounded family:

1. `Architecture A2`
- if A1 fails, port only the current branch partition gains that remain compatible with rollback-like circulation support
- do not restore the stacked suppressor and receiver patch families wholesale

Architecture A2 is now completed in:
- [earth-weather-architecture-a2-partition-port.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a2-partition-port.md)

Its result is another clean bounded reject:
- verdict: `quick_reject`
- best quick candidate: `ported-floor-soft-containment`
- partial partition preservation:
  - `itczWidthDeg: 25.91 -> 25.826`
  - `subtropicalDryNorthRatio: 1.534 -> 1.507`
- but the circulation-recovery side did not move:
  - `subtropicalDrySouthRatio: 1.199 -> 1.2`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14845`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 144.63218`

So the active next move is now:
- `Architecture B: circulation-first partition rebuild`

That means:
- stop trying to recover rollback-like circulation by selectively relaxing current-branch dampers
- treat Architecture A as exhausted
- redesign the circulation scaffold first, then re-port only the partition behavior that survives under that rebuilt circulation base

Architecture B is now completed in:
- [earth-weather-architecture-b-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b-design.md)

Its verdict is:
- `circulation_scaffold_rebuild_required`
- Architecture A proved that relaxing current dampers can preserve some partition behavior
- but it cannot recover the circulation scaffold

Architecture B1 is now completed in:
- [earth-weather-architecture-b1-circulation-scaffold.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b1-circulation-scaffold.md)

Its result is another clean bounded reject:
- verdict: `quick_reject`
- best quick candidate: `narrow-band-soft-containment`
- partial movement:
  - `subtropicalDryNorthRatio: 1.534 -> 1.504`
- but the circulation recovery still did not happen:
  - `itczWidthDeg: 25.91 -> 26.218`
  - `subtropicalDrySouthRatio: 1.199 -> 1.201`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.16433`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 147.25094`

So the active next move is now:
- `Architecture B2: explicit circulation-state port`

That means:
- broad lightening or narrowing of the subtropical drying scaffold is not enough
- the next bounded family needs to port or reconstruct explicit circulation-state behavior, not just rescale the current scaffold

Architecture B2 is now completed in:
- [earth-weather-architecture-b2-circulation-state-port.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b2-circulation-state-port.md)

Its result is another bounded reject:
- verdict: `quick_reject`
- best quick candidate: `soft-containment-omega-port`
- partial movement:
  - `subtropicalDryNorthRatio: 1.534 -> 1.504`
- but explicit circulation-state ports on the B1 scaffold still failed:
  - `itczWidthDeg: 25.91 -> 26.219`
  - `subtropicalDrySouthRatio: 1.199 -> 1.201`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.16605`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 147.22336`

So the active next move became:
- `Architecture B3: direct rollback circulation splice`

Architecture B3 is now completed in:
- [earth-weather-architecture-b3-rollback-circulation-splice.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b3-rollback-circulation-splice.md)

Its result is the strongest bounded reject in the B family:
- verdict: `quick_reject`
- best quick candidate: `ported-floor-soft-containment-omega`
- it preserved some current NH partition behavior:
  - `itczWidthDeg: 25.91 -> 25.837`
  - `subtropicalDryNorthRatio: 1.534 -> 1.512`
- but it still could not recover the missing circulation half:
  - `subtropicalDrySouthRatio: 1.199 -> 1.202`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14213`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 144.56866`

So the next active move is now:
- `Architecture C: code-level rollback/current hybridization design`

That means:
- Architecture B is exhausted as a parameter-only family
- the remaining path needs broader code-level hybridization between the rollback circulation base and the current partition-preserving branch
- more parameter-only local patching would not be a responsible use of time here

Architecture C is now completed in:
- [earth-weather-architecture-c-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c-design.md)

Its conclusion is now explicit:
- verdict: `module_level_hybrid_required`
- rollback donor bundle:
  - `src/weather/v2/core5.js`
  - `src/weather/v2/vertical5.js`
- current preserve bundle:
  - `src/weather/v2/microphysics5.js`
- current adapter bundle:
  - `src/weather/v2/state5.js`
  - `src/weather/validation/diagnostics.js`
  - `scripts/agent/planetary-realism-audit.mjs`

So the next active move became:
- `Architecture C1: hybrid seam contract`

Architecture C1 is now completed in:
- [earth-weather-architecture-c1-hybrid-seam-contract.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c1-hybrid-seam-contract.md)

Its result gives us the first concrete splice contract:
- verdict: `rollback_vertical_core_current_partition_adapter_contract`
- start from archive donor branch:
  - `codex/world-class-weather-loop-archive-20260407-0745`
- keep rollback donor scaffold:
  - `src/weather/v2/core5.js`
  - `src/weather/v2/vertical5.js`
- forward-port current preserve layer:
  - `src/weather/v2/microphysics5.js`
- forward-port current adapter stack:
  - `src/weather/v2/state5.js`
  - `src/weather/validation/diagnostics.js`
  - `scripts/agent/planetary-realism-audit.mjs`
- do not start from current `core5.js` / `vertical5.js` for the first hybrid benchmark

Architecture C2 is now complete in [earth-weather-architecture-c2-donor-base-hybrid-benchmark.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c2-donor-base-hybrid-benchmark.md), and it gave us a clean bootstrap boundary:
- verdict: `integration_blocked_missing_dependency`
- the donor-base hybrid worktree fails before the first quick climate benchmark because donor [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) still uses extensionless ESM imports under the current Node runtime
- donor-core compatibility gaps also remain for the current audit stack:
  - `getCloudTransitionLedgerRaw`
  - `resetCloudTransitionLedger`
  - `getModuleTimingSummary`
  - `getConservationSummary`
  - `loadStateSnapshot`
  - `setReplayDisabledModules`
  - `clearReplayDisabledModules`

Architecture C3 is now complete in [earth-weather-architecture-c3-hybrid-integration-bridge-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c3-hybrid-integration-bridge-design.md), and it turns that boundary into the next concrete contract:
- verdict: `esm_and_core_api_bridge_required`
- patch rollback donor [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) to explicit `.js` ESM imports
- add donor-core compatibility methods required by the current audit stack
- keep the donor-base-first splice contract from Architecture C1 intact
- rerun Architecture C2 immediately after that bridge lands

Architecture C4 is now complete in [earth-weather-architecture-c4-donor-core-integration-bridge.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c4-donor-core-integration-bridge.md):
- verdict: `bridge_implemented_ready_for_rerun`
- the donor weather bundle was bridged to explicit `.js` imports
- donor-core compatibility methods were added for the current audit stack
- missing donor-core compatibility methods after the bridge: `none`

Architecture C5 is now complete in [earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c5-bridged-hybrid-rerun-benchmark.md), and the honest result is mixed:
- verdict: `hybrid_boot_failure`
- the bridged donor/current hybrid is no longer blocked by the original donor-core ESM/core-API seam
- but it still exits without producing the expected quick benchmark summary artifact
- failure message:
  - `Audit completed without expected summary artifact ... Matching files: none`

Architecture C6 is now complete in [earth-weather-architecture-c6-bridged-hybrid-attribution-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c6-bridged-hybrid-attribution-design.md):
- verdict: `silent_no_artifact_exit`
- exit code was still `0`
- no expected summary artifact, no fallback artifact, no cycle-violation artifact, and no stdout summary JSON were produced
- the only emitted process output was a `MODULE_TYPELESS_PACKAGE_JSON` warning

Architecture C7 is now complete in [earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c7-bridged-hybrid-artifact-contract-repair.md), and it gave us the real blocker:
- verdict: `cycle_guard_contract_block`
- forcing the bridged audit through explicit `main()` invocation removed the silent-exit ambiguity
- the bridged donor worktree is being stopped by [plan-guard.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/plan-guard.mjs)
- failure message:
  - `[agent plan guard] agent:planetary-realism-audit requires an active cycle directory with plan.md before it can run.`

Architecture C8 is now complete in [earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.md):
- verdict: `post_cycle_runtime_failure`
- the donor-worktree cycle contract is now real enough to clear the earlier plan-guard block
- the first post-cycle runtime blocker is a missing terrain fixture asset:
  - `scripts/agent/fixtures/headless-terrain-180x90.json`

Architecture C9 is now complete in [earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c9-donor-worktree-runtime-fixture-repair.md):
- verdict: `runtime_fixture_contract_restored`
- the donor-worktree terrain fixture bundle was restored
- the bridged quick audit now exits `0`
- the requested quick artifact is live again:
  - [earth-weather-architecture-c9-bridged-hybrid-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c9-bridged-hybrid-quick.json)

Architecture C10 is now complete in [earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c10-cycled-hybrid-benchmark-rerun.md):
- verdict: `quick_reject`
- the repaired donor/current hybrid is now a real climate candidate and improves `4 / 6` core quick metrics
- the only severe quick-gate regression is:
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -371.9765`

Architecture C11 is now complete in [earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.md):
- verdict: `equatorial_overturning_polarity_inversion`
- the remaining blocker is not generic climate weakness
- it is a polarity reversal in equatorial overturning:
  - equatorial total-water flux north: `148.97786 -> -381.81173`
  - equatorial low-level velocity mean: `11.78514 -> -20.46744`
  - equatorial zonal-mean vapor flux north: `160.44983 -> -274.70821`
  - equatorial eddy vapor flux north: `-12.37515 -> -105.45284`

Architecture C12 is now complete in [earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c12-equatorial-overturning-sign-contract-design.md):
- verdict: `current_low_level_momentum_preserve_layer_required`
- the contract now explicitly keeps the donor scaffold but forward-ports the current low-level preserve layer:
  - [windNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windNudge5.js)
  - [windEddyNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windEddyNudge5.js)
  - [nudging5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/nudging5.js)
- donor-core sign-control ports are now explicitly bounded to:
  - `tauSurfaceSeconds`
  - `tauQvS`
  - `tauQvColumn`
  - organized/subsidence relief terms

Architecture C13 is now complete in [earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.md):
- verdict: `quick_reject`
- the sign-contract hybrid is still a strong climate candidate on `4 / 6` quick metrics:
  - `itczWidthDeg: 25.91 -> 23.884`
  - `subtropicalDryNorthRatio: 1.534 -> 1.152`
  - `subtropicalDrySouthRatio: 1.199 -> 0.585`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.232`
- but the remaining blocker is still transport polarity:
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -330.9854`

Architecture C14 is now complete in [earth-weather-architecture-c14-sign-contract-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c14-sign-contract-implementation-attribution.md):
- verdict: `zonal_mean_equatorial_reversal_still_vertical_scaffold_controlled`
- C13 improved the eddy-side equatorial failure but not the zonal-mean branch:
  - eddy vapor flux north: `-105.45284 -> -34.29106`
  - zonal-mean vapor flux north: `-274.70821 -> -301.63909`
- so the next bounded move became a current-vertical overlay experiment rather than more low-level nudging work

Architecture C15 is now complete in [earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.md):
- verdict: `quick_reject`
- the current vertical-state overlay still improved `4 / 6` quick metrics:
  - `itczWidthDeg: 25.91 -> 24.094`
  - `subtropicalDryNorthRatio: 1.534 -> 1.404`
  - `subtropicalDrySouthRatio: 1.199 -> 0.589`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.209`
- but it did not fix the real blocker and it gave back some C13 strength:
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -364.55266`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.15331`

Architecture C16 is now complete in [earth-weather-architecture-c16-vertical-contract-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c16-vertical-contract-implementation-attribution.md):
- verdict: `zonal_mean_relief_offset_by_upper_cloud_carryover_recirculation`
- the current vertical overlay helped one real thing:
  - equator zonal-mean vapor flux north: `-301.63909 -> -274.13377`
- and it also relieved the 35° dry-belt import burden:
  - `-467.08734 -> -360.61691`
- but it reintroduced a large upper-cloud maintenance family that more than canceled that benefit:
  - equator eddy vapor flux north: `-34.29106 -> -96.97265`
  - NH dry-belt carried-over upper cloud: `0 -> 0.39867`
  - NH dry-belt imported anvil persistence: `0 -> 0.39786`
  - NH dry-belt weak-erosion survival: `0 -> 0.38477`
  - NH dry-belt cloud recirculation proxy: `0 -> 2.22467`

Architecture C17 is now complete in [earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.md):
- verdict: `quick_reject`
- but it is a materially stronger hybrid than C15:
  - `itczWidthDeg: 25.91 -> 23.454`
  - `subtropicalDryNorthRatio: 1.534 -> 1.121`
  - `subtropicalDrySouthRatio: 1.199 -> 0.511`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.202`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14144`
- the blocker is still cross-equatorial transport sign:
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -353.31687`

Architecture C18 is now complete in [earth-weather-architecture-c18-carryover-carveout-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c18-carryover-carveout-implementation-attribution.md):
- verdict: `carryover_carveout_relief_preserves_zonal_mean_but_eddy_export_remains_primary_blocker`
- C17 did what C16 asked for:
  - NH dry-belt carried-over upper cloud: `0.39867 -> 0.22666`
  - NH dry-belt imported anvil persistence: `0.39786 -> 0.22501`
  - NH dry-belt weak-erosion survival: `0.38477 -> 0.21732`
  - NH dry-belt cloud recirculation proxy: `2.22467 -> 0.39988`
- and it preserved the helpful zonal-mean side:
  - equator zonal-mean vapor flux north: `-274.13377 -> -249.95949`
  - equator mid/upper vapor flux north: `-239.13535 -> -226.72426`
- but the remaining failure is now concentrated in the eddy/export lane:
  - equator eddy vapor flux north: `-96.97265 -> -109.90385`
  - 35° interface vapor flux north: `-360.61691 -> -373.49016`

Architecture C19 is now complete in [earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c19-zonal-mean-preserving-eddy-export-attribution.md):
- verdict: `shared_preserve_layer_not_primary_blocker_vertical_overlay_eddy_export_coupling`
- the important narrowing is that C13 and C17 still share the same low-level preserve layer:
  - `nudgeParams.tauQvS`
  - `nudgeParams.tauQvColumn`
  - `nudgeParams organized/subsidence relief quartet`
  - `windNudgeParams.tauSurfaceSeconds`
- so the remaining blocker is not that preserve layer by itself
- it is the newer vertical-overlay interaction that improves zonal mean while worsening the eddy/export branch:
  - equator zonal-mean vapor flux north: `-301.63909 -> -249.95949`
  - equator eddy vapor flux north: `-34.29106 -> -109.90385`
  - equator low-level velocity mean: `-19.4512 -> -20.79729`

Architecture C20 is now complete in [earth-weather-architecture-c20-zonal-mean-preserving-eddy-nudge-softening-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c20-zonal-mean-preserving-eddy-nudge-softening-experiment.md):
- verdict: `quick_reject`
- softening only the surface eddy-energy rescaling lane preserved the broad hybrid wins:
  - `itczWidthDeg: 25.91 -> 23.26`
  - `subtropicalDryNorthRatio: 1.534 -> 1.152`
  - `subtropicalDrySouthRatio: 1.199 -> 0.504`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.209`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.13877`
- but it did not relieve the core sign defect:
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -361.48916`
  - equator eddy vapor flux north: `-109.90385 -> -114.18489`
  - equator low-level velocity mean: `-20.79729 -> -21.02244`

So the next active move is now:
- `Architecture C21: eddy-softening implementation attribution`

Architecture C21 is now complete in [earth-weather-architecture-c21-eddy-softening-implementation-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c21-eddy-softening-implementation-attribution.md):
- verdict: `global_eddy_softening_reactivates_return_branch_carryover_without_fixing_equatorial_export`
- C20 was not inert
- relative to C17, it made the core equatorial transport branches worse:
  - equator zonal-mean vapor flux north: `-249.95949 -> -254.59421`
  - equator eddy vapor flux north: `-109.90385 -> -114.18489`
  - equator low-level velocity mean: `-20.79729 -> -21.02244`
- while the NH dry-belt return/carryover family rebounded:
  - carried-over upper cloud: `0.22666 -> 0.27973`
  - imported anvil persistence: `0.22501 -> 0.27804`
  - weak-erosion survival: `0.21732 -> 0.26804`
  - cloud recirculation proxy: `0.39988 -> 1.34927`
  - return-branch mass flux: `3368.15697 -> 3490.3125`

Architecture C22 is now complete in [earth-weather-architecture-c22-equatorial-band-eddy-softening-carveout-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c22-equatorial-band-eddy-softening-carveout-experiment.md):
- verdict: `quick_reject`
- limiting the softening to the equatorial band preserved the broad quick wins:
  - `itczWidthDeg: 25.91 -> 23.499`
  - `subtropicalDryNorthRatio: 1.534 -> 1.137`
  - `subtropicalDrySouthRatio: 1.199 -> 0.51`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.216`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.11658`
- but the blocker is still the same transport-sign defect:
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -355.11907`

Architecture C23 is now complete in [earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c23-equatorial-band-eddy-softening-attribution.md):
- verdict: `equatorial_band_softening_preserves_dry_belt_relief_but_deepens_lower_mid_zonal_branch`
- the C22 carveout really did preserve the dry-belt relief:
  - carried-over upper cloud: `0.22666 -> 0.22097`
  - imported anvil persistence: `0.22501 -> 0.21933`
  - weak-erosion survival: `0.21732 -> 0.21143`
  - cloud recirculation proxy: `0.39988 -> 0.39849`
  - return-branch mass flux: `3368.15697 -> 3348.50751`
- but the remaining export defect is now concentrated in the inner equatorial core:
  - equator lower zonal vapor flux north: `-13.99991 -> -14.07888`
  - equator mid zonal vapor flux north: `-12.93476 -> -13.11577`

Architecture C24 is now complete in [earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c24-inner-core-equatorial-eddy-softening-experiment.md):
- verdict: `quick_reject`
- narrowing the softening into the inner core kept the same broad quick wins:
  - `itczWidthDeg: 25.91 -> 23.275`
  - `subtropicalDryNorthRatio: 1.534 -> 1.091`
  - `subtropicalDrySouthRatio: 1.199 -> 0.506`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 1.214`
- but it gave back some upper-branch and dry-belt condensation relief:
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.12705`
  - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> -358.07208`

Architecture C25 is now complete in [earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c25-inner-core-equatorial-eddy-softening-attribution.md):
- verdict: `inner_core_narrowing_relieves_lower_mid_core_but_reopens_upper_carryover_shoulder`
- C24 really did relieve the lower-mid equatorial core relative to C22:
  - equator boundary-layer total-water flux north: `-5.01709 -> -4.84216`
  - equator lower total-water flux north: `-17.83744 -> -17.49403`
  - equator mid total-water flux north: `-16.77592 -> -16.75772`
- but it also reopened useful shoulder-side support:
  - equator upper total-water flux north: `-13.3117 -> -13.59209`
  - carried-over upper cloud: `0.22097 -> 0.23253`
  - cloud recirculation proxy: `0.39849 -> 0.49385`
  - return-branch mass flux: `3348.50751 -> 3447.36194`

Architecture C26 is now complete in [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-experiment.md):
- verdict: `quick_reject`
- the modest shoulder restore did help a few things relative to C24:
  - `midlatitudeWesterliesNorthU10Ms: 1.214 -> 1.225`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.12705 -> 0.11952`
  - `crossEquatorialVaporFluxNorthKgM_1S: -358.07208 -> -353.85346`
- but it still did not cross the real gate:
  - `itczWidthDeg: 25.91 -> 23.412`
  - `subtropicalDryNorthRatio: 1.534 -> 1.119`
  - `subtropicalDrySouthRatio: 1.199 -> 0.515`
  - `crossEquatorialVaporFluxNorthKgM_1S` remained a severe regression against the trusted positive target

So the next active move is now:
- `Architecture C27: partial equatorial shoulder restore attribution`

## Hard Rules Going Forward

- no more alphabetized residual micro-phases as the default workflow
- every proposed fix family must clear a full-objective annual decision gate
- 30-day runs are allowed only as a screening filter
- any new work must be framed as a bounded experiment family, not an open-ended local patch chase
