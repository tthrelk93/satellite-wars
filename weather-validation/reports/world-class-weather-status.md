# World-Class Weather Status

Updated: 2026-04-09
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-09T03-55-50Z-convection-seasonal-durability`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- The latest verified physics change promotes a seasonally durable convection-side moisture package in `src/weather/v2/core5.js`:
  - `vertParams.rhTrig: 0.75 -> 0.72`
  - `vertParams.rhMidMin: 0.25 -> 0.22`
  - `vertParams.omegaTrig: 0.3 -> 0.2`
  - `vertParams.instabTrig: 3 -> 2.5`
  - `vertParams.qvTrig: 0.002 -> 0.0018`
  - `vertParams.thetaeCoeff: 10 -> 11`
  - `microParams.precipEffMicro: 0.8 -> 0.75`
- Fresh 30-day quick screening keeps circulation, storm-track, cloud-balance, and stability categories passing while preserving the same single blocker:
  - Tropical trades (N/S): `-0.791 / -0.330 -> -0.790 / -0.329 m/s`
  - Midlatitude westerlies (S): `0.940 -> 0.945 m/s`
  - North subtropical dry-belt ratio: `1.079 -> 1.094` (slight quick-screen regression, still failing)
- Fresh 90-day seasonal follow-through materially improves the long-horizon moisture partitioning baseline while keeping the same single blocker:
  - Day-90 equatorial precip: `0.111 -> 0.117 mm/hr`
  - Day-90 north subtropical dry-belt precip: `0.132 -> 0.121 mm/hr`
  - Day-90 north subtropical dry-belt ratio: `1.191 -> 1.031`
  - Day-90 tropical trades (N/S): `-0.792 / -0.333 -> -0.793 / -0.331 m/s`
  - Day-90 midlatitude westerlies (S): `0.948 -> 0.948 m/s`
- The main blocker is still northern subtropical dry-belt moisture partitioning, but the seasonal gap is now materially smaller. The next cycles should optimize the quick-versus-seasonal balance around this convection package instead of re-discovering the same lever from scratch.

## Fresh evidence from the latest cycle

- Fresh same-cycle seasonal baseline audit (`weather-validation/output/cycle-2026-04-09T03-55-50Z-convection-seasonal-durability/prefix-seasonal-planetary-audit.json`) confirmed the current verified long-horizon blocker:
  - Day-90 north subtropical dry-belt ratio: `1.191`
  - Only seasonal warning: `north_subtropical_dry_belt_too_wet`
- Fresh same-cycle seasonal candidate sweep (`planetary-candidate-sweep-seasonal-convection.json`) ranked milder convection packages by the real 90-day target instead of the 30-day screen:
  - `seasonal-thetae11-soft-eff075` was the best day-90 candidate, improving the ratio to `1.031`
  - `seasonal-thetae11-soft` also improved the seasonal ratio to `1.072`
  - More aggressive or less durable packages were discarded even when they looked better on the quick screen
- The verified fix changed real app weather code:
  - `src/weather/v2/core5.js` -> promoted the milder seasonally durable convection package (`rhTrig`, `rhMidMin`, `omegaTrig`, `instabTrig`, `qvTrig`, `thetaeCoeff`, `precipEffMicro`)
- Targeted automated validation passed:
  - `node --experimental-default-type=module --experimental-specifier-resolution=node --test src/weather/v2/core5.test.js src/weather/v2/nudging5.test.js src/weather/v2/microphysicsPhase7.test.js src/weather/v2/windNudge5.test.js`: PASS
- Fresh same-cycle tracked-code quick audit (`weather-validation/output/cycle-2026-04-09T03-55-50Z-convection-seasonal-durability/postfix-planetary-audit.json`) showed the package keeps the same single blocker while only slightly softening the 30-day moisture score:
  - Day-30 north subtropical dry-belt ratio: `1.094`
  - Tropical trades (N/S): `-0.790 / -0.329 m/s`
  - Midlatitude westerlies (S): `0.945 m/s`
- Fresh same-cycle tracked-code seasonal follow-through (`weather-validation/output/cycle-2026-04-09T03-55-50Z-convection-seasonal-durability/postfix-seasonal-planetary-audit.json`) confirmed the real long-horizon gain:
  - Day-90 north subtropical dry-belt ratio: `1.031`
  - Day-90 equatorial precip: `0.117 mm/hr`
  - Day-90 north subtropical dry-belt precip: `0.121 mm/hr`
  - Only remaining seasonal warning: `north_subtropical_dry_belt_too_wet`

## What still blocks "world class"

- Northern subtropical dry-belt moisture partitioning is still the dominant planetary blocker: the new quick and seasonal audits both still fail `north_subtropical_dry_belt_too_wet` (`1.094` at 30 days, `1.031` at 90 days).
- The quick screen now lags the seasonal gain slightly, so the next moisture cycle should improve the 30-day ratio without giving back the new 90-day durability.
- Live browser realism and runtime smoothness still need a fresh run with the seasonally durable convection package before this broader-circulation baseline can be considered signed off.
- The console texture-warning spam (`THREE.WebGLRenderer: Texture marked for update but no image data found.`) remains unresolved and was not part of this offline convection cycle.
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

1. Keep the next cycle on northern subtropical dry-belt moisture partitioning and ITCZ-adjacent hydrology, but tune around the new seasonally durable convection package so the 30-day ratio improves without losing the 90-day gain.
2. Stay in real `src/` moisture/circulation code rather than returning to terrain-only tuning unless a fresh planetary audit re-ranks terrain highest.
3. Re-run live localhost verification and runtime telemetry after the next moisture fix so browser realism and smoothness are checked against the updated convection baseline.
4. Run the annual planetary audit after the dry-belt fix holds through another seasonal follow-through.
5. Keep validation on the clean world-class checkout only.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
