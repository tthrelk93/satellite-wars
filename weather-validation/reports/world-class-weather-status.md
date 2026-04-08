# World-Class Weather Status

Updated: 2026-04-08
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-08T12-26-47Z-terrain-coupling-lee-retention`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab -- 'http://127.0.0.1:3000/?mode=solo'` reused the existing OpenClaw browser tab with no duplicate page tabs.
- The latest verified physics change adds a terrain-coupled lee-side low-level warm-rain suppression / faster evaporation response in `src/weather/v2/microphysics5.js` when terrain-induced subsidence is strong but recent orographic delivery exposure is absent.
- Fresh mature-window offline evidence shows a further verified Andes improvement while keeping the other audited mountain regions windward-favored:
  - Andes `precipRatio`
    - `75600`: `1.0394 -> 1.0566`
    - `105480`: `0.9271 -> 0.9631`
  - Andes late-window low-level rain ratio also improved:
    - `qrLowRatio` at `105480`: `0.8871 -> 0.9211`
  - Rockies stayed windward-favored:
    - `75600`: `1.3691 -> 1.3702`
    - `105480`: `1.3421 -> 1.3430`
  - Himalaya-Tibet stayed windward-favored and improved further at the late window:
    - `75600`: `1.0083 -> 1.2097`
    - `105480`: `1.4148 -> 1.6335`
- The live runtime telemetry path remains healthy: the canonical localhost verification run produced `173` weather-log lines and preserved the honest smoothness warnings instead of falling back to `lineCount = 0`.
- The main mission is still broader Earth-like realism, not one mountain-ratio win. Andes precipitation placement is now less lee-biased at the mature late window, but broader browser realism still needs re-audits across circulation, storm organization, clouds, precipitation placement, and multi-day credibility.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline audit (`weather-validation/output/cycle-2026-04-08T12-26-47Z-terrain-coupling-lee-retention/prefix-orographic-audit.json`) reproduced the remaining mature Andes blocker on the trusted headless-terrain path:
  - Andes `precipRatio = 1.0394` at `75600`
  - Andes `precipRatio = 0.9271` at `105480`
  - Andes `qrLowRatio = 0.8871` at `105480`
  - Andes `qcLowRatio = 0.4905` at `105480`
- The verified fix changed real app weather code:
  - `src/weather/v2/microphysics5.js` -> terrain-coupled low-level lee drying/suppression that reacts to strong terrain subsidence without recent delivery exposure
- Fresh same-cycle post-fix audit (`weather-validation/output/cycle-2026-04-08T12-26-47Z-terrain-coupling-lee-retention/postfix-orographic-audit.json`) confirmed the mature-window direction improved again:
  - Andes `precipRatio = 1.0566` at `75600`
  - Andes `precipRatio = 0.9631` at `105480`
  - Andes `qrLowRatio = 0.9211` at `105480`
  - Andes `qcLowRatio = 0.4327` at `105480`
  - Rockies `precipRatio = 1.3430` at `105480`
  - Himalaya-Tibet `precipRatio = 1.6335` at `105480`
- Targeted automated validation passed:
  - `node --test src/weather/v2/terrainCoupling.test.js src/weather/v2/microphysicsPhase7.test.js`: PASS
  - `npm run weather:validate:test`: PASS
  - `npm run weather:benchmark`: PASS
- Fresh canonical localhost verification reused the existing browser tab, left the single page-tab path clean, and kept the app rendering on `http://127.0.0.1:3000/?mode=solo` while sim time advanced from `Day 0, 01:58` to `Day 0, 07:38` in the same tab.
- The recovered runtime summary (`runtime-summary.json`) contains `173` lines and still surfaces the next blocker honestly: `earth_update_p95_high`, `earth_update_max_high`, and `wind_targets_failing`.

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits in the live app with the new terrain-coupled lee drying active.
- Orographic realism is improved but not solved: the Andes mature-window `precipRatio` now reaches `0.9631` at `105480`, which is materially better than `0.9271` but still short of a clearly windward-favored late-window split.
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

1. Stay on orographic realism and re-audit the Andes with the new terrain-coupled lee drying active, prioritizing the remaining later-window shortfall at `105480`.
2. Keep the next physics cycle focused on one concrete `src/` fix area instead of another broad terrain retune.
3. Decide whether the remaining Andes shortfall is now mostly a terrain/flow problem or a residual low-level condensate-retention problem before touching microphysics again.
4. When smoothness becomes the blocker again, use the fresh non-empty runtime telemetry before changing renderer or worker performance behavior.
5. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
