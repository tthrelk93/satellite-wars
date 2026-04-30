# Phase 1U Jet-Band Placement Patch Design

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Same-branch off audit: `/tmp/phase1s-omega-bridge-off.json`
- Same-branch on audit: `/tmp/phase1s-omega-bridge-on.json`
- Same-branch off profiles: `/tmp/phase1s-omega-bridge-off-sample-profiles.json`
- Same-branch on profiles: `/tmp/phase1s-omega-bridge-on-sample-profiles.json`

## Verdict

- poleward_projected_transition_bridge_required
- Next phase: Phase 1V: Implement Poleward Jet-Entry Bridge Patch
- Use a poleward-projected jet-entry bridge design. The current bridge is climate-live, but its gain is being spent in the dry-belt core and tropical shoulder instead of the 30-45N transition lane.

## Current Lane Geometry

- current subtropical loop: `15-35°`
- same-column bridge shape: `true`
- The current same-step bridge is confined to the 15-35N subtropical loop, so it cannot directly seed the 41.25-56.25N jet band.

## Live Bridge State

- `northTransitionLowLevelOmegaEffectiveDeltaPaS = 0.00208`
- `northDryBeltLowLevelOmegaEffectiveDeltaPaS = 0.0014`
- `midlatitudeWesterliesNorthDeltaMs = 0`
- `northTransitionDryingOmegaBridgeAppliedMeanPaS = 0.00206`
- `northDryBeltDryingOmegaBridgeAppliedMeanPaS = 0.00145`

## Lat-Band Deltas

- Tropical shoulder (3-18.75N): wind delta `-0.00033`, storm-track delta `0`, condensation delta `0.01778`
- Dry-belt core (18.75-30N): wind delta `-0.0005`, storm-track delta `0`, condensation delta `-0.00425`
- Transition / jet entry (30-45N): wind delta `0`, storm-track delta `0`, condensation delta `-0.00005`
- Jet band (41.25-56.25N): wind delta `0`, storm-track delta `0`, condensation delta `-0.00008`

## Ranking

1. `poleward_projected_transition_bridge_required` score `1`
2. `same_column_amplitude_retune_wrong_lane` score `0.963`
3. `within_loop_lat_reweight_still_insufficient` score `0.91667`

## Patch Design

- Mechanism: Split the current bridge into a capped local share plus a capped same-hemisphere poleward-projected share that redistributes part of the proved dry-belt response into the 30-45N transition / jet-entry rows.
- vertical5.js: keep the current dryDriver/source gate as the source selector, but accumulate a same-hemisphere projected bridge reservoir from source rows centered on roughly 20-30N.
- vertical5.js: redistribute the projected share into target rows centered on roughly 30-45N before later same-step consumers read low-level omega.
- vertical5.js: apply a strong equatorward leak penalty below about 20-22N so the tropical shoulder does not absorb the bridge gain.
- core5.js: expose separate source-band, target-band, local-share, projected-share, and max-Pa/s caps so the design can be tuned without broad circulation retunes.

## Suggested Parameters

- `enableProjectedDryingOmegaBridge = false`
- `dryingOmegaBridgeLocalShareMaxFrac = 0.35`
- `dryingOmegaBridgeProjectedShareMaxFrac = 0.65`
- `dryingOmegaBridgeSourceLat0 = 20`
- `dryingOmegaBridgeSourceLat1 = 30`
- `dryingOmegaBridgeTargetLat0 = 30`
- `dryingOmegaBridgeTargetLat1 = 45`
- `dryingOmegaBridgeEquatorwardLeakLat0 = 18`
- `dryingOmegaBridgeEquatorwardLeakLat1 = 22`
- `dryingOmegaBridgeProjectedMaxPaS = 0.006`

## Target Signature

- `positiveTransitionEntryWindDeltaMs = 0.01`
- `positiveJetBandStormTrackDelta = 0.00002`
- `maxAllowedTropicalShoulderCondensationDeltaKgM2 = 0.005`
- `maxAllowedItczWidthDeltaDeg = 0.02`
- `maxAllowedNorthDryRatioDelta = 0.01`

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.837` (delta `2.191`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.517` (delta `0.417`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)
