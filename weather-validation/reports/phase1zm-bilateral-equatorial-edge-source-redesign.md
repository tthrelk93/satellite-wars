# Phase 1ZM Bilateral Equatorial-Edge Source Redesign

## Verdict

- signed_latitude_window_inheritance
- Next phase: Phase 1ZN: Implement Mirrored Bilateral Edge-Source Window Patch
- Do not retune amplitude. Replace the guard’s inherited NH-only shoulder source/target admission with bilateral abs-lat source and target windows, while preserving the NH target-entry exclusion as a separate lane.

## Why Phase 1ZL Could Not Become Bilateral

- north source support on: `0.1367`
- south source support on: `0`
- north target weight on: `0.41491`
- south target weight on: `0`
- north applied guard on: `0.00072`
- south applied guard on: `0`

## Signed-Latitude Inheritance Evidence

- north inner-shoulder window on: `1`
- south inner-shoulder window on: `0`
- north edge window on: `1`
- south edge window on: `0`
- target-entry exclusion on: `1`
- signed-latitude inheritance score: `1`

## Residual Edge Response

- 3.75° condensation delta: `0.00657`
- -3.75° condensation delta: `0.00126`

## Next Patch Contract

- keep: keep Phase 1ZJ split-lane shoulder gating
- keep: keep Phase 1ZL diagnostics and runtime toggle
- keep: keep the NH 30-45° target-entry exclusion as a separate non-mirrored lane
- change: stop sourcing the equatorial-edge guard from freshShoulderInnerWindowDiagFrac
- change: stop targeting the equatorial-edge guard from freshShoulderEquatorialEdgeWindowDiagFrac
- change: build dedicated bilateral source windows from abs(lat) for 8-14° edge-source rows
- change: build dedicated bilateral target windows from abs(lat) for 2-6° edge lanes
- change: preserve hemisphere-local application instead of coupling through NH-only window geometry
- do not: do not increase equatorial-edge guard amplitude first
- do not: do not mirror the NH 30-45° target-entry exclusion into the south
- do not: do not push this back into the shoulder-selector lane in microphysics
