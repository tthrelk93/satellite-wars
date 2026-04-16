# Earth Weather Architecture C32 Organized-Support Carry-Input Carveout Experiment

This phase keeps the C30 weak-restore carry-input recapture base fixed, but restores stricter organized-support and convective-potential caps. The goal is to preserve the C30 dry-belt receiver relief while preventing the stronger recapture from over-admitting organized equatorial cells and worsening the eddy/export branch.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C33: organized-support carry-input carveout attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2, vertical5.organizedSupportCarryInputCarveoutMax, vertical5.potentialCarryInputCarveoutMax

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- organized-support carry-input carveout quick artifact: [earth-weather-architecture-c32-organized-support-carry-input-carveout-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c32-organized-support-carry-input-carveout-quick.json)

- ITCZ width: off `25.91`, on `23.374`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.122`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.493`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.219`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.10807`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-356.96839`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c32-organized-support-carry-input-carveout-quick-nh-dry-belt-source-sector-summary.json)

