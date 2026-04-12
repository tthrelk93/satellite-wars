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

## Phase E: Patch-Placement Proof

Objective:
- turn the winning coupled bundle into an exact “where the fix goes” design before editing physics defaults

Required deliverables:
- exact file/function ownership
- expected before/after transition changes in the cloud-transition ledger
- expected before/after top-level climate metrics
- explicit non-goals so we do not accidentally “fix” the dry belt by breaking the tropics

Expected outputs:
- `patch-placement-proof.md`
- `patch-placement-proof.json`

That proof must answer:
1. Which function first fails to clear imported cloud?
2. Which downstream function turns that failure into persistent local maintenance?
3. Which reinforcement path is secondary but must be co-edited so the first fix actually sticks?
4. Which metrics must improve in 30-day and remain acceptable in 90-day?

Exit criteria:
- one exact coordinated edit set is named
- every edit in that set has a causal justification from prior phases

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
