# Phase 1ZZD Atlantic Transition Carryover Containment Design

## Verdict

- atlantic_transition_overlap_survival_taper_preferred
- Next phase: Phase 1ZZE: Implement Atlantic Transition Carryover Containment Patch
- The next patch should live in vertical5.js/core5.js and taper Atlantic transition carryover survival around 18–22.5°N. The primary target is overlap-survival / persistence support, not fresh source recharge, resolved-ascent birth, or Atlantic receiver geometry.

## Main Guardrails

- itcz width delta: `0.077`
- dry north delta: `0.017`
- dry south delta: `0.003`
- north dry-belt ocean condensation delta: `-0.00039`

## Live Signals

- `18.75°N` condensation delta: `0.00891`
- `18.75°N` total-column-water delta: `0.342`
- `18.75°N` lower-omega delta: `0.00268`
- `18.75°N` mid-RH delta: `0.011`
- `18.75°N` surface-evap delta: `-0.001`
- `18.75°N` north-dry-belt-ocean source delta: `-0.00223`
- `18.75°N` tropical-ocean-north source delta: `-0.00018`
- `18.75°N` resolved-ascent birth delta: `0.00015`
- `18.75°N` imported persistence delta: `0.03092`
- `18.75°N` carryover delta: `0.03092`
- `18.75°N` weak-erosion survival delta: `0.03047`
- `18.75°N` upper-cloud path delta: `0.03391`
- `26.25°N` receiver condensation delta: `-0.0097`
- `26.25°N` receiver taper frac: `0.00595`
- `26.25°N` receiver taper applied: `0.00164`
- Atlantic sector condensation delta: `-0.00234`
- Atlantic low-level-source delta: `0.23564`
- east Pacific condensation delta: `0.00387`
- Atlantic saturation-adjustment birth delta: `1.51576`
- Atlantic carry-entering delta: `4.3246`
- Atlantic carry-surviving delta: `4.24108`
- Atlantic carry-survival-frac delta: `0.00006`

## Candidate Ranking

- 1. `atlantic_transition_carryover_containment` score `0.82396` — The spillover lane rises with imported persistence, carry-survival, weak-erosion survival, and upper-cloud path while fresh source and resolved-ascent terms stay near-flat.
- 2. `atlantic_transition_saturation_adjustment_cap` score `0.56233` — Atlantic saturation-adjustment birth does rise, but it is secondary to the larger carry-entering and carry-surviving increases.
- 3. `atlantic_transition_low_level_source_sink` score `0` — The spillover lane does not show fresh source recharge; source tracers and surface evaporation are flat-to-down.
- 4. `atlantic_transition_resolved_ascent_cap` score `0` — Resolved-ascent birth barely moves in the spillover lane, so a resolved-ascent cap would chase the wrong carrier.

## Patch Contract

- files: `src/weather/v2/vertical5.js`, `src/weather/v2/core5.js`
- geometry: Atlantic ocean transition lane, centered on 18–22.5°N
- activation: Reuse the live Atlantic receiver-taper / northside leak carrier rather than creating a fresh source gate.
- target: Contain carryover overlap survival and persistence support in the Atlantic transition lane while preserving 26.25°N receiver relief.
- anti-patterns:
  - Do not retune Atlantic receiver geometry again.
  - Do not add a fresh low-level humidity or evaporation sink.
  - Do not cap resolved-ascent birth as the primary lever.
  - Do not globally ablate Atlantic carryover or cloud birth.
