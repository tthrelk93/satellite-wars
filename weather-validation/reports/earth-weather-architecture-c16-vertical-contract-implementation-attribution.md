# Earth Weather Architecture C16 Vertical-Contract Implementation Attribution

This phase attributes what the full current vertical-state overlay in C15 actually changed relative to the narrower C13 sign-contract hybrid. The goal is to determine whether the remaining failure is still a missing vertical-state feature, or whether the full current vertical overlay reintroduces the wrong cloud-maintenance pathway while only partially helping the equatorial branch.

- decision: `zonal_mean_relief_offset_by_upper_cloud_carryover_recirculation`
- next move: Architecture C17: zonal-mean-preserving upper-cloud carryover carveout experiment

## C13 vs C15 quick comparison

- cross-equatorial vapor flux north: C13 `-330.9854`, C15 `-364.55266`
- ITCZ width: C13 `23.884`, C15 `24.094`
- NH dry-belt ratio: C13 `1.152`, C15 `1.404`
- NH dry-belt ocean condensation: C13 `0.12628`, C15 `0.15331`

## Transport comparison

- equator zonal-mean vapor flux north: C13 `-301.63909`, C15 `-274.13377`
- equator eddy vapor flux north: C13 `-34.29106`, C15 `-96.97265`
- equator mid/upper-troposphere vapor flux north: C13 `-203.65605`, C15 `-239.13535`
- 35° interface vapor flux north: C13 `-467.08734`, C15 `-360.61691`

## Carryover / maintenance comparison

- NH dry-belt carried-over upper cloud: C13 `0`, C15 `0.39867`
- NH dry-belt imported anvil persistence: C13 `0`, C15 `0.39786`
- NH dry-belt weak-erosion survival: C13 `0`, C15 `0.38477`
- NH dry-belt cloud recirculation proxy: C13 `0`, C15 `2.22467`

## Interpretation

- C15 did help the equatorial zonal-mean branch relative to C13 and it also reduced the 35° dry-belt import burden.
- But C15 simultaneously reactivated a large upper-cloud carryover / imported-anvil / weak-erosion survival pathway in the NH dry belt.
- That reintroduced a dynamics-supported cloud-maintenance regime and made the equatorial eddy / mid-upper transport more negative, which more than canceled the zonal-mean relief.

## Next experiment contract

- Keep the donor-base hybrid plus the C13 low-level preserve layer.
- Keep only the vertical-state pieces that helped the zonal-mean branch and the 35° import burden.
- Carve out the current vertical upper-cloud carryover / persistence / weak-erosion lane for the next bounded experiment instead of carrying the full current vertical overlay forward.
- Candidate carveout focus in [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js):
  - `carriedOverUpperCloudMass / importedAnvilPersistenceMass accumulation path`
  - `weakErosionCloudSurvivalMass support path`
  - `upper-cloud passive survival / blocked-erosion persistence lane`
  - `keep the subtropical subsidence contract pieces that relieved zonal-mean equatorial flow`

## Thermodynamic shift

- C13 primary regime: `moistureSupported`
- C15 primary regime: `dynamicsSupported`
- C13 dynamics support score: `0.2`
- C15 dynamics support score: `0.72656`

