# Earth Weather Architecture C11 Cycled Hybrid Flux Inversion Attribution

This phase attributes the only severe quick-gate regression left after the donor-worktree cycle and runtime contracts were restored: the cross-equatorial vapor-flux sign flip.

- decision: `equatorial_overturning_polarity_inversion`
- next move: Architecture C12: equatorial overturning sign contract design

## Quick gate context

- ITCZ latitude: off `0.919`, on `5.175`
- ITCZ width: off `25.91`, on `24.221`
- NH dry-belt ratio: off `1.534`, on `1.317`
- SH dry-belt ratio: off `1.199`, on `0.593`
- NH westerlies: off `0.531`, on `1.061`
- cross-equatorial vapor flux north: off `143.95306`, on `-371.9765`

## Interface attribution

- equator total-water flux north: off `148.97786`, on `-381.81173`
- equator zonal-mean vapor flux north: off `160.44983`, on `-274.70821`
- equator eddy vapor flux north: off `-12.37515`, on `-105.45284`
- equator low-level velocity mean: off `11.78514`, on `-20.46744`
- 35° interface vapor flux north: off `-102.1534`, on `-386.71871`

## Hadley / tracer context

- north return-branch mass flux: off `2527.7695`, on `3362.08435`
- low-level source partition local/imported proxy: off `0.11028 / 0.88972`, on `null / null`
- north dry-belt upper-cloud path mean: off `0.21338`, on `0.40135`
- north dry-belt ocean condensation mean: off `0.1413`, on `0.14095`

## Interpretation

- The repaired hybrid is no longer failing on integration contracts; it now produces a real climate benchmark.
- Four of the six core quick metrics improve materially, so this is not a generic circulation collapse.
- The severe gate failure is a polarity reversal in equatorial overturning: low-level equatorial transport flips from northward to strongly southward, and both the zonal-mean and eddy vapor components reinforce that reversal.
- The donor/current hybrid also nulls the low-level local/imported source partition proxy, which means the next contract should focus on restoring equatorial overturning sign while keeping the donor-hybrid dry-belt improvements, not on more dry-belt-local patching.

