# Earth Weather Architecture C37 Organized-Support Half-Relax Carry-Input Attribution

This phase attributes the C36 organized-support half-relax variant relative to the broader C30 carry-input recapture. The question is whether the half-relaxed organized-support cap created a usable intermediate state, or whether it simply falls off a threshold cliff back to the full C30 behavior.

- decision: `organized_support_half_relax_inert_threshold_cliff_reverts_to_c30`
- next move: Architecture C38: inner-core organized-support restore experiment

## C30 vs C36 quick comparison

- cross-equatorial vapor flux north: C30 `-353.96486`, C36 `-353.96486`
- ITCZ width: C30 `23.315`, C36 `23.315`
- NH dry-belt ratio: C30 `1.093`, C36 `1.093`
- SH dry-belt ratio: C30 `0.502`, C36 `0.502`
- NH midlatitude westerlies: C30 `1.232`, C36 `1.232`
- NH dry-belt ocean condensation: C30 `0.12693`, C36 `0.12693`

## Equatorial transport comparison

- equator lower total-water flux north: C30 `-17.99024`, C36 `-17.99024`
- equator mid total-water flux north: C30 `-16.67245`, C36 `-16.67245`
- equator upper total-water flux north: C30 `-12.94654`, C36 `-12.94654`
- equator lower zonal-mean transport: C30 `-14.10166`, C36 `-14.10166`
- equator lower eddy transport: C30 `-3.88858`, C36 `-3.88858`
- equator mid zonal-mean transport: C30 `-12.98794`, C36 `-12.98794`
- equator mid eddy transport: C30 `-3.6845`, C36 `-3.6845`
- equator upper zonal-mean transport: C30 `-7.84381`, C36 `-7.84381`
- equator upper eddy transport: C30 `-5.10272`, C36 `-5.10272`
- 35° lower vapor import: C30 `-22.46949`, C36 `-22.46949`
- 35° mid vapor import: C30 `-16.40141`, C36 `-16.40141`
- 35° upper vapor import: C30 `-5.79198`, C36 `-5.79198`

## Dry-belt receiver comparison

- NH dry-belt ocean condensation: C30 `0.12693`, C36 `0.12693`
- carried-over upper cloud: C30 `0.2187`, C36 `0.2187`
- imported anvil persistence: C30 `0.21701`, C36 `0.21701`
- weak-erosion survival: C30 `0.21225`, C36 `0.21225`
- upper-cloud path: C30 `0.24025`, C36 `0.24025`
- cloud recirculation proxy: C30 `1.18525`, C36 `1.18525`
- return-branch mass flux: C30 `3500.90278`, C36 `3500.90278`
- dominant vapor import: C30 `-22.82573`, C36 `-22.82573`

## Thermodynamic comparison

- C30 primary regime: `mixed`
- C36 primary regime: `mixed`
- C30 dynamics support score: `0.63593`
- C36 dynamics support score: `0.63593`
- C30 moisture support score: `0.58968`
- C36 moisture support score: `0.58968`

## Interpretation

- The organized-support half-relax does not create a distinct intermediate state. It reproduces the full C30 climate, transport, and receiver signature to reporting precision.
- That means scalar organized-support tuning is behaving like a threshold cliff in this family: once the cap is loosened far enough to re-admit the blocked subset, the hybrid snaps all the way back to the broader recapture regime.
- The next bounded move should stop trying to tune organized support globally and instead restore it only inside the inner equatorial core, while keeping the stricter C32 gate outside that core to preserve receiver containment.

## Next experiment contract

- Keep the C32 strict organized-support and potential caps outside the inner equatorial core.
- Restore organized-support admission only inside the lower-mid equatorial core.
- Preserve the C32 dry-belt receiver containment while testing whether core-only restore can recover transport without the C30 collapse.
- Candidate focus lanes:
  - `start from the strict C32 organized-support / potential carveout base`
  - `restore organized-support admission only inside the inner equatorial core instead of globally`
  - `preserve the strict C32 receiver containment outside the core while testing lower-mid transport recovery`

