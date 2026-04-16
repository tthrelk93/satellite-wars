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

- [ ] Select the current branch plus the best trusted rollback candidate(s).
- [ ] Run the `30`-day audit on each branch.
- [ ] Run the `365`-day audit on each branch.
- [ ] Compare only full-objective climate metrics.
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

The next active phase is:
- `Phase 0: Base-State Recovery Decision`

That is the only correct next step if the goal is realistic Earth weather rather than another local patch campaign.
