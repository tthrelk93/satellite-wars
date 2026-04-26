# World-Class Weather Status

Updated: 2026-04-26
Verdict: NOT WORLD CLASS YET

## Current Baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-26T04-52-50Z-phase5-midlatitude-storm-tracks`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Planetary realism status: PASS at the latest 90-day seasonal repro gate (`weather-validation/reports/planetary-realism-status.json`)

## Fresh Evidence From The Latest Cycle

Phase 5 midlatitude storm tracks are verified and ready to hand off to the next phase.

- Code path changed:
  - `src/weather/v2/vertical5.js`: mass-neutral sub-grid frontal ascent concentration plus storm lifecycle diagnostics.
  - `src/weather/v2/core5.js`: production frontal-ascent defaults.
  - `src/weather/v2/state5.js` and `src/weather/validation/diagnostics.js`: frontal/lifecycle diagnostic state and snapshot fields.
  - `scripts/agent/planetary-realism-audit.mjs`: midlatitude frontal storm-track proxy, tightened 30-60 deg storm-track gate, and storm-band/lifecycle metrics.
  - `src/weather/v2/vertical5.test.js`: row-mean omega conservation coverage for the frontal concentration pass.
- Final quick artifact: `weather-validation/output/cycle-2026-04-26T04-52-50Z-phase5-midlatitude-storm-tracks/frontal-final-quick.json`
  - `overallPass = true`
  - warnings: none
  - storm-track peaks N/S: `41.25 / -48.75 deg`
  - baseline quick storm-track peaks N/S: `63.75 / -56.25 deg`
  - midlatitude ascent fraction: `0.48214`
  - midlatitude storm-band precip share: `0.17228`
  - dt/grid sensitivity: PASS/PASS
  - water-cycle budget: PASS
  - numerical climate contract: PASS
- Seasonal repro audit artifact: `weather-validation/output/cycle-2026-04-26T04-52-50Z-phase5-midlatitude-storm-tracks/frontal-final-seasonal.json`
  - `overallPass = true`
  - warnings: none
  - day-90 storm-track peaks N/S: `33.75 / -48.75 deg`
  - day-90 midlatitude ascent fraction: `0.50031`
  - day-90 midlatitude storm-band precip share: `0.15677`
  - day-90 frontal ascent support/added/compensation: `0.18604 / 0.00838 / 0.00767`
  - day-90 storm genesis/deepening/occlusion/decay: `0.12173 / 0.05621 / 0.00349 / 0.07331`
  - day-90 global/equatorial precipitation: `0.065 / 0.132 mm/hr`
  - day-90 dry-belt ratios N/S: `0.313 / 0.440`
  - numerical integrity score/pass: `0.8873 / true`
  - numerical limiter dominance: `false`
  - water-cycle budget: PASS
  - numerical climate contract: PASS
  - dt/grid sensitivity: PASS/PASS
- Canonical seasonal report refresh: `weather-validation/reports/planetary-realism-status.json`
  - generated at `2026-04-26T08:58:41.839Z`
  - preset/grid/dt: `seasonal / 48x24 / 1800s`
  - `overallPass = true`

## Validation

- `node --test src/weather/v2/vertical5.test.js weather-validation/tests/planetary-realism-audit.test.mjs`: 54/54 pass
- `npm run weather:validate:test`: 237/237 pass
- `npm run weather:benchmark`: PASS
- `npm run agent:planetary-realism-audit -- --preset seasonal --repro-check --no-counterfactuals --label phase5-midlatitude-storm-tracks --report-base weather-validation/reports/planetary-realism-status`: PASS

## What Still Blocks "World Class"

- This is a 90-day seasonal Phase 5 claim, not a full annual world-class claim.
- A full annual planetary-realism pass with dt/grid repro enabled is still required before any annual or world-class claim.
- Browser/runtime signoff is still required after the verified climate fixes, including smoothness telemetry and visual observation in the live app.
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

1. Move to the next climate phase from the verified Phase 5 storm-track baseline.
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
