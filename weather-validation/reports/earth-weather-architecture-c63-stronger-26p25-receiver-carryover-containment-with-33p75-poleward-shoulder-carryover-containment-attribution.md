# Earth Weather Architecture C63 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment Attribution

This phase attributes the active C62 poleward-shoulder containment result relative to the C60 middle state. The goal is to identify whether C62 actually resolves the C60 repayment lane, or whether it simply shifts the remaining blocker into a different transport branch.

- decision: `poleward_shoulder_containment_recaptures_receiver_and_nh_ocean_rebound_but_35deg_eddy_import_remains_primary_blocker`
- next move: Architecture C64: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening experiment

## C60 vs C62 quick result

- cross-equatorial vapor flux north: C60 `-318.81218`, C62 `-318.32449`
- ITCZ width: C60 `23.287`, C62 `23.386`
- NH dry-belt ratio: C60 `1.07`, C62 `1.057`
- SH dry-belt ratio: C60 `0.48`, C62 `0.487`
- NH midlatitude westerlies: C60 `1.194`, C62 `1.214`
- NH dry-belt ocean condensation: C60 `0.15491`, C62 `0.13629`

## Receiver and shoulder relief

- NH ocean imported anvil persistence: C60 `0.16602`, C62 `0.10603`
- NH ocean carried-over upper cloud: C60 `0.16611`, C62 `0.10614`
- NH ocean weak-erosion survival: C60 `0.16078`, C62 `0.10274`
- 18.75° vapor flux north: C60 `-232.358`, C62 `-233.953`
- 18.75° carried-over upper cloud: C60 `0.089`, C62 `0.094`
- 26.25° vapor flux north: C60 `-594.845`, C62 `-564.64`
- 26.25° carried-over upper cloud: C60 `0.066`, C62 `0.062`
- 33.75° carried-over upper cloud: C60 `0.513`, C62 `0.418`
- 33.75° upper-cloud path: C60 `0.513`, C62 `0.418`

## Remaining 35° interface blocker

- 35° dominant NH dry-belt vapor import: C60 `-22.79697`, C62 `-24.15339`
- 35° lower zonal-mean total-water flux north: C60 `-19.86124`, C62 `-17.71568`
- 35° lower eddy total-water flux north: C60 `-2.23325`, C62 `-6.31372`
- 35° mid zonal-mean total-water flux north: C60 `-16.79342`, C62 `-14.98167`
- 35° mid eddy total-water flux north: C60 `-0.42171`, C62 `-3.60499`
- 35° upper zonal-mean total-water flux north: C60 `-7.70866`, C62 `-7.33442`
- 35° upper eddy total-water flux north: C60 `0.48228`, C62 `-0.7501`

## Interpretation

- C62 is a real improvement over C60 on the receiver side. It recaptures `26.25°` carryover, unloads the `33.75°` shoulder, and materially recovers NH dry-belt ocean maintenance metrics.
- C62 also helps the broad climate objective a bit more than C60, including a small additional relief in cross-equatorial vapor flux north.
- The remaining blocker is now sharper, not broader: the `35°` interface zonal-mean branch improves, but the `35°` eddy branch worsens across the lower, mid, and upper troposphere. That eddy-side repayment is now the dominant reason the sign defect stays severe.
- The next bounded move should keep the active C62 carryover controls fixed and soften only the `35°` interface eddy-rescaling lane. That lets us test the live blocker directly without giving back the now-helpful `26.25°` and `33.75°` containment wins.

## Next experiment contract

- Keep the active C62 `18.75°` transition preserve fixed.
- Keep the active stronger `26.25°` receiver carryover containment fixed.
- Keep the active `33.75°` poleward-shoulder carryover containment fixed.
- Add only a narrow `35°` interface eddy-softening carveout in `windEddyNudge5.js` and judge whether the remaining eddy import burden can be reduced without reopening the NH ocean rebound family.

