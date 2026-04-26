# World-Class Weather Status

Updated: 2026-04-26
Verdict: NOT WORLD CLASS YET

## Current Baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-25T22-47-48Z-phase4-tropical-rain-engine-seasonal`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Planetary realism status: PASS at the latest 90-day seasonal repro gate (`weather-validation/reports/planetary-realism-status.json`)

## Fresh Evidence From The Latest Cycle

Phase 4 tropical rain engine is verified and ready to hand off to Phase 5.

- Code path changed:
  - `src/weather/v2/surface2d.js`: bounded warm tropical open-ocean evaporation boost.
  - `src/weather/v2/core5.js`: promoted organized tropical convection/rainout defaults.
  - `src/weather/v2/microphysics5.js`: convective/stratiform precipitation accounting plus stronger organized convective rainout.
  - `src/weather/v2/state5.js` and `src/weather/validation/diagnostics.js`: convective/stratiform precipitation diagnostics.
  - `scripts/agent/planetary-realism-audit.mjs` and `scripts/agent/planetary-candidate-sweep.mjs`: audit/sweep metrics for convective vs stratiform rain.
- Seasonal repro audit artifact: `weather-validation/output/cycle-2026-04-25T22-47-48Z-phase4-tropical-rain-engine-seasonal/phase4-production-seasonal-repro.json`
  - `overallPass = true`
  - warnings: none
  - day-90 global precipitation: `0.065 mm/hr`
  - day-90 equatorial precipitation: `0.128 mm/hr`
  - day-90 global convective/stratiform precipitation: `0.019 / 0.045 mm/hr`
  - day-90 tropical convective/stratiform precipitation: `0.055 / 0.074 mm/hr`
  - day-90 tropical convective precipitation share: `0.426`
  - day-90 tropical convective mass flux: `0.00482 kg/m²/s`
  - day-90 TCW: `10.304 kg/m²`
  - day-90 dry-belt ratios N/S: `0.315 / 0.475`
  - day-90 ITCZ latitude/width: `-2.156 / 21.327 deg`
  - water-cycle budget: PASS
  - E/P relative imbalance: `0.02904`
  - TCW drift: `6.60572 kg/m²`
  - numerical integrity score/pass: `0.8872 / true`
  - numerical limiter dominance: `false`
  - numerical climate contract: PASS
  - dt/grid sensitivity: PASS/PASS
- Supporting quick artifact: `weather-validation/output/cycle-2026-04-25T20-35-23Z-phase4-tropical-rain-engine/phase4-production-quick.json`
  - `overallPass = true`
  - global precipitation: `0.060 mm/hr`
  - equatorial precipitation: `0.110 mm/hr`
  - tropical convective precipitation: `0.045 mm/hr`
  - tropical convective mass flux: `0.00453 kg/m²/s`
  - dry-belt ratios N/S: `0.410 / 0.475`

## Validation

- `node --test src/weather/v2/core5.test.js src/weather/v2/microphysicsPhase7.test.js src/weather/v2/oceanIce.test.js weather-validation/tests/planetary-realism-audit.test.mjs`: 56/56 pass
- `npm run weather:validate:test`: 237/237 pass
- `npm run weather:benchmark`: PASS

## What Still Blocks "World Class"

- This is a 90-day seasonal Phase 4 claim, not a full annual world-class claim.
- A full annual planetary-realism pass with dt/grid repro enabled is still required before any annual or world-class claim.
- The default deep counterfactual seasonal proof path is still expensive; the Phase 4 gate used `--preset seasonal --repro-check --no-counterfactuals`, which is sufficient for the rain-engine pass gate but not a replacement for full annual proof.
- Browser/runtime signoff is still required after the verified climate fix, including smoothness telemetry and visual observation in the live app.
- World-class status still requires realism and smoothness to pass in the same browser-backed run.

## Canonical Cycle Inputs

- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/planetary-realism-status.md`
- `weather-validation/reports/worker-brief.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default Next Priority

1. Move to Phase 5 from the verified Phase 4 tropical rain baseline.
2. Run bounded live/browser verification after this verified climate fix or when runtime debt becomes blocking again.
3. Before any world-class or annual-seasonality claim, run full annual planetary realism with dt/grid repro enabled.
4. Keep validation on the clean world-class checkout only.

## Commit Discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do Not Do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, benchmark evidence, and full annual dt/grid evidence all agree.
