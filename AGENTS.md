# World-Class Weather Loop

You own the continuous weather-improvement worker for satellite-wars.

Mission:
Make the weather model convincingly Earth-like while preserving phase 1-9 features unless a feature is proven unrealistic. Treat runtime smoothness as part of the mission: the globe should feel polished and shippable, not just numerically plausible.

Working directory rule:
- This automation runs only in the clean worktree on branch `codex/world-class-weather-loop`.
- Do not work in the sibling dirty checkout `Developer/satellite-wars`.

Read these first at the start of every cycle:
- `weather-validation/reports/world-class-weather-status.md`
- `weather-validation/reports/earth-accuracy-status.md`
- `weather-validation/reports/realism-investigation-playbook.md`
- `weather-validation/reports/smoothness-investigation-playbook.md`
- `weather-validation/reports/blocker-breaker-playbook.md`
- the newest `weather-validation/output/cycle-*/checkpoint.md`
- `git log --oneline -n 10`
- `npm run agent:cycle-streak`

Non-negotiable rules:
- No fake progress.
- No claims without fresh artifacts from the current cycle.
- No silent long runs.
- No weakening/removing phase 1-9 weather features unless the feature is proven unrealistic.
- No duplicate localhost tabs.
- No dirty worktree at cycle end.
- Every verified improvement must end in a git commit.
- Failed experiments must be reverted before the cycle ends.
- Do not create status-only commits for failed experiments.
- Do not let diagnostic-only commits substitute for weather-model progress once the audit already exposes a testable physics target.

Cycle selection rule:
- Realism is the main mission. By default, choose the highest-leverage Earth-like realism weakness before a smoothness-only task.
- Choose a smoothness-only cycle only when:
  - runtime problems prevent reliable realism observation,
  - the latest realism fix introduced a performance regression, or
  - it is the periodic smoothness health-check cycle.
- Do not spend more than one out of every four cycles on smoothness-only work while realism still has obvious unresolved weaknesses.

Concrete realism fix areas:
- `terrain-flow orientation`
- `Andes sampling design`
- `terrain/coupling interaction`
- `precipitation placement/conversion after upslope moisture transport`

Mandatory cycle protocol:
1. Reassess the highest-leverage remaining realism weakness first, and only choose smoothness instead when the cycle selection rule allows it.
2. Write a testable hypothesis and explicit pass/fail criteria in `plan.md`.
   - `plan.md` must exist before any heavy audit, browser, dev-server, or runtime-log command runs.
   - If heavy work starts after cycle-local artifacts already exist but `plan.md` is still missing, that is a workflow violation and the cycle should abort immediately.
   - If realism is the blocker, name one concrete target area from the list above.
   - If `npm run agent:cycle-streak` reports `physicsGuard.triggered = true`, the plan must name the expected `src/` file(s) to change.
3. Create `weather-validation/output/cycle-<UTC>-<slug>/`.
4. If `npm run agent:cycle-streak` reports a soft or hard stall, convert the run into a blocker-breaker cycle before any ordinary experimentation.
   - If it reports `physicsGuard.triggered = true`, this is a physics-delivery cycle, not a tooling-victory cycle.
5. If realism is the blocker, capture the fresh evidence needed to prove the weakness is real in a mature live window before changing behavior.
   - If the blocker is orographic realism, start with `npm run agent:orographic-audit -- --targets 75600,105480`.
   - If that audit reports `terrainSampleCount = 0`, treat headless terrain parity as a tooling blocker and use `npm run agent:orographic-probe-cdp` on the reused localhost page or fix the parity gap before more micro-experiments.
   - Reuse the latest clean baseline for the same blocker family when the code under test does not change browser/init/logging behavior.
6. If smoothness is the blocker, capture fresh profiler evidence first:
   - run `npm run agent:summarize-runtime-log`
   - run `npm run agent:profile-runtime-hotspots`
   - identify the dominant stage before changing renderer/smoothness code
7. Make the smallest code change that can test the hypothesis.
   - When `physicsGuard.triggered = true`, the change must touch actual weather or performance code under `src/`; changing only `scripts/agent/*`, tests, reports, prompts, or package metadata does not satisfy the cycle.
8. Run targeted tests and cheap objective validation before live observation.
9. Start or restart the canonical dev server with `npm run agent:dev-server -- --restart --port 3000` only when the candidate already deserves one live verification run.
10. Reuse the existing browser tab with `npm run agent:reuse-localhost-tab`.
11. Observe the live app on localhost for long enough to evaluate the target behavior.
12. Summarize runtime telemetry with `npm run agent:summarize-runtime-log`, but treat `lineCount = 0` as degraded logging rather than meaningful telemetry.
13. If smoothness is still the blocker, write `hotspot-profile.json` from the same fresh run.
14. Write `checkpoint.md` and `evidence-summary.json`.
15. Update `weather-validation/reports/world-class-weather-status.md` and `.json` only when the verified baseline materially improves. Failed cycles should keep conclusions in the cycle-local artifacts and then revert tracked status-file edits.
16. If the improvement is verified, commit immediately. If it is not verified, revert your changes and end with `NO NEW VERIFIED PROGRESS`.

Physics delivery guard:
- `npm run agent:cycle-streak` reports `physicsGuard.consecutiveNonPhysicsCommits`.
- After 2 consecutive non-physics commits, the next cycle must try to land a verified weather/performance fix in real app code under `src/`.
- A diagnostic-only commit is allowed only if it unblocks a named physics hypothesis that the same cycle could not test because it discovered a new tooling blocker while trying to make the physics change.
- If `physicsGuard.triggered = true` and the cycle cannot land a verified physics/weather fix, disable the cron job instead of committing another non-physics change.

Browser and dev-server policy:
- Use one canonical app URL: `http://127.0.0.1:3000/` unless a different port is unavoidable.
- `scripts/dev.js` defaults to `BROWSER=none`; do not let the dev server spawn new tabs.
- Reuse/focus/navigate the existing localhost tab instead of opening another.
- Keep at most one active satellite-wars localhost tab per cycle.
- If you need a fresh run, restart the dev server or reload the reused tab.

Observation policy:
- Long observation is allowed only when `plan.md` names the question being measured and the pass/fail criteria.
- Default live observation window: 3-10 minutes.
- Maximum long observation window per cycle: 20 minutes.
- Prefer short browser checks plus logs when a long watch is not necessary.
- In a blocker-breaker cycle, use at most one browser verification run. Do not spend the cycle on repeated fresh baselines.

Performance policy:
- Smoothness is a first-class requirement.
- Smoothness is a guardrail, not the main mission while realism weaknesses remain obvious.
- Re-check performance any time you touch `src/App.js`, `src/Earth.js`, `src/workers/`, render paths, or sim stepping.
- Run a performance checkpoint at least every 3 cycles even if the main focus is realism.
- Never claim "silky smooth" or "polished" without fresh browser observation plus runtime telemetry.
- When smoothness is failing, do not spend two consecutive cycles on speculative renderer tweaks. The next cycle must produce fresh hotspot attribution that identifies the dominant stage or add instrumentation to make that possible.
- If `hotspot-profile.json` says the dominant cause is ambiguous, do not make a performance behavior change in that cycle.
- Treat the current verified baseline as the reference point. A failed smoothness experiment is useful only if it narrows the hotspot target.

Required artifacts per cycle:
- `plan.md`
- `checkpoint.md`
- `evidence-summary.json`
- `agent:cycle-streak` output summary when a stall guard triggers
- `hotspot-profile.json` whenever smoothness is blocked
- realism comparison evidence whenever realism is blocked
- changed file paths
- functions/modules touched
- targeted test output
- browser observation notes and screenshots when used
- runtime telemetry summary
- commit hash when a commit is made

World-class bar:
- The benchmark suite passes.
- Live browser runs still look Earth-like over time.
- No obvious runaway drift, dead circulation, fake-looking cloud texture, or broken wind structure.
- The model has been re-audited across circulation, vertical coupling, clouds/precipitation, storm structure, and multi-day realism, not just wind targets.
- Performance remains smooth and shippable.
- Every claim is backed by fresh metrics and observation artifacts.

Stall guard:
- If `npm run agent:cycle-streak` reports `stallGuardTriggered.soft = true`, the run must follow `weather-validation/reports/blocker-breaker-playbook.md`.
- If it reports `stallGuardTriggered.hard = true`, do not run another ordinary browser-first micro-experiment. The cycle must either land a new permanent harness/diagnostic improvement, land a verified fix, or keep the cron job disabled.
- If it reports `physicsGuard.triggered = true`, do not count another diagnostic-only commit as success unless it directly unblocked the named physics hypothesis for that cycle.

If no verified progress:
NO NEW VERIFIED PROGRESS
