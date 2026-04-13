# Phase 1C Proof-vs-Climate Mismatch

## Purpose

Explain why the kept live-state `stepVertical5` patch improves the upstream ownership proof stack but still degrades the full 30-day climate.

## Branch State

Patch branch state under review:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

Authoritative climate artifact for this phase:
- [phase1c-proof-vs-climate-branch-audit.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1c-proof-vs-climate-branch-audit.json)

Baseline comparison:
- [phase1-hadley-second-pass-restore-v4.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json)

## What Still Works

The upstream proof stack remains directionally supportive of the patch family:
- the first material boundary is still `endPreviousStepMicrophysics5`
- the stable owner is still `previousStepResidualUpperCloud`
- the patch still reduces the owned next-boundary reservoir in the frozen corridor proof

That means the short-window ownership diagnosis was not wrong.

## What Breaks In The 30-Day Climate

The 30-day climate gate fails badly against the kept Phase 1 baseline:

- `itczWidthDeg`: `23.646 -> 26.415`
- `subtropicalDryNorthRatio`: `1.100 -> 1.704`
- `subtropicalDrySouthRatio`: `0.519 -> 1.296`
- `subtropicalSubsidenceNorthMean`: `0.065 -> 0.083`
- `subtropicalSubsidenceSouthMean`: `0.038 -> 0.031`
- `midlatitudeWesterliesNorthU10Ms`: `1.192 -> 0.532`
- `midlatitudeWesterliesSouthU10Ms`: `0.943 -> 0.851`
- `globalCloudMeanFrac`: `0.696 -> 0.805`
- `globalPrecipMeanMmHr`: `0.151 -> 0.205`

So the patch improves the owned dry-belt reservoir locally, but the full climate reorganizes in a worse direction:
- broader ITCZ
- much wetter subtropical belts
- weaker westerlies
- higher global cloud and precipitation

## Footprint Evidence

The added carry-input-override instrumentation shows the patch is not acting only in the single proven corridor.

Day 15 accumulated footprint:
- `26.25°`: hits `0.3125`, removed `1.14811 kg/m²`
- `-26.25°`: hits `0.08333`, removed `0.28678 kg/m²`
- `-18.75°`: hits `0.02083`, removed `0.07234 kg/m²`

Day 30 accumulated footprint:
- `26.25°`: hits `1.52083`, removed `5.58187 kg/m²`
- `-18.75°`: hits `0.39583`, removed `1.37072 kg/m²`
- `18.75°`: hits `0.29167`, removed `1.01349 kg/m²`
- `-26.25°`: hits `0.14583`, removed `0.50197 kg/m²`

Band means at day 30:
- `northDryBeltCarryInputOverrideAccumHitMean = 0.61309`
- `southDryBeltCarryInputOverrideAccumHitMean = 0.189`
- `northTransitionCarryInputOverrideAccumHitMean = 0.29167`
- `southTransitionCarryInputOverrideAccumHitMean = 0.39583`
- `northDryBeltCarryInputOverrideAccumRemovedMeanKgM2 = 2.23003`
- `southDryBeltCarryInputOverrideAccumRemovedMeanKgM2 = 0.65346`
- `northTransitionCarryInputOverrideAccumRemovedMeanKgM2 = 1.01349`
- `southTransitionCarryInputOverrideAccumRemovedMeanKgM2 = 1.37072`

This proves the local reservoir-clearing patch is having a broad zonal/hemispheric footprint during the climate run.

## Tuning Attempts From The Mismatch

Two direct tuning responses were tested and both failed.

### 1. Narrow The Footprint To The NH Dry Belt Corridor

The override was restricted to the intended `22-35°N` corridor family.

What improved:
- southern and transition-band override activation collapsed to near-zero

What did not improve:
- `itczWidthDeg = 26.542`
- `subtropicalDryNorthRatio = 1.708`
- `subtropicalDrySouthRatio = 1.311`
- `midlatitudeWesterliesNorthU10Ms = 0.532`

Conclusion:
- the climate damage is not mainly coming from obvious cross-hemisphere spillover

### 2. Soften The Patch And Clear Only Owned Carryover

The removal was softened and tied to the carry-surviving estimate instead of total upper cloud.

Result:
- climate got worse again
- `itczWidthDeg = 27.25`
- `subtropicalDryNorthRatio = 1.725`
- `subtropicalDrySouthRatio = 1.413`
- `globalCloudMeanFrac = 0.806`
- `globalPrecipMeanMmHr = 0.209`

Conclusion:
- this patch family does not become climate-safe just by narrowing or softening it

## Best Explanation

The local upstream reservoir reduction is real, but it is not the right climate lever by itself.

Current best interpretation:
- the patch removes a real owned reservoir in the proof corridor
- the larger climate system compensates through cloud, precipitation, and circulation reorganization
- that compensation overwhelms the local win and leaves the planet in a wetter, broader-ITCZ, weaker-westerly state

The strongest evidence against further tuning of this family is that:
- broad footprint is real
- corridor-only footprint still fails
- softer owner-only clearing also fails

So the mismatch is not just a threshold problem. It is a physics-family mismatch between:
- short-window reservoir ownership improvement
- full-run circulation and cloud maintenance response

## Decision

Do not keep tuning the carry-input override patch family as the main route back to climate improvement.

Keep:
- the proof result that the owned reservoir is real
- the override-footprint instrumentation

Do not assume:
- that a stronger, weaker, or more narrowly triggered local carryover-clear patch will solve the climate gate

Important update from Phase 1E:
- the apples-to-apples current-branch compare in [phase1e-proof-vs-climate-delta-attribution.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1e-proof-vs-climate-delta-attribution.md) shows the `patch on` state is actually slightly better than the `patch off` state on the same instrumented branch
- so the carry-input patch is not the primary cause of the branch’s bad 30-day climate
- the deeper residual blocker is the current branch’s coupled maintenance loop, not the local override alone

## Next Phase

The next phase should be a 30-day delta-attribution campaign between:
- the kept dry-belt baseline
- the patched branch state

That campaign should answer:
- where cloud increases after the local reservoir is reduced
- which large-scale condensation pathways grow in compensation
- whether imported anvil persistence, radiative maintenance, or circulation reorganization becomes the dominant rebound path
- how the ITCZ broadens and the westerlies weaken in response

Only after that comparison should we choose the next physics lever.
