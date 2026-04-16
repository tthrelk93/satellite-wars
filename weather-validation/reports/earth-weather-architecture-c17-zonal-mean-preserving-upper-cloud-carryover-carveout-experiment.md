# Earth Weather Architecture C17 Zonal-Mean-Preserving Upper-Cloud Carryover Carveout Experiment

This phase keeps the donor/current hybrid plus the C15 vertical-state contract, but tightens only the upper-cloud carry-input dominance carveout so the dry-belt carryover/persistence lane is cleared earlier. The goal is to preserve the zonal-mean equatorial relief from C15 without paying for it through renewed upper-cloud recirculation.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C18: carryover carveout implementation attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- carryover-carveout quick artifact: [earth-weather-architecture-c17-carryover-carveout-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c17-carryover-carveout-quick.json)

- ITCZ width: off `25.91`, on `23.454`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.121`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.511`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.202`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.14144`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-353.31687`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c17-carryover-carveout-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c17-carryover-carveout-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c17-carryover-carveout-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c17-carryover-carveout-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c17-carryover-carveout-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c17-carryover-carveout-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c17-carryover-carveout-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c17-carryover-carveout-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c17-carryover-carveout-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c17-carryover-carveout-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c17-carryover-carveout-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c17-carryover-carveout-quick-nh-dry-belt-source-sector-summary.json)

