# World-Class Weather Status

Updated: 2026-04-08
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-08T21-25-17Z-terrain-coupling-lee-rain-retention-gate`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab` reused the existing OpenClaw browser tab for `http://127.0.0.1:3000/?mode=solo` and closed duplicate localhost tabs.
- The latest verified physics change tightens the terrain-coupled lee/no-delivery gate in `src/weather/v2/vertical5.js` + `src/weather/v2/microphysics5.js`, promoted through matching defaults in `src/weather/v2/core5.js`, so lee-side low-level rain conversion is suppressed sooner when terrain-diagnosed subsidence disagrees with residual ascent.
- Fresh mature-window offline evidence now pushes the audited Andes split above windward parity while keeping the other mountain regions windward-favored:
  - Andes `precipRatio`
    - `75600`: `1.2771 -> 1.4266`
    - `105480`: `0.9759 -> 1.0899`
  - Andes late-window low-level rain ratio improved again:
    - `qrLowRatio` at `105480`: `0.8662 -> 0.9619`
  - Rockies stayed windward-favored:
    - `75600`: `1.2845 -> 1.3261`
    - `105480`: `1.2733 -> 1.3101`
  - Himalaya-Tibet stayed windward-favored:
    - `75600`: `1.4374 -> 1.0067`
    - `105480`: `1.3310 -> 1.9379`
- The live runtime telemetry path remains healthy: the canonical localhost verification run produced `212` weather-log lines and preserved the honest smoothness warnings instead of falling back to `lineCount = 0`.
- The main mission is still broader Earth-like realism, not one mountain-ratio win. This cycle clears the specific audited Andes mature-window parity blocker in the trusted offline audit, but broader browser realism still needs re-audits across circulation, storm organization, clouds, precipitation placement, and multi-day credibility.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline audit (`weather-validation/output/cycle-2026-04-08T21-25-17Z-terrain-coupling-lee-rain-retention-gate/prefix-orographic-audit.json`) reproduced the remaining mature Andes blocker on the trusted headless-terrain path:
  - Andes `precipRatio = 1.2771` at `75600`
  - Andes `precipRatio = 0.9759` at `105480`
  - Andes `qrLowRatio = 0.8662` at `105480`
  - Andes `qcLowRatio = 1.0270` at `105480`
- Same-cycle sensitivity probes showed the remaining headroom was in the lee/no-delivery thresholds plus warm-rain suppression rather than another exposure-memory tweak:
  - `probe-lee-gate-0.15-1.2.json` pushed Andes `precipRatio = 1.0693` at `105480` but let Himalaya `75600` slip to `0.9569`
  - `probe-lee-gate-0.15-1.2-warm-rain-0.90.json` cleared the combined offline gate before promotion
- The verified fix changed real app weather code:
  - `src/weather/v2/vertical5.js` -> tighter default lee/no-delivery thresholds (`terrainLeeOmega0: 0.15`, `terrainLeeOmega1: 1.2`)
  - `src/weather/v2/microphysics5.js` -> stronger lee warm-rain suppression default (`terrainLeeWarmRainSuppress: 0.9`) with matching threshold fallbacks
  - `src/weather/v2/core5.js` -> promoted matching runtime defaults for the coupled vertical + microphysics path
- Fresh same-cycle post-fix audit (`weather-validation/output/cycle-2026-04-08T21-25-17Z-terrain-coupling-lee-rain-retention-gate/postfix-orographic-audit.json`) confirmed the audited Andes mature-window split now clears parity:
  - Andes `precipRatio = 1.4266` at `75600`
  - Andes `precipRatio = 1.0899` at `105480`
  - Andes `qrLowRatio = 0.9619` at `105480`
  - Rockies `precipRatio = 1.3261` at `75600`, `1.3101` at `105480`
  - Himalaya-Tibet `precipRatio = 1.0067` at `75600`, `1.9379` at `105480`
- Targeted automated validation passed:
  - `node --experimental-default-type=module --experimental-specifier-resolution=node --test src/weather/v2/terrainCoupling.test.js src/weather/v2/microphysicsPhase7.test.js`: PASS
- Fresh canonical localhost verification reused the existing browser tab, closed duplicate localhost tabs, and kept the app rendering on `http://127.0.0.1:3000/?mode=solo`; the HUD was live at `Day 0, 00:56`, so the app was loading and advancing rather than stalling on boot.
- The recovered runtime summary contains `212` lines and still surfaces the next blocker honestly: `earth_update_p95_high`, `earth_update_max_high`, and `wind_targets_failing`.

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits in the live app with the tighter lee/no-delivery coupling active.
- Orographic realism is materially better, but not fully signed off: the audited Andes mature-window split now clears parity, yet the weakest retained mountain ratio is still only `1.0067` (Himalaya-Tibet at `75600`), so more margin would be healthier before calling the coupling robust.
- Runtime smoothness is still not signed off; the latest run has good telemetry and still shows genuine performance issues instead of degraded logging.
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

1. Re-audit broader live realism with the new lee/no-delivery defaults active instead of assuming the mountain-only offline win generalizes automatically.
2. If more terrain work is needed, protect the newly-cleared Andes `105480` parity and add margin to the weakest surviving mountain ratio (`Himalaya-Tibet 75600 = 1.0067`) rather than reopening broad terrain retunes.
3. Use the fresh non-empty runtime telemetry before changing renderer or worker performance behavior; the honest blocker remains `earth_update_*` plus weak wind targets.
4. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
