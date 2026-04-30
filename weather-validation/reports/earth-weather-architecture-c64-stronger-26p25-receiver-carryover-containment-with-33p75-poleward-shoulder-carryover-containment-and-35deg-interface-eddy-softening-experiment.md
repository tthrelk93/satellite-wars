# Earth Weather Architecture C64 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment And 35deg Interface Eddy Softening Experiment

This phase keeps the active C62 `18.75°`, `26.25°`, and `33.75°` carryover controls fixed, then softens eddy-energy rescaling only in a narrow `35°` interface band. The goal is to reduce the remaining eddy-side NH dry-belt import burden without reopening the receiver and shoulder maintenance families that C62 had just recovered.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C65: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.transitionBandOrganizedSupportRestoreLat0Deg, vertical5.transitionBandOrganizedSupportRestoreLat1Deg, vertical5.transitionBandOrganizedSupportRestoreLat2Deg, vertical5.transitionBandOrganizedSupportRestoreLat3Deg, vertical5.transitionBandOrganizedSupportRestoreMax, vertical5.receiverCarryoverContainment26p25Lat0Deg, vertical5.receiverCarryoverContainment26p25Lat1Deg, vertical5.receiverCarryoverContainment26p25Lat2Deg, vertical5.receiverCarryoverContainment26p25Lat3Deg, vertical5.receiverCarryoverContainment26p25Overlap0, vertical5.receiverCarryoverContainment26p25Overlap1, vertical5.receiverCarryoverContainment26p25Dry0, vertical5.receiverCarryoverContainment26p25Dry1, vertical5.receiverCarryoverContainment26p25Omega0, vertical5.receiverCarryoverContainment26p25Omega1, vertical5.receiverCarryoverContainment26p25MaxFrac, vertical5.transitionCarryInputPreserve18p75Lat0Deg, vertical5.transitionCarryInputPreserve18p75Lat1Deg, vertical5.transitionCarryInputPreserve18p75Lat2Deg, vertical5.transitionCarryInputPreserve18p75Lat3Deg, vertical5.transitionCarryInputPreserve18p75MinResidualMassFloor, vertical5.transitionCarryInputPreserve18p75PotentialMax, vertical5.transitionCarryInputPreserve18p75OrganizedSupportMax, vertical5.transitionCarryInputPreserve18p75SuppressionMin, vertical5.transitionCarryInputPreserve18p75DominanceMin, vertical5.strengthenedReceiverCarryoverContainment26p25MaxFrac, vertical5.polewardShoulderCarryoverContainment33p75Lat0Deg, vertical5.polewardShoulderCarryoverContainment33p75Lat1Deg, vertical5.polewardShoulderCarryoverContainment33p75Lat2Deg, vertical5.polewardShoulderCarryoverContainment33p75Lat3Deg, vertical5.polewardShoulderCarryoverContainment33p75Overlap0, vertical5.polewardShoulderCarryoverContainment33p75Overlap1, vertical5.polewardShoulderCarryoverContainment33p75Dry0, vertical5.polewardShoulderCarryoverContainment33p75Dry1, vertical5.polewardShoulderCarryoverContainment33p75Omega0, vertical5.polewardShoulderCarryoverContainment33p75Omega1, vertical5.polewardShoulderCarryoverContainment33p75MaxFrac, windEddyParams.enable35degInterfaceEddySoftening, windEddyParams.interfaceEddySofteningLat0Deg, windEddyParams.interfaceEddySofteningLat1Deg, windEddyParams.interfaceEddySofteningLat2Deg, windEddyParams.interfaceEddySofteningLat3Deg, windEddyParams.interfaceEddyBlendToUnityFrac, windEddyNudge5 35deg interface eddy softening branch

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- 35deg interface eddy-softening quick artifact: [earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-quick.json)

- ITCZ width: off `25.91`, on `23.237`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.14`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.518`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.216`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.13472`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-361.01`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c64-35deg-interface-eddy-softening-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C63 showed that C62 already recaptures the receiver and NH ocean rebound lanes, and that the remaining live blocker is now concentrated in the `35°` eddy import branch rather than the zonal-mean branch.
- This experiment holds the active C62 carryover-containment geometry fixed and changes only the `windEddyNudge5.js` rescaling behavior near the `35°` interface.
- The bounded question is whether the remaining sign defect can be reduced by easing that eddy-side repayment lane without reopening the `26.25°` receiver or the `33.75°` shoulder maintenance families.

