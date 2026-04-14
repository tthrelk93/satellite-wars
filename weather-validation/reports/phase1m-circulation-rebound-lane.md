# Phase 1M Circulation Rebound Lane

## Scope

- Compare mode: same-branch `off` vs `on`
- Branch keeps the Phase 1K marine-maintenance patch
- Off artifact: `/tmp/phase1m-circulation-off.json`
- On artifact: `/tmp/phase1m-circulation-on.json`

## Implementation

- Added a runtime-toggled circulation-rebound containment lane in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- Wired defaults in [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- Exposed live diagnostics through [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js), [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js), and [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- Added focused coverage in [vertical5.test.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.test.js)

## Result

- Keep the patch
- Read: the lane is real and beneficial, but it does not close circulation rebound by itself

## Day-30 Off Versus On

- `itczWidthDeg`: `25.874 -> 25.834`
- `subtropicalDryNorthRatio`: `1.524 -> 1.515`
- `subtropicalDrySouthRatio`: `1.194 -> 1.192`
- `midlatitudeWesterliesNorthU10Ms`: `0.531 -> 0.531`
- `midlatitudeWesterliesSouthU10Ms`: `0.851 -> 0.851`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.1526 -> 0.14647`
- `northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2`: `0.04238 -> 0.03934`

## Live Gate Coverage

- `northTransitionCirculationReboundContainmentMeanFrac`: `0 -> 0.81272`
- `southTransitionCirculationReboundContainmentMeanFrac`: `0 -> 0.70617`
- `northTransitionCirculationReboundSourceSuppressionMeanFrac`: `0 -> 0.612`
- `southTransitionCirculationReboundSourceSuppressionMeanFrac`: `0 -> 0.51949`

## Interpretation

- The patch is active in the intended off-equatorial transition lanes
- It reduces transition-lane organization and trims the residual marine-maintenance loop without damaging the kept Phase 1K win
- The remaining blocker is no longer selector occupancy
- The remaining blocker is westerly / return-flow recovery, because the NH midlatitude westerly guardrail stays flat even when the transition lane is suppressed

## Next Phase

- Phase 1N: Return-Flow Rebound Attribution
- Focus:
  - explain why reduced transition leakage does not translate into stronger NH westerlies
  - trace the remaining circulation miss through [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) and the subtropical-source / return-flow logic in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
