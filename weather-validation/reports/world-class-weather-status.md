# World-Class Weather Status

Updated: 2026-04-08
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-08T13-11-22Z-terrain-coupling-mass-fix-preservation`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab -- 'http://127.0.0.1:3000/?mode=solo'` reused the existing OpenClaw browser tab with no duplicate page tabs.
- The latest verified physics change adds terrain-coupled lee-side low-level ascent damping in `src/weather/v2/vertical5.js` when terrain subsidence is strong but recent orographic delivery exposure is absent, with matching defaults in `src/weather/v2/core5.js` and focused regression coverage in `src/weather/v2/terrainCoupling.test.js`.
- Fresh mature-window offline evidence now clears the remaining audited Andes precipitation split while keeping the other mountain regions windward-favored:
  - Andes `precipRatio`
    - `75600`: `1.0566 -> 1.1553`
    - `105480`: `0.9631 -> 1.0099`
  - Andes late-window low-level rain ratio improved again:
    - `qrLowRatio` at `105480`: `0.9211 -> 0.9659`
  - Andes late-window low-level cloud-water ratio tightened further:
    - `qcLowRatio` at `105480`: `0.4327 -> 0.4018`
  - Rockies stayed windward-favored:
    - `75600`: `1.3702 -> 1.3729`
    - `105480`: `1.3430 -> 1.3453`
  - Himalaya-Tibet stayed windward-favored:
    - `75600`: `1.2097 -> 1.0213`
    - `105480`: `1.6335 -> 1.5187`
- The live runtime telemetry path remains healthy: the canonical localhost verification run produced `235` weather-log lines and preserved the honest smoothness warnings instead of falling back to `lineCount = 0`.
- The main mission is still broader Earth-like realism, not one mountain-ratio win. Andes precipitation is now windward-favored at the mature late window in the trusted offline audit, but broader browser realism still needs re-audits across circulation, storm organization, clouds, precipitation placement, and multi-day credibility.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline audit (`weather-validation/output/cycle-2026-04-08T13-11-22Z-terrain-coupling-mass-fix-preservation/prefix-orographic-audit.json`) reproduced the remaining mature Andes blocker on the trusted headless-terrain path:
  - Andes `precipRatio = 1.0566` at `75600`
  - Andes `precipRatio = 0.9631` at `105480`
  - Andes `qrLowRatio = 0.9211` at `105480`
  - Andes `qcLowRatio = 0.4327` at `105480`
- The verified fix changed real app weather code:
  - `src/weather/v2/vertical5.js` -> terrain-coupled lee-side low-level ascent damping that reduces usable ascent when strong terrain subsidence exists without prior delivery exposure
  - `src/weather/v2/core5.js` -> tuned default `terrainLeeAscentDamp: 0.8`
  - `src/weather/v2/terrainCoupling.test.js` -> regression coverage for lee-side ascent damping and delivery-exposure protection
- Fresh same-cycle post-fix audit (`weather-validation/output/cycle-2026-04-08T13-11-22Z-terrain-coupling-mass-fix-preservation/postfix-orographic-audit.json`) confirmed the mature-window split is now windward-favored:
  - Andes `precipRatio = 1.1553` at `75600`
  - Andes `precipRatio = 1.0099` at `105480`
  - Andes `qrLowRatio = 0.9659` at `105480`
  - Andes `qcLowRatio = 0.4018` at `105480`
  - Rockies `precipRatio = 1.3453` at `105480`
  - Himalaya-Tibet `precipRatio = 1.5187` at `105480`
- Targeted automated validation passed:
  - `node --test src/weather/v2/terrainCoupling.test.js src/weather/v2/microphysicsPhase7.test.js`: PASS
  - `npm run weather:validate:test`: PASS
  - `npm run weather:benchmark`: PASS
- Fresh canonical localhost verification reused the existing browser tab, left the single page-tab path clean, and kept the app rendering on `http://127.0.0.1:3000/?mode=solo` with the usual controls and forecast panels visible and no blocking error overlay after the hot reload.
- The recovered runtime summary contains `235` lines and still surfaces the next blocker honestly: `earth_update_p95_high`, `earth_update_max_high`, and `wind_targets_failing`.

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits in the live app with the new terrain-coupled lee ascent damping active.
- Orographic realism is improved but not solved: the Andes mature-window `precipRatio` is now windward-favored at `1.0099`, but late-window low-level rain placement (`qrLowRatio = 0.9659`) still trails a clearly comfortable upslope margin.
- Runtime smoothness is still not signed off; the latest run now has good telemetry and still shows genuine performance issues instead of degraded logging.
- The live browser path is functional, but the console still emits repeated `THREE.WebGLRenderer: Texture marked for update but no image data found.` warnings.
- World-class status still requires realism and smoothness to pass in the same fresh live run.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Stay on orographic realism and re-audit the Andes with the new terrain-coupled lee ascent damping active, prioritizing the remaining late-window rain-placement gap (`qrLowRatio`) at `105480`.
2. Keep the next physics cycle focused on one concrete `src/` fix area instead of another broad terrain retune.
3. Decide whether the remaining Andes gap is now mostly `precipitation placement/conversion after upslope moisture transport` or a deeper `terrain-flow orientation` issue before touching microphysics again.
4. When smoothness becomes the blocker again, use the fresh non-empty runtime telemetry before changing renderer or worker performance behavior.
5. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
