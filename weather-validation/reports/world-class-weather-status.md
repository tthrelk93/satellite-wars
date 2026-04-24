# World-Class Weather Status

Updated: 2026-04-24
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-24T09-38-30Z-phase2-conservative-moisture-long-horizon`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Phase 2 conservative moisture transport now has fresh annual evidence:
  - annual E/P relative imbalance: `0.00967`
  - annual TCW drift: `5.13903 kg/m²`
  - advection net delta: `0.0000007 kg/m²`
  - vertical net delta: `0`
  - advection repair: `0.0002 kg/m²`
  - tropical-source numerical residual: `-0.0000003 kg/m²`
  - numerical integrity: PASS
- Latest verified physics baseline in `src/weather/v2/core5.js` still holds:
  - `vertParams.thetaeCoeff: 11 -> 10.5`
  - current dry-belt metrics remain:
    - Day-30 north subtropical dry-belt ratio: `1.029`
    - Day-90 north subtropical dry-belt ratio: `1.015`
- Latest verified browser/runtime fixes still hold on fresh localhost runs:
  - solo-mode minimap white panel stays gone
  - startup `Texture marked for update but no image data found` spam stays gone
- Latest verified runtime smoothness changes now include both `src/Earth.js` and `src/WindStreamlineRenderer.js`:
  - wind-model diagnostics no longer scan the full 16200-cell grid
  - diagnostic sample target now drives `sampleStride: 1 -> 3` and `sampleCount: 16200 -> 5400`
  - fresh `windDiagnosticsPerf` events still show model diagnostics at about `9.1–10.2 ms` on due ticks instead of about `29.4–32.1 ms`
  - the new wind-particle bilinear fast path reduced the mature instrumented live baseline from `Earth.update p95 42.01 ms -> 34.20 ms -> 33.39 ms` across two fresh reruns
  - the confirming rerun also lowered `sample0Ms` p95 from `2.60 ms -> 2.30 ms`
- Full signoff is still blocked:
  - `likelySmoothEnough = false` still remains on the confirming rerun
  - `Earth.update` max is still too high (`449.4 ms`) because larger unknown spikes remain after the particle-path win
  - wind targets still fail on `model_mean_low`, `model_p90_low`, `model_p99_low`, and `viz_step_mean_low`

## Fresh evidence from the latest cycle

- The Phase 2 cycle changed real weather-core code:
  - conservative source-demand remap for `qv`, `qc`, `qi`, `qr`, `qs`, and vapor-source tracers
  - default-off QV nudging so water closure is no longer hidden by climatology relaxation
  - stronger physical rainout/autoconversion defaults and organized supersaturation rainout tracing
  - water-cycle reporting now separates physical tropical-source redistribution from true global source-tracer residual
  - numerical limiter scoring now compares accumulated limiter mass on a 90-day-equivalent basis while preserving raw diagnostics
- Fresh annual artifact:
  - `waterCycleBudget.pass = true`
  - `sampledDays = 365`
  - `evaporationMeanMm = 533.48408`
  - `precipitationMeanMm = 528.32495`
  - `advectionRepairMeanKgM2 = 0.0002`
  - `numericalIntegrityPass = true`
- Fresh cycle artifacts:
  - `weather-validation/output/cycle-2026-04-24T09-38-30Z-phase2-conservative-moisture-long-horizon/conservative-remap-final-annual-baseline.json`
  - `weather-validation/output/cycle-2026-04-24T09-38-30Z-phase2-conservative-moisture-long-horizon/checkpoint.md`
  - `weather-validation/output/cycle-2026-04-24T09-38-30Z-phase2-conservative-moisture-long-horizon/evidence-summary.json`

## What still blocks "world class"

- ITCZ width and south subtropical dry-belt wetness are the next broad climate blockers after Phase 2 transport closure.
- Northern subtropical dry-belt moisture partitioning still needs a fresh broad-realism follow-through under the new conservative transport baseline.
- Browser/runtime signoff is no longer blocked by the old white panel or the full-grid model-diagnostics payload, but it still fails on larger remaining `Earth.update` spikes and weak wind-target diagnostics in the latest live run.
- A full annual planetary-realism pass is still required before any world-class claim; the new annual evidence only clears the conservative moisture-transport contract.
- World-class status still requires realism and smoothness to pass in the same browser-backed run.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/planetary-realism-status.md`
- `weather-validation/reports/worker-brief.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Start Phase 3 with ITCZ width and south subtropical dry-belt moisture partitioning under the new conservative transport baseline.
2. Keep the annual water-cycle contract as a guardrail for every broad hydrology/circulation change.
3. Run bounded live/browser verification after the next verified climate fix or when runtime debt becomes blocking again.
4. Keep validation on the clean world-class checkout only.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
