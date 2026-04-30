# Earth Weather Architecture A2 Partition Port

This report benchmarks rollback-leaning circulation ports that preserve the current branch partition microphysics while relaxing the current branch circulation dampers.

## Quick candidates

### Ported Floor + Soft Containment

- mode: `ported-floor-soft-containment`
- description: Keep the rollback-leaning floor while restoring only a lighter containment scale instead of the current branch damper.
- improved metrics: 2 / 6
- severe regressions: none
- quick pass: false
- distance gain: `0.11`

- ITCZ width: off `25.91`, on `25.826`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.507`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.2`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.14845`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `144.63218`, improved `false`, severeRegression `false`

### Ported Floor

- mode: `ported-floor`
- description: Disable containment and shift the cross-hemi floor / weak-hemi boost to a rollback-leaning circulation floor.
- improved metrics: 2 / 6
- severe regressions: none
- quick pass: false
- distance gain: `0.078`

- ITCZ width: off `25.91`, on `25.853`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.511`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.201`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.1387`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `144.689`, improved `false`, severeRegression `false`

### Containment Off

- mode: `containment-off`
- description: Disable circulation rebound containment while keeping the current branch source-floor inheritance and weak-hemi boost.
- improved metrics: 0 / 6
- severe regressions: none
- quick pass: false
- distance gain: `-0.07`

- ITCZ width: off `25.91`, on `25.962`, improved `false`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.548`, improved `false`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.203`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.15091`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `143.07849`, improved `false`, severeRegression `false`

## Selected candidate

- mode: `ported-floor-soft-containment`
- label: Ported Floor + Soft Containment
- quick pass: false

## Annual gate

- skipped because the best quick candidate did not clear the bounded entry gate

## Decision

- verdict: `quick_reject`
- next move: Architecture A2 failed the bounded quick screen across every rollback-leaning port. Move to Architecture B: circulation-first partition rebuild.

