# World-Class Weather Status

Updated: 2026-04-08
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-08T05-24-30Z-upslope-only-terrain-coupling`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab -- http://127.0.0.1:3000/` successfully reused the existing OpenClaw browser tab and closed duplicates.
- The latest verified physics change damps lee-side terrain-driven subsidence by setting `orographicLeeSubsidenceScale = 0.35` in `src/weather/v2/vertical5.js`.
- Fresh mature-window offline evidence shows materially better Andes windward-vs-lee precipitation while keeping the other audited mountain regions windward-favored:
  - `75600`: Andes `precipRatio` improved from `0.8353` to `1.0099`
  - `105480`: Andes `precipRatio` improved from `0.8217` to `0.9226`
  - Rockies remained windward-favored and improved further:
    - `75600`: `1.2984 -> 1.3679`
    - `105480`: `1.2861 -> 1.3412`
  - Himalaya-Tibet stayed windward-favored:
    - `75600`: `1.2676 -> 1.0188`
    - `105480`: `1.5411 -> 1.4181`
- The live runtime telemetry path is recovered: the same canonical localhost run produced `252` weather-log lines instead of the previous `lineCount = 0` failure mode.
- The main mission is still broader Earth-like realism, not one mountain-ratio win. Terrain coupling is better tuned and live telemetry is healthier, but mature browser realism still needs re-audits across circulation, storm organization, clouds, precipitation placement, and multi-day credibility.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline audit (`weather-validation/output/cycle-2026-04-08T05-24-30Z-upslope-only-terrain-coupling/prefix-orographic-audit.json`) reproduced the latest remaining Andes blocker on the trusted headless-terrain path:
  - Andes `precipRatio = 0.8353` at `75600`
  - Andes `precipRatio = 0.8217` at `105480`
  - Andes `terrainOmegaLowContrast = -4.6081` at `75600`
  - Andes `terrainOmegaLowContrast = -4.6019` at `105480`
- The verified fix changed real app weather code:
  - `src/weather/v2/vertical5.js` -> default `orographicLeeSubsidenceScale = 0.35`
- Fresh same-cycle post-fix audit (`weather-validation/output/cycle-2026-04-08T05-24-30Z-upslope-only-terrain-coupling/postfix-orographic-audit.json`) confirmed the mature-window direction improved again:
  - Andes `precipRatio = 1.0099` at `75600`
  - Andes `precipRatio = 0.9226` at `105480`
  - Andes `terrainOmegaLowContrast = -4.6181` at `75600`
  - Andes `terrainOmegaLowContrast = -4.6130` at `105480`
- Targeted automated validation passed:
  - `node --test src/weather/v2/terrainCoupling.test.js`: `4/4` pass
  - `npm run weather:validate:test`: PASS
  - `npm run weather:benchmark`: PASS
- Fresh canonical localhost verification reused the existing browser tab, closed duplicate localhost tabs, and emitted a real runtime log again on `http://127.0.0.1:3000/?mode=solo`.
- The recovered runtime summary (`runtime-summary.json`) now contains `252` lines and shows the next blocker honestly: `earth_update_p95_high`, `earth_update_max_high`, and `wind_targets_failing`.

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits in the live app with lee-side subsidence damping active.
- Orographic realism is improved but not solved: the Andes mature-window `precipRatio` now clears `1.0` at the earlier target but is still `0.9226` at `105480`, and the terrain-flow sample geometry still needs refinement.
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

1. Stay on orographic realism and re-audit the Andes with lee-side subsidence damping active, prioritizing the remaining later-window shortfall and terrain-flow sample-geometry mismatch.
2. Make the next cycle a concrete `src/` fix attempt before taking any new diagnostics-only detour.
3. When smoothness becomes the blocker again, use the fresh non-empty runtime telemetry before changing renderer or worker performance behavior.
4. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
