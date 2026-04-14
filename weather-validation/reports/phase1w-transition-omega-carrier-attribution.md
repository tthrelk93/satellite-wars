# Phase 1W Transition-Omega Carrier Attribution

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Same-branch off audit: `/tmp/phase1w-carrier-off.json`
- Same-branch on audit: `/tmp/phase1w-carrier-on.json`

## Verdict

- projected_share_unapplied_before_transition_entry
- Next phase: Phase 1X: Projected-Share Application Repair
- Repair the projected-share application path first. The current branch is still behaving like a mostly source-local bridge, so further carrier attribution would be premature until the target-row deposition actually exists in the live run.

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.84` (delta `0.006`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.515` (delta `0`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.192` (delta `0`)
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531` (delta `0`)

## Band Diagnostics

- Tropical shoulder (3-18.75N): local bridge on `0.00068`, projected bridge on `0`, lower/mid/upper omega deltas `0.00004` / `0.00005` / `0.00003`, wind delta `0`, storm-track delta `0`, condensation delta `0.00671`
- Equatorward leak window (18-22N): local bridge on `0.00205`, projected bridge on `0`, lower/mid/upper omega deltas `0.00025` / `0.00023` / `0.00012`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00777`
- Source core (20-30N): local bridge on `0.00063`, projected bridge on `0`, lower/mid/upper omega deltas `0.00032` / `0.00034` / `0.00015`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00107`
- Target entry equatorward half (30-37.5N): local bridge on `0.00038`, projected bridge on `0`, lower/mid/upper omega deltas `0.00021` / `0.00029` / `0.00017`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00084`
- Target entry poleward half (37.5-45N): local bridge on `0`, projected bridge on `0`, lower/mid/upper omega deltas `-0.00023` / `-0.00026` / `-0.00013`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00005`
- Target entry (30-45N): local bridge on `0.00019`, projected bridge on `0`, lower/mid/upper omega deltas `-0.00001` / `0.00002` / `0.00002`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00045`
- Jet band (41.25-56.25N): local bridge on `0`, projected bridge on `0`, lower/mid/upper omega deltas `-0.0001` / `-0.00012` / `-0.00008`, wind delta `0`, storm-track delta `0`, condensation delta `0.00013`

## Ranking

1. `projected_share_unapplied_before_transition_entry` score `0.9075`
2. `vertical_depth_failure` score `0.59429`
3. `equatorward_condensation_absorption` score `0.50692`
4. `latitudinal_target_placement_failure` score `0.5`
5. `true_downstream_jet_response_failure` score `0.25714`

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.84` (delta `2.194`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.515` (delta `0.415`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)
