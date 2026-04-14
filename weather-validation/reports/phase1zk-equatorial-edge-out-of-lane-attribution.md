# Phase 1ZK Equatorial-Edge Out-Of-Lane Attribution

## Verdict

- bilateral_equatorial_edge_subsidence_relaxation
- Next phase: Phase 1ZL: Equatorial-Edge Subsidence Guard Design
- Keep Phase 1ZJ. The next patch should not go back into the shoulder selector. It should preserve or project the subtropical drying/omega response so the 3.75° edge lanes do not absorb the displaced condensation with weaker subsidence.

## Why This Is No Longer A Shoulder-Lane Problem

- 3.75N condensation still rises: `0.0269`
- -3.75 condensation also rises almost the same amount: `0.02769`
- 3.75N shoulder candidate stays `0`
- 3.75N shoulder applied suppression stays `0`
- 11.25N still improves: `-0.05705`
- 33.75N target-entry applied suppression stays `0`

## Carrier Evidence

- 3.75N lower-omega delta: `-0.00176`
- -3.75 lower-omega delta: `-0.01085`
- 3.75N mid-RH delta: `0.001`
- -3.75 mid-RH delta: `0.009`

## Ranking

- bilateral_equatorial_edge_subsidence_relaxation: `0.97` — The residual has shifted into a symmetric equatorial-edge condensation lane with weaker low-level subsidence on both sides of the equator.
- shoulder_lane_now_clean: `1` — The shoulder lane itself is no longer the main owner: the inner shoulder still improves while the edge has zero in-lane guard admission.
- target_entry_protection_preserved: `1` — The target-entry lane remains correctly excluded and is not the source of the residual.

## Next Patch Contract

- keep: keep the split-lane shoulder gate from Phase 1ZJ
- keep: keep the 11.25°N inner-shoulder improvement
- keep: keep the 18.75°N spillover improvement
- keep: keep the 33.75°N target-entry exclusion
- change: move the next patch lane out of microphysics shoulder admission and into vertical/core omega or subsidence placement
- change: design the next patch against the ±3.75° equatorial-edge pair instead of only the 3.75°N shoulder slice
- change: target the same-step subsidence / omega response so edge condensation does not rise when the inner shoulder dries
