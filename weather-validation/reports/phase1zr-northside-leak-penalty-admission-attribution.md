# Phase 1ZR Northside Leak Penalty Admission Attribution

## Verdict

- supported_subset_risk_below_gate
- Next phase: Phase 1ZS: Northside Leak Risk Gate Redesign
- Keep the 1ZQ lane disabled by default. The northside source row is live and partially occupied, but its active supported subset still does not clear the leak-risk entry gate. The next patch should redesign the leak admission around supported-source-normalized risk instead of simply increasing amplitude.

## Northside Source Admission

- 11.25°N source support: `0.13665`
- 11.25°N source window: `0.45833`
- 11.25°N row-mean leak risk: `0.16908`
- 11.25°N active-subset leak risk: `0.3689`
- 11.25°N leak penalty: `0`
- risk threshold miss versus `0.55`: `0.1811`

## Why This Is Not A Wiring Bug

- 3.75°N penalty remains `0`
- -11.25° source window remains `0` by NH-only design
- the north row still carries live support, but its admitted subset never reaches the entry gate

## Live Source Terms

- 11.25°N fresh subtropical band: `0.08427`
- 11.25°N fresh neutral-to-subsiding support: `0.36527`
- 11.25°N lower omega: `0.17391`
- 11.25°N condensation: `0.13552`

## Next Step

- keep: keep the bilateral equatorial-edge subsidence guard geometry
- keep: keep the northside leak-penalty wiring and diagnostics behind the runtime toggle
- keep: keep the south-edge stabilization intact
- change: redesign leak admission around supported-source-normalized risk instead of the current stricter raw risk gate
- change: treat the dominant miss as weak live subtropical-band admission on the NH source subset, not as a wiring failure
- change: do not increase global amplitude until the source-row risk gate actually becomes live
