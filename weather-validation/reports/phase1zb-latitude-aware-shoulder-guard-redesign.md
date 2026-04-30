# Phase 1ZB Latitude-Aware Shoulder Guard Redesign

## Scope

- Same-branch off audit: `/tmp/phase1zb-off.json`
- Same-branch on audit: `/tmp/phase1zb-on.json`

## Verdict

- needs_follow_up
- Next phase: Phase 1ZC: Shoulder Guard Reintegration Audit
- The selector geometry is improved but still needs a follow-up reintegration audit before we treat the shoulder lane as solved.

## Exit Criteria

- strongest shoulder admitted: `true`
- target-entry excluded: `true`
- guardrails preserved or improved: `false`
- shoulder-core condensation reduced: `false`

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.89` (delta `0.056`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.527` (delta `0.012`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.197` (delta `0.005`)

## Key Slices

- shoulder `3.75°N`: off candidate `0.04151`, on candidate `0.06893`, on applied `0.0122`, on latitude window `1`
- shoulder `11.25°N`: on candidate `0.12488`, on applied `0.02496`, on latitude window `1`
- target entry `33.75°N`: off/on candidate `0` / `0`, off/on applied `0` / `0`, on exclusion `1`

## Band Diagnostics

- tropical shoulder core condensation delta: `0.01603`
- tropical shoulder core applied suppression on: `0.01858`
- target-entry applied suppression on: `0`
