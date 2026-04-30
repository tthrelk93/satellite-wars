# Earth Weather Architecture C40 Transition-Band Organized-Support Restore Experiment

This phase keeps the strict C32 organized-support / potential carveout fixed in the equatorial core, but restores organized-support admission only across the active transition-band rows where the carry-input override is actually accumulating. The goal is to recover the blocked transition subset without reopening the full receiver side.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C41: transition-band organized-support restore attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax, vertical5.transitionBandOrganizedSupportRestoreLat0Deg, vertical5.transitionBandOrganizedSupportRestoreLat1Deg, vertical5.transitionBandOrganizedSupportRestoreLat2Deg, vertical5.transitionBandOrganizedSupportRestoreLat3Deg, vertical5.transitionBandOrganizedSupportRestoreMax

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- transition-band organized-support restore quick artifact: [earth-weather-architecture-c40-transition-band-organized-support-restore-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c40-transition-band-organized-support-restore-quick.json)

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

- monthlyClimatologyJsonPath: [earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c40-transition-band-organized-support-restore-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c40-transition-band-organized-support-restore-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c40-transition-band-organized-support-restore-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c40-transition-band-organized-support-restore-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c40-transition-band-organized-support-restore-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c40-transition-band-organized-support-restore-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c40-transition-band-organized-support-restore-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c40-transition-band-organized-support-restore-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c40-transition-band-organized-support-restore-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c40-transition-band-organized-support-restore-quick-nh-dry-belt-source-sector-summary.json)

## Interpretation

- Architecture C39 showed the inner-core restore was inert because the live carry-input override rows were outside the core taper.
- This experiment moves the organized-support restore directly onto the active transition band while leaving the strict C32 core carveout intact.
- The bounded question is whether that geometry can recover the blocked subset without reopening the broader receiver regime.

