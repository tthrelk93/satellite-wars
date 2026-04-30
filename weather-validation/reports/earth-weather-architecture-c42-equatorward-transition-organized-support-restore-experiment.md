# Earth Weather Architecture C42 Equatorward-Transition Organized-Support Restore Experiment

This phase keeps the strict C32 organized-support / potential carveout fixed in the equatorial core and narrows the transition-band restore equatorward so it still reaches the 18.75°-class transition rows but backs away from the 26.25° receiver lane.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C43: equatorward-transition organized-support restore attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.equatorwardTransitionOrganizedSupportRestoreLat0Deg, vertical5.equatorwardTransitionOrganizedSupportRestoreLat1Deg, vertical5.equatorwardTransitionOrganizedSupportRestoreLat2Deg, vertical5.equatorwardTransitionOrganizedSupportRestoreLat3Deg, vertical5.equatorwardTransitionOrganizedSupportRestoreMax

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- equatorward-transition organized-support restore quick artifact: [earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick.json)

- ITCZ width: off `25.91`, on `23.374`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.122`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.493`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.219`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.10807`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-356.96839`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c42-equatorward-transition-organized-support-restore-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C41 showed the broad transition-band restore was active, but it shifted part of the load into the 26.25° receiver lane.
- This experiment narrows the restore equatorward so it still reaches the live transition subset while trying to avoid reopening the receiver lane.

