# World-Class Weather Status

Updated: 2026-04-09
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-09T05-52-10Z-solo-minimap-white-panel-fix`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Latest verified physics baseline in `src/weather/v2/core5.js`:
  - `vertParams.thetaeCoeff: 11 -> 10.5`
  - Current dry-belt metrics remain:
    - Day-30 north subtropical dry-belt ratio: `1.029`
    - Day-90 north subtropical dry-belt ratio: `1.015`
- Latest verified browser/runtime improvement in `src/App.js`:
  - the solo-mode minimap overlay is now gated out of the solo/live-signoff path
  - the persistent lower-right white panel is gone on a fresh localhost run
  - the earlier startup texture-warning fix still holds on the same fresh run
- Fresh live telemetry on the current baseline still blocks full signoff:
  - `likelySmoothEnough = false`
  - `earth_update.updateMs`: `p50 0.10 ms`, `p95 31.4 ms`, `max 391.4 ms`
  - wind targets still fail on `model_mean_low`, `model_p90_low`, `model_p99_low`, and `viz_step_mean_low`
  - hotspot attribution still points at `Earth` wind/model diagnostics cadence

## Fresh evidence from the latest cycle

- Fresh source inspection from the last live cycle tied the old white panel to `src/App.js` continuously drawing `earth.canvas` into the fixed minimap overlay, while `src/Earth.js` uses `this.canvas` as the fog-of-war canvas.
- The verified UI/runtime fix changed real app code:
  - `src/App.js` now gates the minimap draw loop and overlay rendering by game mode
  - `src/gameModeUi.js` centralizes the minimap visibility rule
  - `src/gameModeUi.test.js` covers the mode rule directly
- Targeted automated validation passed:
  - `node --experimental-default-type=module --experimental-specifier-resolution=node --test src/gameModeUi.test.js`: PASS
- Fresh live rerun on the same `thetaeCoeff = 10.5` baseline confirmed:
  - the lower-right white panel is gone
  - the old startup `THREE.WebGLRenderer: Texture marked for update but no image data found.` spam is still gone
  - the canonical solo localhost path still loads and advances normally
- Fresh live runtime artifacts:
  - runtime summary: `weather-validation/output/cycle-2026-04-09T05-52-10Z-solo-minimap-white-panel-fix/runtime-summary.json`
  - hotspot profile: `weather-validation/output/cycle-2026-04-09T05-52-10Z-solo-minimap-white-panel-fix/hotspot-profile.json`

## What still blocks "world class"

- Northern subtropical dry-belt moisture partitioning is still the dominant planetary blocker, even though the quick and seasonal ratios are now down to `1.029` and `1.015`.
- Browser/runtime signoff is no longer blocked by the old white panel, but it still fails on Earth-update smoothness and weak wind-target diagnostics in the latest live run.
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

1. Run a direct `src/` smoothness/runtime cycle on `Earth` wind/model diagnostics cadence and worker sync using the fresh hotspot profile from the latest live run.
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
