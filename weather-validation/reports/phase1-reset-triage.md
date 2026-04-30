# Phase 1 Reset Triage

## Bottom Line

- Frozen branch state for reset work: commit `8593bf5`
- Core blocker still being solved: **north subtropical dry-belt wet bias**
- Practical symptom set:
  - ITCZ too broad
  - NH subtropical dry belts too wet
  - NH midlatitude westerlies too weak
- Strategic conclusion:
  - the long serial `1A -> 1ZZF` micro-phase pattern did produce useful attribution
  - it is no longer the right active workflow
  - from this point forward, success should be judged by **full-objective climate improvement**, not local residual cleanup

## What Bug We Are Actually Solving

This is still the same bug family we started chasing in Phase 1:

- too much NH subtropical / transition ocean large-scale condensation and cloud maintenance
- too much support for moisture persistence across the NH dry-belt / adjacent transition corridor
- resulting in a too-broad tropical rain belt and underpowered NH return-flow / westerlies

This is **not** a new bug every time the phase letters changed. The later letter chain was mostly a sequence of increasingly local attribution passes on the same climate failure.

## Frozen 30-Day Branch State

Artifact:
- quick audit: `/tmp/phase1-reset-current-quick.json`

Run facts:
- headless terrain parity: `true`
- branch state tested: current HEAD default configuration at commit `8593bf5`
- weak-hemi taper check: forcing `--weak-hemi-cross-hemi-floor-taper-patch on` produced an identical 30-day climate screen, so the current frozen branch state and the best-kept state are effectively the same for reset purposes

Current day-30 metrics:
- `itczWidthDeg = 25.91`
- `subtropicalDryNorthRatio = 1.534`
- `subtropicalDrySouthRatio = 1.199`
- `midlatitudeWesterliesNorthU10Ms = 0.531`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.1413`
- `crossEquatorialVaporFluxNorthKgM_1S = 143.95306`

## What Improved Materially Since Early Phase 1

The fairest comparison for “did we improve anything?” is against the badly degraded early live Phase 1 branch state from the first failed kept-patch era, not against the old trusted climate baseline.

Relative to the early broken Phase 1C branch state (`itcz 26.415`, `dry north 1.704`, `dry south 1.296`, `NH jet 0.532`), the current frozen branch state is better on the main dry-belt guardrails:

- `itczWidthDeg`: `26.415 -> 25.91` (`-0.505`)
- `subtropicalDryNorthRatio`: `1.704 -> 1.534` (`-0.170`)
- `subtropicalDrySouthRatio`: `1.296 -> 1.199` (`-0.097`)
- `midlatitudeWesterliesNorthU10Ms`: `0.532 -> 0.531` (`-0.001`)

The real lasting contributors were a small set of kept families:

1. `Phase 1K` soft live-state marine maintenance suppression
- first patch family that materially reduced NH dry-belt ocean maintenance in the real 30-day climate

2. `Phase 1M` circulation rebound containment
- small but real transition-lane cleanup without damaging the Phase 1K win

3. `Phase 1ZG / 1ZJ` buffered shoulder fate plus split-lane gate geometry
- most successful shoulder-lane cleanup sequence
- preserved the `11.25°N` and `18.75°N` improvements while removing false target-entry suppression

Those are real improvements. They are just not enough.

## What Still Fails Against The Main Climate Gates

Relative to the trusted old Phase 1 baseline in [phase1-hadley-second-pass-restore-v4.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json), the current frozen branch state is still materially worse:

- `itczWidthDeg`: `23.646 -> 25.91` (`+2.264`)
- `subtropicalDryNorthRatio`: `1.100 -> 1.534` (`+0.434`)
- `subtropicalDrySouthRatio`: `0.519 -> 1.199` (`+0.680`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192 -> 0.531` (`-0.661`)

This is the key reality check:

- we **have** improved the degraded Phase 1 live branch
- we **have not** recovered the old trusted climate quality
- so the branch is still not ready to hand back to the “main roadmap” as if the blocker were solved

## Long-Horizon Annual Screen

Artifact target:
- annual audit: [phase1-reset-triage-annual.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-reset-triage-annual.json)

Annual climate-only run facts:
- headless terrain parity: `true`
- climate-only mode: `--no-repro-check --no-counterfactuals`
- overall pass: `false`

Key annual samples:

- day 30:
  - `itczWidthDeg = 25.712`
  - `subtropicalDryNorthRatio = 1.765`
  - `subtropicalDrySouthRatio = 1.254`
  - `midlatitudeWesterliesNorthU10Ms = 0.524`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.23684`
  - `crossEquatorialVaporFluxNorthKgM_1S = 132.79614`

- day 180:
  - `itczWidthDeg = 24.8`
  - `subtropicalDryNorthRatio = 1.218`
  - `subtropicalDrySouthRatio = 2.457`
  - `midlatitudeWesterliesNorthU10Ms = 0.529`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.15753`
  - `crossEquatorialVaporFluxNorthKgM_1S = 73.26705`

- day 365:
  - `itczWidthDeg = 24.875`
  - `subtropicalDryNorthRatio = 1.343`
  - `subtropicalDrySouthRatio = 1.145`
  - `midlatitudeWesterliesNorthU10Ms = 0.524`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.2774`
  - `crossEquatorialVaporFluxNorthKgM_1S = 326.33822`

Day-365 versus the trusted old Phase 1 baseline:
- `itczWidthDeg`: `23.646 -> 24.875` (`+1.229`)
- `subtropicalDryNorthRatio`: `1.100 -> 1.343` (`+0.243`)
- `subtropicalDrySouthRatio`: `0.519 -> 1.145` (`+0.626`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192 -> 0.524` (`-0.668`)

What the annual screen means:
- the 30-day screens were **directionally useful**
- the same top-level climate bug still exists at day 365
- so the headless runs were not sending us into a random fake problem

What the annual screen adds:
- 30 days is **not enough** to declare a winning fix
- the annual run exposes long-horizon moisture-partition drift that the 30-day screen does not fully capture
- the strongest annual warning sign is the day-365 rise in:
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2`
  - `crossEquatorialVaporFluxNorthKgM_1S`

So the honest conclusion is:
- use 30-day headless runs as a fast screen for obviously bad ideas
- require 365-day confirmation before promoting any “real fix”

## Which Mechanisms Are Still Live Candidates

The frozen branch-state ranking from the current quick and annual screens still points to a **small** set of live candidate families:

1. `radiativeThermodynamicSupport`
- dominant family in the quick screen
- dominant family in every annual season (`DJF`, `MAM`, `JJA`, `SON`)
- still the strongest live candidate for why NH dry-belt maintenance remains too efficient

2. `importedCloudPersistence`
- second-ranked family in every annual season
- consistent with the long-running upper-cloud survival / overlap story

3. `numericalFragility`
- moved back into the annual top three in every season
- this does **not** mean the bug is fake
- it does mean time-step / handoff robustness still has to be treated as a live co-candidate at annual horizon

4. `localLargeScaleMaintenance`
- still ranks below the top three, but remains the most plausible remaining physical receiver / maintenance expression
- it should stay in scope as part of a broad experiment, not as another micro-lane cleanup project

These are the only families that should define the next experiment set.

## Which Families Are Effectively Ruled Out As Primary Answers

The proof campaign did narrow the search space in a meaningful way. These are not credible primary explanations anymore:

1. `browser / runtime artifact`
- headless terrain parity is stable and the climate miss reproduces in the core model

2. `nudging as the primary owner`
- not supported by the proof chain

3. `storm leakage / spillover as the primary owner`
- persists as a side effect sometimes, but ranks near zero in the current root-cause screen

4. `local convection as the primary owner`
- not the main story

5. `pure transport / carry-input tuning as the main solution`
- ruled out by the failed early vertical / carryover patch family

6. `selector geometry alone`
- shoulder selector and equatorial-edge geometry work narrowed the issue, but did not solve the climate state by themselves

7. `source-cap alone`
- north-source cap relieved `11.25°N` but redistributed the bias elsewhere

8. `Atlantic receiver geometry alone`
- receiver taper moved the problem equatorward instead of solving it

9. `Atlantic transition carryover taper alone`
- current containment lane is blocked at admission and is not the whole answer

## Are Headless Runs Actually Pointing At The Cause?

Yes, but with limits.

Why they are useful here:
- they execute the same climate-core physics modules
- they reproduce the same dry-belt failure pattern repeatedly
- terrain parity is explicit and currently `true`
- they are strong enough to rank live mechanism families and falsify bad patch ideas

What they do **not** prove by themselves:
- final ship-readiness
- all runtime integration behavior
- whether climate scientists would be satisfied by the full shipped system

So the honest answer is:
- headless runs are good enough to diagnose the **core climate bug family**
- headless runs are not sufficient by themselves to declare the whole weather system finished

## Reset Plan: Bounded, System-Level, And Decision-Oriented

This reset does **not** guarantee a successful fix in a fixed number of phases.

It **does** guarantee a bounded decision process:
- after three reset phases, we should either have a credible winning strategy or stop pretending the current branch-tuning style is working

### Reset R1: Freeze And Triage

Deliverables:
- frozen 30-day screen
- frozen 365-day screen
- compact report of:
  - real improvements
  - remaining failures
  - live candidate families
  - ruled-out families

Status:
- active now

### Reset R2: Run Three System-Level Experiments

Judge these only by full-objective climate improvement at 30 days and 365 days.

Experiment A:
- `Upper-cloud persistence collapse`
- jointly test imported persistence plus radiative support reduction in the NH subtropical / transition ocean corridor

Experiment B:
- `Annual numerical-fragility hardening`
- one experiment explicitly aimed at time-step / handoff robustness in the climate core, judged only by full-objective climate improvement rather than local instrumentation signatures

Experiment C:
- `Hydrology balance repartition`
- one coupled experiment around cross-equatorial balance, NH dry-belt ocean condensation efficiency, and remaining large-scale maintenance rather than any single local lane

### Reset R3: Choose Winner Or Stop

Decision rule:
- if one experiment improves the main climate objectives at both 30 days and 365 days, promote it as the new active branch direction
- if none do, stop the patch spiral and either:
  - roll back to the best older trusted branch state, or
  - escalate to a broader architecture change rather than continuing micro-phase decomposition

## Practical Meaning

The honest message to carry forward is:

- we are **not** done
- we are **not** obviously one patch away
- but we are also **not** debugging an infinite random space anymore
- the next useful move is to test a **small number of broad system-level experiments**, not keep subdividing the same residual into more letter pairs
