# Phase 1ZQ Capped Northside Fanout Leak Penalty Patch

## Verdict

- northside_leak_penalty_inert_zero_live_admission
- keep patch: `false`
- Next phase: Phase 1ZR: Northside Leak Penalty Admission Attribution
- Keep the 1ZQ plumbing and diagnostics, but leave the leak-penalty disabled by default. The live 11.25°N source lane keeps positive equatorial-edge source support while the new penalty stays at zero, so the next step is admission attribution rather than amplitude tuning.

## Live 30-Day Compare

- itcz width delta: `0`
- dry north delta: `0`
- dry south delta: `0`
- NH dry-belt ocean condensation delta: `0`
- NH westerlies delta: `0`

## Why This Failed

- 11.25°N source support on: `0.13665`
- 11.25°N leak penalty on: `0`
- 3.75°N condensation delta: `0`
- 18.75°N condensation delta: `0`
- 26.25°N condensation delta: `0`
- -3.75° condensation delta: `0`

## Next Step

- keep: keep the bilateral abs-lat equatorial-edge guard geometry
- keep: keep the south-edge stabilization and the NH target-entry exclusion untouched
- keep: keep the northside leak-penalty plumbing and diagnostics available behind a toggle
- change: attribute why the 11.25°N source lane never admits a non-zero leak penalty in the real 30-day branch state
- change: treat the remaining miss as an admission/selector threshold problem, not a global amplitude problem
