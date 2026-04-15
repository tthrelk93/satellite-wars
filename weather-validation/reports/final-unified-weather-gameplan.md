# Final Unified Weather Gameplan

This is the current master roadmap for the project.

It replaces the scattered older phase lists by answering four questions clearly:
- what the original mission still is
- which earlier campaigns are complete versus superseded
- where we actually stand right now
- what phases are still left before the model is both Earth-like and shippable

## Mission

Build a world climate and weather model that is:
- as Earth-like as we can reasonably make it
- stable over long horizons
- convincing in the shipped game runtime
- strong enough to support believable seasonality, storms, and cyclone environments

## Where We Actually Stand Now

### Original climate roadmap status

The original climate direction was correct:
- fix tropical-to-subtropical moisture transport first
- reduce dependence on nudging as hidden climate structure
- make convection and microphysics more structural and less thresholdy
- only then push storm/cyclone seasonality

That original roadmap was **not abandoned**.

What changed is that we discovered one stubborn blocker was preventing clean progress:
- the **north subtropical dry belt stays too wet**

That blocker turned out to require a long proof campaign before we could patch it responsibly.

### Current active blocker

The current dominant blocker is still:
- **north subtropical dry-belt wet bias**

The current proven ownership story is:
- the stable corridor-scale owner is `previousStepResidualUpperCloud`
- the stable first material break is `endPreviousStepMicrophysics5`
- current-step advection is secondary amplification, not the primary owner
- after numerical repair, this ownership story is stable across all normalized variants

This means we are no longer trying to guess whether the blocker is:
- nudging
- local convection
- pure advection creation
- storm spillover
- or a browser/runtime issue

We have narrowed it much further than that.

### What is complete already

These campaigns are materially complete and should be treated as finished proof work, not active open loops:

1. `Original broad Hadley/moisture partitioning baseline work`
- broad Phase 1 work materially improved the climate baseline
- the kept quick baseline is still valuable
- but it did not fully eliminate the north dry-belt miss

2. `Continuous convection / structural closure refactor`
- continuous convective state, organization, mass-flux-style logic, and related diagnostics were added
- this work is now part of the living model baseline, not a future todo list

3. `12-phase upstream instrumentation campaign`
- completed far enough to rule out many wrong families
- it did not directly yield a patch, but it successfully collapsed the search space

4. `Coupled-fix proof campaign Phases A-D`
- completed
- showed we were not patch-ready yet
- original `Phase E/F` from that campaign should be treated as **superseded**

5. `Pre-vertical upstream proof plan U0-U5`
- completed
- including the later numerical repair and normalized rerun
- the raw U5 artifact is still sparse at single-cell level in one grid variant, but the normalized ownership result now closes

### What was superseded

These plans were useful but should not be treated as the current active phase list anymore:

1. `Original 12-phase plan as a strict linear sequence`
- useful historically
- now superseded by the proof outcome

2. `Coupled-fix campaign original Phase E / Phase F`
- these assumed we were already patch-ready
- that was premature
- they were replaced by the stricter pre-vertical proof ladder

3. `Standalone local north dry-belt cleanup`
- attempted and rejected
- no longer the active lane

## Current Position

We are here:

### Active phase now

`Phase 1: Close exact upstream patch placement for the north dry-belt bug`

More precisely:
- all upstream proof through U5 is complete
- the numerical harness has been repaired
- the ownership story is now stable after normalization
- U6 is now complete
- the next live step is **Phase 1B: implement the first minimal corrective patch**

This means the last proof phase is behind us, and we can move into the first evidence-backed physics patch.

### Current proven facts we should build on

1. The north dry-belt bug is **real**, not a logging illusion.
2. It is **not** primarily caused by:
- local subtropical convection
- nudging
- helper forcing
- storm leakage
- a pure advection-only pathway
3. It **is** centered on a pre-vertical upper-cloud reservoir problem.
4. The most stable owner is:
- `previousStepResidualUpperCloud`
5. The stable first break is:
- `endPreviousStepMicrophysics5`
6. The first corrective patch now has a proven placement:
- primary owner: `stepVertical5`
- secondary downstream support: `stepMicrophysics5`
7. The dominant proved failure mode is:
- retained previous-step carryover surviving the vertical handoff with effectively zero applied erosion
8. Transport still matters, but mainly as amplification.
9. Full-globe complexity is not required to reproduce the mechanism.
10. The earlier `dt_half` instability was heavily contaminated by a harness bug and has now been repaired.

## Final Unified Phase Plan

### Phase 1: Finish Root-Cause Proof And Land The First Corrective Patch

This is the current active phase family.

#### Phase 1A: U6 Upstream Patch-Placement Proof

Objective:
- prove exactly which upstream function or exact coupled handoff owns the retained pre-vertical reservoir

Primary files most likely to matter:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- possibly one secondary support location in [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) or [radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js)

What must be produced:
- exact owning function
- optional secondary co-owner
- predicted before/after ledger signature
- explicit falsification rule

Exit criteria:
- one patch placement proof document
- one predicted signature in:
  - pre-vertical ledger
  - provenance ownership
  - reduced-order replay
  - normalized numerical rerun

Status:
- complete

Outcome:
- patch location proved in [prevertical-patch-placement-proof.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/prevertical-patch-placement-proof.md)
- first owner: [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) `stepVertical5`
- downstream support only: [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) `stepMicrophysics5`
- proved signature:
  - previous-step residual carryover must fall first
  - current-step advection must stay secondary
  - the patch is wrong if it mainly changes downstream cleanup without reducing the post-vertical carryover handoff

#### Phase 1B: Implement The First Minimal Corrective Patch

Objective:
- apply the smallest patch that matches the Phase 1A proof

Rules:
- no broad retuning
- no “dry the dry belt” patch language
- patch must target the proven ownership handoff

Exit criteria:
- proof harness improves in the predicted direction
- no contradiction against the Phase 1A predicted signature

Current status:
- the first two live Phase 1B implementations were rejected
- the new propagation proof in [phase1b-propagation-proof.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1b-propagation-proof.md) shows why:
  - a true current-step carryover-clear correction *does* survive to the next replay boundary
  - the failed patch did **not** fail because the signal was immediately rebuilt by same-step microphysics
  - it failed because the implementation never actually realized the intended owner reduction in the live replay chain

What that means:
- the next subphase is no longer “prove propagation”
- the next subphase is **implementation-alignment proof**
- we now need to make the real [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) patch reproduce the synthetic propagation-proof signature at the exact frozen boundary

Status:
- implementation-alignment proof is now complete in [phase1b-implementation-alignment-proof.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1b-implementation-alignment-proof.md)
- the live patch must reproduce this frozen target-cell signature:
  - `verticalUpperCloudCarrySurvivingMassKgM2: 4.56883 -> 0.06879`
  - `verticalUpperCloudHandedToMicrophysicsMassKgM2: 4.56883 -> 0.06879`
  - `verticalUpperCloudAppliedErosionMassKgM2: 0 -> 4.56883`
  - `upperCloudPathKgM2: 4.63762 -> 0.06879`
- while keeping these essentially stable:
  - `verticalUpperCloudInputMassKgM2`
  - `verticalUpperCloudResolvedBirthMassKgM2`
  - `verticalUpperCloudConvectiveBirthMassKgM2`
  - `lowLevelOmegaEffectiveDiagPaS`
  - `lowLevelMoistureConvergenceDiagS_1`
  - weak-engine convective support terms

Next subphase:
- **Phase 1B.3: alignment-constrained vertical patch**
- the patch must fire on the fresh-state corridor envelope proved in the alignment report, not on stale persistent proxies

Status update:
- the first alignment-constrained live patch attempt was rejected
- the follow-up reconciliation phase is now complete in [phase1b-live-replay-reconciliation.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1b-live-replay-reconciliation.md)
- that reconciliation proved:
  - the old support-family trigger shape is still broadly right
  - the old mass contract is stale
  - the exact live handoff no longer exposes the retained reservoir through `carriedOverUpperCloudMassKgM2`
  - at the real live handoff the key state is:
    - `verticalUpperCloudInputMassKgM2 = 4.56883`
    - `verticalUpperCloudCarrySurvivingMassKgM2 = 4.56883`
    - `verticalUpperCloudHandedToMicrophysicsMassKgM2 = 4.56883`
    - `carriedOverUpperCloudMassKgM2 = 0`
  - so the next patch must key off **carry-surviving-to-input dominance**, not post-handoff `carriedOverUpperCloudMass` dominance

Current next subphase:
- **Phase 1B.4: live-state-aligned vertical patch**
- use the patch design in [phase1b-live-replay-patch-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1b-live-replay-patch-design.md)
- required live trigger family:
  - `freshSubtropicalSuppression >= 0.74243`
  - `freshOrganizedSupport <= 0.22504`
  - `freshPotentialTarget <= 0.24341`
  - `verticalCarryInputDominance >= 0.95`
  - `previousStepResidualUpperCloudMinKgM2 >= 4.40574`
- explicit anti-pattern:
  - do not key the next patch primarily off post-handoff `carriedOverUpperCloudMassKgM2`

Status update:
- the live-state-aligned patch is now implemented in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- the exact live handoff improves materially:
  - `verticalUpperCloudCarrySurvivingMassKgM2: 4.56883 -> 2.34753`
  - `verticalUpperCloudHandedToMicrophysicsMassKgM2: 4.56883 -> 2.39787`
- the new next-boundary proof is complete in [phase1b-next-boundary-ownership-proof.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1b-next-boundary-ownership-proof.md)
- that proof shows the reduced handoff survives to the next owned boundary:
  - target next-boundary owned reservoir: `4.30116 -> 2.19312`
  - corridor next-boundary owned reservoir reduction: `3.39527 kg/m²`
  - target reduction survival fraction: `0.94901`

Next subphase:
- **Phase 1C: re-run the remaining proof stack on the kept patch, then move into the climate gate**

#### Phase 1C: Re-verify The Proof Stack After The Patch

Required reruns:
- pre-vertical boundary ledger
- provenance ownership
- reduced-order experiment
- normalized numerical ownership

Exit criteria:
- the same corridor no longer shows the same owned excess reservoir
- no new owner replaces it immediately

Status:
- mostly complete
- the proof reruns remain supportive:
  - owned target-cell mass at `endPreviousStepMicrophysics5` falls materially
  - the stable owner remains `previousStepResidualUpperCloud`
  - normalized numerical ownership still passes
- but the reduced-order story is less clean than before and now leans toward `requires-full-globe`

#### Phase 1D: Climate Gate On The Patched Physics

Run:
- 30-day quick planetary audit

Goal:
- prove the upstream patch helps the actual climate blocker, not only the corridor proof

Required metrics:
- `subtropicalDryNorthRatio`
- `itczWidthDeg`
- `subtropicalSubsidenceNorthMean`
- `subtropicalSubsidenceSouthMean`
- trades and westerlies

Exit criteria:
- better than the current kept dry-belt baseline
- no major ITCZ/trades/westerlies regression

Status:
- failed on the current kept `stepVertical5` patch
- see [phase1c-proof-vs-climate-mismatch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1c-proof-vs-climate-mismatch.md)
- key result:
  - the upstream owned reservoir improves in proof space
  - the 30-day climate degrades sharply in full-run space
  - this patch family is not climate-viable by simple narrowing or softening

### Phase 1E: Proof-vs-Climate Delta Attribution

Objective:
- explain the compensation path that turns a local reservoir win into a worse 30-day climate

Primary files:
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)

Required outputs:
- baseline-vs-patched 30-day delta report
- latitude-band cloud and precipitation response comparison
- compensation ranking across:
  - large-scale condensation
  - imported anvil persistence
  - weak-erosion cloud survival
  - radiative maintenance
  - circulation and wind response

Exit criteria:
- one dominant rebound/compensation pathway is identified
- the next physics patch targets that pathway instead of further tuning the carry-input override

Status:
- complete
- see [phase1e-proof-vs-climate-delta-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1e-proof-vs-climate-delta-attribution.md)
- important outcome:
  - an apples-to-apples `patch off` vs `patch on` compare on the same instrumented branch does **not** show the live override as the main cause of the degraded 30-day climate
  - `patch on` is slightly better than `patch off`, but both remain far worse than the older kept Phase 1 baseline
  - the dominant residual compensation path is best described as a coupled:
    - large-scale condensation maintenance
    - humidification / precipitation rebound
  - imported-anvil persistence and weak-erosion survival drop in the `patch on` state, so they are no longer the first physics lever to attack on the live branch

### Phase 1F: Maintenance-Loop Patch Design

Objective:
- design the next physics intervention against the residual coupled maintenance loop proved in Phase 1E

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js)

Required proof questions:
- where does the added `northDryBeltLargeScaleCondensationMeanKgM2` come from after the pre-vertical reservoir is reduced?
- what boundary-layer or mid-tropospheric humidification path keeps feeding that maintenance loop?
- how much of the remaining wet bias is local maintenance versus large-scale circulation structure already present in the current branch?

Exit criteria:
- one precise patch target against the maintenance loop
- predicted signature in:
  - large-scale condensation
  - boundary-layer / mid-tropospheric RH
  - ITCZ width
  - dry-belt ratios
  - westerly guardrails

Status:
- complete
- see [phase1f-maintenance-loop-patch-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1f-maintenance-loop-patch-design.md)
- exact design outcome:
  - primary patch target: [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) saturation-adjustment condensation branch
  - primary live region: [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js):313
  - secondary support only: [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js):1478
  - patch concept:
    - regime-selective saturation-adjustment maintenance suppression
    - target weak-engine, subtropically suppressed, marine-maintained columns
    - do not globally suppress condensation
- proof result:
  - ocean-side NH dry-belt large-scale condensation rises `0.18314 -> 0.19722`
  - imported carryover, weak-erosion survival, and radiative support all move down
  - surface ocean evaporation is effectively unchanged
  - so the next patch should attack local marine maintenance, not imported-cloud retention again

### Phase 1G: Implement Regime-Selective Saturation-Adjustment Maintenance Patch

Objective:
- reduce local subtropical marine maintenance cloud birth without damaging organized or strong-ascent tropical condensation

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

Implementation rule:
- patch the `qvVal > qsat` saturation-adjustment path with regime-selective suppression based on existing weak-engine / subtropical terms
- do not start by retuning radiation, transport, or the carry-input override

Outcome:
- rejected as inert in the live 30-day climate
- same-branch `patch off` versus `patch on` compares were effectively identical
- the supposed weak-engine marine-maintenance candidate regime did not occur in the real quick audit

See:
- [phase1g-maintenance-delta-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1g-maintenance-delta-attribution.md)
- [phase1h-maintenance-regime-coverage.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1h-maintenance-regime-coverage.md)

### Phase 1H: Maintenance Regime Coverage

Objective:
- prove whether the rejected Phase 1G regime actually owns any meaningful share of the live 30-day climate drift

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Result:
- candidate occupancy is effectively zero in the live 30-day run
- ocean-side NH dry-belt marine saturation-adjustment condensation is still present
- weak-engine support is already nearly maximal
- the main missing live support term is subtropical suppression, with weak ascent as a secondary limiter

Key metrics:
- `northDryBeltOceanMarineCondensationMeanKgM2 = 0.19722`
- `northDryBeltOceanMarineSubtropicalSupportMeanFrac = 0.0374`
- `northDryBeltOceanMarineWeakEngineSupportMeanFrac = 0.99953`
- `northDryBeltOceanMarineWeakAscentSupportMeanFrac = 0.18488`
- `northDryBeltOceanMarineMarginalSupersaturationSupportMeanFrac = 0.88424`

Conclusion:
- the old Phase 1G regime targeted the wrong live lever
- the next phase should redesign the subtropical-suppression gate itself, not keep tuning an inert maintenance suppressor

### Phase 1I: Subtropical-Suppression Gate Redesign

Objective:
- explain why live ocean-side NH dry-belt saturation-adjustment events have almost no subtropical-suppression support
- determine whether suppression is being diagnosed from the wrong state, at the wrong time, or with the wrong magnitude
- redesign the live maintenance-loop gate from that evidence

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Result:
- the live ocean-side NH dry-belt marine condensation path does carry a strong fresh vertical-state subtropical signal
- the legacy microphysics proxy collapses that signal because it infers suppression through downstream `marginalSubsiding`
- fresh vertical-state suppression is strong while legacy subtropical support stays near zero:
  - `northDryBeltOceanMarineFreshSubtropicalSuppressionMeanFrac = 0.68321`
  - `northDryBeltOceanMarineSubtropicalSupportMeanFrac = 0.0374`
- the first redesign fixed the wrong-state problem but still had near-zero live occupancy because weak ascent remained too hard a multiplicative limiter

See:
- [phase1i-subtropical-suppression-gate-redesign.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1i-subtropical-suppression-gate-redesign.md)

Conclusion:
- the next patch family should key off fresh vertical-state suppression, not the old downstream suppression proxy
- weak ascent should become a softer modulation term rather than a hard occupancy gate

### Phase 1J: Soft-Ascent Live-State Gate Design

Objective:
- redesign the maintenance-loop gate so it is active in the real 30-day branch state without becoming a broad global suppressor

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Result:
- succeeded
- the soft live-state gate is active on the real 30-day branch state while the strict Phase 1I gate is nearly inert
- day-30 NH dry-belt ocean comparison:
  - strict gate candidate mass `0.00065`
  - soft gate candidate mass `0.18498`
  - strict gate potential suppressed mass `0.00007`
  - soft gate potential suppressed mass `0.02092`
  - soft gate hit mean `3.36967`

See:
- [phase1j-soft-ascent-live-state-gate-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1j-soft-ascent-live-state-gate-design.md)

Conclusion:
- we now have a live-run-active gate family for the marine maintenance loop
- the next phase should finally apply physics inside that gate instead of continuing gate-discovery work

### Phase 1K: Implement Soft Live-State Maintenance Suppression Patch

Objective:
- apply a narrow maintenance-suppression physics patch inside the successful Phase 1J soft live-state gate

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Exit criteria:
- same-branch `patch off` versus `patch on` shows a real reduction in NH dry-belt ocean large-scale condensation
- the patch acts through the soft live-state gate rather than broad global damping
- if the same-branch compare is promising, rerun the 30-day climate gate before returning to the original roadmap

Result:
- succeeded as a live-lever patch and is now kept on the branch
- same-branch day-30 `patch on` versus `patch off` improved:
  - `itczWidthDeg`: `26.415 -> 25.874`
  - `subtropicalDryNorthRatio`: `1.704 -> 1.524`
  - `subtropicalDrySouthRatio`: `1.296 -> 1.194`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.19722 -> 0.15260`
- the patch records real live suppression:
  - `northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2 = 0.04238`
- midlatitude westerlies stayed effectively neutral in the same-branch compare

Conclusion:
- Phase 1K proved this soft live-state maintenance lane is a real climate lever
- but the kept `patch on` state is still worse than the trusted old Phase 1 baseline, so we are not ready to return to the original climate roadmap yet

See:
- [phase1k-soft-live-state-maintenance-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1k-soft-live-state-maintenance-patch.md)

### Phase 1L: Residual Branch-Versus-Baseline Attribution

Objective:
- explain what still keeps the current kept Phase 1K branch worse than the trusted old Phase 1 baseline after the marine maintenance loop is partially suppressed

Primary files:
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

Exit criteria:
- rank the remaining branch-versus-baseline compensation paths after Phase 1K
- prove whether the next blocker is still marine maintenance, a broadened tropical response, or a circulation-side rebound
- choose the next narrow patch lane from that ranked residual, not from the pre-Phase-1K story

Result:
- succeeded
- dominant residual family: `circulation_side_rebound` with score `0.31725`
- second residual family: `broadened_tropical_response` with score `0.24192`
- marine maintenance residual now ranks well behind them at `0.11325`
- the kept Phase 1K patch is still clearly live:
  - `northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2 = 0.04238`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.15260`
- but the trusted-baseline gap is now led by circulation / transition structure:
  - `midlatitudeWesterliesNorthU10Ms`: `1.192 -> 0.531`
  - `itczWidthDeg`: `23.646 -> 25.874`
  - `subtropicalDryNorthRatio`: `1.100 -> 1.524`
  - `subtropicalDrySouthRatio`: `0.519 -> 1.194`

Conclusion:
- Phase 1K successfully moved the local marine-maintenance lever, but that is no longer the dominant blocker
- the next patch lane should start with circulation rebound, while keeping broadened tropical response coupled into the design and verification loop

See:
- [phase1l-residual-branch-vs-baseline-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1l-residual-branch-vs-baseline-attribution.md)

### Phase 1M: Circulation Rebound Lane

Objective:
- reduce the residual circulation-side rebound against the trusted baseline without undoing the kept Phase 1K marine-maintenance gain

Primary files:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) as a support lane only if the circulation patch changes live gate occupancy

Exit criteria:
- improve `midlatitudeWesterliesNorthU10Ms` and `itczWidthDeg` against the kept Phase 1K branch
- do not lose the Phase 1K marine-maintenance win in `northDryBeltOceanLargeScaleCondensationMeanKgM2`
- keep the next design focused on circulation / transition partition, not another isolated local dry-belt suppressor

Result:
- keep the Phase 1M patch as a supportive win, but do not count the circulation lane as closed
- same-branch `off -> on` at day 30:
  - `itczWidthDeg`: `25.874 -> 25.834`
  - `subtropicalDryNorthRatio`: `1.524 -> 1.515`
  - `subtropicalDrySouthRatio`: `1.194 -> 1.192`
  - `midlatitudeWesterliesNorthU10Ms`: `0.531 -> 0.531`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.1526 -> 0.14647`
- read: off-equatorial transition leakage is now a proved secondary lever, but NH westerly recovery is still the unresolved blocker

See:
- [phase1m-circulation-rebound-lane.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1m-circulation-rebound-lane.md)

### Phase 1N: Return-Flow Rebound Attribution

Objective:
- explain why the kept transition-lane suppression improves width and dry-belt ratios a bit but still does not restore NH westerlies

Primary files:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

Exit criteria:
- identify the remaining return-flow / jet-response mismatch that stays after Phase 1M
- produce a narrower circulation-facing patch design instead of more transition-occupancy tuning

Result:
- complete
- see [phase1n-return-flow-rebound-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1n-return-flow-rebound-attribution.md)
- verdict: `transition_lane_only_response`
- same-branch Phase 1M `off -> on` still improves the transition-side climate metrics:
  - `itczWidthDeg`: `25.874 -> 25.834`
  - `subtropicalDryNorthRatio`: `1.524 -> 1.515`
  - `subtropicalDrySouthRatio`: `1.194 -> 1.192`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.1526 -> 0.14647`
- but NH jet / return-flow response remains flat:
  - `midlatitudeWesterliesNorthU10Ms`: `0.531 -> 0.531`
- the new return-flow diagnostics show why:
  - transition containment is strongly live: north/south `0.81272 / 0.70617`
  - transition source suppression is also live: north/south `0.612 / 0.51949`
  - but the subtropical return-flow source driver stays weak:
    - north/south transition driver `0.16716 / 0.07608`
  - cross-hemi floor dominance is not the leading failure:
    - north/south cross-hemi floor share `0 / 0.12935`

Conclusion:
- the Phase 1M lane is real, but it is only a transition-containment response
- the remaining blocker is not primarily a cross-hemisphere floor bug or a local-source underweighting bug
- the next patch family should couple the already-live transition suppression to a stronger return-flow / jet response instead of retuning occupancy alone

### Phase 1O: Coupled Transition-To-Return-Flow Patch Design

Objective:
- turn the kept Phase 1M transition containment win into a real circulation recovery by explicitly coupling transition suppression to the return-flow / jet-response lane

Primary files:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Design rule:
- do not treat this as another source-partition cleanup
- do not fall back to more transition-occupancy-only suppression
- use the Phase 1M containment lane as the entry condition, then design a coupled return-flow response that can move NH westerlies and not just local width/dry-belt metrics

Exit criteria:
- same-branch `patch off` versus `patch on` moves `midlatitudeWesterliesNorthU10Ms` upward while preserving the kept Phase 1K and Phase 1M wins
- no material rebound in:
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2`
  - `itczWidthDeg`
  - `subtropicalDryNorthRatio`
  - `subtropicalDrySouthRatio`

Result:
- complete
- see [phase1o-coupled-transition-to-return-flow-patch-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1o-coupled-transition-to-return-flow-patch-design.md)
- verdict: `missing_transition_to_return_flow_coupling`
- the added diagnostics show:
  - transition containment is strong and live
  - the same-hemisphere transition-suppressed source is real but low-amplitude
  - the resulting dry-belt return-flow opportunity is also narrow, not broad
  - NH westerlies still stay flat even while width/dry-belt metrics improve a bit
- important day-30 read:
  - `northTransitionCirculationReboundContainmentMeanFrac = 0.81272`
  - `northTransitionCirculationReboundSuppressedSourceMeanFrac = 0.00133`
  - `northDryBeltCirculationReturnFlowOpportunityMeanFrac = 0.00084`
  - `midlatitudeWesterliesNorthU10Ms = 0.531 -> 0.531`

Conclusion:
- the next patch should exist, but it must be a **capped** coupling patch
- Phase 1M is not missing because containment is dead; it is missing because the removed transition source currently behaves like a sink instead of a return-flow reinforcement
- the absolute opportunity is small enough that the next lane should be implemented as a guardrail-first incremental patch, not a broad circulation retune

### Phase 1P: Implement Capped Transition-To-Return-Flow Coupling Patch

Objective:
- convert a bounded share of same-hemisphere transition-suppressed convective source into subtropical return-flow reinforcement so NH westerlies can recover without giving back the kept Phase 1K and Phase 1M wins

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js) and [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js) for verification support

Design rules:
- use the existing transition containment lane as the selector
- reinject only a capped same-hemisphere share of suppressed transition source
- couple into subtropical source driver and/or descent support, not cross-hemisphere floor borrowing
- preserve the kept marine-maintenance patch as a guardrail lane

Exit criteria:
- same-branch `patch off` versus `patch on` improves `midlatitudeWesterliesNorthU10Ms` by at least `0.08 m/s`
- preserves or improves:
  - `itczWidthDeg`
  - `subtropicalDryNorthRatio`
  - `subtropicalDrySouthRatio`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2`

Result:
- complete and rejected as a default-on fix
- see [phase1p-capped-transition-to-return-flow-coupling.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1p-capped-transition-to-return-flow-coupling.md)
- the new capped same-hemisphere reinjection lane is measurably active:
  - `northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac = 0 -> 0.00975`
- but it does not move the real circulation target:
  - `midlatitudeWesterliesNorthU10Ms = 0.531 -> 0.531`
  - `northDryBeltCirculationReturnFlowOpportunityMeanFrac = 0.00084 -> 0.00084`
- and the climate guardrails degrade:
  - `itczWidthDeg: 25.834 -> 26.055`
  - `subtropicalDryNorthRatio: 1.515 -> 1.572`
  - `subtropicalDrySouthRatio: 1.192 -> 1.203`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14647 -> 0.14768`

Conclusion:
- the missing circulation carrier is not solved by a small source-driver reinjection alone
- the patch lane was real enough to test, but it acted too far upstream of the actual jet / return-flow response
- keep the new diagnostics and runtime toggle, but leave the Phase 1P coupling disabled by default

### Phase 1Q: Return-Flow Carrier Attribution

Objective:
- prove which downstream circulation carrier is actually missing between:
  - transition-source suppression
  - subtropical drying / descent response
  - and NH midlatitude westerly recovery

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Design rule:
- do not make the next move a stronger Phase 1P reinjection
- use the new Phase 1P diagnostics to identify whether the missing link is:
  - source-driver to subtropical-drying conversion
  - subtropical drying to low-level omega response
  - or low-level omega response to jet recovery

Exit criteria:
- one dominant downstream carrier mismatch is identified
- the next circulation patch is placed at that carrier, not at the already-rejected source reinjection lane

Result:
- complete
- see [phase1q-return-flow-carrier-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1q-return-flow-carrier-attribution.md)
- the dominant downstream carrier mismatch is now:
  - `drying_to_omega_response_failure`
- same-branch `off -> on` compare says:
  - `northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac: 0 -> 0.00975`
  - `sourceDriverDeltaMeanFrac = 0.00111`
  - `dryingDeltaMeanFrac = 0.01437`
  - `omegaDeltaMeanPaS = -0.0003`
  - `midlatitudeWesterliesNorthDeltaMs = 0`

Conclusion:
- the current transition / source lane is strong enough to perturb subtropical drying
- that drying is not turning into a stronger low-level omega response
- the next patch lane should therefore move to the drying-to-omega bridge in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) and [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js), not back to source reinjection

### Phase 1R: Omega Response Patch Design

Objective:
- make the already-improved transition / drying lane produce a meaningful low-level omega response in the NH dry belt and transition zone

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

Design rule:
- treat this as a bridge patch, not a broader circulation retune
- preserve the kept Phase 1K marine-maintenance win and the kept Phase 1M transition-containment win
- do not reactivate the rejected Phase 1P reinjection lane as the primary lever

Exit criteria:
- same-branch `off -> on` compare materially improves `northTransitionLowLevelOmegaEffectiveMeanPaS` and `northDryBeltLowLevelOmegaEffectiveMeanPaS`
- `midlatitudeWesterliesNorthU10Ms` starts moving up without giving back the Phase 1K / 1M gains

Result:
- complete
- see [phase1r-omega-response-patch-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1r-omega-response-patch-design.md)
- the live carrier result from Phase 1Q now resolves to:
  - `same_step_drying_to_omega_bridge_missing`
- same-branch evidence says:
  - `sourceDriverDeltaMeanFrac = 0.00111`
  - `dryingDeltaMeanFrac = 0.01437`
  - `omegaDeltaMeanPaS = -0.0003`
  - `midlatitudeWesterliesNorthDeltaMs = 0`

Conclusion:
- the current lane can perturb subtropical drying, but it does not feed that drying back into `lowLevelOmegaEffective` strongly enough to matter
- the structural reason is in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js): omega is diagnosed earlier in the step, while the subtropical dry-driver loop only applies `qv/theta` tendencies later
- the next move should therefore be a small, guardrail-first bridge patch that converts a capped share of the proven dry-driver response into same-step subtropical omega reinforcement

### Phase 1S: Implement Capped Drying-To-Omega Bridge Patch

Objective:
- turn the already-improved subtropical drying response into a real low-level omega increase without re-opening the rejected source reinjection lane

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

Design rule:
- add a capped same-step omega bridge after `dryDriver` is diagnosed
- keep the bridge same-hemisphere, subtropical-band limited, and Pa/s-capped
- preserve the kept Phase 1K marine-maintenance and Phase 1M transition-containment wins

Exit criteria:
- same-branch `off -> on` compare improves `northTransitionLowLevelOmegaEffectiveMeanPaS` by about `0.01 Pa/s`
- same-branch `off -> on` compare improves `northDryBeltLowLevelOmegaEffectiveMeanPaS` by about `0.005 Pa/s`
- `midlatitudeWesterliesNorthU10Ms` starts moving upward without losing the Phase 1K / 1M guardrails

Result:
- complete
- see [phase1s-capped-drying-to-omega-bridge.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1s-capped-drying-to-omega-bridge.md)
- the bridge patch is live, but it does not clear the climate gate:
  - `northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06637 -> 0.06845`
  - `northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01565 -> 0.01705`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
  - `itczWidthDeg: 25.834 -> 25.837`
  - `subtropicalDryNorthRatio: 1.515 -> 1.517`
  - `subtropicalDrySouthRatio: 1.192 -> 1.193`

Conclusion:
- the capped same-step bridge does create a real NH omega response
- but the gain is too small, and NH westerlies still do not recover
- because the bridge is live but not climate-keepable, it should stay disabled by default while we use its diagnostics to attribute the downstream missing lane

### Phase 1T: Omega-To-Jet Recovery Attribution

Objective:
- prove whether the residual failure is weak bridge gain, bad vertical placement of the omega response, or a downstream omega-to-jet recovery gap

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Design rule:
- keep the Phase 1S bridge instrumentation and runtime toggle
- do not strengthen the bridge blindly while it still worsens guardrails and leaves NH westerlies flat
- rank whether the next patch should target bridge gain, bridge vertical distribution, or omega-to-jet recovery

Exit criteria:
- same-branch attribution cleanly identifies the dominant residual carrier after the bridge is turned on
- the next patch lane is specific enough that we can change one mechanism instead of broadening circulation tuning again

Result:
- complete
- see [phase1t-omega-to-jet-recovery-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1t-omega-to-jet-recovery-attribution.md)
- the dominant residual failure is now:
  - `equatorward_absorption_before_jet_band`
- same-branch bridge evidence says:
  - `northTransitionLowLevelOmegaEffectiveDeltaPaS = 0.00208`
  - `northDryBeltLowLevelOmegaEffectiveDeltaPaS = 0.0014`
  - `midlatitudeWesterliesNorthDeltaMs = 0`
- the day-30 profile deltas show why:
  - NH jet-band `wind10mU` delta is effectively `0`
  - NH jet-band `stormTrackIndex` delta is effectively `0`
  - dry-belt-core `largeScaleCondensation` decreases, but tropical-shoulder `largeScaleCondensation` increases

Conclusion:
- the current bridge does create a real subtropical omega response
- but that response is being absorbed too far equatorward, before it reaches the `30-56°N` jet pathway
- this is not yet a true downstream jet-recovery failure; it is mainly a placement problem in the bridge lane

### Phase 1U: Jet-Band Placement Patch Design

Objective:
- redesign the omega bridge so a capped share of the proven drying response projects into the same-hemisphere `30-45°N` transition / jet-entry lane instead of being absorbed in the NH dry-belt core and tropical shoulder

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

Design rule:
- keep the Phase 1S bridge diagnostics and runtime toggle
- do not simply raise bridge amplitude everywhere
- shift the response poleward and guardrail-first, with caps that prevent more ITCZ broadening or dry-belt rewetting

Exit criteria:
- same-branch `off -> on` compare produces a non-zero positive NH jet-band wind or storm-track response
- the bridge still improves NH transition / dry-belt omega without giving back the kept Phase 1K and Phase 1M wins

Result:
- complete
- see [phase1u-jet-band-placement-patch-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1u-jet-band-placement-patch-design.md)
- the design verdict is:
  - `poleward_projected_transition_bridge_required`
- the key structural reason is:
  - the current bridge is confined to the same-column `15-35°` subtropical loop, so a same-column retune cannot directly seed the `41.25-56.25°N` jet band
- the current Phase 1S off/on evidence says:
  - tropical-shoulder `largeScaleCondensation` increases `+0.01778`
  - dry-belt-core `largeScaleCondensation` decreases `-0.00425`
  - transition-entry and jet-band wind deltas stay effectively `0`

Conclusion:
- the right next patch is not a stronger same-column bridge
- it is a poleward-projected same-hemisphere bridge that redistributes a capped share of the proved dry-belt response into the `30-45°N` transition / jet-entry rows
- the current bridge diagnostics and runtime toggle should stay in place so we can compare the placement patch cleanly against Phase 1S

### Phase 1V: Implement Poleward Jet-Entry Bridge Patch

Objective:
- implement a capped same-hemisphere projected bridge that shifts part of the current omega response from the NH dry-belt core into the `30-45°N` transition / jet-entry lane

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

Design rule:
- keep the existing Phase 1S bridge diagnostics and runtime toggle
- split the bridge into a capped local share plus a capped poleward-projected share
- penalize equatorward leakage below roughly `18-22°N`
- do not increase total bridge amplitude before verifying placement

Exit criteria:
- same-branch `off -> on` compare produces a positive NH transition-entry or jet-band wind / storm-track response
- tropical-shoulder `largeScaleCondensation` increase is reduced materially from the current `+0.01778 kg/m²`
- the Phase 1K and Phase 1M wins remain intact

Result:
- complete
- see [phase1v-poleward-jet-entry-bridge-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1v-poleward-jet-entry-bridge-patch.md)
- the projected bridge is live on the real 30-day run:
  - `northTransitionDryingOmegaBridgeAppliedMeanPaS: 0 -> 0.00205`
  - `northDryBeltDryingOmegaBridgeAppliedMeanPaS: 0 -> 0.00105`
  - `northTransitionLowLevelOmegaEffectiveMeanPaS: 0.06637 -> 0.06846`
  - `northDryBeltLowLevelOmegaEffectiveMeanPaS: 0.01565 -> 0.01674`
  - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14647 -> 0.14170`
- but the target circulation still does not move:
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
  - NH storm-track response stays effectively `0`
- guardrails stay flat to slightly worse:
  - `itczWidthDeg: 25.834 -> 25.840`
  - dry-belt ratios stay effectively unchanged
- the residual profile pattern still shows equatorward absorption before jet recovery:
  - `18.75°N` `largeScaleCondensation` decreases
  - `3.75°N` `largeScaleCondensation` increases sharply

Conclusion:
- the poleward-projected bridge is worth keeping as a live lane and diagnostic foothold
- but it is not yet a keepable climate fix
- the remaining blocker is no longer “same-column placement”
- it is now “why does improved transition omega still fail to create transition-entry / jet-band wind recovery”

### Phase 1W: Transition-Omega Carrier Attribution

Objective:
- prove why the now-improved NH transition omega signal still fails to generate any meaningful transition-entry or jet-band wind / storm-track response

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Questions to resolve:
- is the projected omega signal still too shallow vertically to influence the transition wind lane?
- is the projected omega signal landing in the wrong part of the `30-45°N` corridor?
- is a remaining equatorward condensation sink still absorbing the response before jet entry?
- or is the missing carrier now genuinely downstream of omega?

Exit criteria:
- one ranked dominant failure mode among:
  - vertical-depth failure
  - latitudinal target-placement failure
  - equatorward condensation absorption
  - true downstream jet-response failure
- one explicit patch contract for the next circulation lane

Status:
- completed

Result:
- dominant verdict: `projected_share_unapplied_before_transition_entry`
- the projected bridge share is still not a live carrier in the target lane:
  - source-core `20-30°N` local bridge is active: `0.00063 Pa/s`
  - target-entry `30-45°N` projected bridge stays `0`
  - jet-band `41.25-56.25°N` projected bridge stays `0`
- the current branch is still behaving like a mostly source-local bridge, not a real projected transition-entry bridge
- downstream jet recovery attribution would be premature until target-row deposition exists in the live run

Patch contract for the next lane:
- keep the current bridge diagnostics and runtime toggle
- repair the missing projected-share deposition path in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- prove that a non-zero projected bridge reaches the `30-45°N` target rows before asking the jet lane to respond

### Phase 1X: Projected-Share Application Repair

Objective:
- repair the missing target-row deposition path so the existing projected omega bridge budget actually becomes a live carrier in the `30-45°N` transition-entry lane

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Questions to resolve:
- where should the projected bridge budget be deposited into the `30-45°N` target rows in the live step order?
- how much of the existing total bridge should remain local versus projected once the missing deposition path is real?
- can we make the projected share visible in the target-entry lane without widening the ITCZ or undoing the Phase `1K` and `1M` wins?

Exit criteria:
- target-entry `30-45°N` projected bridge mean becomes non-zero in the live `on` run
- target-entry lower- or mid-tropospheric omega improves relative to `off`
- the patch stays guardrail-first and does not increase total bridge amplitude before proving placement

Status:
- completed

Result:
- the projected-share repair succeeded as a live carrier repair
- target-entry `30-45°N` projected bridge is now non-zero: `0.00059 Pa/s`
- target-entry poleward-half `37.5-45°N` projected bridge is also non-zero: `0.00053 Pa/s`
- jet-band `41.25-56.25°N` projected bridge is now non-zero: `0.00018 Pa/s`
- the old dominant failure `projected_share_unapplied_before_transition_entry` is no longer first-ranked
- the new dominant residual is `equatorward_condensation_absorption`
- guardrails did not improve yet:
  - `itczWidthDeg: 25.834 -> 25.839`
  - `subtropicalDryNorthRatio: 1.515 -> 1.517`
  - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`

Patch contract for the next lane:
- keep the repaired projected-share deposition path in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- keep the current diagnostics and runtime toggle
- stop treating missing projected deposition as the blocker
- next work should guard against equatorward tropical-shoulder absorption before adding more downstream coupling

### Phase 1Y: Equatorward Absorption Guard Design

Objective:
- explain and then reduce the remaining equatorward condensation sink that absorbs the now-live projected bridge before transition-entry omega can become wind recovery

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Questions to resolve:
- why does tropical-shoulder `3-18.75°N` condensation increase by `+0.01365 kg/m²` when the projected bridge is enabled?
- why does target-entry projected bridge coexist with slightly worse target-entry lower/mid omega?
- what narrow guard can reduce equatorward absorption without undoing the kept Phase `1K`, `1M`, and Phase `1X` bridge wins?

Exit criteria:
- tropical-shoulder condensation rebound is materially reduced in same-branch `off/on`
- target-entry lower- or mid-tropospheric omega no longer regresses relative to `off`
- the guard stays narrow and does not increase total bridge amplitude first

Status:
- completed

Result:
- dominant verdict: `remote_shoulder_absorption`
- the strongest rebound is in the tropical shoulder core, not the bridge source or target lanes:
  - strongest latitude: `11.25°N`
  - condensation delta: `+0.02107 kg/m²`
  - local bridge on: `0`
  - projected bridge on: `0`
- the shoulder-core `3-12°N` band rises while the source core falls:
  - tropical-shoulder-core condensation delta: `+0.02052 kg/m²`
  - source-core `20-30°N` condensation delta: `-0.00972 kg/m²`
- the repaired projected bridge remains live where we wanted it:
  - target-entry `30-45°N` projected bridge on: `0.00059 Pa/s`
  - jet-band projected bridge on: `0.00018 Pa/s`
- so the next blocker is not direct bridge leakage and not missing target deposition
- it is a remote tropical-shoulder marine condensation rebound that absorbs the benefit before wind recovery

Patch contract for the next lane:
- keep the Phase `1X` projected-share repair in place
- do not touch the `30-45°N` projected bridge deposition path
- add a narrow marine saturation-adjustment guard in the tropical shoulder core `3-12°N`
- use [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) as the first patch lane, not more bridge placement tuning

### Phase 1Z: Implement Shoulder Absorption Guard Patch

Objective:
- suppress the remote tropical-shoulder marine condensation rebound without undoing the kept Phase `1K`, `1M`, and `1X` wins

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Questions to resolve:
- can a narrow `3-12°N` marine saturation-adjustment guard cut the shoulder rebound while leaving the `30-45°N` projected bridge alive?
- can we reduce shoulder condensation without worsening ITCZ width or the dry-belt ratios?
- can the patch stay local enough that the source-core and target-entry bridge lanes remain intact?

Exit criteria:
- tropical-shoulder-core `3-12°N` condensation delta becomes non-positive in same-branch `off/on`
- target-entry `30-45°N` projected bridge remains non-zero
- `itczWidthDeg` and dry-belt ratios do not regress further

Status:
- implemented with live diagnostics and runtime toggle in:
  - [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
  - [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- same-branch `off/on` result is recorded in [phase1z-shoulder-absorption-guard-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1z-shoulder-absorption-guard-patch.md)
- outcome:
  - slight ITCZ / north dry-belt improvement
  - shoulder rebound still stays positive
  - target-entry projected bridge is still `0` on the live branch
  - south dry-belt ratio regresses slightly
- decision:
  - the shoulder guard is **rejected as a kept default patch**
  - the diagnostics and runtime toggle stay in place
  - the guard remains disabled by default

### Phase 1ZA: Shoulder Guard Residual Attribution

Objective:
- explain why the shoulder guard misses the `3.75°N` rebound while also bleeding into the `30-45°N` target-entry lane on the live branch

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [phase1z-shoulder-absorption-guard-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1z-shoulder-absorption-guard-patch.md)

Questions to resolve:
- why is the strongest rebound latitude `3.75°N` still getting zero applied guard mass?
- why does the current selector apply suppression in the target-entry `30-45°N` lane at all?
- is the missing discriminator latitude-window placement, bridge-silence weighting, or a weak-engine ambiguity between shoulder and target-entry columns?

Exit criteria:
- one attribution report that ranks the selector miss:
  - `equatorial-edge shoulder miss`
  - `target-entry false positive`
  - `shared weak-engine ambiguity`
- one explicit redesign contract for the next patch attempt
- no new physics change until that selector miss is proved

Status:
- complete in [phase1za-shoulder-guard-residual-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1za-shoulder-guard-residual-attribution.md)
- dominant residual: `equatorial_edge_shoulder_miss`
- supporting residual: `target_entry_false_positive`
- structural conclusion:
  - the current selector never admits the strongest `3.75°N` rebound because its shoulder-window proxy is effectively zero there
  - the same selector still fires in the `30-45°N` target-entry lane, so it is not safely local
  - weak-engine plus bridge-silence alone are too shared to distinguish the desired shoulder lane from the false-positive transition lane
- the most important design consequence is now explicit:
  - [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) needs a latitude-aware discriminator or a dedicated precomputed shoulder-window diagnostic

### Phase 1ZB: Latitude-Aware Shoulder Guard Redesign

Objective:
- redesign the shoulder guard selector so it reaches the `3–6°N` equatorial shoulder while explicitly excluding the `30–45°N` target-entry lane

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) only if we choose to precompute the selector upstream

Required design rules:
- do not solve this by only raising suppression amplitude
- add explicit equatorial-shoulder admission for `3–6°N`
- add explicit target-entry exclusion for `30–45°N`
- do not remove the kept Phase `1K`, `1M`, or `1X` lanes

Exit criteria:
- the strongest shoulder latitude receives non-zero candidate and applied guard mass
- target-entry shoulder-guard application falls to zero
- same-branch `off/on` still preserves or improves ITCZ width and the dry-belt ratios

Status:
- complete in [phase1zb-latitude-aware-shoulder-guard-redesign.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zb-latitude-aware-shoulder-guard-redesign.md)
- selector placement is now correct:
  - `3.75°N` shoulder candidate/application is live again
  - `33.75°N` target-entry candidate/application is zero
- but the lane is not climate-safe yet:
  - `itczWidthDeg`: `25.834 -> 25.89`
  - `subtropicalDryNorthRatio`: `1.515 -> 1.527`
  - `subtropicalDrySouthRatio`: `1.192 -> 1.197`
  - tropical shoulder core condensation still rises by `+0.01603 kg/m²`

### Phase 1ZC: Shoulder Guard Reintegration Audit

Objective:
- explain why the corrected latitude-aware selector now targets the right cells but still worsens the 30-day climate when enabled

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) only if the reintegration bug is upstream

Questions to answer:
- is the redesigned shoulder lane now overdamping the `11.25°N` shoulder while leaving a compensating humidification path elsewhere in the tropical shoulder?
- is the residual rebound now an amplitude / spread problem inside the corrected selector, or a downstream adjustment response outside the selector?
- can we narrow the live shoulder application without reintroducing the old `33.75°N` false-positive?

Status:
- complete in [phase1zc-shoulder-guard-reintegration-audit.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zc-shoulder-guard-reintegration-audit.md)
- dominant residual: `same_lane_vapor_recharge`
- supporting residual: `adjacent_ungated_shoulder_spillover`
- ruled out: `30-45°N target-entry false-positive`
- the corrected selector is active where it should be, but the live `3-12°N` shoulder gets moister after suppression:
  - tropical shoulder core net condensation delta: `+0.01603 kg/m²`
  - tropical shoulder core reconstructed raw condensation delta: `+0.03461 kg/m²`
  - tropical shoulder core applied suppression on: `0.01858 kg/m²`
  - tropical shoulder core TCW delta: `+0.1055 kg/m²`
  - tropical shoulder core mid-RH delta: `+0.003`
- a secondary spillover still rises at `18.75°N` with zero local guard application

### Phase 1ZD: Suppressed-Mass Fate Design

Objective:
- prove how shoulder-guard-suppressed condensation mass should be handled so it does not immediately recharge the same `3-12°N` marine shoulder lane or spill into `18.75°N`

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) only if the fate path is not local to saturation adjustment

Questions to answer:
- should suppressed shoulder condensation remain in-place as vapor, or does it need a local sink / export / delayed-rainout path?
- is `11.25°N` over-participating relative to `3.75°N`, or is the rebound mainly a shared same-lane recharge response?
- can we reduce the `18.75°N` spillover without reopening the fixed `33.75°N` target-entry lane?

Status:
- complete in [phase1zd-suppressed-mass-fate-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zd-suppressed-mass-fate-design.md)
- dominant verdict: `in_place_vapor_retention`
- the current shoulder guard is now proved to leave more vapor and less condensate in the same column when it suppresses condensation
- that one-column witness matches the live 30-day branch behavior:
  - tropical shoulder core TCW delta: `+0.1055 kg/m²`
  - tropical shoulder core mid-RH delta: `+0.003`
  - adjacent `12-22.5°N` spillover still rises
- selector geometry is no longer the lead problem

### Phase 1ZE: Suppressed-Mass Fate Counterfactuals

Objective:
- compare bounded alternatives for shoulder-guard-suppressed mass handling so we can choose the least damaging fate before patching the live climate

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Counterfactuals to compare:
- capped local sink/export of suppressed shoulder mass
- delayed-rainout / buffered-removal path
- current in-place vapor retention baseline

Exit criteria:
- tropical shoulder core net condensation no longer increases in same-branch `off/on`
- `18.75°N` spillover is reduced
- fixed `33.75°N` target-entry exclusion stays intact
- ITCZ width and dry-belt ratios do not worsen versus the current kept branch

Status:
- complete in [phase1ze-suppressed-mass-fate-counterfactuals.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1ze-suppressed-mass-fate-counterfactuals.md)
- verdict: `no_counterfactual_clears_gate`
- `buffered_rainout` is the best current fate family:
  - score: `0.98969`
  - shoulder-core delta: `+0.00099 kg/m²`
  - spillover delta: `-0.01452 kg/m²`
  - dry south delta: `-0.009`
- `sink_export` fixes the shoulder more aggressively, but fails the south dry-belt guardrail:
  - shoulder-core delta: `-0.01967 kg/m²`
  - spillover delta: `-0.03469 kg/m²`
  - dry south delta: `+0.105`
- `retain` remains the losing baseline and preserves the known recharge failure

### Phase 1ZF: Shoulder Fate Patch Design

Objective:
- turn the Phase 1ZE counterfactual result into a patch-ready design, using `buffered_rainout` as the base fate while fixing the remaining equatorial-edge shoulder miss

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Questions to answer:
- why does the best `buffered_rainout` mode still leave `3.75°N` positive while `11.25°N` and `18.75°N` already improve?
- how do we shift buffered application toward `3-6°N` without reopening the fixed `30-45°N` target-entry lane?
- can we reallocate shoulder suppression equatorward before increasing total amplitude?

Status:
- complete in [phase1zf-shoulder-fate-patch-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zf-shoulder-fate-patch-design.md)
- verdict: `equatorial_edge_buffered_underreach`
- next active phase: `Phase 1ZG: Implement Equatorial-Edge Buffered Shoulder Fate Patch`
- current design contract:
  - keep `buffered_rainout` as the suppressed-mass fate
  - increase effective buffered application specifically in the `3-6°N` equatorial-edge shoulder lane
  - do not reopen the `30-45°N` target-entry lane
  - do not expand application into the `18.75°N` spillover lane
  - reallocate shoulder suppression toward `3.75°N` before increasing total amplitude

### Phase 1ZG: Implement Equatorial-Edge Buffered Shoulder Fate Patch

Objective:
- keep the winning `buffered_rainout` fate family, turn it on by default, and reallocate buffered shoulder suppression toward the `3-6°N` equatorial edge without reopening the protected lanes

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

Status:
- complete in [phase1zg-equatorial-edge-buffered-shoulder-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zg-equatorial-edge-buffered-shoulder-patch.md)
- verdict: `keep_with_equatorial_edge_residual`
- the patch is now worth keeping on by default because same-branch `off -> on` improves the climate guardrails:
  - `itczWidthDeg: 25.834 -> 25.571`
  - `subtropicalDryNorthRatio: 1.515 -> 1.421`
  - `subtropicalDrySouthRatio: 1.192 -> 1.154`
  - target-entry `33.75°N` suppression stays `0`
  - `18.75°N` spillover condensation still improves: `-0.01806 kg/m²`
- but the equatorial edge remains unresolved:
  - `3.75°N` condensation still rises: `+0.04637 kg/m²`
  - `3.75°N` candidate mass rises: `+0.0701 kg/m²`
  - `3.75°N` buffered application rises too: `+0.02352 kg/m²`

### Phase 1ZH: Equatorial-Edge Candidate Rebound Attribution

Objective:
- explain why the kept buffered shoulder patch improves the climate guardrails overall while still allowing a raw `3.75°N` equatorial-edge candidate rebound

Primary files:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

Status:
- complete in [phase1zh-equatorial-edge-candidate-rebound-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zh-equatorial-edge-candidate-rebound-attribution.md)
- verdict: `raw_equatorial_edge_candidate_rebound`
- dominant finding:
  - the remaining failure is no longer suppressed-mass fate or target-entry leakage
  - it is a raw candidate / event-count rebound at `3.75°N` that outruns the stronger buffered removal
- protected wins to preserve:
  - `11.25°N` now improves
  - `18.75°N` spillover now improves
  - `33.75°N` target-entry lane stays closed
- next active phase: `Phase 1ZI: Equatorial-Edge Candidate Gate Design`

### Phase 1ZI: Equatorial-Edge Candidate Gate Design

Objective:
- redesign the shoulder candidate-entry gate so the `3-6°N` equatorial edge no longer rides inside the same fully admitted lane as the improving `9-12°N` inner shoulder

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Status:
- complete in [phase1zi-equatorial-edge-candidate-gate-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zi-equatorial-edge-candidate-gate-design.md)
- verdict: `single_lane_geometry_overadmits_equatorial_edge`
- key conclusion:
  - the current single shoulder latitude window is too coarse
  - it still admits both `3.75°N` and `11.25°N` through one lane even though only the equatorial edge now rebounds
  - the next patch should reduce raw candidate/event generation at `3-6°N`, not increase buffered removal again
- design contract:
  - keep `buffered_rainout` as the suppressed-mass fate
  - keep the `30-45°N` target-entry exclusion intact
  - keep the `11.25°N` and `18.75°N` improvements intact
  - split the shoulder window into an equatorial-edge lane and an inner-shoulder lane in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
  - publish new fresh-state lane diagnostics and use them in [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- apply an edge-only candidate-entry penalty or stricter support threshold tied to fresh subtropical support
- next active phase: `Phase 1ZJ: Implement Split-Lane Equatorial-Edge Candidate Gate Patch`

### Phase 1ZJ: Implement Split-Lane Equatorial-Edge Candidate Gate Patch

Objective:
- split the shoulder candidate gate so the `3-6°N` equatorial edge is no longer admitted through the same lane as the `9-12°N` inner shoulder

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)

Status:
- complete in [phase1zj-split-lane-equatorial-edge-candidate-gate-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zj-split-lane-equatorial-edge-candidate-gate-patch.md)
- verdict: `keep_with_out_of_lane_edge_residual`
- key conclusions:
  - the split-lane gate is worth keeping because it improves the main 30-day climate guardrails again
  - it preserves the `11.25°N`, `18.75°N`, and `33.75°N` protected wins
- the remaining `3.75°N` rebound now occurs with zero shoulder-guard candidate mass and zero applied suppression
- that means the residual is no longer an in-lane shoulder-candidate problem
- next active phase: `Phase 1ZK: Equatorial-Edge Out-Of-Lane Attribution`

### Phase 1ZK: Equatorial-Edge Out-Of-Lane Attribution

Objective:
- prove why the remaining `3.75°N` rebound persists even after the split-lane shoulder gate stopped admitting that lane

Primary files:
- [phase1zk-equatorial-edge-out-of-lane-attribution.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/phase1zk-equatorial-edge-out-of-lane-attribution.mjs)
- [final-unified-weather-gameplan.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/final-unified-weather-gameplan.md)

Status:
- complete in [phase1zk-equatorial-edge-out-of-lane-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zk-equatorial-edge-out-of-lane-attribution.md)
- verdict: `bilateral_equatorial_edge_subsidence_relaxation`
- key conclusions:
  - the residual is mirrored at `-3.75°` and `3.75°`, so it is not just a local NH shoulder miss anymore
  - both equatorial-edge lanes show weaker low-level omega while condensation increases
  - `3.75°N` keeps zero shoulder candidate mass and zero shoulder applied suppression
  - the `11.25°N`, `18.75°N`, and `33.75°N` kept wins remain intact
- next active phase: `Phase 1ZL: Equatorial-Edge Subsidence Guard Design`

#### Phase 1ZL: Equatorial-Edge Subsidence Guard Patch

Objective:
- test whether a small vertical/core omega guard can preserve the drying response and stop the `±3.75°` edge lanes from absorbing displaced condensation

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [phase1zl-equatorial-edge-subsidence-guard-patch.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/phase1zl-equatorial-edge-subsidence-guard-patch.mjs)

Status:
- complete in [phase1zl-equatorial-edge-subsidence-guard-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zl-equatorial-edge-subsidence-guard-patch.md)
- verdict: `north_only_partial_guard_activation`
- keep patch: `false`
- key conclusions:
  - the guard only activates along the northern source/target pair: `11.25°N -> 3.75°N`
  - the southern mirror stays silent, so the bilateral residual from Phase 1ZK is not actually addressed
  - `3.75°N` still gets wetter even with small applied guard omega
  - the main 30-day guardrails are flat-to-worse, so this is not a keepable default patch
- next active phase: `Phase 1ZM: Bilateral Equatorial-Edge Source Redesign`

#### Phase 1ZM: Bilateral Equatorial-Edge Source Redesign

Objective:
- prove exactly why the Phase 1ZL guard stayed north-only and define the bilateral source/target contract before another implementation patch

Primary files:
- [phase1zm-bilateral-equatorial-edge-source-redesign.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/phase1zm-bilateral-equatorial-edge-source-redesign.mjs)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [final-unified-weather-gameplan.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/final-unified-weather-gameplan.md)

Status:
- complete in [phase1zm-bilateral-equatorial-edge-source-redesign.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zm-bilateral-equatorial-edge-source-redesign.md)
- verdict: `signed_latitude_window_inheritance`
- key conclusions:
  - the equatorial-edge guard inherits `freshShoulderInnerWindow` for source admission and `freshShoulderEquatorialEdgeWindow` for target admission
  - both of those windows are currently NH-only signed-latitude lanes, so the south mirror is structurally excluded before any amplitude or support logic matters
  - the correct next move is a dedicated bilateral `abs(lat)` source/target geometry, while preserving the NH target-entry exclusion as a separate lane
- next active phase: `Phase 1ZN: Implement Mirrored Bilateral Edge-Source Window Patch`

#### Phase 1ZN: Mirrored Bilateral Edge-Source Window Patch

Objective:
- repair the geometry bug from Phase 1ZM so both `-3.75°` and `3.75°` edge lanes can receive a real equatorial-edge guard response

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [phase1zn-mirrored-bilateral-edge-source-window-patch.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/phase1zn-mirrored-bilateral-edge-source-window-patch.mjs)

Status:
- complete in [phase1zn-mirrored-bilateral-edge-source-window-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zn-mirrored-bilateral-edge-source-window-patch.md)
- verdict: `bilateral_activation_with_nh_edge_overresponse`
- keep patch: `false`
- key conclusions:
  - the mirrored abs-lat geometry fix succeeds: both source lanes and both edge targets become live
  - `-3.75°` is now effectively neutralized, which means the south-side geometry bug is truly fixed
  - the remaining failure is now an outcome problem, not a geometry problem: `3.75°N` and `18.75°N` over-respond while NH dry-belt ocean condensation rises
  - the patch should stay behind the runtime toggle, not become default-on yet
- next active phase: `Phase 1ZO: Bilateral Edge Outcome Attribution`

#### Phase 1ZO: Bilateral Edge Outcome Attribution

Objective:
- explain where the now-correct bilateral edge response is being absorbed on the north side so the next patch can contain the outcome rather than reworking geometry again

Primary files:
- [phase1zo-bilateral-edge-outcome-attribution.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/phase1zo-bilateral-edge-outcome-attribution.mjs)
- [phase1zn-mirrored-bilateral-edge-source-window-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zn-mirrored-bilateral-edge-source-window-patch.md)
- [final-unified-weather-gameplan.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/final-unified-weather-gameplan.md)

Status:
- complete in [phase1zo-bilateral-edge-outcome-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zo-bilateral-edge-outcome-attribution.md)
- verdict: `northside_condensation_fanout_without_humidification`
- key conclusions:
  - south-edge stabilization is real and no longer the blocker
  - the remaining north-side residual fans out from `11.25°N` into `3.75°N`, `18.75°N`, and `26.25°N`
  - TCW and RH stay nearly flat, so this is not primarily a humidification recharge problem
  - the next patch lane should be a northside fanout containment design, not another geometry redesign
- next active phase: `Phase 1ZP: Northside Fanout Containment Design`

#### Phase 1ZP: Northside Fanout Containment Design

Objective:
- select the safest and most evidence-aligned containment family for the north-side fanout residual before we implement another live physics patch

Primary files:
- [phase1zp-northside-fanout-containment-design.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/phase1zp-northside-fanout-containment-design.mjs)
- [phase1zo-bilateral-edge-outcome-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zo-bilateral-edge-outcome-attribution.md)
- [final-unified-weather-gameplan.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/final-unified-weather-gameplan.md)

Status:
- complete in [phase1zp-northside-fanout-containment-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zp-northside-fanout-containment-design.md)
- verdict: `northside_source_leak_penalty_preferred`
- key conclusions:
  - the best fit is a capped northside source-leak penalty around the 11.25°N source lane
  - target-only capping is too narrow because the residual already fans out into `18.75°N` and `26.25°N`
  - humidification-focused fixes are poor fits because Phase 1ZO showed almost no TCW/RH recharge signature
  - global amplitude reduction would throw away the south-edge stabilization and the bilateral geometry win
- next active phase: `Phase 1ZQ: Implement Capped Northside Fanout Leak Penalty Patch`

Status:
- complete in [phase1zq-capped-northside-fanout-leak-penalty-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zq-capped-northside-fanout-leak-penalty-patch.md)
- verdict: `northside_leak_penalty_inert_zero_live_admission`
- key conclusions:
  - the `11.25°N` source lane keeps positive equatorial-edge source support in the live 30-day branch state
  - the new northside leak-penalty still stays exactly `0`, so the lane is wired but not admitted
  - climate guardrails and north fanout bands stay flat because the penalty never becomes active
  - the next problem is admission/selector attribution, not stronger amplitude
- next active phase: `Phase 1ZR: Northside Leak Penalty Admission Attribution`

Status:
- complete in [phase1zr-northside-leak-penalty-admission-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zr-northside-leak-penalty-admission-attribution.md)
- verdict: `supported_subset_risk_below_gate`
- key conclusions:
  - the `11.25°N` source row is live and partially occupied, not dead
  - active source-window fraction is `0.45833`
  - active-subset leak risk is only `0.36889`, still below the current entry gate at `0.55`
  - this is an admission-threshold / gate-shape miss, not a wiring bug
- next active phase: `Phase 1ZS: Northside Leak Risk Gate Redesign`

Status:
- complete in [phase1zs-northside-leak-risk-gate-redesign.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zs-northside-leak-risk-gate-redesign.md)
- verdict: `northside_gate_live_with_south_mirror_regression`
- key conclusions:
  - the redesigned gate does become live on the `11.25°N` source lane
  - north-side target lanes improve: `3.75°N`, `11.25°N`, and `18.75°N` all reduce condensation
  - but the 30-day climate screen still fails because the south mirror regresses at `-3.75°` and `-11.25°`
  - the next problem is bilateral rebound attribution, not northside gate admission anymore
- next active phase: `Phase 1ZT: South Mirror Rebound Attribution`

Status:
- complete in [phase1zt-south-mirror-rebound-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zt-south-mirror-rebound-attribution.md)
- verdict: `cross_equatorial_compensation_without_local_recharge`
- key conclusions:
  - the south rebound is not mainly a local TCW/RH/omega recharge story
  - the strongest live signal is a small cross-equatorial vapor-flux rebalance paired with reduced tropical-shoulder condensation
  - this looks like bilateral compensation after NH suppression, not a local south selector bug
- next active phase: `Phase 1ZU: Bilateral Balance Patch Design`

Status:
- complete in [phase1zu-bilateral-balance-patch-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zu-bilateral-balance-patch-design.md)
- verdict: `weak_hemi_crosshemi_floor_overhang`
- key conclusions:
  - the south transition is the weak hemisphere, with local source `0.04689` versus mean tropical source `0.10765`
  - the live south source-driver floor is effectively `0.58003`, but a neutral weak-hemi floor would be only `0.43558`
  - that leaves a weak-hemi floor overhang of about `0.14445`, which is large enough to sustain the south mirror compensation lane without a local recharge signal
  - the right next patch is to taper the weak-hemisphere cross-hemi floor in the subtropical source-driver path, not add a south-local humidity or omega sink
- next active phase: `Phase 1ZV: Implement Weak-Hemisphere Cross-Hemi Floor Taper Patch`

Status:
- complete in [phase1zv-weak-hemi-cross-hemi-floor-taper-patch.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zv-weak-hemi-cross-hemi-floor-taper-patch.md)
- verdict: `guardrail_improvement_with_north_source_rebound`
- keep patch: `true`
- key conclusions:
  - the weak-hemi floor taper improves the main 30-day guardrails inside the live edge-guard stack:
    - `itczWidthDeg: -0.072`
    - `subtropicalDryNorthRatio: -0.024`
    - `subtropicalDrySouthRatio: -0.004`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: -0.01518`
  - the south weak-hemi floor share and overhang both fall materially
  - the remaining blocker is no longer the south compensation lane itself
  - the residual is now a narrower north-source rebound at `11.25°N`
- next active phase: `Phase 1ZW: North Source Rebound Attribution`

Status:
- complete in [phase1zw-north-source-rebound-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1zw-north-source-rebound-attribution.md)
- verdict: `north_source_condensation_concentration_without_local_recharge`
- keep patch: `true`
- key conclusions:
  - the remaining `11.25°N` rebound is not a local recharge signal:
    - condensation rises `+0.02481 kg/m²`
    - total column water falls `-0.085 kg/m²`
    - BL/lower/mid RH all fall
    - lower/mid omega both weaken slightly
  - the rebound is better explained as a same-hemisphere source-row concentration lane:
    - `18.75°N` condensation falls `-0.01008 kg/m²`
    - `26.25°N` condensation falls `-0.01896 kg/m²`
    - cross-equatorial vapor flux north still rises `+1.21412`
  - the weak-hemi floor taper should stay kept
  - the next fix should stay in `vertical5.js` / `core5.js` and contain source-row concentration around `9–13°N`, not add another local humidity or omega boost
- next active phase: `Phase 1ZX: North Source Concentration Patch Design`

### Phase 2: Return To The Original Climate Roadmap And Finish Moisture Partitioning

This is where we return once Phase 1 proves and lands the upstream fix.

#### Phase 2A: Finish Hadley Moisture Partitioning

Objective:
- finally clear the remaining north dry-belt blocker using the proven upstream fix path

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [nudging5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/nudging5.js) only as a guardrail lane

Acceptance gate:
- 30-day quick audit beats the current kept Phase-1 baseline on the north dry belt while preserving south dry-belt and circulation guardrails

#### Phase 2B: Seasonal Follow-Through

Run:
- 90-day seasonal audit

Goal:
- prove the moisture-partitioning win survives past startup/transient behavior

Acceptance gate:
- north dry-belt improvement survives
- no seasonal collapse or cross-hemisphere inversion

### Phase 3: Strengthen Organized Tropical Convection And Upper-Level Outflow

Once the remaining dry-belt blocker is no longer dominant, resume the original tropical-structure roadmap.

Objective:
- make organized tropical convection, detrainment, and anvil/export stronger and more believable

Primary files:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)

Acceptance gate:
- improve:
  - `tropicalConvectiveOrganization`
  - `tropicalConvectiveMassFluxKgM2S`
  - `upperDetrainmentTropicalKgM2`
  - `tropicalAnvilPersistenceFrac`
- without re-wetting the subtropics

### Phase 4: Seasonal Storm-Track And Cyclone-Support Structure

Only after the moisture belts and tropical export are credible.

Objective:
- improve storm-track asymmetry
- improve hemisphere-appropriate warm-season cyclone-support structure

Primary files:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

Acceptance gate:
- seasonal audit improves storm/cyclone-support realism without breaking the climate base state

### Phase 5: Annual Earth-Like Climate Signoff

Run:
- full 365-day audit pack

Goal:
- prove the model is not just good in short screens but good as a climate system

Required signoff families:
- ITCZ width and migration
- dry-belt ratios north and south
- subtropical subsidence
- tropical organization/export
- annual seasonal contrast
- storm/cyclone-support structure

### Phase 6: Ship-Readiness And Live Runtime Signoff

The model is not “done” until it is shippable in the actual game path.

Objective:
- verify that the climate gains survive the live browser/runtime path
- clear remaining runtime and smoothness blockers

Primary files:
- [App.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/App.js)
- [Earth.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/Earth.js)
- [WindStreamlineRenderer.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/WindStreamlineRenderer.js)
- browser/logging harness as needed

Acceptance gate:
- browser-backed verification agrees with headless climate evidence
- no unacceptable runtime spikes
- no major app/core divergence

## Practical Mapping From Old Notes To The New Plan

### Old “Fix Hadley-cell moisture partitioning first”

This still lives here:
- `Phase 2A`

### Old “Strengthen organized tropical convection and upper-level outflow”

This still lives here:
- `Phase 3`

### Old “Only then push seasonal storm/cyclone structure”

This still lives here:
- `Phase 4`

### Old 12-phase instrumentation plan

This is now:
- mostly complete historical proof work
- not the active phase list anymore

### Old coupled A-F proof plan

This is now:
- completed through the useful narrowing stages
- superseded by the stricter pre-vertical ownership campaign

### Old U0-U6 upstream ownership ladder

This is now:
- U0-U5 complete
- U6 is the live next phase

## The Short Honest Answer

We are **not** lost.

We are here:
- the original climate roadmap is still the right destination
- the main reason we have not returned to it fully yet is that the north dry-belt blocker forced a deep proof campaign
- that proof campaign has now narrowed the problem to a stable pre-vertical retained-reservoir ownership story
- the next actual phase is:
  - **Phase 1A / U6: exact upstream patch-placement proof**

Once Phase 1 is complete, we return directly to the original climate roadmap at:
- **Phase 2A: finish Hadley moisture partitioning**

That is the clean point where the “bug proof campaign” ends and the “make Earth weather truly great” campaign resumes.
