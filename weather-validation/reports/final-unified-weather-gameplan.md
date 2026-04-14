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
