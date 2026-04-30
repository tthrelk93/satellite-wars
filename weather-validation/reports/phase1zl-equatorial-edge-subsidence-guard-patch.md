# Phase 1ZL Equatorial-Edge Subsidence Guard Patch

## Verdict

- north_only_partial_guard_activation
- keep patch: `false`
- Next phase: Phase 1ZM: Bilateral Equatorial-Edge Source Redesign
- Do not enable the equatorial-edge subsidence guard by default. It improves only the north target lane, leaves the south mirror silent, and slightly worsens the climate guardrails.

## Climate Guardrails

- itcz width delta: `-0.001`
- dry north delta: `0.001`
- dry south delta: `-0.001`
- NH westerlies delta: `0`
- NH dry-belt ocean condensation delta: `0.00789`

## Bilateral Edge Result

- -3.75° condensation delta: `0.00126`
- -3.75° applied guard on: `0`
- 3.75° condensation delta: `0.00657`
- 3.75° applied guard on: `0.00072`

## Source-Lane Asymmetry

- -11.25° source support on: `0`
- 11.25° source support on: `0.1367`
- -3.75° target weight on: `0`
- 3.75° target weight on: `0.41491`

## Protected Lanes

- 18.75° spillover condensation delta: `0.00233`
- 33.75° target-entry applied suppression on: `0`
- 33.75° target-entry exclusion on: `1`

## Next Patch Contract

- keep: keep the Phase 1ZJ split-lane shoulder gate
- keep: keep the 33.75°N target-entry exclusion
- keep: keep the equatorial-edge subsidence guard diagnostics and runtime toggle
- change: redesign the guard source away from the NH-only inner-shoulder lane
- change: build a bilateral source carrier that can project into both -3.75° and 3.75° edge lanes
- change: treat this as a source-lane geometry problem before any amplitude increase
