# Upstream Root-Cause Instrumentation Campaign

Use this plan when the north subtropical dry belt remains too wet after local cleanup, cloud-erosion, and downstream microphysics packages have already failed.

This campaign is intentionally instrumentation-first. The goal is not to guess at another patch. The goal is to make the causal chain so observable that by the final phase we can point to one dominant upstream failure mode and write a patch against that mechanism instead of tuning by inference.

## Current evidence baseline

Latest kept quick-baseline truth from `weather-validation/output/phase1-hadley-second-pass-restore-v4.json`:
- `subtropicalDryNorthRatio = 1.100`
- `itczWidthDeg = 23.646`
- `subtropicalDrySouthRatio = 0.519`
- `subtropicalSubsidenceNorthMean = 0.065`
- `subtropicalSubsidenceSouthMean = 0.038`

Latest causal evidence from `weather-validation/output/phase2c-cloud-origin-quick-moisture-attribution.json`:
- NH dry belt is not dominated by local convective source:
  - `convectiveDetrainmentCloudSourceMeanKgM2 = 0.00005`
- NH dry belt is dominated by carried-over upper cloud that is not being cleared effectively:
  - `carriedOverUpperCloudMeanKgM2 = 0.34771`
  - `weakErosionCloudSurvivalMeanKgM2 = 0.33467`
- large-scale condensation remains the next-biggest in-band contributor:
  - `largeScaleCondensationMeanKgM2 = 0.1439`
- the strongest net moistening source already identified is ocean-side surface vapor injection:
  - `stepSurface2D5 northDryBeltSurfaceVaporDeltaKgKg = 0.42643`
  - land `0.013391`, ocean `0.603119`
- precipitation remains overwhelmingly in `large_scale_other` rather than a well-organized tropical regime:
  - `deep_core_tropical = 7.4%`
  - `marginal_subtropical = 18.1%`
  - `large_scale_other = 74.5%`

Interpretation:
- the remaining bug is upstream of local dry-belt cloud cleanup
- the remaining bug is upstream of simple drizzle suppression
- the remaining bug is likely in a chain that starts with source moisture and transport partitioning, passes through large-scale cloud birth, and ends with weak upper-cloud ventilation / erosion

## Campaign design principles

1. Instrument the causal chain in physical order.
2. Make each phase capable of ruling out whole families of causes.
3. Keep every new metric split by:
   - latitude band
   - height
   - land vs ocean
   - where useful, basin / longitude sector
4. Prefer process budgets and tracers over end-state snapshots.
5. Require every phase to emit machine-readable artifacts, not just console summaries.
6. Do not advance to a new physics patch until the current phase can answer a real causal question.

## Root-cause families this plan is meant to cover

If implemented fully, the phases below cover every plausible upstream cause of the current NH dry-belt wet bias:
- excessive surface moisture source
- wrong land/ocean source partitioning
- wrong source geography or basin asymmetry
- wrong meridional moisture transport
- wrong vertical transport or export level
- weak Hadley export / subsidence partitioning
- excessive resolved ascent in the dry belt
- excessive saturation-adjustment cloud birth
- excessive imported upper cloud
- weak upper-cloud ventilation / erosion
- radiative maintenance of cloud that should dissipate
- boundary-layer or stability structure that favors persistent cloud
- nudging / analysis / climatology interference
- initialization memory / transient contamination
- numerical diffusion, timestep sensitivity, limiter clipping, or grid artifact
- sectoral storm spillover and transient eddy leakage into the dry belt

## Run protocol for every phase

Before starting Phase 1:
- freeze a verified baseline commit and reuse the same seed, grid, and audit entry point
- run at least:
  - `quick` 30-day screen
  - `seasonal` 90-day follow-through for any promising signal
  - `annual` 365-day confirmation only after a candidate causal family is clearly identified
- write all new outputs into `weather-validation/output/` with stable sibling sidecars:
  - main audit JSON
  - attribution JSON
  - profile JSON
  - monthly climatology JSON
  - markdown summary

Every phase should emit:
- one artifact that is a raw measurement dump
- one artifact that is a reduced attribution summary
- one artifact that explicitly says which root-cause families are ruled in, ruled out, or still ambiguous

## Phase 0: Reproducibility And Closure Harness

Objective:
- make sure later findings are trustworthy and comparable

Primary modules:
- `src/weather/v2/core5.js`
- `scripts/agent/planetary-realism-audit.mjs`
- `src/weather/validation/diagnostics.js`

Add instrumentation:
- run metadata block:
  - git commit
  - seed
  - grid
  - timestep
  - model-day sample windows
  - enabled overrides
- exact module-order timing and call counts for each run
- conservation summary:
  - global water
  - global energy proxies
  - per-module delta drift
- restart parity:
  - same run resumed from checkpoint produces the same diagnostic trajectory

New artifacts:
- `*-run-manifest.json`
- `*-conservation-summary.json`
- `*-restart-parity.json`

Rules out / confirms:
- bad comparisons caused by inconsistent setup
- hidden divergence between “same” runs
- nonphysical drift overwhelming the diagnostic picture

Exit criteria:
- repeated baseline runs match within a narrow tolerance on all top-level climate metrics
- conservation drift is bounded and attributable

## Phase 1: Surface Moisture Source Attribution

Objective:
- prove exactly where NH dry-belt moisture enters the system and in what form

Primary modules:
- `src/weather/v2/surface2d.js`
- `src/weather/v2/state5.js`
- `src/weather/v2/core5.js`
- `src/weather/validation/diagnostics.js`

Add instrumentation:
- passive source tracers for low-level vapor tagged by origin:
  - NH dry-belt ocean evaporation
  - tropical ocean evaporation north of the equator
  - tropical ocean evaporation south of the equator
  - NH extratropical ocean evaporation
  - land recycling / evapotranspiration
  - carried-over initialization moisture
- surface-flux decomposition by cell and by band:
  - `Ce`
  - wind speed term
  - humidity gradient term
  - SST / Ts term
  - soil-moisture gate
  - runoff / drainage gate
  - sea-ice suppression term
- land/ocean/coastal splits
- basin / sector splits at minimum for:
  - east Pacific
  - Atlantic
  - west Pacific / Indo-Pacific
  - continental subtropics

New artifacts:
- `*-surface-source-tracers.json`
- `*-surface-flux-decomposition.json`
- `*-nh-dry-belt-source-sector-summary.json`

Rules out / confirms:
- whether the wet bias is simply too much moisture input
- whether the moisture source is local ocean, tropical import, land recycling, or initialization memory
- whether one ocean basin dominates the NH error

Exit criteria:
- at least 90% of NH dry-belt low-level vapor can be attributed to tagged source families
- one or more source families can be ranked by contribution

## Phase 2: Transport And Circulation Partition Tracing

Objective:
- determine whether the bug is caused by transport into the band rather than source injection itself

Primary modules:
- `src/weather/v2/advect5.js`
- `src/weather/v2/dynamics5.js`
- `src/weather/v2/mass5.js`
- `src/weather/v2/windNudge5.js`
- `src/weather/v2/windEddyNudge5.js`
- `src/weather/v2/core5.js`

Add instrumentation:
- tagged-tracer transport across latitude interfaces:
  - `0°`
  - `12°`
  - `22°`
  - `35°`
- split fluxes by level:
  - boundary layer
  - lower troposphere
  - mid troposphere
  - upper troposphere
- decompose moisture transport into:
  - zonal-mean meridional circulation
  - transient eddy contribution
  - local recirculation within the band
- diagnose overturning structure:
  - zonal-mean mass streamfunction proxy
  - export level of tropical condensate and vapor
  - descent return branch intensity north vs south
- diagnose cross-interface cloud import:
  - upper cloud mass crossing `12°`, `22°`, `35°`

New artifacts:
- `*-transport-interface-budget.json`
- `*-hadley-partition-summary.json`
- `*-band-level-flux-matrix.json`

Rules out / confirms:
- whether moisture is entering the NH dry belt from upstream transport even when local source is modest
- whether the NH branch is asymmetric because transport is too efficient northward
- whether the cloud/moisture error enters low, mid, or upper troposphere

Exit criteria:
- the model can say what fraction of NH dry-belt vapor and cloud arrived by local source versus imported transport
- the dominant transport level and interface are identified

## Phase 3: Large-Scale Cloud Birth Attribution Inside The Vertical Path

Objective:
- separate cloud born locally in the dry belt from cloud that merely arrives there

Primary modules:
- `src/weather/v2/vertical5.js`
- `src/weather/v2/core5.js`
- `src/weather/validation/diagnostics.js`

Add instrumentation:
- per-column cloud-birth channels:
  - resolved-ascent cooling cloud birth
  - saturation-adjustment cloud birth
  - convective detrainment cloud birth
  - carry-over cloud entering the step
  - carry-over cloud surviving the step
- split each by:
  - sigma band
  - land/ocean
  - latitude band
  - longitude sector
- event histograms:
  - how often supersaturation is reached
  - how strong omega is when large-scale cloud birth occurs
  - whether cloud birth is driven by weak ascent in many columns or stronger ascent in fewer columns

New artifacts:
- `*-vertical-cloud-birth-attribution.json`
- `*-vertical-cloud-birth-histograms.json`
- `*-dry-belt-cloud-origin-matrix.json`

Rules out / confirms:
- whether the wet bias is really local large-scale cloud generation
- whether saturation adjustment is too eager
- whether weak resolved ascent is overactive in the NH dry belt

Exit criteria:
- the dominant birth pathway for NH `large_scale_other` cloud is known
- local generation versus imported carry-over can be ranked quantitatively

## Phase 4: Upper-Cloud Residency, Ventilation, And Erosion Diagnostics

Objective:
- determine whether the problem is not cloud birth, but failure to remove or ventilate upper cloud after arrival

Primary modules:
- `src/weather/v2/vertical5.js`
- `src/weather/v2/advect5.js`
- `src/weather/v2/radiation2d.js`
- `src/weather/v2/core5.js`

Add instrumentation:
- cloud age tracers:
  - upper-cloud residence time
  - time since last local birth
  - time since last import across `12°` / `22°`
- erosion accounting:
  - potential erosion
  - applied erosion
  - blocked erosion and why
- ventilation accounting:
  - horizontal export of upper cloud
  - descent-driven erosion
  - radiatively maintained persistence
- regime persistence maps:
  - repeated regeneration
  - passive survival
  - oscillatory birth/decay cycling

New artifacts:
- `*-upper-cloud-residence.json`
- `*-upper-cloud-erosion-budget.json`
- `*-upper-cloud-ventilation-summary.json`

Rules out / confirms:
- whether imported cloud survives too long
- whether erosion is too weak or frequently bypassed
- whether the band is cloudy because of stale upper cloud rather than fresh generation

Exit criteria:
- at least 80% of NH dry-belt upper cloud can be labeled as:
  - freshly born
  - recently imported
  - long-lived stale cloud

## Phase 5: Thermodynamic And Radiative Support Diagnostics

Objective:
- determine whether the dry belt is thermodynamically too hospitable to cloud and weak precipitation

Primary modules:
- `src/weather/v2/radiation2d.js`
- `src/weather/v2/surface2d.js`
- `src/weather/v2/hydrostatic.js`
- `src/weather/v2/vertical5.js`

Add instrumentation:
- boundary-layer and lower-tropospheric stability diagnostics:
  - inversion strength
  - moist static energy
  - theta-e gradients
  - lower-tropospheric RH by layer
- radiative maintenance diagnostics:
  - clear-sky vs cloudy LW cooling
  - SW cloud shielding
  - net radiative support for persistent upper cloud
- cloud-maintenance regime classification:
  - moisture-supported
  - radiation-supported
  - dynamics-supported
  - mixed

New artifacts:
- `*-thermodynamic-support-summary.json`
- `*-radiative-cloud-maintenance.json`
- `*-boundary-layer-stability-profiles.json`

Rules out / confirms:
- whether the NH dry belt is too wet because thermal structure or radiation makes cloud persist too easily
- whether the issue is not transport alone, but too weak drying / inversion formation after import

Exit criteria:
- we can say whether radiative / thermodynamic support is primary, secondary, or negligible

## Phase 6: External Forcing, Nudging, Climatology, And Initialization Interference

Objective:
- prove whether “helper” terms are fighting the physical solution

Primary modules:
- `src/weather/v2/nudging5.js`
- `src/weather/v2/analysisIncrement5.js`
- `src/weather/v2/climo2d.js`
- `src/weather/v2/initializeFromClimo.js`
- `src/weather/v2/initializeFromAnalysis.js`
- `src/weather/v2/core5.js`

Add instrumentation:
- per-level, per-band tendency opposition:
  - native drying tendency
  - nudging moistening tendency
  - analysis increment moistening tendency
  - wind-target tendency
- target-versus-state diagnostics:
  - what target humidity / temperature / wind the model is being relaxed toward
  - how often the target opposes local physical clearing
- initialization memory tracer:
  - fraction of present NH dry-belt vapor/cloud still attributable to initial state after 10, 30, 60, 90 days

New artifacts:
- `*-forcing-opposition-budget.json`
- `*-nudging-target-mismatch.json`
- `*-initialization-memory.json`

Rules out / confirms:
- whether nudging or analysis increments quietly sustain the wet bias
- whether a climo or initialization asymmetry contaminates the diagnosis

Exit criteria:
- helper terms are either exonerated or quantitatively implicated

## Phase 7: Sectoral Storm Spillover And Synoptic Leakage

Objective:
- determine whether the NH dry-belt wet bias is actually caused by transient systems leaking cloud and precipitation equatorward / poleward into the band

Primary modules:
- `src/weather/v2/dynamics5.js`
- `src/weather/v2/advect5.js`
- `src/weather/v2/vertical5.js`
- `src/weather/v2/microphysics5.js`

Add instrumentation:
- sector-by-sector event catalog:
  - large-scale rain events in `15–35°N`
  - upstream origin sector
  - associated vorticity / omega / cloud-path signature
- classify NH dry-belt precipitation/cloud into:
  - persistent zonal background
  - tropical spillover
  - subtropical marine deck / drizzle
  - synoptic storm leakage
- track transient-eddy moisture and cloud export into the band by basin

New artifacts:
- `*-storm-spillover-catalog.json`
- `*-sectoral-dry-belt-regimes.json`
- `*-transient-eddy-leakage-summary.json`

Rules out / confirms:
- whether the NH asymmetry is mainly a zonal-mean climate problem or a sectoral storm-track leakage problem

Exit criteria:
- at least 80% of NH dry-belt precipitation/cloud can be assigned to one of the regime families above

## Phase 8: Numerical Integrity And Sensitivity Diagnostics

Objective:
- make sure the remaining bias is not being manufactured by numerics

Primary modules:
- `src/weather/v2/advect5.js`
- `src/weather/v2/vertical5.js`
- `src/weather/v2/core5.js`
- any limiter / clipping logic touched by the moist core

Add instrumentation:
- tracer conservation and clipping counters:
  - negative-value clipping
  - supersaturation clamp frequency
  - cloud/precip limiter frequency
- timestep sensitivity summaries:
  - compare `dt` variants on source, transport, and cloud-birth budgets
- grid sensitivity summaries:
  - compare coarse vs nominal resolution on the same attribution fields
- hemisphere asymmetry sanity checks not explainable by forcing/geography

New artifacts:
- `*-numerical-integrity-summary.json`
- `*-dt-sensitivity.json`
- `*-grid-sensitivity.json`

Rules out / confirms:
- hidden bias from numerics, clipping, or resolution
- false causal stories created by one unstable integration setting

Exit criteria:
- dominant attribution story survives reasonable `dt` and grid perturbations

## Phase 9: Seasonal Memory And Hysteresis Diagnostics

Objective:
- verify that the identified cause is not just a startup artifact or one-month transient

Primary modules:
- `scripts/agent/planetary-realism-audit.mjs`
- `src/weather/validation/diagnostics.js`
- upstream modules identified by earlier phases

Add instrumentation:
- monthly versions of all attribution summaries
- lagged / cumulative source-to-cloud and source-to-precip attribution
- seasonal persistence:
  - does the same root cause dominate in the same months
  - does the band recover after transient perturbations

New artifacts:
- `*-monthly-attribution-climatology.json`
- `*-seasonal-root-cause-ranking.json`
- `*-attribution-lag-analysis.json`

Rules out / confirms:
- startup-only explanations
- short-window misdiagnosis
- false fixes that only look good at 30 days

Exit criteria:
- the leading root-cause family is stable across `30`, `90`, and `365` day horizons

## Phase 10: Controlled Ablation And Counterfactual Harness

Objective:
- move from observation to causal proof

Primary modules:
- `src/weather/v2/core5.js`
- whichever upstream modules are implicated by prior phases
- `scripts/agent/planetary-realism-audit.mjs`

Add instrumentation and harness features:
- controlled ablation toggles that scale only one identified pathway at a time:
  - source moisture
  - transport across a chosen interface
  - resolved ascent cloud birth
  - saturation-adjustment cloud birth
  - upper-cloud erosion
  - radiative maintenance
  - nudging opposition
- automatic counterfactual report:
  - when pathway X is weakened by 10–20%, which downstream metrics move and by how much

New artifacts:
- `*-counterfactual-pathway-sensitivity.json`
- `*-root-cause-candidate-ranking.json`

Rules out / confirms:
- whether the leading attribution is actually causal or merely correlated

Exit criteria:
- one or two pathway families produce the dominant directional improvement when perturbed

## Phase 11: Root-Cause Closure And Patch Readiness

Objective:
- decide when we know enough to stop instrumenting and start patching

Required closure conditions:
- the NH dry-belt wet bias has a dominant upstream explanation with:
  - identified source family
  - identified transport path
  - identified cloud-birth or carry-over mechanism
  - identified maintenance / interference mechanism if applicable
- that explanation survives:
  - seasonal checks
  - numerical sensitivity checks
  - counterfactual perturbation
- the final candidate pathway ranking names one primary causal chain and at most one backup explanation

Required final report:
- `weather-validation/output/root-cause-closure-report.md`

That report must answer:
1. Where does the excess NH dry-belt moisture originate?
2. How does it reach the band?
3. At what level does it become cloud or remain cloud?
4. Why does it persist long enough to rain?
5. Which helper or numerical terms matter, if any?
6. Which single module family should the next physics patch target first?

If the campaign reaches Phase 11 successfully, the next patch should no longer be exploratory. It should be a direct intervention against the identified dominant causal chain.

## Recommended order of implementation

Build in this order:
1. `Phase 0` reproducibility harness
2. `Phase 1` surface source tracing
3. `Phase 2` transport / circulation tracing
4. `Phase 3` vertical cloud-birth tracing
5. `Phase 4` upper-cloud residence / erosion tracing
6. `Phase 6` helper-term interference tracing
7. `Phase 5` thermodynamic / radiative support tracing
8. `Phase 7` sectoral storm spillover tracing
9. `Phase 8` numerical sensitivity tracing
10. `Phase 9` seasonal memory tracing
11. `Phase 10` controlled ablations
12. `Phase 11` closure report

Why this order:
- it follows the causal chain from source to persistence
- it delays the most expensive long-horizon work until the faster attribution layers are already informative
- it ensures we do not confuse a downstream symptom with an upstream cause again

## What this campaign should guarantee if completed thoroughly

No instrumentation plan can mathematically guarantee the exact patch before we collect the data. But if every phase above is implemented well and reaches its exit criteria, we should be left with:
- a fully ranked set of upstream causal pathways
- a small set of falsified explanations we no longer need to guess about
- one dominant mechanism or a very tight pair of mechanisms
- a physics patch that is evidence-backed rather than exploratory

That is the standard for “all but guaranteed” root-cause discovery on this bug.
