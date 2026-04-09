# World-Class Weather Status

Updated: 2026-04-09
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-09T06-25-36Z-earth-wind-model-diag-sampling-retry`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Latest verified physics baseline in `src/weather/v2/core5.js` still holds:
  - `vertParams.thetaeCoeff: 11 -> 10.5`
  - current dry-belt metrics remain:
    - Day-30 north subtropical dry-belt ratio: `1.029`
    - Day-90 north subtropical dry-belt ratio: `1.015`
- Latest verified browser/runtime fixes still hold on fresh localhost runs:
  - solo-mode minimap white panel stays gone
  - startup `Texture marked for update but no image data found` spam stays gone
- Latest verified runtime smoothness change in `src/Earth.js`:
  - wind-model diagnostics no longer scan the full 16200-cell grid
  - diagnostic sample target now drives `sampleStride: 1 -> 3` and `sampleCount: 16200 -> 5400`
  - fresh `windDiagnosticsPerf` events show model diagnostics dropping from about `29.4–32.1 ms` to about `9.1–10.2 ms` on due ticks
  - fresh live runtime summary improves `Earth.update` p95 from `31.96 ms -> 26.32 ms`
- Full signoff is still blocked:
  - `likelySmoothEnough = false` still remains on the fresh rerun
  - `Earth.update` max is still too high (`674.7 ms`) because larger unknown spikes remain outside the now-sampled model diagnostics path
  - wind targets still fail on `model_mean_low`, `model_p90_low`, `model_p99_low`, and `viz_step_mean_low`

## Fresh evidence from the latest cycle

- The prior instrumentation cycle added direct `windDiagnosticsPerf` events, which proved the expensive diagnostic phase was `_logWindModelDiagnostics` rather than wind-viz draw or target-status logging.
- The verified follow-up changed real app code in `src/Earth.js`:
  - diagnostic sample target reduced from full-grid behavior to a bounded subsample
- Fresh live rerun on the sampled build confirms:
  - model diagnostics now cost about `9.1–10.2 ms` instead of about `29.4–32.1 ms`
  - `latestWindModel.sampleStride = 3`
  - `latestWindModel.sampleCount = 5400`
  - `Earth.update` p95 improved to `26.32 ms`
- The same rerun also proves what the next blocker is not:
  - wind-viz draw remains tiny
  - target-status logging remains tiny
  - the remaining worst spikes are now mostly unexplained / outside the sampled model-diagnostics cost itself
- Fresh cycle artifacts:
  - `weather-validation/output/cycle-2026-04-09T06-25-36Z-earth-wind-model-diag-sampling-retry/postfix-runtime-summary.json`
  - `weather-validation/output/cycle-2026-04-09T06-25-36Z-earth-wind-model-diag-sampling-retry/postfix-hotspot-profile.json`

## What still blocks "world class"

- Northern subtropical dry-belt moisture partitioning is still the dominant planetary blocker, even though the quick and seasonal ratios are now down to `1.029` and `1.015`.
- Browser/runtime signoff is no longer blocked by the old white panel or the full-grid model-diagnostics payload, but it still fails on larger remaining `Earth.update` spikes and weak wind-target diagnostics in the latest live run.
- Annual / 365-day stability and seasonality evidence is still required before any long-horizon or world-class claim.
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

1. Run a direct `src/` smoothness/runtime cycle on the remaining unknown `Earth.update` spikes and worker/core sync path now that the model-diagnostics payload has been reduced.
2. Re-run live verification on the current `thetaeCoeff = 10.5` baseline after the next runtime fix.
3. If runtime smoothness stops blocking signoff, return the next physics cycle to northern subtropical dry-belt moisture partitioning and ITCZ-adjacent hydrology.
4. Run the annual planetary audit after the dry-belt fix holds through another seasonal follow-through.
5. Keep validation on the clean world-class checkout only.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
