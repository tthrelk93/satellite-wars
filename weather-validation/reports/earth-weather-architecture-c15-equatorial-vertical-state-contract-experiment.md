# Earth Weather Architecture C15 Equatorial Vertical-State Contract Experiment

This phase extends the C13 donor/current hybrid by overlaying the current vertical scaffold and patching only the donor-core vertical-state contract needed to drive that scaffold. The goal is to restore northward equatorial overturning without giving back the donor-hybrid dry-belt and NH-westerly gains.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C16: vertical-contract implementation attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched core path: `src/weather/v2/core5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds, vertParams.rhTrig, vertParams.rhMidMin, vertParams.omegaTrig, vertParams.instabTrig, vertParams.qvTrig, vertParams.thetaeCoeff, vertParams convective potential/organization timing block, vertParams tropicalOrganizationBandDeg, vertParams subtropicalSubsidence contract

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- vertical-contract quick artifact: [earth-weather-architecture-c15-vertical-contract-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c15-vertical-contract-quick.json)

- ITCZ width: off `25.91`, on `24.094`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.404`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.589`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.209`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.15331`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-364.55266`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c15-vertical-contract-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c15-vertical-contract-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c15-vertical-contract-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c15-vertical-contract-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c15-vertical-contract-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c15-vertical-contract-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c15-vertical-contract-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c15-vertical-contract-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c15-vertical-contract-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c15-vertical-contract-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c15-vertical-contract-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c15-vertical-contract-quick-nh-dry-belt-source-sector-summary.json)

