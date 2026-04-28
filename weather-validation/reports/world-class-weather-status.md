# World-Class Weather Status

Updated: 2026-04-28
Verdict: NOT WORLD CLASS YET

## Current Baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-28T01-08-28Z-phase8-live-game-realism-smoothness-completion`
- Phase 8 live browser/runtime signoff: PASS
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.json`)
- Latest fresh planetary regression in the Phase 8 cycle: PASS (`weather-validation/output/cycle-2026-04-28T01-08-28Z-phase8-live-game-realism-smoothness-completion/phase8-quick-audit.json`)
- Latest full annual climate baseline: PASS from Phase 7 (`weather-validation/output/cycle-2026-04-27T02-12-02Z-phase7-tropical-cyclones-severe-weather-recovery/phase7-final-annual-r2.json`)

## Fresh Evidence From The Latest Cycle

Phase 8 live smoothness and browser-backed signoff are verified.

- Runtime/render code path changed:
  - `src/Earth.js`: weather-worker startup stays external-core backed, live weather textures use `renderScale: 1.5`, and Earth.update now reports phase/substage telemetry.
  - `src/WeatherField.js`: cloud texture painting uses cached noise and exposes paint/logger/physics perf stats.
  - `src/WindStreamlineRenderer.js`: live wind overlay field size, particle density, cadence, and substeps are bounded for browser smoothness.
  - `src/weather/WeatherLogger.js`: render-loop auto logging excludes broad climate diagnostics by default.
  - `src/weather/v2/vertical5.js`: live Phase 7 upper-cloud/transition containment params are accepted without unknown-param warnings.
  - `scripts/agent/profile-runtime-hotspots.mjs`: hotspots now attribute Earth phases, WeatherField stages, and wind overlay stages.
  - `scripts/agent/summarize-runtime-log.mjs`: runtime, visual overlay, and model-wind target health are reported separately.
- Final live runtime artifact: `weather-validation/output/cycle-2026-04-28T01-08-28Z-phase8-live-game-realism-smoothness-completion/runtime-summary-final-live.json`
  - `lineCount = 858`
  - Earth.update p50/p95/max: `0.10 / 8.10 / 11.80 ms`
  - skipped simulation steps: `0`
  - runtime warnings: none
  - visual overlay warnings: none
  - model-wind warning: `wind_model_targets_failing`
- Final hotspot artifact: `weather-validation/output/cycle-2026-04-28T01-08-28Z-phase8-live-game-realism-smoothness-completion/hotspot-profile.json`
  - perf instrumentation: present
  - cloud-paint p95/max: `7.8 / 9.4 ms`
  - wind-viz p95/max: `3.0 / 3.6 ms`
  - remaining performance focus, if needed: `WeatherField._paintClouds`
- Browser-backed evidence:
  - canonical app URL: `http://127.0.0.1:3000/?mode=solo`
  - current-run browser console warnings/errors after restart: none
  - screenshots: `live-watch-t0.png`, `live-watch-t60.png`, `live-watch-t120.png`, `live-watch-t180.png`
  - observation: real model cloud/wind layers visibly evolved from Day 0 morning into afternoon without dead circulation, runaway drift, or broken overlay motion.
- Climate regression evidence:
  - `npm run agent:planetary-realism-audit -- --preset quick --out weather-validation/output/cycle-2026-04-28T01-08-28Z-phase8-live-game-realism-smoothness-completion/phase8-quick-audit.json --md-out weather-validation/output/cycle-2026-04-28T01-08-28Z-phase8-live-game-realism-smoothness-completion/phase8-quick-audit.md`: PASS
  - quick audit preset/grid/dt: `quick / 48x24 / 1800s`

## Validation

- `node --test src/WindStreamlineRenderer.test.js src/weather/v2/vertical5.test.js weather-validation/tests/phase8-live-worker-startup-contract.test.mjs`: 44/44 pass
- `npm run weather:validate:test`: 245/245 pass
- `npm run weather:benchmark`: PASS
- `npm run agent:planetary-realism-audit -- --preset quick ...`: PASS

## What Still Blocks "World Class"

- A fresh annual audit at the final post-Phase-8 commit hash has not been run; the full annual evidence is still the Phase 7 annual baseline plus this Phase 8 quick regression.
- Live near-surface model-wind targets remain low (`model_mean_low`, `model_p90_low`, `model_p99_low`). The rendered wind overlay passes visual motion/churn/clipping gates, so this is a model-wind/circulation diagnostic, not a browser smoothness blocker.
- The annual root-cause sidecars still rank imported cloud persistence/helper forcing as the dominant residual climate family, even though annual planetary gates pass.
- South America tornado seasonality remains diagnostic-only and cool-season biased; the hard tornado warm-season gate is North America and passes.

## Default Next Priority

1. Run a current-hash annual repro audit when ready to make a final world-class claim.
2. If the annual audit remains clean, attack the residual near-surface model-wind target or imported cloud-persistence family only if they still block the claim.
3. Keep browser live signoff in the loop whenever runtime/render/weather visualization changes.

## Commit Discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.
