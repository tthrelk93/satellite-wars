# Earth Weather Architecture C14 Sign Contract Implementation Attribution

This phase attributes what is still wrong after the C13 sign-contract experiment. The goal is to distinguish whether the remaining equatorial polarity defect lives in the preserved current low-level nudging layer or in the donor-controlled vertical overturning scaffold.

- decision: `zonal_mean_equatorial_reversal_still_vertical_scaffold_controlled`
- next move: Architecture C15: equatorial vertical-state contract experiment

## C10 vs C13 equatorial comparison

- total cross-equatorial vapor flux north: C10 `-371.9765`, C13 `-330.9854`
- equatorial low-level velocity mean: C10 `-20.46744`, C13 `-19.4512`
- equatorial low-level zonal-mean vapor flux north: C10 `-274.70821`, C13 `-301.63909`
- equatorial low-level eddy vapor flux north: C10 `-105.45284`, C13 `-34.29106`

## Attribution

- C13 improved the eddy-side failure relative to C10, but the zonal-mean equatorial branch stayed strongly southward and became more negative.
- That pattern means the current low-level nudging preserve layer is not the dominant remaining blocker.
- The stronger evidence now points at the donor-controlled vertical overturning scaffold: the part that sets the zonal-mean equatorial branch before eddy corrections can rescue it.

## Contract for the next experiment

- Keep the donor-base hybrid and the current low-level preserve layer from C13.
- Add [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) from current as the bounded implementation lane.
- Patch donor `core5.js` only where current vertical-state defaults must be made explicit:
  - `vertParams.rhTrig: 0.75 -> 0.72`
  - `vertParams.rhMidMin: 0.25 -> 0.22`
  - `vertParams.omegaTrig: 0.3 -> 0.2`
  - `vertParams.instabTrig: 3 -> 2.5`
  - `vertParams.qvTrig: 0.002 -> 0.0018`
  - `vertParams.thetaeCoeff: 10 -> 10.5`
  - `vertParams convective potential/organization timing block from current vertical contract`
  - `vertParams tropicalOrganizationBandDeg and subtropicalSubsidence contract from current vertical contract`

## Evidence

- C13 softened the eddy reversal relative to C10: `-105.45284` -> `-34.29106`, but the zonal-mean branch worsened: `-274.70821` -> `-301.63909`.
- Current vertical scaffold includes the modern cross-hemi subtropical contract: `true`; archive donor vertical scaffold includes it: `false`.
- Current vs archive dynamics diff exists: `false`; this keeps the next experiment out of the dynamics lane and inside the vertical-scaffold lane.

