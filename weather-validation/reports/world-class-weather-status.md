# World-Class Weather Status

Updated: 2026-04-07
Verdict: NOT WORLD CLASS YET

## Current baseline

- Clean worker worktree: `codex/world-class-weather-loop`
- Latest verified cycle: `cycle-2026-04-07T10-29-38Z-bounded-truth-worker-desync`
- Earth accuracy suite: PASS (`weather-validation/reports/earth-accuracy-status.md`)
- Canonical localhost reuse remains working: `npm run agent:reuse-localhost-tab` successfully reused `http://127.0.0.1:3000/` on the OpenClaw `openclaw` profile and kept the cycle on one live localhost tab.
- Single-tab enforcement was verified again with one live localhost tab only.
- Fresh live evidence now shows the visible sim clock is no longer allowed to outrun the truth worker by multi-day amounts during a reproduced month-burst backlog.
- The same cycle re-entered the mature Day 6–8 window with the truth-worker lead still bounded to roughly `35,880–43,080 s` (`9.97–11.97 h`).
- The wind guardrail still passed on the mature post-fix live run.
- The main mission is still broader Earth-like realism, not just wind targets. The model still needs repeated documented realism audits across circulation, vertical structure, storms, clouds, precipitation, and multi-day evolution.
- Runtime smoothness is still a shippability blocker, but the mature-window worker-desync blocker is materially improved enough to return to realism-first investigation.

## Fresh evidence from the latest cycle

- Sim scheduling change: `src/App.js` now budgets visible sim accumulation against a truth-worker desync cap via `src/weather/simAdvanceBudget.js`.
- Worker sync introspection: `src/Earth.js` now exposes `getWeatherWorkerSyncStatus()` so the app can clamp visible lead from live worker state.
- Targeted automated validation: `npm run weather:validate:test` passed (`37/37`).
- Fresh live clean-HEAD pre-fix burst reproduction (`weather-validation/output/cycle-2026-04-07T10-29-38Z-bounded-truth-worker-desync/prefix-burst-desync.json`):
  - sampled wall-clock window: `90 s`
  - UI sim clock: `Day 0, 04:52 -> Day 21, 18:16`
  - truth core time: `11,160 -> 37,080 s`
  - visible / tracked lead exploded to `1,855,080 s` (`21.47 d`)
- Fresh post-fix burst-cap confirmation (`weather-validation/output/cycle-2026-04-07T10-29-38Z-bounded-truth-worker-desync/postfix-burst-desync.json`):
  - sampled wall-clock window: `90 s`
  - once backlog pressure arrives, `sync.leadSeconds` holds at exactly `43,200 s` (`12 h`) instead of running away into multi-day lead
  - the truth worker remains busy and continues draining repeated 6-hour chunks
- Fresh mature-window monitor from the same long post-fix run (`weather-validation/output/cycle-2026-04-07T10-29-38Z-bounded-truth-worker-desync/mature-window-monitor.json`):
  - observation window: `2026-04-07T10:44:18Z -> 2026-04-07T11:05:59Z`
  - Day 3 checkpoint: lead `35,880 s`
  - Day 5 checkpoint: lead `35,880 s`
  - Day 6 checkpoint: lead `35,880 s`
  - Day 7 checkpoint: lead `35,880 s`
  - latest pre-reset sample in the mature window: lead `43,080 s`
- Mature live snapshot (`postfix-live-snapshot.json`):
  - UI label: `Day 8, 02:22`
  - direct worker sync lead: `43,080 s`
  - screenshot captured: `live-run-day7.png`
- Latest wind target status from the same mature post-fix live run (`runtime-summary.json`):
  - model mean speed: `5.1624 m/s` vs target `4.5–9.5`
  - model p90 speed: `12.1473 m/s` vs target `9–15`
  - model p99 speed: `14.7280 m/s` vs target `14–24`
  - streamline mean step: `0.06030 px` vs target `>= 0.05 px`
  - overall wind target verdict: **PASS**
- Canonical runtime helpers produced fresh non-empty telemetry on this run:
  - `npm run agent:summarize-runtime-log` -> `lineCount: 2412`
  - `npm run agent:profile-runtime-hotspots` -> `lineCount: 2425`, recommended next focus `WindStreamlineRenderer._buildField`

## What still blocks "world class"

- Broader Earth-like realism still needs explicit mature-window re-audits across circulation, vertical coupling, storm behavior, cloud structure, and precipitation organization now that the live Day 6–8 window is usable again.
- Runtime smoothness is still not shippable enough: the fresh hotspot profile points to repeated wind-field rebuild cost in `src/WindStreamlineRenderer.js:_buildField` / `_shouldRebuildField`.
- World-class status still requires realism and smoothness to pass in the same fresh live run.

## Canonical cycle inputs

- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `weather-validation/output/agent-dev-server.json` when a dev server is running
- the latest runtime summary from `npm run agent:summarize-runtime-log`

## Default next priority

1. Use the restored mature Day 6–8 live window to re-audit the highest-leverage remaining realism weakness with the realism investigation playbook.
2. Keep wind-streamline rebuild hotspots evidence-based: use the fresh `hotspot-profile.json` before any renderer smoothness tweak.
3. Re-check realism and smoothness in the same fresh live run rather than treating them as separate finish lines.
4. Keep the localhost validation path clean: one tab, canonical port `3000`, no drift into the sibling dirty checkout.

## Commit discipline

- Every verified improvement gets a commit immediately.
- Failed experiments end clean with no dirty files.

## Do not do

- Do not touch `Developer/satellite-wars`.
- Do not open duplicate localhost tabs.
- Do not claim "world class" until live observation, telemetry, and benchmark evidence all agree.
