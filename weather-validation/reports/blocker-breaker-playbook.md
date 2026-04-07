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
2. If reusable tooling exists only inside a cycle-local artifact, promote it into `scripts/agent/` before running another ordinary experiment.
3. If the blocker is mountain/orographic realism, start with `npm run agent:orographic-audit -- --targets 75600,105480`.
   - If that audit reports `terrainSampleCount = 0`, headless terrain parity is not trustworthy yet. Treat that as a tooling blocker and either fix headless climatology parity or fall back to `npm run agent:orographic-probe-cdp` on the reused localhost page.
4. Reuse the latest clean baseline for the same blocker family when the candidate patch does not change browser/init/logging behavior. Do not recollect the same browser baseline just because the cycle id is new.
5. Use browser/CDP only to verify a candidate that already looks promising offline or to check a browser-only regression.
6. One browser verification run per cycle maximum. If tab reuse or the CDP probe hangs longer than 90 seconds, stop, inspect browser target state once, and continue offline.
7. Treat `runtime-summary.json -> lineCount = 0` as a degraded logging pipeline. Do not wait on runtime-log evidence that cycle unless you are explicitly fixing the logging path.
8. Do not repeat the same file-family tweak unless the new cycle has a new permanent metric, new permanent tooling, or a clearly different hypothesis than the prior failed checkpoints.

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
