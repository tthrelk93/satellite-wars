# World-Class Weather Status

Updated: 2026-04-26
Verdict: NOT WORLD CLASS YET

## Current Baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-26T17-43-11Z-phase6-surface-ocean-land-biomes`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Planetary realism status: PASS at the latest 90-day seasonal repro gate (`weather-validation/reports/planetary-realism-status.json`)

## Fresh Evidence From The Latest Cycle

Phase 6 surface/ocean/land/biome coupling is verified and ready to hand off to the next climate phase.

- Code path changed:
  - `src/weather/v2/surface2d.js`: bounded land surface-energy integration, soil moisture memory, vegetation/ET proxies, humid-tropical canopy/root-zone support, mixed-layer and sea-ice diagnostics.
  - `src/weather/v2/core5.js`: production defaults for Phase 6 surface coupling and rainforest convection support.
  - `src/weather/v2/state5.js` and `src/weather/validation/diagnostics.js`: persistent surface, soil, vegetation, rainforest, mixed-layer, and sea-ice diagnostics.
  - `src/weather/v2/vertical5.js`: rainforest surface support for organized moist convection/rainout.
  - `scripts/agent/planetary-realism-audit.mjs`: biome diagnostics for rainforest, desert, savanna, monsoon, Mediterranean, tundra, eastern-boundary stratocumulus, land/ocean contrast, and land-energy-vs-climo coupling.
  - `src/weather/v2/oceanIce.test.js`: dry-land energy and humid tropical forest canopy/root-zone coverage.
- Final seasonal artifact: `weather-validation/output/cycle-2026-04-26T17-43-11Z-phase6-surface-ocean-land-biomes/phase6-final-seasonal.json`
  - `overallPass = true`
  - warnings: none
  - preset/grid/dt: `seasonal / 48x24 / 1800s`
  - day-90 global/equatorial precipitation: `0.085 / 0.175 mm/hr`
  - day-90 dry-belt ratios N/S: `0.288 / 0.398`
  - day-90 storm-track peaks N/S: `41.25 / -41.25 deg`
  - rainforest precipitation / convective precipitation / ET: `0.19511 / 0.1423 / 0.29364 mm/hr`
  - rainforest vegetation/canopy/root recharge: `0.63574 / 0.66105 / 0.01679 mm/hr`
  - desert score / surface temperature / soil moisture: `0.82365 / 312.99333 K / 0.10547`
  - desert energy-vs-climo ratio: `0.89884`
  - eastern-boundary stratocumulus score / low cloud / inversion: `0.19899 / 0.62611 / 6.48796 K`
  - monsoon potential: `0.13186`
  - land/ocean surface temperature contrast: `9.39712 K`
  - land energy tendency vs climo tendency: `-0.0336 / -0.00515 K`
  - numerical integrity score/pass: `0.8698 / true`
  - numerical limiter dominance: `false`
  - water-cycle budget: PASS
  - numerical climate contract: PASS
  - dt/grid sensitivity: PASS/PASS
- Canonical seasonal report refresh: `weather-validation/reports/planetary-realism-status.json`
  - generated at `2026-04-26T20:10:54.489Z`
  - latest artifact: `weather-validation/output/cycle-2026-04-26T17-43-11Z-phase6-surface-ocean-land-biomes/phase6-final-seasonal.json`

## Validation

- `node --test src/weather/v2/oceanIce.test.js src/weather/v2/vertical5.test.js weather-validation/tests/planetary-realism-audit.test.mjs`: 59/59 pass
- `npm run weather:validate:test`: 239/239 pass
- `npm run weather:benchmark`: PASS
- `npm run agent:planetary-realism-audit -- --preset seasonal --repro-check --no-counterfactuals --label phase6-surface-ocean-land-biomes --out weather-validation/output/cycle-2026-04-26T17-43-11Z-phase6-surface-ocean-land-biomes/phase6-final-seasonal.json --md-out weather-validation/output/cycle-2026-04-26T17-43-11Z-phase6-surface-ocean-land-biomes/phase6-final-seasonal.md --report-base weather-validation/reports/planetary-realism-status`: PASS

## What Still Blocks "World Class"

- This is a 90-day seasonal Phase 6 claim, not a full annual world-class claim.
- A full annual planetary-realism pass with dt/grid repro enabled is still required before any annual or world-class claim.
- Browser/runtime signoff is still required after the verified climate fixes, including smoothness telemetry and visual observation in the live app.
- The latest root-cause ranking still points to subtropical cloud persistence/imported cloud maintenance as the dominant remaining realism family.
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

1. Move to the next climate phase from the verified Phase 6 surface/ocean/land/biome baseline.
2. Run bounded live/browser verification after this verified climate fix or when runtime debt becomes blocking again.
3. Attack the remaining subtropical cloud persistence/imported cloud maintenance family before any world-class claim.
4. Before any world-class or annual-seasonality claim, run full annual planetary realism with dt/grid repro enabled.
5. Keep validation on the clean world-class checkout only.

## Commit Discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do Not Do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, benchmark evidence, and full annual dt/grid evidence all agree.
