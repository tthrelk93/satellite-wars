# Phase 1P Capped Transition-To-Return-Flow Coupling Patch

## Scope

- Compare mode: same-branch `off` vs `on`
- Phase 1M circulation containment kept on in both runs
- Phase 1K marine-maintenance patch kept on in both runs
- Off artifact: `/tmp/phase1p-returnflow-off.json`
- On artifact: `/tmp/phase1p-returnflow-on.json`

## Result

- Reject the patch as a default-on climate fix
- Keep the new diagnostics and runtime toggle
- Leave the coupling lane disabled by default on branch

## Day-30 Off Versus On

- `itczWidthDeg`: `25.834 -> 26.055`
- `subtropicalDryNorthRatio`: `1.515 -> 1.572`
- `subtropicalDrySouthRatio`: `1.192 -> 1.203`
- `midlatitudeWesterliesNorthU10Ms`: `0.531 -> 0.531`
- `midlatitudeWesterliesSouthU10Ms`: `0.851 -> 0.851`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.14647 -> 0.14768`
- `northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2`: `0.03934 -> 0.04136`

## New Coupling Diagnostics

- `northTransitionCirculationReboundContainmentMeanFrac`: `0.81272 -> 0.81411`
- `northTransitionCirculationReboundSuppressedSourceMeanFrac`: `0.00133 -> 0.00134`
- `northDryBeltCirculationReturnFlowOpportunityMeanFrac`: `0.00084 -> 0.00084`
- `northDryBeltCirculationReturnFlowCouplingAppliedMeanFrac`: `0 -> 0.00975`

## Interpretation

- The patch really was active.
- The same-hemisphere capped reinjection lane did apply a measurable amount of coupling in the NH dry belt.
- But that applied coupling did not move the actual circulation target:
  - NH westerlies stayed flat
  - return-flow opportunity stayed effectively unchanged
- At the same time, the climate guardrails moved the wrong way:
  - wider ITCZ
  - wetter north dry belt
  - wetter south dry belt
  - slightly higher residual ocean condensation

## Honest Conclusion

- The missing carrier is **not** “just add a capped share of suppressed transition source back into the subtropical source driver.”
- That source-driver lane is too upstream or too weakly connected to the real jet/return-flow response.
- The next phase should identify which downstream circulation carrier is actually missing:
  - source-driver to subtropical drying conversion
  - subtropical drying to low-level omega / descent response
  - or low-level descent to extratropical westerly recovery

## Next Phase

- Phase 1Q: Return-Flow Carrier Attribution
