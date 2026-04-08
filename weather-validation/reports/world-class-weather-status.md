# World-Class Weather Status

Updated: 2026-04-08
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-08T04-47-37Z-orographic-lift-scale`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab -- http://127.0.0.1:3000/` successfully reused the existing OpenClaw browser tab and closed duplicates.
- The latest verified physics change weakens default terrain-forced lift coupling by setting `vertParams.orographicLiftScale = 0.5` in `src/weather/v2/core5.js`.
- Fresh mature-window offline evidence shows materially better Andes windward-vs-lee precipitation without flipping the other audited mountain regions the wrong way:
  - `75600`: Andes `precipRatio` improved from `0.7164` to `0.8353`
  - `105480`: Andes `precipRatio` improved from `0.7385` to `0.8217`
  - Andes terrain-forced low-level omega contrast weakened in the same direction:
    - `75600`: `-9.1997 -> -4.6081`
    - `105480`: `-9.1853 -> -4.6019`
  - Rockies remained windward-favored:
    - `75600`: `1.2021 -> 1.2984`
    - `105480`: `1.2097 -> 1.2861`
- The live canonical localhost run still loaded and rendered correctly after the change; the reused tab reached the in-game single-player globe with weather layers active and no obvious immediate terrain-coupling regression.
- The main mission is still broader Earth-like realism, not one mountain-ratio win. Terrain coupling is now somewhat better tuned offline, but mature browser realism still needs re-audits across circulation, storm organization, clouds, precipitation placement, and multi-day credibility.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline audit (`weather-validation/output/cycle-2026-04-08T04-47-37Z-orographic-lift-scale/prefix-orographic-audit.json`) reproduced the blocker on the trusted headless-terrain path:
  - Andes `precipRatio = 0.7164` at `75600`
  - Andes `precipRatio = 0.7385` at `105480`
  - Andes `terrainOmegaLowContrast = -9.1997` at `75600`
  - Andes `terrainOmegaLowContrast = -9.1853` at `105480`
- The verified fix sets the default terrain-coupling strength explicitly in app code:
  - `src/weather/v2/core5.js` -> `vertParams.orographicLiftScale = 0.5`
- Fresh same-cycle post-fix audit (`weather-validation/output/cycle-2026-04-08T04-47-37Z-orographic-lift-scale/postfix-orographic-audit.json`) confirmed the mature-window direction improved:
  - Andes `precipRatio = 0.8353` at `75600`
  - Andes `precipRatio = 0.8217` at `105480`
  - Andes `terrainOmegaLowContrast = -4.6081` at `75600`
  - Andes `terrainOmegaLowContrast = -4.6019` at `105480`
- Targeted automated validation passed:
  - `node --test src/weather/v2/terrainCoupling.test.js`: `3/3` pass
  - `npm run weather:benchmark`: PASS
- Full `npm run weather:validate:test` did **not** pass cleanly in this cycle, but the failures were the pre-existing ESM import / loader issue in `weather-validation/tests/headless-terrain-fixture.test.mjs` and `weather-validation/tests/orographic-audit.test.mjs`, not a terrain-coupling regression from the new physics change.
- Fresh canonical localhost verification reused the existing browser tab, closed duplicate localhost tabs, and reached the in-game globe view after selecting single-player.
- Runtime helper execution from that live run again produced a degraded logging artifact (`runtime-summary.json -> lineCount: 0`), so the live signoff for this cycle rests on direct browser observation plus the offline mature-window audit and benchmark output.

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits with the weaker terrain-coupling default active in the real app.
- Orographic realism is improved but not solved: the Andes mature-window `precipRatio` is still below `1.0`, and the regional sample split still shows all-negative terrain-flow quartiles.
- Runtime smoothness is still not signed off; the latest run again produced `runtime-summary.json -> lineCount: 0`, so performance claims still need a fresh non-degraded telemetry pass when smoothness returns to the front of the queue.
- World-class status still requires realism and smoothness to pass in the same fresh live run.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Stay on orographic realism and re-audit the Andes with the weaker default lift coupling active, prioritizing the remaining sample-design / terrain-flow-sign mismatch before another microphysics-only tweak.
2. Verify the same blocker family in a mature browser window once a candidate deserves it, rather than recollecting duplicate early baselines.
3. When smoothness becomes the blocker again, collect fresh hotspot attribution before changing renderer or worker performance behavior.
4. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
