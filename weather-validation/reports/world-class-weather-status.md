# World-Class Weather Status

Updated: 2026-04-08
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-08T19-56-43Z-terrain-coupling-lee-omega-floor`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab -- 'http://127.0.0.1:3000/?mode=solo'` reused the existing OpenClaw browser tab with no duplicate page tabs.
- The latest verified physics change adds a terrain-coupled lee-side effective-omega floor in `src/weather/v2/vertical5.js` so low-level residual ascent gets blended back toward diagnosed terrain subsidence when a column is lee-side with no recent delivery exposure, with matching defaults in `src/weather/v2/core5.js` and focused regression coverage in `src/weather/v2/terrainCoupling.test.js`.
- Fresh mature-window offline evidence now substantially narrows the audited Andes blocker while keeping the other mountain regions windward-favored:
  - Andes `precipRatio`
    - `75600`: `0.7146 -> 1.2771`
    - `105480`: `0.7350 -> 0.9759`
  - Andes late-window low-level rain ratio improved strongly:
    - `qrLowRatio` at `105480`: `0.6703 -> 0.8662`
  - Andes late-window low-level cloud-water ratio also recovered:
    - `qcLowRatio` at `105480`: `0.3755 -> 1.0270`
  - Rockies stayed windward-favored:
    - `75600`: `1.2772 -> 1.2845`
    - `105480`: `1.2671 -> 1.2733`
  - Himalaya-Tibet stayed windward-favored:
    - `75600`: `1.0263 -> 1.4374`
    - `105480`: `1.3738 -> 1.3310`
- The live runtime telemetry path remains healthy: the canonical localhost verification run produced `283` weather-log lines and preserved the honest smoothness warnings instead of falling back to `lineCount = 0`.
- The main mission is still broader Earth-like realism, not one mountain-ratio win. This cycle materially improves the remaining audited Andes mature-window blocker in the trusted offline audit, but broader browser realism still needs re-audits across circulation, storm organization, clouds, precipitation placement, and multi-day credibility.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline audit (`weather-validation/output/cycle-2026-04-08T19-56-43Z-terrain-coupling-lee-omega-floor/prefix-orographic-audit.json`) reproduced the remaining mature Andes blocker on the trusted headless-terrain path:
  - Andes `precipRatio = 0.7146` at `75600`
  - Andes `precipRatio = 0.7350` at `105480`
  - Andes `qrLowRatio = 0.6703` at `105480`
  - Andes `qcLowRatio = 0.3755` at `105480`
- A same-cycle sensitivity probe (`weather-validation/output/cycle-2026-04-08T19-56-43Z-terrain-coupling-lee-omega-floor/probe-omega-floor-blend-1.0.json`) showed the new terrain-coupled omega-floor logic had real headroom before promoting it to the default:
  - Andes `precipRatio = 0.9759` at `105480`
  - Andes `qrLowRatio = 0.8662` at `105480`
- The verified fix changed real app weather code:
  - `src/weather/v2/vertical5.js` -> terrain-coupled lee-side effective-omega floor that blends low-level residual ascent back toward terrain subsidence when delivery exposure is absent
  - `src/weather/v2/core5.js` -> tuned default `terrainLeeOmegaFloorBlend: 1.0`
  - `src/weather/v2/terrainCoupling.test.js` -> regression coverage for both lee-side ascent damping isolation and the new residual-ascent/terrain-subsidence blending behavior
- Fresh same-cycle post-fix audit (`weather-validation/output/cycle-2026-04-08T19-56-43Z-terrain-coupling-lee-omega-floor/postfix-orographic-audit.json`) confirmed a large recovery in the mature-window split:
  - Andes `precipRatio = 1.2771` at `75600`
  - Andes `precipRatio = 0.9759` at `105480`
  - Andes `qrLowRatio = 0.8662` at `105480`
  - Andes `qcLowRatio = 1.0270` at `105480`
  - Rockies `precipRatio = 1.2733` at `105480`
  - Himalaya-Tibet `precipRatio = 1.3310` at `105480`
- Targeted automated validation passed:
  - `node --test src/weather/v2/terrainCoupling.test.js`: PASS
- Fresh canonical localhost verification reused the existing browser tab, left the single page-tab path clean, and kept the app rendering on `http://127.0.0.1:3000/?mode=solo` with the usual controls and forecast panel visible after hot reload; console review showed no new blocking errors beyond the long-standing texture/logging restart warnings.
- The recovered runtime summary contains `283` lines and still surfaces the next blocker honestly: `earth_update_p95_high`, `earth_update_max_high`, and `wind_targets_failing`.

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits in the live app with the new terrain-coupled lee omega floor active.
- Orographic realism is improved but not solved: the Andes mature-window `precipRatio` improved from `0.7350` to `0.9759` and `qrLowRatio` improved from `0.6703` to `0.8662`, but the late-window Andes split still needs one more push above clean windward parity.
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

1. Stay on orographic realism for one more bounded physics cycle and try to push the Andes `105480` split the rest of the way above clean windward parity without giving back the strong `75600` recovery.
2. Keep the next physics cycle focused on one concrete `src/` fix area instead of another broad terrain retune.
3. Use the fresh non-empty runtime telemetry before changing renderer or worker performance behavior; the honest blocker remains `earth_update_*` plus weak wind targets.
4. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
