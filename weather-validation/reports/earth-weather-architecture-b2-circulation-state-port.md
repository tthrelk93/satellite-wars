# Earth Weather Architecture B2 Circulation-State Port

This report benchmarks explicit circulation-state bundle ports on top of the best B1 scaffold instead of further broad scaffold rescaling.

## Quick candidates

### Soft Containment + Omega Port

- mode: `soft-containment-omega-port`
- description: Start from the best B1 scaffold and explicitly reintroduce the drying-to-omega bridge as the circulation-state carrier.
- improved metrics: 1 / 6
- severe regressions: itczWidthDeg
- quick pass: false
- distance gain: `-0.281`

- ITCZ width: off `25.91`, on `26.219`, improved `false`, severeRegression `true`
- NH dry-belt ratio: off `1.534`, on `1.504`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.201`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.16605`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `147.22336`, improved `false`, severeRegression `false`

### Soft Containment + Omega Port circulation state
- north transition low-level omega: `0.06673`
- north dry-belt low-level omega: `0.015`
- north dry-belt return-flow opportunity: `0.0002`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0.73704`

### Open Circulation Bundle

- mode: `open-circulation-bundle`
- description: Use the narrowed scaffold without containment and port the full circulation bundle: return-flow coupling, omega bridge, and weak-hemi taper.
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

### Open Circulation Bundle circulation state
- north transition low-level omega: `0.06678`
- north dry-belt low-level omega: `0.01502`
- north dry-belt return-flow opportunity: `0`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0`

### Soft Containment + Return-Flow Port

- mode: `soft-containment-return-flow-port`
- description: Start from the best B1 scaffold and explicitly reintroduce return-flow coupling as the circulation-state carrier.
- improved metrics: 1 / 6
- severe regressions: itczWidthDeg
- quick pass: false
- distance gain: `-0.291`

- ITCZ width: off `25.91`, on `26.231`, improved `false`, severeRegression `true`
- NH dry-belt ratio: off `1.534`, on `1.499`, improved `true`, severeRegression `false`
- SH dry-belt ratio: off `1.199`, on `1.204`, improved `false`, severeRegression `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`, severeRegression `false`
- NH dry-belt ocean condensation: off `0.1413`, on `0.17392`, improved `false`, severeRegression `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `146.18474`, improved `false`, severeRegression `false`

### Soft Containment + Return-Flow Port circulation state
- north transition low-level omega: `0.06658`
- north dry-belt low-level omega: `0.01495`
- north dry-belt return-flow opportunity: `0.0002`
- north dry-belt return-flow coupling: `0.00276`
- north transition containment: `0.73664`

## Selected candidate

- mode: `soft-containment-omega-port`
- label: Soft Containment + Omega Port
- quick pass: false

### Quick baseline circulation state
- north transition low-level omega: `0.06668`
- north dry-belt low-level omega: `0.01507`
- north dry-belt return-flow opportunity: `0.00083`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0.81322`

### Quick selected circulation state
- north transition low-level omega: `0.06673`
- north dry-belt low-level omega: `0.015`
- north dry-belt return-flow opportunity: `0.0002`
- north dry-belt return-flow coupling: `0`
- north transition containment: `0.73704`

## Annual gate

- skipped because the best quick candidate did not clear the bounded entry gate

## Decision

- verdict: `quick_reject`
- next move: Architecture B2 failed the bounded quick screen across every explicit circulation-state port. Move to Architecture B3: direct rollback circulation splice.

