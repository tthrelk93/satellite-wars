# Blocker-Breaker Playbook

Use this playbook when the worker has gone multiple cycles without a verified improvement.

## Trigger conditions

- `npm run agent:cycle-streak` reports `stallGuardTriggered.soft = true`
- 3 or more consecutive `NO NEW VERIFIED PROGRESS` cycles
- 3 or more failed cycles in the same blocker family
- 2 or more consecutive cycles with `runtime-summary.json -> lineCount = 0`
- tab reuse or browser/CDP probing is hanging often enough that the cycle burns time before it reaches a decision

## Required blocker-breaker protocol

1. Run `npm run agent:cycle-streak` first and read the last 4 relevant checkpoints before picking the next move.
   - If `physicsGuard.triggered = true`, the next move must name one concrete physics target area:
     - `terrain-flow orientation`
     - `Andes sampling design`
     - `terrain/coupling interaction`
     - `precipitation placement/conversion after upslope moisture transport`
2. If reusable tooling exists only inside a cycle-local artifact, promote it into `scripts/agent/` before running another ordinary experiment.
3. If the blocker is mountain/orographic realism, start with `npm run agent:orographic-audit -- --targets 75600,105480`.
   - When you need a saved audit artifact, use `--out <cycle>/...json`. Do not build `.json` artifacts by redirecting `npm run agent:orographic-audit` stdout or by piping it through `awk`, `sed`, or similar text filters first.
   - If that audit reports `terrainSampleCount = 0`, headless terrain parity is not trustworthy yet. Treat that as a tooling blocker and either fix headless climatology parity or fall back to `npm run agent:orographic-probe-cdp` on the reused localhost page.
4. Reuse the latest clean baseline for the same blocker family when the candidate patch does not change browser/init/logging behavior. Do not recollect the same browser baseline just because the cycle id is new.
5. Use browser/CDP only to verify a candidate that already looks promising offline or to check a browser-only regression.
6. One browser verification run per cycle maximum. If tab reuse or the CDP probe hangs longer than 90 seconds, stop, inspect browser target state once, and continue offline.
7. Treat `runtime-summary.json -> lineCount = 0` as a degraded logging pipeline. Do not wait on runtime-log evidence that cycle unless you are explicitly fixing the logging path.
8. Do not repeat the same file-family tweak unless the new cycle has a new permanent metric, new permanent tooling, or a clearly different hypothesis than the prior failed checkpoints.
9. If `physicsGuard.triggered = true`, a commit that changes only `scripts/agent/*`, tests, reports, prompts, or package metadata does not satisfy the cycle. Touch real app/weather code under `src/` or disable the cron job.
10. A no-progress physics cycle only counts as a valid retry if it leaves either:
   - a real attempted `src/` change that was tested and then reverted, or
   - a blocker-narrowing artifact that makes the next same-focus physics hypothesis more specific.

## Diagnostic-only commit rule

- Diagnostic-only commits are allowed only if they unblock a named physics hypothesis that the same cycle could not test.
- The checkpoint must say what physics hypothesis was attempted, what new blocker prevented the actual `src/` change, and why the new tooling removes that blocker for the very next cycle.
- If the cycle cannot make that case clearly, it must end as `NO NEW VERIFIED PROGRESS` or disable cron rather than creating another diagnostic-only commit.

## Validation ladder

1. Cheap offline audit or preview
2. Narrow targeted test coverage
3. One live browser verification run
4. Full `npm run weather:benchmark` only after the candidate clears the cheaper gates or when the change touches broad shared physics

## Hard stall rule

If `npm run agent:cycle-streak` reports `stallGuardTriggered.hard = true`, ordinary experimentation is no longer allowed.

The next cycle must do one of these:

- land a new permanent diagnostic or harness improvement,
- land a verified code fix, or
- keep the cron job disabled instead of burning more cycles

If `npm run agent:cycle-streak` reports `physicsGuard.triggered = true`, tighten that further:

- prefer a verified weather/performance fix in `src/`,
- allow a diagnostic-only commit only under the rule above,
- after 2 consecutive non-physics commits, allow up to 3 consecutive bounded no-progress cycles on the same named focus area only when each one leaves a real `src/` attempt or blocker-narrowing artifact,
- once `physicsGuard.shouldDisableForPhysicsStall = true`, the next same-focus cycle must either land a verified `src/` fix or disable cron instead of taking another tooling-only win.
