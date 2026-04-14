# Phase 1ZA Shoulder Guard Residual Attribution

## Scope

- Same-branch off audit: `/tmp/phase1z-off.json`
- Same-branch on audit: `/tmp/phase1z-on.json`

## Verdict

- equatorial_edge_shoulder_miss
- Next phase: Phase 1ZB: Latitude-Aware Shoulder Guard Redesign
- The next patch should not retune amplitude. It needs a selector redesign that reaches the equatorial shoulder while explicitly excluding the target-entry lane.

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.792` (delta `-0.042`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.508` (delta `-0.007`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.193` (delta `0.001`)
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531` (delta `0`)

## Residual Bands

- tropical shoulder core condensation delta: `0.02242`
- tropical shoulder core applied suppression on: `0.00265`
- target-entry applied suppression on: `0.00705`
- target-entry condensation delta: `-0.02576`

## Reference Slices

- shoulder 3.75°N: off/on condensation `0.07641` / `0.10207`, candidate on `0`, applied on `0`, band-window on `0`
- shoulder 11.25°N: off/on condensation `0.12779` / `0.14696`, candidate on `0.09505`, applied on `0.0053`
- source 26.25°N: candidate on `0`, applied on `0`
- target-entry 33.75°N: off/on condensation `0.18497` / `0.13135`, applied on `0.0141`, projected bridge on `0`

## Ranking

- `equatorial_edge_shoulder_miss` score `1`: The selector never admits the strongest 3.75°N shoulder rebound at all.
- `target_entry_false_positive` score `1`: The selector is still active in the 30–45°N target-entry lane it was supposed to leave alone.
- `shared_weak_engine_ambiguity` score `1`: Weak-engine bridge-silent marine columns still look too similar between the shoulder and target-entry lanes.

## Redesign Contract

- primary finding: `equatorial_edge_shoulder_miss`
- keep: keep Phase 1K marine-maintenance suppression
- keep: keep Phase 1M circulation rebound containment
- keep: keep Phase 1X projected-share repair instrumentation
- required change: add an explicit equatorial-shoulder admission path for 3–6°N columns instead of relying on the current subtropical-band proxy alone
- required change: add an explicit target-entry exclusion for 30–45°N columns so the shoulder guard cannot fire in the transition lane
- required change: do not redesign the next selector as a pure weak-engine or bridge-silence gate; those signals are shared by both the desired and false-positive lanes
- likely implementation need: microphysics5.js currently lacks a direct latitude-aware discriminator, so the next patch should either inject one into state or precompute a dedicated shoulder-window diagnostic upstream.
