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
