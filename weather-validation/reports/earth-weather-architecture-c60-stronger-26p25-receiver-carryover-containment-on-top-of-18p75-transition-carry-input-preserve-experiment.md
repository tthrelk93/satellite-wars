# Earth Weather Architecture C60 Stronger 26p25 Receiver Carryover Containment On Top Of 18p75 Transition Carry-Input Preserve Experiment

This phase keeps the active C58 `18.75°` transition carry-input preserve fixed, but strengthens the `26.25°` receiver carryover containment. The goal is to recapture some of the receiver-side loss from C58 without giving back its small equatorial export relief.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C61: stronger 26p25 receiver carryover containment on top of 18p75 transition carry-input preserve attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.transitionBandOrganizedSupportRestoreLat0Deg, vertical5.transitionBandOrganizedSupportRestoreLat1Deg, vertical5.transitionBandOrganizedSupportRestoreLat2Deg, vertical5.transitionBandOrganizedSupportRestoreLat3Deg, vertical5.transitionBandOrganizedSupportRestoreMax, vertical5.receiverCarryoverContainment26p25Lat0Deg, vertical5.receiverCarryoverContainment26p25Lat1Deg, vertical5.receiverCarryoverContainment26p25Lat2Deg, vertical5.receiverCarryoverContainment26p25Lat3Deg, vertical5.receiverCarryoverContainment26p25Overlap0, vertical5.receiverCarryoverContainment26p25Overlap1, vertical5.receiverCarryoverContainment26p25Dry0, vertical5.receiverCarryoverContainment26p25Dry1, vertical5.receiverCarryoverContainment26p25Omega0, vertical5.receiverCarryoverContainment26p25Omega1, vertical5.receiverCarryoverContainment26p25MaxFrac, vertical5.transitionCarryInputPreserve18p75Lat0Deg, vertical5.transitionCarryInputPreserve18p75Lat1Deg, vertical5.transitionCarryInputPreserve18p75Lat2Deg, vertical5.transitionCarryInputPreserve18p75Lat3Deg, vertical5.transitionCarryInputPreserve18p75MinResidualMassFloor, vertical5.transitionCarryInputPreserve18p75PotentialMax, vertical5.transitionCarryInputPreserve18p75OrganizedSupportMax, vertical5.transitionCarryInputPreserve18p75SuppressionMin, vertical5.transitionCarryInputPreserve18p75DominanceMin, vertical5.strengthenedReceiverCarryoverContainment26p25MaxFrac

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- stronger 26p25 receiver carryover containment on top of 18p75 transition carry-input preserve quick artifact: [earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick.json)

- ITCZ width: off `25.91`, on `23.287`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.07`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.48`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.194`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.15491`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-318.81218`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c60-stronger-26p25-receiver-carryover-containment-on-top-of-18p75-transition-carry-input-preserve-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C59 showed C58 was a real middle state: modest equatorial export relief bought by reloading the `18.75°` transition row and the `26.25°` receiver row.
- This experiment keeps that broader transition carry-input preserve fixed and only strengthens the existing active `26.25°` receiver carryover containment.
- The bounded question is whether stronger receiver recapture can restore NH dry-belt metrics without collapsing the small sign-defect relief from C58.

