# Phase 1Q Return-Flow Carrier Attribution

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Phase 1P off compare: `/tmp/phase1q-carrier-off.json`
- Phase 1P on compare: `/tmp/phase1q-carrier-on.json`

## Verdict

- drying_to_omega_response_failure
- Next phase: Phase 1R: Omega Response Patch Design
- Move the next patch to the drying-to-omega response lane in vertical5.js/core5.js. Drying changes are present, but they are not turning into a stronger low-level circulation response.

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

## Carrier Chain

- coupling applied: `0.00975`
- source driver delta mean: `0.00111`
- drying delta mean: `0.01437`
- omega delta mean: `-0.0003`
- NH westerly delta: `0`

## Ranking

1. `drying_to_omega_response_failure` score `0.97`
2. `omega_to_jet_recovery_failure` score `0.03`
3. `source_driver_to_drying_conversion_failure` score `0`

## Live Signals

- `northTransitionSubtropicalSourceDriverMeanFrac = 0.16827`
- `northDryBeltSubtropicalSourceDriverMeanFrac = 0.16827`
- `northTransitionSubtropicalSubsidenceDryingMeanFrac = 0.1432`
- `northDryBeltSubtropicalSubsidenceDryingMeanFrac = 0.09595`
- `northTransitionLowLevelOmegaEffectiveMeanPaS = 0.06679`
- `northDryBeltLowLevelOmegaEffectiveMeanPaS = 0.01463`
- `midlatitudeWesterliesNorthU10Ms = 0.531`
