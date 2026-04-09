# World-Class Weather Status

Updated: 2026-04-09
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-09T02-07-58Z-circulation-trade-westerly-recovery`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- The latest verified physics change promotes stronger default surface wind restoring in `src/weather/v2/core5.js` by tightening `windNudgeParams.tauSurfaceSeconds` from `7 * 86400` to `8 * 3600` after fresh same-cycle candidate sweeps showed broad circulation responds most to stronger surface restoring.
- Fresh 30-day planetary realism screening collapses the broad warning set from four circulation/moisture failures to one remaining moisture-belt blocker:
  - Tropical trades (N/S): `0.119 / 0.211 -> -0.791 / -0.330 m/s`
  - Midlatitude westerlies (S): `0.191 -> 0.940 m/s`
  - North subtropical dry-belt ratio: `1.307 -> 1.079` (still failing)
- Fresh 90-day seasonal follow-through keeps circulation, storm-track, cloud-balance, and stability categories passing while preserving the same single blocker:
  - Day-90 tropical trades (N/S): `-0.792 / -0.333 m/s`
  - Day-90 midlatitude westerlies (S): `0.948 m/s`
  - Day-90 north subtropical dry-belt ratio: `1.191`
- The main mission is now moisture-belt realism and ITCZ-adjacent hydrology, not basic trade/westerly recovery. Runtime smoothness and live-browser verification still need fresh checks against this broader-circulation baseline.

## Fresh evidence from the latest cycle

- Fresh same-cycle baseline quick audit (`weather-validation/output/cycle-2026-04-09T02-07-58Z-circulation-trade-westerly-recovery/prefix-planetary-audit.json`) reproduced the four broad blockers the worker brief ranked highest:
  - `trade_winds_missing_north`
  - `trade_winds_missing_south`
  - `westerlies_missing_south`
  - `north_subtropical_dry_belt_too_wet`
- Fresh same-cycle candidate sweeps (`planetary-candidate-sweep.json`, `planetary-candidate-sweep-runtime-moisture.json`, `planetary-candidate-sweep-qv-column.json`) showed surface wind restoring was the dominant lever:
  - `24h`, `18h`, and `12h` surface-wind candidates all strengthened trades and southern westerlies materially.
  - The `8h` candidate was the first one to clear the circulation category at 30 days, leaving only `north_subtropical_dry_belt_too_wet`.
  - Moisture-only nudges were weaker and often just reduced equatorial precipitation enough to leave the ratio failing.
- The same-cycle runtime-moisture sweep also exposed a real config detail: post-init `nudgeParams.*` edits do not affect `_nudgeParamsRuntime`, so future moisture tuning needs to target the runtime clone or core defaults explicitly.
- The verified fix changed real app weather code:
  - `src/weather/v2/core5.js` -> stronger default surface wind restore (`windNudgeParams.tauSurfaceSeconds: 7d -> 8h`)
- Targeted automated validation passed:
  - `node --experimental-default-type=module --experimental-specifier-resolution=node --test src/weather/v2/core5.test.js src/weather/v2/windNudge5.test.js`: PASS
- Fresh same-cycle post-fix quick audit (`weather-validation/output/cycle-2026-04-09T02-07-58Z-circulation-trade-westerly-recovery/postfix-planetary-audit.json`) confirmed broad circulation recovery:
  - Tropical trades (N/S): `-0.791 / -0.330 m/s`
  - Midlatitude westerlies (S): `0.940 m/s`
  - Warning set reduced to only `north_subtropical_dry_belt_too_wet`
- Fresh same-cycle seasonal follow-through (`weather-validation/output/cycle-2026-04-09T02-07-58Z-circulation-trade-westerly-recovery/postfix-seasonal-planetary-audit.json`) showed the improvement persists through 90 days without introducing new circulation, storm-track, cloud-balance, or stability failures:
  - Day-90 tropical trades (N/S): `-0.792 / -0.333 m/s`
  - Day-90 midlatitude westerlies (S): `0.948 m/s`
  - Only remaining seasonal warning: `north_subtropical_dry_belt_too_wet`

## What still blocks "world class"

- Northern subtropical dry-belt moisture partitioning is now the dominant planetary blocker: the fresh quick and seasonal audits still fail `north_subtropical_dry_belt_too_wet` (`1.079` at 30 days, `1.191` at 90 days).
- Live browser realism and runtime smoothness still need a fresh run with the stronger surface-wind restore before this broader-circulation baseline can be considered signed off.
- The console texture-warning spam (`THREE.WebGLRenderer: Texture marked for update but no image data found.`) remains unresolved and was not part of this offline circulation cycle.
- Annual / 365-day stability and seasonality evidence is still required before any long-horizon or world-class claim.
- World-class status still requires realism and smoothness to pass in the same fresh live run.

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

1. Fix the northern subtropical dry-belt moisture partitioning and ITCZ-adjacent hydrology now that trades and southern westerlies recover in fresh quick + seasonal headless audits.
2. Keep the next cycle in real `src/` moisture/circulation code rather than returning to terrain-only tuning unless a fresh planetary audit re-ranks terrain highest.
3. Re-run live localhost verification and runtime telemetry after the next moisture fix so browser realism and smoothness are checked against the recovered circulation baseline.
4. Run the annual planetary audit after the moisture-belt fix holds through another seasonal follow-through.
5. Keep validation on the clean world-class checkout only.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
