# Earth Weather Architecture C23 Equatorial-Band Eddy Softening Attribution

This phase attributes the C22 equatorial-band eddy-softening result relative to the stronger C17 carryover-carveout base. The question is whether the narrower band preserved the right dry-belt relief while concentrating the remaining defect into a smaller equatorial transport branch.

- decision: `equatorial_band_softening_preserves_dry_belt_relief_but_deepens_lower_mid_zonal_branch`
- next move: Architecture C24: inner-core equatorial eddy softening experiment

## C17 vs C22 quick comparison

- cross-equatorial vapor flux north: C17 `-353.31687`, C22 `-355.11907`
- ITCZ width: C17 `23.454`, C22 `23.499`
- NH dry-belt ratio: C17 `1.121`, C22 `1.137`
- SH dry-belt ratio: C17 `0.511`, C22 `0.51`
- NH midlatitude westerlies: C17 `1.202`, C22 `1.216`
- NH dry-belt ocean condensation: C17 `0.14144`, C22 `0.11658`

## Equatorial transport repartition

- equator boundary-layer total-water flux north: C17 `-4.91319`, C22 `-5.01709`
- equator lower-troposphere total-water flux north: C17 `-17.72549`, C22 `-17.83744`
- equator mid-troposphere total-water flux north: C17 `-16.60787`, C22 `-16.77592`
- equator upper-troposphere total-water flux north: C17 `-13.44686`, C22 `-13.3117`
- equator lower zonal-mean transport: C17 `-13.99991`, C22 `-14.07888`
- equator lower eddy transport: C17 `-3.72558`, C22 `-3.75856`
- equator mid zonal-mean transport: C17 `-12.93476`, C22 `-13.11577`
- equator mid eddy transport: C17 `-3.6731`, C22 `-3.66015`
- 35° lower vapor import: C17 `-22.95457`, C22 `-22.70728`
- 35° mid vapor import: C17 `-17.4169`, C22 `-17.24626`

## Dry-belt containment preservation

- carried-over upper cloud: C17 `0.22666`, C22 `0.22097`
- imported anvil persistence: C17 `0.22501`, C22 `0.21933`
- weak-erosion survival: C17 `0.21732`, C22 `0.21143`
- upper-cloud path: C17 `0.24206`, C22 `0.23374`
- cloud recirculation proxy: C17 `0.39988`, C22 `0.39849`
- return-branch mass flux: C17 `3368.15697`, C22 `3348.50751`
- north transition vapor flux north: C17 `-198.12637`, C22 `-207.00073`
- north dry-belt vapor flux north: C17 `-413.42196`, C22 `-411.49156`

## Thermodynamic shift

- C17 primary regime: `dynamicsSupported`
- C22 primary regime: `dynamicsSupported`
- C17 dynamics support score: `0.68867`
- C22 dynamics support score: `0.70377`
- C17 moisture support score: `0.59061`
- C22 moisture support score: `0.57803`

## Interpretation

- C22 preserved the dry-belt containment side of C17 instead of reactivating the carryover family.
- The equatorial-band carveout also slightly improved the upper-troposphere branch and the 35° NH import burden.
- But the remaining sign defect tightened into the equatorial lower-to-mid zonal branch: boundary/lower/mid transport got more negative even while upper export was marginally relieved.
- That means the next bounded move should keep the C22 carryover preservation but trim the softened latitude footprint again so the inner equatorial core is tested without pulling the outer lower-mid rows farther southward.

## Next experiment contract

- Keep the C17 carryover carveout fixed.
- Preserve the C22 reduction in dry-belt carryover / recirculation / return-branch mass flux.
- Narrow and weaken the equatorial softening so it acts on the inner equatorial core instead of the full 4–16° band.
- Candidate focus lanes:
  - `narrow the softening footprint from the full 4–16° band into the inner equatorial core`
  - `reduce blend-to-unity amplitude so the lower/mid zonal branch is perturbed less strongly`
  - `keep the C17 carryover carveout and the C22 dry-belt containment contract fixed`

