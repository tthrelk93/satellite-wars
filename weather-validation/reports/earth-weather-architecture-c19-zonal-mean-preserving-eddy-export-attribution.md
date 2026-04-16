# Earth Weather Architecture C19 Zonal-Mean-Preserving Eddy Export Attribution

This phase compares the strongest sign-contract hybrid (C13) to the strongest carryover-carveout hybrid (C17). The point is to separate the shared preserved low-level momentum layer from the newer vertical-overlay family and determine which side now owns the remaining eddy/export sign defect.

- decision: `shared_preserve_layer_not_primary_blocker_vertical_overlay_eddy_export_coupling`
- next move: Architecture C20: zonal-mean-preserving eddy nudge softening experiment

## Shared low-level preserve contract

- shared preserve-layer params: `nudgeParams.tauQvS`, `nudgeParams.tauQvColumn`, `nudgeParams organized/subsidence relief quartet`, `windNudgeParams.tauSurfaceSeconds`
- preserve-layer identical across C13 and C17: `true`

## C13 vs C17 quick comparison

- cross-equatorial vapor flux north: C13 `-330.9854`, C17 `-353.31687`
- ITCZ width: C13 `23.884`, C17 `23.454`
- NH dry-belt ratio: C13 `1.152`, C17 `1.121`
- SH dry-belt ratio: C13 `0.585`, C17 `0.511`
- NH midlatitude westerlies: C13 `1.232`, C17 `1.202`
- NH dry-belt ocean condensation: C13 `0.12628`, C17 `0.14144`

## Transport comparison

- equator zonal-mean vapor flux north: C13 `-301.63909`, C17 `-249.95949`
- equator eddy vapor flux north: C13 `-34.29106`, C17 `-109.90385`
- equator mid/upper vapor flux north: C13 `-203.65605`, C17 `-226.72426`
- equator lower-troposphere vapor flux north: C13 `-132.2741`, C17 `-133.13908`
- equator low-level velocity mean: C13 `-19.4512`, C17 `-20.79729`
- 35° interface vapor flux north: C13 `-467.08734`, C17 `-373.49016`

## Interpretation

- C13 and C17 share the same preserved low-level moisture / momentum contract, so the remaining transport difference is not explained by the preserve layer alone.
- Relative to C13, C17 improves the zonal-mean equatorial branch and the 35° northward interface burden, while also improving the headline dry-belt and ITCZ metrics.
- But C17 makes the equatorial eddy branch and low-level velocity more negative than C13, which is enough to make the total cross-equatorial flux worse again.
- That means the next bounded experiment should keep the C17 vertical/carryover gains and soften only the eddy-energy rescaling lane, not remove the whole preserved low-level contract.

## Next experiment contract

- Keep the C17 carryover carveout fixed.
- Keep the C13/C17 shared low-level wind nudge and moisture-nudge preserve contract fixed.
- Soften only the surface eddy-energy rescaling band before any broader preserve-layer changes.
- Candidate focus lanes:
  - `windEddyParams.tauSeconds`
  - `windEddyParams.scaleClampMin`
  - `windEddyParams.scaleClampMax`
  - `surface-row eddy-energy rescaling in windEddyNudge5.js`

