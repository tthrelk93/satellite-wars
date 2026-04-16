# Earth Weather Architecture C54 26p25 Receiver Carryover Containment Transition-Band Experiment

This phase keeps the strict C32 core carveout fixed and keeps the live C40 transition-band organized-support restore active, but it adds narrow `26.25°` receiver-lane carryover containment. The goal is to preserve the transition-band sign-relief family while reducing the downstream upper-cloud persistence that the organized-support guard failed to touch.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C55: 26p25 receiver carryover containment transition-band attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.transitionBandOrganizedSupportRestoreLat0Deg, vertical5.transitionBandOrganizedSupportRestoreLat1Deg, vertical5.transitionBandOrganizedSupportRestoreLat2Deg, vertical5.transitionBandOrganizedSupportRestoreLat3Deg, vertical5.transitionBandOrganizedSupportRestoreMax, vertical5.receiverCarryoverContainment26p25Lat0Deg, vertical5.receiverCarryoverContainment26p25Lat1Deg, vertical5.receiverCarryoverContainment26p25Lat2Deg, vertical5.receiverCarryoverContainment26p25Lat3Deg, vertical5.receiverCarryoverContainment26p25Overlap0, vertical5.receiverCarryoverContainment26p25Overlap1, vertical5.receiverCarryoverContainment26p25Dry0, vertical5.receiverCarryoverContainment26p25Dry1, vertical5.receiverCarryoverContainment26p25Omega0, vertical5.receiverCarryoverContainment26p25Omega1, vertical5.receiverCarryoverContainment26p25MaxFrac

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- 26p25 receiver carryover containment quick artifact: [earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick.json)

- ITCZ width: off `25.91`, on `23.333`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.124`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.496`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.201`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.12942`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-362.46654`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c54-26p25-receiver-carryover-containment-transition-band-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C53 showed the strong `26.25°` organized-support guard was still inert and left the receiver row unchanged.
- This experiment keeps the same live transition-band geometry but moves one step downstream and contains upper-cloud carryover / persistence only inside the `26.25°` receiver lane.
- The bounded question is whether the receiver reload can be reduced without collapsing the broader transition-band sign-relief family.

