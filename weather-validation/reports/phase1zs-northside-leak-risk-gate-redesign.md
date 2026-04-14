# Phase 1ZS Northside Leak Risk Gate Redesign

## Verdict

- northside_gate_live_with_south_mirror_regression
- keep patch: `false`
- Next phase: Phase 1ZT: South Mirror Rebound Attribution
- Keep the redesigned northside leak gate available behind the runtime toggle, but do not enable it by default. It successfully activates the NH source lane and reduces the north fanout path, but the full 30-day climate screen regresses through a south-mirror rebound.

## What Improved

- 11.25°N source condensation delta: `-0.02383`
- 18.75°N spillover condensation delta: `-0.00997`
- 3.75°N edge condensation delta: `-0.00682`
- 11.25°N leak penalty on: `0.06225`

## Why It Still Fails The Climate Gate

- itcz width delta: `0.007`
- dry north delta: `0.002`
- dry south delta: `0.002`
- NH westerlies delta: `0`
- south edge condensation delta: `0.00309`
- south source condensation delta: `0.02648`

## Next Step

- keep: keep the supported-source-normalized northside leak gate logic available behind the patch toggle
- keep: keep the bilateral equatorial-edge subsidence guard geometry and south-edge stabilization plumbing
- change: attribute why the improved NH source suppression is paired with a south-mirror rebound at -3.75° and -11.25°
- change: treat the next problem as a bilateral balance / cross-equatorial compensation problem, not another northside admission miss
