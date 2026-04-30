# Phase 1I: Subtropical-Suppression Gate Redesign

## Goal

Explain why the live ocean-side NH dry-belt saturation-adjustment path carries almost no legacy subtropical-suppression signal, then redesign the gate from the actual branch state instead of the rejected Phase 1G proxy regime.

## Method

- Exposed fresh vertical-state support diagnostics from [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js):
  - fresh subtropical suppression
  - subtropical-band support
  - neutral-to-subsiding support
  - organized support
  - mid-level RH support
- Wired those live-state signals into the saturation-adjustment branch in [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) alongside the old downstream `marginalSubsiding`-based gate.
- Added a redesigned live-state candidate gate for comparison only. It does not change physics yet.
- Verified the instrumentation with focused tests and a real 30-day quick audit at [phase1i-subtropical-gate-redesign.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1i-subtropical-gate-redesign.json).

## Result

The live marine condensation path **does** carry a strong subtropical signal upstream. That signal is being lost by the legacy downstream proxy.

Day-30 NH dry-belt ocean metrics:

- `northDryBeltOceanMarineCondensationMeanKgM2 = 0.19722`
- legacy downstream subtropical signal:
  - `northDryBeltOceanMarineSubtropicalSupportMeanFrac = 0.0374`
- fresh vertical-state subtropical signal:
  - `northDryBeltOceanMarineFreshSubtropicalSuppressionMeanFrac = 0.68321`
  - `northDryBeltOceanMarineFreshSubtropicalBandMeanFrac = 0.85847`
  - `northDryBeltOceanMarineFreshNeutralToSubsidingSupportMeanFrac = 0.02593`
  - `northDryBeltOceanMarineFreshOrganizedSupportMeanFrac = 0.19655`
  - `northDryBeltOceanMarineFreshRhMidSupportMeanFrac = 0.96748`
- other live marine supports:
  - `northDryBeltOceanMarineWeakEngineSupportMeanFrac = 0.99953`
  - `northDryBeltOceanMarineWeakAscentSupportMeanFrac = 0.18488`
  - `northDryBeltOceanMarineMarginalSupersaturationSupportMeanFrac = 0.88424`
  - `northDryBeltOceanMarineLayerWindowSupportMeanFrac = 0.58917`

## Explanation

The old gate under-read the live branch for a specific reason:

- it inferred “subtropical suppression” through the downstream `marginalSubsiding` proxy
- that proxy depends heavily on `subtropicalSubsidenceDrying`
- the live marine condensation events are weak-engine and subtropical-band columns, but they are **not** strongly descending at the exact condensation instant
- so the legacy proxy collapses to `0.0374` even though the fresh vertical-state suppression signal is actually strong at `0.68321`

In other words:

- the signal is **not missing upstream**
- the signal is being **misrepresented downstream**

## Redesign Outcome

The first redesigned live-state gate was directionally correct but still too strict:

- `northDryBeltOceanLiveGateCandidateCondensationMeanKgM2 = 0.00065`
- `northDryBeltOceanLiveGatePotentialSuppressedMeanKgM2 = 0.00007`
- `northDryBeltOceanLiveGateHitMean = 0.07871`
- `northDryBeltOceanLiveGateSupportMeanFrac = 0.00033`

That means the redesign solved the **wrong-state** problem but still kept the **hard multiplicative occupancy** problem.

Why it stayed tiny:

- weak ascent is only `0.18488`
- layer-window support is only `0.58917`
- multiplying those terms by fresh suppression, weak-engine support, and marginal supersaturation still leaves very little candidate mass above the threshold

## Conclusion

Phase 1I is complete.

What we learned:

- the live marine maintenance loop is already in a subtropically suppressed branch state
- the legacy microphysics gate misses it because it keys off the wrong proxy
- a redesigned gate should use fresh vertical-state suppression as the primary regime key
- weak ascent should not remain a hard multiplicative occupancy gate; it should become a softer scaling or post-selection weight

## Next Phase

## Phase 1J: Soft-Ascent Live-State Gate Design

Focus:

- keep fresh vertical-state subtropical suppression as the primary regime selector
- keep weak-engine support as a confirming term
- demote weak-ascent from a hard occupancy limiter to a softer modulation term
- design the next candidate so it has meaningful live-run occupancy before any new physics suppression is attempted
