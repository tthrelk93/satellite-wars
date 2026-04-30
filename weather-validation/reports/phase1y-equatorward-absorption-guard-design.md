# Phase 1Y Equatorward Absorption Guard Design

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Same-branch off audit: `/tmp/phase1x-off.json`
- Same-branch on audit: `/tmp/phase1x-on.json`

## Verdict

- remote_shoulder_absorption
- Next phase: Phase 1Z: Implement Shoulder Absorption Guard Patch
- Keep the repaired projected-share bridge in place and add a narrow tropical-shoulder absorption guard in the saturation-adjustment lane before trying more downstream jet coupling.

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.839` (delta `0.005`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.517` (delta `0.002`)
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531` (delta `0`)

## Dominant Shoulder Signal

- strongest shoulder rebound latitude: `11.25°`
- shoulder condensation delta: `0.02107`
- shoulder local bridge on: `0`
- shoulder projected bridge on: `0`
- shoulder lower / mid omega on: `0.17323` / `0.17414`
- shoulder storm-track on: `0.00001`

## Band Diagnostics

- Tropical shoulder (3-18.75N): condensation delta `0.01365`, lower / mid omega delta `0.00006` / `0.00008`, local bridge on `0.00068`, projected bridge on `0`, storm-track on `0.00001`
- Tropical shoulder core (3-12N): condensation delta `0.02052`, lower / mid omega delta `-0.00002` / `0.00001`, local bridge on `0`, projected bridge on `0`, storm-track on `0.00001`
- Equatorward leak window (18-22N): condensation delta `-0.00009`, lower / mid omega delta `0.00022` / `0.0002`, local bridge on `0.00205`, projected bridge on `0`, storm-track on `0.00001`
- Source core (20-30N): condensation delta `-0.00972`, lower / mid omega delta `-0.00017` / `-0.00022`, local bridge on `0.00063`, projected bridge on `0`, storm-track on `0.00005`
- Target entry (30-45N): condensation delta `-0.00019`, lower / mid omega delta `-0.00033` / `-0.00043`, local bridge on `0.00019`, projected bridge on `0.00059`, storm-track on `0.00013`
- Jet band (41.25-56.25N): condensation delta `-0.00005`, lower / mid omega delta `0.00026` / `0.00035`, local bridge on `0`, projected bridge on `0.00018`, storm-track on `0.00016`

## Reference Slices

- tropicalShoulder3p75: off cond `0.07641`, on cond `0.09638`, off/on projected bridge `0` / `0`, off/on local bridge `0` / `0`
- tropicalShoulder11p25: off cond `0.12779`, on cond `0.14886`, off/on projected bridge `0` / `0`, off/on local bridge `0` / `0`
- equatorwardLeak18p75: off cond `0.10309`, on cond `0.103`, off/on projected bridge `0` / `0`, off/on local bridge `0` / `0.00205`
- sourceCore26p25: off cond `0.12559`, on cond `0.11587`, off/on projected bridge `0` / `0`, off/on local bridge `0` / `0.00063`
- targetEntry33p75: off cond `0.18497`, on cond `0.18468`, off/on projected bridge `0` / `0.00065`, off/on local bridge `0` / `0.00038`

## Patch Contract

- target lane: marine saturation-adjustment condensation in the tropical shoulder
- latitude window: `3-12°`
- do not touch: projected bridge deposition in 30-45N; Phase 1K marine-maintenance dry-belt suppression; Phase 1M circulation rebound containment
- desired signature: shoulder condensation `<= 0`, target-entry projected bridge `stay > 0`, NH jet `non-decreasing`

## Ranking

1. `remote_shoulder_absorption` score `1`
2. `downstream_jet_nonresponse` score `1`
3. `broad_humidification_rebound` score `0.34267`
4. `direct_shoulder_bridge_leak` score `0.33333`

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.839` (delta `2.193`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.517` (delta `0.417`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)
