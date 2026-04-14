# Phase 1ZP Northside Fanout Containment Design

## Verdict

- northside_source_leak_penalty_preferred
- Next phase: Phase 1ZQ: Implement Capped Northside Fanout Leak Penalty Patch
- Keep the bilateral abs-lat geometry from Phase 1ZN, but add a capped northside source-leak penalty in the vertical lane so improved 11.25°N source drying does not fan out into 3.75°N, 18.75°N, and 26.25°N.

## Candidate Ranking

- northside_source_leak_penalty: `1` — Best matches the live signature: the 11.25°N source improves while 3.75°N, 18.75°N, and 26.25°N all brighten on the same hemisphere.
- global_guard_amplitude_reduction: `0.143` — Would likely undo the south-edge stabilization and bilateral activation that Phase 1ZN finally achieved.
- humidification_sink: `-0.083` — Poor fit because TCW and RH stay nearly flat while condensation fans out northward.
- north_target_only_cap: `-0.1485` — Would only address 3.75°N directly and leaves the 18.75°N / 26.25°N fanout lane unexplained.

## Why The Preferred Lane Fits Best

- north fanout score: `1.22275`
- humidification score: `0.0775`
- prior verdict: `northside_condensation_fanout_without_humidification`

## Next Patch Contract

- keep: keep the bilateral abs-lat equatorial-edge source and target geometry
- keep: keep the south-edge stabilization at -3.75°
- keep: keep the NH 30-45° target-entry exclusion untouched
- change: add a capped northside source-leak penalty around the 11.25°N source lane
- change: gate that penalty against fanout risk into 18.75°N and 26.25°N rather than simply shrinking all guard amplitude
- change: keep the patch in vertical5.js / core5.js, not in the shoulder-selector microphysics lane
- do not: do not reduce global equatorial-edge guard amplitude first
- do not: do not re-open the shoulder-selector geometry work
- do not: do not treat this as a humidification recharge patch
