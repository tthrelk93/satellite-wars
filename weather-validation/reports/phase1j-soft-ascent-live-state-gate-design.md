# Phase 1J: Soft-Ascent Live-State Gate Design

## Goal

Redesign the live maintenance-loop gate so it is active in the real 30-day branch state without turning into a broad global suppressor.

## Method

- Kept the fresh vertical-state subtropical signals introduced in Phase 1I:
  - fresh subtropical suppression
  - fresh subtropical-band support
  - fresh organized support
  - fresh RH-mid support
- Left the strict Phase 1I live gate in place for comparison.
- Added a new **soft live-state gate** in [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js) that:
  - uses fresh subtropical suppression as the primary selector
  - keeps weak-engine support as a confirming term
  - keeps marginal supersaturation and layer support in the selector
  - demotes weak ascent from a hard multiplicative occupancy limiter to a softer modulation term
- Exposed the new gate in [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js) and [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs).
- Verified with focused tests and a real 30-day quick audit at [phase1j-soft-ascent-live-gate.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1j-soft-ascent-live-gate.json).

## Result

Phase 1J succeeded.

The redesigned soft gate is finally active on the real live branch state.

Day-30 NH dry-belt ocean metrics:

- marine condensation still present:
  - `northDryBeltOceanMarineCondensationMeanKgM2 = 0.19722`
- strict Phase 1I live gate:
  - `northDryBeltOceanLiveGateCandidateCondensationMeanKgM2 = 0.00065`
  - `northDryBeltOceanLiveGatePotentialSuppressedMeanKgM2 = 0.00007`
  - `northDryBeltOceanLiveGateHitMean = 0.07871`
  - `northDryBeltOceanLiveGateSupportMeanFrac = 0.00033`
- new soft Phase 1J live gate:
  - `northDryBeltOceanSoftLiveGateCandidateCondensationMeanKgM2 = 0.18498`
  - `northDryBeltOceanSoftLiveGatePotentialSuppressedMeanKgM2 = 0.02092`
  - `northDryBeltOceanSoftLiveGateHitMean = 3.36967`
  - `northDryBeltOceanSoftLiveGateSelectorSupportMeanFrac = 0.41471`
  - `northDryBeltOceanSoftLiveGateAscentModulationMeanFrac = 0.41263`

## Interpretation

This is the key outcome:

- the live gate is now selecting a **meaningful** share of the real NH dry-belt ocean condensation path
- the selector remains anchored on fresh vertical-state subtropical suppression rather than the old downstream `marginalSubsiding` proxy
- weak ascent is still part of the story, but it now behaves like a strength modulator instead of a gate that kills occupancy

In practical terms:

- Phase 1I proved the old gate was reading the wrong state
- Phase 1J proves the corrected live-state family can actually see the branch we care about

## Limits

This phase was diagnostic/design only. It does **not** change climate physics yet.

The 30-day climate is still the same bad branch state:

- `itczWidthDeg = 26.415`
- `subtropicalDryNorthRatio = 1.704`
- `subtropicalDrySouthRatio = 1.296`

So the right conclusion is not “the bug is fixed.”  
The right conclusion is “we finally have the right live gate to target with the next physics patch.”

## Conclusion

Phase 1J is complete and successful.

The next honest phase is:

## Phase 1K: Implement Soft Live-State Maintenance Suppression Patch

Focus:

- apply a narrow physics suppression only inside the new soft live-state gate
- keep the patch scoped to the real NH dry-belt marine maintenance loop
- verify first with same-branch patch `off/on` compare
- only then retry the 30-day climate gate
