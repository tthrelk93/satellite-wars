# Phase 1O Coupled Transition-To-Return-Flow Patch Design

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Phase 1O off compare: `/tmp/phase1o-circulation-off.json`
- Phase 1O on compare: `/tmp/phase1o-circulation-on.json`

## Verdict

- missing_transition_to_return_flow_coupling
- Primary mechanism: Convert a capped share of same-hemisphere transition-suppressed convective source into a subtropical return-flow reinforcement term instead of treating containment as a pure sink.

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.834` (delta `2.188`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.515` (delta `0.415`)
- `subtropicalDrySouthRatio`: `0.519` -> `1.192` (delta `0.673`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)

## Phase 1M Lane Off Versus On

- `itczWidthDeg`: `25.874` -> `25.834`
- `subtropicalDryNorthRatio`: `1.524` -> `1.515`
- `subtropicalDrySouthRatio`: `1.194` -> `1.192`
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.1526` -> `0.14647`

## Transition-To-Return-Flow Signals

- North/South transition containment: `0.81272` / `0.70617`
- North/South transition suppressed source: `0.00133` / `0.00077`
- North/South suppressed source share: `0.52322` / `0.41013`
- North/South dry-belt return-flow opportunity: `0.00084` / `0.00038`
- North/South transition source driver: `0.16716` / `0.07608`

## Ranking

- `The current lane still behaves like width/dry-belt trimming without jet recovery` score `0.41769`
- `Transition suppression is live, but the removed source is not being converted into return-flow recovery` score `0.33462`
- `The next circulation patch should preserve the kept marine-maintenance improvement` score `0.00105`

## Patch Design

- Primary files: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js`, `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js`
- Target NH westerly improvement: `0.08` m/s
- Width guardrail target: `-0.02` deg or better
- North dry-ratio guardrail target: `-0.005` or better
- Ocean condensation guardrail target: `-0.002` kg/m² or better

- Use the existing transition containment lane as the selector, not a new occupancy family.
- Reinforce same-hemisphere subtropical source driver or descent support with capped transition-suppressed source, not cross-hemisphere floor borrowing.
- Keep the marine-maintenance suppression lane intact and treat it as a guardrail, not the primary circulation lever.
- Gate any new return-flow boost so it helps 15-35 degree subtropical descent without broadening the tropical core.
