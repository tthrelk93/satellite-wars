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

That decision should be made with only two approved paths:

1. `Rollback path`
- identify the best trusted climate state that predates the late patch spiral
- benchmark that state against the current branch with the same annual objective suite
- decide whether to restore it as the shipping base

2. `Architecture-change path`
- if rollback is not acceptable, define one broader redesign lane instead of more local patches
- examples:
  - rework upper-cloud maintenance / overlap survival architecture
  - rework subtropical dry-belt condensation partitioning architecture
  - rework cross-equatorial transport and return-flow coupling architecture

## Hard Rules Going Forward

- no more alphabetized residual micro-phases as the default workflow
- every proposed fix family must clear a full-objective annual decision gate
- 30-day runs are allowed only as a screening filter
- any new work must be framed as a bounded experiment family, not an open-ended local patch chase
