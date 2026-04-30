# Smoothness Investigation Playbook

Use this playbook whenever `likelySmoothEnough` is false or the active blocker is runtime smoothness.

## Goal

Turn each smoothness cycle into a concrete attribution cycle, not another speculative tweak. Every failed cycle must still answer what dominated the worst `Earth.update` spikes and what the next smallest justified target is.

## When to use it

- Use this playbook only when runtime noise is blocking reliable realism observation, a recent realism fix regressed performance, or it is the scheduled smoothness health-check cycle.
- Do not let this playbook take over the worker while broader realism weaknesses remain more important than the current smoothness issue.

## Required artifacts for a smoothness-blocked cycle

- `plan.md`
- `checkpoint.md`
- `evidence-summary.json`
- `runtime-summary.json`
- `hotspot-profile.json`

## Canonical commands

- `npm run agent:dev-server -- --restart --port 3000`
- `npm run agent:reuse-localhost-tab`
- `npm run agent:summarize-runtime-log -- --out <cycle>/runtime-summary.json`
- `npm run agent:profile-runtime-hotspots -- <runtime-log> --out <cycle>/hotspot-profile.json`

## Mandatory questions before touching code

1. Which stage dominates the top `Earth.update` spikes?
2. Are the worst spikes clustered on field-rebuild frames, particle-evolution frames, draw-heavy frames, model-diagnostic ticks, or still ambiguous?
3. What single function/module is the narrowest justified target for the next change?
4. What evidence would falsify that target after the next run?

If you cannot answer those questions from fresh artifacts, do not make a renderer or smoothness code change in that cycle. Instrument first, then stop cleanly.

## Decision tree

### 1. Fresh profiling-first cycle

- Capture a fresh mature localhost run on the canonical single-tab path.
- Produce both `runtime-summary.json` and `hotspot-profile.json`.
- If `hotspot-profile.json` says the likely cause is ambiguous, make no performance tweak in that cycle.

### 2. Narrow target selection

- If the dominant stage is `WindStreamlineRenderer._buildField`, only touch field-build/rebuild work.
- If the dominant stage is `WindStreamlineRenderer._evolveParticles`, only touch particle evolution / sampling work.
- If the dominant stage is `WindStreamlineRenderer._draw`, only touch draw/canvas work.
- If the dominant stage is Earth-side diagnostics cadence, only touch diagnostic cadence/payload work.
- Do not mix two hotspot classes into one experiment.

### 3. Proof standard for a verified smoothness improvement

- Fresh canonical localhost run still has one page tab only.
- `runtime-summary.json` clears `earth_update_p95_high`.
- `runtime-summary.json` clears `earth_update_max_high`.
- Wind targets still pass in the same mature run.
- Live browser observation shows no stale, frozen, clipped, or visibly degraded wind field.

## Commit discipline

- Commit only verified improvements.
- Failed smoothness experiments must not create status-only commits.
- Failed cycles must keep their conclusions inside cycle-local artifacts and then revert tracked code/status edits.
- The tracked `world-class-weather-status.*` files should describe the current verified baseline, not every rejected experiment.
