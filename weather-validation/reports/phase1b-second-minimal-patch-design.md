# Phase 1B Second Minimal Patch Design

This design is grounded in [phase1b-exact-corridor-support-proof.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1b-exact-corridor-support-proof.json) and the frozen corridor contract, not in a proxy unit-test state.

## Placement
- stepVertical5 carryover / erosion handoff in vertical5.js

## What the proof says is missing
- The real 26.25 deg N corridor is a strongly subtropical-suppressed, weakly organized column with almost no convective engine, yet a fully stale imported upper-cloud reservoir still survives the handoff and only about five percent of potential erosion is applied. The missing condition is an explicit stale-reservoir override in the vertical carryover/erosion handoff that clears old imported cloud when fresh organized support is weak, even if the column stays moist and slightly ascending.

## Exact inputs the patch should use
- previous-step residual carryover fraction at the target cell / corridor
- fresh current-step subtropical suppression strength at the proving instant
- fresh current-step organized support at the proving instant
- fresh current-step low-level omega at the proving instant
- fresh current-step low-level moisture convergence at the proving instant
- fresh current-step local birth support target from RH, instability, ascent, and convergence
- fresh stale-carryover dominance versus local birth support
- stored current-step convective mass flux / detrainment / anvil source only as secondary corroboration

## What the patch should not trust as its primary gate
- stored convectiveOrganization from the prior step
- stored convectiveMassFlux from the prior step
- stored convectiveDetrainmentMass from the prior step
- stored convectiveAnvilSource from the prior step

## Predicted signature
- endPreviousStepMicrophysics5 previous-step residual carryover falls
- previousStepResidualUpperCloud should shrink before currentStepAdvectedUpperCloud changes materially
- currentStepLocalPreverticalBirth remains near zero in the target cell

## Falsification
- If the patch only helps when low-level descent strengthens, or if it materially changes local birth/advection before the stale previous-step reservoir shrinks, then the override is keyed to the wrong condition.
