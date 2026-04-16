# Earth Weather Architecture C27 Partial Equatorial Shoulder Restore Attribution

This phase attributes the C26 partial shoulder restore relative to the C24 inner-core baseline. The question is whether restoring a small outer shoulder helped the right circulation branch or simply reloaded the wrong imports.

- decision: `partial_shoulder_restore_recovers_upper_branch_and_return_flow_but_reloads_lower_import_and_cloud_recirculation`
- next move: Architecture C28: weak partial equatorial shoulder restore experiment

## C24 vs C26 quick comparison

- cross-equatorial vapor flux north: C24 `-358.07208`, C26 `-353.85346`
- ITCZ width: C24 `23.275`, C26 `23.412`
- NH dry-belt ratio: C24 `1.091`, C26 `1.119`
- SH dry-belt ratio: C24 `0.506`, C26 `0.515`
- NH midlatitude westerlies: C24 `1.214`, C26 `1.225`
- NH dry-belt ocean condensation: C24 `0.12705`, C26 `0.11952`

## Equatorial transport repartition

- equator boundary-layer total-water flux north: C24 `-4.84216`, C26 `-4.79371`
- equator lower-troposphere total-water flux north: C24 `-17.49403`, C26 `-18.00423`
- equator mid-troposphere total-water flux north: C24 `-16.75772`, C26 `-16.6919`
- equator upper-troposphere total-water flux north: C24 `-13.59209`, C26 `-13.23333`
- equator lower zonal-mean transport: C24 `-13.80457`, C26 `-14.14641`
- equator lower eddy transport: C24 `-3.68946`, C26 `-3.85782`
- equator mid zonal-mean transport: C24 `-12.99397`, C26 `-12.96382`
- equator mid eddy transport: C24 `-3.76374`, C26 `-3.72808`
- 35° lower vapor import: C24 `-22.69662`, C26 `-22.99819`
- 35° mid vapor import: C24 `-17.16362`, C26 `-17.27508`

## Dry-belt carryover / return-flow tradeoff

- carried-over upper cloud: C24 `0.23253`, C26 `0.2348`
- imported anvil persistence: C24 `0.23079`, C26 `0.23307`
- weak-erosion survival: C24 `0.22243`, C26 `0.22509`
- upper-cloud path: C24 `0.24474`, C26 `0.25387`
- cloud recirculation proxy: C24 `0.49385`, C26 `0.60796`
- return-branch mass flux: C24 `3447.36194`, C26 `3383.23239`
- north transition vapor flux north: C24 `-190.46264`, C26 `-207.34044`
- north dry-belt vapor flux north: C24 `-414.35421`, C26 `-417.17261`

## Thermodynamic shift

- C24 primary regime: `dynamicsSupported`
- C26 primary regime: `mixed`
- C24 dynamics support score: `0.6811`
- C26 dynamics support score: `0.63475`
- C24 moisture support score: `0.57993`
- C26 moisture support score: `0.57525`

## Interpretation

- C26 did recover some useful upper-branch and return-flow behavior relative to C24, and it modestly improved both cross-equatorial flux and NH dry-belt ocean condensation.
- But that shoulder restore also reloaded the lower branch, the 35° import burden, and cloud recirculation.
- That means the C26 restore was directionally useful but slightly too strong: the right next move is to keep the restored shoulder concept while weakening it.

## Next experiment contract

- Keep the C17 carryover carveout fixed.
- Keep the C24 inner-core narrowing as the baseline lower-mid relief anchor.
- Preserve some of the C26 upper-branch and return-flow recovery while trimming the lower-branch reload.
- Candidate focus lanes:
  - `keep the C24 0–10° / 0.45 inner-core anchor`
  - `retain only a weaker shoulder restoration than C26, closer to a 0–11° / 0.47 or similarly reduced restore`
  - `preserve the C26 upper-branch and return-flow relief while trimming the lower-branch reload and cloud-recirculation rebound`

