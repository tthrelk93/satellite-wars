# Earth Weather Architecture C10 Cycled Hybrid Benchmark Rerun

This phase reruns the bridged donor/current hybrid benchmark after restoring both the donor-worktree cycle contract and the missing terrain fixture runtime contract.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `quick_reject`
- next move: Architecture C11: cycled hybrid flux inversion attribution

## Hybrid runtime status

- bridged file count: 6
- rewritten relative import count: 27
- quick artifact: [earth-weather-architecture-c10-bridged-hybrid-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick.json)
- annual artifact: not run

## Copied supporting artifacts

- monthlyClimatologyJsonPath: [earth-weather-architecture-c10-bridged-hybrid-quick-monthly-climatology.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-monthly-climatology.json)
- moistureAttributionJsonPath: [earth-weather-architecture-c10-bridged-hybrid-quick-moisture-attribution.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-moisture-attribution.json)
- transportInterfaceBudgetJsonPath: [earth-weather-architecture-c10-bridged-hybrid-quick-transport-interface-budget.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-transport-interface-budget.json)
- hadleyPartitionSummaryJsonPath: [earth-weather-architecture-c10-bridged-hybrid-quick-hadley-partition-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-hadley-partition-summary.json)
- thermodynamicSupportSummaryJsonPath: [earth-weather-architecture-c10-bridged-hybrid-quick-thermodynamic-support-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-thermodynamic-support-summary.json)
- nhDryBeltSourceSectorSummaryJsonPath: [earth-weather-architecture-c10-bridged-hybrid-quick-nh-dry-belt-source-sector-summary.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick-nh-dry-belt-source-sector-summary.json)

## Quick benchmark

- current quick artifact: [earth-weather-architecture-c7-current-off-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c7-current-off-quick.json)
- hybrid quick artifact: [earth-weather-architecture-c10-bridged-hybrid-quick.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/earth-weather-architecture-c10-bridged-hybrid-quick.json)

- ITCZ width: off `25.91`, on `24.221`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.317`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `0.593`, improved `true`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `1.061`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.14095`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `-371.9765`, improved `false`, severeRegression `true`

- improved metrics: 4 / 6
- severe regressions: crossEquatorialVaporFluxNorthKgM_1S
- quick gate pass: false

