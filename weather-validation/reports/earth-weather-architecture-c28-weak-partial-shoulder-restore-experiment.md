# Earth Weather Architecture C28 Weak Partial Shoulder Restore Experiment

This phase keeps the C24 inner-core narrowing, but restores only a weaker outer shoulder than C26. The goal is to preserve some of C26’s upper-branch and return-flow recovery without reloading the lower branch as strongly.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C29: weak partial shoulder restore attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.weakPartialShoulderRestoreLat1Deg, windEddyParams.weakPartialShoulderRestoreBlendToUnityFrac

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- weak partial shoulder-restore quick artifact: [earth-weather-architecture-c28-weak-partial-shoulder-restore-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c28-weak-partial-shoulder-restore-quick.json)

- ITCZ width: off `25.91`, on `23.321`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.097`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.487`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.202`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.15539`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-323.23581`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c28-weak-partial-shoulder-restore-quick-nh-dry-belt-source-sector-summary.json)

