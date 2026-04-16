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

## Hard Rules Going Forward

- no more alphabetized residual micro-phases as the default workflow
- every proposed fix family must clear a full-objective annual decision gate
- 30-day runs are allowed only as a screening filter
- any new work must be framed as a bounded experiment family, not an open-ended local patch chase
