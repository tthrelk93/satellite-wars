# World-Class Weather Status

Updated: 2026-04-07
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-07T05-06-50Z-surface-drag-relaxation`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab` successfully reused `http://127.0.0.1:3000/` on the OpenClaw `openclaw` profile and cleaned duplicate localhost tabs during the cycle.
- Single-tab enforcement was verified again with one live localhost tab only.
- Fresh runtime summary (`weather-validation/output/cycle-2026-04-07T05-06-50Z-surface-drag-relaxation/runtime-summary.json`) still says `likelySmoothEnough: false`.
- Fresh live wind telemetry no longer fails the documented wind-energy gate; the next concrete blocker is runtime smoothness.

## Fresh evidence from the latest cycle

- Physics change: `src/weather/v2/core5.js` now gives the near-surface wind solver a slightly longer drag timescale (`tauDragSurface: 4h -> 5h`).
- Targeted automated validation: `npm run weather:validate:test` passed (`31/31`).
- Fresh steady-state runtime summary:
  - `updateMs p95`: `23.50 ms`
  - `updateMs max`: `97.80 ms`
  - `simLagSeconds p95`: `112.68 s`
  - `stepsSkippedTotal`: `0`
- Latest wind target status from the same live run:
  - model mean speed: `4.7604 m/s` vs target `4.5–9.5`
  - model p90 speed: `11.5071 m/s` vs target `9–15`
  - model p99 speed: `14.0195 m/s` vs target `14–24`
  - streamline mean step: `0.05708 px` vs target `>= 0.05 px`
  - overall wind target verdict: **PASS**
- Live browser observation: on the spun-up canonical localhost tab (Day 6–8), the streamline field looked materially denser and more continuous than the prior baseline and no fresh clipping/churn issue was visible.

## What still blocks "world class"

- Runtime smoothness still shows `Earth.update` spikes (`earth_update_p95_high`, `earth_update_max_high`).
- Long-horizon live realism still needs repeated documented checkpoints on the newly-energized field, not just a single successful mature-window run.
- The weather worker still needs a clean pass where realism and smoothness are both inside the world-class bar at the same time.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Investigate and reduce `Earth.update` runtime spikes that still push `updateMs p95` and `max` above the smoothness gate.
2. Re-run the canonical single-tab observation path on the energized wind field and document a longer live checkpoint without step-induced validation artifacts.
3. Confirm the mean/p99 wind pass remains stable over repeated mature live windows.
4. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
