# Phase 1X Projected-Share Application Repair

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Same-branch off audit: `/tmp/phase1x-off.json`
- Same-branch on audit: `/tmp/phase1x-on.json`

## Verdict

- equatorward_condensation_absorption
- Next phase: Phase 1Y: Equatorward Absorption Guard Design
- The projected bridge is live, but an equatorward condensation sink is still soaking up the response before jet entry. Add an absorption guard before building downstream coupling.

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.839` (delta `0.005`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.517` (delta `0.002`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.194` (delta `0.002`)
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531` (delta `0`)

## Band Diagnostics

- Tropical shoulder (3-18.75N): local bridge on `0.00068`, projected bridge on `0`, lower/mid/upper omega deltas `0.00006` / `0.00008` / `0.00004`, wind delta `0`, storm-track delta `0`, condensation delta `0.01365`
- Equatorward leak window (18-22N): local bridge on `0.00205`, projected bridge on `0`, lower/mid/upper omega deltas `0.00022` / `0.0002` / `0.00008`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00009`
- Source core (20-30N): local bridge on `0.00063`, projected bridge on `0`, lower/mid/upper omega deltas `-0.00017` / `-0.00022` / `-0.00013`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00972`
- Target entry equatorward half (30-37.5N): local bridge on `0.00038`, projected bridge on `0.00065`, lower/mid/upper omega deltas `-0.00087` / `-0.00111` / `-0.0007`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00029`
- Target entry poleward half (37.5-45N): local bridge on `0`, projected bridge on `0.00053`, lower/mid/upper omega deltas `0.00022` / `0.00025` / `0.00011`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00009`
- Target entry (30-45N): local bridge on `0.00019`, projected bridge on `0.00059`, lower/mid/upper omega deltas `-0.00033` / `-0.00043` / `-0.00029`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00019`
- Jet band (41.25-56.25N): local bridge on `0`, projected bridge on `0.00018`, lower/mid/upper omega deltas `0.00026` / `0.00035` / `0.00025`, wind delta `0`, storm-track delta `0`, condensation delta `-0.00005`

## Ranking

1. `equatorward_condensation_absorption` score `0.75`
2. `true_downstream_jet_response_failure` score `0.71875`
3. `vertical_depth_failure` score `0.625`
4. `latitudinal_target_placement_failure` score `0.54615`
5. `projected_share_unapplied_before_transition_entry` score `0.4075`

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.839` (delta `2.193`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.517` (delta `0.417`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)
