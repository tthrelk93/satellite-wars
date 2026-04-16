# Earth Weather Architecture C26 Partial Equatorial Shoulder Restore Experiment

This phase keeps the C24 inner-core narrowing as the base contract and restores only a modest amount of the outer equatorial shoulder. The goal is to recover some upper-branch and dry-belt containment relief without reverting to the broader lower-mid drag seen under C22.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C27: partial equatorial shoulder restore attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`, `src/weather/v2/windEddyNudge5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.enableEquatorialBandSoftening, windEddyParams.equatorialSofteningLat0Deg, windEddyParams.equatorialSofteningLat1Deg, windEddyParams.equatorialBlendToUnityFrac, windEddyNudge5 equatorial band softening branch, windEddyParams.innerCoreEquatorialSofteningLat0Deg, windEddyParams.innerCoreEquatorialSofteningLat1Deg, windEddyParams.innerCoreEquatorialBlendToUnityFrac, windEddyParams.partialShoulderRestoreLat1Deg, windEddyParams.partialShoulderRestoreBlendToUnityFrac

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- partial shoulder-restore quick artifact: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick.json)

- ITCZ width: off `25.91`, on `23.412`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.119`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.515`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.225`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.11952`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-353.85346`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-quick-nh-dry-belt-source-sector-summary.json)

