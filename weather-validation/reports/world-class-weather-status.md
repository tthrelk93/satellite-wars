# World-Class Weather Status

Updated: 2026-04-25
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-25T09-21-31Z-phase3-sh-condensation-source-breaker`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Phase 2 conservative moisture transport now has fresh annual evidence:
  - annual E/P relative imbalance: `0.00967`
  - annual TCW drift: `5.13903 kg/m²`
  - advection net delta: `0.0000007 kg/m²`
  - vertical net delta: `0`
  - advection repair: `0.0002 kg/m²`
  - tropical-source numerical residual: `-0.0000003 kg/m²`
  - numerical integrity: PASS
- Phase 3 Hadley/Walker closure and SH subtropical condensation/rainout are now ready to hand off to Phase 4:
  - promoted quick audit: PASS
  - 90-day seasonal audit: PASS
  - 365-day annual-lite climate horizon: PASS for realism categories, water, and seasonality
  - quick dry-belt ratios N/S: `0.545 / 0.653`
  - seasonal dry-belt ratios stay in range through day 90
  - annual-lite day-365 dry-belt ratios N/S: `0.522 / 0.536`
  - quick ITCZ latitude/width: `-2.515 / 22.06 deg`
  - seasonal ITCZ latitude/width at day 90: `-3.26 / 22.201 deg`
  - annual-lite day-365 ITCZ latitude/width: `-1.473 / 22.269 deg`
  - return-flow wind diagnostics remain nonzero: quick south `0.29116 m/s`, annual-lite south `0.27903 m/s`
  - Walker longitudinal support remains nonzero: quick south `0.5105`
  - water-cycle budget: PASS in quick, seasonal, and annual-lite
  - quick and seasonal dt/grid sensitivity gates: PASS
  - annual-lite caveat: top-level `overallPass = false` only because `--no-repro-check` intentionally skipped annual dt/grid repro sidecars; do not use it as a full annual world-class claim
- Latest verified physics baseline in `src/weather/v2/core5.js` still holds:
  - `vertParams.thetaeCoeff: 11 -> 10.5`
  - current dry-belt metrics remain:
    - Day-30 north subtropical dry-belt ratio: `1.029`
    - Day-90 north subtropical dry-belt ratio: `1.015`
- Latest verified browser/runtime fixes still hold on fresh localhost runs:
  - solo-mode minimap white panel stays gone
  - startup `Texture marked for update but no image data found` spam stays gone
- Latest verified runtime smoothness changes now include both `src/Earth.js` and `src/WindStreamlineRenderer.js`:
  - wind-model diagnostics no longer scan the full 16200-cell grid
  - diagnostic sample target now drives `sampleStride: 1 -> 3` and `sampleCount: 16200 -> 5400`
  - fresh `windDiagnosticsPerf` events still show model diagnostics at about `9.1–10.2 ms` on due ticks instead of about `29.4–32.1 ms`
  - the new wind-particle bilinear fast path reduced the mature instrumented live baseline from `Earth.update p95 42.01 ms -> 34.20 ms -> 33.39 ms` across two fresh reruns
  - the confirming rerun also lowered `sample0Ms` p95 from `2.60 ms -> 2.30 ms`
- Full signoff is still blocked:
  - `likelySmoothEnough = false` still remains on the confirming rerun
  - `Earth.update` max is still too high (`449.4 ms`) because larger unknown spikes remain after the particle-path win
  - wind targets still fail on `model_mean_low`, `model_p90_low`, `model_p99_low`, and `viz_step_mean_low`

## Fresh evidence from the latest cycle

- The Phase 3 blocker-breaker cycle changed real weather-core code:
  - added conservative soft live-state marine-deck mass fate handling in `src/weather/v2/microphysics5.js`
  - exported selected SH/NH subtropical excess vapor equatorward into the same-hemisphere tropical rain lane instead of retaining it locally or deleting it
  - promoted the minimal passing medium default in `src/weather/v2/core5.js`: mode `equatorward_export`, scale `2.6`, max fraction `0.55`
  - added diagnostics in `src/weather/v2/state5.js` and `src/weather/validation/diagnostics.js`
  - added targeted microphysics and vertical tests for the new fate/transport behavior
- Fresh quick artifact:
  - `overallPass = true`
  - `subtropicalDryNorthRatio = 0.545`
  - `subtropicalDrySouthRatio = 0.653`
  - `itczLatDeg = -2.515`
  - `itczWidthDeg = 22.06`
  - `southDryBeltHadleyReturnFlowWindAppliedMeanMs = 0.29116`
  - `southDryBeltWalkerLongitudinalSubsidenceSupportMeanFrac = 0.5105`
  - `waterCycleBudget.pass = true`
  - `numericalIntegrityPass = true`
  - `dtSensitivity.pass = true`
  - `gridSensitivity.pass = true`
- Fresh seasonal artifact:
  - `overallPass = true`
  - `waterCycleBudget.pass = true`
  - `evapPrecipRelativeImbalance = 0.03347`
  - `tcwDriftKgM2 = 6.43601`
  - `stableAcrossMonthsPass = true`
  - `stableAcrossSeasonsPass = true`
  - `dtSensitivity.pass = true`
  - `gridSensitivity.pass = true`
- Fresh annual-lite artifact:
  - day-365 realism categories: PASS
  - top-level `overallPass = false` due expected `dt_sensitivity_not_evaluated` and `grid_sensitivity_not_evaluated`
  - day-365 dry-belt ratios N/S: `0.522 / 0.536`
  - day-365 ITCZ latitude/width: `-1.473 / 22.269`
  - day-365 south return-flow diagnostic: `0.27903 m/s`
  - water-cycle budget: PASS
  - annual E/P relative imbalance: `-0.01077`
  - annual TCW drift: `6.03275 kg/m²`
  - NH/SH tropical cyclone seasonality: PASS/PASS
- Fresh cycle artifacts:
  - `weather-validation/output/cycle-2026-04-25T09-21-31Z-phase3-sh-condensation-source-breaker/phase3-equatorward-medium-quick.json`
  - `weather-validation/output/cycle-2026-04-25T09-21-31Z-phase3-sh-condensation-source-breaker/phase3-equatorward-medium-seasonal.json`
  - `weather-validation/output/cycle-2026-04-25T09-21-31Z-phase3-sh-condensation-source-breaker/phase3-equatorward-medium-annual-lite.json`
  - `weather-validation/output/cycle-2026-04-25T09-21-31Z-phase3-sh-condensation-source-breaker/checkpoint.md`
  - `weather-validation/output/cycle-2026-04-25T09-21-31Z-phase3-sh-condensation-source-breaker/evidence-summary.json`

## What still blocks "world class"

- Phase 3 is ready to hand off to Phase 4, but the next world-class claim still needs a full annual audit with dt/grid repro enabled.
- Browser/runtime signoff is no longer blocked by the old white panel or the full-grid model-diagnostics payload, but it still fails on larger remaining `Earth.update` spikes and weak wind-target diagnostics in the latest live run.
- A full annual planetary-realism pass with dt/grid repro is still required before any world-class claim; the annual-lite run intentionally skipped repro sidecars.
- World-class status still requires realism and smoothness to pass in the same browser-backed run.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/planetary-realism-status.md`
- `weather-validation/reports/worker-brief.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Move to Phase 4 from the verified Phase 3 circulation/moisture-belt baseline.
2. Before any world-class or annual-seasonality claim, rerun full annual planetary realism with dt/grid repro enabled.
3. Run bounded live/browser verification after the next verified climate fix or when runtime debt becomes blocking again.
4. Keep validation on the clean world-class checkout only.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
