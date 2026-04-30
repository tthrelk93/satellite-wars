# Earth Weather Architecture C50 Partial 26p25 Receiver-Guard Transition-Band Experiment

This phase keeps the strict C32 organized-support / potential carveout fixed in the equatorial core and keeps the proven C40 transition-band restore active, but it partially guards the `26.25°` receiver lane. The goal is to preserve the small C40 sign-relief signal while reducing the modest inner dry-belt reload that comes with that regime.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C51: partial 26p25 receiver-guard transition-band attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.transitionBandOrganizedSupportRestoreLat0Deg, vertical5.transitionBandOrganizedSupportRestoreLat1Deg, vertical5.transitionBandOrganizedSupportRestoreLat2Deg, vertical5.transitionBandOrganizedSupportRestoreLat3Deg, vertical5.transitionBand26p25ReceiverGuardLat0Deg, vertical5.transitionBand26p25ReceiverGuardLat1Deg, vertical5.transitionBand26p25ReceiverGuardLat2Deg, vertical5.transitionBand26p25ReceiverGuardLat3Deg, vertical5.transitionBand26p25ReceiverGuardPenalty

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- partial 26p25 receiver-guard transition-band quick artifact: [earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick.json)

- ITCZ width: off `25.91`, on `23.386`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.128`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.49`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.225`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.11898`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-355.94778`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c50-partial-26p25-receiver-guard-transition-band-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C49 showed the tapered shoulder is not a new family state; it reproduces the earlier C40 transition-band regime exactly.
- This experiment keeps that live transition-band geometry but partially guards the `26.25°` receiver lane instead of reworking the shoulder again.
- The bounded question is whether a smaller `26.25°` reload can preserve the small sign-relief signal without collapsing back to C32 or reopening the broader C30 tradeoff.

