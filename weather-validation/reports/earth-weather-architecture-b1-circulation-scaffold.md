# Earth Weather Architecture B1 Circulation Scaffold

This report benchmarks circulation-first scaffold rebuild variants before any new partition re-porting is attempted.

## Quick candidates

### Narrow Band + Soft Containment

- mode: `narrow-band-soft-containment`
- description: Use the narrower lighter scaffold but restore only a small containment share to protect partition gains.
- improved metrics: 1 / 6
- severe regressions: itczWidthDeg
- quick pass: false
- distance gain: `-0.28`

- ITCZ width: off `25.91`, on `26.218`, improved `false`, severeRegression `true`
- NH dry-belt ratio: off `1.534`, on `1.504`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.201`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.16433`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `147.25094`, improved `false`, severeRegression `false`

### Narrow Band + Light Drying

- mode: `narrow-band-light-drying`
- description: Lighten the scaffold and pull the active subtropical drying band poleward into a narrower 18-30 degree lane.
- improved metrics: 1 / 6
- severe regressions: itczWidthDeg
- quick pass: false
- distance gain: `-0.285`

- ITCZ width: off `25.91`, on `26.22`, improved `false`, severeRegression `true`
- NH dry-belt ratio: off `1.534`, on `1.506`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.202`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.17242`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `147.39407`, improved `false`, severeRegression `false`

### Floor Reset + Light Drying

- mode: `floor-reset-light-drying`
- description: Reset the cross-hemi floor and weak-hemi boost, disable containment, and lighten the subtropical drying/theta scaffold.
- improved metrics: 1 / 6
- severe regressions: itczWidthDeg, subtropicalDryNorthRatio, subtropicalDrySouthRatio
- quick pass: false
- distance gain: `-1.975`

- ITCZ width: off `25.91`, on `27.444`, improved `false`, severeRegression `true`
- NH dry-belt ratio: off `1.534`, on `1.697`, improved `false`, severeRegression `true`
- SH dry-belt ratio: off `1.199`, on `1.478`, improved `false`, severeRegression `true`
- NH midlatitude westerlies: off `0.531`, on `0.532`, improved `true`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.16737`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `117.90357`, improved `false`, severeRegression `false`

## Selected candidate

- mode: `narrow-band-soft-containment`
- label: Narrow Band + Soft Containment
- quick pass: false

## Annual gate

- skipped because the best quick candidate did not clear the bounded entry gate

## Decision

- verdict: `quick_reject`
- next move: Architecture B1 failed the bounded quick screen across every scaffold candidate. Move to Architecture B2: explicit circulation-state port.

