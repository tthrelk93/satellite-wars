# Pre-Vertical Upstream Proof Plan

Use this plan after [Phase E1](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/coupled-fix-proof-campaign.md) has shown that the NH dry-belt corridor is budget-closed at the vertical handoff and that the dominant difference is **already present as upper cloud input before `stepVertical5` runs**.

This is a scientific debugging plan, not a patch plan.

The objective is:
- identify **which exact module or module pair** supplies or retains the excess upper cloud before `stepVertical5`
- prove that ownership under replay, control, and sensitivity experiments
- define a patch only after the owning mechanism is isolated

## Current proven facts

We should treat these as fixed constraints for the next investigation:

1. [Phase E0](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/coupled-fix-proof-campaign.md) froze a minimal failing corridor:
   - `eastPacific / 22-35°N / cell 390 / lat 26.25 / lon -131.25`
   - `checkpointDay = 29.75`
   - `windowSteps = 12`

2. [Phase E1](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/coupled-fix-proof-campaign.md) proved that the dominant first-step difference is not in-step vertical birth:
   - current first-step vertical input: `3.51914 kg/m²`
   - current first-step resolved birth: `0.06594 kg/m²`
   - current first-step convective birth: `0`
   - historical first-step vertical input: effectively `0`

3. The current core step order in [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) matters:
   - `stepSurface2D5`
   - `stepRadiation2D5`
   - `stepWinds5`
   - `stepWindNudge5`
   - `stepWindEddyNudge5`
   - `stepSurfacePressure5`
   - `stepAdvection5`
   - `stepVertical5`
   - `stepMicrophysics5`

4. For direct upper-cloud mass ownership, the only obviously mass-moving modules **before** `stepVertical5` are:
   - previous-step residual state carried into the current step
   - `stepAdvection5` in the current step

5. Radiation, surface fluxes, winds, and nudges may still matter, but they are likely **support or steering paths**, not first-order cloud-mass source paths.

That means the most likely upstream ownership families are:
- **Family A: previous-step carryover retention**
- **Family B: current-step advection import**
- **Family C: advection + prior-step residual coupling**
- **Family D: numerical transport artifact that only appears as apparent supply**

## Standard of proof

We are not trying to answer:
- “what looks suspicious?”
- “what moves the metric a little?”

We are trying to answer:
- **which module first creates the excess pre-vertical cloud mass in the frozen corridor**
- **which module keeps it from going away**
- **which of those is primary versus secondary**

For this plan to count as complete, it must produce:
- one primary owner
- zero or one secondary co-owner
- one predicted patch signature
- one falsifiable reason that competing owners are not primary

## Research model

This is how a strong research/software team would handle the problem:

1. Freeze the failing experiment.
2. Instrument only the causal chain we need.
3. Compare historical and current at identical boundaries.
4. Use ablations and reduced-order models to separate supply from retention.
5. Separate physical sensitivity from numerical sensitivity.
6. Define patch location only after ownership is proven.

## Hypothesis tree

We should explicitly test this tree, in order:

### H1. Previous-step carryover retention is primary

Meaning:
- the current branch exits the previous step with too much upper cloud in the corridor
- `stepAdvection5` is not the main creator; it mostly passes through or redistributes what already exists

Primary owning modules:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) from the **previous** step
- possibly [radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js) as a support term

### H2. Current-step advection import is primary

Meaning:
- the corridor enters the step with acceptable cloud
- `stepAdvection5` imports too much upper cloud into the corridor before `stepVertical5`

Primary owning modules:
- [advect5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/advect5.js)
- upstream wind-field support from [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js), [dynamics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/dynamics5.js), [windNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windNudge5.js)

### H3. Coupled retention-plus-advection is primary

Meaning:
- the current branch carries too much upper cloud into the step
- `stepAdvection5` then further concentrates or preserves it in the corridor
- neither side alone explains the full failure

### H4. Numerical artifact is primary

Meaning:
- one of the apparent physical owners only “wins” because dt/grid numerics distort the path
- if the same frozen corridor is replayed with sensitivity controls, the ownership story changes materially

## Phase U0: Ownership Contract

Objective:
- lock down the exact proving question before any new instrumentation is added

Question:
- for the frozen E0/E1 corridor, at the instant just before `stepVertical5`, what fraction of excess upper cloud is attributable to:
  - previous-step residual carryover
  - current-step advection import
  - current-step local pre-vertical creation
  - numerical residual

Required artifact:
- `prevertical-ownership-contract.md`

Exit criteria:
- every later phase measures the same target cell, corridor, checkpoint, and comparison pair

## Phase U1: Boundary-Resolved Pre-Vertical Ledger

Objective:
- close the upper-cloud budget at **every module boundary** from the end of one step to the start of `stepVertical5` in the next step

Required boundaries:
- end of previous `stepMicrophysics5`
- end of previous full step
- start of current step
- after `stepSurface2D5`
- after `stepRadiation2D5`
- after wind updates
- after `stepAdvection5`
- just before `stepVertical5`

Primary files:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [advect5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/advect5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

Required measurements at each boundary:
- upper-cloud mass in target cell
- upper-cloud mass in corridor band
- cloud age / stale fraction
- provenance split:
  - prior-step residual
  - current-step advected import
  - current-step advected export
  - local creation before vertical
- closure residual

Required artifact:
- `prevertical-boundary-ledger.json`
- `prevertical-boundary-ledger.md`

Exit criteria:
- at least `99%` closure for the target cell
- at least `97%` closure for the corridor band
- one boundary is identified where historical and current first diverge materially

What this phase should decide:
- does the excess cloud already exist before advection, or appear during advection?

## Phase U2: Provenance Tracer Ownership

Objective:
- attach durable provenance labels to upper-cloud mass so we can stop inferring ownership from scalar deltas

Tracer families:
- `prev_step_residual_upper_cloud`
- `current_step_advected_upper_cloud`
- `current_step_local_upper_cloud`
- `reprocessed_upper_cloud` (mass that existed earlier, was transformed, and re-entered upper-cloud reservoir)

Important rule:
- these tracers must move with the same transport and limiter logic as the physical cloud fields
- otherwise they are not trustworthy

Primary files:
- [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [advect5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/advect5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

Required artifact:
- `prevertical-provenance-ownership.json`

Exit criteria:
- tracer ownership closes to the same mass as the physical upper-cloud budget
- one provenance family explains most of the excess current-minus-historical cloud before vertical

What this phase should decide:
- is the excess cloud mostly inherited, imported, or locally generated before vertical?

## Phase U3: Supply Versus Retention Counterfactuals

Objective:
- separate “too much cloud arrives” from “too much cloud survives”

Counterfactual classes:

1. **Retention-off replay**
- keep winds and advection identical
- replace previous-step upper-cloud reservoir with historical-level reservoir
- if the excess disappears, retention is primary

2. **Advection-off replay**
- keep previous-step reservoir identical
- suppress current-step upper-cloud advection into the corridor only
- if the excess disappears, advection supply is primary

3. **Carryover-only replay**
- feed the corridor the current previous-step reservoir but historical winds/advection

4. **Advection-only replay**
- feed the corridor the historical previous-step reservoir but current winds/advection

Primary files:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [advect5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/advect5.js)

Required artifact:
- `prevertical-supply-vs-retention-counterfactuals.json`

Exit criteria:
- one of these outcomes is proven:
  - retention-dominant
  - advection-dominant
  - coupled

What this phase should decide:
- who actually owns the excess upper cloud: prior-step reservoir, current-step import, or both

## Phase U4: Reduced-Order Reference Experiments

Objective:
- determine whether the bug survives when we remove most of the globe and keep only the suspected mechanism

Required experiments:

### Column experiment

Setup:
- one vertical column
- initialize from frozen corridor target-cell state
- no horizontal transport

Interpretation:
- if the excess-cloud bug persists without transport, retention/local maintenance owns it
- if it disappears, transport coupling is necessary

### 2D curtain experiment

Setup:
- meridional curtain across `22°N–35°N`
- limited zonal complexity
- replay only relevant winds, cloud fields, and thermodynamic support

Interpretation:
- if the bug appears here, the owner is likely advection plus local retention, not full-globe sector complexity

### Advection-only curtain

Setup:
- cloud tracers only
- no new microphysics creation
- no radiation-created secondary support

Interpretation:
- proves whether transport alone can reproduce the excess pre-vertical mass

Required artifact:
- `prevertical-reduced-order-results.json`

Exit criteria:
- at least one reduced experiment reproduces the ownership story
- or we prove the bug requires full coupled behavior and can stop wasting time on reduced models

## Phase U5: Numerical Ownership Check

Objective:
- prove the winning owner is not a dt/grid artifact

Why this phase is mandatory:
- [Phase 9](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/upstream-root-cause-instrumentation-campaign.md) already told us the story is numerically sensitive
- we should not patch based on ownership that flips under replay resolution

Required variants:
- baseline replay
- `dt_half`
- `grid_coarse`
- one finer replay if practical

Required outputs:
- ownership fractions by variant
- boundary divergence step by variant
- dominant owner by variant

Required artifact:
- `prevertical-numerical-ownership-check.json`

Exit criteria:
- same primary owner across variants
- same first material boundary across variants
- no variant flips the conclusion from retention-dominant to advection-dominant or vice versa

If this phase fails:
- the next step is numerical-model repair, not physics repair

## Phase U6: Upstream Patch-Placement Proof

Objective:
- only after U1-U5, define exactly where the first upstream fix belongs

Allowed patch locations:
- [advect5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/advect5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [dynamics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/dynamics5.js)
- [windNudge5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/windNudge5.js)
- or one exact coordinated subset

Required proof:
- exact owning function
- exact secondary co-owner if needed
- predicted before/after signature in:
  - pre-vertical boundary ledger
  - provenance ownership
  - reduced-order experiment
  - 30-day climate metrics

Required artifact:
- `prevertical-patch-placement-proof.md`
- `prevertical-patch-placement-proof.json`

Exit criteria:
- one patch placement with causal proof
- one predicted ledger signature
- one explicit falsification rule for why the patch would be considered wrong

## What the next fix should look like

A valid fix should not be described as:
- “reduce cloud”
- “increase erosion”
- “dry the dry belt”

A valid fix should be described as:
- “reduce **current-step upper-cloud import in `advect5.js`** into the frozen corridor by changing X”
- or “reduce **previous-step residual upper-cloud carryover leaving `microphysics5.js`** by changing Y”
- or “reduce **coupled residual-plus-import persistence** by coordinated edits in A and B”

The proof must predict:
- which pre-vertical ledger term will drop
- which term should stay nearly unchanged
- which climate guardrails should remain intact

## Decision table

If the evidence says:

- `previous-step residual` dominates and survives reduced-order column tests:
  - patch belongs first in previous-step retention logic, likely [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

- `current-step advected import` dominates and advection-only curtain reproduces it:
  - patch belongs first in [advect5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/advect5.js) or in the wind field owner that feeds it

- `retention + advection` are both required but stable across variants:
  - patch should be coordinated, but only after ownership fractions and patch signatures are proven

- ownership flips across dt/grid variants:
  - stop and fix the numerical integrity problem first

## Bottom line

The next step is not “try another cloud tweak.”

The next step is to **prove upstream ownership of the excess pre-vertical cloud reservoir**. If we execute U0-U6 thoroughly, we should be able to say:
- exactly which module first owns the bug
- exactly which secondary module keeps it alive
- exactly what the first patch should change
- exactly how that patch should show up in the ledger before we trust any 30-day climate win
