# Earth Weather Architecture A1 Balance Contract Experiment

This report benchmarks the explicit subtropical balance contract experiment against the current branch baseline using the bounded Architecture A workflow.

## Quick screen

- ITCZ width: off `25.91`, on `26.404`, improved `false`, severeRegression `true`
- NH dry-belt ratio: off `1.534`, on `1.743`, improved `false`, severeRegression `true`
- SH dry-belt ratio: off `1.199`, on `1.306`, improved `false`, severeRegression `true`
- NH midlatitude westerlies: off `0.531`, on `0.532`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.15915`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `120.33081`, improved `false`, severeRegression `false`

- improved metrics: 1 / 6
- severe regressions: itczWidthDeg, subtropicalDryNorthRatio, subtropicalDrySouthRatio
- quick pass: false

### Quick off
- north transition partition: `0.65035`
- north transition circulation: `0.54206`
- north transition contract: `0.5068`
- north dry-belt contract: `0.40963`
- south transition contract: `0.21148`
- south dry-belt contract: `0.19748`

### Quick on
- north transition partition: `0.65149`
- north transition circulation: `0.54148`
- north transition contract: `0.50762`
- north dry-belt contract: `0.40227`
- south transition contract: `0.20819`
- south dry-belt contract: `0.19395`

## Annual gate

- skipped because the quick screen failed the bounded entry gate

## Decision

- verdict: `quick_reject`
- next move: Architecture A1 failed the bounded quick screen. Move to Architecture A2: circulation-preserving partition port.

