# World-Class Weather Status

Updated: 2026-04-08
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-08T07-32-00Z-andes-sampling-design-refinement`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab -- 'http://127.0.0.1:3000/?mode=solo'` reused the existing OpenClaw browser tab with no duplicate page tabs.
- The latest verified physics change adds a small default broad-terrain sampling blend by setting `terrainDirectionalBlend = 0.05` in `src/weather/v2/core5.js` / `src/weather/v2/vertical5.js`.
- Fresh mature-window offline evidence shows a small but verified further Andes improvement while keeping the other audited mountain regions windward-favored:
  - Andes `precipRatio`
    - `75600`: `1.0099 -> 1.0394`
    - `105480`: `0.9226 -> 0.9271`
  - Rockies stayed windward-favored:
    - `75600`: `1.3679 -> 1.3691`
    - `105480`: `1.3412 -> 1.3421`
  - Himalaya-Tibet stayed windward-favored:
    - `75600`: `1.0188 -> 1.0083`
    - `105480`: `1.4181 -> 1.4148`
- The live runtime telemetry path remains healthy: the canonical localhost verification run produced `66` weather-log lines and preserved the honest smoothness warnings instead of falling back to `lineCount = 0`.
- The main mission is still broader Earth-like realism, not one mountain-ratio win. Andes sampling is slightly better tuned, but mature browser realism still needs re-audits across circulation, storm organization, clouds, precipitation placement, and multi-day credibility.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline audit (`weather-validation/output/cycle-2026-04-08T07-32-00Z-andes-sampling-design-refinement/prefix-orographic-audit.json`) reproduced the latest remaining Andes blocker on the trusted headless-terrain path:
  - Andes `precipRatio = 1.0099` at `75600`
  - Andes `precipRatio = 0.9226` at `105480`
  - Andes `terrainOmegaLowContrast = -3.1231` at `75600`
  - Andes `terrainOmegaLowContrast = -3.1197` at `105480`
- The verified fix changed real app weather code:
  - `src/weather/v2/vertical5.js` -> blend local terrain-normal flow with a short broad-terrain sample via default `terrainDirectionalBlend = 0.05`
  - `src/weather/v2/core5.js` -> ship the same `terrainDirectionalBlend = 0.05` default
- Fresh same-cycle post-fix audit (`weather-validation/output/cycle-2026-04-08T07-32-00Z-andes-sampling-design-refinement/postfix-orographic-audit.json`) confirmed the mature-window direction improved again:
  - Andes `precipRatio = 1.0394` at `75600`
  - Andes `precipRatio = 0.9271` at `105480`
  - Andes `terrainOmegaLowContrast = -3.1228` at `75600`
  - Andes `terrainOmegaLowContrast = -3.1194` at `105480`
- Targeted automated validation passed:
  - `node --test src/weather/v2/terrainCoupling.test.js`: `5/5` pass
  - `npm run weather:validate:test`: PASS
  - `npm run weather:benchmark`: PASS
- Fresh canonical localhost verification reused the existing browser tab, left the single page-tab path clean, and kept the app rendering on `http://127.0.0.1:3000/?mode=solo`.
- The recovered runtime summary (`runtime-summary.json`) contains `66` lines and still surfaces the next blocker honestly: `earth_update_p95_high`, `earth_update_max_high`, and `wind_targets_failing`.

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits in the live app with lee-side subsidence damping active.
- Orographic realism is improved but not solved: the Andes mature-window `precipRatio` now reaches `1.0394` at the earlier target but is still only `0.9271` at `105480`, and broader terrain/flow realism still needs more selective refinement.
- Runtime smoothness is still not signed off; the latest run now has good telemetry and shows genuine performance issues instead of degraded logging.
- World-class status still requires realism and smoothness to pass in the same fresh live run.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Stay on orographic realism and re-audit the Andes with the new broad-terrain sampling blend active, prioritizing the remaining later-window shortfall at `105480`.
2. Keep the next physics cycle focused on one concrete `src/` fix area instead of another broad terrain retune.
3. When smoothness becomes the blocker again, use the fresh non-empty runtime telemetry before changing renderer or worker performance behavior.
4. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
