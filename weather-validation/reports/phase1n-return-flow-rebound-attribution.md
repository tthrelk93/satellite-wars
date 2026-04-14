# Phase 1N Return-Flow Rebound Attribution

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Phase 1M off compare: `/tmp/phase1n-circulation-off.json`
- Phase 1M on compare: `/tmp/phase1n-circulation-on.json`

## Verdict

- transition_lane_only_response
- The next patch lane should stay focused on transition suppression, but only if a stronger circulation response can be coupled to it.

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.834` (delta `2.188`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.515` (delta `0.415`)
- `subtropicalDrySouthRatio`: `0.519` -> `1.192` (delta `0.673`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)

## Phase 1M Off Versus On

- `itczWidthDeg`: `25.874` -> `25.834`
- `subtropicalDryNorthRatio`: `1.524` -> `1.515`
- `subtropicalDrySouthRatio`: `1.194` -> `1.192`
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.1526` -> `0.14647`

## Return-Flow Signals

- North/South transition containment: `0.81272` / `0.70617`
- North/South transition source suppression: `0.612` / `0.51949`
- North/South transition source driver: `0.16716` / `0.07608`
- North/South transition cross-hemi floor share: `0` / `0.12935`
- North/South transition weak-hemi fraction: `0` / `0.49503`

## Ranking

- `Transition containment is active but return flow stays flat` score `0.6626`
- `NH return-flow source remains too symmetric with SH` score `0.43875`
- `Subtropical return-flow driver is still floor-dominated` score `0.0599`
- `Local hemispheric source is still underweighted relative to the mean tropical source` score `0`

