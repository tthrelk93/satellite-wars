# Earth Weather Architecture C20 Zonal-Mean-Preserving Eddy Nudge Softening Experiment

This phase keeps the C17 carryover carveout intact and softens only the surface eddy-energy rescaling contract. The goal is to relieve the remaining equatorial eddy/export sign defect without giving back the stronger zonal-mean, dry-belt, and ITCZ metrics from C17.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C21: eddy-softening implementation attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched paths: `src/weather/v2/core5.js`, `src/weather/v2/vertical5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract, vertical5.carryInputSubtropicalSuppressionMin, vertical5.carryInputOrganizedSupportMax, vertical5.carryInputPotentialMax, vertical5.carryInputDominanceMin, vertical5.carryInputMinResidualMassKgM2, windEddyParams.tauSeconds, windEddyParams.scaleClampMin, windEddyParams.scaleClampMax

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- eddy-softening quick artifact: [earth-weather-architecture-c20-eddy-softening-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c20-eddy-softening-quick.json)

- ITCZ width: off `25.91`, on `23.26`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.152`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.504`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.209`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.13877`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-361.48916`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c20-eddy-softening-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c20-eddy-softening-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c20-eddy-softening-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c20-eddy-softening-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c20-eddy-softening-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c20-eddy-softening-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c20-eddy-softening-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c20-eddy-softening-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c20-eddy-softening-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c20-eddy-softening-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c20-eddy-softening-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c20-eddy-softening-quick-nh-dry-belt-source-sector-summary.json)

