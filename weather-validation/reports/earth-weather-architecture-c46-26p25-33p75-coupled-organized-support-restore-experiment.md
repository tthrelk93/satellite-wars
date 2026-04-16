# Earth Weather Architecture C46 26p25-33p75 Coupled Organized-Support Restore Experiment

This phase keeps the strict C32 organized-support / potential carveout fixed in the equatorial core and restores organized-support only across the coupled `26.25°–33.75°` poleward shoulder. The goal is to test whether that coupled shoulder is sufficient to recreate the only live C40 signal without reactivating the full broad transition band.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C47: 26p25-33p75 coupled organized-support restore attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.coupled26p25_33p75OrganizedSupportRestoreLat0Deg, vertical5.coupled26p25_33p75OrganizedSupportRestoreLat1Deg, vertical5.coupled26p25_33p75OrganizedSupportRestoreLat2Deg, vertical5.coupled26p25_33p75OrganizedSupportRestoreLat3Deg, vertical5.coupled26p25_33p75OrganizedSupportRestoreMax

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- 26p25-33p75 coupled organized-support restore quick artifact: [earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick.json)

- ITCZ width: off `25.91`, on `23.315`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.093`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.502`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.232`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.12693`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-353.96486`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c46-26p25-33p75-coupled-organized-support-restore-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C45 showed the `26.25°` lane alone is not sufficient, so this experiment restores the coupled poleward shoulder directly.
- The bounded question is whether the `26.25°–33.75°` pair is sufficient to recreate the small C40 sign-relief signal without needing the full broad transition-band geometry.

