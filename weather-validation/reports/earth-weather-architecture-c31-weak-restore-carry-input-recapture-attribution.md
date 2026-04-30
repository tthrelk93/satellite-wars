# Earth Weather Architecture C31 Weak Restore Carry-Input Recapture Attribution

This phase attributes the C30 stronger carry-input recapture relative to the weaker C28 receiver contract. The question is whether the stronger recapture fixed the NH dry-belt receiver side cleanly or whether it paid for that relief by damaging a different equatorial transport branch.

- decision: `carry_input_recapture_recovers_dry_belt_and_zonal_mean_but_reloads_equatorial_eddy_export_recirculation`
- next move: Architecture C32: organized-support carry-input carveout experiment

## C28 vs C30 quick comparison

- cross-equatorial vapor flux north: C28 `-323.23581`, C30 `-353.96486`
- ITCZ width: C28 `23.321`, C30 `23.315`
- NH dry-belt ratio: C28 `1.097`, C30 `1.093`
- SH dry-belt ratio: C28 `0.487`, C30 `0.502`
- NH midlatitude westerlies: C28 `1.202`, C30 `1.232`
- NH dry-belt ocean condensation: C28 `0.15539`, C30 `0.12693`

## Equatorial transport repartition

- equator lower total-water flux north: C28 `-16.93964`, C30 `-17.99024`
- equator mid total-water flux north: C28 `-14.80431`, C30 `-16.67245`
- equator upper total-water flux north: C28 `-11.22308`, C30 `-12.94654`
- equator lower zonal-mean transport: C28 `-14.49379`, C30 `-14.10166`
- equator lower eddy transport: C28 `-2.44586`, C30 `-3.88858`
- equator mid zonal-mean transport: C28 `-14.12323`, C30 `-12.98794`
- equator mid eddy transport: C28 `-0.68108`, C30 `-3.6845`
- equator upper zonal-mean transport: C28 `-8.8185`, C30 `-7.84381`
- equator upper eddy transport: C28 `-2.40458`, C30 `-5.10272`
- 35° lower vapor import: C28 `-25.26785`, C30 `-22.46949`
- 35° mid vapor import: C28 `-20.28483`, C30 `-16.40141`
- 35° upper vapor import: C28 `-8.40779`, C30 `-5.79198`

## Dry-belt receiver / recirculation shift

- NH dry-belt ocean condensation: C28 `0.15539`, C30 `0.12693`
- carried-over upper cloud: C28 `0.24485`, C30 `0.2187`
- imported anvil persistence: C28 `0.24284`, C30 `0.21701`
- weak-erosion survival: C28 `0.23434`, C30 `0.21225`
- upper-cloud path: C28 `0.26708`, C30 `0.24025`
- cloud recirculation proxy: C28 `0.74157`, C30 `1.18525`
- return-branch mass flux: C28 `3444.87796`, C30 `3500.90278`
- dominant vapor import: C28 `-25.51113`, C30 `-22.82573`

## Thermodynamic shift

- C28 primary regime: `dynamicsSupported`
- C30 primary regime: `mixed`
- C28 dynamics support score: `0.67121`
- C30 dynamics support score: `0.63593`
- C28 moisture support score: `0.58473`
- C30 moisture support score: `0.58968`

## Interpretation

- The stronger carry-input recapture genuinely improved the NH dry-belt receiver side: carryover, persistence, weak-erosion survival, dominant vapor import, and ocean condensation all moved in the right direction.
- It also improved the equatorial zonal-mean branch at lower, mid, and upper levels, so the recapture was not a pure circulation regression.
- The remaining failure is concentrated in the equatorial eddy/export lane instead: every equatorial eddy branch became more negative, the cross-equatorial flux got worse, and the return/recirculation side intensified again.
- That means the next bounded move should preserve the C30 recapture gains but protect organized equatorial cells from the stronger carry-input override rather than undoing the whole recapture layer.

## Next experiment contract

- Keep the C30 weak-restore carry-input recapture baseline fixed.
- Preserve the C30 dry-belt receiver relief and zonal-mean improvements.
- Restore stricter organized-support and convective-potential caps so the stronger recapture does not over-admit organized equatorial cells.
- Candidate focus lanes:
  - `keep the C30 subtropical suppression, dominance, and residual-mass recapture thresholds fixed`
  - `restore stricter organized-support and convective-potential caps so organized equatorial cells are carved out of the stronger recapture`
  - `preserve the C30 dry-belt receiver relief while recovering the C28 eddy/export advantage`

