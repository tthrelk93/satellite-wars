# Coupled Fix Proof Campaign

Use this campaign after the original 12-phase upstream instrumentation pass reaches Phase 12 and concludes that the NH dry-belt bug is a **coupled multi-pathway failure**, not a single isolated lever.

This plan is intentionally **proof-first**. The goal is not to guess at a coupled patch. The goal is to identify:
- exactly where the coupled chain first becomes pathological
- exactly which module boundary owns that failure
- exactly which coordinated edit set should be attempted first
- exactly how we will prove the patch works before we trust it

## Why a new campaign is needed

The first campaign successfully narrowed the problem, but it did **not** give us a patch-ready single cause.

What we know now:
- imported/background atmospheric carryover dominates local source
- the corridor is upper tropospheric and largely persistent-background, not storm leakage
- carried-over upper cloud dominates local convective source
- blocked erosion is severe
- radiative support is secondary but real
- helper forcing is mostly ruled out
- numerical sensitivity is still real
- Phase 11 proved that no single isolated ablation is enough

What we still do **not** know:
- the first exact module handoff where the coupled chain becomes unavoidable
- whether the current instrumentation branch is still reproducing the last trusted Phase 1 baseline faithfully
- which combined intervention set preserves ITCZ/trades/westerlies while drying the NH dry belt

## Current working hypothesis

The most likely coupled chain is:
1. imported upper cloud enters the NH dry belt through the upper-tropospheric background corridor
2. the vertical-path erosion/ventilation logic fails to clear enough of it
3. local saturation-adjustment / large-scale maintenance keeps rebuilding cloud from that imported reservoir
4. radiative support helps the surviving cloud persist

The critical unknown is where that chain should be broken first:
- transport handoff
- vertical erosion handoff
- large-scale condensation handoff
- radiative persistence handoff

## Phase A: Baseline Reconciliation And Observer-Effect Audit

Objective:
- prove that the current instrumented branch still reproduces the last trusted weather baseline, or explain exactly why it does not

Why this phase is first:
- the kept Phase 1 artifact shows:
  - `itczWidthDeg = 23.646`
  - `subtropicalDryNorthRatio = 1.100`
  - `subtropicalDrySouthRatio = 0.519`
  - `subtropicalSubsidenceNorthMean = 0.065`
  - `subtropicalSubsidenceSouthMean = 0.038`
- the current Phase 11 quick baseline showed:
  - `itczWidthDeg = 27.36`
  - `subtropicalDryNorthRatio = 1.772`
  - `subtropicalDrySouthRatio = 1.437`
  - `subtropicalSubsidenceNorthMean = 0.085`
  - `subtropicalSubsidenceSouthMean = 0.033`

That mismatch is too large to ignore. Before any new fix-placement work, we need to know whether:
- the physics branch drifted
- the diagnostics changed semantics
- the audit harness is not comparing like with like
- the instrumentation itself is affecting the model

Primary modules:
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- any instrumentation fields that can influence stepping order or state mutation

Required work:
- add a no-op instrumentation mode that records nothing but still walks the same code path
- add an instrumentation-disabled paired run mode
- compare:
  - last trusted commit / artifact
  - current branch with instrumentation enabled
  - current branch with instrumentation no-op
- emit a strict observer-effect diff on all Phase 1 metrics

Artifacts:
- `observer-effect-baseline-diff.json`
- `observer-effect-baseline-diff.md`
- `observer-effect-module-order-parity.json`

Exit criteria:
- either the current branch reproduces the trusted baseline within tolerance
- or we isolate the exact observer/drift cause and fix that first

Phase A result:
- completed on `2026-04-12`
- trusted baseline commit `e6fea58` still reproduces the kept Phase 1 artifact exactly
- current branch does **not** reproduce that baseline
- current `full`, `noop`, and `disabled` instrumentation modes all land on the same degraded quick baseline
- module stepping order remains identical across the observer variants
- current diagnosis:
  - `observer effect`: ruled out as the primary cause
  - `branch drift or audit semantics drift`: still active and must be treated as the live baseline problem before any new fix-placement claims

## Phase B: Module-Local Cloud Transition Ledger

Objective:
- trace the exact cloud-state transitions that convert imported dry-belt upper cloud into persistent/raining cloud

Why this phase matters:
- our current diagnostics tell us which families matter
- they do **not** yet tell us which module step is the first hard failure

Primary modules:
- [advect5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/advect5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js)

Required instrumentation:
- per module, per NH dry-belt cell, per upper/mid/lower level band:
  - imported cloud entering
  - imported cloud surviving unchanged
  - cloud eroded away
  - cloud converted into local condensation support
  - cloud converted into precip support
  - cloud lost to re-evaporation
  - cloud kept alive by radiative persistence
- track this as a real state-transition ledger instead of separate scalar diagnostics

Artifacts:
- `cloud-transition-ledger.json`
- `cloud-transition-ledger-summary.json`
- `cloud-transition-ledger-sector-split.json`

Exit criteria:
- at least 95% of NH dry-belt upper-cloud-path change is attributed to explicit module-local transitions
- we can name the first module that turns imported cloud into “persistent problem cloud”

Phase B result:
- completed on `2026-04-11`
- artifacts:
  - `/tmp/phaseB-smoke-cloud-transition-ledger.json`
  - `/tmp/phaseB-smoke-cloud-transition-ledger-summary.json`
  - `/tmp/phaseB-smoke-cloud-transition-ledger-sector-split.json`
- current result:
  - gross attributed transition coverage is `0.88304`
  - net closure remains poor because gross transitions largely cancel, so Phase B should be read through the gross-coverage lens rather than signed net closure alone
  - `firstPersistentProblemModule = stepVertical5`
  - `dominantPersistentModule = stepVertical5`
  - the strongest persistent corridor is `eastPacific / midTroposphere`, followed by `indoPacific / midTroposphere`
- current diagnosis:
  - the first hard failure is inside the vertical path, not advection, microphysics, or radiation
  - imported upper cloud is being carried forward and locally reinforced inside `stepVertical5`
  - Phase B narrows placement to the vertical handoff, but it does **not** fully close the chain because coverage is still below the `0.95` bar

## Phase C: Corridor Replay And Short-Window Causal Slices

Objective:
- isolate the bad handoff in short replays instead of waiting for the full 30-day chain every time

Why:
- full 30-day runs are necessary for screening
- they are too blunt for step-level causal proof

Primary modules:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Required work:
- save replay checkpoints centered on the strongest NH corridor sectors:
  - east Pacific
  - Atlantic
  - continental subtropics
- record 1-step, 6-step, and 24-step causal slices around:
  - import arrival
  - first failed erosion
  - first large-scale maintenance rebound
- let replay mode disable exactly one module at a time after the checkpoint

Artifacts:
- `corridor-replay-catalog.json`
- `corridor-step-slice-attribution.json`
- `corridor-module-toggle-deltas.json`

Exit criteria:
- one or two concrete module handoffs are shown to create the persistent cloud/rain problem in replay

Phase C result:
- completed on `2026-04-11`
- targeted verification artifacts:
  - `/tmp/phaseC-targeted-corridor-replay-catalog.json`
  - `/tmp/phaseC-targeted-corridor-step-slice-attribution.json`
  - `/tmp/phaseC-targeted-corridor-module-toggle-deltas.json`
- selected corridor targets:
  - `eastPacific / midTroposphere / cell 390`
  - `atlantic / midTroposphere / cell 453`
  - `continentalSubtropics / midTroposphere / cell 371`
- strongest replay result:
  - disabling `stepVertical5` is the best 24-step replay toggle for `importArrival`, `failedErosion`, and `largeScaleMaintenanceRebound` in all three sectors
  - representative 24-step target-cell cloud-path deltas:
    - east Pacific: `-1.90467`, `-2.30613`, `-2.24894`
    - Atlantic: `-3.32867` across all three replay checkpoints
    - continental subtropics: `-1.11928` across all three replay checkpoints
- current diagnosis:
  - the first causal break and the strongest short-window lever both sit inside `stepVertical5`
  - downstream maintenance is still visible, especially via local condensation support, but it does not beat the vertical replay toggle as the dominant short-window intervention
  - `stepAdvection5`, `stepMicrophysics5`, and `stepRadiation2D5` do not emerge as the best 24-step replay toggle in the current corridor set

## Phase D: Coupled Counterfactual Matrix

Objective:
- replace one-pathway ablations with a small matrix of physically coherent coupled interventions

Why:
- Phase 11 proved isolated ablations are insufficient
- the next proof step is to test whether the **chain** behaves causally when perturbed as a chain

Allowed coupled sets:
- import + erosion
- erosion + saturation-adjustment maintenance
- import + erosion + saturation-adjustment maintenance
- erosion + radiative maintenance
- import + erosion + radiative maintenance
- maintenance + radiative support

Rules:
- no random combination explosion
- only combinations justified by the closure report
- each bundle must be tested on:
  - quick baseline
  - at least one `dt` sensitivity variant
  - at least one grid sensitivity variant

Artifacts:
- `coupled-counterfactual-matrix.json`
- `coupled-counterfactual-ranking.json`
- `coupled-counterfactual-guardrails.json`

Exit criteria:
- at least one coupled pathway bundle produces:
  - positive dry-belt directional improvement
  - preserved ITCZ/trades/westerlies
  - tolerable sensitivity behavior

Phase D result:
- completed on `2026-04-11`
- targeted verification artifacts:
  - `/tmp/phaseD-targeted-coupled-counterfactual-matrix.json`
  - `/tmp/phaseD-targeted-coupled-counterfactual-ranking.json`
  - `/tmp/phaseD-targeted-coupled-counterfactual-guardrails.json`
- verification scope:
  - all six coupled bundles screened at the 30-day quick baseline
  - the top three baseline bundles rerun on `dt_half` and `grid_coarse`
- selected sensitivity leaders:
  - `import_erosion_saturation_adjustment`
  - `import_plus_erosion`
  - `import_erosion_radiative_maintenance`
- strongest bundle:
  - `import_erosion_saturation_adjustment`
  - `dryRatioImprovement = 0.161`
  - `directionalImprovementScore = -0.09711`
  - `exitCriteriaPass = false`
- key failure mode:
  - every screened bundle preserved south subsidence plus trades/westerlies, but all of them failed the `itczWidthPass` guardrail
  - the leading coupled bundle also lost attribution stability under both `dt_half` and `grid_coarse`
- current diagnosis after Phase D:
  - a coupled vertical-path intervention can move the north dry-belt ratio in the right direction
  - but the present bundle family still “fixes” the dry belt by re-broadening the ITCZ and changing the causal story too much
- that is enough to move into a stricter pre-patch proof ladder, but not enough to justify a production physics patch yet

## Phase E0: Minimal Failing Corridor Experiment

Objective:
- freeze one trusted historical baseline and one current drifting baseline, then prove exactly where they diverge inside the shortest representative NH dry-belt corridor replay

Why this phase exists:
- the original Phase E was too eager; Phase D proved we still do not have patch-ready proof
- before naming any edit location, we need a tiny reproducible failing experiment that a research team could inspect step by step

Required structure:
- one sector corridor
- one latitude band
- one target cell
- one short replay window
- one saved checkpoint
- one historical baseline commit
- one current branch baseline

Primary harness:
- [minimal-failing-corridor.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/minimal-failing-corridor.mjs)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

Required outputs:
- `phase-e0-minimal-corridor.json`
- `phase-e0-minimal-corridor.md`

Exit criteria:
- the historical and current baselines are both frozen explicitly
- the first material divergence step is identified inside the replay window
- the dominant post-vertical divergence fields are ranked for the target cell
- the corridor is small enough to reuse directly in E1 and E2

Phase E0 result:
- completed on `2026-04-12`
- verification artifacts:
  - [phase-e0-minimal-corridor.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase-e0-minimal-corridor.json)
  - [phase-e0-minimal-corridor.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase-e0-minimal-corridor.md)
- frozen corridor:
  - `eastPacific / 22-35°N / cell 390 / lat 26.25 / lon -131.25`
  - `checkpointDay = 29.75`
  - `windowSteps = 12`
- frozen baselines under the E0 harness:
  - historical `e6fea58`: `subtropicalDryNorthRatio = 1.352`, `itczWidthDeg = 23.723`
  - current `246c99a`: `subtropicalDryNorthRatio = 1.698`, `itczWidthDeg = 27.197`
- dominant replay finding:
  - the first material divergence occurs immediately at `stepOffset = 0`
  - the peak divergence is also `stepOffset = 0`
  - leading target-cell post-vertical deltas at that first step:
    - `upperCloudPathKgM2 = +3.51914`
    - `largeScaleCondensationSourceKgM2 = +1.77152`
    - `precipRateMmHr = +1.4008`
- across the full 12-step replay window, the divergence repeatedly stays dominated by:
  - `upperCloudPathKgM2`
  - `largeScaleCondensationSourceKgM2`
  - `precipRateMmHr`
- current diagnosis after E0:
  - the historical/current split is already present in the very first replayed vertical handoff
  - we do not need another broad search to find where the failure begins
  - E1 should budget-close the vertical handoff specifically around imported cloud carryover, large-scale condensation birth, and what is handed into microphysics

## Phase E1: Budget-Closed Vertical Handoff Proof

Objective:
- make the selected corridor fully budget-closed across the vertical handoff so we can prove the exact failing channel instead of just ranking deltas

Required deliverables:
- strict ledger for:
  - cloud in
  - cloud born
  - cloud carried
  - cloud eroded
  - cloud handed to microphysics
  - cloud left over
- zero or near-zero residual at the selected corridor scale

Expected outputs:
- `vertical-handoff-proof.json`
- `vertical-handoff-proof.md`

Exit criteria:
- at least 95% of target-cell and corridor-band cloud change is ledger-closed
- the first failing channel inside `stepVertical5` is named
- the result survives the same minimal replay under at least one dt and one grid sensitivity variant

Phase E1 result:
- completed on `2026-04-12`
- verification artifacts:
  - [vertical-handoff-proof.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/vertical-handoff-proof.json)
  - [vertical-handoff-proof.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/vertical-handoff-proof.md)
- closure result:
  - current target-cell combined closure stays between `0.99033` and `0.99536`
  - historical target-cell combined closure stays at `1.0`
  - sensitivity variants also stay above the closure bar:
    - `dt_half`: min target closure `0.99523`, min corridor closure `0.99446`
    - `grid_coarse`: min target closure `1.0`, min corridor closure `0.97744`
- dominant baseline-pair finding:
  - the largest vertical delta is **not** in-step cloud birth or erosion
  - it is `inputMassKgM2`, immediately at `stepOffset = 0`
  - the same is true for the paired microphysics handoff on the first step
- first-step target-cell ledger:
  - current vertical handoff:
    - `inputMassKgM2 = 3.51914`
    - `resolvedBirthMassKgM2 = 0.06594`
    - `convectiveBirthMassKgM2 = 0`
    - `handedToMicrophysicsMassKgM2 = 3.51914`
    - `residualMassKgM2 = 0.06594`
  - historical vertical handoff:
    - all terms effectively `0`
  - current microphysics handoff:
    - `inputMassKgM2 = 3.51912`
    - `cloudReevaporationMassKgM2 = 0.20322`
    - `sedimentationExportMassKgM2 = 0.20415`
    - `outputMassKgM2 = 3.09801`
    - `residualMassKgM2 = 0`
- current diagnosis after E1:
  - the selected corridor is now budget-closed well enough for proof work
  - the dominant failure is **preexisting upper cloud already present at vertical entry**
  - `stepVertical5` is not primarily creating the bad corridor cloud in-step; it is handing forward cloud that is already there
  - the main unresolved question for E2 is therefore upstream of the in-step birth logic:
    - where that cloud is being supplied or retained before it reaches the vertical handoff
    - and which exact module/function owns that supply-retention path

## Phase E2: Patch-Placement Proof

Objective:
- only after E0 and E1 close, turn the proven pre-handoff failure chain into an exact “where the fix goes” design before editing physics defaults

Required deliverables:
- exact file/function ownership
- expected before/after transition changes in the E1 ledger
- expected before/after top-level climate metrics
- explicit non-goals so we do not accidentally “fix” the dry belt by breaking the tropics

Expected outputs:
- `patch-placement-proof.md`
- `patch-placement-proof.json`

That proof must answer:
1. Which function first supplies or preserves the excess upper cloud before it reaches `stepVertical5`?
2. Which downstream function turns that incoming excess into persistent local maintenance?
3. Which reinforcement path is secondary but must be co-edited so the first fix actually sticks?
4. Which metrics must improve in 30-day and remain acceptable in 90-day?

Exit criteria:
- one exact coordinated edit set is named
- every edit in that set has a causal justification from E0 and E1, not just earlier broad phases

## Phase F: Patch Gate And Verification Ladder

Objective:
- only after proof, implement the first coupled patch and verify it rigorously

Required ladder:
1. quick 30-day proof run
2. seasonal 90-day follow-through
3. annual 365-day confirmation only if the first two survive
4. live/browser signoff after headless proof, not before

Required acceptance:
- north dry-belt ratio materially improved
- ITCZ width not re-broadened
- south subtropical subsidence not regressed
- trades and westerlies preserved
- coupled-chain transition ledger reflects the intended mechanism change

## What this new campaign is designed to prove

If executed thoroughly, this campaign should tell us:
- whether the current branch is still measuring the same climate problem as the trusted Phase 1 baseline
- the exact module handoff where imported cloud becomes persistent problem cloud
- whether the fix belongs first in:
  - [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
  - [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
  - [radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js)
  - or an exact coordinated subset of them
- and how to prove the first coupled patch worked for the right reason instead of by accident

## Most important rule

Do **not** write another physics patch until:
- Phase A reconciles the baseline
- Phase B or C identifies the first failing handoff
- Phase D shows a coupled pathway bundle that actually behaves causally

That is how we stop guessing and start proving.
