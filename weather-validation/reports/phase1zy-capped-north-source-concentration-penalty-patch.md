# Phase 1ZY Capped North Source Concentration Penalty Patch

## Verdict

- north_source_relief_with_dry_core_redistribution
- keep patch: `false`
- Next phase: Phase 1ZZ: Source-Cap Redistribution Attribution
- Do not enable this penalty by default. It improves the 11.25°N source row, but the improvement is redistributed into the dry-belt core and south mirror rather than closing the climate lane cleanly.

## Main Guardrails

- itcz width delta: `-0.028`
- dry north delta: `-0.004`
- dry south delta: `0`
- NH westerlies delta: `0`
- north dry-belt ocean condensation delta: `0.00199`
- cross-equatorial vapor-flux delta: `0.33263`

## Source-Lane Outcome

- 11.25°N source condensation delta: `-0.0306`
- 18.75°N spillover condensation delta: `-0.00425`
- 26.25°N dry-core condensation delta: `0.0084`
- 3.75°N edge condensation delta: `0.00749`
- -3.75° edge condensation delta: `0.00001`
- -11.25° source condensation delta: `0.02652`

## Live Penalty State

- 11.25°N concentration penalty frac: `0.00583`
- 11.25°N concentration applied: `0.0022`
- 11.25°N upstream leak penalty frac: `0.06374`
- 11.25°N total-column-water delta: `-0.03`
- 11.25°N lower-omega delta: `-0.00006`
- 11.25°N mid-omega delta: `-0.00033`
