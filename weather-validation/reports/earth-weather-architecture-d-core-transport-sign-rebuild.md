# Earth Weather Architecture D Core Transport-Sign Rebuild

Architecture D starts after the Architecture C closeout in [earth-weather-architecture-c-closeout.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c-closeout.md).

- decision: `core_transport_sign_rebuild_required`
- predecessor decision: `architecture_c_exhausted_best_reference_c62`
- retained Architecture C reference candidate: `C62`
- hard stop: do not continue `C71+`

## Objective

Repair the circulation-core transport-sign defect that keeps the best hybrid family southward on cross-equatorial vapor transport.

## Scope

- freeze `C62` as the best retained Architecture C reference candidate
- compare `current branch`, `rollback archive`, `C62`, and `C70` as the main sign-tradeoff marker
- decompose the signed transport problem into:
  - zonal-mean overturning polarity
  - equatorial eddy export closure
  - NH dry-belt import / closure balance

## Hard Bounds

- no new latitude-lane micro-tuning as the primary experiment family
- Architecture D is bounded to `D1` through `D3` before another mandatory closeout gate
- if `D1-D3` cannot beat `C62` on the primary blocker, stop and close out Architecture D instead of creating `D4+` by habit

## Initial Architecture D Phases

- `Architecture D1: signed transport-budget decomposition design`
- `Architecture D2: overturning-polarity contract experiment`
- `Architecture D3: eddy-export closure experiment`

## Promotion Gate

Any Architecture D keep candidate must:

- beat `C62` on `crossEquatorialVaporFluxNorthKgM_1S`
- preserve the broad late-C quick-shape gains on:
  - `itczWidthDeg`
  - `subtropicalDryNorthRatio`
  - `subtropicalDrySouthRatio`
  - `midlatitudeWesterliesNorthU10Ms`
- avoid reopening the NH dry-belt ocean maintenance family as the repayment lane

## Active Next Move

- `Architecture D1: signed transport-budget decomposition design`
