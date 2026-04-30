# Earth Weather Architecture C29 Weak Partial Shoulder Restore Attribution

This phase attributes the C28 weak shoulder restore relative to the stronger C26 partial shoulder restore. The question is whether the weaker restore actually solved the right equatorial export problem or just shifted the cost into the NH dry-belt receiver side.

- decision: `weak_restore_relieves_equatorial_eddy_export_but_reopens_dry_belt_carryover_condensation`
- next move: Architecture C30: weak restore carry-input recapture experiment

## C26 vs C28 quick comparison

- cross-equatorial vapor flux north: C26 `-353.85346`, C28 `-323.23581`
- ITCZ width: C26 `23.412`, C28 `23.321`
- NH dry-belt ratio: C26 `1.119`, C28 `1.097`
- SH dry-belt ratio: C26 `0.515`, C28 `0.487`
- NH midlatitude westerlies: C26 `1.225`, C28 `1.202`
- NH dry-belt ocean condensation: C26 `0.11952`, C28 `0.15539`

## Equatorial transport repartition

- equator lower total-water flux north: C26 `-18.00423`, C28 `-16.93964`
- equator mid total-water flux north: C26 `-16.6919`, C28 `-14.80431`
- equator upper total-water flux north: C26 `-13.23333`, C28 `-11.22308`
- equator lower zonal-mean transport: C26 `-14.14641`, C28 `-14.49379`
- equator lower eddy transport: C26 `-3.85782`, C28 `-2.44586`
- equator mid zonal-mean transport: C26 `-12.96382`, C28 `-14.12323`
- equator mid eddy transport: C26 `-3.72808`, C28 `-0.68108`
- equator upper zonal-mean transport: C26 `-8.0559`, C28 `-8.8185`
- equator upper eddy transport: C26 `-5.17743`, C28 `-2.40458`

## Dry-belt carryover / condensation rebound

- NH dry-belt ocean condensation: C26 `0.11952`, C28 `0.15539`
- carried-over upper cloud: C26 `0.2348`, C28 `0.24485`
- imported anvil persistence: C26 `0.23307`, C28 `0.24284`
- weak-erosion survival: C26 `0.22509`, C28 `0.23434`
- cloud recirculation proxy: C26 `0.60796`, C28 `0.74157`
- return-branch mass flux: C26 `3383.23239`, C28 `3444.87796`
- dominant vapor import: C26 `-23.20045`, C28 `-25.51113`

## Thermodynamic shift

- C26 primary regime: `mixed`
- C28 primary regime: `dynamicsSupported`
- C26 dynamics support score: `0.63475`
- C28 dynamics support score: `0.67121`
- C26 moisture support score: `0.57525`
- C28 moisture support score: `0.58473`

## Interpretation

- Weakening the shoulder restore materially improved the equatorial export side, especially the eddy transport branches and the cross-equatorial sign defect.
- But that same weakening reopened the NH dry-belt ocean condensation receiver path through stronger carryover, recirculation, and import.
- That means the next bounded move should keep the C28 weak shoulder geometry but re-strengthen only the carry-input override / recapture path on the dry-belt side.

## Next experiment contract

- Keep the C28 weak shoulder restore geometry fixed.
- Preserve the C28 cross-equatorial and equatorial-eddy improvements.
- Add a stronger carry-input override recapture layer so dry-belt carryover and ocean condensation do not rebound.
- Candidate focus lanes:
  - `keep the C28 weak 0–11° / 0.47 shoulder geometry fixed`
  - `strengthen the dry-belt carry-input override so carryover, persistence, and ocean condensation are forced back down`
  - `avoid re-strengthening the shoulder itself, since C29 shows the remaining rebound is on the dry-belt receiver side`

