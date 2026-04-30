# Phase 1ZW North Source Rebound Attribution

## Verdict

- north_source_condensation_concentration_without_local_recharge
- keep weak-hemi taper: `true`
- Next phase: Phase 1ZX: North Source Concentration Patch Design
- Keep the Phase 1ZV weak-hemi floor taper. Do not chase the remaining 11.25N rebound with a local humidity or omega boost. The next patch should be a capped source-concentration containment lane in vertical5.js/core5.js around the 9-13N source row.

## Why The Remaining 11.25°N Rebound Is Not Local Recharge

- 11.25°N condensation delta: `0.02481`
- 11.25°N total-column-water delta: `-0.085`
- 11.25°N BL RH delta: `-0.002`
- 11.25°N lower-RH delta: `-0.003`
- 11.25°N mid-RH delta: `-0.005`
- 11.25°N lower-omega delta: `-0.00054`
- 11.25°N mid-omega delta: `-0.00103`
- 11.25°N source-support delta: `0.00127`
- 11.25°N leak-penalty delta: `0.00114`

## Concentration Evidence

- 18.75°N condensation delta: `-0.01008`
- 26.25°N condensation delta: `-0.01896`
- 3.75°N condensation delta: `-0.00238`
- -11.25° condensation delta: `-0.0215`
- cross-equatorial vapor-flux delta: `1.21412`
- concentration signal: `0.06599`
- local recharge signal: `0`

## Guardrail Context

- itcz width delta: `-0.072`
- dry north delta: `-0.024`
- dry south delta: `-0.004`
- north dry-belt ocean condensation delta: `-0.01518`

## Practical Read

- The Phase 1ZV taper is still worth keeping.
- The remaining north-side miss is now a same-hemisphere source-row concentration problem around `11.25°N`, not a new humidity recharge lane.
- The next patch should stay in the `vertical5.js` / `core5.js` lane and contain source-row concentration before turning up any broader amplitude.
