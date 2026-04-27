# World-Class Weather Status

Updated: 2026-04-27
Verdict: NOT WORLD CLASS YET

## Current Baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-27T02-12-02Z-phase7-tropical-cyclones-severe-weather-recovery`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Planetary realism status: PASS at the latest 365-day annual repro gate (`weather-validation/output/cycle-2026-04-27T02-12-02Z-phase7-tropical-cyclones-severe-weather-recovery/phase7-final-annual-r2.json`)

## Fresh Evidence From The Latest Cycle

Phase 7 tropical cyclone and severe-weather environments are verified and ready to hand off to Phase 8.

- Code path changed:
  - `src/weather/v2/state5.js`: persistent tropical-cyclone and tornado-risk diagnostic arrays.
  - `src/weather/v2/core5.js`: production defaults for severe-weather environment diagnostics.
  - `src/weather/v2/vertical5.js`: basin-season cyclone support, TC genesis/embedded-vortex potential, and tornado-risk environment calculations tied to instability, shear, moisture, lift, and storm mode.
  - `src/weather/validation/diagnostics.js`: 2D diagnostic exports for TC/tornado support fields.
  - `scripts/agent/planetary-realism-audit.mjs`: severe-weather category, basin seasonality gates, false-positive checks, and basin-aware NH seasonality handling.
  - `src/weather/v2/vertical5.test.js` and `weather-validation/tests/planetary-realism-audit.test.mjs`: focused helper and audit-gate coverage.
- Final annual artifact: `weather-validation/output/cycle-2026-04-27T02-12-02Z-phase7-tropical-cyclones-severe-weather-recovery/phase7-final-annual-r2.json`
  - `overallPass = true`
  - warnings: none
  - preset/grid/dt: `annual / 48x24 / 3600s`
  - categories passing: circulation, moisture belts, storm tracks, cloud balance, stability, numerical integrity, severe weather, seasonality
  - annual mean global precipitation: `0.08616 mm/hr`
  - annual mean tropical convective fraction / mass flux: `0.44368 / 0.01272 kg/m2/s`
  - TC environment counts N/S: `16.28 / 38.68`
  - basin genesis means Atlantic/East Pacific/West Pacific/North Indian/SH: `0.00067 / 0.00119 / 0.0078 / 0.00246 / 0.0205`
  - TC cold-water false positive mean: `0`
  - TC dry-subtropical false positive mean: `0.00536`
  - cyclone seasonality: Atlantic, East Pacific, West Pacific, North Indian, and Southern Hemisphere all PASS
  - North America tornado warm/cool season mean: `0.00504 / 0.00427`, PASS
  - tornado support instability/shear/lift/storm-mode: `0.6675 / 0.40583 / 0.57158 / 0.08062`
  - numerical integrity score: `0.86399`
  - numerical climate contract: PASS, major climate claims allowed
  - dt/grid sensitivity: PASS/PASS
- Canonical benchmark refresh: `weather-validation/reports/earth-accuracy-status.json`

## Validation

- `node --test src/weather/v2/vertical5.test.js weather-validation/tests/planetary-realism-audit.test.mjs`: 57/57 pass
- `npm run weather:validate:test`: 239/239 pass
- `npm run agent:planetary-realism-audit -- --preset annual --repro-check --no-counterfactuals --label phase7-tropical-cyclones-severe-weather-r2 --out weather-validation/output/cycle-2026-04-27T02-12-02Z-phase7-tropical-cyclones-severe-weather-recovery/phase7-final-annual-r2.json --md-out weather-validation/output/cycle-2026-04-27T02-12-02Z-phase7-tropical-cyclones-severe-weather-recovery/phase7-final-annual-r2.md`: PASS
- `npm run weather:benchmark`: PASS
- `npm run agent:claim-guard`: PASS

## What Still Blocks "World Class"

- Browser/runtime signoff is still required after the verified climate fixes, including smoothness telemetry and visual observation in the live app.
- World-class status still requires realism and smoothness to pass in the same browser-backed run.
- The annual root-cause sidecars still rank imported cloud persistence/helper forcing as the dominant residual realism family, even though all annual planetary gates pass.
- South America tornado seasonality is diagnostic-only in Phase 7 and remains cool-season biased; the hard tornado warm-season gate is North America and passes.

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

1. Move to Phase 8 from the verified Phase 7 severe-weather annual baseline.
2. Run bounded live/browser verification after this verified climate fix or when runtime debt becomes blocking again.
3. Attack the remaining imported cloud persistence/helper-forcing family before any world-class claim.
4. Keep validation on the clean world-class checkout only.

## Commit Discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do Not Do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, benchmark evidence, and annual dt/grid evidence all agree.
