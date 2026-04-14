# Phase 1S Capped Drying-To-Omega Bridge Patch

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Same-branch off audit: `/tmp/phase1s-omega-bridge-off.json`
- Same-branch on audit: `/tmp/phase1s-omega-bridge-on.json`

## Verdict

- omega_to_jet_recovery_failure
- Next phase: Phase 1T: Omega-To-Jet Recovery Attribution
- The bridge is live and does move low-level omega, but NH westerlies stay flat. Keep diagnostics, leave the patch disabled by default, and move to omega-to-jet recovery attribution instead of blindly strengthening the bridge.

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.837` (delta `0.003`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.517` (delta `0.002`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.193` (delta `0.001`)
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531` (delta `0`)

## Bridge Response

- `northTransitionDryingOmegaBridgeAppliedMeanPaS = 0.00206`
- `northDryBeltDryingOmegaBridgeAppliedMeanPaS = 0.00145`
- `northTransitionLowLevelOmegaEffectiveMeanPaS`: `0.06637` -> `0.06845` (delta `0.00208`)
- `northDryBeltLowLevelOmegaEffectiveMeanPaS`: `0.01565` -> `0.01705` (delta `0.0014`)
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.14647` -> `0.14242` (delta `-0.00405`)

## Phase Targets

- north transition omega target hit fraction: `0.208`
- north dry-belt omega target hit fraction: `0.28`
- NH jet delta: `0`

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.837` (delta `2.191`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.517` (delta `0.417`)
- `subtropicalDrySouthRatio`: `0.519` -> `1.193` (delta `0.674`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)

## Guardrail Assessment

- `itczWidthDegDelta = 0.003`
- `subtropicalDryNorthRatioDelta = 0.002`
- `subtropicalDrySouthRatioDelta = 0.001`
- `guardrailCostScore = 0.06667`
