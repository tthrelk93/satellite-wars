# Earth Weather Architecture C13 Equatorial Overturning Sign Contract Experiment

This phase implements the Architecture C12 preserve-layer contract: keep the donor circulation scaffold, forward-port the current low-level momentum/nudging preserve layer, and patch only the donor-core low-level sign-control defaults.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C14: sign-contract implementation attribution

## Implementation contract

- bridged file count: 6
- rewritten relative import count: 27
- patched core path: `src/weather/v2/core5.js`
- patched params: nudgeParams.tauQvS, nudgeParams.tauQvColumn, nudgeParams organized/subsidence relief quartet, windNudgeParams.tauSurfaceSeconds

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- sign-contract quick artifact: [earth-weather-architecture-c13-sign-contract-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c13-sign-contract-quick.json)

- ITCZ width: off `25.91`, on `23.884`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.152`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.585`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.232`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.12628`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-330.9854`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c13-sign-contract-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c13-sign-contract-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c13-sign-contract-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c13-sign-contract-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c13-sign-contract-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c13-sign-contract-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c13-sign-contract-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c13-sign-contract-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c13-sign-contract-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c13-sign-contract-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c13-sign-contract-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c13-sign-contract-quick-nh-dry-belt-source-sector-summary.json)

