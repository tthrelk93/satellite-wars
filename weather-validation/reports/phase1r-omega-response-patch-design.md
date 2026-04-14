# Phase 1R Omega Response Patch Design

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Phase 1Q off compare: `/tmp/phase1q-carrier-off.json`
- Phase 1Q on compare: `/tmp/phase1q-carrier-on.json`

## Verdict

- same_step_drying_to_omega_bridge_missing
- Next phase: Phase 1S: Implement capped drying-to-omega bridge patch
- Primary mechanism: Add a capped same-step omega-response bridge driven by the proven dryDriver lane, then expose its parameters through core5.js so the drying response can seed a small subtropical descent increase without broad circulation retuning.

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `26.055` (delta `2.409`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.572` (delta `0.472`)
- `subtropicalDrySouthRatio`: `0.519` -> `1.203` (delta `0.684`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)

## Off Versus On

- `itczWidthDeg`: `25.834` -> `26.055`
- `subtropicalDryNorthRatio`: `1.515` -> `1.572`
- `subtropicalDrySouthRatio`: `1.192` -> `1.203`
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531`
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.14647` -> `0.14768`

## Carrier Bridge Signals

- coupling applied: `0.00975`
- source driver delta mean: `0.00111`
- drying delta mean: `0.01437`
- omega delta mean: `-0.0003`
- NH westerly delta: `0`
- drying-to-omega transfer frac: `0.02088`
- omega-to-jet transfer frac: `0`

## Ranking

1. `same_step_drying_to_omega_bridge_missing` score `0.95`
2. `broad_core_retune_is_wrong_lane` score `0.95`
3. `omega_to_jet_recovery_is_secondary_until_omega_moves` score `0.05`

## Code Evidence

- vertical5.js computes omega and lowLevelOmegaEffective before the subtropical dryDriver loop.
- vertical5.js computes dryDriver later, then applies qv/theta drying and warming tendencies without feeding those tendencies back into omega for the same step.
- The current bridge can improve drying diagnostics while leaving lowLevelOmegaEffective almost unchanged, which is exactly what the Phase 1Q off/on compare shows.

## Patch Design

- Primary files: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js`, `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js`
- vertical5.js: after dryDriver is computed and before the subtropical drying loop exits, derive a capped omega bridge term from dryDriver, latShape, weak-engine structure, and same-hemisphere transition suppression.
- vertical5.js: apply the bridge to lowLevelOmegaEffective and the low-level omega interface for the same subtropical column so the response is visible to later same-step consumers.
- core5.js: add guardrail-first parameters for enable/disable, dryDriver thresholds, and max omega bridge amplitude.

## Target Signature

- `northTransitionLowLevelOmegaEffectiveDeltaPaS >= 0.01`
- `northDryBeltLowLevelOmegaEffectiveDeltaPaS >= 0.005`
- `midlatitudeWesterliesNorthDeltaMs >= 0.03`
- `itczWidthDeg delta <= 0.05`
- `subtropicalDryNorthRatio delta <= 0.02`
- `northDryBeltOceanLargeScaleCondensation delta <= 0.002`

## Design Rules

- Use the already-kept Phase 1K and Phase 1M selectors as the envelope; do not reintroduce broad source reinjection.
- Make the bridge same-hemisphere and subtropical-band limited so it acts as a local descent seed, not a global omega retune.
- Cap the bridge in Pa/s, not only in fractional terms, so it cannot silently escalate under a stronger dryDriver.
- Treat midlatitude westerly recovery as a downstream guardrail target; the first proof of success is a real omega response.
