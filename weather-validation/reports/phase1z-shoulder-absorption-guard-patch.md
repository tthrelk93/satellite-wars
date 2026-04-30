# Phase 1Z Shoulder Absorption Guard Patch

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Same-branch off audit: `/tmp/phase1z-off.json`
- Same-branch on audit: `/tmp/phase1z-on.json`

## Verdict

- rejected_patch
- Next phase: Phase 1ZA: Shoulder Guard Residual Attribution
- Do not assume the shoulder guard is the final fix yet; use the same-branch compare to identify the residual mismatch before broadening tuning.

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.792` (delta `-0.042`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.508` (delta `-0.007`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.193` (delta `0.001`)
- `midlatitudeWesterliesNorthU10Ms`: `0.531` -> `0.531` (delta `0`)

## Exit Criteria

- shoulder condensation pass: `false`
- target-entry projected bridge pass: `false`
- ITCZ width pass: `true`
- north dry-belt pass: `true`
- south dry-belt pass: `false`
- NH jet non-degrading pass: `true`
- source-locality pass: `true`

## Dominant Shoulder Point

- strongest shoulder latitude: `3.75°`
- condensation delta: `0.02566`
- applied guard suppression on: `0`

## Band Diagnostics

- Tropical shoulder (3-18.75N): condensation delta `0.01089`, guard applied on `0.00177`, local bridge on `0`, projected bridge on `0`, wind on `-0.71533`
- Tropical shoulder core (3-12N): condensation delta `0.02242`, guard applied on `0.00265`, local bridge on `0`, projected bridge on `0`, wind on `-0.9085`
- Source core (20-30N): condensation delta `-0.0103`, guard applied on `0`, local bridge on `0`, projected bridge on `0`, wind on `1.357`
- Target entry (30-45N): condensation delta `-0.02576`, guard applied on `0.00705`, local bridge on `0`, projected bridge on `0`, wind on `0.247`
- Jet band (41.25-56.25N): condensation delta `0.00134`, guard applied on `0`, local bridge on `0`, projected bridge on `0`, wind on `0.781`

## Reference Slices

- tropicalShoulder3p75: off cond `0.07641`, on cond `0.10207`, off/on guard `0` / `0`
- tropicalShoulder11p25: off cond `0.12779`, on cond `0.14696`, off/on guard `0` / `0.0053`
- sourceCore26p25: off cond `0.12559`, on cond `0.11529`, on guard `0`
- targetEntry33p75: off cond `0.18497`, on cond `0.13135`, on projected bridge `0`

## Baseline Gap

- `itczWidthDeg`: `23.646` -> `25.792` (delta `2.146`)
- `subtropicalDryNorthRatio`: `1.1` -> `1.508` (delta `0.408`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192` -> `0.531` (delta `-0.661`)
