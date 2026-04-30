# Phase 1ZO Bilateral Edge Outcome Attribution

## Verdict

- northside_condensation_fanout_without_humidification
- Next phase: Phase 1ZP: Northside Fanout Containment Design
- Keep the mirrored bilateral geometry in principle, but do not enable the patch by default yet. The next patch should target northside fanout containment across 3.75°N, 18.75°N, and 26.25°N rather than revisiting geometry or amplitude.

## Why This Is Not A Geometry Problem Anymore

- south-edge applied guard on: `0.00054`
- north-edge applied guard on: `0.00072`
- south-edge condensation delta: `-0.00001`
- north-edge condensation delta: `0.01256`

## Northside Fanout Evidence

- 11.25°N source condensation delta: `-0.0066`
- 18.75°N spillover condensation delta: `0.01227`
- 26.25°N dry-belt-core condensation delta: `0.01088`
- 33.75°N target-entry applied suppression on: `0`

## Why This Is Not A Humidification Recharge Story

- 3.75°N TCW delta: `-0.005`
- 3.75°N BL RH delta: `-0.001`
- 18.75°N TCW delta: `-0.016`
- 18.75°N BL RH delta: `0`
- north humidification score: `0.0775`

## Climate Guardrails

- itcz width delta: `-0.005`
- dry north delta: `-0.001`
- dry south delta: `-0.002`
- NH dry-belt ocean condensation delta: `0.0131`

## Next Patch Contract

- keep: keep the mirrored bilateral abs-lat geometry from Phase 1ZN
- keep: keep the south-edge stabilization at -3.75°
- keep: keep the 33.75°N target-entry exclusion separate and untouched
- change: design the next lane around northside fanout containment from 11.25°N into 3.75°N, 18.75°N, and 26.25°N
- change: treat the residual as a same-hemisphere outcome redistribution problem, not a humidification recharge problem
- change: prefer a capped northside redistribution/containment design over amplitude increases
