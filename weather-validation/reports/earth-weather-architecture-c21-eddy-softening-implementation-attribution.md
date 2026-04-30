# Earth Weather Architecture C21 Eddy-Softening Implementation Attribution

This phase attributes the failed C20 global eddy-softening experiment relative to the stronger C17 carryover-carveout base. The question is whether eddy softening was inert, or whether it traded the wrong transport defect for a rebound in the dry-belt return/carryover family.

- decision: `global_eddy_softening_reactivates_return_branch_carryover_without_fixing_equatorial_export`
- next move: Architecture C22: equatorial-band eddy softening carveout experiment

## C17 vs C20 quick comparison

- cross-equatorial vapor flux north: C17 `-353.31687`, C20 `-361.48916`
- ITCZ width: C17 `23.454`, C20 `23.26`
- NH dry-belt ratio: C17 `1.121`, C20 `1.152`
- SH dry-belt ratio: C17 `0.511`, C20 `0.504`
- NH midlatitude westerlies: C17 `1.202`, C20 `1.209`
- NH dry-belt ocean condensation: C17 `0.14144`, C20 `0.13877`

## Transport comparison

- equator zonal-mean vapor flux north: C17 `-249.95949`, C20 `-254.59421`
- equator eddy vapor flux north: C17 `-109.90385`, C20 `-114.18489`
- equator mid/upper vapor flux north: C17 `-226.72426`, C20 `-234.61563`
- equator low-level velocity mean: C17 `-20.79729`, C20 `-21.02244`
- 35° interface vapor flux north: C17 `-373.49016`, C20 `-350.09613`

## Carryover / return-branch rebound

- NH dry-belt carried-over upper cloud: C17 `0.22666`, C20 `0.27973`
- NH dry-belt imported anvil persistence: C17 `0.22501`, C20 `0.27804`
- NH dry-belt weak-erosion survival: C17 `0.21732`, C20 `0.26804`
- NH dry-belt cloud recirculation proxy: C17 `0.39988`, C20 `1.34927`
- NH dry-belt return-branch mass flux: C17 `3368.15697`, C20 `3490.3125`

## Interpretation

- C20 was not inert. It did change the transport system.
- But the change went the wrong way: the equatorial zonal-mean and eddy branches both got more negative, even though the 35° interface burden improved.
- At the same time, the NH dry-belt carryover / persistence / weak-erosion family rebounded and the return branch strengthened again.
- That means global eddy softening relaxes the wrong parts of the hybrid. The next test should keep C17 as the base and soften eddy rescaling only where the remaining equatorial export defect actually lives.

## Thermodynamic shift

- C17 primary regime: `dynamicsSupported`
- C20 primary regime: `mixed`
- C17 dynamics support score: `0.68867`
- C20 dynamics support score: `0.64311`
- C17 moisture support score: `0.59061`
- C20 moisture support score: `0.57999`

## Next experiment contract

- Keep the C17 carryover carveout fixed.
- Do not soften eddy rescaling globally.
- Apply the softening only inside an equatorial band so the dry-belt return/carryover containment stays intact.
- Candidate focus lanes:
  - `equatorial latitude-gated softening in windEddyNudge5.js`
  - `keep subtropical rows on the original C17 eddy rescaling contract`
  - `preserve C17 carryover carveout and low-level preserve layer`

