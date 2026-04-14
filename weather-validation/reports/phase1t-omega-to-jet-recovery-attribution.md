# Phase 1T Omega-To-Jet Recovery Attribution

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Same-branch off audit: `/tmp/phase1s-omega-bridge-off.json`
- Same-branch on audit: `/tmp/phase1s-omega-bridge-on.json`
- Same-branch off profiles: `/tmp/phase1s-omega-bridge-off-sample-profiles.json`
- Same-branch on profiles: `/tmp/phase1s-omega-bridge-on-sample-profiles.json`

## Verdict

- equatorward_absorption_before_jet_band
- Next phase: Phase 1U: Jet-Band Placement Patch Design
- The bridge response is being absorbed in the NH dry-belt and tropical-shoulder lane instead of reaching the 30-56N jet pathway. Keep the bridge disabled by default and redesign its placement/latitudinal weighting before changing amplitude.

## Bridge Signals

- `northTransitionDryingOmegaBridgeAppliedMeanPaS = 0.00206`
- `northDryBeltDryingOmegaBridgeAppliedMeanPaS = 0.00145`
- `northTransitionLowLevelOmegaEffectiveDeltaPaS = 0.00208`
- `northDryBeltLowLevelOmegaEffectiveDeltaPaS = 0.0014`
- `omegaTargetHitFrac = 0.244`
- `midlatitudeWesterliesNorthDeltaMs = 0`

## Lat-Band Deltas

- Tropical shoulder (3-18.75N): wind delta `-0.00033`, storm-track delta `0`, condensation delta `0.01778`, drying delta `0.00001`
- Dry-belt core (18.75-30N): wind delta `-0.0005`, storm-track delta `0`, condensation delta `-0.00425`, drying delta `-0.00002`
- Transition band (30-41.25N): wind delta `0`, storm-track delta `0`, condensation delta `-0.00005`, drying delta `-0.00002`
- Jet band (41.25-56.25N): wind delta `0`, storm-track delta `0`, condensation delta `-0.00008`, drying delta `0`

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.837` (delta `0.003`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.517` (delta `0.002`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.193` (delta `0.001`)
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531` (delta `0`)

## Ranking

1. `equatorward_absorption_before_jet_band` score `1`
2. `omega_response_still_too_weak` score `0.87783`
3. `downstream_jet_recovery_failure` score `0.41467`

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.837` (delta `2.191`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.517` (delta `0.417`)
- `subtropicalDrySouthRatio`: `0.519` -> `1.193` (delta `0.674`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)
