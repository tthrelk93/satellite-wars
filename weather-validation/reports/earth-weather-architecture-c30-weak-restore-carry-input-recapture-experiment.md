# Earth Weather Architecture C30 Weak Restore Carry-Input Recapture Experiment

This phase keeps the C28 weak shoulder geometry fixed and strengthens the dry-belt carry-input override. The goal is to preserve the improved cross-equatorial transport from C28 while forcing dry-belt carryover and ocean condensation back down.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C31: weak-restore carry-input recapture attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac, vertical5.weakRestoreCarryInputRecaptureSubtropicalSuppressionMin, vertical5.weakRestoreCarryInputRecaptureOrganizedSupportMax, vertical5.weakRestoreCarryInputRecapturePotentialMax, vertical5.weakRestoreCarryInputRecaptureDominanceMin, vertical5.weakRestoreCarryInputRecaptureMinResidualMassKgM2

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- weak-restore carry-input recapture quick artifact: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick.json)

- ITCZ width: off `25.91`, on `23.315`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.093`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.502`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.232`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.12693`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-353.96486`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c30-weak-restore-carry-input-recapture-quick-nh-dry-belt-source-sector-summary.json)

