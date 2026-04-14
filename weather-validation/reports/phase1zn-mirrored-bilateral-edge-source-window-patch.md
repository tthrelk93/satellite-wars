# Phase 1ZN Mirrored Bilateral Edge-Source Window Patch

## Verdict

- bilateral_activation_with_nh_edge_overresponse
- keep patch: `false`
- bilateral activation: `true`
- Next phase: Phase 1ZO: Bilateral Edge Outcome Attribution
- Do not enable the mirrored bilateral edge-source patch by default. The geometry bug is fixed, but the outcome is now a bilateral activation with north-edge and 18.75°N overresponse.

## Climate Guardrails

- itcz width delta: `-0.005`
- dry north delta: `-0.001`
- dry south delta: `-0.002`
- NH westerlies delta: `0`
- NH dry-belt ocean condensation delta: `0.0131`

## Bilateral Activation Check

- -11.25° source support on: `0.10521`
- 11.25° source support on: `0.13665`
- -3.75° target weight on: `0.47609`
- 3.75° target weight on: `0.41485`
- -3.75° applied guard on: `0.00054`
- 3.75° applied guard on: `0.00072`

## Outcome

- -3.75° condensation delta: `-0.00001`
- 3.75° condensation delta: `0.01256`
- 11.25° condensation delta: `-0.0066`
- 18.75° spillover condensation delta: `0.01227`
- 33.75° target-entry applied suppression on: `0`

## Next Patch Contract

- keep: keep the bilateral abs-lat source and target geometry
- keep: keep the NH target-entry exclusion separate from the bilateral edge guard
- keep: keep the equatorial-edge guard runtime toggle disabled by default until the climate screen passes
- change: explain why the north edge 3.75°N and adjacent 18.75°N lane over-respond once bilateral activation becomes live
- change: treat the next phase as an outcome-attribution problem, not another geometry problem
- change: preserve the south-edge stabilization while reducing the north-edge and 18.75°N rebound
