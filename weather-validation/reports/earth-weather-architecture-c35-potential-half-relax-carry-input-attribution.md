# Earth Weather Architecture C35 Potential-Half-Relax Carry-Input Attribution

This phase attributes the C34 potential-half-relax variant relative to the stricter C32 organized-support carry-input carveout. The question is whether the half-relaxed potential cap changed the live climate state at all, or whether the organized-support cap is the real active binder.

- decision: `potential_half_relax_inert_potential_cap_not_primary_binder`
- next move: Architecture C36: organized-support half-relax carry-input experiment

## C32 vs C34 quick comparison

- cross-equatorial vapor flux north: C32 `-356.96839`, C34 `-356.96839`
- ITCZ width: C32 `23.374`, C34 `23.374`
- NH dry-belt ratio: C32 `1.122`, C34 `1.122`
- SH dry-belt ratio: C32 `0.493`, C34 `0.493`
- NH midlatitude westerlies: C32 `1.219`, C34 `1.219`
- NH dry-belt ocean condensation: C32 `0.10807`, C34 `0.10807`

## Equatorial transport comparison

- equator lower total-water flux north: C32 `-18.3439`, C34 `-18.3439`
- equator mid total-water flux north: C32 `-16.74764`, C34 `-16.74764`
- equator upper total-water flux north: C32 `-12.82647`, C34 `-12.82647`
- equator lower zonal-mean transport: C32 `-14.37359`, C34 `-14.37359`
- equator lower eddy transport: C32 `-3.97031`, C34 `-3.97031`
- equator mid zonal-mean transport: C32 `-13.06211`, C34 `-13.06211`
- equator mid eddy transport: C32 `-3.68553`, C34 `-3.68553`
- equator upper zonal-mean transport: C32 `-7.78225`, C34 `-7.78225`
- equator upper eddy transport: C32 `-5.04422`, C34 `-5.04422`
- 35° lower vapor import: C32 `-23.19317`, C34 `-23.19317`
- 35° mid vapor import: C32 `-17.28133`, C34 `-17.28133`
- 35° upper vapor import: C32 `-6.28724`, C34 `-6.28724`

## Dry-belt receiver comparison

- NH dry-belt ocean condensation: C32 `0.10807`, C34 `0.10807`
- carried-over upper cloud: C32 `0.17351`, C34 `0.17351`
- imported anvil persistence: C32 `0.17183`, C34 `0.17183`
- weak-erosion survival: C32 `0.16844`, C34 `0.16844`
- upper-cloud path: C32 `0.19258`, C34 `0.19258`
- cloud recirculation proxy: C32 `0.44108`, C34 `0.44108`
- return-branch mass flux: C32 `3554.21558`, C34 `3554.21558`
- dominant vapor import: C32 `-23.37997`, C34 `-23.37997`

## Thermodynamic comparison

- C32 primary regime: `dynamicsSupported`
- C34 primary regime: `dynamicsSupported`
- C32 dynamics support score: `0.69295`
- C34 dynamics support score: `0.69295`
- C32 moisture support score: `0.58914`
- C34 moisture support score: `0.58914`

## Interpretation

- The half-relaxed potential cap did not just fail to clear the gate. It left the quick score, the equatorial transport stack, and the dry-belt receiver state unchanged to reporting precision.
- That means the potential cap is not the active binder in this carry-input family. The live lower-mid core defect under C32 is being set upstream by the stricter organized-support cap, not by the potential cap itself.
- The next bounded move should keep the stricter potential cap fixed, then partially relax only the organized-support cap so we can test whether the lower-mid core can recover without reopening the receiver side as aggressively as C30 did.

## Next experiment contract

- Keep the C32 strict potential cap fixed.
- Preserve the C32 dry-belt receiver containment and upper-branch relief.
- Partially relax only the organized-support cap.
- Candidate focus lanes:
  - `keep the C32 strict potential cap fixed at 0.42`
  - `partially relax only the organized-support cap so lower-mid equatorial cells can recover without fully reopening the C30 receiver side`
  - `preserve the C32 dry-belt receiver containment and upper-branch relief while testing whether organized-support is the live binder`

