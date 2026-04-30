# Earth Weather Architecture C56 26p25 Carryover Containment With 18p75 Transition-Support Preserve Experiment

This phase keeps the active C54 `26.25°` receiver carryover-containment lane, but adds narrow `18.75°` transition-support preserve inside the organized-support restore contract. The goal is to keep the receiver relief while preventing the equatorward transition lane from paying for it with worse southward export.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C57: 26p25 carryover containment with 18p75 transition-support preserve attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.transitionBandOrganizedSupportRestoreLat0Deg, vertical5.transitionBandOrganizedSupportRestoreLat1Deg, vertical5.transitionBandOrganizedSupportRestoreLat2Deg, vertical5.transitionBandOrganizedSupportRestoreLat3Deg, vertical5.transitionBandOrganizedSupportRestoreMax, vertical5.receiverCarryoverContainment26p25Lat0Deg, vertical5.receiverCarryoverContainment26p25Lat1Deg, vertical5.receiverCarryoverContainment26p25Lat2Deg, vertical5.receiverCarryoverContainment26p25Lat3Deg, vertical5.receiverCarryoverContainment26p25Overlap0, vertical5.receiverCarryoverContainment26p25Overlap1, vertical5.receiverCarryoverContainment26p25Dry0, vertical5.receiverCarryoverContainment26p25Dry1, vertical5.receiverCarryoverContainment26p25Omega0, vertical5.receiverCarryoverContainment26p25Omega1, vertical5.receiverCarryoverContainment26p25MaxFrac, vertical5.transitionSupportPreserve18p75Lat0Deg, vertical5.transitionSupportPreserve18p75Lat1Deg, vertical5.transitionSupportPreserve18p75Lat2Deg, vertical5.transitionSupportPreserve18p75Lat3Deg, vertical5.transitionSupportPreserve18p75OrganizedSupportBoost

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- 26p25 carryover containment with 18p75 transition-support preserve quick artifact: [earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick.json)

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

- monthlyClimatologyJsonPath: [earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c56-26p25-carryover-containment-with-18p75-transition-support-preserve-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C55 showed the C54 receiver relief was real, but it worsened the `18.75°` transition-export lane and reloaded the `33.75°` shoulder.
- This experiment keeps the active `26.25°` carryover containment, but preserves organized-support admission only in the narrow `18.75°` transition lane.
- The bounded question is whether that equatorward transition preserve can recover the export side without giving back the receiver relief.

