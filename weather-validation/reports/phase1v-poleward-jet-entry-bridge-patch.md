# Phase 1V: Poleward Jet-Entry Bridge Patch

## Objective

Implement the Phase 1U design contract:
- keep the current drying-to-omega bridge diagnostics and runtime toggle
- split the bridge into a capped local share plus a capped poleward-projected share
- source rows centered around `20-30°N`
- target rows centered around `30-45°N`
- add an equatorward leak penalty around `18-22°N`
- do not increase total bridge amplitude first

## Implementation

The live Phase 1V patch is implemented in:
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [vertical5.test.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.test.js)

The patch keeps the existing bridge lane and splits it into:
- a capped local same-column share
- a capped same-hemisphere projected share

The projected share:
- only activates inside the existing bridge lane
- favors `20-30°N` source rows
- penalizes equatorward leakage below `18-22°N`
- redistributes toward weak-engine `30-45°N` target rows
- preserves the existing total bridge amplitude cap

## Verification

Focused verification passed:
- [vertical5.test.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.test.js)
- [planetary-realism-audit.test.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/tests/planetary-realism-audit.test.mjs)
- [microphysicsPhase7.test.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysicsPhase7.test.js)

Live same-branch 30-day compare artifacts:
- `off`: `/tmp/phase1v-jet-entry-off.json`
- `on`: `/tmp/phase1v-jet-entry-on.json`

## Result

The Phase 1V bridge is real and placed better than the old same-column bridge, but it is not yet a keepable climate fix.

Same-branch `off -> on` deltas at day 30:
- `itczWidthDeg`: `25.834 -> 25.840`
- `subtropicalDryNorthRatio`: `1.515 -> 1.515`
- `subtropicalDrySouthRatio`: `1.192 -> 1.192`
- `midlatitudeWesterliesNorthU10Ms`: `0.531 -> 0.531`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.14647 -> 0.14170`
- `northTransitionLowLevelOmegaEffectiveMeanPaS`: `0.06637 -> 0.06846`
- `northDryBeltLowLevelOmegaEffectiveMeanPaS`: `0.01565 -> 0.01674`
- `northTransitionDryingOmegaBridgeAppliedMeanPaS`: `0 -> 0.00205`
- `northDryBeltDryingOmegaBridgeAppliedMeanPaS`: `0 -> 0.00105`

So the projected bridge does two useful things:
- it raises NH transition and dry-belt low-level omega
- it lowers NH dry-belt ocean large-scale condensation

But it still fails its real exit gate:
- NH jet response stays flat
- NH storm-track response stays flat
- the climate guardrails do not improve materially

The residual profile story also matters:
- `18.75°N` large-scale condensation decreases
- `3.75°N` large-scale condensation increases sharply

That means the poleward projection removed some equatorward absorption from the dry-belt shoulder, but the system is still finding an equatorward condensation sink before any real jet recovery appears.

## Conclusion

Phase 1V should be treated as:
- an implemented and validated bridge-placement lane
- a useful improvement in omega placement
- not yet a ship-level climate win

The next phase should not be “turn the poleward bridge up more.”
It should prove why the new transition omega signal still fails to create transition-entry or jet-band wind recovery.

Recommended next phase:
- `Phase 1W: Transition-Omega Carrier Attribution`
