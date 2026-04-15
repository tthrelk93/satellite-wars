# Phase 1ZX North Source Concentration Patch Design

## Verdict

- live_leak_signal_driven_source_cap_preferred
- keep weak-hemi taper: `true`
- Next phase: Phase 1ZY: Implement Capped North Source Concentration Penalty Patch
- Keep the weak-hemi floor taper from Phase 1ZV. Do not add a local humidity or omega boost at 11.25N. The next patch should reuse the already-live northside leak signal as a direct capped source-row concentration penalty in vertical5.js/core5.js, applied only in the 9-13N source window.

## Why Concentration Is The Right Patch Lane

- 11.25°N condensation delta: `0.02481`
- 11.25°N total-column-water delta: `-0.085`
- 11.25°N BL RH delta: `-0.002`
- 11.25°N lower/mid omega deltas: `-0.00054` / `-0.00103`
- 11.25°N live leak penalty on: `0.06339`
- 11.25°N total-water-flux-north delta: `-1.00552`
- 11.25°N precip-reevap delta: `-0.00272`

## Supporting Lane Evidence

- 3.75°N condensation delta: `-0.00238`
- 18.75°N condensation delta: `-0.01008`
- 26.25°N condensation delta: `-0.01896`
- -11.25° condensation delta: `-0.0215`
- local recharge signal: `0`
- dry-neighbor relief: `0.03142`
- export-weakening signal: `0.01602`
- concentration signal: `0.07225`

## Candidate Ranking

- north_source_concentration_penalty: `0.13564`
- poleward_export_preserving_bridge: `0.03487`
- local_humidity_omega_boost: `-0.02481`
- global_source_amplitude_reduction: `-0.03142`

## Patch Contract

- keep the Phase 1ZV weak-hemi cross-hemi floor taper active
- patch the north 9-13N source loop in vertical5.js rather than the target lane or shoulder selector lane
- drive the new cap directly from the already-live northside leak penalty signal and source support, not from another admission gate
- apply the cap only in the NH source window and keep the south mirror untouched
- cap the penalty below broad amplitude-retune territory so the 18.75N and 26.25N dry-lane wins are preserved
- do not add a local humidity sink or omega boost at 11.25N

## Guardrail Context

- itcz width delta: `-0.072`
- dry north delta: `-0.024`
- dry south delta: `-0.004`
- north dry-belt ocean condensation delta: `-0.01518`
