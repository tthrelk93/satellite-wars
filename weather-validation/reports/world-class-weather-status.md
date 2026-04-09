# World-Class Weather Status

Updated: 2026-04-09
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-09T11-09-21Z-sample0-fastpath-live-rerun`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
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

- The recent particle-path profiler work identified `WindStreamlineRenderer._evolveParticles(...)` with `sample0Ms` dominant on the mature live baseline.
- The verified follow-up changed real app code in `src/WindStreamlineRenderer.js`:
  - added a dedicated in-range bilinear fast path for the common all-valid sample case
  - stopped building/destructuring large sample argument objects on every particle sample
  - reused scratch sample objects inside `_evolveParticles(...)`
- Two fresh live reruns on the same patch confirm the win is not a one-off:
  - mature pre-patch baseline: `Earth.update p95 = 42.01 ms`, `sample0Ms p95 = 2.60 ms`
  - first rerun: `Earth.update p95 = 34.20 ms`
  - confirming rerun: `Earth.update p95 = 33.39 ms`, `sample0Ms p95 = 2.30 ms`
- The hotspot mix also changed materially:
  - mature pre-patch top spikes: `particle_evolve = 6`, `unknown = 2`
  - confirming rerun top spikes: `particle_evolve = 2`, `unknown = 6`
- What still blocks signoff after this fix:
  - larger `Earth.update` max spikes still remain
  - the remaining worst spikes are now mostly unknown / startup-ish rather than clearly `sample0Ms` dominated
- Fresh cycle artifacts:
  - `weather-validation/output/cycle-2026-04-09T11-09-21Z-sample0-fastpath-live-rerun/runtime-summary.json`
  - `weather-validation/output/cycle-2026-04-09T11-09-21Z-sample0-fastpath-live-rerun/hotspot-profile.json`
  - `weather-validation/output/cycle-2026-04-09T11-09-21Z-sample0-fastpath-live-rerun/runtime-summary-rerun.json`
  - `weather-validation/output/cycle-2026-04-09T11-09-21Z-sample0-fastpath-live-rerun/hotspot-profile-rerun.json`

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

1. Run one bounded live diagnostic cycle on the remaining unknown `Earth.update` max spikes before another renderer tweak; the old `sample0Ms` bottleneck is materially reduced.
2. If that diagnostic cycle does not expose a sharper runtime/app target, return the next physics cycle to northern subtropical dry-belt moisture partitioning while keeping the faster particle sampler.
3. Re-run live verification on the current `thetaeCoeff = 10.5` baseline after the next targeted runtime or dry-belt fix.
4. Run the annual planetary audit after the dry-belt fix holds through another seasonal follow-through.
5. Keep validation on the clean world-class checkout only.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
