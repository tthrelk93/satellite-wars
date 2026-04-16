# Earth Weather Architecture C41 Transition-Band Organized-Support Restore Attribution

This phase attributes the C40 transition-band organized-support restore relative to the strict C32 carveout. The question is whether activating the live transition rows improved the right transport subset cleanly, or whether it simply shifted the receiver burden equatorward into a different dry-belt lane.

- decision: `transition_band_restore_shifts_override_equatorward_and_slightly_relieves_sign_defect_but_reloads_26p25_receiver_lane`
- next move: Architecture C42: equatorward-transition organized-support restore experiment

## C32 vs C40 quick comparison

- cross-equatorial vapor flux north: C32 `-356.96839`, C40 `-355.94778`
- ITCZ width: C32 `23.374`, C40 `23.386`
- NH dry-belt ratio: C32 `1.122`, C40 `1.128`
- SH dry-belt ratio: C32 `0.493`, C40 `0.49`
- NH midlatitude westerlies: C32 `1.219`, C40 `1.225`
- NH dry-belt ocean condensation: C32 `0.10807`, C40 `0.11898`

## Equatorial transport repartition

- equator lower total-water flux north: C32 `-18.3439`, C40 `-18.50334`
- equator mid total-water flux north: C32 `-16.74764`, C40 `-16.63613`
- equator upper total-water flux north: C32 `-12.82647`, C40 `-12.71408`
- equator lower zonal-mean transport: C32 `-14.37359`, C40 `-14.4051`
- equator lower eddy transport: C32 `-3.97031`, C40 `-4.09824`
- equator mid zonal-mean transport: C32 `-13.06211`, C40 `-13.01697`
- equator mid eddy transport: C32 `-3.68553`, C40 `-3.61915`
- equator upper zonal-mean transport: C32 `-7.78225`, C40 `-7.77471`
- equator upper eddy transport: C32 `-5.04422`, C40 `-4.93937`
- 35° lower vapor import: C32 `-23.19317`, C40 `-22.74287`
- 35° mid vapor import: C32 `-17.28133`, C40 `-17.04799`
- 35° upper vapor import: C32 `-6.28724`, C40 `-6.25064`

## Dry-belt receiver / return shift

- carried-over upper cloud: C32 `0.17351`, C40 `0.17677`
- imported anvil persistence: C32 `0.17183`, C40 `0.17511`
- weak-erosion survival: C32 `0.16844`, C40 `0.17145`
- upper-cloud path: C32 `0.19258`, C40 `0.19571`
- dominant vapor import: C32 `-23.37997`, C40 `-22.94616`
- cloud recirculation proxy: C32 `0.44108`, C40 `0.49162`
- return-branch mass flux: C32 `3554.21558`, C40 `3407.08074`

## Latitude-resolved override shift

- 26.25° accumulated override hits: C32 `18.625`, C40 `18.667`
- 33.75° accumulated override hits: C32 `5.698`, C40 `5.51`
- 26.25° accumulated removed mass: C32 `14.891`, C40 `14.901`
- 33.75° accumulated removed mass: C32 `4.531`, C40 `4.309`
- 26.25° carried-over upper cloud: C32 `0.05`, C40 `0.06`
- 33.75° carried-over upper cloud: C32 `0.429`, C40 `0.424`

## Thermodynamic shift

- C32 primary regime: `dynamicsSupported`
- C40 primary regime: `mixed`
- C32 dynamics support score: `0.69295`
- C40 dynamics support score: `0.65542`
- C32 moisture support score: `0.58914`
- C40 moisture support score: `0.59672`

## Interpretation

- The transition-band restore is active: it no longer reproduces the strict C32 quick state exactly.
- It slightly relieves the cross-equatorial sign defect and improves the mid-upper / 35° zonal-mean side, so the geometry is hitting a live transport subset.
- But the equatorial lower branch gets worse and the NH receiver side reopens modestly.
- The latitude-resolved signal explains why: activity shifts away from `33.75°` and into `26.25°`, which reloads the inner dry-belt receiver lane rather than cleanly resolving the defect.

## Next experiment contract

- Keep the strict C32 core carveout fixed.
- Preserve the fact that the active geometry must reach the transition band, not the equatorial core.
- Narrow the restore equatorward so it can still touch `18.75°`-class transition cells while backing away from the `26.25°` receiver lane.
- Candidate focus lanes:
  - `keep the strict C32 organized-support / potential carveout in the equatorial core`
  - `restore organized-support only in the equatorward transition shoulder around 18°–24°`
  - `avoid reopening the 26.25° receiver lane while preserving a live transition-band geometry`

