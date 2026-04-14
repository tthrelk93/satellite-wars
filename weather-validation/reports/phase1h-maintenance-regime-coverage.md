# Phase 1H: Maintenance Regime Coverage

## Goal

Verify whether the rejected Phase 1G maintenance patch family ever governs the real 30-day climate drift on the current branch.

## Method

- Instrument the `qvVal > qsat` saturation-adjustment branch in [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js).
- Track candidate occupancy for the weak-engine, subtropically suppressed, marginal-supersaturation marine-maintenance regime.
- Compare that candidate occupancy against the actual ocean-side NH dry-belt large-scale condensation seen in the 30-day quick audit.
- Break down which support terms are present in live marine saturation-adjustment events even when the maintenance candidate does not fire.

## Result

The live 30-day climate does **not** occupy the rejected Phase 1G regime in any meaningful way.

From [phase1h-maintenance-trigger-coverage](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1h-maintenance-trigger-coverage.json):

- `northDryBeltLargeScaleCondensationMeanKgM2 = 0.17069`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.19722`
- `northDryBeltMaintenanceCandidateCondensationMeanKgM2 = 0`
- `northDryBeltOceanMaintenanceCandidateCondensationMeanKgM2 = 0`
- `northDryBeltMaintenancePotentialSuppressedMeanKgM2 = 0`
- `northDryBeltOceanMaintenancePotentialSuppressedMeanKgM2 = 0`
- `northDryBeltMaintenanceCandidateHitMean = 0`
- `northDryBeltOceanMaintenanceCandidateHitMean = 0`

That means the unit-test regime existed as a synthetic possibility, but it never actually owned the 30-day drift.

## Support Breakdown

From [phase1h-maintenance-support-breakdown](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1h-maintenance-support-breakdown.json), the real ocean-side NH dry-belt saturation-adjustment events look like this:

- `northDryBeltOceanMarineCondensationMeanKgM2 = 0.19722`
- `northDryBeltOceanMarineSubtropicalSupportMeanFrac = 0.0374`
- `northDryBeltOceanMarineWeakEngineSupportMeanFrac = 0.99953`
- `northDryBeltOceanMarineWeakAscentSupportMeanFrac = 0.18488`
- `northDryBeltOceanMarineMarginalSupersaturationSupportMeanFrac = 0.88424`
- `northDryBeltOceanMarineLayerWindowSupportMeanFrac = 0.58917`

## Interpretation

This is the important live-branch correction:

- weak-engine support is already nearly maximal
- marginal supersaturation is already common
- the missing condition is **not** weak-engine occupancy
- the main absent support term is **subtropical suppression**
- weak ascent is the secondary limiter

So the old Phase 1G patch family was aimed at the wrong live regime. The climate drift is still happening in ocean-side NH dry-belt saturation-adjustment events, but those events are not entering the strongly subtropically suppressed regime we expected.

## Conclusion

Phase 1G should stay rejected.

The next honest phase is:

## Phase 1I: Subtropical-Suppression Gate Redesign

Focus:

- explain why live ocean-side NH dry-belt saturation-adjustment events have almost no subtropical-suppression support
- determine whether the support signal is being diagnosed too late, too weakly, or from the wrong state variables
- redesign the gating around the actual live maintenance loop instead of the inert Phase 1G candidate regime

The key lesson is simple: the maintenance loop is real, but the current branch does not enter it through the regime envelope we originally assumed.
