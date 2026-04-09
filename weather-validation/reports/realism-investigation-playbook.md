# Realism Investigation Playbook

Use this playbook whenever the main mission is improving Earth-like weather realism.

## Mission

Make the weather system so convincingly Earth-like that a climate scientist would recognize realistic large-scale circulation, storm behavior, cloud organization, and moisture/precipitation structure rather than game-like heuristics.

## Priority rule

- Realism is the primary mission.
- Choose a realism weakness before a smoothness-only task unless:
  - runtime problems prevent reliable observation,
  - the latest realism change introduced a performance regression, or
  - it is the scheduled smoothness health-check cycle.
- Do not let performance-only work consume more than one out of every four cycles while realism still has obvious unresolved weaknesses.

## Realism weakness categories

When reassessing the next blocker, prefer concrete weaknesses in one of these areas:

1. Large-scale circulation: Hadley/Ferrel/polar structure, trades, westerlies, jet placement, storm-track coherence.
2. Vertical coupling: surface-to-850 coupling, realistic shear profiles, PBL behavior, upper/lower wind relationship.
3. Moisture and precipitation: dry subtropics vs wet tropics, frontal precipitation organization, convective vs stratiform balance, unrealistic drizzle bias.
4. Cloud realism: fake-looking persistence, dead texture, unrealistic cloud belts, poor cyclone/comma-head structure, broken subtropical stratocumulus zones.
5. Storm evolution: cyclogenesis, track behavior, occlusion/front structure, tropical organization, unrealistic storm lifetimes.
6. Diurnal/seasonal behavior: day-night convection response, land/ocean contrast, polar/tropical contrast, unrealistic time evolution.
7. Multi-day credibility: mature windows should still look Earth-like after several simulated days, not only right after initialization.

## Primary offline realism harnesses

- Use `npm run agent:planetary-realism-audit -- --preset quick` for broad 30-day realism screening.
- Use `npm run agent:planetary-realism-audit -- --preset seasonal` when a change touches circulation, clouds, moisture partitioning, or storm organization.
- Use `npm run agent:planetary-realism-audit -- --preset annual` before claiming world-class seasonal behavior or when the blocker is explicitly annual/seasonal stability.
- Use `npm run agent:orographic-audit -- --targets 75600,105480` only when the broader realism screen or current evidence says the blocker is still terrain-specific.

The planetary realism audit exists to keep the worker from camping on mountain-only metrics while circulation, storm evolution, and seasonality remain under-audited.

## Required questions before changing code

1. What specific realism weakness most limits credibility right now?
2. What fresh evidence shows that weakness exists?
3. What module/function is the narrowest justified place to intervene?
4. What would count as a real improvement in the next live run?

If those questions are not answered with current-cycle evidence, do not make a realism behavior change yet. Gather the missing evidence first.

## Required evidence for a realism-focused cycle

- `plan.md`
- `checkpoint.md`
- `evidence-summary.json`
- fresh runtime/weather logs from the current cycle
- browser observation notes from a mature live window
- one concrete before/after metric or comparison artifact tied to the realism weakness

Broad-realism cycles should prefer the planetary audit as that concrete before/after artifact unless the blocker is already proven to be terrain-specific.

## Pass standard for a verified realism improvement

- The changed behavior addresses the named realism weakness in the mature live run, not just in startup.
- Objective telemetry improves in the same direction as the visual observation.
- No obvious new unrealistic side effect is introduced elsewhere in the column or circulation.
- The canonical localhost path remains trustworthy: one page tab, clean worktree at cycle end.

## Climate-scientist bar

Do not call the system world class until the agent has repeatedly re-audited:

- circulation realism,
- vertical wind realism,
- cloud/precipitation realism,
- storm structure/evolution,
- multi-day mature-window credibility,
- and smoothness/shippability.

The goal is not merely passing current wind targets. The goal is believable Earth weather.
