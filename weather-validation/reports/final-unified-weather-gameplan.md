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

#### Phase 1C: Re-verify The Proof Stack After The Patch

Required reruns:
- pre-vertical boundary ledger
- provenance ownership
- reduced-order experiment
- normalized numerical ownership

Exit criteria:
- the same corridor no longer shows the same owned excess reservoir
- no new owner replaces it immediately

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
