# Earth Weather Architecture B3 Rollback Circulation Splice

This report benchmarks direct rollback-leaning circulation splices on top of the stronger A2 floor/containment base instead of the weakened B1 scaffold.

## Quick candidates

### Ported Floor + Soft Containment + Omega

- mode: `ported-floor-soft-containment-omega`
- description: Use the A2 rollback-leaning floor and soft containment as the base, then reintroduce the drying-to-omega bridge directly on that splice.
- improved metrics: 2 / 6
- severe regressions: none
- quick pass: false
- distance gain: `0.092`

- ITCZ width: off `25.91`, on `25.837`, improved `true`, severeRegression `false`
- NH dry-belt ratio: off `1.534`, on `1.512`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.202`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.14213`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `144.56866`, improved `false`, severeRegression `false`

### Ported Floor + Soft Containment + Omega circulation state
- north transition low-level omega: `0.06651`
- north dry-belt low-level omega: `0.01613`
- north dry-belt return-flow opportunity: `0.00054`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0.81329`

### Ported Floor + Open Bundle

- mode: `ported-floor-open-bundle`
- description: Use the rollback-leaning floor with containment disabled and port the full direct bundle: return-flow, omega bridge, and weak-hemi taper.
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

### Ported Floor + Open Bundle circulation state
- north transition low-level omega: `0.06646`
- north dry-belt low-level omega: `0.01575`
- north dry-belt return-flow opportunity: `0`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0`

### Ported Floor + Soft Containment + Return-Flow

- mode: `ported-floor-soft-containment-return-flow`
- description: Use the A2 rollback-leaning floor and soft containment as the base, then reintroduce return-flow coupling directly on that splice.
- improved metrics: 0 / 6
- severe regressions: itczWidthDeg, subtropicalDryNorthRatio
- quick pass: false
- distance gain: `-0.184`

- ITCZ width: off `25.91`, on `26.049`, improved `false`, severeRegression `true`
- NH dry-belt ratio: off `1.534`, on `1.566`, improved `false`, severeRegression `true`
- SH dry-belt ratio: off `1.199`, on `1.212`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.15758`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `142.32673`, improved `false`, severeRegression `false`

### Ported Floor + Soft Containment + Return-Flow circulation state
- north transition low-level omega: `0.06682`
- north dry-belt low-level omega: `0.01469`
- north dry-belt return-flow opportunity: `0.00054`
- north dry-belt return-flow coupling: `0.00843`
- north transition containment: `0.81438`

## Selected candidate

- mode: `ported-floor-soft-containment-omega`
- label: Ported Floor + Soft Containment + Omega
- quick pass: false

### Quick baseline circulation state
- north transition low-level omega: `0.06668`
- north dry-belt low-level omega: `0.01507`
- north dry-belt return-flow opportunity: `0.00083`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0.81322`

### Quick selected circulation state
- north transition low-level omega: `0.06651`
- north dry-belt low-level omega: `0.01613`
- north dry-belt return-flow opportunity: `0.00054`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0.81329`

## Annual gate

- skipped because the best quick candidate did not clear the bounded entry gate

## Decision

- verdict: `quick_reject`
- next move: Architecture B3 failed the bounded quick screen across every direct rollback circulation splice. Move to Architecture C: code-level rollback/current hybridization design.

