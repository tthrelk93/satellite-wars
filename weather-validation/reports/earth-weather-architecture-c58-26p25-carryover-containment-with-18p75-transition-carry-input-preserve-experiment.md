# Earth Weather Architecture C58 26p25 Carryover Containment With 18p75 Transition Carry-Input Preserve Experiment

This phase keeps the active C54 `26.25°` receiver carryover-containment lane, but broadens the `18.75°` preserve from a single organized-support cap into a local transition carry-input contract. The goal is to recover the `18.75°` transition-export lane without giving back the receiver relief.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C59: 26p25 carryover containment with 18p75 transition carry-input preserve attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.transitionBandOrganizedSupportRestoreLat0Deg, vertical5.transitionBandOrganizedSupportRestoreLat1Deg, vertical5.transitionBandOrganizedSupportRestoreLat2Deg, vertical5.transitionBandOrganizedSupportRestoreLat3Deg, vertical5.transitionBandOrganizedSupportRestoreMax, vertical5.receiverCarryoverContainment26p25Lat0Deg, vertical5.receiverCarryoverContainment26p25Lat1Deg, vertical5.receiverCarryoverContainment26p25Lat2Deg, vertical5.receiverCarryoverContainment26p25Lat3Deg, vertical5.receiverCarryoverContainment26p25Overlap0, vertical5.receiverCarryoverContainment26p25Overlap1, vertical5.receiverCarryoverContainment26p25Dry0, vertical5.receiverCarryoverContainment26p25Dry1, vertical5.receiverCarryoverContainment26p25Omega0, vertical5.receiverCarryoverContainment26p25Omega1, vertical5.receiverCarryoverContainment26p25MaxFrac, vertical5.transitionCarryInputPreserve18p75Lat0Deg, vertical5.transitionCarryInputPreserve18p75Lat1Deg, vertical5.transitionCarryInputPreserve18p75Lat2Deg, vertical5.transitionCarryInputPreserve18p75Lat3Deg, vertical5.transitionCarryInputPreserve18p75MinResidualMassFloor, vertical5.transitionCarryInputPreserve18p75PotentialMax, vertical5.transitionCarryInputPreserve18p75OrganizedSupportMax, vertical5.transitionCarryInputPreserve18p75SuppressionMin, vertical5.transitionCarryInputPreserve18p75DominanceMin

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- 26p25 carryover containment with 18p75 transition carry-input preserve quick artifact: [earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick.json)

- ITCZ width: off `25.91`, on `23.634`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.231`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.497`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.194`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.13447`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-351.9993`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c58-26p25-carryover-containment-with-18p75-transition-carry-input-preserve-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C57 showed the narrow `18.75°` organized-support-only preserve was completely inert relative to C54.
- This experiment therefore preserves the broader local transition carry-input contract around `18.75°`: organized-support max, potential max, subtropical-suppression floor, dominance floor, and minimum residual-mass gate.
- The bounded question is whether that broader local carry-input preserve can improve the export side while keeping the active `26.25°` receiver containment intact.

