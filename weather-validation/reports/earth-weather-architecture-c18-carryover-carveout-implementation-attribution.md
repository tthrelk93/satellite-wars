# Earth Weather Architecture C18 Carryover Carveout Implementation Attribution

This phase attributes what the C17 carryover carveout actually changed relative to the broader C15 vertical-state overlay. The goal is to determine whether the carveout truly relieved the upper-cloud carryover lane and, if so, what transport branch is now the dominant remaining blocker.

- decision: `carryover_carveout_relief_preserves_zonal_mean_but_eddy_export_remains_primary_blocker`
- next move: Architecture C19: zonal-mean-preserving eddy export attribution

## C15 vs C17 quick comparison

- cross-equatorial vapor flux north: C15 `-364.55266`, C17 `-353.31687`
- ITCZ width: C15 `24.094`, C17 `23.454`
- NH dry-belt ratio: C15 `1.404`, C17 `1.121`
- SH dry-belt ratio: C15 `0.589`, C17 `0.511`
- NH midlatitude westerlies: C15 `1.209`, C17 `1.202`
- NH dry-belt ocean condensation: C15 `0.15331`, C17 `0.14144`

## Transport comparison

- equator zonal-mean vapor flux north: C15 `-274.13377`, C17 `-249.95949`
- equator eddy vapor flux north: C15 `-96.97265`, C17 `-109.90385`
- equator mid/upper-troposphere vapor flux north: C15 `-239.13535`, C17 `-226.72426`
- equator low-level velocity mean: C15 `-20.23835`, C17 `-20.79729`
- 35° interface vapor flux north: C15 `-360.61691`, C17 `-373.49016`

## Carryover / maintenance comparison

- NH dry-belt carried-over upper cloud: C15 `0.39867`, C17 `0.22666`
- NH dry-belt imported anvil persistence: C15 `0.39786`, C17 `0.22501`
- NH dry-belt weak-erosion survival: C15 `0.38477`, C17 `0.21732`
- NH dry-belt cloud recirculation proxy: C15 `2.22467`, C17 `0.39988`

## Interpretation

- C17 did not leave the carryover carveout inert. It materially reduced carried-over upper cloud, imported persistence, weak-erosion survival, and the NH dry-belt cloud recirculation proxy.
- C17 also improved the equatorial zonal-mean branch and the mid/upper transport component relative to C15, while further improving ITCZ width and both dry-belt ratios.
- But the severe regression remains because the equatorial eddy branch got more negative and the 35° northward vapor interface worsened again.
- That means the upper-cloud carryover lane was a real part of the C15 failure, but it is no longer the dominant blocker after the carveout lands.

## Thermodynamic shift

- C15 primary regime: `dynamicsSupported`
- C17 primary regime: `dynamicsSupported`
- C15 dynamics support score: `0.72656`
- C17 dynamics support score: `0.68867`
- C15 moisture support score: `0.55332`
- C17 moisture support score: `0.59061`

## Next experiment contract

- Keep the C17 carry-input carveout fixed as the new comparison base.
- Preserve the zonal-mean relief and the improved dry-belt/ITCZ metrics from C17.
- Attribute the remaining equatorial eddy export / low-level velocity sign defect before changing the hybrid again.
- Candidate focus lanes:
  - `equatorial eddy vapor-flux branch in the transport-interface budget`
  - `equatorial low-level velocity / preserved low-level momentum layer`
  - `35° northward vapor interface burden after the carryover carveout`
  - `windEddyNudge5.js and nudging5.js preserve-layer interaction with the donor scaffold`

