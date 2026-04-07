# World-Class Weather Status

Updated: 2026-04-07
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-07T04-44-00Z-baseline-live-smoothness`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse is now working again: `npm run agent:reuse-localhost-tab` successfully reused `http://127.0.0.1:3000/` on the OpenClaw `openclaw` profile.
- Single-tab enforcement was verified with one live localhost tab only.
- Fresh runtime summary (`weather-validation/output/cycle-2026-04-07T04-44-00Z-baseline-live-smoothness/runtime-summary.json`) says `likelySmoothEnough: false`.
- Fresh live run exposed the next concrete blocker: winds and streamline motion are still under-energized in browser telemetry.

## Fresh evidence from the latest cycle

- Canonical helper fix: `scripts/agent/reuse-localhost-tab.mjs` now passes CLI options in the order the current OpenClaw browser CLI expects.
- Runtime summary:
  - `updateMs p95`: `22.52 ms`
  - `updateMs max`: `90.40 ms`
  - `simLagSeconds p95`: `110.84 s`
- Latest wind target status from the same run:
  - model mean speed: `3.80 m/s` vs target `4.5–9.5`
  - model p90 speed: `8.77 m/s` vs target `9–15`
  - model p99 speed: `11.14 m/s` vs target `14–24`
  - streamline mean step: `0.0475 px` vs target `>= 0.05 px`
- Live browser observation: the in-sim globe loaded cleanly on the canonical localhost tab, but the streamline field still looked sparse / low-energy rather than world-class.

## What still blocks "world class"

- Wind energy remains too low in fresh live telemetry (`model_mean_low`, `model_p90_low`, `model_p99_low`).
- Streamline motion is still slightly too weak in fresh live telemetry (`viz_step_mean_low`).
- Runtime smoothness still shows update spikes (`earth_update_p95_high`, `earth_update_max_high`).
- Long-horizon live realism still needs repeated documented checkpoints, not just one fresh baseline.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Raise the live wind field toward the documented target band without introducing overspeed or noisy churn.
2. Increase streamline step mean above the minimum target while preserving stable particle behavior.
3. Investigate and reduce `Earth.update` runtime spikes that pushed `updateMs p95` and `max` above the smoothness gate.
4. Re-run the canonical single-tab observation path and document a longer live checkpoint after the wind/smoothness fix.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
