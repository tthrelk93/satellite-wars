# Phase 1ZI Equatorial-Edge Candidate Gate Design

## Verdict

- single_lane_geometry_overadmits_equatorial_edge
- Next phase: Phase 1ZJ: Implement Split-Lane Equatorial-Edge Candidate Gate Patch
- Do not tune amplitude first. Implement a split-lane candidate gate so the equatorial edge must earn admission with stronger fresh subtropical support than the inner shoulder.

## Why The Current Gate Is Wrong

- Phase 1ZB still admitted both the 3.75°N edge and 11.25°N inner shoulder through the same shoulder lane.
- Phase 1ZG improved the climate guardrails overall, but 3.75°N still rebounded:
  - candidate delta: `0.0701`
  - event-count delta: `0.52084`
  - applied suppression delta: `0.02352`
  - condensation delta: `0.04637`
- The inner shoulder and spillover are already moving the right way:
  - 11.25°N condensation delta: `-0.03849`
  - 18.75°N spillover delta: `-0.01806`
  - 33.75°N target-entry applied suppression: `0`

## Design Choice

- Split-lane equatorial-edge candidate gate
- The current single shoulder window admits both 3.75°N and 11.25°N as one lane, but only the equatorial edge rebounds. The next gate must split those lanes and apply a stricter edge-only admission rule tied to fresh subtropical support.

## Preserve

- keep buffered_rainout as the suppressed-mass fate
- keep the 30–45°N target-entry exclusion intact
- keep the 11.25°N inner-shoulder improvement
- keep the 18.75°N spillover improvement

## Change

- split the current shoulder latitude window into an equatorial-edge lane and an inner-shoulder lane in vertical5.js
- publish new fresh-state diagnostics for the equatorial-edge and inner-shoulder windows through state5.js and diagnostics.js
- replace the single shoulder band-window support in microphysics5.js with split-lane support
- apply an edge-only candidate-entry penalty or higher support threshold that scales with weak fresh subtropical suppression / weak fresh subtropical band support
- avoid increasing total buffered removal first; reduce raw candidate/event generation at 3–6°N instead
