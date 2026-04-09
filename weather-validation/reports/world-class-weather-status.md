# World-Class Weather Status

Updated: 2026-04-09
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-09T05-21-25Z-seasonal-followthrough-thetae105`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- The latest verified physics change tightens the current seasonally durable convection package in `src/weather/v2/core5.js`:
  - `vertParams.thetaeCoeff: 11 -> 10.5`
  - The rest of the package remains at the previously verified settings:
    - `vertParams.rhTrig: 0.72`
    - `vertParams.rhMidMin: 0.22`
    - `vertParams.omegaTrig: 0.2`
    - `vertParams.instabTrig: 2.5`
    - `vertParams.qvTrig: 0.0018`
    - `microParams.precipEffMicro: 0.75`
- Fresh 30-day tracked-code quick screening improves the short-horizon moisture score while keeping the same single blocker and preserving the broad category passes:
  - Tropical trades (N/S): `-0.791 / -0.329 -> -0.790 / -0.329 m/s`
  - Midlatitude westerlies (S): `0.945 -> 0.947 m/s`
  - ITCZ latitude: `4.799 -> 4.266 deg`
  - North subtropical dry-belt ratio: `1.094 -> 1.029`
- Fresh 90-day tracked-code seasonal follow-through improves the long-horizon moisture partitioning baseline again while preserving the same single blocker:
  - Day-90 equatorial precip: `0.117 -> 0.118 mm/hr`
  - Day-90 north subtropical dry-belt precip: `0.121 -> 0.119 mm/hr`
  - Day-90 north subtropical dry-belt ratio: `1.031 -> 1.015`
  - Day-90 tropical trades (N/S): `-0.793 / -0.331 -> -0.794 / -0.328 m/s`
  - Day-90 midlatitude westerlies (S): `0.948 -> 0.947 m/s`
- The earlier live-runtime fix in `src/Earth.js` still removes the old startup `THREE.WebGLRenderer: Texture marked for update but no image data found.` spam on a fresh localhost tab, but browser signoff is not yet refreshed on this improved moisture baseline.

## Fresh evidence from the latest cycle

- Fresh quick half-step revert screening (`cycle-2026-04-09T05-13-43Z-quick-halfstep-reverts-after-qv-fail`) narrowed the next physics candidate set without drifting away from the current convection package:
  - `thetaeCoeff = 10.5` was the best day-30 candidate (`1.029`)
  - `rhTrig = 0.735` was the secondary fallback (`1.036`)
  - `rhMidMin`, `instabTrig`, and `precipEffMicro` half-step reverts were all weaker or worse
- The verified fix changed real app weather code:
  - `src/weather/v2/core5.js` -> promoted `vertParams.thetaeCoeff = 10.5`
- Targeted automated validation passed:
  - `node --experimental-default-type=module --experimental-specifier-resolution=node --test src/weather/v2/core5.test.js src/weather/v2/nudging5.test.js src/weather/v2/microphysicsPhase7.test.js src/weather/v2/windNudge5.test.js`: PASS
- Fresh tracked-code quick audit (`weather-validation/output/cycle-2026-04-09T05-21-25Z-seasonal-followthrough-thetae105/postfix-planetary-audit.json`) confirmed the improved short-horizon baseline:
  - Day-30 north subtropical dry-belt ratio: `1.029`
  - ITCZ latitude: `4.266`
  - Tropical trades (N/S): `-0.790 / -0.329 m/s`
  - Midlatitude westerlies (S): `0.947 m/s`
- Fresh tracked-code seasonal follow-through (`weather-validation/output/cycle-2026-04-09T05-21-25Z-seasonal-followthrough-thetae105/postfix-seasonal-planetary-audit.json`) confirmed the improved long-horizon baseline:
  - Day-90 north subtropical dry-belt ratio: `1.015`
  - Day-90 equatorial precip: `0.118 mm/hr`
  - Day-90 north subtropical dry-belt precip: `0.119 mm/hr`
  - Only remaining seasonal warning: `north_subtropical_dry_belt_too_wet`

## What still blocks "world class"

- Northern subtropical dry-belt moisture partitioning is still the dominant planetary blocker, but the fresh quick and seasonal audits have narrowed it to `1.029` at 30 days and `1.015` at 90 days.
- Live browser realism and runtime smoothness still need a fresh run on the improved `thetaeCoeff = 10.5` baseline before this moisture package can be considered signed off.
- The lower-right white panel and the remaining runtime smoothness / wind-target issues from the last live run are still unresolved until a fresh browser-backed run proves otherwise.
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

1. Run a browser-backed `live` verification cycle on the improved `thetaeCoeff = 10.5` baseline before another headless-only tuning cycle.
2. If the live run confirms the improved baseline, keep the next physics cycle on northern subtropical dry-belt moisture partitioning and ITCZ-adjacent hydrology.
3. Preserve both the new `thetaeCoeff = 10.5` moisture package and the texture-readiness guard while investigating the lower-right white panel / runtime issues only if they still block signoff after the new live run.
4. Run the annual planetary audit after the dry-belt fix holds through another seasonal follow-through.
5. Keep validation on the clean world-class checkout only.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
